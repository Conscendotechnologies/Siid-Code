import * as path from "path"
import fs from "fs/promises"

import NodeCache from "node-cache"
import { safeWriteJson } from "../../../utils/safeWriteJson"

import { ContextProxy } from "../../../core/config/ContextProxy"
import { getCacheDirectoryPath } from "../../../utils/storage"
import { RouterName, ModelRecord } from "../../../shared/api"
import { fileExistsAtPath } from "../../../utils/fs"

import { getOpenRouterModels } from "./openrouter"
import { getRequestyModels } from "./requesty"
import { getGlamaModels } from "./glama"
import { getUnboundModels } from "./unbound"
import { getLiteLLMModels } from "./litellm"
import { GetModelsOptions } from "../../../shared/api"
import { getOllamaModels } from "./ollama"
import { getLMStudioModels } from "./lmstudio"
import { anthropicCacheKey, describeAnthropicError, getAnthropicModels, getAnthropicStaticModels } from "./anthropic"

const memoryCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 5 * 60 })

// Last successful Anthropic list per credential hash. Never expires, so synchronous readers
// (AnthropicHandler.getModel, called by Task for context-window math) keep real model info
// after the 5 minute memory TTL lapses, until a refresh replaces it. Seeded once per process
// from `anthropic_models.json`, so an extension restart does not revert to defaults either.
const lastGoodAnthropic = new Map<string, ModelRecord>()

// A list read from a legacy (flat, unkeyed) `anthropic_models.json`: usable for any credentials.
let legacyDiskAnthropic: ModelRecord | undefined

// In-flight Anthropic fetches per credential hash, so concurrent callers share one request.
const inFlightAnthropic = new Map<string, Promise<ModelRecord>>()

let anthropicSeedPromise: Promise<void> | undefined

export function getLastGoodAnthropicModels(cacheKey: string): ModelRecord | undefined {
	return lastGoodAnthropic.get(cacheKey) ?? legacyDiskAnthropic
}

/** Format of `anthropic_models.json`: one list per credential hash (the raw key never appears). */
type AnthropicModelsFile = { format: 2; lists: Record<string, ModelRecord> }

function isAnthropicModelsFile(data: unknown): data is AnthropicModelsFile {
	return (
		!!data &&
		typeof data === "object" &&
		(data as AnthropicModelsFile).format === 2 &&
		typeof (data as AnthropicModelsFile).lists === "object"
	)
}

/**
 * Seed the last-good map from disk once per process. Safe to call repeatedly
 * and from synchronous-ish paths: it never throws and the result is memoised.
 */
export function ensureAnthropicLastGoodSeeded(): Promise<void> {
	if (!anthropicSeedPromise) {
		anthropicSeedPromise = (async () => {
			try {
				const data = await readModels("anthropic")
				if (!data) return
				if (isAnthropicModelsFile(data)) {
					for (const [key, list] of Object.entries(data.lists)) {
						if (list && typeof list === "object" && !lastGoodAnthropic.has(key)) {
							lastGoodAnthropic.set(key, list)
						}
					}
				} else if (typeof data === "object" && Object.keys(data).length > 0) {
					legacyDiskAnthropic = data as ModelRecord
				}
			} catch (error) {
				console.warn(
					"[getModels] Could not seed Anthropic model list from disk:",
					describeAnthropicError(error),
				)
			}
		})()
	}
	return anthropicSeedPromise
}

/** Test hook: forget everything the Anthropic last-good state remembers. */
export function resetAnthropicLastGoodForTests() {
	lastGoodAnthropic.clear()
	legacyDiskAnthropic = undefined
	inFlightAnthropic.clear()
	anthropicSeedPromise = undefined
}

async function writeModels(router: RouterName | "anthropic", data: ModelRecord | AnthropicModelsFile) {
	const filename = `${router}_models.json`
	const cacheDir = await getCacheDirectoryPath(ContextProxy.instance.globalStorageUri.fsPath)
	await safeWriteJson(path.join(cacheDir, filename), data)
}

async function readModels(router: RouterName): Promise<ModelRecord | undefined>
async function readModels(router: "anthropic"): Promise<ModelRecord | AnthropicModelsFile | undefined>
async function readModels(router: RouterName | "anthropic"): Promise<ModelRecord | AnthropicModelsFile | undefined> {
	const filename = `${router}_models.json`
	const cacheDir = await getCacheDirectoryPath(ContextProxy.instance.globalStorageUri.fsPath)
	const filePath = path.join(cacheDir, filename)
	const exists = await fileExistsAtPath(filePath)
	return exists ? JSON.parse(await fs.readFile(filePath, "utf8")) : undefined
}

/**
 * Get models from the cache or fetch them from the provider and cache them.
 * There are two caches:
 * 1. Memory cache - This is a simple in-memory cache that is used to store models for a short period of time.
 * 2. File cache - This is a file-based cache that is used to store models for a longer period of time.
 *
 * @param router - The router to fetch models from.
 * @param apiKey - Optional API key for the provider.
 * @param baseUrl - Optional base URL for the provider (currently used only for LiteLLM).
 * @returns The models from the cache or the fetched models.
 */
export const getModels = async (options: GetModelsOptions): Promise<ModelRecord> => {
	const { provider } = options

	if (provider === "anthropic") {
		return getAnthropicModelsWithFallback(options)
	}

	let models = getModelsFromCache(provider)
	if (models) {
		return models
	}

	try {
		switch (provider) {
			case "openrouter":
				models = await getOpenRouterModels()
				break
			case "requesty":
				// Requesty models endpoint requires an API key for per-user custom policies
				models = await getRequestyModels(options.apiKey)
				break
			case "glama":
				models = await getGlamaModels()
				break
			case "unbound":
				// Unbound models endpoint requires an API key to fetch application specific models
				models = await getUnboundModels(options.apiKey)
				break
			case "litellm":
				// Type safety ensures apiKey and baseUrl are always provided for litellm
				models = await getLiteLLMModels(options.apiKey, options.baseUrl)
				break
			case "ollama":
				models = await getOllamaModels(options.baseUrl)
				break
			case "lmstudio":
				models = await getLMStudioModels(options.baseUrl)
				break
			default: {
				// Ensures router is exhaustively checked if RouterName is a strict union
				const exhaustiveCheck: never = provider
				throw new Error(`Unknown provider: ${exhaustiveCheck}`)
			}
		}

		// Cache the fetched models (even if empty, to signify a successful fetch with no models)
		memoryCache.set(provider, models)
		await writeModels(provider, models).catch((err) =>
			console.error(`[getModels] Error writing ${provider} models to file cache:`, err),
		)

		try {
			models = await readModels(provider)
			// console.log(`[getModels] read ${router} models from file cache`)
		} catch (error) {
			console.error(`[getModels] error reading ${provider} models from file cache`, error)
		}
		return models || {}
	} catch (error) {
		// Log the error and re-throw it so the caller can handle it (e.g., show a UI message).
		console.error(`[getModels] Failed to fetch models in modelCache for ${provider}:`, error)

		throw error // Re-throw the original error to be handled by the caller.
	}
}

/**
 * Anthropic: live list merged with the bundled table. Any failure (no key,
 * network error, non-200) returns the bundled table without throwing and
 * without caching it, so the next request retries. The memory cache key is a
 * hash of key + base URL + auth mode; the raw key never appears in it.
 */
async function getAnthropicModelsWithFallback(
	options: Extract<GetModelsOptions, { provider: "anthropic" }>,
): Promise<ModelRecord> {
	const cacheKey = anthropicCacheKey(options)
	const cached = memoryCache.get<ModelRecord>(cacheKey)
	if (cached) {
		return cached
	}

	if (!options.apiKey) {
		return getAnthropicStaticModels()
	}

	const inFlight = inFlightAnthropic.get(cacheKey)
	if (inFlight) {
		return inFlight
	}

	const request = (async () => {
		await ensureAnthropicLastGoodSeeded()
		try {
			const models = await getAnthropicModels(options)
			memoryCache.set(cacheKey, models)
			lastGoodAnthropic.set(cacheKey, models)
			const file: AnthropicModelsFile = { format: 2, lists: Object.fromEntries(lastGoodAnthropic) }
			await writeModels("anthropic", file).catch((err) =>
				console.error("[getModels] Error writing anthropic models to file cache:", describeAnthropicError(err)),
			)
			return models
		} catch (error) {
			console.warn(
				`[getModels] Anthropic model list unavailable, using bundled list: ${describeAnthropicError(error)}`,
			)
			return getLastGoodAnthropicModels(cacheKey) ?? getAnthropicStaticModels()
		} finally {
			inFlightAnthropic.delete(cacheKey)
		}
	})()

	inFlightAnthropic.set(cacheKey, request)
	return request
}

/**
 * Flush models memory cache for a specific router
 * @param router - The router to flush models for.
 */
export const flushModels = async (router: RouterName | "anthropic") => {
	if (router === "anthropic") {
		memoryCache.del(memoryCache.keys().filter((key) => key.startsWith("anthropic:")))
		return
	}
	memoryCache.del(router)
}

export function getModelsFromCache(provider: string) {
	return memoryCache.get<ModelRecord>(provider)
}

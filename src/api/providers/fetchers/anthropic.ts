import axios from "axios"
import { createHash } from "crypto"

import { type ModelInfo, anthropicModels, ANTHROPIC_DEFAULT_MAX_TOKENS } from "@siid-code/types"

import type { ModelRecord } from "../../../shared/api"

const ANTHROPIC_API_VERSION = "2023-06-01"
const DEFAULT_BASE_URL = "https://api.anthropic.com"
const PAGE_LIMIT = 1000
const MAX_PAGES = 20
const REQUEST_TIMEOUT_MS = 10_000
const DEFAULT_CONTEXT_WINDOW = 200_000

type CapabilitySupport = { supported?: boolean } | null | undefined

/** Shape of one entry of GET /v1/models. Every field except `id` may be absent. */
export type AnthropicApiModel = {
	id: string
	display_name?: string
	created_at?: string
	type?: string
	max_input_tokens?: number | null
	max_tokens?: number | null
	capabilities?: {
		image_input?: CapabilitySupport
		thinking?: { supported?: boolean; types?: { enabled?: CapabilitySupport; adaptive?: CapabilitySupport } } | null
	} | null
}

type AnthropicModelsPage = { data?: AnthropicApiModel[]; has_more?: boolean; last_id?: string | null }

export type AnthropicFetchOptions = { apiKey?: string; baseUrl?: string; useAuthToken?: boolean }

/**
 * Cache key for a (key, base url, auth mode) combination. The API key is only
 * ever hashed, so neither the key nor a usable fragment of it reaches a cache
 * key, log line or file name.
 */
export function anthropicCacheKey({ apiKey, baseUrl, useAuthToken }: AnthropicFetchOptions): string {
	const digest = createHash("sha256")
		.update(`${baseUrl || ""}|${baseUrl && useAuthToken ? "token" : "key"}|${apiKey || ""}`)
		.digest("hex")
		.slice(0, 16)
	return `anthropic:${digest}`
}

/** The bundled table as a plain record, used as the fallback list. */
export function getAnthropicStaticModels(): ModelRecord {
	return { ...(anthropicModels as Record<string, ModelInfo>) }
}

/** Fetch every page of /v1/models. Throws on any failure; never logs credentials. */
export async function fetchAnthropicApiModels({
	apiKey,
	baseUrl,
	useAuthToken,
}: AnthropicFetchOptions): Promise<AnthropicApiModel[]> {
	if (!apiKey) {
		throw new Error("No Anthropic API key configured")
	}

	const root = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "")
	const headers: Record<string, string> = { "anthropic-version": ANTHROPIC_API_VERSION }

	// Mirrors AnthropicHandler: bearer auth only applies with a custom base URL.
	if (baseUrl && useAuthToken) {
		headers["Authorization"] = `Bearer ${apiKey}`
	} else {
		headers["x-api-key"] = apiKey
	}

	const all: AnthropicApiModel[] = []
	let afterId: string | undefined

	for (let page = 0; page < MAX_PAGES; page++) {
		const params: Record<string, string | number> = { limit: PAGE_LIMIT }
		if (afterId) {
			params.after_id = afterId
		}

		const response = await axios.get<AnthropicModelsPage>(`${root}/v1/models`, {
			headers,
			params,
			timeout: REQUEST_TIMEOUT_MS,
		})

		if (response.status !== 200 || !response.data || !Array.isArray(response.data.data)) {
			throw new Error(`Unexpected response from Anthropic models endpoint (status ${response.status})`)
		}

		for (const m of response.data.data) {
			if (m && typeof m.id === "string" && m.id) {
				all.push(m)
			}
		}

		const next = response.data.last_id
		if (!response.data.has_more || !next || next === afterId) {
			break
		}
		afterId = next
	}

	return all
}

const positiveNumber = (n: unknown): number | undefined => (typeof n === "number" && n > 0 ? n : undefined)

/**
 * Merge the API list with the bundled table. The API decides which models
 * exist and wins for limits and capabilities; the table only supplies pricing
 * and metadata for ids it knows. Unknown ids get conservative defaults and no
 * prices (undefined, never 0). Newest first.
 */
export function mergeAnthropicModels(apiModels: AnthropicApiModel[]): ModelRecord {
	const known = anthropicModels as Record<string, ModelInfo>

	const ordered = apiModels
		.map((m, index) => ({ m, index, time: Date.parse(m.created_at ?? "") }))
		.sort((a, b) => {
			const ta = Number.isFinite(a.time) && a.time > 0 ? a.time : undefined
			const tb = Number.isFinite(b.time) && b.time > 0 ? b.time : undefined
			if (ta !== undefined && tb !== undefined && ta !== tb) return tb - ta
			return a.index - b.index
		})

	const result: ModelRecord = {}

	for (const { m } of ordered) {
		if (result[m.id]) continue

		const base = known[m.id]
		const caps = m.capabilities ?? undefined
		const budgetThinking = caps?.thinking?.types?.enabled?.supported
		const thinkingSupported = caps?.thinking?.supported
		const imageInput = caps?.image_input?.supported

		const info: ModelInfo = {
			// Conservative defaults for ids the table does not know.
			maxTokens: ANTHROPIC_DEFAULT_MAX_TOKENS,
			contextWindow: DEFAULT_CONTEXT_WINDOW,
			supportsImages: true,
			supportsPromptCache: true,
			...(base as Partial<ModelInfo> | undefined),
		}

		const contextWindow = positiveNumber(m.max_input_tokens)
		if (contextWindow) info.contextWindow = contextWindow
		const maxTokens = positiveNumber(m.max_tokens)
		if (maxTokens) info.maxTokens = maxTokens
		if (typeof imageInput === "boolean") info.supportsImages = imageInput

		if (typeof budgetThinking === "boolean") {
			info.supportsReasoningBudget = budgetThinking
			if (!budgetThinking) delete info.requiredReasoningBudget
		} else if (!base) {
			// No capability data and no table entry: never send a thinking budget.
			info.supportsReasoningBudget = false
		}

		// Thinking supported but manual budgets are not: newer models that also
		// reject sampling parameters (see Anthropic migration guides).
		if (!base && thinkingSupported === true && budgetThinking === false) {
			info.supportedParameters = ["max_tokens", "reasoning"]
		}

		if (m.display_name && !info.description) info.description = m.display_name

		result[m.id] = info

		// Virtual extended-thinking variant defined by the bundled table.
		const thinkingVariant = known[`${m.id}:thinking`]
		if (thinkingVariant && budgetThinking !== false) {
			result[`${m.id}:thinking`] = { ...thinkingVariant }
		}
	}

	return result
}

/** Live list merged with the table. Throws if the request fails. */
export async function getAnthropicModels(options: AnthropicFetchOptions): Promise<ModelRecord> {
	const merged = mergeAnthropicModels(await fetchAnthropicApiModels(options))
	if (Object.keys(merged).length === 0) {
		throw new Error("Anthropic models endpoint returned no models")
	}
	return merged
}

/** Message safe to log: never includes headers or the key. */
export function describeAnthropicError(error: unknown): string {
	if (axios.isAxiosError(error)) {
		return `${error.code ?? "request failed"}${error.response ? ` (HTTP ${error.response.status})` : ""}`
	}
	return error instanceof Error ? error.message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]") : "unknown error"
}

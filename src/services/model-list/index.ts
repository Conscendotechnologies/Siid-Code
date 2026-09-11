/**
 * Runtime model list.
 *
 * Providers move models between free and paid, grant free access for limited
 * windows, and delist them outright. Shipping the list as code meant a release
 * for every one of those, so it is published as JSON and fetched here.
 *
 * Three sources, in order of preference:
 *   1. the fetched list  - current, replaces the others when it validates
 *   2. the cached list   - the last good fetch, so a cold start is correct offline
 *   3. the bundled list  - compiled in, the floor that guarantees a non-empty list
 *
 * Refresh is event-driven rather than periodic: an idle window makes no
 * requests. See `refreshModelList` for what triggers a fetch.
 */

import * as path from "path"
import fs from "fs/promises"

import axios from "axios"

import { ContextProxy } from "../../core/config/ContextProxy"
import { getCacheDirectoryPath } from "../../utils/storage"
import { fileExistsAtPath } from "../../utils/fs"
import { safeWriteJson } from "../../utils/safeWriteJson"
import { setModelList, type ModelListData } from "../../shared/mode-models"
import { parseModelList } from "../../shared/model-list-schema"

const MODEL_LIST_URL = "https://raw.githubusercontent.com/aman-dhakar-191/siid-configs/main/v1/mode-models.json"

const CACHE_FILENAME = "mode-models.json"
const FETCH_TIMEOUT_MS = 15000

/**
 * Opening the model dropdown triggers a refresh, so repeated opens are
 * collapsed into one request. Deliberately short: the payload is a few KB and
 * CDN-cached, and the case that matters is someone publishing a fix and
 * reopening the picker to see it. A longer window mostly serves stale data.
 */
const THROTTLE_MS = 60 * 1000

let lastFetchAt = 0
let inFlight: Promise<boolean> | null = null

async function cacheFilePath(): Promise<string> {
	const cacheDir = await getCacheDirectoryPath(ContextProxy.instance.globalStorageUri.fsPath)
	return path.join(cacheDir, CACHE_FILENAME)
}

/**
 * Load the cached list, if there is a valid one.
 *
 * A cache that fails validation is deleted: it would otherwise be re-read and
 * re-rejected on every start, and the bundled list is a better floor than a
 * file we already know is bad.
 */
export async function loadCachedModelList(): Promise<ModelListData | undefined> {
	try {
		const filePath = await cacheFilePath()
		if (!(await fileExistsAtPath(filePath))) return undefined

		const result = parseModelList(JSON.parse(await fs.readFile(filePath, "utf8")))
		if (result.ok) return result.data

		console.warn(`[model-list] discarding invalid cached list: ${result.error}`)
		await fs.unlink(filePath).catch(() => {})
	} catch (error) {
		console.warn(`[model-list] could not read cached list:`, error)
	}
	return undefined
}

/**
 * Apply the cached list, then refresh from the network in the background.
 *
 * The cache is awaited so the first dropdown render is already correct offline.
 * The fetch deliberately is not: it must never delay activation, and whatever
 * it returns arrives well before anyone opens the model picker.
 */
export async function initializeModelList(): Promise<void> {
	const cached = await loadCachedModelList()
	if (cached) {
		setModelList(cached)
		console.log(`[model-list] loaded ${cached.models.length} models from cache`)
	}

	// Not awaited: a slow or unreachable network must not hold up startup.
	void refreshModelList(true).catch(() => {})
}

/**
 * Fetch the published list and apply it if it validates.
 *
 * Returns whether the active list changed. Any failure — offline, proxy, 404,
 * malformed payload — leaves the current list untouched, so the worst case is
 * staleness rather than an empty model picker.
 *
 * @param force skip the throttle (used when a request failed because a model is gone)
 */
export async function refreshModelList(force = false): Promise<boolean> {
	const sinceLastFetch = Date.now() - lastFetchAt
	if (!force && sinceLastFetch < THROTTLE_MS) {
		// Logged because a silent skip looks identical to a fetch that returned
		// stale data, which makes "my edit did not show up" hard to diagnose.
		console.log(`[model-list] refresh skipped: throttled, last fetch ${Math.round(sinceLastFetch / 1000)}s ago`)
		return false
	}

	// Collapse concurrent callers onto one request.
	if (inFlight) return inFlight

	inFlight = (async () => {
		// Stamped on attempt rather than on success: a failing network would
		// otherwise leave this at 0 and retry on every single dropdown open.
		lastFetchAt = Date.now()

		try {
			const response = await axios.get(MODEL_LIST_URL, {
				timeout: FETCH_TIMEOUT_MS,
				// A proxy or captive portal may answer with an HTML error page.
				responseType: "json",
				headers: { Accept: "application/json" },
			})

			const result = parseModelList(response.data)
			if (!result.ok) {
				console.warn(`[model-list] rejected fetched list: ${result.error}`)
				return false
			}

			setModelList(result.data)
			console.log(`[model-list] updated to ${result.data.models.length} models from ${MODEL_LIST_URL}`)

			await safeWriteJson(await cacheFilePath(), result.data).catch((error) =>
				console.warn(`[model-list] could not write cache:`, error),
			)

			return true
		} catch (error) {
			console.warn(
				`[model-list] fetch failed, keeping current list:`,
				error instanceof Error ? error.message : error,
			)
			return false
		} finally {
			inFlight = null
		}
	})()

	return inFlight
}

/**
 * Whether an error means the model no longer exists, rather than a transient
 * failure. A delisted model is exactly the case a stale list causes, so it is
 * worth spending a fetch to see if the fix is already published.
 */
export function isModelUnavailableError(error: any): boolean {
	if (error?.status === 404 || error?.error?.code === 404) return true

	const message = typeof error?.message === "string" ? error.message.toLowerCase() : ""
	return (
		message.includes("no endpoints found") ||
		message.includes("no allowed providers") ||
		(message.includes("not a valid model") && message.includes("404"))
	)
}

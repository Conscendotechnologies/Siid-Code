/*---------------------------------------------------------------------------------------------
 *  Diff the curated model list against OpenRouter's live catalogue.
 *
 *  Models come and go: a provider moves one from free to paid, grants free access for a limited
 *  window, or removes it outright. None of that reaches us — the curated list is data we
 *  maintain, so a delisted model keeps being offered until someone notices. This script is the
 *  noticing.
 *
 *  Reports three kinds of drift:
 *    GONE      - listed by us, absent from the catalogue (requests 404)
 *    RE-TIERED - we call it Free but it now costs money, or vice versa
 *    NEW FREE  - free on OpenRouter and not in our list (a candidate, never automatic:
 *                a model has to be tested before it is offered)
 *
 *  Exits 1 when drift is found so CI can fail; --warn-only exits 0 for local use.
 *  FAIL-OPEN on infrastructure trouble: no network, non-200, unparseable body → exit 0 with a
 *  notice. A catalogue check must not become a broken build when OpenRouter has a bad minute.
 *--------------------------------------------------------------------------------------------*/
"use strict"

const fs = require("fs")
const path = require("path")

const RED = "\x1b[31m"
const YELLOW = "\x1b[33m"
const GREEN = "\x1b[32m"
const DIM = "\x1b[2m"
const RESET = "\x1b[0m"

const CATALOGUE_URL = "https://openrouter.ai/api/v1/models"
const TIMEOUT_MS = 30000

/**
 * Where to find the curated list. Prefers the JSON (the runtime source of truth) and falls
 * back to parsing the TypeScript module, so this works both before and after the list moves
 * to JSON.
 */
const JSON_PATH = path.join(__dirname, "..", "src", "shared", "mode-models.json")
const TS_PATH = path.join(__dirname, "..", "src", "shared", "mode-models.ts")

/**
 * A model is free only when both prompt and completion cost nothing. Models priced per
 * request rather than per token (image and audio models) quote "0" for both, so they are
 * excluded — they are not free text models and do not belong in the list.
 */
function isFree(model) {
	const pricing = model && model.pricing
	if (!pricing) return false
	if (pricing.prompt === undefined || pricing.completion === undefined) return false
	const perRequest = parseFloat(pricing.request || "0")
	if (perRequest > 0) return false
	return parseFloat(pricing.prompt) === 0 && parseFloat(pricing.completion) === 0
}

/** Text-capable models only; the curated list is for chat/completion use. */
function isTextModel(model) {
	const modality = model && model.architecture && model.architecture.modality
	if (!modality) return true
	return modality.includes("text->text")
}

/** Read the curated list from JSON, or from the TS module while it still lives there. */
function readCuratedModels() {
	if (fs.existsSync(JSON_PATH)) {
		const data = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"))
		const models = Array.isArray(data.models) ? data.models : []
		return models.map((m) => ({ modelId: m.modelId, tier: m.tier }))
	}

	// Fall back to the TS list: pull modelId/tier pairs regardless of how prettier
	// happened to wrap each entry.
	const source = fs.readFileSync(TS_PATH, "utf8")
	const seen = new Map()
	const entryPattern = /modelId:\s*"([^"]+)"[\s\S]{0,200}?tier:\s*"([^"]+)"/g
	let match
	while ((match = entryPattern.exec(source)) !== null) {
		if (!seen.has(match[1])) seen.set(match[1], match[2])
	}
	return [...seen].map(([modelId, tier]) => ({ modelId, tier }))
}

async function fetchCatalogue() {
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
	try {
		const response = await fetch(CATALOGUE_URL, { signal: controller.signal })
		if (!response.ok) return { error: `HTTP ${response.status}` }
		const body = await response.json()
		if (!body || !Array.isArray(body.data)) return { error: "unexpected response shape" }
		return { models: body.data }
	} catch (error) {
		return { error: error.name === "AbortError" ? `timed out after ${TIMEOUT_MS}ms` : error.message }
	} finally {
		clearTimeout(timer)
	}
}

async function main() {
	const warnOnly = process.argv.includes("--warn-only")

	let curated
	try {
		curated = readCuratedModels()
	} catch (error) {
		console.log(`${YELLOW}notice${RESET} could not read the curated model list: ${error.message}`)
		process.exit(0)
	}

	if (curated.length === 0) {
		console.log(`${YELLOW}notice${RESET} the curated model list is empty; nothing to check`)
		process.exit(0)
	}

	const { models: catalogue, error } = await fetchCatalogue()
	if (error) {
		console.log(`${YELLOW}notice${RESET} skipping model availability check: ${error}`)
		process.exit(0)
	}

	const live = new Map(catalogue.map((m) => [m.id, m]))
	const curatedIds = new Set(curated.map((m) => m.modelId))

	const gone = []
	const reTiered = []
	for (const model of curated) {
		const liveModel = live.get(model.modelId)
		if (!liveModel) {
			gone.push(model)
			continue
		}
		const freeNow = isFree(liveModel)
		if (model.tier === "Free" && !freeNow) {
			reTiered.push({ ...model, detail: `now costs $${liveModel.pricing.prompt}/token prompt` })
		} else if (model.tier !== "Free" && freeNow) {
			reTiered.push({ ...model, detail: "is now free" })
		}
	}

	const newlyFree = catalogue.filter((m) => isFree(m) && isTextModel(m) && !curatedIds.has(m.id)).map((m) => m.id)

	console.log(`${DIM}checked ${curated.length} curated models against ${catalogue.length} on OpenRouter${RESET}\n`)

	if (gone.length > 0) {
		console.log(`${RED}GONE${RESET} — listed by us but absent from OpenRouter (requests will 404):`)
		for (const model of gone) console.log(`  ${model.modelId} ${DIM}(we list it as ${model.tier})${RESET}`)
		console.log("")
	}

	if (reTiered.length > 0) {
		console.log(`${RED}RE-TIERED${RESET} — our tier no longer matches OpenRouter's pricing:`)
		for (const model of reTiered)
			console.log(`  ${model.modelId} ${DIM}(we say ${model.tier}, ${model.detail})${RESET}`)
		console.log("")
	}

	if (newlyFree.length > 0) {
		console.log(
			`${YELLOW}NEW FREE${RESET} — free on OpenRouter, not in our list ${DIM}(test before adding)${RESET}:`,
		)
		for (const id of newlyFree) console.log(`  ${id}`)
		console.log("")
	}

	const drifted = gone.length + reTiered.length
	if (drifted === 0) {
		console.log(`${GREEN}ok${RESET} every curated model exists and its tier matches`)
		process.exit(0)
	}

	console.log(`${RED}${drifted} model(s) need attention${RESET} — update the model list JSON, no release required`)
	process.exit(warnOnly ? 0 : 1)
}

main().catch((error) => {
	// Unexpected failure is still infrastructure trouble, not list drift.
	console.log(`${YELLOW}notice${RESET} model availability check failed: ${error.message}`)
	process.exit(0)
})

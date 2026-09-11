/**
 * Mode-to-Models mapping
 *
 * The model list is data, not code: providers move models between free and paid,
 * grant free access for limited windows, and delist them outright. The list is
 * fetched at runtime (see `model-list-source.ts`) so those changes reach users
 * without a release.
 *
 * The bundled JSON below is the floor, not the source of truth — it is what a
 * fresh offline install falls back to. `setModelList` replaces it once a cached
 * or fetched list is available.
 */

import bundledModelList from "./mode-models.json"

export interface ModeModelInfo {
	modelId: string
	displayName: string
	provider?: "openrouter" | "anthropic" | "openai" | "other"
	tier?: "Free" | "Basic" | "Medium" | "Advanced" | "Premium"
}

/** A mode's offering: model ids in priority order, plus which one it recommends. */
export interface ModeModelConfig {
	recommended?: string
	models: string[]
}

/** The shape of the model list JSON, bundled or fetched. */
export interface ModelListData {
	version: number
	defaultModelId: string
	defaultPaidModelId?: string
	models: ModeModelInfo[]
	modes: Record<string, ModeModelConfig>
}

/**
 * The active list. Starts as the bundled copy so lookups work before any
 * network call, and is swapped wholesale by `setModelList`.
 */
let activeList: ModelListData = bundledModelList as ModelListData

/** Resolved per mode and rebuilt on swap, since lookups happen on hot paths. */
let modelsByMode: Record<string, ModeModelInfo[]> = {}

function rebuildIndex() {
	const byId = new Map(activeList.models.map((model) => [model.modelId, model]))
	const next: Record<string, ModeModelInfo[]> = {}

	for (const [mode, config] of Object.entries(activeList.modes)) {
		next[mode] = config.models
			.map((modelId) => byId.get(modelId))
			.filter((model): model is ModeModelInfo => model !== undefined)
			// The list omits `provider` when it is the default.
			.map((model) => ({ provider: "openrouter" as const, ...model }))
	}

	modelsByMode = next
}

rebuildIndex()

/**
 * Replace the active model list. Callers are responsible for validating the
 * data first (see `parseModelList`); this trusts what it is given.
 */
export function setModelList(data: ModelListData): void {
	activeList = data
	rebuildIndex()
}

/** The list currently in use, for diagnostics. */
export function getModelList(): ModelListData {
	return activeList
}

/** The list compiled into this build, used as the offline floor. */
export function getBundledModelList(): ModelListData {
	return bundledModelList as ModelListData
}

/**
 * Every mode that offers models, mapped to its list. The key set is the
 * allowlist: a mode absent from it resolves to an empty array, which callers
 * read as "no model picker here".
 */
export function getAllModeModels(): Record<string, ModeModelInfo[]> {
	return modelsByMode
}

/**
 * Get available models for a mode
 * Returns empty array if mode not found
 */
export function getModelsForMode(modeSlug: string): ModeModelInfo[] {
	return modelsByMode[modeSlug] || []
}

/**
 * Get the default (first) model for a mode
 * Returns undefined if mode not found or no models available
 */
export function getDefaultModelForMode(modeSlug: string): ModeModelInfo | undefined {
	return getModelsForMode(modeSlug)[0]
}

/**
 * Get the model id a mode recommends, if any
 */
export function getRecommendedModelForMode(modeSlug: string): string | undefined {
	return activeList.modes[modeSlug]?.recommended
}

/**
 * Check if a model is available for a mode
 */
export function isModelAvailableForMode(modeSlug: string, modelId: string): boolean {
	return getModelsForMode(modeSlug).some((m) => m.modelId === modelId)
}

/**
 * The model a fresh install starts on
 */
export function getDefaultModelId(): string {
	return activeList.defaultModelId
}

/**
 * The model a fresh install starts on for the paid profile
 */
export function getDefaultPaidModelId(): string | undefined {
	return activeList.defaultPaidModelId
}

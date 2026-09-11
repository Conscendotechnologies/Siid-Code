/**
 * Validation for the runtime model list.
 *
 * The list is fetched from a public URL and drives which models users can pick
 * and which ones the 429 fallback walks. A malformed or truncated payload must
 * never replace a working list, so everything here is written to reject rather
 * than coerce: a failure means "keep what we have", which degrades to a stale
 * list instead of an empty dropdown.
 */

import { z } from "zod"

import type { ModelListData } from "./mode-models"

const modelSchema = z.object({
	modelId: z.string().min(1),
	displayName: z.string().min(1),
	provider: z.enum(["openrouter", "anthropic", "openai", "other"]).optional(),
	tier: z.enum(["Free", "Basic", "Medium", "Advanced", "Premium"]),
})

const modeSchema = z.object({
	recommended: z.string().min(1).optional(),
	models: z.array(z.string().min(1)).min(1),
})

const modelListSchema = z.object({
	// Pinned: an unknown version means a format this build cannot read, so it is
	// safer to keep the current list than to guess at the new shape.
	version: z.literal(1),
	defaultModelId: z.string().min(1),
	defaultPaidModelId: z.string().min(1).optional(),
	models: z.array(modelSchema).min(1),
	modes: z.record(z.string(), modeSchema),
})

export type ModelListParseResult = { ok: true; data: ModelListData } | { ok: false; error: string }

/**
 * Parse and validate a model list payload.
 *
 * Beyond the shape, this enforces the cross-references the runtime depends on:
 * ids in a mode must exist, a recommendation must be offered by its own mode,
 * and every mode needs a free model or its fallback chain is empty.
 */
export function parseModelList(raw: unknown): ModelListParseResult {
	const parsed = modelListSchema.safeParse(raw)
	if (!parsed.success) {
		const issue = parsed.error.issues[0]
		return { ok: false, error: `${issue.path.join(".") || "payload"}: ${issue.message}` }
	}

	const data = parsed.data

	const ids = new Set<string>()
	for (const model of data.models) {
		if (ids.has(model.modelId)) {
			return { ok: false, error: `duplicate model "${model.modelId}"` }
		}
		ids.add(model.modelId)
	}

	if (Object.keys(data.modes).length === 0) {
		return { ok: false, error: "no modes defined" }
	}

	const freeIds = new Set(data.models.filter((m) => m.tier === "Free").map((m) => m.modelId))

	for (const [mode, config] of Object.entries(data.modes)) {
		for (const modelId of config.models) {
			// A dangling id would silently drop a model from that mode's picker.
			if (!ids.has(modelId)) {
				return { ok: false, error: `mode "${mode}" references unknown model "${modelId}"` }
			}
		}
		if (config.recommended && !config.models.includes(config.recommended)) {
			return { ok: false, error: `mode "${mode}" recommends "${config.recommended}", which it does not offer` }
		}
		if (!config.models.some((modelId) => freeIds.has(modelId))) {
			return { ok: false, error: `mode "${mode}" has no free model, so it has no fallback chain` }
		}
	}

	if (!ids.has(data.defaultModelId)) {
		return { ok: false, error: `defaultModelId "${data.defaultModelId}" is not in the list` }
	}
	if (data.defaultPaidModelId && !ids.has(data.defaultPaidModelId)) {
		return { ok: false, error: `defaultPaidModelId "${data.defaultPaidModelId}" is not in the list` }
	}

	return { ok: true, data }
}

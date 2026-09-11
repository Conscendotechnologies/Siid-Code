import { describe, it, expect, afterEach } from "vitest"

import {
	getAllModeModels,
	getModelsForMode,
	getDefaultModelForMode,
	getRecommendedModelForMode,
	isModelAvailableForMode,
	setModelList,
	getBundledModelList,
	getDefaultModelId,
} from "../mode-models"
import { getFallbackChain, getPrimaryModel } from "../model-fallback"

describe("mode-models", () => {
	describe("getModelsForMode", () => {
		it("returns the model list for each known mode", () => {
			for (const mode of ["salesforce-agent", "code", "orchestrator"]) {
				expect(getModelsForMode(mode).length).toBeGreaterThan(0)
			}
		})

		// Unknown modes must stay empty: model-fallback skips fallback on an empty
		// chain and ModelSelector renders nothing, so leaking the full list here
		// would silently give every mode a model picker.
		it("returns an empty array for an unknown mode", () => {
			expect(getModelsForMode("no-such-mode")).toEqual([])
		})

		it("does not fall back to a wildcard entry", () => {
			expect(getAllModeModels()["*"]).toBeUndefined()
		})
	})

	describe("list integrity", () => {
		it("has no duplicate model ids within a mode", () => {
			for (const mode of Object.keys(getAllModeModels())) {
				const ids = getAllModeModels()[mode].map((m) => m.modelId)
				expect(new Set(ids).size).toBe(ids.length)
			}
		})

		it("gives every model a non-empty id and display name", () => {
			for (const mode of Object.keys(getAllModeModels())) {
				for (const model of getAllModeModels()[mode]) {
					expect(model.modelId).toBeTruthy()
					expect(model.displayName).toBeTruthy()
				}
			}
		})

		it("keeps at least one free model so the fallback chain is never empty", () => {
			for (const mode of Object.keys(getAllModeModels())) {
				expect(getAllModeModels()[mode].some((m) => m.tier === "Free")).toBe(true)
			}
		})
	})

	describe("getDefaultModelForMode", () => {
		it("returns the first model in list order", () => {
			const models = getModelsForMode("code")
			expect(getDefaultModelForMode("code")).toEqual(models[0])
		})

		it("returns undefined for an unknown mode", () => {
			expect(getDefaultModelForMode("no-such-mode")).toBeUndefined()
		})
	})

	describe("isModelAvailableForMode", () => {
		it("is true for a model in the list", () => {
			const first = getModelsForMode("code")[0]
			expect(isModelAvailableForMode("code", first.modelId)).toBe(true)
		})

		it("is false for a model that is not in the list", () => {
			expect(isModelAvailableForMode("code", "vendor/removed-model")).toBe(false)
		})

		it("is false for an unknown mode", () => {
			const first = getModelsForMode("code")[0]
			expect(isModelAvailableForMode("no-such-mode", first.modelId)).toBe(false)
		})
	})
})

describe("runtime list replacement", () => {
	const bundled = getBundledModelList()

	afterEach(() => setModelList(bundled))

	it("serves the swapped list to every accessor", () => {
		setModelList({
			version: 1,
			defaultModelId: "vendor/new",
			models: [{ modelId: "vendor/new", displayName: "New", tier: "Free" }],
			modes: { code: { recommended: "vendor/new", models: ["vendor/new"] } },
		})

		expect(getModelsForMode("code").map((m) => m.modelId)).toEqual(["vendor/new"])
		expect(getDefaultModelForMode("code")?.modelId).toBe("vendor/new")
		expect(getRecommendedModelForMode("code")).toBe("vendor/new")
		expect(getDefaultModelId()).toBe("vendor/new")
		// Modes dropped from the new list must stop offering models.
		expect(getModelsForMode("orchestrator")).toEqual([])
	})

	it("drops a delisted model from the fallback chain", () => {
		const before = getFallbackChain("code")
		expect(before.length).toBeGreaterThan(1)

		setModelList({
			version: 1,
			defaultModelId: before[1],
			models: bundled.models.filter((m) => m.modelId !== before[0]),
			modes: { code: { models: bundled.modes.code.models.filter((id) => id !== before[0]) } },
		})

		expect(getFallbackChain("code")).not.toContain(before[0])
		expect(getPrimaryModel("code")).toBe(before[1])
	})

	it("restores the bundled list", () => {
		setModelList(bundled)
		expect(getModelsForMode("code").length).toBe(bundled.modes.code.models.length)
	})
})

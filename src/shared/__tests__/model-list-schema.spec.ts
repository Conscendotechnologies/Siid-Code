import { describe, it, expect } from "vitest"

import { parseModelList } from "../model-list-schema"
import bundled from "../mode-models.json"

const valid = () => ({
	version: 1,
	defaultModelId: "vendor/free",
	defaultPaidModelId: "vendor/paid",
	models: [
		{ modelId: "vendor/free", displayName: "Free", tier: "Free" },
		{ modelId: "vendor/paid", displayName: "Paid", tier: "Premium" },
	],
	modes: {
		code: { recommended: "vendor/free", models: ["vendor/free", "vendor/paid"] },
	},
})

describe("parseModelList", () => {
	it("accepts the bundled list", () => {
		const result = parseModelList(bundled)
		expect(result.ok).toBe(true)
	})

	it("accepts a well-formed list", () => {
		expect(parseModelList(valid()).ok).toBe(true)
	})

	it("defaults an omitted provider to openrouter downstream", () => {
		const result = parseModelList(valid())
		expect(result.ok && result.data.models[0].provider).toBeUndefined()
	})

	// Everything below must be rejected: a bad payload has to leave the previous
	// list in place rather than half-replace it.
	describe("rejects", () => {
		const cases: Array<[string, (data: any) => void]> = [
			["an unknown version", (d) => (d.version = 2)],
			["a missing version", (d) => delete d.version],
			["an empty model list", (d) => (d.models = [])],
			["a duplicate model id", (d) => d.models.push(d.models[0])],
			["a blank model id", (d) => (d.models[0].modelId = "")],
			["a blank display name", (d) => (d.models[0].displayName = "")],
			["an unknown tier", (d) => (d.models[0].tier = "Cheap")],
			["a missing tier", (d) => delete d.models[0].tier],
			["no modes at all", (d) => (d.modes = {})],
			["a mode with no models", (d) => (d.modes.code.models = [])],
			["a mode referencing an unknown model", (d) => (d.modes.code.models = ["vendor/free", "vendor/ghost"])],
			["a recommendation the mode does not offer", (d) => (d.modes.code.recommended = "vendor/ghost")],
			["a mode with no free model", (d) => (d.modes.code.models = ["vendor/paid"])],
			["a default that is not in the list", (d) => (d.defaultModelId = "vendor/ghost")],
			["a paid default that is not in the list", (d) => (d.defaultPaidModelId = "vendor/ghost")],
		]

		it.each(cases)("%s", (_label, mutate) => {
			const data = valid()
			mutate(data)
			const result = parseModelList(data)
			expect(result.ok).toBe(false)
			expect(result.ok === false && result.error.length).toBeGreaterThan(0)
		})

		it.each([
			["null", null],
			["a string", "not a list"],
			["an array", []],
			["an empty object", {}],
		])("%s", (_label, payload) => {
			expect(parseModelList(payload).ok).toBe(false)
		})
	})

	// A proxy or captive portal answers with HTML rather than the file.
	it("rejects an HTML error page", () => {
		expect(parseModelList("<!doctype html><html><body>404</body></html>").ok).toBe(false)
	})
})

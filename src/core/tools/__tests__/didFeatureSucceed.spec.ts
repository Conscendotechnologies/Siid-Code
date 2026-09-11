// Regression: siid_forge rendered a green "success" row for a red Apex test run.
// `success` was hardcoded true whenever feature.run() didn't throw, but
// runApexTests reports failures as data and resolves normally.

import { describe, it, expect } from "vitest"

import { __testing } from "../siidForgeTool"

const { didFeatureSucceed } = __testing

describe("didFeatureSucceed", () => {
	it("fails a red Apex test run", () => {
		// Shape observed from the real payload that was mislabelled.
		const result = {
			result: {
				summary: { outcome: "Failed", failing: 1, passing: 3, testsRan: 4 },
				tests: [],
			},
		}

		expect(didFeatureSucceed(result)).toBe(false)
	})

	it("passes a green Apex test run", () => {
		const result = {
			result: { summary: { outcome: "Passed", failing: 0, passing: 5, testsRan: 5 }, tests: [] },
		}

		expect(didFeatureSucceed(result)).toBe(true)
	})

	it("falls back to the failing count when outcome is absent", () => {
		expect(didFeatureSucceed({ result: { summary: { failing: 2 } } })).toBe(false)
		expect(didFeatureSucceed({ result: { summary: { failing: 0 } } })).toBe(true)
	})

	it("treats a feature that reports no outcome as successful", () => {
		// Most features just return data - returning without throwing is the signal.
		expect(didFeatureSucceed({ username: "a@b.com" })).toBe(true)
		expect(didFeatureSucceed("some string result")).toBe(true)
		expect(didFeatureSucceed(null)).toBe(true)
		expect(didFeatureSucceed(undefined)).toBe(true)
	})
})

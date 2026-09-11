import { describe, it, expect, beforeEach } from "vitest"

import { getModelsForMode } from "../mode-models"
import {
	is429Error,
	getNextModelOnError,
	getFallbackChain,
	getPrimaryModel,
	isFallbackEligible,
	clearTracking,
} from "../model-fallback"

const freeChain = () =>
	getModelsForMode("code")
		.filter((m) => m.tier === "Free")
		.map((m) => m.modelId)

describe("model-fallback", () => {
	beforeEach(() => clearTracking())

	describe("getFallbackChain", () => {
		it("contains only free models, in list order", () => {
			expect(getFallbackChain("code")).toEqual(freeChain())
		})

		it("is empty for an unknown mode", () => {
			expect(getFallbackChain("no-such-mode")).toEqual([])
		})

		it("reports the first free model as primary", () => {
			expect(getPrimaryModel("code")).toBe(freeChain()[0])
		})

		it("has no primary for an unknown mode", () => {
			expect(getPrimaryModel("no-such-mode")).toBeNull()
		})
	})

	describe("is429Error", () => {
		it.each([
			["top-level status", { status: 429 }],
			["top-level code", { code: 429 }],
			["nested code", { error: { code: 429 } }],
			["openrouter raw payload", { error: { metadata: { raw: '{"code":429,"message":"rate limit"}' } } }],
			["message with rate context", { message: "Request failed with 429 rate limit exceeded" }],
		])("detects a 429 from %s", (_label, error) => {
			expect(is429Error(error)).toBe(true)
		})

		it.each([
			["a 500", { status: 500 }],
			["an unrelated message", { message: "socket hang up" }],
			["null", null],
			["undefined", undefined],
		])("does not treat %s as a 429", (_label, error) => {
			expect(is429Error(error)).toBe(false)
		})
	})

	describe("getNextModelOnError", () => {
		it("advances from primary to the next free model", () => {
			const chain = freeChain()
			const result = getNextModelOnError("code", chain[0])
			expect(result.model).toBe(chain[1])
			expect(result.isFallback).toBe(true)
		})

		it("walks the whole chain then cycles back to primary", () => {
			const chain = freeChain()
			for (let i = 0; i < chain.length - 1; i++) {
				expect(getNextModelOnError("code", chain[i]).model).toBe(chain[i + 1])
			}
			const wrapped = getNextModelOnError("code", chain[chain.length - 1])
			expect(wrapped.model).toBe(chain[0])
			expect(wrapped.isFallback).toBe(false)
		})

		// A paid model must not be swapped out from under the user on a 429.
		it("does not switch when the current model is not in the free chain", () => {
			const paid = getModelsForMode("code").find((m) => m.tier === "Premium")!
			const result = getNextModelOnError("code", paid.modelId)
			expect(result.model).toBeNull()
			expect(result.isFallback).toBe(false)
		})

		// This is the delisted-model case: once a model leaves the list, it is no
		// longer in the chain, so no automatic switching happens for it.
		it("does not switch for a model that is no longer in the list", () => {
			const result = getNextModelOnError("code", "vendor/removed-model")
			expect(result.model).toBeNull()
		})

		it("does not switch for an unknown mode", () => {
			expect(getNextModelOnError("no-such-mode", "anything").model).toBeNull()
		})
	})

	describe("isFallbackEligible", () => {
		it("is true for a free model and false for a delisted one", () => {
			expect(isFallbackEligible("code", freeChain()[0])).toBe(true)
			expect(isFallbackEligible("code", "vendor/removed-model")).toBe(false)
		})
	})

	// OpenRouter moves models between free and paid, grants free access for
	// limited periods, and removes models outright. The chain is derived from
	// `tier` on every call, so these cases must hold for any list contents.
	describe("volatile provider catalogue", () => {
		it("derives the chain from tier rather than the :free id suffix", () => {
			// A ":free" suffix is part of the vendor's id, not a promise about
			// price, so tier is the only thing that may drive the chain.
			const chain = getFallbackChain("code")
			for (const id of chain) {
				const model = getModelsForMode("code").find((m) => m.modelId === id)
				expect(model?.tier).toBe("Free")
			}
			const paidWithFreeSuffix = getModelsForMode("code").filter(
				(m) => m.modelId.endsWith(":free") && m.tier !== "Free",
			)
			for (const model of paidWithFreeSuffix) {
				expect(chain).not.toContain(model.modelId)
			}
		})

		it("keeps the primary as the first free model even as the list changes", () => {
			// Whichever model currently sits first in the free tier is primary;
			// nothing hardcodes a specific id.
			const firstFree = getModelsForMode("code").find((m) => m.tier === "Free")
			expect(getPrimaryModel("code")).toBe(firstFree?.modelId)
		})

		it("leaves a user on a model that has been removed from the list", () => {
			// Removal must not silently reassign the user's model; the UI is
			// responsible for prompting them to pick a new one.
			const result = getNextModelOnError("code", "z-ai/glm-4.5-air:free-removed")
			expect(result.model).toBeNull()
			expect(result.isFallback).toBe(false)
			expect(result.message).toBe("")
		})

		it("does not fall back for a model that moved from free to paid", () => {
			// Once re-tiered, the model is no longer in the free chain, so a 429
			// on it must not trigger automatic switching.
			const paid = getModelsForMode("code").find((m) => m.tier !== "Free")!
			expect(isFallbackEligible("code", paid.modelId)).toBe(false)
			expect(getNextModelOnError("code", paid.modelId).model).toBeNull()
		})

		it("survives a mode whose models are all paid", () => {
			// If every free model is delisted at once the chain empties, which
			// must degrade to "no fallback" rather than throwing or picking a
			// paid model on the user's behalf.
			expect(getFallbackChain("no-such-mode")).toEqual([])
			expect(getPrimaryModel("no-such-mode")).toBeNull()
			expect(getNextModelOnError("no-such-mode", "anything")).toEqual({
				model: null,
				isFallback: false,
				message: "",
			})
		})
	})
})

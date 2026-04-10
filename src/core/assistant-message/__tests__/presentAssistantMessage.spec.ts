import { describe, expect, it } from "vitest"

import { shouldAdvanceStreamingContentIndex } from "../presentAssistantMessage"

describe("shouldAdvanceStreamingContentIndex", () => {
	it("advances completed blocks", () => {
		expect(shouldAdvanceStreamingContentIndex(false, false, false)).toBe(true)
	})

	it("advances rejected partial blocks", () => {
		expect(shouldAdvanceStreamingContentIndex(true, true, false)).toBe(true)
	})

	it("does not advance a partial block just because another tool already ran", () => {
		expect(shouldAdvanceStreamingContentIndex(true, false, true)).toBe(false)
	})

	it("does not advance an ordinary partial block", () => {
		expect(shouldAdvanceStreamingContentIndex(true, false, false)).toBe(false)
	})
})

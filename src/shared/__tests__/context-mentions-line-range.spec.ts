import { mentionRegex } from "../context-mentions"

/**
 * File mentions may carry an optional 1-based inclusive line range,
 * e.g. @/src/a.ts:22-29, produced by attaching an editor selection.
 */
describe("mentionRegex line ranges", () => {
	const capture = (input: string) => input.match(mentionRegex)?.[1]

	it("captures a path with a line range", () => {
		expect(capture("@/src/a.ts:22-29")).toBe("/src/a.ts:22-29")
	})

	it("captures a range mid-sentence", () => {
		expect(capture("look at @/src/a.ts:1-5 please")).toBe("/src/a.ts:1-5")
	})

	it("keeps trailing punctuation out of the mention", () => {
		expect(capture("see @/src/a.ts:22-29.")).toBe("/src/a.ts:22-29")
	})

	it("still captures a plain path with no range", () => {
		expect(capture("@/src/a.ts")).toBe("/src/a.ts")
	})

	it("handles escaped spaces alongside a range", () => {
		expect(capture("@/my\\ file.ts:3-9")).toBe("/my\\ file.ts:3-9")
	})

	it("does not treat a partial range as a range", () => {
		// A single trailing number is not a range; it stays part of the path.
		expect(capture("@/src/a.ts:22")).toBe("/src/a.ts:22")
	})
})

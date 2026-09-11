// Regression: models trained on their own tool-call format wrap XML tool uses in
// <tool_call>…</tool_call>. Those are not tools here, so the parser emitted them as
// prose and the user saw a bare "</tool_call>" sitting in the chat.

import { describe, it, expect } from "vitest"

import { parseAssistantMessage } from "../parseAssistantMessage"

describe("tool_call framing", () => {
	it("drops a text block that is only a stray closing tag", () => {
		const blocks = parseAssistantMessage("</tool_call>")

		expect(blocks.filter((b) => b.type === "text")).toEqual([])
	})

	it("strips framing but keeps the prose around it", () => {
		const blocks = parseAssistantMessage("<tool_call>\nLet me check that file.\n</tool_call>")
		const text = blocks.find((b) => b.type === "text")

		expect(text?.content).toBe("Let me check that file.")
	})

	it("still parses a tool use wrapped in framing", () => {
		const blocks = parseAssistantMessage("<tool_call>\n<read_file>\n<path>a.ts</path>\n</read_file>\n</tool_call>")
		const toolUse = blocks.find((b) => b.type === "tool_use")

		expect(toolUse).toBeDefined()
		expect(toolUse?.type === "tool_use" && toolUse.name).toBe("read_file")
		// The framing must not survive as a stray text bubble either.
		expect(blocks.some((b) => b.type === "text" && b.content.includes("tool_call"))).toBe(false)
	})

	it("leaves ordinary text untouched", () => {
		const blocks = parseAssistantMessage("Here is the plan, step by step.")
		const text = blocks.find((b) => b.type === "text")

		expect(text?.content).toBe("Here is the plan, step by step.")
	})

	it("does not strip the phrase from inside a tool parameter", () => {
		// Only the framing tags go; parameter content is never rewritten.
		const blocks = parseAssistantMessage("<read_file>\n<path>tool_call.ts</path>\n</read_file>")
		const toolUse = blocks.find((b) => b.type === "tool_use")

		expect(toolUse?.type === "tool_use" && toolUse.params.path).toBe("tool_call.ts")
	})
})

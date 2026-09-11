// Regression: a model that invents a tool name used to get "you did not use a
// tool", which reads as false to it, so it retried the same invented call until
// the mistake limit killed the task.

import { describe, it, expect } from "vitest"

import { formatResponse } from "../responses"

describe("formatResponse.noToolsUsed", () => {
	it("names an invented tool so the model can correct it", () => {
		const message = formatResponse.noToolsUsed(
			"<create-folder>\n<path>force-app/main/default/lwc/parentComponent</path>\n</create-folder>",
		)

		expect(message).toContain("'create-folder' is not an available tool")
		// The real list has to be present, otherwise there is nothing to correct against.
		expect(message).toContain("write_to_file")
	})

	it("falls back to the generic message for plain prose", () => {
		const message = formatResponse.noToolsUsed("Sure, I'll create that component for you.")

		expect(message).toContain("You did not use a tool")
		expect(message).not.toContain("is not an available tool")
	})

	it("ignores tool-call framing models emit natively", () => {
		// Nemotron leaks </tool_call>; that is not an invented tool name.
		const message = formatResponse.noToolsUsed("<tool_call>\nthinking about it\n</tool_call>")

		expect(message).toContain("You did not use a tool")
	})

	it("does not flag a real tool name", () => {
		const message = formatResponse.noToolsUsed("<read_file>\n<path>a.ts</path>\n</read_file>")

		expect(message).toContain("You did not use a tool")
	})

	it("still works with no text at all", () => {
		expect(formatResponse.noToolsUsed()).toContain("You did not use a tool")
	})
})

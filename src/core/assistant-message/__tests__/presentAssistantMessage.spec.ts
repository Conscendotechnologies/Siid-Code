import { describe, it, expect, vi, beforeEach } from "vitest"
import { presentAssistantMessage } from "../presentAssistantMessage"
import { Task } from "../../task/Task"
import { formatResponse } from "../../prompts/responses"

vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolError: vi.fn((msg) => `Error: ${msg}`),
	},
}))

describe("presentAssistantMessage", () => {
	let mockCline: Partial<Task>
	let executeCommandMock: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.clearAllMocks()
		executeCommandMock = vi.fn()

		mockCline = {
			assistantMessageContent: [],
			presentAssistantMessageLocked: false,
			presentAssistantMessageHasPendingUpdates: false,
			userMessageContentReady: false,
			didAlreadyUseTool: false,
			didRejectTool: false,
			userMessageContent: [],
			abort: false,
			say: vi.fn(),
			ask: vi.fn().mockResolvedValue(true),
		} as Partial<Task>
	})

	it("should not set didAlreadyUseTool for a partial tool block", async () => {
		mockCline.assistantMessageContent = [
			{
				type: "tool_use",
				name: "execute_command",
				params: { command: "npm test" },
				partial: true,
			},
		]

		await presentAssistantMessage(mockCline as Task)
		expect(mockCline.didAlreadyUseTool).toBe(false)
	})

	it("should refuse a second complete tool block in the same message", async () => {
		// Mock that one tool has already been used
		mockCline.didAlreadyUseTool = true

		mockCline.assistantMessageContent = [
			{
				type: "tool_use",
				name: "execute_command",
				params: { command: "npm start" },
				partial: false,
			},
		]

		await presentAssistantMessage(mockCline as Task)

		expect(mockCline.userMessageContent).toHaveLength(1)
		expect(mockCline.userMessageContent![0]).toEqual(
			expect.objectContaining({
				type: "text",
				text: expect.stringContaining("Error: Only one tool may be used at a time"),
			}),
		)
	})

	it("should reject a tool with an invalid_tool_tag_mismatch tag", async () => {
		mockCline.assistantMessageContent = [
			{
				type: "tool_use",
				name: "invalid_tool_tag_mismatch" as any,
				params: {},
				partial: false,
			},
		]

		await presentAssistantMessage(mockCline as Task)

		expect(mockCline.userMessageContent).toHaveLength(1)
		expect(mockCline.userMessageContent![0]).toEqual(
			expect.objectContaining({
				type: "text",
				text: expect.stringContaining("Error: Invalid tool tag mismatch"),
			}),
		)
	})
})

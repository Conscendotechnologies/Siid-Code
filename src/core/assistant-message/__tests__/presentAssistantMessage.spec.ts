import { describe, it, expect, vi, beforeEach } from "vitest"
import { presentAssistantMessage } from "../presentAssistantMessage"
import { Task } from "../../task/Task"
import { formatResponse } from "../../prompts/responses"

vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolError: vi.fn((msg) => `Error: ${msg}`),
	},
}))

vi.mock("@siid-code/telemetry")

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
			currentStreamingContentIndex: 0,
			didCompleteReadingStream: false,
			instanceId: "test-instance",
			taskId: "test-task",
			providerRef: {
				deref: () => ({
					getState: async () => ({
						alwaysAllowExecute: false,
						alwaysAllowMcp: false,
						experiments: {},
					}),
				}),
			} as any,
			say: vi.fn(),
			ask: vi.fn().mockResolvedValue(true),
			recordToolUsage: vi.fn(),
			toolRepetitionDetector: {
				check: vi.fn(() => ({ allowExecution: true, agentHint: "" })),
			} as any,
			browserSession: {
				closeBrowser: vi.fn(),
			} as any,
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
		mockCline.providerRef = {
			deref: () => ({
				getState: async () => ({
					experiments: { multipleToolCalls: false },
				}),
			}),
		} as any

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
				text: expect.stringContaining("Only one tool may be used per message"),
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

		expect(mockCline.userMessageContent).toHaveLength(2)
		expect(mockCline.userMessageContent![1]).toEqual(
			expect.objectContaining({
				type: "text",
				text: expect.stringContaining("Error: Invalid tool tag mismatch"),
			}),
		)
	})
})

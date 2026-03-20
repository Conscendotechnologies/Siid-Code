import { describe, expect, it, vi } from "vitest"

import { formatResponse } from "../../prompts/responses"
import { executeCommandTool } from "../executeCommandTool"

describe("Salesforce execute_command guard", () => {
	it("blocks raw sf deploy commands", async () => {
		const pushToolResult = vi.fn()
		const askApproval = vi.fn()
		const handleError = vi.fn()
		const removeClosingTag = vi.fn()
		const task: any = {
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			sayAndCreateMissingParamError: vi.fn(),
			rooIgnoreController: { validateCommand: vi.fn().mockReturnValue(null) },
		}

		await executeCommandTool(
			task,
			{
				type: "tool_use",
				name: "execute_command",
				params: { command: "sf project deploy start --metadata CustomObject:Test__c" },
				partial: false,
			},
			askApproval as any,
			handleError as any,
			pushToolResult as any,
			removeClosingTag as any,
		)

		expect(askApproval).not.toHaveBeenCalled()
		expect(pushToolResult).toHaveBeenCalledWith(
			formatResponse.toolError(
				"Raw Salesforce deploy commands are blocked here. Use the sf_deploy_metadata tool so deployment runs automatically through the Salesforce workflow.",
			),
		)
	})

	it("blocks raw sf anonymous apex commands", async () => {
		const pushToolResult = vi.fn()
		const askApproval = vi.fn()
		const handleError = vi.fn()
		const removeClosingTag = vi.fn()
		const task: any = {
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			sayAndCreateMissingParamError: vi.fn(),
			rooIgnoreController: { validateCommand: vi.fn().mockReturnValue(null) },
		}

		await executeCommandTool(
			task,
			{
				type: "tool_use",
				name: "execute_command",
				params: { command: "sf apex run --file anonymous.apex --json" },
				partial: false,
			},
			askApproval as any,
			handleError as any,
			pushToolResult as any,
			removeClosingTag as any,
		)

		expect(askApproval).not.toHaveBeenCalled()
		expect(pushToolResult).toHaveBeenCalledWith(
			formatResponse.toolError(
				"Raw Salesforce anonymous Apex commands are blocked here. Use the sf_execute_anonymous tool so execution runs automatically through the Salesforce workflow.",
			),
		)
	})
})

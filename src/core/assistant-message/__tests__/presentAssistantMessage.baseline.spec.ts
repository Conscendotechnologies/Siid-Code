import { beforeEach, describe, expect, it, vi } from "vitest"

import { executeCommandTool } from "../../tools/executeCommandTool"
import { writeToFileTool } from "../../tools/writeToFileTool"
import { readFileTool } from "../../tools/readFileTool"
import { presentAssistantMessage, shouldWaitForCheckpointBaseline } from "../presentAssistantMessage"

vi.mock("@siid-code/telemetry", () => ({
	TelemetryService: { instance: { captureToolUsage: vi.fn() } },
}))
vi.mock("../../tools/validateToolUse", () => ({ validateToolUse: vi.fn() }))
vi.mock("../../tools/executeCommandTool", () => ({ executeCommandTool: vi.fn().mockResolvedValue(undefined) }))
vi.mock("../../tools/writeToFileTool", () => ({ writeToFileTool: vi.fn().mockResolvedValue(undefined) }))
vi.mock("../../tools/readFileTool", () => ({
	readFileTool: vi.fn().mockResolvedValue(undefined),
	getReadFileToolDescription: vi.fn(() => "[read_file]"),
}))

function makeTask(block: Record<string, unknown>) {
	let finishBaseline!: () => void
	const baseline = new Promise<void>((resolve) => (finishBaseline = resolve))

	const task: any = {
		abort: false,
		taskId: "t",
		instanceId: "i",
		presentAssistantMessageLocked: false,
		presentAssistantMessageHasPendingUpdates: false,
		providerRef: { deref: () => undefined },
		currentStreamingContentIndex: 0,
		currentStreamingDidCheckpoint: false,
		assistantMessageContent: [{ type: "tool_use", params: {}, ...block }],
		didCompleteReadingStream: true,
		userMessageContent: [],
		didRejectTool: false,
		didAlreadyUseTool: false,
		diffEnabled: true,
		browserSession: { closeBrowser: vi.fn().mockResolvedValue(undefined) },
		recordToolUsage: vi.fn(),
		toolRepetitionDetector: { check: vi.fn(() => ({ allowExecution: true })) },
		waitForCheckpointBaseline: vi.fn(() => baseline),
		checkpointSave: vi.fn().mockResolvedValue(undefined),
		postFileChanges: vi.fn().mockResolvedValue(undefined),
	}

	return { task, finishBaseline }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("checkpoint baseline gating", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("holds execute_command until the baseline is taken", async () => {
		const { task, finishBaseline } = makeTask({ name: "execute_command", partial: false })

		const presenting = presentAssistantMessage(task)
		await flush()

		expect(task.waitForCheckpointBaseline).toHaveBeenCalledTimes(1)
		expect(executeCommandTool).not.toHaveBeenCalled()

		finishBaseline()
		await presenting

		expect(executeCommandTool).toHaveBeenCalledTimes(1)
	})

	it("does not run execute_command if the task was cancelled during the wait", async () => {
		const { task, finishBaseline } = makeTask({ name: "execute_command", partial: false })

		const presenting = presentAssistantMessage(task)
		await flush()
		task.abort = true
		finishBaseline()
		await presenting

		expect(executeCommandTool).not.toHaveBeenCalled()
	})

	it("lets a partial execute_command render without waiting", async () => {
		const { task } = makeTask({ name: "execute_command", partial: true })

		await presentAssistantMessage(task)

		expect(task.waitForCheckpointBaseline).not.toHaveBeenCalled()
		expect(executeCommandTool).toHaveBeenCalledTimes(1)
	})

	it("holds an edit tool from its first partial block, before saving its checkpoint", async () => {
		const { task, finishBaseline } = makeTask({ name: "write_to_file", partial: true })

		const presenting = presentAssistantMessage(task)
		await flush()

		expect(task.checkpointSave).not.toHaveBeenCalled()
		expect(writeToFileTool).not.toHaveBeenCalled()

		finishBaseline()
		await presenting

		expect(task.checkpointSave).toHaveBeenCalledWith(true)
		expect(writeToFileTool).toHaveBeenCalledTimes(1)
	})

	it("does not hold read-only tools", async () => {
		const { task } = makeTask({ name: "read_file", partial: false })

		await presentAssistantMessage(task)

		expect(task.waitForCheckpointBaseline).not.toHaveBeenCalled()
		expect(readFileTool).toHaveBeenCalledTimes(1)
	})

	it.each(["retrieve_sf_metadata", "siid_forge", "use_mcp_tool", "new_task"] as const)(
		"treats %s as able to change the workspace",
		(name) => {
			expect(shouldWaitForCheckpointBaseline(name, false)).toBe(true)
			expect(shouldWaitForCheckpointBaseline(name, true)).toBe(false)
		},
	)
})

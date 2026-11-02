// npx vitest run core/task/__tests__/Task.review-fixes.spec.ts
//
// Task methods exercised on a bare object through the prototype: the baseline
// gate's hard timeout, the no-row rule of condenseContext, and the cleared
// status line after a failed first chunk.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@siid-code/telemetry", () => ({
	TelemetryService: {
		instance: { captureEvent: vi.fn(), captureLlmCompletion: vi.fn(), captureTaskCreated: vi.fn() },
	},
}))

const checkpoints = vi.hoisted(() => ({
	getCheckpointService: vi.fn(),
	checkpointSave: vi.fn(),
	checkpointRestore: vi.fn(),
	checkpointDiff: vi.fn(),
	postFileChanges: vi.fn(),
	getTaskFileChanges: vi.fn(),
	postFileChangesFrom: vi.fn(),
}))
vi.mock("../../checkpoints", () => checkpoints)

const condense = vi.hoisted(() => ({ summarizeConversation: vi.fn() }))
vi.mock("../../condense", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../condense")>()),
	summarizeConversation: condense.summarizeConversation,
}))

import { Task } from "../Task"

const provider = () => ({
	log: vi.fn(),
	getState: vi.fn().mockResolvedValue({}),
	postMessageToWebview: vi.fn().mockResolvedValue(undefined),
})

describe("Task.waitForCheckpointBaseline", () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	const fake = () => ({
		taskId: "t1",
		instanceId: "abc",
		abort: false,
		enableCheckpoints: true,
		checkpointService: undefined,
		checkpointServiceInitializing: false,
		clineMessages: [
			{
				type: "say",
				say: "api_req_started",
				ts: 1,
				progressStatus: { text: "Receiving response...", icon: "sync" },
			},
		],
		providerRef: { deref: () => provider() },
		updateApiRequestProgressStatus: vi.fn().mockResolvedValue(undefined),
		say: vi.fn().mockResolvedValue(undefined),
	})

	it("turns checkpoints off and tells the user when the snapshot does not finish in time (hung git add)", async () => {
		checkpoints.getCheckpointService.mockReturnValue(new Promise(() => {}))
		const task = fake()
		const waiting = Task.prototype.waitForCheckpointBaseline.call(task as any)

		await vi.advanceTimersByTimeAsync(Task.CHECKPOINT_BASELINE_TIMEOUT_MS - 1_000)
		expect(task.enableCheckpoints).toBe(true)

		await vi.advanceTimersByTimeAsync(2_000)
		await waiting
		expect(task.enableCheckpoints).toBe(false)
		expect(task.say).toHaveBeenCalledWith(
			"error",
			expect.stringContaining("Checkpoints are off for this task"),
			undefined,
			false,
			undefined,
			undefined,
			{ isNonInteractive: true },
		)
		// The status line goes back to what it was.
		expect(task.updateApiRequestProgressStatus).toHaveBeenLastCalledWith("Receiving response...", "sync")
	})

	it("proceeds as soon as this instance's own init settles, even if the pending flag is still set", async () => {
		// A reopened task: the old instance's init would never clear this
		// instance's flags. Only our own promise counts; undefined means disabled.
		checkpoints.getCheckpointService.mockResolvedValue(undefined)
		const task = fake()
		const waiting = Task.prototype.waitForCheckpointBaseline.call(task as any)
		await vi.advanceTimersByTimeAsync(1_000)
		await waiting
		expect(task.say).not.toHaveBeenCalled()
		expect(task.updateApiRequestProgressStatus).toHaveBeenLastCalledWith("Receiving response...", "sync")
	})

	it("stops waiting when the task is aborted", async () => {
		checkpoints.getCheckpointService.mockReturnValue(new Promise(() => {}))
		const task = fake()
		const waiting = Task.prototype.waitForCheckpointBaseline.call(task as any)
		await vi.advanceTimersByTimeAsync(1_000)
		task.abort = true
		await vi.advanceTimersByTimeAsync(500)
		await waiting
		expect(task.enableCheckpoints).toBe(true)
		expect(task.say).not.toHaveBeenCalled()
	})
})

describe("Task.condenseContext", () => {
	const history = [
		{ role: "user", content: [{ type: "text", text: "<task>x</task>" }] },
		{ role: "assistant", content: [{ type: "text", text: "ok" }] },
	]
	const fake = () => ({
		taskId: "t1",
		api: {},
		apiConversationHistory: history,
		getSystemPrompt: vi.fn().mockResolvedValue("sys"),
		getTokenUsage: vi.fn().mockReturnValue({ contextTokens: 100_000 }),
		providerRef: { deref: () => provider() },
		overwriteApiConversationHistory: vi.fn().mockResolvedValue(undefined),
		say: vi.fn().mockResolvedValue(undefined),
	})

	beforeEach(() => condense.summarizeConversation.mockReset())

	it("writes no condense_context row when nothing changed", async () => {
		condense.summarizeConversation.mockResolvedValue({
			messages: history,
			summary: "",
			cost: 0,
			newContextTokens: 100_000,
		})
		const task = fake()
		expect(await Task.prototype.condenseContext.call(task as any, true)).toBe(false)
		expect(task.overwriteApiConversationHistory).not.toHaveBeenCalled()
		expect(task.say).not.toHaveBeenCalled()
	})

	it("writes the row when the history was rewritten", async () => {
		const rewritten = [history[0]]
		condense.summarizeConversation.mockResolvedValue({
			messages: rewritten,
			summary: "Elided 1 older tool output (~50,000 tokens).",
			cost: 0,
			newContextTokens: 50_000,
		})
		const task = fake()
		expect(await Task.prototype.condenseContext.call(task as any, true)).toBe(true)
		expect(task.overwriteApiConversationHistory).toHaveBeenCalledWith(rewritten)
		expect(task.say).toHaveBeenCalledWith(
			"condense_context",
			undefined,
			undefined,
			false,
			undefined,
			undefined,
			{ isNonInteractive: true },
			expect.objectContaining({ newContextTokens: 50_000, prevContextTokens: 100_000 }),
		)
	})
})

describe("Task.clearApiRequestProgressStatus", () => {
	it("drops the stale status line of the latest request row", async () => {
		const row = {
			type: "say",
			say: "api_req_started",
			ts: 1,
			progressStatus: { text: "Thinking (12s)...", icon: "sync" },
		}
		const task = { clineMessages: [row], updateClineMessage: vi.fn().mockResolvedValue(undefined) }
		await (Task.prototype as any).clearApiRequestProgressStatus.call(task)
		expect(row.progressStatus).toBeUndefined()
		expect(task.updateClineMessage).toHaveBeenCalledWith(row)

		// Nothing to clear: no update is posted.
		await (Task.prototype as any).clearApiRequestProgressStatus.call(task)
		expect(task.updateClineMessage).toHaveBeenCalledTimes(1)
	})
})

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

	describe("blocking status", () => {
		// Uses the real status writer, so the assertions read the row itself.
		const withRealStatus = () => {
			const task = fake() as any
			task.updateClineMessage = vi.fn().mockResolvedValue(undefined)
			task.updateApiRequestProgressStatus = (Task.prototype as any).updateApiRequestProgressStatus
			return task
		}
		const status = (task: any) => task.clineMessages[0].progressStatus
		const expectBlockingThenRestored = async (
			task: any,
			waiting: Promise<void>,
			settle: () => Promise<unknown>,
		) => {
			await vi.advanceTimersByTimeAsync(1_000)
			expect(status(task)).toMatchObject({ blocking: true, text: expect.stringContaining("Snapshotting") })
			expect(task.updateClineMessage).toHaveBeenCalled()

			await settle()
			await waiting
			expect(status(task)).toEqual({ text: "Receiving response...", icon: "sync" })
		}

		it("is set during the wait and dropped when the snapshot settles", async () => {
			let resolveInit: (value: undefined) => void = () => {}
			checkpoints.getCheckpointService.mockReturnValue(new Promise((resolve) => (resolveInit = resolve)))
			const task = withRealStatus()
			const waiting = Task.prototype.waitForCheckpointBaseline.call(task)
			await expectBlockingThenRestored(task, waiting, async () => {
				resolveInit(undefined)
				await vi.advanceTimersByTimeAsync(500)
			})
		})

		it("is dropped when the wait times out", async () => {
			checkpoints.getCheckpointService.mockReturnValue(new Promise(() => {}))
			const task = withRealStatus()
			const waiting = Task.prototype.waitForCheckpointBaseline.call(task)
			await expectBlockingThenRestored(task, waiting, () =>
				vi.advanceTimersByTimeAsync(Task.CHECKPOINT_BASELINE_TIMEOUT_MS + 1_000),
			)
			expect(task.enableCheckpoints).toBe(false)
		})

		it("is dropped within one poll of an abort", async () => {
			checkpoints.getCheckpointService.mockReturnValue(new Promise(() => {}))
			const task = withRealStatus()
			const waiting = Task.prototype.waitForCheckpointBaseline.call(task)
			await expectBlockingThenRestored(task, waiting, async () => {
				task.abort = true
				await vi.advanceTimersByTimeAsync(200)
			})
		})
	})
})

describe("Task.resumeTaskFromHistory", () => {
	it("drops a blocking status persisted mid-wait, so the resumed task does not stick on Cancel", async () => {
		let saved: any[] = [
			{ type: "say", say: "task", ts: 1, text: "t" },
			{
				type: "say",
				say: "api_req_started",
				ts: 2,
				text: '{"cost":1}',
				progressStatus: { text: "Snapshotting workspace for checkpoints...", icon: "sync", blocking: true },
			},
		]
		const stopAfterResumeAsk = new Error("stop at the resume ask")
		const task: any = {
			getSavedClineMessages: vi.fn(async () => saved),
			overwriteClineMessages: vi.fn(async (messages: any[]) => {
				saved = messages
			}),
			getSavedApiConversationHistory: vi.fn().mockResolvedValue([]),
			ask: vi.fn().mockRejectedValue(stopAfterResumeAsk),
		}

		await expect((Task.prototype as any).resumeTaskFromHistoryInner.call(task)).rejects.toBe(stopAfterResumeAsk)

		expect(task.ask).toHaveBeenCalledWith("resume_task")
		expect(task.clineMessages[1].progressStatus).toBeUndefined()
		expect(saved[1].progressStatus).toBeUndefined()
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

describe("automatic summary backoff", () => {
	const THRESHOLD = 50
	const model = {
		id: "test-model",
		info: { contextWindow: 1_000_000, maxTokens: 100_000, supportsPromptCache: false },
	}
	const END_OF_CONDENSE = new Error("past the condense block")
	const failed = { messages: [], summary: "", cost: 0, newContextTokens: 0, error: "Summary too short after retry" }
	const history = [
		{ role: "user", content: [{ type: "text", text: "<task>x</task>" }] },
		{ role: "assistant", content: [{ type: "text", text: "ok" }] },
		{ role: "user", content: [{ type: "text", text: "next" }] },
	]

	const fake = () => {
		const task: any = {
			taskId: "t1",
			api: { getModel: () => model, countTokens: vi.fn().mockResolvedValue(1_000) },
			apiConfiguration: {},
			apiConversationHistory: history,
			clineMessages: [],
			tokens: 0,
			overflowCondenseFreedLittle: false,
			getSystemPrompt: vi.fn().mockResolvedValue("sys"),
			getResolvedModel: vi.fn().mockResolvedValue(model),
			getTokenUsage: () => ({ contextTokens: task.tokens }),
			combineMessages: vi.fn().mockReturnValue([]),
			providerRef: {
				deref: () => ({
					...provider(),
					getState: vi
						.fn()
						.mockResolvedValue({ autoCondenseContextPercent: THRESHOLD, listApiConfigMeta: [] }),
				}),
			},
			overwriteApiConversationHistory: vi.fn(async (messages: unknown) => {
				task.apiConversationHistory = messages
			}),
			updateApiRequestProgressStatus: vi.fn().mockResolvedValue(undefined),
			say: vi.fn().mockResolvedValue(undefined),
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
			condenseContext: Task.prototype.condenseContext,
			// The first thing after the condense block: ends the turn before any request.
			autoApprovalHandler: { checkAutoApprovalLimits: vi.fn().mockRejectedValue(END_OF_CONDENSE) },
		}
		return task
	}

	/** One turn's condense decision at the given context size. */
	const turn = async (task: any, tokens: number) => {
		task.tokens = tokens
		await expect(Task.prototype.attemptApiRequest.call(task).next()).rejects.toBe(END_OF_CONDENSE)
	}
	const overflowRow = (ts: number) => ({ type: "say", say: "api_req_retry_delayed", text: "prompt is too long", ts })
	const summaryCalls = () => condense.summarizeConversation.mock.calls.length
	const errorRows = (task: any) => task.say.mock.calls.filter((c: unknown[]) => c[0] === "condense_context_error")

	beforeEach(() => {
		condense.summarizeConversation.mockReset()
		condense.summarizeConversation.mockResolvedValue(failed)
	})

	it("does not summarise again next turn after a failure", async () => {
		const task = fake()
		await turn(task, 500_000)
		expect(summaryCalls()).toBe(1)
		await turn(task, 500_000)
		await turn(task, 549_000)
		expect(summaryCalls()).toBe(1)
		expect(errorRows(task)).toHaveLength(1)
	})

	it("retries once the context grew by 10%", async () => {
		const task = fake()
		await turn(task, 500_000)
		await turn(task, 550_000)
		expect(summaryCalls()).toBe(2)
	})

	it("stops after two failures in a row and says so once", async () => {
		const task = fake()
		await turn(task, 500_000)
		await turn(task, 550_000)
		await turn(task, 700_000)
		await turn(task, 880_000)
		expect(summaryCalls()).toBe(2)
		const rows = errorRows(task)
		expect(rows).toHaveLength(2)
		expect(rows[0][1]).toBe("Summary too short after retry")
		expect(rows[1][1]).toContain("Auto-condense is paused")
	})

	it("still summarises on a provider overflow while paused", async () => {
		const task = fake()
		await turn(task, 500_000)
		await turn(task, 550_000)
		task.clineMessages = [overflowRow(5)]
		await turn(task, 880_000)
		expect(summaryCalls()).toBe(3)
		// Already told: no second pause notice.
		expect(errorRows(task).filter((c: unknown[]) => String(c[1]).includes("paused"))).toHaveLength(1)
	})

	it("tells the user when the context stays too large after an overflow condense while paused", async () => {
		const task = fake()
		await turn(task, 500_000)
		await turn(task, 550_000)
		task.clineMessages = [overflowRow(5)]
		await turn(task, 880_000)
		task.clineMessages = [overflowRow(6)]
		await turn(task, 880_000)
		expect(task.ask).toHaveBeenCalledWith("api_req_failed", expect.stringContaining("still too large"))
	})

	it("a manual condense always runs and resets the backoff, even when it fails", async () => {
		const task = fake()
		await turn(task, 500_000)
		await turn(task, 550_000)
		await turn(task, 700_000)
		expect(summaryCalls()).toBe(2)

		task.tokens = 700_000
		expect(await Task.prototype.condenseContext.call(task)).toBe(false)
		expect(summaryCalls()).toBe(3)

		await turn(task, 700_000)
		expect(summaryCalls()).toBe(4)
	})

	it("a successful summary resets the backoff", async () => {
		const task = fake()
		await turn(task, 500_000)
		condense.summarizeConversation.mockResolvedValueOnce({
			messages: [...history],
			summary: "A real summary",
			cost: 0.1,
			newContextTokens: 100_000,
		})
		await turn(task, 550_000)
		expect(summaryCalls()).toBe(2)

		// No growth needed for the next one, and two more failures to pause.
		await turn(task, 500_000)
		expect(summaryCalls()).toBe(3)
		await turn(task, 550_000)
		expect(summaryCalls()).toBe(4)
		await turn(task, 900_000)
		expect(summaryCalls()).toBe(4)
	})

	it("a reduction without a summary does not reset the backoff", async () => {
		const task = fake()
		await turn(task, 500_000)
		await turn(task, 550_000)
		condense.summarizeConversation.mockResolvedValueOnce({
			messages: [...history],
			summary: "Elided 1 older tool output (~50,000 tokens).",
			cost: 0,
			newContextTokens: 400_000,
			reductionOnly: true,
		})
		task.tokens = 550_000
		await Task.prototype.condenseContext.call(task, true)
		expect(summaryCalls()).toBe(3)

		await turn(task, 900_000)
		expect(summaryCalls()).toBe(3)
	})

	it("an aborted summary does not count and writes no row", async () => {
		const task = fake()
		task.abort = true
		task.tokens = 500_000
		expect(await Task.prototype.condenseContext.call(task, true)).toBe(false)
		expect(task.say).not.toHaveBeenCalled()

		task.abort = false
		await turn(task, 500_000)
		expect(summaryCalls()).toBe(2)
	})

	it("treats a thrown request like a failed validation", async () => {
		condense.summarizeConversation.mockResolvedValue({ ...failed, error: "503 upstream error" })
		const task = fake()
		await turn(task, 500_000)
		await turn(task, 500_000)
		expect(summaryCalls()).toBe(1)
		expect(errorRows(task)[0][1]).toBe("503 upstream error")
	})

	it("keeps trimming while paused", async () => {
		const task = fake()
		await turn(task, 500_000)
		await turn(task, 550_000)
		expect(summaryCalls()).toBe(2)

		// Old environment details large enough to clear the hysteresis, not enough to go under the threshold.
		const big = `<environment_details>\n${"x".repeat(300_000)}\n</environment_details>`
		task.apiConversationHistory = Array.from({ length: 12 }, (_, i) =>
			i % 2
				? { role: "assistant", content: [{ type: "text", text: "ok" }] }
				: {
						role: "user",
						content: [
							{ type: "text", text: `turn ${i}` },
							{ type: "text", text: big },
						],
					},
		)
		await turn(task, 880_000)

		expect(summaryCalls()).toBe(2)
		expect(task.overwriteApiConversationHistory).toHaveBeenCalledTimes(1)
		expect(JSON.stringify(task.apiConversationHistory)).toContain("[elided: environment_details")
		expect(task.say).toHaveBeenCalledWith(
			"condense_context",
			undefined,
			undefined,
			false,
			undefined,
			undefined,
			{ isNonInteractive: true },
			expect.objectContaining({ cost: 0 }),
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

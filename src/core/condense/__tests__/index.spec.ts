// npx vitest run core/condense/__tests__/index.spec.ts

import { ApiHandler } from "../../../api"
import { ApiMessage } from "../../task-persistence/apiMessages"
import {
	summarizeConversation,
	getMinimumSummaryChars,
	getSummaryTargetTokens,
	CONTINUATION_PROMPT,
	N_MESSAGES_TO_KEEP,
} from "../index"
import {
	reduceConversation,
	selectTailStart,
	tailTokenBudget,
	ELIDED_MARKER,
	boundFirstMessage,
	describeReduction,
	estimateMessageTokens,
	planCondense,
	shouldApplyReduction,
	FIRST_MESSAGE_BUDGET_FRACTION,
	REDUCTION_MIN_FREED_TOKENS,
	REDUCTION_SOFT_CAP_TOKENS,
} from "../stages"
import { collectWorkingSet, formatWorkingSet } from "../workingSet"

vi.mock("../../../api/transform/image-cleaning", () => ({
	maybeRemoveImageBlocks: vi.fn((messages: ApiMessage[]) => [...messages]),
}))

vi.mock("@siid-code/telemetry", () => ({
	TelemetryService: { instance: { captureLlmCompletion: vi.fn(), captureContextCondensed: vi.fn() } },
}))

// ---------------------------------------------------------------------------
// Fixture: a realistic text-block history as presentAssistantMessage builds it.
// ---------------------------------------------------------------------------

const filler = (lines: number, prefix = "line") =>
	Array.from({ length: lines }, (_, i) => `${prefix} ${i + 1}: const value${i} = compute(${i}) // padding text`).join(
		"\n",
	)

const env = (todo = true) =>
	`<environment_details>\n# VSCode Visible Files\nsrc/a.ts\n\n# Current Time\n2026-11-02\n${filler(40, "ctx")}\n` +
	(todo
		? `====\n\nREMINDERS\n\n| # | Content | Status |\n|---|---------|--------|\n| 1 | Fix the login bug | In Progress |\n| 2 | Run the tests | Pending |\n\n`
		: "") +
	`</environment_details>`

const readResult = (path: string, lines: string, body: string) =>
	`<file><path>${path}</path>\n<content lines="${lines}">\n${body}</content>\n</file>`

const commandOutput = () =>
	`Command executed in terminal 1 within working directory 'D:/proj'. Exit code: 1\nOutput:\n` +
	`> proj@1.0.0 test\nFIRST LINE OF OUTPUT\n` +
	filler(400, "log") +
	`\nDeploy Id: 0Af5g00000AbCdEfGH\n` +
	filler(100, "more") +
	`\nLAST LINE OF OUTPUT\nTests: 3 failed, 10 passed`

const user = (blocks: string[], ts: number): ApiMessage => ({
	role: "user",
	content: blocks.map((text) => ({ type: "text" as const, text })),
	ts,
})
const assistant = (text: string, ts: number): ApiMessage => ({
	role: "assistant",
	content: [{ type: "text", text }],
	ts,
})

function buildHistory(): ApiMessage[] {
	return [
		user(["<task>\nFix the login bug in src/a.ts; do not touch src/c.ts\n</task>", env(false)], 1),
		assistant("I'll read the file.\n<read_file><args><file><path>src/a.ts</path></file></args></read_file>", 2),
		user(["[read_file for 'src/a.ts'] Result:", readResult("src/a.ts", "1-200", filler(200)), env()], 3),
		assistant("<execute_command><command>npm test</command></execute_command>", 4),
		user(["[execute_command for 'npm test'] Result:", commandOutput(), env()], 5),
		assistant(
			"<apply_diff><path>src/a.ts</path><diff><<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE</diff></apply_diff>",
			6,
		),
		user(["[apply_diff for 'src/a.ts'] Result:", "Changes successfully applied to src/a.ts", env()], 7),
		assistant("<read_file><args><file><path>src/b.ts</path></file></args></read_file>", 8),
		user(["[read_file for 'src/b.ts'] Result:", readResult("src/b.ts", "1-50", filler(50, "b")), env()], 9),
		assistant("<ask_followup_question><question>Which?</question></ask_followup_question>", 10),
		user(["[ask_followup_question for 'Which?'] Result:", "<answer>\nUse option two please\n</answer>", env()], 11),
		assistant("<read_file><args><file><path>src/c.ts</path></file></args></read_file>", 12),
		user(["[read_file for 'src/c.ts'] Result:", readResult("src/c.ts", "1-80", filler(80, "c")), env()], 13),
		assistant("<list_files><path>src</path></list_files>", 14),
		user(["[list_files for 'src'] Result:", filler(300, "src/file"), env()], 15),
		assistant("Now I'll apply the change.", 16),
	]
}

const text = (m: ApiMessage, i: number) => (m.content as { text: string }[])[i].text

// ---------------------------------------------------------------------------
// Staged reduction
// ---------------------------------------------------------------------------

describe("reduceConversation", () => {
	it("elides reads superseded by a later edit and old environment details (stage 0)", () => {
		const history = buildHistory()
		const result = reduceConversation(history)

		expect(result.changed).toBe(true)
		expect(result.messages).toHaveLength(history.length)

		// read of src/a.ts (message 2) was followed by apply_diff on src/a.ts (message 6)
		const tomb = text(result.messages[2], 1)
		expect(tomb).toMatch(/^\[elided: read_file path=src\/a\.ts lines=1-200 ~\d+ tokens; re-read if needed\]$/)
		// header block and position are preserved (pairing with the assistant call)
		expect(text(result.messages[2], 0)).toBe("[read_file for 'src/a.ts'] Result:")
		expect(result.messages[2].ts).toBe(3)

		// env details outside the last 4 messages are gone, inside they are kept
		expect(text(result.messages[0], 1)).toMatch(/^\[elided: environment_details ~\d+ tokens\]$/)
		expect(text(result.messages[14], 2)).toMatch(/^<environment_details>/)
	})

	it("never touches user text, assistant prose, or small results", () => {
		const history = buildHistory()
		const result = reduceConversation(history, { stage1Protected: 2 })

		expect(text(result.messages[0], 0)).toBe(text(history[0], 0)) // <task>
		expect(text(result.messages[10], 1)).toBe("<answer>\nUse option two please\n</answer>")
		expect(text(result.messages[6], 1)).toBe("Changes successfully applied to src/a.ts")
		for (let i = 0; i < history.length; i++) {
			if (history[i].role === "assistant") expect(result.messages[i]).toBe(history[i])
		}
	})

	it("tombstones older reproducible outputs with a pointer (stage 1) and keeps command shape", () => {
		const history = buildHistory()
		const result = reduceConversation(history, { stage1Protected: 1 })

		// read_file of src/b.ts (not superseded) is now outside the protected window
		expect(text(result.messages[8], 1)).toMatch(
			/^\[elided: read_file path=src\/b\.ts lines=1-50 ~\d+ tokens; re-read if needed\]$/,
		)
		expect(text(result.messages[12], 1)).toMatch(/^\[elided: read_file path=src\/c\.ts lines=1-80/)
		expect(text(result.messages[14], 1)).toMatch(/^\[elided: list_files 'src' ~\d+ tokens; re-run if needed\]$/)

		// the command keeps its header, exit code, head, tail and id-bearing lines
		const cmd = text(result.messages[4], 1)
		expect(cmd).toContain("Command executed in terminal 1")
		expect(cmd).toContain("Exit code: 1")
		expect(cmd).toContain("FIRST LINE OF OUTPUT")
		expect(cmd).toContain("LAST LINE OF OUTPUT")
		expect(cmd).toContain("Tests: 3 failed, 10 passed")
		expect(cmd).toContain("Deploy Id: 0Af5g00000AbCdEfGH")
		expect(cmd).toContain("[elided: middle of execute_command output")
		expect(cmd.length).toBeLessThan(text(history[4], 1).length / 2)
		expect(result.freedTokensEstimate).toBeGreaterThan(0)
	})

	it("is byte-stable, applies once, and survives persistence (resume)", () => {
		const history = buildHistory()
		const first = reduceConversation(history, { stage1Protected: 2 })
		const second = reduceConversation(first.messages, { stage1Protected: 2 })
		expect(second.changed).toBe(false)
		expect(second.messages).toBe(first.messages)

		// what task resume reads back from disk is what was written
		const restored: ApiMessage[] = JSON.parse(JSON.stringify(first.messages))
		const third = reduceConversation(restored, { stage1Protected: 2 })
		expect(third.changed).toBe(false)
		expect(JSON.stringify(third.messages)).toBe(JSON.stringify(first.messages))

		// and a fresh run over the same input produces the same bytes
		expect(JSON.stringify(reduceConversation(buildHistory(), { stage1Protected: 2 }).messages)).toBe(
			JSON.stringify(first.messages),
		)
	})

	it("returns the same array when there is nothing to do", () => {
		const short = buildHistory().slice(-3)
		const result = reduceConversation(short)
		expect(result.changed).toBe(false)
		expect(result.messages).toBe(short)
	})
})

// ---------------------------------------------------------------------------
// Tail selection
// ---------------------------------------------------------------------------

describe("selectTailStart", () => {
	it("scales the budget to the window with a floor and a cap", () => {
		expect(tailTokenBudget(200_000)).toBe(24_000)
		expect(tailTokenBudget(1_000_000)).toBe(60_000)
		expect(tailTokenBudget(20_000)).toBe(6_000)
	})

	it("keeps at least N_MESSAGES_TO_KEEP and aligns to an assistant message", () => {
		const history = buildHistory()
		// tiny window: only the minimum tail fits
		const start = selectTailStart(history, 8_000, 1)
		expect(history.length - start).toBeGreaterThanOrEqual(N_MESSAGES_TO_KEEP)
		expect(history[start].role).toBe("assistant")
	})

	it("grows the tail while the budget allows", () => {
		const history = buildHistory()
		const small = selectTailStart(history, 8_000, 1)
		const large = selectTailStart(history, 1_000_000, 1)
		expect(large).toBeLessThan(small)
		expect(large).toBe(1)
	})
})

// ---------------------------------------------------------------------------
// Working set
// ---------------------------------------------------------------------------

describe("working set", () => {
	it("is generated from the transcript: edits, reads with ranges and hashes, todo, latest instruction", () => {
		const history = buildHistory()
		const set = collectWorkingSet(history)
		const a = set.files.find((f) => f.path === "src/a.ts")!
		const b = set.files.find((f) => f.path === "src/b.ts")!
		expect(a.edits.map((e) => e.tool)).toEqual(["apply_diff"])
		expect(a.reads[0].lines).toBe("1-200")
		expect(a.reads[0].hash).toMatch(/^[0-9a-f]{12}$/)
		expect(b.edits).toHaveLength(0)
		expect(b.reads[0].lines).toBe("1-50")
		expect(set.todo).toContain("| 1 | Fix the login bug | In Progress |")
		expect(set.latestUserInstruction).toBe("Use option two please")

		const formatted = formatWorkingSet(set)
		expect(formatted).toContain("[Working set: generated from the transcript, not from recall]")
		expect(formatted).toContain("- src/a.ts: apply_diff x1, last at message 6")
		expect(formatted).toMatch(/- src\/b\.ts lines=1-50 sha256:[0-9a-f]{12}/)
		expect(formatted).toContain('Latest user instruction (verbatim):\n"""\nUse option two please\n"""')
	})

	it("still knows paths and ranges after elision", () => {
		const reduced = reduceConversation(buildHistory(), { stage1Protected: 2 }).messages
		const set = collectWorkingSet(reduced)
		expect(set.files.find((f) => f.path === "src/b.ts")!.reads[0].lines).toBe("1-50")
		expect(set.files.find((f) => f.path === "src/a.ts")!.edits).toHaveLength(1)
	})
})

// ---------------------------------------------------------------------------
// Summary sizing
// ---------------------------------------------------------------------------

describe("summary sizing", () => {
	it("scales the target between 500 and 6000 tokens", () => {
		expect(getSummaryTargetTokens(5_000)).toBe(500)
		expect(getSummaryTargetTokens(40_000)).toBe(2_000)
		expect(getSummaryTargetTokens(140_000)).toBe(6_000)
		expect(getSummaryTargetTokens(900_000)).toBe(6_000)
	})

	it("scales the floor with the body and caps it", () => {
		expect(getMinimumSummaryChars(140_000, 50)).toBe(8_000)
		expect(getMinimumSummaryChars(40_000, 20)).toBe(2_800)
		expect(getMinimumSummaryChars(5_000, 5)).toBe(700)
		expect(getMinimumSummaryChars(200, 3)).toBe(350)
	})
})

// ---------------------------------------------------------------------------
// summarizeConversation
// ---------------------------------------------------------------------------

const SECTIONS = [
	"1. Previous Conversation:",
	"2. Current Work:",
	"3. Key Technical Concepts:",
	"4. Relevant Files and Code:",
	"5. Errors and Fixes:",
	"6. User Messages (Chronological):",
	"7. Pending Tasks and Next Steps:",
]
const validSummary = (chars = 1_200) =>
	SECTIONS.map((s) => `${s}\n${"Detail about the session. ".repeat(Math.ceil(chars / 7 / 26))}`).join("\n\n")

function mockHandler(summaries: string[], contextWindow = 200_000): ApiHandler {
	let call = 0
	return {
		createMessage: vi.fn().mockImplementation(() => {
			const textOut = summaries[Math.min(call++, summaries.length - 1)]
			return (async function* () {
				yield { type: "text", text: textOut }
				yield { type: "usage", inputTokens: 1000, outputTokens: 300, totalCost: 0.05 }
			})()
		}),
		countTokens: vi
			.fn()
			.mockImplementation(async (blocks: { text?: string }[]) =>
				Math.ceil(blocks.reduce((n, b) => n + (b.text?.length ?? 0), 0) / 4),
			),
		getModel: vi.fn().mockReturnValue({
			id: "test-model",
			info: { contextWindow, maxTokens: 8192, supportsImages: true, supportsPromptCache: true },
		}),
	} as unknown as ApiHandler
}

describe("summarizeConversation", () => {
	const taskId = "task-1"
	const prevTokens = 50_000

	beforeEach(() => vi.clearAllMocks())

	it("keeps the first user message and a verbatim tail around the summary", async () => {
		const history = buildHistory()
		const handler = mockHandler([validSummary()], 20_000) // small window → minimal tail
		const result = await summarizeConversation(history, handler, "sys", taskId, prevTokens, true)

		expect(result.error).toBeUndefined()
		expect(result.summary).toBe(validSummary())
		expect(result.cost).toBe(0.05)

		const out = result.messages
		// original task message kept verbatim (its old environment details were elided by stage 0)
		expect(out[0].role).toBe("user")
		expect(out[0].ts).toBe(history[0].ts)
		expect(text(out[0], 0)).toBe(text(history[0], 0))
		expect(out[1].role).toBe("assistant")
		expect(out[1].isSummary).toBe(true)
		const summaryText = text(out[1], 0)
		expect(summaryText.startsWith("[Context Summary]\n\n")).toBe(true)
		expect(summaryText).toContain("[Working set: generated from the transcript")
		expect(summaryText).toContain("Use option two please")
		expect(summaryText).toContain("| 1 | Fix the login bug | In Progress |")
		expect(out[2].role).toBe("user")
		expect(text(out[2], 0).startsWith(CONTINUATION_PROMPT)).toBe(true)

		const tail = out.slice(3)
		expect(tail.length).toBeGreaterThanOrEqual(N_MESSAGES_TO_KEEP)
		expect(tail[0].role).toBe("assistant")
		const original = history.slice(history.length - tail.length)
		tail.forEach((m, i) => expect(m).toBe(original[i]))
		expect(result.newContextTokens).toBeLessThan(prevTokens)
	})

	it("summarises only the middle: the transcript excludes the first message and the tail", async () => {
		const history = buildHistory()
		const handler = mockHandler([validSummary()], 20_000)
		await summarizeConversation(history, handler, "sys", taskId, prevTokens)
		const [prompt, messages] = (handler.createMessage as any).mock.calls[0]
		const transcript = messages[0].content[0].text as string
		expect(transcript).not.toContain("Fix the login bug in src/a.ts; do not touch src/c.ts")
		expect(transcript).not.toContain("Now I'll apply the change.")
		expect(transcript).toContain("[read_file for 'src/a.ts'] Result:")
		expect(prompt).toContain("the exact text to find, and the exact replacement text, verbatim")
		expect(prompt).toContain("Latest user intent")
		expect(prompt).toMatch(/OUTPUT LENGTH: about \d+ tokens/)
	})

	it("honours a custom condensing prompt and skips the section check for it", async () => {
		const history = buildHistory()
		const custom = "Write a haiku-free but thorough recap of the work so far."
		const freeform = "Recap. ".repeat(200)
		const handler = mockHandler([freeform], 20_000)
		const result = await summarizeConversation(history, handler, "sys", taskId, prevTokens, false, custom)
		expect(result.error).toBeUndefined()
		expect(result.summary).toBe(freeform)
		const [prompt] = (handler.createMessage as any).mock.calls[0]
		expect(prompt.startsWith(custom)).toBe(true)
	})

	it("retries once when the summary is too short and reports failure after that", async () => {
		const history = buildHistory()
		const handler = mockHandler(["too short", "still short"], 20_000)
		const result = await summarizeConversation(history, handler, "sys", taskId, prevTokens)
		expect(handler.createMessage).toHaveBeenCalledTimes(2)
		expect(result.error).toMatch(/too short .* after retry/)
		expect(result.messages).toBe(history)
	})

	it("rejects tool-like output and missing sections with the default prompt", async () => {
		const history = buildHistory()
		const handler = mockHandler(
			["<read_file><path>x</path></read_file>", "Prose without sections. ".repeat(80)],
			20_000,
		)
		const result = await summarizeConversation(history, handler, "sys", taskId, prevTokens)
		expect(result.error).toMatch(/missing required sections/)
	})

	it("does not summarise when there are too few messages, but still returns the reduced history", async () => {
		const history = buildHistory().slice(-2)
		const handler = mockHandler([validSummary()])
		const result = await summarizeConversation(history, handler, "sys", taskId, prevTokens)
		expect(handler.createMessage).not.toHaveBeenCalled()
		expect(result.messages).toBe(history)
		expect(result.summary).toBe("")
		expect(result.newContextTokens).toBe(prevTokens)
	})

	it("does not summarise when the budgeted tail already covers the whole history", async () => {
		const history = buildHistory()
		const handler = mockHandler([validSummary()], 1_000_000) // 60k tail budget: everything fits
		const result = await summarizeConversation(history, handler, "sys", taskId, prevTokens)
		expect(handler.createMessage).not.toHaveBeenCalled()
		expect(result.error).toBeUndefined()
		// The staged reduction alone would free well under the 40k hysteresis:
		// not worth a prompt-cache miss, so the history comes back as-is and the
		// caller writes no condense_context row.
		expect(reduceConversation(history).freedTokensEstimate).toBeLessThan(REDUCTION_MIN_FREED_TOKENS)
		expect(result.messages).toBe(history)
		expect(result.summary).toBe("")
		expect(result.newContextTokens).toBe(prevTokens)
	})

	it("persists a reduction-only result once it clears the hysteresis, counting the messages only", async () => {
		// One huge old read: ~3 MB of text, far over the 40k-token hysteresis.
		const history = buildHistory()
		history[2] = user(
			["[read_file for 'src/a.ts'] Result:", readResult("src/a.ts", "1-60000", filler(60_000)), env()],
			3,
		)
		const handler = mockHandler([validSummary()], 1_000_000)
		const result = await summarizeConversation(history, handler, "sys", taskId, 900_000)
		expect(handler.createMessage).not.toHaveBeenCalled()
		expect(result.summary).toMatch(/^Elided \d+ older tool outputs/)
		expect(text(result.messages[2], 1)).toContain(ELIDED_MARKER)
		// newContextTokens is the count of the messages (no system prompt), the
		// same semantics as the summary path and the Task reduction path.
		const blocks = result.messages.flatMap((m) => m.content as { text?: string }[])
		expect(result.newContextTokens).toBe(await handler.countTokens(blocks as any))
		expect(result.newContextTokens).toBeLessThan(900_000)
	})

	it("bounds an oversized first message to head + tail with a note and summarises it", async () => {
		const history = buildHistory()
		const pasted = `<task>\nMUST keep src/c.ts untouched. START-MARKER\n${filler(4_000, "spec")}\nEND-MARKER do not touch src/c.ts\n</task>`
		history[0] = user([pasted, env(false)], 1)
		// Small window → minimal tail; the big body raises the summary floor to its 8k cap.
		const handler = mockHandler([validSummary(9_000)], 20_000)
		const budget = Math.round((tailTokenBudget(20_000) + 6_000) * FIRST_MESSAGE_BUDGET_FRACTION)
		expect(estimateMessageTokens(history[0])).toBeGreaterThan(budget)

		const result = await summarizeConversation(history, handler, "sys", taskId, 150_000)
		expect(result.error).toBeUndefined()
		const first = result.messages[0]
		expect(first.role).toBe("user")
		expect(estimateMessageTokens(first)).toBeLessThanOrEqual(budget)
		const firstText = text(first, 0)
		expect(firstText).toContain("START-MARKER")
		expect(firstText).toContain("END-MARKER do not touch src/c.ts")
		expect(firstText).toContain("[elided:")
		expect(firstText).toContain("from the middle of the original task message")
		// The cut text is not lost silently: the summary saw the whole message.
		const [, messages] = (handler.createMessage as any).mock.calls[0]
		expect(messages[0].content[0].text).toContain("spec 2000:")
		// Idempotent: the bounded message is under budget and stays as it is.
		expect(boundFirstMessage(first, budget).bounded).toBe(false)
		// A normal-sized first message is kept verbatim.
		const normal = buildHistory()[0]
		expect(boundFirstMessage(normal, budget).message).toBe(normal)
	})

	it("merges an earlier summary instead of stacking summaries", async () => {
		const history = buildHistory()
		const handler = mockHandler([validSummary(), validSummary(1_500)], 20_000)
		const once = await summarizeConversation(history, handler, "sys", taskId, prevTokens)
		// continue the conversation past the tail so there is something new to summarise
		const continued = [
			...once.messages,
			assistant("<read_file><args><file><path>src/d.ts</path></file></args></read_file>", 20),
			user(["[read_file for 'src/d.ts'] Result:", readResult("src/d.ts", "1-30", filler(30, "d")), env()], 21),
			assistant("Reading more.", 22),
			user(["<user_message>\nAlso update the README\n</user_message>", env()], 23),
			assistant("Will do.", 24),
			user(["[execute_command for 'ls'] Result:", "a b c", env()], 25),
			assistant("Done listing.", 26),
		]
		const twice = await summarizeConversation(continued, handler, "sys", taskId, prevTokens)
		expect(twice.error).toBeUndefined()
		expect(twice.messages.filter((m) => m.isSummary)).toHaveLength(1)
		expect(twice.messages[0]).toBe(once.messages[0]) // first message untouched the second time
		expect(text(twice.messages[0], 0)).toBe(text(history[0], 0))
		const [, messages] = (handler.createMessage as any).mock.calls[1]
		expect(messages[0].content[0].text).toContain("[Context Summary]")
		expect(messages[0].content[0].text).not.toContain(CONTINUATION_PROMPT)
		expect(text(twice.messages[1], 0)).toContain("Also update the README")
	})
})

// ---------------------------------------------------------------------------
// Soft cap hysteresis (what Task.attemptApiRequest does each turn)
// ---------------------------------------------------------------------------

describe("soft cap hysteresis", () => {
	it("rewrites the history a few times over 20 turns above the soft cap, never every turn", () => {
		// 1M model, ~420k context, no summary. Each turn adds one ~8k-token tool
		// result; the one crossing the 12-message boundary would be tombstoned.
		let history = buildHistory()
		let total = 420_000
		const rows: string[] = []
		const rewriteTurns: number[] = []

		for (let turn = 1; turn <= 20; turn++) {
			const ts = 100 + turn * 2
			history = [
				...history,
				assistant(`<read_file><args><file><path>src/t${turn}.ts</path></file></args></read_file>`, ts),
				user(
					[
						`[read_file for 'src/t${turn}.ts'] Result:`,
						readResult(`src/t${turn}.ts`, "1-600", filler(600, `t${turn}`)),
						env(),
					],
					ts + 1,
				),
			]
			total += 8_000

			const plan = planCondense({
				contextTokens: total,
				systemPromptTokens: 10_000,
				systemPromptIncluded: true,
				contextWindow: 1_000_000,
				maxTokens: 32_000,
				defaulted: false,
				thresholdPercent: 80,
				messageCount: history.length,
				overflow: false,
			})
			expect(plan.shouldReduce).toBe(true)
			expect(plan.shouldSummarize).toBe(false)
			expect(total).toBeGreaterThanOrEqual(REDUCTION_SOFT_CAP_TOKENS)

			// Computed without touching the history; persisted only past the hysteresis.
			const before = history
			const reduced = reduceConversation(history)
			expect(history).toBe(before)
			expect(reduced.changed).toBe(true) // there is always something small to elide
			if (shouldApplyReduction(reduced, total)) {
				history = reduced.messages
				total -= reduced.freedTokensEstimate
				rows.push(describeReduction(reduced))
				rewriteTurns.push(turn)
				// Idempotent: the persisted history has nothing left to free right away.
				expect(reduceConversation(history).changed).toBe(false)
			}
		}

		expect(rewriteTurns.length).toBeGreaterThan(0)
		expect(rewriteTurns.length).toBeLessThanOrEqual(5)
		// Never two turns in a row: a rewrite needs the hysteresis to accumulate again.
		for (let i = 1; i < rewriteTurns.length; i++) {
			expect(rewriteTurns[i] - rewriteTurns[i - 1]).toBeGreaterThan(1)
		}
		// One "Context condensed" row per rewrite, and nothing else.
		expect(rows).toHaveLength(rewriteTurns.length)
		rows.forEach((row) => expect(row).toMatch(/^Elided \d+ older tool outputs/))
	})

	it("applies without hysteresis once the freed amount is large enough", () => {
		const history = buildHistory()
		const reduced = reduceConversation(history)
		expect(reduced.changed).toBe(true)
		expect(shouldApplyReduction(reduced, 420_000)).toBe(false) // a few tombstones only
		expect(shouldApplyReduction({ ...reduced, freedTokensEstimate: 50_000 }, 420_000)).toBe(true)
		expect(shouldApplyReduction({ ...reduced, freedTokensEstimate: 50_000 }, 900_000)).toBe(false) // 10% = 90k
		expect(shouldApplyReduction({ ...reduced, changed: false, freedTokensEstimate: 0 }, 1)).toBe(false)
	})
})

import { createHash } from "crypto"

import type { Anthropic } from "@anthropic-ai/sdk"
import type { ClineMessage } from "@siid-code/types"

import type { ApiMessage } from "../task-persistence/apiMessages"

export { isDefaultedModelInfo } from "../../api/providers/fetchers/anthropic"

/**
 * Staged, byte-stable reduction of a conversation history, run at condense
 * time only (never per turn, which would break prompt caching on every call).
 *
 * Stage 0: drop what is provably stale: `<environment_details>` outside the
 *          verbatim tail, and read_file results superseded by a later re-read
 *          or edit of the same path.
 * Stage 1: replace older tool outputs (outside the last STAGE1_PROTECTED_MESSAGES
 *          messages) with tombstones that say what was there and how to get it
 *          back. Commands and deploys keep command, exit code, head, tail and
 *          id-bearing lines; only their middle is dropped.
 *
 * Never touched: user text, assistant prose, images, anything already elided.
 * Applying the reduction twice yields byte-identical output.
 */

/** Absolute soft cap: stage 0-1 run once the context reaches this many tokens,
 *  even when the user's percentage threshold (the only trigger for a summary)
 *  is far away. See the report for the reasoning. */
export const REDUCTION_SOFT_CAP_TOKENS = 400_000

/**
 * Hysteresis for the soft cap. Rewriting the history is a full prompt-cache
 * miss, so a reduction is only persisted when it frees at least this much:
 * max(REDUCTION_MIN_FREED_TOKENS, REDUCTION_MIN_FREED_FRACTION of the context).
 * After a rewrite the same amount has to accumulate again before the next one.
 */
export const REDUCTION_MIN_FREED_TOKENS = 40_000
export const REDUCTION_MIN_FREED_FRACTION = 0.1

/** Messages at the end of the history that are always kept verbatim. */
export const VERBATIM_TAIL_MIN_MESSAGES = 4

/** Tool outputs within this many trailing messages are never tombstoned. */
export const STAGE1_PROTECTED_MESSAGES = 12

/** Fraction of the context window the verbatim tail may grow to, and its cap. */
export const TAIL_BUDGET_FRACTION = 0.12
export const TAIL_BUDGET_MIN_TOKENS = 6_000
export const TAIL_BUDGET_MAX_TOKENS = 60_000

export const ELIDED_MARKER = "[elided"

const MIN_ELIDABLE_CHARS = 600
const COMMAND_MIN_ELIDE_CHARS = 5_000
const COMMAND_HEAD_CHARS = 1_500
const COMMAND_TAIL_CHARS = 1_500
const COMMAND_MAX_ID_LINES = 40

/** Tools whose output is reproducible: a pointer is enough. */
const REPRODUCIBLE_TOOLS = new Set([
	"read_file",
	"list_files",
	"search_files",
	"codebase_search",
	"list_code_definition_names",
	"retrieve_sf_metadata",
	"get_task_guides",
	"fetch_instructions",
	"access_mcp_resource",
	"show_agent_deployment_guide",
])

/** Tools whose results may carry user text or steer the task: never elided. */
const NEVER_ELIDE_TOOLS = new Set([
	"ask_followup_question",
	"attempt_completion",
	"new_task",
	"switch_mode",
	"update_todo_list",
])

const EDIT_TOOLS = new Set(["apply_diff", "write_to_file", "insert_content", "search_and_replace"])

const RESULT_HEADER = /^\[([a-z_]+)(?: for (.*))?\] Result:$/s
const USER_TEXT_IN_RESULT = /<(feedback|answer|user_message)>/
const SF_OR_UUID_ID =
	/\b(?=[0-9A-Za-z]*\d)(?=[0-9A-Za-z]*[A-Za-z])[0-9A-Za-z]{15}(?:[0-9A-Za-z]{3})?\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/
const ID_LABEL = /\b(?:id|Id|ID|jobId|deployId|requestId)\b\s*[:=]/

type TextBlock = { type: "text"; text: string }

const isTextBlock = (block: unknown): block is TextBlock =>
	!!block &&
	typeof block === "object" &&
	(block as TextBlock).type === "text" &&
	typeof (block as TextBlock).text === "string"

/** Conservative token estimate for budgets (code runs ~3.5 chars/token). */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 3.5)
}

/** Display estimate for tombstones: deterministic, rounded to 100. */
function roughTokens(text: string): number {
	return Math.max(100, Math.round(text.length / 4 / 100) * 100)
}

export function estimateMessageTokens(message: ApiMessage): number {
	if (typeof message.content === "string") return estimateTokens(message.content)
	let total = 0
	for (const block of message.content) {
		if (isTextBlock(block)) total += estimateTokens(block.text)
		else if ((block as { type: string }).type === "image") total += 1_600
		else total += estimateTokens(JSON.stringify(block))
	}
	return total
}

export type ResultHeader = { tool: string; description: string; paths: string[] }

/** Parse a `[tool for 'x'] Result:` header block. */
export function parseResultHeader(text: string): ResultHeader | undefined {
	const match = RESULT_HEADER.exec(text.trim())
	if (!match) return undefined
	const tool = match[1]
	const description = match[2] ?? ""
	const paths: string[] = []
	const first = /^'([^']+)'/.exec(description)
	if (first && (tool === "read_file" || EDIT_TOOLS.has(tool))) paths.push(normalizePath(first[1]))
	return { tool, description, paths }
}

function normalizePath(p: string): string {
	return p.replace(/\\/g, "/").replace(/^\.\//, "")
}

export type ReadFileEntry = { path: string; lines?: string; hash?: string; chars: number }

/** Parse the `<file>` entries of a read_file result (plain or multi-file). */
export function parseReadFileResult(text: string): ReadFileEntry[] {
	const entries: ReadFileEntry[] = []
	const fileRe = /<file>([\s\S]*?)<\/file>/g
	let fm: RegExpExecArray | null
	while ((fm = fileRe.exec(text))) {
		const body = fm[1]
		const pathMatch = /<path>([\s\S]*?)<\/path>/.exec(body)
		if (!pathMatch) continue
		const ranges: string[] = []
		let contentChars = 0
		const hash = createHash("sha256")
		const contentRe = /<content(?: lines="([^"]*)")?>\n?([\s\S]*?)<\/content>/g
		let cm: RegExpExecArray | null
		while ((cm = contentRe.exec(body))) {
			if (cm[1]) ranges.push(cm[1])
			contentChars += cm[2].length
			hash.update(cm[2])
		}
		entries.push({
			path: normalizePath(pathMatch[1].trim()),
			lines: ranges.length > 0 ? ranges.join(",") : undefined,
			hash: contentChars > 0 ? hash.digest("hex").slice(0, 12) : undefined,
			chars: contentChars,
		})
	}
	return entries
}

/** Parse the entries of a read_file tombstone produced by this module. */
export function parseReadFileTombstone(text: string): ReadFileEntry[] {
	const entries: ReadFileEntry[] = []
	const re = /read_file path=(\S+)(?: lines=(\S+))?/g
	let m: RegExpExecArray | null
	while ((m = re.exec(text))) {
		entries.push({ path: m[1], lines: m[2], chars: 0 })
	}
	return entries
}

function readFileTombstone(text: string): string {
	const entries = parseReadFileResult(text)
	const approx = roughTokens(text)
	if (entries.length === 0) {
		return `[elided: read_file ~${approx} tokens; re-read if needed]`
	}
	const parts = entries.map((e) => `read_file path=${e.path}${e.lines ? ` lines=${e.lines}` : ""}`)
	return `[elided: ${parts.join(", ")} ~${approx} tokens; re-read if needed]`
}

function pointerTombstone(header: ResultHeader, text: string): string {
	const desc = header.description ? ` ${truncateOneLine(header.description, 160)}` : ""
	return `[elided: ${header.tool}${desc} ~${roughTokens(text)} tokens; re-run if needed]`
}

function truncateOneLine(s: string, max: number): string {
	const one = s.replace(/\s+/g, " ").trim()
	return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

/**
 * Keep head, tail and id-bearing lines of a command/deploy output; drop the
 * middle. Returns undefined when nothing worth dropping.
 */
function headTailElision(tool: string, text: string): string | undefined {
	if (text.length < COMMAND_MIN_ELIDE_CHARS) return undefined

	const headEnd = text.lastIndexOf("\n", COMMAND_HEAD_CHARS)
	const tailStart = text.indexOf("\n", text.length - COMMAND_TAIL_CHARS)
	if (headEnd <= 0 || tailStart < 0 || tailStart <= headEnd) return undefined

	const head = text.slice(0, headEnd)
	const middle = text.slice(headEnd + 1, tailStart)
	const tail = text.slice(tailStart + 1)
	if (middle.length < 1_000) return undefined

	const middleLines = middle.split("\n")
	const idLines = middleLines.filter((line) => SF_OR_UUID_ID.test(line) || ID_LABEL.test(line))
	const kept = idLines.slice(0, COMMAND_MAX_ID_LINES)
	const keptNote =
		kept.length > 0
			? `; ${kept.length}${idLines.length > kept.length ? ` of ${idLines.length}` : ""} lines with ids kept below`
			: ""

	return [
		head,
		`[elided: middle of ${tool} output, ${middleLines.length} lines ~${roughTokens(middle)} tokens omitted; head, tail and exit code kept${keptNote}]`,
		...kept,
		tail,
	].join("\n")
}

/** Index of a result's content block: the block right after its header. */
type ResultRef = { messageIndex: number; blockIndex: number; header: ResultHeader }

function collectResults(messages: ApiMessage[]): ResultRef[] {
	const refs: ResultRef[] = []
	messages.forEach((message, messageIndex) => {
		if (message.role !== "user" || !Array.isArray(message.content)) return
		for (let i = 0; i + 1 < message.content.length; i++) {
			const block = message.content[i]
			if (!isTextBlock(block)) continue
			const header = parseResultHeader(block.text)
			if (!header) continue
			if (isTextBlock(message.content[i + 1])) refs.push({ messageIndex, blockIndex: i + 1, header })
		}
	})
	return refs
}

export type ReductionResult = {
	messages: ApiMessage[]
	changed: boolean
	elidedBlocks: number
	freedChars: number
	freedTokensEstimate: number
}

export type ReductionOptions = {
	/** Trailing messages kept verbatim (stage 0 does not touch them). */
	protectedTail?: number
	/** Trailing messages whose tool outputs stage 1 leaves alone. */
	stage1Protected?: number
}

export function reduceConversation(messages: ApiMessage[], options: ReductionOptions = {}): ReductionResult {
	const protectedTail = options.protectedTail ?? VERBATIM_TAIL_MIN_MESSAGES
	const stage1Protected = options.stage1Protected ?? STAGE1_PROTECTED_MESSAGES
	const stage0Limit = Math.max(0, messages.length - protectedTail)
	const stage1Limit = Math.max(0, messages.length - stage1Protected)

	const replacements = new Map<number, Map<number, string>>()
	let freedChars = 0
	let elidedBlocks = 0

	const replace = (messageIndex: number, blockIndex: number, original: string, replacement: string) => {
		if (replacement.length >= original.length) return
		let perMessage = replacements.get(messageIndex)
		if (!perMessage) replacements.set(messageIndex, (perMessage = new Map()))
		if (perMessage.has(blockIndex)) return
		perMessage.set(blockIndex, replacement)
		freedChars += original.length - replacement.length
		elidedBlocks += 1
	}

	const results = collectResults(messages)

	// Paths touched later than a given message index (for stage 0 supersession).
	const touchedAt: { messageIndex: number; path: string }[] = []
	for (const ref of results) {
		for (const p of ref.header.paths) touchedAt.push({ messageIndex: ref.messageIndex, path: p })
	}
	const supersededLater = (messageIndex: number, paths: string[]) =>
		paths.length > 0 && paths.every((p) => touchedAt.some((t) => t.messageIndex > messageIndex && t.path === p))

	// Stage 0a: old environment details.
	for (let m = 0; m < stage0Limit; m++) {
		const message = messages[m]
		if (message.role !== "user" || !Array.isArray(message.content)) continue
		message.content.forEach((block, b) => {
			if (!isTextBlock(block)) return
			const text = block.text
			if (text.startsWith("<environment_details>") && !text.includes(ELIDED_MARKER)) {
				replace(m, b, text, `[elided: environment_details ~${roughTokens(text)} tokens]`)
			}
		})
	}

	for (const ref of results) {
		const message = messages[ref.messageIndex]
		const block = (message.content as TextBlock[])[ref.blockIndex]
		const text = block.text
		const { tool } = ref.header

		if (text.includes(ELIDED_MARKER) || NEVER_ELIDE_TOOLS.has(tool) || USER_TEXT_IN_RESULT.test(text)) continue
		if (text.length < MIN_ELIDABLE_CHARS) continue

		// Stage 0b: superseded reads.
		if (ref.messageIndex < stage0Limit && tool === "read_file") {
			const paths = parseReadFileResult(text).map((e) => e.path)
			const known = paths.length > 0 ? paths : ref.header.paths
			if (supersededLater(ref.messageIndex, known)) {
				replace(ref.messageIndex, ref.blockIndex, text, readFileTombstone(text))
				continue
			}
		}

		// Stage 1: older tool outputs.
		if (ref.messageIndex >= stage1Limit) continue
		if (tool === "read_file") {
			replace(ref.messageIndex, ref.blockIndex, text, readFileTombstone(text))
		} else if (REPRODUCIBLE_TOOLS.has(tool)) {
			replace(ref.messageIndex, ref.blockIndex, text, pointerTombstone(ref.header, text))
		} else {
			// Commands, deploys, edits, MCP calls: unique output, keep its shape.
			const elided = headTailElision(tool, text)
			if (elided) replace(ref.messageIndex, ref.blockIndex, text, elided)
		}
	}

	if (replacements.size === 0) {
		return { messages, changed: false, elidedBlocks: 0, freedChars: 0, freedTokensEstimate: 0 }
	}

	const next = messages.map((message, m) => {
		const perMessage = replacements.get(m)
		if (!perMessage) return message
		const content = (message.content as Anthropic.Messages.ContentBlockParam[]).map((block, b) => {
			const replacement = perMessage.get(b)
			return replacement === undefined ? block : { type: "text" as const, text: replacement }
		})
		return { ...message, content }
	})

	return {
		messages: next,
		changed: true,
		elidedBlocks,
		freedChars,
		freedTokensEstimate: Math.round(freedChars / 4),
	}
}

export function describeReduction(result: ReductionResult): string {
	return `Elided ${result.elidedBlocks} older tool output${result.elidedBlocks === 1 ? "" : "s"} (~${result.freedTokensEstimate.toLocaleString()} tokens). Each is replaced by a pointer that says how to get it back.`
}

/** Tokens a reduction must free before it is worth a prompt-cache miss. */
export function reductionHysteresisTokens(totalTokens: number): number {
	return Math.max(REDUCTION_MIN_FREED_TOKENS, Math.round(totalTokens * REDUCTION_MIN_FREED_FRACTION))
}

/**
 * Whether a computed (not yet persisted) reduction should be written back.
 * `reduceConversation` never mutates its input, so callers compute first and
 * only persist when this says the freed amount clears the hysteresis.
 */
export function shouldApplyReduction(reduced: ReductionResult, totalTokens: number): boolean {
	return reduced.changed && reduced.freedTokensEstimate >= reductionHysteresisTokens(totalTokens)
}

// ---------------------------------------------------------------------------
// First message bound
// ---------------------------------------------------------------------------

/** Share of the tail + summary budget the verbatim first message may take. */
export const FIRST_MESSAGE_BUDGET_FRACTION = 0.25
/** Marks a first message already cut to head + tail (stage 0 tombstones also use ELIDED_MARKER). */
const FIRST_MESSAGE_CUT_NOTE = "from the middle of the original task message"

/**
 * The first user message is kept verbatim across condenses, so a pasted
 * novel would survive every summary and leave nothing to free. Above the
 * budget it is cut to head + tail with an explicit note; the summary still
 * sees the whole text because the caller includes it in the transcript.
 * Idempotent: a bounded message is under budget and comes back unchanged.
 */
export function boundFirstMessage(
	message: ApiMessage,
	budgetTokens: number,
): { message: ApiMessage; bounded: boolean } {
	if (message.role !== "user" || estimateMessageTokens(message) <= budgetTokens) {
		return { message, bounded: false }
	}
	const blocks: Anthropic.Messages.ContentBlockParam[] =
		typeof message.content === "string" ? [{ type: "text", text: message.content }] : message.content
	const text = blocks
		.filter(isTextBlock)
		.map((b) => b.text)
		.join("\n\n")
	if (text.includes(FIRST_MESSAGE_CUT_NOTE)) {
		return { message, bounded: false }
	}
	const budgetChars = Math.max(1_000, Math.floor(budgetTokens * 3.5))
	const headChars = Math.floor(budgetChars * 0.6)
	const tailChars = Math.floor(budgetChars * 0.3)
	if (text.length <= headChars + tailChars) {
		return { message, bounded: false }
	}
	const omitted = text.length - headChars - tailChars
	const note =
		`\n\n[elided: ${omitted.toLocaleString()} characters (~${roughTokens(text.slice(headChars, text.length - tailChars)).toLocaleString()} tokens) ` +
		`${FIRST_MESSAGE_CUT_NOTE}, cut when the context was condensed. ` +
		`The context summary carries its substance; ask the user if an exact detail from it is needed.]\n\n`
	const boundedText = text.slice(0, headChars) + note + text.slice(text.length - tailChars)
	const others = blocks.filter((b) => !isTextBlock(b))
	return {
		message: { ...message, content: [...others, { type: "text", text: boundedText }] },
		bounded: true,
	}
}

// ---------------------------------------------------------------------------
// Verbatim tail selection
// ---------------------------------------------------------------------------

/** Token budget for the verbatim tail, scaled to the window. */
export function tailTokenBudget(contextWindow: number): number {
	const scaled = Math.round(contextWindow * TAIL_BUDGET_FRACTION)
	return Math.max(TAIL_BUDGET_MIN_TOKENS, Math.min(TAIL_BUDGET_MAX_TOKENS, scaled))
}

/**
 * Index where the verbatim tail starts. Always keeps the last
 * VERBATIM_TAIL_MIN_MESSAGES, grows backwards while the budget allows, then
 * aligns to an assistant message so a tool call stays with its result text.
 * `minStart` is the first index the tail may start at.
 */
export function selectTailStart(messages: ApiMessage[], contextWindow: number, minStart = 1): number {
	const budget = tailTokenBudget(contextWindow)
	let start = Math.max(minStart, messages.length - VERBATIM_TAIL_MIN_MESSAGES)
	let used = 0
	for (let i = messages.length - 1; i >= start; i--) used += estimateMessageTokens(messages[i])

	while (start > minStart) {
		const cost = estimateMessageTokens(messages[start - 1])
		if (used + cost > budget) break
		used += cost
		start -= 1
	}

	// Pairing: a user message holds the result text of the assistant call before it.
	if (start > minStart && messages[start].role === "user") start -= 1
	return Math.min(start, messages.length)
}

// ---------------------------------------------------------------------------
// Decision helpers used by Task.attemptApiRequest
// ---------------------------------------------------------------------------

export type CondensePlanInput = {
	contextTokens: number
	systemPromptTokens: number
	/** True when contextTokens already include the system prompt (API usage numbers do). */
	systemPromptIncluded: boolean
	contextWindow: number
	maxTokens: number
	defaulted: boolean
	thresholdPercent: number
	messageCount: number
	overflow: boolean
}

export type CondensePlan = {
	totalTokens: number
	availableTokens: number
	percentUsed: number
	shouldReduce: boolean
	shouldSummarize: boolean
	reason: string
}

export const MIN_MESSAGES_FOR_CONDENSING = 3

export function planCondense(input: CondensePlanInput): CondensePlan {
	const totalTokens = input.contextTokens + (input.systemPromptIncluded ? 0 : input.systemPromptTokens)
	const boundedMaxTokens = Math.max(0, Math.min(input.maxTokens, Math.max(0, input.contextWindow - 1)))
	const availableTokens = Math.max(1, input.contextWindow - boundedMaxTokens)
	const percentUsed = (totalTokens / availableTokens) * 100
	const base = { totalTokens, availableTokens, percentUsed }

	if (input.messageCount < MIN_MESSAGES_FOR_CONDENSING) {
		return { ...base, shouldReduce: false, shouldSummarize: false, reason: "too few messages" }
	}
	if (input.overflow) {
		return { ...base, shouldReduce: true, shouldSummarize: true, reason: "provider reported context overflow" }
	}
	if (input.defaulted) {
		return {
			...base,
			shouldReduce: false,
			shouldSummarize: false,
			reason: "model info is defaulted (window unknown); waiting for live info or a provider overflow error",
		}
	}
	const shouldSummarize = percentUsed >= input.thresholdPercent
	const shouldReduce = shouldSummarize || totalTokens >= REDUCTION_SOFT_CAP_TOKENS
	return {
		...base,
		shouldReduce,
		shouldSummarize,
		reason: shouldSummarize
			? `${percentUsed.toFixed(1)}% >= ${input.thresholdPercent}% threshold`
			: shouldReduce
				? `${totalTokens} tokens >= ${REDUCTION_SOFT_CAP_TOKENS} soft cap`
				: "below threshold",
	}
}

/** Do the latest usage numbers already include the system prompt? */
export function contextTokensIncludeSystemPrompt(clineMessages: ClineMessage[]): boolean {
	for (let i = clineMessages.length - 1; i >= 0; i--) {
		const message = clineMessages[i]
		if (message.type !== "say") continue
		if (message.say === "condense_context") {
			if (message.contextCondense?.newContextTokens) return false
		} else if (message.say === "api_req_started" && message.text) {
			try {
				const { tokensIn, tokensOut, cacheWrites, cacheReads } = JSON.parse(message.text)
				if ((tokensIn || 0) + (tokensOut || 0) + (cacheWrites || 0) + (cacheReads || 0) > 0) return true
			} catch {
				// ignore
			}
		}
	}
	return true
}

const OVERFLOW_PATTERNS = [
	/prompt is too long/i,
	/input is too long/i,
	/context[_ ]length[_ ]exceeded/i,
	/maximum context length/i,
	/exceeds? the (?:model'?s? )?(?:maximum )?context/i,
	/exceed(?:s)? context limit/i,
	/input length and `?max_tokens`? exceed/i,
	/exceeds the maximum number of tokens/i,
	/too many tokens/i,
	/request_too_large/i,
]

export function isContextOverflowMessage(text: string | undefined): boolean {
	return !!text && OVERFLOW_PATTERNS.some((re) => re.test(text))
}

const handledOverflows = new WeakMap<object, number>()

/**
 * The provider rejected the last request for being too long and nothing has
 * been condensed since. Returns the error message's timestamp, or undefined.
 */
export function findUnhandledContextOverflow(
	task: object,
	clineMessages: ClineMessage[],
): { ts: number; text: string } | undefined {
	const handledTs = handledOverflows.get(task) ?? -1
	for (let i = clineMessages.length - 1; i >= 0; i--) {
		const message = clineMessages[i]
		if (message.type === "say" && message.say === "condense_context") return undefined
		const isApiError =
			(message.type === "say" && message.say === "api_req_retry_delayed") ||
			(message.type === "ask" && message.ask === "api_req_failed")
		if (!isApiError) continue
		if (!isContextOverflowMessage(message.text)) return undefined
		return message.ts > handledTs ? { ts: message.ts, text: message.text ?? "" } : undefined
	}
	return undefined
}

export function markContextOverflowHandled(task: object, ts: number) {
	handledOverflows.set(task, ts)
}

/**
 * Backoff for failed automatic summaries. Every attempt sends the whole
 * transcript (more than once when validation fails), so a failure must not
 * simply repeat next turn. After a failure the next automatic summary needs
 * this much more context than the failed one had; after
 * AUTO_SUMMARY_MAX_FAILURES in a row there are no more until a manual condense
 * or a successful summary resets the count. Only the summary call is held back:
 * staged reduction and the provider-overflow path do not consult this.
 */
export const AUTO_SUMMARY_RETRY_GROWTH_FRACTION = 0.1
export const AUTO_SUMMARY_MAX_FAILURES = 2

const autoSummaryFailures = new WeakMap<object, { count: number; tokens: number }>()

export function isAutoSummaryAllowed(task: object, totalTokens: number): boolean {
	const failures = autoSummaryFailures.get(task)
	if (!failures) return true
	if (failures.count >= AUTO_SUMMARY_MAX_FAILURES) return false
	return totalTokens >= failures.tokens * (1 + AUTO_SUMMARY_RETRY_GROWTH_FRACTION)
}

/** Returns true when this failure is the one that pauses automatic summaries. */
export function recordAutoSummaryFailure(task: object, totalTokens: number): boolean {
	const count = (autoSummaryFailures.get(task)?.count ?? 0) + 1
	autoSummaryFailures.set(task, { count, tokens: totalTokens })
	return count === AUTO_SUMMARY_MAX_FAILURES
}

export function resetAutoSummaryFailures(task: object) {
	autoSummaryFailures.delete(task)
}

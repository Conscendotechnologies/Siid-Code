import Anthropic from "@anthropic-ai/sdk"

import { TelemetryService } from "@siid-code/telemetry"

import { ApiHandler } from "../../api"
import { ApiMessage } from "../task-persistence/apiMessages"
import { maybeRemoveImageBlocks } from "../../api/transform/image-cleaning"
import {
	ELIDED_MARKER,
	FIRST_MESSAGE_BUDGET_FRACTION,
	boundFirstMessage,
	describeReduction,
	estimateMessageTokens,
	reduceConversation,
	selectTailStart,
	shouldApplyReduction,
	tailTokenBudget,
	VERBATIM_TAIL_MIN_MESSAGES,
} from "./stages"
import { buildWorkingSet } from "./workingSet"

export {
	reduceConversation,
	selectTailStart,
	tailTokenBudget,
	planCondense,
	REDUCTION_SOFT_CAP_TOKENS,
	VERBATIM_TAIL_MIN_MESSAGES,
	STAGE1_PROTECTED_MESSAGES,
} from "./stages"
export { buildWorkingSet, collectWorkingSet, formatWorkingSet } from "./workingSet"

/** Minimum number of trailing messages kept verbatim after a summary. */
export const N_MESSAGES_TO_KEEP = VERBATIM_TAIL_MIN_MESSAGES
export const MIN_CONDENSE_THRESHOLD = 5 // Minimum percentage of context window to trigger condensing
export const MAX_CONDENSE_THRESHOLD = 80 // Maximum percentage of context window to trigger condensing
export const CONTINUATION_PROMPT = "Please continue from where we left off based on the summary above."
const CONTINUATION_PROMPT_WITH_TAIL = `${CONTINUATION_PROMPT} The messages after this one are the verbatim most recent part of the conversation; a tool output shown as ${ELIDED_MARKER}: ...] can be fetched again with the tool named in it.`
const MAX_SUMMARY_ATTEMPTS = 2
const MIN_MESSAGES_FOR_SUMMARY = 3

// Summary size scales with what is being summarised: ~5% of the summarised
// tokens, so 2,000 tokens at a 40k body up to 6,000 at 120k+; smaller bodies
// (rare for an automatic condense) scale down to the floor.
const SUMMARY_TARGET_MIN_TOKENS = 500
const SUMMARY_TARGET_MAX_TOKENS = 6_000
const SUMMARY_TARGET_FRACTION = 0.05
const MIN_SUMMARY_CHARS_ABSOLUTE = 350
const MIN_SUMMARY_CHARS_MAX = 8_000
// Never demand more than this share of the body's own characters.
const MIN_SUMMARY_BODY_FRACTION = 0.25

const SUMMARY_RETRY_PROMPT_SUFFIX = `\
CRITICAL RETRY INSTRUCTION:
- Your previous response was invalid because it resembled a tool call / XML tag output.
- Respond with plain text prose only.
- Do NOT output any tool syntax.
- Do NOT output any XML tags like <tool_name>...</tool_name>.
- Do NOT wrap the response in angle-bracket blocks.
`

const TOOL_LIKE_TAG_PATTERN =
	/<(read_file|get_task_guides|search_files|list_files|list_code_definition_names|retrieve_sf_metadata|apply_diff|write_to_file|execute_command|ask_followup_question|attempt_completion|new_task|switch_mode)\b/i
const REQUIRED_SUMMARY_SECTIONS = [
	"1. Previous Conversation:",
	"2. Current Work:",
	"3. Key Technical Concepts:",
	"4. Relevant Files and Code:",
	"5. Errors and Fixes:",
	"6. User Messages (Chronological):",
	"7. Pending Tasks and Next Steps:",
]

function isToolLikeSummaryOutput(summaryText: string): boolean {
	const trimmed = summaryText.trim()

	if (!trimmed) {
		return false
	}

	if (TOOL_LIKE_TAG_PATTERN.test(trimmed)) {
		return true
	}

	// Catch generic single-tag XML-style responses like <foo>...</foo>
	const fullXmlBlock = trimmed.match(/^<([a-z][a-z0-9_-]*)>\s*[\s\S]*<\/\1>\s*$/i)
	if (fullXmlBlock) {
		return true
	}

	return false
}

/** Target summary length in tokens for a body of `bodyTokens`. */
export function getSummaryTargetTokens(bodyTokens: number): number {
	const scaled = Math.round(bodyTokens * SUMMARY_TARGET_FRACTION)
	return Math.max(SUMMARY_TARGET_MIN_TOKENS, Math.min(SUMMARY_TARGET_MAX_TOKENS, scaled))
}

/**
 * Minimum acceptable summary length in characters: roughly 35% of the target
 * (at ~4 chars/token), never below the absolute floor, scaled by message count.
 */
export function getMinimumSummaryChars(bodyTokens: number, messageCount: number): number {
	const targetBasedMinimum = Math.round(getSummaryTargetTokens(bodyTokens) * 1.4)
	const bodyCap = Math.round(bodyTokens * 3.5 * MIN_SUMMARY_BODY_FRACTION)
	const messageBasedMinimum = messageCount * 40
	return Math.min(
		MIN_SUMMARY_CHARS_MAX,
		Math.max(MIN_SUMMARY_CHARS_ABSOLUTE, messageBasedMinimum, Math.min(targetBasedMinimum, bodyCap)),
	)
}

function isSummaryTooShort(summaryText: string, minSummaryChars: number): boolean {
	return summaryText.trim().length < minSummaryChars
}

function buildRetryPromptSuffix(validationError: string, minSummaryChars: number): string {
	return `${SUMMARY_RETRY_PROMPT_SUFFIX}
CRITICAL LENGTH INSTRUCTION:
- Your previous response was also invalid because it was too short and lost important task details.
- Minimum required summary length: ${minSummaryChars} characters.
- Keep concrete details: files, errors/fixes, user requests, and pending steps.
- Validation reason: ${validationError}.
`
}

function getMissingSummarySections(summaryText: string): string[] {
	return REQUIRED_SUMMARY_SECTIONS.filter((section) => !summaryText.includes(section))
}

function formatMessageContentForTranscript(content: ApiMessage["content"]): string {
	if (typeof content === "string") {
		return content
	}

	return content
		.map((block) => {
			switch (block.type) {
				case "text":
					return block.text
				case "tool_use": {
					const inputSummary =
						typeof block.input === "string" ? block.input : JSON.stringify(block.input ?? {}, null, 2)
					return `[tool_use] name=${block.name} id=${block.id}\n${inputSummary}`
				}
				case "tool_result": {
					if (typeof block.content === "string") {
						return `[tool_result] tool_use_id=${block.tool_use_id}${block.is_error ? " error=true" : ""}\n${block.content}`
					}

					const nestedContent = (block.content ?? [])
						.map((nestedBlock: { type: string; text?: string }) =>
							nestedBlock.type === "text" ? (nestedBlock.text ?? "") : `[${nestedBlock.type} omitted]`,
						)
						.join("\n")
					return `[tool_result] tool_use_id=${block.tool_use_id}${block.is_error ? " error=true" : ""}\n${nestedContent}`
				}
				case "image":
					return "[image omitted]"
				default:
					return `[${block.type} omitted]`
			}
		})
		.join("\n")
}

function buildConversationTranscript(messages: ApiMessage[]): string {
	return messages
		.map((message, index) => {
			const content = formatMessageContentForTranscript(message.content).trim()
			const safeContent = content.length > 0 ? content : "[empty]"
			return `[${index + 1}] ${message.role.toUpperCase()}:\n${safeContent}`
		})
		.join("\n\n")
}

const SUMMARY_PROMPT = `\
You are writing an internal context snapshot for a coding agent to resume work accurately. This is NOT a user-facing reply.

ABSOLUTE OUTPUT RULES:
- Plain prose only. No XML, no markdown code fences, no angle-bracket tags.
- Do NOT reproduce raw tool calls or tool results. Translate them into factual statements.
- Do NOT ask questions or offer options.
- Any violation renders this output invalid.

OUTPUT LENGTH: __LENGTH__

WHAT THE AGENT WILL STILL HAVE: the original task message, the most recent messages verbatim, and a generated working set listing files read or edited (with line ranges and content hashes) and the current todo list. Do not repeat the working set; spend your words on reasoning, decisions, and anything only the older messages knew. Tool outputs shown as "[elided: ...]" were removed on purpose; mention what they established, not that they were elided. If the transcript starts with an earlier "[Context Summary]", merge it with the newer messages into one summary, keeping every still-relevant fact.

---

Write the summary using exactly these 7 section headers in order:

1. Previous Conversation:
Summarize the overall arc of the session in 2–4 sentences: what the user wanted, what approach was taken, and where things stand now.

2. Current Work:
Describe the most recent task in detail. Include: what was attempted, what succeeded, what is in-progress or blocked, and the exact state of any code being written or modified. If an edit is pending, partially applied, or was planned but not yet made, give it exactly: the file path, the exact text to find, and the exact replacement text, verbatim, so the agent can apply it without re-reading.

3. Key Technical Concepts:
List the languages, frameworks, libraries, APIs, design patterns, and architectural constraints active in this session. Be specific (e.g., "TypeScript with strict null checks", "React 18 concurrent mode", "REST API on port 3001").

4. Relevant Files and Code:
For each file touched: its path, what changed, and why. Name the functions or classes involved. Include short exact code fragments (a few lines) wherever the agent would otherwise have to re-read the file to continue: signatures it must call, the lines around a pending edit, an identifier it must reuse.

5. Errors and Fixes:
For each error or failure encountered: the error message or symptom, the diagnosed root cause, the fix applied, and whether it is resolved or still open. Keep exact identifiers (deploy ids, record ids, test names, error codes).

6. User Messages (Chronological):
List every user request in order, one per line, concise but complete. Preserve intent, not just surface phrasing. Any constraint the user stated (do not do X, only touch Y) must appear here word for word.

7. Pending Tasks and Next Steps:
List the exact next actions the agent should take when resuming, in order, including the reasoning behind the chosen approach so it is not re-derived. Quote the user's most recent instruction verbatim at the end of this section as: "Latest user intent: [quote here]"

---

Output only the 7 sections above. No preamble, no sign-off.
`

function buildSummaryPrompt(
	customCondensingPrompt: string | undefined,
	targetTokens: number,
): {
	prompt: string
	custom: boolean
} {
	const length = `about ${targetTokens} tokens (${Math.round(targetTokens * 0.6)}–${Math.round(targetTokens * 1.4)}). Use the upper end when many files, errors or pending edits need exact details.`
	if (customCondensingPrompt && customCondensingPrompt.trim().length > 0) {
		return { prompt: `${customCondensingPrompt.trim()}\n\nOUTPUT LENGTH: ${length}`, custom: true }
	}
	return { prompt: SUMMARY_PROMPT.replace("__LENGTH__", length), custom: false }
}

export type SummarizeResponse = {
	messages: ApiMessage[] // The messages after summarization
	summary: string // The summary text; empty string for no summary
	cost: number // The cost of the summarization operation
	newContextTokens?: number // The number of tokens in the context for the next API request
	error?: string // Populated iff the operation fails: error message shown to the user on failure (see Task.ts)
}

function isContinuationMessage(message: ApiMessage): boolean {
	if (message.role !== "user") return false
	if (typeof message.content === "string") return message.content.startsWith(CONTINUATION_PROMPT)
	const text = message.content.find((c) => c.type === "text") as Anthropic.Messages.TextBlockParam | undefined
	return !!text && text.text.startsWith(CONTINUATION_PROMPT)
}

/**
 * Condenses the conversation: staged reduction first (byte-stable tombstones
 * for old tool output), then an LLM summary of the older part of the history
 * while the original task message and a verbatim recent tail are kept.
 *
 * Result layout: [first user message, summary (assistant, isSummary),
 * continuation (user), ...verbatim tail]. The summary message also carries a
 * generated working set (files read/edited with ranges and hashes, current
 * todo, latest user instruction verbatim).
 *
 * @param {ApiMessage[]} messages - The conversation messages
 * @param {ApiHandler} apiHandler - The main API handler: its model decides the tail budget and counts tokens (fallback if condensingApiHandler not provided)
 * @param {string} systemPrompt - The system prompt for API requests (kept for signature compatibility; the summary uses its own prompt)
 * @param {string} taskId - The task ID for the conversation, used for telemetry
 * @param {number} prevContextTokens - The number of tokens currently in the context, used to ensure we don't grow the context
 * @param {boolean} isAutomaticTrigger - Whether the summarization is triggered automatically
 * @param {string} customCondensingPrompt - Optional custom prompt to use for condensing
 * @param {ApiHandler} condensingApiHandler - Optional specific API handler to use for condensing
 * @returns {SummarizeResponse} - The result of the summarization operation (see above)
 */
export async function summarizeConversation(
	messages: ApiMessage[],
	apiHandler: ApiHandler,
	systemPrompt: string,
	taskId: string,
	prevContextTokens: number,
	isAutomaticTrigger?: boolean,
	customCondensingPrompt?: string,
	condensingApiHandler?: ApiHandler,
): Promise<SummarizeResponse> {
	void systemPrompt
	const startTime = Date.now()
	console.log(
		`[summarizeConversation] Starting. taskId: ${taskId}, messageCount: ${messages.length}, isAutomatic: ${isAutomaticTrigger}`,
	)

	try {
		// Use condensing handler if provided, otherwise use main handler
		const handler = condensingApiHandler ?? apiHandler

		// Stage 0-1 first. Idempotent: a history reduced earlier comes back unchanged.
		const reduced = reduceConversation(messages)
		const working = reduced.messages

		// When no summary is written, the reduction alone is persisted only when
		// it clears the hysteresis: a rewrite is a full prompt-cache miss, so a
		// few tombstones a turn are not worth it. Unchanged input comes back as
		// the same array with an empty summary so the caller writes no row.
		// newContextTokens counts the messages only (no system prompt), the same
		// as the summary path below.
		const reductionOnly = async (): Promise<SummarizeResponse> => {
			if (!shouldApplyReduction(reduced, prevContextTokens)) {
				return { messages, cost: 0, summary: "", newContextTokens: prevContextTokens }
			}
			const blocks = working.flatMap((message) =>
				typeof message.content === "string"
					? [{ text: message.content, type: "text" as const }]
					: message.content,
			)
			return {
				messages: working,
				cost: 0,
				summary: describeReduction(reduced),
				newContextTokens: await handler.countTokens(blocks),
			}
		}

		if (working.length < MIN_MESSAGES_FOR_SUMMARY) {
			return reductionOnly()
		}

		// Layout: the first user message stays; everything up to the tail is summarised.
		const keepFirst = working[0].role === "user" && !working[0].isSummary
		const bodyStart = keepFirst ? 1 : 0
		const contextWindow = apiHandler.getModel().info.contextWindow
		const tailStart = selectTailStart(working, contextWindow, bodyStart)
		const tail = working.slice(tailStart)

		// A first message larger than its share of the tail + summary budget is
		// cut to head + tail (with a note) and summarised with the body, so it
		// cannot keep the context above the threshold forever.
		const firstMessageBudget = Math.round(
			(tailTokenBudget(contextWindow) + SUMMARY_TARGET_MAX_TOKENS) * FIRST_MESSAGE_BUDGET_FRACTION,
		)
		const first = keepFirst ? boundFirstMessage(working[0], firstMessageBudget) : undefined
		const body = working.slice(first?.bounded ? 0 : bodyStart, tailStart).filter((m) => !isContinuationMessage(m))
		const existingSummaryCount = body.filter((m) => m.isSummary).length

		if (body.length - existingSummaryCount < MIN_MESSAGES_FOR_SUMMARY) {
			return reductionOnly()
		}

		const bodyTokens = body.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
		const targetTokens = getSummaryTargetTokens(bodyTokens)
		const minSummaryChars = getMinimumSummaryChars(bodyTokens, body.length)
		const { prompt, custom } = buildSummaryPrompt(customCondensingPrompt, targetTokens)

		console.log(
			`[summarizeConversation] Summarizing ${body.length} messages (~${bodyTokens} tokens, hasExistingSummary: ${existingSummaryCount > 0}), ` +
				`keeping first=${keepFirst}${first?.bounded ? " (bounded to head+tail)" : ""}, tail=${tail.length} messages, target=${targetTokens} tokens, customPrompt=${custom}`,
		)

		// Remove images from messages to save tokens
		const cleanedMessages = maybeRemoveImageBlocks(body, handler)
		const transcript = buildConversationTranscript(cleanedMessages)
		const summarizeTranscriptMessage: Anthropic.Messages.MessageParam = {
			role: "user",
			content: [
				{
					type: "text",
					text:
						"Summarize this transcript exactly per the system instructions.\n\n" +
						"Conversation transcript:\n" +
						transcript,
				},
			],
		}

		// Collect summary text and usage metrics (supports a single retry on invalid output)
		let summaryText = ""
		let inputTokens = 0
		let outputTokens = 0
		let cacheWriteTokens = 0
		let cacheReadTokens = 0
		let totalCost = 0
		let retryValidationError: string | undefined

		for (let attempt = 1; attempt <= MAX_SUMMARY_ATTEMPTS; attempt++) {
			const retrySuffix =
				attempt === 1
					? ""
					: `\n\n${buildRetryPromptSuffix(retryValidationError ?? "Invalid summary format", minSummaryChars)}`
			const attemptPrompt = `${prompt}${retrySuffix}`
			const metadata = { taskId, mode: "summarize" }
			const stream = handler.createMessage(attemptPrompt, [summarizeTranscriptMessage], metadata)

			let attemptSummaryText = ""
			let attemptInputTokens = 0
			let attemptOutputTokens = 0
			let attemptCacheWriteTokens = 0
			let attemptCacheReadTokens = 0
			let attemptTotalCost: number | undefined

			console.log(
				`[summarizeConversation] Streaming summary from LLM (attempt ${attempt}/${MAX_SUMMARY_ATTEMPTS})...`,
			)

			for await (const chunk of stream) {
				if (!chunk) continue

				switch (chunk.type) {
					case "text":
						attemptSummaryText += chunk.text
						break
					case "usage":
						attemptInputTokens += chunk.inputTokens
						attemptOutputTokens += chunk.outputTokens
						attemptCacheWriteTokens += chunk.cacheWriteTokens ?? 0
						attemptCacheReadTokens += chunk.cacheReadTokens ?? 0
						attemptTotalCost = chunk.totalCost
						break
				}
			}

			inputTokens += attemptInputTokens
			outputTokens += attemptOutputTokens
			cacheWriteTokens += attemptCacheWriteTokens
			cacheReadTokens += attemptCacheReadTokens
			totalCost += attemptTotalCost ?? 0

			console.log(
				`[summarizeConversation] Summary attempt ${attempt} complete. Length: ${attemptSummaryText.length} chars, tokens: in=${attemptInputTokens}, out=${attemptOutputTokens}`,
			)

			if (isToolLikeSummaryOutput(attemptSummaryText)) {
				retryValidationError = "Summary generation returned tool-like output instead of plain text summary"
				console.warn(`[summarizeConversation] ${retryValidationError} (attempt ${attempt})`)
				continue
			}

			if (isSummaryTooShort(attemptSummaryText, minSummaryChars)) {
				retryValidationError = `Summary too short for safe context preservation (${attemptSummaryText.trim().length} < ${minSummaryChars} chars)`
				console.warn(`[summarizeConversation] ${retryValidationError} (attempt ${attempt})`)
				continue
			}

			if (!custom) {
				const missingSections = getMissingSummarySections(attemptSummaryText)
				if (missingSections.length > 0) {
					retryValidationError = `Summary missing required sections: ${missingSections.join(", ")}`
					console.warn(`[summarizeConversation] ${retryValidationError} (attempt ${attempt})`)
					continue
				}
			}

			summaryText = attemptSummaryText
			break
		}

		if (!summaryText && retryValidationError) {
			return {
				messages,
				cost: 0,
				summary: "",
				newContextTokens: prevContextTokens,
				error: `${retryValidationError} after retry`,
			}
		}

		// If summary is empty or failed, return original messages
		if (!summaryText || summaryText.trim().length === 0) {
			console.log(`[summarizeConversation] Empty summary, returning original messages`)
			return {
				messages,
				cost: 0,
				summary: "",
				newContextTokens: prevContextTokens,
				error: "Summary generation returned empty result",
			}
		}

		// Calculate cost
		const { calculateApiCostAnthropic } = await import("../../shared/cost")
		const fallbackCost = calculateApiCostAnthropic(
			handler.getModel().info,
			inputTokens,
			outputTokens,
			cacheWriteTokens,
			cacheReadTokens,
		)
		const cost = totalCost > 0 ? totalCost : fallbackCost

		// Working set from the whole (reduced) history: real data, not recall.
		const workingSet = buildWorkingSet(working)

		const newSummaryMessage: ApiMessage = {
			role: "assistant",
			content: [
				{
					type: "text",
					text: `[Context Summary]\n\n${summaryText.trim()}\n\n${workingSet}`,
				},
			],
			isSummary: true, // Mark as summary for UI to show in collapsed view
		}

		const continuationMessage: ApiMessage = {
			role: "user",
			content: [{ type: "text", text: CONTINUATION_PROMPT_WITH_TAIL }],
		}

		const condensedMessages: ApiMessage[] = [
			...(first ? [first.message] : []),
			newSummaryMessage,
			continuationMessage,
			...tail,
		]

		// Count new token usage
		const contextBlocks = condensedMessages.flatMap((message) =>
			typeof message.content === "string" ? [{ text: message.content, type: "text" as const }] : message.content,
		)
		const newContextTokens = await handler.countTokens(contextBlocks)

		const duration = Date.now() - startTime
		const reduction = prevContextTokens - newContextTokens
		const reductionPercent = prevContextTokens > 0 ? ((reduction / prevContextTokens) * 100).toFixed(1) : "n/a"

		console.log(
			`[summarizeConversation] Success! Duration: ${duration}ms, ` +
				`prevTokens: ${prevContextTokens}, newTokens: ${newContextTokens}, ` +
				`reduction: ${reduction} tokens (${reductionPercent}%), cost: $${cost.toFixed(4)}`,
		)

		// Track telemetry
		TelemetryService.instance.captureLlmCompletion(taskId, {
			inputTokens,
			outputTokens,
			cacheWriteTokens,
			cacheReadTokens,
			cost,
		})

		return {
			messages: condensedMessages,
			summary: summaryText,
			cost,
			newContextTokens,
		}
	} catch (error) {
		const duration = Date.now() - startTime
		console.error(`[summarizeConversation] Error after ${duration}ms:`, error)

		// Return original messages on error, with error message
		return {
			messages,
			cost: 0,
			summary: "",
			newContextTokens: prevContextTokens,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

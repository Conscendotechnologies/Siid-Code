import Anthropic from "@anthropic-ai/sdk"

import { TelemetryService } from "@siid-code/telemetry"

import { t } from "../../i18n"
import { ApiHandler } from "../../api"
import { ApiMessage } from "../task-persistence/apiMessages"
import { maybeRemoveImageBlocks } from "../../api/transform/image-cleaning"

// helpers formerly in stateCapture.ts

function getRecentMessages(messages: ApiMessage[], maxMessages: number = 15): ApiMessage[] {
	if (messages.length <= maxMessages) {
		return messages
	}
	const recent = messages.slice(-maxMessages)
	console.log(`[getRecentMessages] Sliced from ${messages.length} to ${recent.length} messages for condensation`)
	return recent
}

function is429Error(error: unknown): boolean {
	if (error instanceof Error) {
		const message = error.message.toLowerCase()
		return message.includes("429") || message.includes("rate limit") || message.includes("too many requests")
	}
	const errorObj = error as any
	return errorObj?.status === 429 || errorObj?.statusCode === 429
}

function calculateExponentialBackoff(attempt: number, maxDelaySeconds: number = 600): number {
	const baseDelay = Math.pow(2, Math.min(attempt - 1, 9))
	const delaySeconds = Math.min(baseDelay, maxDelaySeconds)
	const delayMs = delaySeconds * 1000
	const jitter = delayMs * 0.1 * (Math.random() - 0.5)
	return Math.max(1000, delayMs + jitter)
}

export const N_MESSAGES_TO_KEEP = 0 // Changed: Now we don't keep any messages, only the summary
export const MIN_CONDENSE_THRESHOLD = 5 // Minimum percentage of context window to trigger condensing
export const MAX_CONDENSE_THRESHOLD = 80 // Maximum percentage of context window to trigger condensing
export const MAX_MESSAGES_FOR_CONDENSE = 15 // Only condense from last 10-15 messages to reduce token usage
export const MAX_SUMMARY_ATTEMPTS_WITH_RETRY = 3 // Increased from 2 to allow for 429 retry
const CONTINUATION_PROMPT =
	"Please continue from where we left off based on the summary above, Please read the guidelines carefully and continue the work, ensuring to follow the user's intent and the context provided in the summary."
const MAX_SUMMARY_ATTEMPTS = 2
const MIN_SUMMARY_CHARS_ABSOLUTE = 350
const MIN_SUMMARY_CHARS_MAX = 2000

// Rate limit handling
const MAX_429_RETRIES = 3
const INITIAL_429_BACKOFF_MS = 2000 // Start with 2 seconds

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

function getMinimumSummaryChars(prevContextTokens: number, messageCount: number): number {
	const tokenBasedMinimum = Math.floor(prevContextTokens * 0.012) // ~1.2% of previous context
	const messageBasedMinimum = messageCount * 40
	return Math.min(MIN_SUMMARY_CHARS_MAX, Math.max(MIN_SUMMARY_CHARS_ABSOLUTE, tokenBasedMinimum, messageBasedMinimum))
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

OUTPUT LENGTH: 500–2000 tokens. Lean toward 800–1200 for typical sessions. Use more only if many files or errors require it.

---

Write the summary using exactly these 7 section headers in order:

1. Previous Conversation:
Summarize the overall arc of the session in 2–4 sentences: what the user wanted, what approach was taken, and where things stand now.

2. Current Work:
Describe the most recent task in detail. Include: what was attempted, what succeeded, what is in-progress or blocked, and the exact state of any code being written or modified.

3. Key Technical Concepts:
List the languages, frameworks, libraries, APIs, design patterns, and architectural constraints active in this session. Be specific (e.g., "TypeScript with strict null checks", "React 18 concurrent mode", "REST API on port 3001").

4. Relevant Files and Code:
For each file touched: its path, what changed, and why. If a function or class was modified, name it. Keep this grounded — paths and symbol names only, no large code blocks.

5. Errors and Fixes:
For each error or failure encountered: the error message or symptom, the diagnosed root cause, the fix applied, and whether it is resolved or still open.

6. User Messages (Chronological):
List every user request in order, one per line, concise but complete. Preserve intent, not just surface phrasing.

7. Pending Tasks and Next Steps:
List the exact next actions the agent should take when resuming. Quote the user's most recent instruction verbatim at the end of this section as: "Latest user intent: [quote here]"

---

Output only the 7 sections above. No preamble, no sign-off.
`

export type SummarizeResponse = {
	messages: ApiMessage[] // The messages after summarization
	summary: string // The summary text; empty string for no summary
	cost: number // The cost of the summarization operation
	newContextTokens?: number // The number of tokens in the context for the next API request
	error?: string // Populated iff the operation fails: error message shown to the user on failure (see Task.ts)
	rateLimitHit?: boolean // Whether a 429 rate limit error was encountered
}

/**
 * Summarizes the conversation messages using an LLM call
 *
 * @param {ApiMessage[]} messages - The conversation messages
 * @param {ApiHandler} apiHandler - The API handler to use for token counting.
 * @param {string} systemPrompt - The system prompt for API requests, which should be considered in the context token count
 * @param {string} taskId - The task ID for the conversation, used for telemetry
 * @param {boolean} isAutomaticTrigger - Whether the summarization is triggered automatically
 * @returns {SummarizeResponse} - The result of the summarization operation (see above)
 */
/**
 * Summarizes the conversation messages using an LLM call
 *
 * @param {ApiMessage[]} messages - The conversation messages
 * @param {ApiHandler} apiHandler - The API handler to use for token counting (fallback if condensingApiHandler not provided)
 * @param {string} systemPrompt - The system prompt for API requests (fallback if customCondensingPrompt not provided)
 * @param {string} taskId - The task ID for the conversation, used for telemetry
 * @param {number} prevContextTokens - The number of tokens currently in the context, used to ensure we don't grow the context
 * @param {boolean} isAutomaticTrigger - Whether the summarization is triggered automatically
 * @param {string} customCondensingPrompt - Optional custom prompt to use for condensing
 * @param {ApiHandler} condensingApiHandler - Optional specific API handler to use for condensing
 * @returns {SummarizeResponse} - The result of the summarization operation (see above)
 */
// Tools whose results should be replaced with a short status message
const TOOLS_TO_TRIM_RESULTS: string[] = [
	"list_files",
	"search_files",
	"codebase_search",
	"retrieve_sf_metadata",
	"execute_command",
	"read_file",
	"sf_deploy_metadata",
	"update_todo_list",
	"write_to_file",
	"apply_diff",
]

// Tools whose results should NOT be touched
// const TOOLS_TO_KEEP_RESULTS: string[] = [
// 	"fetch_instructions",
// 	"switch_mode",
// 	"new_task",
// ]

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
	const startTime = Date.now()
	console.log(
		`[summarizeConversation] Starting full summarization. taskId: ${taskId}, messageCount: ${messages.length}, isAutomatic: ${isAutomaticTrigger}`,
	)

	// ===== TOKEN GUARD: Check if we should even attempt condensation =====
	// Estimate the cost of the summarization call itself
	const estimatedSummaryOverhead = Math.ceil(messages.length * 100) // ~100 tokens per message as estimate
	if (prevContextTokens + estimatedSummaryOverhead > 200000) {
		console.warn(
			`[summarizeConversation] Skipping condensation - estimated cost would exceed token limit (current: ${prevContextTokens}, overhead: ${estimatedSummaryOverhead})`,
		)
		return {
			messages,
			cost: 0,
			summary: "",
			newContextTokens: prevContextTokens,
			error: "Token limit safety guard triggered - condensation overhead too high",
		}
	}

	try {
		// ===== MESSAGE FILTERING: Only use recent messages to reduce token usage =====
		const recentMessages = getRecentMessages(messages, MAX_MESSAGES_FOR_CONDENSE)
		console.log(
			`[summarizeConversation] Using ${recentMessages.length} recent messages (from ${messages.length} total) for condensation`,
		)

		// Use condensing handler if provided, otherwise use main handler
		const handler = condensingApiHandler ?? apiHandler
		const prompt = SUMMARY_PROMPT

		// If we have too few messages, no need to summarize
		const MIN_MESSAGES_FOR_SUMMARY = 3 // Need at least 3 messages to make summarization worthwhile

		// Find the most recent summary message (if any)
		let lastSummaryIndex = -1
		let existingSummary: ApiMessage | undefined
		for (let i = recentMessages.length - 1; i >= 0; i--) {
			if (recentMessages[i].isSummary) {
				lastSummaryIndex = i
				existingSummary = recentMessages[i]
				break
			}
		}

		// Determine which messages to summarize
		let messagesToSummarize: ApiMessage[]

		if (lastSummaryIndex >= 0 && existingSummary) {
			// We have a previous summary - summarize that summary + NEW messages after it,
			// then replace both with a single merged summary.
			const messagesAfterSummary = recentMessages.slice(lastSummaryIndex + 1)

			// Filter out the continuation prompt if it exists
			const newMessages = messagesAfterSummary.filter((m) => {
				if (m.role === "user" && Array.isArray(m.content)) {
					const text = m.content.find((c) => c.type === "text") as
						| Anthropic.Messages.TextBlockParam
						| undefined
					return text?.text !== CONTINUATION_PROMPT
				}
				return true
			})

			console.log(
				`[summarizeConversation] Found existing summary at index ${lastSummaryIndex}, ` +
					`${newMessages.length} new messages after it`,
			)

			if (newMessages.length < MIN_MESSAGES_FOR_SUMMARY) {
				console.log(
					`[summarizeConversation] Too few new messages (${newMessages.length}), skipping summarization`,
				)
				return { messages, cost: 0, summary: "", newContextTokens: prevContextTokens }
			}

			messagesToSummarize = [existingSummary, ...newMessages]
		} else {
			// No previous summary - summarize all recent messages
			if (recentMessages.length < MIN_MESSAGES_FOR_SUMMARY) {
				console.log(
					`[summarizeConversation] Too few messages (${recentMessages.length}), skipping summarization`,
				)
				return { messages, cost: 0, summary: "", newContextTokens: prevContextTokens }
			}

			messagesToSummarize = recentMessages
		}

		console.log(
			`[summarizeConversation] Summarizing ${messagesToSummarize.length} messages ` +
				`(hasExistingSummary: ${lastSummaryIndex >= 0})`,
		)

		// Remove images from messages to save tokens
		const cleanedMessages = maybeRemoveImageBlocks(messagesToSummarize, handler)
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

		// Make LLM call to summarize all messages with 429 rate limit retry logic
		// Collect summary text and usage metrics (supports a single retry on invalid tool-like output)
		let summaryText = ""
		let inputTokens = 0
		let outputTokens = 0
		let cacheWriteTokens = 0
		let cacheReadTokens = 0
		let totalCost = 0
		let retryValidationError: string | undefined
		const minSummaryChars = getMinimumSummaryChars(prevContextTokens, messagesToSummarize.length)

		// ===== RATE LIMIT RETRY LOOP =====
		let rateLimitRetries = 0
		let lastError: Error | null = null

		for (let attempt = 1; attempt <= MAX_SUMMARY_ATTEMPTS + rateLimitRetries; attempt++) {
			// Check for rate limit before retry
			if (rateLimitRetries > 0 && attempt > MAX_SUMMARY_ATTEMPTS) {
				if (rateLimitRetries >= MAX_429_RETRIES) {
					console.error(`[summarizeConversation] Max 429 retries (${MAX_429_RETRIES}) reached, giving up`)
					return {
						messages,
						cost: 0,
						summary: "",
						newContextTokens: prevContextTokens,
						error: `Rate limited by provider (429) after ${rateLimitRetries} retries. Please try again later.`,
						rateLimitHit: true,
					}
				}

				// Calculate backoff for this retry
				const backoffMs = calculateExponentialBackoff(rateLimitRetries, 600)
				console.warn(
					`[summarizeConversation] Rate limited (429) - retry ${rateLimitRetries}/${MAX_429_RETRIES} after ${backoffMs}ms backoff`,
				)

				// Wait before retrying
				await new Promise((resolve) => setTimeout(resolve, backoffMs))
			}

			const retrySuffix =
				attempt <= MAX_SUMMARY_ATTEMPTS && attempt > 1
					? `\n\n${buildRetryPromptSuffix(retryValidationError ?? "Invalid summary format", minSummaryChars)}`
					: ""
			const attemptPrompt = `${prompt}${retrySuffix}`
			const metadata = { taskId, mode: "summarize" }

			try {
				const stream = handler.createMessage(attemptPrompt, [summarizeTranscriptMessage], metadata)

				let attemptSummaryText = ""
				let attemptInputTokens = 0
				let attemptOutputTokens = 0
				let attemptCacheWriteTokens = 0
				let attemptCacheReadTokens = 0
				let attemptTotalCost: number | undefined

				console.log(
					`[summarizeConversation] Streaming summary from LLM (attempt ${attempt}/${MAX_SUMMARY_ATTEMPTS + MAX_429_RETRIES})...`,
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

				console.log([
					`[summarizeConversation] Received summary chunk (attempt ${attempt}):`,
					attemptSummaryText,
				])
				console.log(
					`[summarizeConversation] Summary attempt ${attempt} complete. Length: ${attemptSummaryText.length} chars, tokens: in=${attemptInputTokens}, out=${attemptOutputTokens}`,
				)

				// Reset rate limit retry counter on success
				rateLimitRetries = 0
				lastError = null

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

				const missingSections = getMissingSummarySections(attemptSummaryText)
				if (missingSections.length > 0) {
					retryValidationError = `Summary missing required sections: ${missingSections.join(", ")}`
					console.warn(`[summarizeConversation] ${retryValidationError} (attempt ${attempt})`)
					continue
				}

				summaryText = attemptSummaryText
				break
			} catch (streamError) {
				// Check if this is a 429 rate limit error
				if (is429Error(streamError)) {
					rateLimitRetries++
					lastError = streamError as Error
					console.warn(`[summarizeConversation] Got 429 rate limit error on attempt ${attempt}`)

					// If we haven't exceeded max 429 retries, continue the loop for retry
					if (rateLimitRetries < MAX_429_RETRIES) {
						continue
					}
				}

				// Not a 429 or max retries reached - re-throw
				throw streamError
			}
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
		// Import at top of file: import { calculateApiCostAnthropic } from "../../shared/cost"
		const { calculateApiCostAnthropic } = await import("../../shared/cost")
		const fallbackCost = calculateApiCostAnthropic(
			handler.getModel().info,
			inputTokens,
			outputTokens,
			cacheWriteTokens,
			cacheReadTokens,
		)
		const cost = totalCost > 0 ? totalCost : fallbackCost

		// Create summary message (marked for collapsed view)
		const newSummaryMessage: ApiMessage = {
			role: "assistant",
			content: [
				{
					type: "text",
					text: `[Context Summary]\n\n${summaryText}`,
				},
			],
			isSummary: true, // Mark as summary for UI to show in collapsed view
		}

		// Create user continuation message
		const continuationMessage: ApiMessage = {
			role: "user",
			content: [
				{
					type: "text",
					text: CONTINUATION_PROMPT,
				},
			],
		}

		// Always keep a single merged summary + continuation prompt.
		// If an existing summary was present, it was included in messagesToSummarize above.
		const condensedMessages: ApiMessage[] = [newSummaryMessage, continuationMessage]

		// Count new token usage
		const contextBlocks = condensedMessages.flatMap((message) =>
			typeof message.content === "string" ? [{ text: message.content, type: "text" as const }] : message.content,
		)
		const newContextTokens = await handler.countTokens(contextBlocks)

		const duration = Date.now() - startTime
		const reduction = prevContextTokens - newContextTokens
		const reductionPercent = ((reduction / prevContextTokens) * 100).toFixed(1)

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
		const isRateLimit = is429Error(error)

		console.error(
			`[summarizeConversation] Error after ${duration}ms${isRateLimit ? " (429 rate limit)" : ""}:`,
			error,
		)

		// Return original messages on error, with error message
		return {
			messages,
			cost: 0,
			summary: "",
			newContextTokens: prevContextTokens,
			error: error instanceof Error ? error.message : String(error),
			rateLimitHit: isRateLimit,
		}
	}
}

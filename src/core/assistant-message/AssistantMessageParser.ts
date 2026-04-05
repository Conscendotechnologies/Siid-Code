import { type ToolName, toolNames } from "@siid-code/types"
import { TextContent, ToolUse, ToolParamName, toolParamNames } from "../../shared/tools"
import { AssistantMessageContent } from "./parseAssistantMessage"
import {
	announceStreamedToolDebugFile,
	logStreamedToolDebug,
	STREAMED_TOOL_DEBUG_ENABLED,
} from "../../utils/streamed-tool-debug"

function logAssistantParserDebug(event: string, payload: Record<string, unknown>) {
	if (!STREAMED_TOOL_DEBUG_ENABLED) {
		return
	}

	const serializedPayload = JSON.stringify(payload, (_key, value) => {
		if (typeof value === "bigint") {
			return value.toString()
		}

		if (value instanceof Error) {
			return {
				name: value.name,
				message: value.message,
				stack: value.stack,
			}
		}

		return value
	})

	console.log(`[AssistantMessageParserDebug] ${event} ${serializedPayload}`)
	logStreamedToolDebug("AssistantMessageParserDebug", event, payload)
}

/**
 * Parser for assistant messages. Maintains state between chunks
 * to avoid reprocessing the entire message on each update.
 */
export class AssistantMessageParser {
	private contentBlocks: AssistantMessageContent[] = []
	private currentTextContent: TextContent | undefined = undefined
	private currentTextContentStartIndex = 0
	private currentToolUse: ToolUse | undefined = undefined
	private currentToolUseStartIndex = 0
	private currentParamName: ToolParamName | undefined = undefined
	private currentParamValueStartIndex = 0
	private readonly MAX_ACCUMULATOR_SIZE = 1024 * 1024 // 1MB limit
	private readonly MAX_PARAM_LENGTH = 1024 * 100 // 100KB per parameter limit
	private accumulator = ""

	private getVisibleTextContent(text: string): string {
		const hiddenSuffixLength = this.getTrailingToolPrefixLength(text)
		const visibleText = hiddenSuffixLength > 0 ? text.slice(0, -hiddenSuffixLength) : text

		return visibleText.trim()
	}

	private getTrailingToolPrefixLength(text: string): number {
		let longestPrefixLength = 0

		for (const toolName of toolNames) {
			const openingTag = `<${toolName}>`

			for (let prefixLength = 1; prefixLength < openingTag.length; prefixLength++) {
				if (text.endsWith(openingTag.slice(0, prefixLength))) {
					longestPrefixLength = Math.max(longestPrefixLength, prefixLength)
				}
			}
		}

		return longestPrefixLength
	}

	/**
	 * Initialize a new AssistantMessageParser instance.
	 */
	constructor() {
		announceStreamedToolDebugFile()
		this.reset()
	}

	/**
	 * Reset the parser state.
	 */
	public reset(): void {
		this.contentBlocks = []
		this.currentTextContent = undefined
		this.currentTextContentStartIndex = 0
		this.currentToolUse = undefined
		this.currentToolUseStartIndex = 0
		this.currentParamName = undefined
		this.currentParamValueStartIndex = 0
		this.accumulator = ""
	}

	/**
	 * Returns the current parsed content blocks
	 */

	public getContentBlocks(): AssistantMessageContent[] {
		// Return a shallow copy to prevent external mutation
		return this.contentBlocks.slice()
	}
	/**
	 * Process a new chunk of text and update the parser state.
	 * @param chunk The new chunk of text to process.
	 */
	public processChunk(chunk: string): AssistantMessageContent[] {
		logAssistantParserDebug("processChunk:start", {
			chunk,
			accumulatorLengthBefore: this.accumulator.length,
		})

		if (this.accumulator.length + chunk.length > this.MAX_ACCUMULATOR_SIZE) {
			throw new Error("Assistant message exceeds maximum allowed size")
		}
		// Store the current length of the accumulator before adding the new chunk
		const accumulatorStartLength = this.accumulator.length

		for (let i = 0; i < chunk.length; i++) {
			const char = chunk[i]
			this.accumulator += char
			const currentPosition = accumulatorStartLength + i

			// There should not be a param without a tool use.
			if (this.currentToolUse && this.currentParamName) {
				const currentParamValue = this.accumulator.slice(this.currentParamValueStartIndex)
				if (currentParamValue.length > this.MAX_PARAM_LENGTH) {
					logAssistantParserDebug("param:too-large", {
						tool: this.currentToolUse.name,
						param: this.currentParamName,
						length: currentParamValue.length,
					})
					// Reset to a safe state
					this.currentParamName = undefined
					this.currentParamValueStartIndex = 0
					continue
				}
				const paramClosingTag = `</${this.currentParamName}>`
				// Streamed param content: always write the currently accumulated value
				if (currentParamValue.endsWith(paramClosingTag)) {
					// End of param value.
					// Do not trim content parameters to preserve newlines, but strip first and last newline only
					const paramValue = currentParamValue.slice(0, -paramClosingTag.length)
					this.currentToolUse.params[this.currentParamName] =
						this.currentParamName === "content"
							? paramValue.replace(/^\n/, "").replace(/\n$/, "")
							: paramValue.trim()
					logAssistantParserDebug("param:complete", {
						tool: this.currentToolUse.name,
						param: this.currentParamName,
						valuePreview: this.currentToolUse.params[this.currentParamName],
					})
					this.currentParamName = undefined
					continue
				} else {
					// Partial param value is accumulating.
					// Write the currently accumulated param content in real time
					this.currentToolUse.params[this.currentParamName] = currentParamValue
					continue
				}
			}

			// No currentParamName.

			if (this.currentToolUse) {
				const currentToolValue = this.accumulator.slice(this.currentToolUseStartIndex)
				const toolUseClosingTag = `</${this.currentToolUse.name}>`
				if (currentToolValue.endsWith(toolUseClosingTag)) {
					// End of a tool use.
					this.currentToolUse.partial = false
					logAssistantParserDebug("tool:complete", {
						tool: this.currentToolUse.name,
						params: this.currentToolUse.params,
					})

					this.currentToolUse = undefined
					continue
				} else {
					const possibleParamOpeningTags = toolParamNames.map((name) => `<${name}>`)
					for (const paramOpeningTag of possibleParamOpeningTags) {
						if (this.accumulator.endsWith(paramOpeningTag)) {
							// Start of a new parameter.
							const paramName = paramOpeningTag.slice(1, -1)
							if (!toolParamNames.includes(paramName as ToolParamName)) {
								// Handle invalid parameter name gracefully
								continue
							}
							this.currentParamName = paramName as ToolParamName
							this.currentParamValueStartIndex = this.accumulator.length
							logAssistantParserDebug("param:start", {
								tool: this.currentToolUse.name,
								param: this.currentParamName,
							})
							break
						}
					}

					// There's no current param, and not starting a new param.

					// Special case for write_to_file where file contents could
					// contain the closing tag, in which case the param would have
					// closed and we end up with the rest of the file contents here.
					// To work around this, get the string between the starting
					// content tag and the LAST content tag.
					const contentParamName: ToolParamName = "content"

					if (
						this.currentToolUse.name === "write_to_file" &&
						this.accumulator.endsWith(`</${contentParamName}>`)
					) {
						const toolContent = this.accumulator.slice(this.currentToolUseStartIndex)
						const contentStartTag = `<${contentParamName}>`
						const contentEndTag = `</${contentParamName}>`
						const contentStartIndex = toolContent.indexOf(contentStartTag) + contentStartTag.length
						const contentEndIndex = toolContent.lastIndexOf(contentEndTag)

						if (contentStartIndex !== -1 && contentEndIndex !== -1 && contentEndIndex > contentStartIndex) {
							// Don't trim content to preserve newlines, but strip first and last newline only
							this.currentToolUse.params[contentParamName] = toolContent
								.slice(contentStartIndex, contentEndIndex)
								.replace(/^\n/, "")
								.replace(/\n$/, "")
							logAssistantParserDebug("tool:content-recovered", {
								tool: this.currentToolUse.name,
								contentPreview: this.currentToolUse.params[contentParamName],
							})
						}
					}

					// Partial tool value is accumulating.
					continue
				}
			}

			// No currentToolUse.

			let didStartToolUse = false
			const possibleToolUseOpeningTags = toolNames.map((name) => `<${name}>`)

			for (const toolUseOpeningTag of possibleToolUseOpeningTags) {
				if (this.accumulator.endsWith(toolUseOpeningTag)) {
					// Extract and validate the tool name
					const extractedToolName = toolUseOpeningTag.slice(1, -1)

					// Check if the extracted tool name is valid
					if (!toolNames.includes(extractedToolName as ToolName)) {
						// Invalid tool name, treat as plain text and continue
						continue
					}

					// Start of a new tool use.
					this.currentToolUse = {
						type: "tool_use",
						name: extractedToolName as ToolName,
						params: {},
						partial: true,
					}
					logAssistantParserDebug("tool:start", {
						tool: this.currentToolUse.name,
						accumulatorTail: this.accumulator.slice(Math.max(0, this.accumulator.length - 200)),
					})

					this.currentToolUseStartIndex = this.accumulator.length

					// This also indicates the end of the current text content.
					if (this.currentTextContent) {
						this.currentTextContent.partial = false
						this.currentTextContent.content = this.accumulator
							.slice(this.currentTextContentStartIndex, -toolUseOpeningTag.length)
							.trim()

						// No need to push, currentTextContent is already in contentBlocks
						this.currentTextContent = undefined
					}

					// Immediately push new tool_use block as partial
					let idx = this.contentBlocks.findIndex((block) => block === this.currentToolUse)
					if (idx === -1) {
						this.contentBlocks.push(this.currentToolUse)
					}

					didStartToolUse = true
					break
				}
			}

			if (!didStartToolUse) {
				// No tool use, so it must be text either at the beginning or
				// between tools.
				if (this.currentTextContent === undefined) {
					// If this is the first chunk and we're at the beginning of processing,
					// set the start index to the current position in the accumulator
					this.currentTextContentStartIndex = currentPosition

					// Create a new text content block and add it to contentBlocks
					this.currentTextContent = {
						type: "text",
						content: this.getVisibleTextContent(this.accumulator.slice(this.currentTextContentStartIndex)),
						partial: true,
					}

					// Add the new text content to contentBlocks immediately
					// Ensures it appears in the UI right away
					this.contentBlocks.push(this.currentTextContent)
				} else {
					// Update the existing text content
					this.currentTextContent.content = this.getVisibleTextContent(
						this.accumulator.slice(this.currentTextContentStartIndex),
					)
				}
			}
		}

		logAssistantParserDebug("processChunk:end", {
			blockCount: this.contentBlocks.length,
			blocks: this.contentBlocks,
		})
		// Do not call finalizeContentBlocks() here.
		// Instead, update any partial blocks in the array and add new ones as they're completed.
		// This matches the behavior of the original parseAssistantMessage function.
		return this.getContentBlocks()
	}

	/**
	 * Finalize any partial content blocks.
	 * Should be called after processing the last chunk.
	 */
	public finalizeContentBlocks(): void {
		// Mark all partial blocks as complete
		for (const block of this.contentBlocks) {
			if (block.partial) {
				block.partial = false
			}
			if (block.type === "text" && typeof block.content === "string") {
				if (block === this.currentTextContent) {
					block.content = this.accumulator.slice(this.currentTextContentStartIndex).trim()
				} else {
					block.content = block.content.trim()
				}
			}
		}
	}
}

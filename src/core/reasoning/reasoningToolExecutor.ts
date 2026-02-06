import { ToolName, toolNames } from "@siid-code/types"
import { ToolUse, toolParamNames, ToolParamName } from "../../shared/tools"

/**
 * Tools that are allowed to be executed within reasoning blocks.
 * These are read-only, data-gathering tools that don't modify state.
 */
export const REASONING_ALLOWED_TOOLS: readonly ToolName[] = [
	"read_file",
	"search_files",
	"list_files",
	"codebase_search",
	"list_code_definition_names",
	"get_task_guides",
	"retrieve_sf_metadata",
] as const

/**
 * Check if a tool is allowed to be executed in reasoning blocks
 */
export function isToolAllowedInReasoning(toolName: string): boolean {
	return REASONING_ALLOWED_TOOLS.includes(toolName as ToolName)
}

/**
 * Result of parsing reasoning content for tool calls
 */
export interface ReasoningToolParseResult {
	/** The tool use block if found */
	toolUse: ToolUse | null
	/** Text content before the tool call */
	textBefore: string
	/** Text content after the tool call (if tool is complete) */
	textAfter: string
	/** Whether the tool tag is complete (has closing tag) */
	isComplete: boolean
	/** Error message if tool is not allowed */
	error?: string
}

/**
 * Parse reasoning content to extract a single tool call.
 * Only ONE tool call is allowed per reasoning block.
 *
 * @param reasoningContent The raw reasoning text that may contain tool XML
 * @returns ParseResult with extracted tool or null if no tool found
 */
export function parseReasoningForTool(reasoningContent: string): ReasoningToolParseResult {
	// Find the first tool tag in the reasoning content
	for (const toolName of toolNames) {
		const openingTag = `<${toolName}>`
		const closingTag = `</${toolName}>`

		const startIndex = reasoningContent.indexOf(openingTag)
		if (startIndex === -1) continue

		// Found a tool tag
		const textBefore = reasoningContent.slice(0, startIndex)

		// Check if tool is allowed in reasoning
		if (!isToolAllowedInReasoning(toolName)) {
			return {
				toolUse: null,
				textBefore,
				textAfter: "",
				isComplete: false,
				error: `Tool '${toolName}' is not allowed in reasoning blocks. Only read-only tools are permitted.`,
			}
		}

		const endIndex = reasoningContent.indexOf(closingTag, startIndex)
		const isComplete = endIndex !== -1

		// Extract the tool content
		const toolContentStart = startIndex + openingTag.length
		const toolContentEnd = isComplete ? endIndex : reasoningContent.length
		const toolContent = reasoningContent.slice(toolContentStart, toolContentEnd)

		// Parse parameters from tool content
		const params = parseToolParams(toolContent)

		const toolUse: ToolUse = {
			type: "tool_use",
			name: toolName,
			params,
			partial: !isComplete,
		}

		const textAfter = isComplete ? reasoningContent.slice(endIndex + closingTag.length) : ""

		return {
			toolUse,
			textBefore,
			textAfter,
			isComplete,
		}
	}

	// No tool found
	return {
		toolUse: null,
		textBefore: reasoningContent,
		textAfter: "",
		isComplete: true,
	}
}

/**
 * Parse tool parameters from the content between tool tags
 */
function parseToolParams(toolContent: string): Record<string, string> {
	const params: Record<string, string> = {}

	for (const paramName of toolParamNames) {
		const openingTag = `<${paramName}>`
		const closingTag = `</${paramName}>`

		const startIndex = toolContent.indexOf(openingTag)
		if (startIndex === -1) continue

		const valueStart = startIndex + openingTag.length
		const endIndex = toolContent.indexOf(closingTag, valueStart)

		if (endIndex !== -1) {
			const value = toolContent.slice(valueStart, endIndex)
			// Don't trim content parameters to preserve newlines
			params[paramName] = paramName === "content" ? value.replace(/^\n/, "").replace(/\n$/, "") : value.trim()
		}
	}

	return params
}

/**
 * Remove tool XML tags from reasoning content for display purposes.
 * This cleans up the reasoning text after tool execution.
 */
export function cleanReasoningContent(reasoningContent: string): string {
	let cleaned = reasoningContent

	// Remove all tool tags and their content
	for (const toolName of toolNames) {
		const regex = new RegExp(`<${toolName}>.*?</${toolName}>`, "gs")
		cleaned = cleaned.replace(regex, "")

		// Also remove incomplete opening tags
		const incompleteRegex = new RegExp(`<${toolName}>.*$`, "gs")
		cleaned = cleaned.replace(incompleteRegex, "")
	}

	return cleaned.trim()
}

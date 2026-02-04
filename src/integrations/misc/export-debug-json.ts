import { Anthropic } from "@anthropic-ai/sdk"
import os from "os"
import * as path from "path"
import * as vscode from "vscode"

import { ApiMessage } from "../../core/task-persistence/apiMessages"

interface DebugExportMetadata {
	taskId: string
	timestamp: number
	taskNumber?: number
	workspace?: string
	mode?: string
	systemPrompt?: string
}

interface ApiRequestData {
	requestIndex: number
	timestamp: number
	userMessage: Anthropic.Messages.ContentBlockParam[]
	assistantResponse?: Anthropic.Messages.ContentBlockParam[]
	toolsUsed: string[]
	hadPreTask: boolean
	hadEnvironmentDetails: boolean
	wasStripped: boolean
}

interface MessageStatistics {
	totalMessages: number
	userMessages: number
	assistantMessages: number
	summaryMessages: number
	toolUseCount: number
	toolResultCount: number
	toolUseSummary: Record<string, number>
	errorCount: number
}

function computeStatistics(messages: ApiMessage[]): MessageStatistics {
	const stats: MessageStatistics = {
		totalMessages: messages.length,
		userMessages: 0,
		assistantMessages: 0,
		summaryMessages: 0,
		toolUseCount: 0,
		toolResultCount: 0,
		toolUseSummary: {},
		errorCount: 0,
	}

	for (const message of messages) {
		if (message.role === "user") {
			stats.userMessages++
		} else {
			stats.assistantMessages++
		}

		if ((message as ApiMessage).isSummary) {
			stats.summaryMessages++
		}

		if (Array.isArray(message.content)) {
			for (const block of message.content) {
				if (block.type === "tool_use") {
					stats.toolUseCount++
					const name = (block as Anthropic.Messages.ToolUseBlockParam).name
					stats.toolUseSummary[name] = (stats.toolUseSummary[name] || 0) + 1
				} else if (block.type === "tool_result") {
					stats.toolResultCount++
					if ((block as Anthropic.Messages.ToolResultBlockParam).is_error) {
						stats.errorCount++
					}
				}
			}
		}
	}

	return stats
}

/**
 * Analyzes the conversation history to extract detailed API request data.
 * Groups messages into request-response pairs and extracts metadata.
 */
function extractApiRequests(messages: ApiMessage[]): ApiRequestData[] {
	const requests: ApiRequestData[] = []
	let requestIndex = 0

	for (let i = 0; i < messages.length; i++) {
		const message = messages[i]

		// Look for user messages (these are the API requests)
		if (message.role === "user") {
			const content = Array.isArray(message.content)
				? message.content
				: [{ type: "text" as const, text: message.content }]

			// Check for pre-task and environment details
			let hadPreTask = false
			let hadEnvironmentDetails = false
			let wasStripped = false

			const userMessage: Anthropic.Messages.ContentBlockParam[] = content.map((block) => {
				if (block.type === "text") {
					const text = (block as Anthropic.Messages.TextBlockParam).text || ""
					if (text.includes("<pre-task>")) {
						hadPreTask = true
					}
					if (text.includes("<environment_details>")) {
						hadEnvironmentDetails = true
					}
					if (text.includes("[Tool executed successfully. Please continue with the next step.]")) {
						wasStripped = true
					}
				}
				return block
			})

			// Find the corresponding assistant response
			let assistantResponse: Anthropic.Messages.ContentBlockParam[] | undefined
			const toolsUsed: string[] = []

			if (i + 1 < messages.length && messages[i + 1].role === "assistant") {
				const assistantMsg = messages[i + 1]
				const assistantContent = Array.isArray(assistantMsg.content)
					? assistantMsg.content
					: [{ type: "text" as const, text: assistantMsg.content }]

				assistantResponse = assistantContent as Anthropic.Messages.ContentBlockParam[]

				// Extract tools used in the response (including interrupted ones)
				for (const block of assistantContent) {
					if (block.type === "tool_use") {
						const toolName = (block as Anthropic.Messages.ToolUseBlockParam).name
						toolsUsed.push(toolName)
					} else if (block.type === "text") {
						// Check for interrupted tool calls in text blocks
						const text = (block as Anthropic.Messages.TextBlockParam).text || ""

						// Pattern to match XML-style tool tags: <tool_name>...</tool_name> or <tool_name (interrupted)
						const toolTagPattern = /<(\w+)(?:\s|>)/g
						let match

						while ((match = toolTagPattern.exec(text)) !== null) {
							const potentialToolName = match[1]

							// Common tool names in your system
							const knownTools = [
								"write_to_file",
								"read_file",
								"apply_diff",
								"execute_command",
								"list_files",
								"search_files",
								"update_todo_list",
								"fetch_instructions",
								"sf_deploy_metadata",
								"retrieve_sf_metadata",
								"ask_followup_question",
								"attempt_completion",
								"new_task",
								"switch_mode",
							]

							if (knownTools.includes(potentialToolName)) {
								// Check if tool was interrupted (incomplete closing tag or followed by "Response interrupted")
								const isInterrupted =
									text.includes("[Response interrupted") || !text.includes(`</${potentialToolName}>`)

								if (isInterrupted && !toolsUsed.includes(`${potentialToolName} (interrupted)`)) {
									toolsUsed.push(`${potentialToolName} (interrupted)`)
								} else if (!isInterrupted && !toolsUsed.includes(potentialToolName)) {
									toolsUsed.push(potentialToolName)
								}
							}
						}
					}
				}
			}

			requests.push({
				requestIndex: requestIndex++,
				timestamp: (message as ApiMessage).ts || Date.now(),
				userMessage,
				assistantResponse,
				toolsUsed,
				hadPreTask,
				hadEnvironmentDetails,
				wasStripped,
			})
		}
	}

	return requests
}

/**
 * Exports the full task conversation history as a JSON file for debug/analysis.
 * Includes metadata, statistics, and the raw apiConversationHistory.
 */
export async function exportTaskDebugJson(
	apiConversationHistory: ApiMessage[],
	metadata: DebugExportMetadata,
): Promise<void> {
	const date = new Date(metadata.timestamp)
	const month = date.toLocaleString("en-US", { month: "short" }).toLowerCase()
	const day = date.getDate()
	const year = date.getFullYear()
	let hours = date.getHours()
	const minutes = date.getMinutes().toString().padStart(2, "0")
	const seconds = date.getSeconds().toString().padStart(2, "0")
	const ampm = hours >= 12 ? "pm" : "am"
	hours = hours % 12
	hours = hours ? hours : 12

	const fileName = `siid_debug_${month}-${day}-${year}_${hours}-${minutes}-${seconds}-${ampm}.json`

	const statistics = computeStatistics(apiConversationHistory)
	const apiRequests = extractApiRequests(apiConversationHistory)

	const { systemPrompt, ...metadataWithoutPrompt } = metadata

	const exportData = {
		metadata: {
			...metadataWithoutPrompt,
			exportedAt: new Date().toISOString(),
		},
		statistics,
		systemPrompt: systemPrompt || null,
		apiRequests,
		apiConversationHistory,
	}

	const saveUri = await vscode.window.showSaveDialog({
		filters: { JSON: ["json"] },
		defaultUri: vscode.Uri.file(path.join(os.homedir(), "Downloads", fileName)),
	})

	if (saveUri) {
		await vscode.workspace.fs.writeFile(saveUri, Buffer.from(JSON.stringify(exportData, null, 2)))
		vscode.window.showTextDocument(saveUri, { preview: true })
	}
}

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

	const { systemPrompt, ...metadataWithoutPrompt } = metadata

	const exportData = {
		metadata: {
			...metadataWithoutPrompt,
			exportedAt: new Date().toISOString(),
		},
		statistics,
		systemPrompt: systemPrompt || null,
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

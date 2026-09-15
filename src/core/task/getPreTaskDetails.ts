import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import { TaskTypeMapping } from "../../shared/globalFileNames"
import type { Experiments } from "@siid-code/types"
import { FileChangesService } from "../../services/file-changes"

export interface PreTaskOptions {
	globalStorageUri: vscode.Uri | undefined
	taskId?: string
	planningFilePath?: string
}

/**
 * Generates static pre-task instructions for the AI, included in system prompt.
 */
export function getStaticPreTaskInstructions(): string {
	let instructions = `### Task Guide Instructions\n`
	instructions += `**IMPORTANT:** Use 'get_task_guides' tool to get all required instructions for your task.\n`
	instructions += `(If you have already loaded task guides, you can focus on execution.)\n\n`

	instructions += `---\n\n`
	instructions += `- **code:** Apex, async Apex, LWC, triggers, test classes, development\n\n`
	instructions += `---\n\n`

	instructions += `### Available Task Types for get_task_guides\n\n`
	const taskTypes = Object.entries(TaskTypeMapping)
	for (const [taskType, config] of taskTypes) {
		instructions += `- **${taskType}:** ${config.description}\n`
	}
	instructions += `\nExample:\n`
	instructions += `<get_task_guides>\n`
	instructions += `<task_type>create-lwc-with-apex</task_type>\n`
	instructions += `</get_task_guides>\n`
	return instructions
}

/**
 * Generates pre-task instructions for the AI.
 * Content is dynamic based on current task state.
 */
export async function getPreTaskDetails(globalStorageUri: vscode.Uri | undefined, options?: Partial<PreTaskOptions>) {
	const { taskId, planningFilePath } = options || {}

	let preTask = ""

	if (globalStorageUri) {
		// Planning file instructions if exists
		if (planningFilePath) {
			preTask += `**Planning File:** A planning file has been created at \`${planningFilePath}\`. This file contains task phases and a progress log.\n`
			preTask += `- Read the planning file to understand task phases\n`
			preTask += `- Update the planning file as you progress through phases\n`
			preTask += `- Use the write_to_file tool to update the file: write_to_file(path="${planningFilePath}", content=<updated content>)\n\n`
		}

		// Include modified files list so AI knows what has changed and deploys only those files
		if (taskId) {
			try {
				const service = FileChangesService.getInstance()
				const fileChanges = await service.getTaskFileChanges(taskId)
				if (fileChanges.length > 0) {
					preTask += `### Modified Files in This Task\n`
					preTask += `**IMPORTANT:** Keep track of these files. During deployment, deploy ONLY these specific files — NEVER deploy entire folders (e.g., \`default/\`, \`classes/\`, \`lwc/\`, \`triggers/\`).\n\n`
					preTask += `| File | Status | Deployment |\n`
					preTask += `|------|--------|------------|\n`
					for (const fc of fileChanges) {
						preTask += `| \`${fc.filePath}\` | ${fc.status} | ${fc.deploymentStatus} |\n`
					}
					preTask += `\n`
				}
			} catch {
				// Ignore errors — file changes service may not be initialized
			}
		}
	}

	if (preTask.length > 0) {
		return `<pre-task>\n\n${preTask}\n</pre-task>`
	}
	return ""
}

/**
 * Legacy function signature for backward compatibility
 * @deprecated Use getPreTaskDetails with options object
 */
export async function getPreTaskDetailsLegacy(
	globalStorageUri: vscode.Uri | undefined,
	_includeFileDetails: boolean = false,
) {
	return getPreTaskDetails(globalStorageUri, {})
}

import Anthropic from "@anthropic-ai/sdk"
import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"

import { RooCodeEventName } from "@siid-code/types"
import { TelemetryService } from "@siid-code/telemetry"

import { Task } from "../task/Task"
import {
	ToolResponse,
	ToolUse,
	AskApproval,
	HandleError,
	PushToolResult,
	RemoveClosingTag,
	ToolDescription,
	AskFinishSubTaskApproval,
} from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { Package } from "../../shared/package"
import { FileChangesService } from "../../services/file-changes"

export async function attemptCompletionTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
	toolDescription: ToolDescription,
	askFinishSubTaskApproval: AskFinishSubTaskApproval,
) {
	const result: string | undefined = block.params.result
	const command: string | undefined = block.params.command

	// Get the setting for preventing completion with open todos from VSCode configuration
	const preventCompletionWithOpenTodos = vscode.workspace
		.getConfiguration(Package.name)
		.get<boolean>("preventCompletionWithOpenTodos", false)

	// Check if there are incomplete todos (only if the setting is enabled)
	const hasIncompleteTodos = cline.todoList && cline.todoList.some((todo) => todo.status !== "completed")

	if (preventCompletionWithOpenTodos && hasIncompleteTodos) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("attempt_completion")

		pushToolResult(
			formatResponse.toolError(
				"Cannot complete task while there are incomplete todos. Please finish all todos before attempting completion.",
			),
		)

		return
	}

	// Check if SF deployment was performed before completing task
	// Use FileChangesService to get all modified files for this task
	const sfFileExtensions = [
		".cls",
		".trigger",
		".page",
		".component",
		"-meta.xml",
		".object",
		".field",
		".layout",
		".permissionset",
		".profile",
		".flexipage",
		".flow",
	]
	const sfDirectories = [
		"/classes/",
		"/triggers/",
		"/pages/",
		"/components/",
		"/objects/",
		"/layouts/",
		"/permissionsets/",
		"/profiles/",
		"/flexipages/",
		"/flows/",
		"/lwc/",
		"/aura/",
		"/staticresources/",
		"/tabs/",
		"/applications/",
	]

	let hasSfFileModifications = false

	// Try to use FileChangesService to get modified files
	try {
		const fileChangesService = FileChangesService.getInstance()
		const fileChanges = await fileChangesService.getTaskFileChanges(cline.taskId)

		// Check if any modified files are Salesforce files
		for (const fileChange of fileChanges) {
			const filePath = fileChange.filePath.toLowerCase()
			const hasSfExtension = sfFileExtensions.some((ext) => filePath.includes(ext))
			const hasSfDirectory = sfDirectories.some((dir) => filePath.includes(dir))

			if (hasSfExtension || hasSfDirectory) {
				hasSfFileModifications = true
				break
			}
		}
	} catch (error) {
		// FileChangesService might not be initialized, fall back to checking messages
		console.log("[attemptCompletion] FileChangesService unavailable, skipping SF deployment check:", error)
	}

	// Only check for deployment if Salesforce files were modified
	if (hasSfFileModifications) {
		// Look for sf_deploy_metadata tool usage or execute_command with "sf project deploy"
		const hasSfDeployMetadata = (cline.toolUsage["sf_deploy_metadata"]?.attempts ?? 0) > 0

		// Check if any execute_command contained "sf project deploy"
		let hasSfDeployCommand = false
		for (const message of cline.clineMessages) {
			if (message.type === "ask" && message.ask === "command") {
				const command = message.text?.toLowerCase() || ""
				if (command.includes("sf project deploy") || command.includes("sf deploy")) {
					hasSfDeployCommand = true
					break
				}
			}
		}

		// If neither deployment method was used, remind the AI to deploy
		if (!hasSfDeployMetadata && !hasSfDeployCommand) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("attempt_completion")

			pushToolResult(
				formatResponse.toolError(
					"⚠️ **Deployment Required:** You modified Salesforce files but haven't deployed them yet.\n\n**ACTION REQUIRED:**\n1. First, load deployment instructions: Use 'get_task_guides' tool with your task type (create-apex, create-lwc, etc.) to get the Salesforce Deployment Best Practices guide\n2. Follow the deployment guide to deploy SPECIFIC components (not entire folders)\n3. Use 'execute_command' with component-specific paths:\n   - Apex: `sf project deploy start --dry-run --source-dir force-app/main/default/classes/YourClass.cls --json`\n   - LWC: `sf project deploy start --dry-run --source-dir force-app/main/default/lwc/yourComponent --json`\n\n**CRITICAL:** \n- ❌ NEVER deploy entire folders (classes/, lwc/, etc.)\n- ✅ ALWAYS deploy specific component files/folders\n- ✅ ALWAYS dry-run first, fix errors, then deploy\n- ✅ Deploy dependencies in order (Apex first, then LWC)\n- ✅ If multiple components fail together, deploy one-by-one\n\nAfter successful deployment, attempt completion again.",
				),
			)

			return
		}
	}

	try {
		const lastMessage = cline.clineMessages.at(-1)

		if (block.partial) {
			if (command) {
				// the attempt_completion text is done, now we're getting command
				// remove the previous partial attempt_completion ask, replace with say, post state to webview, then stream command

				// const secondLastMessage = cline.clineMessages.at(-2)
				if (lastMessage && lastMessage.ask === "command") {
					// update command
					await cline.ask("command", removeClosingTag("command", command), block.partial).catch(() => {})
				} else {
					// last message is completion_result
					// we have command string, which means we have the result as well, so finish it (doesnt have to exist yet)
					await cline.say("completion_result", removeClosingTag("result", result), undefined, false)

					TelemetryService.instance.captureTaskCompleted(cline.taskId)
					cline.emit(RooCodeEventName.TaskCompleted, cline.taskId, cline.getTokenUsage(), cline.toolUsage)

					await cline.ask("command", removeClosingTag("command", command), block.partial).catch(() => {})
				}
			} else {
				// No command, still outputting partial result
				await cline.say("completion_result", removeClosingTag("result", result), undefined, block.partial)
				cline.taskCompleted = true
			}
			return
		} else {
			if (!result) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("attempt_completion")
				pushToolResult(await cline.sayAndCreateMissingParamError("attempt_completion", "result"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Command execution is permanently disabled in attempt_completion
			// Users must use execute_command tool separately before attempt_completion
			await cline.say("completion_result", result, undefined, false)
			TelemetryService.instance.captureTaskCompleted(cline.taskId)
			cline.taskCompleted = true
			cline.emit(RooCodeEventName.TaskCompleted, cline.taskId, cline.getTokenUsage(), cline.toolUsage)

			// Debug logging for subtask detection
			console.log(
				`[attemptCompletionTool] Task ${cline.taskId} (taskNumber: ${cline.taskNumber}): parentTask=${cline.parentTask ? cline.parentTask.taskId : "undefined"}`,
			)

			if (cline.parentTask) {
				const didApprove = await askFinishSubTaskApproval()

				if (!didApprove) {
					return
				}

				// tell the provider to remove the current subtask and resume the previous task in the stack
				await cline.providerRef.deref()?.finishSubTask(result)
				return
			}

			// We already sent completion_result says, an
			// empty string asks relinquishes control over
			// button and field.
			const { response, text, images } = await cline.ask("completion_result", "", false)

			// Signals to recursive loop to stop (for now
			// cline never happens since yesButtonClicked
			// will trigger a new task).
			if (response === "yesButtonClicked") {
				pushToolResult("")
				return
			}

			await cline.say("user_feedback", text ?? "", images)
			const toolResults: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = []

			toolResults.push({
				type: "text",
				text: `The user has provided feedback on the results. Consider their input to continue the task, and then attempt completion again.\n<feedback>\n${text}\n</feedback>`,
			})

			toolResults.push(...formatResponse.imageBlocks(images))
			cline.userMessageContent.push({ type: "text", text: `${toolDescription()} Result:` })
			cline.userMessageContent.push(...toolResults)

			return
		}
	} catch (error) {
		await handleError("inspecting site", error)
		return
	}
}

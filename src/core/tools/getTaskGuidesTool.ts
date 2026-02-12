import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { ToolUse, AskApproval, HandleError, PushToolResult } from "../../shared/tools"
import { resolveTaskGuides, getAvailableTaskTypes, isValidTaskType } from "../prompts/instructions/task-guide-resolver"

/**
 * Tool for AI to get all related guides/instructions for a task type in one call.
 * This replaces multiple fetch_instructions calls with a single unified call.
 */
export async function getTaskGuidesTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
) {
	const taskType: string | undefined = block.params.task_type

	try {
		if (block.partial) {
			// Skip partial messages
			return
		}

		if (!taskType) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("get_task_guides")

			// Provide helpful error with available task types
			const availableTypes = getAvailableTaskTypes()
			const typesList = availableTypes.map((t) => `- ${t.taskType}: ${t.description}`).join("\n")

			pushToolResult(
				formatResponse.toolError(
					`Missing required parameter 'task_type'. Available task types:\n\n${typesList}`,
				),
			)
			return
		}

		// Validate task type
		if (!isValidTaskType(taskType)) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("get_task_guides")

			const availableTypes = getAvailableTaskTypes()
			const typesList = availableTypes.map((t) => `- ${t.taskType}: ${t.description}`).join("\n")

			pushToolResult(
				formatResponse.toolError(`Invalid task_type '${taskType}'. Available task types:\n\n${typesList}`),
			)
			return
		}

		cline.consecutiveMistakeCount = 0

		// Get provider context
		const provider = cline.providerRef.deref()
		const mcpHub = provider?.getMcpHub()

		if (!mcpHub) {
			throw new Error("MCP hub not available")
		}

		const diffStrategy = cline.diffStrategy
		const context = provider?.context

		// Resolve and fetch all related guides
		const result = await resolveTaskGuides(taskType, {
			mcpHub,
			diffStrategy,
			context,
		})

		if (!result) {
			pushToolResult(formatResponse.toolError(`Could not load guides for task type: ${taskType}`))
			return
		}

		// Mark that guides have been fetched for this task
		cline.taskGuidesFetched = true

		// Show which task guides were loaded (with the list of guides)
		const toolMessage: ClineSayTool = {
			tool: "getTaskGuides",
			content: taskType,
			loadedGuides: result.loadedGuides,
		}
		await cline.say("tool", JSON.stringify(toolMessage))

		// Build response with guidance
		let response = result.instructions
		response += `\n\n---\n\n`
		response += `**Task Guide Summary:**\n`
		response += `- Task Type: ${result.taskType}\n`
		response += `- Recommended Mode: ${result.recommendedMode}\n`
		response += `- Loaded ${result.instructionCount} instruction guide(s)\n\n`
		response += `**Next Steps:**\n`
		response += `1. Create or update your todo list based on the task requirements\n`
		response += `2. If a todo list already exists, update it - don't recreate\n`
		response += `3. Follow the workflow in the guides above\n`

		pushToolResult(response)
	} catch (error) {
		await handleError("get task guides", error)
	}
}

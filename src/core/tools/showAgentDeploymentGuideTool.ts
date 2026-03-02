import { Task } from "../task/Task"
import type { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { openAgentDeploymentGuide } from "../../utils/openAgentDeploymentGuide"

/**
 * Tool to display the Agent Post Deployment Guide in markdown preview mode.
 * Shows configuration steps for adding deployed Agentforce agents to external websites.
 */
export async function showAgentDeploymentGuideTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	_removeClosingTag: RemoveClosingTag,
) {
	// Handle partial message
	if (block.partial) {
		// Skip partial messages
		return
	}

	try {
		// Get the provider context
		const provider = cline.providerRef.deref()
		if (!provider) {
			throw new Error("Provider not found")
		}

		console.log("Opening Agent Deployment Guide...", provider.context.extensionPath)
		console.log("Opening Agent Deployment Guide...", provider.context.globalStorageUri.fsPath)
		// Open the guide using the common utility function
		await openAgentDeploymentGuide(provider.context)

		// Success message
		await cline.say(
			"tool",
			"Agent Post Deployment Guide opened successfully. The guide provides step-by-step instructions for configuring your deployed agent for external websites, including messaging settings, routing configuration, CORS, and trusted domains setup.",
		)

		pushToolResult(
			formatResponse.toolResult(
				"Agent Post Deployment Guide has been opened in preview mode. User can now view the complete configuration steps.",
			),
		)
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error)
		await handleError("opening Agent Deployment Guide", error instanceof Error ? error : new Error(errorMsg))
		pushToolResult(formatResponse.toolError(`Failed to open Agent Deployment Guide: ${errorMsg}`))
	}
}

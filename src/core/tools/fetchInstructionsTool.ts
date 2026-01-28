import { Task } from "../task/Task"
import { fetchInstructions } from "../prompts/instructions/instructions"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { ToolUse, AskApproval, HandleError, PushToolResult } from "../../shared/tools"

/**
 * Maps task identifiers to user-friendly display names
 */
function getTaskDisplayName(task: string): string {
	const taskNames: Record<string, string> = {
		// General Instructions
		create_mcp_server: "MCP Server Instructions",
		create_mode: "Custom Mode Instructions",
		create_lwc: "Lightning Web Component Instructions",
		create_apex: "Apex Class Instructions",
		create_visual_force: "Visual Force Page Instructions",
		create_aura_components: "Aura Components Instructions",

		// Salesforce Agent Instructions
		assignment_rules: "Assignment Rules Instructions",
		custom_field: "Custom Field Instructions",
		custom_object: "Custom Object Instructions",
		field_permissions: "Field Permissions Instructions",
		object_permissions: "Object Permissions Instructions",
		path_creation: "Path Creation Instructions",
		profile: "Profile Instructions",
		record_types: "Record Types Instructions",
		role_creation: "Role Creation Instructions",
		validation_rules: "Validation Rules Instructions",
		// PMD Rules Instructions
		pmd_apex: "PMD Apex Rules Instructions",
		pmd_html: "PMD HTML Rules Instructions",
		pmd_javascript: "PMD JavaScript Rules Instructions",
		pmd_visualforce: "PMD Visualforce Rules Instructions",
		pmd_xml: "PMD XML Rules Instructions",
		// Invocable Apex Instructions
		invocable_apex: "Invocable Apex Instructions",
	}

	return taskNames[task] || task
}

export async function fetchInstructionsTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
) {
	const task: string | undefined = block.params.task
	const displayName = task ? getTaskDisplayName(task) : undefined
	const sharedMessageProps: ClineSayTool = { tool: "fetchInstructions", content: displayName }

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: undefined } satisfies ClineSayTool)
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!task) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("fetch_instructions")
				pushToolResult(await cline.sayAndCreateMissingParamError("fetch_instructions", "task"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Extract optional section parameter
			const section: string | undefined = block.params.section

			// Update display message to include section if provided
			const displayMessage = section ? `${displayName} - Section: ${section}` : displayName

			// Auto-approve instructions fetch to reduce friction.
			// We still emit a message so the webview shows what was fetched, but do not gate on user approval.
			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: displayMessage,
			} satisfies ClineSayTool)
			// Skip explicit approval prompt; we'll show the fetched content via pushToolResult below.

			// Now fetch the content and provide it to the agent.
			const provider = cline.providerRef.deref()
			const mcpHub = provider?.getMcpHub()

			if (!mcpHub) {
				throw new Error("MCP hub not available")
			}

			const diffStrategy = cline.diffStrategy
			const context = provider?.context
			const content = await fetchInstructions(task, { mcpHub, diffStrategy, context, section })

			if (!content) {
				pushToolResult(formatResponse.toolError(`Invalid instructions request: ${task}`))
				return
			}

			pushToolResult(content)

			return
		}
	} catch (error) {
		await handleError("fetch instructions", error)
	}
}

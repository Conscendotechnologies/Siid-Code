import * as vscode from "vscode"

export async function getPreTaskDetails(globalStorageUri: vscode.Uri | undefined, includeFileDetails: boolean = false) {
	console.log("Getting pre-task details...")
	console.log(`Global Storage URI: ${globalStorageUri}`)

	let preTask = "<pre-task>"
	if (globalStorageUri) {
		preTask += `\n\n**IMPORTANT: Before proceeding with any task, you MUST use the 'fetch_instructions' tool to read the relevant instructions.**\n\n`
		preTask += `Do NOT attempt to read instruction files directly. Always use the fetch_instructions tool.\n\n`

		// Enforce Orchestrator Planning Workflow
		preTask += `---\n\n`
		preTask += `### Required Orchestrator Planning Workflow\n\n`
		preTask += `For multi-phase tasks, you MUST follow this planning protocol:\n\n`

		preTask += `#### Step 1: Create Phase-Based Todo List\n`
		preTask += `Use 'update_todo_list' with DYNAMIC phases based on task analysis:\n\n`
		preTask += `<update_todo_list>\n`
		preTask += `<todos>\n`
		preTask += `[ ] Phase 1/N: [Description] ([mode-name])\n`
		preTask += `[ ] Phase 2/N: [Description] ([mode-name])\n`
		preTask += `[ ] Phase 3/N: [Description] ([mode-name])\n`
		preTask += `...additional phases as needed...\n`
		preTask += `</todos>\n`
		preTask += `</update_todo_list>\n\n`

		preTask += `**Status legend:** [ ] pending, [-] in_progress, [x] completed\n\n`

		preTask += `#### Step 3: Execute & Validate Each Phase\n`
		preTask += `For each phase:\n`
		preTask += `1. Delegate to appropriate mode (salesforce-agent or code)\n`
		preTask += `2. Mode reports status: SUCCESS | PARTIAL | FAILED\n`
		preTask += `3. Validate deliverables before proceeding\n`
		preTask += `4. If FAILED: Re-delegate with error context (max 2 retries)\n`
		preTask += `5. Update todo list with phase status\n\n`

		preTask += `#### Step 4: Final Summary\n`
		preTask += `After all phases complete:\n`
		preTask += `- Update todo list with final status\n`
		preTask += `- Provide summary of all deliverables\n`
		preTask += `- Mark all todos complete\n\n`

		preTask += `**CRITICAL RULES:**\n`
		preTask += `- ALWAYS create phase plan BEFORE any delegation\n`
		preTask += `- ALWAYS validate phase status before next phase\n`
		preTask += `- ALWAYS re-delegate with error context if issues found\n`
		preTask += `- NEVER exceed 2 retries without user input\n`
		preTask += `- ONE task [-] in_progress at a time\n\n`

		preTask += `---\n\n`
		preTask += `### Mode Selection Guide\n\n`
		preTask += `**salesforce-agent mode:** Objects, fields, profiles, flows, Agentforce agents, admin work\n`
		preTask += `**code mode:** Apex, LWC, triggers, test classes, development work\n\n`

		preTask += `---\n\n`
		preTask += `Available instruction tasks:\n`
		preTask += `\n**General Instructions:**\n`
		preTask += `- create_mcp_server: Instructions for creating MCP servers\n`
		preTask += `- create_mode: Instructions for creating custom modes\n`
		preTask += `- create_lwc: Instructions for creating/updating Lightning Web Components\n`
		preTask += `- create_apex: Instructions for creating/updating Apex classes\n`
		preTask += `- invocable_apex: Instructions for creating/updating Invocable Apex classes actions for agentforce scenarios\n`
		preTask += `- adaptive_response_agent: Instructions for creating/updating Adaptive Response Agents\n`
		preTask += `- adaptive_response_agent_workflow: Workflow instructions for Adaptive Response Agents\n\n`
		preTask += `\n**Salesforce Agent Instructions:**\n`
		preTask += `- agentforce_agent_create: Instructions for creating Agentforce agents from scratch\n`
		preTask += `- agentforce_agent_analyse: Instructions for analyzing and enhancing existing Agentforce agents\n`
		preTask += `- agentforce_topic_analyse: Instructions for analyzing and optimizing Agentforce topics\n`
		preTask += `- agentforce_topics_actions: Instructions for configuring topics and actions in Agentforce\n`
		preTask += `- assignment_rules: Instructions for creating/updating Assignment Rules\n`
		preTask += `- custom_field: Instructions for creating/updating Custom Fields\n`
		preTask += `- custom_object: Instructions for creating/updating Custom Objects\n`
		preTask += `- field_permissions: Instructions for creating/updating Field Permissions\n`
		preTask += `- object_permissions: Instructions for creating/updating Object Permissions\n`
		preTask += `- path_creation: Instructions for creating/updating Paths\n`
		preTask += `- profile: Instructions for creating/updating Profiles\n`
		preTask += `- record_types: Instructions for creating/updating Record Types\n`
		preTask += `- role_creation: Instructions for creating/updating Roles\n`
		preTask += `- validation_rules: Instructions for creating/updating Validation Rules\n\n`
		preTask += `Example usage:\n`
		preTask += `<fetch_instructions>\n`
		preTask += `<task>create_lwc</task>\n`
		preTask += `</fetch_instructions>\n`
	}
	preTask += `\n</pre-task>`
	return preTask
}

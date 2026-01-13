import * as vscode from "vscode"

export async function getPreTaskDetails(globalStorageUri: vscode.Uri | undefined, includeFileDetails: boolean = false) {
	console.log("Getting pre-task details...")
	console.log(`Global Storage URI: ${globalStorageUri}`)

	let preTask = "<pre-task>"
	if (globalStorageUri) {
		preTask += `\n\n**IMPORTANT: Before proceeding with any task, you MUST use the 'fetch_instructions' tool to read the relevant instructions.**\n\n`
		preTask += `Do NOT attempt to read instruction files directly. Always use the fetch_instructions tool.\n\n`

		// Enforce Todo Workflow
		preTask += `---\n\n`
		preTask += `### Required Todo Workflow\n`
		preTask += `You MUST create and maintain a todo list for every non-trivial task before using any other tools. Use the 'update_todo_list' tool to create or update the checklist. Keep steps small to avoid losing context.\n\n`
		preTask += `#### How to create/update the todo list\n`
		preTask += `<update_todo_list>\n`
		preTask += `<todos>\n`
		preTask += `[ ] Capture task requirements\n`
		preTask += `[ ] Locate relevant code areas\n`
		preTask += `[ ] Break task into subtasks\n`
		preTask += `[ ] Define assumptions & risks\n`
		preTask += `[ ] Plan tool batches\n`
		preTask += `[ ] Execute first subtask\n`
		preTask += `[ ] Run build/lint/tests\n`
		preTask += `[ ] Iterate on errors\n`
		preTask += `[ ] Execute remaining subtasks\n`
		preTask += `[ ] Finalize & summarize\n`
		preTask += `</todos>\n`
		preTask += `</update_todo_list>\n\n`
		preTask += `Status legend: [ ] pending, [-] in_progress, [x] completed. Update statuses as you progress.\n\n`
		preTask += `The checklist must be updated at each step and summarized at the end. If a failure occurs, add a brief note and retry up to three targeted fixes before escalating.\n\n`
		preTask += `---\n\n`
		preTask += `Available instruction tasks:\n`
		preTask += `\n**General Instructions:**\n`
		preTask += `- create_mcp_server: Instructions for creating MCP servers\n`
		preTask += `- create_mode: Instructions for creating custom modes\n`
		preTask += `- create_lwc: Instructions for creating/updating Lightning Web Components\n`
		preTask += `- create_apex: Instructions for creating/updating Apex classes\n`
		preTask += `- create_visual_force: Instructions for creating/updating Visualforce Pages\n`
		preTask += `- create_aura_components: Instructions for creating/updating Aura Components\n`
		preTask += `- invocable_apex: Instructions for creating/updating Invocable Apex classes actions for agentforce scenarios\n`
		preTask += `\n**Salesforce Agent Instructions:**\n`
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

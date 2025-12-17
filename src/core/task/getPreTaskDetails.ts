import * as vscode from "vscode"

export async function getPreTaskDetails(
	globalStorageUri: vscode.Uri | undefined,
	includeFileDetails: boolean = false,
	currentMode?: string,
) {
	console.log("Getting pre-task details...")
	console.log(`Global Storage URI: ${globalStorageUri}`)
	console.log(`Current Mode: ${currentMode}`)

	let preTask = "<pre-task>"
	if (globalStorageUri) {
		// Orchestrator has its own embedded instructions, no fetch_instructions needed
		if (currentMode !== "orchestrator") {
			preTask += `\n\n**IMPORTANT: Before proceeding with any task, you MUST use the 'fetch_instructions' tool to read the relevant instructions.**\n\n`
			preTask += `Do NOT attempt to read instruction files directly. Always use the fetch_instructions tool.\n\n`
			preTask += `---\n\n`
			preTask += `Available instruction tasks:\n`

			// Show appropriate instructions based on mode
			if (currentMode === "flow-builder") {
				preTask += `\n**Flow Builder Instructions:**\n`
				preTask += `- screen_flow_patterns: Screen Flow template and patterns (user input, forms, wizards)\n`
				preTask += `- record_trigger_flow_patterns: Record-Triggered Flow patterns (before/after save automation)\n`
				preTask += `- detailed_workflow: 10-phase step-by-step workflow with validation checkpoints\n`
				preTask += `- quick_reference: Quick reference guide (10 phases at a glance)\n\n`
				preTask += `**Flow Schema Tool:**\n`
				preTask += `Use the retrieve_schema tool to get Flow XML component definitions from Salesforce Metadata API v65.0.\n`
				preTask += `Available schemas: Flow, FlowRecordCreate, FlowRecordUpdate, FlowRecordDelete, FlowRecordLookup, FlowDecision, FlowLoop, FlowAssignment, FlowScreen, FlowSubflow, FlowActionCall, FlowStart, FlowVariable, FlowFormula, FlowTextTemplate, FlowConstant, FlowProcessType\n\n`
			} else {
				// General and Salesforce Agent instructions for non-flow-builder modes
				preTask += `\n**General Instructions:**\n`
				preTask += `- create_mcp_server: Instructions for creating MCP servers\n`
				preTask += `- create_mode: Instructions for creating custom modes\n`
				preTask += `- create_lwc: Instructions for creating/updating Lightning Web Components\n`
				preTask += `- create_apex: Instructions for creating/updating Apex classes\n`
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
			}

			preTask += `Example usage:\n`
			preTask += `<fetch_instructions>\n`
			if (currentMode === "flow-builder") {
				preTask += `<task>screen_flow_patterns</task>\n`
			} else {
				preTask += `<task>create_lwc</task>\n`
			}
			preTask += `</fetch_instructions>\n\n`
		}

		// Enforce Todo Workflow (applies to all modes)
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
	}
	preTask += `\n</pre-task>`
	return preTask
}

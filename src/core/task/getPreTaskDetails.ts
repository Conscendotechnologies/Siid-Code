import * as vscode from "vscode"

export async function getPreTaskDetails(globalStorageUri: vscode.Uri | undefined, includeFileDetails: boolean = false) {
	console.log("Getting pre-task details...")
	console.log(`Global Storage URI: ${globalStorageUri}`)

	let preTask = "<pre-task>"
	if (globalStorageUri) {
		preTask += `\n\n**IMPORTANT: Before proceeding with any task, you MUST use the 'fetch_instructions' tool to read the relevant instructions.**\n\n`
		preTask += `Do NOT attempt to read instruction files directly. Always use the fetch_instructions tool.\n\n`
		preTask += `Available instruction tasks:\n`
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
		preTask += `Example usage:\n`
		preTask += `<fetch_instructions>\n`
		preTask += `<task>create_lwc</task>\n`
		preTask += `</fetch_instructions>\n`
	}
	preTask += `\n</pre-task>`
	return preTask
}

/**
 * Generates the fetch_instructions tool description.
 * @param enableMcpServerCreation - Whether to include MCP server creation task.
 *                                  Defaults to true when undefined.
 */
export function getFetchInstructionsDescription(enableMcpServerCreation?: boolean): string {
	const tasks =
		enableMcpServerCreation !== false
			? `  create_mcp_server
  create_mode
  create_lwc
  create_apex
  assignment_rules
  custom_field
  custom_object
  field_permissions
  object_permissions
  path_creation
  profile
  record_types
  role_creation
  validation_rules`
			: `  create_mode
  create_lwc
  create_apex
  assignment_rules
  custom_field
  custom_object
  field_permissions
  object_permissions
  path_creation
  profile
  record_types
  role_creation
  validation_rules`

	const example =
		enableMcpServerCreation !== false
			? `Example: Requesting instructions to create an MCP Server

<fetch_instructions>
<task>create_mcp_server</task>
</fetch_instructions>

Example: Requesting instructions to create a Lightning Web Component

<fetch_instructions>
<task>create_lwc</task>
</fetch_instructions>

Example: Requesting instructions to create an Apex class

<fetch_instructions>
<task>create_apex</task>
</fetch_instructions>

Example: Requesting instructions for Salesforce Assignment Rules

<fetch_instructions>
<task>assignment_rules</task>
</fetch_instructions>

Example: Requesting instructions for Salesforce Custom Field

<fetch_instructions>
<task>custom_field</task>
</fetch_instructions>`
			: `Example: Requesting instructions to create a Mode

<fetch_instructions>
<task>create_mode</task>
</fetch_instructions>

Example: Requesting instructions to create a Lightning Web Component

<fetch_instructions>
<task>create_lwc</task>
</fetch_instructions>

Example: Requesting instructions for Salesforce Custom Object

<fetch_instructions>
<task>custom_object</task>
</fetch_instructions>`

	return `## fetch_instructions
Description: Request to fetch instructions to perform a task
Parameters:
- task: (required) The task to get instructions for.  This can take the following values:
${tasks}

${example}`
}

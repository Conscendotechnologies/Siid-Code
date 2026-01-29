export type PromptVariables = {
	workspace?: string
	extensionPath?: string
	globalStoragePath?: string
	mode?: string
	language?: string
	shell?: string
	operatingSystem?: string
}

/**
 * Loads custom system prompt from a file at .roo/system-prompt-[mode slug]
 * If the file doesn't exist, returns an empty string
 */
export async function loadCustomPromptIndexFile(cwd: string, variables: PromptVariables): Promise<string> {
	return `**IMPORTANT: This is index information to help you complete your tasks.

**Rules for using instructions:**
1. When a user makes a request, first identify the task type
2. You must use the 'fetch_instructions' tool to access the instructions to complete the task.

Do **not** attempt to complete the task without first fetching the related instruction file using the fetch_instructions tool.
Always follow the steps and format provided in the instruction file to complete the task.

**General Instructions Examples:**

Example: If the user asks you to create or edit a Lightning Web Component, you should fetch the instructions like this:
<fetch_instructions>
<task>create_lwc</task>
</fetch_instructions>

Example: If the user asks you to create or edit an Apex class, you should fetch the instructions like this:
<fetch_instructions>
<task>create_apex</task>
</fetch_instructions>

**Salesforce Agent Instructions Examples:**

Example: If the user asks you to create a Custom Field:
<fetch_instructions>
<task>custom_field</task>
</fetch_instructions>

Example: If the user asks you to create a Custom Object:
<fetch_instructions>
<task>custom_object</task>
</fetch_instructions>

Example: If the user asks you to create Validation Rules:
<fetch_instructions>
<task>validation_rules</task>
</fetch_instructions>

**PMD Rules Instructions Examples:**

Example: If the user is writing Apex code and needs to follow PMD best practices:
<fetch_instructions>
<task>pmd_apex</task>
</fetch_instructions>

Example: If the user is writing JavaScript code and needs to follow PMD best practices:
<fetch_instructions>
<task>pmd_javascript</task>
</fetch_instructions>

Example: If the user is writing HTML code and needs to follow PMD best practices:
<fetch_instructions>
<task>pmd_html</task>
</fetch_instructions>

Example: If the user is writing Visualforce code and needs to follow PMD best practices:
<fetch_instructions>
<task>pmd_visualforce</task>
</fetch_instructions>

Example: If the user is writing XML configuration and needs to follow PMD best practices:
<fetch_instructions>
<task>pmd_xml</task>
</fetch_instructions>`
}

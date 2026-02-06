import { TaskTypeMapping } from "../../../shared/globalFileNames"

/**
 * Generates the get_task_guides tool description.
 * This tool replaces fetch_instructions - provides all related guides in one call.
 */
export function getGetTaskGuidesDescription(): string {
	// Build task types list from TaskTypeMapping
	const taskTypesList = Object.entries(TaskTypeMapping)
		.map(([taskType, config]) => `  ${taskType} - ${config.description}`)
		.join("\n")

	return `## get_task_guides
Description: Get all required instruction guides for a task type in a single call. This tool automatically fetches all related guides based on the task type, eliminating the need for multiple instruction fetches.

Parameters:
- task_type: (required) The type of task you want to perform. Available types:
${taskTypesList}

Usage Notes:
- Use this tool BEFORE starting any task to get complete guidance
- All related instructions are combined and returned in one response
- The tool also provides the recommended mode for the task
- If a todo list already exists, update it instead of recreating

Example: Get guides for creating an LWC with Apex backend

<get_task_guides>
<task_type>create-lwc-with-apex</task_type>
</get_task_guides>

Example: Get guides for creating custom objects

<get_task_guides>
<task_type>create-custom-object</task_type>
</get_task_guides>

Example: Get guides for Adaptive Response Agent

<get_task_guides>
<task_type>create-adaptive-agent</task_type>
</get_task_guides>`
}

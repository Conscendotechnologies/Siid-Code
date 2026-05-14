import { ToolArgs } from "./types"

export function getAttemptCompletionDescription(args?: ToolArgs): string {
	return `## attempt_completion
Description: After each tool use, the user will respond with the result of that tool use, i.e. if it succeeded or failed, along with any reasons for failure. Use this tool when you are ready to stop and present a final status summary to the user. This summary does not need to claim the task is complete. Accurately state what was completed, what is still in progress, and what remains blocked or pending.
IMPORTANT NOTE: This tool CANNOT be used until you've confirmed from the user that any previous tool uses were successful. Failure to do so will result in code corruption and system failure. Before using this tool, you must ask yourself in <thinking></thinking> tags if you've confirmed from the user that any previous tool uses were successful. If not, then DO NOT use this tool.
Parameters:
- result: (required) A concise status summary for the current task. Do not falsely say the task is completed if any requested work is still in progress, blocked, not deployed, or unverified. Don't end your result with questions or offers for further assistance.
Usage:
<attempt_completion>
<result>
Your final status summary here
</result>
</attempt_completion>

Example: Sending a final status summary
<attempt_completion>
<result>
Updated the CSS. Deployment is still pending.
</result>
</attempt_completion>`
}

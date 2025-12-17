export function getSwitchModeDescription(): string {
	return `## switch_mode
Description: Request to switch to a different mode. This tool allows modes to request switching to another mode when needed, such as switching to code mode to make code changes. The user must approve the mode switch.

**IMPORTANT: After switching to a new mode, you MUST:**
1. Create or update your todo list to match the new mode's workflow
2. For Flow Builder mode: Create the 10-phase todo structure (replace any existing generic todos)
3. For Code mode: Use the standard code workflow todos
4. For other modes: Follow their specific patterns
5. This ensures consistent progress tracking across mode switches

Parameters:
- mode_slug: (required) The slug of the mode to switch to (e.g., "code", "ask", "architect")
- reason: (optional) The reason for switching modes
Usage:
<switch_mode>
<mode_slug>Mode slug here</mode_slug>
<reason>Reason for switching here</reason>
</switch_mode>

Example: Requesting to switch to code mode
<switch_mode>
<mode_slug>code</mode_slug>
<reason>Need to make code changes</reason>
</switch_mode>`
}

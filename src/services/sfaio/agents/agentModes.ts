import { ModeConfig } from "@siid-code/types"

/**
 * Builds an ephemeral ModeConfig for an agent.
 * Limits the agent's scope by restricting which tools and files it can touch.
 */
export function buildAgentMode(
	baseMode: ModeConfig,
	agentId: string,
	roleDescription: string,
	allowedFiles: string[],
): ModeConfig {
	const ownershipRegex = buildOwnershipRegex(allowedFiles)

	return {
		...baseMode,
		slug: `${baseMode.slug}-${agentId}`,
		name: `${baseMode.name} (${agentId})`,
		roleDefinition: `${baseMode.roleDefinition}\n\n${roleDescription}\n\nYou are strictly restricted to modifying only the following files:\n${allowedFiles.join("\n")}`,
		customInstructions: `${baseMode.customInstructions || ""}\n\nYou must not touch any files outside of your allowed list.`,
	}
}

/**
 * Builds a regex string that matches the exact paths allowed for the agent.
 */
export function buildOwnershipRegex(allowedFiles: string[]): string {
	if (!allowedFiles || allowedFiles.length === 0) {
		return "^$" // Matches nothing
	}

	// Escape regex special characters in paths and join them
	const escapedPaths = allowedFiles.map((path) => path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
	return `^(${escapedPaths.join("|")})$`
}

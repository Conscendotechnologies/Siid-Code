import { GroupEntry, ModeConfig } from "@siid-code/types"

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
		// SFAIO: the prompt text below states the restriction, but prose is not
		// enforcement — a model can ignore it. The fileRegex on the `edit` group is
		// what makes ownership a hard guarantee: isToolAllowedForMode() checks it
		// and throws FileRestrictionError (src/shared/modes.ts). Phase 0 §0.3.
		groups: applyOwnershipToEditGroup(baseMode.groups, ownershipRegex, agentId),
		roleDefinition: `${baseMode.roleDefinition}\n\n${roleDescription}\n\nYou are strictly restricted to modifying only the following files:\n${allowedFiles.join("\n")}`,
		customInstructions: `${baseMode.customInstructions || ""}\n\nYou must not touch any files outside of your allowed list.`,
	}
}

/**
 * Replaces the `edit` group with one carrying the agent's ownership regex, leaving
 * every other group untouched.
 *
 * Deliberately a replace-in-place rather than a fixed group list:
 *  - it preserves whatever else the base mode allows (read / command / mcp / browser),
 *  - it never *adds* an edit group to a mode that has none (the Architect is read-only,
 *    and must stay that way),
 *  - group names must be unique (groupEntryArraySchema in packages/types/src/mode.ts),
 *    so appending would risk producing an invalid ModeConfig.
 */
function applyOwnershipToEditGroup(
	groups: readonly GroupEntry[],
	fileRegex: string,
	agentId: string,
): GroupEntry[] {
	const description = `Only files owned by SFAIO task ${agentId}`

	return groups.map((group): GroupEntry => {
		if (group === "edit") {
			return ["edit", { fileRegex, description }]
		}

		if (Array.isArray(group) && group[0] === "edit") {
			return ["edit", { ...group[1], fileRegex, description }]
		}

		return group
	})
}

/**
 * Builds a regex string that matches the exact paths allowed for the agent.
 */
export function buildOwnershipRegex(allowedFiles: string[]): string {
	if (!allowedFiles || allowedFiles.length === 0) {
		return "(?!.*)" // Matches nothing safely
	}

	// Normalize path separators to forward slashes, then escape regex special characters
	const escapedPaths = allowedFiles.map((path) => path.replace(/\\/g, "/").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
	return `^(${escapedPaths.join("|")})$`
}

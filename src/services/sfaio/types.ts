export interface SfaioAutoApproval {
	/** Auto-approve edits. Ownership is still enforced by fileRegex. */
	write: boolean
	/** Commands matching any of these prefixes are auto-approved. */
	allowedCommandPrefixes: string[]
	/** Auto-approve MCP tool calls. */
	mcp: boolean
	/** Auto-approve read operations. */
	read: boolean
}

export const DEFAULT_AGENT_AUTO_APPROVAL: SfaioAutoApproval = {
	write: true,
	read: true,
	mcp: true,
	allowedCommandPrefixes: ["sf ", "sfdx ", "npm run lint", "git status", "git diff"],
}

import { ClineAsk } from "@siid-code/types"
import { SfaioAutoApproval } from "../types"

export class SfaioEscalationRequired extends Error {
	constructor(public readonly reason: string) {
		super(reason)
		this.name = "SfaioEscalationRequired"
	}
}

export function evaluateSfaioApproval(
	policy: SfaioAutoApproval,
	toolName: ClineAsk | string,
	toolParams?: string,
): { approved: boolean; reason?: string } {
	switch (toolName) {
		case "read_file":
		case "list_files":
		case "search_files":
		case "read_url":
			return policy.read
				? { approved: true }
				: { approved: false, reason: "Read operations are not auto-approved by policy." }

		case "write_to_file":
		case "apply_diff":
			return policy.write
				? { approved: true }
				: { approved: false, reason: "Write operations are not auto-approved by policy." }

		case "command": {
			if (!toolParams) {
				return { approved: false, reason: "Command execution requires parameters." }
			}
			const cmd = toolParams.trim()
			const isAllowed = policy.allowedCommandPrefixes.some((prefix) => cmd.startsWith(prefix))
			return isAllowed
				? { approved: true }
				: {
						approved: false,
						reason: `Command '${cmd}' is not in the allowed prefixes list.`,
					}
		}

		case "use_mcp_server":
		case "access_mcp_resource":
			return policy.mcp
				? { approved: true }
				: { approved: false, reason: "MCP operations are not auto-approved by policy." }

		case "browser_action_launch":
		case "browser_action":
			return { approved: false, reason: "Browser actions are not permitted for background agents." }

		case "tool":
			return { approved: false, reason: "Generic tool approval must be evaluated explicitly." }

		default:
			// For specific tool names like 'sfDeployMetadataTool' which are treated as "tool" requests
			return { approved: false, reason: `Unrecognized tool request '${toolName}'.` }
	}
}

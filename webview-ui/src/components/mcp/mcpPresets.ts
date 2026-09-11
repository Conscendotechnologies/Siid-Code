export type McpPresetCredential = {
	key: string
	label: string
	placeholder?: string
}

export type McpPreset = {
	id: string
	label: string
	description: string
	name: string
	config: Record<string, any>
	testable?: boolean
	credentials?: McpPresetCredential[]
	// If true, the "Detect" button appears alongside credential inputs and prefills
	// them from the same testMcpPreset call (mode=detect).
	detectable?: boolean
}

// Salesforce official MCP server (@salesforce/mcp). Env values are placeholders;
// the file opens after install so the user can fill them in.
// ponytail: single hardcoded preset list, promote to JSON registry if we add many more.
export const MCP_PRESETS: McpPreset[] = [
	{
		id: "salesforce",
		label: "Salesforce (official)",
		description:
			"Salesforce DX MCP server via npx. Uses your default `sf` org — run `sf org login web` first, then use Test connection to verify.",
		name: "salesforce",
		config: {
			command: "npx",
			args: ["-y", "@salesforce/mcp", "--orgs", "DEFAULT_TARGET_ORG", "--toolsets", "all"],
			alwaysAllow: [],
			disabled: false,
		},
		testable: true,
		detectable: true,
		credentials: [
			{ key: "username", label: "Username", placeholder: "user@example.com" },
			{ key: "instanceUrl", label: "Instance URL", placeholder: "https://your-domain.my.salesforce.com" },
		],
	},
	{
		id: "memory",
		label: "Memory (official)",
		description:
			"Knowledge-graph memory server (@modelcontextprotocol/server-memory). Persists entities/relations across sessions. Runs via npx, no setup.",
		name: "memory",
		config: {
			command: "npx",
			args: ["-y", "@modelcontextprotocol/server-memory"],
			alwaysAllow: [],
			disabled: false,
		},
		testable: true,
	},
	{
		id: "fetch",
		label: "Fetch (official)",
		description:
			"Web content fetch server (mcp-server-fetch). Retrieves URLs and converts HTML to markdown. Requires Python + `uvx` on PATH.",
		name: "fetch",
		config: {
			command: "uvx",
			args: ["mcp-server-fetch"],
			alwaysAllow: [],
			disabled: false,
		},
		testable: true,
	},
	{
		id: "atlassian",
		label: "Atlassian (official, remote)",
		description:
			"Atlassian Rovo MCP server (Jira + Confluence Cloud), via the official `mcp-remote` proxy. The proxy handles the OAuth 2.1 browser login itself (opens on first connect) and speaks stdio to us — no direct streamable-http/OAuth support needed on our side. Requires Node.js v18+.",
		name: "atlassian",
		config: {
			command: "npx",
			args: ["-y", "mcp-remote@latest", "https://mcp.atlassian.com/v1/mcp/authv2"],
			alwaysAllow: [],
			disabled: false,
		},
	},
]

import type { ClineMessage, HistoryItem } from "@siid-code/types"

/** 1_000_000 -> "1M", 200_000 -> "200K", 1_048_576 -> "1M". */
export function formatContextWindow(tokens?: number): string | undefined {
	if (!tokens || tokens <= 0) {
		return undefined
	}
	if (tokens >= 1_000_000) {
		return `${Number((tokens / 1_000_000).toFixed(1))}M`
	}
	if (tokens >= 1_000) {
		return `${Math.round(tokens / 1_000)}K`
	}
	return String(tokens)
}

/** Id of the portal container in AgentsView that menus and pickers render into. */
export const AGENTS_PORTAL_ID = "agents-portal"

export function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * Builds the "Medium · Context 1M" summary from real values only. Returns undefined when
 * neither value is available so the chip can be hidden.
 */
export function buildModelDetail(opts: {
	reasoningEffort?: string
	reasoningEnabled?: boolean
	contextWindow?: number
	contextLabel: string
}): string | undefined {
	const parts: string[] = []
	if (opts.reasoningEffort && opts.reasoningEnabled !== false) {
		parts.push(capitalize(opts.reasoningEffort))
	}
	const ctx = formatContextWindow(opts.contextWindow)
	if (ctx) {
		parts.push(`${opts.contextLabel} ${ctx}`)
	}
	return parts.length > 0 ? parts.join(" · ") : undefined
}

export function basename(p?: string): string {
	if (!p) {
		return ""
	}
	const parts = p.replace(/[\\/]+$/, "").split(/[\\/]/)
	return parts[parts.length - 1] ?? ""
}

export function filterSessions(
	history: HistoryItem[],
	opts: { query: string; workspaceOnly: boolean; cwd?: string },
): HistoryItem[] {
	const q = opts.query.trim().toLowerCase()
	return history
		.filter((item) => item.task && item.task.trim().length > 0)
		.filter((item) => !opts.workspaceOnly || !opts.cwd || item.workspace === opts.cwd)
		.filter((item) => !q || item.task.toLowerCase().includes(q))
		.sort((a, b) => b.ts - a.ts)
}

/**
 * True while the agent is working: the last message is still streaming, or the latest
 * api_req_started has not reported a cost yet (same signal ChatView uses for its stop button).
 */
export function isTaskRunning(messages?: ClineMessage[]): boolean {
	if (!messages || messages.length === 0) {
		return false
	}
	if (messages[messages.length - 1].partial === true) {
		return true
	}
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].say === "api_req_started") {
			try {
				return JSON.parse(messages[i].text ?? "{}").cost === undefined
			} catch {
				return false
			}
		}
	}
	return false
}

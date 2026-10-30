import type { HistoryItem } from "@siid-code/types"

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

export function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1)
}

/**
 * Builds the "Medium · Max 1M" summary from real values only. Returns undefined when
 * neither value is available so the chip can be hidden.
 */
export function buildModelDetail(opts: {
	reasoningEffort?: string
	reasoningEnabled?: boolean
	contextWindow?: number
	maxLabel: string
}): string | undefined {
	const parts: string[] = []
	if (opts.reasoningEffort && opts.reasoningEnabled !== false) {
		parts.push(capitalize(opts.reasoningEffort))
	}
	const ctx = formatContextWindow(opts.contextWindow)
	if (ctx) {
		parts.push(`${opts.maxLabel} ${ctx}`)
	}
	return parts.length > 0 ? parts.join(" · ") : undefined
}

export function providerLabel(provider?: string): string | undefined {
	if (!provider) {
		return undefined
	}
	return provider
		.split(/[-_]/)
		.map((p) => capitalize(p))
		.join(" ")
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
		.filter((item) => !opts.workspaceOnly || !opts.cwd || !item.workspace || item.workspace === opts.cwd)
		.filter((item) => !q || item.task.toLowerCase().includes(q))
		.sort((a, b) => b.ts - a.ts)
}

import * as vscode from "vscode"

/**
 * Leaf module (must not import ClineProvider or agentsPanel, to avoid an import cycle).
 * Tracks whether the Agents panel is open so file editors can be routed to the group
 * beside it instead of covering it.
 */
let agentsPanelOpen = false
let agentsPanelRef: vscode.WebviewPanel | undefined
let layoutPromise: Promise<void> | undefined

export function setAgentsPanelOpen(open: boolean): void {
	agentsPanelOpen = open
	if (!open) {
		agentsPanelRef = undefined
	}
	// Re-arm the one-time 62/38 split for the next time the panel opens.
	layoutPromise = undefined
}

export function isAgentsPanelOpen(): boolean {
	return agentsPanelOpen
}

/** Registers the Agents WebviewPanel so routing code can reveal it without importing agentsPanel. */
export function setAgentsPanelRef(panel: vscode.WebviewPanel | undefined): void {
	agentsPanelRef = panel
}

/**
 * Reveals the Agents panel in its current column without taking focus. Returns true when the panel is open.
 * Used by routing code (getInstance, handleTask) so it never falls back to focusing the sidebar.
 */
export function revealAgentsPanel(preserveFocus = true): boolean {
	if (!agentsPanelOpen || !agentsPanelRef) {
		return false
	}
	try {
		agentsPanelRef.reveal(agentsPanelRef.viewColumn, preserveFocus)
	} catch {
		// disposed between check and reveal
	}
	return true
}

/** ViewColumn.Two while the Agents panel is open, otherwise the caller's existing column (may be undefined). */
export function getEditorColumn(existing?: vscode.ViewColumn): vscode.ViewColumn | undefined {
	if (!agentsPanelOpen) {
		return existing
	}
	void prepareEditorColumn()
	return vscode.ViewColumn.Two
}

/** Returns options unchanged unless the Agents panel is open, in which case viewColumn is set to Two. */
export function withEditorColumn<T extends object>(options: T): T & { viewColumn?: vscode.ViewColumn } {
	if (!agentsPanelOpen) {
		return options
	}
	// Fire-and-forget; async openers should `await prepareEditorColumn()` first so the split exists before opening.
	void prepareEditorColumn()
	return { ...options, viewColumn: vscode.ViewColumn.Two }
}

/**
 * While the Agents panel is open and only one editor group exists, lays the editor area out as a
 * 62/38 split so the group opened for Two is narrower than the panel. Runs at most once per panel
 * lifetime; concurrent callers share the same promise. No-op when the panel is closed.
 */
export function prepareEditorColumn(): Promise<void> {
	if (!agentsPanelOpen) {
		return Promise.resolve()
	}
	if (!layoutPromise) {
		layoutPromise = (async () => {
			try {
				if (vscode.window.tabGroups.all.length <= 1) {
					await vscode.commands.executeCommand("vscode.setEditorLayout", {
						orientation: 0,
						groups: [{ size: 0.62 }, { size: 0.38 }],
					})
				}
			} catch {
				// layout is cosmetic; never block opening a file
			}
		})()
	}
	return layoutPromise
}

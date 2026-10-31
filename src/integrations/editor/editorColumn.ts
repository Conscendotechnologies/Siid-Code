import * as vscode from "vscode"

/**
 * Leaf module (must not import ClineProvider or agentsPanel, to avoid an import cycle).
 * Tracks whether the Agents panel is open so file editors can be routed to the group
 * beside it instead of covering it.
 */
let agentsPanelOpen = false

export function setAgentsPanelOpen(open: boolean): void {
	agentsPanelOpen = open
}

export function isAgentsPanelOpen(): boolean {
	return agentsPanelOpen
}

/** ViewColumn.Two while the Agents panel is open, otherwise the caller's existing column (may be undefined). */
export function getEditorColumn(existing?: vscode.ViewColumn): vscode.ViewColumn | undefined {
	return agentsPanelOpen ? vscode.ViewColumn.Two : existing
}

/** Returns options unchanged unless the Agents panel is open, in which case viewColumn is set to Two. */
export function withEditorColumn<T extends object>(options: T): T & { viewColumn?: vscode.ViewColumn } {
	return agentsPanelOpen ? { ...options, viewColumn: vscode.ViewColumn.Two } : options
}

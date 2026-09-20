import * as vscode from "vscode"

/**
 * Validates that the VS Code environment meets the prerequisites for SFAIO.
 */
export async function runPreflightChecks(): Promise<void> {
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		throw new Error("SFAIO requires an active workspace folder.")
	}
}

/**
 * Returns the primary workspace folder for SFAIO operations.
 */
export function getPrimaryWorkspace(): vscode.WorkspaceFolder {
	const folders = vscode.workspace.workspaceFolders
	if (!folders || folders.length === 0) {
		throw new Error("SFAIO requires an active workspace folder.")
	}
	return folders[0]
}

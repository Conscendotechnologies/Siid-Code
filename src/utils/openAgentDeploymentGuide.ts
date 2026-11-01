import * as vscode from "vscode"
import path from "path"
import { isAgentsPanelOpen, prepareEditorColumn, withEditorColumn } from "../integrations/editor/editorColumn"

/**
 * Opens the Agent Deployment Guide in markdown preview mode
 * @param context - VSCode Extension Context
 * @returns Promise that resolves when the file is opened
 * @throws Error if the file is not found or cannot be opened
 */
export async function openAgentDeploymentGuide(context: vscode.ExtensionContext): Promise<void> {
	// Get the file path from global storage
	const globalFsPath = context.globalStorageUri.fsPath
	const filePath = path.join(
		globalFsPath,
		"instructions",
		"modes",
		"Salesforce_Agent",
		"agent-deployment-external-sites.md",
	)
	const fileUri = vscode.Uri.file(filePath)

	// Check if file exists
	try {
		await vscode.workspace.fs.stat(fileUri)
	} catch (error) {
		throw new Error(
			`Agent deployment guide file not found at: ${filePath}. ` +
				`Please ensure the extension has initialized properly and the bundled instructions have been copied to global storage.`,
		)
	}

	// Open in markdown preview mode
	if (isAgentsPanelOpen()) {
		// "ToSide" is relative to the focused group and would create a third group next to the Agents panel:
		// focus group Two, then preview in place there.
		await prepareEditorColumn()
		await vscode.window.showTextDocument(fileUri, withEditorColumn({ preview: true }))
		await vscode.commands.executeCommand("markdown.showPreview", fileUri)
		return
	}
	await vscode.commands.executeCommand("markdown.showPreviewToSide", fileUri)
}

import * as vscode from "vscode"
import { exec } from "child_process"
import { promisify } from "util"
import * as fs from "fs/promises"
import * as path from "path"

const execAsync = promisify(exec)

/**
 * Validates that the VS Code environment meets the prerequisites for SFAIO.
 */
export async function runPreflightChecks(): Promise<void> {
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		throw new Error("SFAIO requires an active workspace folder.")
	}

	if (vscode.workspace.workspaceFolders.length > 1) {
		throw new Error(
			"SFAIO currently does not support multi-root workspaces. Please open a single Salesforce project folder.",
		)
	}

	const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath

	// Writability check
	const forceAppPath = path.join(workspaceRoot, "force-app")
	try {
		await fs.access(forceAppPath, fs.constants.W_OK)
	} catch {
		throw new Error(`SFAIO requires write access to the force-app directory. Could not access: ${forceAppPath}`)
	}

	// Salesforce CLI checks
	try {
		const { stdout } = await execAsync("sf org display --json", { cwd: workspaceRoot })
		const result = JSON.parse(stdout)

		if (result.status !== 0 || !result.result) {
			throw new Error("Salesforce CLI returned an error or no result.")
		}

		// Production org guard
		if (
			result.result.isSandbox === false &&
			result.result.isScratch === false &&
			result.result.isDevHub === false
		) {
			// Some orgs may not have these fields or they might be explicitly false.
			// Let's just rely on isSandbox explicitly.
			if (result.result.isSandbox === false) {
				throw new Error(
					"SFAIO cannot run against a production org. Please authenticate with a sandbox or scratch org.",
				)
			}
		}
	} catch (error: any) {
		if (error.message && error.message.includes("SFAIO cannot run against a production org")) {
			throw error
		}
		throw new Error(
			`SFAIO Salesforce CLI preflight check failed. Please ensure 'sf' is installed and you are authenticated to an org.\nDetails: ${error.message}`,
		)
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
	if (folders.length > 1) {
		throw new Error(
			"SFAIO currently does not support multi-root workspaces. Please open a single Salesforce project folder.",
		)
	}
	return folders[0]
}

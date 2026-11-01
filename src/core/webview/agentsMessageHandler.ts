import * as vscode from "vscode"
import * as path from "path"
import { execFile } from "child_process"

import type { ClineProvider } from "./ClineProvider"
import type { WebviewMessage } from "../../shared/WebviewMessage"
import { isAgentsPanelOpen, prepareEditorColumn, withEditorColumn } from "../../integrations/editor/editorColumn"

export type AgentsChangeStatus = "M" | "A" | "D" | "R" | "U" | "?"

export interface AgentsChange {
	/** Path relative to the workspace root, forward slashes. */
	path: string
	absPath: string
	status: AgentsChangeStatus
}

export interface AgentsDirEntry {
	name: string
	path: string
	isDirectory: boolean
}

/** Parses `git status --porcelain=v1 -z` output. */
export function parsePorcelainStatus(output: string, root: string): AgentsChange[] {
	const parts = output.split("\u0000").filter((p) => p.length > 0)
	const changes: AgentsChange[] = []
	for (let i = 0; i < parts.length; i++) {
		const entry = parts[i]
		if (entry.length < 4) {
			continue
		}
		const x = entry[0]
		const y = entry[1]
		const rel = entry.slice(3)
		let status: AgentsChangeStatus
		if (x === "?" && y === "?") {
			status = "?"
		} else if (x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D")) {
			status = "U"
		} else if (x === "R" || x === "C") {
			status = "R"
			i++ // the original path follows as its own NUL-terminated field
		} else if (x === "D" || y === "D") {
			status = "D"
		} else if (x === "A") {
			status = "A"
		} else {
			status = "M"
		}
		changes.push({ path: rel, absPath: path.join(root, rel), status })
	}
	return changes
}

function getRoot(provider: ClineProvider): string | undefined {
	// Same root the workspace chip shows; falls back to the first folder when cwd is unavailable.
	return provider.cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
}

/** Result of `git status`: either the raw output, or a marker that the root is not a git repository. */
export type GitStatusResult = { output: string } | { notRepo: true }

/** Opens a file in the editor group beside the Agents panel (Beside only when the panel is closed). */
async function showBeside(uri: vscode.Uri, preserveFocus?: boolean) {
	await prepareEditorColumn()
	const options = withEditorColumn({ viewColumn: vscode.ViewColumn.Beside, preview: true, preserveFocus })
	return vscode.window.showTextDocument(uri, options)
}

/** True when `target` is the workspace root or inside it. */
export function isInsideRoot(root: string, target: string): boolean {
	const rel = path.relative(root, target)
	return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))
}

async function listDir(provider: ClineProvider, root: string, dir: string) {
	const abs = dir ? path.resolve(dir) : root
	if (!isInsideRoot(root, abs)) {
		return
	}
	let entries: AgentsDirEntry[] = []
	try {
		const raw = await vscode.workspace.fs.readDirectory(vscode.Uri.file(abs))
		entries = raw
			.filter(([name]) => name !== ".git")
			.map(([name, type]) => ({
				name,
				path: path.join(abs, name),
				isDirectory: (type & vscode.FileType.Directory) !== 0,
			}))
			.sort((a, b) => (a.isDirectory === b.isDirectory ? a.name.localeCompare(b.name) : a.isDirectory ? -1 : 1))
	} catch {
		// unreadable directory: report as empty
	}
	await provider.postMessageToWebview({
		type: "agentsDirListing",
		payload: { path: abs, root: abs === root ? { name: path.basename(root), path: root } : undefined, entries },
	})
}

export function gitStatus(root: string): Promise<GitStatusResult> {
	return new Promise((resolve, reject) => {
		execFile(
			"git",
			["status", "--porcelain=v1", "-z", "--untracked-files=normal"],
			{ cwd: root, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
			(err, stdout, stderr) => {
				if (!err) {
					return resolve({ output: stdout })
				}
				if (/not a git repository/i.test(String(stderr ?? "")) || /not a git repository/i.test(err.message)) {
					return resolve({ notRepo: true })
				}
				reject(err)
			},
		)
	})
}

export async function handleAgentsMessage(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	const root = getRoot(provider)

	switch (message.type) {
		case "agentsListDir":
			if (root) {
				await listDir(provider, root, message.text ?? "")
			} else {
				await provider.postMessageToWebview({ type: "agentsDirListing", payload: { path: "", entries: [] } })
			}
			break
		case "agentsOpenFile": {
			if (!root || !message.text || !isInsideRoot(root, path.resolve(message.text))) {
				break
			}
			try {
				await showBeside(vscode.Uri.file(message.text))
			} catch (error) {
				vscode.window.showWarningMessage(error instanceof Error ? error.message : String(error))
			}
			break
		}
		case "agentsGetChanges": {
			if (!root) {
				await provider.postMessageToWebview({ type: "agentsChanges", payload: { changes: [] } })
				break
			}
			try {
				const result = await gitStatus(root)
				if ("notRepo" in result) {
					await provider.postMessageToWebview({
						type: "agentsChanges",
						payload: { changes: [], notRepo: true },
					})
					break
				}
				await provider.postMessageToWebview({
					type: "agentsChanges",
					payload: { changes: parsePorcelainStatus(result.output, root) },
				})
			} catch (error) {
				await provider.postMessageToWebview({
					type: "agentsChanges",
					payload: { changes: [], error: error instanceof Error ? error.message : String(error) },
				})
			}
			break
		}
		case "agentsOpenDiff": {
			if (!root || !message.text || !isInsideRoot(root, path.resolve(message.text))) {
				break
			}
			const uri = vscode.Uri.file(message.text)
			try {
				// git.openChange takes no group: it opens in the active one. Make group Two active first
				// (showing the file there with focus) so the diff never covers the Agents panel.
				if (isAgentsPanelOpen()) {
					await showBeside(uri, false)
				}
				await vscode.commands.executeCommand("git.openChange", uri)
			} catch {
				await showBeside(uri)
			}
			break
		}
	}
}

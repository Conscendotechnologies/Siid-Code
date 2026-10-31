import * as vscode from "vscode"

import { ContextProxy } from "../config/ContextProxy"
import { MdmService } from "../../services/mdm/MdmService"
import { ClineProvider } from "./ClineProvider"
import { setAgentsPanelOpen } from "../../integrations/editor/editorColumn"

let agentsPanel: vscode.WebviewPanel | undefined
let agentsProvider: ClineProvider | undefined
let closing = false

export const AGENTS_PANEL_TITLE = "SIID"

/** Opens (or reveals) the singleton Agents webview panel in the first editor column. */
export async function openAgentsView(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
	if (agentsPanel) {
		agentsPanel.reveal(vscode.ViewColumn.One)
		return agentsProvider
	}

	const contextProxy = await ContextProxy.getInstance(context)
	let mdmService: MdmService | undefined
	try {
		mdmService = MdmService.getInstance()
	} catch {
		mdmService = undefined
	}

	const provider = new ClineProvider(context, outputChannel, "agents", contextProxy, mdmService)
	const panel = vscode.window.createWebviewPanel(
		ClineProvider.tabPanelId,
		AGENTS_PANEL_TITLE,
		vscode.ViewColumn.One,
		{ enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [context.extensionUri] },
	)
	agentsPanel = panel
	agentsProvider = provider
	setAgentsPanelOpen(true)

	panel.iconPath = {
		light: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "panel_light.png"),
		dark: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "panel_dark.png"),
	}

	await provider.resolveWebviewView(panel)

	panel.onDidChangeViewState(
		(e) => {
			if (e.webviewPanel.visible) {
				e.webviewPanel.webview.postMessage({ type: "action", action: "didBecomeVisible" })
			}
		},
		null,
		context.subscriptions,
	)

	panel.onDidDispose(
		async () => {
			const closedByCommand = closing
			agentsPanel = undefined
			agentsProvider = undefined
			setAgentsPanelOpen(false)
			if (closedByCommand) {
				return
			}
			// Closed by the user: leave the host's agents mode. The command only exists in the
			// Siid editor fork, so a missing command on stock VS Code is expected.
			closing = true
			try {
				await vscode.commands.executeCommand("workbench.action.exitAgentsMode")
			} catch {
				// not available on stock VS Code
			} finally {
				closing = false
			}
		},
		null,
		context.subscriptions,
	)

	return provider
}

/** Disposes the Agents panel if open; no-op otherwise. */
export function closeAgentsView() {
	if (!agentsPanel || closing) {
		return
	}
	closing = true
	try {
		agentsPanel.dispose()
	} finally {
		closing = false
	}
}

export function isAgentsViewOpen() {
	return agentsPanel !== undefined
}

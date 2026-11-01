import * as vscode from "vscode"

import { ContextProxy } from "../config/ContextProxy"
import { MdmService } from "../../services/mdm/MdmService"
import { Package } from "../../shared/package"
import { ClineProvider } from "./ClineProvider"
import { setAgentsPanelOpen, setAgentsPanelRef } from "../../integrations/editor/editorColumn"

let agentsPanel: vscode.WebviewPanel | undefined
let agentsProvider: ClineProvider | undefined
let closing = false

export const AGENTS_PANEL_TITLE = "SIID"

/** Own viewType (not ClineProvider.tabPanelId) so the serializer below only ever sees Agents panels. */
export const AGENTS_PANEL_VIEW_TYPE = `${Package.name}.AgentsPanel`

/**
 * After a window reload VS Code restores the panel's tab, but the webview has no provider behind it and
 * stays blank. Dispose it instead; the user reopens Agents through the normal command.
 */
export function registerAgentsPanelSerializer(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.window.registerWebviewPanelSerializer(AGENTS_PANEL_VIEW_TYPE, {
			async deserializeWebviewPanel(panel: vscode.WebviewPanel) {
				panel.dispose()
			},
		}),
	)
}

/** Opens (or reveals) the singleton Agents webview panel in the first editor column. */
export async function openAgentsView(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
	if (agentsPanel) {
		agentsPanel.reveal(agentsPanel.viewColumn ?? vscode.ViewColumn.One)
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
	const panel = vscode.window.createWebviewPanel(AGENTS_PANEL_VIEW_TYPE, AGENTS_PANEL_TITLE, vscode.ViewColumn.One, {
		enableScripts: true,
		retainContextWhenHidden: true,
		localResourceRoots: [context.extensionUri],
	})
	agentsPanel = panel
	agentsProvider = provider
	setAgentsPanelOpen(true)
	setAgentsPanelRef(panel)

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

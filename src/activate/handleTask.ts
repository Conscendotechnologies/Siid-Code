import * as vscode from "vscode"

import { Package } from "../shared/package"
import { ClineProvider } from "../core/webview/ClineProvider"
import { t } from "../i18n"
import { isAgentsPanelOpen, revealAgentsPanel } from "../integrations/editor/editorColumn"

export const handleNewTask = async (params: { prompt?: string } | null | undefined) => {
	let prompt = params?.prompt

	if (!prompt) {
		// Agents panel open: never open the sidebar; just bring the panel back without taking focus.
		if (isAgentsPanelOpen()) {
			revealAgentsPanel(true)
			return
		}
		prompt = await vscode.window.showInputBox({
			prompt: t("common:input.task_prompt"),
			placeHolder: t("common:input.task_placeholder"),
		})
	}

	if (!prompt) {
		await vscode.commands.executeCommand(`${Package.name}.SidebarProvider.focus`)
		return
	}

	await ClineProvider.handleCodeAction("newTask", "NEW_TASK", { userInput: prompt })
}

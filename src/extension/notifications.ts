import * as vscode from "vscode"
import { Package } from "../shared/package"

let notifier: any
try {
	// dynamic require so build/bundlers won't choke if not installed in other packages
	notifier = require("node-notifier")
} catch (e) {
	notifier = undefined
}

export async function sendOsNotification(title: string, message: string) {
	const config = vscode.workspace.getConfiguration(Package.name)
	const useOs = config.get<boolean>("notifications.useOs", true)
	const silent = config.get<boolean>("notifications.silent", false)

	if (useOs && notifier) {
		try {
			// node-notifier accepts title/message; sound controls audible alert on Windows
			notifier.notify({ title, message, sound: !silent, wait: false })
			return
		} catch (err) {
			console.error("sendOsNotification: node-notifier failed", err)
		}
	}

	// Fallback to VS Code in-app notification
	try {
		vscode.window.showInformationMessage(`${title}: ${message}`)
	} catch (err) {
		console.error("sendOsNotification fallback failed", err)
	}
}

export default sendOsNotification

import { vscode } from "./vscode"

declare global {
	interface Window {
		IMAGES_BASE_URI: string
	}
}

// Check if the browser supports notifications
const isNotificationSupported = "Notification" in window

// Request notification permission
export async function requestNotificationPermission() {
	if (!isNotificationSupported) {
		return false
	}

	if (Notification.permission === "granted") {
		return true
	}

	if (Notification.permission !== "denied") {
		const permission = await Notification.requestPermission()
		return permission === "granted"
	}

	return false
}

// Show a notification
export function showNotification(title: string, options?: NotificationOptions) {
	if (!isNotificationSupported) {
		// Fallback to VS Code notifications using a native VS Code message
		vscode.postMessage({
			type: "executeCommand",
			commands: ["workbench.action.focusActiveEditorGroup"],
			text: `${title}: ${options?.body || ""}`,
		})
		return
	}

	// If we have permission, show the notification
	if (Notification.permission === "granted") {
		const notification = new Notification(title, {
			icon: options?.icon || `${window.IMAGES_BASE_URI}/roo-code-icon.png`,
			...options,
		})

		// Handle notification click
		notification.onclick = () => {
			// Switch to chat view and focus VS Code window
			vscode.postMessage({
				type: "executeCommand",
				commands: ["workbench.action.focusActiveEditorGroup"],
			})
		}
	}
}

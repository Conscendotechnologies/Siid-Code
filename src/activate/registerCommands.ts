import * as vscode from "vscode"
import delay from "delay"

import type { CommandId } from "@siid-code/types"
import { TelemetryService } from "@siid-code/telemetry"

import { Package } from "../shared/package"
import { getCommand } from "../utils/commands"
import { ClineProvider } from "../core/webview/ClineProvider"
import { ContextProxy } from "../core/config/ContextProxy"
import { focusPanel } from "../utils/focusPanel"

import { registerHumanRelayCallback, unregisterHumanRelayCallback, handleHumanRelayResponse } from "./humanRelay"
import { handleNewTask } from "./handleTask"
import { CodeIndexManager } from "../services/code-index/manager"
import { importSettingsWithFeedback } from "../core/config/importExport"
import { MdmService } from "../services/mdm/MdmService"
import { t } from "../i18n"

/**
 * Helper to get the visible ClineProvider instance or log if not found.
 */
export function getVisibleProviderOrLog(outputChannel: vscode.OutputChannel): ClineProvider | undefined {
	const visibleProvider = ClineProvider.getVisibleInstance()
	if (!visibleProvider) {
		outputChannel.appendLine("Cannot find any visible Roo Code instances.")
		return undefined
	}
	return visibleProvider
}

// Store panel references in both modes
let sidebarPanel: vscode.WebviewView | undefined = undefined
let tabPanel: vscode.WebviewPanel | undefined = undefined

/**
 * Get the currently active panel
 * @returns WebviewPanel或WebviewView
 */
export function getPanel(): vscode.WebviewPanel | vscode.WebviewView | undefined {
	return tabPanel || sidebarPanel
}

/**
 * Set panel references
 */
export function setPanel(
	newPanel: vscode.WebviewPanel | vscode.WebviewView | undefined,
	type: "sidebar" | "tab",
): void {
	if (type === "sidebar") {
		sidebarPanel = newPanel as vscode.WebviewView
		tabPanel = undefined
	} else {
		tabPanel = newPanel as vscode.WebviewPanel
		sidebarPanel = undefined
	}
}

export type RegisterCommandOptions = {
	context: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel
	provider: ClineProvider
}

export const registerCommands = (options: RegisterCommandOptions) => {
	const { context } = options

	for (const [id, callback] of Object.entries(getCommandsMap(options))) {
		const command = getCommand(id as CommandId)
		context.subscriptions.push(vscode.commands.registerCommand(command, callback))
	}
}

const getCommandsMap = ({ context, outputChannel, provider }: RegisterCommandOptions): Record<CommandId, any> => ({
	activationCompleted: () => {},
	plusButtonClicked: async () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("plus")

		await visibleProvider.removeClineFromStack()
		await visibleProvider.postStateToWebview()
		await visibleProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		// Send focusInput action immediately after chatButtonClicked
		// This ensures the focus happens after the view has switched
		await visibleProvider.postMessageToWebview({ type: "action", action: "focusInput" })
	},
	mcpButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("mcp")

		visibleProvider.postMessageToWebview({ type: "action", action: "mcpButtonClicked" })
	},
	promptsButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("prompts")

		visibleProvider.postMessageToWebview({ type: "action", action: "promptsButtonClicked" })
	},
	popoutButtonClicked: () => {
		TelemetryService.instance.captureTitleButtonClicked("popout")

		return openClineInNewTab({ context, outputChannel })
	},
	openInNewTab: () => openClineInNewTab({ context, outputChannel }),
	settingsButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("settings")

		visibleProvider.postMessageToWebview({ type: "action", action: "settingsButtonClicked" })
		// Also explicitly post the visibility message to trigger scroll reliably
		visibleProvider.postMessageToWebview({ type: "action", action: "didBecomeVisible" })
	},
	historyButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("history")

		visibleProvider.postMessageToWebview({ type: "action", action: "historyButtonClicked" })
	},
	showHumanRelayDialog: (params: { requestId: string; promptText: string }) => {
		const panel = getPanel()

		if (panel) {
			panel?.webview.postMessage({
				type: "showHumanRelayDialog",
				requestId: params.requestId,
				promptText: params.promptText,
			})
		}
	},
	registerHumanRelayCallback: registerHumanRelayCallback,
	unregisterHumanRelayCallback: unregisterHumanRelayCallback,
	handleHumanRelayResponse: handleHumanRelayResponse,
	newTask: handleNewTask,
	setCustomStoragePath: async () => {
		const { promptForCustomStoragePath } = await import("../utils/storage")
		await promptForCustomStoragePath()
	},
	importSettings: async (filePath?: string) => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)
		if (!visibleProvider) {
			return
		}

		await importSettingsWithFeedback(
			{
				providerSettingsManager: visibleProvider.providerSettingsManager,
				contextProxy: visibleProvider.contextProxy,
				customModesManager: visibleProvider.customModesManager,
				provider: visibleProvider,
			},
			filePath,
		)
	},
	focusInput: async () => {
		try {
			await focusPanel(tabPanel, sidebarPanel)

			// Send focus input message only for sidebar panels
			if (sidebarPanel && getPanel() === sidebarPanel) {
				provider.postMessageToWebview({ type: "action", action: "focusInput" })
			}
		} catch (error) {
			outputChannel.appendLine(`Error focusing input: ${error}`)
		}
	},
	focusPanel: async () => {
		try {
			await focusPanel(tabPanel, sidebarPanel)
		} catch (error) {
			outputChannel.appendLine(`Error focusing panel: ${error}`)
		}
	},
	acceptInput: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		visibleProvider.postMessageToWebview({ type: "acceptInput" })
	},
	onFirebaseLogin: async () => {
		// NOTE: This command can be used for development bypass when Firebase Service is not available
		// In production, the actual login handling is done in api.onFirebaseLogin()
		// which is called directly by the Firebase Service extension.
		outputChannel.appendLine("=== DEVELOPMENT BYPASS: Manual Authentication ===")

		try {
			// Prompt user for their OpenRouter API key
			const userApiKey = await vscode.window.showInputBox({
				prompt: "Enter your OpenRouter API key (for development bypass)",
				password: true,
				placeHolder: "sk-or-v1-...",
				ignoreFocusOut: true,
			})

			if (!userApiKey) {
				outputChannel.appendLine("Bypass cancelled - no API key provided")
				vscode.window.showWarningMessage("Bypass cancelled - no API key provided")
				return
			}

			outputChannel.appendLine("API key provided, setting up bypass authentication...")

			// Store in global state for retrieval by ProviderSettingsManager
			await context.globalState.update("devBypassApiKey", userApiKey)
			await context.globalState.update("devBypassActive", true)
			outputChannel.appendLine("API key stored in global state")

			// Update Firebase auth state to authenticated
			provider.setFirebaseAuthState(true)
			outputChannel.appendLine("Firebase auth state set to authenticated")

			// Set useFreeModels preference (false for dev bypass - user has their own API key)
			await provider.contextProxy.setValue("useFreeModels", false)
			outputChannel.appendLine("useFreeModels set to false (using user's own API key)")

			// Update all provider configs with the API key
			// This will call fetchApiKeysFromFirebase which now checks for devBypassApiKey
			await provider.providerSettingsManager.updateApiKeysFromFirebase()
			outputChannel.appendLine("Provider configs updated with API key")

			// Update webview state to show as authenticated
			// Send explicit state message with firebaseIsAuthenticated override
			await provider.postMessageToWebview({
				type: "state",
				state: {
					...(await provider.getStateToPostToWebview()),
					firebaseIsAuthenticated: true, // Force authenticated state for dev bypass
				},
			} as any)
			outputChannel.appendLine("Webview state updated")

			outputChannel.appendLine("✅ Development bypass complete!")
			vscode.window.showInformationMessage("✅ Development mode active! Using provided API key.")
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			outputChannel.appendLine(`❌ Bypass failed: ${errorMsg}`)
			if (error instanceof Error && error.stack) {
				outputChannel.appendLine(`Stack trace: ${error.stack}`)
			}
			vscode.window.showErrorMessage(`Failed to setup development bypass: ${errorMsg}`)
		}
	},
	onFirebaseLogout: async () => {
		// NOTE: This command can be used for development bypass logout
		// In production, the actual logout handling is done in api.onFirebaseLogout()
		// which is called directly by the Firebase Service extension.
		outputChannel.appendLine("=== DEVELOPMENT BYPASS: Manual Logout ===")

		try {
			// Check if dev bypass is active
			const devBypassActive = context.globalState.get<boolean>("devBypassActive")

			if (devBypassActive) {
				outputChannel.appendLine("Clearing dev bypass state...")

				// Clear dev bypass data from global state
				await context.globalState.update("devBypassApiKey", undefined)
				await context.globalState.update("devBypassActive", undefined)
				outputChannel.appendLine("Dev bypass state cleared")

				// Update Firebase auth state to logged out
				provider.setFirebaseAuthState(false)
				outputChannel.appendLine("Firebase auth state set to logged out")

				// Clear useFreeModels preference
				await provider.contextProxy.setValue("useFreeModels", undefined)
				outputChannel.appendLine("useFreeModels cleared")

				// Update webview state
				await provider.postStateToWebview()
				outputChannel.appendLine("Webview state updated")

				outputChannel.appendLine("✅ Development bypass logout complete!")
				vscode.window.showInformationMessage("✅ Logged out from development mode")
			} else {
				outputChannel.appendLine("No active dev bypass session found")
				vscode.window.showInformationMessage("No active dev bypass session to logout from")
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			outputChannel.appendLine(`❌ Logout failed: ${errorMsg}`)
			if (error instanceof Error && error.stack) {
				outputChannel.appendLine(`Stack trace: ${error.stack}`)
			}
			vscode.window.showErrorMessage(`Failed to logout from development bypass: ${errorMsg}`)
		}
	},
	testOpenRouterApiKey: async () => {
		try {
			outputChannel.appendLine("\n=== OpenRouter API Key Generation Test ===")

			// Prompt for provisioning API key
			const provisioningKey = await vscode.window.showInputBox({
				prompt: "Enter your OpenRouter provisioning API key",
				password: true,
				placeHolder: "sk-or-v1-...",
			})

			if (!provisioningKey) {
				outputChannel.appendLine("Test cancelled - no provisioning key provided")
				vscode.window.showWarningMessage("Test cancelled")
				return
			}

			outputChannel.appendLine("Testing OpenRouter API key generation...")
			outputChannel.appendLine(`Provisioning key: ${provisioningKey}`)

			// Import the OpenRouter key service
			const { OpenRouterKeyService } = await import("../services/openrouter/api-key-service")
			const keyService = new OpenRouterKeyService(outputChannel)

			// Set the provisioning key
			keyService.setProvisioningKey(provisioningKey)

			// Create a test API key
			const testEmail = "test@example.com"
			const testUserId = `test-${Date.now()}`
			outputChannel.appendLine(`Creating test key for user: ${testUserId}`)

			const keyParams = {
				name: `test-siid-code-${testEmail}-${Date.now()}`,
				limit: 10, // $10 USD
				limit_reset: "monthly" as const,
				include_byok_in_limit: true,
			}

			outputChannel.appendLine(`Key parameters: ${JSON.stringify(keyParams, null, 2)}`)

			const result = await keyService.createUserApiKey(keyParams)

			outputChannel.appendLine("\n✅ SUCCESS: API key created!")
			outputChannel.appendLine(`Generated API Key: ${result.key}`)
			outputChannel.appendLine(`Key Hash: ${result.data.hash}`)
			outputChannel.appendLine(`Key Name: ${result.data.name}`)
			outputChannel.appendLine(`Limit: $${result.data.limit}`)
			outputChannel.appendLine(`Limit Remaining: $${result.data.limit_remaining}`)
			outputChannel.appendLine(`Limit Reset: ${result.data.limit_reset}`)
			outputChannel.appendLine(`Created At: ${result.data.created_at}`)

			vscode.window.showInformationMessage(
				`✅ OpenRouter API key created successfully! Check output channel for details.`,
			)
		} catch (error) {
			outputChannel.appendLine(`\n❌ ERROR: ${error instanceof Error ? error.message : String(error)}`)
			if (error instanceof Error && error.stack) {
				outputChannel.appendLine(`Stack trace: ${error.stack}`)
			}
			vscode.window.showErrorMessage(
				`Failed to create OpenRouter API key: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	},
	testRetrieveSchema: async () => {
		try {
			outputChannel.appendLine("\n=== Retrieve Schema Tool Test ===")

			// Prompt for component name
			const componentName = await vscode.window.showInputBox({
				prompt: "Enter the component name to retrieve (e.g., Flow, FlowDecision, DeployResult)",
				placeHolder: "Flow",
			})

			if (!componentName) {
				outputChannel.appendLine("Test cancelled - no component name provided")
				vscode.window.showWarningMessage("Test cancelled")
				return
			}

			// Prompt for schema file
			const schemaFile = await vscode.window.showQuickPick(["metadata", "apex", "both"], {
				placeHolder: "Select schema file to search",
			})

			if (!schemaFile) {
				outputChannel.appendLine("Test cancelled - no schema file selected")
				vscode.window.showWarningMessage("Test cancelled")
				return
			}

			outputChannel.appendLine(`Testing retrieve schema for component: ${componentName}`)
			outputChannel.appendLine(`Schema file: ${schemaFile}`)

			// Import necessary functions
			const path = await import("path")
			const fs = await import("fs/promises")
			const { getProjectRooDirectoryForCwd, fileExists } = await import("../services/roo-config")

			// Get current workspace folder
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
			if (!workspaceFolder) {
				throw new Error("No workspace folder found")
			}
			const cwd = workspaceFolder.uri.fsPath

			outputChannel.appendLine(`\nWorkspace: ${cwd}`)

			// Test path resolution
			const fileName = schemaFile === "both" ? "metadata.xml" : `${schemaFile}.xml`

			// Check project-local path
			const projectLocalPath = path.join(getProjectRooDirectoryForCwd(cwd), "rules-flow-builder", fileName)
			const projectExists = await fileExists(projectLocalPath)
			outputChannel.appendLine(`\nProject-local path: ${projectLocalPath}`)
			outputChannel.appendLine(`Project-local exists: ${projectExists}`)

			// Check global storage path using extension context (the one that's actually available)
			const extensionContext = context
			let globalPath: string | null = null
			let globalExists = false

			if (extensionContext) {
				globalPath = path.join(
					extensionContext.globalStorageUri.fsPath,
					"instructions",
					"modes",
					"flow-builder",
					fileName,
				)
				globalExists = await fileExists(globalPath)
				outputChannel.appendLine(`\nGlobal storage path: ${globalPath}`)
				outputChannel.appendLine(`Global storage exists: ${globalExists}`)
				outputChannel.appendLine(
					`Extension context global storage: ${extensionContext.globalStorageUri.fsPath}`,
				)
			}

			// Determine which file to use
			let filePath: string | null = null
			if (projectExists) {
				filePath = projectLocalPath
				outputChannel.appendLine(`\n📁 Using project-local file`)
			} else if (globalExists && globalPath) {
				filePath = globalPath
				outputChannel.appendLine(`\n📁 Using global storage file`)
			} else {
				outputChannel.appendLine(`\n❌ Schema file not found in any location`)
				vscode.window.showErrorMessage("Schema file not found!")
				return
			}

			// Import the searchInSchemaFile function from retrieveSchemaTool
			const { searchInSchemaFile } = await import("../core/tools/retrieveSchemaTool")

			outputChannel.appendLine(
				`\n🔍 Searching for component '${componentName}' using retrieve_schema tool logic...`,
			)

			// Use the actual tool logic to search for the component
			const globalStoragePath = extensionContext.globalStorageUri.fsPath
			const result = await searchInSchemaFile(cwd, componentName, "metadata", globalStoragePath)

			if (result.found && result.definition) {
				outputChannel.appendLine(`\n✅ Component '${componentName}' found in schema!`)
				outputChannel.appendLine(`\nFull definition:\n${result.definition}`)

				if (result.relatedTypes && result.relatedTypes.length > 0) {
					outputChannel.appendLine(`\n📎 Referenced types: ${result.relatedTypes.join(", ")}`)
				}
			} else {
				outputChannel.appendLine(`\n❌ Component '${componentName}' not found in schema`)
			}

			vscode.window.showInformationMessage(`✅ Test completed! Check output channel for details.`)
		} catch (error) {
			outputChannel.appendLine(`\n❌ ERROR: ${error instanceof Error ? error.message : String(error)}`)
			if (error instanceof Error && error.stack) {
				outputChannel.appendLine(`Stack trace: ${error.stack}`)
			}
			vscode.window.showErrorMessage(`Test failed: ${error instanceof Error ? error.message : String(error)}`)
		}
	},
	openChatView: async () => {
		// Open the sidebar view first
		await vscode.commands.executeCommand("workbench.view.extension.siid-code-ActivityBar")

		// Then focus on the chat and trigger new chat
		const visibleProvider = getVisibleProviderOrLog(outputChannel)
		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("openChatView")

		await visibleProvider.removeClineFromStack()
		await visibleProvider.postStateToWebview()
		await visibleProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		await visibleProvider.postMessageToWebview({ type: "action", action: "focusInput" })
	},
})

export const openClineInNewTab = async ({ context, outputChannel }: Omit<RegisterCommandOptions, "provider">) => {
	// (This example uses webviewProvider activation event which is necessary to
	// deserialize cached webview, but since we use retainContextWhenHidden, we
	// don't need to use that event).
	// https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
	const contextProxy = await ContextProxy.getInstance(context)
	const codeIndexManager = CodeIndexManager.getInstance(context)

	// Get the existing MDM service instance to ensure consistent policy enforcement
	let mdmService: MdmService | undefined
	try {
		mdmService = MdmService.getInstance()
	} catch (error) {
		// MDM service not initialized, which is fine - extension can work without it
		mdmService = undefined
	}

	const tabProvider = new ClineProvider(context, outputChannel, "editor", contextProxy, mdmService)
	const lastCol = Math.max(...vscode.window.visibleTextEditors.map((editor) => editor.viewColumn || 0))

	// Check if there are any visible text editors, otherwise open a new group
	// to the right.
	const hasVisibleEditors = vscode.window.visibleTextEditors.length > 0

	if (!hasVisibleEditors) {
		await vscode.commands.executeCommand("workbench.action.newGroupRight")
	}

	const targetCol = hasVisibleEditors ? Math.max(lastCol + 1, 1) : vscode.ViewColumn.Two

	const newPanel = vscode.window.createWebviewPanel(ClineProvider.tabPanelId, "Roo Code", targetCol, {
		enableScripts: true,
		retainContextWhenHidden: true,
		localResourceRoots: [context.extensionUri],
	})

	// Save as tab type panel.
	setPanel(newPanel, "tab")

	// TODO: Use better svg icon with light and dark variants (see
	// https://stackoverflow.com/questions/58365687/vscode-extension-iconpath).
	newPanel.iconPath = {
		light: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "panel_light.png"),
		dark: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "panel_dark.png"),
	}

	await tabProvider.resolveWebviewView(newPanel)

	// Add listener for visibility changes to notify webview
	newPanel.onDidChangeViewState(
		(e) => {
			const panel = e.webviewPanel
			if (panel.visible) {
				panel.webview.postMessage({ type: "action", action: "didBecomeVisible" }) // Use the same message type as in SettingsView.tsx
			}
		},
		null, // First null is for `thisArgs`
		context.subscriptions, // Register listener for disposal
	)

	// Handle panel closing events.
	newPanel.onDidDispose(
		() => {
			setPanel(undefined, "tab")
		},
		null,
		context.subscriptions, // Also register dispose listener
	)

	// Lock the editor group so clicking on files doesn't open them over the panel.
	await delay(100)
	await vscode.commands.executeCommand("workbench.action.lockEditorGroup")

	return tabProvider
}

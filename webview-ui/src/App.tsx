import React, { useCallback, useEffect, useRef, useState } from "react"
import { useEvent } from "react-use"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

console.log("🚀 App.tsx module is loading...")

import { ExtensionMessage } from "@roo/ExtensionMessage"
import TranslationProvider from "./i18n/TranslationContext"

import { vscode } from "./utils/vscode"
import { telemetryClient } from "./utils/TelemetryClient"
import { initializeSourceMaps, exposeSourceMapsForDebugging } from "./utils/sourceMapInitializer"
import { ExtensionStateContextProvider, useExtensionState } from "./context/ExtensionStateContext"
import ChatView, { ChatViewRef } from "./components/chat/ChatView"
import HistoryView from "./components/history/HistoryView"
import SettingsView, { SettingsViewRef } from "./components/settings/SettingsView"
import WelcomeView from "./components/welcome/WelcomeView"
import LoginView from "./components/welcome/LoginView"
import McpView from "./components/mcp/McpView"
import ModesView from "./components/modes/ModesView"
import { HumanRelayDialog } from "./components/human-relay/HumanRelayDialog"
import { DeleteMessageDialog, EditMessageDialog } from "./components/chat/MessageModificationConfirmationDialog"
import ErrorBoundary from "./components/ErrorBoundary"
import { useAddNonInteractiveClickListener } from "./components/ui/hooks/useNonInteractiveClick"
import { TooltipProvider } from "./components/ui/tooltip"
import { STANDARD_TOOLTIP_DELAY } from "./components/ui/standard-tooltip"
import { requestNotificationPermission, showNotification } from "./utils/notifications"

type Tab = "settings" | "history" | "mcp" | "modes" | "chat"

interface HumanRelayDialogState {
	isOpen: boolean
	requestId: string
	promptText: string
}

interface DeleteMessageDialogState {
	isOpen: boolean
	messageTs: number
}

interface EditMessageDialogState {
	isOpen: boolean
	messageTs: number
	text: string
	images?: string[]
}

// Memoize dialog components to prevent unnecessary re-renders
const MemoizedDeleteMessageDialog = React.memo(DeleteMessageDialog)
const MemoizedEditMessageDialog = React.memo(EditMessageDialog)
const MemoizedHumanRelayDialog = React.memo(HumanRelayDialog)

const tabsByMessageAction: Partial<Record<NonNullable<ExtensionMessage["action"]>, Tab>> = {
	chatButtonClicked: "chat",
	settingsButtonClicked: "settings",
	promptsButtonClicked: "modes",
	mcpButtonClicked: "mcp",
	historyButtonClicked: "history",
}

const App = () => {
	console.log("🚀 App component is loading...")

	const {
		didHydrateState,
		showWelcome,
		showLogin,
		shouldShowAnnouncement,
		telemetrySetting,
		telemetryKey,
		machineId,
		renderContext,
		mdmCompliant,
	} = useExtensionState()

	console.log("🚀 App component - useExtensionState called")

	// Create a persistent state manager

	const [showAnnouncement, setShowAnnouncement] = useState(false)
	const [tab, setTab] = useState<Tab>("chat")

	const [humanRelayDialogState, setHumanRelayDialogState] = useState<HumanRelayDialogState>({
		isOpen: false,
		requestId: "",
		promptText: "",
	})

	const [deleteMessageDialogState, setDeleteMessageDialogState] = useState<DeleteMessageDialogState>({
		isOpen: false,
		messageTs: 0,
	})

	const [editMessageDialogState, setEditMessageDialogState] = useState<EditMessageDialogState>({
		isOpen: false,
		messageTs: 0,
		text: "",
		images: [],
	})

	const settingsRef = useRef<SettingsViewRef>(null)
	const chatViewRef = useRef<ChatViewRef>(null)

	const switchTab = useCallback(
		(newTab: Tab) => {
			// Check MDM compliance before allowing tab switching
			if (mdmCompliant === false) {
				return
			}

			setCurrentSection(undefined)

			if (settingsRef.current?.checkUnsaveChanges) {
				settingsRef.current.checkUnsaveChanges(() => setTab(newTab))
			} else {
				setTab(newTab)
			}
		},
		[mdmCompliant],
	)

	const [currentSection, setCurrentSection] = useState<string | undefined>(undefined)

	const handleNotification = useCallback(
		(title: string, text: string) => {
			// Always show OS notification when tab is not visible
			if (!document.hasFocus() || tab !== "chat") {
				showNotification(title, {
					body: text,
					requireInteraction: true, // Keep notification until user dismisses it
					silent: false, // Play a sound
				})
			}
		},
		[tab],
	)

	const onMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data

			// Handle notification message
			if (message.type === "notification" && message.title && message.text) {
				const { title, text } = message
				const suppress = (message as any).suppressInWebview
				const delayMs = (message as any).delayMs || 0

				if (suppress) {
					// When the extension indicates OS notifications are being used,
					// delay the in-webview toast slightly to avoid duplicate popups.
					setTimeout(() => handleNotification(title, text), delayMs)
				} else {
					handleNotification(title, text)
				}
			}

			if (message.type === "action" && message.action) {
				// Handle switchTab action with tab parameter
				if (message.action === "switchTab" && message.tab) {
					const targetTab = message.tab as Tab
					switchTab(targetTab)
					setCurrentSection(undefined)
				} else {
					// Handle other actions using the mapping
					const newTab = tabsByMessageAction[message.action]
					const section = message.values?.section as string | undefined

					if (newTab) {
						switchTab(newTab)
						setCurrentSection(section)
					}
				}
			}

			if (message.type === "showHumanRelayDialog" && message.requestId && message.promptText) {
				const { requestId, promptText } = message
				setHumanRelayDialogState({ isOpen: true, requestId, promptText })
			}

			if (message.type === "showDeleteMessageDialog" && message.messageTs) {
				setDeleteMessageDialogState({ isOpen: true, messageTs: message.messageTs })
			}

			if (message.type === "showEditMessageDialog" && message.messageTs && message.text) {
				setEditMessageDialogState({
					isOpen: true,
					messageTs: message.messageTs,
					text: message.text,
					images: message.images || [],
				})
			}

			if (message.type === "acceptInput") {
				chatViewRef.current?.acceptInput()
			}

			if (message.type === "loginSuccess") {
				// Handle successful login - store login details and update state
				vscode.postMessage({ type: "storeLoginDetails", loginData: message.loginData } as any)
			}
		},
		[switchTab, handleNotification],
	)

	useEvent("message", onMessage)

	useEffect(() => {
		if (shouldShowAnnouncement) {
			setShowAnnouncement(true)
			vscode.postMessage({ type: "didShowAnnouncement" })
		}
	}, [shouldShowAnnouncement])

	useEffect(() => {
		if (didHydrateState) {
			telemetryClient.updateTelemetryState(telemetrySetting, telemetryKey, machineId)
		}
	}, [telemetrySetting, telemetryKey, machineId, didHydrateState])

	// Tell the extension that we are ready to receive messages.
	// Request notification permission when app launches
	useEffect(() => {
		vscode.postMessage({ type: "webviewDidLaunch" })
		requestNotificationPermission() // Request permission for notifications
	}, [])

	// Initialize source map support for better error reporting
	useEffect(() => {
		// Initialize source maps for better error reporting in production
		initializeSourceMaps()

		// Expose source map debugging utilities in production
		if (process.env.NODE_ENV === "production") {
			exposeSourceMapsForDebugging()
		}

		// Log initialization for debugging
		console.debug("App initialized with source map support")
	}, [])

	// Focus the WebView when non-interactive content is clicked (only in editor/tab mode)
	useAddNonInteractiveClickListener(
		useCallback(() => {
			// Only send focus request if we're in editor (tab) mode, not sidebar
			if (renderContext === "editor") {
				vscode.postMessage({ type: "focusPanelRequest" })
			}
		}, [renderContext]),
	)
	// Track marketplace tab views
	// useEffect(() => {
	//  if (tab === "marketplace") {
	//      telemetryClient.capture(TelemetryEventName.MARKETPLACE_TAB_VIEWED)
	//  }
	// }, [tab])

	if (!didHydrateState) {
		console.log("App: didHydrateState is false, returning null")
		return null
	}

	// Do not conditionally load ChatView, it's expensive and there's state we
	// don't want to lose (user input, disableInput, askResponse promise, etc.)
	console.log("App render - showWelcome:", showWelcome)
	console.log("App render - showLogin:", showLogin)
	console.log("App render - didHydrateState:", didHydrateState)

	return showLogin ? (
		<LoginView />
	) : showWelcome ? (
		<WelcomeView />
	) : (
		<>
			{tab === "modes" && <ModesView onDone={() => switchTab("chat")} />}
			{tab === "mcp" && <McpView onDone={() => switchTab("chat")} />}
			{tab === "history" && <HistoryView onDone={() => switchTab("chat")} />}
			{tab === "settings" && (
				<SettingsView ref={settingsRef} onDone={() => setTab("chat")} targetSection={currentSection} />
			)}
			<ChatView
				ref={chatViewRef}
				isHidden={tab !== "chat"}
				showAnnouncement={showAnnouncement}
				hideAnnouncement={() => setShowAnnouncement(false)}
			/>
			<MemoizedHumanRelayDialog
				isOpen={humanRelayDialogState.isOpen}
				requestId={humanRelayDialogState.requestId}
				promptText={humanRelayDialogState.promptText}
				onClose={() => setHumanRelayDialogState((prev) => ({ ...prev, isOpen: false }))}
				onSubmit={(requestId, text) => vscode.postMessage({ type: "humanRelayResponse", requestId, text })}
				onCancel={(requestId) => vscode.postMessage({ type: "humanRelayCancel", requestId })}
			/>
			<MemoizedDeleteMessageDialog
				open={deleteMessageDialogState.isOpen}
				onOpenChange={(open) => setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
				onConfirm={() => {
					vscode.postMessage({
						type: "deleteMessageConfirm",
						messageTs: deleteMessageDialogState.messageTs,
					})
					setDeleteMessageDialogState((prev) => ({ ...prev, isOpen: false }))
				}}
			/>
			<MemoizedEditMessageDialog
				open={editMessageDialogState.isOpen}
				onOpenChange={(open) => setEditMessageDialogState((prev) => ({ ...prev, isOpen: open }))}
				onConfirm={() => {
					vscode.postMessage({
						type: "editMessageConfirm",
						messageTs: editMessageDialogState.messageTs,
						text: editMessageDialogState.text,
						images: editMessageDialogState.images,
					})
					setEditMessageDialogState((prev) => ({ ...prev, isOpen: false }))
				}}
			/>
		</>
	)
}

const queryClient = new QueryClient()

const AppWithProviders = () => {
	console.log("🚀 AppWithProviders component is loading...")
	return (
		<ErrorBoundary>
			<ExtensionStateContextProvider>
				<TranslationProvider>
					<QueryClientProvider client={queryClient}>
						<TooltipProvider delayDuration={STANDARD_TOOLTIP_DELAY}>
							<App />
						</TooltipProvider>
					</QueryClientProvider>
				</TranslationProvider>
			</ExtensionStateContextProvider>
		</ErrorBoundary>
	)
}

export default AppWithProviders

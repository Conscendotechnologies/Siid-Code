import React, { useCallback, useEffect } from "react"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"

import { AgentsRail } from "./AgentsRail"
import { AgentsComposer } from "./AgentsComposer"
import { AgentsRightPane } from "./AgentsRightPane"
import { AgentsFlag } from "./AgentsFlag"
import { agentsThemeVars } from "./agentsTheme"
import "./agents.css"

type AgentsTab = "settings" | "history" | "mcp" | "modes" | "chat"

interface AgentsViewProps {
	/** Renders the existing ChatView; it stays mounted so task state is never lost. */
	renderChat: (isHidden: boolean) => React.ReactNode
	onSwitchTab: (tab: AgentsTab) => void
	/** True while another full-screen view (settings, modes, history) is shown on top. */
	hidden?: boolean
}

export const AgentsView = ({ renderChat, onSwitchTab, hidden }: AgentsViewProps) => {
	const { t } = useAppTranslation()
	const { clineMessages } = useExtensionState()
	const hasTask = (clineMessages?.length ?? 0) > 0

	const newSession = useCallback(() => {
		vscode.postMessage({ type: "clearTask" })
	}, [])

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "n") {
				e.preventDefault()
				newSession()
			}
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [newSession])

	return (
		<div
			className={`agents-root${hidden ? " agents-hidden" : ""}`}
			style={agentsThemeVars}
			data-testid="agents-view">
			<AgentsRail
				onNewSession={newSession}
				onOpenCustomizations={() => onSwitchTab("modes")}
				onOpenHistory={() => onSwitchTab("history")}
			/>

			<main className="agents-center">
				{!hasTask && <div className="agents-arc" aria-hidden="true" />}
				{!hasTask && <AgentsFlag className="agents-flagshape" />}
				{!hasTask && (
					<div className="agents-hero" data-testid="agents-hero">
						<div className="agents-eyebrow">{t("agents:tagline")}</div>
						<h1>{t("agents:heroTitle")}</h1>
						<AgentsComposer onOpenSettings={() => onSwitchTab("settings")} />
					</div>
				)}
				<div className="agents-chat" style={{ display: hasTask ? "block" : "none" }}>
					{renderChat(!hasTask)}
				</div>
			</main>

			<AgentsRightPane />
		</div>
	)
}

export default AgentsView

import React, { useCallback, useEffect, useState } from "react"
import { PanelRight } from "lucide-react"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"

import { AgentsRail } from "./AgentsRail"
import { AgentsComposer } from "./AgentsComposer"
import { AgentsRightPane } from "./AgentsRightPane"
import { AgentsFlag } from "./AgentsFlag"
import { agentsThemeVars } from "./agentsTheme"
import { AGENTS_PORTAL_ID, isTaskRunning } from "./agentsFormat"
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
	const running = isTaskRunning(clineMessages)
	const [drawerOpen, setDrawerOpen] = useState(false)

	const newSession = useCallback(() => {
		vscode.postMessage({ type: "clearTask" })
	}, [])

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			// Ignored while another view is on top or a task is working, so it never clears a live task.
			if (hidden || running) {
				return
			}
			if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "n") {
				e.preventDefault()
				newSession()
			}
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [newSession, hidden, running])

	// Narrow windows show the right pane as a drawer: close on outside click or Escape.
	useEffect(() => {
		if (!drawerOpen) {
			return
		}
		const onDown = (e: MouseEvent) => {
			if (!(e.target as Element | null)?.closest?.(".agents-right, .agents-drawer-toggle")) {
				setDrawerOpen(false)
			}
		}
		const onEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setDrawerOpen(false)
			}
		}
		// Picking a file or change opens it beside the panel, so get out of the composer's way.
		const onPick = (e: MouseEvent) => {
			if ((e.target as Element | null)?.closest?.('.agents-change, [data-testid="agents-file"]')) {
				setDrawerOpen(false)
			}
		}
		document.addEventListener("mousedown", onDown)
		document.addEventListener("keydown", onEsc)
		document.addEventListener("click", onPick)
		return () => {
			document.removeEventListener("mousedown", onDown)
			document.removeEventListener("keydown", onEsc)
			document.removeEventListener("click", onPick)
		}
	}, [drawerOpen])

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
				<button
					className="agents-icon-btn agents-drawer-toggle"
					aria-label={t("agents:changesAndFiles")}
					aria-expanded={drawerOpen}
					data-testid="agents-drawer-toggle"
					onClick={() => setDrawerOpen((v) => !v)}>
					<PanelRight size={15} />
				</button>
				{!hasTask && <div className="agents-arc" aria-hidden="true" />}
				{!hasTask && <AgentsFlag className="agents-flagshape" />}
				{!hasTask && (
					<div className="agents-hero" data-testid="agents-hero">
						<div className="agents-eyebrow">{t("agents:tagline")}</div>
						<h1>{t("agents:heroTitle")}</h1>
						<AgentsComposer />
					</div>
				)}
				<div className="agents-chat" style={{ display: hasTask ? "block" : "none" }}>
					{renderChat(!hasTask)}
				</div>
			</main>

			<AgentsRightPane drawerOpen={drawerOpen} />

			<div id={AGENTS_PORTAL_ID} />
		</div>
	)
}

export default AgentsView

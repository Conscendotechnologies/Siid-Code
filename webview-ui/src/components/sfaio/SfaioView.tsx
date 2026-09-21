import React, { useState, useEffect } from "react"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"
import { SetupScreen } from "./components/SetupScreen"
import { RunBoard } from "./components/RunBoard"
import { DecisionInbox } from "./components/DecisionInbox"
import { TaskDrawer } from "./components/TaskDrawer"
import { VSCodePanels, VSCodePanelTab, VSCodePanelView } from "@vscode/webview-ui-toolkit/react"

interface SfaioViewProps {
	onDone: () => void
}

const SfaioView: React.FC<SfaioViewProps> = () => {
	const { sfaioState } = useExtensionState()
	const [activeTab, setActiveTab] = useState("runboard")

	// Helper to get active run
	const runs = sfaioState?.runs ? Object.values(sfaioState.runs) : []
	const activeRun: any = runs.find((r: any) => ["running", "paused"].includes(r.status)) || runs[0]

	// Determine UI state
	const hasRun = !!activeRun

	useEffect(() => {
		if (hasRun && activeTab === "setup") {
			setActiveTab("runboard")
		} else if (!hasRun && activeTab !== "setup") {
			setActiveTab("setup")
		}
	}, [hasRun, activeTab])

	const handleStartRun = (config: any) => {
		vscode.postMessage({
			type: "sfaioAction",
			sfaioAction: "startRun",
			payload: config,
		})
	}

	const handleResolveDecision = (decisionId: string, response: any) => {
		vscode.postMessage({
			type: "sfaioAction",
			sfaioAction: "resolveDecision",
			payload: { decisionId, response },
		})
	}

	const handlePauseRun = () => {
		if (activeRun) {
			vscode.postMessage({ type: "sfaioAction", sfaioAction: "pauseRun", payload: { runId: activeRun.id } })
		}
	}

	const handleResumeRun = () => {
		if (activeRun) {
			vscode.postMessage({ type: "sfaioAction", sfaioAction: "resumeRun", payload: { runId: activeRun.id } })
		}
	}

	const handleCancelRun = () => {
		if (activeRun) {
			vscode.postMessage({ type: "sfaioAction", sfaioAction: "cancelRun", payload: { runId: activeRun.id } })
		}
	}

	if (!hasRun) {
		return (
			<div style={{ height: "100%", width: "100%", overflowY: "auto" }}>
				<SetupScreen onStartRun={handleStartRun} />
			</div>
		)
	}

	const tasks = sfaioState?.tasks ? Object.values(sfaioState.tasks) : []
	const decisions = sfaioState?.decisions ? Object.values(sfaioState.decisions) : []
	const pendingDecisionsCount = decisions.filter((d: any) => d.status === "pending").length

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
			<VSCodePanels
				activeid={`tab-${activeTab}`}
				onChange={(e: any) => setActiveTab(e.target.activeid.replace("tab-", ""))}>
				<VSCodePanelTab id="tab-runboard">Run Board</VSCodePanelTab>
				<VSCodePanelTab id="tab-decisions">
					Inbox {pendingDecisionsCount > 0 && `(${pendingDecisionsCount})`}
				</VSCodePanelTab>
				<VSCodePanelTab id="tab-tasks">Tasks</VSCodePanelTab>

				<VSCodePanelView id="view-runboard" style={{ padding: 0, overflow: "auto" }}>
					<RunBoard
						run={activeRun}
						tasks={tasks}
						onPauseRun={handlePauseRun}
						onResumeRun={handleResumeRun}
						onCancelRun={handleCancelRun}
					/>
				</VSCodePanelView>

				<VSCodePanelView id="view-decisions" style={{ padding: 0, overflow: "auto" }}>
					<DecisionInbox decisions={decisions} onResolve={handleResolveDecision} />
				</VSCodePanelView>

				<VSCodePanelView id="view-tasks" style={{ padding: 0, overflow: "auto" }}>
					<TaskDrawer tasks={tasks} />
				</VSCodePanelView>
			</VSCodePanels>
		</div>
	)
}

export default SfaioView

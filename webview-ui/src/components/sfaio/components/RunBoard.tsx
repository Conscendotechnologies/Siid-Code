import React from "react"
import { VSCodeButton, VSCodeBadge } from "@vscode/webview-ui-toolkit/react"

interface RunBoardProps {
	run: any
	tasks: any[]
	onPauseRun: () => void
	onResumeRun: () => void
	onCancelRun: () => void
}

export const RunBoard: React.FC<RunBoardProps> = ({ run, tasks, onPauseRun, onResumeRun, onCancelRun }) => {
	if (!run) return null

	return (
		<div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<div>
					<h2>Run: {run.id.substring(0, 8)}...</h2>
					<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
						<VSCodeBadge>{run.status}</VSCodeBadge>
						<span style={{ color: "var(--vscode-descriptionForeground)", fontSize: "12px" }}>
							Target Org: {run.config.targetOrgAlias}
						</span>
					</div>
				</div>
				<div style={{ display: "flex", gap: "12px" }}>
					{run.status === "running" && (
						<VSCodeButton appearance="secondary" onClick={onPauseRun}>
							Pause
						</VSCodeButton>
					)}
					{run.status === "paused" && (
						<VSCodeButton appearance="primary" onClick={onResumeRun}>
							Resume
						</VSCodeButton>
					)}
					{run.status !== "completed" && run.status !== "failed" && run.status !== "cancelled" && (
						<VSCodeButton
							appearance="secondary"
							onClick={onCancelRun}
							style={{ background: "var(--vscode-errorForeground)" }}>
							Cancel
						</VSCodeButton>
					)}
				</div>
			</div>

			<div
				style={{
					background: "var(--vscode-editor-background)",
					padding: "16px",
					borderRadius: "6px",
					border: "1px solid var(--vscode-widget-border)",
				}}>
				<h3 style={{ marginTop: 0 }}>Requirement</h3>
				<div style={{ whiteSpace: "pre-wrap", fontSize: "13px", color: "var(--vscode-foreground)" }}>
					{run.config.requirement}
				</div>
			</div>

			<div>
				<h3>Tasks Overview</h3>
				{tasks.length === 0 ? (
					<p style={{ color: "var(--vscode-descriptionForeground)" }}>No tasks created yet.</p>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
						{tasks.map((task) => (
							<div
								key={task.id}
								style={{
									display: "flex",
									justifyContent: "space-between",
									padding: "12px",
									background: "var(--vscode-editor-inactiveSelectionBackground)",
									borderRadius: "4px",
								}}>
								<div>
									<div style={{ fontWeight: "bold" }}>
										{task.type} - {task.id.substring(0, 8)}
									</div>
									<div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>
										{task.metadata?.title || "No title"}
									</div>
								</div>
								<VSCodeBadge>{task.status}</VSCodeBadge>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

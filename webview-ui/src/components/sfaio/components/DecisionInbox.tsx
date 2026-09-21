import React from "react"
import { VSCodeButton, VSCodeBadge, VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"

interface DecisionInboxProps {
	decisions: any[]
	onResolve: (decisionId: string, response: any) => void
}

export const DecisionInbox: React.FC<DecisionInboxProps> = ({ decisions, onResolve }) => {
	const pendingDecisions = decisions.filter((d) => d.status === "pending")
	const resolvedDecisions = decisions.filter((d) => d.status === "resolved")

	return (
		<div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "24px" }}>
			<h2>Decision Inbox</h2>

			<div>
				<h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
					Requires Attention <VSCodeBadge>{pendingDecisions.length}</VSCodeBadge>
				</h3>
				{pendingDecisions.length === 0 ? (
					<p style={{ color: "var(--vscode-descriptionForeground)" }}>No pending decisions.</p>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
						{pendingDecisions.map((decision) => (
							<DecisionItem key={decision.id} decision={decision} onResolve={onResolve} />
						))}
					</div>
				)}
			</div>

			{resolvedDecisions.length > 0 && (
				<div>
					<h3>Recently Resolved</h3>
					<div style={{ display: "flex", flexDirection: "column", gap: "8px", opacity: 0.7 }}>
						{resolvedDecisions.slice(0, 5).map((decision) => (
							<div
								key={decision.id}
								style={{
									padding: "12px",
									background: "var(--vscode-editor-inactiveSelectionBackground)",
									borderRadius: "4px",
								}}>
								<div style={{ display: "flex", justifyContent: "space-between" }}>
									<b>{decision.type}</b>
									<VSCodeBadge>Resolved</VSCodeBadge>
								</div>
								<div style={{ marginTop: "8px", fontSize: "12px" }}>
									Response: {JSON.stringify(decision.response)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

const DecisionItem: React.FC<{ decision: any; onResolve: (id: string, response: any) => void }> = ({
	decision,
	onResolve,
}) => {
	const [responseText, setResponseText] = React.useState("")

	const handleResolve = (approved: boolean) => {
		onResolve(decision.id, {
			approved,
			feedback: responseText,
		})
	}

	return (
		<div
			style={{
				padding: "16px",
				background: "var(--vscode-editor-background)",
				border: "1px solid var(--vscode-focusBorder)",
				borderRadius: "6px",
			}}>
			<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
				<b style={{ fontSize: "14px", color: "var(--vscode-textPreformat-foreground)" }}>{decision.type}</b>
				<span style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>
					Run: {decision.runId?.substring(0, 8)} | Task: {decision.taskId?.substring(0, 8)}
				</span>
			</div>

			<div style={{ marginBottom: "16px", fontSize: "13px" }}>
				<strong>Payload:</strong>
				<pre
					style={{
						background: "var(--vscode-textCodeBlock-background)",
						padding: "8px",
						borderRadius: "4px",
						overflowX: "auto",
					}}>
					{JSON.stringify(decision.payload, null, 2)}
				</pre>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
				<label style={{ fontSize: "12px" }}>Feedback / Instructions (Optional)</label>
				<VSCodeTextArea
					rows={3}
					value={responseText}
					onInput={(e: any) => setResponseText(e.target.value)}
					placeholder="Add feedback to guide the agent..."
					style={{ width: "100%" }}
				/>
			</div>

			<div style={{ display: "flex", gap: "12px" }}>
				<VSCodeButton onClick={() => handleResolve(true)}>Approve</VSCodeButton>
				<VSCodeButton appearance="secondary" onClick={() => handleResolve(false)}>
					Reject / Needs Work
				</VSCodeButton>
			</div>
		</div>
	)
}

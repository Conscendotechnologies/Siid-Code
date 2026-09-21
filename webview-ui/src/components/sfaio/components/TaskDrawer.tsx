import React from "react"
import { VSCodeBadge, VSCodeDivider } from "@vscode/webview-ui-toolkit/react"

interface TaskDrawerProps {
	tasks: any[]
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({ tasks }) => {
	if (!tasks || tasks.length === 0) {
		return <div style={{ padding: "20px", color: "var(--vscode-descriptionForeground)" }}>No tasks available.</div>
	}

	return (
		<div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
			<h2>Tasks Drawer</h2>

			<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
				{tasks.map((task) => (
					<div
						key={task.id}
						style={{
							padding: "16px",
							background: "var(--vscode-editor-background)",
							border: "1px solid var(--vscode-widget-border)",
							borderRadius: "6px",
						}}>
						<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
							<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
								<b style={{ fontSize: "14px" }}>{task.type}</b>
								<span style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>
									{task.id.substring(0, 8)}
								</span>
							</div>
							<VSCodeBadge>{task.status}</VSCodeBadge>
						</div>

						{task.metadata?.title && (
							<div style={{ marginBottom: "12px", fontSize: "13px" }}>{task.metadata.title}</div>
						)}

						<div
							style={{
								display: "flex",
								gap: "12px",
								fontSize: "12px",
								color: "var(--vscode-descriptionForeground)",
							}}>
							<span>Agent: {task.agentId || "Unassigned"}</span>
							<span>Created: {new Date(task.createdAt).toLocaleString()}</span>
						</div>

						{task.spec && (
							<>
								<VSCodeDivider style={{ margin: "12px 0" }} />
								<div>
									<div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>
										Spec Preview:
									</div>
									<pre
										style={{
											background: "var(--vscode-textCodeBlock-background)",
											padding: "8px",
											borderRadius: "4px",
											fontSize: "12px",
											margin: 0,
											maxHeight: "150px",
											overflowY: "auto",
										}}>
										{JSON.stringify(task.spec, null, 2)}
									</pre>
								</div>
							</>
						)}
					</div>
				))}
			</div>
		</div>
	)
}

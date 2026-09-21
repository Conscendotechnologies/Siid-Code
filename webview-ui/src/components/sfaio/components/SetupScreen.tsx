import React, { useState } from "react"
import { VSCodeButton, VSCodeTextArea, VSCodeTextField, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

interface SetupScreenProps {
	onStartRun: (config: any) => void
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onStartRun }) => {
	const [requirement, setRequirement] = useState("")
	const [targetOrgAlias, setTargetOrgAlias] = useState("")
	const [autoMode, setAutoMode] = useState(false)
	const [projectPath, setProjectPath] = useState("force-app/main/default")
	const [isGreenfieldOrg, setIsGreenfieldOrg] = useState(false)

	const handleSubmit = () => {
		if (!requirement || !targetOrgAlias) {
			// Basic validation
			return
		}

		onStartRun({
			requirement,
			targetOrgAlias,
			autoMode,
			projectPath,
			isGreenfieldOrg,
		})
	}

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "16px",
				maxWidth: "600px",
				margin: "0 auto",
				padding: "24px",
			}}>
			<div style={{ textAlign: "center", marginBottom: "24px" }}>
				<h2>SFAIO Engine Setup</h2>
				<p style={{ color: "var(--vscode-descriptionForeground)" }}>Configure your execution parameters</p>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
				<label style={{ fontWeight: "bold" }}>Requirement Document</label>
				<VSCodeTextArea
					rows={8}
					value={requirement}
					onInput={(e: any) => setRequirement(e.target.value)}
					placeholder="Enter the raw requirements for the Salesforce feature..."
					style={{ width: "100%" }}
				/>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
				<label style={{ fontWeight: "bold" }}>Target Org Alias</label>
				<VSCodeTextField
					value={targetOrgAlias}
					onInput={(e: any) => setTargetOrgAlias(e.target.value)}
					placeholder="e.g., devOrg, uatOrg"
					style={{ width: "100%" }}
				/>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
				<label style={{ fontWeight: "bold" }}>Project Path</label>
				<VSCodeTextField
					value={projectPath}
					onInput={(e: any) => setProjectPath(e.target.value)}
					placeholder="force-app/main/default"
					style={{ width: "100%" }}
				/>
			</div>

			<div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
				<VSCodeCheckbox checked={autoMode} onChange={(e: any) => setAutoMode(e.target.checked)}>
					Auto-delegate to AI (bypass manual approvals)
				</VSCodeCheckbox>

				<VSCodeCheckbox checked={isGreenfieldOrg} onChange={(e: any) => setIsGreenfieldOrg(e.target.checked)}>
					Greenfield Org (no existing metadata to pull)
				</VSCodeCheckbox>
			</div>

			<div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
				<VSCodeButton appearance="primary" onClick={handleSubmit} disabled={!requirement || !targetOrgAlias}>
					Start Run
				</VSCodeButton>
			</div>
		</div>
	)
}

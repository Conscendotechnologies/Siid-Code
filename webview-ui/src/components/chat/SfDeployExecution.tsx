import { useState } from "react"
import { useEvent } from "react-use"

import { SfDeployExecutionStatus, sfDeployExecutionStatusSchema } from "@siid-code/types"
import { ExtensionMessage } from "@roo/ExtensionMessage"
import { safeJsonParse } from "@roo/safeJsonParse"

interface SfDeployExecutionProps {
	metadataType: string
	metadataName: string
	isLast: boolean
}

const statusLabel: Record<SfDeployExecutionStatus["status"], string> = {
	validating: "Validating...",
	deploying: "Deploying to org...",
	completed: "Deployed ✓",
	error: "Failed",
}

const statusColor: Record<SfDeployExecutionStatus["status"], string> = {
	validating: "var(--vscode-charts-yellow)",
	deploying: "var(--vscode-charts-blue)",
	completed: "var(--vscode-charts-green)",
	error: "var(--vscode-charts-red)",
}

export const SfDeployExecution = ({ metadataType, metadataName, isLast }: SfDeployExecutionProps) => {
	const [status, setStatus] = useState<SfDeployExecutionStatus | null>(null)

	useEvent("message", (event: MessageEvent) => {
		// Only the most recent tool row should react — old rows stay frozen
		if (!isLast) return

		const message: ExtensionMessage = event.data
		if (message.type !== "sfDeployExecutionStatus") return

		const result = sfDeployExecutionStatusSchema.safeParse(safeJsonParse(message.text || "{}", {}))
		if (!result.success) return

		const data = result.data
		if (
			(data.status === "validating" || data.status === "deploying") &&
			(data.metadataType !== metadataType || data.metadataName !== metadataName)
		) {
			return
		}

		setStatus(data)
	})

	if (!status || status.status === "completed") return null

	const color = statusColor[status.status]
	const label = statusLabel[status.status]
	const isActive = status.status === "validating" || status.status === "deploying"

	return (
		<div
			style={{
				marginTop: "6px",
				display: "flex",
				alignItems: "center",
				gap: "6px",
				fontSize: "var(--vscode-font-size)",
				color: "var(--vscode-descriptionForeground)",
			}}>
			<span
				style={{
					display: "inline-block",
					width: "8px",
					height: "8px",
					borderRadius: "50%",
					backgroundColor: color,
					animation: isActive ? "pulse 1.5s ease-in-out infinite" : "none",
				}}
			/>
			<span style={{ color }}>{label}</span>
		</div>
	)
}

import { useState } from "react"
import { useEvent } from "react-use"

import { SfRetrieveExecutionStatus, sfRetrieveExecutionStatusSchema } from "@siid-code/types"
import { ExtensionMessage } from "@roo/ExtensionMessage"
import { safeJsonParse } from "@roo/safeJsonParse"

interface SfRetrieveExecutionProps {
	metadataType: string
	metadataName?: string
	isLast: boolean
}

const statusLabel: Record<SfRetrieveExecutionStatus["status"], string> = {
	retrieving: "Retrieving from org...",
	completed: "Retrieved",
	error: "Failed",
}

const statusColor: Record<SfRetrieveExecutionStatus["status"], string> = {
	retrieving: "var(--vscode-charts-blue)",
	completed: "var(--vscode-charts-green)",
	error: "var(--vscode-charts-red)",
}

export const SfRetrieveExecution = ({ metadataType, isLast }: SfRetrieveExecutionProps) => {
	const [status, setStatus] = useState<SfRetrieveExecutionStatus | null>(null)

	useEvent("message", (event: MessageEvent) => {
		// Only the most recent tool row should react — old rows stay frozen
		if (!isLast) return

		const message: ExtensionMessage = event.data
		if (message.type !== "sfRetrieveExecutionStatus") return

		const result = sfRetrieveExecutionStatusSchema.safeParse(safeJsonParse(message.text || "{}", {}))
		if (!result.success) return

		const data = result.data
		if (data.status === "retrieving" && data.metadataType !== metadataType) return

		setStatus(data)
	})

	if (!status || status.status === "completed" || status.status === "error") return null

	const color = statusColor[status.status]
	const label = statusLabel[status.status]

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
					animation: "pulse 1.5s ease-in-out infinite",
				}}
			/>
			<span style={{ color }}>{label}</span>
		</div>
	)
}

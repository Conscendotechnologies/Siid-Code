import { useEffect, useState } from "react"

/**
 * Live "running…" indicator for a siid_forge feature: a spinner + an elapsed-seconds timer.
 * Prefers Forge's REAL elapsed (`elapsedMs`, from the command's onStatus heartbeat) when provided;
 * falls back to a local clock while waiting for the first heartbeat. The parent unmounts it once the
 * result row arrives, and only renders it while the task is actively streaming (no runaway counter).
 */
export const SiidForgeRunning = ({
	feature,
	elapsedMs,
	label,
}: {
	feature?: string
	elapsedMs?: number
	label?: string
}) => {
	const [localElapsed, setLocalElapsed] = useState(0)

	useEffect(() => {
		const start = Date.now()
		const id = setInterval(() => setLocalElapsed(Math.floor((Date.now() - start) / 1000)), 250)
		return () => clearInterval(id)
	}, [])

	const elapsed = elapsedMs !== undefined ? Math.floor(elapsedMs / 1000) : localElapsed

	return (
		<div
			style={{
				marginTop: "4px",
				padding: "8px 12px",
				display: "flex",
				alignItems: "center",
				gap: "8px",
				minHeight: "20px",
				color: "var(--vscode-foreground)",
				fontSize: "var(--vscode-font-size)",
			}}>
			<span className="codicon codicon-loading codicon-modifier-spin" aria-hidden="true" />
			<span>
				{label ?? `Running ${feature ?? "command"}…`} <strong>{elapsed}s</strong>
			</span>
		</div>
	)
}

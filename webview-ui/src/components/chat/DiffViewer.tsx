import React from "react"
import type { FileChange } from "./FileChanges"

export interface DiffViewerProps {
	file: FileChange
	onClose: () => void
}

/**
 * Simple diff viewer component
 * Shows the diff content in a modal-like overlay
 */
export const DiffViewer: React.FC<DiffViewerProps> = ({ file, onClose }) => {
	if (!file.diff) {
		return null
	}

	const parseDiff = (diff: string) => {
		const lines = diff.split("\n")
		return lines.map((line, index) => {
			let type: "add" | "remove" | "context" | "header" = "context"
			let bgColor = "transparent"
			let textColor = "var(--vscode-editor-foreground)"

			if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) {
				type = "header"
				textColor = "var(--vscode-textPreformat-foreground)"
			} else if (line.startsWith("+")) {
				type = "add"
				bgColor = "var(--vscode-diffEditor-insertedTextBackground)"
				textColor = "var(--vscode-gitDecoration-addedResourceForeground)"
			} else if (line.startsWith("-")) {
				type = "remove"
				bgColor = "var(--vscode-diffEditor-removedTextBackground)"
				textColor = "var(--vscode-gitDecoration-deletedResourceForeground)"
			}

			return { line, type, bgColor, textColor, index }
		})
	}

	const diffLines = parseDiff(file.diff)

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center"
			style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
			onClick={onClose}>
			<div
				className="relative w-full max-w-4xl max-h-[80vh] flex flex-col bg-vscode-editor-background border border-vscode-panel-border rounded-lg shadow-lg"
				onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div className="flex items-center justify-between p-3 border-b border-vscode-panel-border">
					<div className="flex items-center gap-2">
						<span className="codicon codicon-diff text-base" />
						<h3 className="font-bold text-sm">{file.path}</h3>
						{file.status && (
							<span
								className="px-2 py-0.5 rounded text-xs"
								style={{
									backgroundColor: "var(--vscode-badge-background)",
									color: "var(--vscode-badge-foreground)",
								}}>
								{file.status}
							</span>
						)}
					</div>
					<button
						onClick={onClose}
						className="codicon codicon-close hover:bg-vscode-button-hoverBackground p-1 rounded"
						title="Close"
					/>
				</div>

				{/* Diff content */}
				<div className="flex-1 overflow-auto p-4">
					<pre
						className="text-xs"
						style={{
							fontFamily: "var(--vscode-editor-font-family)",
							margin: 0,
						}}>
						{diffLines.map(({ line, bgColor, textColor, index }) => (
							<div
								key={index}
								style={{
									backgroundColor: bgColor,
									color: textColor,
									padding: "2px 8px",
									whiteSpace: "pre-wrap",
									wordBreak: "break-all",
								}}>
								{line || " "}
							</div>
						))}
					</pre>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between p-3 border-t border-vscode-panel-border text-xs opacity-70">
					<div className="flex items-center gap-4">
						{file.additions !== undefined && file.additions > 0 && (
							<span style={{ color: "var(--vscode-charts-green)" }}>+{file.additions} additions</span>
						)}
						{file.deletions !== undefined && file.deletions > 0 && (
							<span style={{ color: "var(--vscode-errorForeground)" }}>-{file.deletions} deletions</span>
						)}
					</div>
					{file.timestamp && <span>Modified: {new Date(file.timestamp).toLocaleString()}</span>}
				</div>
			</div>
		</div>
	)
}

import React, { memo, useState } from "react"
import CodeAccordian from "../common/CodeAccordian"
import { calculateDiffStats } from "../../utils/diffStats"

interface FileDiff {
	path: string
	changeCount: number
	key: string
	content: string
	linesAdded?: number
	linesRemoved?: number
	diffs?: Array<{
		content: string
		startLine?: number
	}>
}

interface BatchDiffApprovalProps {
	files: FileDiff[]
	ts: number
}

export const BatchDiffApproval = memo(({ files = [], ts }: BatchDiffApprovalProps) => {
	const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({})

	if (!files?.length) {
		return null
	}

	const handleToggleExpand = (filePath: string) => {
		setExpandedFiles((prev) => ({
			...prev,
			[filePath]: !prev[filePath],
		}))
	}

	return (
		<div className="pt-[5px]">
			<div className="flex flex-col gap-0 border border-border rounded-md p-1">
				{files.map((file) => {
					// Combine all diffs into a single diff string for this file
					const combinedDiff = file.diffs?.map((diff) => diff.content).join("\n\n") || file.content

					// Calculate diff stats
					const diffStats =
						file.linesAdded !== undefined && file.linesRemoved !== undefined
							? { linesAdded: file.linesAdded, linesRemoved: file.linesRemoved }
							: calculateDiffStats(combinedDiff)

					return (
						<div key={`${file.path}-${ts}`}>
							<div className="flex items-center gap-2 px-2 py-1 rounded-t-md bg-vscode-editor-background border-b border-border">
								<div className="flex-1 text-sm font-mono truncate">{file.path}</div>
								<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
									<span
										style={{
											fontSize: 12,
											fontFamily: "monospace",
											color: "var(--vscode-charts-green)",
											fontWeight: 700,
										}}>
										+{diffStats.linesAdded}
									</span>
									<span
										style={{
											fontSize: 12,
											fontFamily: "monospace",
											color:
												diffStats.linesRemoved && diffStats.linesRemoved > 0
													? "var(--vscode-errorForeground)"
													: "var(--vscode-descriptionForeground)",
											fontWeight: 700,
										}}>
										-{diffStats.linesRemoved}
									</span>
								</div>
							</div>
							<CodeAccordian
								path={file.path}
								code={combinedDiff}
								language="diff"
								isExpanded={expandedFiles[file.path] || false}
								onToggleExpand={() => handleToggleExpand(file.path)}
							/>
						</div>
					)
				})}
			</div>
		</div>
	)
})

BatchDiffApproval.displayName = "BatchDiffApproval"

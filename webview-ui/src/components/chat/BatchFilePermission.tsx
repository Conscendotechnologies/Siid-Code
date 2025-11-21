import { memo, useState } from "react"

import { vscode } from "@src/utils/vscode"
import { removeLeadingNonAlphanumeric } from "@src/utils/removeLeadingNonAlphanumeric"

interface FilePermissionItem {
	path: string
	lineSnippet?: string
	isOutsideWorkspace?: boolean
	key: string
	content?: string // full path
}

interface BatchFilePermissionProps {
	files: FilePermissionItem[]
	onPermissionResponse?: (response: { [key: string]: boolean }) => void
	ts: number
}

export const BatchFilePermission = memo(({ files = [], onPermissionResponse, ts }: BatchFilePermissionProps) => {
	const [hoveredFile, setHoveredFile] = useState<string | null>(null)

	// Don't render if there are no files or no response handler
	if (!files?.length || !onPermissionResponse) {
		return null
	}

	return (
		<div style={{ margin: "6px 0 6px 0", display: "flex", flexDirection: "column", gap: "6px" }}>
			{files.map((file) => {
				const fileName = file.path
					? file.path.split(/[\\/]/).pop()
					: removeLeadingNonAlphanumeric(file.path ?? "")
				const isHovered = hoveredFile === file.key

				return (
					<div key={`${file.path}-${ts}`} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
						<span
							style={{
								fontSize: "11px",
								color: "var(--vscode-descriptionForeground)",
								fontFamily: "monospace",
								border: `1px solid ${isHovered ? "#007ACC" : "var(--vscode-sideBar-border)"}`,
								borderRadius: "3px",
								padding: "2px 6px",
								background: isHovered ? "rgba(0, 122, 204, 0.1)" : "var(--vscode-sideBar-background)",
								cursor: "pointer",
								display: "inline-block",
								transition: "all 120ms ease",
							}}
							onMouseEnter={() => setHoveredFile(file.key)}
							onMouseLeave={() => setHoveredFile(null)}
							onClick={() =>
								vscode.postMessage({
									type: "openFile",
									text: file.content || file.path,
								})
							}>
							Read: {fileName}
						</span>
					</div>
				)
			})}
		</div>
	)
})

BatchFilePermission.displayName = "BatchFilePermission"

import React, { useState } from "react"
import "./FilesChangedSummary.css"

export interface FileChange {
	path: string
	additions: number
	deletions: number
	status: "added" | "modified" | "deleted"
}

export interface FilesChangedSummaryProps {
	files: FileChange[]
}

export const FilesChangedSummary: React.FC<FilesChangedSummaryProps> = ({ files }) => {
	const [isExpanded, setIsExpanded] = useState(true)

	if (!files || files.length === 0) {
		return null
	}

	const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0)
	const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0)

	return (
		<div className="files-changed-summary">
			<div className="files-changed-header" onClick={() => setIsExpanded(!isExpanded)}>
				<span className="chevron">{isExpanded ? "▼" : "▶"}</span>
				<span className="file-count">
					{files.length} file{files.length !== 1 ? "s" : ""} changed
				</span>
				<span className="changes-badge">
					<span className="additions">+{totalAdditions}</span>
					<span className="deletions">-{totalDeletions}</span>
				</span>
			</div>

			{isExpanded && (
				<div className="files-changed-list">
					{files.map((file) => (
						<div key={file.path} className="file-change-item">
							<span className={`file-icon status-${file.status}`}>
								{file.status === "added" && "＋"}
								{file.status === "modified" && "◇"}
								{file.status === "deleted" && "✕"}
							</span>
							<span className="file-path">{file.path}</span>
							<span className="file-changes">
								<span className="additions">+{file.additions}</span>
								<span className="deletions">-{file.deletions}</span>
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export default FilesChangedSummary

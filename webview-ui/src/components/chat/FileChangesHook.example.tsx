/**
 * Example of using the useFileChanges hook
 * Demonstrates the full workflow of file change tracking with deployment status
 */

import React, { useState } from "react"
import { useFileChanges } from "./useFileChanges"
import { FileChanges } from "./FileChanges"
import { DiffViewer } from "./DiffViewer"
import type { FileChange } from "./FileChanges"

export const FileChangesHookExample: React.FC = () => {
	const taskId = "example-task-123"
	const {
		files,
		addFile,
		updateFile,
		removeFile: _removeFile,
		updateDeploymentStatus,
		updateMultipleStatuses,
		filterByStatus,
		getPendingFiles,
		markAllDeployed,
		clearAll,
	} = useFileChanges(taskId)

	const [selectedDiffFile, setSelectedDiffFile] = useState<FileChange | null>(null)

	// Simulate creating a new file
	const handleCreateFile = () => {
		const newFile: FileChange = {
			path: `src/NewComponent${Date.now()}.tsx`,
			additions: 45,
			deletions: 0,
			status: "created",
			deploymentStatus: "local",
			diff: `--- /dev/null
+++ b/src/NewComponent.tsx
@@ -0,0 +1,45 @@
+import React from 'react'
+
+export const NewComponent = () => {
+  return <div>Hello World</div>
+}`,
			timestamp: Date.now(),
		}
		addFile(newFile)
	}

	// Simulate modifying a file
	const handleModifyFile = () => {
		if (files.length > 0) {
			const file = files[0]
			updateFile(file.path, {
				additions: (file.additions || 0) + 10,
				deletions: (file.deletions || 0) + 5,
				diff: `Modified diff content for ${file.path}`,
			})
		}
	}

	// Simulate dry run
	const handleDryRun = () => {
		const pending = getPendingFiles()
		const paths = pending.map((f) => f.path)
		updateMultipleStatuses(paths, "dry-run")
	}

	// Simulate deployment
	const handleDeploy = async () => {
		const pending = getPendingFiles()

		for (const file of pending) {
			// Set to deploying
			updateDeploymentStatus(file.path, "deploying")

			// Simulate deployment delay
			await new Promise((resolve) => setTimeout(resolve, 1000))

			// Randomly succeed or fail
			if (Math.random() > 0.2) {
				updateDeploymentStatus(file.path, "deployed")
			} else {
				updateDeploymentStatus(file.path, "failed", "Deployment failed: Connection timeout")
			}
		}
	}

	const localFiles = filterByStatus("local")
	const deployedFiles = filterByStatus("deployed")
	const failedFiles = filterByStatus("failed")
	const pendingFiles = getPendingFiles()

	return (
		<div className="p-4 space-y-6">
			<div className="border-b border-vscode-panel-border pb-4">
				<h1 className="text-2xl font-bold mb-2">File Changes Hook Example</h1>
				<p className="text-sm opacity-70">
					Demonstrates file tracking, diff viewing, and deployment status management
				</p>
			</div>

			{/* Action Buttons */}
			<div className="flex gap-2 flex-wrap">
				<button
					onClick={handleCreateFile}
					className="px-3 py-1.5 rounded bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground text-sm">
					Create File
				</button>
				<button
					onClick={handleModifyFile}
					className="px-3 py-1.5 rounded bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground text-sm"
					disabled={files.length === 0}>
					Modify First File
				</button>
				<button
					onClick={handleDryRun}
					className="px-3 py-1.5 rounded bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground text-sm"
					disabled={pendingFiles.length === 0}>
					Dry Run ({pendingFiles.length})
				</button>
				<button
					onClick={handleDeploy}
					className="px-3 py-1.5 rounded bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground text-sm"
					disabled={pendingFiles.length === 0}>
					Deploy ({pendingFiles.length})
				</button>
				<button
					onClick={markAllDeployed}
					className="px-3 py-1.5 rounded bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground text-sm"
					disabled={files.length === 0}>
					Mark All Deployed
				</button>
				<button
					onClick={clearAll}
					className="px-3 py-1.5 rounded bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground hover:bg-vscode-button-secondaryHoverBackground text-sm"
					disabled={files.length === 0}>
					Clear All
				</button>
			</div>

			{/* Statistics */}
			<div className="grid grid-cols-4 gap-4">
				<div className="p-3 rounded border border-vscode-panel-border">
					<div className="text-2xl font-bold">{files.length}</div>
					<div className="text-xs opacity-70">Total Files</div>
				</div>
				<div className="p-3 rounded border border-vscode-panel-border">
					<div className="text-2xl font-bold">{localFiles.length}</div>
					<div className="text-xs opacity-70">Local</div>
				</div>
				<div className="p-3 rounded border border-vscode-panel-border">
					<div className="text-2xl font-bold">{deployedFiles.length}</div>
					<div className="text-xs opacity-70">Deployed</div>
				</div>
				<div className="p-3 rounded border border-vscode-panel-border">
					<div className="text-2xl font-bold">{failedFiles.length}</div>
					<div className="text-xs opacity-70">Failed</div>
				</div>
			</div>

			{/* File Changes Display */}
			{files.length > 0 ? (
				<>
					<div>
						<h2 className="text-lg font-bold mb-3">All Files - List View</h2>
						<FileChanges
							files={files}
							variant="list"
							defaultCollapsed={false}
							onViewDiff={(file) => setSelectedDiffFile(file)}
							taskId={taskId}
						/>
					</div>

					<div>
						<h2 className="text-lg font-bold mb-3">All Files - Detail View</h2>
						<FileChanges
							files={files}
							variant="detail"
							onViewDiff={(file) => setSelectedDiffFile(file)}
							taskId={taskId}
						/>
					</div>

					{pendingFiles.length > 0 && (
						<div>
							<h2 className="text-lg font-bold mb-3">Pending Deployment</h2>
							<FileChanges
								files={pendingFiles}
								variant="list"
								defaultCollapsed={false}
								onViewDiff={(file) => setSelectedDiffFile(file)}
							/>
						</div>
					)}
				</>
			) : (
				<div className="text-center py-8 text-sm opacity-70">
					No files tracked yet. Click &quot;Create File&quot; to add some files.
				</div>
			)}

			{/* Diff Viewer */}
			{selectedDiffFile && <DiffViewer file={selectedDiffFile} onClose={() => setSelectedDiffFile(null)} />}
		</div>
	)
}

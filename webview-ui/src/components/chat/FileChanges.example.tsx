/**
 * Example usage of the FileChanges component
 *
 * This file demonstrates how to use both variants of the FileChanges component:
 * - "list" variant: Collapsible list view (default)
 * - "detail" variant: Expanded view with prominent statistics
 * - With diff tracking and deployment status
 */

import React, { useState } from "react"
import { FileChanges, type FileChange, type DeploymentStatus as _DeploymentStatus } from "./FileChanges"
import { DiffViewer } from "./DiffViewer"

// Example file changes data with diff and deployment status
const exampleFiles: FileChange[] = [
	{
		path: "src/components/Header.tsx",
		additions: 45,
		deletions: 12,
		status: "modified",
		deploymentStatus: "deployed",
		timestamp: Date.now() - 3600000,
		diff: `--- a/src/components/Header.tsx
+++ b/src/components/Header.tsx
@@ -1,10 +1,15 @@
 import React from 'react'
+import { useAuth } from '../hooks/useAuth'
 
 export const Header = () => {
+  const { user, logout } = useAuth()
+  
   return (
     <header className="header">
       <h1>My App</h1>
+      <div className="user-info">
+        <span>{user?.name}</span>
+        <button onClick={logout}>Logout</button>
+      </div>
     </header>
   )
 }`,
	},
	{
		path: "src/utils/helpers.ts",
		additions: 23,
		deletions: 5,
		status: "modified",
		deploymentStatus: "deploying",
		timestamp: Date.now() - 1800000,
	},
	{
		path: "src/components/NewFeature.tsx",
		additions: 120,
		deletions: 0,
		status: "created",
		deploymentStatus: "dry-run",
		timestamp: Date.now() - 600000,
	},
	{
		path: "src/styles/old-theme.css",
		additions: 0,
		deletions: 67,
		status: "deleted",
		deploymentStatus: "local",
		timestamp: Date.now() - 300000,
	},
	{
		path: "README.md",
		additions: 15,
		deletions: 3,
		status: "modified",
		deploymentStatus: "failed",
		error: "Deployment failed: Connection timeout",
		timestamp: Date.now(),
	},
]

export const FileChangesExample = () => {
	const [selectedDiffFile, setSelectedDiffFile] = useState<FileChange | null>(null)

	// Custom file click handler (optional)
	const handleFileClick = (path: string) => {
		console.log("Opening file:", path)
		// Your custom logic here
	}

	return (
		<div className="space-y-8 p-4">
			<div>
				<h2 className="text-xl font-bold mb-4">List Variant with Deployment Status</h2>
				<p className="text-sm mb-4 opacity-70">Shows collapsible list with deployment status badges</p>
				<FileChanges
					files={exampleFiles}
					variant="list"
					defaultCollapsed={false}
					onFileClick={handleFileClick}
					onViewDiff={(file) => setSelectedDiffFile(file)}
					taskId="example-task-1"
				/>
			</div>

			<div>
				<h2 className="text-xl font-bold mb-4">Detail Variant with Full Statistics</h2>
				<p className="text-sm mb-4 opacity-70">
					Always expanded with prominent statistics and deployment status summary
				</p>
				<FileChanges
					files={exampleFiles}
					variant="detail"
					onFileClick={handleFileClick}
					onViewDiff={(file) => setSelectedDiffFile(file)}
					taskId="example-task-2"
				/>
			</div>

			<div>
				<h2 className="text-xl font-bold mb-4">Local Only Files</h2>
				<p className="text-sm mb-4 opacity-70">Files that have not been deployed yet</p>
				<FileChanges
					files={exampleFiles.filter((f) => f.deploymentStatus === "local")}
					variant="list"
					defaultCollapsed={false}
					onFileClick={handleFileClick}
					taskId="example-task-3"
				/>
			</div>

			<div>
				<h2 className="text-xl font-bold mb-4">Files Without Statistics</h2>
				<p className="text-sm mb-4 opacity-70">When additions/deletions are not provided</p>
				<FileChanges
					files={[
						{ path: "src/config.json", deploymentStatus: "local", timestamp: Date.now() },
						{ path: "package.json", deploymentStatus: "deployed", timestamp: Date.now() },
						{ path: "tsconfig.json", deploymentStatus: "local", timestamp: Date.now() },
					]}
					variant="list"
					defaultCollapsed={false}
					taskId="example-task-4"
				/>
			</div>

			<div>
				<h2 className="text-xl font-bold mb-4">Deployment Status Examples</h2>
				<p className="text-sm mb-4 opacity-70">Different deployment statuses with their visual indicators</p>
				<FileChanges
					files={[
						{ path: "local-file.ts", deploymentStatus: "local", timestamp: Date.now() },
						{ path: "dry-run-file.ts", deploymentStatus: "dry-run", timestamp: Date.now() },
						{ path: "deploying-file.ts", deploymentStatus: "deploying", timestamp: Date.now() },
						{ path: "deployed-file.ts", deploymentStatus: "deployed", timestamp: Date.now() },
						{
							path: "failed-file.ts",
							deploymentStatus: "failed",
							error: "Network error",
							timestamp: Date.now(),
						},
					]}
					variant="detail"
					taskId="example-task-5"
				/>
			</div>

			{/* Diff Viewer Modal */}
			{selectedDiffFile && <DiffViewer file={selectedDiffFile} onClose={() => setSelectedDiffFile(null)} />}
		</div>
	)
}

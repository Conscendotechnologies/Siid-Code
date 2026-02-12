/**
 * Utility functions for managing file changes and deployment status
 */

import type { FileChange, DeploymentStatus } from "./FileChanges"

/**
 * Update the deployment status of a specific file
 */
export const updateFileDeploymentStatus = (
	files: FileChange[],
	filePath: string,
	status: DeploymentStatus,
	error?: string,
): FileChange[] => {
	return files.map((file) =>
		file.path === filePath
			? {
					...file,
					deploymentStatus: status,
					error: error || file.error,
					timestamp: Date.now(),
				}
			: file,
	)
}

/**
 * Update the deployment status of multiple files
 */
export const updateMultipleFilesDeploymentStatus = (
	files: FileChange[],
	filePaths: string[],
	status: DeploymentStatus,
): FileChange[] => {
	const pathSet = new Set(filePaths)
	return files.map((file) =>
		pathSet.has(file.path)
			? {
					...file,
					deploymentStatus: status,
					timestamp: Date.now(),
				}
			: file,
	)
}

/**
 * Add or update a file change with diff information
 */
export const addOrUpdateFileChange = (files: FileChange[], newFile: FileChange): FileChange[] => {
	const existingIndex = files.findIndex((f) => f.path === newFile.path)

	if (existingIndex >= 0) {
		// Update existing file
		const updated = [...files]
		updated[existingIndex] = {
			...updated[existingIndex],
			...newFile,
			timestamp: Date.now(),
		}
		return updated
	}

	// Add new file
	return [...files, { ...newFile, timestamp: newFile.timestamp || Date.now() }]
}

/**
 * Remove a file from the changes list
 */
export const removeFileChange = (files: FileChange[], filePath: string): FileChange[] => {
	return files.filter((file) => file.path !== filePath)
}

/**
 * Filter files by deployment status
 */
export const filterByDeploymentStatus = (files: FileChange[], status: DeploymentStatus): FileChange[] => {
	return files.filter((file) => file.deploymentStatus === status)
}

/**
 * Get files grouped by deployment status
 */
export const groupByDeploymentStatus = (files: FileChange[]): Record<DeploymentStatus, FileChange[]> => {
	const grouped: Record<string, FileChange[]> = {
		local: [],
		"dry-run": [],
		deploying: [],
		deployed: [],
		failed: [],
	}

	files.forEach((file) => {
		const status = file.deploymentStatus || "local"
		if (grouped[status]) {
			grouped[status].push(file)
		}
	})

	return grouped as Record<DeploymentStatus, FileChange[]>
}

/**
 * Calculate total statistics for all files
 */
export const calculateTotalStats = (files: FileChange[]) => {
	return files.reduce(
		(acc, file) => ({
			additions: acc.additions + (file.additions || 0),
			deletions: acc.deletions + (file.deletions || 0),
			filesChanged: acc.filesChanged + 1,
		}),
		{ additions: 0, deletions: 0, filesChanged: 0 },
	)
}

/**
 * Sort files by various criteria
 */
export const sortFiles = (
	files: FileChange[],
	sortBy: "name" | "status" | "timestamp" | "additions" | "deletions",
	order: "asc" | "desc" = "asc",
): FileChange[] => {
	const sorted = [...files].sort((a, b) => {
		let comparison = 0

		switch (sortBy) {
			case "name":
				comparison = a.path.localeCompare(b.path)
				break
			case "status":
				comparison = (a.status || "").localeCompare(b.status || "")
				break
			case "timestamp":
				comparison = (a.timestamp || 0) - (b.timestamp || 0)
				break
			case "additions":
				comparison = (a.additions || 0) - (b.additions || 0)
				break
			case "deletions":
				comparison = (a.deletions || 0) - (b.deletions || 0)
				break
		}

		return order === "asc" ? comparison : -comparison
	})

	return sorted
}

/**
 * Generate a simple diff string from before/after content
 * This is a basic implementation - for production, use a proper diff library
 */
export const generateSimpleDiff = (
	filePath: string,
	before: string,
	after: string,
): { diff: string; additions: number; deletions: number } => {
	const beforeLines = before.split("\n")
	const afterLines = after.split("\n")

	const diffLines: string[] = []
	let additions = 0
	let deletions = 0

	diffLines.push(`--- a/${filePath}`)
	diffLines.push(`+++ b/${filePath}`)
	diffLines.push(`@@ -1,${beforeLines.length} +1,${afterLines.length} @@`)

	// Simple line-by-line comparison (not a proper diff algorithm)
	const maxLength = Math.max(beforeLines.length, afterLines.length)

	for (let i = 0; i < maxLength; i++) {
		const beforeLine = beforeLines[i]
		const afterLine = afterLines[i]

		if (beforeLine !== afterLine) {
			if (beforeLine !== undefined) {
				diffLines.push(`-${beforeLine}`)
				deletions++
			}
			if (afterLine !== undefined) {
				diffLines.push(`+${afterLine}`)
				additions++
			}
		} else if (beforeLine !== undefined) {
			diffLines.push(` ${beforeLine}`)
		}
	}

	return {
		diff: diffLines.join("\n"),
		additions,
		deletions,
	}
}

/**
 * Check if a file has pending changes (not deployed)
 */
export const hasPendingChanges = (file: FileChange): boolean => {
	return file.deploymentStatus !== "deployed" && file.deploymentStatus !== "failed"
}

/**
 * Get files that need deployment
 */
export const getFilesNeedingDeployment = (files: FileChange[]): FileChange[] => {
	return files.filter(
		(file) =>
			file.deploymentStatus === "local" ||
			file.deploymentStatus === "dry-run" ||
			file.deploymentStatus === "failed",
	)
}

/**
 * Mark all files as deployed
 */
export const markAllAsDeployed = (files: FileChange[]): FileChange[] => {
	return files.map((file) => ({
		...file,
		deploymentStatus: "deployed" as DeploymentStatus,
		timestamp: Date.now(),
		error: undefined,
	}))
}

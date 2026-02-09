/**
 * Utility to migrate file changes from localStorage to SQLite backend
 * This is a one-time migration that runs when a task is loaded
 */

import { vscode } from "@src/utils/vscode"
import { loadFileChanges } from "./FileChanges"

const MIGRATION_KEY_PREFIX = "fileChanges_migrated_"

/**
 * Check if file changes for a task have been migrated
 */
export const isMigrated = (taskId: string): boolean => {
	try {
		return localStorage.getItem(`${MIGRATION_KEY_PREFIX}${taskId}`) === "true"
	} catch {
		return false
	}
}

/**
 * Mark file changes for a task as migrated
 */
export const markAsMigrated = (taskId: string): void => {
	try {
		localStorage.setItem(`${MIGRATION_KEY_PREFIX}${taskId}`, "true")
	} catch (error) {
		console.error("Failed to mark file changes as migrated:", error)
	}
}

/**
 * Migrate file changes from localStorage to SQLite backend
 * This sends each file change to the backend to be stored in the database
 */
export const migrateFileChangesToBackend = async (taskId: string): Promise<boolean> => {
	// Check if already migrated
	if (isMigrated(taskId)) {
		return true
	}

	try {
		// Load file changes from localStorage
		const localFileChanges = loadFileChanges(taskId)

		if (localFileChanges.length === 0) {
			// No data to migrate, mark as done
			markAsMigrated(taskId)
			return true
		}

		console.debug(`Migrating ${localFileChanges.length} file changes for task ${taskId}`)

		// Send each file change to the backend
		// The backend will store them in SQLite

		// Request the backend to fetch file changes (which will trigger loading)
		// The backend handler should check localStorage migration status
		vscode.postMessage({
			type: "migrateFileChanges",
			text: taskId,
			values: { fileChanges: localFileChanges },
		})

		// Mark as migrated
		markAsMigrated(taskId)

		// Optionally clear localStorage after successful migration
		// clearFileChanges(taskId)

		console.debug(`Successfully migrated file changes for task ${taskId}`)
		return true
	} catch (error) {
		console.error("Failed to migrate file changes:", error)
		return false
	}
}

/**
 * Get all task IDs that have file changes in localStorage
 */
export const getTaskIdsWithLocalChanges = (): string[] => {
	const taskIds: string[] = []
	const prefix = "fileChanges_"

	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i)
			if (key && key.startsWith(prefix) && !key.includes("migrated")) {
				const taskId = key.substring(prefix.length)
				taskIds.push(taskId)
			}
		}
	} catch (error) {
		console.error("Failed to get task IDs with local changes:", error)
	}

	return taskIds
}

/**
 * Migrate all file changes from localStorage to backend
 */
export const migrateAllFileChanges = async (): Promise<void> => {
	const taskIds = getTaskIdsWithLocalChanges()

	console.debug(`Found ${taskIds.length} tasks with local file changes to migrate`)

	for (const taskId of taskIds) {
		await migrateFileChangesToBackend(taskId)
	}
}

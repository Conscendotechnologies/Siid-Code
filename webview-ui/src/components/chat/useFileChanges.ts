/**
 * Custom React hook for managing file changes state
 */

import { useState, useCallback, useEffect } from "react"
import type { FileChange, DeploymentStatus } from "./FileChanges"
import { saveFileChanges, loadFileChanges, clearFileChanges } from "./FileChanges"
import {
	addOrUpdateFileChange,
	updateFileDeploymentStatus,
	updateMultipleFilesDeploymentStatus,
	removeFileChange,
	filterByDeploymentStatus,
	getFilesNeedingDeployment,
	markAllAsDeployed,
} from "./fileChangesUtils"

export interface UseFileChangesReturn {
	files: FileChange[]
	addFile: (file: FileChange) => void
	updateFile: (filePath: string, updates: Partial<FileChange>) => void
	removeFile: (filePath: string) => void
	updateDeploymentStatus: (filePath: string, status: DeploymentStatus, error?: string) => void
	updateMultipleStatuses: (filePaths: string[], status: DeploymentStatus) => void
	filterByStatus: (status: DeploymentStatus) => FileChange[]
	getPendingFiles: () => FileChange[]
	markAllDeployed: () => void
	clearAll: () => void
	saveToStorage: () => void
	loadFromStorage: () => void
}

/**
 * Hook for managing file changes with localStorage persistence
 */
export const useFileChanges = (taskId?: string): UseFileChangesReturn => {
	const [files, setFiles] = useState<FileChange[]>([])

	// Load from localStorage on mount if taskId is provided
	useEffect(() => {
		if (taskId) {
			const savedFiles = loadFileChanges(taskId)
			if (savedFiles.length > 0) {
				setFiles(savedFiles)
			}
		}
	}, [taskId])

	// Auto-save to localStorage when files change
	useEffect(() => {
		if (taskId && files.length > 0) {
			saveFileChanges(taskId, files)
		}
	}, [files, taskId])

	const addFile = useCallback((file: FileChange) => {
		setFiles((prev) => addOrUpdateFileChange(prev, file))
	}, [])

	const updateFile = useCallback((filePath: string, updates: Partial<FileChange>) => {
		setFiles((prev) =>
			prev.map((file) => (file.path === filePath ? { ...file, ...updates, timestamp: Date.now() } : file)),
		)
	}, [])

	const removeFile = useCallback((filePath: string) => {
		setFiles((prev) => removeFileChange(prev, filePath))
	}, [])

	const updateDeploymentStatus = useCallback((filePath: string, status: DeploymentStatus, error?: string) => {
		setFiles((prev) => updateFileDeploymentStatus(prev, filePath, status, error))
	}, [])

	const updateMultipleStatuses = useCallback((filePaths: string[], status: DeploymentStatus) => {
		setFiles((prev) => updateMultipleFilesDeploymentStatus(prev, filePaths, status))
	}, [])

	const filterByStatus = useCallback(
		(status: DeploymentStatus) => {
			return filterByDeploymentStatus(files, status)
		},
		[files],
	)

	const getPendingFiles = useCallback(() => {
		return getFilesNeedingDeployment(files)
	}, [files])

	const markAllDeployed = useCallback(() => {
		setFiles((prev) => markAllAsDeployed(prev))
	}, [])

	const clearAll = useCallback(() => {
		setFiles([])
		if (taskId) {
			clearFileChanges(taskId)
		}
	}, [taskId])

	const saveToStorage = useCallback(() => {
		if (taskId) {
			saveFileChanges(taskId, files)
		}
	}, [taskId, files])

	const loadFromStorage = useCallback(() => {
		if (taskId) {
			const savedFiles = loadFileChanges(taskId)
			setFiles(savedFiles)
		}
	}, [taskId])

	return {
		files,
		addFile,
		updateFile,
		removeFile,
		updateDeploymentStatus,
		updateMultipleStatuses,
		filterByStatus,
		getPendingFiles,
		markAllDeployed,
		clearAll,
		saveToStorage,
		loadFromStorage,
	}
}

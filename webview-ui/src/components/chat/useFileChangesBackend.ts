/**
 * Custom React hook for managing file changes state with SQLite backend
 * This hook fetches file changes from the extension backend (SQLite database)
 * and falls back to localStorage for backward compatibility
 */

import { useState, useCallback, useEffect, useRef } from "react"
import { vscode } from "@src/utils/vscode"
import type { FileChange, DeploymentStatus } from "./FileChanges"
import { loadFileChanges, clearFileChanges as clearLocalStorageFileChanges } from "./FileChanges"
import {
	addOrUpdateFileChange,
	updateFileDeploymentStatus as updateFileDeploymentStatusLocal,
	updateMultipleFilesDeploymentStatus,
	removeFileChange,
	filterByDeploymentStatus,
	getFilesNeedingDeployment,
	markAllAsDeployed,
} from "./fileChangesUtils"

export interface UseFileChangesBackendReturn {
	files: FileChange[]
	isLoading: boolean
	error: string | null
	addFile: (file: FileChange) => void
	updateFile: (filePath: string, updates: Partial<FileChange>) => void
	removeFile: (filePath: string) => void
	updateDeploymentStatus: (filePath: string, status: DeploymentStatus, error?: string) => void
	updateMultipleStatuses: (filePaths: string[], status: DeploymentStatus) => void
	filterByStatus: (status: DeploymentStatus) => FileChange[]
	getPendingFiles: () => FileChange[]
	markAllDeployed: () => void
	clearAll: () => void
	refreshFromBackend: () => void
}

/**
 * Hook for managing file changes with SQLite backend persistence
 * Falls back to localStorage if backend is unavailable
 */
export const useFileChangesBackend = (taskId?: string): UseFileChangesBackendReturn => {
	const [files, setFiles] = useState<FileChange[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null)
	const isLoadingRef = useRef(false)

	// Listen for file changes from the backend
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "fileChanges" && message.fileChanges) {
				setFiles(message.fileChanges)
				setIsLoading(false)
				isLoadingRef.current = false
				setError(null)
			} else if (message.type === "fileChangesStatistics" && message.statistics) {
				// Handle statistics if needed
				console.debug("File changes statistics:", message.statistics)
			}
		}

		messageHandlerRef.current = handleMessage
		window.addEventListener("message", handleMessage)

		return () => {
			if (messageHandlerRef.current) {
				window.removeEventListener("message", messageHandlerRef.current)
			}
		}
	}, [])

	// Fetch file changes from backend on mount and when taskId changes
	useEffect(() => {
		if (taskId) {
			setIsLoading(true)
			isLoadingRef.current = true
			setError(null)

			// Request file changes from backend
			vscode.postMessage({ type: "getFileChanges", text: taskId })

			// Fallback: load from localStorage after a timeout if backend doesn't respond
			const timeoutId = setTimeout(() => {
				if (isLoadingRef.current) {
					console.debug("Backend timeout, falling back to localStorage")
					const savedFiles = loadFileChanges(taskId)
					if (savedFiles.length > 0) {
						setFiles(savedFiles)
					}
					setIsLoading(false)
					isLoadingRef.current = false
				}
			}, 2000)

			return () => clearTimeout(timeoutId)
		}
	}, [taskId])

	const refreshFromBackend = useCallback(() => {
		if (taskId) {
			setIsLoading(true)
			vscode.postMessage({ type: "getFileChanges", text: taskId })
		}
	}, [taskId])

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

	const updateDeploymentStatus = useCallback(
		(filePath: string, status: DeploymentStatus, deployError?: string) => {
			// Update local state
			setFiles((prev) => updateFileDeploymentStatusLocal(prev, filePath, status, deployError))

			// Also update in backend
			if (taskId) {
				vscode.postMessage({
					type: "updateFileDeploymentStatus",
					values: {
						taskId,
						filePath,
						deploymentStatus: status,
						error: deployError,
					},
				})
			}
		},
		[taskId],
	)

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
			// Clear from backend
			vscode.postMessage({ type: "clearFileChanges", text: taskId })
			// Also clear localStorage for backward compatibility
			clearLocalStorageFileChanges(taskId)
		}
	}, [taskId])

	return {
		files,
		isLoading,
		error,
		addFile,
		updateFile,
		removeFile,
		updateDeploymentStatus,
		updateMultipleStatuses,
		filterByStatus,
		getPendingFiles,
		markAllDeployed,
		clearAll,
		refreshFromBackend,
	}
}

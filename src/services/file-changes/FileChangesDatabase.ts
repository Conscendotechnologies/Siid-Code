import * as path from "path"
import * as fs from "fs/promises"
import * as diff from "diff"

export type DeploymentStatus = "local" | "dry-run" | "deploying" | "deployed" | "failed"

export type FileChangeStatus = "modified" | "created" | "deleted"

export interface FileChangeRecord {
	id: number
	taskId: string
	filePath: string
	status: FileChangeStatus
	additions: number
	deletions: number
	deploymentStatus: DeploymentStatus
	timestamp: number
	diff?: string
	error?: string
}

export interface FileChangeInput {
	taskId: string
	filePath: string
	status: FileChangeStatus
	additions?: number
	deletions?: number
	deploymentStatus?: DeploymentStatus
	timestamp?: number
	diff?: string
	error?: string
	oldContent?: string
	newContent?: string
}

interface DatabaseStore {
	nextId: number
	records: FileChangeRecord[]
}

/**
 * JSON-based file changes tracking service
 * Provides persistent storage and querying for file changes across tasks
 * Uses a JSON file for storage (compatible with VSCode extensions)
 */
export class FileChangesDatabase {
	private dbPath: string
	private store: DatabaseStore | null = null

	constructor(storagePath: string) {
		this.dbPath = path.join(storagePath, "file-changes.json")
	}

	/**
	 * Initialize the database and load existing data
	 */
	async initialize(): Promise<void> {
		try {
			// Ensure the directory exists
			await fs.mkdir(path.dirname(this.dbPath), { recursive: true })

			// Try to load existing data
			try {
				const data = await fs.readFile(this.dbPath, "utf-8")
				this.store = JSON.parse(data)
			} catch {
				// File doesn't exist or is invalid, create new store
				this.store = { nextId: 1, records: [] }
				await this.save()
			}
		} catch (error) {
			console.error("Failed to initialize FileChangesDatabase:", error)
			throw error
		}
	}

	/**
	 * Save the database to disk
	 */
	private async save(): Promise<void> {
		if (!this.store) return
		await fs.writeFile(this.dbPath, JSON.stringify(this.store, null, 2), "utf-8")
	}

	/**
	 * Calculate additions and deletions from old and new content
	 */
	private calculateDiff(
		oldContent: string,
		newContent: string,
	): { additions: number; deletions: number; diffText: string } {
		const patches = diff.structuredPatch("file", "file", oldContent, newContent, "", "")

		let additions = 0
		let deletions = 0

		for (const hunk of patches.hunks) {
			for (const line of hunk.lines) {
				if (line.startsWith("+")) {
					additions++
				} else if (line.startsWith("-")) {
					deletions++
				}
			}
		}

		// Create a compact diff string
		const diffText = diff.createPatch("file", oldContent, newContent)

		return { additions, deletions, diffText }
	}

	/**
	 * Add or update a file change record
	 */
	async addFileChange(input: FileChangeInput): Promise<FileChangeRecord> {
		if (!this.store) {
			throw new Error("Database not initialized")
		}

		const timestamp = input.timestamp ?? Date.now()
		let additions = input.additions ?? 0
		let deletions = input.deletions ?? 0
		let diffText = input.diff

		// If oldContent and newContent are provided, calculate diff automatically
		if (input.oldContent !== undefined && input.newContent !== undefined) {
			const diffResult = this.calculateDiff(input.oldContent, input.newContent)
			additions = diffResult.additions
			deletions = diffResult.deletions
			diffText = diffResult.diffText
		}

		// Check if record already exists
		const existingIndex = this.store.records.findIndex(
			(r) => r.taskId === input.taskId && r.filePath === input.filePath,
		)

		const record: FileChangeRecord = {
			id: existingIndex >= 0 ? this.store.records[existingIndex].id : this.store.nextId++,
			taskId: input.taskId,
			filePath: input.filePath,
			status: input.status,
			additions,
			deletions,
			deploymentStatus: input.deploymentStatus ?? "local",
			timestamp,
			diff: diffText,
			error: input.error,
		}

		if (existingIndex >= 0) {
			this.store.records[existingIndex] = record
		} else {
			this.store.records.push(record)
		}

		await this.save()
		return record
	}

	/**
	 * Get all file changes for a specific task
	 */
	async getFileChangesByTask(taskId: string): Promise<FileChangeRecord[]> {
		if (!this.store) {
			throw new Error("Database not initialized")
		}

		return this.store.records.filter((r) => r.taskId === taskId).sort((a, b) => b.timestamp - a.timestamp)
	}

	/**
	 * Get all tasks that modified a specific file
	 */
	async getTasksByFile(filePath: string): Promise<FileChangeRecord[]> {
		if (!this.store) {
			throw new Error("Database not initialized")
		}

		return this.store.records.filter((r) => r.filePath === filePath).sort((a, b) => b.timestamp - a.timestamp)
	}

	/**
	 * Update deployment status for a file change
	 */
	async updateDeploymentStatus(
		taskId: string,
		filePath: string,
		deploymentStatus: DeploymentStatus,
		error?: string,
	): Promise<void> {
		if (!this.store) {
			throw new Error("Database not initialized")
		}

		const record = this.store.records.find((r) => r.taskId === taskId && r.filePath === filePath)
		if (record) {
			record.deploymentStatus = deploymentStatus
			record.error = error
			record.timestamp = Date.now()
			await this.save()
		}
	}

	/**
	 * Update deployment status for multiple files
	 */
	async updateMultipleDeploymentStatus(
		taskId: string,
		filePaths: string[],
		deploymentStatus: DeploymentStatus,
	): Promise<void> {
		if (!this.store) {
			throw new Error("Database not initialized")
		}

		const pathSet = new Set(filePaths)
		const now = Date.now()

		for (const record of this.store.records) {
			if (record.taskId === taskId && pathSet.has(record.filePath)) {
				record.deploymentStatus = deploymentStatus
				record.timestamp = now
			}
		}

		await this.save()
	}

	/**
	 * Get files by deployment status
	 */
	async getFilesByDeploymentStatus(taskId: string, deploymentStatus: DeploymentStatus): Promise<FileChangeRecord[]> {
		if (!this.store) {
			throw new Error("Database not initialized")
		}

		return this.store.records
			.filter((r) => r.taskId === taskId && r.deploymentStatus === deploymentStatus)
			.sort((a, b) => b.timestamp - a.timestamp)
	}

	/**
	 * Get files needing deployment
	 */
	async getFilesNeedingDeployment(taskId: string): Promise<FileChangeRecord[]> {
		if (!this.store) {
			throw new Error("Database not initialized")
		}

		return this.store.records
			.filter(
				(r) =>
					r.taskId === taskId &&
					(r.deploymentStatus === "local" ||
						r.deploymentStatus === "dry-run" ||
						r.deploymentStatus === "failed"),
			)
			.sort((a, b) => b.timestamp - a.timestamp)
	}

	/**
	 * Delete a file change record
	 */
	async deleteFileChange(taskId: string, filePath: string): Promise<void> {
		if (!this.store) {
			throw new Error("Database not initialized")
		}

		this.store.records = this.store.records.filter((r) => !(r.taskId === taskId && r.filePath === filePath))
		await this.save()
	}

	/**
	 * Delete all file changes for a task
	 */
	async deleteAllFileChangesForTask(taskId: string): Promise<void> {
		if (!this.store) {
			throw new Error("Database not initialized")
		}

		this.store.records = this.store.records.filter((r) => r.taskId !== taskId)
		await this.save()
	}

	/**
	 * Get aggregated statistics for a task
	 */
	async getTaskStatistics(taskId: string): Promise<{
		totalFiles: number
		totalAdditions: number
		totalDeletions: number
		byStatus: Record<FileChangeStatus, number>
		byDeploymentStatus: Record<DeploymentStatus, number>
	}> {
		if (!this.store) {
			throw new Error("Database not initialized")
		}

		const taskRecords = this.store.records.filter((r) => r.taskId === taskId)

		const byStatus: Record<string, number> = {}
		const byDeploymentStatus: Record<string, number> = {}
		let totalAdditions = 0
		let totalDeletions = 0

		for (const record of taskRecords) {
			totalAdditions += record.additions
			totalDeletions += record.deletions
			byStatus[record.status] = (byStatus[record.status] || 0) + 1
			byDeploymentStatus[record.deploymentStatus] = (byDeploymentStatus[record.deploymentStatus] || 0) + 1
		}

		return {
			totalFiles: taskRecords.length,
			totalAdditions,
			totalDeletions,
			byStatus: byStatus as Record<FileChangeStatus, number>,
			byDeploymentStatus: byDeploymentStatus as Record<DeploymentStatus, number>,
		}
	}

	/**
	 * Get all files modified across all tasks (analytics)
	 */
	async getAllFileChanges(
		options: {
			limit?: number
			offset?: number
			filePath?: string
			deploymentStatus?: DeploymentStatus
			startDate?: number
			endDate?: number
		} = {},
	): Promise<FileChangeRecord[]> {
		if (!this.store) {
			throw new Error("Database not initialized")
		}

		let results = [...this.store.records]

		if (options.filePath) {
			results = results.filter((r) => r.filePath === options.filePath)
		}

		if (options.deploymentStatus) {
			results = results.filter((r) => r.deploymentStatus === options.deploymentStatus)
		}

		if (options.startDate) {
			results = results.filter((r) => r.timestamp >= options.startDate!)
		}

		if (options.endDate) {
			results = results.filter((r) => r.timestamp <= options.endDate!)
		}

		results.sort((a, b) => b.timestamp - a.timestamp)

		if (options.offset) {
			results = results.slice(options.offset)
		}

		if (options.limit) {
			results = results.slice(0, options.limit)
		}

		return results
	}

	/**
	 * Get most frequently modified files across all tasks
	 */
	async getMostModifiedFiles(limit: number = 10): Promise<Array<{ filePath: string; count: number }>> {
		if (!this.store) {
			throw new Error("Database not initialized")
		}

		const countMap = new Map<string, number>()

		for (const record of this.store.records) {
			countMap.set(record.filePath, (countMap.get(record.filePath) || 0) + 1)
		}

		return Array.from(countMap.entries())
			.map(([filePath, count]) => ({ filePath, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, limit)
	}

	/**
	 * Close the database connection (no-op for JSON storage)
	 */
	async close(): Promise<void> {
		this.store = null
	}
}

import { FileChangesDatabase, FileChangeInput, FileChangeRecord, DeploymentStatus } from "./FileChangesDatabase"

/**
 * Singleton service for managing file changes database
 */
export class FileChangesService {
	private static instance: FileChangesService | null = null
	private database: FileChangesDatabase | null = null

	private constructor() {}

	/**
	 * Get the singleton instance
	 */
	static getInstance(): FileChangesService {
		if (!FileChangesService.instance) {
			FileChangesService.instance = new FileChangesService()
		}
		return FileChangesService.instance
	}

	/**
	 * Initialize the service with storage path
	 */
	async initialize(storagePath: string): Promise<void> {
		if (this.database) {
			return // Already initialized
		}

		this.database = new FileChangesDatabase(storagePath)
		await this.database.initialize()
	}

	/**
	 * Get the database instance
	 */
	getDatabase(): FileChangesDatabase {
		if (!this.database) {
			throw new Error("FileChangesService not initialized. Call initialize() first.")
		}
		return this.database
	}

	/**
	 * Record a file change with automatic diff calculation
	 */
	async recordFileChange(input: FileChangeInput): Promise<FileChangeRecord> {
		return this.getDatabase().addFileChange(input)
	}

	/**
	 * Get all file changes for a task
	 */
	async getTaskFileChanges(taskId: string): Promise<FileChangeRecord[]> {
		return this.getDatabase().getFileChangesByTask(taskId)
	}

	/**
	 * Update deployment status for a file
	 */
	async updateDeploymentStatus(
		taskId: string,
		filePath: string,
		status: DeploymentStatus,
		error?: string,
	): Promise<void> {
		return this.getDatabase().updateDeploymentStatus(taskId, filePath, status, error)
	}

	/**
	 * Shutdown the service
	 */
	async shutdown(): Promise<void> {
		if (this.database) {
			await this.database.close()
			this.database = null
		}
	}

	/**
	 * Reset the singleton (useful for testing)
	 */
	static reset(): void {
		FileChangesService.instance = null
	}
}

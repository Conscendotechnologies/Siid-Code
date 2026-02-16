import { FileChangesService, FileChangeStatus } from "./index"

/**
 * Helper function to track file changes during tool execution
 */
export async function trackFileChange(options: {
	taskId: string
	filePath: string
	status: FileChangeStatus
	oldContent?: string
	newContent?: string
}): Promise<void> {
	try {
		const service = FileChangesService.getInstance()

		await service.recordFileChange({
			taskId: options.taskId,
			filePath: options.filePath,
			status: options.status,
			oldContent: options.oldContent,
			newContent: options.newContent,
			deploymentStatus: "local",
			timestamp: Date.now(),
		})
	} catch (error) {
		// Log error but don't fail the tool execution
		console.error("Failed to track file change:", error)
	}
}

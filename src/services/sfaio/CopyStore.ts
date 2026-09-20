import * as fs from "fs/promises"
import * as path from "path"
import os from "os"

/**
 * CopyStore manages filesystem-based snapshots for SFAIO.
 * It copies files to a shadow directory for isolated background task execution.
 * Reverting is just a recursive overwrite back to the main workspace.
 */
export class CopyStore {
	private snapshotsDir: string

	constructor(globalStorageDir: string) {
		this.snapshotsDir = path.join(globalStorageDir, "sfaio_snapshots")
	}

	/**
	 * Creates a snapshot of the workspace (or specific path) into a unique shadow directory.
	 * @param sourcePath The path to copy from (usually the workspace root)
	 * @param snapshotId A unique identifier for this snapshot (e.g., taskId)
	 * @returns The path to the snapshot directory
	 */
	async createSnapshot(sourcePath: string, snapshotId: string): Promise<string> {
		const targetPath = path.join(this.snapshotsDir, snapshotId)
		await fs.mkdir(targetPath, { recursive: true })
		await fs.cp(sourcePath, targetPath, { recursive: true })
		return targetPath
	}

	/**
	 * Restores a snapshot back to the original source path, recursively overwriting it.
	 * @param snapshotId The unique identifier of the snapshot to restore
	 * @param destinationPath The path to restore to (usually the workspace root)
	 */
	async restoreSnapshot(snapshotId: string, destinationPath: string): Promise<void> {
		const sourcePath = path.join(this.snapshotsDir, snapshotId)
		const exists = await fs.stat(sourcePath).catch(() => null)
		if (!exists) {
			throw new Error(`Snapshot ${snapshotId} does not exist.`)
		}
		
		// Overwrite the destination with the snapshot
		await fs.cp(sourcePath, destinationPath, { recursive: true, force: true })
	}

	/**
	 * Deletes a snapshot to free up space.
	 * @param snapshotId The unique identifier of the snapshot to delete
	 */
	async deleteSnapshot(snapshotId: string): Promise<void> {
		const targetPath = path.join(this.snapshotsDir, snapshotId)
		await fs.rm(targetPath, { recursive: true, force: true })
	}
}

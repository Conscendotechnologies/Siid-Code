import pWaitFor from "p-wait-for"
import * as path from "path"
import * as vscode from "vscode"

import { TelemetryService } from "@siid-code/telemetry"

import { Task } from "../task/Task"

import { getWorkspacePath } from "../../utils/path"
import { checkGitInstalled } from "../../utils/git"
import { t } from "../../i18n"

import { ClineApiReqInfo } from "../../shared/ExtensionMessage"
import { getApiMetrics } from "../../shared/getApiMetrics"

import { DIFF_VIEW_URI_SCHEME } from "../../integrations/editor/DiffViewProvider"
import { withEditorColumn } from "../../integrations/editor/editorColumn"

import { CheckpointServiceOptions, RepoPerTaskCheckpointService } from "../../services/checkpoints"
import { getDeploymentStatuses } from "../../services/file-changes/deploymentStatus"

/**
 * In-flight initializations, keyed by task.
 *
 * `cline.checkpointService` is only assigned after initShadowGit resolves, so
 * without this every concurrent caller starts its own `git init` on the same
 * directory. They collide ("could not lock config file"), and each failure
 * disables checkpoints for the whole task.
 */
const initializing = new Map<string, Promise<RepoPerTaskCheckpointService | undefined>>()

export async function getCheckpointService(
	cline: Task,
	options: { interval?: number; timeout?: number } = {},
): Promise<RepoPerTaskCheckpointService | undefined> {
	if (!cline.enableCheckpoints) {
		return undefined
	}

	// Already built and ready - the common case, no need to serialize.
	if (cline.checkpointService && !cline.checkpointServiceInitializing) {
		return cline.checkpointService
	}

	const pending = initializing.get(cline.taskId)

	if (pending) {
		return pending
	}

	const promise = initCheckpointService(cline, options).finally(() => initializing.delete(cline.taskId))

	initializing.set(cline.taskId, promise)

	return promise
}

async function initCheckpointService(
	cline: Task,
	{ interval = 250, timeout = 15_000 }: { interval?: number; timeout?: number } = {},
) {
	if (!cline.enableCheckpoints) {
		return undefined
	}

	if (cline.checkpointService) {
		if (cline.checkpointServiceInitializing) {
			console.log("[Task#getCheckpointService] checkpoint service is still initializing")
			const service = cline.checkpointService
			await pWaitFor(
				() => {
					console.log("[Task#getCheckpointService] waiting for service to initialize")
					return service.isInitialized
				},
				{ interval, timeout },
			)
			return service.isInitialized ? cline.checkpointService : undefined
		} else {
			return cline.checkpointService
		}
	}

	const provider = cline.providerRef.deref()

	const log = (message: string) => {
		console.log(message)

		try {
			provider?.log(message)
		} catch (err) {
			// NO-OP
		}
	}

	console.log("[Task#getCheckpointService] initializing checkpoints service")

	try {
		const workspaceDir = getWorkspacePath()

		if (!workspaceDir) {
			log("[Task#getCheckpointService] workspace folder not found, disabling checkpoints")
			cline.enableCheckpoints = false
			return undefined
		}

		const globalStorageDir = provider?.context.globalStorageUri.fsPath

		if (!globalStorageDir) {
			log("[Task#getCheckpointService] globalStorageDir not found, disabling checkpoints")
			cline.enableCheckpoints = false
			return undefined
		}

		const options: CheckpointServiceOptions = {
			taskId: cline.taskId,
			workspaceDir,
			shadowDir: globalStorageDir,
			log,
		}

		const service = RepoPerTaskCheckpointService.create(options)
		cline.checkpointServiceInitializing = true

		// Check if Git is installed before initializing the service
		// Only assign the service after successful initialization
		try {
			await checkGitInstallation(cline, service, log, provider)
			cline.checkpointService = service
			return service
		} catch (err) {
			// Clean up on failure
			cline.checkpointServiceInitializing = false
			cline.enableCheckpoints = false
			throw err
		}
	} catch (err) {
		log(`[Task#getCheckpointService] ${err.message}`)
		cline.enableCheckpoints = false
		return undefined
	}
}

async function checkGitInstallation(
	cline: Task,
	service: RepoPerTaskCheckpointService,
	log: (message: string) => void,
	provider: any,
) {
	try {
		const gitInstalled = await checkGitInstalled()

		if (!gitInstalled) {
			log("[Task#getCheckpointService] Git is not installed, disabling checkpoints")
			cline.enableCheckpoints = false
			cline.checkpointServiceInitializing = false

			// Show user-friendly notification
			const selection = await vscode.window.showWarningMessage(
				t("common:errors.git_not_installed"),
				t("common:buttons.learn_more"),
			)

			if (selection === t("common:buttons.learn_more")) {
				await vscode.env.openExternal(vscode.Uri.parse("https://git-scm.com/downloads"))
			}

			return
		}

		// Git is installed, proceed with initialization
		service.on("initialize", () => {
			log("[Task#getCheckpointService] service initialized")
			cline.checkpointServiceInitializing = false
		})

		service.on("checkpoint", ({ fromHash: from, toHash: to }) => {
			try {
				provider?.postMessageToWebview({ type: "currentCheckpointUpdated", text: to })

				// A checkpoint means the workspace changed - refresh the file
				// list. Build it straight off `service`: routing through
				// getCheckpointService here would re-enter initialization from
				// inside its own event handler.
				postFileChangesFrom(cline, service).catch((err) => {
					log("[Task#getCheckpointService] caught unexpected error in postFileChanges")
					console.error(err)
				})

				cline
					.say("checkpoint_saved", to, undefined, undefined, { from, to }, undefined, {
						isNonInteractive: true,
					})
					.catch((err) => {
						log("[Task#getCheckpointService] caught unexpected error in say('checkpoint_saved')")
						console.error(err)
					})
			} catch (err) {
				log("[Task#getCheckpointService] caught unexpected error in on('checkpoint'), disabling checkpoints")
				console.error(err)
				cline.enableCheckpoints = false
			}
		})

		log("[Task#getCheckpointService] initializing shadow git")
		try {
			await service.initShadowGit()
		} catch (err) {
			// One-way switch: from here on checkpoints, the file-changes panel,
			// and per-file diffs are all silently disabled for this task.
			log(
				`[Task#getCheckpointService] initShadowGit -> ${err.message} - DISABLING checkpoints, file changes and diffs for this task`,
			)
			cline.enableCheckpoints = false
		}
	} catch (err) {
		log(`[Task#getCheckpointService] Unexpected error during Git check: ${err.message}`)
		console.error("Git check error:", err)
		cline.enableCheckpoints = false
		cline.checkpointServiceInitializing = false
	}
}

export async function checkpointSave(cline: Task, force = false) {
	const service = await getCheckpointService(cline)

	if (!service) {
		return
	}

	if (!service.isInitialized) {
		const provider = cline.providerRef.deref()
		provider?.log("[checkpointSave] checkpoints didn't initialize in time, disabling checkpoints for this task")
		cline.enableCheckpoints = false
		return
	}

	TelemetryService.instance.captureCheckpointCreated(cline.taskId)

	// Start the checkpoint process in the background.
	return service.saveCheckpoint(`Task: ${cline.taskId}, Time: ${Date.now()}`, { allowEmpty: force }).catch((err) => {
		console.error("[Task#checkpointSave] caught unexpected error, disabling checkpoints", err)
		cline.enableCheckpoints = false
	})
}

export type CheckpointRestoreOptions = {
	ts: number
	commitHash: string
	mode: "preview" | "restore"
}

export async function checkpointRestore(cline: Task, { ts, commitHash, mode }: CheckpointRestoreOptions) {
	const service = await getCheckpointService(cline)

	if (!service) {
		return
	}

	const index = cline.clineMessages.findIndex((m) => m.ts === ts)

	if (index === -1) {
		return
	}

	const provider = cline.providerRef.deref()

	try {
		await service.restoreCheckpoint(commitHash)
		TelemetryService.instance.captureCheckpointRestored(cline.taskId)
		await provider?.postMessageToWebview({ type: "currentCheckpointUpdated", text: commitHash })

		if (mode === "restore") {
			await cline.overwriteApiConversationHistory(cline.apiConversationHistory.filter((m) => !m.ts || m.ts < ts))

			const deletedMessages = cline.clineMessages.slice(index + 1)

			const { totalTokensIn, totalTokensOut, totalCacheWrites, totalCacheReads, totalCost } = getApiMetrics(
				cline.combineMessages(deletedMessages),
			)

			await cline.overwriteClineMessages(cline.clineMessages.slice(0, index + 1))

			// TODO: Verify that this is working as expected.
			await cline.say(
				"api_req_deleted",
				JSON.stringify({
					tokensIn: totalTokensIn,
					tokensOut: totalTokensOut,
					cacheWrites: totalCacheWrites,
					cacheReads: totalCacheReads,
					cost: totalCost,
				} satisfies ClineApiReqInfo),
			)
		}

		// The task is already cancelled by the provider beforehand, but we
		// need to re-init to get the updated messages.
		//
		// This was take from Cline's implementation of the checkpoints
		// feature. The cline instance will hang if we don't cancel twice,
		// so this is currently necessary, but it seems like a complicated
		// and hacky solution to a problem that I don't fully understand.
		// I'd like to revisit this in the future and try to improve the
		// task flow and the communication between the webview and the
		// Cline instance.
		provider?.cancelTask()
	} catch (err) {
		provider?.log("[checkpointRestore] disabling checkpoints for this task")
		cline.enableCheckpoints = false
	}
}

export type CheckpointDiffOptions = {
	ts: number
	previousCommitHash?: string
	commitHash: string
	mode: "full" | "checkpoint"
}

export async function checkpointDiff(cline: Task, { ts, previousCommitHash, commitHash, mode }: CheckpointDiffOptions) {
	const service = await getCheckpointService(cline)

	if (!service) {
		return
	}

	TelemetryService.instance.captureCheckpointDiffed(cline.taskId)

	// Both modes end at the checkpoint that was clicked; they differ only in
	// where they start. "full" spans the whole task, "checkpoint" just the one
	// step. Diffing forward from the clicked hash would show changes that came
	// after it - the opposite of what either label promises.
	const taskStart = await service.getTaskStartHash()
	const from = mode === "full" ? taskStart : (previousCommitHash ?? taskStart)

	try {
		const changes = await service.getDiff({ from, to: commitHash })

		if (!changes?.length) {
			vscode.window.showInformationMessage("No changes found.")
			return
		}

		await vscode.commands.executeCommand(
			"vscode.changes",
			mode === "full" ? "Changes since task started" : "Changes since previous checkpoint",
			changes.map((change) => [
				vscode.Uri.file(change.paths.absolute),
				vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${change.paths.relative}`).with({
					query: Buffer.from(change.content.before ?? "").toString("base64"),
				}),
				vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${change.paths.relative}`).with({
					query: Buffer.from(change.content.after ?? "").toString("base64"),
				}),
			]),
		)
	} catch (err) {
		const provider = cline.providerRef.deref()
		provider?.log("[checkpointDiff] disabling checkpoints for this task")
		cline.enableCheckpoints = false
	}
}

/**
 * Files changed since the task started, with per-file +/- counts from git,
 * merged with the deployment status we track separately.
 *
 * Returns [] when checkpoints are unavailable (disabled, git missing, nested
 * repos) - the webview renders an empty state rather than stale data.
 */
export async function getTaskFileChanges(cline: Task) {
	const service = await getCheckpointService(cline)

	if (!service) {
		// The usual reason the panel is empty. enableCheckpoints is one-way, so
		// once something flips it off this is silent for the rest of the task.
		cline.providerRef
			.deref()
			?.log(
				`[fileChanges] no checkpoint service (enableCheckpoints=${cline.enableCheckpoints}) - list will be empty`,
			)
		return []
	}

	return fileChangesFrom(cline, service)
}

/**
 * Build the list from an already-resolved service.
 *
 * Callers inside the service's own event handlers must use this rather than
 * getTaskFileChanges - that would re-enter initialization, and any throw there
 * is caught by the handler and permanently disables checkpoints for the task.
 */
async function fileChangesFrom(cline: Task, service: RepoPerTaskCheckpointService) {
	const log = (message: string) => cline.providerRef.deref()?.log(`[fileChanges] ${message}`)

	try {
		const summary = await service.getFileChangeSummary()
		const deployment = getDeploymentStatuses(cline.taskId)

		// An empty summary is indistinguishable from a broken one in the UI -
		// the panel just doesn't render - so say which it was.
		log(
			summary.length === 0
				? `no files changed since task start (base=${(await service.getTaskStartHash())?.slice(0, 8)})`
				: `${summary.length} file(s): ${summary.map((f) => `${f.path} +${f.additions}/-${f.deletions}`).join(", ")}`,
		)

		return summary.map((file) => {
			const deployed = deployment.get(file.path)

			return {
				path: file.path,
				additions: file.additions,
				deletions: file.deletions,
				status: file.status,
				deploymentStatus: deployed?.status,
				error: deployed?.error,
			}
		})
	} catch (err) {
		log(`failed: ${err instanceof Error ? err.message : String(err)}`)
		return []
	}
}

/**
 * Open a VS Code diff of one file.
 *
 * With no hashes this shows the whole task: content at task start vs. now,
 * matching the cumulative counts in the file-changes panel. Passing `from`/`to`
 * scopes it to a single operation instead, so an inline edit row can show just
 * the change it reports.
 *
 * Returns false when the shadow repo can't supply a baseline (checkpoints
 * disabled, or the file didn't change in that range), so the caller can fall
 * back to just opening the file.
 */
export async function openTaskFileDiff(
	cline: Task,
	relPath: string,
	range?: { from?: string; to?: string },
): Promise<boolean> {
	const log = (message: string) => cline.providerRef.deref()?.log(`[openTaskFileDiff] ${message}`)
	const service = await getCheckpointService(cline)

	if (!service) {
		log(`no checkpoint service (enableCheckpoints=${cline.enableCheckpoints}) - falling back to opening the file`)
		return false
	}

	try {
		const changes = await service.getDiff({ from: range?.from, to: range?.to })
		const change = changes.find((c) => c.paths.relative === relPath)

		if (!change) {
			// Usually a path-shape mismatch, so log both sides.
			log(
				`${relPath} not in diff (${changes.length} changed: ${changes.map((c) => c.paths.relative).join(", ")})`,
			)
			return false
		}

		const fileName = path.basename(relPath)
		const scoped = !!(range?.from || range?.to)

		// A scoped diff compares two commits, so the "after" side is historical
		// content, not the file on disk.
		const after = scoped
			? vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${relPath}`).with({
					query: Buffer.from(change.content.after ?? "").toString("base64"),
				})
			: vscode.Uri.file(change.paths.absolute)

		await vscode.commands.executeCommand(
			"vscode.diff",
			vscode.Uri.parse(`${DIFF_VIEW_URI_SCHEME}:${relPath}`).with({
				query: Buffer.from(change.content.before ?? "").toString("base64"),
			}),
			after,
			`${fileName}: ${scoped ? "Changes in this edit" : "Changes since task started"}`,
			withEditorColumn({ preview: true }),
		)

		return true
	} catch (err) {
		log(`failed: ${err instanceof Error ? err.message : String(err)}`)
		return false
	}
}

/**
 * Restore one file to its content at task start, leaving every other file
 * alone. Per-file counterpart to restoreCheckpoint.
 */
export async function revertTaskFile(cline: Task, relPath: string): Promise<boolean> {
	const service = await getCheckpointService(cline)

	if (!service) {
		return false
	}

	try {
		const taskStart = await service.getTaskStartHash()

		if (!taskStart) {
			return false
		}

		await service.revertFile(taskStart, relPath)
		await postFileChangesFrom(cline, service)
		return true
	} catch (err) {
		cline.providerRef.deref()?.log(`[revertTaskFile] ${err instanceof Error ? err.message : String(err)}`)
		return false
	}
}

/** Push the current file-change list to the webview. */
export async function postFileChanges(cline: Task) {
	const service = await getCheckpointService(cline)

	if (service) {
		await postFileChangesFrom(cline, service)
	}
}

/** Push variant for callers that already hold the service - see fileChangesFrom. */
async function postFileChangesFrom(cline: Task, service: RepoPerTaskCheckpointService) {
	const provider = cline.providerRef.deref()

	if (!provider) {
		return
	}

	const fileChanges = await fileChangesFrom(cline, service)
	await provider.postMessageToWebview({ type: "fileChanges", fileChanges })
}

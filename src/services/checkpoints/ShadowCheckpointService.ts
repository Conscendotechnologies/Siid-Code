import fs from "fs/promises"
import os from "os"
import * as path from "path"
import crypto from "crypto"
import EventEmitter from "events"

import simpleGit, { SimpleGit } from "simple-git"
import pWaitFor from "p-wait-for"

import { fileExistsAtPath } from "../../utils/fs"
import { executeRipgrep } from "../../services/search/file-search"

import { CheckpointDiff, CheckpointResult, CheckpointEventMap, FileChangeSummary } from "./types"
import { getExcludePatterns } from "./excludes"

export abstract class ShadowCheckpointService extends EventEmitter {
	public readonly taskId: string
	public readonly checkpointsDir: string
	public readonly workspaceDir: string

	protected _checkpoints: string[] = []
	protected _baseHash?: string

	protected readonly dotGitDir: string
	protected git?: SimpleGit
	protected readonly log: (message: string) => void
	protected shadowGitConfigWorktree?: string

	// Tail of the git queue. Never rejects, so one failure can't stall later work.
	private gitQueue: Promise<unknown> = Promise.resolve()

	/**
	 * Run git work that touches the index one operation at a time.
	 *
	 * Callers resume together from the shared init promise, and concurrent
	 * `git add`s collide on index.lock. stageAll swallows that failure, so the
	 * result would be a silently incomplete checkpoint or file list.
	 *
	 * Not re-entrant: queued work must call the private implementations.
	 */
	private enqueueGit<T>(operation: () => Promise<T>): Promise<T> {
		const result = this.gitQueue.then(operation)
		this.gitQueue = result.catch(() => {})
		return result
	}

	public get baseHash() {
		return this._baseHash
	}

	protected set baseHash(value: string | undefined) {
		this._baseHash = value
	}

	public get isInitialized() {
		return !!this.git
	}

	public getCheckpoints(): string[] {
		return this._checkpoints.slice()
	}

	constructor(taskId: string, checkpointsDir: string, workspaceDir: string, log: (message: string) => void) {
		super()

		const homedir = os.homedir()
		const desktopPath = path.join(homedir, "Desktop")
		const documentsPath = path.join(homedir, "Documents")
		const downloadsPath = path.join(homedir, "Downloads")
		const protectedPaths = [homedir, desktopPath, documentsPath, downloadsPath]

		if (protectedPaths.includes(workspaceDir)) {
			throw new Error(`Cannot use checkpoints in ${workspaceDir}`)
		}

		this.taskId = taskId
		this.checkpointsDir = checkpointsDir
		this.workspaceDir = workspaceDir

		this.dotGitDir = path.join(this.checkpointsDir, ".git")
		this.log = log
	}

	public async initShadowGit(onInit?: () => Promise<void>) {
		if (this.git) {
			throw new Error("Shadow git repo already initialized")
		}

		const hasNestedGitRepos = await this.hasNestedGitRepositories()

		if (hasNestedGitRepos) {
			throw new Error(
				"Checkpoints are disabled because nested git repositories were detected in the workspace. " +
					"Please remove or relocate nested git repositories to use the checkpoints feature.",
			)
		}

		await fs.mkdir(this.checkpointsDir, { recursive: true })
		const git = simpleGit(this.checkpointsDir)
		const gitVersion = await git.version()
		this.log(`[${this.constructor.name}#create] git = ${gitVersion}`)

		let created = false
		const startTime = Date.now()

		if (await fileExistsAtPath(this.dotGitDir)) {
			this.log(`[${this.constructor.name}#initShadowGit] shadow git repo already exists at ${this.dotGitDir}`)
			const worktree = await this.getShadowGitConfigWorktree(git)

			if (worktree !== this.workspaceDir) {
				throw new Error(
					`Checkpoints can only be used in the original workspace: ${worktree} !== ${this.workspaceDir}`,
				)
			}

			await this.writeExcludeFile()
			// Patterns may have grown since this repo was created.
			await this.untrackExcluded(git)
			this.baseHash = await git.revparse(["HEAD"])
		} else {
			this.log(`[${this.constructor.name}#initShadowGit] creating shadow git repo at ${this.checkpointsDir}`)
			await git.init()
			await git.addConfig("core.worktree", this.workspaceDir) // Sets the working tree to the current workspace.
			await git.addConfig("commit.gpgSign", "false") // Disable commit signing for shadow repo.
			await git.addConfig("user.name", "Roo Code")
			await git.addConfig("user.email", "noreply@example.com")
			await this.writeExcludeFile()
			await this.stageAll(git)
			const { commit } = await git.commit("initial commit", { "--allow-empty": null })
			this.baseHash = commit
			created = true
		}

		const duration = Date.now() - startTime

		this.log(
			`[${this.constructor.name}#initShadowGit] initialized shadow repo with base commit ${this.baseHash} in ${duration}ms`,
		)

		this.git = git

		await onInit?.()

		this.emit("initialize", {
			type: "initialize",
			workspaceDir: this.workspaceDir,
			baseHash: this.baseHash,
			created,
			duration,
		})

		return { created, duration }
	}

	// Add basic excludes directly in git config, while respecting any
	// .gitignore in the workspace.
	// .git/info/exclude is local to the shadow git repo, so it's not
	// shared with the main repo - and won't conflict with user's
	// .gitignore.
	protected async writeExcludeFile() {
		await fs.mkdir(path.join(this.dotGitDir, "info"), { recursive: true })
		const patterns = await getExcludePatterns(this.workspaceDir)
		await fs.writeFile(path.join(this.dotGitDir, "info", "exclude"), patterns.join("\n"))
	}

	/**
	 * Drop already-tracked files that the current excludes cover.
	 *
	 * info/exclude only applies to *untracked* paths, so a repo created before
	 * a pattern was added keeps reporting those files forever. Untracking is
	 * index-only (`--cached`) - nothing is removed from the workspace.
	 */
	private async untrackExcluded(git: SimpleGit) {
		try {
			const ignored = await git.raw(["ls-files", "--cached", "--ignored", "--exclude-standard"])
			const paths = ignored.split("\n").filter((line) => line.trim())

			if (paths.length === 0) {
				return
			}

			await git.raw(["rm", "--cached", "-r", "--quiet", "--", ...paths])
			this.log(`[${this.constructor.name}#untrackExcluded] untracked ${paths.length} newly-excluded file(s)`)
		} catch (error) {
			// Non-critical: the panel shows extra rows, nothing breaks.
			this.log(
				`[${this.constructor.name}#untrackExcluded] failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			)
		}
	}

	private async stageAll(git: SimpleGit) {
		try {
			await git.add(".")
		} catch (error) {
			this.log(
				`[${this.constructor.name}#stageAll] failed to add files to git: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private async hasNestedGitRepositories(): Promise<boolean> {
		try {
			// Find all .git directories that are not at the root level.
			const args = ["--files", "--hidden", "--follow", "-g", "**/.git/HEAD", this.workspaceDir]

			const gitPaths = await executeRipgrep({ args, workspacePath: this.workspaceDir })

			// Filter to only include nested git directories (not the root .git).
			const nestedGitPaths = gitPaths.filter(
				({ type, path }) =>
					type === "folder" && path.includes(".git") && !path.startsWith(".git") && path !== ".git",
			)

			if (nestedGitPaths.length > 0) {
				this.log(
					`[${this.constructor.name}#hasNestedGitRepositories] found ${nestedGitPaths.length} nested git repositories: ${nestedGitPaths.map((p) => p.path).join(", ")}`,
				)
				return true
			}

			return false
		} catch (error) {
			this.log(
				`[${this.constructor.name}#hasNestedGitRepositories] failed to check for nested git repos: ${error instanceof Error ? error.message : String(error)}`,
			)

			// If we can't check, assume there are no nested repos to avoid blocking the feature.
			return false
		}
	}

	private async getShadowGitConfigWorktree(git: SimpleGit) {
		if (!this.shadowGitConfigWorktree) {
			try {
				this.shadowGitConfigWorktree = (await git.getConfig("core.worktree")).value || undefined
			} catch (error) {
				this.log(
					`[${this.constructor.name}#getShadowGitConfigWorktree] failed to get core.worktree: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		return this.shadowGitConfigWorktree
	}

	public async saveCheckpoint(
		message: string,
		options?: { allowEmpty?: boolean },
	): Promise<CheckpointResult | undefined> {
		return this.enqueueGit(() => this.saveCheckpointNow(message, options))
	}

	private async saveCheckpointNow(
		message: string,
		options?: { allowEmpty?: boolean },
	): Promise<CheckpointResult | undefined> {
		try {
			this.log(
				`[${this.constructor.name}#saveCheckpoint] starting checkpoint save (allowEmpty: ${options?.allowEmpty ?? false})`,
			)

			if (!this.git) {
				throw new Error("Shadow git repo not initialized")
			}

			const startTime = Date.now()
			await this.stageAll(this.git)
			const commitArgs = options?.allowEmpty ? { "--allow-empty": null } : undefined
			const result = await this.git.commit(message, commitArgs)
			const fromHash = this._checkpoints[this._checkpoints.length - 1] ?? this.baseHash!
			const toHash = result.commit || fromHash
			this._checkpoints.push(toHash)
			const duration = Date.now() - startTime

			if (result.commit) {
				this.emit("checkpoint", { type: "checkpoint", fromHash, toHash, duration })
			}

			if (result.commit) {
				this.log(
					`[${this.constructor.name}#saveCheckpoint] checkpoint saved in ${duration}ms -> ${result.commit}`,
				)
				return result
			} else {
				this.log(`[${this.constructor.name}#saveCheckpoint] found no changes to commit in ${duration}ms`)
				return undefined
			}
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e))
			this.log(`[${this.constructor.name}#saveCheckpoint] failed to create checkpoint: ${error.message}`)
			this.emit("error", { type: "error", error })
			throw error
		}
	}

	public async restoreCheckpoint(commitHash: string) {
		return this.enqueueGit(() => this.restoreCheckpointNow(commitHash))
	}

	private async restoreCheckpointNow(commitHash: string) {
		try {
			this.log(`[${this.constructor.name}#restoreCheckpoint] starting checkpoint restore`)

			if (!this.git) {
				throw new Error("Shadow git repo not initialized")
			}

			const start = Date.now()
			await this.git.clean("f", ["-d", "-f"])
			await this.git.reset(["--hard", commitHash])

			// Remove all checkpoints after the specified commitHash.
			const checkpointIndex = this._checkpoints.indexOf(commitHash)

			if (checkpointIndex !== -1) {
				this._checkpoints = this._checkpoints.slice(0, checkpointIndex + 1)
			}

			const duration = Date.now() - start
			this.emit("restore", { type: "restore", commitHash, duration })
			this.log(`[${this.constructor.name}#restoreCheckpoint] restored checkpoint ${commitHash} in ${duration}ms`)
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e))
			this.log(`[${this.constructor.name}#restoreCheckpoint] failed to restore checkpoint: ${error.message}`)
			this.emit("error", { type: "error", error })
			throw error
		}
	}

	/**
	 * The shadow repo's root commit - the workspace as it was when the task
	 * started.
	 *
	 * Note this is NOT `baseHash`: on a repo that already exists, `baseHash` is
	 * set to whatever HEAD happened to be when the service was constructed, so
	 * after the first checkpoint it points at that checkpoint rather than at
	 * the task's starting state.
	 */
	public async getTaskStartHash(): Promise<string | undefined> {
		if (!this.git) {
			return undefined
		}

		try {
			return (await this.git.raw(["rev-list", "--max-parents=0", "HEAD"])).trim() || undefined
		} catch {
			return undefined
		}
	}

	public async getDiff(range: { from?: string; to?: string }): Promise<CheckpointDiff[]> {
		return this.enqueueGit(() => this.getDiffNow(range))
	}

	private async getDiffNow({ from, to }: { from?: string; to?: string }): Promise<CheckpointDiff[]> {
		if (!this.git) {
			throw new Error("Shadow git repo not initialized")
		}

		const result: CheckpointDiff[] = []

		const base = from ?? (await this.getTaskStartHash())

		if (!base) {
			return result
		}

		// Stage all changes so that untracked files appear in diff summary.
		await this.stageAll(this.git)

		this.log(`[${this.constructor.name}#getDiff] diffing ${to ? `${base}..${to}` : `${base}..HEAD`}`)
		const { files } = to ? await this.git.diffSummary([`${base}..${to}`]) : await this.git.diffSummary([base])

		const cwdPath = (await this.getShadowGitConfigWorktree(this.git)) || this.workspaceDir || ""

		for (const file of files) {
			const relPath = file.file
			const absPath = path.join(cwdPath, relPath)
			const before = await this.git.show([`${base}:${relPath}`]).catch(() => "")

			const after = to
				? await this.git.show([`${to}:${relPath}`]).catch(() => "")
				: await fs.readFile(absPath, "utf8").catch(() => "")

			result.push({ paths: { relative: relPath, absolute: absPath }, content: { before, after } })
		}

		return result
	}

	/**
	 * Per-file additions/deletions for everything that changed since `from`
	 * (defaults to the task's base commit) up to the current working tree.
	 *
	 * Cumulative by construction: a file edited several times reports its total
	 * change, not just the most recent edit. Note this reflects the workspace,
	 * so changes made outside the agent (manual edits, build output) are
	 * included - git cannot attribute a change to its author.
	 */
	public async getFileChangeSummary(from?: string): Promise<FileChangeSummary[]> {
		return this.enqueueGit(() => this.getFileChangeSummaryNow(from))
	}

	private async getFileChangeSummaryNow(from?: string): Promise<FileChangeSummary[]> {
		if (!this.git) {
			throw new Error("Shadow git repo not initialized")
		}

		const base = from ?? (await this.getTaskStartHash())

		if (!base) {
			return []
		}

		// Stage all changes so that untracked files appear in the diff.
		await this.stageAll(this.git)

		const { files } = await this.git.diffSummary([base])

		if (files.length === 0) {
			return []
		}

		// diffSummary doesn't report create/delete/rename, so pair it with a
		// name-status pass keyed by path.
		const statusByPath = new Map<string, FileChangeSummary["status"]>()

		try {
			const raw = await this.git.raw(["diff", "--name-status", "-M", base])

			for (const line of raw.split("\n")) {
				if (!line.trim()) {
					continue
				}

				// "A\tpath", "M\tpath", "D\tpath", "R100\told\tnew"
				const parts = line.split("\t")
				const code = parts[0]?.[0]
				// For renames git lists old path then new; the new path is what we show.
				const filePath = parts[parts.length - 1]

				if (!code || !filePath) {
					continue
				}

				const status =
					code === "A" ? "created" : code === "D" ? "deleted" : code === "R" ? "renamed" : "modified"

				statusByPath.set(filePath, status)
			}
		} catch (error) {
			this.log(
				`[${this.constructor.name}#getFileChangeSummary] failed to read name-status: ${
					error instanceof Error ? error.message : String(error)
				}`,
			)
		}

		return files.map((file) => {
			// Binary files report no insertions/deletions.
			const { insertions, deletions } = file as { insertions?: number; deletions?: number }

			return {
				path: file.file,
				additions: insertions ?? 0,
				deletions: deletions ?? 0,
				status: statusByPath.get(file.file) ?? "modified",
			}
		})
	}

	/**
	 * Restore a single file to its content at `commitHash`, leaving the rest of
	 * the workspace untouched.
	 *
	 * A file that didn't exist at that commit is deleted rather than restored -
	 * `git checkout` errors on an unknown path, so handle that case directly.
	 */
	public async revertFile(commitHash: string, relPath: string): Promise<void> {
		return this.enqueueGit(() => this.revertFileNow(commitHash, relPath))
	}

	private async revertFileNow(commitHash: string, relPath: string): Promise<void> {
		if (!this.git) {
			throw new Error("Shadow git repo not initialized")
		}

		const existedAtBase = await this.git
			.raw(["cat-file", "-e", `${commitHash}:${relPath}`])
			.then(() => true)
			.catch(() => false)

		if (existedAtBase) {
			await this.git.raw(["checkout", commitHash, "--", relPath])
		} else {
			// Created during the task - reverting means removing it.
			const absPath = path.join(this.workspaceDir, relPath)
			await fs.rm(absPath, { force: true })
		}

		this.log(`[${this.constructor.name}#revertFile] reverted ${relPath} to ${commitHash}`)
	}

	/**
	 * EventEmitter
	 */

	override emit<K extends keyof CheckpointEventMap>(event: K, data: CheckpointEventMap[K]) {
		return super.emit(event, data)
	}

	override on<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.on(event, listener)
	}

	override off<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.off(event, listener)
	}

	override once<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.once(event, listener)
	}

	/**
	 * Storage
	 */

	public static hashWorkspaceDir(workspaceDir: string) {
		return crypto.createHash("sha256").update(workspaceDir).digest("hex").toString().slice(0, 8)
	}

	protected static taskRepoDir({ taskId, globalStorageDir }: { taskId: string; globalStorageDir: string }) {
		return path.join(globalStorageDir, "tasks", taskId, "checkpoints")
	}

	protected static workspaceRepoDir({
		globalStorageDir,
		workspaceDir,
	}: {
		globalStorageDir: string
		workspaceDir: string
	}) {
		return path.join(globalStorageDir, "checkpoints", this.hashWorkspaceDir(workspaceDir))
	}

	public static async deleteTask({
		taskId,
		globalStorageDir,
		workspaceDir,
	}: {
		taskId: string
		globalStorageDir: string
		workspaceDir: string
	}) {
		const workspaceRepoDir = this.workspaceRepoDir({ globalStorageDir, workspaceDir })
		const branchName = `roo-${taskId}`
		const git = simpleGit(workspaceRepoDir)
		const success = await this.deleteBranch(git, branchName)

		if (success) {
			console.log(`[${this.name}#deleteTask.${taskId}] deleted branch ${branchName}`)
		} else {
			console.error(`[${this.name}#deleteTask.${taskId}] failed to delete branch ${branchName}`)
		}
	}

	public static async deleteBranch(git: SimpleGit, branchName: string) {
		const branches = await git.branchLocal()

		if (!branches.all.includes(branchName)) {
			console.error(`[${this.constructor.name}#deleteBranch] branch ${branchName} does not exist`)
			return false
		}

		const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"])

		if (currentBranch === branchName) {
			const worktree = await git.getConfig("core.worktree")

			try {
				await git.raw(["config", "--unset", "core.worktree"])
				await git.reset(["--hard"])
				await git.clean("f", ["-d"])
				const defaultBranch = branches.all.includes("main") ? "main" : "master"
				await git.checkout([defaultBranch, "--force"])

				await pWaitFor(
					async () => {
						const newBranch = await git.revparse(["--abbrev-ref", "HEAD"])
						return newBranch === defaultBranch
					},
					{ interval: 500, timeout: 2_000 },
				)

				await git.branch(["-D", branchName])
				return true
			} catch (error) {
				console.error(
					`[${this.constructor.name}#deleteBranch] failed to delete branch ${branchName}: ${error instanceof Error ? error.message : String(error)}`,
				)

				return false
			} finally {
				if (worktree.value) {
					await git.addConfig("core.worktree", worktree.value)
				}
			}
		} else {
			await git.branch(["-D", branchName])
			return true
		}
	}
}

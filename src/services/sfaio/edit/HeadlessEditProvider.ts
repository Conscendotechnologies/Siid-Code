import * as fs from "fs/promises"
import * as path from "path"
import { fileExistsAtPath } from "../../../utils/fs"
import type { Task } from "../../../core/task/Task"
import { EditSurface } from "../../../integrations/editor/EditSurface"

export class HeadlessEditProvider implements EditSurface {
	newProblemsMessage?: string
	userEdits?: string
	editType?: "create" | "modify"
	isEditing: boolean = false
	originalContent: string | undefined

	private _newContent: string | undefined
	get newContent(): string | undefined {
		return this._newContent
	}

	private absPath: string | undefined

	constructor(
		private cwd: string,
		private task: Task,
	) {}

	async open(relPath: string): Promise<void> {
		this.absPath = path.resolve(this.cwd, relPath)
		this.isEditing = true

		const exists = await fileExistsAtPath(this.absPath)
		if (exists) {
			this.editType = "modify"
			this.originalContent = await fs.readFile(this.absPath, "utf8")
		} else {
			this.editType = "create"
			this.originalContent = ""
		}

		this._newContent = this.originalContent
	}

	async update(accumulatedContent: string, isFinal: boolean): Promise<void> {
		this._newContent = accumulatedContent
	}

	async saveChanges(
		diagnosticsEnabled?: boolean,
		writeDelayMs?: number,
	): Promise<{ newProblemsMessage?: string; userEdits?: string; finalContent?: string }> {
		if (!this.absPath || this._newContent === undefined) {
			throw new Error("No file is currently open for editing")
		}

		const dir = path.dirname(this.absPath)
		await fs.mkdir(dir, { recursive: true })

		await fs.writeFile(this.absPath, this._newContent, "utf8")

		this.newProblemsMessage = undefined
		this.userEdits = undefined

		return {
			newProblemsMessage: this.newProblemsMessage,
			userEdits: this.userEdits,
			finalContent: this._newContent,
		}
	}

	async saveDirectly(
		relPath: string,
		content: string,
		openFile?: boolean,
		diagnosticsEnabled?: boolean,
		writeDelayMs?: number,
	): Promise<{ newProblemsMessage?: string; userEdits?: string; finalContent?: string }> {
		const absPath = path.resolve(this.cwd, relPath)
		const dir = path.dirname(absPath)
		await fs.mkdir(dir, { recursive: true })
		await fs.writeFile(absPath, content, "utf8")
		return { finalContent: content }
	}

	async pushToolWriteResult(task: Task, cwd: string, isNewFile: boolean): Promise<string> {
		if (this.userEdits) {
			return (
				`The user made the following updates to your content:\n\n${this.userEdits}\n\n` +
				`The updated content has been saved to ${this.absPath}.`
			)
		}
		return `The content was saved successfully.`
	}

	async revertChanges(): Promise<void> {
		if (!this.absPath) return

		if (this.editType === "create") {
			await fs.unlink(this.absPath).catch(() => {})
		} else if (this.editType === "modify" && this.originalContent !== undefined) {
			await fs.writeFile(this.absPath, this.originalContent, "utf8")
		}
		await this.reset()
	}

	scrollToFirstDiff(): void {
		// No-op for headless mode
	}

	async reset(): Promise<void> {
		this.newProblemsMessage = undefined
		this.userEdits = undefined
		this.editType = undefined
		this.isEditing = false
		this.originalContent = undefined
		this._newContent = undefined
		this.absPath = undefined
	}
}

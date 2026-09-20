import type { Task } from "../../core/task/Task"

/**
 * The subset of DiffViewProvider that tools actually use. Implemented by both
 * DiffViewProvider (interactive) and HeadlessEditProvider (background agents).
 */
export interface EditSurface {
	// Result fields read by tools after saveChanges()
	newProblemsMessage?: string
	userEdits?: string
	editType?: "create" | "modify"
	isEditing: boolean
	originalContent: string | undefined
	readonly newContent: string | undefined

	open(relPath: string): Promise<void>
	update(accumulatedContent: string, isFinal: boolean): Promise<void>
	saveChanges(
		diagnosticsEnabled?: boolean,
		writeDelayMs?: number,
	): Promise<{ newProblemsMessage?: string; userEdits?: string; finalContent?: string }>
	saveDirectly(
		relPath: string,
		content: string,
		openFile?: boolean,
		diagnosticsEnabled?: boolean,
		writeDelayMs?: number,
	): Promise<{ newProblemsMessage?: string; userEdits?: string; finalContent?: string }>
	pushToolWriteResult(task: Task, cwd: string, isNewFile: boolean): Promise<string>
	revertChanges(): Promise<void>
	scrollToFirstDiff(): void
	reset(): Promise<void>
}

import type { Task } from "../task/Task"

export type PromptFileChange = Awaited<ReturnType<Task["getFileChanges"]>>[number]

/**
 * True while the shadow repo's first snapshot is still being taken.
 *
 * Kept in this type-only module (no runtime imports) so the prompt path can use
 * it without loading the checkpoint service and everything behind it.
 */
export function isCheckpointBaselinePending(
	cline: Pick<Task, "enableCheckpoints" | "checkpointService" | "checkpointServiceInitializing">,
): boolean {
	return cline.enableCheckpoints && (!cline.checkpointService || cline.checkpointServiceInitializing)
}

/**
 * The file-change list for building a prompt. Never waits for the baseline: on a
 * large workspace that wait is the first `git add .`, which can take minutes.
 *
 * Nothing has been changed by the agent while the baseline is pending, because
 * tools that can write wait for it first (see presentAssistantMessage), so an
 * empty list is accurate. Webview callers want the real list once it exists and
 * should keep using getTaskFileChanges.
 */
export async function readFileChangesForPrompt(
	cline: Pick<
		Task,
		| "enableCheckpoints"
		| "checkpointService"
		| "checkpointServiceInitializing"
		| "getFileChanges"
		| "startCheckpointInit"
	>,
): Promise<PromptFileChange[]> {
	if (isCheckpointBaselinePending(cline)) {
		// This read used to start init as a side effect, and paths that don't go
		// through initiateTaskLoop rely on that. Start it without waiting.
		cline.startCheckpointInit()
		return []
	}

	return cline.getFileChanges()
}

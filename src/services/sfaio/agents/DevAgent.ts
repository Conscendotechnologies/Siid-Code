import { SfaioTask, Run } from "../../../shared/sfaio/types"
import { ClineProvider } from "../../../core/webview/ClineProvider"
import { getModeConfig } from "../../../shared/modes"
import { buildAgentMode } from "./agentModes"
import { DEFAULT_AGENT_AUTO_APPROVAL } from "../types"
import { StateStore } from "../StateStore"
import { DeployQueue } from "../deploy/DeployQueue"
import { exec } from "child_process"
import { promisify } from "util"
import { RooCodeEventName, TokenUsage, ToolUsage } from "@siid-code/types"

const execAsync = promisify(exec)

export class DevAgent {
	constructor(
		private provider: ClineProvider,
		private store: StateStore,
		private deployQueue: DeployQueue,
	) {}

	async executeTask(run: Run, task: SfaioTask): Promise<void> {
		// Step 1: Snapshot
		// TODO (Phase 4): Capture baseline modified dates

		// Step 2: Scaffold
		// TODO (Phase 2): Use existing generator tools to scaffold code

		// Step 3: Implement
		const baseDevMode = getModeConfig("code")
		const roleDescription = `You are a Salesforce Developer.`
		const agentMode = buildAgentMode(
			baseDevMode,
			task.taskId,
			roleDescription + "\n\n" + task.spec.instructions,
			task.spec.filesOwned,
		)

		const engineTask = await this.provider.createBackgroundTask({
			task: `Begin dev phase for task ${task.taskId}: ${task.spec.objective}`,
			mode: agentMode.slug,
			customModesOverlay: [agentMode],
			headless: true,
			autoApprovalOverride: DEFAULT_AGENT_AUTO_APPROVAL,
			sfaioTargetOrg: run.targetOrgAlias,
		})

		engineTask.on(
			RooCodeEventName.TaskCompleted,
			async (taskId: string, tokenUsage: TokenUsage, toolUsage: ToolUsage) => {
				try {
					// Transition to DRY_RUN
					await this.store.updateTask(
						task.taskId,
						{ state: "DRY_RUN" },
						{ actor: "DevAgent", reason: "engine task completed" },
					)

					// Step 4: Dry run
					let cliCommand = `sf project deploy start --target-org "${run.targetOrgAlias}" --dry-run --ignore-conflicts`
					if (task.spec.metadataTypes && task.spec.metadataTypes.length > 0) {
						cliCommand += ` --metadata ${task.spec.metadataTypes.join(",")}`
					} else {
						cliCommand += ` --source-dir force-app`
					}

					try {
						await execAsync(cliCommand)
						// Step 5: Enqueue
						await this.deployQueue.enqueue({
							runId: run.runId,
							taskId: task.taskId,
							orgAlias: run.targetOrgAlias,
							priority: 1, // Default priority
						})
						// Step 6 is handled by DeployWorker
					} catch (err: any) {
						// Dry run failed
						await this.store.updateTask(
							task.taskId,
							{ state: "FAILED" },
							{ actor: "DevAgent", reason: `dry run failed: ${err.message}` },
						)
					}
				} catch (e) {
					console.error(`Failed to process DevAgent completion for task ${task.taskId}`, e)
				}
			},
		)
	}
}

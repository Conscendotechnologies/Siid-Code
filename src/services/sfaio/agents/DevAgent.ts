import { SfaioTask, Run } from "../../../shared/sfaio/types"
import { ClineProvider } from "../../../core/webview/ClineProvider"
import { ModeConfig } from "@siid-code/types"
import { DEFAULT_AGENT_AUTO_APPROVAL } from "../types"

export class DevAgent {
	constructor(private provider: ClineProvider) {}

	async executeTask(run: Run, task: SfaioTask): Promise<void> {
		const agentMode: ModeConfig = {
			slug: `sfaio-dev-${task.taskId}`,
			name: `SFAIO Dev`,
			roleDefinition: `You are a Salesforce Developer.`,
			customInstructions: task.spec.instructions,
			groups: ["read", "edit", "command"], // Build tools
		}

		await this.provider.createBackgroundTask({
			task: `Begin dev phase for task ${task.taskId}: ${task.spec.objective}`,
			mode: agentMode.slug,
			customModesOverlay: [agentMode],
			headless: true,
			autoApprovalOverride: DEFAULT_AGENT_AUTO_APPROVAL,
			sfaioTargetOrg: run.targetOrgAlias,
		})
	}
}

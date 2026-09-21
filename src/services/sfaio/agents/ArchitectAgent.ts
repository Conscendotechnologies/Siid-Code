import { Run } from "../../../shared/sfaio/types"
import { ClineProvider } from "../../../core/webview/ClineProvider"
import { ModeConfig } from "@siid-code/types"
import { DEFAULT_AGENT_AUTO_APPROVAL } from "../types"

const ARCHITECT_ROLE = `You are a Salesforce Architect.`
function architectInstructions(run: Run): string {
	return `Analyze the requirement for run ${run.runId} and emit structured JSON for tasks.`
}

export class ArchitectAgent {
	constructor(private provider: ClineProvider) {}

	async analyzeRequirement(run: Run): Promise<void> {
		const agentMode: ModeConfig = {
			slug: `sfaio-architect-${run.runId}`,
			name: `SFAIO Architect`,
			roleDefinition: ARCHITECT_ROLE,
			customInstructions: architectInstructions(run),
			groups: ["read"], // Read tools only
		}

		await this.provider.createBackgroundTask({
			task: `Begin architect phase for requirement: ${run.requirement}`,
			mode: agentMode.slug,
			customModesOverlay: [agentMode],
			headless: true,
			autoApprovalOverride: DEFAULT_AGENT_AUTO_APPROVAL,
		})
	}
}

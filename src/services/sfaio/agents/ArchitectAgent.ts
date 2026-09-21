import { Run, SfaioTask } from "../../../shared/sfaio/types"
import { ClineProvider } from "../../../core/webview/ClineProvider"
import { getModeConfig } from "../../../shared/modes"
import { buildAgentMode } from "./agentModes"
import { DEFAULT_AGENT_AUTO_APPROVAL } from "../types"
import { z } from "zod"
import { StateStore } from "../StateStore"
import { v4 as uuidv4 } from "uuid"
import { RooCodeEventName, TokenUsage, ToolUsage } from "@siid-code/types"

const ARCHITECT_ROLE = `You are a Salesforce Architect.`
function architectInstructions(run: Run): string {
	return `Analyze the requirement for run ${run.runId} and emit structured JSON for tasks. The JSON must have a single top-level "tasks" array. Each task object in the array must strictly adhere to the following schema:
- objective: string
- filesOwned: array of strings
- filesReadOnly: array of strings (optional)
- contracts: object with optional methodSignatures, fieldApiNames, and notes
- acceptanceCriteria: array of strings
- constraints: array of strings
- instructions: string
- metadataTypes: array of strings
- assignedTier: number or string (optional)

Output nothing but the JSON.`
}

const taskGraphSchema = z.object({
	tasks: z.array(
		z.object({
			objective: z.string(),
			filesOwned: z.array(z.string()),
			filesReadOnly: z.array(z.string()).optional(),
			contracts: z
				.object({
					methodSignatures: z.array(z.string()).optional(),
					fieldApiNames: z.array(z.string()).optional(),
					notes: z.string().optional(),
				})
				.optional(),
			acceptanceCriteria: z.array(z.string()),
			constraints: z.array(z.string()),
			instructions: z.string(),
			metadataTypes: z.array(z.string()),
			assignedTier: z.union([z.number(), z.string()]).optional(),
		}),
	),
})

export class ArchitectAgent {
	constructor(
		private provider: ClineProvider,
		private store: StateStore,
	) {}

	async analyzeRequirement(run: Run): Promise<void> {
		const baseArchitectMode = getModeConfig("orchestrator")
		const agentMode = buildAgentMode(
			baseArchitectMode,
			run.runId,
			ARCHITECT_ROLE + "\n\n" + architectInstructions(run),
			[],
		)

		const engineTask = await this.provider.createBackgroundTask({
			task: `Begin architect phase for requirement: ${run.requirement}`,
			mode: agentMode.slug,
			customModesOverlay: [agentMode],
			headless: true,
			autoApprovalOverride: DEFAULT_AGENT_AUTO_APPROVAL,
		})

		engineTask.on(
			RooCodeEventName.TaskCompleted,
			async (taskId: string, tokenUsage: TokenUsage, toolUsage: ToolUsage) => {
				try {
					const lastMessage = engineTask.clineMessages
						.slice()
						.reverse()
						.find((m) => m.type === "say" && m.say === "text")
					if (!lastMessage) throw new Error("No response from ArchitectAgent")

					let jsonString = (lastMessage.text || "")
						.replace(/^```json/i, "")
						.replace(/```$/, "")
						.trim()

					const parsed = JSON.parse(jsonString)
					const result = taskGraphSchema.parse(parsed)

					for (const t of result.tasks) {
						const newTaskId = uuidv4()
						const sfaioTask: SfaioTask = {
							taskId: newTaskId,
							runId: run.runId,
							state: "PENDING",
							spec: {
								taskId: newTaskId,
								wave: 0,
								assignedTier: "mid",
								objective: t.objective,
								filesOwned: t.filesOwned,
								filesReadOnly: t.filesReadOnly || [],
								contracts: t.contracts || {},
								acceptanceCriteria: t.acceptanceCriteria,
								constraints: t.constraints,
								instructions: t.instructions,
								metadataTypes: t.metadataTypes,
							},
							selfRetryCount: 0,
							reviewCount: 0,
							createdAt: Date.now(),
							updatedAt: Date.now(),
						}

						await this.store.transaction(
							{
								actor: "ArchitectAgent",
								reason: "task generation",
								entityType: "Task",
								entityId: newTaskId,
							},
							(state) => {
								state.tasks[newTaskId] = sfaioTask
							},
						)
					}
					await this.store.updateRun(
						run.runId,
						{ state: "AWAITING_DESIGN_APPROVAL" },
						{ actor: "ArchitectAgent", reason: "analysis complete" },
					)
				} catch (e) {
					console.error("Failed to parse Architect output", e)
				}
			},
		)
	}
}

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
- wave: number (0 for objects/fields, 1..N for dependent logic)
- assignedTier: string ("architect", "senior", "mid", or "junior")
- filesOwned: array of strings
- filesReadOnly: array of strings (optional)
- contracts: object with optional methodSignatures, fieldApiNames, and notes
- acceptanceCriteria: array of strings
- constraints: array of strings
- instructions: string
- metadataTypes: array of strings

Output nothing but the JSON.`
}

const taskGraphSchema = z.object({
	tasks: z.array(
		z.object({
			objective: z.string(),
			wave: z.number(),
			assignedTier: z.enum(["architect", "senior", "mid", "junior"]),
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
		}),
	),
})

export class ArchitectAgent {
	constructor(
		private provider: ClineProvider,
		private store: StateStore,
	) {}

	async analyzeRequirement(run: Run): Promise<void> {
		const instructions = ARCHITECT_ROLE + "\n\n" + architectInstructions(run)
		await this.executeArchitectTask(run, instructions, false)
	}

	private async executeArchitectTask(run: Run, instructions: string, isRetry: boolean): Promise<void> {
		const baseArchitectMode = getModeConfig("orchestrator")
		const agentMode = buildAgentMode(baseArchitectMode, run.runId, instructions, [])

		const engineTask = await this.provider.createBackgroundTask({
			task: `Begin architect phase for requirement: ${run.requirement}`,
			mode: agentMode.slug,
			customModesOverlay: [agentMode],
			headless: true,
			autoApprovalOverride: DEFAULT_AGENT_AUTO_APPROVAL,
		})

		engineTask.once(
			RooCodeEventName.TaskCompleted,
			async (taskId: string, tokenUsage: TokenUsage, toolUsage: ToolUsage) => {
				try {
					const lastMessage = engineTask.clineMessages
						.slice()
						.reverse()
						.find((m) => m.type === "say" && m.say === "text")
					if (!lastMessage) throw new Error("No response from ArchitectAgent")

					const text = lastMessage.text || ""
					const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
					let jsonString = match ? match[1].trim() : text.trim()

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
								wave: t.wave,
								assignedTier: t.assignedTier,
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
					const decisionId = uuidv4()
					await this.store.transaction(
						{
							actor: "ArchitectAgent",
							reason: "creating design approval decision",
							entityType: "Decision",
							entityId: decisionId,
						},
						(state) => {
							state.decisions[decisionId] = {
								decisionId,
								runId: run.runId,
								kind: "DESIGN_APPROVAL",
								prompt: "Please review and approve the generated task graph.",
								payload: result,
								createdAt: Date.now(),
							}
						},
					)

					await this.store.updateRun(
						run.runId,
						{ state: "AWAITING_DESIGN_APPROVAL" },
						{ actor: "ArchitectAgent", reason: "analysis complete, awaiting design approval" },
					)
				} catch (e: any) {
					console.error("Failed to parse Architect output", e)
					if (!isRetry) {
						const retryInstructions = `${instructions}\n\nIMPORTANT: Your previous output failed validation with the following error:\n${e.message}\n\nPlease fix the JSON and try again.`
						await this.executeArchitectTask(run, retryInstructions, true)
					} else {
						// Failed twice, surface to human via ALIGNMENT
						const decisionId = uuidv4()
						await this.store.transaction(
							{
								actor: "ArchitectAgent",
								reason: "creating alignment decision for parse failure",
								entityType: "Decision",
								entityId: decisionId,
							},
							(state) => {
								state.decisions[decisionId] = {
									decisionId,
									runId: run.runId,
									kind: "ALIGNMENT",
									prompt: "The Architect agent failed to generate a valid task graph after multiple attempts. Please review the error.",
									payload: { error: e.message },
									createdAt: Date.now(),
								}
							},
						)

						await this.store.updateRun(
							run.runId,
							{ state: "AWAITING_ALIGNMENT" },
							{ actor: "ArchitectAgent", reason: "Parse failed twice: " + e.message },
						)
					}
				}
			},
		)
	}
}

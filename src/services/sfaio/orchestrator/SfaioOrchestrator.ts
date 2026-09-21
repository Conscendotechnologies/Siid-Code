import { StateStore } from "../StateStore"
import { ClineProvider } from "../../../core/webview/ClineProvider"
import { DeployQueue } from "../deploy/DeployQueue"
import { Run, DecisionItem, SfaioTask, TaskSpec } from "../../../shared/sfaio/types"
import { v4 as uuidv4 } from "uuid"

const AUTO_APPROVABLE: DecisionItem["kind"][] = ["DESIGN_APPROVAL", "DELEGATION_APPROVAL"]

function isSafeAlignmentDefault(item: DecisionItem, run: Run): boolean {
	if (run.isGreenfieldOrg) return false
	return true
}

export class SfaioOrchestrator {
	constructor(
		private store: StateStore,
		private provider: ClineProvider,
		private deployQueue: DeployQueue,
	) {
		this.store.on("stateChanged", (state) => {
			// In a real system, you'd subscribe to specific events or diff the state
			// For this MVP, we can trigger advance() on relevant runs.
			// Currently advance() is called manually by handlers, so this is just a stub.
		})
	}

	async startRun(params: {
		requirement: string
		targetOrgAlias: string
		autoMode: boolean
		projectPath: string
		isGreenfieldOrg: boolean
	}): Promise<Run> {
		const runId = uuidv4()
		const newRun: Run = {
			runId,
			state: "SETUP",
			requirement: params.requirement,
			targetOrgAlias: params.targetOrgAlias,
			projectPath: params.projectPath,
			autoMode: params.autoMode,
			isGreenfieldOrg: params.isGreenfieldOrg,
			waves: 0,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		}

		await this.store.transaction(
			{
				actor: "system",
				reason: "start run",
				entityType: "Run",
				entityId: runId,
			},
			(state) => {
				state.runs[runId] = newRun
			},
		)

		// Transition to ANALYZING immediately
		await this.store.updateRun(runId, { state: "ANALYZING" }, { actor: "system", reason: "begin analysis phase" })

		await this.advance(runId)
		return this.store.getState().runs[runId]
	}

	private canAutoResolve(run: Run, item: DecisionItem): boolean {
		if (!run.autoMode) return false
		if (AUTO_APPROVABLE.includes(item.kind)) return true
		if (item.kind === "ALIGNMENT") return isSafeAlignmentDefault(item, run)
		return false
	}

	public async advance(runId: string): Promise<void> {
		const state = this.store.getState()
		const run = state.runs[runId]
		if (!run) return

		if (run.state === "ANALYZING") {
			// Check if we need to emit an alignment question
			// This would normally happen via Architect agent emitting a decision.
			// Stub logic:
		} else if (run.state === "EXECUTING") {
			// Scan tasks
			const tasks = Object.values(state.tasks).filter((t) => t.runId === runId)
			// Kick off tasks if dependencies are met
		}
	}

	async resolveDecision(decisionId: string, response: DecisionItem["response"]): Promise<void> {
		let runId: string | undefined
		await this.store.transaction(
			{
				actor: "user",
				reason: "decision resolved",
				entityType: "Decision",
				entityId: decisionId,
			},
			(state) => {
				const decision = state.decisions[decisionId]
				if (!decision) throw new Error(`Decision ${decisionId} not found`)

				decision.response = response
				decision.resolvedAt = Date.now()
				runId = decision.runId
			},
		)

		if (runId) {
			const state = this.store.getState()
			const run = state.runs[runId]
			const decision = state.decisions[decisionId]

			if (
				decision.kind === "ALIGNMENT" ||
				decision.kind === "DESIGN_APPROVAL" ||
				decision.kind === "DELEGATION_APPROVAL"
			) {
				if (response?.decision === "REJECT") {
					// Regenerate or go back to analyzing
					await this.store.updateRun(
						runId,
						{ state: "ANALYZING" },
						{ actor: "user", reason: "design rejected" },
					)
				} else {
					if (decision.kind === "ALIGNMENT") {
						await this.store.updateRun(
							runId,
							{ state: "AWAITING_DESIGN_APPROVAL" },
							{ actor: "user", reason: "alignment accepted" },
						)
					} else if (decision.kind === "DESIGN_APPROVAL") {
						await this.store.updateRun(
							runId,
							{ state: "AWAITING_DELEGATION_APPROVAL" },
							{ actor: "user", reason: "design accepted" },
						)
					} else if (decision.kind === "DELEGATION_APPROVAL") {
						await this.store.updateRun(
							runId,
							{ state: "EXECUTING" },
							{ actor: "user", reason: "delegation accepted" },
						)
					}
				}
			}
			await this.advance(runId)
		}
	}

	async pauseRun(runId: string): Promise<void> {
		await this.store.updateRun(runId, { state: "PAUSED" }, { actor: "user", reason: "user paused run" })
	}

	async resumeRun(runId: string): Promise<void> {
		await this.store.updateRun(runId, { state: "EXECUTING" }, { actor: "user", reason: "user resumed run" })
		await this.advance(runId)
	}

	async cancelRun(runId: string): Promise<void> {
		await this.store.updateRun(runId, { state: "CANCELLED" }, { actor: "user", reason: "user cancelled run" })
	}

	async updateTaskSpec(runId: string, taskId: string, newSpec: TaskSpec): Promise<void> {
		const state = this.store.getState()
		const task = state.tasks[taskId]
		if (!task) return

		if (task.state === "PENDING" || task.state === "ASSIGNED") {
			await this.store.updateTask(taskId, { spec: newSpec }, { actor: "user", reason: "edited spec inline" })
		} else if (task.state === "IN_PROGRESS" || task.state === "DRY_RUN") {
			await this.store.updateTask(
				taskId,
				{ state: "REASSIGNED" },
				{ actor: "user", reason: "aborted for spec edit" },
			)
			await this.store.updateTask(
				taskId,
				{ state: "ASSIGNED", spec: newSpec },
				{ actor: "user", reason: "reassigned with new spec" },
			)
		} else if (task.state === "QUEUED") {
			await this.deployQueue.remove(taskId)
			await this.store.updateTask(
				taskId,
				{ state: "IN_PROGRESS", spec: newSpec },
				{ actor: "user", reason: "removed from queue for spec edit" },
			)
		} else if (task.state === "DEPLOYING") {
			throw new Error("Cannot edit spec while deploying. Cancel or wait for completion.")
		} else if (task.state === "DONE" || task.state === "ROLLED_BACK") {
			throw new Error("Cannot edit spec of a completed task. Start a new task instead.")
		}
	}
}

import * as fs from "fs/promises"
import * as path from "path"
import * as lockfile from "proper-lockfile"
import { SfaioState } from "../../shared/sfaio/types"
import { EventEmitter } from "events"
import { assertTaskTransition, assertRunTransition } from "./orchestrator/stateMachine"
import { SfaioTask, Run } from "../../shared/sfaio/types"

export interface MutationContext {
	actor: string
	reason: string
	entityType: "Run" | "Task" | "Agent" | "DeployQueueItem" | "System" | "Decision"
	entityId: string
	fromState?: string
	toState?: string
}

export class StateStore extends EventEmitter {
	private dbPath: string
	private memoryState: SfaioState

	private constructor(dbPath: string, initialState: SfaioState) {
		super()
		this.dbPath = dbPath
		this.memoryState = initialState
	}

	public static async create(storageDir: string): Promise<StateStore> {
		await fs.mkdir(storageDir, { recursive: true })
		const dbPath = path.join(storageDir, "sfaio.db.json")
		const metaPath = path.join(storageDir, "meta.json")
		const CURRENT_SCHEMA_VERSION = 1

		try {
			const metaData = await fs.readFile(metaPath, "utf-8")
			const meta = JSON.parse(metaData)
			if (meta.schemaVersion !== CURRENT_SCHEMA_VERSION) {
				// SFAIO: in the future, migrations go here
				// For now, if schema is mismatched, we could reset or throw
			}
		} catch (error: any) {
			if (error.code === "ENOENT") {
				await fs.writeFile(metaPath, JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION }, null, 2))
			}
		}

		let initialState: SfaioState = {
			runs: {},
			tasks: {},
			decisions: {},
			agents: {},
			deployQueue: {},
			escalations: {},
			snapshots: {},
			eventLogs: {},
		}

		try {
			const data = await fs.readFile(dbPath, "utf-8")
			initialState = JSON.parse(data)
		} catch (error: any) {
			if (error.code === "ENOENT") {
				// File does not exist, create it with initial state
				await fs.writeFile(dbPath, JSON.stringify(initialState, null, 2))
			} else {
				throw new Error(`Failed to read SFAIO state: ${error.message}`)
			}
		}

		return new StateStore(dbPath, initialState)
	}

	public getState(): SfaioState {
		// Return a deep clone to prevent direct mutations bypassing transactions
		return JSON.parse(JSON.stringify(this.memoryState))
	}

	/**
	 * Executes a state transition atomically using a file lock.
	 * The callback receives a deep clone of the current state, mutates it, and the store writes it back.
	 * If the callback throws, the transaction is aborted.
	 */
	public async transaction(
		context: MutationContext,
		updater: (state: SfaioState) => void | Promise<void>,
	): Promise<void> {
		let release: () => Promise<void>
		try {
			release = await lockfile.lock(this.dbPath, {
				retries: {
					retries: 5,
					minTimeout: 50,
					maxTimeout: 1000,
				},
			})
		} catch (error) {
			throw new Error(`Failed to acquire lock for SFAIO state transaction: ${error}`)
		}

		try {
			// Read the latest state from disk to ensure we have the most recent data across possible multiple processes
			// even though SFAIO tasks mostly run in the same extension host process, this handles hot-reloads and Edge cases.
			const data = await fs.readFile(this.dbPath, "utf-8")
			const currentState: SfaioState = JSON.parse(data)

			// Mutate state
			await updater(currentState)

			// Append event log
			const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
			currentState.eventLogs[eventId] = {
				id: eventId,
				timestamp: Date.now(),
				actor: context.actor,
				entityType: context.entityType as any,
				entityId: context.entityId,
				fromState: context.fromState,
				toState: context.toState,
				reason: context.reason,
			}

			// Write back
			await fs.writeFile(this.dbPath, JSON.stringify(currentState, null, 2))

			// Update memory cache
			this.memoryState = currentState

			// Emit event for UI to update
			this.emit("stateChanged", this.memoryState)
		} finally {
			await release()
		}
	}

	public async updateTask(
		taskId: string,
		patch: Partial<SfaioTask>,
		context: Omit<MutationContext, "entityType" | "entityId" | "fromState" | "toState">,
	): Promise<void> {
		const fromState = this.memoryState.tasks[taskId]?.state
		const toState = patch.state || fromState

		await this.transaction(
			{
				...context,
				entityType: "Task",
				entityId: taskId,
				fromState,
				toState,
			},
			(state) => {
				const task = state.tasks[taskId]
				if (!task) throw new Error(`Task ${taskId} not found`)

				if (patch.state && patch.state !== task.state) {
					assertTaskTransition(task.state, patch.state)
				}

				Object.assign(task, patch)
			},
		)
	}

	public async updateRun(
		runId: string,
		patch: Partial<Run>,
		context: Omit<MutationContext, "entityType" | "entityId" | "fromState" | "toState">,
	): Promise<void> {
		const fromState = this.memoryState.runs[runId]?.state
		const toState = patch.state || fromState

		await this.transaction(
			{
				...context,
				entityType: "Run",
				entityId: runId,
				fromState,
				toState,
			},
			(state) => {
				const run = state.runs[runId]
				if (!run) throw new Error(`Run ${runId} not found`)

				if (patch.state && patch.state !== run.state) {
					assertRunTransition(run.state, patch.state)
				}

				Object.assign(run, patch)
			},
		)
	}
}

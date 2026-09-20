import * as fs from "fs/promises"
import * as path from "path"
import * as lockfile from "proper-lockfile"
import { SfaioState } from "../../shared/sfaio/types"
import { EventEmitter } from "events"

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

		let initialState: SfaioState = {
			runs: {},
			tasks: {},
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
		updater: (state: SfaioState) => void | Promise<void>
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
}

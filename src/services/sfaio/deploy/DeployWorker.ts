import { DeployQueue } from "./DeployQueue"
import { StateStore } from "../StateStore"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export class DeployWorker {
	private isRunning = false

	constructor(
		private queue: DeployQueue,
		private store: StateStore,
	) {
		this.store.on("stateChanged", () => {
			this.trigger()
		})
	}

	public trigger() {
		if (this.isRunning) return
		this.run()
	}

	private async run() {
		this.isRunning = true
		try {
			while (true) {
				const state = this.store.getState()

				// Find all unique orgs that have items waiting
				const orgAliases = new Set<string>()
				Object.values(state.deployQueue).forEach((item) => {
					if (item.state === "WAITING") {
						orgAliases.add(item.orgAlias)
					}
				})

				if (orgAliases.size === 0) break

				// Deploy for each org sequentially (in this simple MVP)
				for (const orgAlias of orgAliases) {
					const item = await this.queue.claimNext(orgAlias)
					if (!item) continue

					// Execute deployment
					const task = state.tasks[item.taskId]
					let success = false
					let rawOutput = ""
					let errorSnippet = ""
					let cliCommand = ""

					if (task) {
						// For MVP: deploy the source directory since tracking exact files requires more logic.
						cliCommand = `sf project deploy start --target-org "${orgAlias}" --ignore-conflicts`
						if (task.spec.metadataTypes && task.spec.metadataTypes.length > 0) {
							cliCommand += ` --metadata ${task.spec.metadataTypes.join(",")}`
						} else {
							cliCommand += ` --source-dir force-app`
						}

						try {
							const { stdout, stderr } = await execAsync(cliCommand)
							rawOutput = stdout + (stderr ? "\n" + stderr : "")
							success = true
						} catch (error: any) {
							rawOutput = error.stdout || ""
							errorSnippet = error.stderr || error.message || "Unknown error"
							success = false
						}
					} else {
						cliCommand = "N/A"
						errorSnippet = "Task not found"
					}

					await this.queue.complete(item.itemId, {
						success,
						cliCommand,
						rawOutput: rawOutput.substring(0, 5000), // Truncate
						errorSnippet,
						finishedAt: Date.now(),
					})
				}
			}
		} finally {
			this.isRunning = false
		}
	}
}

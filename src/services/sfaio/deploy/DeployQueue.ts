import { DeployQueueItem, DeployResult } from "../../../shared/sfaio/types"
import { StateStore } from "../StateStore"
import { v4 as uuidv4 } from "uuid"

export class DeployQueue {
	constructor(private store: StateStore) {}

	async enqueue(item: Omit<DeployQueueItem, "itemId" | "enqueuedAt" | "state">): Promise<DeployQueueItem> {
		const itemId = uuidv4()
		const newItem: DeployQueueItem = {
			...item,
			itemId,
			enqueuedAt: Date.now(),
			state: "WAITING",
		}

		await this.store.transaction(
			{
				actor: "system",
				reason: "enqueue deployment",
				entityType: "DeployQueueItem",
				entityId: itemId,
				toState: "WAITING",
			},
			(state) => {
				state.deployQueue[itemId] = newItem
				// Advance task to QUEUED
				const task = state.tasks[item.taskId]
				if (task && task.state === "DRY_RUN") {
					task.state = "QUEUED"
				}
			},
		)

		return newItem
	}

	async peek(orgAlias: string): Promise<DeployQueueItem | undefined> {
		const state = this.store.getState()
		const items = Object.values(state.deployQueue)
			.filter((i) => i.orgAlias === orgAlias && i.state === "WAITING")
			.sort((a, b) => {
				if (a.priority !== b.priority) return a.priority - b.priority
				return a.enqueuedAt - b.enqueuedAt
			})
		return items[0]
	}

	async claimNext(orgAlias: string): Promise<DeployQueueItem | undefined> {
		let claimedItem: DeployQueueItem | undefined

		// Need to lock and find the highest priority waiting item to claim it
		await this.store.transaction(
			{
				actor: "deploy-worker",
				reason: "claim deployment",
				entityType: "DeployQueueItem",
				entityId: "", // Will be filled dynamically below
				fromState: "WAITING",
				toState: "DEPLOYING",
			},
			(state) => {
				const items = Object.values(state.deployQueue)
					.filter((i) => i.orgAlias === orgAlias && i.state === "WAITING")
					.sort((a, b) => {
						if (a.priority !== b.priority) return a.priority - b.priority
						return a.enqueuedAt - b.enqueuedAt
					})

				const isDeploying = Object.values(state.deployQueue).some(
					(i) => i.orgAlias === orgAlias && i.state === "DEPLOYING",
				)
				if (isDeploying) return

				if (items.length > 0) {
					const item = items[0]
					item.state = "DEPLOYING"
					claimedItem = item

					// Change task state as well
					const task = state.tasks[item.taskId]
					if (task && task.state === "QUEUED") {
						task.state = "DEPLOYING"
					}
				}
			},
		)

		return claimedItem
	}

	async complete(itemId: string, result: DeployResult): Promise<void> {
		await this.store.transaction(
			{
				actor: "deploy-worker",
				reason: "complete deployment",
				entityType: "DeployQueueItem",
				entityId: itemId,
				fromState: "DEPLOYING",
				toState: result.success ? "DONE" : "FAILED",
			},
			(state) => {
				const item = state.deployQueue[itemId]
				if (!item) throw new Error(`DeployQueueItem ${itemId} not found`)
				item.state = result.success ? "DONE" : "FAILED"
				item.result = result

				// Update task state and append result
				const task = state.tasks[item.taskId]
				if (task && task.state === "DEPLOYING") {
					task.state = result.success ? "IN_REVIEW" : "FAILED"
					task.deployResult = result
				}
			},
		)
	}

	async remove(itemId: string): Promise<void> {
		await this.store.transaction(
			{
				actor: "system",
				reason: "remove deployment",
				entityType: "DeployQueueItem",
				entityId: itemId,
			},
			(state) => {
				delete state.deployQueue[itemId]
			},
		)
	}
}

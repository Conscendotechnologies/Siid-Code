import * as assert from "assert"
import { sleep } from "./utils"

suite("SFAIO Phase 0 Integration", () => {
	test("Should isolate background tasks from the interactive stack", async () => {
		const api = globalThis.api

		// 1. Initialize a user task
		const parentTaskId = await api.startNewTask({
			configuration: {
				mode: "architect",
				alwaysAllowModeSwitch: true,
				autoApprovalEnabled: true,
				enableCheckpoints: false,
			},
			text: "I am the main task. Wait for background tasks.",
		})

		// Let it settle
		await sleep(1000)

		// 2. Start two background tasks
		// The `api` exposes provider methods in e2e tests
		type SfaioProvider = {
			createBackgroundTask?: (options: Record<string, unknown>) => Promise<{ id: string }>
			getAllBackgroundTasks?: () => { id: string }[]
			getCurrentCline?: () => unknown
			removeBackgroundTask?: (task: { id: string }) => void
		}
		const provider = (api as { provider?: SfaioProvider }).provider
		if (!provider || !provider.createBackgroundTask) {
			assert.fail("Provider missing SFAIO createBackgroundTask API")
		}

		const bg1 = await provider.createBackgroundTask({
			task: "I am a background agent",
			apiConfiguration: { autoApprovalEnabled: true },
			mode: "architect",
			headless: true,
			enableCheckpoints: false,
		})

		const bg2 = await provider.createBackgroundTask({
			task: "I am another background agent",
			apiConfiguration: { autoApprovalEnabled: true },
			mode: "architect",
			headless: true,
			enableCheckpoints: false,
		})

		// 3. Assert they are in the background registry
		assert.strictEqual(provider.getAllBackgroundTasks().length, 2, "Should have 2 background tasks")

		// 4. Assert interactive stack was NOT modified (LIFO bypassed)
		assert.strictEqual(provider.getCurrentCline()?.taskId, parentTaskId, "Parent task should remain active")

		// 5. Assert check-point isolation
		assert.strictEqual(bg1.enableCheckpoints, false, "Background task 1 should not have checkpoints enabled")
		assert.strictEqual(bg2.enableCheckpoints, false, "Background task 2 should not have checkpoints enabled")

		// Clean up
		await provider.removeBackgroundTask(bg1.taskId)
		await provider.removeBackgroundTask(bg2.taskId)
		await api.clearCurrentTask()
	})
})

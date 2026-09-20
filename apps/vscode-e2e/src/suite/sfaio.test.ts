import * as assert from "assert"
import { sleep } from "./utils"
// @ts-expect-error - mocking internal for testing
import { writeToFileTool } from "../../src/core/tools/writeToFileTool"
// @ts-expect-error - mocking internal for testing
import { StateStore } from "../../src/services/sfaio/StateStore"
import * as path from "path"
import * as os from "os"
import * as fs from "fs/promises"

suite("SFAIO Phase 0 Integration", () => {
	test("Should isolate background tasks from the interactive stack", async () => {
		const api = globalThis.api

		// 1. Initialize a user task
		const parentTaskId = await api.startNewTask({
			configuration: {
				mode: "architect",
				alwaysAllowModeSwitch: true,
				apiProvider: "anthropic",
				apiModelId: "claude-3-5-sonnet-20241022",
				autoApprovalEnabled: true,
				enableCheckpoints: false,
			},
			text: "I am the main task. Wait for background tasks.",
		})

		await sleep(1000)

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const provider = (api as any).provider
		if (!provider || !provider.createBackgroundTask) {
			assert.fail("Provider missing SFAIO createBackgroundTask API")
		}

		// 2. Test FileRestrictionError and headless isolation
		const bg1 = await provider.createBackgroundTask({
			task: "I am a background agent",
			apiConfiguration: {
				apiProvider: "anthropic",
				apiModelId: "claude-3-5-sonnet-20241022",
				autoApprovalEnabled: true,
			},
			mode: "architect",
			headless: true,
			enableCheckpoints: false,
			autoApprovalOverride: "full",
		})
		bg1.allowedFiles = ["force-app/main/default/classes/.*"] // Restrict to specific directory

		// Mock the tool execution
		const pushToolResult = (res: string) => {
			bg1.lastToolResult = res
		}

		try {
			await writeToFileTool(
				bg1,
				{
					id: "tool1",
					name: "write_to_file",
					params: { path: "package.json", content: "{}" },
				},
				async () => true,
				async () => {},
				pushToolResult,
				() => "package.json",
			)
			assert.fail("Should have thrown FileRestrictionError")
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (e: any) {
			assert.ok(e.name === "FileRestrictionError", `Expected FileRestrictionError, got ${e.name}`)
		}

		// Ensure interactive stack was NOT modified
		assert.strictEqual(provider.getCurrentCline()?.taskId, parentTaskId, "Parent task should remain active")

		// 3. Test concurrent transactions
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sfaio-test-"))
		const store = await StateStore.create(tmpDir)

		const t1 = store.transaction(
			{ actor: "bg1", reason: "test", entityType: "Task", entityId: "t1" },
			// @ts-expect-error - mocking internal for testing
			(state) => {
				state.tasks["t1"] = { status: "running", agentId: "bg1", createdAt: Date.now() }
			},
		)

		const t2 = store.transaction(
			{ actor: "bg2", reason: "test", entityType: "Task", entityId: "t2" },
			// @ts-expect-error - mocking internal for testing
			(state) => {
				state.tasks["t2"] = { status: "completed", agentId: "bg2", createdAt: Date.now() }
			},
		)

		await Promise.all([t1, t2])

		const finalState = store.getState()
		assert.ok(finalState.tasks["t1"], "Transaction 1 failed to persist")
		assert.ok(finalState.tasks["t2"], "Transaction 2 failed to persist")

		// Clean up
		await provider.removeBackgroundTask(bg1.taskId)
		await api.clearCurrentTask()
	})
})

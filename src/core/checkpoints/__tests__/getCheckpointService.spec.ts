// npx vitest run core/checkpoints/__tests__/getCheckpointService.spec.ts

import { describe, expect, it, vi } from "vitest"

import { getCheckpointService } from "../index"

vi.mock("@siid-code/telemetry", () => ({ TelemetryService: { instance: { captureEvent: vi.fn() } } }))
vi.mock("../../task/Task", () => ({ Task: class {} }))
vi.mock("../../../utils/path", () => ({ getWorkspacePath: () => "/ws" }))
vi.mock("../../../utils/git", () => ({ checkGitInstalled: vi.fn().mockResolvedValue(true) }))
vi.mock("../../../i18n", () => ({ t: (key: string) => key }))
vi.mock("../../../integrations/editor/DiffViewProvider", () => ({ DIFF_VIEW_URI_SCHEME: "diff" }))
vi.mock("../../../integrations/editor/editorColumn", () => ({ withEditorColumn: vi.fn() }))
vi.mock("../../../services/file-changes/deploymentStatus", () => ({ getDeploymentStatuses: vi.fn() }))
vi.mock("../../../shared/getApiMetrics", () => ({ getApiMetrics: vi.fn() }))

const created = vi.hoisted(() => [] as any[])
vi.mock("../../../services/checkpoints", () => ({
	RepoPerTaskCheckpointService: {
		create: vi.fn(() => {
			let resolveInit!: () => void
			const handlers: Record<string, (...args: any[]) => void> = {}
			const service = {
				isInitialized: false,
				on: vi.fn((event: string, handler: (...args: any[]) => void) => {
					handlers[event] = handler
				}),
				initShadowGit: vi.fn(
					() =>
						new Promise<void>((resolve) => {
							resolveInit = () => {
								service.isInitialized = true
								handlers.initialize?.()
								resolve()
							}
						}),
				),
				finishInit: () => resolveInit(),
			}
			created.push(service)
			return service
		}),
	},
}))

function fakeTask(taskId: string) {
	const provider = {
		log: vi.fn(),
		context: { globalStorageUri: { fsPath: "/storage" } },
		postMessageToWebview: vi.fn(),
	}
	return {
		taskId,
		instanceId: Math.random().toString(36).slice(2, 8),
		enableCheckpoints: true,
		checkpointService: undefined as any,
		checkpointServiceInitializing: false,
		providerRef: { deref: () => provider },
		say: vi.fn().mockResolvedValue(undefined),
	} as any
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("getCheckpointService", () => {
	it("gives a task reopened during its previous instance's init its own service, after the old init", async () => {
		created.length = 0
		const old = fakeTask("task-1")
		const fresh = fakeTask("task-1")

		const first = getCheckpointService(old)
		await tick()
		expect(created).toHaveLength(1)
		expect(old.checkpointServiceInitializing).toBe(true)

		// Same task id, new instance: not the old promise (which only ever sets
		// old.checkpointService), but serialised behind it so the two never run
		// `git init` on the same shadow directory at once.
		const second = getCheckpointService(fresh)
		expect(second).not.toBe(first)
		await tick()
		expect(created).toHaveLength(1)
		expect(fresh.checkpointService).toBeUndefined()

		created[0].finishInit()
		expect(await first).toBe(created[0])
		expect(old.checkpointService).toBe(created[0])
		expect(old.checkpointServiceInitializing).toBe(false)

		await tick()
		expect(created).toHaveLength(2)
		created[1].finishInit()
		expect(await second).toBe(created[1])
		expect(fresh.checkpointService).toBe(created[1])
		expect(fresh.checkpointServiceInitializing).toBe(false)
	})

	it("joins the in-flight init of the same instance and returns the built service afterwards", async () => {
		created.length = 0
		const task = fakeTask("task-2")
		const a = getCheckpointService(task)
		const b = getCheckpointService(task)
		await tick()
		expect(created).toHaveLength(1) // the second caller joined the first init
		created[0].finishInit()
		expect(await a).toBe(created[0])
		expect(await b).toBe(created[0])
		expect(await getCheckpointService(task)).toBe(created[0])
		expect(created).toHaveLength(1)
	})

	it("returns undefined without initialising when checkpoints are disabled", async () => {
		created.length = 0
		const task = fakeTask("task-3")
		task.enableCheckpoints = false
		expect(await getCheckpointService(task)).toBeUndefined()
		expect(created).toHaveLength(0)
	})
})

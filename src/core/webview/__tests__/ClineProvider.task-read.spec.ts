// npx vitest run core/webview/__tests__/ClineProvider.task-read.spec.ts
//
// A save replaces the task's history file, so a read can land in the moment it
// is absent. That must neither lose a cancel nor delete the task from history.

import fs from "fs/promises"

import { fileExistsAtPath } from "../../../utils/fs"
import { ClineProvider } from "../ClineProvider"

vi.mock("vscode", () => ({
	window: { createTextEditorDecorationType: vi.fn(() => ({})), showErrorMessage: vi.fn() },
	workspace: { getConfiguration: vi.fn(() => ({ get: vi.fn() })), workspaceFolders: [] },
	env: { uriScheme: "vscode", language: "en", machineId: "m", sessionId: "s", appName: "t" },
	ExtensionMode: { Production: 1, Development: 2, Test: 3 },
	Uri: { file: (p: string) => ({ fsPath: p }), joinPath: vi.fn() },
	EventEmitter: vi.fn(),
	RelativePattern: vi.fn(),
	ThemeIcon: vi.fn(),
	ConfigurationTarget: { Global: 1 },
}))

vi.mock("../../task/Task", () => ({ Task: class {} }))

vi.mock("delay", () => ({ default: () => Promise.resolve() }))

vi.mock("fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("fs/promises")>()
	const readFile = vi.fn()
	return { ...actual, readFile, default: { ...actual, readFile } }
})

vi.mock("../../../utils/fs", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../../utils/fs")>()),
	fileExistsAtPath: vi.fn(),
}))

vi.mock("../../../utils/storage", () => ({
	getTaskDirectoryPath: vi.fn().mockResolvedValue("/tasks/t1"),
	getSettingsDirectoryPath: vi.fn(),
	getStorageBasePath: vi.fn(),
}))

const enoent = () => Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" })

describe("ClineProvider task history reads", () => {
	const historyItem = { id: "t1", ts: 1, task: "x" }

	const fakeProvider = () => ({
		getGlobalState: vi.fn(() => [historyItem]),
		contextProxy: { globalStorageUri: { fsPath: "/storage" } },
		deleteTaskFromState: vi.fn().mockResolvedValue(undefined),
	})

	const getTaskWithId = (provider: ReturnType<typeof fakeProvider>) =>
		(ClineProvider.prototype.getTaskWithId as any).call(provider, "t1")

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("reads the file again when it vanished between the check and the read", async () => {
		vi.mocked(fileExistsAtPath).mockResolvedValue(true)
		vi.mocked(fs.readFile).mockRejectedValueOnce(enoent()).mockResolvedValueOnce("[]")
		const provider = fakeProvider()

		const result = await getTaskWithId(provider)

		expect(result.historyItem).toBe(historyItem)
		expect(result.apiConversationHistory).toEqual([])
		expect(provider.deleteTaskFromState).not.toHaveBeenCalled()
	})

	it("does not delete the task when the file is briefly absent", async () => {
		vi.mocked(fileExistsAtPath).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
		vi.mocked(fs.readFile).mockResolvedValueOnce("[]")
		const provider = fakeProvider()

		await expect(getTaskWithId(provider)).resolves.toBeTruthy()
		expect(provider.deleteTaskFromState).not.toHaveBeenCalled()
	})

	it("still treats a task whose file stays absent as gone", async () => {
		vi.mocked(fileExistsAtPath).mockResolvedValue(false)
		const provider = fakeProvider()

		await expect(getTaskWithId(provider)).rejects.toThrow("Task not found")
		expect(provider.deleteTaskFromState).toHaveBeenCalledWith("t1")
	})

	it("does not retry a file that cannot be parsed", async () => {
		vi.mocked(fileExistsAtPath).mockResolvedValue(true)
		vi.mocked(fs.readFile).mockResolvedValue("{not json")
		const provider = fakeProvider()

		await expect(getTaskWithId(provider)).rejects.toThrow(SyntaxError)
		expect(fs.readFile).toHaveBeenCalledTimes(1)
		expect(provider.deleteTaskFromState).not.toHaveBeenCalled()
	})

	it("aborts on cancel without reading history first, so a racing save cannot lose the cancel", async () => {
		const order: string[] = []
		const task = {
			taskId: "t1",
			getTaskDuration: () => 0,
			abortTask: vi.fn(async () => {
				order.push("abort")
			}),
			isStreaming: false,
		}
		const provider = {
			getCurrentCline: () => task,
			getTaskWithId: vi.fn(async () => {
				order.push("read")
				return { historyItem: { ...historyItem, duration: 0 } }
			}),
			postMessageToWebview: vi.fn(),
			postStateToWebview: vi.fn().mockResolvedValue(undefined),
			initClineWithHistoryItem: vi.fn().mockResolvedValue(undefined),
		}

		await (ClineProvider.prototype.cancelTask as any).call(provider)

		expect(order).toEqual(["abort", "read"])
		expect(provider.initClineWithHistoryItem).toHaveBeenCalledTimes(1)
	})
})

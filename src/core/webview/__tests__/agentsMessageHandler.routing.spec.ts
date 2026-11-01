const executeCommand = vi.fn()
const showTextDocument = vi.fn()
const execFileMock = vi.fn()

vi.mock("vscode", () => ({
	workspace: { workspaceFolders: [{ uri: { fsPath: "/ws-first" } }], fs: {} },
	window: {
		showTextDocument: (...a: any[]) => showTextDocument(...a),
		showWarningMessage: vi.fn(),
		tabGroups: { all: [1, 2] },
	},
	commands: { executeCommand: (...a: any[]) => executeCommand(...a) },
	Uri: { file: (p: string) => ({ fsPath: p }) },
	FileType: { Directory: 2 },
	ViewColumn: { Beside: -2, One: 1, Two: 2 },
}))
vi.mock("child_process", () => ({ execFile: (...a: any[]) => execFileMock(...a) }))

import * as path from "path"
import { handleAgentsMessage, gitStatus } from "../agentsMessageHandler"
import { setAgentsPanelOpen } from "../../../integrations/editor/editorColumn"

const file = path.resolve("/ws/a.ts")
const provider = () => ({ cwd: path.resolve("/ws"), postMessageToWebview: vi.fn() }) as any

describe("agentsMessageHandler routing", () => {
	beforeEach(() => {
		executeCommand.mockReset()
		showTextDocument.mockReset()
		execFileMock.mockReset()
	})
	afterEach(() => setAgentsPanelOpen(false))

	it("opens files in group Two (not Beside) while the Agents panel is open", async () => {
		setAgentsPanelOpen(true)
		await handleAgentsMessage(provider(), { type: "agentsOpenFile", text: file } as any)
		expect(showTextDocument.mock.calls[0][1]).toMatchObject({ viewColumn: 2, preview: true })
	})

	it("keeps ViewColumn.Beside when the panel is closed", async () => {
		await handleAgentsMessage(provider(), { type: "agentsOpenFile", text: file } as any)
		expect(showTextDocument.mock.calls[0][1]).toMatchObject({ viewColumn: -2 })
	})

	it("makes group Two active (focused) before git.openChange while open", async () => {
		setAgentsPanelOpen(true)
		const order: string[] = []
		showTextDocument.mockImplementation(async (_u, o) => void order.push(`show:${o.viewColumn}:${o.preserveFocus}`))
		executeCommand.mockImplementation(async (c: string) => void order.push(c))
		await handleAgentsMessage(provider(), { type: "agentsOpenDiff", text: file } as any)
		expect(order).toEqual(["show:2:false", "git.openChange"])
	})

	it("does not pre-open anything for git.openChange when the panel is closed", async () => {
		await handleAgentsMessage(provider(), { type: "agentsOpenDiff", text: file } as any)
		expect(showTextDocument).not.toHaveBeenCalled()
		expect(executeCommand).toHaveBeenCalledWith("git.openChange", expect.anything())
	})

	it("uses provider.cwd as the root, not workspaceFolders[0]", async () => {
		await handleAgentsMessage(provider(), { type: "agentsOpenFile", text: path.resolve("/ws-first/x.ts") } as any)
		expect(showTextDocument).not.toHaveBeenCalled()
	})

	it("git status uses --untracked-files=normal and reports a non-repo distinctly", async () => {
		execFileMock.mockImplementation((_c, _a, _o, cb) =>
			cb(new Error("x"), "", "fatal: not a git repository (or any of the parent directories): .git"),
		)
		const p = provider()
		await handleAgentsMessage(p, { type: "agentsGetChanges" } as any)
		expect(execFileMock.mock.calls[0][1]).toContain("--untracked-files=normal")
		expect(p.postMessageToWebview).toHaveBeenCalledWith({
			type: "agentsChanges",
			payload: { changes: [], notRepo: true },
		})
	})

	it("other git failures stay raw errors; success returns output", async () => {
		execFileMock.mockImplementationOnce((_c, _a, _o, cb) => cb(new Error("boom"), "", "boom"))
		await expect(gitStatus("/ws")).rejects.toThrow("boom")
		execFileMock.mockImplementationOnce((_c, _a, _o, cb) => cb(null, " M a.ts\0", ""))
		await expect(gitStatus("/ws")).resolves.toEqual({ output: " M a.ts\0" })
	})
})

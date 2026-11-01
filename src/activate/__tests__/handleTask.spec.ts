const executeCommand = vi.fn()
vi.mock("vscode", () => ({
	commands: { executeCommand: (...a: any[]) => executeCommand(...a) },
	window: { showInputBox: vi.fn().mockResolvedValue(undefined) },
	ViewColumn: { Two: 2 },
}))
vi.mock("../../i18n", () => ({ t: (k: string) => k }))
vi.mock("../../core/webview/ClineProvider", () => ({ ClineProvider: { handleCodeAction: vi.fn() } }))

import { handleNewTask } from "../handleTask"
import { setAgentsPanelOpen, setAgentsPanelRef } from "../../integrations/editor/editorColumn"

describe("handleNewTask without a prompt", () => {
	afterEach(() => setAgentsPanelOpen(false))

	it("focuses the sidebar when the Agents panel is closed (unchanged)", async () => {
		await handleNewTask(null)
		expect(executeCommand).toHaveBeenCalledWith(expect.stringContaining("SidebarProvider.focus"))
	})

	it("does not open the sidebar while the Agents panel is open; reveals it without focus", async () => {
		executeCommand.mockClear()
		const panel = { viewColumn: 1, reveal: vi.fn() } as any
		setAgentsPanelOpen(true)
		setAgentsPanelRef(panel)
		await handleNewTask(null)
		expect(executeCommand).not.toHaveBeenCalled()
		expect(panel.reveal).toHaveBeenCalledWith(1, true)
	})
})

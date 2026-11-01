import * as vscode from "vscode"
import {
	setAgentsPanelOpen,
	setAgentsPanelRef,
	prepareEditorColumn,
	revealAgentsPanel,
	withEditorColumn,
	getEditorColumn,
} from "../editorColumn"

const executeCommand = vi.fn().mockResolvedValue(undefined)
let groups = 1

vi.mock("vscode", () => ({
	ViewColumn: { Active: -1, Beside: -2, One: 1, Two: 2 },
	commands: { executeCommand: (...a: any[]) => executeCommand(...a) },
	window: {
		tabGroups: {
			get all() {
				return new Array(groups)
			},
		},
	},
}))

describe("editorColumn layout and reveal", () => {
	beforeEach(() => {
		executeCommand.mockClear()
		groups = 1
	})
	afterEach(() => setAgentsPanelOpen(false))

	it("does nothing while the panel is closed", async () => {
		await prepareEditorColumn()
		withEditorColumn({})
		expect(executeCommand).not.toHaveBeenCalled()
	})

	it("sets a 62/38 layout once when only one group exists, even with concurrent openers", async () => {
		setAgentsPanelOpen(true)
		await Promise.all([prepareEditorColumn(), prepareEditorColumn()])
		withEditorColumn({})
		getEditorColumn()
		await prepareEditorColumn()
		expect(executeCommand).toHaveBeenCalledTimes(1)
		expect(executeCommand).toHaveBeenCalledWith("vscode.setEditorLayout", {
			orientation: 0,
			groups: [{ size: 0.62 }, { size: 0.38 }],
		})
	})

	it("leaves an existing multi-group layout alone", async () => {
		groups = 2
		setAgentsPanelOpen(true)
		await prepareEditorColumn()
		expect(executeCommand).not.toHaveBeenCalled()
	})

	it("re-arms for the next time the panel opens", async () => {
		setAgentsPanelOpen(true)
		await prepareEditorColumn()
		setAgentsPanelOpen(false)
		setAgentsPanelOpen(true)
		await prepareEditorColumn()
		expect(executeCommand).toHaveBeenCalledTimes(2)
	})

	it("a failing layout command never rejects", async () => {
		executeCommand.mockRejectedValueOnce(new Error("no"))
		setAgentsPanelOpen(true)
		await expect(prepareEditorColumn()).resolves.toBeUndefined()
	})

	it("revealAgentsPanel reveals in the panel's own column with preserveFocus, only when open", () => {
		const panel = { viewColumn: 1, reveal: vi.fn() } as any
		setAgentsPanelOpen(true)
		setAgentsPanelRef(panel)
		expect(revealAgentsPanel(true)).toBe(true)
		expect(panel.reveal).toHaveBeenCalledWith(1, true)
		setAgentsPanelOpen(false)
		expect(revealAgentsPanel(true)).toBe(false)
		expect(vscode.ViewColumn.Two).toBe(2)
	})
})

vi.mock("vscode", () => ({
	ViewColumn: { Active: -1, One: 1, Two: 2 },
	commands: { executeCommand: vi.fn() },
}))
vi.mock("../../core/webview/ClineProvider", () => ({ ClineProvider: { sideBarId: "side" } }))

import { focusPanel } from "../focusPanel"

describe("focusPanel", () => {
	it("reveals a tab panel in its own column, not the active group", async () => {
		const panel = { active: false, viewColumn: 1, reveal: vi.fn() } as any
		await focusPanel(panel, undefined)
		expect(panel.reveal).toHaveBeenCalledWith(1, false)
	})

	it("falls back to Active when the panel has no column (new-tab behaviour)", async () => {
		const panel = { active: false, viewColumn: undefined, reveal: vi.fn() } as any
		await focusPanel(panel, undefined)
		expect(panel.reveal).toHaveBeenCalledWith(-1, false)
	})
})

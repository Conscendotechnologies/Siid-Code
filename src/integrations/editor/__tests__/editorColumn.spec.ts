import * as vscode from "vscode"
import { setAgentsPanelOpen, isAgentsPanelOpen, getEditorColumn, withEditorColumn } from "../editorColumn"

vi.mock("vscode", () => ({
	ViewColumn: { Active: -1, Beside: -2, One: 1, Two: 2 },
}))

describe("editorColumn", () => {
	afterEach(() => setAgentsPanelOpen(false))

	it("defaults to closed and passes the existing column through", () => {
		expect(isAgentsPanelOpen()).toBe(false)
		expect(getEditorColumn()).toBeUndefined()
		expect(getEditorColumn(vscode.ViewColumn.Active)).toBe(vscode.ViewColumn.Active)
	})

	it("returns ViewColumn.Two while the Agents panel is open", () => {
		setAgentsPanelOpen(true)
		expect(isAgentsPanelOpen()).toBe(true)
		expect(getEditorColumn()).toBe(vscode.ViewColumn.Two)
		expect(getEditorColumn(vscode.ViewColumn.Active)).toBe(vscode.ViewColumn.Two)
	})

	it("returns to the existing column after the panel closes", () => {
		setAgentsPanelOpen(true)
		setAgentsPanelOpen(false)
		expect(getEditorColumn(vscode.ViewColumn.Active)).toBe(vscode.ViewColumn.Active)
	})

	it("withEditorColumn returns the same options object when closed", () => {
		const opts = { preview: false, preserveFocus: true }
		expect(withEditorColumn(opts)).toBe(opts)
	})

	it("withEditorColumn sets viewColumn Two when open, overriding Active, without mutating input", () => {
		setAgentsPanelOpen(true)
		const opts = { preview: false, viewColumn: vscode.ViewColumn.Active, preserveFocus: true }
		expect(withEditorColumn(opts)).toEqual({ preview: false, viewColumn: 2, preserveFocus: true })
		expect(opts.viewColumn).toBe(vscode.ViewColumn.Active)
	})
})

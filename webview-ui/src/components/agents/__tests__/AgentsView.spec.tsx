import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"

import en from "../../../i18n/locales/en/agents.json"
import AgentsView from "../AgentsView"
import { buildModelDetail, filterSessions, formatContextWindow } from "../agentsFormat"

const postMessage = vi.fn()
vi.mock("@/utils/vscode", () => ({ vscode: { postMessage: (m: any) => postMessage(m) } }))
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (k: string) =>
			k
				.split(":")[1]
				.split(".")
				.reduce((o: any, p) => o?.[p], en) ?? k,
	}),
}))
vi.mock("@/components/ui/hooks/useSelectedModel", () => ({
	useSelectedModel: () => ({ id: "claude-test", info: { contextWindow: 1_000_000 } }),
}))
vi.mock("@/components/ui/standard-tooltip", () => ({
	StandardTooltip: ({ children, content }: any) => <span data-tooltip={content}>{children}</span>,
}))

let state: any
vi.mock("@/context/ExtensionStateContext", () => ({ useExtensionState: () => state }))

const baseState = () => ({
	taskHistory: [
		{ id: "a", task: "Fix login bug", ts: 2, workspace: "/w" },
		{ id: "b", task: "Write docs", ts: 1, workspace: "/other" },
	],
	currentTaskItem: undefined,
	clineMessages: [],
	apiConfiguration: { apiProvider: "anthropic", reasoningEffort: "medium" },
	mode: "code",
	customModes: [],
	autoApprovalEnabled: false,
	cwd: "/w",
})

describe("AgentsView", () => {
	beforeEach(() => {
		postMessage.mockClear()
		state = baseState()
	})
	const renderView = (onSwitchTab = vi.fn()) =>
		render(<AgentsView onSwitchTab={onSwitchTab} renderChat={() => <div data-testid="chat" />} />)

	it("shows hero when empty and sends a real newTask", () => {
		renderView()
		expect(screen.getByTestId("agents-hero")).toBeInTheDocument()
		const input = screen.getByTestId("agents-input")
		fireEvent.change(input, { target: { value: "hello" } })
		fireEvent.click(screen.getByTestId("agents-send"))
		expect(postMessage).toHaveBeenCalledWith({ type: "newTask", text: "hello", images: [] })
	})

	it("hides hero when a task is active", () => {
		state.clineMessages = [{ ts: 1 }]
		renderView()
		expect(screen.queryByTestId("agents-hero")).toBeNull()
	})

	it("resumes a session, searches and filters", () => {
		renderView()
		fireEvent.click(screen.getAllByTestId("agents-session")[0])
		expect(postMessage).toHaveBeenCalledWith({ type: "showTaskWithId", text: "a" })
		fireEvent.click(screen.getByTestId("agents-search-toggle"))
		fireEvent.change(screen.getByTestId("agents-search"), { target: { value: "docs" } })
		expect(screen.getAllByTestId("agents-session")).toHaveLength(1)
		fireEvent.click(screen.getByTestId("agents-filter"))
		expect(screen.queryAllByTestId("agents-session")).toHaveLength(0)
	})

	it("new session clears the task; automations is disabled with tooltip", () => {
		renderView()
		fireEvent.click(screen.getByTestId("agents-new-session"))
		expect(postMessage).toHaveBeenCalledWith({ type: "clearTask" })
		expect(screen.getByTestId("agents-automations")).toHaveAttribute("aria-disabled", "true")
		expect(screen.getByTestId("agents-automations").closest("[data-tooltip]")).toHaveAttribute(
			"data-tooltip",
			"Coming soon",
		)
	})

	it("reflects and toggles real permission state, switches mode, opens settings", () => {
		const onSwitch = vi.fn()
		renderView(onSwitch)
		expect(screen.getByTestId("agents-permissions")).toHaveTextContent("Manual permissions")
		fireEvent.click(screen.getByTestId("agents-permissions"))
		expect(postMessage).toHaveBeenCalledWith({ type: "autoApprovalEnabled", bool: true })
		fireEvent.click(screen.getByTestId("agents-mode"))
		fireEvent.click(screen.getAllByTestId("agents-mode-option")[0])
		expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "mode" }))
		fireEvent.click(screen.getByTestId("agents-model"))
		expect(onSwitch).toHaveBeenCalledWith("settings")
		fireEvent.click(screen.getByTestId("agents-customizations"))
		expect(onSwitch).toHaveBeenCalledWith("modes")
	})

	it("shows real model detail and provider, hides missing values", () => {
		const { unmount } = renderView()
		expect(screen.getByTestId("agents-model-detail")).toHaveTextContent("Medium · Max 1M")
		expect(screen.getByTestId("agents-provider-chip")).toHaveTextContent("Anthropic")
		unmount()
		state.apiConfiguration = { apiProvider: "openai" }
		renderView()
		expect(screen.getByTestId("agents-model-detail")).toHaveTextContent("Max 1M")
	})

	it("requests the workspace tree and changes", () => {
		renderView()
		expect(postMessage).toHaveBeenCalledWith({ type: "agentsListDir", text: "" })
		fireEvent.click(screen.getByTestId("agents-tab-changes"))
		expect(postMessage).toHaveBeenCalledWith({ type: "agentsGetChanges" })
	})
})

describe("agentsFormat", () => {
	it("formats", () => {
		expect(formatContextWindow(200_000)).toBe("200K")
		expect(buildModelDetail({ maxLabel: "Max" })).toBeUndefined()
		expect(filterSessions([{ id: "x", task: "  ", ts: 1 } as any], { query: "", workspaceOnly: false })).toEqual([])
	})
})

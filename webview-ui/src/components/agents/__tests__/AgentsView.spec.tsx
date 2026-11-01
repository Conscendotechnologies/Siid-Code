import React from "react"
import { render, screen, fireEvent, act } from "@testing-library/react"

import en from "../../../i18n/locales/en/agents.json"
import AgentsView from "../AgentsView"
import { buildModelDetail, filterSessions, formatContextWindow, isTaskRunning } from "../agentsFormat"

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
let selected: any
vi.mock("@/components/ui/hooks/useSelectedModel", () => ({ useSelectedModel: () => selected }))
vi.mock("@roo/mode-models", () => ({
	getModelsForMode: () => [{ modelId: "claude-test", displayName: "Claude Test", tier: "Paid" }],
	getRecommendedModelForMode: () => undefined,
}))
vi.mock("@/components/chat/ChatView", () => ({ MAX_IMAGES_PER_MESSAGE: 20 }))
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
	useFreeModels: false,
	developerMode: false,
})

describe("AgentsView", () => {
	beforeEach(() => {
		postMessage.mockClear()
		state = baseState()
		selected = {
			id: "claude-test",
			isLoading: false,
			info: { contextWindow: 1_000_000, supportsReasoningEffort: true, supportsImages: true },
		}
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
		fireEvent.click(screen.getByTestId("agents-customizations"))
		expect(onSwitch).toHaveBeenCalledWith("modes")
	})

	it("uses the sidebar ModelSelector and no longer shows a provider chip", () => {
		renderView()
		expect(screen.getByTestId("model-selector-trigger")).toHaveTextContent("Claude Test")
		expect(screen.queryByTestId("agents-provider-chip")).toBeNull()
		selected = { ...selected, id: "claude-sonnet-4-20250514" }
		state = baseState()
		const { unmount } = renderView()
		expect(screen.getAllByTestId("model-selector-trigger").pop()).toHaveTextContent(
			"chat:modelSelector.selectModel",
		)
		unmount()
	})

	it("shows model detail only for a listed, loaded model with info", () => {
		const { unmount } = renderView()
		expect(screen.getByTestId("agents-model-detail")).toHaveTextContent("Medium · Context 1M")
		unmount()
		selected = { ...selected, info: { ...selected.info, supportsReasoningEffort: false } }
		const r2 = renderView()
		expect(screen.getByTestId("agents-model-detail")).toHaveTextContent("Context 1M")
		expect(screen.getByTestId("agents-model-detail")).not.toHaveTextContent("Medium")
		r2.unmount()
		selected = { ...selected, isLoading: true }
		const r3 = renderView()
		expect(screen.queryByTestId("agents-model-detail")).toBeNull()
		r3.unmount()
		selected = { ...selected, isLoading: false, id: "unlisted" }
		renderView()
		expect(screen.queryByTestId("agents-model-detail")).toBeNull()
	})

	it("disables attach without image support and drops held images when support is lost", () => {
		const { unmount } = renderView()
		expect(screen.getByTestId("agents-attach")).not.toBeDisabled()
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "selectedImages", context: "edit", messageTs: -1, images: ["data:a"] },
				}),
			)
		})
		unmount()
		selected = { ...selected, info: { ...selected.info, supportsImages: false } }
		renderView()
		expect(screen.getByTestId("agents-attach")).toBeDisabled()
	})

	it("mode menu (Radix popover) closes on Escape", () => {
		renderView()
		fireEvent.click(screen.getByTestId("agents-mode"))
		expect(screen.getAllByTestId("agents-mode-option").length).toBeGreaterThan(0)
		fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })
		expect(screen.queryAllByTestId("agents-mode-option")).toHaveLength(0)
	})

	it("Ctrl+N starts a session only when idle and visible", () => {
		const { unmount } = renderView()
		const idle = new KeyboardEvent("keydown", { key: "n", ctrlKey: true, cancelable: true })
		window.dispatchEvent(idle)
		expect(postMessage).toHaveBeenCalledWith({ type: "clearTask" })
		expect(idle.defaultPrevented).toBe(true)
		unmount()
		postMessage.mockClear()
		state.clineMessages = [{ ts: 1, partial: true }]
		const r2 = renderView()
		const busy = new KeyboardEvent("keydown", { key: "n", ctrlKey: true, cancelable: true })
		window.dispatchEvent(busy)
		expect(postMessage).not.toHaveBeenCalledWith({ type: "clearTask" })
		expect(busy.defaultPrevented).toBe(false)
		r2.unmount()
		state.clineMessages = []
		render(<AgentsView hidden onSwitchTab={vi.fn()} renderChat={() => <div />} />)
		window.dispatchEvent(new KeyboardEvent("keydown", { key: "n", ctrlKey: true, cancelable: true }))
		expect(postMessage).not.toHaveBeenCalledWith({ type: "clearTask" })
	})

	it("rail marks only the current session with aria-current", () => {
		state.currentTaskItem = { id: "a" }
		renderView()
		const [first, second] = screen.getAllByTestId("agents-session")
		expect(first).toHaveAttribute("aria-current", "true")
		expect(second).not.toHaveAttribute("aria-current")
	})

	it("drawer toggle opens the right pane and Escape closes it", () => {
		renderView()
		expect(screen.getByTestId("agents-right")).not.toHaveClass("agents-right-open")
		fireEvent.click(screen.getByTestId("agents-drawer-toggle"))
		expect(screen.getByTestId("agents-right")).toHaveClass("agents-right-open")
		fireEvent.keyDown(document, { key: "Escape" })
		expect(screen.getByTestId("agents-right")).not.toHaveClass("agents-right-open")
	})

	it("requests the workspace tree and changes", () => {
		renderView()
		expect(postMessage).toHaveBeenCalledWith({ type: "agentsListDir", text: "" })
		fireEvent.click(screen.getByTestId("agents-tab-changes"))
		expect(postMessage).toHaveBeenCalledWith({ type: "agentsGetChanges" })
	})
})

describe("right pane refresh", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		postMessage.mockClear()
		state = baseState()
		selected = { id: "claude-test", isLoading: false, info: {} }
	})
	afterEach(() => vi.useRealTimers())

	it("re-lists root and expanded dirs after messages change, debounced and in-flight guarded", () => {
		const { rerender } = render(<AgentsView onSwitchTab={vi.fn()} renderChat={() => <div />} />)
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "agentsDirListing",
						payload: { path: "/w", root: { name: "w", path: "/w" }, entries: [] },
					},
				}),
			)
		})
		postMessage.mockClear()
		state = { ...state, clineMessages: [{ ts: 1 }] }
		rerender(<AgentsView onSwitchTab={vi.fn()} renderChat={() => <div />} />)
		state = { ...state, clineMessages: [{ ts: 1 }, { ts: 2 }] }
		rerender(<AgentsView onSwitchTab={vi.fn()} renderChat={() => <div />} />)
		expect(postMessage).not.toHaveBeenCalledWith({ type: "agentsListDir", text: "/w" })
		act(() => {
			vi.advanceTimersByTime(1100)
		})
		const calls = postMessage.mock.calls.filter(([m]) => m.type === "agentsListDir" && m.text === "/w")
		expect(calls).toHaveLength(1)
	})

	it("shows the not-a-repo note and refreshes changes only once while pending", () => {
		render(<AgentsView onSwitchTab={vi.fn()} renderChat={() => <div />} />)
		fireEvent.click(screen.getByTestId("agents-tab-changes"))
		const count = () => postMessage.mock.calls.filter(([m]) => m.type === "agentsGetChanges").length
		expect(count()).toBe(1)
		act(() => {
			vi.advanceTimersByTime(1100)
		})
		expect(count()).toBe(1)
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "agentsChanges", payload: { changes: [], notRepo: true } },
				}),
			)
		})
		expect(screen.getByText("This folder isn't a git repository")).toBeInTheDocument()
	})
})

describe("agentsFormat", () => {
	it("formats", () => {
		expect(formatContextWindow(200_000)).toBe("200K")
		expect(buildModelDetail({ contextLabel: "Context" })).toBeUndefined()
		expect(filterSessions([{ id: "x", task: "  ", ts: 1 } as any], { query: "", workspaceOnly: false })).toEqual([])
		const noWs = { id: "y", task: "t", ts: 1 } as any
		expect(filterSessions([noWs], { query: "", workspaceOnly: true, cwd: "/w" })).toEqual([])
		expect(filterSessions([noWs], { query: "", workspaceOnly: false, cwd: "/w" })).toHaveLength(1)
		expect(isTaskRunning([{ ts: 1, type: "say", say: "api_req_started", text: "{}" } as any])).toBe(true)
		expect(isTaskRunning([{ ts: 1, type: "say", say: "api_req_started", text: '{"cost":1}' } as any])).toBe(false)
	})
})

// npx vitest run src/components/chat/__tests__/ChatView.checkpoint-wait.spec.tsx
//
// A tool waiting for the checkpoint baseline has no row and its stream has ended,
// so the footer must offer Cancel, not the previous ask's disabled buttons.

import { act, fireEvent, render, screen, waitFor } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

import ChatView, { ChatViewProps } from "../ChatView"

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("rehype-highlight", () => ({
	default: () => () => {},
}))

vi.mock("hast-util-to-text", () => ({
	default: () => "",
}))

vi.mock("../BrowserSessionRow", () => ({
	default: function MockBrowserSessionRow({ messages }: { messages: any[] }) {
		return <div data-testid="browser-session">{JSON.stringify(messages)}</div>
	},
}))

vi.mock("../ChatRow", () => ({
	default: function MockChatRow({ message }: { message: any }) {
		return <div data-testid="chat-row">{JSON.stringify(message)}</div>
	},
}))

vi.mock("../TaskHeader", () => ({
	default: function MockTaskHeader({ task }: { task: any }) {
		return <div data-testid="task-header">{JSON.stringify(task)}</div>
	},
}))

vi.mock("../AutoApproveMenu", () => ({
	default: () => null,
}))

vi.mock("@src/components/common/CodeBlock", () => ({
	default: () => null,
	CODE_BLOCK_BG_COLOR: "rgb(30, 30, 30)",
}))

vi.mock("@src/components/common/CodeAccordian", () => ({
	default: () => null,
}))

vi.mock("@src/components/chat/ContextMenu", () => ({
	default: () => null,
}))

const postState = (clineMessages: any[]) =>
	act(async () => {
		window.postMessage(
			{
				type: "state",
				state: {
					version: "1.0.0",
					clineMessages,
					taskHistory: [],
					shouldShowAnnouncement: false,
					allowedCommands: [],
					alwaysAllowExecute: false,
					autoApprovalEnabled: false,
				},
			},
			"*",
		)
	})

const queryClient = new QueryClient()

const defaultProps: ChatViewProps = {
	isHidden: false,
	showAnnouncement: false,
	hideAnnouncement: () => {},
}

const renderChatView = () =>
	render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<ChatView {...defaultProps} />
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)

const baseTs = Date.now() - 10_000

const taskMessage = { type: "say", say: "task", ts: baseTs, text: "Initial task" }

const toolAsk = (ts: number) => ({
	type: "ask",
	ask: "tool",
	ts,
	text: JSON.stringify({ tool: "readFile", path: "test.txt" }),
	partial: false,
})

const finishedRequest = (ts: number, progressStatus?: object) => ({
	type: "say",
	say: "api_req_started",
	ts,
	text: JSON.stringify({ cost: 0.01 }),
	progressStatus,
})

const blockingStatus = { text: "Snapshotting workspace for checkpoints...", icon: "sync", blocking: true }

const primaryButton = () => screen.queryByTestId("chat-primary-button")
const cancelButton = () => screen.queryByText("chat:cancel.title")
const isEnabled = (button: Element | null) => {
	const disabled = button?.getAttribute("disabled")
	return !!button && (disabled === null || disabled === "false")
}

/** The user approves a tool ask; returns the messages so far. */
const answerAsk = async (before: any[] = [taskMessage]) => {
	const answered = [...before, toolAsk(baseTs + 5)]
	await postState(answered)
	await waitFor(() => expect(isEnabled(primaryButton())).toBe(true))

	fireEvent.click(primaryButton()!)
	expect(vscode.postMessage).toHaveBeenCalledWith(
		expect.objectContaining({ type: "askResponse", askResponse: "yesButtonClicked" }),
	)

	return answered
}

describe("ChatView - tool waiting for the checkpoint baseline", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("replaces the answered ask's stale disabled buttons with a working Cancel", async () => {
		renderChatView()
		const answered = await answerAsk()

		// The reported state: the stream ended, no status yet. Old text, disabled.
		await postState([...answered, finishedRequest(baseTs + 6)])
		// The web component reflects `disabled` to the attribute asynchronously.
		await waitFor(() => {
			expect(primaryButton()).not.toBeNull()
			expect(isEnabled(primaryButton())).toBe(false)
		})
		expect(cancelButton()).toBeNull()

		await postState([...answered, finishedRequest(baseTs + 6, blockingStatus)])

		await waitFor(() => expect(cancelButton()).not.toBeNull())
		expect(primaryButton()).toBeNull()
		await waitFor(() => expect(isEnabled(cancelButton())).toBe(true))

		fireEvent.click(cancelButton()!)
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "cancelTask" })
	})

	it("shows Cancel while the wait follows an answered ask that is still the last row", async () => {
		// Two tools in one response: the second waits before posting anything, so
		// the first one's ask stays last.
		renderChatView()
		const text = { type: "say", say: "text", ts: baseTs + 2, text: "Reading, then editing." }
		const answered = await answerAsk([taskMessage, finishedRequest(baseTs + 1), text])

		await postState([taskMessage, finishedRequest(baseTs + 1, blockingStatus), text, answered.at(-1)])

		await waitFor(() => expect(cancelButton()).not.toBeNull())
		expect(primaryButton()).toBeNull()
	})

	it("still shows Approve for a real ask arriving after the wait", async () => {
		renderChatView()
		const answered = await answerAsk()

		await postState([...answered, finishedRequest(baseTs + 6, blockingStatus)])
		await waitFor(() => expect(cancelButton()).not.toBeNull())

		await postState([
			...answered,
			finishedRequest(baseTs + 6, { text: "Receiving response...", icon: "sync" }),
			toolAsk(baseTs + 7),
		])

		await waitFor(() => expect(isEnabled(primaryButton())).toBe(true))
		expect(primaryButton()!.textContent).toBe("chat:approve.title")
		expect(cancelButton()).toBeNull()
	})

	it("does not carry a cancel that never landed into the next task", async () => {
		renderChatView()
		const answered = await answerAsk()
		await postState([...answered, finishedRequest(baseTs + 6, blockingStatus)])
		await waitFor(() => expect(isEnabled(cancelButton())).toBe(true))

		fireEvent.click(cancelButton()!)
		await waitFor(() => expect(screen.queryByText("Cancelling...")).not.toBeNull())

		await postState([
			{ ...taskMessage, ts: baseTs + 100, text: "Next task" },
			finishedRequest(baseTs + 101, blockingStatus),
		])

		await waitFor(() => expect(isEnabled(cancelButton())).toBe(true))
		expect(screen.queryByText("Cancelling...")).toBeNull()
	})

	it("clears a cancel that never landed once the run stops streaming", async () => {
		renderChatView()
		const answered = await answerAsk()
		await postState([...answered, finishedRequest(baseTs + 6, blockingStatus)])
		await waitFor(() => expect(isEnabled(cancelButton())).toBe(true))

		fireEvent.click(cancelButton()!)
		await waitFor(() => expect(screen.queryByText("Cancelling...")).not.toBeNull())

		// The wait ended and the tool asked, so the run went on without the cancel.
		const nextAsk = toolAsk(baseTs + 7)
		await postState([...answered, finishedRequest(baseTs + 6), nextAsk])
		await waitFor(() => expect(isEnabled(primaryButton())).toBe(true))
		fireEvent.click(primaryButton()!)

		await postState([
			...answered,
			finishedRequest(baseTs + 6),
			nextAsk,
			finishedRequest(baseTs + 8, blockingStatus),
		])

		await waitFor(() => expect(isEnabled(cancelButton())).toBe(true))
		expect(screen.queryByText("Cancelling...")).toBeNull()
	})

	it("offers Resume, not Cancel, when a persisted blocking status reaches a resume ask", async () => {
		renderChatView()

		await postState([
			taskMessage,
			finishedRequest(baseTs + 1, blockingStatus),
			{ type: "ask", ask: "resume_task", ts: baseTs + 2, partial: false },
		])

		await waitFor(() => expect(isEnabled(primaryButton())).toBe(true))
		expect(cancelButton()).toBeNull()
	})
})

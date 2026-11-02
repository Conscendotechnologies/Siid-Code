// npx vitest run src/components/chat/__tests__/ChatView.ask-recovery.spec.tsx

import { act, render, screen, waitFor } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { vscode } from "@src/utils/vscode"

import ChatView, { ChatViewProps, ASK_RECOVERY_DELAY_MS } from "../ChatView"

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

const mockPostMessage = (state: any) => {
	window.postMessage(
		{
			type: "state",
			state: {
				version: "1.0.0",
				clineMessages: [],
				taskHistory: [],
				shouldShowAnnouncement: false,
				allowedCommands: [],
				alwaysAllowExecute: false,
				autoApprovalEnabled: true,
				...state,
			},
		},
		"*",
	)
}

const queryClient = new QueryClient()

const defaultProps: ChatViewProps = {
	isHidden: false,
	showAnnouncement: false,
	hideAnnouncement: () => {},
}

const renderChatView = (props: Partial<ChatViewProps> = {}) => {
	return render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={queryClient}>
				<ChatView {...defaultProps} {...props} />
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)
}

const taskMessage = { type: "say", say: "task", ts: Date.now() - 2000, text: "Initial task" }

const readToolAsk = (ts: number) => ({
	type: "ask",
	ask: "tool",
	ts,
	text: JSON.stringify({ tool: "readFile", path: "test.txt" }),
	partial: false,
})

// Fake clock: the real delay is 10s and only its elapse matters here.
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

const primaryButton = () => screen.getByTestId("chat-primary-button")
const isPrimaryEnabled = () => {
	const button = primaryButton()
	const disabled = button.getAttribute("disabled")
	return disabled === null || disabled === "false"
}

describe("ChatView - ask recovery after a lost auto-approve", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		// shouldAdvanceTime keeps waitFor and React's scheduler ticking.
		vi.useFakeTimers({ shouldAdvanceTime: true })
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("re-enables the buttons when the same ask is still last after ASK_RECOVERY_DELAY_MS", async () => {
		renderChatView()
		const askTs = Date.now()

		mockPostMessage({ alwaysAllowReadOnly: true, clineMessages: [taskMessage] })
		mockPostMessage({ alwaysAllowReadOnly: true, clineMessages: [taskMessage, readToolAsk(askTs)] })

		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({ type: "askResponse", askResponse: "yesButtonClicked", messageTs: askTs }),
			)
		})

		// Right after auto-approve the buttons are disabled.
		await waitFor(() => expect(isPrimaryEnabled()).toBe(false))

		// A quiet long-running approved tool must not re-show Approve early.
		await advance(ASK_RECOVERY_DELAY_MS - 1000)
		expect(isPrimaryEnabled()).toBe(false)

		// Nothing new arrives from the extension; the controls come back.
		await advance(1500)
		await waitFor(() => expect(isPrimaryEnabled()).toBe(true))

		// The recovery must not have auto-responded a second time.
		const askResponses = vi
			.mocked(vscode.postMessage)
			.mock.calls.filter(([message]: any[]) => message.type === "askResponse")
		expect(askResponses).toHaveLength(1)
	})

	it("does not re-arm Approve when the extension acknowledged the response and the tool is still running", async () => {
		renderChatView()
		const askTs = Date.now()

		mockPostMessage({ alwaysAllowReadOnly: true, clineMessages: [taskMessage] })
		mockPostMessage({ alwaysAllowReadOnly: true, clineMessages: [taskMessage, readToolAsk(askTs)] })

		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({ type: "askResponse", askResponse: "yesButtonClicked", messageTs: askTs }),
			)
		})
		await waitFor(() => expect(isPrimaryEnabled()).toBe(false))

		// The extension accepted the answer; the approved tool runs quietly for a
		// long time, so the ask row stays the last message and nothing streams.
		window.postMessage({ type: "askResponseReceived", messageTs: askTs }, "*")

		await advance(ASK_RECOVERY_DELAY_MS + 1500)
		expect(isPrimaryEnabled()).toBe(false)

		const askResponses = vi
			.mocked(vscode.postMessage)
			.mock.calls.filter(([message]: any[]) => message.type === "askResponse")
		expect(askResponses).toHaveLength(1)
	})

	it("does not re-enable the buttons when a real next message arrives", async () => {
		renderChatView()
		const askTs = Date.now()

		mockPostMessage({ alwaysAllowReadOnly: true, clineMessages: [taskMessage] })
		mockPostMessage({ alwaysAllowReadOnly: true, clineMessages: [taskMessage, readToolAsk(askTs)] })

		await waitFor(() => {
			expect(vscode.postMessage).toHaveBeenCalledWith(
				expect.objectContaining({ type: "askResponse", askResponse: "yesButtonClicked", messageTs: askTs }),
			)
		})

		// The extension accepted the approval and moved on.
		mockPostMessage({
			alwaysAllowReadOnly: true,
			clineMessages: [
				taskMessage,
				readToolAsk(askTs),
				{ type: "say", say: "api_req_started", ts: askTs + 10, text: JSON.stringify({ request: "next" }) },
			],
		})

		await waitFor(() => expect(screen.queryByTestId("chat-primary-button")).toBeNull())
		await advance(ASK_RECOVERY_DELAY_MS + 500)

		// No tool ask is pending any more, so no primary button is offered.
		expect(screen.queryByTestId("chat-primary-button")).toBeNull()
		const askResponses = vi
			.mocked(vscode.postMessage)
			.mock.calls.filter(([message]: any[]) => message.type === "askResponse")
		expect(askResponses).toHaveLength(1)
	})
})

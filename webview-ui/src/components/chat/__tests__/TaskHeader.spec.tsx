// npx vitest src/components/chat/__tests__/TaskHeader.spec.tsx

import React from "react"
import { render, screen, fireEvent } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import type { ProviderSettings } from "@siid-code/types"

import TaskHeader, { TaskHeaderProps } from "../TaskHeader"

// Mock i18n
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key, // Simple mock that returns the key
	}),
	// Mock initReactI18next to prevent initialization errors in tests
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
}))

// Mock the vscode API
vi.mock("@/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock the VSCodeBadge component
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeBadge: ({ children }: { children: React.ReactNode }) => <div data-testid="vscode-badge">{children}</div>,
}))

// Mock the ExtensionStateContext
vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		apiConfiguration: {
			apiProvider: "anthropic",
			apiKey: "test-api-key", // Add relevant fields
			apiModelId: "claude-3-opus-20240229", // Add relevant fields
		} as ProviderSettings, // Optional: Add type assertion if ProviderSettings is imported
		currentTaskItem: { id: "test-task-id" },
		// Cost display and the condense button are gated on developer mode (75b3071c9).
		developerMode: true,
	}),
}))

// Same shape the real hook has before its model lists arrive, unless a test sets otherwise.
const { selectedModel } = vi.hoisted(() => ({
	selectedModel: { current: { id: "claude-3-opus-20240229", info: undefined, isLoading: true } as any },
}))
vi.mock("@/components/ui/hooks/useSelectedModel", () => ({ useSelectedModel: () => selectedModel.current }))

describe("TaskHeader", () => {
	const loadingModel = selectedModel.current

	afterEach(() => {
		selectedModel.current = loadingModel
	})

	describe("cost when the price is unknown", () => {
		const unpriced = { contextWindow: 1_000_000, supportsPromptCache: true }

		it("shows a dash with a tooltip label instead of a cost, collapsed and expanded", () => {
			selectedModel.current = { id: "claude-opus-5-5", info: unpriced, isLoading: false }
			renderTaskHeader({ totalCost: 0 })

			expect(screen.getByTestId("task-cost-unavailable")).toHaveTextContent("—")
			expect(screen.getByTestId("task-cost-unavailable")).toHaveAttribute(
				"aria-label",
				"chat:task.priceUnavailable",
			)
			expect(screen.queryByText(/\$/)).not.toBeInTheDocument()

			fireEvent.click(screen.getByText("Test task"))
			expect(screen.getByTestId("task-cost-unavailable")).toBeInTheDocument()
			expect(screen.getByText("chat:task.apiCost")).toBeInTheDocument()
		})

		it("treats a model with no info at all as unpriced once loading has finished", () => {
			selectedModel.current = { id: "claude-opus-5-5", info: undefined, isLoading: false }
			renderTaskHeader({ totalCost: 0 })
			expect(screen.getByTestId("task-cost-unavailable")).toBeInTheDocument()
		})

		it("keeps the numeric cost when one has been recorded", () => {
			selectedModel.current = { id: "claude-opus-5-5", info: unpriced, isLoading: false }
			renderTaskHeader({ totalCost: 0.05 })
			expect(screen.getByText("$0.05")).toBeInTheDocument()
			expect(screen.queryByTestId("task-cost-unavailable")).not.toBeInTheDocument()
		})

		it("shows no dash for a model whose price is known to be 0", () => {
			selectedModel.current = {
				id: "free-model",
				info: { ...unpriced, inputPrice: 0, outputPrice: 0 },
				isLoading: false,
			}
			renderTaskHeader({ totalCost: 0 })
			expect(screen.queryByTestId("task-cost-unavailable")).not.toBeInTheDocument()
		})

		it("shows no dash while loading or before any tokens are used", () => {
			const { unmount } = renderTaskHeader({ totalCost: 0 })
			expect(screen.queryByTestId("task-cost-unavailable")).not.toBeInTheDocument()
			unmount()

			selectedModel.current = { id: "claude-opus-5-5", info: unpriced, isLoading: false }
			renderTaskHeader({ totalCost: 0, tokensIn: 0, tokensOut: 0 })
			expect(screen.queryByTestId("task-cost-unavailable")).not.toBeInTheDocument()
		})
	})

	const defaultProps: TaskHeaderProps = {
		task: { type: "say", ts: Date.now(), text: "Test task", images: [] },
		tokensIn: 100,
		tokensOut: 50,
		totalCost: 0.05,
		contextTokens: 200,
		buttonsDisabled: false,
		handleCondenseContext: vi.fn(),
	}

	const queryClient = new QueryClient()

	const renderTaskHeader = (props: Partial<TaskHeaderProps> = {}) => {
		return render(
			<QueryClientProvider client={queryClient}>
				<TaskHeader {...defaultProps} {...props} />
			</QueryClientProvider>,
		)
	}

	it("should display cost when totalCost is greater than 0", () => {
		renderTaskHeader()
		expect(screen.getByText("$0.05")).toBeInTheDocument()
	})

	it("should not display cost when totalCost is 0", () => {
		renderTaskHeader({ totalCost: 0 })
		expect(screen.queryByText("$0.0000")).not.toBeInTheDocument()
	})

	it("should not display cost when totalCost is null", () => {
		renderTaskHeader({ totalCost: null as any })
		expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
	})

	it("should not display cost when totalCost is undefined", () => {
		renderTaskHeader({ totalCost: undefined as any })
		expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
	})

	it("should not display cost when totalCost is NaN", () => {
		renderTaskHeader({ totalCost: NaN })
		expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
	})

	it("should render the condense context button when expanded", () => {
		renderTaskHeader()
		// First click to expand the task header
		const taskHeader = screen.getByText("Test task")
		fireEvent.click(taskHeader)

		// Now find the condense button in the expanded state
		const buttons = screen.getAllByRole("button")
		const condenseButton = buttons.find((button) => button.querySelector("svg.lucide-fold-vertical"))
		expect(condenseButton).toBeDefined()
		expect(condenseButton?.querySelector("svg")).toBeInTheDocument()
	})

	it("should call handleCondenseContext when condense context button is clicked", () => {
		const handleCondenseContext = vi.fn()
		renderTaskHeader({ handleCondenseContext })

		// First click to expand the task header
		const taskHeader = screen.getByText("Test task")
		fireEvent.click(taskHeader)

		// Find the button that contains the FoldVertical icon
		const buttons = screen.getAllByRole("button")
		const condenseButton = buttons.find((button) => button.querySelector("svg.lucide-fold-vertical"))
		expect(condenseButton).toBeDefined()
		fireEvent.click(condenseButton!)
		expect(handleCondenseContext).toHaveBeenCalledWith("test-task-id")
	})

	it("should disable the condense context button when buttonsDisabled is true", () => {
		const handleCondenseContext = vi.fn()
		renderTaskHeader({ buttonsDisabled: true, handleCondenseContext })

		// First click to expand the task header
		const taskHeader = screen.getByText("Test task")
		fireEvent.click(taskHeader)

		// Find the button that contains the FoldVertical icon
		const buttons = screen.getAllByRole("button")
		const condenseButton = buttons.find((button) => button.querySelector("svg.lucide-fold-vertical"))
		expect(condenseButton).toBeDefined()
		expect(condenseButton).toBeDisabled()
		fireEvent.click(condenseButton!)
		expect(handleCondenseContext).not.toHaveBeenCalled()
	})
})

import React from "react"
import { render, screen, fireEvent } from "@/utils/test-utils"
import { describe, test, expect, vi, beforeEach } from "vitest"

import { ModelSelector } from "../ModelSelector"

vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/ui/hooks/useRooPortal", () => ({
	useRooPortal: () => document.body,
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({ modeModelListVersion: 0 }),
}))

const { mockPostMessage } = vi.hoisted(() => ({ mockPostMessage: vi.fn() }))

vi.mock("@/utils/vscode", () => ({
	vscode: { postMessage: mockPostMessage },
}))

vi.mock("@/components/ui", () => ({
	Popover: ({ children, onOpenChange }: any) => (
		<div>
			<button data-testid="open-popover" onClick={() => onOpenChange?.(true)} />
			{children}
		</div>
	),
	PopoverTrigger: ({ children, disabled, "data-testid": testId }: any) => (
		<div data-disabled={disabled} data-testid={testId}>
			{children}
		</div>
	),
	PopoverContent: ({ children }: any) => <div>{children}</div>,
	StandardTooltip: ({ children }: any) => <>{children}</>,
}))

// The model list is the unit under test's data source, so it is stubbed to
// exercise catalogue changes (re-tiering, removal, odd display names) that the
// real list does not currently contain.
const { mockGetModelsForMode, mockGetRecommendedModelForMode } = vi.hoisted(() => ({
	mockGetModelsForMode: vi.fn(),
	mockGetRecommendedModelForMode: vi.fn(),
}))

vi.mock("@roo/mode-models", () => ({
	getModelsForMode: mockGetModelsForMode,
	getRecommendedModelForMode: mockGetRecommendedModelForMode,
}))

const FREE = { modelId: "vendor/free-model:free", displayName: "Free Model (Free)", tier: "Free" as const }
const PAID = { modelId: "vendor/paid-model", displayName: "Paid Model", tier: "Premium" as const }

const renderSelector = (props: Partial<React.ComponentProps<typeof ModelSelector>> = {}) =>
	render(<ModelSelector value={FREE.modelId} mode={"code" as any} onChange={vi.fn()} {...props} />)

describe("ModelSelector", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockGetModelsForMode.mockReturnValue([FREE, PAID])
		mockGetRecommendedModelForMode.mockReturnValue(undefined)
	})

	describe("recommended suffix", () => {
		test("folds the suffix into a name that ends in a parenthetical", () => {
			mockGetRecommendedModelForMode.mockReturnValue(FREE.modelId)
			renderSelector()
			expect(screen.getAllByText("Free Model (Free, Recommended)").length).toBeGreaterThan(0)
		})

		// A paid model has no "(Free)" to fold into, so a naive suffix would
		// produce an unbalanced paren like "Paid Model, Recommended)".
		test("appends its own parenthetical to a name without one", () => {
			mockGetRecommendedModelForMode.mockReturnValue(PAID.modelId)
			renderSelector({ value: PAID.modelId })
			expect(screen.getAllByText("Paid Model (Recommended)").length).toBeGreaterThan(0)
		})

		test("marks only the recommended model", () => {
			mockGetRecommendedModelForMode.mockReturnValue(FREE.modelId)
			renderSelector()
			expect(screen.getAllByText("Paid Model").length).toBeGreaterThan(0)
		})

		test("leaves every name untouched when the mode recommends nothing", () => {
			renderSelector()
			expect(screen.getAllByText("Free Model (Free)").length).toBeGreaterThan(0)
			expect(screen.getAllByText("Paid Model").length).toBeGreaterThan(0)
		})
	})

	describe("filtering", () => {
		test("shows only free models when useFreeModels is on", () => {
			renderSelector({ useFreeModels: true })
			expect(screen.getAllByText("Free Model (Free)").length).toBeGreaterThan(0)
			expect(screen.queryByText("Paid Model")).toBeNull()
		})

		test("shows every model in developer mode regardless of useFreeModels", () => {
			renderSelector({ useFreeModels: true, developerMode: true })
			expect(screen.getAllByText("Paid Model").length).toBeGreaterThan(0)
		})
	})

	describe("volatile provider catalogue", () => {
		// The stored id is what requests use, so it is named rather than replaced
		// by a prompt that implies no model is set.
		test("names a stored model that is not in the list by its id", () => {
			const onChange = vi.fn()
			renderSelector({ value: "claude-opus-5-5", onChange })

			const trigger = screen.getByTestId("model-selector-trigger")
			expect(trigger).toHaveTextContent("claude-opus-5-5")
			expect(trigger).not.toHaveTextContent("chat:modelSelector.selectModel")
			expect(onChange).not.toHaveBeenCalled()
		})

		test("compacts a vendor path on the trigger and keeps the full id as its title", () => {
			renderSelector({ value: "vendor/removed-model" })

			const label = screen.getByText("removed-model")
			expect(label.closest("[data-testid='model-selector-trigger']")).not.toBeNull()
			expect(label).toHaveAttribute("title", "vendor/removed-model")
		})

		test("does not put a title on a model the list can name", () => {
			renderSelector({ value: PAID.modelId })
			const trigger = screen.getByTestId("model-selector-trigger")
			expect(trigger.querySelector("[title]")).toBeNull()
		})

		test("prompts only when there is truly no model", () => {
			renderSelector({ value: "" })
			expect(screen.getByTestId("model-selector-trigger")).toHaveTextContent("chat:modelSelector.selectModel")
		})

		test("the dropdown keeps the mode's list and picking from it still works", () => {
			const onChange = vi.fn()
			renderSelector({ value: "claude-opus-5-5", onChange })

			expect(screen.getAllByText("Paid Model").length).toBeGreaterThan(0)
			expect(screen.getAllByText("claude-opus-5-5")).toHaveLength(1)

			fireEvent.click(screen.getByText("Paid Model"))
			expect(onChange).toHaveBeenCalledWith(PAID.modelId)
		})

		// A model that moved from free to paid drops out of the free-only list,
		// but it stays in use, so the trigger keeps its name.
		test("keeps the name of a stored model filtered out by useFreeModels", () => {
			renderSelector({ value: PAID.modelId, useFreeModels: true })

			expect(screen.getByTestId("model-selector-trigger")).toHaveTextContent("Paid Model")
			expect(screen.getAllByText("Free Model (Free)").length).toBeGreaterThan(0)
			expect(screen.getAllByText("Paid Model")).toHaveLength(1)
		})

		test("names an off-list stored model under useFreeModels and developerMode alike", () => {
			const first = renderSelector({ value: "claude-opus-5-5", useFreeModels: true })
			expect(screen.getByTestId("model-selector-trigger")).toHaveTextContent("claude-opus-5-5")
			first.unmount()

			renderSelector({ value: "claude-opus-5-5", useFreeModels: true, developerMode: true })
			expect(screen.getByTestId("model-selector-trigger")).toHaveTextContent("claude-opus-5-5")
			expect(screen.getAllByText("Paid Model").length).toBeGreaterThan(0)
		})

		test("renders nothing when the mode has no models at all", () => {
			mockGetModelsForMode.mockReturnValue([])
			const { container } = renderSelector()
			expect(container).toBeEmptyDOMElement()
		})

		test("renders nothing when filtering removes every model", () => {
			mockGetModelsForMode.mockReturnValue([PAID])
			const { container } = renderSelector({ useFreeModels: true })
			expect(container).toBeEmptyDOMElement()
		})
	})
	// Opening the picker is what triggers a refresh, so a list that went stale
	// while the window sat open is corrected at the moment it is looked at.
	describe("refresh on open", () => {
		test("asks the extension to refresh the list when opened", () => {
			renderSelector()
			expect(mockPostMessage).not.toHaveBeenCalled()

			fireEvent.click(screen.getByTestId("open-popover"))

			expect(mockPostMessage).toHaveBeenCalledWith({ type: "refreshModeModelList" })
		})
	})
})

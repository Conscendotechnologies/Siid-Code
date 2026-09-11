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
	PopoverTrigger: ({ children, disabled }: any) => <div data-disabled={disabled}>{children}</div>,
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
		// Removing a model must not blank the trigger: the user keeps their
		// stored id and needs a visible prompt to choose again.
		test("still renders when the stored model is no longer in the list", () => {
			renderSelector({ value: "vendor/removed-model" })
			// Prompts for a new pick rather than showing a bare id, and does not
			// silently switch the user to another model.
			expect(screen.getAllByText("chat:modelSelector.selectModel").length).toBeGreaterThan(0)
			expect(screen.queryByText("vendor/removed-model")).toBeNull()
		})

		// A model that moved from free to paid drops out of the free-only list,
		// so the selector must not crash on a now-missing selection.
		test("handles a stored model that has been re-tiered out of the list", () => {
			renderSelector({ value: PAID.modelId, useFreeModels: true })
			expect(screen.getAllByText("Free Model (Free)").length).toBeGreaterThan(0)
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

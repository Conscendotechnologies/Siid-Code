import { describe, it, expect, vi, beforeEach } from "vitest"
import { NineRouterHandler } from "../9router"
import { nineRouterDefaultModelId, nineRouterDefaultModelInfo } from "@siid-code/types"

describe("NineRouterHandler", () => {
	let handler: NineRouterHandler
	const mockOptions = {
		nineRouterBaseUrl: "http://localhost:20128/v1",
		nineRouterApiKey: "test-api-key",
		nineRouterModelId: "claude-3-7-sonnet",
	}

	beforeEach(() => {
		vi.clearAllMocks()
		handler = new NineRouterHandler(mockOptions)
	})

	describe("constructor", () => {
		it("should initialize with default options when none are provided", () => {
			const defaultHandler = new NineRouterHandler({})
			expect(defaultHandler).toBeDefined()
			const { id, info } = defaultHandler.getModel()
			expect(id).toBe(nineRouterDefaultModelId)
			expect(info).toEqual(nineRouterDefaultModelInfo)
		})

		it("should initialize with custom options", () => {
			expect(handler).toBeDefined()
			const { id, info } = handler.getModel()
			expect(id).toBe("claude-3-7-sonnet")
			expect(info).toEqual(nineRouterDefaultModelInfo)
		})
	})

	describe("getModel", () => {
		it("should return correct model info", () => {
			const { id, info } = handler.getModel()
			expect(id).toBe("claude-3-7-sonnet")
			expect(info).toEqual(nineRouterDefaultModelInfo)
		})
	})
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import axios from "axios"
import { getNineRouterModels } from "../9router"
import { nineRouterDefaultModelInfo } from "@siid-code/types"

vi.mock("axios")

describe("getNineRouterModels", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("fetches and parses models from 9Router OpenAI-compatible endpoint", async () => {
		const mockResponse = {
			data: {
				data: [{ id: "command-code" }, { id: "claude-3-7-sonnet" }],
			},
		}

		vi.mocked(axios.get).mockResolvedValueOnce(mockResponse as any)

		const result = await getNineRouterModels("test-key", "http://localhost:20128/v1")

		expect(axios.get).toHaveBeenCalledWith(
			"http://localhost:20128/v1/models",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer test-key",
				}),
			}),
		)

		expect(result).toHaveProperty("command-code")
		expect(result).toHaveProperty("claude-3-7-sonnet")
		expect(result["command-code"].maxTokens).toBe(nineRouterDefaultModelInfo.maxTokens)
	})

	it("handles fallback array responses", async () => {
		const mockResponse = {
			data: [{ id: "custom-model" }],
		}

		vi.mocked(axios.get).mockResolvedValueOnce(mockResponse as any)

		const result = await getNineRouterModels(undefined, "http://localhost:20128")

		expect(axios.get).toHaveBeenCalledWith("http://localhost:20128/models", expect.any(Object))
		expect(result).toHaveProperty("custom-model")
	})
})

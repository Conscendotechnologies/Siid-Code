import axios from "axios"
import { anthropicModels } from "@siid-code/types"
import { vi, describe, it, expect, beforeEach } from "vitest"

import { anthropicCacheKey, fetchAnthropicApiModels, getAnthropicModels, mergeAnthropicModels } from "../anthropic"

vi.mock("axios")
const mockGet = vi.mocked(axios.get)

const page = (ids: string[], hasMore: boolean) => ({
	status: 200,
	data: { data: ids.map((id) => ({ id })), has_more: hasMore, last_id: ids[ids.length - 1] },
})

describe("anthropic fetcher", () => {
	beforeEach(() => vi.clearAllMocks())

	it("follows pagination with after_id", async () => {
		mockGet.mockResolvedValueOnce(page(["a", "b"], true)).mockResolvedValueOnce(page(["c"], false))
		const models = await fetchAnthropicApiModels({ apiKey: "k" })
		expect(models.map((m) => m.id)).toEqual(["a", "b", "c"])
		expect(mockGet).toHaveBeenCalledTimes(2)
		expect(mockGet.mock.calls[0][1]?.params).toEqual({ limit: 1000 })
		expect(mockGet.mock.calls[1][1]?.params).toEqual({ limit: 1000, after_id: "b" })
		expect(mockGet.mock.calls[0][0]).toBe("https://api.anthropic.com/v1/models")
	})

	it("sends x-api-key by default", async () => {
		mockGet.mockResolvedValueOnce(page(["a"], false))
		await fetchAnthropicApiModels({ apiKey: "secret" })
		expect(mockGet.mock.calls[0][1]?.headers).toEqual({ "anthropic-version": "2023-06-01", "x-api-key": "secret" })
	})

	it("sends a bearer token with a custom base url and auth token mode", async () => {
		mockGet.mockResolvedValueOnce(page(["a"], false))
		await fetchAnthropicApiModels({ apiKey: "secret", baseUrl: "https://proxy.example.com/", useAuthToken: true })
		expect(mockGet.mock.calls[0][0]).toBe("https://proxy.example.com/v1/models")
		expect(mockGet.mock.calls[0][1]?.headers).toEqual({
			"anthropic-version": "2023-06-01",
			Authorization: "Bearer secret",
		})
	})

	it("throws without a key and on non-200", async () => {
		await expect(fetchAnthropicApiModels({})).rejects.toThrow()
		mockGet.mockResolvedValueOnce({ status: 500, data: {} })
		await expect(getAnthropicModels({ apiKey: "k" })).rejects.toThrow()
	})

	it("cache key does not contain the api key", () => {
		const key = anthropicCacheKey({ apiKey: "sk-ant-supersecret" })
		expect(key).not.toContain("supersecret")
		expect(anthropicCacheKey({ apiKey: "x" })).not.toBe(anthropicCacheKey({ apiKey: "y" }))
	})

	describe("mergeAnthropicModels", () => {
		it("keeps the API's set, newest first, static prices for known ids, unknown prices undefined", () => {
			const merged = mergeAnthropicModels([
				{ id: "claude-sonnet-4-20250514", created_at: "2025-05-14T00:00:00Z", max_input_tokens: 1_000_000 },
				{ id: "claude-future-9", created_at: "2027-01-01T00:00:00Z", max_tokens: 100_000 },
			])
			expect(Object.keys(merged)).toEqual(["claude-future-9", "claude-sonnet-4-20250514"])
			expect(merged["claude-sonnet-4-20250514"].inputPrice).toBe(3.0)
			expect(merged["claude-sonnet-4-20250514"].contextWindow).toBe(1_000_000)
			const unknown = merged["claude-future-9"]
			expect(unknown.inputPrice).toBeUndefined()
			expect(unknown.outputPrice).toBeUndefined()
			expect(unknown.cacheReadsPrice).toBeUndefined()
			expect(unknown.supportsPromptCache).toBe(true)
			expect(unknown.supportsReasoningBudget).toBe(false)
			expect(unknown.maxTokens).toBe(100_000)
			expect(merged["claude-3-haiku-20240307"]).toBeUndefined()
		})

		it("API capabilities win; adaptive-only models drop temperature support", () => {
			const merged = mergeAnthropicModels([
				{
					id: "claude-new-1",
					capabilities: {
						image_input: { supported: false },
						thinking: {
							supported: true,
							types: { enabled: { supported: false }, adaptive: { supported: true } },
						},
					},
				},
				{
					id: "claude-sonnet-4-20250514",
					capabilities: { thinking: { supported: true, types: { enabled: { supported: false } } } },
				},
			])
			expect(merged["claude-new-1"].supportsImages).toBe(false)
			expect(merged["claude-new-1"].supportsReasoningBudget).toBe(false)
			expect(merged["claude-new-1"].supportedParameters).not.toContain("temperature")
			expect(merged["claude-sonnet-4-20250514"].supportsReasoningBudget).toBe(false)
			expect(merged["claude-sonnet-4-20250514"].supportedParameters).toBeUndefined()
		})

		it("does not mutate the static table", () => {
			mergeAnthropicModels([{ id: "claude-sonnet-4-20250514", max_tokens: 1 }])
			expect(anthropicModels["claude-sonnet-4-20250514"].maxTokens).toBe(64_000)
		})
	})
})

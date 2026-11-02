// npx vitest run src/api/providers/__tests__/anthropic.spec.ts

import { AnthropicHandler, FAILED_FETCH_BACKOFF_MS } from "../anthropic"
import { ApiHandlerOptions } from "../../../shared/api"
import { isDefaultedModelInfo, mergeAnthropicModels } from "../fetchers/anthropic"

const mockCreate = vitest.fn()

// The model list cache is replaced so tests control what the handler sees.
const modelCache = vitest.hoisted(() => ({
	getModels: vitest.fn(),
	getModelsFromCache: vitest.fn(),
	getLastGoodAnthropicModels: vitest.fn(),
	ensureAnthropicLastGoodSeeded: vitest.fn(),
}))

vitest.mock("../fetchers/modelCache", () => modelCache)

vitest.mock("@anthropic-ai/sdk", () => {
	const mockAnthropicConstructor = vitest.fn().mockImplementation(() => ({
		messages: {
			create: mockCreate.mockImplementation(async (options) => {
				if (!options.stream) {
					return {
						id: "test-completion",
						content: [{ type: "text", text: "Test response" }],
						role: "assistant",
						model: options.model,
						usage: {
							input_tokens: 10,
							output_tokens: 5,
						},
					}
				}
				return {
					async *[Symbol.asyncIterator]() {
						yield {
							type: "message_start",
							message: {
								usage: {
									input_tokens: 100,
									output_tokens: 50,
									cache_creation_input_tokens: 20,
									cache_read_input_tokens: 10,
								},
							},
						}
						yield {
							type: "content_block_start",
							index: 0,
							content_block: {
								type: "text",
								text: "Hello",
							},
						}
						yield {
							type: "content_block_delta",
							delta: {
								type: "text_delta",
								text: " world",
							},
						}
					},
				}
			}),
		},
	}))

	return {
		Anthropic: mockAnthropicConstructor,
	}
})

// Import after mock
import { Anthropic } from "@anthropic-ai/sdk"

const mockAnthropicConstructor = vitest.mocked(Anthropic)

describe("AnthropicHandler", () => {
	let handler: AnthropicHandler
	let mockOptions: ApiHandlerOptions

	beforeEach(() => {
		mockOptions = {
			apiKey: "test-api-key",
			apiModelId: "claude-3-5-sonnet-20241022",
		}
		handler = new AnthropicHandler(mockOptions)
		vitest.clearAllMocks()
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(handler).toBeInstanceOf(AnthropicHandler)
			expect(handler.getModel().id).toBe(mockOptions.apiModelId)
		})

		it("should initialize with undefined API key", () => {
			// The SDK will handle API key validation, so we just verify it initializes
			const handlerWithoutKey = new AnthropicHandler({
				...mockOptions,
				apiKey: undefined,
			})
			expect(handlerWithoutKey).toBeInstanceOf(AnthropicHandler)
		})

		it("should use custom base URL if provided", () => {
			const customBaseUrl = "https://custom.anthropic.com"
			const handlerWithCustomUrl = new AnthropicHandler({
				...mockOptions,
				anthropicBaseUrl: customBaseUrl,
			})
			expect(handlerWithCustomUrl).toBeInstanceOf(AnthropicHandler)
		})

		it("use apiKey for passing token if anthropicUseAuthToken is not set", () => {
			const handlerWithCustomUrl = new AnthropicHandler({
				...mockOptions,
			})
			expect(handlerWithCustomUrl).toBeInstanceOf(AnthropicHandler)
			expect(mockAnthropicConstructor).toHaveBeenCalledTimes(1)
			expect(mockAnthropicConstructor.mock.calls[0]![0]!.apiKey).toEqual("test-api-key")
			expect(mockAnthropicConstructor.mock.calls[0]![0]!.authToken).toBeUndefined()
		})

		it("use apiKey for passing token if anthropicUseAuthToken is set but custom base URL is not given", () => {
			const handlerWithCustomUrl = new AnthropicHandler({
				...mockOptions,
				anthropicUseAuthToken: true,
			})
			expect(handlerWithCustomUrl).toBeInstanceOf(AnthropicHandler)
			expect(mockAnthropicConstructor).toHaveBeenCalledTimes(1)
			expect(mockAnthropicConstructor.mock.calls[0]![0]!.apiKey).toEqual("test-api-key")
			expect(mockAnthropicConstructor.mock.calls[0]![0]!.authToken).toBeUndefined()
		})

		it("use authToken for passing token if both of anthropicBaseUrl and anthropicUseAuthToken are set", () => {
			const customBaseUrl = "https://custom.anthropic.com"
			const handlerWithCustomUrl = new AnthropicHandler({
				...mockOptions,
				anthropicBaseUrl: customBaseUrl,
				anthropicUseAuthToken: true,
			})
			expect(handlerWithCustomUrl).toBeInstanceOf(AnthropicHandler)
			expect(mockAnthropicConstructor).toHaveBeenCalledTimes(1)
			expect(mockAnthropicConstructor.mock.calls[0]![0]!.authToken).toEqual("test-api-key")
			expect(mockAnthropicConstructor.mock.calls[0]![0]!.apiKey).toBeUndefined()
		})
	})

	describe("createMessage", () => {
		const systemPrompt = "You are a helpful assistant."

		it("should handle prompt caching for supported models", async () => {
			const stream = handler.createMessage(systemPrompt, [
				{
					role: "user",
					content: [{ type: "text" as const, text: "First message" }],
				},
				{
					role: "assistant",
					content: [{ type: "text" as const, text: "Response" }],
				},
				{
					role: "user",
					content: [{ type: "text" as const, text: "Second message" }],
				},
			])

			const chunks: any[] = []
			for await (const chunk of stream) {
				chunks.push(chunk)
			}

			// Verify usage information
			const usageChunk = chunks.find((chunk) => chunk.type === "usage")
			expect(usageChunk).toBeDefined()
			expect(usageChunk?.inputTokens).toBe(100)
			expect(usageChunk?.outputTokens).toBe(50)
			expect(usageChunk?.cacheWriteTokens).toBe(20)
			expect(usageChunk?.cacheReadTokens).toBe(10)

			// Verify text content
			const textChunks = chunks.filter((chunk) => chunk.type === "text")
			expect(textChunks).toHaveLength(2)
			expect(textChunks[0].text).toBe("Hello")
			expect(textChunks[1].text).toBe(" world")

			// Verify API
			expect(mockCreate).toHaveBeenCalled()
		})
	})

	describe("completePrompt", () => {
		it("should complete prompt successfully", async () => {
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("Test response")
			expect(mockCreate).toHaveBeenCalledWith({
				model: mockOptions.apiModelId,
				messages: [{ role: "user", content: "Test prompt" }],
				max_tokens: 8192,
				temperature: 0,
				thinking: undefined,
				stream: false,
			})
		})

		it("should handle API errors", async () => {
			mockCreate.mockRejectedValueOnce(new Error("Anthropic completion error: API Error"))
			await expect(handler.completePrompt("Test prompt")).rejects.toThrow("Anthropic completion error: API Error")
		})

		it("should handle non-text content", async () => {
			mockCreate.mockImplementationOnce(async () => ({
				content: [{ type: "image" }],
			}))
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})

		it("should handle empty response", async () => {
			mockCreate.mockImplementationOnce(async () => ({
				content: [{ type: "text", text: "" }],
			}))
			const result = await handler.completePrompt("Test prompt")
			expect(result).toBe("")
		})
	})

	describe("getModel", () => {
		it("should return default model if no model ID is provided", () => {
			const handlerWithoutModel = new AnthropicHandler({
				...mockOptions,
				apiModelId: undefined,
			})
			const model = handlerWithoutModel.getModel()
			expect(model.id).toBeDefined()
			expect(model.info).toBeDefined()
		})

		it("should return specified model if valid model ID is provided", () => {
			const model = handler.getModel()
			expect(model.id).toBe(mockOptions.apiModelId)
			expect(model.info).toBeDefined()
			expect(model.info.maxTokens).toBe(8192)
			expect(model.info.contextWindow).toBe(200_000)
			expect(model.info.supportsImages).toBe(true)
			expect(model.info.supportsPromptCache).toBe(true)
		})

		it("honors custom maxTokens for thinking models", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet-20250219:thinking",
				modelMaxTokens: 32_768,
				modelMaxThinkingTokens: 16_384,
			})

			const result = handler.getModel()
			expect(result.maxTokens).toBe(32_768)
			expect(result.reasoningBudget).toEqual(16_384)
			expect(result.temperature).toBe(1.0)
		})

		it("does not honor custom maxTokens for non-thinking models", () => {
			const handler = new AnthropicHandler({
				apiKey: "test-api-key",
				apiModelId: "claude-3-7-sonnet-20250219",
				modelMaxTokens: 32_768,
				modelMaxThinkingTokens: 16_384,
			})

			const result = handler.getModel()
			expect(result.maxTokens).toBe(8192)
			expect(result.reasoningBudget).toBeUndefined()
			expect(result.temperature).toBe(0)
		})
	})
})

describe("AnthropicHandler dynamic model ids", () => {
	const live = {
		"claude-opus-5-5": {
			contextWindow: 1_000_000,
			maxTokens: 128_000,
			supportsImages: true,
			supportsPromptCache: true,
			supportsReasoningBudget: false,
		},
	}

	beforeEach(() => {
		vitest.clearAllMocks()
		modelCache.getModels.mockResolvedValue({})
		modelCache.getModelsFromCache.mockReturnValue(undefined)
		modelCache.getLastGoodAnthropicModels.mockReturnValue(undefined)
		modelCache.ensureAnthropicLastGoodSeeded.mockResolvedValue(undefined)
		AnthropicHandler.resetFailedFetchBackoff()
	})

	afterEach(() => {
		vitest.useRealTimers()
	})

	it("accepts an id outside the bundled table with conservative, tagged defaults", () => {
		const handler = new AnthropicHandler({ apiKey: "k", apiModelId: "claude-future-9" })
		const model = handler.getModel()
		expect(model.id).toBe("claude-future-9")
		expect(model.info.inputPrice).toBeUndefined()
		expect(model.info.supportsPromptCache).toBe(true)
		expect(model.reasoning).toBeUndefined()
		expect(isDefaultedModelInfo(model.info)).toBe(true)
		expect(isDefaultedModelInfo(new AnthropicHandler({ apiKey: "k" }).getModel().info)).toBe(false)
	})

	it("fetchModel waits for the live list so the context window is real before any arithmetic", async () => {
		let cached: any
		modelCache.getModels.mockImplementation(async () => {
			await new Promise((r) => setTimeout(r, 10))
			cached = live
			return live
		})
		modelCache.getModelsFromCache.mockImplementation(() => cached)

		const handler = new AnthropicHandler({ apiKey: "k", apiModelId: "claude-opus-5-5" })
		expect(handler.getModel().info.contextWindow).toBe(200_000) // synchronous view before the fetch
		const model = await handler.fetchModel()
		expect(model.info.contextWindow).toBe(1_000_000)
		expect(model.info.maxTokens).toBe(128_000)
		expect(isDefaultedModelInfo(model.info)).toBe(false)
		expect(modelCache.getModels).toHaveBeenCalledTimes(1)
	})

	it("fetchModel uses the last-good list after the memory TTL lapsed without waiting for the refresh", async () => {
		modelCache.getModels.mockReturnValue(new Promise(() => {})) // refresh never completes
		modelCache.getLastGoodAnthropicModels.mockReturnValue(live)

		const handler = new AnthropicHandler({ apiKey: "k", apiModelId: "claude-opus-5-5" })
		const model = await handler.fetchModel()
		expect(model.info.contextWindow).toBe(1_000_000)
		expect(isDefaultedModelInfo(model.info)).toBe(false)
	})

	it("fetchModel bounds the wait and returns tagged defaults when the list never arrives", async () => {
		vitest.useFakeTimers()
		modelCache.getModels.mockReturnValue(new Promise(() => {}))

		const handler = new AnthropicHandler({ apiKey: "k", apiModelId: "claude-opus-5-5" })
		const pending = handler.fetchModel()
		await vitest.advanceTimersByTimeAsync(5_000)
		const model = await pending
		expect(model.info.contextWindow).toBe(200_000)
		expect(isDefaultedModelInfo(model.info)).toBe(true)
	})

	it("fetchModel backs off for a minute after a refresh fails or times out", async () => {
		vitest.useFakeTimers()
		AnthropicHandler.resetFailedFetchBackoff()
		modelCache.getModels.mockReturnValue(new Promise(() => {})) // offline: never answers

		const handler = new AnthropicHandler({ apiKey: "k", apiModelId: "claude-opus-5-5" })
		const first = handler.fetchModel()
		await vitest.advanceTimersByTimeAsync(5_000)
		expect(isDefaultedModelInfo((await first).info)).toBe(true)
		expect(modelCache.getModels).toHaveBeenCalledTimes(1)

		// The next requests inside the backoff window neither fetch nor wait.
		const startedAt = Date.now()
		expect(isDefaultedModelInfo((await handler.fetchModel()).info)).toBe(true)
		const other = new AnthropicHandler({ apiKey: "k", apiModelId: "claude-opus-5-5" })
		expect(isDefaultedModelInfo((await other.fetchModel()).info)).toBe(true)
		expect(Date.now() - startedAt).toBe(0)
		expect(modelCache.getModels).toHaveBeenCalledTimes(1)

		// A rejected fetch backs off the same way.
		AnthropicHandler.resetFailedFetchBackoff()
		modelCache.getModels.mockRejectedValue(new Error("ENOTFOUND"))
		await handler.fetchModel()
		await handler.fetchModel()
		expect(modelCache.getModels).toHaveBeenCalledTimes(2)

		// After the window a refresh is tried again.
		await vitest.advanceTimersByTimeAsync(FAILED_FETCH_BACKOFF_MS)
		await handler.fetchModel()
		expect(modelCache.getModels).toHaveBeenCalledTimes(3)
		AnthropicHandler.resetFailedFetchBackoff()
	})

	it("fetchModel does not fetch for bundled ids", async () => {
		const handler = new AnthropicHandler({ apiKey: "k", apiModelId: "claude-3-haiku-20240307" })
		const model = await handler.fetchModel()
		expect(model.info.inputPrice).toBe(0.25)
		expect(modelCache.getModels).not.toHaveBeenCalled()
	})

	it("still resolves bundled ids and the default", () => {
		expect(
			new AnthropicHandler({ apiKey: "k", apiModelId: "claude-3-haiku-20240307" }).getModel().info.inputPrice,
		).toBe(0.25)
		expect(new AnthropicHandler({ apiKey: "k" }).getModel().id).toBe("claude-sonnet-4-20250514")
	})

	describe("temperature on the wire", () => {
		// What actually leaves the process: undefined fields are not serialized.
		const lastBody = () => JSON.parse(JSON.stringify(mockCreate.mock.calls.at(-1)![0]))

		const sendMessage = async (handler: AnthropicHandler) => {
			for await (const _ of handler.createMessage("system", [{ role: "user", content: "hi" }])) {
				// drain
			}
			return lastBody()
		}

		const sendPrompt = async (handler: AnthropicHandler) => {
			await handler.completePrompt("hi")
			return lastBody()
		}

		const useList = (apiModels: Parameters<typeof mergeAnthropicModels>[0]) => {
			modelCache.getModelsFromCache.mockReturnValue(mergeAnthropicModels(apiModels))
		}

		it("omits it for a defaulted id when the list is unavailable", async () => {
			modelCache.getModels.mockRejectedValue(new Error("ENOTFOUND"))
			const handler = new AnthropicHandler({ apiKey: "k", apiModelId: "claude-opus-5-5" })

			expect(isDefaultedModelInfo(handler.getModel().info)).toBe(true)
			expect(await sendMessage(handler)).not.toHaveProperty("temperature")
			expect(await sendPrompt(handler)).not.toHaveProperty("temperature")
		})

		it("omits a user-set temperature for a defaulted id too", async () => {
			const handler = new AnthropicHandler({ apiKey: "k", apiModelId: "claude-opus-5-5", modelTemperature: 0.7 })

			expect(await sendMessage(handler)).not.toHaveProperty("temperature")
		})

		it("omits it for a list entry with no capabilities and no table base", async () => {
			useList([{ id: "proxy-model", max_input_tokens: 500_000, max_tokens: 16_000 }])
			const handler = new AnthropicHandler({ apiKey: "k", apiModelId: "proxy-model" })

			expect(isDefaultedModelInfo(handler.getModel().info)).toBe(false)
			expect(await sendMessage(handler)).not.toHaveProperty("temperature")
			expect(await sendPrompt(handler)).not.toHaveProperty("temperature")
		})

		it("omits it for a list entry whose capabilities mean sampling is rejected", async () => {
			useList([
				{
					id: "claude-opus-5-5",
					max_input_tokens: 1_000_000,
					capabilities: { thinking: { supported: true, types: { enabled: { supported: false } } } },
				},
			])
			const handler = new AnthropicHandler({ apiKey: "k", apiModelId: "claude-opus-5-5" })

			expect(await sendMessage(handler)).not.toHaveProperty("temperature")
			expect(await sendPrompt(handler)).not.toHaveProperty("temperature")
		})

		it("keeps it for a list entry whose capabilities state manual thinking budgets", async () => {
			useList([
				{
					id: "claude-sonnet-4-6",
					max_input_tokens: 1_000_000,
					capabilities: { thinking: { supported: true, types: { enabled: { supported: true } } } },
				},
			])
			const handler = new AnthropicHandler({ apiKey: "k", apiModelId: "claude-sonnet-4-6" })

			expect((await sendMessage(handler)).temperature).toBe(0)
			expect((await sendPrompt(handler)).temperature).toBe(0)
		})

		it("keeps it for a bundled id, listed or not", async () => {
			const handler = new AnthropicHandler({ apiKey: "k", apiModelId: "claude-3-haiku-20240307" })
			expect((await sendMessage(handler)).temperature).toBe(0)
			expect((await sendPrompt(handler)).temperature).toBe(0)

			useList([{ id: "claude-3-haiku-20240307" }])
			expect((await sendMessage(handler)).temperature).toBe(0)
			expect((await sendPrompt(handler)).temperature).toBe(0)
		})

		it("keeps a user-set temperature for a bundled id", async () => {
			const handler = new AnthropicHandler({
				apiKey: "k",
				apiModelId: "claude-3-haiku-20240307",
				modelTemperature: 0.7,
			})

			expect((await sendMessage(handler)).temperature).toBe(0.7)
		})

		it("completePrompt loads the list on a cold cache and uses what it states", async () => {
			let cached: any
			modelCache.getModels.mockImplementation(async () => {
				cached = mergeAnthropicModels([
					{
						id: "claude-sonnet-4-6",
						capabilities: { thinking: { supported: true, types: { enabled: { supported: true } } } },
					},
				])
				return cached
			})
			modelCache.getModelsFromCache.mockImplementation(() => cached)

			const body = await sendPrompt(new AnthropicHandler({ apiKey: "k", apiModelId: "claude-sonnet-4-6" }))

			expect(modelCache.getModels).toHaveBeenCalledTimes(1)
			expect(body.temperature).toBe(0)
		})

		it("completePrompt does not fetch the list for a bundled id", async () => {
			await sendPrompt(new AnthropicHandler({ apiKey: "k", apiModelId: "claude-3-haiku-20240307" }))

			expect(modelCache.getModels).not.toHaveBeenCalled()
		})
	})
})

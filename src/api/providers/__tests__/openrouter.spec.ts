// npx vitest run src/api/providers/__tests__/openrouter.spec.ts

// Mock vscode first to avoid import errors
vitest.mock("vscode", () => ({}))

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { OpenRouterHandler } from "../openrouter"
import { ApiHandlerOptions } from "../../../shared/api"
import { Package } from "../../../shared/package"
import { AssistantMessageParser } from "../../../core/assistant-message/AssistantMessageParser"

// Mock dependencies
vitest.mock("openai")
vitest.mock("delay", () => ({ default: vitest.fn(() => Promise.resolve()) }))
vitest.mock("../fetchers/modelCache", () => ({
	getModels: vitest.fn().mockImplementation(() => {
		return Promise.resolve({
			"anthropic/claude-sonnet-4": {
				maxTokens: 8192,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 3,
				outputPrice: 15,
				cacheWritesPrice: 3.75,
				cacheReadsPrice: 0.3,
				description: "Claude 3.7 Sonnet",
				thinking: false,
				supportsComputerUse: true,
			},
			"anthropic/claude-3.7-sonnet:thinking": {
				maxTokens: 128000,
				contextWindow: 200000,
				supportsImages: true,
				supportsPromptCache: true,
				inputPrice: 3,
				outputPrice: 15,
				cacheWritesPrice: 3.75,
				cacheReadsPrice: 0.3,
				description: "Claude 3.7 Sonnet with thinking",
				supportsComputerUse: true,
			},
		})
	}),
}))

describe("OpenRouterHandler", () => {
	const mockOptions: ApiHandlerOptions = {
		openRouterApiKey: "test-key",
		openRouterModelId: "anthropic/claude-sonnet-4",
	}

	beforeEach(() => vitest.clearAllMocks())

	it("initializes with correct options", () => {
		const handler = new OpenRouterHandler(mockOptions)
		expect(handler).toBeInstanceOf(OpenRouterHandler)

		expect(OpenAI).toHaveBeenCalledWith({
			baseURL: "https://openrouter.ai/api/v1",
			apiKey: mockOptions.openRouterApiKey,
			defaultHeaders: {
				"HTTP-Referer": "https://github.com/RooVetGit/Roo-Cline",
				"X-Title": "Roo Code",
				"User-Agent": `RooCode/${Package.version}`,
			},
		})
	})

	describe("fetchModel", () => {
		it("returns correct model info when options are provided", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const result = await handler.fetchModel()

			expect(result).toMatchObject({
				id: mockOptions.openRouterModelId,
				maxTokens: 8192,
				temperature: 0,
				reasoningEffort: undefined,
				topP: undefined,
			})
		})

		it("returns default model info when options are not provided", async () => {
			const handler = new OpenRouterHandler({})
			const result = await handler.fetchModel()
			expect(result.id).toBe("anthropic/claude-sonnet-4")
			expect(result.info.supportsPromptCache).toBe(true)
		})

		it("honors custom maxTokens for thinking models", async () => {
			const handler = new OpenRouterHandler({
				openRouterApiKey: "test-key",
				openRouterModelId: "anthropic/claude-3.7-sonnet:thinking",
				modelMaxTokens: 32_768,
				modelMaxThinkingTokens: 16_384,
			})

			const result = await handler.fetchModel()
			// With the new clamping logic, 128000 tokens (64% of 200000 context window)
			// gets clamped to 20% of context window: 200000 * 0.2 = 40000
			expect(result.maxTokens).toBe(40000)
			expect(result.reasoningBudget).toBeUndefined()
			expect(result.temperature).toBe(0)
		})

		it("does not honor custom maxTokens for non-thinking models", async () => {
			const handler = new OpenRouterHandler({
				...mockOptions,
				modelMaxTokens: 32_768,
				modelMaxThinkingTokens: 16_384,
			})

			const result = await handler.fetchModel()
			expect(result.maxTokens).toBe(8192)
			expect(result.reasoningBudget).toBeUndefined()
			expect(result.temperature).toBe(0)
		})
	})

	describe("createMessage", () => {
		it("generates correct stream chunks", async () => {
			const handler = new OpenRouterHandler(mockOptions)

			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						id: mockOptions.openRouterModelId,
						choices: [{ delta: { content: "test response" } }],
					}
					yield {
						id: "test-id",
						choices: [{ delta: {} }],
						usage: { prompt_tokens: 10, completion_tokens: 20, cost: 0.001 },
					}
				},
			}

			// Mock OpenAI chat.completions.create
			const mockCreate = vitest.fn().mockResolvedValue(mockStream)

			;(OpenAI as any).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			const systemPrompt = "test system prompt"
			const messages: Anthropic.Messages.MessageParam[] = [{ role: "user" as const, content: "test message" }]

			const generator = handler.createMessage(systemPrompt, messages)
			const chunks = []

			for await (const chunk of generator) {
				chunks.push(chunk)
			}

			// Verify stream chunks
			expect(chunks).toHaveLength(2) // One text chunk and one usage chunk
			expect(chunks[0]).toEqual({ type: "text", text: "test response" })
			expect(chunks[1]).toEqual({ type: "usage", inputTokens: 10, outputTokens: 20, totalCost: 0.001 })

			// Verify OpenAI client was called with correct parameters.
			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					max_tokens: 8192,
					messages: [
						{
							content: [
								{ cache_control: { type: "ephemeral" }, text: "test system prompt", type: "text" },
							],
							role: "system",
						},
						{
							content: [{ cache_control: { type: "ephemeral" }, text: "test message", type: "text" }],
							role: "user",
						},
					],
					model: "anthropic/claude-sonnet-4",
					stream: true,
					stream_options: { include_usage: true },
					temperature: 0,
					top_p: undefined,
				}),
			)
		})

		it("supports the middle-out transform", async () => {
			const handler = new OpenRouterHandler({
				...mockOptions,
				openRouterUseMiddleOutTransform: true,
			})
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						id: "test-id",
						choices: [{ delta: { content: "test response" } }],
					}
				},
			}

			const mockCreate = vitest.fn().mockResolvedValue(mockStream)
			;(OpenAI as any).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			await handler.createMessage("test", []).next()

			expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ transforms: ["middle-out"] }))
		})

		it("adds cache control for supported models", async () => {
			const handler = new OpenRouterHandler({
				...mockOptions,
				openRouterModelId: "anthropic/claude-3.5-sonnet",
			})

			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						id: "test-id",
						choices: [{ delta: { content: "test response" } }],
					}
				},
			}

			const mockCreate = vitest.fn().mockResolvedValue(mockStream)
			;(OpenAI as any).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			const messages: Anthropic.Messages.MessageParam[] = [
				{ role: "user", content: "message 1" },
				{ role: "assistant", content: "response 1" },
				{ role: "user", content: "message 2" },
			]

			await handler.createMessage("test system", messages).next()

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: expect.arrayContaining([
						expect.objectContaining({
							role: "system",
							content: expect.arrayContaining([
								expect.objectContaining({ cache_control: { type: "ephemeral" } }),
							]),
						}),
					]),
				}),
			)
		})

		it("handles API errors", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { error: { message: "API Error", code: 500 } }
				},
			}

			const mockCreate = vitest.fn().mockResolvedValue(mockStream)
			;(OpenAI as any).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			const generator = handler.createMessage("test", [])
			await expect(generator.next()).rejects.toThrow("OpenRouter API Error 500: API Error")
		})

		it("handles usage-only chunks without delta", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						id: "test-id",
						choices: [{ delta: { reasoning: "thinking..." } }],
					}
					yield {
						id: "test-id",
						usage: { prompt_tokens: 5, completion_tokens: 7, cost: 0.0001 },
					}
				},
			}

			const mockCreate = vitest.fn().mockResolvedValue(mockStream)
			;(OpenAI as any).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			const chunks = []
			for await (const chunk of handler.createMessage("test", [])) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "reasoning", text: "thinking..." },
				{ type: "usage", inputTokens: 5, outputTokens: 7, totalCost: 0.0001 },
			])
		})

		it("extracts reasoning_content from OpenRouter deltas", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						id: "test-id",
						choices: [{ delta: { reasoning_content: "hidden chain" } }],
					}
					yield {
						id: "test-id",
						usage: { prompt_tokens: 3, completion_tokens: 4, cost: 0.0002 },
					}
				},
			}

			const mockCreate = vitest.fn().mockResolvedValue(mockStream)
			;(OpenAI as any).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			const chunks = []
			for await (const chunk of handler.createMessage("test", [])) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "reasoning", text: "hidden chain" },
				{ type: "usage", inputTokens: 3, outputTokens: 4, totalCost: 0.0002 },
			])
		})

		it("extracts thinking tags from streamed content", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						id: "test-id",
						choices: [{ delta: { content: "<thinking>hidden" } }],
					}
					yield {
						id: "test-id",
						choices: [{ delta: { content: " steps</thinking> after" } }],
					}
				},
			}

			const mockCreate = vitest.fn().mockResolvedValue(mockStream)
			;(OpenAI as any).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			const chunks = []
			for await (const chunk of handler.createMessage("test", [])) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "reasoning", text: "hidden" },
				{ type: "reasoning", text: " steps" },
				{ type: "text", text: " after" },
			])
		})

		it("extracts a thinking block that starts after visible text", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						id: "test-id",
						choices: [{ delta: { content: "Visible text <thinking>hidden plan" } }],
					}
					yield {
						id: "test-id",
						choices: [{ delta: { content: " continued</thinking> final answer" } }],
					}
				},
			}

			const mockCreate = vitest.fn().mockResolvedValue(mockStream)
			;(OpenAI as any).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			const chunks = []
			for await (const chunk of handler.createMessage("test", [])) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "text", text: "Visible text " },
				{ type: "reasoning", text: "hidden plan" },
				{ type: "reasoning", text: " continued" },
				{ type: "text", text: " final answer" },
			])
		})

		it("extracts multiple thinking blocks across chunks", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						id: "test-id",
						choices: [{ delta: { content: "<thinking>first" } }],
					}
					yield {
						id: "test-id",
						choices: [{ delta: { content: " block</thinking> shown <thinking>second" } }],
					}
					yield {
						id: "test-id",
						choices: [{ delta: { content: " block</thinking> done" } }],
					}
				},
			}

			const mockCreate = vitest.fn().mockResolvedValue(mockStream)
			;(OpenAI as any).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			const chunks = []
			for await (const chunk of handler.createMessage("test", [])) {
				chunks.push(chunk)
			}

			expect(chunks).toEqual([
				{ type: "reasoning", text: "first" },
				{ type: "reasoning", text: " block" },
				{ type: "text", text: " shown " },
				{ type: "reasoning", text: "second" },
				{ type: "reasoning", text: " block" },
				{ type: "text", text: " done" },
			])
		})

		it("preserves a single write_to_file tool after a split thinking block", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const parser = new AssistantMessageParser()
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						id: "test-id",
						choices: [{ delta: { content: "<thinking>Planning the file" } }],
					}
					yield {
						id: "test-id",
						choices: [
							{
								delta: {
									content:
										" structure</thinking><write_to_file><path>force-app/main/default/lwc/parentComponent/parentComponent.html</path><content><template>\n",
								},
							},
						],
					}
					yield {
						id: "test-id",
						choices: [
							{
								delta: {
									content:
										'    <div class="parent-container">\n        <h2>Parent Component</h2>\n    </div>\n',
								},
							},
						],
					}
					yield {
						id: "test-id",
						choices: [
							{ delta: { content: "</template></content><line_count>4</line_count></write_to_file>" } },
						],
					}
				},
			}

			const mockCreate = vitest.fn().mockResolvedValue(mockStream)
			;(OpenAI as any).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			for await (const chunk of handler.createMessage("test", [])) {
				if (chunk.type === "text") {
					parser.processChunk(chunk.text)
				}
			}

			parser.finalizeContentBlocks()
			const blocks = parser.getContentBlocks()
			const toolUse = blocks.find((block) => block.type === "tool_use")

			expect(toolUse).toBeDefined()
			expect(toolUse).toMatchObject({
				type: "tool_use",
				name: "write_to_file",
				params: {
					path: "force-app/main/default/lwc/parentComponent/parentComponent.html",
					line_count: "4",
				},
			})
			expect((toolUse as any).params.content).toContain('<div class="parent-container">')
			expect((toolUse as any).params.content).toContain("<h2>Parent Component</h2>")
		})

		it("preserves write_to_file parsing when visible text and multiple thinking blocks surround the tool", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const parser = new AssistantMessageParser()
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						id: "test-id",
						choices: [{ delta: { content: "I will create the component. <thinking>Need parent html" } }],
					}
					yield {
						id: "test-id",
						choices: [
							{
								delta: {
									content:
										" first</thinking> <thinking>Ensure single file target</thinking><write_to_file><path>force-app/main/default/lwc/parentComponent/parentComponent.html</path><content><template>\n    <div>Ready</div>\n</template></content><line_count>3</line_count></write_to_file>",
								},
							},
						],
					}
				},
			}

			const mockCreate = vitest.fn().mockResolvedValue(mockStream)
			;(OpenAI as any).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			for await (const chunk of handler.createMessage("test", [])) {
				if (chunk.type === "text") {
					parser.processChunk(chunk.text)
				}
			}

			parser.finalizeContentBlocks()
			const blocks = parser.getContentBlocks()
			const toolUses = blocks.filter((block) => block.type === "tool_use")
			const textBlocks = blocks.filter((block) => block.type === "text")

			expect(toolUses).toHaveLength(1)
			expect((toolUses[0] as any).params.path).toBe(
				"force-app/main/default/lwc/parentComponent/parentComponent.html",
			)
			expect((toolUses[0] as any).params.content).toContain("<template>")
			expect((toolUses[0] as any).params.content).toContain("<div>Ready</div>")
			expect(textBlocks[0]).toMatchObject({
				type: "text",
				content: "I will create the component.",
			})
		})

		it("preserves consecutive write_to_file payloads for lwc html and meta xml files", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const parser = new AssistantMessageParser()
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						id: "test-id",
						choices: [
							{
								delta: {
									content:
										"<thinking>Creating child bundle files</thinking><write_to_file><path>force-app/main/default/lwc/childComponent/childComponent.html</path><content><template>\n",
								},
							},
						],
					}
					yield {
						id: "test-id",
						choices: [
							{
								delta: {
									content:
										'    <div class="child">Child</div>\n</template></content><line_count>3</line_count></write_to_file><write_to_file><path>force-app/main/default/lwc/childComponent/childComponent.js-meta.xml</path><content><?xml version="1.0" encoding="UTF-8"?>\n',
								},
							},
						],
					}
					yield {
						id: "test-id",
						choices: [
							{
								delta: {
									content:
										'<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">\n    <apiVersion>62.0</apiVersion>\n</LightningComponentBundle></content><line_count>4</line_count></write_to_file>',
								},
							},
						],
					}
				},
			}

			const mockCreate = vitest.fn().mockResolvedValue(mockStream)
			;(OpenAI as any).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			for await (const chunk of handler.createMessage("test", [])) {
				if (chunk.type === "text") {
					parser.processChunk(chunk.text)
				}
			}

			parser.finalizeContentBlocks()
			const toolUses = parser.getContentBlocks().filter((block) => block.type === "tool_use") as any[]

			expect(toolUses).toHaveLength(2)
			expect(toolUses[0].params.path).toBe("force-app/main/default/lwc/childComponent/childComponent.html")
			expect(toolUses[0].params.content).toBe('<template>\n    <div class="child">Child</div>\n</template>')
			expect(toolUses[1].params.path).toBe("force-app/main/default/lwc/childComponent/childComponent.js-meta.xml")
			expect(toolUses[1].params.content).toContain('<?xml version="1.0" encoding="UTF-8"?>')
			expect(toolUses[1].params.content).toContain("<LightningComponentBundle")
		})
	})

	describe("completePrompt", () => {
		it("returns correct response", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const mockResponse = { choices: [{ message: { content: "test completion" } }] }

			const mockCreate = vitest.fn().mockResolvedValue(mockResponse)
			;(OpenAI as any).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			const result = await handler.completePrompt("test prompt")

			expect(result).toBe("test completion")

			expect(mockCreate).toHaveBeenCalledWith({
				model: mockOptions.openRouterModelId,
				max_tokens: 8192,
				thinking: undefined,
				temperature: 0,
				messages: [{ role: "user", content: "test prompt" }],
				stream: false,
			})
		})

		it("handles API errors", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const mockError = {
				error: {
					message: "API Error",
					code: 500,
				},
			}

			const mockCreate = vitest.fn().mockResolvedValue(mockError)
			;(OpenAI as any).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			await expect(handler.completePrompt("test prompt")).rejects.toThrow("OpenRouter API Error 500: API Error")
		})

		it("handles unexpected errors", async () => {
			const handler = new OpenRouterHandler(mockOptions)
			const mockCreate = vitest.fn().mockRejectedValue(new Error("Unexpected error"))
			;(OpenAI as any).prototype.chat = {
				completions: { create: mockCreate },
			} as any

			await expect(handler.completePrompt("test prompt")).rejects.toThrow("Unexpected error")
		})
	})
})

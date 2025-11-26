import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import {
	openRouterDefaultModelId,
	openRouterDefaultModelInfo,
	OPENROUTER_DEFAULT_PROVIDER_NAME,
	OPEN_ROUTER_PROMPT_CACHING_MODELS,
	DEEP_SEEK_DEFAULT_TEMPERATURE,
} from "@siid-code/types"

import type { ApiHandlerOptions, ModelRecord } from "../../shared/api"

import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStreamChunk } from "../transform/stream"
import { convertToR1Format } from "../transform/r1-format"
import { addCacheBreakpoints as addAnthropicCacheBreakpoints } from "../transform/caching/anthropic"
import { addCacheBreakpoints as addGeminiCacheBreakpoints } from "../transform/caching/gemini"
import type { OpenRouterReasoningParams } from "../transform/reasoning"
import { getModelParams } from "../transform/model-params"

import { getModels } from "./fetchers/modelCache"
import { getModelEndpoints } from "./fetchers/modelEndpointCache"

import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import type { SingleCompletionHandler } from "../index"
import path from "path"
import fs from "fs"
import { ApiMetricsLogger } from "./utils/apiMetricsLogger"

// Add custom interface for OpenRouter params.
type OpenRouterChatCompletionParams = OpenAI.Chat.ChatCompletionCreateParams & {
	transforms?: string[]
	include_reasoning?: boolean
	// https://openrouter.ai/docs/use-cases/reasoning-tokens
	reasoning?: OpenRouterReasoningParams
}

// See `OpenAI.Chat.Completions.ChatCompletionChunk["usage"]`
// `CompletionsAPI.CompletionUsage`
// See also: https://openrouter.ai/docs/use-cases/usage-accounting
interface CompletionUsage {
	completion_tokens?: number
	completion_tokens_details?: {
		reasoning_tokens?: number
	}
	prompt_tokens?: number
	prompt_tokens_details?: {
		cached_tokens?: number
	}
	total_tokens?: number
	cost?: number
	cost_details?: {
		upstream_inference_cost?: number
	}
}

export class OpenRouterHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	protected models: ModelRecord = {}
	protected endpoints: ModelRecord = {}

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options

		const baseURL = this.options.openRouterBaseUrl || "https://openrouter.ai/api/v1"
		const apiKey = this.options.openRouterApiKey ?? "not-provided"

		this.client = new OpenAI({ baseURL, apiKey, defaultHeaders: DEFAULT_HEADERS })
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
	): AsyncGenerator<ApiStreamChunk> {
		const model = await this.fetchModel()

		let { id: modelId, maxTokens, temperature, topP, reasoning } = model

		// OpenRouter sends reasoning tokens by default for Gemini 2.5 Pro
		// Preview even if you don't request them. This is not the default for
		// other providers (including Gemini), so we need to explicitly disable
		// i We should generalize this using the logic in `getModelParams`, but
		// this is easier for now.
		if (
			(modelId === "google/gemini-2.5-pro-preview" || modelId === "google/gemini-2.5-pro") &&
			typeof reasoning === "undefined"
		) {
			reasoning = { exclude: true }
		}

		// Convert Anthropic messages to OpenAI format.
		let openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]

		// DeepSeek highly recommends using user instead of system role.
		if (modelId.startsWith("deepseek/deepseek-r1") || modelId === "perplexity/sonar-reasoning") {
			openAiMessages = convertToR1Format([{ role: "user", content: systemPrompt }, ...messages])
		}

		// https://openrouter.ai/docs/features/prompt-caching
		// TODO: Add a `promptCacheStratey` field to `ModelInfo`.
		if (OPEN_ROUTER_PROMPT_CACHING_MODELS.has(modelId)) {
			if (modelId.startsWith("google")) {
				addGeminiCacheBreakpoints(systemPrompt, openAiMessages)
			} else {
				addAnthropicCacheBreakpoints(systemPrompt, openAiMessages)
			}
		}

		const transforms = (this.options.openRouterUseMiddleOutTransform ?? true) ? ["middle-out"] : undefined

		// https://openrouter.ai/docs/transforms
		const completionParams: OpenRouterChatCompletionParams = {
			model: modelId,
			...(maxTokens && maxTokens > 0 && { max_tokens: maxTokens }),
			temperature,
			top_p: topP,
			messages: openAiMessages,
			stream: true,
			stream_options: { include_usage: true },
			// Only include provider if openRouterSpecificProvider is not "[default]".
			...(this.options.openRouterSpecificProvider &&
				this.options.openRouterSpecificProvider !== OPENROUTER_DEFAULT_PROVIDER_NAME && {
					provider: {
						order: [this.options.openRouterSpecificProvider],
						only: [this.options.openRouterSpecificProvider],
						allow_fallbacks: false,
					},
				}),
			...(transforms && { transforms }),
			...(reasoning && { reasoning }),
		}

		// Write completionParams to a debug file for inspection

		const debugFilePath = path.resolve(__dirname, "../../../debug/openrouter-completionParams.json")
		console.log(`debugFilePath created/openrouter-completionParams.json: ${debugFilePath}`)

		try {
			fs.promises.mkdir(path.dirname(debugFilePath), { recursive: true })
			await fs.promises.writeFile(debugFilePath, JSON.stringify(completionParams, null, 2), "utf8")
		} catch (err) {
			console.warn("Failed to write completionParams debug file:", err)
		}

		// Prepare user request string for logging
		const userRequestString = JSON.stringify({
			systemPrompt,
			messages: messages.slice(-3), // Last 3 messages for context
			model: modelId,
		})

		// Create timing tracker for metrics
		const timingTracker = ApiMetricsLogger.createTimingTracker("openrouter", modelId, true, userRequestString)

		let lastUsage: CompletionUsage | undefined = undefined

		try {
			const stream = await this.client.chat.completions.create(completionParams)

			for await (const chunk of stream) {
				// Mark first chunk received
				timingTracker.markFirstChunk()

				// OpenRouter returns an error object instead of the OpenAI SDK throwing an error.
				if ("error" in chunk) {
					const error = chunk.error as { message?: string; code?: number }
					console.error(`OpenRouter API Error: ${error?.code} - ${error?.message}`)
					await timingTracker.complete("error", undefined, `${error?.code}: ${error?.message}`)
					throw new Error(`OpenRouter API Error ${error?.code}: ${error?.message}`)
				}

				// Start timing data processing
				timingTracker.startProcessing()

				const delta = chunk.choices[0]?.delta

				if ("reasoning" in delta && delta.reasoning && typeof delta.reasoning === "string") {
					timingTracker.appendOutput(`[REASONING] ${delta.reasoning}\n`)
					yield { type: "reasoning", text: delta.reasoning }
				}

				if (delta?.content) {
					timingTracker.appendOutput(delta.content)
					yield { type: "text", text: delta.content }
				}

				if (chunk.usage) {
					lastUsage = chunk.usage
				}

				// End timing data processing
				timingTracker.endProcessing()

				// Mark last chunk (will be overwritten until loop ends)
				timingTracker.markLastChunk()
			}

			if (lastUsage) {
				const usageData = {
					inputTokens: lastUsage.prompt_tokens || 0,
					outputTokens: lastUsage.completion_tokens || 0,
					cacheReadTokens: lastUsage.prompt_tokens_details?.cached_tokens,
					reasoningTokens: lastUsage.completion_tokens_details?.reasoning_tokens,
					totalCost: (lastUsage.cost_details?.upstream_inference_cost || 0) + (lastUsage.cost || 0),
				}

				yield {
					type: "usage",
					...usageData,
				}

				// Complete metrics logging with token usage
				await timingTracker.complete("success", usageData)
			} else {
				// Complete metrics logging without token usage
				await timingTracker.complete("success")
			}
		} catch (error) {
			// Log error metrics
			await timingTracker.complete(
				"error",
				lastUsage
					? {
							inputTokens: lastUsage.prompt_tokens || 0,
							outputTokens: lastUsage.completion_tokens || 0,
							cacheReadTokens: lastUsage.prompt_tokens_details?.cached_tokens,
							reasoningTokens: lastUsage.completion_tokens_details?.reasoning_tokens,
							totalCost: (lastUsage.cost_details?.upstream_inference_cost || 0) + (lastUsage.cost || 0),
						}
					: undefined,
				error instanceof Error ? error.message : String(error),
			)
			throw error
		}
	}

	public async fetchModel() {
		const [models, endpoints] = await Promise.all([
			getModels({ provider: "openrouter" }),
			getModelEndpoints({
				router: "openrouter",
				modelId: this.options.openRouterModelId,
				endpoint: this.options.openRouterSpecificProvider,
			}),
		])

		this.models = models
		this.endpoints = endpoints

		return this.getModel()
	}

	override getModel() {
		const id = this.options.openRouterModelId ?? openRouterDefaultModelId
		let info = this.models[id] ?? openRouterDefaultModelInfo

		// If a specific provider is requested, use the endpoint for that provider.
		if (this.options.openRouterSpecificProvider && this.endpoints[this.options.openRouterSpecificProvider]) {
			info = this.endpoints[this.options.openRouterSpecificProvider]
		}

		const isDeepSeekR1 = id.startsWith("deepseek/deepseek-r1") || id === "perplexity/sonar-reasoning"

		const params = getModelParams({
			format: "openrouter",
			modelId: id,
			model: info,
			settings: this.options,
			defaultTemperature: isDeepSeekR1 ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0,
		})

		return { id, info, topP: isDeepSeekR1 ? 0.95 : undefined, ...params }
	}

	async completePrompt(prompt: string) {
		let { id: modelId, maxTokens, temperature, reasoning } = await this.fetchModel()

		const completionParams: OpenRouterChatCompletionParams = {
			model: modelId,
			max_tokens: maxTokens,
			temperature,
			messages: [{ role: "user", content: prompt }],
			stream: false,
			// Only include provider if openRouterSpecificProvider is not "[default]".
			...(this.options.openRouterSpecificProvider &&
				this.options.openRouterSpecificProvider !== OPENROUTER_DEFAULT_PROVIDER_NAME && {
					provider: {
						order: [this.options.openRouterSpecificProvider],
						only: [this.options.openRouterSpecificProvider],
						allow_fallbacks: false,
					},
				}),
			...(reasoning && { reasoning }),
		}

		// Prepare user request string for logging
		const userRequestString = JSON.stringify({
			prompt,
			model: modelId,
		})

		// Create timing tracker for non-streaming requests
		const timingTracker = ApiMetricsLogger.createTimingTracker("openrouter", modelId, false, userRequestString)

		try {
			timingTracker.startProcessing()
			const response = await this.client.chat.completions.create(completionParams)
			timingTracker.endProcessing()

			if ("error" in response) {
				const error = response.error as { message?: string; code?: number }
				await timingTracker.complete("error", undefined, `${error?.code}: ${error?.message}`)
				throw new Error(`OpenRouter API Error ${error?.code}: ${error?.message}`)
			}

			const completion = response as OpenAI.Chat.ChatCompletion
			const content = completion.choices[0]?.message?.content || ""

			// Capture the output response
			timingTracker.appendOutput(content)

			// Extract token usage if available
			const usage = completion.usage as CompletionUsage | undefined
			if (usage) {
				await timingTracker.complete("success", {
					inputTokens: usage.prompt_tokens || 0,
					outputTokens: usage.completion_tokens || 0,
					cacheReadTokens: usage.prompt_tokens_details?.cached_tokens,
					reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
					totalCost: (usage.cost_details?.upstream_inference_cost || 0) + (usage.cost || 0),
				})
			} else {
				await timingTracker.complete("success")
			}

			return content
		} catch (error) {
			// Log error metrics
			await timingTracker.complete("error", undefined, error instanceof Error ? error.message : String(error))
			throw error
		}
	}
}

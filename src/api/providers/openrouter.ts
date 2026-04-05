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
import { XmlMatcher, type XmlMatcherResult } from "../../utils/xml-matcher"
import {
	announceStreamedToolDebugFile,
	logStreamedToolDebug,
	STREAMED_TOOL_DEBUG_ENABLED,
} from "../../utils/streamed-tool-debug"
import path from "path"
import fs from "fs"

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

function logOpenRouterStreamDebug(event: string, payload: Record<string, unknown>) {
	if (!STREAMED_TOOL_DEBUG_ENABLED) {
		return
	}

	const serializedPayload = JSON.stringify(payload, (_key, value) => {
		if (typeof value === "bigint") {
			return value.toString()
		}

		if (value instanceof Error) {
			return {
				name: value.name,
				message: value.message,
				stack: value.stack,
			}
		}

		return value
	})

	console.log(`[OpenRouterToolDebug] ${event} ${serializedPayload}`)
	logStreamedToolDebug("OpenRouterToolDebug", event, payload)
}

export class OpenRouterHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: OpenAI
	protected models: ModelRecord = {}
	protected endpoints: ModelRecord = {}
	// Simple in-memory cache to avoid refetching model metadata/endpoints on every call
	private lastFetchTs?: number
	private readonly fetchTtlMs = 60_000 // 60s TTL by default

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		announceStreamedToolDebugFile()

		const baseURL = this.options.openRouterBaseUrl || "https://openrouter.ai/api/v1"
		const apiKey = this.options.openRouterApiKey ?? "not-provided"

		// Log API key for debugging (masked)
		const maskedKey =
			apiKey && apiKey !== "not-provided"
				? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
				: "[NOT PROVIDED]"
		console.log(`[OpenRouterHandler] Constructor - API Key: ${maskedKey}, Length: ${apiKey?.length || 0}`)

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

		// Middle-out transform can add server-side processing latency; default to off unless explicitly enabled
		const transforms = this.options.openRouterUseMiddleOutTransform === true ? ["middle-out"] : undefined

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

		// Optional debug write (disabled by default to avoid disk I/O latency on every request)
		// Use env flag to avoid typing changes on ApiHandlerOptions
		if (process.env.SIID_OPENROUTER_DEBUG === "1") {
			const debugFilePath = path.resolve(__dirname, "../../../debug/openrouter-completionParams.json")
			console.log(`openrouter completionParams debug: ${debugFilePath}`)
			try {
				await fs.promises.mkdir(path.dirname(debugFilePath), { recursive: true })
				await fs.promises.writeFile(debugFilePath, JSON.stringify(completionParams, null, 2), "utf8")
			} catch (err) {
				console.warn("Failed to write completionParams debug file:", err)
			}
		}

		// Log request details for debugging
		const apiKey = this.options.openRouterApiKey ?? "not-provided"
		const maskedKey =
			apiKey && apiKey !== "not-provided"
				? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
				: "[NOT PROVIDED]"
		console.log(`[OpenRouterHandler.createMessage] Making request:`, {
			model: completionParams.model,
			apiKey: maskedKey,
			apiKeyLength: apiKey?.length || 0,
			baseURL: this.client.baseURL,
			hasAuth: !!apiKey && apiKey !== "not-provided",
		})

		const stream = await this.client.chat.completions.create(completionParams)

		let lastUsage: CompletionUsage | undefined = undefined
		const thinkingMatcher = new XmlMatcher(
			"thinking",
			(chunk: XmlMatcherResult) =>
				({
					type: chunk.matched ? "reasoning" : "text",
					text: chunk.data,
				}) as const,
			Number.MAX_SAFE_INTEGER,
		)
		const thinkMatcher = new XmlMatcher(
			"think",
			(chunk: XmlMatcherResult) =>
				({
					type: chunk.matched ? "reasoning" : "text",
					text: chunk.data,
				}) as const,
			Number.MAX_SAFE_INTEGER,
		)

		function* yieldTaggedContent(content: string, finalize = false) {
			const thinkingChunks = finalize ? thinkingMatcher.final(content) : thinkingMatcher.update(content)

			logOpenRouterStreamDebug("yieldTaggedContent:start", {
				finalize,
				content,
				thinkingChunkCount: thinkingChunks.length,
			})

			for (const chunk of thinkingChunks) {
				if (chunk.type === "reasoning") {
					logOpenRouterStreamDebug("yieldTaggedContent:reasoning", {
						source: "thinking",
						text: chunk.text,
					})
					yield chunk
					continue
				}

				const thinkChunks = thinkMatcher.update(chunk.text)
				logOpenRouterStreamDebug("yieldTaggedContent:text", {
					text: chunk.text,
					thinkChunkCount: thinkChunks.length,
				})
				for (const thinkChunk of thinkChunks) {
					logOpenRouterStreamDebug("yieldTaggedContent:emit", {
						source: "think-or-text",
						type: thinkChunk.type,
						text: thinkChunk.text,
					})
					yield thinkChunk
				}
			}

			if (finalize) {
				for (const thinkChunk of thinkMatcher.final()) {
					logOpenRouterStreamDebug("yieldTaggedContent:final", {
						type: thinkChunk.type,
						text: thinkChunk.text,
					})
					yield thinkChunk
				}
			}
		}

		for await (const chunk of stream) {
			// OpenRouter returns an error object instead of the OpenAI SDK throwing an error.
			if ("error" in chunk) {
				const error = chunk.error as { message?: string; code?: number }
				console.error(`OpenRouter API Error: ${error?.code} - ${error?.message}`)
				throw new Error(`OpenRouter API Error ${error?.code}: ${error?.message}`)
			}

			const delta = chunk.choices?.[0]?.delta

			logOpenRouterStreamDebug("stream:chunk", {
				hasDelta: !!delta,
				reasoning_content:
					delta && "reasoning_content" in delta && typeof delta.reasoning_content === "string"
						? delta.reasoning_content
						: undefined,
				reasoning:
					delta && "reasoning" in delta && typeof delta.reasoning === "string" ? delta.reasoning : undefined,
				content: delta?.content,
				hasUsage: !!chunk.usage,
			})

			if (
				delta &&
				"reasoning_content" in delta &&
				delta.reasoning_content &&
				typeof delta.reasoning_content === "string"
			) {
				logOpenRouterStreamDebug("stream:emit-reasoning_content", {
					text: delta.reasoning_content,
				})
				yield { type: "reasoning", text: delta.reasoning_content }
			}

			if (delta && "reasoning" in delta && delta.reasoning && typeof delta.reasoning === "string") {
				logOpenRouterStreamDebug("stream:emit-reasoning", {
					text: delta.reasoning,
				})
				yield { type: "reasoning", text: delta.reasoning }
			}

			if (delta?.content) {
				for (const matcherChunk of yieldTaggedContent(delta.content)) {
					yield matcherChunk
				}
			}

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		for (const matcherChunk of yieldTaggedContent("", true)) {
			yield matcherChunk
		}

		if (lastUsage) {
			yield {
				type: "usage",
				inputTokens: lastUsage.prompt_tokens || 0,
				outputTokens: lastUsage.completion_tokens || 0,
				cacheReadTokens: lastUsage.prompt_tokens_details?.cached_tokens,
				reasoningTokens: lastUsage.completion_tokens_details?.reasoning_tokens,
				totalCost: (lastUsage.cost_details?.upstream_inference_cost || 0) + (lastUsage.cost || 0),
			}
		}
	}

	public async fetchModel() {
		const now = Date.now()
		const isFresh = this.lastFetchTs && now - this.lastFetchTs < this.fetchTtlMs
		if (!isFresh) {
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
			this.lastFetchTs = now
		}

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

		const response = await this.client.chat.completions.create(completionParams)

		if ("error" in response) {
			const error = response.error as { message?: string; code?: number }
			throw new Error(`OpenRouter API Error ${error?.code}: ${error?.message}`)
		}

		const completion = response as OpenAI.Chat.ChatCompletion
		return completion.choices[0]?.message?.content || ""
	}
}

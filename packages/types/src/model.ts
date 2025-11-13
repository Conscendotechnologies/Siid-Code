import { z } from "zod"

/**
 * ReasoningEffort
 */

export const reasoningEfforts = ["low", "medium", "high", "minimal"] as const

export const reasoningEffortsSchema = z.enum(reasoningEfforts)

export type ReasoningEffort = z.infer<typeof reasoningEffortsSchema>

/**
 * Verbosity
 */

export const verbosityLevels = ["low", "medium", "high"] as const

export const verbosityLevelsSchema = z.enum(verbosityLevels)

export type VerbosityLevel = z.infer<typeof verbosityLevelsSchema>

/**
 * ModelParameter
 */

export const modelParameters = ["max_tokens", "temperature", "reasoning", "include_reasoning"] as const

export const modelParametersSchema = z.enum(modelParameters)

export type ModelParameter = z.infer<typeof modelParametersSchema>

export const isModelParameter = (value: string): value is ModelParameter =>
	modelParameters.includes(value as ModelParameter)

/**
 * ModelInfo
 */

export const modelInfoSchema = z.object({
	maxTokens: z.number().nullish(),
	maxThinkingTokens: z.number().nullish(),
	contextWindow: z.number(),
	supportsImages: z.boolean().optional(),
	supportsComputerUse: z.boolean().optional(),
	supportsPromptCache: z.boolean(),
	supportsReasoningBudget: z.boolean().optional(),
	requiredReasoningBudget: z.boolean().optional(),
	supportsReasoningEffort: z.boolean().optional(),
	supportedParameters: z.array(modelParametersSchema).optional(),
	inputPrice: z.number().optional(),
	outputPrice: z.number().optional(),
	cacheWritesPrice: z.number().optional(),
	cacheReadsPrice: z.number().optional(),
	description: z.string().optional(),
	reasoningEffort: reasoningEffortsSchema.optional(),
	minTokensPerCachePoint: z.number().optional(),
	maxCachePoints: z.number().optional(),
	cachableFields: z.array(z.string()).optional(),
	isFree: z.boolean().optional(),
	tiers: z
		.array(
			z.object({
				contextWindow: z.number(),
				inputPrice: z.number().optional(),
				outputPrice: z.number().optional(),
				cacheWritesPrice: z.number().optional(),
				cacheReadsPrice: z.number().optional(),
			}),
		)
		.optional(),
})

export type ModelInfo = z.infer<typeof modelInfoSchema>

/**
 * Utility function to determine if a model is free based on pricing
 * A model is considered free if:
 * 1. Both inputPrice and outputPrice are 0
 * 2. OR the model ID ends with ':free' or '-free' suffix (OpenRouter/Cerebras convention)
 *
 * @param modelInfo - The model information object
 * @param modelId - Optional model ID to check for :free suffix
 * @returns true if the model is free, false otherwise
 */
export function isModelFree(modelInfo: ModelInfo, modelId?: string): boolean {
	// Check if explicitly marked as free
	if (modelInfo.isFree !== undefined) {
		return modelInfo.isFree
	}

	// Method 1: Check pricing (most reliable)
	const hasZeroPricing =
		(modelInfo.inputPrice === 0 || modelInfo.inputPrice === undefined) &&
		(modelInfo.outputPrice === 0 || modelInfo.outputPrice === undefined)

	if (hasZeroPricing && modelInfo.inputPrice === 0 && modelInfo.outputPrice === 0) {
		return true
	}

	// Method 2: Check model ID suffix (OpenRouter :free, Cerebras -free)
	if (modelId) {
		if (modelId.endsWith(":free") || modelId.endsWith("-free")) {
			return true
		}
	}

	return false
}

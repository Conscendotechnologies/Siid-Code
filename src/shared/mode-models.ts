/**
 * Mode-to-Models mapping
 * Defines which models are available for each mode
 */

export interface ModeModelInfo {
	modelId: string
	displayName: string
	provider?: "openrouter" | "anthropic" | "openai" | "other"
	tier?: "free" | "basic" | "medium" | "advanced"
	priority?: number // Lower number = higher priority (1 = primary, 2 = fallback1, 3 = fallback2, etc.)
}

/**
 * Maps mode slugs to available models
 * Models are listed in priority order (first one is default)
 */
export const MODE_TO_MODELS: Record<string, ModeModelInfo[]> = {
	"salesforce-agent": [
		{
			modelId: "z-ai/glm-4.5-air:free",
			displayName: "GLM 4.5 Air (Free, Recommended)",
			provider: "openrouter",
			tier: "free",
			priority: 1, // Primary
		},
		{
			modelId: "meta-llama/llama-3.3-70b-instruct:free",
			displayName: "Llama 3.3 70B (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 2, // Fallback 1
		},
		{
			modelId: "deepseek/deepseek-r1-0528:free",
			displayName: "DeepSeek R1 (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 3, // Fallback 2
		},
		{
			modelId: "z-ai/glm-4.6",
			displayName: "GLM 4.6",
			provider: "openrouter",
			tier: "medium",
			priority: 10, // Premium option
		},
		{
			modelId: "z-ai/glm-4.5",
			displayName: "GLM 4.5",
			provider: "openrouter",
			tier: "medium",
			priority: 11, // Premium option
		},
		{
			modelId: "openai/gpt-5",
			displayName: "GPT-5 (Premium)",
			provider: "openrouter",
			tier: "advanced",
			priority: 20, // Premium option
		},
		{
			modelId: "anthropic/claude-sonnet-4-20250514",
			displayName: "Claude Sonnet 4",
			provider: "openrouter",
			tier: "advanced",
			priority: 21, // Premium option
		},
	],
	code: [
		{
			modelId: "qwen/qwen3-coder:free",
			displayName: "Qwen3 Coder (Free, Recommended)",
			provider: "openrouter",
			tier: "free",
			priority: 1, // Primary
		},
		{
			modelId: "z-ai/glm-4.5-air:free",
			displayName: "GLM 4.5 Air (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 2, // Fallback 1
		},
		{
			modelId: "deepseek/deepseek-r1-0528:free",
			displayName: "DeepSeek R1 (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 3, // Fallback 2
		},
		{
			modelId: "z-ai/glm-4.5",
			displayName: "GLM 4.5",
			provider: "openrouter",
			tier: "medium",
			priority: 10, // Premium option
		},
		{
			modelId: "openai/gpt-5",
			displayName: "GPT-5 (Premium)",
			provider: "openrouter",
			tier: "advanced",
			priority: 20, // Premium option
		},
		{
			modelId: "anthropic/claude-sonnet-4-20250514",
			displayName: "Claude Sonnet 4",
			provider: "openrouter",
			tier: "advanced",
			priority: 21, // Premium option
		},
	],
	orchestrator: [
		{
			modelId: "z-ai/glm-4.5-air:free",
			displayName: "GLM 4.5 Air (Free, Recommended)",
			provider: "openrouter",
			tier: "free",
			priority: 1, // Primary
		},
		{
			modelId: "meta-llama/llama-3.3-70b-instruct:free",
			displayName: "Llama 3.3 70B (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 2, // Fallback 1
		},
		{
			modelId: "deepseek/deepseek-r1-0528:free",
			displayName: "DeepSeek R1 (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 3, // Fallback 2
		},
		{
			modelId: "x-ai/grok-code-fast-1",
			displayName: "Grok Code Fast 1",
			provider: "openrouter",
			tier: "medium",
			priority: 10, // Premium option
		},
		{
			modelId: "openai/gpt-5",
			displayName: "GPT-5 (Premium)",
			provider: "openrouter",
			tier: "advanced",
			priority: 20, // Premium option
		},
		{
			modelId: "anthropic/claude-sonnet-4-20250514",
			displayName: "Claude Sonnet 4",
			provider: "openrouter",
			tier: "advanced",
			priority: 21, // Premium option
		},
	],
	debug: [
		{
			modelId: "qwen/qwen3-coder:free",
			displayName: "Qwen3 Coder (Free, Recommended)",
			provider: "openrouter",
			tier: "free",
			priority: 1, // Primary
		},
		{
			modelId: "z-ai/glm-4.5-air:free",
			displayName: "GLM 4.5 Air (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 2, // Fallback 1
		},
		{
			modelId: "meta-llama/llama-3.3-70b-instruct:free",
			displayName: "Llama 3.3 70B (Free)",
			provider: "openrouter",
			tier: "free",
			priority: 3, // Fallback 2
		},
		{
			modelId: "anthropic/claude-sonnet-4-20250514",
			displayName: "Claude Sonnet 4",
			provider: "openrouter",
			tier: "advanced",
			priority: 20, // Premium option
		},
		{
			modelId: "openai/gpt-5",
			displayName: "GPT-5",
			provider: "openrouter",
			tier: "advanced",
			priority: 21, // Premium option
		},
	],
}

/**
 * Get available models for a mode
 * Returns empty array if mode not found
 */
export function getModelsForMode(modeSlug: string): ModeModelInfo[] {
	return MODE_TO_MODELS[modeSlug] || []
}

/**
 * Get the default (first) model for a mode
 * Returns undefined if mode not found or no models available
 */
export function getDefaultModelForMode(modeSlug: string): ModeModelInfo | undefined {
	const models = getModelsForMode(modeSlug)
	return models[0]
}

/**
 * Check if a model is available for a mode
 */
export function isModelAvailableForMode(modeSlug: string, modelId: string): boolean {
	const models = getModelsForMode(modeSlug)
	return models.some((m) => m.modelId === modelId)
}

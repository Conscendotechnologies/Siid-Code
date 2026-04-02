/**
 * Mode-to-Models mapping
 * Defines which models are available for each mode
 */

export interface ModeModelInfo {
	modelId: string
	displayName: string
	provider?: "openrouter" | "anthropic" | "openai" | "other"
	tier?: "Free" | "Basic" | "Medium" | "Advanced" | "Premium"
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
			tier: "Free",
			priority: 1, // Primary
		},
		{
			modelId: "qwen/qwen3-coder:free",
			displayName: "Qwen3 Coder (Free)",
			provider: "openrouter",
			tier: "Free",
			priority: 2, // Fallback 1
		},
		{
			modelId: "openai/gpt-oss-120b:free",
			displayName: "OpenAI: gpt-oss-120b (Free)",
			provider: "openrouter",
			tier: "Free",
			priority: 3, // Fallback 2
		},
		{
			modelId: "openai/gpt-oss-20b:free",
			displayName: "OpenAI: gpt-oss-20b (Free)",
			provider: "openrouter",
			tier: "Free",
			priority: 4, // Fallback 3
		},
		{
			modelId: "openai/gpt-5.4-nano",
			displayName: "GPT-5.4 Nano",
			provider: "openrouter",
			tier: "Medium",
			priority: 5, // Medium option
		},
		{
			modelId: "moonshotai/kimi-k2.5",
			displayName: "Kimi K2.5",
			provider: "openrouter",
			tier: "Medium",
			priority: 6, // Medium option
		},
		{
			modelId: "qwen/qwen3-32b:nitro",
			displayName: "Qwen3 32B (nitro)",
			provider: "openrouter",
			tier: "Medium",
			priority: 7, // Medium option
		},
		{
			modelId: "minimax/minimax-m2.5",
			displayName: "MiniMax: MiniMax M2.5",
			provider: "openrouter",
			tier: "Medium",
			priority: 8, // Medium option
		},
		{
			modelId: "meta-llama/llama-3.3-70b-instruct:nitro",
			displayName: "Llama 3.3 70B Instruct (nitro)",
			provider: "openrouter",
			tier: "Medium",
			priority: 9, // Medium option
		},
		{
			modelId: "deepseek/deepseek-v3.2",
			displayName: "DeepSeek V3.2",
			provider: "openrouter",
			tier: "Medium",
			priority: 10, // Medium option
		},
		{
			modelId: "openai/gpt-5-mini",
			displayName: "GPT-5 Mini",
			provider: "openrouter",
			tier: "Advanced",
			priority: 11, // Advanced option
		},
		{
			modelId: "openai/gpt-5.4-mini",
			displayName: "GPT-5.4 Mini",
			provider: "openrouter",
			tier: "Advanced",
			priority: 12, // Advanced option
		},
		{
			modelId: "google/gemini-3-flash-preview",
			displayName: "Gemini 3 Flash Preview",
			provider: "openrouter",
			tier: "Advanced",
			priority: 13, // Advanced option
		},
		{
			modelId: "xiaomi/mimo-v2-pro",
			displayName: "Xiaomi: MiMo-V2-Pro",
			provider: "openrouter",
			tier: "Advanced",
			priority: 14, // Advanced option
		},
		{
			modelId: "anthropic/claude-sonnet-4.5",
			displayName: "Claude Sonnet 4.5",
			provider: "openrouter",
			tier: "Premium",
			priority: 15, // Premium option
		},
		{
			modelId: "anthropic/claude-haiku-4.5",
			displayName: "Claude Haiku 4.5",
			provider: "openrouter",
			tier: "Premium",
			priority: 16, // Premium option
		},
		{
			modelId: "openai/gpt-5.1",
			displayName: "GPT-5.1",
			provider: "openrouter",
			tier: "Premium",
			priority: 17, // Premium option
		},
		{
			modelId: "openai/gpt-5.4",
			displayName: "GPT-5.4",
			provider: "openrouter",
			tier: "Premium",
			priority: 18, // Premium option
		},
		{
			modelId: "openai/gpt-5.2-codex",
			displayName: "GPT-5.2 Codex",
			provider: "openrouter",
			tier: "Premium",
			priority: 19, // Premium option
		},
	],
	code: [
		{
			modelId: "z-ai/glm-4.5-air:free",
			displayName: "GLM 4.5 Air (Free)",
			provider: "openrouter",
			tier: "Free",
			priority: 1, // Primary
		},
		{
			modelId: "qwen/qwen3-coder:free",
			displayName: "Qwen3 Coder (Free, Recommended)",
			provider: "openrouter",
			tier: "Free",
			priority: 2, // Fallback 1
		},
		{
			modelId: "openai/gpt-oss-120b:free",
			displayName: "OpenAI: gpt-oss-120b (Free)",
			provider: "openrouter",
			tier: "Free",
			priority: 3, // Fallback 2
		},
		{
			modelId: "openai/gpt-oss-20b:free",
			displayName: "OpenAI: gpt-oss-20b (Free)",
			provider: "openrouter",
			tier: "Free",
			priority: 4, // Fallback 3
		},
		{
			modelId: "openai/gpt-5.4-nano",
			displayName: "GPT-5.4 Nano",
			provider: "openrouter",
			tier: "Medium",
			priority: 5, // Medium option
		},
		{
			modelId: "moonshotai/kimi-k2.5",
			displayName: "Kimi K2.5",
			provider: "openrouter",
			tier: "Medium",
			priority: 6, // Medium option
		},
		{
			modelId: "qwen/qwen3-32b:nitro",
			displayName: "Qwen3 32B (nitro)",
			provider: "openrouter",
			tier: "Medium",
			priority: 7, // Medium option
		},
		{
			modelId: "minimax/minimax-m2.5",
			displayName: "MiniMax: MiniMax M2.5",
			provider: "openrouter",
			tier: "Medium",
			priority: 8, // Medium option
		},
		{
			modelId: "meta-llama/llama-3.3-70b-instruct:nitro",
			displayName: "Llama 3.3 70B Instruct (nitro)",
			provider: "openrouter",
			tier: "Medium",
			priority: 9, // Medium option
		},
		{
			modelId: "deepseek/deepseek-v3.2",
			displayName: "DeepSeek V3.2",
			provider: "openrouter",
			tier: "Medium",
			priority: 10, // Medium option
		},
		{
			modelId: "openai/gpt-5-mini",
			displayName: "GPT-5 Mini",
			provider: "openrouter",
			tier: "Advanced",
			priority: 11, // Advanced option
		},
		{
			modelId: "openai/gpt-5.4-mini",
			displayName: "GPT-5.4 Mini",
			provider: "openrouter",
			tier: "Advanced",
			priority: 12, // Advanced option
		},
		{
			modelId: "google/gemini-3-flash-preview",
			displayName: "Gemini 3 Flash Preview",
			provider: "openrouter",
			tier: "Advanced",
			priority: 13, // Advanced option
		},
		{
			modelId: "xiaomi/mimo-v2-pro",
			displayName: "Xiaomi: MiMo-V2-Pro",
			provider: "openrouter",
			tier: "Advanced",
			priority: 14, // Advanced option
		},
		{
			modelId: "anthropic/claude-sonnet-4.5",
			displayName: "Claude Sonnet 4.5",
			provider: "openrouter",
			tier: "Premium",
			priority: 15, // Premium option
		},
		{
			modelId: "anthropic/claude-haiku-4.5",
			displayName: "Claude Haiku 4.5",
			provider: "openrouter",
			tier: "Premium",
			priority: 16, // Premium option
		},
		{
			modelId: "openai/gpt-5.1",
			displayName: "GPT-5.1",
			provider: "openrouter",
			tier: "Premium",
			priority: 17, // Premium option
		},
		{
			modelId: "openai/gpt-5.4",
			displayName: "GPT-5.4",
			provider: "openrouter",
			tier: "Premium",
			priority: 18, // Premium option
		},
		{
			modelId: "openai/gpt-5.2-codex",
			displayName: "GPT-5.2 Codex",
			provider: "openrouter",
			tier: "Premium",
			priority: 19, // Premium option
		},
	],
	orchestrator: [
		{
			modelId: "z-ai/glm-4.5-air:free",
			displayName: "GLM 4.5 Air (Free)",
			provider: "openrouter",
			tier: "Free",
			priority: 1, // Primary
		},
		{
			modelId: "qwen/qwen3-coder:free",
			displayName: "Qwen3 Coder (Free, Recommended)",
			provider: "openrouter",
			tier: "Free",
			priority: 2, // Fallback 1
		},
		{
			modelId: "openai/gpt-oss-120b:free",
			displayName: "OpenAI: gpt-oss-120b (Free)",
			provider: "openrouter",
			tier: "Free",
			priority: 3, // Fallback 2
		},
		{
			modelId: "openai/gpt-oss-20b:free",
			displayName: "OpenAI: gpt-oss-20b (Free)",
			provider: "openrouter",
			tier: "Free",
			priority: 4, // Fallback 3
		},
		{
			modelId: "openai/gpt-5.4-nano",
			displayName: "GPT-5.4 Nano",
			provider: "openrouter",
			tier: "Medium",
			priority: 5, // Medium option
		},
		{
			modelId: "moonshotai/kimi-k2.5",
			displayName: "Kimi K2.5",
			provider: "openrouter",
			tier: "Medium",
			priority: 6, // Medium option
		},
		{
			modelId: "qwen/qwen3-32b:nitro",
			displayName: "Qwen3 32B (nitro)",
			provider: "openrouter",
			tier: "Medium",
			priority: 7, // Medium option
		},
		{
			modelId: "minimax/minimax-m2.5",
			displayName: "MiniMax: MiniMax M2.5",
			provider: "openrouter",
			tier: "Medium",
			priority: 8, // Medium option
		},
		{
			modelId: "meta-llama/llama-3.3-70b-instruct:nitro",
			displayName: "Llama 3.3 70B Instruct (nitro)",
			provider: "openrouter",
			tier: "Medium",
			priority: 9, // Medium option
		},
		{
			modelId: "deepseek/deepseek-v3.2",
			displayName: "DeepSeek V3.2",
			provider: "openrouter",
			tier: "Medium",
			priority: 10, // Medium option
		},
		{
			modelId: "openai/gpt-5-mini",
			displayName: "GPT-5 Mini",
			provider: "openrouter",
			tier: "Advanced",
			priority: 11, // Advanced option
		},
		{
			modelId: "openai/gpt-5.4-mini",
			displayName: "GPT-5.4 Mini",
			provider: "openrouter",
			tier: "Advanced",
			priority: 12, // Advanced option
		},
		{
			modelId: "google/gemini-3-flash-preview",
			displayName: "Gemini 3 Flash Preview",
			provider: "openrouter",
			tier: "Advanced",
			priority: 13, // Advanced option
		},
		{
			modelId: "xiaomi/mimo-v2-pro",
			displayName: "Xiaomi: MiMo-V2-Pro",
			provider: "openrouter",
			tier: "Advanced",
			priority: 14, // Advanced option
		},
		{
			modelId: "anthropic/claude-sonnet-4.5",
			displayName: "Claude Sonnet 4.5",
			provider: "openrouter",
			tier: "Premium",
			priority: 15, // Premium option
		},
		{
			modelId: "anthropic/claude-haiku-4.5",
			displayName: "Claude Haiku 4.5",
			provider: "openrouter",
			tier: "Premium",
			priority: 16, // Premium option
		},
		{
			modelId: "openai/gpt-5.1",
			displayName: "GPT-5.1",
			provider: "openrouter",
			tier: "Premium",
			priority: 17, // Premium option
		},
		{
			modelId: "openai/gpt-5.4",
			displayName: "GPT-5.4",
			provider: "openrouter",
			tier: "Premium",
			priority: 18, // Premium option
		},
		{
			modelId: "openai/gpt-5.2-codex",
			displayName: "GPT-5.2 Codex",
			provider: "openrouter",
			tier: "Premium",
			priority: 19, // Premium option
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

/**
 * Model Fallback Logic for 429 Rate Limit Errors
 *
 * This module handles automatic model switching when a 429 error occurs.
 * It maintains fallback chains for each config so that when one model is rate-limited,
 * it can switch to an alternative and restore back if needed.
 *
 * Fallback Strategy:
 * - Primary: z-ai/glm-4.5-air:free (always the main model)
 * - Fallback 1: qwen/qwen3-coder:free
 * - Fallback 2: meta-llama/llama-3.3-70b-instruct:free
 * - Fallback 3: deepseek/deepseek-r1-0528:free
 *
 * Time-based Auto-Recovery:
 * - Each model has a 3-minute timeout
 * - After 3 minutes, automatically switch back to primary GLM
 * - New chats/tasks always start with primary GLM
 */

import type { ProviderSettings } from "@siid-code/types"

// 3 minutes in milliseconds
const MODEL_TIMEOUT_MS = 3 * 60 * 1000

/**
 * Maps config IDs to their fallback chains
 * Format: configId -> [primaryModel, fallback1, fallback2, fallback3, ...]
 */
const MODEL_FALLBACK_CHAIN: Record<string, string[]> = {
	"salesforce-agent-basic-free": [
		"z-ai/glm-4.5-air:free", // Primary (index 0)
		"qwen/qwen3-coder:free", // Fallback 1 (index 1)
		"meta-llama/llama-3.3-70b-instruct:free", // Fallback 2 (index 2)
		"deepseek/deepseek-r1-0528:free", // Fallback 3 (index 3)
	],
	"code-basic-free": [
		"z-ai/glm-4.5-air:free", // Primary (index 0)
		"qwen/qwen3-coder:free", // Fallback 1 (index 1)
		"meta-llama/llama-3.3-70b-instruct:free", // Fallback 2 (index 2)
		"deepseek/deepseek-r1-0528:free", // Fallback 3 (index 3)
	],
	"orchestrator-basic-free": [
		"z-ai/grok-4.1-fast:free", // Primary (index 0) - Note: Different primary
		"qwen/qwen3-coder:free", // Fallback 1 (index 1)
		"meta-llama/llama-3.3-70b-instruct:free", // Fallback 2 (index 2)
		"deepseek/deepseek-r1-0528:free", // Fallback 3 (index 3)
	],
}

/**
 * Tracks the current model index for each config
 * Allows us to switch between models in the fallback chain
 */
const modelIndexTracker: Record<string, number> = {}

/**
 * Tracks when each model was activated (timestamp in ms)
 * Used to auto-reset to primary after timeout
 */
const modelActivationTimeTracker: Record<string, number> = {}

/**
 * Tracks consecutive 429 errors per config
 */
const errorCountTracker: Record<string, number> = {}

/**
 * Checks if an error is a 429 rate limit error
 */
export function is429Error(error: any): boolean {
	// Direct status code checks
	if (error?.status === 429) return true
	if (error?.code === 429) return true

	// Check nested error properties
	if (error?.error?.code === 429) return true
	if (error?.error?.status === 429) return true

	// Check OpenRouter error response format
	if (error?.error?.metadata?.raw) {
		const raw = error.error.metadata.raw
		if (typeof raw === "string" && raw.includes('"code":429')) return true
		if (typeof raw === "string" && raw.includes('code":429')) return true
		if (typeof raw === "string" && raw.includes("429")) {
			// More strict: check if it's actually rate limit
			return raw.includes("rate") || raw.includes("limit") || raw.includes("temporarily")
		}
	}

	// Check message for explicit 429 mentions with rate limit context
	if (error?.message) {
		const msg = error.message.toLowerCase()
		if (msg.includes("429") && (msg.includes("rate") || msg.includes("limit") || msg.includes("throttle"))) {
			return true
		}
	}

	// Check raw error response
	if (error?.rawError) {
		const raw = JSON.stringify(error.rawError)
		if (raw.includes("429") && (raw.includes("rate") || raw.includes("limit"))) return true
	}

	return false
}

/**
 * Gets the fallback model for a given config or advances through the chain
 * Returns the model to switch to, whether it's a fallback, and a UI message
 */
export function getNextModelOnError(
	configId: string,
	currentModel: string,
): {
	model: string | null
	isFallback: boolean
	message: string
} {
	const chain = MODEL_FALLBACK_CHAIN[configId]
	if (!chain) return { model: null, isFallback: false, message: "" }

	const primaryModel = chain[0]

	// Find current position in chain
	const currentIndex = chain.indexOf(currentModel)

	// If not found in chain or at primary, switch to first fallback
	if (currentIndex === -1 || currentIndex === 0) {
		if (chain.length > 1) {
			modelIndexTracker[configId] = 1
			modelActivationTimeTracker[configId] = Date.now()
			errorCountTracker[configId] = 1
			const nextModel = chain[1]
			return {
				model: nextModel,
				isFallback: true,
				message: `⚠️ Switching to fallback model: ${nextModel}`,
			}
		}
		return { model: null, isFallback: false, message: "" }
	}

	// If on a fallback, advance to next fallback if available
	if (currentIndex > 0 && currentIndex < chain.length - 1) {
		const nextIndex = currentIndex + 1
		modelIndexTracker[configId] = nextIndex
		modelActivationTimeTracker[configId] = Date.now()
		errorCountTracker[configId] = (errorCountTracker[configId] ?? 0) + 1
		const nextModel = chain[nextIndex]
		return {
			model: nextModel,
			isFallback: true,
			message: `⚠️ Switching to next fallback model: ${nextModel}`,
		}
	}

	// If on last fallback, cycle back to primary
	if (currentIndex === chain.length - 1) {
		modelIndexTracker[configId] = 0
		modelActivationTimeTracker[configId] = Date.now()
		errorCountTracker[configId] = 1
		return {
			model: primaryModel,
			isFallback: false,
			message: `✅ Switching back to primary model: ${primaryModel}`,
		}
	}

	return { model: null, isFallback: false, message: "" }
}

/**
 * Checks if a model has exceeded its timeout duration
 * Returns true if the model should be reset to primary
 */
export function isModelTimeoutExpired(configId: string): boolean {
	const activationTime = modelActivationTimeTracker[configId]
	if (!activationTime) return false

	const elapsed = Date.now() - activationTime
	return elapsed >= MODEL_TIMEOUT_MS
}

/**
 * Gets time remaining for current model (in seconds)
 * Useful for UI display
 */
export function getModelTimeRemaining(configId: string): number {
	const activationTime = modelActivationTimeTracker[configId]
	if (!activationTime) return 0

	const elapsed = Date.now() - activationTime
	const remaining = MODEL_TIMEOUT_MS - elapsed

	return Math.max(0, Math.ceil(remaining / 1000)) // Return seconds
}

/**
 * Resets model to primary when timeout expires (NOT on success)
 * Only called when 3-minute timeout is exceeded
 */
export function resetModelToDefault(configId: string): { reset: boolean; message: string } {
	const chain = MODEL_FALLBACK_CHAIN[configId]
	const currentIndex = modelIndexTracker[configId] ?? 0
	const primaryModel = chain?.[0]

	// If we're not on primary, reset and return message
	if (currentIndex !== 0 && primaryModel) {
		modelIndexTracker[configId] = 0
		errorCountTracker[configId] = 0
		modelActivationTimeTracker[configId] = 0

		return {
			reset: true,
			message: `✅ Switching back to primary model: ${primaryModel}`,
		}
	}

	// Already on primary
	modelIndexTracker[configId] = 0
	errorCountTracker[configId] = 0
	modelActivationTimeTracker[configId] = 0

	return { reset: false, message: "" }
}

/**
 * Handles timeout-based reset to primary model
 * Called periodically or when timeout is detected
 */
export function resetOnTimeout(configId: string): { timedOut: boolean; message: string; model: string | null } {
	if (!isModelTimeoutExpired(configId)) {
		return { timedOut: false, message: "", model: null }
	}

	const chain = MODEL_FALLBACK_CHAIN[configId]
	const primaryModel = chain?.[0]

	if (primaryModel) {
		modelIndexTracker[configId] = 0
		errorCountTracker[configId] = 0
		modelActivationTimeTracker[configId] = 0

		return {
			timedOut: true,
			message: `⏱️ 3-minute timeout reached. Switching back to primary model: ${primaryModel}`,
			model: primaryModel,
		}
	}

	return { timedOut: false, message: "", model: null }
}

/**
 * Gets the primary model for a config
 */
export function getPrimaryModel(configId: string): string | null {
	const chain = MODEL_FALLBACK_CHAIN[configId]
	if (!chain || chain.length === 0) return null
	return chain[0] // Primary is always at index 0
}

/**
 * Gets the current active model for a config
 */
export function getCurrentActiveModel(configId: string, config: ProviderSettings): string | null {
	const chain = MODEL_FALLBACK_CHAIN[configId]
	if (!chain) return null

	const currentIndex = modelIndexTracker[configId] ?? 0
	return chain[currentIndex]
}

/**
 * Increments error count and returns true if we should try fallback
 */
export function shouldSwitchToFallback(configId: string): boolean {
	const currentCount = errorCountTracker[configId] ?? 0
	errorCountTracker[configId] = currentCount + 1

	// Switch to fallback on first 429 error
	return true
}

/**
 * Gets the fallback chain for a config
 */
export function getFallbackChain(configId: string): string[] {
	return MODEL_FALLBACK_CHAIN[configId] ?? []
}

/**
 * Clears all tracking data (for testing or reset)
 */
export function clearTracking(): void {
	Object.keys(modelIndexTracker).forEach((key) => delete modelIndexTracker[key])
	Object.keys(errorCountTracker).forEach((key) => delete errorCountTracker[key])
	Object.keys(modelActivationTimeTracker).forEach((key) => delete modelActivationTimeTracker[key])
}

/**
 * Gets debug info about current state
 */
export function getDebugInfo() {
	return {
		modelIndexTracker: { ...modelIndexTracker },
		errorCountTracker: { ...errorCountTracker },
		modelActivationTimeTracker: { ...modelActivationTimeTracker },
		timeoutMs: MODEL_TIMEOUT_MS,
	}
}

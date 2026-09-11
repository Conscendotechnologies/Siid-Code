import type { ModelInfo } from "../model.js"

export const nineRouterDefaultBaseUrl = "http://localhost:20128/v1"
export const nineRouterDefaultModelId = "claude-3-7-sonnet"

export const nineRouterDefaultModelInfo: ModelInfo = {
	maxTokens: 8192,
	contextWindow: 200_000,
	supportsImages: true,
	supportsComputerUse: true,
	supportsPromptCache: true,
}

export function inferModelInfoFromId(id: string): ModelInfo {
	const idLower = id.toLowerCase()
	let contextWindow = nineRouterDefaultModelInfo.contextWindow

	if (idLower.includes("2m") || idLower.includes("2000k")) {
		contextWindow = 2_000_000
	} else if (
		idLower.includes("1m") ||
		idLower.includes("1000k") ||
		idLower.includes("gemini-1.5") ||
		idLower.includes("gemini-2.0") ||
		idLower.includes("gemini-flash") ||
		idLower.includes("gemini-pro") ||
		idLower.includes("gemini")
	) {
		contextWindow = 1_000_000
	} else if (
		idLower.includes("200k") ||
		idLower.includes("claude-3") ||
		idLower.includes("sonnet") ||
		idLower.includes("opus")
	) {
		contextWindow = 200_000
	} else if (idLower.includes("128k") || idLower.includes("deepseek") || idLower.includes("llama-3")) {
		contextWindow = 128_000
	} else if (idLower.includes("64k")) {
		contextWindow = 64_000
	} else if (idLower.includes("32k")) {
		contextWindow = 32_000
	}

	return {
		...nineRouterDefaultModelInfo,
		contextWindow,
		description: `${id} via 9Router`,
	}
}

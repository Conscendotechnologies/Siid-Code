const getAnthropicModels = vi.fn()
vi.mock("../anthropic", async (orig) => ({
	...(await orig<typeof import("../anthropic")>()),
	getAnthropicModels: (...a: any[]) => getAnthropicModels(...a),
}))
vi.mock("../../../../utils/safeWriteJson", () => ({ safeWriteJson: vi.fn().mockResolvedValue(undefined) }))
vi.mock("../../../../utils/storage", () => ({ getCacheDirectoryPath: vi.fn().mockResolvedValue("/cache") }))
vi.mock("../../../../core/config/ContextProxy", () => ({
	ContextProxy: { instance: { globalStorageUri: { fsPath: "/g" } } },
}))

import { getModels, flushModels, getLastGoodAnthropicModels } from "../modelCache"
import { anthropicCacheKey } from "../anthropic"

const opts = { provider: "anthropic" as const, apiKey: "k", baseUrl: undefined, useAuthToken: false }
const live = { "claude-new": { contextWindow: 1_000_000, supportsPromptCache: true } } as any

describe("getModels anthropic last-good list", () => {
	it("keeps the last good list after the memory entry expires and a refresh fails", async () => {
		getAnthropicModels.mockResolvedValueOnce(live)
		await getModels(opts)
		expect(getLastGoodAnthropicModels(anthropicCacheKey(opts))).toBe(live)

		await flushModels("anthropic") // stands in for the 5 minute TTL
		getAnthropicModels.mockRejectedValueOnce(new Error("down"))
		vi.spyOn(console, "warn").mockImplementation(() => {})
		expect(await getModels(opts)).toBe(live)
		expect(getLastGoodAnthropicModels(anthropicCacheKey(opts))).toBe(live)
	})

	it("has no last-good list for unknown credentials", () => {
		expect(getLastGoodAnthropicModels("anthropic:nope")).toBeUndefined()
	})
})

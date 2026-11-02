const getAnthropicModels = vi.fn()
const safeWriteJson = vi.fn().mockResolvedValue(undefined)
const disk = vi.hoisted(() => ({ exists: false, content: "" }))

vi.mock("../anthropic", async (orig) => ({
	...(await orig<typeof import("../anthropic")>()),
	getAnthropicModels: (...a: any[]) => getAnthropicModels(...a),
}))
vi.mock("../../../../utils/safeWriteJson", () => ({ safeWriteJson: (...a: any[]) => safeWriteJson(...a) }))
vi.mock("../../../../utils/storage", () => ({ getCacheDirectoryPath: vi.fn().mockResolvedValue("/cache") }))
vi.mock("../../../../utils/fs", () => ({ fileExistsAtPath: vi.fn(async () => disk.exists) }))
vi.mock("fs/promises", () => ({ default: { readFile: vi.fn(async () => disk.content) } }))
vi.mock("../../../../core/config/ContextProxy", () => ({
	ContextProxy: { instance: { globalStorageUri: { fsPath: "/g" } } },
}))

import {
	getModels,
	flushModels,
	getLastGoodAnthropicModels,
	ensureAnthropicLastGoodSeeded,
	resetAnthropicLastGoodForTests,
} from "../modelCache"
import { anthropicCacheKey } from "../anthropic"

const opts = { provider: "anthropic" as const, apiKey: "k", baseUrl: undefined, useAuthToken: false }
const key = anthropicCacheKey(opts)
const live = { "claude-new": { contextWindow: 1_000_000, maxTokens: 128_000, supportsPromptCache: true } } as any

describe("getModels anthropic last-good list", () => {
	beforeEach(async () => {
		resetAnthropicLastGoodForTests()
		await flushModels("anthropic")
		disk.exists = false
		disk.content = ""
		vi.spyOn(console, "warn").mockImplementation(() => {})
		safeWriteJson.mockClear()
		getAnthropicModels.mockReset()
	})

	it("keeps the last good list after the memory entry expires and a refresh fails", async () => {
		getAnthropicModels.mockResolvedValueOnce(live)
		await getModels(opts)
		expect(getLastGoodAnthropicModels(key)).toBe(live)

		await flushModels("anthropic") // stands in for the 5 minute TTL
		getAnthropicModels.mockRejectedValueOnce(new Error("down"))
		expect(await getModels(opts)).toBe(live)
		expect(getLastGoodAnthropicModels(key)).toBe(live)
	})

	it("writes the list to disk keyed by credential hash, never by key", async () => {
		getAnthropicModels.mockResolvedValueOnce(live)
		await getModels(opts)
		expect(safeWriteJson).toHaveBeenCalledWith(expect.stringMatching(/anthropic_models\.json$/), {
			format: 2,
			lists: { [key]: live },
		})
		expect(JSON.stringify(safeWriteJson.mock.calls[0][1])).not.toContain('"k"')
	})

	it("seeds the last-good list from disk on a cold start (extension restart)", async () => {
		disk.exists = true
		disk.content = JSON.stringify({ format: 2, lists: { [key]: live } })

		await ensureAnthropicLastGoodSeeded()
		expect(getLastGoodAnthropicModels(key)).toEqual(live)

		// a slow or failing first fetch after restart still yields real limits
		getAnthropicModels.mockRejectedValueOnce(new Error("timeout"))
		expect(await getModels(opts)).toEqual(live)
	})

	it("accepts a legacy flat anthropic_models.json for any credentials", async () => {
		disk.exists = true
		disk.content = JSON.stringify(live)
		await ensureAnthropicLastGoodSeeded()
		expect(getLastGoodAnthropicModels("anthropic:other")).toEqual(live)
	})

	it("reads the disk file only once per process and tolerates a corrupt file", async () => {
		disk.exists = true
		disk.content = "{not json"
		await ensureAnthropicLastGoodSeeded()
		await ensureAnthropicLastGoodSeeded()
		expect(getLastGoodAnthropicModels(key)).toBeUndefined()
	})

	it("shares one in-flight fetch between concurrent callers", async () => {
		let resolve!: (v: any) => void
		getAnthropicModels.mockReturnValueOnce(new Promise((r) => (resolve = r)))
		const a = getModels(opts)
		const b = getModels(opts)
		resolve(live)
		expect(await a).toBe(live)
		expect(await b).toBe(live)
		expect(getAnthropicModels).toHaveBeenCalledTimes(1)
	})

	it("has no last-good list for unknown credentials", () => {
		expect(getLastGoodAnthropicModels("anthropic:nope")).toBeUndefined()
	})
})

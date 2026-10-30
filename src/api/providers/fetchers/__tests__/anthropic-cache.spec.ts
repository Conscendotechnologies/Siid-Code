import axios from "axios"
import { vi, describe, it, expect, beforeEach } from "vitest"

vi.mock("axios")
vi.mock("../../../../core/config/ContextProxy", () => ({
	ContextProxy: { instance: { globalStorageUri: { fsPath: "/tmp/siid-test" } } },
}))
vi.mock("../../../../utils/storage", () => ({ getCacheDirectoryPath: vi.fn().mockResolvedValue("/tmp/siid-test") }))
vi.mock("../../../../utils/safeWriteJson", () => ({ safeWriteJson: vi.fn().mockResolvedValue(undefined) }))

import { getModels } from "../modelCache"

const mockGet = vi.mocked(axios.get)

describe("getModels(anthropic) fallback", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.spyOn(console, "warn").mockImplementation(() => {})
	})

	it("returns the bundled list with no key and makes no request", async () => {
		const models = await getModels({ provider: "anthropic" })
		expect(models["claude-sonnet-4-20250514"]).toBeDefined()
		expect(mockGet).not.toHaveBeenCalled()
	})

	it("falls back on network failure without leaking the key", async () => {
		mockGet.mockRejectedValue(new Error("boom sk-ant-abcdef123"))
		const models = await getModels({ provider: "anthropic", apiKey: "sk-ant-abcdef123" })
		expect(models["claude-3-haiku-20240307"]).toBeDefined()
		expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("abcdef123")
	})

	it("caches a successful live list per key", async () => {
		mockGet.mockResolvedValue({ status: 200, data: { data: [{ id: "claude-live-1" }], has_more: false } })
		const a = await getModels({ provider: "anthropic", apiKey: "key-a" })
		await getModels({ provider: "anthropic", apiKey: "key-a" })
		expect(Object.keys(a)).toEqual(["claude-live-1"])
		expect(mockGet).toHaveBeenCalledTimes(1)
	})
})

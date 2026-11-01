vi.mock("vscode", () => ({ ExtensionMode: { Test: 3 } }))
import { ContextProxy } from "../ContextProxy"

describe("ContextProxy.onDidChange", () => {
	const ctx: any = {
		globalState: { get: vi.fn(), update: vi.fn().mockResolvedValue(undefined), keys: () => [] },
		secrets: {
			get: vi.fn(),
			store: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined),
		},
	}

	it("notifies listeners of global state and secret writes until disposed; a throwing listener is isolated", async () => {
		const proxy = new ContextProxy(ctx)
		const seen: string[] = []
		const sub = proxy.onDidChange((k) => seen.push(k))
		proxy.onDidChange(() => {
			throw new Error("bad listener")
		})
		await proxy.setValue("mode", "code" as any)
		await proxy.setValue("apiKey", "k")
		expect(seen).toEqual(["mode", "apiKey"])
		sub.dispose()
		await proxy.setValue("mode", "ask" as any)
		expect(seen).toHaveLength(2)
	})
})

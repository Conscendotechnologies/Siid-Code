import * as path from "path"

vi.mock("vscode", () => ({
	workspace: { workspaceFolders: [], fs: {} },
	window: {},
	commands: {},
	Uri: { file: (p: string) => ({ fsPath: p }) },
	FileType: { Directory: 2 },
	ViewColumn: { Beside: -2 },
}))

import { parsePorcelainStatus, isInsideRoot } from "../agentsMessageHandler"

describe("agentsMessageHandler", () => {
	it("parses porcelain -z output including renames and untracked", () => {
		const out = " M a.ts\0A  b.ts\0?? c.ts\0R  new.ts\0old.ts\0 D d.ts\0UU e.ts\0"
		const r = parsePorcelainStatus(out, "/r")
		expect(r.map((c) => [c.path, c.status])).toEqual([
			["a.ts", "M"],
			["b.ts", "A"],
			["c.ts", "?"],
			["new.ts", "R"],
			["d.ts", "D"],
			["e.ts", "U"],
		])
		expect(r[0].absPath).toBe(path.join("/r", "a.ts"))
	})
	it("guards paths outside the workspace", () => {
		expect(isInsideRoot("/r", "/r/x/y")).toBe(true)
		expect(isInsideRoot("/r", "/r/../etc")).toBe(false)
		expect(isInsideRoot("/r", "/other")).toBe(false)
	})
})

// Regression: "invocable_apex" was listed in TaskTypeMapping, the fetch_instructions
// tool description, and the resolver's title map - but had no case in fetchInstructions
// and no guide file, so create-invocable-apex silently loaded nothing.
//
// Guards the whole set: every instruction key a task type advertises must have a
// guide file on disk.

import * as fs from "fs"
import * as path from "path"

import { describe, it, expect } from "vitest"

import { TaskTypeMapping, GlobalFileNames } from "../../../../shared/globalFileNames"

// instructions/modes/<x>.md is provisioned from .roo/rules-<x>/ at install time.
const ROO_DIR = path.resolve(__dirname, "../../../../../.roo")

const guidePath = (relative: string) => path.join(ROO_DIR, `rules-${relative}`)

describe("task guide files", () => {
	it("ships a guide file for every GlobalFileNames entry", () => {
		const missing = Object.entries(GlobalFileNames)
			.filter(([, value]) => typeof value === "string" && value.endsWith(".md"))
			.filter(([, value]) => !fs.existsSync(guidePath(value as string)))
			.map(([key, value]) => `${key} -> ${value}`)

		expect(missing).toEqual([])
	})

	it("resolves invocable_apex, which create-invocable-apex depends on", () => {
		expect(TaskTypeMapping["create-invocable-apex"].instructions).toContain("invocable_apex")
		expect(fs.existsSync(guidePath(GlobalFileNames.invocableApexInstructions))).toBe(true)
	})
})

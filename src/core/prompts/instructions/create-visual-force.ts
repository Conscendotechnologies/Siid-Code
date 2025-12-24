import * as path from "path"
import * as vscode from "vscode"
import * as fs from "fs/promises"

import { GlobalFileNames } from "../../../shared/globalFileNames"
import { findSection, getGuideSummary } from "./markdown-parser"

export async function createVisualForceInstructions(
	context: vscode.ExtensionContext | undefined,
	section?: string,
): Promise<string> {
	console.log("[VISUAL FORCE] Fetching Visual Force instructions...")
	if (!context) throw new Error("Missing VSCode Extension Context")

	// Get the global storage URI path
	const settingsDir = path.join(context.globalStorageUri.fsPath, "instructions/modes")
	const visualForceInstructionsPath = path.join(settingsDir, GlobalFileNames.visualForceInstructions)
	console.log(`[VISUAL FORCE] Instructions path: ${visualForceInstructionsPath}`)

	// Try to read custom instructions from the file
	try {
		const customInstructions = await fs.readFile(visualForceInstructionsPath, "utf-8")
		console.log(
			`[VISUAL FORCE] Successfully loaded Visual Force instructions (${customInstructions.length} characters)`,
		)
		if (!customInstructions.trim()) {
			throw new Error(`Visual Force instructions file at '${visualForceInstructionsPath}' is empty.`)
		}

		// If no section specified, return full guide with XML and deployment instructions
		if (!section) {
			console.log("[VISUAL FORCE] Returning full Visual Force guide")
			return customInstructions
		}

		// Try to find the requested section
		console.log(`[VISUAL FORCE] Searching for section: '${section}'`)
		const sectionResult = findSection(customInstructions, section)

		if (sectionResult) {
			console.log(`[VISUAL FORCE] Found section: '${sectionResult.title}'`)
			return `# ${sectionResult.title}\n\n${sectionResult.content}`
		}

		// Section not found - return helpful error with TOC
		console.warn(`[VISUAL FORCE] Section '${section}' not found, returning table of contents`)
		const summary = getGuideSummary(customInstructions, "Visual Force")
		return `Section "${section}" not found in Visual Force guide.\n\n${summary}`
	} catch (error) {
		// File doesn't exist or can't be read
		console.error("[VISUAL FORCE] Error loading Visual Force instructions:", error)
		if (error instanceof Error && error.message.includes("is empty")) {
			throw error
		}
		throw new Error(`Visual Force instructions file not found at '${visualForceInstructionsPath}'.`)
	}
}

import * as path from "path"
import * as vscode from "vscode"
import * as fs from "fs/promises"

import { GlobalFileNames } from "../../../shared/globalFileNames"
import { findSection, getGuideSummary } from "./markdown-parser"

export async function createAuraComponentsInstructions(
	context: vscode.ExtensionContext | undefined,
	section?: string,
): Promise<string> {
	console.log("[AURA COMPONENTS] Fetching Aura Components instructions...")
	if (!context) throw new Error("Missing VSCode Extension Context")

	// Get the global storage URI path
	const settingsDir = path.join(context.globalStorageUri.fsPath, "instructions/modes")
	const auraComponentsInstructionsPath = path.join(settingsDir, GlobalFileNames.auraComponentsInstructions)
	console.log(`[AURA COMPONENTS] Instructions path: ${auraComponentsInstructionsPath}`)

	// Try to read custom instructions from the file
	try {
		const customInstructions = await fs.readFile(auraComponentsInstructionsPath, "utf-8")
		console.log(
			`[AURA COMPONENTS] Successfully loaded Aura Components instructions (${customInstructions.length} characters)`,
		)
		if (!customInstructions.trim()) {
			throw new Error(`Aura Components instructions file at '${auraComponentsInstructionsPath}' is empty.`)
		}

		// If no section specified, return full guide with XML and deployment instructions
		if (!section) {
			console.log("[AURA COMPONENTS] Returning full Aura Components guide")
			return customInstructions
		}

		// Try to find the requested section
		console.log(`[AURA COMPONENTS] Searching for section: '${section}'`)
		const sectionResult = findSection(customInstructions, section)

		if (sectionResult) {
			console.log(`[AURA COMPONENTS] Found section: '${sectionResult.title}'`)
			return `# ${sectionResult.title}\n\n${sectionResult.content}`
		}

		// Section not found - return helpful error with TOC
		console.warn(`[AURA COMPONENTS] Section '${section}' not found, returning table of contents`)
		const summary = getGuideSummary(customInstructions, "Aura Components")
		return `Section "${section}" not found in Aura Components guide.\n\n${summary}`
	} catch (error) {
		// File doesn't exist or can't be read
		console.error(`[AURA COMPONENTS] Error reading Aura Components instructions:`, error)
		throw new Error(
			`Failed to load Aura Components instructions. Please ensure the file exists at ${auraComponentsInstructionsPath}`,
		)
	}
}

import * as path from "path"
import * as vscode from "vscode"
import * as fs from "fs/promises"

import { GlobalFileNames } from "../../../shared/globalFileNames"
import { findSection, getGuideSummary } from "./markdown-parser"

export async function createLWCInstructions(
	context: vscode.ExtensionContext | undefined,
	section?: string,
): Promise<string> {
	if (!context) throw new Error("Missing VSCode Extension Context")

	// Get the global storage URI path
	const settingsDir = path.join(context.globalStorageUri.fsPath, "instructions/modes")
	const lwcInstructionsPath = path.join(settingsDir, GlobalFileNames.lwcInstructions)

	// Try to read custom instructions from the file
	try {
		const customInstructions = await fs.readFile(lwcInstructionsPath, "utf-8")
		if (!customInstructions.trim()) {
			throw new Error(`LWC instructions file at '${lwcInstructionsPath}' is empty.`)
		}

		// If no section specified, return full guide with XML meta and deployment instructions
		if (!section) {
			return customInstructions
		}

		// Try to find the requested section
		const sectionResult = findSection(customInstructions, section)

		if (sectionResult) {
			return `# ${sectionResult.title}\n\n${sectionResult.content}`
		}

		// Section not found - return helpful error with TOC
		const summary = getGuideSummary(customInstructions, "Lightning Web Components (LWC)")
		return `Section "${section}" not found in LWC guide.\n\n${summary}`
	} catch (error) {
		// File doesn't exist or can't be read
		if (error instanceof Error && error.message.includes("is empty")) {
			throw error
		}
		throw new Error(`LWC instructions file not found at '${lwcInstructionsPath}'.`)
	}
}

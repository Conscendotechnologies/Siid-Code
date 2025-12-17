import * as path from "path"
import * as vscode from "vscode"
import * as fs from "fs/promises"

import { GlobalFileNames } from "../../../shared/globalFileNames"
import { findSection, getGuideSummary } from "./markdown-parser"

export async function createApexInstructions(
	context: vscode.ExtensionContext | undefined,
	section?: string,
): Promise<string> {
	if (!context) throw new Error("Missing VSCode Extension Context")

	// Get the global storage URI path
	const settingsDir = path.join(context.globalStorageUri.fsPath, "instructions/modes")
	const apexInstructionsPath = path.join(settingsDir, GlobalFileNames.apexInstructions)

	// Try to read custom instructions from the file
	try {
		const customInstructions = await fs.readFile(apexInstructionsPath, "utf-8")
		if (!customInstructions.trim()) {
			throw new Error(`Apex instructions file at '${apexInstructionsPath}' is empty.`)
		}

		// If no section specified, return full guide with XML and deployment instructions
		if (!section) {
			return customInstructions
		}

		// Try to find the requested section
		const sectionResult = findSection(customInstructions, section)

		if (sectionResult) {
			return `# ${sectionResult.title}\n\n${sectionResult.content}`
		}

		// Section not found - return helpful error with TOC
		const summary = getGuideSummary(customInstructions, "Apex")
		return `Section "${section}" not found in Apex guide.\n\n${summary}`
	} catch (error) {
		// File doesn't exist or can't be read
		if (error instanceof Error && error.message.includes("is empty")) {
			throw error
		}
		throw new Error(`Apex instructions file not found at '${apexInstructionsPath}'.`)
	}
}

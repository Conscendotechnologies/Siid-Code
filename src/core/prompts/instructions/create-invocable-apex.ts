import * as path from "path"
import * as vscode from "vscode"
import * as fs from "fs/promises"

import { GlobalFileNames } from "../../../shared/globalFileNames"
import { findSection, getGuideSummary } from "./markdown-parser"

export async function createInvocableApexInstructions(
	context: vscode.ExtensionContext | undefined,
	section?: string,
): Promise<string> {
	if (!context) throw new Error("Missing VSCode Extension Context")

	const settingsDir = path.join(context.globalStorageUri.fsPath, "instructions/modes")
	const invocableApexInstructionsPath = path.join(settingsDir, GlobalFileNames.invocableApexInstructions)

	try {
		const customInstructions = await fs.readFile(invocableApexInstructionsPath, "utf-8")
		if (!customInstructions.trim()) {
			throw new Error(`Invocable Apex instructions file at '${invocableApexInstructionsPath}' is empty.`)
		}

		if (!section) {
			return customInstructions
		}

		const sectionResult = findSection(customInstructions, section)

		if (sectionResult) {
			return `# ${sectionResult.title}\n\n${sectionResult.content}`
		}

		const summary = getGuideSummary(customInstructions, "Invocable Apex")
		return `Section "${section}" not found in Invocable Apex guide.\n\n${summary}`
	} catch (error) {
		if (error instanceof Error && error.message.includes("is empty")) {
			throw error
		}
		throw new Error(`Invocable Apex instructions file not found at '${invocableApexInstructionsPath}'.`)
	}
}

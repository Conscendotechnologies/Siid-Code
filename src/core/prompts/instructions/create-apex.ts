import * as path from "path"
import * as vscode from "vscode"
import * as fs from "fs/promises"

import { GlobalFileNames } from "../../../shared/globalFileNames"

export async function createApexInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	if (!context) throw new Error("Missing VSCode Extension Context")

	// Get the global storage URI path
	const settingsDir = path.join(context.globalStorageUri.fsPath, "instructions/modes")
	const apexInstructionsPath = path.join(settingsDir, GlobalFileNames.apexInstructions)

	// Try to read custom instructions from the file
	try {
		const customInstructions = await fs.readFile(apexInstructionsPath, "utf-8")
		if (customInstructions.trim()) {
			return customInstructions
		}
	} catch (error) {
		// File doesn't exist or can't be read
		throw new Error(`Apex instructions file not found at '${apexInstructionsPath}'.`)
	}

	// If file exists but is empty
	throw new Error(`Apex instructions file at '${apexInstructionsPath}' is empty.`)
}

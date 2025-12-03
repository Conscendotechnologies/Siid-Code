import * as path from "path"
import * as vscode from "vscode"
import * as fs from "fs/promises"

import { GlobalFileNames } from "../../../shared/globalFileNames"

export async function createLWCInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	if (!context) throw new Error("Missing VSCode Extension Context")

	// Get the global storage URI path
	const settingsDir = path.join(context.globalStorageUri.fsPath, "instructions/modes")
	const lwcInstructionsPath = path.join(settingsDir, GlobalFileNames.lwcInstructions)

	// Try to read custom instructions from the file
	try {
		const customInstructions = await fs.readFile(lwcInstructionsPath, "utf-8")
		if (customInstructions.trim()) {
			return customInstructions
		}
	} catch (error) {
		// File doesn't exist or can't be read
		throw new Error(`LWC instructions file not found at '${lwcInstructionsPath}'.`)
	}

	// Return empty string if file exists but is empty
	throw new Error(`LWC instructions file at '${lwcInstructionsPath}' is empty.`)
}

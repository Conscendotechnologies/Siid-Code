import * as path from "path"
import * as vscode from "vscode"
import * as fs from "fs/promises"

import { GlobalFileNames } from "../../../shared/globalFileNames"

export async function createDeploymentInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	if (!context) throw new Error("Missing VSCode Extension Context")

	// Get the global storage URI path
	const settingsDir = path.join(context.globalStorageUri.fsPath, "instructions/modes")
	const deploymentInstructionsPath = path.join(settingsDir, GlobalFileNames.deploymentInstructions)

	// Try to read deployment instructions from the file
	try {
		const customInstructions = await fs.readFile(deploymentInstructionsPath, "utf-8")
		if (!customInstructions.trim()) {
			throw new Error(`Deployment instructions file at '${deploymentInstructionsPath}' is empty.`)
		}

		return customInstructions
	} catch (error) {
		// File doesn't exist or can't be read
		if (error instanceof Error && error.message.includes("is empty")) {
			throw error
		}
		throw new Error(`Deployment instructions file not found at '${deploymentInstructionsPath}'.`)
	}
}

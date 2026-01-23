import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { GlobalFileNames } from "../../../shared/globalFileNames"

/**
 * Loads Salesforce-specific instructions from the global storage
 * @param context - VSCode extension context
 * @param instructionFilePath - Path to the instruction file (from GlobalFileNames)
 * @returns The instruction content or throws an error
 */
async function loadCodeInstruction(
	context: vscode.ExtensionContext | undefined,
	instructionFilePath: string,
): Promise<string> {
	if (!context) {
		throw new Error("Extension context is not available.")
	}

	const instructionPath = path.join(context.globalStorageUri.fsPath, "instructions/modes/", instructionFilePath)

	try {
		const content = await fs.readFile(instructionPath, "utf-8")
		if (content.trim()) {
			return content.trim()
		}
		throw new Error(`Instruction file at '${instructionPath}' is empty.`)
	} catch (error) {
		console.error(`Error reading instruction file ${instructionFilePath}:`, error)
		throw new Error(
			`Could not load instructions from '${instructionPath}'. Please ensure the instruction files are properly installed.`,
		)
	}
}

/**
 * Loads Invocable Apex instructions
 */
export async function invocableApexInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadCodeInstruction(context, GlobalFileNames.invocableapexInstructions)
}

/**
 * Loads Adaptive Response Agent instructions
 */
export async function adaptiveResponseAgentInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadCodeInstruction(context, GlobalFileNames.adaptiveResponseAgentInstructions)
}

/**
 * Loads Adaptive Response Agent Workflow instructions
 */
export async function adaptiveResponseAgentWorkflow(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadCodeInstruction(context, GlobalFileNames.adaptiveResponseAgentWorkflow)
}

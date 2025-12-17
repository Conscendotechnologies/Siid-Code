import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { GlobalFileNames } from "../../../shared/globalFileNames"

/**
 * Loads Flow Builder-specific instructions from the global storage
 * @param context - VSCode extension context
 * @param instructionFilePath - Path to the instruction file (from GlobalFileNames)
 * @returns The instruction content or throws an error
 */
async function loadFlowBuilderInstruction(
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
 * Loads Screen Flow Patterns instructions
 */
export async function screenFlowPatternsInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadFlowBuilderInstruction(context, GlobalFileNames.screenFlowPatternsInstructions)
}

/**
 * Loads Record-Triggered Flow Patterns instructions
 */
export async function recordTriggerFlowPatternsInstructions(
	context: vscode.ExtensionContext | undefined,
): Promise<string> {
	return loadFlowBuilderInstruction(context, GlobalFileNames.recordTriggerFlowPatternsInstructions)
}

/**
 * Loads Detailed Workflow instructions
 */
export async function detailedWorkflowInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadFlowBuilderInstruction(context, GlobalFileNames.detailedWorkflowInstructions)
}

/**
 * Loads Quick Reference instructions
 */
export async function quickReferenceInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadFlowBuilderInstruction(context, GlobalFileNames.quickReferenceInstructions)
}

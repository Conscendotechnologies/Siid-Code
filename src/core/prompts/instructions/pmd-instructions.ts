import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { GlobalFileNames } from "../../../shared/globalFileNames"

/**
 * Loads PMD-specific instructions from the global storage
 * @param context - VSCode extension context
 * @param instructionFilePath - Path to the instruction file (from GlobalFileNames)
 * @returns The instruction content or throws an error
 */
async function loadPmdInstruction(
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
 * Loads PMD Apex Rules instructions
 */
export async function pmdApexInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadPmdInstruction(context, GlobalFileNames.pmdApexInstructions)
}

/**
 * Loads PMD HTML Rules instructions
 */
export async function pmdHtmlInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadPmdInstruction(context, GlobalFileNames.pmdHtmlInstructions)
}

/**
 * Loads PMD JavaScript Rules instructions
 */
export async function pmdJavaScriptInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadPmdInstruction(context, GlobalFileNames.pmdJavaScriptInstructions)
}

/**
 * Loads PMD Visualforce Rules instructions
 */
export async function pmdVisualforceInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadPmdInstruction(context, GlobalFileNames.pmdVisualforceInstructions)
}

/**
 * Loads PMD XML Rules instructions
 */
export async function pmdXmlInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadPmdInstruction(context, GlobalFileNames.pmdXmlInstructions)
}

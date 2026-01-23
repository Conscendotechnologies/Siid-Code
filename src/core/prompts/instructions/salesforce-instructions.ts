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
async function loadSalesforceInstruction(
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
 * Loads Agentforce Agent Creation Workflow instructions
 */
export async function agentforceAgentInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadSalesforceInstruction(context, GlobalFileNames.agentforceAgentInstructions)
}

/**
 * Loads Agentforce Agent Analysis Workflow instructions
 */
export async function agentforceAnalyseInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadSalesforceInstruction(context, GlobalFileNames.agentforceAnalyseInstructions)
}

/**
 * Loads Agentforce Topic Analysis Workflow instructions
 */
export async function agentforceTopicAnalyseInstructions(
	context: vscode.ExtensionContext | undefined,
): Promise<string> {
	return loadSalesforceInstruction(context, GlobalFileNames.agentforceTopicAnalyseInstructions)
}

/**
 * Loads Assignment Rules instructions
 */
export async function assignmentRulesInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadSalesforceInstruction(context, GlobalFileNames.assignmentRulesInstructions)
}

/**
 * Loads Custom Field instructions
 */
export async function customFieldInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadSalesforceInstruction(context, GlobalFileNames.customFieldInstructions)
}

/**
 * Loads Custom Object instructions
 */
export async function customObjectInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadSalesforceInstruction(context, GlobalFileNames.customObjectInstructions)
}

/**
 * Loads Field Permissions instructions
 */
export async function fieldPermissionsInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadSalesforceInstruction(context, GlobalFileNames.fieldPermissionsInstructions)
}

/**
 * Loads Object Permissions instructions
 */
export async function objectPermissionsInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadSalesforceInstruction(context, GlobalFileNames.objectPermissionsInstructions)
}

/**
 * Loads Path Creation instructions
 */
export async function pathCreationInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadSalesforceInstruction(context, GlobalFileNames.pathCreationInstructions)
}

/**
 * Loads Profile instructions
 */
export async function profileInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadSalesforceInstruction(context, GlobalFileNames.profileInstructions)
}

/**
 * Loads Record Types instructions
 */
export async function recordTypesInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadSalesforceInstruction(context, GlobalFileNames.recordTypesInstructions)
}

/**
 * Loads Role Creation instructions
 */
export async function roleCreationInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadSalesforceInstruction(context, GlobalFileNames.roleCreationInstructions)
}

/**
 * Loads Validation Rules instructions
 */
export async function validationRulesInstructions(context: vscode.ExtensionContext | undefined): Promise<string> {
	return loadSalesforceInstruction(context, GlobalFileNames.validationRulesInstructions)
}

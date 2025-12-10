import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { extractTableOfContents, findSection, getGuideSummary } from "./markdown-parser"

/**
 * Creates Salesforce deployment and retrieval instructions
 * Supports section-based retrieval for token optimization
 */
export async function createSalesforceDeploymentInstructions(
	context: vscode.ExtensionContext | undefined,
	section?: string,
): Promise<string> {
	const customInstructionsPath = context
		? path.join(context.extensionPath, ".roo", "rules-code", "salesforce-deployment-guide.md")
		: path.join(process.cwd(), ".roo", "rules-code", "salesforce-deployment-guide.md")

	let customInstructions: string
	try {
		customInstructions = await fs.readFile(customInstructionsPath, "utf-8")
	} catch (error) {
		return `# Salesforce Deployment & Retrieval Guide

Error: Could not load deployment guide from ${customInstructionsPath}

Please ensure the salesforce-deployment-guide.md file exists in the .roo/rules-code/ directory.`
	}

	// If no section specified, return full deployment guide (critical information)
	if (!section) {
		return customInstructions
	}

	// Try to find the requested section
	const sectionResult = findSection(customInstructions, section)

	if (sectionResult) {
		return `# ${sectionResult.title}\n\n${sectionResult.content}`
	}

	// Section not found - return helpful error with TOC
	const toc = extractTableOfContents(customInstructions)
	return `# Section Not Found

The section "${section}" was not found in the Salesforce Deployment & Retrieval Guide.

${toc.summary}

Please use one of the section numbers or titles listed above, or omit the section parameter to get the full guide summary.`
}

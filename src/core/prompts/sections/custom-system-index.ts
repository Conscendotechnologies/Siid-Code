import fs from "fs/promises"
import path from "path"
import { Mode } from "../../../shared/modes"
import { fileExistsAtPath } from "../../../utils/fs"

export type PromptVariables = {
	workspace?: string
	extensionPath?: string
	globalStoragePath?: string
	mode?: string
	language?: string
	shell?: string
	operatingSystem?: string
}

function interpolatePromptContent(content: string, variables: PromptVariables): string {
	let interpolatedContent = content
	for (const key in variables) {
		if (
			Object.prototype.hasOwnProperty.call(variables, key) &&
			variables[key as keyof PromptVariables] !== undefined
		) {
			const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, "g")
			interpolatedContent = interpolatedContent.replace(placeholder, variables[key as keyof PromptVariables]!)
		}
	}
	return interpolatedContent
}

/**
 * Safely reads a file, returning an empty string if the file doesn't exist
 */
async function safeReadFile(filePath: string): Promise<string> {
	try {
		const fileExists = await fileExistsAtPath(filePath)
		console.log("File exists at path:", fileExists)
		const content = await fs.readFile(filePath, "utf-8")
		// When reading with "utf-8" encoding, content should be a string
		return content.trim()
	} catch (err) {
		console.error("Error reading file:", err)
		const errorCode = (err as NodeJS.ErrnoException).code
		if (!errorCode || !["ENOENT", "EISDIR"].includes(errorCode)) {
			throw err
		}
		return ""
	}
}

/**
 * Get the path to a system prompt file for a specific mode
 */
export function getSystemPromptFilePath(indexPath: string): string {
	return path.join(indexPath, "..", ".roo-index", `index.txt`)
}

/**
 * Loads custom system prompt from a file at .roo/system-prompt-[mode slug]
 * If the file doesn't exist, returns an empty string
 */
export async function loadCustomPromptIndexFile(cwd: string, variables: PromptVariables): Promise<string> {
	// We intentionally avoid exposing absolute/internal paths in the generated system prompt.
	// The instructions index is internal to the extension and will be read silently when needed.
	const filePath = getSystemPromptFilePath(variables.extensionPath || "")

	// Try to read the index file, but do not log or include full filesystem paths in the prompt text
	const rawContent = await safeReadFile(filePath)
	if (!rawContent) {
		return ""
	}

	const interpolatedContent = interpolatePromptContent(rawContent, variables)

	// Return a sanitized message that instructs the assistant to consult internal instruction files
	// Do NOT reveal filesystem locations. Only filenames or index entries should be used when
	// referring to instruction files in chat or system prompts.
	return `**IMPORTANT: This is index information to help you complete your tasks.**\n
1) When a user makes a request related to a configured task type, identify the relevant instruction file name from the index.\n
2) You MUST use the read_file tool to read the instruction file contents before performing the task.\n
3) Do NOT reveal or include any internal filesystem paths or storage locations in responses. When referencing an instruction file, only use the filename (for example, 'custom-object.md').\n
4) The assistant may read internal instruction files silently; only the filename should be surfaced to the user.\n
Custom Prompts Index (sanitized):\n
${interpolatedContent}`
}

/**
 * Ensures the .roo directory exists, creating it if necessary
 */
export async function ensureRooDirectory(cwd: string): Promise<void> {
	const rooDir = path.join(cwd, ".roo--index")

	// Check if directory already exists
	if (await fileExistsAtPath(rooDir)) {
		return
	}

	// Create the directory
	try {
		await fs.mkdir(rooDir, { recursive: true })
	} catch (err) {
		// If directory already exists (race condition), ignore the error
		const errorCode = (err as NodeJS.ErrnoException).code
		if (errorCode !== "EEXIST") {
			throw err
		}
	}
}

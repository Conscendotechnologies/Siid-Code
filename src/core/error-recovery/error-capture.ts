/**
 * Error Capture and Knowledge Base Engine
 * Captures deployment errors and matches them against knowledge bases
 */

import * as fs from "fs"
import * as path from "path"
import * as YAML from "yaml"
import type { ErrorContext, KBError, KnowledgeBase, CapturedError } from "./types/error-types"

/**
 * ErrorCapture - Handles error detection and knowledge base matching
 */
export class ErrorCapture {
	private defaultKB: KBError[] = []
	private userKB: KBError[] = []
	private projectRoot: string
	private globalStoragePath?: string

	/**
	 * Initialize error capture system with project root
	 * Loads both default and user knowledge bases
	 */
	constructor(projectRoot: string, globalStoragePath?: string) {
		this.projectRoot = projectRoot
		this.globalStoragePath = globalStoragePath
		this.loadKnowledgeBases()
	}

	/**
	 * Load both default and user knowledge bases
	 * User KB is loaded first and takes priority in search
	 */
	private loadKnowledgeBases(): void {
		console.log(`[ErrorCapture] Loading knowledge bases from: ${this.projectRoot}`)

		// Load user KB first (takes priority)
		const userPath = path.join(this.projectRoot, "error-knowledge-base/custom-errors.yaml")
		if (fs.existsSync(userPath)) {
			try {
				const content = fs.readFileSync(userPath, "utf-8")
				const data = YAML.parse(content) as KnowledgeBase | KBError[]
				this.userKB = Array.isArray(data) ? data : data.errors || []
				console.log(
					`[ErrorCapture] ✅ Loaded user knowledge base: ${this.userKB.length} errors from ${userPath}`,
				)
			} catch (error) {
				console.warn(`[ErrorCapture] ⚠️ Failed to load user KB from ${userPath}: ${error}`)
			}
		} else {
			console.log(`[ErrorCapture] ℹ️ No user KB found at ${userPath} (optional)`)
		}

		// Load default KB with compatibility fallback paths
		const defaultPathCandidates = [
			...(this.globalStoragePath
				? [path.join(this.globalStoragePath, "error-knowledge-base/agentforce-errors.yaml")]
				: []),
			path.join(this.projectRoot, ".siid/error-knowledge-base/agentforce-errors.yaml"),
			path.join(this.projectRoot, ".roo/error-knowledge-base/agentforce-errors.yaml"),
			path.join(__dirname, "../../bundled/error-knowledge-base/agentforce-errors.yaml"),
		]
		const defaultPath = defaultPathCandidates.find((candidate) => fs.existsSync(candidate))
		if (defaultPath) {
			try {
				const content = fs.readFileSync(defaultPath, "utf-8")
				const data = YAML.parse(content) as KnowledgeBase | KBError[]
				this.defaultKB = Array.isArray(data) ? data : data.errors || []
				console.log(
					`[ErrorCapture] ✅ Loaded default knowledge base: ${this.defaultKB.length} errors from ${defaultPath}`,
				)
			} catch (error) {
				console.error(`[ErrorCapture] ❌ Failed to load default KB from ${defaultPath}: ${error}`)
			}
		} else {
			console.warn(`[ErrorCapture] ⚠️ Default KB not found. Checked: ${defaultPathCandidates.join(", ")}`)
		}

		console.log(
			`[ErrorCapture] Total errors loaded - User: ${this.userKB.length}, Default: ${this.defaultKB.length}`,
		)
	}

	/**
	 * Reload knowledge bases from disk.
	 */
	public reloadKnowledgeBases(): void {
		this.loadKnowledgeBases()
	}

	/**
	 * Find matching error from knowledge bases
	 * Searches user KB first (priority), then default KB
	 *
	 * Matching logic: ALL keywords in the pattern must be found in the error output
	 * (case-insensitive)
	 */
	public findMatchingError(errorOutput: string): ErrorContext | null {
		console.log(`[ErrorCapture] Searching for matching error in knowledge bases...`)

		// Search user KB first (priority)
		const userMatch = this.searchKB(this.userKB, errorOutput)
		if (userMatch) {
			console.log(`[ErrorCapture] ✅ Found match in user KB: ${userMatch.id}`)
			return this.buildErrorContext(userMatch, errorOutput, "user")
		}

		// Search default KB
		const defaultMatch = this.searchKB(this.defaultKB, errorOutput)
		if (defaultMatch) {
			console.log(`[ErrorCapture] ✅ Found match in default KB: ${defaultMatch.id}`)
			return this.buildErrorContext(defaultMatch, errorOutput, "default")
		}

		console.log(`[ErrorCapture] ⚠️ No matching error found in knowledge bases`)
		return null
	}

	/**
	 * Search a single knowledge base for matching error
	 * Returns first error where ALL keywords match
	 */
	private searchKB(kb: KBError[], errorOutput: string): KBError | null {
		for (const error of kb) {
			const allKeywordsMatch = error.errorPattern.keywords.every((keyword) => {
				const regex = new RegExp(keyword, "i") // case-insensitive
				return regex.test(errorOutput)
			})

			if (allKeywordsMatch) {
				return error
			}
		}
		return null
	}

	/**
	 * Build error context from KB entry and error output
	 */
	private buildErrorContext(kbError: KBError, errorOutput: string, source: "default" | "user"): ErrorContext {
		// Extract first 200 chars of error message
		const errorMessage = errorOutput.substring(0, 200).replace(/\n/g, " ")

		return {
			errorId: kbError.id,
			errorMessage,
			description: kbError.description,
			solution: kbError.solution,
			affectedFile: kbError.affectedFile,
			rawOutput: errorOutput,
			knowledgeBaseSource: source,
		}
	}

	/**
	 * Build formatted message for AI with error details and solution
	 */
	public buildAIMessage(error: ErrorContext): string {
		const separator = "━".repeat(50)

		let message = `\n🔴 DEPLOYMENT ERROR DETECTED\n${separator}\n\n`

		message += `Error ID: ${error.errorId}\n`
		message += `Knowledge Base: ${error.knowledgeBaseSource}\n\n`

		message += `📋 Error Description:\n${error.description}\n\n`

		message += `⚠️ Error Message:\n${error.errorMessage}\n\n`

		message += `💡 Solution:\n${error.solution}\n\n`

		if (error.affectedFile) {
			message += `📁 Affected File: ${error.affectedFile}\n\n`
		}

		message += `${separator}\n\n`
		message +=
			`Please analyze this error and apply the solution.\n` + `After fixing, the deployment will be retried.\n`

		return message
	}

	/**
	 * Capture and process deployment error
	 * Returns structured error context if found, null otherwise
	 */
	public captureError(errorOutput: string): CapturedError {
		if (!errorOutput || errorOutput.trim().length === 0) {
			return { found: false }
		}

		const error = this.findMatchingError(errorOutput)

		if (error) {
			return {
				found: true,
				context: error,
			}
		}

		return {
			found: false,
			rawError: errorOutput,
		}
	}

	/**
	 * Get knowledge base statistics (useful for debugging)
	 */
	public getStats(): { defaultKB: number; userKB: number; total: number } {
		return {
			defaultKB: this.defaultKB.length,
			userKB: this.userKB.length,
			total: this.defaultKB.length + this.userKB.length,
		}
	}
}

/**
 * Singleton instance of ErrorCapture
 */
let errorCaptureInstance: ErrorCapture | null = null
let errorCaptureInstanceConfig: { projectRoot: string; globalStoragePath?: string } | null = null

/**
 * Get or create ErrorCapture instance
 */
export function getErrorCapture(projectRoot: string, globalStoragePath?: string): ErrorCapture {
	if (
		!errorCaptureInstance ||
		!errorCaptureInstanceConfig ||
		errorCaptureInstanceConfig.projectRoot !== projectRoot ||
		errorCaptureInstanceConfig.globalStoragePath !== globalStoragePath
	) {
		errorCaptureInstance = new ErrorCapture(projectRoot, globalStoragePath)
		errorCaptureInstanceConfig = { projectRoot, globalStoragePath }
	} else {
		// Reload KBs so runtime edits to YAML files are picked up without restart.
		errorCaptureInstance.reloadKnowledgeBases()
	}
	return errorCaptureInstance
}

/**
 * Reset singleton (useful for testing)
 */
export function resetErrorCapture(): void {
	errorCaptureInstance = null
	errorCaptureInstanceConfig = null
}

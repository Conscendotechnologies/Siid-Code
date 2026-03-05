/**
 * Error Recovery System Types
 * Defines interfaces for error capture, knowledge base, and recovery flow
 */

/**
 * Pattern matching configuration for error detection
 */
export interface ErrorPattern {
	keywords: string[]
}

/**
 * Knowledge base error entry
 */
export interface KBError {
	id: string
	errorPattern: ErrorPattern
	description: string
	solution: string
	affectedFile?: string
}

/**
 * Knowledge base structure
 */
export interface KnowledgeBase {
	errors: KBError[]
}

/**
 * Error context after matching with KB
 */
export interface ErrorContext {
	errorId: string
	errorMessage: string
	description: string
	solution: string
	affectedFile?: string
	rawOutput: string
	knowledgeBaseSource: "default" | "user"
}

/**
 * Error capture result
 */
export interface CapturedError {
	found: boolean
	context?: ErrorContext
	rawError?: string
}

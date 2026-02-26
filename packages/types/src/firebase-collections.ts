/**
 * Firebase Collections Type Definitions
 *
 * This file defines TypeScript interfaces for Firebase collections used
 * to track user evolution/progress and activity logs.
 */

/**
 * Evolution Data - Tracks user progress and usage statistics
 * Stored at: evolutionData/{userId}
 */
export interface EvolutionData {
	/** Total number of completed tasks */
	totalTasksCompleted: number

	/** Total tokens consumed across all tasks */
	totalTokensUsed: number

	/** ISO timestamp of account creation */
	accountCreatedAt: string

	/** ISO timestamp of last activity */
	lastActiveAt: string

	/** Current user tier */
	tier: "Free" | "Pro" | "Max"

	/** Task input */
	taskInput: string
}

/**
 * Log Entry - Individual activity log entry
 * Stored at: siid-code-logs/{userId}/logs/{autoId}
 */
export interface LogEntry {
	/** ISO timestamp (auto-generated) */
	timestamp: string

	/** Event category/type */
	eventType: LogEventType

	/** Flexible JSON data for event-specific information */
	data: Record<string, any>

	/** Optional session identifier */
	sessionId?: string

	/** User tier at time of event */
	tier?: "Free" | "Pro" | "Max"

	/** Extension version */
	version?: string
}

/**
 * Supported log event types
 */
export type LogEventType = "task_completed" | "task_failed" | "task_aborted" | "error_occurred"

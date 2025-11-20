import * as vscode from "vscode"

/**
 * Performance logging utility with enable/disable toggle
 *
 * USAGE:
 * 1. Enable via VS Code Settings: SIID Code > Enable Performance Logs
 * 2. Or set directly: Settings > siid-code.enablePerformanceLogs
 * 3. Toggle on to see detailed timing logs, off for production
 *
 * EXAMPLES:
 * ```ts
 * import { perfLog, perfTimer } from './utils/performanceLogger'
 *
 * // Simple log
 * perfLog('[MyModule] Operation completed in 123ms')
 *
 * // Timer pattern
 * const timer = perfTimer('[MyModule] Heavy operation')
 * doWork()
 * timer.log() // Logs: [Performance] [MyModule] Heavy operation took 456ms
 * ```
 */

/**
 * Check if performance logging is enabled via VS Code settings
 */
function isPerformanceLoggingEnabled(): boolean {
	try {
		return vscode.workspace.getConfiguration("siid-code").get<boolean>("enablePerformanceLogs", false)
	} catch {
		// If we can't read the setting (e.g., during early initialization), default to false
		return false
	}
}

/**
 * Log performance timing (only if enabled in settings)
 */
export function perfLog(message: string, ...args: any[]): void {
	if (isPerformanceLoggingEnabled()) {
		console.log(`[Performance] [${new Date().toISOString()}] ${message}`, ...args)
	}
}

/**
 * Log performance error (always shown)
 */
export function perfError(message: string, ...args: any[]): void {
	console.error(message, ...args)
}

/**
 * Create a performance timer
 */
export function perfTimer(label: string) {
	const start = Date.now()

	return {
		/**
		 * Log elapsed time
		 */
		log: (suffix?: string) => {
			const elapsed = Date.now() - start
			perfLog(`[Performance] ${label}${suffix ? ` ${suffix}` : ""} took ${elapsed}ms`)
			return elapsed
		},

		/**
		 * Get elapsed time without logging
		 */
		elapsed: () => Date.now() - start,
	}
}

import fs from "fs/promises"
import path from "path"
import os from "os"

/**
 * Metrics for API request timing
 */
export interface ApiTimingMetrics {
	/** Timestamp when request started */
	requestStartTime: number
	/** Time to receive first chunk of data (ms) */
	timeToFirstChunk?: number
	/** Time to receive last chunk of data (ms) */
	timeToLastChunk?: number
	/** Total time for request and response (ms) */
	totalRequestTime?: number
	/** Time spent processing data and sending to UI (ms) */
	dataProcessingTime?: number
	/** Provider name (e.g., openrouter, anthropic) */
	provider: string
	/** Model ID used */
	modelId: string
	/** Whether the request was streaming */
	isStreaming: boolean
	/** Request status (success/error) */
	status: "success" | "error"
	/** Error message if status is error */
	errorMessage?: string
	/** User request/input */
	userRequest?: string
	/** Output response from API */
	outputResponse?: string
	/** Token usage information */
	tokenUsage?: {
		inputTokens: number
		outputTokens: number
		cacheReadTokens?: number
		reasoningTokens?: number
		totalCost?: number
	}
}

/**
 * Logger for API timing metrics
 */
export class ApiMetricsLogger {
	private static logDir: string | null = null
	private static logFilePath: string | null = null

	/**
	 * Initialize the logger with log directory path
	 */
	static async initialize(customLogDir?: string): Promise<void> {
		try {
			// Use custom directory or default to user's home directory
			const baseDir = customLogDir || path.join(os.homedir(), ".siid-code", "logs")
			this.logDir = path.join(baseDir, "api-metrics")

			// Create directory if it doesn't exist
			await fs.mkdir(this.logDir, { recursive: true })

			// Create log file with date stamp
			const dateStamp = new Date().toISOString().split("T")[0]
			this.logFilePath = path.join(this.logDir, `api-metrics-${dateStamp}.json`)

			console.log(`API metrics logger initialized. Logging to: ${this.logFilePath}`)
		} catch (error) {
			console.error("Failed to initialize API metrics logger:", error)
			this.logDir = null
			this.logFilePath = null
		}
	}

	/**
	 * Log API timing metrics to file
	 */
	static async logMetrics(metrics: ApiTimingMetrics): Promise<void> {
		// Initialize if not already done
		if (!this.logFilePath) {
			await this.initialize()
		}

		if (!this.logFilePath || !this.logDir) {
			console.warn("API metrics logger not initialized. Skipping log.")
			return
		}

		try {
			// Add timestamp
			const timestamp = new Date().toISOString()
			const logEntry = {
				timestamp,
				...metrics,
			}

			// Write to summary JSON file (one JSON object per line)
			const logLine = JSON.stringify(logEntry) + "\n"
			await fs.appendFile(this.logFilePath, logLine, "utf8")

			// Also write to individual request file
			const requestId = `${timestamp.replace(/[:.]/g, "-")}_${Math.random().toString(36).substring(7)}`
			const individualLogDir = path.join(this.logDir, "requests")
			await fs.mkdir(individualLogDir, { recursive: true })

			const individualLogFile = path.join(individualLogDir, `${requestId}.json`)
			await fs.writeFile(individualLogFile, JSON.stringify(logEntry, null, 2), "utf8")
		} catch (error) {
			console.error("Failed to write API metrics:", error)
		}
	}

	/**
	 * Create a timing tracker for an API request
	 */
	static createTimingTracker(provider: string, modelId: string, isStreaming: boolean, userRequest?: string) {
		const startTime = Date.now()
		let firstChunkTime: number | undefined
		let lastChunkTime: number | undefined
		let processingStartTime: number | undefined
		let totalProcessingTime = 0
		let outputResponse = ""

		return {
			/**
			 * Mark when first chunk is received
			 */
			markFirstChunk: () => {
				if (!firstChunkTime) {
					firstChunkTime = Date.now()
				}
			},

			/**
			 * Mark when last chunk is received
			 */
			markLastChunk: () => {
				lastChunkTime = Date.now()
			},

			/**
			 * Start timing data processing
			 */
			startProcessing: () => {
				processingStartTime = Date.now()
			},

			/**
			 * End timing data processing and accumulate
			 */
			endProcessing: () => {
				if (processingStartTime) {
					totalProcessingTime += Date.now() - processingStartTime
					processingStartTime = undefined
				}
			},

			/**
			 * Append to output response
			 */
			appendOutput: (chunk: string) => {
				outputResponse += chunk
			},

			/**
			 * Complete the request and log metrics
			 */
			complete: async (
				status: "success" | "error",
				tokenUsage?: ApiTimingMetrics["tokenUsage"],
				errorMessage?: string,
			) => {
				const endTime = Date.now()

				const metrics: ApiTimingMetrics = {
					requestStartTime: startTime,
					timeToFirstChunk: firstChunkTime ? firstChunkTime - startTime : undefined,
					timeToLastChunk: lastChunkTime ? lastChunkTime - startTime : undefined,
					totalRequestTime: endTime - startTime,
					dataProcessingTime: totalProcessingTime,
					provider,
					modelId,
					isStreaming,
					status,
					errorMessage,
					userRequest,
					outputResponse: outputResponse || undefined,
					tokenUsage,
				}

				await ApiMetricsLogger.logMetrics(metrics)

				// Also log summary to console for immediate visibility
				console.log(
					`[API Metrics] ${provider}/${modelId} - ` +
						`Total: ${metrics.totalRequestTime}ms, ` +
						`TTFC: ${metrics.timeToFirstChunk || "N/A"}ms, ` +
						`Processing: ${metrics.dataProcessingTime}ms, ` +
						`Status: ${status}`,
				)

				return metrics
			},
		}
	}

	/**
	 * Get the current log file path
	 */
	static getLogFilePath(): string | null {
		return this.logFilePath
	}

	/**
	 * Read metrics from log file for a specific date
	 */
	static async readMetrics(date?: string): Promise<ApiTimingMetrics[]> {
		if (!this.logDir) {
			await this.initialize()
		}

		if (!this.logDir) {
			throw new Error("API metrics logger not initialized")
		}

		const dateStamp = date || new Date().toISOString().split("T")[0]
		const logFile = path.join(this.logDir, `api-metrics-${dateStamp}.json`)

		try {
			const content = await fs.readFile(logFile, "utf8")
			const lines = content.trim().split("\n")
			return lines.map((line) => JSON.parse(line))
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return [] // File doesn't exist
			}
			throw error
		}
	}
}

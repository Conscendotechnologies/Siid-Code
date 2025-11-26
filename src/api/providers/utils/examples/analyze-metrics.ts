/**
 * Example script to analyze API metrics
 *
 * Run this script to get insights from your API metrics logs:
 * npx tsx src/api/providers/utils/examples/analyze-metrics.ts
 */

import { ApiMetricsLogger, ApiTimingMetrics } from "../apiMetricsLogger"

interface MetricsSummary {
	totalRequests: number
	successfulRequests: number
	failedRequests: number
	averageTimeToFirstChunk: number
	averageTotalTime: number
	averageProcessingTime: number
	totalCost: number
	totalInputTokens: number
	totalOutputTokens: number
	modelBreakdown: Record<string, number>
}

async function analyzeMetrics(date?: string): Promise<MetricsSummary> {
	const metrics = await ApiMetricsLogger.readMetrics(date)

	if (metrics.length === 0) {
		console.log(`No metrics found for ${date || "today"}`)
		return {
			totalRequests: 0,
			successfulRequests: 0,
			failedRequests: 0,
			averageTimeToFirstChunk: 0,
			averageTotalTime: 0,
			averageProcessingTime: 0,
			totalCost: 0,
			totalInputTokens: 0,
			totalOutputTokens: 0,
			modelBreakdown: {},
		}
	}

	const summary: MetricsSummary = {
		totalRequests: metrics.length,
		successfulRequests: metrics.filter((m) => m.status === "success").length,
		failedRequests: metrics.filter((m) => m.status === "error").length,
		averageTimeToFirstChunk: 0,
		averageTotalTime: 0,
		averageProcessingTime: 0,
		totalCost: 0,
		totalInputTokens: 0,
		totalOutputTokens: 0,
		modelBreakdown: {},
	}

	// Calculate averages and totals
	let ttfcSum = 0
	let ttfcCount = 0
	let totalTimeSum = 0
	let processingTimeSum = 0

	metrics.forEach((metric) => {
		// Time to first chunk (only for streaming)
		if (metric.timeToFirstChunk !== undefined) {
			ttfcSum += metric.timeToFirstChunk
			ttfcCount++
		}

		// Total time
		if (metric.totalRequestTime !== undefined) {
			totalTimeSum += metric.totalRequestTime
		}

		// Processing time
		if (metric.dataProcessingTime !== undefined) {
			processingTimeSum += metric.dataProcessingTime
		}

		// Token usage and cost
		if (metric.tokenUsage) {
			summary.totalInputTokens += metric.tokenUsage.inputTokens
			summary.totalOutputTokens += metric.tokenUsage.outputTokens
			summary.totalCost += metric.tokenUsage.totalCost || 0
		}

		// Model breakdown
		const modelKey = `${metric.provider}/${metric.modelId}`
		summary.modelBreakdown[modelKey] = (summary.modelBreakdown[modelKey] || 0) + 1
	})

	summary.averageTimeToFirstChunk = ttfcCount > 0 ? ttfcSum / ttfcCount : 0
	summary.averageTotalTime = metrics.length > 0 ? totalTimeSum / metrics.length : 0
	summary.averageProcessingTime = metrics.length > 0 ? processingTimeSum / metrics.length : 0

	return summary
}

function formatDuration(ms: number): string {
	if (ms < 1000) {
		return `${Math.round(ms)}ms`
	}
	return `${(ms / 1000).toFixed(2)}s`
}

function formatCost(cost: number): string {
	return `$${cost.toFixed(4)}`
}

async function main() {
	console.log("📊 API Metrics Analysis\n")

	// Get today's date
	const today = new Date().toISOString().split("T")[0]

	console.log(`Analyzing metrics for: ${today}`)
	console.log(`Log file: ${ApiMetricsLogger.getLogFilePath() || "Not initialized"}\n`)

	const summary = await analyzeMetrics()

	if (summary.totalRequests === 0) {
		console.log("No metrics found. Make some API requests to see metrics here.")
		return
	}

	console.log("📈 Summary Statistics:")
	console.log("─".repeat(50))
	console.log(`Total Requests:       ${summary.totalRequests}`)
	console.log(`  ✓ Successful:       ${summary.successfulRequests}`)
	console.log(`  ✗ Failed:           ${summary.failedRequests}`)
	console.log()
	console.log(`Average Timings:`)
	console.log(`  Time to First Chunk: ${formatDuration(summary.averageTimeToFirstChunk)}`)
	console.log(`  Total Request Time:  ${formatDuration(summary.averageTotalTime)}`)
	console.log(`  Processing Time:     ${formatDuration(summary.averageProcessingTime)}`)
	console.log()
	console.log(`Token Usage:`)
	console.log(`  Input Tokens:        ${summary.totalInputTokens.toLocaleString()}`)
	console.log(`  Output Tokens:       ${summary.totalOutputTokens.toLocaleString()}`)
	console.log(`  Total Cost:          ${formatCost(summary.totalCost)}`)
	console.log()
	console.log(`Model Breakdown:`)
	Object.entries(summary.modelBreakdown)
		.sort((a, b) => b[1] - a[1])
		.forEach(([model, count]) => {
			console.log(`  ${model}: ${count} requests`)
		})

	// Show recent errors if any
	const allMetrics = await ApiMetricsLogger.readMetrics()
	const recentErrors = allMetrics.filter((m) => m.status === "error").slice(-5)

	if (recentErrors.length > 0) {
		console.log()
		console.log("⚠️  Recent Errors:")
		console.log("─".repeat(50))
		recentErrors.forEach((error, index) => {
			console.log(`${index + 1}. ${error.provider}/${error.modelId}`)
			console.log(`   Error: ${error.errorMessage}`)
		})
	}
}

// Run the analysis
main().catch(console.error)

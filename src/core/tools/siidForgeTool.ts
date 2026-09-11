import * as vscode from "vscode"

import type { SiidForgeApi } from "@conscendotech/siid-forge-api"

import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { getForgeFeature, validateForgeArgs, REQUIRED_FORGE_VERSION, FORGE_FEATURES } from "./forgeFeatureRegistry"

const FORGE_EXT_ID = "ConscendoTechInc.siid-forge"

/** A short one-line summary of a feature's args for the chat row (never dumps huge blobs). */
function summarizeArgs(feature: string, args: Record<string, unknown>): string {
	// sfRun's array of CLI args reads best as a command line.
	if (feature === "sfRun" && Array.isArray(args.args)) {
		return `sf ${(args.args as string[]).join(" ")}`
	}
	const parts = Object.entries(args)
		.filter(([k]) => k !== "projectRoot") // internal default, not interesting to show
		.map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
	const line = parts.join(", ")
	return line.length > 200 ? line.slice(0, 197) + "…" : line
}

/**
 * Did the feature's *work* succeed, as opposed to merely not throwing?
 *
 * Some features report a failing outcome in their payload rather than raising:
 * `runApexTests` returns `{result: {summary: {outcome: "Failed", failing: 1}}}`
 * for a red test run and resolves normally. Reporting that row as a success
 * puts a ✅ next to a failing test run.
 *
 * Only an explicitly negative outcome flips this to false - a feature that says
 * nothing about its outcome is still a success, since it returned without error.
 */
function didFeatureSucceed(result: unknown): boolean {
	const summary = (result as { result?: { summary?: { outcome?: unknown; failing?: unknown } } })?.result?.summary

	if (!summary) {
		return true
	}

	// sf CLI reports "Passed" | "Failed" | "Skipped" here.
	if (typeof summary.outcome === "string") {
		return summary.outcome.toLowerCase() !== "failed"
	}

	if (typeof summary.failing === "number") {
		return summary.failing === 0
	}

	return true
}

/** Bind the SIID Forge public API at runtime, or return undefined if unavailable. Never throws. */
async function resolveForge(): Promise<SiidForgeApi | undefined> {
	try {
		const ext = vscode.extensions.getExtension(FORGE_EXT_ID)
		if (!ext) {
			return undefined
		}
		const api = (ext.isActive ? ext.exports : await ext.activate()) as SiidForgeApi | undefined
		return api ?? undefined
	} catch {
		return undefined
	}
}

/** Compare dotted semver strings a >= b (numeric, no pre-release handling — sufficient here). */
function versionGte(a: string, b: string): boolean {
	const pa = a.split(".").map((n) => parseInt(n, 10) || 0)
	const pb = b.split(".").map((n) => parseInt(n, 10) || 0)
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0)
		if (d !== 0) {
			return d > 0
		}
	}
	return true
}

/**
 * The single `siid_forge` tool. The model picks a `feature` and passes `args`; we dispatch to the
 * headless SIID Forge API. Mutating features are gated behind the user-approval flow. Read features
 * run directly. Everything fails soft with a clear tool error — no crash if forge is absent.
 */
export async function siidForgeTool(
	task: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const featureName: string | undefined = block.params.feature
	const rawArgs: string | undefined = block.params.args

	try {
		if (block.partial) {
			// Nothing to stream meaningfully; show the feature being requested.
			await task.ask("tool", removeClosingTag("feature", featureName ?? ""), block.partial).catch(() => {})
			return
		}

		if (!featureName) {
			task.consecutiveMistakeCount++
			task.recordToolError("siid_forge")
			pushToolResult(await task.sayAndCreateMissingParamError("siid_forge", "feature"))
			return
		}

		const feature = getForgeFeature(featureName)
		if (!feature) {
			task.consecutiveMistakeCount++
			task.recordToolError("siid_forge")
			const names = FORGE_FEATURES.map((f) => f.name).join(", ")
			pushToolResult(formatResponse.toolError(`Unknown siid_forge feature "${featureName}". Valid: ${names}.`))
			return
		}

		// Parse args JSON (default to {}).
		let args: Record<string, unknown> = {}
		if (rawArgs && rawArgs.trim().length > 0) {
			try {
				const parsed = JSON.parse(rawArgs)
				if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
					args = parsed as Record<string, unknown>
				} else {
					pushToolResult(formatResponse.toolError(`siid_forge "args" must be a JSON object.`))
					return
				}
			} catch (e) {
				pushToolResult(formatResponse.toolError(`siid_forge "args" is not valid JSON: ${(e as Error).message}`))
				return
			}
		}

		const argError = validateForgeArgs(feature, args)
		if (argError) {
			task.consecutiveMistakeCount++
			task.recordToolError("siid_forge")
			pushToolResult(formatResponse.toolError(argError))
			return
		}

		task.consecutiveMistakeCount = 0

		// Default the project directory to the OPEN WORKSPACE (task.cwd) when the model omits it.
		// Forge otherwise falls back to process.cwd() = the IDE install dir, which is not a Salesforce
		// DX project, so `sfRun` deploys and any projectRoot-based feature fail. One place covers every
		// feature that takes projectRoot.
		if (args.projectRoot === undefined && task.cwd) {
			args.projectRoot = task.cwd
		}

		// Bind forge.
		const forge = await resolveForge()
		if (!forge) {
			pushToolResult(
				formatResponse.toolError(
					`SIID Forge extension (${FORGE_EXT_ID}) is not installed or not available. This tool requires it.`,
				),
			)
			return
		}
		if (!versionGte(forge.version, REQUIRED_FORGE_VERSION)) {
			pushToolResult(
				formatResponse.toolError(
					`SIID Forge ${forge.version} is too old; this tool needs ${REQUIRED_FORGE_VERSION}+. Please update SIID Forge.`,
				),
			)
			return
		}

		// A one-line, human-readable summary of the args for the UI row.
		const argSummary = summarizeArgs(feature.name, args)

		// Auto-approval: mutating features gate on the "SIID Forge (write)" toggle, read features on
		// the "SIID Forge (read)" toggle. When the toggle is ON, forceApproval=false → the row shows
		// but auto-accepts; when OFF, the user is asked. Every feature routes through askApproval so a
		// structured tool row always renders (icon, feature, args, buttons/status).
		const providerState = await task.providerRef.deref()?.getState()
		const autoApproved = feature.mutating
			? !!providerState?.alwaysAllowSiidForgeWrite
			: !!providerState?.alwaysAllowSiidForgeRead
		const approvalMessage = JSON.stringify({
			tool: "siidForge",
			feature: feature.name,
			mutating: feature.mutating,
			content: argSummary,
		} satisfies ClineSayTool)
		const didApprove = await askApproval("tool", approvalMessage, undefined, !autoApproved)
		if (!didApprove) {
			return
		}

		// Capture Forge's real command lifecycle so the result row reports the ACTUAL elapsed time
		// and terminal phase (not a client guess). Throttled progress rows drive a live timer while
		// the command runs; the terminal phase carries the final elapsedMs.
		let lastElapsedMs: number | undefined
		let lastProgressAt = 0
		const startedAt = Date.now()
		const onStatus = (s: { phase: string; elapsedMs: number }) => {
			// Forge reports real elapsed time; for the synthetic "started" below there is
			// none yet, so fall back to our own clock rather than reporting 0.0s.
			lastElapsedMs = s.elapsedMs || Date.now() - startedAt
			const now = Date.now()
			// Throttle "running" heartbeats to ~1/s; always emit terminal phases.
			const terminal = s.phase !== "started" && s.phase !== "running"
			if (!terminal && now - lastProgressAt < 900) {
				return
			}
			lastProgressAt = now
			task.say(
				"tool",
				JSON.stringify({
					tool: "siidForge",
					feature: feature.name,
					mutating: feature.mutating,
					phase: s.phase,
					// Omitted when Forge has no real figure yet (the synthetic "started"
					// below): the row then runs its own live timer instead of freezing
					// on a static 0s that never updates.
					elapsedMs: s.elapsedMs || undefined,
				} satisfies ClineSayTool),
			).catch(() => {})
		}

		// Approval is done, so the row must stop saying "Awaiting approval…" even for
		// features that report no progress of their own. Only `sfRun` forwards Forge's
		// onStatus; everything else (runApexTests among them) would otherwise look
		// unapproved for its whole run. A synthetic "started" is enough - the UI treats
		// any progress row as "running", and a real heartbeat just supersedes it.
		onStatus({ phase: "started", elapsedMs: 0 })

		// Dispatch, then emit a success/failure result row.
		try {
			const result = await feature.run(forge, args, onStatus)
			const text = typeof result === "string" ? result : JSON.stringify(result ?? null, null, 2)
			await task
				.say(
					"tool",
					JSON.stringify({
						tool: "siidForge",
						feature: feature.name,
						mutating: feature.mutating,
						success: didFeatureSucceed(result),
						elapsedMs: lastElapsedMs,
						content: text,
					} satisfies ClineSayTool),
				)
				.catch(() => {})
			pushToolResult(`siid_forge(${feature.name}) result:\n${text}`)
		} catch (runErr) {
			const msg = (runErr as Error)?.message ?? String(runErr)
			await task
				.say(
					"tool",
					JSON.stringify({
						tool: "siidForge",
						feature: feature.name,
						mutating: feature.mutating,
						success: false,
						elapsedMs: lastElapsedMs,
						content: msg,
					} satisfies ClineSayTool),
				)
				.catch(() => {})
			pushToolResult(formatResponse.toolError(`siid_forge(${feature.name}) failed: ${msg}`))
		}
	} catch (error) {
		await handleError(`running siid_forge feature "${featureName ?? "?"}"`, error as Error)
	}
}

/** Internals exposed for tests only. */
export const __testing = { didFeatureSucceed }

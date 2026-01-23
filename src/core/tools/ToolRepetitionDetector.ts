import { ToolUse } from "../../shared/tools"
import { t } from "../../i18n"

/**
 * Possible recovery actions when tool repetition is detected
 */
export type ToolRecoveryAction = "NONE" | "SWITCH_MODE" | "ASK_USER"

/**
 * Detects consecutive identical tool calls and
 * provides internal guidance to help the agent recover.
 */
export class ToolRepetitionDetector {
	private previousToolCallJson: string | null = null
	private consecutiveIdenticalToolCallCount = 0
	private readonly consecutiveIdenticalToolCallLimit: number

	/**
	 * @param limit Maximum number of identical consecutive tool calls allowed
	 *              (0 = unlimited)
	 */
	constructor(limit: number = 3) {
		this.consecutiveIdenticalToolCallLimit = limit
	}

	/**
	 * Checks whether the current tool call can be executed
	 * or whether recovery guidance should be applied.
	 */
	public check(currentToolCallBlock: ToolUse): {
		allowExecution: boolean
		recoveryAction: ToolRecoveryAction
		reason?: string
		agentHint?: string
	} {
		let currentToolCallJson: string

		try {
			currentToolCallJson = this.serializeToolUse(currentToolCallBlock)
		} catch (err: unknown) {
			const e = err as Error
			console.error("ToolRepetitionDetector: failed to serialize tool call", e, { toolUse: currentToolCallBlock })

			return {
				allowExecution: false,
				recoveryAction: "SWITCH_MODE",
				reason: `Failed to serialize tool call "${currentToolCallBlock.name}"`,
			}
		}

		// Detect consecutive repetition
		if (this.previousToolCallJson === currentToolCallJson) {
			this.consecutiveIdenticalToolCallCount++
		} else {
			this.consecutiveIdenticalToolCallCount = 1
			this.previousToolCallJson = currentToolCallJson
		}

		// Repetition limit reached → inject internal guidance
		if (
			this.consecutiveIdenticalToolCallLimit > 0 &&
			this.consecutiveIdenticalToolCallCount >= this.consecutiveIdenticalToolCallLimit
		) {
			this.reset()

			return {
				allowExecution: false,
				recoveryAction: "NONE",
				reason: `Repeated identical calls to tool "${currentToolCallBlock.name}" detected`,
				agentHint:
					"No progress is being made with the current tool call. Pause execution, reassess the overall objective, and revise your plan. If the task is large or complex, break it into smaller, well-defined steps. Adjust your strategy by changing inputs, selecting a different tool, or approaching the problem incrementally before proceeding.",
			}
		}

		return {
			allowExecution: true,
			recoveryAction: "NONE",
		}
	}

	/**
	 * Explicit fallback when autonomous recovery fails
	 */
	public buildAskUserResponse(toolName: string) {
		return {
			allowExecution: false,
			recoveryAction: "ASK_USER" as ToolRecoveryAction,
			reason: t("tools:toolRepetitionLimitReached", { toolName }),
		}
	}

	/**
	 * Resets internal repetition state
	 */
	private reset() {
		this.consecutiveIdenticalToolCallCount = 0
		this.previousToolCallJson = null
	}

	/**
	 * Serializes a ToolUse object into a canonical JSON string
	 * with sorted parameter keys for stable comparison.
	 */
	private serializeToolUse(toolUse: ToolUse): string {
		const sortedParams: Record<string, unknown> = {}
		const sortedKeys = Object.keys(toolUse.params ?? {}).sort()

		for (const key of sortedKeys) {
			if (Object.prototype.hasOwnProperty.call(toolUse.params, key)) {
				sortedParams[key] = toolUse.params[key as keyof typeof toolUse.params]
			}
		}

		return JSON.stringify({
			name: toolUse.name,
			parameters: sortedParams,
		})
	}
}

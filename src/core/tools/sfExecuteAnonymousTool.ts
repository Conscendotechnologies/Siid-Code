import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { exec } from "child_process"

import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineSayTool } from "../../shared/ExtensionMessage"

function runSfCommand(command: string, cwd: string, timeoutMs: number): Promise<string> {
	return new Promise((resolve, reject) => {
		exec(
			command,
			{
				cwd,
				encoding: "utf-8",
				timeout: timeoutMs,
				maxBuffer: 10 * 1024 * 1024,
				windowsHide: true,
			},
			(error, stdout, stderr) => {
				if (error) {
					const wrappedError = error as Error & { stdout?: string; stderr?: string; killed?: boolean }
					wrappedError.stdout = stdout
					wrappedError.stderr = stderr
					reject(wrappedError)
					return
				}
				resolve(stdout)
			},
		)
	})
}

function handleCommonSfCliErrors(errorMessage: string): string {
	if (errorMessage.includes("command not found") || errorMessage.includes("'sf' is not recognized")) {
		return "Salesforce CLI (sf) is not installed or not in PATH. Please install it from https://developer.salesforce.com/tools/salesforcecli"
	}
	if (errorMessage.includes("No default org set") || errorMessage.includes("No default username")) {
		return "No default Salesforce org is set. Please run 'sf org login web' or 'sf config set target-org <username>' to set a default org."
	}
	if (errorMessage.includes("ENOENT")) {
		return "Salesforce CLI (sf) is not installed. Please install it from https://developer.salesforce.com/tools/salesforcecli"
	}
	return errorMessage
}

function formatAnonymousResult(output: string): string {
	try {
		const jsonOutput = JSON.parse(output)
		if (jsonOutput.status === 0) {
			const result = jsonOutput.result ?? {}
			const logs =
				typeof result.logs === "string" && result.logs.trim().length > 0 ? `\n\nLogs:\n${result.logs.trim()}` : ""
			return `Anonymous Apex executed successfully.${logs}`
		}

		const message = jsonOutput.message || jsonOutput.result?.message || "Unknown Salesforce CLI error"
		return `Anonymous Apex execution failed.\n\n${message}`
	} catch {
		return output.trim().length > 0 ? output.trim() : "Anonymous Apex execution finished with no output."
	}
}

export async function sfExecuteAnonymousTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const content: string | undefined = block.params.content

	try {
		const sharedMessageProps: ClineSayTool = {
			tool: "sfExecuteAnonymous",
			content: content || "",
		}

		if (block.partial) {
			await cline
				.ask(
					"tool",
					JSON.stringify({
						...sharedMessageProps,
						content: removeClosingTag("content", content),
					} satisfies ClineSayTool),
					block.partial,
				)
				.catch(() => {})
			return
		}

		if (!content?.trim()) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("sf_execute_anonymous")
			pushToolResult(await cline.sayAndCreateMissingParamError("sf_execute_anonymous", "content"))
			return
		}

		cline.consecutiveMistakeCount = 0

		const approvalMessage = JSON.stringify({
			...sharedMessageProps,
			content,
		} satisfies ClineSayTool)

		const didApprove = await askApproval("tool", approvalMessage)
		if (!didApprove) {
			return
		}

		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "siid-sf-anon-"))
		const tempFile = path.join(tempDir, "anonymous.apex")

		try {
			fs.writeFileSync(tempFile, content, "utf-8")
			const command = `sf apex run --file "${tempFile}" --json`
			const output = await runSfCommand(command, cline.cwd, 300000)
			const formattedResult = formatAnonymousResult(output)

			await cline.say(
				"tool",
				JSON.stringify({
					...sharedMessageProps,
					content: formattedResult,
				} satisfies ClineSayTool),
			)
			pushToolResult(formatResponse.toolResult(formattedResult))
		} catch (execError: any) {
			let errorMessage = "Failed to execute anonymous Apex"

			if (execError.killed) {
				errorMessage = "Anonymous Apex execution timed out after 5 minutes"
			} else if (execError.stdout) {
				errorMessage = formatAnonymousResult(execError.stdout)
			} else if (execError.stderr) {
				errorMessage = execError.stderr
			} else if (execError.message) {
				errorMessage = execError.message
			}

			errorMessage = handleCommonSfCliErrors(errorMessage)
			pushToolResult(formatResponse.toolError(errorMessage))
		} finally {
			try {
				fs.rmSync(tempDir, { recursive: true, force: true })
			} catch {
				// Ignore cleanup failures for temp files.
			}
		}
	} catch (error) {
		await handleError("executing Salesforce anonymous Apex", error as Error)
	}
}

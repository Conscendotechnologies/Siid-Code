import fs from "fs"
import path from "path"

export const STREAMED_TOOL_DEBUG_ENABLED = true

export const STREAMED_TOOL_DEBUG_FILE_PATH = process.env.SIID_STREAMED_TOOL_DEBUG_FILE
	? path.resolve(process.env.SIID_STREAMED_TOOL_DEBUG_FILE)
	: path.resolve(__dirname, "../../debug/streamed-tool-debug.jsonl")

let hasAnnouncedDebugFile = false
let writeChain = Promise.resolve()

function sanitizePayload(payload: unknown): unknown {
	return JSON.parse(
		JSON.stringify(payload, (_key, value) => {
			if (typeof value === "bigint") {
				return value.toString()
			}

			if (value instanceof Error) {
				return {
					name: value.name,
					message: value.message,
					stack: value.stack,
				}
			}

			return value
		}),
	)
}

function queueWrite(line: string) {
	writeChain = writeChain
		.then(async () => {
			await fs.promises.mkdir(path.dirname(STREAMED_TOOL_DEBUG_FILE_PATH), { recursive: true })
			await fs.promises.appendFile(STREAMED_TOOL_DEBUG_FILE_PATH, line, "utf8")
		})
		.catch((error) => {
			console.warn("[StreamedToolDebug] Failed to append debug log:", error)
		})
}

export function announceStreamedToolDebugFile() {
	if (!STREAMED_TOOL_DEBUG_ENABLED || hasAnnouncedDebugFile) {
		return
	}

	hasAnnouncedDebugFile = true
	console.log(`[StreamedToolDebug] writing logs to ${STREAMED_TOOL_DEBUG_FILE_PATH}`)
	queueWrite(
		`${JSON.stringify({
			ts: new Date().toISOString(),
			scope: "StreamedToolDebug",
			event: "session:start",
			payload: {
				filePath: STREAMED_TOOL_DEBUG_FILE_PATH,
				pid: process.pid,
			},
		})}\n`,
	)
}

export function logStreamedToolDebug(scope: string, event: string, payload: Record<string, unknown>) {
	if (!STREAMED_TOOL_DEBUG_ENABLED) {
		return
	}

	announceStreamedToolDebugFile()

	const line = `${JSON.stringify({
		ts: new Date().toISOString(),
		scope,
		event,
		payload: sanitizePayload(payload),
	})}\n`

	queueWrite(line)
}

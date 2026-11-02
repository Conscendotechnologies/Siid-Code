import type { ApiMessage } from "../task-persistence/apiMessages"
import {
	parseReadFileResult,
	parseReadFileTombstone,
	parseResultHeader,
	ELIDED_MARKER,
	type ReadFileEntry,
} from "./stages"

/**
 * A "working set" generated from the real transcript (never from model
 * recall): which files were read or edited, with line ranges and content
 * hashes where the transcript still has them, the current todo list, and the
 * latest user instruction verbatim. Appended to every summary message.
 */

const MAX_FILES = 40
const MAX_INSTRUCTION_CHARS = 2_000
const USER_TEXT_BLOCK = /^<(task|user_message|feedback|answer)>([\s\S]*?)<\/\1>/
const USER_TEXT_IN_RESULT = /<(feedback|answer)>([\s\S]*?)<\/\1>/
const EDIT_TOOLS = new Set(["apply_diff", "write_to_file", "insert_content", "search_and_replace"])

type FileRecord = {
	path: string
	reads: { at: number; lines?: string; hash?: string }[]
	edits: { at: number; tool: string }[]
}

type TextBlock = { type: "text"; text: string }
const isTextBlock = (b: unknown): b is TextBlock =>
	!!b && typeof b === "object" && (b as TextBlock).type === "text" && typeof (b as TextBlock).text === "string"

function textBlocks(message: ApiMessage): TextBlock[] {
	if (typeof message.content === "string") return [{ type: "text", text: message.content }]
	return message.content.filter(isTextBlock)
}

export type WorkingSet = {
	files: FileRecord[]
	todo?: string
	latestUserInstruction?: string
}

export function collectWorkingSet(messages: ApiMessage[]): WorkingSet {
	const files = new Map<string, FileRecord>()
	const record = (path: string) => {
		let r = files.get(path)
		if (!r) files.set(path, (r = { path, reads: [], edits: [] }))
		return r
	}

	let todo: string | undefined
	let latestUserInstruction: string | undefined

	messages.forEach((message, index) => {
		const blocks = textBlocks(message)
		if (message.role === "assistant") {
			// Edits are also visible in the call itself (path param), which survives
			// even when the result text was elided.
			for (const block of blocks) {
				const callRe =
					/<(apply_diff|write_to_file|insert_content|search_and_replace)>[\s\S]*?<path>([^<]+)<\/path>/g
				let m: RegExpExecArray | null
				while ((m = callRe.exec(block.text))) {
					const path = normalizePath(m[2].trim())
					const r = record(path)
					if (!r.edits.some((e) => e.at === index)) r.edits.push({ at: index, tool: m[1] })
				}
				const todoMatch = /<update_todo_list>\s*<todos>([\s\S]*?)<\/todos>/.exec(block.text)
				if (todoMatch) todo = todoMatch[1].trim()
			}
			return
		}

		for (let i = 0; i < blocks.length; i++) {
			const text = blocks[i].text
			const header = parseResultHeader(text)
			if (header) {
				const result = blocks[i + 1]?.text ?? ""
				if (header.tool === "read_file") {
					const entries = result.includes(ELIDED_MARKER)
						? parseReadFileTombstone(result)
						: parseReadFileResult(result)
					const list: ReadFileEntry[] =
						entries.length > 0 ? entries : header.paths.map((p) => ({ path: p, chars: 0 }))
					for (const e of list) {
						record(e.path).reads.push({ at: index, lines: e.lines, hash: e.hash })
					}
				} else if (EDIT_TOOLS.has(header.tool)) {
					for (const p of header.paths) {
						const r = record(p)
						// The call in the previous assistant message already recorded this edit.
						if (!r.edits.some((e) => e.at === index || e.at === index - 1)) {
							r.edits.push({ at: index, tool: header.tool })
						}
					}
				}
				const userText = USER_TEXT_IN_RESULT.exec(result)
				if (userText) latestUserInstruction = userText[2].trim()
				i += 1
				continue
			}
			const direct = USER_TEXT_BLOCK.exec(text.trim())
			if (direct) latestUserInstruction = direct[2].trim()
		}

		// The reminders table inside the latest environment details is the live todo list.
		for (const block of blocks) {
			if (!block.text.startsWith("<environment_details>")) continue
			const table = /(\| # \| Content \| Status \|[\s\S]*?)(?:\n\n|\n<\/environment_details>|$)/.exec(block.text)
			if (table) todo = table[1].trim()
		}
	})

	return {
		files: [...files.values()],
		todo,
		latestUserInstruction,
	}
}

function normalizePath(p: string): string {
	return p.replace(/\\/g, "/").replace(/^\.\//, "")
}

export function formatWorkingSet(set: WorkingSet): string {
	const lines: string[] = ["[Working set: generated from the transcript, not from recall]"]

	const edited = set.files.filter((f) => f.edits.length > 0).sort((a, b) => lastAt(a.edits) - lastAt(b.edits))
	const readOnly = set.files.filter((f) => f.edits.length === 0 && f.reads.length > 0)

	if (edited.length > 0) {
		lines.push("Files edited (oldest first):")
		for (const f of edited.slice(-MAX_FILES)) {
			const tools = [...new Set(f.edits.map((e) => e.tool))].join(", ")
			const lastRead = f.reads.filter((r) => r.at > lastAt(f.edits)).pop()
			lines.push(
				`- ${f.path}: ${tools} x${f.edits.length}, last at message ${lastAt(f.edits) + 1}` +
					(lastRead
						? `; re-read after editing${describeRead(lastRead)}`
						: "; not re-read after the last edit"),
			)
		}
	}
	if (readOnly.length > 0) {
		lines.push("Files read (not edited):")
		for (const f of readOnly.slice(-MAX_FILES)) {
			const last = f.reads[f.reads.length - 1]
			lines.push(
				`- ${f.path}${describeRead(last)} (message ${last.at + 1}, ${f.reads.length} read${f.reads.length === 1 ? "" : "s"})`,
			)
		}
	}
	if (set.todo) {
		lines.push("Current todo (from the latest reminders):", set.todo)
	}
	if (set.latestUserInstruction) {
		const text =
			set.latestUserInstruction.length > MAX_INSTRUCTION_CHARS
				? `${set.latestUserInstruction.slice(0, MAX_INSTRUCTION_CHARS)}…`
				: set.latestUserInstruction
		lines.push("Latest user instruction (verbatim):", '"""', text, '"""')
	}
	return lines.join("\n")
}

function lastAt(items: { at: number }[]): number {
	return items.length > 0 ? items[items.length - 1].at : -1
}

function describeRead(read: { lines?: string; hash?: string }): string {
	const parts: string[] = []
	if (read.lines) parts.push(`lines=${read.lines}`)
	if (read.hash) parts.push(`sha256:${read.hash}`)
	return parts.length > 0 ? ` ${parts.join(" ")}` : ""
}

export function buildWorkingSet(messages: ApiMessage[]): string {
	return formatWorkingSet(collectWorkingSet(messages))
}

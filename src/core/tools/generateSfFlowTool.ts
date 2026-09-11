import * as path from "path"
import * as fs from "fs"
import { execFile } from "child_process"
import { promisify } from "util"

import * as vscode from "vscode"

import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { buildSfDeployCommand, runSfCliCommand, formatDryRunResult } from "./sfDeployMetadataTool"

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// Helpers ported from SF-FlowAutomation (prompt analysis + schema retrieval)
// ---------------------------------------------------------------------------

const MAX_OBJECTS = 5

const COMMON_SOBJECT_HINTS: Array<{ apiName: string; pattern: RegExp }> = [
	{ apiName: "Account", pattern: /\baccounts?\b/i },
	{ apiName: "Case", pattern: /\bcases?\b/i },
	{ apiName: "Contact", pattern: /\bcontacts?\b/i },
	{ apiName: "Lead", pattern: /\bleads?\b/i },
	{ apiName: "Opportunity", pattern: /\bopportunities\b|\bopportunity\b/i },
	{ apiName: "Task", pattern: /\btasks?\b/i },
	{ apiName: "Event", pattern: /\bevents?\b/i },
	{ apiName: "User", pattern: /\busers?\b/i },
	{ apiName: "Quote", pattern: /\bquotes?\b/i },
	{ apiName: "QuoteLineItem", pattern: /\bquote\s+lines?\b|\bquote\s+line\s+items?\b/i },
	{ apiName: "Order", pattern: /\borders?\b/i },
	{ apiName: "OrderItem", pattern: /\border\s+items?\b/i },
	{ apiName: "Product2", pattern: /\bproducts?\b/i },
	{ apiName: "Pricebook2", pattern: /\bpricebooks?\b/i },
	{ apiName: "Asset", pattern: /\bassets?\b/i },
	{ apiName: "Contract", pattern: /\bcontracts?\b/i },
	{ apiName: "Campaign", pattern: /\bcampaigns?\b/i },
	{ apiName: "CaseComment", pattern: /\bcase\s+comments?\b/i },
]

function dedupeAndLimit(objects: string[]): string[] {
	return [...new Set(objects.map((o) => o.trim()).filter(Boolean))].slice(0, MAX_OBJECTS)
}

function extractSchemaObjectHints(userMessage: string): string[] {
	const hints: string[] = []
	for (const hint of COMMON_SOBJECT_HINTS) {
		if (hint.pattern.test(userMessage)) {
			hints.push(hint.apiName)
		}
	}
	const explicitCustomObjects = userMessage.match(/\b[A-Za-z][A-Za-z0-9]*__c\b/g) ?? []
	hints.push(...explicitCustomObjects)
	return dedupeAndLimit(hints)
}

function sanitizeFileStem(value: string): string {
	return value
		.trim()
		.replace(/[^A-Za-z0-9_-]+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_+|_+$/g, "")
}

function buildObjectFileStem(objectNames: string[]): string {
	const unique = [...new Set(objectNames.map((n) => n.trim()).filter(Boolean))]
	return unique.length === 0 ? "schema" : sanitizeFileStem(unique.join("_"))
}

// Catches both full ESC sequences (\x1b[...m) and bare SGR codes that PowerShell strips to ([...m)
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE_RE = /(?:\x1b\[|\[)[0-9;]*[a-zA-Z]/g

function stripAnsi(text: string): string {
	return text.replace(ANSI_ESCAPE_RE, "")
}

function formatProcessError(prefix: string, err: any): string {
	const parts = [prefix]
	const stderr = typeof err?.stderr === "string" ? stripAnsi(err.stderr).trim() : ""
	const stdout = typeof err?.stdout === "string" ? stripAnsi(err.stdout).trim() : ""
	const message = err?.message ? stripAnsi(String(err.message)).trim() : ""
	if (stderr) {
		parts.push(`stderr: ${stderr}`)
	}
	if (stdout && stdout !== stderr) {
		parts.push(`stdout: ${stdout}`)
	}
	if (message && message !== stderr && message !== stdout) {
		parts.push(`message: ${message}`)
	}
	return parts.join("\n")
}

function parseUsage(rawUsage: any): Record<string, number> | undefined {
	if (!rawUsage || typeof rawUsage !== "object") {
		return undefined
	}
	const usage: Record<string, number> = {}
	for (const key of ["prompt_tokens", "completion_tokens", "total_tokens"] as const) {
		const v = Number(rawUsage[key])
		if (Number.isFinite(v)) {
			usage[key] = v
		}
	}
	const cost = Number(rawUsage.cost)
	if (Number.isFinite(cost)) {
		usage.cost = cost
	}
	return Object.keys(usage).length > 0 ? usage : undefined
}

function extractUsageFromError(err: any): Record<string, number> | undefined {
	for (const source of [err?.stderr, err?.stdout, err?.message]) {
		if (typeof source !== "string" || !source.trim()) {
			continue
		}
		const match = source.match(/Usage:\s*(\{[\s\S]*\})/)
		if (!match) {
			continue
		}
		try {
			return parseUsage(JSON.parse(match[1]))
		} catch {
			// try next
		}
	}
	return undefined
}

// ---------------------------------------------------------------------------
// Schema retrieval — via VS Code hidden terminal (inherits user shell/PATH/auth)
// ---------------------------------------------------------------------------

const DESCRIBE_TIMEOUT_MS = 20_000

function quotePowerShell(value: string): string {
	return `'${value.replace(/'/g, "''")}'`
}

function quotePosix(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`
}

function buildTerminalCommand(baseArgs: string[], outputFile: string, doneFile: string): string {
	if (process.platform === "win32") {
		const args = baseArgs.map(quotePowerShell).join(" ")
		const output = quotePowerShell(outputFile)
		const done = quotePowerShell(doneFile)
		const script = [
			"$global:LASTEXITCODE = $null",
			`& sf ${args} --json *> ${output}`,
			"$code = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } elseif ($?) { 0 } else { 1 }",
			`Set-Content -LiteralPath ${done} -Value $code -Encoding UTF8`,
		].join("; ")
		const encodedScript = Buffer.from(script, "utf16le").toString("base64")
		return `powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedScript}\n`
	}
	const args = baseArgs.map(quotePosix).join(" ")
	return `sf ${args} --json > ${quotePosix(outputFile)} 2>&1; printf '%s' "$?" > ${quotePosix(doneFile)}\n`
}

function readShellRedirectedFile(filePath: string): string {
	const buf = fs.readFileSync(filePath)
	let text: string
	if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
		text = buf.slice(2).toString("utf16le")
	} else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
		text = buf.swap16().slice(2).toString("utf16le")
	} else if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
		text = buf.slice(3).toString("utf-8")
	} else {
		text = buf.toString("utf-8")
	}
	text = text.replace(/^\uFEFF/, "")
	const firstJsonChar = text.search(/[{[]/)
	if (firstJsonChar > 0) {
		text = text.slice(firstJsonChar)
	}
	return text.trim()
}

function readExitCode(doneFile: string): number | undefined {
	try {
		const raw = fs.readFileSync(doneFile, "utf-8").trim()
		const parsed = Number(raw)
		return Number.isFinite(parsed) ? parsed : undefined
	} catch {
		return undefined
	}
}

function summarizeSfOutput(raw: string): string {
	const clean = stripAnsi(raw)
	if (!clean.trim()) {
		return "No output from Salesforce CLI."
	}
	try {
		const parsed = JSON.parse(clean)
		const message = parsed?.message || parsed?.result?.message || parsed?.name
		if (message) {
			return String(message)
		}
	} catch {
		// fall through
	}
	return clean.replace(/\s+/g, " ").trim().slice(0, 200)
}

async function describeObjectViaTerminal(
	objectName: string,
	outputFile: string,
	targetOrg?: string,
): Promise<{ stdout: string } | { error: string }> {
	const doneFile = `${outputFile}.done`
	if (fs.existsSync(outputFile)) {
		fs.unlinkSync(outputFile)
	}
	if (fs.existsSync(doneFile)) {
		fs.unlinkSync(doneFile)
	}

	const terminal = vscode.window.createTerminal({ name: `sf-schema-${objectName}`, hideFromUser: true })

	const baseArgs = ["sobject", "describe", "--sobject", objectName]
	if (targetOrg) {
		baseArgs.push("--target-org", targetOrg)
	}
	terminal.sendText(buildTerminalCommand(baseArgs, outputFile, doneFile))

	const pollInterval = 300
	const maxPolls = Math.ceil(DESCRIBE_TIMEOUT_MS / pollInterval)
	for (let i = 0; i < maxPolls; i++) {
		await new Promise((resolve) => setTimeout(resolve, pollInterval))
		if (fs.existsSync(doneFile)) {
			const exitCode = readExitCode(doneFile)
			const content = fs.existsSync(outputFile) ? readShellRedirectedFile(outputFile) : ""
			terminal.dispose()
			try {
				fs.unlinkSync(doneFile)
			} catch {
				// not critical
			}
			if (exitCode === 0) {
				return { stdout: content }
			}
			return {
				error: `sf sobject describe ${objectName} failed${exitCode === undefined ? "" : ` with exit code ${exitCode}`}: ${summarizeSfOutput(content)}`,
			}
		}
	}
	terminal.dispose()
	return {
		error: `Timed out waiting for 'sf sobject describe ${objectName}' after ${DESCRIBE_TIMEOUT_MS}ms. Is your default org authenticated?`,
	}
}

interface CondensedField {
	name: string
	type: string
	required: boolean
	picklistValues?: string[]
	referenceTo?: string[]
}

interface CondensedObject {
	label: string
	fields: CondensedField[]
}

function condenseDescribeResult(raw: string, objectName: string): CondensedObject | { error: string } {
	let parsed: any
	try {
		parsed = JSON.parse(raw)
	} catch {
		return { error: `Could not parse 'sf sobject describe ${objectName}' output as JSON.` }
	}
	if (parsed?.status !== 0 && parsed?.name) {
		return { error: `sf CLI error: ${parsed.message || parsed.name}` }
	}
	const result = parsed?.result
	if (!result || !Array.isArray(result.fields)) {
		return { error: `Unexpected sf describe JSON shape for ${objectName}` }
	}
	const fields: CondensedField[] = result.fields.map((f: any) => {
		const field: CondensedField = {
			name: f.name,
			type: f.type,
			required: f.nillable === false && f.defaultedOnCreate === false,
		}
		if (f.type === "picklist" && Array.isArray(f.picklistValues)) {
			field.picklistValues = f.picklistValues.filter((pv: any) => pv.active !== false).map((pv: any) => pv.value)
		}
		if (f.type === "reference" && Array.isArray(f.referenceTo) && f.referenceTo.length) {
			field.referenceTo = f.referenceTo
		}
		return field
	})
	return { label: result.label || objectName, fields }
}

function loadSchemaFieldMap(schemaPath?: string): Record<string, Set<string>> {
	if (!schemaPath || !fs.existsSync(schemaPath)) {
		return {}
	}
	try {
		const doc = JSON.parse(fs.readFileSync(schemaPath, "utf-8"))
		const map: Record<string, Set<string>> = {}
		for (const [objectName, obj] of Object.entries<any>(doc.objects || {})) {
			map[objectName.toLowerCase()] = new Set((obj.fields || []).map((f: any) => String(f.name).toLowerCase()))
		}
		return map
	} catch {
		return {}
	}
}

// Best-effort: flags custom fields (__c) referenced in the graph that don't exist in the
// schema we fetched, so a doomed deploy isn't reported as a silent success.
function findMissingCustomFields(graph: any, schemaFieldMap: Record<string, Set<string>>): string[] {
	if (Object.keys(schemaFieldMap).length === 0) {
		return []
	}
	const nodes: any[] = Array.isArray(graph?.nodes) ? graph.nodes : []
	const startNode = nodes.find((n) => n?.type === "Start")
	const triggerObject: string | undefined = startNode?.metadata?.object

	const missing = new Set<string>()
	const checkField = (objectName: string | undefined, field: string | undefined) => {
		if (!objectName || !field || !/__c$/i.test(field)) {
			return
		}
		const fields = schemaFieldMap[objectName.toLowerCase()]
		if (fields && !fields.has(field.toLowerCase())) {
			missing.add(`${objectName}.${field}`)
		}
	}

	for (const node of nodes) {
		const meta = node?.metadata || {}
		for (const filter of meta.filters || []) {
			checkField(meta.object, filter?.field)
		}
		for (const assignment of meta.input_assignments || []) {
			checkField(meta.object, assignment?.field)
		}
		for (const item of meta.assignment_items || []) {
			const ref: string | undefined = item?.assign_to_reference
			if (typeof ref === "string" && ref.startsWith("$Record.")) {
				checkField(triggerObject, ref.slice("$Record.".length))
			}
		}
		for (const condition of meta.conditions || []) {
			const ref: string | undefined = condition?.leftValueReference
			if (typeof ref === "string" && ref.startsWith("$Record.")) {
				checkField(triggerObject, ref.slice("$Record.".length))
			}
		}
	}

	return [...missing]
}

interface SchemaRetrievalResult {
	schemaPath?: string
	objectsFound: string[]
	objectsFailed: Array<{ name: string; reason: string }>
}

async function retrieveSchemaContext(objectNames: string[], storageRoot: string): Promise<SchemaRetrievalResult> {
	if (objectNames.length === 0) {
		return { objectsFound: [], objectsFailed: [] }
	}

	const schemaDir = path.join(storageRoot, "schema")
	fs.mkdirSync(schemaDir, { recursive: true })

	const objectsFound: string[] = []
	const objectsFailed: Array<{ name: string; reason: string }> = []
	const objects: Record<string, CondensedObject> = {}

	// Run serially — parallel hidden terminals can race on the same session
	for (const name of objectNames) {
		const rawOutputFile = path.join(schemaDir, `${name}_raw.json`)
		const attempt = await describeObjectViaTerminal(name, rawOutputFile)

		if ("error" in attempt) {
			objectsFailed.push({ name, reason: attempt.error })
			continue
		}

		const condensed = condenseDescribeResult(attempt.stdout, name)
		if ("error" in condensed) {
			objectsFailed.push({ name, reason: condensed.error })
			continue
		}

		objects[name] = condensed
		objectsFound.push(name)
		try {
			fs.unlinkSync(rawOutputFile)
		} catch {
			// not critical
		}
	}

	if (objectsFound.length === 0) {
		return { objectsFound, objectsFailed }
	}

	const schemaDoc = { retrieved_at: new Date().toISOString(), objects }
	const schemaPath = path.join(schemaDir, `${buildObjectFileStem(objectsFound)}_schema.json`)
	fs.writeFileSync(schemaPath, JSON.stringify(schemaDoc, null, 2), "utf-8")
	return { schemaPath, objectsFound, objectsFailed }
}

// ---------------------------------------------------------------------------
// Python resolver
// ---------------------------------------------------------------------------

async function resolvePython(): Promise<string> {
	for (const candidate of ["python3", "python"]) {
		try {
			await execFileAsync(candidate, ["--version"], { timeout: 5000 })
			return candidate
		} catch {
			// try next
		}
	}
	throw new Error("Python 3 not found. Please install Python 3 and ensure it is in your PATH.")
}

// ---------------------------------------------------------------------------
// Tool entry point
// ---------------------------------------------------------------------------

export async function generateSfFlowTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
): Promise<void> {
	const prompt: string = block.params.prompt ?? ""
	const outputPath: string = block.params.output_path ?? "force-app/main/default/flows"

	if (block.partial) {
		await cline.ask("tool", JSON.stringify({ tool: "generateSfFlow", prompt, outputPath }), block.partial)
		return
	}

	if (!prompt.trim()) {
		await pushToolResult(formatResponse.toolError("generate_sf_flow requires a non-empty `prompt` parameter."))
		return
	}

	try {
		const provider = cline.providerRef.deref()
		const extContext = provider?.context
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath

		if (!workspaceRoot) {
			await pushToolResult(
				formatResponse.toolError("No workspace folder open. Please open a Salesforce project folder."),
			)
			return
		}

		if (!extContext) {
			await pushToolResult(formatResponse.toolError("Extension context unavailable."))
			return
		}

		// Python scripts live next to the extension bundle
		const pythonDir = path.join(extContext.extensionPath, "dist", "python")
		const promptScript = path.join(pythonDir, "prompt_to_graph.py")
		const xmlScript = path.join(pythonDir, "graph_to_flow_xml.py")
		const validatorScript = path.join(pythonDir, "flow_validator.py")

		if (!fs.existsSync(promptScript) || !fs.existsSync(xmlScript)) {
			await pushToolResult(
				formatResponse.toolError(
					`Python scripts not found at ${pythonDir}. Expected prompt_to_graph.py and graph_to_flow_xml.py.`,
				),
			)
			return
		}

		// API key + model come from the active task's provider settings
		const apiConfig = cline.apiConfiguration
		const apiKey: string =
			(apiConfig as any).openRouterApiKey || (apiConfig as any).apiKey || process.env.OPENROUTER_API_KEY || ""
		const model: string =
			(apiConfig as any).openRouterModelId || (apiConfig as any).apiModelId || "openai/gpt-4o-mini"
		// Base URL: use openrouter default; override if a custom base URL is set
		const baseUrl: string = (apiConfig as any).openRouterBaseUrl || "https://openrouter.ai/api/v1"

		if (!apiKey) {
			await pushToolResult(
				formatResponse.toolError(
					"No API key available for flow generation. Configure an OpenRouter API key in Siid-Code settings.",
				),
			)
			return
		}

		// Temp dirs in global storage (survives runs, never in workspace)
		const storageRoot = path.join(extContext.globalStorageUri.fsPath, "sfflow")
		const tempDir = path.join(storageRoot, "graphs")
		const outDir = path.join(storageRoot, "output")
		fs.mkdirSync(tempDir, { recursive: true })
		fs.mkdirSync(outDir, { recursive: true })

		const tempGraphPath = path.join(tempDir, `prompt_${Date.now()}.json`)

		// Feature label used as the UI row title (max 60 chars, matches ChatRow case)
		const flowFeature = prompt.length > 60 ? prompt.slice(0, 57) + "…" : prompt

		// Emit the anchor row — ChatRow renders this as the header; phase/success rows are folded into it
		await cline.say(
			"tool",
			JSON.stringify({ tool: "generate_sf_flow", feature: flowFeature } satisfies ClineSayTool),
		)

		const startedAt = Date.now()

		// Step 1 — extract sObject hints + retrieve schema (best-effort, never blocks)
		const schemaObjectNames = extractSchemaObjectHints(prompt)
		let schemaPath: string | undefined
		let schemaObjectsFailed: Array<{ name: string; reason: string }> = []

		if (schemaObjectNames.length > 0) {
			await cline.say(
				"tool",
				JSON.stringify({
					tool: "generate_sf_flow",
					feature: flowFeature,
					phase: "schema-detecting",
				} satisfies ClineSayTool),
			)
			try {
				const schemaResult = await retrieveSchemaContext(schemaObjectNames, storageRoot)
				schemaPath = schemaResult.schemaPath
				schemaObjectsFailed = schemaResult.objectsFailed
				const skipped =
					schemaResult.objectsFailed.length > 0
						? ` Skipped: ${schemaResult.objectsFailed.map((f) => `${f.name} (${f.reason})`).join("; ")}.`
						: ""
				if (schemaPath) {
					await cline.say(
						"tool",
						JSON.stringify({
							tool: "generate_sf_flow",
							feature: flowFeature,
							phase: "schema-done",
							content: `Schema retrieved for: ${schemaResult.objectsFound.join(", ")}.${skipped}`,
						} satisfies ClineSayTool),
					)
				} else {
					await cline.say(
						"tool",
						JSON.stringify({
							tool: "generate_sf_flow",
							feature: flowFeature,
							phase: "schema-failed",
							content: `Schema retrieval failed (${schemaResult.objectsFailed.map((f) => `${f.name}: ${f.reason}`).join("; ")}). Continuing without schema context.`,
						} satisfies ClineSayTool),
					)
				}
			} catch (err: any) {
				schemaObjectsFailed = [{ name: schemaObjectNames.join(", "), reason: err?.message || String(err) }]
				await cline.say(
					"tool",
					JSON.stringify({
						tool: "generate_sf_flow",
						feature: flowFeature,
						phase: "schema-failed",
						content: `Schema retrieval failed (${err?.message || String(err)}). Continuing without schema context.`,
					} satisfies ClineSayTool),
				)
			}
		}

		// Step 2 — prompt_to_graph.py
		const python3 = await resolvePython()

		// Context log for debugging (inside workspace, not storage)
		const contextLogDir = path.join(workspaceRoot, ".sfflow", "ai-context")
		fs.mkdirSync(contextLogDir, { recursive: true })
		const contextLogBase = buildObjectFileStem(
			schemaPath ? [path.basename(schemaPath, "_schema.json")] : schemaObjectNames,
		)
		const contextLogPath = path.join(contextLogDir, `${contextLogBase}_prompt_to_graph_context.txt`)

		const relPath = outputPath || "force-app/main/default/flows"
		const flowsDir = path.join(workspaceRoot, relPath)
		fs.mkdirSync(flowsDir, { recursive: true })

		// Steps 2-5 run in a loop: generate graph -> XML -> write to workspace -> internal sf CLI
		// dry-run validation. On a validation failure we retry once, feeding the dry-run error
		// back into the prompt so the model can self-correct (e.g. drop a field that doesn't exist).
		const MAX_ATTEMPTS = 3
		let currentPrompt = prompt
		let graphObj: any
		let missingFieldsLine = ""
		let usage: ReturnType<typeof parseUsage> | undefined
		let flowName = ""
		let xmlFileName = ""
		let destPath = ""
		let dryRunPassed = false
		let lastDryRunMessage = ""

		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			const promptToGraphArgs = [
				promptScript,
				currentPrompt,
				"--api-key",
				apiKey,
				"--model",
				model,
				"--base-url",
				baseUrl,
				"--output",
				tempGraphPath,
			]
			if (schemaPath) {
				promptToGraphArgs.push("--schema-context", schemaPath)
			}
			promptToGraphArgs.push("--context-log", contextLogPath)

			await cline.say(
				"tool",
				JSON.stringify({
					tool: "generate_sf_flow",
					feature: flowFeature,
					phase: "graph-generating",
				} satisfies ClineSayTool),
			)

			try {
				await execFileAsync(python3, promptToGraphArgs, { timeout: 120_000 })
			} catch (err: any) {
				const errUsage = extractUsageFromError(err)
				const usageLine = errUsage ? `\nToken usage: ${JSON.stringify(errUsage)}` : ""
				await cline.say(
					"tool",
					JSON.stringify({
						tool: "generate_sf_flow",
						feature: flowFeature,
						success: false,
						elapsedMs: Date.now() - startedAt,
						content: `prompt_to_graph.py failed.\n${formatProcessError("", err)}${usageLine}`,
					} satisfies ClineSayTool),
				)
				await pushToolResult(
					formatResponse.toolError(`prompt_to_graph.py failed.\n${formatProcessError("", err)}${usageLine}`),
				)
				return
			}

			// Step 3 — parse graph JSON
			try {
				graphObj = JSON.parse(fs.readFileSync(tempGraphPath, "utf-8"))
			} catch (err: any) {
				await cline.say(
					"tool",
					JSON.stringify({
						tool: "generate_sf_flow",
						feature: flowFeature,
						success: false,
						elapsedMs: Date.now() - startedAt,
						content: `Failed to read graph JSON from ${tempGraphPath}: ${err.message}`,
					} satisfies ClineSayTool),
				)
				await pushToolResult(
					formatResponse.toolError(`Failed to read graph JSON from ${tempGraphPath}: ${err.message}`),
				)
				return
			}

			await cline.say(
				"tool",
				JSON.stringify({
					tool: "generate_sf_flow",
					feature: flowFeature,
					phase: "graph-done",
				} satisfies ClineSayTool),
			)

			const missingFields = findMissingCustomFields(graphObj, loadSchemaFieldMap(schemaPath))
			const preDeployCaveats: string[] = []
			if (missingFields.length > 0) {
				preDeployCaveats.push(
					`Custom field(s) not found in org schema — create them before deploying, or deployment will fail: ${missingFields.join(", ")}`,
				)
			}
			if (schemaObjectsFailed.length > 0) {
				preDeployCaveats.push(
					`Schema retrieval failed for ${schemaObjectsFailed.map((f) => f.name).join(", ")} — field names on these object(s) were NOT validated; verify manually before deploying.`,
				)
			}
			missingFieldsLine =
				preDeployCaveats.length > 0 ? "\n" + preDeployCaveats.map((c) => `⚠️ Warning: ${c}`).join("\n") : ""

			usage = parseUsage(graphObj.usage)
			flowName = (graphObj.flow_name || "unnamed_flow").toLowerCase().replace(/[^a-z0-9_]/g, "_")

			// Step 4 — graph_to_flow_xml.py
			const xmlFile = path.join(outDir, `${flowName}.flow-meta.xml`)

			await cline.say(
				"tool",
				JSON.stringify({
					tool: "generate_sf_flow",
					feature: flowFeature,
					phase: "xml-generating",
				} satisfies ClineSayTool),
			)

			try {
				// Generate as Active: Salesforce only validates formulas/fields strictly for Active
				// flows, so Draft would pass dry-run and only fail later on manual activation.
				await execFileAsync(python3, [xmlScript, tempGraphPath, xmlFile, "--status", "Active"], {
					timeout: 30_000,
				})
			} catch (err: any) {
				await cline.say(
					"tool",
					JSON.stringify({
						tool: "generate_sf_flow",
						feature: flowFeature,
						success: false,
						elapsedMs: Date.now() - startedAt,
						content: `graph_to_flow_xml.py failed.\n${formatProcessError("", err)}`,
					} satisfies ClineSayTool),
				)
				await pushToolResult(
					formatResponse.toolError(`graph_to_flow_xml.py failed.\n${formatProcessError("", err)}`),
				)
				return
			}

			if (!fs.existsSync(xmlFile)) {
				await cline.say(
					"tool",
					JSON.stringify({
						tool: "generate_sf_flow",
						feature: flowFeature,
						success: false,
						elapsedMs: Date.now() - startedAt,
						content: "graph_to_flow_xml.py completed but did not produce an XML file.",
					} satisfies ClineSayTool),
				)
				await pushToolResult(
					formatResponse.toolError("graph_to_flow_xml.py completed but did not produce an XML file."),
				)
				return
			}

			await cline.say(
				"tool",
				JSON.stringify({
					tool: "generate_sf_flow",
					feature: flowFeature,
					phase: "xml-done",
				} satisfies ClineSayTool),
			)

			// Step 5 — copy XML to workspace flows dir
			xmlFileName = `${flowName}.flow-meta.xml`
			destPath = path.join(flowsDir, xmlFileName)
			const xmlText = fs.readFileSync(xmlFile, "utf-8")

			try {
				fs.writeFileSync(destPath, xmlText, "utf-8")
			} catch (err: any) {
				await pushToolResult(
					formatResponse.toolError(`Failed to write XML file to ${destPath}: ${err.message}`),
				)
				return
			}

			// Internal validation — dry-run deploy the generated Flow via sf CLI before declaring success.
			// metadata name must be the file's base name (flowName), not the human-readable flow_name label.
			await cline.say(
				"tool",
				JSON.stringify({
					tool: "generate_sf_flow",
					feature: flowFeature,
					phase: "validating",
				} satisfies ClineSayTool),
			)
			try {
				const dryRunCommand = buildSfDeployCommand(
					"Flow",
					flowName,
					undefined,
					"NoTestRun",
					undefined,
					true,
					true,
					workspaceRoot,
				)
				const dryRunOutput = await runSfCliCommand(dryRunCommand, workspaceRoot, 300_000)
				const dryRunResult = formatDryRunResult(dryRunOutput, "Flow", flowName, "NoTestRun")
				dryRunPassed = dryRunResult.success
				lastDryRunMessage = dryRunResult.message
			} catch (dryRunErr: any) {
				dryRunPassed = false
				lastDryRunMessage = dryRunErr.stdout
					? formatDryRunResult(dryRunErr.stdout, "Flow", flowName, "NoTestRun").message
					: dryRunErr?.message || String(dryRunErr)
			}

			if (dryRunPassed) {
				break
			}

			if (attempt < MAX_ATTEMPTS) {
				await cline.say(
					"tool",
					JSON.stringify({
						tool: "generate_sf_flow",
						feature: flowFeature,
						phase: "retrying",
						content: `Dry-run validation failed, regenerating with the error fed back:\n${lastDryRunMessage}`,
					} satisfies ClineSayTool),
				)
				currentPrompt = `${prompt}\n\nThe previous attempt failed sf CLI dry-run validation with this error — fix it:\n${lastDryRunMessage}`
			}
		}

		if (!dryRunPassed) {
			await cline.say(
				"tool",
				JSON.stringify({
					tool: "generate_sf_flow",
					feature: flowFeature,
					success: false,
					elapsedMs: Date.now() - startedAt,
					content: `Flow generated but failed internal dry-run validation after ${MAX_ATTEMPTS} attempts.\n${lastDryRunMessage}`,
				} satisfies ClineSayTool),
			)
			await pushToolResult(
				formatResponse.toolError(
					`Flow generated but failed sf CLI dry-run validation after ${MAX_ATTEMPTS} attempts. Do not hand-edit the XML — fix the reported cause (e.g. create a missing field) and call generate_sf_flow again.\n${lastDryRunMessage}`,
				),
			)
			return
		}

		// Step 6 — ensure package.xml includes Flow metadata type
		const packageXmlPath = path.join(workspaceRoot, "manifest", "package.xml")
		if (fs.existsSync(packageXmlPath)) {
			try {
				let pkgXml = fs.readFileSync(packageXmlPath, "utf-8")
				if (!pkgXml.includes("<name>Flow</name>")) {
					// Insert a Flow <types> block before </Package>
					const flowTypes =
						"    <types>\n        <members>*</members>\n        <name>Flow</name>\n    </types>\n"
					pkgXml = pkgXml.replace("</Package>", `${flowTypes}</Package>`)
					fs.writeFileSync(packageXmlPath, pkgXml, "utf-8")
					await cline.say(
						"tool",
						JSON.stringify({
							tool: "generate_sf_flow",
							feature: flowFeature,
							phase: "pkg-updated",
						} satisfies ClineSayTool),
					)
				}
			} catch {
				// non-critical — deploy will surface the issue
			}
		}

		// Clean up temp graph file
		try {
			fs.unlinkSync(tempGraphPath)
		} catch {
			// not critical
		}

		const usageLine = usage ? `\nToken usage: ${JSON.stringify(usage)}` : ""
		const contextLine = fs.existsSync(contextLogPath)
			? `\nAI context logged to: ${path.join(".sfflow", "ai-context", path.basename(contextLogPath))}`
			: ""

		await cline.say(
			"tool",
			JSON.stringify({
				tool: "generate_sf_flow",
				feature: flowFeature,
				success: true,
				elapsedMs: Date.now() - startedAt,
				content: `Flow name: ${graphObj.flow_name}\nFile: ${path.join(relPath, xmlFileName)}${usageLine}${contextLine}${missingFieldsLine}`,
			} satisfies ClineSayTool),
		)
		await pushToolResult(
			formatResponse.toolResult(
				`Flow generated successfully.\nFlow name: ${graphObj.flow_name}\nFile: ${path.join(relPath, xmlFileName)}${usageLine}${contextLine}${missingFieldsLine}`,
			),
		)
	} catch (err: any) {
		await handleError("generating SF flow", err)
	}
}

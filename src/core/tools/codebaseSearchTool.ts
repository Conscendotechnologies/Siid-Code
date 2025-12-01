import * as vscode from "vscode"

import { Task } from "../task/Task"
import { CodeIndexManager } from "../../services/code-index/manager"
import { getWorkspacePath } from "../../utils/path"
import { formatResponse } from "../prompts/responses"
import { VectorStoreSearchResult } from "../../services/code-index/interfaces"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag, ToolUse } from "../../shared/tools"
import path from "path"
import { regexSearchFiles } from "../../services/ripgrep"
const searchCache = new Map<string, { ts: number; kind: "index" | "fallback"; payload: any; output: string }>()
const CACHE_TTL = 5 * 60 * 1000
const fileWatcher = vscode.workspace.createFileSystemWatcher("**/*")
fileWatcher.onDidChange((uri) => {
  const filePath = uri.fsPath
  for (const [key, value] of searchCache.entries()) {
    const c = value.payload?.content
    if (c && Array.isArray(c.results) && c.results.some((r: any) => r.filePath && filePath.includes(r.filePath))) {
      searchCache.delete(key)
    }
  }
})
fileWatcher.onDidDelete(() => {
  searchCache.clear()
})

function detectFilePattern(query: string): string | undefined {
  const ql = query.toLowerCase()
  const patterns: Record<string, string> = {
    test: "**/*.{test,spec}.{ts,tsx,js,jsx}",
    component: "**/*.{tsx,jsx}",
    util: "**/*{util,utils,helper,helpers}*.{ts,js}",
    config: "**/*{config,configuration}*.{ts,js,json}",
    type: "**/*.{d.ts,types.ts}",
    style: "**/*.{css,scss,sass,less}",
    api: "**/*{api,service,client}*.{ts,js}",
    hook: "**/*{use,hook}*.{ts,tsx,js,jsx}",
    model: "**/*{model,schema,entity}*.{ts,js}",
    controller: "**/*{controller,handler,route}*.{ts,js}",
  }
  for (const k of Object.keys(patterns)) {
    if (ql.includes(k)) return patterns[k]
  }
  return undefined
}

function getSalesforceFilePattern(query: string): string | undefined {
  const ql = query.toLowerCase()
  const patterns: Record<string, string> = {
    apex: "**/*.{cls,trigger}",
    class: "**/*.cls",
    trigger: "**/*.trigger",
    test: "**/*Test.cls",
    controller: "**/*Controller.cls",
    helper: "**/*Helper.cls",
    service: "**/*Service.cls",
    handler: "**/*Handler.cls",
    selector: "**/*Selector.cls",
    batch: "**/*Batch*.cls",
    queueable: "**/*Queueable*.cls",
    lwc: "**/lwc/**/*.{js,html,css}",
    component: "**/lwc/**/*.{js,html}",
    wire: "**/lwc/**/*.js",
    javascript: "**/lwc/**/*.js",
    html: "**/lwc/**/*.html",
    aura: "**/aura/**/*.{js,cmp,css}",
    visualforce: "**/*.{page,component}",
    vf: "**/*.{page,component}",
    metadata: "**/*-meta.xml",
    object: "**/objects/**/*.xml",
    field: "**/objects/**/*.field-meta.xml",
    permission: "**/*.permissionset-meta.xml",
    profile: "**/*.profile-meta.xml",
    flow: "**/*.flow-meta.xml",
    layout: "**/*.layout-meta.xml",
    payment: "**/*{Payment,Transaction,Charge,Refund}*.cls",
    integration: "**/*{Integration,Callout,Service,Http,REST}*.cls",
    validation: "**/*{Validation,Validator}*.{cls,trigger}",
  }
  for (const k of Object.keys(patterns)) {
    if (ql.includes(k)) return patterns[k]
  }
  return undefined
}

function detectSalesforcePattern(query: string): string | undefined {
  const ql = query.toLowerCase()
  if (/(find|get|search).*(auraenabled|api)/.test(ql)) return "**/*.cls"
  if (/(trigger|before|after).*(insert|update|delete)/.test(ql)) return "**/*.trigger"
  if (/(wire|@wire|getrecord)/.test(ql)) return "**/lwc/**/*.js"
  if (/(test|testsetup|assert)/.test(ql)) return "**/*Test.cls"
  if (/(soql|select.*from|database\.query)/.test(ql)) return "**/*.{cls,trigger}"
  return getSalesforceFilePattern(query)
}

function getSalesforceRegexPattern(query: string): string {
  const ql = query.toLowerCase()
  if (ql.includes("payment") || ql.includes("transaction") || ql.includes("charge")) {
    return "(Payment|Transaction|Charge|Refund|Invoice|Spreedly|Razorpay|TapPay)\\w*"
  }
  if (ql.includes("integration") || ql.includes("callout") || ql.includes("http")) {
    return "(Http|REST|SOAP|Callout|Integration|@RestResource)\\w*"
  }
  if (ql.includes("@auraenabled") || ql.includes("auraenabled")) {
    return "@AuraEnabled\\s*(\\(.*?\\))?\\s*(public|global)"
  }
  if (ql.includes("@future")) {
    return "@future\\s*(\\(.*?\\))?"
  }
  if (ql.includes("@invocable")) {
    return "@InvocableMethod\\s*(\\(.*?\\))?"
  }
  if (ql.includes("trigger")) {
    return "trigger\\s+\\w+\\s+on\\s+\\w+\\s*\\(.*?\\)"
  }
  if (ql.includes("trigger.new") || ql.includes("trigger.old")) {
    return "Trigger\\.(new|old|newMap|oldMap)"
  }
  if (ql.includes("soql") || ql.includes("query")) {
    return "\\[(SELECT|select)\\s+.*?(FROM|from)\\s+\\w+"
  }
  if (ql.includes("@wire") || ql.includes("wire")) {
    return "@wire\\s*\\([^\\)]+\\)"
  }
  if (ql.includes("import") && ql.includes("lwc")) {
    return "import\\s+.*?from\\s+['\"]@salesforce"
  }
  if (ql.includes("batch") || ql.includes("batchable")) {
    return "implements\\s+Database\\.Batchable"
  }
  if (ql.includes("queueable")) {
    return "implements\\s+Queueable"
  }
  if (ql.includes("schedulable")) {
    return "implements\\s+Schedulable"
  }
  if (ql.includes("test") || ql.includes("@istest")) {
    return "(@isTest|@TestSetup|Test\\.startTest|System\\.assert)"
  }
  if (ql.includes("dml") || ql.includes("insert") || ql.includes("update")) {
    return "(insert|update|delete|upsert|Database\\.(insert|update|delete|upsert))\\s+"
  }
  if (ql.includes("schema") || ql.includes("describe")) {
    return "Schema\\.(SObjectType|DescribeSObjectResult|FieldSet)"
  }
  return query.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")
}

function generateSmartVariations(query: string): string[] {
  const variations: string[] = []
  const ql = query.toLowerCase()
  const camelSplit = query.replace(/([a-z])([A-Z])/g, "$1 $2")
  if (camelSplit !== query) variations.push(camelSplit)
  const withoutPrefix = query.replace(/^(handle|on|get|set|is|has|fetch|load|create|update|delete)/i, "")
  if (withoutPrefix !== query && withoutPrefix.length > 2) variations.push(withoutPrefix)
  const sfSynonyms: Record<string, string> = {
    lwc: "@wire",
    api: "@AuraEnabled",
    async: "@future",
    test: "@isTest",
    trigger: "Trigger.new",
    soql: "SELECT",
  }
  for (const [key, expansion] of Object.entries(sfSynonyms)) {
    if (ql.includes(key)) {
      variations.push(expansion)
      break
    }
  }
  return variations.slice(0, 2)
}

type RegexSearchResult = {
  filePath: string
  line: number
  lineEnd: number
  text: string
  score: number
}

function parseRipgrepResults(text: string, query: string, context: any): RegexSearchResult[] {
  const results: RegexSearchResult[] = []
  let currentPath = ""
  const lines = text.split("\n")
  const ql = query.toLowerCase()
  for (const line of lines) {
    if (line.startsWith("# ")) {
      currentPath = line.slice(2).trim()
      continue
    }
    const match = line.match(/^\s*(\d+)\s\|\s(.*)$/)
    if (match && currentPath) {
      const lineNum = Number(match[1])
      const t = match[2]
      const tl = t.toLowerCase()
      let score = 0.5
      if (tl.includes(ql)) score += 0.3
      if ((/@AuraEnabled/.test(t))) score += 0.25
      if ((/@wire/.test(t))) score += 0.25
      if ((/@future/.test(t))) score += 0.2
      if ((/@InvocableMethod/.test(t))) score += 0.2
      if ((/@isTest/.test(t))) score += 0.15
      if (/^(public|global|private|protected)\s+(class|interface|enum)/.test(t.trim())) score += 0.3
      if (/^(public|global)\s+(static\s+)?(\w+)\s+\w+\s*\(/.test(t.trim())) score += 0.25
      if (/^trigger\s+\w+\s+on\s+\w+/.test(t.trim())) score += 0.4
      if (/\[SELECT\s+.*?FROM\s+\w+/i.test(t)) score += 0.2
      if (/payment|transaction|charge|refund/i.test(currentPath)) score += 0.15
      if (/integration|callout|http/i.test(currentPath)) score += 0.15
      if (context?.currentFileType === "apex" && currentPath.endsWith(".cls")) score += 0.2
      if (context?.currentFileType === "lwc" && (currentPath.includes("/lwc/") || currentPath.includes("\\lwc\\"))) score += 0.2
      if (context?.componentName && currentPath.includes(context.componentName)) score += 0.3
      if (context?.relatedFiles?.some((rf: string) => currentPath.endsWith(rf))) score += 0.4
      if (!ql.includes("test") && currentPath.includes("Test.cls")) score *= 0.4
      results.push({ filePath: currentPath, line: lineNum, lineEnd: lineNum, text: t.trim(), score })
    }
  }
  results.sort((a, b) => b.score - a.score)
  return results
}

function getSalesforceContext() {
  const editor = vscode.window.activeTextEditor
  if (!editor) return {}
  const filePath = editor.document.uri.fsPath
  const fileName = path.basename(filePath)
  let currentFileType: "apex" | "lwc" | "aura" | "vf" | "trigger" | undefined
  let componentName: string | undefined
  let relatedFiles: string[] = []
  if (filePath.endsWith(".cls")) currentFileType = "apex"
  else if (filePath.endsWith(".trigger")) currentFileType = "trigger"
  else if (filePath.includes("/lwc/") || filePath.includes("\\lwc\\")) currentFileType = "lwc"
  else if (filePath.includes("/aura/") || filePath.includes("\\aura\\")) currentFileType = "aura"
  else if (filePath.endsWith(".page") || filePath.endsWith(".component")) currentFileType = "vf"
  if (currentFileType === "lwc") {
    const parts = filePath.split(/\\|\//)
    const idx = parts.findIndex((p) => p === "lwc")
    if (idx >= 0 && parts[idx + 1]) componentName = parts[idx + 1]
  }
  if (currentFileType === "apex" && fileName.includes("Test.cls")) {
    const base = fileName.replace(/Test\.cls$/, "")
    relatedFiles = [base + ".cls"]
  }
  return { currentFileType, componentName, relatedFiles }
}

function rankSalesforceResults(results: VectorStoreSearchResult[], query: string): VectorStoreSearchResult[] {
  const ql = query.toLowerCase()
  return results
    .map((r) => {
      let s = r.score
      const fp = String(r.payload?.filePath || "")
      const chunk = String(r.payload?.codeChunk || "").toLowerCase()
      if (ql.includes("trigger") && fp.endsWith(".trigger")) s *= 1.3
      if (ql.includes("apex") && fp.endsWith(".cls")) s *= 1.2
      if ((ql.includes("wire") || ql.includes("@wire")) && fp.includes("lwc")) s *= 1.2
      if (ql.includes("@auraenabled") && chunk.includes("@auraenabled")) s *= 1.3
      if (ql.includes("soql") && /\[select\s+.*from\s+\w+/.test(chunk)) s *= 1.25
      return { ...r, score: s }
    })
    .sort((a, b) => b.score - a.score)
}

function rankWithSalesforceContext(results: VectorStoreSearchResult[], context: any): VectorStoreSearchResult[] {
  if (!context) return results
  return results
    .map((r) => {
      let s = r.score
      const fp = String(r.payload?.filePath || "")
      if (context.relatedFiles && context.relatedFiles.some((rf: string) => fp.endsWith(rf))) s *= 1.8
      if (context.componentName && fp.includes(String(context.componentName))) s *= 1.6
      if (context.currentFileType === "lwc" && fp.includes("lwc")) s *= 1.3
      else if (context.currentFileType === "apex" && fp.endsWith(".cls")) s *= 1.3
      else if (context.currentFileType === "trigger" && fp.endsWith(".trigger")) s *= 1.3
      return { ...r, score: s }
    })
    .sort((a, b) => b.score - a.score)
}

function generateQueryVariations(query: string): string[] {
  const variations: string[] = []
  const camelSplit = query.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()
  if (camelSplit !== query.toLowerCase()) variations.push(camelSplit)
  const withoutPrefix = query.replace(/^(handle|on|get|set|is|has|fetch|load)/, "")
  if (withoutPrefix !== query && withoutPrefix.length > 2) variations.push(withoutPrefix)
  const words = query.split(" ")
  if (words.length > 2) {
    variations.push(words.slice(0, 2).join(" "))
    variations.push(words.slice(-2).join(" "))
  }
  return variations.slice(0, 3)
}

function rankResults(results: VectorStoreSearchResult[], query: string): VectorStoreSearchResult[] {
  const q = query.toLowerCase()
  return results
    .map((r) => {
      let boost = 1
      const chunk = String(r.payload?.codeChunk || "").toLowerCase()
      if (chunk.includes(q)) boost *= 1.5
      if (/^(export )?(function|class|const|interface|type)\s/.test(String(r.payload?.codeChunk || "").trim())) boost *= 1.3
      const ext = path.extname(String(r.payload?.filePath || ""))
      if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) boost *= 1.2
      if (String(r.payload?.codeChunk || "").length < 500) boost *= 1.1
      return { ...r, score: r.score * boost }
    })
    .sort((a, b) => b.score - a.score)
}

function rankWithContext(results: VectorStoreSearchResult[], contextPath?: string): VectorStoreSearchResult[] {
  if (!contextPath) return results
  return results
    .map((r) => {
      let s = r.score
      const resultDir = path.dirname(String(r.payload?.filePath || ""))
      if (resultDir === contextPath) s *= 1.4
      else if (resultDir.startsWith(contextPath) || contextPath.startsWith(resultDir)) s *= 1.2
      return { ...r, score: s }
    })
    .sort((a, b) => b.score - a.score)
}

type RegexMatch = { filePath: string; line: number; text: string }
function parseRegexResults(text: string): RegexMatch[] {
  const out: RegexMatch[] = []
  let currentPath = ""
  const lines = text.split("\n")
  for (const line of lines) {
    if (line.startsWith("# ")) {
      currentPath = line.slice(2).trim()
      continue
    }
    const m = line.match(/^\s*(\d+)\s\|\s(.*)$/)
    if (m && currentPath) out.push({ filePath: currentPath, line: Number(m[1]), text: m[2] })
  }
  return out
}

function mergeAndDeduplicateResults(
  vector: VectorStoreSearchResult[],
  regexText: string,
  maxResults: number,
  query: string,
  contextPath?: string,
) {
  const sfCtx = getSalesforceContext()
  const rankedVector = rankWithSalesforceContext(rankWithContext(rankSalesforceResults(rankResults(vector, query), query), contextPath), sfCtx)
  const regexMatches = parseRipgrepResults(regexText, query, sfCtx)
  const unified: { filePath: string; score: number; startLine: number; endLine: number; codeChunk: string }[] = []
  const seen = new Set<string>()
  for (const r of rankedVector) {
    if (!r.payload) continue
    const fp = String(r.payload.filePath || "")
    const chunk = String(r.payload.codeChunk || "").trim()
    const k = `${fp}:${r.payload.startLine}:${r.payload.endLine}:${chunk}`
    if (seen.has(k)) continue
    seen.add(k)
    unified.push({ filePath: fp, score: r.score, startLine: r.payload.startLine, endLine: r.payload.endLine, codeChunk: chunk })
  }
  for (const m of regexMatches) {
    const fp = m.filePath
    const chunk = m.text
    const overlap = unified.some((u) => u.filePath === fp && m.line >= u.startLine && m.line <= u.endLine && u.codeChunk.includes(chunk))
    if (overlap) continue
    const k = `${fp}:${m.line}:${m.lineEnd}:${chunk.substring(0,50)}`
    if (seen.has(k)) continue
    seen.add(k)
    unified.push({ filePath: fp, score: m.score, startLine: m.line, endLine: m.lineEnd, codeChunk: chunk })
  }
  unified.sort((a, b) => b.score - a.score)
  return unified.slice(0, maxResults)
}

export async function codebaseSearchTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const toolName = "codebase_search"
	const workspacePath = getWorkspacePath()

	if (!workspacePath) {
		// This case should ideally not happen if Cline is initialized correctly
		await handleError(toolName, new Error("Could not determine workspace path."))
		return
	}

	// --- Parameter Extraction and Validation ---
  let query: string | undefined = (block.params as any).query
  let directoryPrefix: string | undefined = block.params.path
  let filePattern: string | undefined = (block.params as any).file_pattern
  let maxResultsParam: any = (block.params as any).size ?? (block.params as any).max_results

  query = removeClosingTag("search", query)

	if (directoryPrefix) {
		directoryPrefix = removeClosingTag("path", directoryPrefix)
		directoryPrefix = path.normalize(directoryPrefix)
	}

  if (filePattern) {
    filePattern = String(filePattern)
  }

	let maxResults = 10
  if (typeof maxResultsParam !== "undefined") {
    const cleaned = (block.params as any).size !== undefined
      ? removeClosingTag("size", String(maxResultsParam))
      : String(maxResultsParam)
    const parsed = Number(cleaned)
    if (!Number.isNaN(parsed) && parsed > 0) {
      maxResults = parsed
    }
  }

	const sharedMessageProps = {
		tool: "codebaseSearch",
		query: query,
		path: directoryPrefix,
		filePattern,
		maxResults,
		isOutsideWorkspace: false,
	}

	if (block.partial) {
		await cline.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
		return
	}

	if (!query) {
		cline.consecutiveMistakeCount++
		pushToolResult(await cline.sayAndCreateMissingParamError(toolName, "query"))
		return
	}

	const didApprove = await askApproval("tool", JSON.stringify(sharedMessageProps))
	if (!didApprove) {
		pushToolResult(formatResponse.toolDenied())
		return
	}

	cline.consecutiveMistakeCount = 0

	// --- Core Logic ---
	try {
		const context = cline.providerRef.deref()?.context
		if (!context) {
			throw new Error("Extension context is not available.")
		}

		const manager = CodeIndexManager.getInstance(context)

		if (!manager) {
			throw new Error("CodeIndexManager is not available.")
		}

		const canUseIndex = manager.isFeatureEnabled && manager.isFeatureConfigured && manager.isInitialized
		const cwd = workspacePath
		const baseDir = directoryPrefix ? path.resolve(workspacePath, directoryPrefix) : workspacePath
		const cleanedQuery = String(query).trim().replace(/\s+/g, " ")
    if (!filePattern) {
      const detected = detectFilePattern(cleanedQuery) || detectSalesforcePattern(cleanedQuery)
      if (detected) filePattern = detected
    }
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")
    const regex = getSalesforceRegexPattern(cleanedQuery)
		const cacheKey = `${cleanedQuery}:${directoryPrefix || ""}:${filePattern || ""}:${maxResults}`
		const cached = searchCache.get(cacheKey)
		if (cached && Date.now() - cached.ts < CACHE_TTL) {
			await cline.say("codebase_search_result", JSON.stringify(cached.payload))
			pushToolResult(cached.output)
			return
		}
		const vectorPromise = canUseIndex ? manager.searchIndex(query, directoryPrefix) : Promise.resolve([])
		const regexPromise = regexSearchFiles(cwd, baseDir, regex, filePattern, cline.rooIgnoreController)
    const [vecSet, regSet] = await Promise.allSettled([vectorPromise, regexPromise])
    let vectorResults: VectorStoreSearchResult[] = []
    let regexText = ""
    if (vecSet.status === "fulfilled") {
      vectorResults = vecSet.value as VectorStoreSearchResult[]
    }
    if (regSet.status === "fulfilled") {
      regexText = regSet.value as string
    }
    if (!regexText || regexText.trim().length === 0 || /^No results found/i.test(regexText)) {
      const v1 = generateQueryVariations(cleanedQuery)
      const v2 = generateSmartVariations(cleanedQuery)
      const variations = Array.from(new Set([...v1, ...v2])).slice(0, 4)
      if (variations.length > 0) {
        const extraPromises = variations.map((v) => regexSearchFiles(cwd, baseDir, escapeRegex(v), filePattern, cline.rooIgnoreController))
        const extras = await Promise.allSettled(extraPromises)
        const parts: string[] = []
        for (const ex of extras) {
          if (ex.status === "fulfilled") {
            const t = ex.value as string
            if (t && t.trim().length > 0 && !/^No results found/i.test(t)) parts.push(t)
          }
        }
        if (parts.length > 0) regexText = parts.join("\n")
      }
    }
    const merged = mergeAndDeduplicateResults(vectorResults, regexText, maxResults, cleanedQuery, baseDir)
    if (!merged || merged.length === 0) {
      const suggestions = (function generateSearchSuggestions(query: string, filePattern?: string) {
        const ql = query.toLowerCase()
        const s: string[] = []
        if (filePattern) s.push("Try without file pattern filter")
        if (ql.includes("lwc")) {
          s.push('Try: "@wire"')
          s.push('Try searching in: **/lwc/**/*.js')
        } else if (ql.includes("trigger")) {
          s.push('Try: "Trigger.new"')
          s.push('Try searching in: **/*.trigger')
        } else if (ql.includes("test")) {
          s.push('Try: "@isTest"')
          s.push('Try searching in: **/*Test.cls')
        } else if (ql.includes("api") || ql.includes("auraenabled")) {
          s.push('Try: "@AuraEnabled"')
          s.push('Try searching in: **/*Controller.cls')
        } else if (ql.includes("payment") || ql.includes("transaction")) {
          s.push('Try: "Payment" or "Transaction"')
          s.push('Try searching in: **/*Payment*.cls')
        } else if (ql.includes("integration")) {
          s.push('Try: "Http" or "Callout"')
          s.push('Try searching in: **/*Integration*.cls')
        }
        return s.slice(0, 3)
      })(cleanedQuery, filePattern)
      let msg = `No relevant code snippets found for the query: "${query}"`
      if (suggestions.length > 0) {
        msg += `\n\nSuggestions:\n${suggestions.map((s) => `  • ${s}`).join("\n")}`
      }
      pushToolResult(msg)
      return
    }
    const jsonResult = { query, results: merged.map((r) => ({
      filePath: vscode.workspace.asRelativePath(r.filePath, false),
      score: r.score,
      startLine: r.startLine,
      endLine: r.endLine,
      codeChunk: r.codeChunk,
    })) }
    const payload = { tool: "codebaseSearch", content: jsonResult }
    await cline.say("codebase_search_result", JSON.stringify(payload))
    const output = `Query: ${query}\nResults:\n\n${jsonResult.results
      .map((r) => `File path: ${r.filePath}\nScore: ${r.score}\nLines: ${r.startLine}-${r.endLine}\nCode Chunk: ${r.codeChunk}\n`)
      .join("\n")}`
    pushToolResult(output)
    searchCache.set(cacheKey, { ts: Date.now(), kind: vectorResults.length > 0 ? "index" : "fallback", payload, output })
	} catch (error: any) {
		await handleError(toolName, error) // Use the standard error handler
	}
}

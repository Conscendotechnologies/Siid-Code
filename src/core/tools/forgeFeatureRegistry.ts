import type { SiidForgeApi, SfCommandStatus } from "@conscendotech/siid-forge-api"

/** Real-time lifecycle callback for `sf` commands (forwarded to Forge's onStatus). */
export type ForgeStatusCallback = (status: SfCommandStatus) => void

/**
 * Feature registry for the single `siid_forge` tool.
 *
 * ONE tool exposes many SIID Forge capabilities; the model picks a capability via the `feature`
 * parameter and passes `args`. This registry is the single source of truth — both the tool handler
 * (dispatch + validation + approval gating) and the model-facing prompt description are generated
 * from it, so they can never drift.
 *
 * Every feature dispatches to forge's ALREADY-HEADLESS public API (`SiidForgeApi`); this file adds
 * no Salesforce logic of its own. Mutating features are flagged so the tool asks the user for
 * approval before running them.
 */

/** One declared argument for a feature (drives validation + the prompt docs). */
export interface ForgeArgSpec {
	name: string
	type: "string" | "number" | "boolean" | "string[]" | "object" | "object[]"
	required: boolean
	description: string
	/** For string args: the allowed values. If set, a value outside the set is rejected. */
	enum?: string[]
}

export interface ForgeFeature {
	/** The `feature` value the model passes, e.g. "query". */
	name: string
	/** One-line description for the model. */
	summary: string
	/** True if it writes to the org / mutates files / handles credentials → requires approval. */
	mutating: boolean
	/** Declared args (validated before dispatch; documented to the model). */
	args: ForgeArgSpec[]
	/** Optional one-liner describing the result shape, for features whose output isn't obvious. */
	returns?: string
	/**
	 * Dispatch to the forge API. `args` has already been shape-validated against `args` above.
	 * Return any JSON-serializable result; it becomes the tool result the model sees.
	 * `onStatus` (optional) receives real `sf` command lifecycle updates for features that run
	 * commands (deploy, sfRun, …), so the UI can show Forge's real elapsed time + terminal phase.
	 */
	run(forge: SiidForgeApi, args: Record<string, unknown>, onStatus?: ForgeStatusCallback): Promise<unknown>
}

/** Minimum forge API version this tool relies on. */
export const REQUIRED_FORGE_VERSION = "2.14.0" // needs data/formula/diff/stdlib/batch-log namespaces

// Safe only for args declared in the feature's args spec (validated upstream by validateForgeArgs).
const str = (a: Record<string, unknown>, k: string) => a[k] as string
const opt = <T>(a: Record<string, unknown>, k: string) => a[k] as T | undefined

/**
 * The curated feature set. All are exposed; `mutating: true` ones are approval-gated by the handler.
 * Read features first, then the powerful/mutating ones.
 */
export const FORGE_FEATURES: ForgeFeature[] = [
	// ─────────────── read / inspect (safe, run directly) ───────────────
	{
		name: "query",
		summary: "Run a SOQL query and return the records (like `sf data query`).",
		returns: "{totalSize, done, records[]} — rows are under .records.",
		mutating: false,
		args: [
			{ name: "soql", type: "string", required: true, description: "The SOQL query string." },
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		run: (forge, a) => forge.data.query(str(a, "soql"), { projectRoot: opt<string>(a, "projectRoot") }),
	},
	{
		name: "describeObject",
		summary: "Describe an SObject's schema (fields, picklists) from the org.",
		returns:
			"Object schema {name, fields[{name,type,picklistValues,referenceTo,relationshipName,...}]}, or {described:true, schema:null} if not readable.",
		mutating: false,
		args: [
			{ name: "name", type: "string", required: true, description: "SObject API name, e.g. Account." },
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		run: async (forge, a) => {
			await forge.schema.describeObject(str(a, "name"), opt<string>(a, "projectRoot"))
			return (
				forge.schema.readObject(str(a, "name"), opt<string>(a, "projectRoot")) ?? {
					described: true,
					schema: null,
					note: "describe ran but no readable schema was returned",
				}
			)
		},
	},
	{
		name: "listObjects",
		summary: "List the SObject API names available in the project.",
		mutating: false,
		args: [
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		run: async (forge, a) => forge.schema.listObjects(opt<string>(a, "projectRoot")),
	},
	{
		name: "readApex",
		summary: "Read a parsed Apex class's schema (methods, properties) from the project.",
		mutating: false,
		args: [
			{ name: "name", type: "string", required: true, description: "Apex class name." },
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		run: async (forge, a) => forge.schema.readApex(str(a, "name"), opt<string>(a, "projectRoot")) ?? null,
	},
	{
		name: "listOrgs",
		summary: "List authorized Salesforce orgs.",
		mutating: false,
		args: [{ name: "force", type: "boolean", required: false, description: "Bypass the ~30s cache." }],
		run: async (forge, a) => forge.orgs.list(opt<boolean>(a, "force")),
	},
	{
		name: "getDefaultOrg",
		summary: "Get the default org username/alias for the project.",
		mutating: false,
		args: [],
		run: async (forge) => (await forge.orgs.getDefault()) ?? null,
	},
	{
		name: "getCoverage",
		summary: "Get stored Apex code-coverage for a class.",
		returns: "{name, coveredPercent, totalLines, covered[], uncovered[], capturedAt}.",
		mutating: false,
		args: [
			{ name: "className", type: "string", required: true, description: "Apex class name." },
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		run: async (forge, a) => forge.coverage.get(str(a, "className"), opt<string>(a, "projectRoot")) ?? null,
	},
	{
		name: "analyzeLog",
		summary: "Analyze an Apex debug log string (governor limits, timings, SOQL/DML, errors).",
		returns: "LogAnalysis {limits[], hotMethods[], dataOps[], insights[], counts, errors[], truncated, isFinest}.",
		mutating: false,
		args: [{ name: "rawLog", type: "string", required: true, description: "The raw Apex debug log text." }],
		run: async (forge, a) => forge.logs.analyze(str(a, "rawLog")),
	},
	{
		name: "runApexTests",
		summary: "Run a class's Apex tests against the org and return structured results.",
		returns:
			"{passing, failing, testsRan, classCoverage?, reportPath, logFiles[], result}. `result.summary.outcome` is Passed/Failed and `result.tests[]` carries each failure's Message and StackTrace. Includes coverage — a separate getCoverage call is usually unnecessary. Debug logs are captured by default; read one with analyzeLogFile when Message/StackTrace is not enough.",
		mutating: false,
		args: [
			{ name: "className", type: "string", required: true, description: "Apex test class name to run." },
			{
				name: "debug",
				type: "boolean",
				required: false,
				description:
					"Capture debug logs and return their paths in logFiles[]. Defaults to true — pass false only to skip the trace-flag setup on a routine run.",
			},
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		// debug defaults ON: a failing run is the common case for calling this, and
		// without it logFiles[] is always empty, so the log is gone by the time
		// anyone wants it.
		run: async (forge, a) =>
			forge.apexTests.run(str(a, "className"), {
				debug: opt<boolean>(a, "debug") ?? true,
				projectRoot: opt<string>(a, "projectRoot"),
			}),
	},
	{
		name: "getUsername",
		summary: "Get the resolved username of the default org.",
		mutating: false,
		args: [],
		run: async (forge) => (await forge.orgs.getUsername()) ?? null,
	},
	{
		name: "getUserId",
		summary: "Get the user Id of the default org's user.",
		mutating: false,
		args: [],
		run: async (forge) => (await forge.orgs.getUserId()) ?? null,
	},
	{
		name: "listApexClasses",
		summary: "List the Apex class names in the project.",
		mutating: false,
		args: [
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		run: async (forge, a) => forge.schema.apexClassNames(opt<string>(a, "projectRoot")),
	},
	{
		name: "objectOf",
		summary: "Return the SObject a SOQL query targets (its FROM object).",
		mutating: false,
		args: [{ name: "soql", type: "string", required: true, description: "The SOQL query string." }],
		run: async (forge, a) => forge.data.objectOf(str(a, "soql")) ?? null,
	},
	{
		name: "stdlibLookup",
		summary: "Look up a Salesforce StandardApexLibrary class (System.*, ConnectApi.*) by name.",
		mutating: false,
		args: [
			{
				name: "name",
				type: "string",
				required: true,
				description: "Qualified (System.Database) or bare class name.",
			},
		],
		run: async (forge, a) => {
			await forge.schema.stdlib.ensure()
			return forge.schema.stdlib.lookup(str(a, "name")) ?? null
		},
	},
	{
		name: "stdlibNamespaces",
		summary: "List StandardApexLibrary namespaces → class names.",
		mutating: false,
		args: [],
		run: async (forge) => {
			await forge.schema.stdlib.ensure()
			return forge.schema.stdlib.namespaces() ?? null
		},
	},
	{
		name: "scaffoldTest",
		summary: "Scaffold an empty Apex test class + meta for a class-under-test (no deploy).",
		mutating: false,
		args: [
			{ name: "clsPath", type: "string", required: true, description: "Absolute path of the .cls under test." },
			{ name: "apiVersion", type: "string", required: false, description: "Optional API version for the meta." },
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		run: async (forge, a) =>
			forge.apexTests.scaffold(str(a, "clsPath"), opt<string>(a, "apiVersion"), opt<string>(a, "projectRoot")) ??
			null,
	},
	{
		name: "collectApexContext",
		summary: "Collect the static context (related classes, objects, flows, triggers) for an Apex class.",
		mutating: false,
		args: [
			{ name: "className", type: "string", required: true, description: "Apex class name." },
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		run: async (forge, a) => forge.apexTests.collectContext(str(a, "className"), opt<string>(a, "projectRoot")),
	},
	{
		name: "evaluateFormula",
		summary: "Evaluate a Salesforce formula against the org (via FormulaEval) and return the value.",
		returns: "{success, value?, referencedFields[], warning?, error?, executionTimeMs}.",
		mutating: false,
		args: [
			{ name: "formula", type: "string", required: true, description: "The formula expression." },
			{
				name: "objectName",
				type: "string",
				required: true,
				description: "SObject the formula is defined against.",
			},
			{
				name: "returnType",
				type: "string",
				required: true,
				description: "The formula's return type.",
				enum: ["STRING", "BOOLEAN", "INTEGER", "LONG", "DECIMAL", "DOUBLE", "DATE", "DATETIME", "TIME"],
			},
			{
				name: "recordId",
				type: "string",
				required: false,
				description: "Specific record Id to evaluate against.",
			},
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		run: async (forge, a) =>
			forge.formula.evaluate({
				formula: str(a, "formula"),
				objectName: str(a, "objectName"),
				returnType: str(a, "returnType") as never,
				recordId: opt<string>(a, "recordId"),
				projectRoot: opt<string>(a, "projectRoot"),
			}),
	},
	{
		name: "sampleRecords",
		summary: "List a few records (Id + label) of an object, e.g. to pick one to evaluate a formula against.",
		mutating: false,
		args: [
			{ name: "objectName", type: "string", required: true, description: "SObject API name." },
			{ name: "limit", type: "number", required: false, description: "Max records (default a few)." },
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		run: async (forge, a) =>
			forge.formula.sampleRecords(str(a, "objectName"), {
				limit: opt<number>(a, "limit"),
				projectRoot: opt<string>(a, "projectRoot"),
			}),
	},
	{
		name: "analyzeLogFile",
		summary: "Analyze a saved Apex debug log FILE (.siid/logs/*.log) into limits/timings/SOQL-DML/errors.",
		returns: "LogAnalysis {limits[], hotMethods[], dataOps[], insights[], counts, errors[], truncated, isFinest}.",
		mutating: false,
		args: [{ name: "logFilePath", type: "string", required: true, description: "Path to the saved .log file." }],
		run: async (forge, a) => forge.logs.analyzeFile(str(a, "logFilePath")),
	},
	{
		name: "analyzeBatchJob",
		summary: "Collect + analyze EVERY log of an async Apex job (Batchable/Queueable) by job Id.",
		returns:
			"BatchJobAnalysis with per-phase breakdown; note limitsUsable=false means limits not measured (async logs report 0), SOQL/DML counts still reliable.",
		mutating: false,
		args: [
			{ name: "jobId", type: "string", required: true, description: "The AsyncApexJob Id." },
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		run: async (forge, a) =>
			forge.logs.analyzeBatchJobById(str(a, "jobId"), undefined, opt<string>(a, "projectRoot")),
	},
	{
		name: "diffTypes",
		summary:
			"Diff whole metadata TYPES between the org and the local project (per-member status) — for content-diffable types (Apex, LWC, etc.).",
		returns:
			"Array of {type, comparedByContent, rows:[{fullName, status}]}. status ∈ new-in-org|changed|only-local|identical|retrieved-not-compared.",
		mutating: false,
		args: [
			{
				name: "types",
				type: "string[]",
				required: true,
				description: 'Metadata type names, e.g. ["ApexClass"].',
			},
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		run: async (forge, a) => {
			const groups = await forge.diff.byMetadataTypes(a["types"] as string[], {
				projectRoot: opt<string>(a, "projectRoot"),
			})
			// Return a plain, serializable summary; release temp org files.
			const out = groups.map((g) => ({
				type: g.type,
				comparedByContent: g.comparedByContent,
				rows: g.rows.map((r) => ({ fullName: r.fullName, status: r.status })),
			}))
			try {
				forge.diff.dispose(groups)
			} catch {
				/* best-effort cleanup */
			}
			return out
		},
	},
	{
		name: "findOrphanedMeta",
		summary: "List orphaned -meta.xml sidecar files (a .cls-meta.xml with no .cls) in the project.",
		mutating: false,
		args: [
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		run: async (forge, a) => forge.diff.findOrphanedMeta(opt<string>(a, "projectRoot")),
	},

	// ─────────────── powerful / mutating (approval-gated) ───────────────
	{
		name: "applyToLocal",
		summary: "Pull specific components from the org INTO the local project (writes files). Requires approval.",
		mutating: true,
		args: [
			{
				name: "refs",
				type: "object[]",
				required: true,
				description: 'Components to pull, each {type, fullName}, e.g. [{"type":"ApexClass","fullName":"Foo"}].',
			},
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		run: async (forge, a) =>
			forge.diff.applyToLocal(a["refs"] as never, { projectRoot: opt<string>(a, "projectRoot") }),
	},
	{
		name: "deploy",
		summary:
			"Deploy NAMED metadata to the org (e.g. specific Apex classes). PREFER this over sfRun for deploys — it targets named components, so it won't scan/parse unrelated managed-package classes. Requires approval.",
		mutating: true,
		args: [
			{
				name: "metadata",
				type: "string[]",
				required: true,
				description:
					'Metadata to deploy as Type:Name, e.g. ["ApexClass:LeadService","ApexClass:LeadServiceTest"].',
			},
			{ name: "projectRoot", type: "string", required: false, description: "Working directory override." },
		],
		run: async (forge, a, onStatus) => {
			const md = a["metadata"] as string[]
			const args = ["project", "deploy", "start", "--json"]
			for (const m of md) {
				args.push("--metadata", m)
			}
			return forge.sf.run(args, { cwd: opt<string>(a, "projectRoot"), onStatus })
		},
	},
	{
		name: "sfRun",
		summary:
			"Escape hatch: run an arbitrary `sf` CLI command (JSON output). Use ONLY when no dedicated feature fits — prefer query/runApexTests/deploy/retrieveTypes/updateRecords etc. Requires approval.",
		mutating: true,
		args: [
			{ name: "args", type: "string[]", required: true, description: 'sf CLI args, e.g. ["org","list"].' },
			{ name: "projectRoot", type: "string", required: false, description: "Working directory override." },
		],
		run: async (forge, a, onStatus) =>
			forge.sf.run(a["args"] as string[], { cwd: opt<string>(a, "projectRoot"), onStatus }),
	},
	{
		name: "updateRecords",
		summary: "Write edited records back to the org (one update per row). Requires approval.",
		mutating: true,
		args: [
			{ name: "sobject", type: "string", required: true, description: "SObject API name." },
			{
				name: "edits",
				type: "object[]",
				required: true,
				description:
					"Array of {recordId: string, fields: [{field: string, value: string}], sobject?: string} — one object per record.",
			},
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		run: async (forge, a) =>
			forge.data.updateRecords(str(a, "sobject"), a["edits"] as never, {
				projectRoot: opt<string>(a, "projectRoot"),
			}),
	},
	{
		name: "generateApexTest",
		summary: "AI-driven Apex test generation for a class: writes, deploys, runs, self-corrects. Requires approval.",
		mutating: true,
		args: [
			{
				name: "clsPath",
				type: "string",
				required: true,
				description: "Absolute path of the class-under-test .cls.",
			},
			{ name: "coverageTarget", type: "number", required: false, description: "Coverage % target (default 75)." },
		],
		run: async (forge, a) =>
			forge.apexTests.generate({
				clsPath: str(a, "clsPath"),
				coverageTarget: opt<number>(a, "coverageTarget"),
			} as never),
	},
	{
		name: "retrieveTypes",
		summary:
			"Retrieve whole metadata types from the org into the local project — for retrieve-only types (CustomObject, Report, …) that can't be content-diffed. Requires approval.",
		mutating: true,
		args: [
			{
				name: "types",
				type: "string[]",
				required: true,
				description: 'Metadata type names, e.g. ["CustomObject"].',
			},
			{ name: "projectRoot", type: "string", required: false, description: "Optional project root override." },
		],
		run: async (forge, a) =>
			forge.diff.retrieveTypes(a["types"] as never, { projectRoot: opt<string>(a, "projectRoot") }),
	},
	{
		name: "authorizeOrg",
		summary: "Authorize an org from a session id / access token. Handles credentials — requires approval.",
		mutating: true,
		args: [
			{ name: "accessToken", type: "string", required: true, description: "Access token (<orgId>!<token>)." },
			{ name: "instanceUrl", type: "string", required: true, description: "Org instance URL." },
			{ name: "alias", type: "string", required: false, description: "Optional alias." },
			{ name: "setDefault", type: "boolean", required: false, description: "Set as default org." },
		],
		run: async (forge, a) => {
			await forge.orgs.authorizeWithToken(
				str(a, "accessToken"),
				str(a, "instanceUrl"),
				opt<string>(a, "alias"),
				opt<boolean>(a, "setDefault"),
			)
			return { authorized: true }
		},
	},
]

/** Look up a feature by name. */
export function getForgeFeature(name: string): ForgeFeature | undefined {
	return FORGE_FEATURES.find((f) => f.name === name)
}

/**
 * Validate `args` against a feature's declared arg specs. Returns an error string, or undefined if OK.
 * Only shape/presence is checked (required present, primitive type matches) — deep validation is the
 * forge API's job.
 */
export function validateForgeArgs(feature: ForgeFeature, args: Record<string, unknown>): string | undefined {
	for (const spec of feature.args) {
		const v = args[spec.name]
		if (v === undefined || v === null) {
			if (spec.required) {
				return `Missing required arg "${spec.name}" for feature "${feature.name}".`
			}
			continue
		}
		const ok =
			spec.type === "string"
				? typeof v === "string"
				: spec.type === "number"
					? typeof v === "number"
					: spec.type === "boolean"
						? typeof v === "boolean"
						: spec.type === "string[]"
							? Array.isArray(v) && v.every((x) => typeof x === "string")
							: spec.type === "object[]"
								? Array.isArray(v)
								: spec.type === "object"
									? typeof v === "object"
									: false
		if (!ok) {
			return `Arg "${spec.name}" for feature "${feature.name}" must be ${spec.type}.`
		}
		// Enum check for string args (shape/presence only — deeper validation stays in the API).
		if (spec.type === "string" && spec.enum && !spec.enum.includes(v as string)) {
			return `Arg "${spec.name}" for feature "${feature.name}" must be one of: ${spec.enum.join(", ")}.`
		}
	}
	return undefined
}

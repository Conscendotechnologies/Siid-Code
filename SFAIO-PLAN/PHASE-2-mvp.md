# Phase 2 — MVP

**Prerequisite:** Phase 0 acceptance test fully passing, **and** Phase 1 — this phase's UI
(§2.11) consumes the token layer, the vendored fonts and the shared primitives Phase 1
builds. Phase 0 and Phase 1 are independent of each other and can run in parallel.

**Goal:** one requirement goes in, and comes out deployed to a scratch org, driven by an
Architect and **one** dev agent, with every state change visible on a run board and every
human decision routed through a Decision Inbox.

**Explicitly not in this phase:** parallelism, retries, escalation, review loops,
reassignment, freshness checks, rollback, crash recovery, model config UI. Those are
Phases 3–5. Resist pulling them forward — the state machine is much easier to get right
with one agent.

**Definition of done:** the §2.12 acceptance test passes end-to-end on a scratch org.

---

## 2.1 Entities and state machine

**File:** `src/services/sfaio/types.ts` (extend what Phase 0 started)

Model these exactly as `SFAIO.md` §10.2 specifies. Do not invent extra states.

```ts
export type RunState =
	| "SETUP"
	| "ANALYZING"
	| "AWAITING_ALIGNMENT"
	| "AWAITING_DESIGN_APPROVAL"
	| "AWAITING_DELEGATION_APPROVAL" // added in §2.6
	| "EXECUTING"
	| "COMPLETED"
	| "FAILED"
	| "PAUSED"
	| "CANCELLED"

export type SfaioTaskState =
	| "PENDING"
	| "ASSIGNED"
	| "IN_PROGRESS"
	| "DRY_RUN"
	| "QUEUED"
	| "DEPLOYING"
	| "IN_REVIEW"
	| "DONE"
	| "FAILED"
	| "ESCALATED"
	| "REASSIGNED"
	| "ROLLED_BACK"
	| "PAUSED"
	| "CANCELLED"

export type AgentTier = "architect" | "senior" | "mid" | "junior"

export interface TaskSpec {
	taskId: string
	wave: number
	assignedTier: AgentTier
	objective: string
	filesOwned: string[] // exclusive; enforced by fileRegex (Phase 0 §0.3)
	filesReadOnly: string[]
	contracts: {
		// "interfaces/contracts" in SFAIO.md §6.A7
		methodSignatures?: string[]
		fieldApiNames?: string[]
		notes?: string
	}
	acceptanceCriteria: string[]
	constraints: string[] // standards chosen during alignment (§2.4)
	generatorFlags?: Record<string, string>
	instructions: string // tier-dependent depth
	metadataTypes: string[] // drives deploy ordering + instruction lookup
}

export interface SfaioTask {
	taskId: string
	runId: string
	state: SfaioTaskState
	spec: TaskSpec
	assignedAgentId?: string
	engineTaskId?: string // the engine Task currently executing this
	selfRetryCount: number // Phase 4
	reviewCount: number // Phase 4
	snapshotId?: string // Phase 4
	deployResult?: DeployResult
	costUsd?: number // Phase 5
	tokensIn?: number
	tokensOut?: number
	createdAt: number
	updatedAt: number
}

export interface Run {
	runId: string
	state: RunState
	requirement: string
	targetOrgAlias: string
	projectPath: string
	designDocPath?: string
	alignmentAnswers?: Record<string, string>
	autoMode: boolean // §2.6a — skips permission gates, never safety stops
	isGreenfieldOrg: boolean // §2.6a decides whether alignment can be auto-answered
	budgetCapUsd?: number // Phase 5
	waves: number
	createdAt: number
	updatedAt: number
}

export interface AgentRecord {
	agentId: string
	runId: string
	tier: AgentTier
	profileName: string // provider-profile name, never a model id
	currentTaskId?: string
	status: "IDLE" | "BUSY" | "PAUSED" | "DEAD"
	lastHeartbeat: number // Phase 4
	tokensIn: number
	tokensOut: number
	costUsd: number
}

export interface DeployQueueItem {
	itemId: string
	runId: string
	taskId: string
	orgAlias: string
	priority: number // Architect-assigned deploy order
	enqueuedAt: number
	state: "WAITING" | "DEPLOYING" | "DONE" | "FAILED"
	result?: DeployResult
}

export interface DeployResult {
	success: boolean
	cliCommand: string
	rawOutput: string // truncated; full output goes to the log file
	errorSnippet?: string
	componentsDeployed?: number
	finishedAt: number
}

export interface DecisionItem {
	decisionId: string
	runId: string
	kind:
		| "ALIGNMENT"
		| "DESIGN_APPROVAL"
		| "DELEGATION_APPROVAL"
		| "ESCALATION"
		| "BUDGET_PAUSE"
		| "FRESHNESS_CONFLICT"
		| "DESTRUCTIVE_ROLLBACK_APPROVAL" // Phase 4 §4.5 — never auto-approvable
	prompt: string
	payload?: unknown // e.g. the design doc path, the task graph, the escalation
	createdAt: number
	resolvedAt?: number
	response?: { decision: "APPROVE" | "REJECT" | "ANSWER"; text?: string }
}
```

### Transition guards

**File:** `src/services/sfaio/orchestrator/stateMachine.ts`

Declare the legal transitions as data, not as scattered `if`s:

```ts
const TASK_TRANSITIONS: Record<SfaioTaskState, SfaioTaskState[]> = {
	PENDING: ["ASSIGNED", "CANCELLED"],
	ASSIGNED: ["IN_PROGRESS", "PENDING", "CANCELLED"],
	IN_PROGRESS: ["DRY_RUN", "FAILED", "ESCALATED", "PAUSED", "CANCELLED"],
	DRY_RUN: ["QUEUED", "IN_PROGRESS", "FAILED", "ESCALATED"],
	QUEUED: ["DEPLOYING", "PAUSED", "CANCELLED"],
	DEPLOYING: ["IN_REVIEW", "FAILED", "ESCALATED"],
	IN_REVIEW: ["DONE", "IN_PROGRESS", "FAILED"],
	DONE: ["ROLLED_BACK"],
	FAILED: ["ASSIGNED", "REASSIGNED", "CANCELLED"],
	ESCALATED: ["ASSIGNED", "REASSIGNED", "IN_PROGRESS", "CANCELLED"],
	REASSIGNED: ["ASSIGNED"],
	ROLLED_BACK: [],
	PAUSED: ["IN_PROGRESS", "QUEUED", "CANCELLED"],
	CANCELLED: [],
}

export function assertTaskTransition(from: SfaioTaskState, to: SfaioTaskState): void {
	if (!TASK_TRANSITIONS[from].includes(to)) {
		throw new Error(`[SFAIO] illegal task transition ${from} -> ${to}`)
	}
}
```

Call the assert inside `SfaioStore.updateTask` whenever `patch.state` is present, so an
illegal transition is impossible rather than merely discouraged. `SFAIO.md` §10.2 requires
every transition to write an `EventLog` entry with `from → to`, actor, and reason — the
store already does this via `MutationContext` (Phase 0 §0.7).

Do the same for `RunState`.

---

## 2.2 Orchestrator service

**File:** `src/services/sfaio/orchestrator/SfaioOrchestrator.ts`

The orchestrator is **plain code**, not an LLM. It owns the run lifecycle. No prompt
decides what happens next.

```ts
export class SfaioOrchestrator {
	constructor(
		private store: SfaioStore,
		private provider: ClineProvider,
		private deployQueue: DeployQueue,
	) {}

	async startRun(params: { requirement: string; targetOrgAlias: string; autoMode: boolean }): Promise<Run>

	/** Called after any state change. Pure decision function: what should happen now? */
	private async advance(runId: string): Promise<void>

	/** The user answered something in the Decision Inbox. */
	async resolveDecision(decisionId: string, response: DecisionItem["response"]): Promise<void>

	async pauseRun(runId: string): Promise<void>
	async resumeRun(runId: string): Promise<void>
	async cancelRun(runId: string): Promise<void>
}
```

`advance()` is the heart of it. It is a switch on `run.state` and, in `EXECUTING`, a scan
of task states. Keep it **idempotent** — it will be called from event handlers and may run
more than once for the same state. Every action it takes must be safe to attempt twice
(guard with the task's current state before acting).

Wire it to the event bus: subscribe to `task.updated` and `queue.updated`, and call
`advance(runId)`. That is what makes the system move without a polling loop.

---

## 2.3 Architect agent

**File:** `src/services/sfaio/agents/ArchitectAgent.ts`

The Architect is an engine `Task` running in an ephemeral mode with **no edit group**
(Phase 0 §0.3). It produces structured output the orchestrator parses; it does not act on
the org directly.

### Mode

```ts
buildAgentMode({
	taskId: runId,
	tier: "architect",
	filesOwned: [], // no edit group at all — see §0.3
	roleDefinition: ARCHITECT_ROLE, // from agents/prompts/architect.ts
	instructions: architectInstructions(run),
})
```

Tools it needs: `read_file`, `search_salesforce_symbols`, `search_salesforce_graph`,
`codebase_search`, `list_files`, `get_task_guides`. It must **not** have
`write_to_file`, `apply_diff`, `sf_deploy_metadata`, or `execute_command`.

### Context retrieval — the important constraint

`SFAIO.md` §6.A2 says "read index files first". Read that as **query the index, never load
it**. The graph index is ~7 MB (`F22`). Loading it into a prompt will blow the context
window and cost a fortune.

Route all index access through `SalesforceSearchRouter`
(`src/services/code-index/processors/salesforce-search-router.ts`), which already does
intent classification and returns ranked `filePath:line` pointers with snippets. The
Architect's prompt should instruct it to search, then `read_file` only specific
components.

Add an explicit guard: if the Architect tries to `read_file` on
`.siid-code/SALESFORCE_GRAPH.md`, `SALESFORCE_INDEX.md`, or
`SALESFORCE_TRANSACTIONS.md`, reject with a message telling it to use the search tools.

### The A1–A7 pipeline

Run these as **separate turns with structured output**, not one giant prompt. Each step's
output is parsed and persisted before the next begins, so a failure is recoverable and
the UI can show progress.

| Step                   | Output                                      | Persisted as                                          |
| ---------------------- | ------------------------------------------- | ----------------------------------------------------- |
| A1 Intake              | normalized requirement summary              | `run.requirement` (kept verbatim too)                 |
| A2 Context retrieval   | list of relevant existing components        | log only                                              |
| A3 Alignment questions | `{ questions: [{ id, prompt, options? }] }` | `DecisionItem` kind `ALIGNMENT`                       |
| A4 Design document     | markdown                                    | `runs/<runId>/design.md`, path on `run.designDocPath` |
| A5 Human approval gate | —                                           | `DecisionItem` kind `DESIGN_APPROVAL`                 |
| A6 Task graph          | `{ waves: [{ wave, tasks: TaskSpec[] }] }`  | one `SfaioTask` per spec, all `PENDING`               |
| A7 Task specs          | (part of A6 output)                         | `SfaioTask.spec`                                      |

**Structured output parsing:** ask for a fenced ```json block and parse it. Validate with
zod against the `TaskSpec` schema. On a parse failure, re-prompt once with the validation
error appended, then surface to the human — do not silently accept a malformed graph.

### Alignment question content (A3)

`SFAIO.md` §6.A3 distinguishes two cases. Decide which by querying the index:

- **Heavily customized org** (index shows substantial existing Apex/Flows/objects) → ask
  "Follow existing implementation patterns?" and list the patterns detected.
- **Greenfield / empty org** → ask for preferred standards: trigger framework, LWC
  practices, PMD strictness, naming conventions, test-coverage target.

The answers become `run.alignmentAnswers` and are copied verbatim into every
`TaskSpec.constraints`. That is how a standard chosen once reaches every agent.

### Instruction depth by tier (A7)

One fixed schema, varying depth (`SFAIO.md` §6.A7):

- **Junior** — near-procedural. Exact file paths, exact method signatures, exact field API
  names, explicit "do not deviate" framing, worked example if one exists in the org.
- **Mid** — the objective, the contracts, the acceptance criteria, and the constraints.
  No step-by-step.
- **Senior** — high-level intent plus contracts and constraints. Trusted to choose
  structure.

Use `TaskTypeMapping` in `src/shared/globalFileNames.ts` (`F18`) to attach the right
existing instruction guides to each spec based on `metadataTypes`. This is the registry
the dropped "Citation Service" was meant to be — it already exists, so use it rather than
writing metadata guidance into prompts.

---

## 2.4 Alignment + design approval in the Decision Inbox

Both are `DecisionItem`s. The flow for each:

1. Orchestrator creates the `DecisionItem`, sets `run.state` to `AWAITING_ALIGNMENT` or
   `AWAITING_DESIGN_APPROVAL`, emits `decision.created`.
2. UI shows it in the Decision Inbox with a badge (§2.10).
3. User responds → `webviewMessageHandler` → `orchestrator.resolveDecision()`.
4. Orchestrator writes the response, transitions the run, calls `advance()`.

**Rejection with comments** (`SFAIO.md` §6.A5): a `REJECT` on `DESIGN_APPROVAL` carries
`response.text`. Feed that back to the Architect as a new turn on the same engine Task and
regenerate the design. Do **not** start a fresh Architect task — the context of the
rejected design matters.

**In auto mode both of these gates are auto-passed** (§2.6a), except greenfield alignment,
which always asks once. Route every gate through `canAutoResolve()` rather than checking
`run.autoMode` inline — there is exactly one place that decision is made.

**Never use `Task.ask()` for these.** The Architect is a background task; `ask()` responses
are dropped (`F7`). The Architect emits its questions as structured output, the
orchestrator turns them into `DecisionItem`s, and the answers are injected as the next
user turn.

---

## 2.5 Wave and dependency model

Even with one agent in Phase 2, build the wave structure now — Phase 3 depends on it.

- **Wave 0 is schema:** objects, fields, and anything other metadata depends on. Deployed
  first (`SFAIO.md` §6.A6).
- **Wave N starts only when every task in wave N−1 is `DONE`.** Enforce this in
  `advance()`, not in a prompt.
- `DeployQueueItem.priority` comes from the Architect's deploy ordering within a wave.

Validate the graph before accepting it:

1. No two tasks in the same wave share any path in `filesOwned` (overlap is a planning
   error — reject and re-prompt the Architect with the specific collision).
2. Every `filesReadOnly` entry is owned by an earlier wave or already exists in the repo.
3. Wave numbers are contiguous from 0.
4. Every task has at least one `acceptanceCriteria` entry and a non-empty `objective`.

---

## 2.6 Delegation approval gate (new requirement)

This is **not** in `SFAIO.md` §6 as written — it was added by the user after the spec was
drafted. Add it to the spec too.

> Before assigning tasks to agents, show the user the task graph and ask them to approve.
> Provide an auto mode so they don't have to review every time.

### Behaviour

1. After A6/A7 validation passes, orchestrator creates a `DecisionItem` of kind
   `DELEGATION_APPROVAL` whose `payload` is the full task graph (waves, tasks, tiers,
   owned files, assigned agent per task).
2. `run.state` → `AWAITING_DELEGATION_APPROVAL`.
3. UI shows a compact modal: wave → task → tier → files owned, with **Approve**,
   **Edit**, **Reject**.
4. On `APPROVE` → `run.state` → `EXECUTING`, `advance()` assigns the first wave.
5. On `REJECT` with comments → back to the Architect to re-plan.
6. **Edit** → the user may modify specs inline (see §2.7 mid-run editing rules).

---

## 2.6a Auto mode — the full policy

The field is `run.autoMode` (§2.1), not `autoDelegate` — per **D3** it governs more than
delegation, and naming it after one gate invites someone to check it inline at that gate
only.

Auto mode works like Claude Code's auto-accept: it skips **permission** gates. It never
skips **safety** stops (**D4**). Encode this as a table, not as scattered conditionals:

| Decision kind                                    | Auto mode behaviour                                              | Why                                                                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `DESIGN_APPROVAL` (§2.4)                         | **Auto-approved**                                                | Permission gate.                                                                                                                   |
| `DELEGATION_APPROVAL` (§2.6)                     | **Auto-approved**                                                | Permission gate.                                                                                                                   |
| `ALIGNMENT` — customized org                     | **Auto-answered** with "follow existing implementation patterns" | There is a safe default: the org's own conventions. See below.                                                                     |
| `ALIGNMENT` — greenfield org                     | **Still blocks**                                                 | There is no safe default for "which trigger framework" or "what PMD strictness". Guessing here poisons every task's `constraints`. |
| `ESCALATION` surfaced to human                   | **Still blocks**                                                 | It reached a human because the Architect already failed. Not a permission.                                                         |
| `FRESHNESS_CONFLICT` (Phase 4 §4.6)              | **Always blocks** (D4)                                           | Auto-resolving means silently overwriting someone else's org change.                                                               |
| `BUDGET_PAUSE` (Phase 5 §5.5)                    | **Always blocks** (D4)                                           | A safety stop, and the whole point is to get the user's attention.                                                                 |
| Destructive rollback on a sandbox (Phase 4 §4.5) | **Always blocks** (D4)                                           | Irreversibly deletes org metadata.                                                                                                 |

Implementation:

```ts
const AUTO_APPROVABLE: DecisionItem["kind"][] = ["DESIGN_APPROVAL", "DELEGATION_APPROVAL"]

function canAutoResolve(run: Run, item: DecisionItem): boolean {
	if (!run.autoMode) return false
	if (AUTO_APPROVABLE.includes(item.kind)) return true
	if (item.kind === "ALIGNMENT") return isSafeAlignmentDefault(item)
	return false // everything else always needs a human
}
```

Default the list closed: a new decision kind added later is **not** auto-approvable unless
someone deliberately adds it. Getting this backwards is how a safety stop silently stops
being one.

### Auto-resolved items still get recorded

Every auto-resolution writes a full `DecisionItem` with `resolvedAt` set,
`response.decision = "APPROVE"`, and an `EventLog` entry with `actor: "system"` and
`reason: "auto mode"`. Never leave a gap in the audit trail — the run summary must be able
to show that a gate existed and was auto-passed.

### The alignment split, and why

`SFAIO.md` §6.A3 asks two different kinds of question depending on the org:

- **Heavily customized org** → "Follow existing implementation patterns?" The org's own
  conventions are a defensible default, and it is what a human answers nearly every time.
  Auto-answer it, record the detected patterns in the design doc, and move on.
- **Greenfield / empty org** → preferred trigger framework, LWC practices, PMD strictness,
  naming conventions. There is no safe default. A wrong guess here is copied verbatim into
  every task's `constraints` (§2.3) and shapes the entire build with no later checkpoint,
  because design approval is auto-passed in auto mode.

So auto mode blocks on greenfield alignment. This is my judgement call, not something the
spec states — flag it if you disagree. Surface it in the UI when the user enables auto mode
on a greenfield org: "auto mode will still ask once, to establish your standards."

### Where the toggle lives

1. The setup screen.
2. A "don't ask again for this run" checkbox in each auto-approvable modal, which sets
   `run.autoMode = true`.
3. Run controls (§11.7), so it can be turned on or off mid-run. Turning it **off** mid-run
   takes effect at the next gate; it does not retroactively re-open auto-passed gates.

---

## 2.7 Mid-run spec editing

The user may edit a task spec while the run is live. Rules — enforce these in the
orchestrator, not the UI:

| Task state when edited   | Behaviour                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `PENDING`, `ASSIGNED`    | Edit the spec in place. Nothing is running.                                                                                  |
| `IN_PROGRESS`, `DRY_RUN` | Abort the engine Task, revert its snapshot, set the task to `REASSIGNED`, then `ASSIGNED` with the new spec. Log the reason. |
| `QUEUED`                 | Remove from the deploy queue first, then as `IN_PROGRESS`.                                                                   |
| `DEPLOYING`              | **Reject the edit.** A deploy is in flight; editing now would desync the org from the spec. Tell the user to wait or cancel. |
| `DONE`, `ROLLED_BACK`    | Reject. Start a new task instead.                                                                                            |

Swapping a spec under a running agent without an abort produces work that matches neither
the old nor the new spec. Do not allow it.

Editing `filesOwned` also means rebuilding the ephemeral mode (Phase 0 §0.3) — the regex
is baked into the mode, so a new engine Task with a new mode is required. That is exactly
why the table above aborts rather than patches.

---

## 2.8 Dev agent execution (single agent)

**File:** `src/services/sfaio/agents/DevAgent.ts`

For each assigned `SfaioTask`, in order:

### Step 1 — snapshot

Per **D1** there is no git. Phase 2 does **not** implement snapshots at all — the copy store
arrives in Phase 4 §4.5. Agent tasks run with `enableCheckpoints: false`.

What Phase 2 _does_ capture, because it is free now and avoids a data migration later:

- the org-side baseline — for each component in `spec.metadataTypes`, query
  `lastModifiedDate` and store it on the task. Unused until Phase 4's freshness check.

Leave a `// TODO(SFAIO Phase 4): capture file snapshot via SnapshotService` at the point
where the copy-store call will go, so Phase 4 has an obvious insertion point.

Consequence to accept knowingly: **Phase 2 has no rollback.** If a task goes wrong, the
recovery is manual. That is acceptable for an MVP on a scratch org, and pretending otherwise
with a rollback button that silently restores the wrong files would be worse.

### Step 2 — scaffold

`SFAIO.md` §6.B2 asks for SF CLI generators so `-meta.xml` always exists.

**Current reality (`F20`):** the existing `generate_*` tools write XML from templates and
already guarantee the meta.xml file. No `sf apex generate` / `sf schema generate` call
exists anywhere in the codebase.

**Decision for Phase 2:** keep the template generators. They satisfy the actual
requirement (meta.xml always present) with no interactivity risk.

**Also do this in Phase 2, for the record** (`SFAIO.md` §13.7): test whether
`sf schema generate sobject` and `sf schema generate field` can run non-interactively
(try `--json` plus all flags; check whether it still prompts). Write the result into
`SFAIO-PLAN/findings-sf-schema-generate.md` so the question is closed with evidence
rather than left open.

### Step 3 — implement

Spawn the background task:

```ts
const engineTask = await provider.createBackgroundTask({
	task: renderTaskPrompt(spec), // objective + contracts + criteria + constraints + instructions
	apiConfiguration: await resolveProfileForTier(spec.assignedTier),
	mode: agentMode.slug,
	customModesOverlay: [agentMode],
	headless: true,
	autoApprovalOverride: DEFAULT_AGENT_AUTO_APPROVAL,
	parentTask: architectEngineTask,
})
```

`resolveProfileForTier` in Phase 2 can read a single hardcoded **profile name** from
settings (not a model id — never a model id). Phase 5 builds the real role→profile UI.

Set `SfaioTask.engineTaskId = engineTask.taskId` and state → `IN_PROGRESS`.

Listen for the engine task's completion. The engine emits events on the `Task`
EventEmitter — inspect `TaskEvents` in `packages/types` and subscribe to the completion
and abort events rather than polling.

### Step 4 — dry run

**Be precise about which "dry run" this is.** There are two different things:

- `validate_sf_metadata` (`src/core/tools/validateSfMetadataTool.ts`) validates XML
  **locally against XSD schemas**. It never contacts the org. Useful, cheap, run it first.
- `sf project deploy start --dry-run` is the **org-side check-only deploy**. This is what
  `SFAIO.md` §6.B5 means.

The existing `sf_deploy_metadata` tool already does both in sequence: it runs the dry-run
command, and only on success proceeds to the real deploy
(`sfDeployMetadataTool.ts:745,772`). For SFAIO, **split them**: the agent runs the dry-run,
then the task is enqueued, and the deploy happens later under the queue lock. Do not let
the agent's tool call perform the real deploy directly — that bypasses the queue.

Simplest implementation: add a `dryRunOnly?: boolean` parameter that stops after the dry run.
The tool is already split for this — it has an explicit `// PHASE 1: Execute DRY RUN` block
ending in a `dryRunResult.success` gate, then `// PHASE 2` for the real deploy
(`sfDeployMetadataTool.ts:739-760`). Insert immediately after the success check:

```ts
// SFAIO: agents validate; the deploy queue deploys (SFAIO.md §7).
if (dryRunOnly) {
	await updateDeploymentStatuses(cline.taskId, dryRunPaths, "dry-run")
	pushToolResult(dryRunResult.message)
	return
}
```

Set it for SFAIO agent tasks, and assert the inverse: the tool throws if called by a task
with `autoApprovalOverride` set and `dryRunOnly` unset (§2.13).

State → `DRY_RUN` on success. On failure in Phase 2, → `FAILED` and surface it (retries are
Phase 4).

### Step 5 — enqueue

`deployQueue.enqueue({ runId, taskId, orgAlias, priority: spec.deployPriority })`.
State → `QUEUED`.

### Step 6 — deploy

Handled by the queue worker (§2.9), not the agent.

---

## 2.9 Deploy queue

**Files:** `src/services/sfaio/deploy/DeployQueue.ts`, `DeployWorker.ts`

### Requirements (`SFAIO.md` §7)

- FIFO **per target org**, implemented in code. No LLM involvement.
- Exactly **one deploy at a time per org**.
- Persisted; survives restart.
- The lock is **atomic** — not check-then-act.

### Implementation

```ts
export class DeployQueue {
	async enqueue(item: Omit<DeployQueueItem, "itemId" | "enqueuedAt" | "state">): Promise<DeployQueueItem>
	async peek(orgAlias: string): Promise<DeployQueueItem | undefined>
	async claimNext(orgAlias: string): Promise<DeployQueueItem | undefined>
	async complete(itemId: string, result: DeployResult): Promise<void>
	async remove(itemId: string): Promise<void> // for §2.7 spec edits
}
```

`claimNext` is the critical one. It must, **inside** `withOrgLock` (Phase 0 §0.7):

1. read the queue file,
2. find the highest-priority `WAITING` item (ties broken by `enqueuedAt`),
3. check no item is already `DEPLOYING` — if one is, return `undefined`,
4. set it to `DEPLOYING` and write,
5. release the lock.

Reading and writing must both be inside the lock. Reading outside and writing inside is
exactly the check-then-act race the spec forbids.

The worker loop is event-driven, not a timer: on `queue.updated`, try `claimNext`; if it
returns an item, deploy it, then `complete()` and try again.

### Deploy execution

Call the existing deploy tool machinery with `--target-org` (§2.10) and the task's
metadata. Capture the full CLI output to `logs/<runId>/<taskId>.log`; store only a
truncated `rawOutput` and an `errorSnippet` in the state store (`SFAIO.md` §10.1 log
storage row).

On success: task → `IN_REVIEW` (Phase 2 auto-advances `IN_REVIEW` → `DONE` since Architect
review is Phase 4; make that explicit and logged, not implicit).

On failure: task → `FAILED`, `DecisionItem` of kind `ESCALATION` with the real CLI error.
`SFAIO.md` §11 requires the actual CLI message, never a generic failure.

---

## 2.10 `--target-org` threading

`F9`: deploy and retrieve never pass `--target-org`. SFAIO binds a run to one org, so this
must be threaded through.

**Correction worth noting:** `validateSfMetadataTool` does **not** need this — it is local
XSD validation and never contacts an org (`ensureSchemaLoaded` at
`validateSfMetadataTool.ts:20`). Only these two need changing.

### `src/core/tools/sfDeployMetadataTool.ts`

`buildSfDeployCommand` is declared at `:281` with 8 positional parameters and called at
`:693` (dry run) and `:704` (deploy). Add a 9th, last, optional parameter to keep the diff
small:

```ts
function buildSfDeployCommand(
	metadataType: string,
	metadataName: string,
	sourceDir: string | undefined,
	testLevel: string | undefined,
	tests: string | undefined,
	ignoreWarnings: boolean,
	isDryRun: boolean,
	cwd: string,
	targetOrg?: string,   // SFAIO
): string {
```

Insert the flag where the other flags are appended (near the `--test-level` addition
around `:350`):

```ts
// SFAIO: bind the deploy to the run's target org instead of the CLI default.
if (targetOrg) {
	command += ` --target-org "${targetOrg}"`
}
```

Pass it at both call sites. The value comes from the SFAIO task's run; for interactive
chat calls it stays `undefined` and behaviour is unchanged.

### `src/core/tools/retrieveSfMetadataTool.ts`

`buildSfCommand(metadataType, metadataName, cwd)` builds
`sf project retrieve start --metadata ...` at `:177` and `:181`, called at `:306`. Add
`targetOrg?: string` and append the same flag in both return paths.

### Where the org alias comes from

For an SFAIO background task, the tool needs the run's `targetOrgAlias`. Rather than
threading a parameter through every tool signature, put it on the task:

- `sfaioTargetOrg?: string` is already on `TaskOptions` — Phase 0 §0.2 adds it alongside the
  other per-task overrides. Set it when creating the agent task,
- read `cline.sfaioTargetOrg` in the deploy/retrieve tools and pass it into the command
  builders.

Leave the existing "No default Salesforce org is set…" error (`sfDeployMetadataTool.ts:950`)
in place as the fallback for interactive chat.

---

## 2.11 UI — run board v1 and Decision Inbox

> **Phase 1 already built the foundation this needs** — the token layer, the vendored fonts
> and Phosphor icons, the `data-sfaio-theme` wrapper, the motion keyframes with their
> reduced-motion block, and the shared primitives (`StateChip`, `ToolCard`, `ApprovalFooter`,
> `LinearMeter`, `DonutMeter`, `ModalShell`, `SectionLabel`, `MonoText` — Phase 1 §1.5).
>
> **Consume them; do not rebuild them.** If a surface here needs something close to a
> primitive but not identical, extend the primitive rather than forking it — Phase 6 rebuilds
> the agent panel on the same components, and two divergent copies is the failure mode.
> `UI-THEME-nocturne.md` remains the reference for patterns and the state palette.

### Surface

Open the run board as an **editor-area webview panel**, not in the sidebar — it needs the
space, and the sidebar stays available for chat. There is an existing pattern to copy at
`src/activate/registerCommands.ts:518`, which creates a panel with
`ClineProvider.tabPanelId`.

Register a new command `sfaio.openRunBoard` and a new panel id. Keep the Decision Inbox
badge in the sidebar so it is visible when the board is closed.

### Message plumbing

Add to `src/shared/ExtensionMessage.ts` (extension → webview):

```ts
	| { type: "sfaioState"; state: SfaioUiState }
	| { type: "sfaioEvent"; event: SfaioEvent }
```

Add to `src/shared/WebviewMessage.ts` (webview → extension):

```ts
	| { type: "sfaioStartRun"; requirement: string; targetOrgAlias: string; autoMode: boolean }
	| { type: "sfaioResolveDecision"; decisionId: string; decision: "APPROVE" | "REJECT" | "ANSWER"; text?: string }
	| { type: "sfaioEditTaskSpec"; runId: string; taskId: string; spec: TaskSpec }
	| { type: "sfaioRunControl"; runId: string; action: "pause" | "resume" | "cancel" }
	| { type: "sfaioSetAutoMode"; runId: string; value: boolean }
```

Handle each with a new `case` in `src/core/webview/webviewMessageHandler.ts`, delegating
straight to the orchestrator. Keep the handlers thin — no logic in the message handler.

### State delivery

Send a full `sfaioState` snapshot on panel open, then incremental `sfaioEvent` messages
from the event bus. Do not re-send the whole state on every change; runs will have
hundreds of tasks and thousands of events.

`SFAIO.md` §10.2 rule: **the UI reads only from these entities and never parses raw agent
output for status.** Enforce this by not sending agent output on the state channel at all
— logs go through `log.appended` events, clearly separated.

### Views required in Phase 2

Only these four. The rest are Phase 3+.

1. **Setup screen** — target org picker (`sf org list --json`), requirement textarea,
   auto-delegate checkbox, Start. Model config is Phase 5; use the default profile.
2. **Run board (basic)** — tasks grouped by wave, coloured by state. No kanban toggle, no
   filters yet.
3. **Decision Inbox** — list of unresolved `DecisionItem`s with Approve / Reject / Answer,
   and a global badge count.
4. **Task drawer (basic)** — spec, state history from the EventLog, CLI output, deploy
   result.

### UX rules from `SFAIO.md` §11

- Never block the whole UI except during initial sync.
- Every automated decision must show its reason — the EventLog `reason` field is the
  source for this; surface it in the task drawer.
- Errors show the actual CLI message.

---

## 2.12 Phase 2 acceptance test

On a **scratch org**, using one of SIID's existing test use cases:

| #   | Check                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Setup screen starts a run; `Run` persisted with state `ANALYZING`.                                                                                             |
| 2   | Architect produces alignment questions; they appear in the Decision Inbox; answering them advances the run.                                                    |
| 3   | A design document is written to `runs/<runId>/design.md` and shown in the UI.                                                                                  |
| 4   | Rejecting the design with a comment causes a revised design, not a crash or a fresh start.                                                                     |
| 5   | Approving produces a validated task graph with wave 0 = schema.                                                                                                |
| 6   | Graph validation rejects a deliberately overlapping `filesOwned` (test by hand-editing the Architect's output).                                                |
| 7   | Delegation gate appears; approving starts execution.                                                                                                           |
| 7a  | With `autoMode: true`, both the design-approval and delegation gates are auto-passed, and each still records a resolved `DecisionItem` with `actor: "system"`. |
| 7b  | With `autoMode: true` on a **greenfield** org, the alignment question still blocks (§2.6a).                                                                    |
| 7c  | A decision kind not in `AUTO_APPROVABLE` is never auto-resolved (unit test on `canAutoResolve`).                                                               |
| 8   | One dev agent implements a task headlessly — no editor tabs open.                                                                                              |
| 9   | The agent cannot write outside `filesOwned` (`FileRestrictionError`).                                                                                          |
| 10  | Dry run runs against the org and its result is visible.                                                                                                        |
| 11  | Task is enqueued and deployed with `--target-org` pointing at the scratch org (verify in the logged CLI command).                                              |
| 12  | Two tasks enqueued at once deploy strictly one at a time (test with a stub second task).                                                                       |
| 13  | Deploy failure surfaces the real CLI error in the UI, not a generic message.                                                                                   |
| 14  | Run reaches `COMPLETED`; every transition has an `EventLog` entry with actor and reason.                                                                       |
| 15  | Reload VS Code mid-run: state reloads from disk and the board renders correctly (full resume is Phase 4 — here, just no data loss and no crash).               |
| 16  | Mid-run spec edit on a `PENDING` task applies; on a `DEPLOYING` task is rejected with a clear message.                                                         |

---

## 2.13 Risks specific to this phase

- **The Architect's structured output will be the flakiest part.** Validate with zod, allow
  exactly one re-prompt with the error, then escalate to the human. Do not build a
  multi-attempt repair loop — it hides prompt problems.
- **Do not let the agent's `sf_deploy_metadata` call perform the real deploy.** If the
  `dryRunOnly` flag is missed, agents deploy outside the queue and the whole §7 guarantee
  is void. Add an assertion: the deploy tool throws if called by a task with
  `autoApprovalOverride` set and `dryRunOnly` not set.
- **`IN_REVIEW` auto-advance.** Phase 2 has no Architect review, so `IN_REVIEW` → `DONE`
  happens automatically. Make it an explicit, logged transition with
  `reason: "auto-advance: review not implemented until Phase 4"` so it is obvious in the
  event log and easy to find when Phase 4 lands.
- **Org alias vs username.** `sf` accepts both. Store whatever `sf org list --json` returns
  as the alias, and use the same string everywhere — including as the deploy-queue key.
  Mixing alias and username creates two queues for one org and breaks the one-deploy-at-a-time
  guarantee.

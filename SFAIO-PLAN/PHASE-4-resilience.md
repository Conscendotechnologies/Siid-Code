# Phase 4 — Resilience

**Prerequisite:** Phase 3 acceptance test passing.

**Goal:** the run survives failure. Agents retry, escalate, get reviewed, get reassigned by
rule; deploys check org freshness first; work can be rolled back; and a VS Code crash
doesn't lose or silently re-run anything.

**Definition of done:** the §4.8 acceptance test passes, including a deliberately broken
task that recovers through retry → escalation → reassignment, and a rollback that restores
exactly one task's files without touching another agent's work.

---

## 4.1 Self-correction (max 2 retries)

`SFAIO.md` §6.B9: on failure, read the CLI error, fix, retry. Max 2 self-retries, then
escalate.

**File:** `src/services/sfaio/agents/DevAgent.ts`

### What counts as a retryable failure

| Failure                                             | Retryable?                               | Notes                                                                                                        |
| --------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Dry-run validation failure (org rejects metadata)   | **Yes**                                  | The canonical case. Feed the CLI error back to the agent.                                                    |
| Real deploy failure                                 | **Yes**                                  | Same handling.                                                                                               |
| Local XSD validation failure                        | **Yes**                                  | Cheap; often a missing meta.xml field.                                                                       |
| `FileRestrictionError` (wrote outside `filesOwned`) | **No**                                   | A spec/planning problem, not something the agent can fix. Escalate immediately.                              |
| `SfaioEscalationRequired` from the approval gate    | **No**                                   | By definition out of policy. Escalate.                                                                       |
| Provider 429 / rate limit                           | **No — and does not consume the budget** | Handled by backoff (Phase 3 §3.6). Must not count as a retry.                                                |
| Context-window overflow                             | **No**                                   | Escalate; the spec is too large for the tier. Note it in the escalation so the Architect can split the task. |

Keeping 429s out of the retry budget matters: otherwise a busy provider burns both retries
before the agent has made a single real attempt.

### Retry mechanics

```ts
async function runWithSelfCorrection(task: SfaioTask): Promise<void> {
	while (true) {
		const result = await attemptTask(task)
		if (result.ok) return

		if (!isRetryable(result.error) || task.selfRetryCount >= 2) {
			await escalate(task, buildEscalationPayload(task, result))
			return
		}

		await store.updateTask(
			task.runId,
			task.taskId,
			{
				selfRetryCount: task.selfRetryCount + 1,
				state: "IN_PROGRESS",
			},
			{
				actor: `agent:${task.assignedAgentId}`,
				reason: `self-retry ${task.selfRetryCount + 1}/2: ${summarize(result.error)}`,
			},
		)

		// Continue the SAME engine Task with the error as a new user turn — do not
		// start a fresh one. The agent needs its own prior attempt in context.
		await continueEngineTask(task.engineTaskId!, formatErrorForAgent(result.error))
	}
}
```

**Continue the existing engine `Task`, don't spawn a new one.** A fresh task has no memory
of what it just tried and will often repeat the same mistake.

### `continueEngineTask` — the actual mechanism

There is no ready-made "send this task another turn" API, and the one that looks right is the
one you must not use: `resumePausedTask()` is the **subtask** path, and Phase 0 §0.5a bans
SFAIO agents from the engine's parent/child tree entirely.

Build it from the same primitives `resumePausedTask` uses (`src/core/task/Task.ts:1458-1500`).
`recursivelyMakeClineRequests` is **public** (`:1960`), so no engine change is needed:

```ts
// src/services/sfaio/agents/continueEngineTask.ts
export async function continueEngineTask(task: Task, text: string): Promise<void> {
	// A completed task has stopped its loop; re-arm before driving it.
	if (task.isLoopRunning) {
		throw new Error(`[SFAIO] task ${task.taskId} is still running — refusing to double-drive it`)
	}

	task.taskCompleted = false
	task.isLoopRunning = true

	await task.addToApiConversationHistory({
		role: "user",
		content: [{ type: "text", text }],
	})

	let nextUserContent: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text }]

	while (!task.abort) {
		const didEndLoop = await task.recursivelyMakeClineRequests(nextUserContent, false)
		if (didEndLoop) break
		nextUserContent = [{ type: "text", text: formatResponse.noToolsUsed() }]
	}
}
```

**The `isLoopRunning` guard is not optional.** Calling
`recursivelyMakeClineRequests` on a task whose loop is already running drives the same
conversation from two places at once — interleaved tool calls, corrupted history, and a
failure that looks like the model behaving erratically.

`addToApiConversationHistory` and `isLoopRunning` are currently private. Widen them to
`public` with a `// SFAIO:` comment, or add a single `public async continueWith(text)` method
on `Task` and call that — the second is tidier and keeps the engine edit to one place.

This same helper serves all three re-entry points in this phase: self-retry (§4.1), the
Architect's escalation answer (§4.2), and review findings (§4.3).

Feed the agent the **real CLI error text**, not a summary. `SFAIO.md` §11 requires actual
CLI messages in the UI, and the agent needs the component name and line number to fix
anything.

---

## 4.2 Escalation

`SFAIO.md` §6.C1: the escalation payload is structured and **required**.

**File:** `src/services/sfaio/types.ts`

```ts
export interface Escalation {
	escalationId: string
	runId: string
	taskId: string
	fromAgentId: string
	createdAt: number

	// All five fields are mandatory — SFAIO.md §6.C1
	blocker: string // exact blocker, one sentence
	location: { file: string; line?: number } | null
	cliError: string | null // verbatim, untruncated
	attempted: string[] // what was tried, in order
	proposedSolution: string // the agent's own proposal

	resolution?: {
		by: "architect" | "user"
		instruction: string // definitive and unambiguous
		at: number
	}
}
```

Validate with zod on construction. An escalation missing `blocker` or `proposedSolution`
is a bug in the agent prompt — reject it and re-prompt the agent for a complete payload
rather than forwarding a vague escalation to the Architect.

### Who answers

Default (`SFAIO.md` §13.5): **the Architect answers; the human can override from the
Decision Inbox.**

Flow:

1. Task → `ESCALATED`. `Escalation` persisted.
2. Orchestrator sends the escalation to the Architect's engine task as a new turn, asking
   for a definitive instruction.
3. Architect responds → `resolution.by = "architect"`.
4. Task → `ASSIGNED` (same agent, same tier) with the instruction appended to its spec
   `instructions`, and `selfRetryCount` reset to 0.
5. **Also** create a `DecisionItem` of kind `ESCALATION` for visibility, pre-resolved with
   the Architect's answer. The user can override it, which supersedes the Architect's
   instruction and re-dispatches the task.

The user can answer escalations directly — confirmed requirement. Surface an
"answer myself" action on the inbox item that short-circuits step 2.

If the Architect's instruction itself fails (the task escalates again on the same blocker),
go to reassignment (§4.3) rather than looping. Detect "same blocker" by comparing the
`blocker` string similarity or, more simply, by counting escalations per task — two
escalations on one task means reassignment.

---

## 4.3 Architect review (max 2 send-backs)

`SFAIO.md` §6.C2: the Architect reviews on completion against the requirement and
acceptance criteria; sends back for fixes at most twice.

Replaces the Phase 2 auto-advance of `IN_REVIEW` → `DONE` (Phase 2 §2.13 — find the
`reason: "auto-advance..."` transition and remove it).

Flow:

1. Deploy succeeds → task → `IN_REVIEW`.
2. Orchestrator asks the Architect: here is the spec, the acceptance criteria, the diff, and
   the deploy result — does this satisfy the requirement? Structured response:
   `{ verdict: "PASS" | "FAIL", findings: string[] }`.
3. `PASS` → `DONE`.
4. `FAIL` and `reviewCount < 2` → `reviewCount++`, task → `IN_PROGRESS` with the findings
   appended, same agent.
5. `FAIL` and `reviewCount === 2` → reassignment (§4.3).

Give the Architect the **diff**, not the whole files. Use the snapshot (§4.5) as the base
for the diff. Feeding whole files for review wastes context and buries the change.

Note that review happens **after** deploy. That is what the spec says, and it means a failed
review implies a redeploy — which is why rollback (§4.5) must work before review can be
trusted.

---

## 4.4 Deterministic reassignment

`SFAIO.md` §6.C3: rule-based, no LLM cost calculation, and **logged**.

**File:** `src/services/sfaio/orchestrator/reassignment.ts`

```ts
export type ReassignAction =
	| { kind: "SENIOR_FIX"; reason: string }
	| { kind: "SENIOR_REBUILD"; reason: string }
	| { kind: "ARCHITECT_TAKEOVER"; reason: string }
	| { kind: "SURFACE_TO_HUMAN"; reason: string }

export function decideReassignment(task: SfaioTask, signals: ReassignSignals): ReassignAction
```

`ReassignSignals` must be **measurable facts**, not judgements:

```ts
export interface ReassignSignals {
	tier: AgentTier
	selfRetryCount: number
	escalationCount: number
	reviewCount: number
	/** Fraction of spec.acceptanceCriteria the review marked satisfied (0..1). */
	criteriaSatisfiedRatio: number
	/** Fraction of spec.filesOwned that exist and are non-empty. */
	filesProducedRatio: number
	/** Did the last dry-run pass? A localized failure usually still dry-runs clean. */
	lastDryRunPassed: boolean
	deployFailureCount: number
}
```

Rules, in order — first match wins:

| #   | Condition                                                                         | Action                                                     |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | tier is `junior` or `mid`, and (`selfRetryCount >= 2` and `escalationCount >= 1`) | `SENIOR_FIX` or `SENIOR_REBUILD` by rule 2/3               |
| 2   | `filesProducedRatio >= 0.8` **and** `criteriaSatisfiedRatio >= 0.5`               | `SENIOR_FIX` — most of it is sound, failure is localized   |
| 3   | `filesProducedRatio < 0.8` **or** `criteriaSatisfiedRatio < 0.5`                  | `SENIOR_REBUILD` — structurally wrong or mostly incomplete |
| 4   | tier is `senior` and (`selfRetryCount >= 2` or `reviewCount >= 2`)                | `ARCHITECT_TAKEOVER`                                       |
| 5   | Architect takeover already attempted, or `deployFailureCount >= 3`                | `SURFACE_TO_HUMAN`                                         |

`SFAIO.md` §6.C3 says exact thresholds are the implementer's choice but must be rule-based
and logged. The 0.8 / 0.5 figures above are a starting point — put them in one exported
constants object so they can be tuned without hunting through code:

```ts
export const REASSIGN_THRESHOLDS = {
	filesProducedSound: 0.8,
	criteriaSatisfiedSound: 0.5,
	maxDeployFailures: 3,
} as const
```

**Logging is a hard requirement.** Every reassignment writes an `EventLog` entry containing
the action, every signal value, and which rule number fired. `SFAIO.md` §11 requires every
automated decision to be visible with its reason — the task drawer renders this.

`SENIOR_FIX` keeps the existing files and gives the senior the diff plus the failure.
`SENIOR_REBUILD` reverts to the snapshot (§4.5) and hands the senior the original spec.
These are genuinely different operations; don't collapse them.

---

## 4.5 Snapshots and rollback

This is the largest piece of Phase 4, and it fixes the known gap `F10`.

### The problem restated

`ShadowCheckpointService.stageAll()` is `git.add(".")` with `core.worktree` pointing at the
workspace (`src/services/checkpoints/ShadowCheckpointService.ts:146-148`, `:188-198`). Every
checkpoint contains every agent's in-flight work. Additionally, checkpoints are **disabled
entirely** when any nested `.git` exists below the workspace root (`:70-80`, `:156-186`) —
`F11`.

### The approach: a path-scoped copy store, no git

Per **D1** (`00-OVERVIEW.md` §8) SFAIO does not use git. Not every user has the binary
installed, shelling out to it is slow, and the engine's shadow-git checkpoints are wrong for
this job anyway. Use a plain file copy store.

Why this is the right answer and not merely the git-free one:

1. **No git dependency at all** (D1) — works on a machine that has never had git installed.
2. **Immune to `F11`.** Nested repos, no repo, someone else's repo — irrelevant.
3. **Exactly scoped by construction:** you copy `filesOwned` and nothing else, so one
   agent's snapshot can neither contain nor restore another agent's work. This is the direct
   fix for `F10`.
4. **No `.git/index.lock` contention** between concurrent agents.
5. Restore is trivially correct and trivially testable — it is file copies.

This supersedes `SFAIO.md` §10.1's snapshots row; the deviation is recorded in
`00-OVERVIEW.md` §8.1.

**Do not import `simple-git`, `src/utils/git.ts`, or `ShadowCheckpointService` anywhere in
SFAIO.** Add this to the grep gate alongside the model-name check (Phase 5 §5.1).

**File:** `src/services/sfaio/snapshots/SnapshotService.ts`

```ts
export interface Snapshot {
	snapshotId: string
	runId: string
	taskId: string
	createdAt: number
	/** workspace-relative path -> { existedBefore, storedAt|null } */
	files: Record<string, { existedBefore: boolean; storedAt: string | null }>
	/** Org-side baseline for the freshness check (§4.6). */
	orgBaseline: Record<string, string> // componentKey -> lastModifiedDate
}

export class SnapshotService {
	/** Copy every file in filesOwned that exists into the store. Record absences. */
	async capture(task: SfaioTask): Promise<Snapshot>

	/** Restore exactly the files in the snapshot. Delete files that did not exist before. */
	async restore(snapshotId: string): Promise<void>

	/** Unified diff of current state vs snapshot, for Architect review (§4.3). */
	async diff(snapshotId: string): Promise<string>

	async prune(runId: string): Promise<void>
}
```

Storage: `<sfaioRoot>/snapshots/<taskId>/<hash-of-relpath>` plus a `manifest.json`. Hash the
relative path for the stored filename so nested directories and long paths can't break it.

### Diffs without git

`diff@^5.2.0` is already a dependency and already used in this codebase to format diffs for
the LLM (`src/core/prompts/responses.ts:3`, `src/integrations/editor/DiffViewProvider.ts:4`).
Use it:

```ts
import * as diff from "diff"

const patch = diff.createPatch(relPath, snapshotContent, currentContent, "snapshot", "current")
```

Concatenate per-file patches for the whole-task diff. Follow whatever conventions
`responses.ts` already uses for presenting diffs to a model, so the Architect sees a familiar
format during review (§4.3).

**Recording absences matters.** If `filesOwned` includes a file the task is meant to
_create_, the snapshot records `existedBefore: false`, and restore **deletes** it. Without
that, rollback leaves orphaned new components behind.

### Rollback — the three cases from `SFAIO.md` §8

| Target          | New components                                                                                                              | Modified components                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Scratch org** | Discard and recreate the org (`sf org delete scratch`, then recreate from the definition file). Simplest and most complete. | Same.                                                |
| **Sandbox**     | Deploy a generated `destructiveChanges.xml` naming exactly the components this task created.                                | Restore files from the snapshot, then redeploy them. |

`destructiveChanges.xml` generation: build from `spec.metadataTypes` plus the component
names the task created (derive from snapshot entries with `existedBefore: false`). Pair it
with an empty `package.xml` — the SF CLI requires both. Verify the exact invocation
(`sf project deploy start --manifest package.xml --post-destructive-changes destructiveChanges.xml`)
against the CLI version in use before relying on the flag names.

**Rollback goes through the deploy queue.** It is a deploy; it must hold the org lock like
any other, or it can race a concurrent task's deploy.

### Destructive changes always require a human (D4)

**A sandbox destructive rollback must never proceed without explicit human approval, and
auto mode must not be able to approve it.** It permanently deletes org metadata, and if the
component list is wrong it deletes the wrong things.

Implementation:

1. Create a `DecisionItem` of a dedicated kind `DESTRUCTIVE_ROLLBACK_APPROVAL`, **not** in
   `AUTO_APPROVABLE` (Phase 2 §2.6a). `canAutoResolve()` returns `false` for it
   unconditionally.
2. The inbox item must show **the exact component list** that will be deleted and the target
   org alias, not a summary. The user is authorising specific deletions.
3. Require a typed confirmation of the org alias, the way destructive CLI tools do. A single
   click is too easy to fire by reflex on an item like this.
4. Only after approval does the item enter the deploy queue.

The other two rollback paths do not need this gate: scratch-org recreate is by definition
disposable, and restoring modified components from a snapshot is additive (it redeploys the
previous version rather than deleting anything).

During development, run the destructive path against a **scratch org only**. Do not point it
at a sandbox until the manifest generation has been verified by inspection.

Task → `ROLLED_BACK`, logged. `ROLLED_BACK` is terminal (`stateMachine.ts` in Phase 2 §2.1
has no transitions out of it) — a re-attempt is a new task.

### Wiring

- Capture in `DevAgent` step 1, at the `// TODO(SFAIO Phase 4)` marker Phase 2 §2.8 left
  there. Phase 2 captured no file snapshot at all, so there is nothing to replace.
- Restore on `SENIOR_REBUILD` (§4.4) and on explicit user rollback from the task drawer or
  run controls.
- `diff()` feeds Architect review (§4.3).

---

## 4.6 Pre-deploy freshness check

`SFAIO.md` §6.B7: immediately before deploy, query the org's `lastModifiedDate` for the
touched components and compare with the snapshot. If changed: retrieve, merge, re-validate,
then deploy.

**File:** `src/services/sfaio/deploy/freshness.ts`

### Getting `lastModifiedDate`

Two sources; pick per metadata type:

1. `sf org list metadata --metadata-type <Type> --target-org <alias> --json` returns
   `lastModifiedDate` per component. Works for most types. Note it is a per-type listing,
   so batch by type rather than querying per component.
2. Tooling API SOQL (e.g. `SELECT Id, Name, LastModifiedDate FROM ApexClass`) via
   `sf data query --use-tooling-api`. More precise for Apex-like types.

**Some types don't report a usable `lastModifiedDate`.** Don't pretend otherwise. Maintain
an explicit map:

```ts
type FreshnessStrategy = "listMetadata" | "toolingApi" | "unsupported"
const FRESHNESS_STRATEGY: Record<string, FreshnessStrategy> = {
	/* per metadata type */
}
```

For `unsupported`, skip the check and **record that it was skipped** on the deploy result,
so a later conflict is explainable. Silently skipping is how you get an unexplained
overwrite.

### On conflict

Do not auto-merge and deploy. `SFAIO.md` §11.5 lists freshness conflicts as a **Decision
Inbox** item — the human decides.

1. Task stays `QUEUED`; release the org lock so other tasks can proceed.
2. Create a `DecisionItem` of kind `FRESHNESS_CONFLICT` with: component name, snapshot
   timestamp, current org timestamp, and the diff between the org version and the local
   version (retrieve into a temp dir to produce it).
3. Offer three actions: **retrieve and merge** (agent re-runs with the org version as new
   baseline), **overwrite** (proceed with the local version), **abandon** (task →
   `CANCELLED`).

Run the check inside the queue claim, after acquiring the lock and before the deploy
command — that is the only point where "immediately before deploy" is true.

---

## 4.7 Heartbeats, watchdog, crash recovery

`SFAIO.md` §10.1 process-supervision and crash-recovery rows.

### Heartbeats

Each running agent writes `AgentRecord.lastHeartbeat = Date.now()` on a timer (e.g. every
10 s) and on every meaningful step transition.

**Batch these into existing writes where possible.** A heartbeat every 10 s per agent
through the single-writer store is real contention for no benefit — piggyback on state
updates and only write a standalone heartbeat if nothing else has been written recently.

### Watchdog

A timer in the orchestrator (every 30 s):

- Agent `BUSY` with `lastHeartbeat` older than a threshold (e.g. 3 minutes) → mark the
  agent `DEAD`, its task `FAILED` with reason `watchdog: agent stalled`, and surface it.
- Task `IN_PROGRESS` or `DEPLOYING` beyond a per-state timeout → same. `SFAIO.md` §10.2 is
  explicit: **marked and surfaced, never silently re-run.**

Timeouts must differ per state. A `DEPLOYING` task can legitimately take many minutes (the
existing deploy path uses a 10-minute timeout — `sfDeployMetadataTool.ts:843`), while an
`IN_PROGRESS` task with no heartbeat for 3 minutes is genuinely stuck.

Note the interaction with the deploy lock's `stale` value (Phase 0 §0.7): if the watchdog
declares a deploy dead before `proper-lockfile` considers the lock stale, the task is marked
failed while the lock is still held. Keep the lock's `stale` **shorter** than the
`DEPLOYING` watchdog timeout, or the queue deadlocks.

### Crash recovery

On extension activation:

1. Load all runs from the store. Nothing is in memory yet; the store is the truth.
2. For each run not in a terminal state:
    - reset all `AgentRecord`s to `IDLE` (the engine tasks are gone — the extension host
      restarted),
    - any task in `IN_PROGRESS`, `DRY_RUN` or `DEPLOYING` → `PAUSED` with reason
      `crash recovery: state unknown at restart`,
    - any `DeployQueueItem` in `DEPLOYING` → back to `WAITING`, and **release any stale org
      lock**,
    - run → `PAUSED`.
3. Create one `DecisionItem` per interrupted task asking the user to resume, retry, or
   cancel.

**Never auto-resume a `DEPLOYING` task.** The deploy may have succeeded in the org before
the crash. Re-running it blind can double-apply changes. The user must decide, and the
inbox item should tell them to check the org — include the CLI command that was running.

`SFAIO.md` §10.1 says tasks "resume from saved engine history where possible". The engine
does persist per-task conversation history (`api_conversation_history.json` via
`GlobalFileNames`), and `ClineProvider` has history-resume paths around `:756-940`. Reuse
them for `IN_PROGRESS` tasks the user chooses to resume — but only after they choose.

---

## 4.8 Phase 4 acceptance test

| #   | Check                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A task with a deliberate compile error self-retries exactly twice, then escalates.                                                                      |
| 2   | 429 responses do not consume the retry budget.                                                                                                          |
| 3   | A `FileRestrictionError` escalates immediately without retrying.                                                                                        |
| 4   | Escalation payload is rejected if any mandatory field is missing.                                                                                       |
| 5   | Architect answers an escalation; the task resumes with the instruction in context.                                                                      |
| 6   | The user overrides an Architect answer from the inbox and the task re-dispatches.                                                                       |
| 7   | Architect review fails a task that doesn't meet its acceptance criteria; it returns to the same agent with findings.                                    |
| 8   | Two failed reviews trigger reassignment; the EventLog shows the rule number and every signal value.                                                     |
| 9   | `SENIOR_FIX` keeps existing files; `SENIOR_REBUILD` restores the snapshot first. Verify on disk.                                                        |
| 10  | Snapshot of task A does not contain task B's concurrent edits. **This is the `F10` regression test.**                                                   |
| 11  | Rollback of task A restores only A's files; B's work on disk is untouched.                                                                              |
| 12  | Rollback of a created file deletes it (absence recorded correctly).                                                                                     |
| 13  | Sandbox rollback of new components produces a valid `destructiveChanges.xml` and deploys it through the queue.                                          |
| 13a | Destructive rollback **cannot** be auto-approved: with `autoMode: true`, it still raises `DESTRUCTIVE_ROLLBACK_APPROVAL` and waits (D4).                |
| 13b | The destructive approval item lists every component to be deleted and requires the org alias to be typed.                                               |
| 13c | Grep gate: nothing under `src/services/sfaio/` imports `simple-git`, `utils/git`, or `ShadowCheckpointService` (D1).                                    |
| 14  | Scratch-org rollback recreates the org.                                                                                                                 |
| 15  | Freshness check detects an out-of-band org change (edit a class in Setup mid-run) and raises a `FRESHNESS_CONFLICT` decision instead of overwriting.    |
| 16  | Freshness skip for an unsupported metadata type is recorded on the deploy result.                                                                       |
| 17  | Killing the extension host mid-run: on restart, no task is silently re-run, the queue lock is released, and every interrupted task has a decision item. |
| 18  | A `DEPLOYING` task interrupted by a crash is never auto-resumed.                                                                                        |
| 19  | Watchdog marks a stalled agent `DEAD` and surfaces its task.                                                                                            |
| 20  | Lock `stale` is shorter than the `DEPLOYING` watchdog timeout (assert in a unit test on the constants).                                                 |

---

## 4.9 Risks specific to this phase

- **Retry loops that never terminate.** Every loop in this phase needs a hard counter, not
  just a condition. Assert the counter increments before continuing; a bug where
  `selfRetryCount` isn't persisted means infinite retries and an unbounded bill.
- **Rollback correctness is the highest-stakes code in SFAIO.** It deletes and overwrites
  user files. Write unit tests against a temp directory before wiring it to a button, and
  make `restore()` refuse to act on any path not listed in the snapshot manifest.
- **`destructiveChanges.xml` deletes org metadata.** Test on a scratch org only, never
  against a sandbox, until the manifest generation is proven. Consider requiring explicit
  user confirmation for the sandbox-destructive path even in auto mode.
- **Freshness check adds latency to every deploy.** It runs inside the org lock, so it
  serializes with deploys. Batch per type and cache within a single queue drain.
- **The engine's history-resume paths are chat-shaped.** They assume a task on `clineStack`.
  Re-read `ClineProvider.ts:756-940` carefully before reusing them for background tasks; a
  resumed agent must land in `backgroundTasks`, not on the stack (Phase 0 §0.1).

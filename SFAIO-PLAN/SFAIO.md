# SFAIO — Salesforce AI Orchestrator

**Implementation Spec for SIID (replaces the current orchestrator)**

> **For Claude Code:** This document describes _what_ SFAIO must do and the decisions already made. _How_ to implement it is your call. **Before writing any code:**
>
> 1. Inspect the existing SIID codebase: orchestrator, agents, terminal pool, current state handling, SF CLI MCP server, org indexes (transaction/graph/other), and UI.
> 2. **SIID is a VS Code extension built on the Cline / Roo Code engine.** Map every requirement below onto the engine's existing primitives first (§3.1). Extend the engine; don't build parallel infrastructure beside it.
> 3. **SFAIO runs fully locally.** No external services (no Firestore or any cloud DB/queue/pub-sub). The only outbound calls allowed are to the configured LLM providers and the target Salesforce org. See §10.
> 4. Reuse what exists. Replace only the orchestration/routing/planning logic.
> 5. Produce an implementation plan mapped to the phases in §12, list the open decisions in §13 with your recommendation, and wait for approval before building.
> 6. Do not hardcode model names anywhere **in SFAIO** (code, config defaults, docs). Models are always configuration. (The pre-existing legacy tables `src/shared/mode-models.ts` and `src/shared/model-fallback.ts` stay, wired only to the legacy chat modes; SFAIO code must never read them.)

---

## 1. Goals

- Replace the current orchestrator with an **Architect-led, multi-agent** orchestrator.
- Run **multiple tasks on multiple agents in parallel** without deploy collisions.
- Give the user **full visibility and control** in the UI: agents, tasks, deploy queue, escalations, approvals, cost.
- Let the user **configure models per role** at run start, or pick an **AUTO** mode.

## 2. Non-Goals / Deferred (do NOT build now)

- Deterministic script-based XML generation (paused; future).
- PMD / Apex test / coverage gates (run later, on user selection, after deployment works).
- Per-task dynamic model selection (worker pool only for now).
- Automatic/periodic org re-sync (human-triggered only).
- Metadata instruction registry / Citation Service. Agents rely on current models for metadata knowledge; the Architect supplies task-level detail.

## 3. Existing Components to Reuse

| Component                                        | Use in SFAIO                                                   |
| ------------------------------------------------ | -------------------------------------------------------------- |
| Org indexes (transaction, graph, third index)    | Architect's primary context source                             |
| Index button in UI                               | Initial and subsequent org sync (human-triggered)              |
| ~~Firestore~~ → **Local state store (new, §10)** | All run/task/agent/queue state — built locally, no external DB |
| Terminal pool                                    | CLI execution for agents                                       |
| SF CLI MCP server                                | CLI operations                                                 |

Target orgs: **sandboxes and scratch orgs.**

### 3.1 Engine (Cline / Roo Code) primitives to build on

Verify each against the actual SIID fork — engine versions differ.

| SFAIO need                                   | Engine primitive to reuse / extend                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Agent roles (Architect, Senior, Mid, Junior) | **Modes** (custom modes with role-specific system prompts, tool groups, file restrictions)                     |
| Model per role                               | **API configuration profiles** bound per mode                                                                  |
| Agent execution loop                         | **Task** instances (agent loop, tool calls, context management)                                                |
| Architect → Dev delegation                   | Orchestrator-style **subtask** mechanism (`new_task`-like), extended for parallel children (see 3.2)           |
| Snapshots / rollback of local files          | ~~Checkpoints (shadow git)~~ → **local copy store, no git** (see §10.1)                                        |
| CLI execution                                | Engine **terminal integration** + existing SIID terminal pool                                                  |
| SF CLI MCP server                            | Engine **MCP hub** — note: no SF CLI MCP server exists today; SF ops are native tools calling the CLI directly |
| UI                                           | Extension **webview** (React + Tailwind + Radix) + message passing to the extension host                       |
| UI visual language                           | **Nocturne design system** (§11) — tokens, patterns and the Workspace mockup already exist                     |
| API keys                                     | **VS Code SecretStorage**                                                                                      |
| Autonomy                                     | Auto-approve settings — **global and flat today**; per-role scoping is new work                                |
| Token/cost tracking                          | Engine's per-task usage metrics (`TokenUsage.totalCost` already computed)                                      |

### 3.2 Known engine gaps SFAIO must close

- **Parallel tasks:** the engine's subtask model is a **stack** (parent pauses, one child runs at a time). SFAIO needs **multiple concurrent child Tasks** under one Architect run. This is the core engine change; do it first (Phase 0).
- **Per-task isolation:** each concurrent Task needs its own API handler, terminal, checkpoint scope, and cost counter; no shared mutable singletons.
- **Headless file edits:** the engine's diff-view editing opens editor tabs; concurrent agents must write files **without** fighting over the editor. Add a headless/direct-write edit path for background agents (file ownership from the task spec still applies).
- **Approvals:** interactive approvals can't block background agents. Background agents run fully auto-approved within their owned files and allowed commands; anything outside is rejected and escalated, not prompted.
- **Snapshots under concurrency:** the engine's shadow-git checkpoints are unusable here — they stage the whole worktree, so one agent's snapshot captures every other agent's in-flight work, and they self-disable when nested `.git` directories exist. SFAIO uses its own path-scoped copy store instead and runs agent Tasks with checkpoints off (§10.1).
- **Upstream merges:** keep SFAIO changes isolated (own modules, minimal edits to core engine files) so upstream Cline/Roo updates can still be merged.

---

## 4. Initialization & Metadata Sync

- On first connection of a project/org, show a checkbox: "Perform initial sync". One-time.
- If chosen: block the UI with a status message ("Syncing via SF CLI — time depends on retrieval size").
- Retrieval generates/updates the existing index files.
- **Re-sync is manual** via the existing index button. No scheduled or automatic full re-sync.

---

## 5. Agent Roster

| Role           | Tier               | Responsibilities                                                                                                                                   |
| -------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architect**  | Highest (thinking) | Requirement analysis, alignment questions, solution design, task graph, task specs, deploy ordering, escalation answers, code review, reassignment |
| **Senior Dev** | High               | Complex multi-file logic; escalation target for failed lower-tier tasks                                                                            |
| **Mid Dev ×N** | Mid                | Standard implementation, single components, routine test classes                                                                                   |
| **Junior Dev** | Low                | Simple/repetitive, highly constrained edits                                                                                                        |

- Implemented as a **worker pool**: pool size and count per tier are configurable (§9).
- Model per role comes from configuration only.

---

## 6. Execution Workflow

### Phase A — Analysis & Design (Architect)

1. **Intake** the requirement.
2. **Selective context retrieval:** read index files first; use `read_file` to pull specific metadata only when needed. Avoid context bloat.
3. **Implementation alignment** (question to user via UI Decision Inbox):
    - Heavily customized org → "Follow existing implementation patterns?"
    - Greenfield/empty org → ask preferred standards (trigger framework, LWC practices, PMD strictness, etc.).
4. **Design document** produced.
5. **Human approval gate:** the user approves or rejects (with comments) before any dev work starts.
6. **Task graph:**
    - **Wave 0 — Schema:** objects, fields, and other foundational metadata that others depend on. Deployed first.
    - **Wave 1..N — Components:** Apex, LWC, Flows, etc., split across agents. Independent components go to different agents in parallel; tightly coupled work goes to the same agent.
    - A wave starts only when the previous wave is fully `DONE`.
    - The Architect assigns tasks to avoid file overlap and sets **deploy order** based on dependencies.
7. **Task specs:** one **fixed schema** for every task; the Architect varies only the **depth of instruction** by tier (Junior = most explicit and constrained, Senior = high-level intent). Minimum fields:
    - `taskId`, `wave`, `assignedTier`, `objective`
    - `filesOwned` (exclusive), `filesReadOnly`
    - `interfaces/contracts` (method signatures, field API names, etc.)
    - `acceptanceCriteria`
    - `constraints` (standards chosen in step 3)
    - `generatorFlags` (if any)
    - `instructions` (tier-dependent detail)
8. **Delegation approval gate:** before any task is assigned to an agent, show the user the
   validated task graph — wave, task, tier, assigned agent, files owned — with **Approve**,
   **Edit** or **Reject**. Rejection with comments returns to the Architect to re-plan.
9. **Auto mode** (per run, set at setup and toggleable mid-run): skips the _permission_ gates —
   the step-5 design approval and the step-8 delegation gate — the way an auto-accept mode does.
   It never skips a **safety stop**: destructive-change rollback on a sandbox (§8), a freshness
   conflict (§6.B7), and a budget-cap pause (§9) always wait for a human. Alignment questions
   (step 3) auto-answer only in the customized-org case, where "follow existing patterns" is a
   safe default; the greenfield-standards case still asks once, because a wrong guess there is
   copied into every task's `constraints` with no later checkpoint. Every auto-passed gate is
   still recorded in the event log with actor `system`, so the audit trail has no silent gaps.

### Phase B — Development & Deployment (Dev agents)

Per task:

1. **Snapshot:** git commit (or equivalent) of the files the task touches, and store `lastModifiedDate` from the org for those components.
2. **Scaffold with SF CLI generators** so `-meta.xml` files are always present (e.g. `sf apex generate class`, `sf lightning generate component`, `sf schema generate sobject/field`). Default flags unless the spec provides flags.
    - ⚠ `sf schema generate *` is interactive. Test this. If it can't be driven non-interactively, fall back to index-based XML templates.
3. **Implement** strictly per spec. No assumptions outside the spec; unclear points → escalate.
4. **Sub-tasking:** the agent may split its own task and run independent CLI calls in parallel locally.
5. **Dry-run** deploy (check-only).
6. **Enqueue** for deploy (§7).
7. **Pre-deploy freshness check:** query the org's `lastModifiedDate` for the touched components _immediately before deploy_ and compare with the snapshot. If changed, retrieve, merge, re-validate, then deploy.
8. **Deploy** (isolated, per task).
9. **Self-correction:** on failure, read the CLI error, fix, retry. **Max 2 self-retries**, then escalate.

### Phase C — Review & Escalation

1. **Escalation payload** (structured, required): exact blocker, file/line location, CLI error (if any), what was tried, proposed solution. The Architect replies with a definitive, unambiguous instruction.
2. **Architect review** on completion against the requirement and acceptance criteria. Send back for fixes **max 2 times**.
3. **Deterministic reassignment rule** (no LLM "cost calculation"). Based on what is implemented vs. what's broken:
    - Failed after 2 self-retries + escalation on Junior/Mid → reassign to Senior.
    - If most of the implementation is sound and the failure is localized → Senior **fixes** existing code.
    - If the implementation is structurally wrong or mostly incomplete → Senior **rebuilds** from the spec.
    - Senior fails → Architect takes over or surfaces to the human.
    - Exact thresholds are implementer's choice; they must be rule-based and logged.

---

## 7. Deploy Queue

- **FIFO per target org, implemented in code** (no LLM managing the queue). Replaces sleep/poll mutex.
- The Architect decides **order/priority** at planning time; the queue enforces **one deploy at a time per org** (shared files like profiles/permission sets make concurrent deploys risky).
- Queue state persisted in the local state store (§10); must survive restarts.
- The lock must be atomic (local DB transaction or OS-level lock), not check-then-act.

## 8. Rollback

- Triggered per task or per run (user can instruct the agent, or use the UI button).
- **Scratch org:** discard/recreate.
- **Sandbox, new components:** deploy `destructiveChanges.xml`.
- **Sandbox, modified components:** redeploy from the pre-task snapshot.
- Rollback actions are logged and reflected in task state (`ROLLED_BACK`).

---

## 9. Model Configuration

Shown at run start (setup screen); locked for the run. Changes mid-run apply only to new tasks.

**Manual mode**

- Per role (Architect, Senior, Mid, Junior): pick an engine **API configuration profile** (provider + model + settings). Reuse the engine's provider list and profile UI.
- Pool size / count per tier.

**AUTO mode**

- Deterministic **presets** (e.g. Economy / Balanced / Quality) mapping each role to models from the user's **configured providers**. Lookup table, no LLM choosing models.
- Presets must be editable in settings.

**Validation before run**

- Verify API keys / connectivity with a test call per configured model; block run start on failure with a clear error.

**Optional:** budget cap per run (tokens or cost). On hitting the cap → pause the run and ask the user.

Must support existing cloud providers and leave room for a local inference provider (future fine-tuned local model).

---

## 10. Local Infrastructure & State Model

Everything runs on the user's machine. Implementer picks the concrete tech; it must meet these requirements.

### 10.1 What must be built locally

| Need                      | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Replaces                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **State store**           | Embedded, file-based DB in the extension's global/workspace storage (no server process). ACID transactions. Safe for concurrent writes from multiple Tasks (single-writer service in the extension host is simplest). Versioned schema migrations. Must package cleanly in a VS Code extension on Win/Mac/Linux (native modules need per-platform builds; a WASM/pure-JS option avoids that). Engine's existing task-history storage stays as-is; SFAIO state lives alongside it. | Firestore               |
| **Atomic locks / claims** | Deploy-queue lock and task claiming (one agent per task) done inside a transaction or with an OS-level file lock. No check-then-act.                                                                                                                                                                                                                                                                                                                                              | Firestore transactions  |
| **Event bus**             | In-process pub/sub: every state change emits an event.                                                                                                                                                                                                                                                                                                                                                                                                                            | Firestore listeners     |
| **UI live updates**       | Extension host → webview `postMessage`. Throttle/batch high-frequency events (logs, token counts).                                                                                                                                                                                                                                                                                                                                                                                | Firestore realtime sync |
| **Log storage**           | Per-agent / per-task log files on disk (CLI output, LLM transcripts), size-capped with rotation; DB stores paths and summaries, not full logs.                                                                                                                                                                                                                                                                                                                                    | —                       |
| **Snapshots**             | **A local file copy store, path-scoped to each task's `filesOwned`. No git** — not every user has the binary, engine checkpoints stage the whole worktree (so one agent's snapshot captures another's in-flight work) and self-disable on nested repos. Diffs come from the `diff` npm package. Org-side rollback per §8.                                                                                                                                                         | —                       |
| **Secrets**               | VS Code SecretStorage (engine already does this); never in plain config or logs.                                                                                                                                                                                                                                                                                                                                                                                                  | —                       |
| **Process supervision**   | Agents are concurrent Task instances in the extension host. Each writes heartbeats to the state store; a watchdog marks stalled Tasks and surfaces them. Cap concurrency (pool size) to keep the extension host responsive.                                                                                                                                                                                                                                                       | —                       |
| **Crash recovery**        | On VS Code reload/crash, rebuild state from the store; Tasks resume from saved engine history where possible, otherwise marked for user action.                                                                                                                                                                                                                                                                                                                                   | —                       |
| **Backup / export**       | Export a run (state + logs + summary) as a local archive.                                                                                                                                                                                                                                                                                                                                                                                                                         | —                       |

Allowed network access: configured LLM providers and the Salesforce org (via SF CLI). Everything else local.

### 10.2 State model

Entities (names indicative): `Run`, `Task`, `Agent`, `DeployQueueItem`, `Escalation`, `Snapshot`, `ModelConfig`, `EventLog`.

**Task states**

```
PENDING → ASSIGNED → IN_PROGRESS → DRY_RUN → QUEUED → DEPLOYING → IN_REVIEW → DONE
side states: FAILED, ESCALATED, REASSIGNED, ROLLED_BACK, PAUSED, CANCELLED
```

**Run states:** `SETUP → ANALYZING → AWAITING_ALIGNMENT → AWAITING_DESIGN_APPROVAL → EXECUTING → COMPLETED / FAILED / PAUSED / CANCELLED`

Rules:

- Every state transition writes an `EventLog` entry (timestamp, actor, from→to, reason).
- The UI reads **only** from these entities; it never parses raw agent output for status.
- Crash recovery: on restart, resume runs from persisted state; tasks stuck `IN_PROGRESS`/`DEPLOYING` beyond a timeout are marked and surfaced (no silent re-run).

---

## 11. UI / UX

Built in the engine's React webview. Views can be tabs in the existing sidebar webview and/or a dedicated editor-area webview panel for the run board (more space). All screens are live-updating from state.

**Visual language: the Nocturne design system.** Source of truth is
`SFAIO-PLAN/siid-reactive-ide-design/project/_ds/nocturne-*/` (tokens in `styles.css`, intent in
`readme.md`), with the interaction patterns demonstrated in that project's
`SIID Workspace.dc.html` — a complete agentic-IDE mockup on the same tokens.
`SFAIO-PLAN/UI-THEME-nocturne.md` is the implementation spec: how the tokens are scoped, which
mockup patterns to lift, and what must not be ported.

Non-negotiables that follow from it:

- Every color, font, space, radius and shadow comes from a token. No hex literals, no raw px
  spacing, no font names in component code.
- The accent is a line, an outline, a dot or a 3px meter fill — **never a flood**.
- JetBrains Mono for everything machine-generated (paths, counts, durations, token and cost
  figures, ids, CLI output); Inter for interface text. The split is how the eye separates
  measurement from chrome.
- Nocturne is dark-only and is **scoped to SFAIO surfaces** via a `data-sfaio-theme` wrapper.
  The rest of the extension keeps following the user's VS Code theme — SFAIO must not restyle it.
- Nocturne is a mono system with **no state colors**. SFAIO adds a six-role semantic set
  (idle / active / waiting / success / attention / danger / spent) in the system's own OKLCH
  discipline; see `UI-THEME-nocturne.md` §4. Task and run state must **also** be conveyed by
  icon and text label, never by color alone — 14 states cannot be distinguished by hue.
- The webview CSP (`src/core/webview/ClineProvider.ts`) blocks external fonts and the Phosphor
  icon font. Vendor the fonts via `@fontsource/*` and use `@phosphor-icons/react`. Do not relax
  the CSP.
- All continuously-looping animation stops under `prefers-reduced-motion: reduce`; the mockup's
  scanline/scan-sweep ambience ships behind a setting, default off.

1. **Setup screen:** target org, Manual/AUTO mode, models per role, pool size, optional budget cap, Start.
2. **Run board:**
    - Task graph grouped by **wave**, nodes colored by state.
    - Toggle to Kanban (columns = task states).
    - Filters: by agent, tier, state, wave.
3. **Agent panel:** one card per agent showing role/tier, model, current task, status, retries used, tokens/cost, live log stream (collapsible).
4. **Deploy queue panel:** currently deploying item, waiting items in order, last results (success/fail with error snippet).
5. **Decision Inbox:** single place for everything needing the human: alignment questions, design approval, escalations surfaced to human, budget-cap pauses, and freshness conflicts. Badge count visible globally.
6. **Task drawer (click any task):** spec, assigned agent history, diffs, CLI output, dry-run/deploy results, retry and review history, escalation thread, **Rollback** button.
7. **Run controls:** pause/resume/cancel run; pause an agent; manually reassign a task; retry a task.
8. **Run summary:** duration, cost/tokens per role, tasks done/failed/reassigned, files changed, deployments, rollbacks.
9. **Sync:** initial sync checkbox + blocking status (§4); index button for re-sync.

UX requirements:

- Never block the whole UI except during initial sync.
- Every automated decision (assignment, reassignment, deploy order, rollback) is visible with its reason.
- Errors are shown with the actual CLI message, not a generic failure.

---

## 12. Build Phases (iterative — validate each before the next)

One sequence covering both repos: SFAIO and the product UI redesign are a single ordered implementation, not parallel tracks.

0. **Engine groundwork:** concurrent child Tasks, per-task isolation, headless edit path, per-role auto-approve, SFAIO state store. Validate by running 2 dummy Tasks in parallel editing different files.
1. **Design foundation** _(both repos; can run alongside phase 0)_: the Nocturne VS Code colour theme as the product default, fonts bundled in both repos, the webview token layer and state palette, the shared UI primitives every later phase consumes, and removal of every hardcoded colour already in the codebase. See §11.
2. **MVP:** state model + Architect pipeline (A1–A9) + a **single** dev agent + deploy queue + basic run board + Decision Inbox (alignment, design approval, delegation gate).
3. **Parallelism:** worker pool, multiple dev agents, waves, agent panel, deploy queue panel.
4. **Resilience:** self-retries, escalation, Architect review, deterministic reassignment, freshness check, snapshots + rollback, crash recovery.
5. **Configuration:** Manual/AUTO model config, validation, budget cap, run summary.
6. **Product reskin:** the surfaces that predate SFAIO — agent chat panel, indexing modal, history, settings, status bar — brought up to the design structurally. Phase 1 already made them correct in colour.
7. **Fork chrome:** the custom top bar, workbench UI font, loading screen. The only phase that patches VS Code workbench source, and therefore the only one carrying permanent merge debt — re-justify it against phase 1's result before starting.

**Deferred (not a phase — do not build):** PMD/test/coverage gates, deterministic XML scripts, per-task model selection.

Acceptance for phases 2–5: run the standard acceptance scenario end-to-end on a scratch org. Phases 1, 6 and 7 have their own visual acceptance criteria.

---

## 13. Open Decisions (resolve by inspecting the project; propose, don't assume)

1. Which engine base the SIID fork follows (Cline vs Roo Code, version) and how far it has diverged → decides which primitives in §3.1 exist as-is.
2. ~~Does each SIID project already have a git repo?~~ **Resolved: SFAIO requires no git and creates no repo.** A project's version control is the user's business.
3. Choice of embedded DB (packaging constraints in §10.1) and how existing Firestore-dependent code (if any) is migrated/removed.
4. Sidebar tabs vs dedicated editor panel for the run board.
5. Can the human answer escalations / edit tasks mid-run, or only the Architect? (Default: Architect answers; human can override from the Decision Inbox.)
6. Budget cap: tokens, cost, or both; default on/off.
7. Whether `sf schema generate *` can run non-interactively in this environment.
8. Migration path: how existing runs/state from the old orchestrator are handled (or not).

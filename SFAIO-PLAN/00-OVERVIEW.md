# SFAIO Implementation Plan — Overview & Orientation

**Read this file first. Then read the phase file you are working on.**

You are implementing SFAIO (Salesforce AI Orchestrator) inside the SIID-Code VS Code
extension. The authoritative _requirements_ document is `SFAIO.md`, alongside these files in `SFAIO-PLAN/`.
These plan files are the _implementation instructions_: what to edit, where, and why.

If this plan and `SFAIO.md` ever disagree, `SFAIO.md` wins on **what** to build and
this plan wins on **where** the code goes. Flag the contradiction rather than guessing.

---

## 1. Ground rules

1. **Verify every line number before you edit.** Every anchor in these documents was
   read at a specific baseline (§2). Files drift. Always `grep` for the quoted code
   snippet rather than trusting the line number blindly.
2. **Do not hardcode model names** anywhere in SFAIO code, config defaults, or docs.
   Models are always configuration. (Exception: the pre-existing legacy tables in §6 —
   leave them alone, but never read them from SFAIO code.)
3. **Prefer new modules over edits to engine files.** SIID-Code is a fork of Roo Code
   and still merges upstream. Every in-place edit to a core engine file is future merge
   pain. §5 lists the small set of files you _must_ touch; everything else goes in
   `src/services/sfaio/`.
4. **Never delete or repurpose existing behaviour** to make room for SFAIO. The
   interactive chat experience (Salesforce Agent / Code / Orchestrator modes) must keep
   working exactly as it does today, on the same code paths.
5. **One phase at a time.** Each phase has an acceptance test at the bottom of its file.
   Do not start phase N+1 until phase N's acceptance test passes.

---

## 2. Baseline

- **Repo:** `Siid-Code` — `https://github.com/Conscendotechnologies/Siid-Code.git`
- **Branch SFAIO off:** `KoDe-2.o` (remote: `origin/KODE-2.o`).
- **Warning:** the working tree may currently be on a different branch (it was on
  `fix-history-tab-deletion` when this plan was written). Confirm with
  `git rev-parse --abbrev-ref HEAD` before you start, and branch from `KoDe-2.o`
  explicitly.
- All anchors below were verified identical between `KoDe-2.o` and the branch they were
  read on, for every file this plan touches.

### Repo layout you need to know

| Path              | What it is                                                            |
| ----------------- | --------------------------------------------------------------------- |
| `src/`            | Extension host code (Node). This is where nearly all SFAIO code goes. |
| `webview-ui/`     | React 18 + Vite + Tailwind + Radix webview. All SFAIO UI goes here.   |
| `packages/types/` | Shared zod schemas + TS types, imported as `@siid-code/types`.        |
| `src/webview-ui/` | **Build output.** Never edit.                                         |
| `apps/`           | e2e tests, nightly build, docs sites. Not relevant to SFAIO.          |

There is a sibling repo `Siid` (a VS Code fork). **SFAIO does not touch it.** It hosts a
`firebase-service` extension used for auth and API-key provisioning; that stays exactly
as it is.

---

## 3. Verified facts that shape this design

These were established by reading the code. They are the reason the plan looks the way
it does. Each is worth re-confirming if something doesn't behave as described.

| #   | Fact                                                                                                                                                                                                                                                                                                   | Evidence                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Task execution is a **LIFO stack**, not a pool. Only the top task is "current".                                                                                                                                                                                                                        | `src/core/webview/ClineProvider.ts:111` (`clineStack: Task[]`), `:315-320` (`getCurrentCline`)                                                             |
| F2  | Subtasks **pause the parent** and run one at a time, returning a string.                                                                                                                                                                                                                               | `src/core/task/Task.ts:1458` (`resumePausedTask`), `:1976-1982`                                                                                            |
| F3  | A task's mode is read from **global provider state**, not from the task. Three separate read points.                                                                                                                                                                                                   | `Task.ts:437-441`, `Task.ts:2578` (`mode` destructured from `getState()`), `src/core/assistant-message/presentAssistantMessage.ts:426`                     |
| F4  | Mode `fileRegex` **is enforced by the engine** and throws `FileRestrictionError`. This is how file ownership becomes a hard guarantee.                                                                                                                                                                 | `src/shared/modes.ts:218-245`, schema at `packages/types/src/mode.ts:9-31`                                                                                 |
| F5  | Every file write routes through `diffViewProvider.open()`, which calls `showTextDocument` — it **opens editor tabs**.                                                                                                                                                                                  | `src/core/tools/writeToFileTool.ts:125,241`, `src/core/tools/applyDiffTool.ts:191`, `src/integrations/editor/DiffViewProvider.ts:218,457,526,592,714`      |
| F6  | `diffViewProvider` is instantiated **per Task**, so a headless implementation can be injected per agent without touching the interactive path.                                                                                                                                                         | `Task.ts:351`                                                                                                                                              |
| F7  | `askResponse` from the webview is delivered only to `getCurrentCline()` and **silently dropped** if the `taskId` doesn't match.                                                                                                                                                                        | `src/core/webview/webviewMessageHandler.ts:520-533`                                                                                                        |
| F8  | Auto-approve settings are **flat and global**, with permissive defaults. No per-mode scoping exists.                                                                                                                                                                                                   | `packages/types/src/global-settings.ts:51-62`, defaults at `:256-266`                                                                                      |
| F9  | Deploy/validate/retrieve **never pass `--target-org`**; they rely on the CLI's default org.                                                                                                                                                                                                            | `src/core/tools/sfDeployMetadataTool.ts:307-372`, `:950`                                                                                                   |
| F10 | Shadow-git checkpoints stage the **entire worktree** (`git add .`) with `core.worktree` pointing at the workspace. Under parallelism one agent's snapshot captures every other agent's in-flight files.                                                                                                | `src/services/checkpoints/ShadowCheckpointService.ts:146-148`, `:188-198`                                                                                  |
| F11 | Checkpoints are **disabled entirely** if any nested `.git` exists below the workspace root.                                                                                                                                                                                                            | `ShadowCheckpointService.ts:70-80`, `:156-186`                                                                                                             |
| F12 | The terminal pool **is** parallel-safe: terminals are keyed by `taskId` and `busy`. Reuse it as-is.                                                                                                                                                                                                    | `src/integrations/terminal/TerminalRegistry.ts:153-208`                                                                                                    |
| F13 | `Task` already takes its own `apiConfiguration` and builds its own API handler — per-role models are structurally easy.                                                                                                                                                                                | `Task.ts:301`, `:340-341`                                                                                                                                  |
| F14 | `modeApiConfigs` exists in the settings schema and is _displayed_ in the UI, but nothing writes it and nothing reads it to select a handler. Role→model binding must be rebuilt.                                                                                                                       | `packages/types/src/global-settings.ts:143`, `webview-ui/src/components/modes/ModesView.tsx:772`; `DEFAULT_MODES` comments in `packages/types/src/mode.ts` |
| F15 | Module-level mutable state keyed by **mode**, not task — will cross-talk between concurrent agents.                                                                                                                                                                                                    | `src/shared/model-fallback.ts:43,49,54`                                                                                                                    |
| F16 | `FileChangesService` is a **static singleton** over a whole-file JSON read→mutate→write store, and it is on the deploy path. Concurrent writes lose data.                                                                                                                                              | `src/services/file-changes/FileChangesService.ts:7,15`, `FileChangesDatabase.ts:50,64-82`, called from `sfDeployMetadataTool.ts:587`                       |
| F17 | `safeWriteJson` already provides atomic rename + `proper-lockfile` advisory locking. Use it; don't reinvent it.                                                                                                                                                                                        | `src/utils/safeWriteJson.ts:4,40-42,74-100,234`                                                                                                            |
| F18 | An SF metadata instruction registry already exists (`GlobalFileNames` + `TaskTypeMapping` + `getTaskGuidesTool`). The Architect should use it to populate task-spec `instructions`.                                                                                                                    | `src/shared/globalFileNames.ts`                                                                                                                            |
| F19 | There is no SF CLI MCP server. SF operations are native tools calling `child_process.exec` directly.                                                                                                                                                                                                   | `src/core/tools/sfDeployMetadataTool.ts:3,600`; `src/services/mcp/McpHub.ts` is stock config-driven MCP                                                    |
| F20 | SF metadata generators write XML from templates; no `sf apex generate` / `sf schema generate` call exists anywhere.                                                                                                                                                                                    | `src/core/sf-metadata/generators/`, `src/core/tools/generateApexClassTool.ts:82`                                                                           |
| F21 | An editor-area webview panel is already created somewhere in the codebase — copy the pattern for the run board.                                                                                                                                                                                        | `src/activate/registerCommands.ts:518`, `ClineProvider.tabPanelId` at `ClineProvider.ts:106`                                                               |
| F22 | Org index files are large (graph ~7 MB) but a query router exists. Never read raw index files into a prompt.                                                                                                                                                                                           | `src/services/code-index/processors/salesforce-search-router.ts`                                                                                           |
| F23 | The webview CSP allows **no external fonts or stylesheets** - `font-src` is `cspSource data:` and `style-src` is `cspSource 'unsafe-inline'`. The design system's Google Fonts import and the Phosphor icon-font CDN both fail **silently**. Vendor them.                                              | `src/core/webview/ClineProvider.ts:1114`; `UI-THEME-nocturne.md` 1.1                                                                                       |
| F24 | The webview's Tailwind `@theme` maps every color onto `--vscode-*`, so existing UI follows the editor theme. Nocturne is fixed dark, so it must be **scoped** to SFAIO surfaces, not applied globally.                                                                                                 | `webview-ui/src/index.css` (the `@theme` block); `UI-THEME-nocturne.md` 5                                                                                  |
| F25 | **`Task.ask()` never times out** — `pWaitFor(…, { interval: 100 })` with no deadline, and responses only reach `getCurrentCline()`. Any blocking ask from a background task hangs it **forever**.                                                                                                      | `Task.ts` `ask()`; `blockingAsks` at `packages/types/src/message.ts:51-59`                                                                                 |
| F26 | **`attemptCompletionTool` hangs a background task on both branches** — `ask("completion_result")` with no parent, or `askFinishSubTaskApproval()` with one. There is no safe out-of-the-box completion path.                                                                                           | `src/core/tools/attemptCompletionTool.ts:105-125`                                                                                                          |
| F27 | **`provider.finishSubTask()` pops the INTERACTIVE stack.** A background task with `parentTask` set would close the user's own chat on completion. Never pass `parentTask` to an SFAIO agent.                                                                                                           | `ClineProvider.ts:334-339`                                                                                                                                 |
| F28 | `addToClineMessages` calls `postStateToWebview()` on **every message**, serializing whole extension state. N agents streaming = N× full state posts per message.                                                                                                                                       | `Task.ts` `addToClineMessages`; `ClineProvider.ts:1629`, `:1869`                                                                                           |
| F29 | With **no workspace folder open**, `Task.cwd` falls back to the user's **Desktop**; with **multiple roots** it follows the focused editor, so sibling agents can get different `cwd`s.                                                                                                                 | `src/utils/path.ts:109`; `Task.ts` constructor                                                                                                             |
| F30 | Fork patches carry **53 hardcoded hexes** across four files — 33 of them in `blockingProgressDialog.ts`, the dialog `SFAIO.md` §4 uses for the blocking initial sync.                                                                                                                                  | counted in `Siid/src/vs/workbench/…`; see Phase 1 §1.6                                                                                                     |
| F31 | `sf project deploy start` destructive flags confirmed on the installed CLI: `--pre-destructive-changes`, `--post-destructive-changes`, `-x/--manifest`. Conventional filename is `destructiveChangesPost.xml`.                                                                                         | `sf project deploy start --help`                                                                                                                           |
| F32 | **`Task.lastGlobalApiRequestTime` is `private static`** — one rate-limit slot shared by every task in the process. Under parallelism it serialises all agents, and the countdown emits a message per second.                                                                                           | `Task.ts:210`, `:2719-2738`; fix in Phase 3 §3.3a                                                                                                          |
| F33 | `recursivelyMakeClineRequests` is **public** (`Task.ts:1960`), so a task can be given another turn without engine surgery — but `addToApiConversationHistory` and `isLoopRunning` are private, and `resumePausedTask` is the banned subtask path.                                                      | `Task.ts:1458-1500`, `:1960`; Phase 4 §4.1                                                                                                                 |
| F34 | A **real extension-host e2e harness already exists** — `apps/vscode-e2e`, `pnpm test:run`, with `subtasks.test.ts` / `task.test.ts` driving live tasks through `globalThis.api`. Phase 0's acceptance is written as a suite here, so it is machine-verifiable. Needs `.env.local` with a provider key. | `apps/vscode-e2e/package.json`, `src/suite/subtasks.test.ts`                                                                                               |

---

## 4. Target module layout

All new code lives here unless stated otherwise:

```
src/services/sfaio/
├── index.ts                     # public entry: SfaioService singleton, wiring
├── types.ts                     # Run, SfaioTask, AgentRecord, DeployQueueItem,
│                                #   Escalation, Snapshot, TaskSpec, EventLog entities
├── state/
│   ├── Store.ts                 # single-writer persistence + transactions
│   ├── paths.ts                 # storage path resolution
│   ├── migrations.ts            # versioned schema migrations
│   ├── EventBus.ts              # in-process pub/sub
│   └── EventLog.ts              # append-only NDJSON writer
├── orchestrator/
│   ├── SfaioOrchestrator.ts     # run lifecycle, phase transitions
│   ├── Scheduler.ts             # wave gating, task claiming, pool (Phase 3)
│   ├── stateMachine.ts          # legal transitions + guards
│   └── reassignment.ts          # deterministic rules (Phase 4)
├── agents/
│   ├── ArchitectAgent.ts        # Phase A pipeline
│   ├── DevAgent.ts              # Phase B pipeline
│   ├── agentModes.ts            # ephemeral per-task ModeConfig builder
│   └── prompts/                 # role prompt fragments (no model names!)
├── deploy/
│   ├── DeployQueue.ts           # FIFO per org + atomic lock
│   ├── DeployWorker.ts          # drains the queue, one at a time per org
│   └── freshness.ts             # pre-deploy lastModifiedDate check (Phase 4)
├── snapshots/
│   └── SnapshotService.ts       # path-scoped snapshot + rollback (Phase 4)
├── edit/
│   └── HeadlessEditProvider.ts  # non-tab-opening edit surface (Phase 0)
├── cost/
│   └── CostTracker.ts           # per-task cost, run rollup, cap (Phase 5)
└── config/
    ├── roleConfig.ts            # role → provider-profile mapping (Phase 5)
    └── presets.ts              # AUTO presets (Phase 5)

webview-ui/src/components/sfaio/
├── theme/
│   ├── nocturne.css             # Nocturne tokens + SFAIO state tokens + keyframes
│   └── StateChip.tsx            # the one place a state becomes colour + icon + label
├── SetupScreen.tsx
├── RunBoard.tsx
├── AgentPanel.tsx
├── DeployQueuePanel.tsx
├── DecisionInbox.tsx
├── TaskDrawer.tsx
├── RunSummary.tsx
└── hooks/useSfaioState.ts
```

---

## 5. Engine files you must edit in place

Keep these edits **minimal and clearly commented** with `// SFAIO:` so future upstream
merges are tractable. This is the complete list; if you find yourself editing anything
else in `src/core/`, stop and reconsider.

| File                                                             | Why                                                             | Phase |
| ---------------------------------------------------------------- | --------------------------------------------------------------- | ----- |
| `src/core/webview/ClineProvider.ts`                              | background task registry alongside `clineStack`                 | 0     |
| `src/core/task/Task.ts`                                          | `TaskOptions` additions; per-task mode; headless edit injection | 0     |
| `src/core/assistant-message/presentAssistantMessage.ts`          | use task mode instead of global mode                            | 0     |
| `src/core/tools/writeToFileTool.ts`                              | route through the injected edit surface                         | 0     |
| `src/core/tools/applyDiffTool.ts`                                | same                                                            | 0     |
| `src/core/webview/webviewMessageHandler.ts`                      | fix ask routing (F7); add SFAIO messages                        | 0 / 1 |
| `src/core/tools/sfDeployMetadataTool.ts`                         | `--target-org`; skip interactive approval for background agents | 1     |
| `src/core/tools/validateSfMetadataTool.ts`                       | `--target-org`                                                  | 1     |
| `src/core/tools/retrieveSfMetadataTool.ts`                       | `--target-org`                                                  | 1     |
| `packages/types/src/global-settings.ts`                          | SFAIO settings keys                                             | 1 / 4 |
| `src/shared/ExtensionMessage.ts`, `src/shared/WebviewMessage.ts` | SFAIO message types                                             | 1     |

---

## 6. Things to leave alone

- `src/shared/mode-models.ts` and `src/shared/model-fallback.ts` — **decision made: keep
  them**, wired only to the legacy chat modes (`salesforce-agent`, `code`,
  `orchestrator`). SFAIO code must never import or read them. They contain hardcoded
  model names; that is accepted for legacy paths only.
- `analyzeTaskComplexity` (`src/core/task/analyzeTaskComplexity.ts`, called at
  `ClineProvider.ts:700`) — stays on the legacy chat start path. SFAIO must not call it;
  per-task dynamic model selection is an explicit non-goal in `SFAIO.md` §2.
- The `orchestrator` mode in `packages/types/src/mode.ts:174` — keep it. SFAIO does not
  replace it in the mode list; SFAIO is a separate surface.
- The `firebase-service` extension and all auth / API-key provisioning.
- `src/.roo/rules/00-global-salesforce-critical.md` — SFAIO agents **inherit** these
  rules (bulkification, `with sharing`, generators over raw XML, 85% coverage).

---

## 7. Naming — avoid the collision

The engine already has a class called `Task`. SFAIO has its own concept of a task. In
code and comments:

- **`Task`** (unqualified) = the engine's agent-loop class in `src/core/task/Task.ts`.
- **`SfaioTask`** = the SFAIO unit of work (a row in the state store, with a spec, a
  wave, a tier, and a state from `SFAIO.md` §10.2).
- **`AgentRecord`** = a worker in the pool, which _runs_ an engine `Task` to execute an
  `SfaioTask`.

One `SfaioTask` maps to exactly one engine `Task` instance at a time. On reassignment it
gets a new engine `Task`.

---

## 8. Decisions taken (confirmed — do not re-litigate)

These were open when this plan was drafted and have since been answered. They are settled;
build to them.

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **No dependency on git.** Not every user has the git binary installed, and shelling out to it is slow. SFAIO snapshots, diffs and rollback use a local file copy store (Phase 4 §4.5) and the `diff` npm package. Do **not** use the engine's shadow-git checkpoints, `simple-git`, or `src/utils/git.ts` anywhere in SFAIO. Agent tasks run with `enableCheckpoints: false`. This supersedes `SFAIO.md` §10.1's "local git repo per project" row — see §8.1.                     |
| D2  | **Budget cap pauses, it does not terminate.** On hitting the cap the run halts, tells the user prominently, and can resume after the cap is raised. The user must also be warned as the cap is _approached_, not only when it is hit. Phase 5 §5.5.                                                                                                                                                                                                                               |
| D3  | **Auto mode skips human approval gates**, the same way Claude Code's auto-accept works: both the design-approval gate and the delegation gate are auto-passed. It does **not** skip the safety stops in D4. Phase 2 §2.6a has the full policy table.                                                                                                                                                                                                                              |
| D4  | **Three things always require a human, even in auto mode:** destructive-change rollback on a sandbox, freshness conflicts, and budget-cap pauses. All three risk irreversible loss of work — org metadata, someone else's org change, or money. Auto mode is about skipping _permission_, never about skipping _safety_.                                                                                                                                                          |
| D5  | **The loading screen is the current `SIID Loading.dc.html`, palette kept.** `v1 (rings)` is superseded — do not build it. The loader is not off-palette: it runs a teal↔violet pair whose violet end is the product accent's family, so it reads as its own pre-launch moment and still hands off to the workspace. Its two hues are **loader-only** and must appear nowhere else; its `#000000` ground is an accepted exception to Nocturne's no-pure-black rule. Phase 7 §7.4. |
| D6  | **The state palette is approved.** Amber for `attention`, green for `success`, danger as derived — L 0.74 / C 0.150, all three in sRGB gamut and within one contrast point of each other. No longer provisional; build on it. `UI-THEME-nocturne.md` §4.2.                                                                                                                                                                                                                        |

### 8.1 Deviations from `SFAIO.md` this plan makes deliberately

Both are consequences of D1. `SFAIO.md` should be updated to match.

| `SFAIO.md` says                                                                                      | This plan does                                     | Why                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §10.1 Snapshots: "Engine checkpoints (shadow git) for local files per task"                          | Local file copy store, path-scoped to `filesOwned` | Checkpoints stage the whole worktree (`F10`) so one agent's snapshot captures another's in-flight work; they are disabled outright when nested `.git` dirs exist (`F11`); and they require the git binary (D1). The copy store is exactly scoped by construction and has none of those failure modes. |
| §13.2 / §10.1: "Does each SIID project already have a git repo? If not, create one on project setup" | Never create a repo; never require one             | D1. A project's own version control is the user's business, not SFAIO's.                                                                                                                                                                                                                              |

---

## 9. Phase map

**One sequence, both repos.** SFAIO and the product redesign are a single ordered
implementation — the visual foundation lands early because everything after it draws
something, and the expensive structural UI work lands last because it is the only part that
can be cut without losing functionality.

| Phase | File                           | Repo      | Outcome                                                                                                                                                        |
| ----- | ------------------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | `PHASE-0-engine-groundwork.md` | Siid-Code | Two concurrent background engine Tasks editing different files, no editor tabs, no shared-state corruption; state store working.                               |
| 1     | `PHASE-1-design-foundation.md` | **both**  | Nocturne VS Code theme as the default; fonts bundled in both repos; webview token layer + state palette; shared UI primitives; every hardcoded colour removed. |
| 2     | `PHASE-2-mvp.md`               | Siid-Code | One requirement → design → approval → task graph → delegation gate → one dev agent → deploy queue → deployed to a scratch org, visible on a run board.         |
| 3     | `PHASE-3-parallelism.md`       | Siid-Code | Worker pool, waves, multiple dev agents in parallel, agent + queue panels.                                                                                     |
| 4     | `PHASE-4-resilience.md`        | Siid-Code | Retries, escalation, review, deterministic reassignment, freshness check, snapshots + rollback, crash recovery.                                                |
| 5     | `PHASE-5-configuration.md`     | Siid-Code | Manual/AUTO model config, pre-run validation, budget cap with cost rollup, run summary, export.                                                                |
| 6     | `PHASE-6-product-reskin.md`    | Siid-Code | Agent panel rebuilt to the mockup, indexing modal, history, settings, status bar.                                                                              |
| 7     | `PHASE-7-fork-chrome.md`       | Siid      | Custom top bar, workbench font, loading screen. The only phase with permanent merge debt.                                                                      |

### Why this order

- **0 and 1 are independent** and can run in parallel — Phase 0 is extension-host code with
  no UI; Phase 1 is UI with no orchestration. They share no files.
- **1 before everything visual.** The colour theme reskins most of the product with no
  component edits (190 components, only 7 with hardcoded colour), and the shared primitives
  in §1.5 are consumed by Phases 2, 3, 4 and 6. Building UI before it exists means building
  it twice.
- **2–5 are SFAIO** and run in dependency order, unchanged.
- **6 and 7 are last** because Phase 1 already made those surfaces _correct in colour_; what
  remains is restructuring, which nothing else depends on. Phase 7 additionally carries
  permanent merge debt against upstream VS Code, so it is the one phase that should be
  re-justified before starting — see its §7.1.

### Supporting documents

| File                        | Role                                                                         |
| --------------------------- | ---------------------------------------------------------------------------- |
| `SFAIO.md`                  | The requirements spec. Wins on **what**; the phase files win on **where**.   |
| `UI-THEME-nocturne.md`      | The visual authority — tokens, state palette, mockup patterns, the CSP trap. |
| `UI-OWNERSHIP-MAP.md`       | Which repo owns which pixel, and what is style versus feature.               |
| `siid-reactive-ide-design/` | The design project itself.                                                   |

The deferred items in `SFAIO.md` §12 — PMD/test/coverage gates, deterministic XML scripts,
per-task model selection — are not a phase. Do not build them.

---

## 10. The standard acceptance scenario

`SFAIO.md` §12 says "run at least one of SIID's existing test use cases end-to-end on a
scratch org". Rather than depend on an external list, use this scenario for every phase's
end-to-end check. It is chosen to exercise the machinery that actually breaks: multi-wave
dependencies, several metadata types, deploy ordering, and parallelisable work.

**Requirement text to feed the Architect:**

> Build equipment-loan tracking. Create a custom object `Equipment_Loan__c` with fields for
> the borrower (lookup to Contact), the item name, loan date, due date, and a status
> picklist (Requested / Approved / Returned / Overdue). Add a validation rule preventing a
> due date before the loan date. Add an Apex trigger with a handler class that stamps the
> status to Overdue when the due date passes. Include a test class with at least 85%
> coverage. Add an LWC that lists a contact's current loans on the Contact record page.

**Why this one:**

- **Wave 0 is unambiguous:** the object, its fields and the picklist must deploy before
  anything referencing them. If wave gating is broken, this fails loudly and immediately.
- **Wave 1 has genuinely independent work:** validation rule, trigger + handler, test class,
  and LWC are four separable tasks with disjoint `filesOwned` — exactly what Phase 3 needs
  to demonstrate parallelism.
- **It spans six metadata types** (`CustomObject`, `CustomField`, `ValidationRule`,
  `ApexTrigger`, `ApexClass`, `LightningComponentBundle`), all of which the existing deploy
  tool already supports.
- **Tightly coupled work exists** (trigger + handler + test class share contracts), so the
  Architect's "coupled work goes to the same agent" rule from `SFAIO.md` §6.A6 gets tested.
- **It has a natural failure injection point:** break the trigger's handler signature to
  drive Phase 4's retry → escalation → reassignment path deterministically.

**Per-phase expectations for this scenario:**

| Phase | Expected outcome                                                                                                                                     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Completes with a single agent working sequentially through every task.                                                                               |
| 2     | Completes with 3 agents; wave 1 tasks overlap in time; deploys stay serialized.                                                                      |
| 3     | Completes after a deliberately broken handler recovers through retry and reassignment; a rollback of the LWC task leaves the trigger work untouched. |
| 4     | Completes with different profiles per tier, and a deliberately low cap pauses it mid-wave-1 with correct per-task costs.                             |

Use a **scratch org** throughout. Never run the destructive-rollback path against a sandbox
during development (Phase 4 §4.5).

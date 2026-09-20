# Phase 5 — Configuration

**Prerequisite:** Phase 4 acceptance test passing.

**Goal:** the user controls which model each role uses, validates connectivity before
spending anything, caps run cost, and gets a full accounting afterwards.

**Definition of done:** the §5.8 acceptance test passes, including a run that hits its
budget cap and pauses cleanly with correct per-task and rolled-up costs.

---

## 5.1 Role → provider-profile mapping

### The rule that governs this whole section

`SFAIO.md` preamble #6: **do not hardcode model names anywhere** in code, config defaults,
or docs. Models are always configuration.

Concretely, in SFAIO code:

- Store and pass **provider-profile names**, never model ids.
- The model id is resolved from the profile at runtime and is only ever _displayed_.
- No default preset ships with a model id in it (§5.3).
- Grep gate before merging: no string matching a model-id pattern (`/[a-z0-9-]+\/[a-zA-Z0-9.:_-]+/`)
  in any file under `src/services/sfaio/` or `webview-ui/src/components/sfaio/`.

Run the same gate for the other two standing prohibitions, in CI rather than by hand:

| Gate                | Forbidden under `src/services/sfaio/`                                                                                  | Rule                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Model names         | any model-id literal                                                                                                   | §5.1 / `SFAIO.md` #6                                |
| Legacy model tables | `mode-models`, `model-fallback` imports                                                                                | `00-OVERVIEW.md` §6                                 |
| Git                 | `simple-git`, `utils/git`, `ShadowCheckpointService` imports                                                           | D1                                                  |
| Hard-coded style    | hex literals, font-family names, raw px spacing under `webview-ui/src/components/sfaio/` (except `theme/nocturne.css`) | `UI-THEME-nocturne.md` 3                            |
| CDN assets          | `fonts.googleapis.com`, `fonts.gstatic.com`, `unpkg.com` anywhere in SFAIO                                             | F23 - the CSP blocks them and the failure is silent |

> The legacy tables `src/shared/mode-models.ts` and `src/shared/model-fallback.ts` do
> contain hardcoded model ids. They stay, wired only to the legacy chat modes. SFAIO must
> never import them (`00-OVERVIEW.md` §6). Verify by grep as part of this phase.

### Why this is new code, not reuse

`F14`: `modeApiConfigs` exists in the settings schema
(`packages/types/src/global-settings.ts:143`) and is _displayed_ read-only in the modes UI
(`webview-ui/src/components/modes/ModesView.tsx:772`), but **nothing writes it and nothing
reads it to select a handler**. `DEFAULT_MODES` even carries the comment "No longer using
per-mode config IDs — configs selected manually via UI". Don't try to revive it; build the
SFAIO-specific mapping cleanly and leave that key alone.

### Implementation

**File:** `src/services/sfaio/config/roleConfig.ts`

```ts
export interface SfaioRoleConfig {
	/** Provider-profile name, as listed by ProviderSettingsManager.listConfig(). */
	architect: string
	senior: string
	mid: string
	junior: string
}

export interface SfaioRunConfig {
	mode: "MANUAL" | "AUTO"
	presetId?: string // when mode === "AUTO"
	roles: SfaioRoleConfig
	pool: PoolConfig // from Phase 3 §3.1
	budgetCapUsd?: number // §5.4
	autoMode: boolean // Phase 2 §2.6a
}
```

Resolution at task-spawn time:

```ts
export async function resolveProfileForTier(
	tier: AgentTier,
	config: SfaioRoleConfig,
	settingsManager: ProviderSettingsManager,
): Promise<ProviderSettingsWithId & { name: string }> {
	const profileName = config[tier]
	// getProfile throws a clear "Config with name 'x' not found" if it's gone.
	return await settingsManager.getProfile({ name: profileName })
}
```

`ProviderSettingsManager.getProfile({ name })` is at
`src/core/config/ProviderSettingsManager.ts:713` and returns exactly the
`ProviderSettings` shape `new Task({ apiConfiguration })` needs (`F13`). That is the whole
integration — no new plumbing.

**Do not call `activateProfile`** (`:755`). That mutates the _user's_ globally selected
profile and would change what their interactive chat uses. `getProfile` reads without
side effects.

### Persistence

`SfaioRunConfig` is stored on the `Run` (so it is locked for the run, per `SFAIO.md` §9) and
the _defaults_ are stored in extension settings. Add to
`packages/types/src/global-settings.ts`:

```ts
	sfaioDefaultRoleConfig: z.object({ /* four profile-name strings */ }).optional(),
	sfaioDefaultPool: z.object({ /* senior, mid, junior, maxConcurrent */ }).optional(),
	sfaioBudgetCapUsd: z.number().optional(),
	sfaioPresets: z.array(sfaioPresetSchema).optional(),
```

### Mid-run changes

`SFAIO.md` §9: "Changes mid-run apply only to new tasks." So:

- The `Run`'s config is the source of truth for tasks already `ASSIGNED` or later.
- A mid-run config edit writes a new config to the `Run` and logs it; tasks claimed
  _after_ that point resolve against the new config.
- Never swap the profile of a running engine `Task`. The engine does support a model change
  mid-task (`Task.handleModelChange` at `src/core/task/Task.ts:1012`) — deliberately do not
  use it here. Changing models mid-task makes cost attribution and reproducibility
  meaningless.

---

## 5.2 Setup screen

**File:** `webview-ui/src/components/sfaio/SetupScreen.tsx`

`SFAIO.md` §11.1. Fields:

1. **Target org** — populate from `sf org list --json`. Show alias, username, and whether
   it is a scratch org or a sandbox (rollback behaviour differs — Phase 4 §4.5). Store the
   **alias**, and use that same string as the deploy-queue key (Phase 2 §2.13).
2. **Mode** — Manual / AUTO radio.
3. **Manual:** four profile pickers, one per role, populated from
   `ProviderSettingsManager.listConfig()` (`:669`). Show the resolved model id beside each
   as read-only text.
4. **AUTO:** preset dropdown (§5.3).
5. **Pool sizes** — senior / mid / junior counts plus `maxConcurrent`.
6. **Budget cap** — optional, currency amount (§5.4).
7. **Auto mode** checkbox (Phase 2 §2.6a), with a note that it skips approval gates but
   never the safety stops.
8. **Requirement** textarea.
9. **Start** — disabled until validation passes (§5.4).

Also surface the Phase 0 §0.8 preflight results here: missing/unauthenticated `sf` CLI,
missing org index warning, non-writable workspace, production-org guard. Block Start on any
error. (There is no git check — D1.)

---

## 5.3 AUTO presets

`SFAIO.md` §9: deterministic presets mapping each role to models from the user's configured
providers. A lookup table — **no LLM choosing models**. Presets must be editable in settings.

### The constraint that shapes the design

Presets cannot ship with model names (§5.1). So a preset cannot say "Economy = model X".

**Design:** a preset is a mapping from role to a _profile name_, and it ships **empty**. On
first use the user fills in which of their profiles each slot uses. The preset then persists.

```ts
export interface SfaioPreset {
	presetId: string
	label: string // "Economy", "Balanced", "Quality" — user-editable
	roles: Partial<SfaioRoleConfig> // empty until the user fills it
}

// Ships with labels only. No model ids, no profile names.
export const BUILTIN_PRESET_SKELETONS: SfaioPreset[] = [
	{ presetId: "economy", label: "Economy", roles: {} },
	{ presetId: "balanced", label: "Balanced", roles: {} },
	{ presetId: "quality", label: "Quality", roles: {} },
]
```

UI behaviour: selecting an AUTO preset with unfilled slots opens the preset editor rather
than starting the run, with an explanation ("pick which of your configured profiles each
role should use"). Once filled, AUTO mode is a single-click lookup with no prompting.

This is strictly better than shipping guesses: the user's available providers and pricing
are things only they know, and a hardcoded guess would violate the spec's core rule.

Preset editing lives in the SFAIO settings section, not in the run setup screen — presets
outlive runs.

---

## 5.4 Pre-run validation

`SFAIO.md` §9: verify API keys / connectivity with a test call per configured model; block
run start on failure with a clear error.

**File:** `src/services/sfaio/config/validateRunConfig.ts`

For each **distinct** profile in the resolved role config (dedupe — two roles often share
one profile):

1. Resolve the profile via `getProfile({ name })`.
2. Build a handler with `buildApiHandler(profile)`.
3. Call **`handler.completePrompt(prompt)`** — it is on the `ApiHandler` interface
   (`src/api/index.ts:42`) and returns `Promise<string>`. Use a trivial prompt. Do **not**
   stream-and-abort; there is a purpose-built non-streaming path and it is what this is for.
4. Record: reachable, model id resolved, whether `ModelInfo` carries pricing (this drives
   §5.5's caveat).

Report per profile:

```ts
export interface ProfileValidation {
	profileName: string
	role: AgentTier[] // which roles use it
	ok: boolean
	modelId?: string
	hasPricing: boolean
	error?: string // verbatim provider error
}
```

Show the real provider error, not "validation failed". An expired key, a wrong base URL and
a missing model are three different fixes.

**Secrets:** read keys only from the profile (which is backed by VS Code `SecretStorage` via
`ContextProxy.storeSecret`, `src/core/config/ContextProxy.ts:150`). If a key is missing,
fail validation with a message telling the user to sign in or add the key — do **not**
attempt to re-provision anything at run start.

Never log a key, a partial key, or a request body containing one.

---

## 5.5 Cost tracking and the budget cap

This is the user's explicit requirement:

> Build a UI in settings for a hard stop so as not to consume a lot. Pricing should be
> calculated for a complete task from the architect model down to the junior models, rolled
> up to the main task, but showing each task's cost.

### Per-task cost — already available

`Task.getTokenUsage()` (`src/core/task/Task.ts:3035`) returns `TokenUsage`, which already
includes `totalCost` alongside `totalTokensIn`, `totalTokensOut`, `totalCacheWrites`,
`totalCacheReads` and `contextTokens` (`packages/types/src/message.ts:188-197`). The engine
computes it with `calculateApiCostAnthropic` / `calculateApiCostOpenAI`
(`src/shared/cost.ts:20,37`), choosing per protocol.

So per-task cost needs no new arithmetic. Capture it:

- on `RooCodeEventName.TaskCompleted`, which carries `[taskId, tokenUsage, toolUsage]`,
- and periodically during the run (for a live figure), by calling `getTokenUsage()` on the
  engine task.

Write `costUsd`, `tokensIn`, `tokensOut` onto the `SfaioTask`, and accumulate onto the
`AgentRecord`.

### The rollup

**File:** `src/services/sfaio/cost/CostTracker.ts`

```ts
export interface RunCostBreakdown {
	runId: string
	totalUsd: number
	architectUsd: number
	byTier: Record<AgentTier, number>
	byTask: Array<{
		taskId: string
		objective: string
		tier: AgentTier
		usd: number
		tokensIn: number
		tokensOut: number
	}>
	/** True if any contributing profile lacked pricing metadata — totals are then a floor. */
	incomplete: boolean
}
```

The rollup is the Architect's own engine task cost **plus** every dev task's cost. Include:

- the Architect's analysis/design turns,
- every escalation answer and review turn the Architect performs (these are additional turns
  on the Architect's task, so they are already in its `getTokenUsage()` — don't double count
  by also attributing them to the dev task),
- every dev task, including retried attempts (retries continue the same engine task, so
  their cost accrues there automatically — Phase 4 §4.1),
- reassigned tasks: the failed attempt **and** the senior's attempt both count. Keep them as
  separate `byTask` rows with a note, so the cost of a reassignment is visible.

### The pricing caveat — do not hide it

`totalCost` is derived from `ModelInfo.inputPrice` / `outputPrice` / `cacheWritesPrice` /
`cacheReadsPrice`. Providers that don't publish pricing metadata yield **0**.

So:

- Set `incomplete: true` if any contributing profile had `hasPricing: false` at validation
  (§5.4).
- When `incomplete`, the UI must show the figure as a **lower bound** with an explicit note
  naming which profiles lack pricing, and the cap falls back to a **token** ceiling for
  those profiles.
- Never render a confident currency total that is silently missing a provider. A cap that
  reads $0.00 while spending real money is the worst possible failure here.

### The cap

Per **D2**: the cap **pauses** the run and tells the user clearly. It does not terminate —
the work is preserved and the run resumes once the cap is raised.

Enforcement points — check the cap **before** spending, never after:

1. **Before claiming a task** (Scheduler, Phase 3 §3.1): if `totalUsd >= cap`, don't claim.
2. **Before the Architect's next turn.**
3. **On each cost update during a running task**: if the cap is crossed mid-task, stop
   claiming new work and let running tasks finish their current step.

Checking after a turn completes means the cap is always overshot by a whole task. Check
before.

### Telling the user — three levels

D2 requires the user to _see_ this happening, not discover it afterwards.

| Level           | Trigger                                                 | Surface                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Live**        | always, when a cap is set                               | A cost meter on the run board: `$X.XX of $Y.YY (Z%)`, updating as costs accrue. Colour shifts as it fills.                                                                                                      |
| **Approaching** | crossing 80% of the cap (make the threshold a constant) | A non-blocking banner on the run board plus one `vscode.window.showWarningMessage`. Fire it **once** per run — a warning that repeats gets dismissed reflexively.                                               |
| **Hit**         | `totalUsd >= cap`                                       | Run → `PAUSED`; `DecisionItem` of kind `BUDGET_PAUSE`; a modal-level `showWarningMessage` with a "Show run board" action; inbox badge. The board makes the paused state unmissable, not a subtle status change. |

The `BUDGET_PAUSE` item carries the full `RunCostBreakdown` and offers exactly two actions:
**raise the cap and resume**, or **cancel the run**. Show the per-task table in the item so
the user can see _where_ the money went before deciding — that is the decision-relevant
information.

`BUDGET_PAUSE` is never auto-approvable, even in auto mode (**D4**, Phase 2 §2.6a). Its
entire purpose is to interrupt.

On crossing, in this order:

1. Stop assigning new tasks and block new LLM turns.
2. **Let in-flight deploys finish.** Halting between dry-run and deploy, or mid-deploy, risks
   leaving the org partially updated. A deploy consumes no LLM tokens, so finishing it costs
   nothing against the cap.
3. `Run` → `PAUSED`, with an `EventLog` entry recording the cap, the actual total, and which
   task crossed it.
4. Raise the notifications above.

Settings UI (`SFAIO.md` §9 "Optional"): a global default cap plus a per-run override on the
setup screen. Default **off** — an accidental cap that stops a working run is its own kind of
bad surprise. When a cap _is_ set, the live meter is always visible.

---

## 5.6 Run summary

`SFAIO.md` §11.8. **File:** `webview-ui/src/components/sfaio/RunSummary.tsx`

Rendered from the store and the EventLog, never recomputed from agent output:

- duration (first to last EventLog entry)
- cost and tokens **per role**, plus the run total, with the `incomplete` caveat if set
- per-task cost table (the user's explicit requirement — every task's own figure alongside
  the rollup)
- tasks done / failed / reassigned / rolled back
- files changed (union of `filesOwned` across `DONE` tasks)
- deployments attempted and succeeded
- rollbacks performed
- every automated decision with its reason (assignment, reassignment, deploy order,
  rollback) — read straight from the EventLog `reason` field, which Phase 2 §2.1 made
  mandatory

Offer "export" here (§5.7).

---

## 5.7 Export / backup

`SFAIO.md` §10.1 final row: export a run (state + logs + summary) as a local archive.

**File:** `src/services/sfaio/export/exportRun.ts`

Produce a zip containing:

```
<runId>/
├── run.json
├── tasks/*.json
├── agents/*.json
├── escalations/*.json
├── events.ndjson
├── design.md
├── logs/*.log
└── summary.md        # rendered version of §5.6
```

Write it to a user-chosen path via `vscode.window.showSaveDialog`. Everything stays local —
no upload, no telemetry of run content.

**Redact before writing:** profile configs may contain API keys. Export profile **names**
and resolved model ids only; strip every secret field. Add a test that asserts no exported
file contains any value from `SecretStorage`. An export is the most likely way a key
accidentally leaves the machine.

---

## 5.8 Phase 5 acceptance test

| #   | Check                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Setup screen lists real orgs from `sf org list --json`, distinguishing scratch from sandbox.                                        |
| 2   | Manual mode: four role pickers list the user's real profiles; the resolved model id shows beside each.                              |
| 3   | Spawned agents use the profile assigned to their tier (verify the model id in each agent card differs when configured differently). |
| 4   | `activateProfile` is never called — the user's interactive chat profile is unchanged after a run.                                   |
| 5   | AUTO mode with an unfilled preset opens the preset editor instead of starting.                                                      |
| 6   | A filled preset starts a run with no further prompting.                                                                             |
| 7   | Grep gate passes: no model id literal anywhere under `src/services/sfaio/` or the SFAIO webview components.                         |
| 8   | Grep gate passes: nothing under `src/services/sfaio/` imports `mode-models` or `model-fallback`.                                    |
| 9   | Pre-run validation makes one test call per **distinct** profile and blocks Start on failure, showing the verbatim provider error.   |
| 10  | A profile with a deliberately wrong key fails validation with a clear message; no key appears in any log.                           |
| 11  | Per-task cost appears in the task drawer and matches that task's `getTokenUsage().totalCost`.                                       |
| 12  | Run total equals Architect cost plus the sum of all task costs, with no double counting of Architect review/escalation turns.       |
| 13  | A reassigned task shows both attempts as separate cost rows.                                                                        |
| 14  | With a provider lacking pricing metadata, the UI shows the total as a lower bound and names the profile.                            |
| 15  | A run with a low cap pauses on crossing it, with a `BUDGET_PAUSE` decision item and a correct breakdown.                            |
| 15a | The live cost meter updates during the run whenever a cap is set.                                                                   |
| 15b | Crossing 80% raises the approaching-cap warning exactly once.                                                                       |
| 15c | Hitting the cap raises a `showWarningMessage` and the run board shows the paused state unmistakably.                                |
| 15d | `BUDGET_PAUSE` is not auto-resolved with `autoMode: true` (D4).                                                                     |
| 16  | An in-flight deploy completes rather than being abandoned when the cap is crossed.                                                  |
| 17  | Raising the cap and resuming continues the run; cancelling ends it cleanly.                                                         |
| 18  | Mid-run config change applies only to tasks claimed afterwards; running tasks keep their original profile.                          |
| 19  | Run summary shows per-role and per-task cost, plus every automated decision with its reason.                                        |
| 20  | Export produces a complete archive containing no secret values.                                                                     |

---

## 5.9 Risks specific to this phase

- **Hardcoding a model name by accident.** It is the easiest rule in the spec to break —
  a "sensible default" in a preset, a test fixture, a doc example. The grep gate in §5.1
  is the guard; run it in CI, not by hand.
- **Cost that looks authoritative but isn't.** §5.5. If pricing metadata is absent, say so
  loudly rather than showing zero.
- **Cap checked after spending.** Checking on completion rather than before the next turn
  means the cap is always overshot by one task. Check before.
- **Validation cost.** One test call per profile per run start is cheap, but don't validate
  on every keystroke in the setup screen. Validate on Start, and cache the result for a few
  minutes keyed by profile name plus its `id`.
- **Exported secrets.** §5.7. Write the assertion test.
- **Pool config that can't be satisfied.** A task graph needing a junior agent when the pool
  has zero juniors stalls forever. Validate at Start: every tier appearing in the graph must
  have at least one agent — though note the graph doesn't exist until after the Architect
  plans, so this check belongs at delegation time (Phase 2 §2.6), with a clear message
  offering to adjust the pool.

# Phase 3 — Parallelism

**Prerequisite:** Phase 2 acceptance test passing end-to-end on a scratch org.

**Goal:** turn the single dev agent into a configurable worker pool, run independent tasks
concurrently within a wave, and give the user visibility into what every agent is doing.

**Definition of done:** a run with at least four independent tasks in one wave completes
with at least three agents working simultaneously, deploys still strictly serialized per
org, and the UI shows live per-agent state and the deploy queue.

**Still not in this phase:** retries, escalation, review, reassignment, freshness, rollback,
crash recovery (Phase 4); model config UI and budget caps (Phase 5).

---

## 3.1 Worker pool

**File:** `src/services/sfaio/orchestrator/Scheduler.ts`

### Pool model

`SFAIO.md` §5: agents are a worker pool; pool size and count per tier are configurable.

```ts
export interface PoolConfig {
	senior: number
	mid: number
	junior: number
	/** Hard ceiling across all tiers, regardless of per-tier counts. */
	maxConcurrent: number
}
```

Agents are **long-lived `AgentRecord`s**, not one-per-task. An agent is created when the
run starts (one per configured slot), picks up a task, runs it to completion, returns to
`IDLE`, and picks up the next. The engine `Task` is per-`SfaioTask` and disposable; the
`AgentRecord` outlives it.

Why this way: it makes the agent panel meaningful (a card per agent with a stable
identity), it makes cost attribution per agent possible, and it makes pausing an agent
(§11.7) a coherent operation.

### Claiming

Task claiming must be atomic — two agents must never claim the same task.

Because all agents live in one extension host and the store has a single writer (Phase 0
§0.7), claim inside a store transaction:

```ts
async claimTask(agentId: string, tier: AgentTier): Promise<SfaioTask | undefined> {
	return this.store.transaction(async (tx) => {
		const candidates = tx.listTasks(this.runId)
			.filter((t) => t.state === "PENDING")
			.filter((t) => t.spec.wave === this.currentWave)
			.filter((t) => t.spec.assignedTier === tier)
			.sort((a, b) => a.spec.deployPriority - b.spec.deployPriority)

		const task = candidates[0]
		if (!task) return undefined

		await tx.updateTask(task.taskId, { state: "ASSIGNED", assignedAgentId: agentId })
		await tx.updateAgent(agentId, { status: "BUSY", currentTaskId: task.taskId })
		return task
	}, { actor: `agent:${agentId}`, reason: "claimed task" })
}
```

Both writes happen in one transaction. A partial claim — task assigned but agent still
`IDLE`, or vice versa — will cause either a stuck task or a double-claim after a reload.

### Tier matching

A task specifies `assignedTier`. Rules:

- An agent only claims tasks of its own tier. Do **not** let a senior agent opportunistically
  pick up junior work in Phase 3 — it makes cost attribution and reassignment logic
  (Phase 4) much harder to reason about.
- If no agent of the required tier exists in the pool (user configured zero), fail run setup
  with a clear validation error rather than silently reassigning.

---

## 3.2 Wave gating

**File:** `src/services/sfaio/orchestrator/SfaioOrchestrator.ts` (`advance()`)

`SFAIO.md` §6.A6: a wave starts only when the previous wave is fully `DONE`.

```ts
private computeCurrentWave(tasks: SfaioTask[]): number | "COMPLETE" {
	const maxWave = Math.max(...tasks.map((t) => t.spec.wave))
	for (let w = 0; w <= maxWave; w++) {
		const inWave = tasks.filter((t) => t.spec.wave === w)
		if (inWave.some((t) => t.state !== "DONE")) return w
	}
	return "COMPLETE"
}
```

Then: agents may only claim tasks in `computeCurrentWave()`. One function, called from
`advance()`, is the single place this rule lives.

**Terminal-but-not-done states block the wave.** A task in `FAILED` or `ESCALATED` is not
`DONE`, so the wave cannot advance. That is correct and deliberate — Phase 4 adds the
machinery to resolve those states. In Phase 3, a failed task stalls the run and surfaces in
the Decision Inbox. Make the stall **visible**: if the current wave has no claimable tasks
and no agent is `BUSY`, the run is stuck — emit a `DecisionItem` saying so rather than
sitting silently idle.

That "stuck run" detector is worth writing carefully; it is the difference between a user
seeing "wave 1 blocked by 1 failed task" and staring at a board that stopped moving.

---

## 3.3 Concurrency caps

Three separate limits, all needed:

| Limit                            | Why                                                                                                                | Where enforced                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `PoolConfig.maxConcurrent`       | Extension host responsiveness. Each engine `Task` holds a streaming LLM connection, a terminal, and file watchers. | Scheduler: never have more than N agents `BUSY`.                                      |
| Deploys: 1 per org               | `SFAIO.md` §7. Shared metadata (profiles, permission sets) makes concurrent deploys unsafe.                        | Already enforced by the queue lock (Phase 2 §2.9). Do not relax it under parallelism. |
| Provider rate limits             | Concurrent agents on one provider profile will hit 429s far sooner than a single chat does.                        | §3.6.                                                                                 |
| **The global rate-limit window** | `Task.lastGlobalApiRequestTime` is **static** — shared by every task in the process. See §3.3a.                    | §3.3a — must be fixed or parallelism does not happen.                                 |

Default `maxConcurrent`: start at 3. Make it configurable and document that raising it
trades throughput for editor responsiveness.

**Do not raise the deploy concurrency to match the agent concurrency.** N agents producing
work that deploys one-at-a-time is the intended design; the queue is the throttle.

---

## 3.3a The static rate-limit window — a parallelism blocker

**Fix this before measuring anything in this phase**, or the pool will look broken.

`Task.lastGlobalApiRequestTime` is declared `private static` at `src/core/task/Task.ts:210`
and used in `attemptApiRequest`:

```ts
if (Task.lastGlobalApiRequestTime) {
	const timeSinceLastRequest = Date.now() - Task.lastGlobalApiRequestTime
	const rateLimit = apiConfiguration?.rateLimitSeconds || 0
	rateLimitDelay = Math.ceil(Math.max(0, rateLimit * 1000 - timeSinceLastRequest) / 1000)
}
// …
Task.lastGlobalApiRequestTime = Date.now() // every task writes the same slot
```

The comment says it exists "so that subtasks respect the same rate-limit window as their
parent tasks" — correct for a LIFO stack where only one task runs at a time. **Under
parallelism it serialises every agent.** With `rateLimitSeconds: 5` and four agents, each
round costs 15+ seconds of pure waiting, and the countdown does
`await this.say("api_req_retry_delayed", …)` plus `delay(1000)` **per second**, so it also
floods the message stream and the state store.

The pool will appear to work while running at roughly single-agent throughput. That is a
nasty failure to diagnose from the outside.

### Fix

Key the window by **provider profile** rather than globally, since a rate limit is a property
of the provider account, not of the process:

```ts
	// SFAIO: a rate limit belongs to the provider account, not the process. A single
	// static slot serialises every concurrent agent.
	private static lastApiRequestTimeByProfile = new Map<string, number>()

	private get rateLimitKey(): string {
		return this.apiConfiguration?.id ?? this.apiConfiguration?.apiProvider ?? "default"
	}
```

Read and write `Task.lastApiRequestTimeByProfile.get(this.rateLimitKey)` in place of the
static field. Agents sharing one profile still respect that profile's limit; agents on
different profiles no longer block each other. Keep the reset at `:225` in step.

**Also suppress the per-second countdown for background agents** — it is a UI affordance for
a human watching a chat, and for an agent it is pure message-stream noise. Log once and
`delay(rateLimitDelay * 1000)`.

### Verify

Configure `rateLimitSeconds: 5`, run three agents on one profile and three on two profiles,
and compare wall-clock time against the same work run serially. If the pool is no faster than
one agent, this is why.

---

## 3.4 Per-task isolation — verify it actually holds

Phase 0 built the isolation; Phase 3 is where violations start corrupting runs. Before
building the UI, write a test that runs 4 agents concurrently and asserts:

| Property                                 | How to check                                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Independent API handlers                 | Each agent's `Task.api` is a distinct instance; per-task `getTokenUsage()` sums to the run total with no double counting.    |
| Independent terminals                    | `TerminalRegistry.getTerminals(true)` shows distinct terminals per `taskId` (`F12`).                                         |
| Independent modes                        | Each agent's `getTaskMode()` returns its own ephemeral slug, not a shared one. This is the regression test for Phase 0 §0.2. |
| No cross-file writes                     | Each agent attempts one write outside its `filesOwned`; all are rejected.                                                    |
| No `model-fallback` cross-talk           | Grep: nothing under `src/services/sfaio/` imports `model-fallback` or `mode-models` (`F15`).                                 |
| **Rate-limit window is per-profile**     | Agents on different profiles do not wait on each other (§3.3a, `F32`).                                                       |
| `FileChangesService` doesn't lose writes | 4 agents record file changes concurrently; all appear in the JSON store (`F16` — the serialization added in Phase 0 §0.6).   |
| Store has no lost updates                | 4 concurrent `updateTask` calls on different tasks all persist.                                                              |

**The mode isolation check is the one most likely to fail quietly.** If `getSystemPrompt`
still reads a global mode anywhere (Phase 0 §0.2 change 3), all four agents get the same
prompt and the same `fileRegex`, and ownership enforcement silently collapses into
"everyone can edit everything". Test it explicitly.

---

## 3.5 No snapshots yet — and no rollback button

Per **D1** (`00-OVERVIEW.md` §8) SFAIO uses no git, and engine checkpoints stay off
(`enableCheckpoints: false`). The copy-store snapshot service arrives in Phase 4 §4.5.

So Phase 3 has **no rollback**. Do not ship a rollback button in this phase. A button that
appears to work but restores nothing — or worse, the wrong files — is more damaging than an
absent one, because the user will trust it.

If a rollback affordance is needed for a demo before Phase 4 lands, wire it **only** to
"recreate the scratch org" (`SFAIO.md` §8, scratch-org case). That path needs no snapshot and
is always correct.

This is also the phase where the absence starts to bite: four agents editing concurrently
with no way back is the point at which a bad Architect plan costs real cleanup time. If
Phase 3 testing is painful for that reason, that is an argument for pulling Phase 4 §4.5
forward — it is self-contained and does not depend on anything else in Phase 4.

---

## 3.6 Rate limits under parallelism

Concurrent agents multiply request rate. `SFAIO.md` §2 defers per-task dynamic model
selection, and the legacy fallback chain must not be used (`F15`).

> **Phase 0 §0.5a already resolves `api_req_failed` for background agents** — it returns
> `yesButtonClicked`, which drops into the engine's own retry path. That path applies
> exponential backoff with jitter and honours a `RetryInfo` delay when the provider sends one
> (`Task.ts`, the `autoApprovalEnabled && alwaysApproveResubmit` branch, capped by
> `MAX_EXPONENTIAL_BACKOFF_SECONDS = 600`). **Check whether that is already sufficient before
> writing a second backoff** — two retry layers stacked will multiply delays and make rate
> limiting look like a hang.

**If per-agent backoff is still needed on top:**

- On a 429 or provider rate-limit error, the agent backs off and retries the same request
  with the same model. Do **not** switch models — switching mid-task changes behaviour
  unpredictably and `SFAIO.md` §9 locks models for the run.
- Backoff: exponential with jitter. The engine already has a backoff constant —
  `MAX_EXPONENTIAL_BACKOFF_SECONDS = 600` near `src/core/task/Task.ts:120`. Check whether
  the engine's own retry path already covers this before writing a second one; prefer
  reusing it.
- Count rate-limit waits separately from `selfRetryCount` (Phase 4). A 429 is not a task
  failure and must not consume a retry budget.

Also: the engine shares a rate-limit timestamp across tasks (see the comments near
`Task.ts:2717` and `:2737` about subtasks honouring the provider's rate limit). Read that
code before adding anything — the behaviour under concurrency may already be handled, or
may need the shared timestamp to become per-profile rather than global.

---

## 3.7 UI — SFAIO agent panel (the worker-pool cards)

> **Not the same surface as Phase 6 §6.2.** This is SFAIO's own panel — one card per pool
> agent, showing tier, profile, current task, tokens and cost. Phase 6 §6.2 rebuilds the
> _chat_ panel (`SIID CODE`). They share primitives and visual language, nothing else.
>
> Build on Phase 1 §1.5's primitives — `StateChip` for agent status, `LinearMeter` and
> `DonutMeter` for tokens and cost, `SectionLabel`, `MonoText`. The mockup's agent surface is
> the reference for treatment: message kinds at `SIID Workspace.dc.html:341-426`, tool cards
> with the `NEEDS OK` affordance at `:366-379`, inline approve/reject at `:415-422`, token and
> context meters at `:331-337` and `:572-578`.
> See `UI-THEME-nocturne.md` 7.1-7.4.

`SFAIO.md` §11.3: one card per agent showing role/tier, model, current task, status,
retries used, tokens/cost, live log stream (collapsible).

**File:** `webview-ui/src/components/sfaio/AgentPanel.tsx`

Card contents, all from `AgentRecord` + the linked `SfaioTask`:

- tier badge and agent id
- **profile name** and the resolved model id (display only — the model id shown in the UI
  comes from the profile at runtime, never from a constant in code)
- current task objective (truncated) and its state
- status: `IDLE` / `BUSY` / `PAUSED` / `DEAD`
- tokens in/out and cost so far
- collapsible live log tail

Controls: **pause agent** (finishes its current task, then stops claiming) and **resume**.
A pause that aborts mid-task would leave half-written files; make "pause" mean "stop
claiming new work" and say so in the tooltip.

---

## 3.8 UI — deploy queue panel

`SFAIO.md` §11.4: currently deploying item, waiting items in order, last results with an
error snippet.

**File:** `webview-ui/src/components/sfaio/DeployQueuePanel.tsx`

Render straight from `DeployQueueItem[]` for the run's org, sorted the same way
`claimNext` sorts (priority, then `enqueuedAt`) — the displayed order must match the actual
dequeue order, or the panel lies.

Show the last N completed items with success/failure and `errorSnippet`. Full output links
to the task drawer.

---

## 3.9 UI — log streaming without melting the webview

`log.appended` is high-frequency: several agents streaming CLI output and LLM tokens.
`SFAIO.md` §10.1 requires throttling/batching.

Implementation:

1. **Extension side:** buffer log chunks per task in memory; flush to the webview on a
   timer (e.g. every 250 ms) or when the buffer exceeds a size threshold, whichever comes
   first. One batched message per flush, not one per chunk.
2. **Cap what the UI holds:** keep only the last ~500 lines per task in the webview. Full
   logs live in `logs/<runId>/<taskId>.log`; the drawer offers "open full log" which opens
   the file in an editor.
3. **Only stream the visible agent's log.** When a card is collapsed, unsubscribe. Send a
   `sfaioSubscribeLog` / `sfaioUnsubscribeLog` message pair from the webview.

Without all three, a four-agent run will make the webview unresponsive. This is the single
most likely performance failure in the project.

---

## 3.10 UI — run board v2

> Build the wave view from the mockup's pipeline rows (`:244-267`) — this is the mockup's
> **Pipeline tab**, and SFAIO owns it (`UI-OWNERSHIP-MAP.md` §1). Build the dependency view
> from its graph + chip-list pair (`:269-302`), keeping **both**: the chip list is the
> narrow-width and screen-reader fallback. Use Phase 1 §1.5's `StateChip` and `LinearMeter`
> rather than new colour logic. `UI-THEME-nocturne.md` §7.5–§7.6.

Upgrade the Phase 2 board:

- **Wave-grouped task graph**, nodes coloured by state. Show dependency edges where
  `filesReadOnly` of one task matches `filesOwned` of another.
- **Kanban toggle** — columns are task states, exactly the ones in §10.2. Same data,
  different layout; keep one selector/`useMemo` producing both views from the same task
  array.
- **Filters:** by agent, tier, state, wave. Filters apply to both views.

For the graph, prefer a simple hand-rolled layered layout (wave = column, tasks stacked
vertically) over pulling in a graph library. Waves already give the layering; a dependency
layout engine is unnecessary complexity and another dependency to package.

---

## 3.11 Phase 3 acceptance test

On a scratch org, with a requirement that genuinely decomposes into 4+ independent
components in one wave:

| #   | Check                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Pool config of 3 mid agents produces 3 concurrently `BUSY` agents.                                                        |
| 2   | No task is ever claimed twice (assert via EventLog: exactly one `ASSIGNED` transition per task per attempt).              |
| 3   | Wave 1 does not start until every wave 0 task is `DONE`.                                                                  |
| 4   | With 4 tasks enqueued, deploys are strictly serialized — no two `DEPLOYING` at once, verified in the EventLog timestamps. |
| 5   | All isolation checks in §3.4 pass.                                                                                        |
| 6   | Each agent's `fileRegex` blocks writes to other agents' files.                                                            |
| 7   | Agent panel shows live status, tokens and cost per agent; sum of per-agent cost equals the run total.                     |
| 8   | Deploy queue panel's displayed order matches actual dequeue order.                                                        |
| 9   | Log streaming with 3 active agents keeps the webview responsive (subjective but check for input lag).                     |
| 10  | Kanban toggle and all four filters work on the same data.                                                                 |
| 11  | Pausing an agent stops it claiming new work without aborting its current task.                                            |
| 12  | A deliberately failed task stalls its wave and raises a "run stuck" decision item rather than hanging silently.           |
| 13  | `maxConcurrent` is respected even when per-tier counts sum higher.                                                        |

---

## 3.12 Risks specific to this phase

- **Silent mode-isolation regression.** Covered in §3.4, worth repeating: if this breaks,
  everything still appears to work while file ownership is no longer enforced. Make it a
  standing automated test, not a manual check.
- **Webview performance.** §3.9. Budget real time for this; it is usually underestimated.
- **Store contention.** Every agent state change is a store mutation through one writer.
  With 4 agents and chatty updates, the queue can become the bottleneck. Batch related
  writes into single transactions (e.g. task state + agent state together, as in §3.1) and
  avoid writing on every token.
- **`AgentRecord` and engine `Task` lifetimes diverging.** If an engine task dies without
  the agent noticing, the agent stays `BUSY` forever and the pool shrinks silently.
  Phase 4's heartbeat/watchdog fixes this properly; in Phase 3, at minimum subscribe to the
  engine task's abort/complete events and reconcile.
- **Scratch org API limits.** Four agents dry-running against one scratch org will consume
  API calls quickly. If tests start failing with limit errors, that is the org, not the
  code.

# PR #211 review — copy-paste into GitHub

Reviewed against `SFAIO-PLAN/PHASE-0-engine-groundwork.md` at merge-base `7379a0e37`.

---

## Review body — request changes

**Verdict: request changes.** Two blockers, and roughly half of Phase 0 is not in this PR.

Good work in here — `StateStore.transaction()` is genuinely better than what the plan asked
for (see the inline note), and the background-task registry is the right shape.

### Blockers

**1. It doesn't compile.** `Task.ts:830` calls `this.isToolAllowedForBackground(type, text)`.
That method is never defined — a repo-wide grep at this ref returns one hit, the call site
itself. `pnpm check-types` fails.

**2. `parentTask` is passed to background tasks**, which Phase 0 §0.5a explicitly forbids
(fact F27). This is the highest-severity item in the plan and the guard in this PR makes it
_more_ reachable, not less. Detail in the inline comment on `initBackgroundTask`.

### Missing from Phase 0

| Spec                                                                    | Status | Why it matters                                                                                                                                                                    |
| ----------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §0.2 mode isolation (3 edit points)                                     | absent | `presentAssistantMessage.ts` and `getSystemPrompt` untouched, no `mode`/`customModesOverlay` on `TaskOptions`. **Every concurrent agent shares the global mode.** Fails silently. |
| §0.3 ephemeral modes / `fileRegex`                                      | absent | no file-ownership enforcement exists at all                                                                                                                                       |
| §0.4 headless edit path                                                 | absent | agents will open editor tabs and fight over focus                                                                                                                                 |
| §0.6 `FileChangesService` serialization + `postStateToWebview` throttle | absent | lost writes on the deploy path; full state serialize per agent message                                                                                                            |
| §0.8 preflight                                                          | absent | with no workspace folder open, agent `cwd` falls back to the user's Desktop (F29)                                                                                                 |
| §0.9 e2e acceptance suite                                               | absent | see the test comment                                                                                                                                                              |

§0.2 is the one I'd prioritise after the blockers. It fails _quietly_ — agents appear to work
while all of them run the same prompt and the same (nonexistent) ownership regex. Phase 3's
parallelism has nothing to build on without it.

### Also

`CopyStore.ts` is Phase 4 §4.5 work, not Phase 0. No objection to it existing, but it is out
of scope for this PR and unreviewed against its own spec.

### Suggested order

1. Fix the build (define the method, or inline the switch from §0.5a)
2. Drop `parentTask`
3. §0.2 mode isolation
4. §0.3 ownership, §0.4 headless
5. §0.9 e2e suite — this is what turns "I think it works" into a green check

---

## Inline comments

### `src/core/webview/ClineProvider.ts` — on `rootTask:` / `parentTask,` in `initBackgroundTask`

**Blocker — remove both of these.** Phase 0 §0.5a, fact F27.

With `parentTask` set, a completing background agent takes the parent branch of
`attemptCompletionTool` (`src/core/tools/attemptCompletionTool.ts:105-125`):

```ts
if (cline.parentTask) {
	const didApprove = await askFinishSubTaskApproval() // a "tool" ask
	if (!didApprove) return
	await cline.providerRef.deref()?.finishSubTask(result)
	return
}
```

`askFinishSubTaskApproval()` is a `tool` ask, so the new guard in `Task.ask()` auto-approves
it. Then `ClineProvider.finishSubTask()` runs:

```ts
async finishSubTask(lastMessage: string) {
    await this.removeClineFromStack()          // pops the INTERACTIVE stack
    await this.getCurrentCline()?.resumePausedTask(lastMessage)
}
```

**That pops the user's own chat task off the stack and resumes whatever was beneath it.**
Before this PR the ask would have hung, which accidentally prevented it. The guard removes the
hang and makes the stack corruption reachable.

Track parentage in the SFAIO state store (`SfaioTask.runId`), never in the engine's task tree.

---

### `src/core/task/Task.ts:830` — on `const isAllowed = this.isToolAllowedForBackground(...)`

**Blocker — this method does not exist.** Repo-wide grep at this ref returns only this line.
The PR does not type-check.

Two other issues once it's defined:

**Placement.** §0.5a puts the guard at the _top_ of `ask()`, right after the `if (this.abort)`
check, returning directly:

```ts
if (this._autoApprovalOverride) {
	return this.resolveBackgroundAsk(type, text)
}
```

Here it sits after `addToClineMessages`, so every background ask still writes a message and
triggers a full `postStateToWebview()` — the thrash in fact F28.

**Coverage.** The guard must handle all seven `blockingAsks`
(`packages/types/src/message.ts:51-59`), not just tool approvals:

- `completion_result` → `yesButtonClicked` — **every agent that finishes hits this**
- `api_req_failed` → `yesButtonClicked` (drops into the engine's own backoff)
- `command_output` → `yesButtonClicked` (don't kill a slow deploy)
- `auto_approval_max_req_reached`, `mistake_limit_reached`, `followup` → refuse, so the loop
  unwinds into an escalation

`followup` matters: an agent calling `ask_followup_question` is asking the human something,
which per `SFAIO.md` §6.C1 must become a structured escalation rather than a silent stall.

---

### `src/core/task/Task.ts` — on the `"ESCALATE: ..."` string

Works, but it's a magic string the agent has to notice. `askApproval` turns a non-`yes`
response into `toolDeniedWithFeedback(text)`, so this reaches the model as ordinary tool
feedback with no structure.

§0.5 specifies a typed `SfaioEscalationRequired` thrown from `evaluateSfaioApproval`, caught by
the DevAgent wrapper in Phase 4 and turned into a structured `Escalation` with the five
mandatory fields (`SFAIO.md` §6.C1). Worth doing now — Phase 4 will need it anyway, and
string-sniffing will have spread by then.

---

### `src/core/webview/ClineProvider.ts` — on `private backgroundTasks: Task[] = []`

Four things, all from §0.1:

1. **Should be a `Map<string, Task>`.** The spec needs `getBackgroundTask(taskId)`; with an
   array every lookup is a scan.
2. **Cleanup only fires on `TaskCompleted`.** A task that aborts or throws stays in the array
   forever. Subscribe to `TaskAborted` too, or remove in a `finally`.
3. **No teardown on disposal.** §0.1 requires background tasks to be torn down beside the
   `while (this.clineStack.length > 0)` loop at `:365-366` and in `dispose()` at `:398`.
   Otherwise agents outlive the provider.
4. **No `abortTask()` on removal** — the task is dropped from the array but keeps running.

---

### `src/core/webview/ClineProvider.ts` — on `enableCheckpoints,` in `initBackgroundTask`

Should be hard-coded `false` for background tasks, per decision D1 and fact F10.

Taking it from global state means that if the user has checkpoints enabled, every agent runs
shadow-git — which needs the `git` binary (not assumed), stages the **entire worktree**
(`git add .` with `core.worktree` at the workspace), and self-disables on nested `.git` dirs.
Under parallelism one agent's checkpoint captures every other agent's in-flight files.

SFAIO snapshots are the copy store in Phase 4 §4.5.

---

### `src/core/webview/__tests__/ClineProvider.spec.ts` — on the new describe block

The assertion `// proving LIFO restriction is gone` isn't what this tests, and the gap hides
the `parentTask` blocker.

```ts
backgroundTask1.emit(RooCodeEventName.TaskCompleted)
```

This emits the completion event by hand. A real completion goes through
`attemptCompletionTool`, which is exactly where the `finishSubTask` stack-pop happens — so
this test passes while the bug it would catch is live. Drive a real completion instead.

Also not asserted, all required by §0.9:

- no editor tabs opened during the run (`vscode.window.tabGroups.all` before/after)
- neither agent can write outside its `filesOwned` (`FileRestrictionError`)
- each agent's `getTaskMode()` returns its **own** ephemeral slug — the §0.2 regression test
- no background task emits `TaskIdle` (the canary for a blocking ask escaping the guard)
- the interactive chat task is still current afterwards
- two concurrent `store.transaction` calls both persist

§0.9 asks for this as an e2e suite in `apps/vscode-e2e/src/suite/sfaio.test.ts`, following
`subtasks.test.ts` — real extension host via `pnpm test:run`, `globalThis.api`, real events.
A mocked unit test can't observe tabs, file restrictions or modes.

---

### `src/services/sfaio/StateStore.ts` — on `transaction()`

**This is better than the plan specified — keep it.** Re-reading from disk _inside_ the lock
before mutating makes it correct across processes, not just within one extension host. §0.7
only asked for a single in-process writer. I'll update the plan to match.

Two things still needed from §0.7:

1. **Every mutation must append an `EventLog` entry** with `{ actor, reason, from → to }`.
   `SFAIO.md` §10.2 makes this mandatory for every state transition, and the run board reads
   it to show _why_ each automated decision happened. Make it structurally impossible to skip
   by having the mutate API take a `MutationContext` rather than trusting callers.
2. **Schema versioning + migrations.** A `meta.json` with `schemaVersion` and an ordered
   migration list. Worth adding now even at version 1 — adding it later means writing a
   migration for users who already have state on disk.

Minor: the whole state is one `sfaio.db.json`. That's fine at this size, but a long run with
hundreds of tasks and thousands of event-log entries will rewrite the entire file on every
transition. §0.7 splits per entity for this reason. Not a blocker for Phase 0.

---

### `src/services/sfaio/CopyStore.ts` — on the file

Out of scope — this is Phase 4 §4.5. No objection to it landing early, but it hasn't been
reviewed against its spec, which has specific requirements that are easy to miss:

- record **absences**: a file in `filesOwned` that didn't exist before must be recorded so
  restore _deletes_ it, otherwise rollback leaves orphaned components
- `restore()` must refuse any path not in the snapshot manifest
- diffs come from the `diff` package (already a dependency), not git (D1)

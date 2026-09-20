# PR #211 — fix list for the implementing agent

Work top to bottom. Each item says the file, what's wrong, and which plan section has the
specification. **Read the named plan section before fixing — do not work from this summary
alone**, it is an index, not the spec.

Branch: `feature/sfaio-phase-0`. Baseline for all line numbers: merge-base `7379a0e37`.

---

## 1. BLOCKER — the branch does not compile

**File:** `src/core/task/Task.ts:830`

```ts
const isAllowed = this.isToolAllowedForBackground(type, text)
```

This method does not exist. A repo-wide grep at this ref returns exactly one hit — the call
site. `pnpm check-types` fails.

**Fix:** implement the guard as specified in **Phase 0 §0.5a**, which gives the full
`resolveBackgroundAsk()` switch. Do not write a new one from scratch; §0.5a covers all seven
`blockingAsks` and each one's correct answer.

Three specifics §0.5a requires that the current code misses:

- **Placement:** top of `ask()`, immediately after the `if (this.abort)` check, returning
  directly. Currently it sits after `addToClineMessages`, so every background ask still writes
  a message and triggers a full `postStateToWebview()` (fact F28).
- **Coverage:** `completion_result` (**every agent that finishes hits this**),
  `api_req_failed`, `command_output`, `auto_approval_max_req_reached`, `mistake_limit_reached`,
  `followup`, plus tool approval. The current code handles only tool-shaped asks.
- **`followup` must refuse**, so the loop unwinds into a structured escalation
  (`SFAIO.md` §6.C1) rather than silently continuing.

**Verify:** `pnpm check-types` clean.

---

## 2. BLOCKER — background tasks corrupt the interactive chat stack

**File:** `src/core/webview/ClineProvider.ts`, in `initBackgroundTask`

```ts
rootTask: parentTask?.rootTask || parentTask,
parentTask,
```

**Delete both lines.** Phase 0 §0.5a forbids this; fact F27.

**Why:** with `parentTask` set, a completing agent takes the parent branch of
`attemptCompletionTool` (`src/core/tools/attemptCompletionTool.ts:105-125`) →
`askFinishSubTaskApproval()` → auto-approved by the new guard →
`provider.finishSubTask()` → `removeClineFromStack()` → **pops the user's own chat task**.

Before this PR the ask would have hung, which accidentally prevented it. Fixing item 1 makes
this reachable, so items 1 and 2 must land together.

**Also add** the defensive branch from §0.5a to `attemptCompletionTool.ts`, before the
existing `if (cline.parentTask)`, so this can never be re-introduced by accident.

Track parentage in the SFAIO state store (`SfaioTask.runId`), never in the engine task tree.

**Verify:** spawn a background task, let it call `attempt_completion`, assert
`provider.getCurrentCline()?.taskId` is unchanged.

---

## 3. Mode isolation — the silent failure

**Spec:** Phase 0 §0.2. **Not started.** Do this before any further Phase 0 work.

Without it every concurrent agent runs the same system prompt and the same mode, so the
file-ownership mechanism in item 4 has nothing to enforce. **It fails quietly** — agents look
like they work.

Three edit points, all required (fact F3):

| File                                                        | What                                                                                                                                               |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/task/Task.ts` — `TaskOptions`                     | add `mode`, `customModesOverlay`, `headless`, `autoApprovalOverride`, `sfaioTargetOrg`                                                             |
| `src/core/task/Task.ts` — `initializeTaskMode`              | prefer the override over `state.mode`                                                                                                              |
| `src/core/task/Task.ts` — `getSystemPrompt`                 | use the task's mode + overlay, not `getState()`'s. **Read the whole method** — there are more `mode`/`customModes` references than the destructure |
| `src/core/assistant-message/presentAssistantMessage.ts:426` | use `await cline.getTaskMode()` + the task's overlay for `validateToolUse`                                                                         |

The last one is what makes file ownership real — it routes into `isToolAllowedForMode` →
the `fileRegex` check at `src/shared/modes.ts:218-245` → `FileRestrictionError`.

Note the current PR uses `isBackground: boolean` where the plan uses
`autoApprovalOverride?: SfaioAutoApproval`. Either is workable, but the override object
carries the policy (allowed command prefixes, etc.) that §0.5 needs. Prefer the plan's shape.

---

## 4. File ownership — not started

**Spec:** Phase 0 §0.3. New file `src/services/sfaio/agents/agentModes.ts`.

`buildAgentMode()` + `buildOwnershipRegex()` are given in full in §0.3, including the
Windows-separator handling and the match-nothing case for an empty `filesOwned`.

Pass the result as `customModesOverlay` — **do not** write it to `custom_modes.yaml` via
`CustomModesManager.updateCustomMode()`; that file is user-facing and watched.

Depends on item 3.

---

## 5. Headless edit path — not started

**Spec:** Phase 0 §0.4. Without it agents open editor tabs and steal the user's focus.

- Extract `EditSurface` from `DiffViewProvider` (`src/integrations/editor/EditSurface.ts`) —
  **match the real signatures**, §0.4 flags that its `saveChanges` return type is a guess
- `HeadlessEditProvider` in `src/services/sfaio/edit/`
- Inject at `Task.ts:351` based on the headless flag

Expect type errors at call sites §0.4 doesn't list — that's the point. Widen the interface,
never cast to `any`. Run `pnpm check-types` after each.

---

## 6. Registry hygiene

**File:** `src/core/webview/ClineProvider.ts`. **Spec:** Phase 0 §0.1.

- `backgroundTasks` should be `Map<string, Task>`, not an array — §0.1 needs
  `getBackgroundTask(taskId)`
- cleanup fires only on `TaskCompleted`; a task that aborts or throws leaks. Handle
  `TaskAborted` too
- no teardown on disposal — add it beside the `while (this.clineStack.length > 0)` loop at
  `:365-366` **and** in `dispose()` at `:398`, or agents outlive the provider
- call `abortTask()` when removing, or the task keeps running after being dropped

---

## 7. `enableCheckpoints` must be forced false

**File:** `src/core/webview/ClineProvider.ts`, `initBackgroundTask`

Currently inherited from global state. Hard-code `false` — decision D1, fact F10.

If the user has checkpoints on, every agent runs shadow-git: needs the `git` binary (not
assumed), stages the **entire worktree**, and self-disables on nested `.git` dirs. Under
parallelism one agent's checkpoint captures every other agent's in-flight files.

---

## 8. Shared-state fixes — not started

**Spec:** Phase 0 §0.6.

- `src/services/file-changes/FileChangesService.ts` — add the serialization queue. It's a
  static singleton over whole-file JSON read→mutate→write, and it's **on the deploy path**
  (`sfDeployMetadataTool.ts:587`). Concurrent agents lose writes (fact F16)
- `Task.addToClineMessages` / `updateClineMessage` — skip `postStateToWebview()` for
  background tasks (fact F28)
- verify nothing under `src/services/sfaio/` imports `model-fallback` or `mode-models`
  (fact F15)

---

## 9. Preflight — not started

**Spec:** Phase 0 §0.8. New file `src/services/sfaio/preflight.ts`.

Five checks. The first is the one people skip: **with no workspace folder open, `Task.cwd`
falls back to the user's Desktop** (`src/utils/path.ts:109`, fact F29) and agents will write
Salesforce metadata there. Multi-root is also an error — `getWorkspacePath` follows the
focused editor, so sibling agents can get different `cwd`s.

No git check — D1.

---

## 10. State store — two gaps

**File:** `src/services/sfaio/StateStore.ts`. **Spec:** Phase 0 §0.7.

`transaction()` is **better than the plan asked for** — re-reading from disk inside the lock
makes it correct across processes. Keep it; §0.7 has been updated to match.

Still needed:

- **`EventLog` entry on every mutation**, with `{ actor, reason, from → to }`. `SFAIO.md`
  §10.2 makes this mandatory for every state transition and the run board reads it to show
  _why_ each automated decision happened. Make it unskippable: the mutate API takes a
  `MutationContext` rather than trusting callers
- **Schema versioning + migrations** — `meta.json` with `schemaVersion` and an ordered
  migration list. Add it now even at v1; later means writing a migration for users with
  existing state

Minor, not a blocker: one `sfaio.db.json` rewrites the whole file per transition. Fine now;
§0.7 splits per entity for long runs.

---

## 11. Replace the test with the real acceptance suite

**Spec:** Phase 0 §0.9. Delete the `SFAIO Phase 0 Validation` block from
`src/core/webview/__tests__/ClineProvider.spec.ts` and write
`apps/vscode-e2e/src/suite/sfaio.test.ts`.

The current test hand-fires `backgroundTask1.emit(RooCodeEventName.TaskCompleted)`. A real
completion goes through `attemptCompletionTool` — exactly where item 2's bug lives — so the
test passes green while the blocker sits there. That is the argument for e2e in one example.

Follow `apps/vscode-e2e/src/suite/subtasks.test.ts`: real extension host via `pnpm test:run`,
`globalThis.api`, real events, `waitUntilCompleted`. Needs `.env.local` with a provider key.

§0.9's table is the acceptance bar. The ones the current test omits:

- no editor tabs opened during the run
- neither agent can write outside its `filesOwned` (`FileRestrictionError`)
- each agent's `getTaskMode()` returns its **own** ephemeral slug — the item-3 regression test
- **no background task emits `TaskIdle`** — the canary for a blocking ask escaping the guard
- the interactive chat task is still current afterwards — the item-2 regression test
- two concurrent `store.transaction` calls both persist

---

## 12. Out of scope

`src/services/sfaio/CopyStore.ts` is Phase 4 §4.5. No objection to it landing early, but
review it against that spec before relying on it. Three requirements easy to miss:

- record **absences** — a file in `filesOwned` that didn't exist before must be recorded so
  restore _deletes_ it, else rollback leaves orphaned components
- `restore()` must refuse any path not in the snapshot manifest
- diffs come from the `diff` package (already a dependency), never git (D1)

---

## Run after every item

```
pnpm check-types
pnpm lint
pnpm test
pnpm --filter @siid-code/vscode-e2e test:run
```

Phase 0 is done when §0.9's table passes, not when the code compiles.

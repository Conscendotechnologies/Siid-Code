# Phase 0 — Engine Groundwork

**Goal:** make the engine capable of running several agents at once, off-screen, safely.
No SFAIO business logic in this phase. Nothing user-visible except a debug command.

**Why first:** every later phase depends on this. `SFAIO.md` §3.2 calls it "the core
engine change; do it first".

**Definition of done:** two background engine `Task` instances run concurrently, each
editing a different file, neither opens an editor tab, neither can write outside its
assigned files, and both appear in the SFAIO state store with independent cost counters.

---

## 0.1 Background task registry

### Problem

`ClineProvider` holds a single LIFO stack (`F1`). `getCurrentCline()` returns the top.
Pushing background agents onto this stack breaks the chat UI (it would render an agent's
conversation as the user's active chat) and makes "which task is current" meaningless.

### Change

Keep `clineStack` **exactly as it is** for interactive chat. Add a parallel registry.

**File:** `src/core/webview/ClineProvider.ts`

Near the existing declaration at `:111`:

```ts
	private clineStack: Task[] = []
	// SFAIO: background agents run outside the interactive stack. They are never
	// "current", never emit TaskFocused, and never appear in the chat view.
	private backgroundTasks: Map<string, Task> = new Map()
```

Add these methods next to `addClineToStack` (around `:250`):

```ts
	// SFAIO: register a background agent task. Deliberately does NOT push to
	// clineStack, does NOT emit TaskFocused, and does NOT call getState()'s mode
	// assertion — the task carries its own mode (see 0.2).
	public async addBackgroundTask(task: Task): Promise<void> {
		this.backgroundTasks.set(task.taskId, task)
		await this.performPreparationTasks(task)
	}

	public async removeBackgroundTask(taskId: string): Promise<void> {
		const task = this.backgroundTasks.get(taskId)
		if (!task) return
		this.backgroundTasks.delete(taskId)
		try {
			await task.abortTask(true)
		} catch (e) {
			this.log(`[SFAIO] failed to abort background task ${taskId}: ${e}`)
		}
	}

	public getBackgroundTask(taskId: string): Task | undefined {
		return this.backgroundTasks.get(taskId)
	}

	public getAllBackgroundTasks(): Task[] {
		return Array.from(this.backgroundTasks.values())
	}
```

**Important details:**

- `addClineToStack` currently emits `RooCodeEventName.TaskFocused` and then asserts that
  `state.mode` is a string, throwing `errors.retrieve_current_mode` otherwise. Background
  tasks must skip both — hence the separate method rather than a flag on the existing
  one. Reuse `performPreparationTasks` (it handles the LM Studio model preload) — that
  part _is_ still needed.
- Find the teardown loop at `ClineProvider.ts:365-366`
  (`while (this.clineStack.length > 0) { await this.removeClineFromStack() }`) and add
  background teardown beside it, so `clearTask()` / disposal kills agents too:

```ts
// SFAIO: tear down background agents as well.
for (const taskId of Array.from(this.backgroundTasks.keys())) {
	await this.removeBackgroundTask(taskId)
}
```

- Also add the same teardown to `dispose()` (around `:398`, where
  `ClineProvider.activeInstances.delete(this)` happens).

### Background task factory

Do **not** extend `initClineWithTask` — it is the chat entry point and does things
SFAIO must not do (pushes to the stack, fires `analyzeTaskComplexity` in the background
at `:700`, creates planning files).

Add a separate method:

```ts
	// SFAIO: create an agent task that runs off-screen.
	public async createBackgroundTask(opts: {
		task: string
		apiConfiguration: ProviderSettings
		mode: string
		customModesOverlay?: ModeConfig[]
		headless?: boolean
		autoApprovalOverride?: SfaioAutoApproval
		enableCheckpoints?: boolean
	}): Promise<Task> {
		const { organizationAllowList, fuzzyMatchThreshold, experiments } = await this.getState()

		if (!ProfileValidator.isProfileAllowed(opts.apiConfiguration, organizationAllowList)) {
			throw new OrganizationAllowListViolationError(
				t("common:errors.violated_organization_allowlist"),
			)
		}

		const task = new Task({
			provider: this,
			apiConfiguration: opts.apiConfiguration,
			enableDiff: true,
			// SFAIO: D1 — no git. Engine checkpoints use simple-git and would either
			// fail silently without the binary or stage the whole worktree (F10).
			// SFAIO snapshots are the copy store in Phase 4 §4.5.
			enableCheckpoints: opts.enableCheckpoints ?? false,
			fuzzyMatchThreshold,
			consecutiveMistakeLimit: opts.apiConfiguration.consecutiveMistakeLimit,
			task: opts.task,
			experiments,
			// SFAIO: deliberately NOT passing parentTask — see §0.5a. The engine's
			// parentTask branch calls provider.finishSubTask(), which pops the
			// INTERACTIVE stack and would close the user's chat task. SFAIO tracks
			// parentage in its own state store instead.
			// SFAIO additions — see 0.2, 0.4, 0.5
			mode: opts.mode,
			customModesOverlay: opts.customModesOverlay,
			headless: opts.headless ?? true,
			autoApprovalOverride: opts.autoApprovalOverride,
			onCreated: (instance) => this.emit(RooCodeEventName.TaskCreated, instance),
		})

		await this.addBackgroundTask(task)
		return task
	}
```

`ProfileValidator` and `OrganizationAllowListViolationError` are already imported in this
file for `initClineWithTask` — reuse those imports.

---

## 0.2 Per-task mode isolation

### Problem (`F3`)

A task's mode is read from global provider state in **three** places. With concurrent
agents, all of them would run as whichever mode the user last selected in the UI.

### Change 1 — `TaskOptions`

**File:** `src/core/task/Task.ts`, the `TaskOptions` type at `:122-138`.

Add:

```ts
	// SFAIO: per-task overrides so concurrent agents don't share global state.
	mode?: string
	customModesOverlay?: ModeConfig[]
	headless?: boolean
	autoApprovalOverride?: SfaioAutoApproval
	/** The run's target org alias. Read by the deploy/retrieve tools (Phase 2 §2.10)
	 *  so `--target-org` is bound per run instead of following the CLI default. */
	sfaioTargetOrg?: string
```

Store them in the constructor (`:299-345`), alongside `this.apiConfiguration = apiConfiguration`:

```ts
this._modeOverride = mode
this._customModesOverlay = customModesOverlay
this._headless = headless ?? false
this._autoApprovalOverride = autoApprovalOverride
```

Declare the private fields near the other readonly declarations, and expose two getters
the rest of the code will need:

```ts
	private _modeOverride?: string
	private _customModesOverlay?: ModeConfig[]
	private _headless = false
	private _autoApprovalOverride?: SfaioAutoApproval

	public get isHeadless(): boolean {
		return this._headless
	}

	public get customModesOverlay(): ModeConfig[] | undefined {
		return this._customModesOverlay
	}

	public get autoApprovalOverride(): SfaioAutoApproval | undefined {
		return this._autoApprovalOverride
	}
```

### Change 2 — `initializeTaskMode`

**File:** `src/core/task/Task.ts:437-448`.

```ts
	private async initializeTaskMode(provider: ClineProvider): Promise<void> {
		// SFAIO: an explicit mode override always wins — background agents must not
		// inherit whatever mode the user has selected in the UI.
		if (this._modeOverride) {
			this._taskMode = this._modeOverride
			return
		}
		try {
			const state = await provider.getState()
			this._taskMode = state?.mode || defaultModeSlug
		} catch (error) {
			this._taskMode = defaultModeSlug
			const errorMessage = `Failed to initialize task mode: ${error instanceof Error ? error.message : String(error)}`
			provider.log(errorMessage)
		}
	}
```

### Change 3 — `getSystemPrompt`

**File:** `src/core/task/Task.ts`, inside `getSystemPrompt()` around `:2578`.

The method destructures `mode` and `customModes` out of `getState()`. Override both
after the destructure — do not restructure the whole method:

```ts
		} = state ?? {}

		// SFAIO: use this task's own mode and mode overlay, not the global selection.
		const effectiveMode = this._modeOverride ?? mode
		const effectiveCustomModes = this._customModesOverlay
			? [...(customModes ?? []), ...this._customModesOverlay]
			: customModes
```

Then replace every downstream use of `mode` / `customModes` **inside this method** with
`effectiveMode` / `effectiveCustomModes`. Read the rest of the method body before
editing — it passes these into the system-prompt builder; every such reference must be
switched or the agent gets the wrong prompt.

Overlay entries are appended **after** the user's custom modes so an SFAIO ephemeral
mode with a unique slug can never be shadowed. Slugs are unique by construction (0.3).

### Change 4 — tool validation

**File:** `src/core/assistant-message/presentAssistantMessage.ts:426`.

```ts
			// Validate tool use before execution.
			const { mode, customModes } = (await cline.providerRef.deref()?.getState()) ?? {}
			// SFAIO: prefer the task's own mode + overlay.
			const effectiveMode = (await cline.getTaskMode()) || mode
			const effectiveCustomModes = cline.customModesOverlay
				? [...(customModes ?? []), ...cline.customModesOverlay]
				: customModes

			try {
				validateToolUse(
					block.name as ToolName,
					effectiveMode,
					effectiveCustomModes,
					// ...remaining args unchanged
				)
```

`getTaskMode()` awaits `taskModeReady` internally, so this is safe to call here.

**This is the edit that makes file ownership real.** `validateToolUse` →
`isToolAllowedForMode` → the `fileRegex` check at `src/shared/modes.ts:218-245` throws
`FileRestrictionError`. Get this wrong and agents can write anywhere.

---

## 0.3 Ephemeral per-task modes (file ownership)

### Approach

For each `SfaioTask`, build a `ModeConfig` in memory whose edit-group `fileRegex` is
exactly that task's `filesOwned`. Pass it as `customModesOverlay`.

**Do not** write these to `custom_modes.yaml` via
`CustomModesManager.updateCustomMode()` (`src/core/config/CustomModesManager.ts:482`).
That file is user-facing, is watched by a file watcher, and would churn on every task.

**New file:** `src/services/sfaio/agents/agentModes.ts`

```ts
import type { ModeConfig } from "@siid-code/types"

export type AgentTier = "architect" | "senior" | "mid" | "junior"

/**
 * Build a regex that matches exactly the given workspace-relative paths.
 * Tolerates both separators because specs may carry either on Windows.
 */
export function buildOwnershipRegex(filesOwned: string[]): string {
	if (filesOwned.length === 0) {
		// Match nothing. An agent with no owned files must not be able to edit.
		return "(?!)"
	}
	const alternatives = filesOwned.map((p) => {
		const normalized = p.replace(/\\/g, "/").replace(/^\.\//, "")
		// Escape regex metacharacters, then allow either separator at each slash.
		const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
		return escaped.replace(/\//g, "[\\\\/]")
	})
	return `^(?:${alternatives.join("|")})$`
}

export function buildAgentMode(params: {
	taskId: string
	tier: AgentTier
	filesOwned: string[]
	roleDefinition: string
	instructions: string
}): ModeConfig {
	const fileRegex = buildOwnershipRegex(params.filesOwned)
	return {
		slug: `sfaio-${params.tier}-${params.taskId}`,
		name: `SFAIO ${params.tier} (${params.taskId.slice(0, 8)})`,
		roleDefinition: params.roleDefinition,
		description: `SFAIO ${params.tier} agent for task ${params.taskId}`,
		whenToUse: "Internal SFAIO agent mode. Not user-selectable.",
		groups: [
			"read",
			[
				"edit",
				{
					fileRegex,
					description: `Only files owned by SFAIO task ${params.taskId}`,
				},
			],
			"command",
			"mcp",
		],
		customInstructions: params.instructions,
	} as ModeConfig
}
```

**Verify before relying on it:** confirm the `groups` tuple shape against
`packages/types/src/mode.ts:37` (`groupEntrySchema` is a union of a bare group name and a
`[groupName, groupOptions]` tuple), and confirm which `ModeConfig` fields are required by
`modeConfigSchema`. Adjust the object to satisfy the schema exactly — a schema failure
here will surface as a confusing "no mode found" error later.

**Architect mode** gets no `edit` group at all (read / command / mcp only). The Architect
writes its design document through the SFAIO service, not through agent file tools.

### Ownership pre-check

`fileRegex` is the _enforcement_ backstop. Also validate at plan time (Phase 2) that no
two tasks in the same wave declare overlapping `filesOwned` — a clear planning error
beats a confusing `FileRestrictionError` mid-run.

---

## 0.4 Headless edit path

### Problem (`F5`)

Every write goes through `cline.diffViewProvider.open()`, which calls
`vscode.window.showTextDocument`. N background agents would fight over editor focus and
steal the user's cursor.

### Why it's tractable (`F6`)

`diffViewProvider` is created **per Task** at `Task.ts:351`:

```ts
this.diffViewProvider = new DiffViewProvider(this.cwd, this)
```

So inject a different implementation for headless tasks. The interactive path is
untouched.

### Step 1 — extract the interface

**New file:** `src/integrations/editor/EditSurface.ts`

```ts
import type { Task } from "../../core/task/Task"

/**
 * The subset of DiffViewProvider that tools actually use. Implemented by both
 * DiffViewProvider (interactive) and HeadlessEditProvider (background agents).
 */
export interface EditSurface {
	// Result fields read by tools after saveChanges()
	newProblemsMessage?: string
	userEdits?: string
	editType?: "create" | "modify"
	isEditing: boolean
	originalContent: string | undefined
	readonly newContent: string | undefined

	open(relPath: string): Promise<void>
	update(accumulatedContent: string, isFinal: boolean): Promise<void>
	saveChanges(
		diagnosticsEnabled?: boolean,
		writeDelayMs?: number,
	): Promise<{ newProblemsMessage?: string; userEdits?: string; finalContent?: string }>
	pushToolWriteResult(task: Task, cwd: string, isNewFile: boolean): Promise<string>
	revertChanges(): Promise<void>
	scrollToFirstDiff(): void
	reset(): Promise<void>
}
```

**Before writing this interface, read these methods in
`src/integrations/editor/DiffViewProvider.ts` and match the real signatures exactly:**
`open` (`:56`), `update` (`:121`), `saveChanges` (`:198`), `pushToolWriteResult` (`:314`),
`revertChanges` (`:418`), `scrollToFirstDiff` (`:628`), `reset` (`:667`). The return type
of `saveChanges` above is a guess — use the actual one. Then declare
`export class DiffViewProvider implements EditSurface` and fix any gaps the compiler
reports.

### Step 2 — headless implementation

**New file:** `src/services/sfaio/edit/HeadlessEditProvider.ts`

Behaviour requirements:

- `open(relPath)`: resolve the absolute path; record whether the file exists (sets
  `editType` to `"modify"` or `"create"`); read and store `originalContent`; create
  parent directories as needed; set `isEditing = true`. **No** `showTextDocument`, no
  `vscode.diff`, no decorations.
- `update(content, isFinal)`: buffer in memory. Only write on `isFinal`. Streaming
  partial writes to disk serves no purpose with no editor to render them, and it makes
  the file transiently invalid for anything watching it.
- `saveChanges()`: write the buffered content with `fs.writeFile`, then return the same
  shape the interactive provider returns. `userEdits` is always `undefined` (no human
  edited anything). For `newProblemsMessage`, see the note below.
- `pushToolWriteResult(task, cwd, isNewFile)`: must return the **same string format** the
  interactive path returns, because the agent reads it as tool output. Read
  `DiffViewProvider.pushToolWriteResult` (`:314`) and mirror its formatting, minus the
  editor-specific parts.
- `revertChanges()`: restore `originalContent`, or delete the file if `editType === "create"`.
- `scrollToFirstDiff()`: no-op.
- `reset()`: clear all buffers and `isEditing = false`.

**Diagnostics:** the interactive provider captures `preDiagnostics` and diffs them after
save to produce `newProblemsMessage`. In headless mode the language server may not have
the file open, so diagnostics will be unreliable or empty. Do not fake them. Return
`undefined` and let the deploy dry-run be the source of truth on correctness — that is
what actually gates an SFAIO task anyway.

**Also track file changes:** the interactive path records changes for the deploy tool via
`FileChangesService`. See `0.6` — do not call that singleton directly from concurrent
agents.

### Step 3 — inject

**File:** `src/core/task/Task.ts:351`

```ts
// SFAIO: background agents write files without opening editor tabs.
this.diffViewProvider = this._headless ? new HeadlessEditProvider(this.cwd, this) : new DiffViewProvider(this.cwd, this)
```

Change the field's declared type at `Task.ts:239` from `DiffViewProvider` to
`EditSurface`. Then compile and fix call sites — `writeToFileTool.ts:125,241,298-299`,
`applyDiffTool.ts:191-192,214-215`, and the two references in `Task.ts` itself at
`:1839-1840` and `:2153`. If a call site needs something not on `EditSurface`, widen the
interface rather than casting.

---

## 0.5 Per-role auto-approve

### Problem (`F7`, `F8`)

Auto-approve is global and flat. Worse, an interactive approval from a background task
can never be answered: `webviewMessageHandler.ts:520-533` routes `askResponse` only to
`getCurrentCline()` and drops anything whose `taskId` doesn't match.

### Policy (from `SFAIO.md` §3.2)

> Background agents run fully auto-approved within their owned files and allowed
> commands; anything outside is rejected and escalated, not prompted.

### Change 1 — the override type

**New file:** `src/services/sfaio/types.ts` (start it here; Phase 2 adds the entities)

```ts
export interface SfaioAutoApproval {
	/** Auto-approve edits. Ownership is still enforced by fileRegex. */
	write: boolean
	/** Commands matching any of these prefixes are auto-approved. */
	allowedCommandPrefixes: string[]
	/** Auto-approve MCP tool calls. */
	mcp: boolean
	/** Auto-approve read operations. */
	read: boolean
}

export const DEFAULT_AGENT_AUTO_APPROVAL: SfaioAutoApproval = {
	write: true,
	read: true,
	mcp: true,
	allowedCommandPrefixes: ["sf ", "sfdx ", "npm run lint", "git status", "git diff"],
}
```

Keep the command allowlist narrow and explicit. An agent that needs something outside it
escalates.

### Change 2 — enforce it

Find where approval is requested for background tasks. The two that matter in Phase 0/1:

- generic tool approval in `presentAssistantMessage.ts` (the `askApproval` closure passed
  to tools),
- the deploy approval at `src/core/tools/sfDeployMetadataTool.ts:733`
  (`const didApprove = await askApproval("tool", approvalMessage, undefined, forceApproval)`).

For a task with `autoApprovalOverride` set, the approval helper must resolve immediately
without touching the webview:

```ts
// SFAIO: background agents never prompt. Approve within policy, reject outside it.
if (cline.autoApprovalOverride) {
	const decision = evaluateSfaioApproval(cline.autoApprovalOverride, toolName, toolParams)
	if (decision.approved) return true
	throw new SfaioEscalationRequired(decision.reason)
}
```

Write `evaluateSfaioApproval` and `SfaioEscalationRequired` in
`src/services/sfaio/agents/approval.ts`. `SfaioEscalationRequired` is caught by the
DevAgent wrapper in Phase 2 and turned into an escalation record; in Phase 0 it just
needs to exist and not hang.

**Critical: never let a background task call `Task.ask()` for approval.** `ask()` blocks
on a webview response that will never arrive, and the task hangs forever with no
diagnostic. If you find another approval path in a tool SFAIO uses, route it through the
same override.

---

## 0.5a How a background task ends — **read this before writing any of §0.1**

This section exists because the obvious implementation deadlocks on the very first
acceptance test. It is the highest-risk area in the whole plan.

### The two traps

`Task.ask()` ends with an **untimed** wait (`Task.ts`, in `ask()`):

```ts
await pWaitFor(() => this.askResponse !== undefined || this.lastMessageTs !== askTs, { interval: 100 })
```

No timeout, no abort signal. And `askResponse` only ever arrives from the webview, routed to
`getCurrentCline()` — which a background task never is (`F7`). **Any blocking ask from a
background task hangs that task forever.**

Now look at how _every_ task finishes, in `src/core/tools/attemptCompletionTool.ts:105-125`:

```ts
if (cline.parentTask) {
	const didApprove = await askFinishSubTaskApproval() // -> askApproval -> cline.ask("tool") -> HANGS
	if (!didApprove) return
	await cline.providerRef.deref()?.finishSubTask(result)
	return
}
const { response, text, images } = await cline.ask("completion_result", "", false) // -> HANGS
```

**Both branches hang a background task.** There is no safe path out of the box.

Worse, the `parentTask` branch is actively destructive. `ClineProvider.finishSubTask()`:

```ts
async finishSubTask(lastMessage: string) {
    await this.removeClineFromStack()                          // pops the INTERACTIVE stack
    await this.getCurrentCline()?.resumePausedTask(lastMessage)
}
```

An SFAIO agent completing would pop **the user's own chat task** off the stack and resume
whatever was beneath it. That is why §0.1's `createBackgroundTask` does not pass
`parentTask`. Track parentage in the SFAIO state store (`SfaioTask.runId`), never in the
engine's task tree.

### The full blocking-ask inventory

`blockingAsks` (`packages/types/src/message.ts:51-59`) is the authoritative list. Every one
is a hang site for a background task:

| Ask                                     | Fires from                                                       | When it bites                                                 |
| --------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| `completion_result`                     | `attemptCompletionTool.ts:121`                                   | **Every agent that finishes.** Guaranteed.                    |
| `tool` (via `askFinishSubTaskApproval`) | `attemptCompletionTool.ts` + `presentAssistantMessage.ts:361`    | Every agent that finishes _with_ a parentTask.                |
| `auto_approval_max_req_reached`         | `core/task/AutoApprovalHandler.ts:55,101`                        | After N auto-approved requests. **Any long agent hits this.** |
| `api_req_failed`                        | `Task.ts`, unless `autoApprovalEnabled && alwaysApproveResubmit` | First provider error. Very likely.                            |
| `command_output`                        | `executeCommandTool`                                             | A `sf project deploy` that outruns the output wait. Likely.   |
| `resume_task` / `resume_completed_task` | history resume                                                   | Phase 4 crash recovery.                                       |
| `mistake_limit_reached`                 | consecutive-mistake path                                         | Repeated malformed tool calls.                                |

My earlier draft of §0.5 covered only tool approval. That was wrong: approval is the
_least_ likely of these to fire first.

### The fix — one guard, at the source

Do not try to patch seven call sites. Intercept in `Task.ask()` itself, which is the single
choke point every one of them passes through.

**File:** `src/core/task/Task.ts`, at the top of `ask()`, right after the existing
`if (this.abort)` check:

```ts
// SFAIO: background agents have no webview to answer them. An ask here would
// wait forever (the pWaitFor below is untimed). Resolve deterministically
// instead: approve what policy allows, escalate everything else.
if (this._autoApprovalOverride) {
	return this.resolveBackgroundAsk(type, text)
}
```

And the resolver, on `Task`:

```ts
	private resolveBackgroundAsk(
		type: ClineAsk,
		text?: string,
	): { response: ClineAskResponse; text?: string; images?: string[] } {
		switch (type) {
			// Completion: accept and stop. Never route through finishSubTask.
			case "completion_result":
				return { response: "yesButtonClicked" }

			// Retry provider failures here; the run-level budget still applies.
			case "api_req_failed":
				return { response: "yesButtonClicked" }

			// Long-running command: keep waiting rather than killing a deploy.
			case "command_output":
				return { response: "yesButtonClicked" }

			// Policy-gated tool approval (§0.5).
			case "tool":
			case "command":
			case "browser_action_launch":
			case "use_mcp_server":
				return evaluateSfaioApproval(this._autoApprovalOverride!, type, text)
					? { response: "yesButtonClicked" }
					: { response: "noButtonClicked" }

			// These mean the agent is stuck or over budget. Refuse, so the loop
			// unwinds and the DevAgent wrapper turns it into an escalation.
			case "auto_approval_max_req_reached":
			case "mistake_limit_reached":
			case "followup":
			case "resume_task":
			case "resume_completed_task":
			default:
				return { response: "noButtonClicked" }
		}
	}
```

**`followup` matters.** If an agent calls `ask_followup_question` it is asking the _human_
something — which is precisely the case the spec says must become a structured escalation
(`SFAIO.md` §6.C1), not a silent stall. Refusing here unwinds the loop; the DevAgent wrapper
catches it and raises the escalation.

### Also patch `attemptCompletionTool`

The guard above stops the hang, but the `parentTask` branch must never be reachable for a
background task even if someone later passes `parentTask` by mistake. Add an explicit branch
**before** the existing `if (cline.parentTask)`:

```ts
// SFAIO: background agents complete without a webview round-trip and must
// never touch the interactive stack (finishSubTask pops it).
if (cline.autoApprovalOverride) {
	pushToolResult("")
	return
}
```

### How the orchestrator learns the result

With no `ask` and no `finishSubTask`, SFAIO needs its own completion signal. Use the engine
event, which fires at `Task.ts:1956`:

```ts
task.on(RooCodeEventName.TaskCompleted, (taskId, tokenUsage, toolUsage) => { … })
```

The agent's final text is the last `completion_result` message in `task.clineMessages`
(written by `attemptCompletionTool.ts:96` via `say`, which does _not_ block). Read it there.

Also subscribe to `TaskAborted`. And note `TaskIdle` (emitted at the top of `ask()` for
blocking asks) is a useful canary: **after this fix a background task should never emit
`TaskIdle`.** If one does, a blocking ask escaped the guard. Assert on it in the §0.9 test.

### Acceptance additions

These are now part of §0.9 and are the gate for the whole phase:

- A background task that calls `attempt_completion` finishes, emits `TaskCompleted`, and its
  result text is readable — with no webview interaction.
- The interactive chat task is still on `clineStack` and still current afterwards.
- No background task ever emits `TaskIdle`.
- Forcing each of `api_req_failed`, `auto_approval_max_req_reached` and `followup` resolves
  within one turn rather than hanging.

---

### Change 3 — fix ask routing anyway

The Architect's own questions (alignment, design approval) _do_ need the human, and they
arrive through the Decision Inbox in Phase 2, not through `ask()`. But the dropped-response
bug is a live footgun. Make the drop visible:

**File:** `src/core/webview/webviewMessageHandler.ts:520-533`

Keep the existing behaviour, but log at a level someone will actually see, and include
both ids:

```ts
if (message.taskId && message.taskId !== task.taskId) {
	provider.log(
		`[SFAIO] Dropped askResponse for taskId=${message.taskId}; current=${task.taskId}. ` +
			`Background agents must not use ask() — see SFAIO-PLAN Phase 0 §0.5.`,
	)
	break
}
```

---

## 0.6 Shared mutable state

Two concrete hazards (`F15`, `F16`).

### `model-fallback.ts`

`src/shared/model-fallback.ts:43,49,54` holds module-level records keyed by **mode**:
`modelIndexTracker`, `modelActivationTimeTracker`, `errorCountTracker`. Two agents on the
same mode would share each other's 429 state and silently swap each other's models.

**Action:** SFAIO code must never call into this module. Verify by grep that no file under
`src/services/sfaio/` imports `model-fallback` or `mode-models`. If the 429 path is
reached generically for any task, gate it:

```ts
// SFAIO: agents use per-agent backoff, not the legacy per-mode fallback chain.
if (task.autoApprovalOverride) return null
```

Per-agent retry/backoff is Phase 4 work. In Phase 0 the requirement is only that SFAIO
tasks don't corrupt the legacy tracker and vice versa.

### `postStateToWebview` thrash

`Task.addToClineMessages()` calls `provider.postStateToWebview()` on **every message**, and
`postStateToWebview` serializes the whole extension state (including `taskHistory`) and posts
it. With several agents streaming, that is a full state serialize per message per agent.

Background agents' messages do **not** leak into the chat — `getStateToPostToWebview` reads
`getCurrentCline()?.clineMessages`, and background tasks are not on the stack — so this is
purely a throughput problem, but a serious one.

**Fix:** skip the post for background tasks.

```ts
	private async addToClineMessages(message: ClineMessage) {
		this.clineMessages.push(message)
		const provider = this.providerRef.deref()
		// SFAIO: background agents are not the current task, so a full state post
		// tells the webview nothing and costs a whole-state serialize per message.
		if (!this._autoApprovalOverride) {
			await provider?.postStateToWebview()
		}
		this.emit(RooCodeEventName.Message, { action: "created", message })
		await this.saveClineMessages()
		// …rest unchanged
	}
```

Do the same in `updateClineMessage` for the `messageUpdated` post. SFAIO's own UI is driven
by the state store's event bus (§0.7), not by these messages — that separation is exactly what
`SFAIO.md` §10.2 requires ("the UI reads only from these entities").

### `FileChangesService`

`src/services/file-changes/FileChangesService.ts:7,15` is a static singleton wrapping
`FileChangesDatabase`, which does whole-file JSON read → mutate → write
(`FileChangesDatabase.ts:64-82`). Concurrent `recordFileChange` calls lose updates. It is
called from the deploy path (`sfDeployMetadataTool.ts:587`).

**Action:** add a serialization queue inside `FileChangesService` so all mutations run one
at a time. Smallest correct change:

```ts
	// SFAIO: serialize mutations — the JSON store rewrites the whole file, so
	// concurrent callers lose each other's writes.
	private writeChain: Promise<unknown> = Promise.resolve()

	private serialize<T>(op: () => Promise<T>): Promise<T> {
		const next = this.writeChain.then(op, op)
		this.writeChain = next.catch(() => {})
		return next
	}
```

Wrap `recordFileChange` and `updateDeploymentStatus` bodies in `this.serialize(...)`.
This is an in-place edit to an existing service — keep it tight and comment it.

---

## 0.7 State store

### Location

Use the engine's storage helper so a custom storage path is honoured:

```ts
import { getStorageBasePath } from "../../../utils/storage" // src/utils/storage.ts:13

const base = await getStorageBasePath(context.globalStorageUri.fsPath)
const sfaioRoot = path.join(base, "sfaio", projectKey)
```

`projectKey` = a stable hash of the workspace folder path, so two projects never share
state. Do not use the workspace folder itself — run state should survive a clean checkout.

### Layout

```
<sfaioRoot>/
├── meta.json                 # { schemaVersion: number }
├── runs/<runId>/run.json
├── runs/<runId>/tasks/<taskId>.json
├── runs/<runId>/agents/<agentId>.json
├── runs/<runId>/escalations/<escalationId>.json
├── runs/<runId>/events.ndjson       # append-only EventLog
├── runs/<runId>/design.md
├── queue/<orgAlias>.json            # deploy queue, FIFO
├── queue/<orgAlias>.lock            # proper-lockfile target
├── snapshots/<taskId>/              # Phase 4
└── logs/<runId>/<taskId>.log        # rotated, size-capped
```

One file per entity keeps writes small and makes conflicts rare. The single writer (below)
is what actually guarantees correctness.

### Single writer

**New file:** `src/services/sfaio/state/Store.ts`

Requirements:

1. **All mutations go through one serialized queue** (a promise chain, as in 0.6). Only
   one mutation executes at a time per extension host.
   **Then go one better, as PR #211 did:** inside the lock, **re-read the state from disk**
   before applying the mutation, rather than trusting the in-memory copy. That makes the
   transaction correct across _processes_ (a second VS Code window on the same project, a
   hot-reload) and not merely within one extension host. Keep the in-memory copy as a read
   cache only.
2. **Every write uses `safeWriteJson`** (`src/utils/safeWriteJson.ts:234`) — it does
   atomic temp-file + rename and takes a `proper-lockfile` advisory lock, which also
   covers the second-VS-Code-window case.
3. **Reads are cached in memory** and invalidated by the writer. The UI reads from the
   in-memory cache via events, never by polling the disk.
4. **`transaction(fn)`** — runs `fn` against a snapshot of one or more entities and
   commits all writes together, or none. Implement as: acquire the queue slot, load the
   entities, run `fn`, write all results, release. Because there is exactly one writer,
   this is sufficient for ACID within a process.
5. **Every mutation appends an `EventLog` entry** and emits on the event bus. Make this
   structurally impossible to skip — the mutate API should take
   `{ actor, reason }` and write the event itself, rather than trusting callers.

Suggested surface:

```ts
export class SfaioStore {
	static async create(context: vscode.ExtensionContext, workspacePath: string): Promise<SfaioStore>

	// reads (from cache)
	getRun(runId: string): Run | undefined
	listRuns(): Run[]
	getTask(runId: string, taskId: string): SfaioTask | undefined
	listTasks(runId: string): SfaioTask[]
	getQueue(orgAlias: string): DeployQueueItem[]

	// mutations (serialized, event-emitting)
	createRun(run: Run, ctx: MutationContext): Promise<Run>
	updateRun(runId: string, patch: Partial<Run>, ctx: MutationContext): Promise<Run>
	updateTask(runId: string, taskId: string, patch: Partial<SfaioTask>, ctx: MutationContext): Promise<SfaioTask>
	transaction<T>(fn: (tx: StoreTx) => Promise<T>, ctx: MutationContext): Promise<T>

	// events
	readonly events: SfaioEventBus
}

export interface MutationContext {
	actor: string // "architect" | "agent:<id>" | "user" | "system"
	reason: string
}
```

### Deploy-queue lock

The queue lock is the one place that needs to hold across process boundaries too (two
windows on the same project could both try to deploy).

**New file:** `src/services/sfaio/deploy/DeployQueue.ts` (skeleton in Phase 0, logic in Phase 2)

```ts
import * as lockfile from "proper-lockfile"

// SFAIO: atomic claim. Never check-then-act.
async function withOrgLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
	const release = await lockfile.lock(lockPath, {
		retries: { retries: 10, minTimeout: 200, maxTimeout: 2000 },
		stale: 5 * 60_000, // a deploy can legitimately take minutes
	})
	try {
		return await fn()
	} finally {
		await release()
	}
}
```

`proper-lockfile` is already a dependency (used by `safeWriteJson`). The lock file must
exist before locking — create it on first use.

**Note the `stale` value carefully.** Too short and a slow deploy's lock gets stolen mid
flight; too long and a crashed window blocks deploys until it expires. 5 minutes with a
heartbeat (Phase 4) is the compromise.

### Event bus

**New file:** `src/services/sfaio/state/EventBus.ts`

A typed `EventEmitter`. Events carry the entity id and the change, not the whole world:

```ts
export type SfaioEvent =
	| { type: "run.updated"; runId: string; run: Run }
	| { type: "task.updated"; runId: string; taskId: string; task: SfaioTask }
	| { type: "queue.updated"; orgAlias: string; items: DeployQueueItem[] }
	| { type: "agent.updated"; runId: string; agentId: string; agent: AgentRecord }
	| { type: "log.appended"; runId: string; taskId: string; chunk: string }
	| { type: "decision.created"; runId: string; decision: DecisionItem }
```

`log.appended` will be high-frequency — Phase 3 adds throttling. Do not send raw log
chunks to the webview unbatched.

### Migrations

**New file:** `src/services/sfaio/state/migrations.ts`

```ts
export const SCHEMA_VERSION = 1

type Migration = (root: string) => Promise<void>

export const migrations: Record<number, Migration> = {
	// 1 is the initial schema; no migration needed.
}

export async function migrate(root: string): Promise<void> {
	// read meta.json, run each migration from stored version+1 up to SCHEMA_VERSION,
	// write meta.json last so a crash mid-migration re-runs rather than skipping.
}
```

Even with one version, put this in now. Adding it later means writing a migration for
users who already have state.

---

## 0.8 Workspace preflight

Per **D1** (`00-OVERVIEW.md` §8), SFAIO does not use or require git. That removes the two
git-related preflight checks an earlier draft of this plan had: do **not** create a repo,
and do **not** fail on nested repos.

**New file:** `src/services/sfaio/preflight.ts`

```ts
export interface PreflightResult {
	ok: boolean
	problems: Array<{ severity: "error" | "warning"; message: string }>
}
```

Checks:

1. **Exactly one workspace folder is open.** This is not pedantry:
   `Task`'s constructor calls `getWorkspacePath(path.join(os.homedir(), "Desktop"))`
   (`src/utils/path.ts:109`), so **with no folder open every agent's `cwd` becomes the user's
   Desktop** and agents would create Salesforce metadata there. **Error** if zero folders.

    With _multiple_ roots there is a second hazard: `getWorkspacePath` returns the folder of
    the **currently focused editor**, so two agents spawned moments apart can receive different
    `cwd`s depending on what the user happened to be looking at. **Error** on multi-root too,
    until SFAIO pins a root explicitly.

2. **`sf` CLI present and authenticated.** `sf org display --target-org <alias> --json`.
   **Error** if the binary is missing or the org is not authenticated — nothing works
   without this.
3. **Org index present.** If `.siid-code/SALESFORCE_INDEX.md` is absent, **warn** and point
   at the initial-sync checkbox (`SFAIO.md` §4). The Architect can technically run without
   it but will plan badly.
4. **Workspace is writable** and the SFAIO state directory can be created. **Error** if not.
5. **Target is a scratch org or sandbox.** `SFAIO.md` §3 restricts SFAIO to these.
   `sf org display --json` reports whether the org is a scratch org. **Error** on anything
   that looks like a production org — this is a cheap guard against an expensive mistake.

Block run start on any `error`.

**Do not add a git check of any kind.** If you find yourself wanting one, the snapshot
design has drifted back to git; re-read Phase 4 §4.5.

---

## 0.9 Phase 0 acceptance test

**Write this as an e2e suite, not a debug command.** The repo already has a harness that
launches a real extension host: `apps/vscode-e2e`, run with `pnpm test:run` (which does
`tsc` then `node ./out/runTest.js` under `dotenvx` with `.env.local`). Existing suites
include `subtasks.test.ts` and `task.test.ts` — the exact machinery this phase changes.

Copy the pattern from `apps/vscode-e2e/src/suite/subtasks.test.ts`: it takes `globalThis.api`,
subscribes to `RooCodeEventName.Message` / `TaskSpawned`, drives real tasks, and asserts on
what comes back. Use `waitUntilCompleted` and `waitFor` from `./utils`.

New file: `apps/vscode-e2e/src/suite/sfaio.test.ts`.

**This matters more than it looks.** It converts the riskiest phase in the plan from
"launch the extension and look at it" into a command that either passes or fails — which is
what lets the whole build be driven and verified without someone watching. You will need a
`.env.local` with a working provider key, as the existing suites do.

The suite should:

1. Create two temp files in the workspace: `sfaio-probe/a.txt`, `sfaio-probe/b.txt`.
2. Build two ephemeral modes via `buildAgentMode`, one owning only `a.txt`, one only `b.txt`.
3. Spawn two background tasks via `createBackgroundTask`, each instructed to write a
   known string into its own file **and** to attempt a write to the other's file.
4. Assert, and log results to the output channel:

| Check                                                                 | Expected                                                          |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Both files contain the expected content                               | pass                                                              |
| Neither agent wrote the other's file                                  | `FileRestrictionError` raised for the cross-write attempt         |
| Editor tab count unchanged during the run                             | no tabs opened (`vscode.window.tabGroups.all` count before/after) |
| Both tasks present in `backgroundTasks` during the run, absent after  | pass                                                              |
| `getTokenUsage()` differs per task                                    | independent cost counters                                         |
| `events.ndjson` contains entries for both tasks                       | EventLog wired                                                    |
| **Both tasks call `attempt_completion` and finish**                   | `TaskCompleted` fires; result text readable; **no hang** (§0.5a)  |
| **The interactive chat task is still current afterwards**             | `getCurrentCline()` unchanged — `finishSubTask` was never called  |
| **Neither background task emits `TaskIdle`**                          | no blocking ask escaped the §0.5a guard                           |
| Forcing `api_req_failed`, `auto_approval_max_req_reached`, `followup` | each resolves within a turn, none hangs                           |
| Webview receives no `state` post per agent message                    | §0.6 throttle in place                                            |
| Two concurrent `store.updateTask` calls both persist                  | single writer works (no lost update)                              |
| Two concurrent `withOrgLock` callers serialize                        | lock works                                                        |

**Do not proceed to Phase 2 until every row passes.** These are exactly the properties
the rest of SFAIO assumes. Debugging them later, through orchestration logic, is far harder.

### Run these after every edit in this phase

Not just at the end. The §0.4 `EditSurface` extraction in particular will surface type errors
in call sites this plan does not list, and you want them one at a time:

```
pnpm check-types     # the EditSurface cascade lands here first
pnpm lint
pnpm test            # unit tests
pnpm --filter @siid-code/vscode-e2e test:run   # the real extension host
```

---

## 0.10 Risks specific to this phase

- **`getSystemPrompt` has more `mode`/`customModes` references than the destructure.**
  Read the whole method. A missed reference means the agent silently runs with the wrong
  prompt — it will look like a model quality problem, not a bug.
- **`EditSurface` extraction will surface type errors in places this plan didn't list.**
  That is expected and good. Widen the interface; do not cast to `any`.
- **`abortTask` on a background task** goes through `Task.abortTask` (`:1847`), which at
  `:1839-1840` calls `diffViewProvider.revertChanges()` if editing. Verify the headless
  implementation reverts correctly, or an aborted agent leaves half-written files.
- **The completion path is the thing most likely to burn a day.** §0.5a is not optional
  background reading; the naïve implementation deadlocks on the first dummy task and the
  symptom (a task that simply never finishes, with no error) points nowhere useful.
- **Never pass `parentTask` to a background task.** It routes completion through
  `provider.finishSubTask()`, which pops the interactive stack and closes the user's chat.
- **Do not enable engine checkpoints anywhere in SFAIO** (D1). They need the git binary,
  they stage the whole worktree (`F10`), and they self-disable on nested repos (`F11`).
  Snapshots arrive in Phase 4 §4.5 as a copy store. Until then SFAIO has no rollback, which
  is fine — Phase 0 and 1 have nothing to roll back to.

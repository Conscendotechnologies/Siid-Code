# Phase 6 — Product Reskin

**Prerequisite:** Phase 1 complete, and its §1.7 screenshot comparison done.

**Goal:** bring the surfaces that predate SFAIO — the chat panel, the indexing modal, history,
settings, status bar — up to the mockup **structurally**. Phase 1 already made them correct in
colour.

**Repo:** `Siid-Code` only. Nothing here touches the fork.

---

## 6.0 Read this first — the mistake this phase invites

An earlier draft of this document said "the mockup collapses the chat stream to four message
kinds; adopt that wholesale." **That instruction was wrong and would have destroyed working
functionality.** Understand why before you touch `ChatRow.tsx`.

`ChatRow.tsx` is **1653 lines** and switches over **25 distinct message cases**, each with
bespoke UI:

```
appliedDiff  codebaseSearch  command  deploySfMetadata  editedExistingFile  error
fetchInstructions  finishTask  followup  getTaskGuides  insertContent
listCodeDefinitionNames  listFilesRecursive  listFilesTopLevel  newFileCreated
newTask  readFile  reasoning  retrieveSfMetadata  say  searchAndReplace
searchFiles  switchMode  text  ask
```

Several are Salesforce-specific and exist nowhere else (`deploySfMetadata`,
`retrieveSfMetadata`, `getTaskGuides`). Deleting them to fit four kinds would be a functional
regression dressed up as a redesign.

**The correct model:** the mockup's four kinds are the **chrome** — the avatar, the bubble,
the dashed think-box, the card shell with its status affordance. The 25 renderers are the
**contents** of the `tool` kind. You are wrapping them, not replacing them.

```
┌─ tool card (NEW: shell, icon, title, status chip, approval footer) ─┐
│  ┌─ existing renderer for this case, restyled to tokens ─────────┐  │
│  │  (editedExistingFile / readFile / deploySfMetadata / …)       │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

Every one of the 25 keeps working. That is the acceptance bar.

---

## 6.1 Scope check before you build

`ChatView.tsx` is 2549 lines, `ChatRow.tsx` 1653, `ChatTextArea.tsx` 1312 — about 6800 lines
across the nine components this phase touches. Phase 1 already themed all of it.

So **re-do the §1.7 comparison per surface and cross off what already reads correctly.** A
component that looks right under the new theme is finished. The table in §6.2 is what the
mockup differs on _structurally_; it is not a mandate to rewrite 6800 lines.

---

## 6.2 The chat panel

Mockup: `SIID Workspace.dc.html:307-587`.

> **Not the same surface as Phase 3 §3.7.** That is SFAIO's worker-pool cards. This is the
> `SIID CODE` chat panel that exists today. Both use Phase 1 §1.5's primitives.

| Mockup region      | Lines      | Existing                                                                                    | Work                           | Size |
| ------------------ | ---------- | ------------------------------------------------------------------------------------------- | ------------------------------ | ---- |
| Panel header       | `:309-320` | VS Code view title actions                                                                  | New header row in the webview  | S    |
| Task header        | `:322-338` | `TaskHeader.tsx` (359)                                                                      | Restructure — §6.3             | M    |
| Chat stream        | `:341-426` | `ChatRow.tsx` (1653)                                                                        | **Wrap, don't replace** — §6.4 | L    |
| Recent tasks       | `:440-527` | `components/history/` (9 files)                                                             | Restyle rows — §6.7            | M    |
| Paused controls    | `:531-536` | `TaskActions.tsx` (72)                                                                      | Restyle                        | S    |
| Auto-approve row   | `:539-548` | `AutoApproveMenu.tsx` (249)                                                                 | Restructure — §6.6             | M    |
| Composer           | `:550-559` | `ChatTextArea.tsx` (1312)                                                                   | Restyle shell only — §6.5      | M    |
| Bottom control row | `:561-585` | `ModeSelector` (304), `ModelSelector` (225), `ContextUsageIndicator`, `IndexingStatusBadge` | Consolidate into one row       | M    |

---

## 6.3 Task header

**File:** `webview-ui/src/components/chat/TaskHeader.tsx`

Mockup `:322-338` is two rows on a `--color-neutral-900` ground with a bottom hairline.

**Row 1** — `Task` label, title, elapsed timer:

```tsx
<div
	data-sfaio-theme
	className="flex flex-col gap-[7px] px-3 py-2.5
     bg-[var(--color-neutral-900)] border-b border-[var(--color-neutral-800)]">
	<div className="flex items-center gap-[9px]">
		<SectionLabel>Task</SectionLabel>
		<span className="flex-1 min-w-0 text-[12px] truncate text-[var(--color-text)]">{taskTitle}</span>
		<span
			className="flex items-center gap-[5px] whitespace-nowrap px-2 py-0.5
                     rounded-full border border-[var(--color-neutral-700)]">
			<Timer size={11} className="text-[var(--color-accent-200)]" />
			<MonoText className="text-[10px] text-[var(--color-neutral-300)]">{elapsed}</MonoText>
		</span>
	</div>
	...
</div>
```

**Row 2** — token readout, `LinearMeter`, context percentage:

```tsx
<div className="flex items-center gap-2">
	<MonoText className="text-[10px] text-[var(--color-neutral-500)]">{tokenReadout}</MonoText>
	<LinearMeter value={tokenPct} className="flex-1" />
	<MonoText className="text-[10px]" style={{ color: ctxColor }}>
		ctx {ctxPct}%
	</MonoText>
</div>
```

`LinearMeter` and `MonoText` come from Phase 1 §1.5 — do not re-implement them.

**The elapsed timer is new.** `Task` already tracks duration (`getTaskDuration()` on the
engine task, surfaced through the existing message flow); wire it rather than counting in the
webview, or it resets on every re-render.

`ctxColor` shifts to `--state-attention-fg` past 80% and `--state-danger-fg` past 95%, the
same thresholds Phase 5 §5.5 uses for the budget meter. Keep them in one constant.

---

## 6.4 The chat stream — wrap, don't replace

**File:** `webview-ui/src/components/chat/ChatRow.tsx`

### Step 1 — classify, don't rewrite

Add a classifier **above** the existing switch. It decides _chrome_, and leaves the switch to
render _contents_:

```tsx
type ChromeKind = "user" | "say" | "think" | "tool"

function chromeKindFor(message: ClineMessage): ChromeKind {
	if (message.type === "ask" && message.ask === "followup") return "say"
	if (message.say === "user_feedback" || message.say === "user_feedback_diff") return "user"
	if (message.say === "reasoning" || message.say === "api_req_started") return "think"
	if (message.say === "text" || message.say === "completion_result") return "say"
	return "tool" // everything else: the 25 renderers keep their bodies
}
```

Verify the `say`/`ask` values against `packages/types/src/message.ts` before relying on this —
the list above is derived from `ChatRow`'s existing branches but the union is the authority.

### Step 2 — the four chrome components

New file: `webview-ui/src/components/sfaio/theme/chat/` (shared, since Phase 2's Decision
Inbox uses `ToolCard` too).

**user** (`:344-348`) — right-aligned bubble, asymmetric radius:

```tsx
<div className="flex justify-end">
	<div
		className="max-w-[88%] px-[11px] py-2 text-[12.5px] leading-[1.5]
                  rounded-[10px_10px_3px_10px]
                  bg-[var(--color-accent-900)] border border-[var(--color-accent-700)]
                  text-[var(--color-accent-100)] animate-[siidRise_0.2s_ease-out]">
		{children}
	</div>
</div>
```

**say** (`:350-357`) — sparkle avatar, blinking cursor while streaming:

```tsx
<div className="flex gap-[9px] animate-[siidRise_0.2s_ease-out]">
	<span
		className="shrink-0 w-5 h-5 grid place-items-center rounded-full
                   border border-[var(--color-accent-700)] bg-[var(--color-accent-900)]">
		<Sparkle size={11} className="text-[var(--color-accent)]" />
	</span>
	<div className="flex-1 min-w-0 text-[12.5px] leading-[1.6] text-[var(--color-neutral-100)]">
		{children}
		{streaming && (
			<span
				className="inline-block w-1.5 h-[13px] ml-[3px] align-[-2px]
                                   bg-[var(--color-accent)] animate-[siidBlink_0.9s_step-end_infinite]"
			/>
		)}
	</div>
</div>
```

**think** (`:359-364`) — dashed border is the whole point; it reads as provisional:

```tsx
<div
	className="flex items-center gap-[9px] px-2.5 py-[7px] rounded-lg
                border border-dashed border-[var(--color-neutral-700)]
                bg-[color-mix(in_srgb,var(--color-accent)_5%,transparent)]">
	<Spinner size={11} />
	<span
		className="flex-1 text-[11.5px] text-[var(--color-accent-200)]
                   animate-[siidPulse_1.6s_ease-in-out_infinite]">
		{children}
	</span>
</div>
```

**tool** — `ToolCard` from Phase 1 §1.5. Header row (icon, title, `StateChip`), then
`{children}` — the existing renderer — then optional detail rows and `ApprovalFooter`.

### Step 3 — restyle the 25 bodies

Work through the switch replacing hardcoded colours and VS Code classes with tokens. **Do not
change what any case renders.** `ChatRow.tsx` is one of the seven files Phase 1 §1.6 already
de-hexed, so most of this is class swaps.

Priority order — the Salesforce ones are what SIID users actually see:
`deploySfMetadata`, `retrieveSfMetadata`, `getTaskGuides`, `editedExistingFile`,
`appliedDiff`, `newFileCreated`, `readFile`, `command`, then the rest.

### Step 4 — detail rows

The mockup's tool card has four optional rows, all worth having (`:382-413`): command
highlight, file path, file list with verbs, and a diff summary as `+adds` / `−dels` pills with
scope. Several existing renderers already produce this information in their own shapes —
where they do, move it into the shared rows so every tool card reads the same.

The status affordance maps to `StateChip`: spinner → `active`, check → `success`,
`NEEDS OK` → `attention`. **Do not copy the mockup's raw OKLCH literals** — they are the
inconsistency the state palette fixes (`UI-THEME-nocturne.md` §1.2).

---

## 6.5 Composer

**File:** `ChatTextArea.tsx` (1312 lines)

**Restyle the shell only.** The interior carries `@` context mentions, `/` commands, drag-drop
and paste handling — all of it working, none of it in the mockup. Touching it is how a reskin
turns into a bug hunt.

Shell per `:550-559`: bordered container on `--color-neutral-900`, `--radius-md`, border
brightening to the accent on focus, textarea transparent inside, and a bottom row with the
hint `@ context · / commands · shift-drag files`, a magic-wand button, and the send button.

```tsx
<div
	className="mx-3 mt-2.5 rounded-[9px] bg-[var(--color-neutral-900)]
                border transition-colors duration-200"
	style={{ borderColor: focused ? "var(--color-accent)" : "var(--color-neutral-800)" }}>
	{/* existing textarea, background transparent, border-0 */}
	<div className="flex items-center gap-2 px-2 pb-2 pl-2.5">
		<span className="flex-1 min-w-0 truncate text-[10px] text-[var(--color-neutral-600)]">
			@ context · / commands · shift-drag files
		</span>
		{/* magic wand + send */}
	</div>
</div>
```

---

## 6.6 Auto-approve row

**File:** `AutoApproveMenu.tsx` (249 lines)

Mockup `:539-548` is a full-width clickable row above the composer: a 15px checkbox, the
label `Auto-approve`, **the current scope in muted text**, and a caret into settings.

Showing the scope inline is the point — it is what keeps "auto" from feeling like a blind
switch. The existing component has the scope data; surface it in the row instead of only
inside the opened menu.

```tsx
<div
	onClick={toggle}
	className="flex items-center gap-[9px] px-3 py-2 cursor-pointer
                border-t border-[var(--color-neutral-800)]
                hover:bg-[var(--color-neutral-800)]">
	<Checkbox checked={enabled} />
	<span className="text-[11.5px] text-[var(--color-neutral-300)]">Auto-approve</span>
	<span className="flex-1 min-w-0 truncate text-[11px] text-[var(--color-neutral-500)]">{scopeSummary}</span>
	<CaretRight size={12} className="text-[var(--color-neutral-500)]" />
</div>
```

SFAIO's auto mode already renders its scope this way (Phase 2 §2.6a). Make the summary strings
read consistently — both should name what is **not** covered, not just what is.

---

## 6.7 History rows

**Directory:** `webview-ui/src/components/history/` (9 files)

Mockup `:505-522`: title on top, then `ago · duration · tokens` in JetBrains Mono separated by
3px dots, with copy / export / delete revealed on hover. Delete tints to
`--state-danger-fg` on hover.

```tsx
<div className="group flex gap-2 px-2 py-2 rounded-md hover:bg-[var(--color-neutral-900)]">
  <div className="flex-1 min-w-0">
    <div className="text-[12.5px] leading-[1.45] text-[var(--color-text)]">{title}</div>
    <div className="flex items-center gap-[7px] mt-1.5">
      <MonoText className="text-[10px] text-[var(--color-neutral-500)]">{ago}</MonoText>
      <Dot /> <MonoText …>{duration}</MonoText>
      <Dot /> <MonoText …>{tokens}</MonoText>
    </div>
  </div>
  <div className="shrink-0 flex gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity">
    {/* copy, export, delete */}
  </div>
</div>
```

---

## 6.8 The indexing modal

Existing: `CodeIndexPopover.tsx`, `IndexingStatusBadge.tsx`, `SalesforceIndexLoader.tsx`,
`SalesforceFullOverlayLoader.tsx`. The last two were made dark in Phase 1 §1.6 but not
restructured.

Build on `ModalShell` (Phase 1 §1.5): header with icon, title, and a status pill (dot +
monospace label in a 999px border), per `:601-609`.

**Only two of the five tabs belong in this phase:**

| Tab                          | Status                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| Run (`idxShowRun`)           | Redesign of what exists. **In scope.**                                              |
| Settings (`idxShowSettings`) | Redesign of what exists. **In scope.**                                              |
| Symbols, Graph, Timeline     | New views over index data. **Features** — `UI-OWNERSHIP-MAP.md` §2. Not this phase. |

Ship two good tabs, not a five-tab shell with three empty ones.

---

## 6.9 Typography sweep

`--font-mono` landed in Phase 1 §1.4. Sweep for machine-generated values still in the UI font:
`TaskHeader`, `ContextWindowProgress`, `ContextUsageIndicator`, `FileChanges`,
`CommandExecution`, the history list, and settings pages showing limits and counts.

Paths, counts, durations, token figures, ids, log lines, diff stats, percentages — all
JetBrains Mono. A duration set in Inter reads as prose and disappears.

---

## 6.10 Status bar

Contribute **only what is real.** Org name and error/warning counts exist. SOQL, DML and
coverage readouts need instrumentation that does not — they are features
(`UI-OWNERSHIP-MAP.md` §2).

Leave gaps rather than placeholders. A status bar showing a plausible wrong number is worse
than one showing nothing.

---

## 6.11 Acceptance

| #   | Check                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **All 25 `ChatRow` cases still render.** Exercise each; none regressed to a generic card. **This is the phase's most important check.** |
| 2   | The four chrome kinds are visually distinct; `think` reads as provisional.                                                              |
| 3   | Tool card status uses `StateChip`, not inline colour.                                                                                   |
| 4   | Salesforce renderers (`deploySfMetadata`, `retrieveSfMetadata`, `getTaskGuides`) are correct and legible.                               |
| 5   | Approvals appear inside the tool card.                                                                                                  |
| 6   | Auto-approve shows its scope inline, worded consistently with SFAIO's.                                                                  |
| 7   | Composer: `@` mentions, `/` commands, drag-drop and paste all still work.                                                               |
| 8   | Task header shows a live elapsed timer that survives re-render.                                                                         |
| 9   | Indexing modal is dark, on `ModalShell`, Run + Settings only.                                                                           |
| 10  | Every machine-generated value is in JetBrains Mono.                                                                                     |
| 11  | Status bar shows only real data.                                                                                                        |
| 12  | `pnpm check-types`, `pnpm lint`, `pnpm test` all clean.                                                                                 |
| 13  | Nothing regressed for a user who never opens SFAIO.                                                                                     |
| 14  | Panel usable at minimum width.                                                                                                          |

---

## 6.12 What not to do

- **Do not collapse the 25 renderers into four kinds** (§6.0). Wrap them.
- **Do not rewrite `ChatView.tsx`** (2549 lines). It owns scroll, virtualisation, streaming and
  queueing. Phase 1 themed it; leave the logic alone.
- **Do not touch `ChatTextArea`'s interior** (§6.5).
- **Do not port the mockup's inline styles** — it is ~100% inline because it is a design-canvas
  document. Use Tailwind over the tokens.
- **Do not build Symbols / Graph / Timeline** (§6.8).
- **Do not fork a Phase 1 primitive.** Extend it — Phase 2's inbox uses the same `ToolCard`.

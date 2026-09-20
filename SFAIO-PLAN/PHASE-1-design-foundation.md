# Phase 1 — Design Foundation

**Prerequisite:** none. Can run alongside Phase 0 — Phase 0 is extension-host code with no
UI, this is UI with no orchestration. They do not touch the same files.

**Goal:** one coherent visual language across both repos, and every shared UI primitive
built once. After this phase the product _looks_ finished even though SFAIO does not exist
yet, and no later phase has to argue about colour again.

**Why this early:** every phase from 2 onward draws something. Building UI before the token
layer exists means building it twice. And the single highest-leverage artifact in the whole
plan — the VS Code colour theme — reskins most of the product with no component edits at all
(§2).

**Definition of done:** §7 acceptance passes.

**Read first:** `UI-THEME-nocturne.md` (tokens, state palette, mockup patterns) and
`UI-OWNERSHIP-MAP.md` (which repo owns which pixel, and what is style versus feature).

---

## 1.1 What this phase covers, and what it does not

| In                                                    | Out                                  |
| ----------------------------------------------------- | ------------------------------------ |
| The VS Code colour theme (`Siid` fork)                | Workbench chrome patches → Phase 7   |
| Bundled fonts, both repos                             | The loading screen → Phase 7         |
| The webview token layer + state palette               | Rebuilding the agent panel → Phase 6 |
| Shared UI primitives used by SFAIO **and** the reskin | The indexing modal → Phase 6         |
| Fixing every hardcoded colour already in the codebase | Any new feature view                 |

The split is deliberate: this phase is **cheap, reversible and product-wide**. Phases 6 and
7 are expensive and structural. Doing the cheap half first means Phase 6 starts from a
product that already looks right, and a lot of what looked like Phase 6 work turns out to be
unnecessary.

---

## 1.2 The VS Code colour theme — the highest-leverage task in the plan

**Repo:** `Siid`.

### The plumbing already exists

You are not creating a theme, and not wiring a default:

- **File:** `extensions/theme-defaults/themes/ai_pexium_night.json` — **249 colour keys**,
  **241 `tokenColors` rules**, 82 colour groups
- **Registered:** `extensions/theme-defaults/package.json` → `contributes.themes`
- **Already the default dark theme:**
  `src/vs/workbench/services/themes/common/workbenchThemeService.ts:42` —
  `COLOR_THEME_DARK = 'AI Pexium Night'`

So this is a **retune of an already-default theme**. Every key you need is enumerated.

### Why it is not Nocturne today

| Key                      | Today                               | Should be                                 |
| ------------------------ | ----------------------------------- | ----------------------------------------- |
| `editor.background`      | `#1e1e1e` — stock VS Code grey      | `#161826` — `--color-bg`, a blue-black    |
| `editor.foreground`      | `#d4d4d4`                           | `#e9e9ed` — `--color-text`                |
| `activityBar.background` | `#38244d`                           | desaturated, `--color-neutral-900` family |
| `statusBar.background`   | `#592d86` — a saturated purple band | near-ground with a hairline border        |
| `focusBorder`            | `#663399`                           | `#9184d9` — `--color-accent`              |
| `button.background`      | `#4e227b` — a **filled** purple     | see §1.2.3                                |

Same purple family, very different discipline: Nocturne is a desaturated blue-black ground
with one soft accent used sparingly.

### 1.2.1 Add alongside, don't overwrite

New file `extensions/theme-defaults/themes/siid_nocturne.json`, registered as
`SIID Nocturne` with `uiTheme: "vs-dark"`. Point `ThemeSettingDefaults.COLOR_THEME_DARK` at
it. Leave `AIPexiumNight` listed.

Seed it by copying the existing file — the 249 keys are already present and correctly named,
which is most of the work. Then change values.

### 1.2.2 The principal keys

Work through all 249; these set the tone and the rest follow.

```jsonc
{
	"editor.background": "#161826",
	"editor.foreground": "#e9e9ed",
	"sideBar.background": "#161826",
	"sideBarSectionHeader.background": "#292b31",
	"activityBar.background": "#161826",
	"activityBar.foreground": "#9184d9",
	"activityBar.inactiveForeground": "#75798c",
	"titleBar.activeBackground": "#161826",
	"titleBar.activeForeground": "#cfd3e5",
	"panel.background": "#161826",
	"editorGroupHeader.tabsBackground": "#161826",

	"statusBar.background": "#161826",
	"statusBar.foreground": "#b2b6ca",
	"statusBar.border": "#3f424d",

	"editorGroup.border": "#3f424d",
	"sideBar.border": "#3f424d",
	"panel.border": "#3f424d",
	"tab.border": "#3f424d",

	"focusBorder": "#9184d9",
	"tab.activeBorderTop": "#9184d9",
	"activityBarBadge.background": "#423a6a",
	"activityBarBadge.foreground": "#f5f4ff",
	"progressBar.background": "#9184d9",
	"editorCursor.foreground": "#9184d9",

	"editor.selectionBackground": "#423a6a",
	"editor.lineHighlightBackground": "#232532",
	"list.activeSelectionBackground": "#2b2741",
	"list.activeSelectionForeground": "#f5f4ff",
	"list.hoverBackground": "#292b31",
	"list.inactiveSelectionBackground": "#292b31",

	"input.background": "#232532",
	"input.border": "#3f424d",
	"input.foreground": "#e9e9ed",

	"editorError.foreground": "#fb817a",
	"editorWarning.foreground": "#d6a20a",
	"editorInfo.foreground": "#9184d9",
}
```

The three diagnostic values are the sRGB form of `--state-danger-fg` / `--state-attention-fg`
from `UI-THEME-nocturne.md` §4.2. **Derive them from that file rather than retyping**, and if
the palette is retuned, move the theme with it — otherwise the same error is one colour in the
Problems panel and a different colour on the SFAIO board.

A VS Code theme takes **hex only**, so the oklch source values have to be converted. §4.2
carries the sRGB form alongside each token for exactly this reason. Do not eyeball the
conversion: an earlier draft of the palette specified a `danger` that fell outside sRGB and
would have been silently clipped.

### 1.2.3 The button problem

Nocturne outlines primary buttons: 1px accent border on transparent, never a fill
(`styles.css:149`). VS Code's `button.background` **is** a fill, and there is no theme key to
change that.

**Do:** tint workbench buttons from the deep accent ramp (`#423a6a` background,
`#f5f4ff` foreground) and accept that they are filled — the workbench has few buttons, and
webview surfaces (where we control CSS) get correct outlined buttons.

**Don't:** patch `src/vs/base/browser/ui/button/button.css` for this. It affects every dialog
in the product and buys very little.

### 1.2.4 Syntax colours

241 `tokenColors` rules already exist. Retune them against the mockup's editor
(`SIID Workspace.dc.html:140-183`) and the design's rule: **low chroma outside the accent**.
Syntax is where a "desaturated" theme usually gets betrayed by an inherited rainbow palette.

Check Apex and LWC by hand — `extensions/apex-language-basics` is a fork extension, so don't
assume the generic Java-ish rules cover it.

---

## 1.3 Fonts — both repos, bundled, never fetched

### The trap (`F23`)

The design calls for Inter, JetBrains Mono and Phosphor icons. The mockup loads all three
from CDNs. The production webview CSP at `src/core/webview/ClineProvider.ts:1114` allows
neither external fonts nor external stylesheets, and **fails silently**: fonts fall back,
icons render as empty boxes.

### Extension (`Siid-Code`)

```jsonc
// webview-ui/package.json
"@fontsource/inter": "^5",
"@fontsource/jetbrains-mono": "^5",
"@phosphor-icons/react": "^2"
```

Import the used weights once at the webview entry point (Inter 400/500/600/700, JetBrains
Mono 400/500/600). Vite emits woff2 into the bundle, served from `webview.cspSource`, which
the CSP already permits. **Do not relax the CSP.**

`lucide-react` is already a dependency and is used widely. Do not rip it out — new and
rebuilt surfaces use Phosphor, and the two coexist during the transition.

### Fork (`Siid`)

The workbench has no such restriction, but bundle anyway so the look does not depend on what
the user has installed. Ship the font files in `resources/` or a fork extension, then set
configuration defaults:

- `editor.fontFamily` → `"JetBrains Mono", "Droid Sans Mono", monospace`
- `terminal.integrated.fontFamily` → same

The workbench **UI** font needs CSS and is Phase 7.

---

## 1.4 The webview token layer

**File:** `webview-ui/src/components/sfaio/theme/nocturne.css`

Per `UI-THEME-nocturne.md` §3 and §4:

1. Generate the `:root` block from `_ds_manifest.json`'s `tokens` array — all 51 tokens.
   Do not retype hex values by hand.
2. Drop the Google Fonts `@import`.
3. Scope it to `[data-sfaio-theme]` (§5 of the theme doc) so SFAIO surfaces get fixed dark
   while the rest of the extension keeps following the editor theme.
4. Append the state tokens from §4.2.
5. Copy the nine motion keyframes from the mockup (`:22-30`), wrapped so every **infinite**
   loop stops under `prefers-reduced-motion: reduce`. `siidRise` is short and finite — keep it.

Add the mono/display tokens to the main `index.css` `@theme` block as well, since the whole
extension needs them, not only SFAIO:

```css
@theme {
	--font-display: "Inter", var(--vscode-font-family);
	--font-mono: "JetBrains Mono", var(--vscode-editor-font-family), monospace;
}
```

**Resolve the Radix portal problem now** (`UI-THEME-nocturne.md` §5). Dialogs, dropdowns,
popovers and tooltips render into `document.body`, landing outside `[data-sfaio-theme]` and
losing every token. Fix it once, here, in a shared portal wrapper — not the first time
someone builds a dropdown and finds the tokens "randomly stopped working".

---

## 1.5 Shared primitives — build these once

**This is the section that prevents duplicated work.** SFAIO's Decision Inbox (Phase 2) and
the rebuilt agent panel (Phase 6) need the same components. Build them here; both consume
them.

**Directory:** `webview-ui/src/components/sfaio/theme/`

| Primitive        | What                                                                                                                       | Mockup     | Used by                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------- |
| `StateChip`      | state → colour + **icon + text label**. The one place a state becomes visual.                                              | `:371-379` | Phase 2 run board, Phase 3 agent panel, Phase 6                        |
| `ToolCard`       | bordered card: icon, title, status affordance, optional detail rows (command highlight, path, file list, diff `+/−` pills) | `:366-423` | Phase 2 inbox, Phase 6 chat                                            |
| `ApprovalFooter` | top-bordered footer: full-width accent-outline **Approve** + 96px **Reject**                                               | `:415-422` | Phase 2, Phase 4 escalations, Phase 6                                  |
| `LinearMeter`    | 3px track, accent gradient fill, `transition: width`                                                                       | `:333-335` | Phase 3 waves, Phase 5 budget                                          |
| `DonutMeter`     | 16px SVG, rotated −90°, `stroke-dasharray`                                                                                 | `:573-577` | context %, cost %                                                      |
| `ModalShell`     | backdrop `rgba(14,16,28,0.94)`, bordered panel, header with icon + title + status pill, `siidRise` entry                   | `:601-609` | Phase 2 delegation gate, Phase 4 destructive confirm, Phase 6 indexing |
| `SectionLabel`   | ~9px, `letter-spacing: 0.16em`, uppercase, muted, with the right-fading hairline                                           | `:440-443` | everywhere                                                             |
| `MonoText`       | JetBrains Mono span for machine output                                                                                     | throughout | everywhere                                                             |

`StateChip` is the important one. **Colour is never the only signal** — 14 task states cannot
be distinguished by hue, and a board readable in greyscale is a board readable quickly in
colour. Every chip carries an icon and the state name; `active` additionally carries motion;
`spent` states render dimmed with the label struck through.

---

## 1.6 Fix every hardcoded colour that already exists

Once the theme lands, anything carrying its own colours becomes the one thing on screen that
looks wrong. Fix both repos now.

### Extension — 7 files

Of 147 component files, only these contain a hex literal. The codebase is otherwise
disciplined, which is why the theme carries so much for free.

| File                                   | Likely cause                   |
| -------------------------------------- | ------------------------------ |
| `chat/SalesforceIndexLoader.tsx`       | the light-blue indexing screen |
| `chat/SalesforceFullOverlayLoader.tsx` | same family                    |
| `chat/ChatRow.tsx`                     | status / diff colours          |
| `chat/BatchFilePermission.tsx`         | approval affordances           |
| `chat/UpdateTodoListToolBlock.tsx`     | todo state colours             |
| `common/MarkdownBlock.tsx`             | syntax highlighting            |
| `common/MermaidBlock.tsx`              | diagram palette                |

The two Salesforce loaders are the light-themed "Discovering Metadata" screen. Restyle them
dark here; their **structural** redesign (the hex cluster) is Phase 6.

### Fork — 53 hardcoded hexes across four files

Counted, not estimated:

| File                                                 | Hex literals       | Notes                                                                       |
| ---------------------------------------------------- | ------------------ | --------------------------------------------------------------------------- |
| `services/progress/common/blockingProgressDialog.ts` | **33** (16 unique) | `#663399`, `#ff7800`, `#c488ff`, `#432264`, `#1e1e1e`, `#ffffff`, `#cccccc` |
| `contrib/update/browser/releaseNotesEditor.ts`       | **14** (11 unique) |                                                                             |
| `contrib/welcomeScreen/browser/welcomeScreen.ts`     | **5**              | `#FF7800`, `#443264`, `#0065A9`, `#007ACC`, `#1F9CF0`                       |
| `browser/parts/titlebar/menubarControl.ts`           | **1**              |                                                                             |

**`blockingProgressDialog.ts` is the priority.** It is the dialog `SFAIO.md` §4 uses to block
the UI during initial org sync, so it is a screen every SFAIO user meets on first run — and it
is currently painted in rebeccapurple and orange with a `#1e1e1e` ground. It also uses
`#ffffff`, which breaks Nocturne's "no pure black or white" rule outright.

Replace all of them with theme colour references (`registerColor` / existing theme keys), not
with Nocturne hexes — hardcoding Nocturne values just moves the problem.

### Renaming the theme — check these first

`AI Pexium Night` / `AIPexiumNight` / `ai_pexium_night` appears in five files. Three matter:

- `extensions/theme-defaults/package.json:65-68` — the registration. **Must change** if you
  rename.
- `src/vs/workbench/services/themes/common/workbenchThemeService.ts:42` — the default.
  **Must change.**
- `extensions/theme-defaults/themes/ai_pexium_night.json` — the file itself.

The other two are comments only (`siid-forge/src/ui/webview.ts:18`,
`blockingProgressDialog.ts:104`) — update the text so the next reader is not misled, but
nothing breaks if you miss them.

---

## 1.7 Acceptance

| #   | Check                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------- |
| 1   | A fresh profile launches into `SIID Nocturne`; the editor ground is `#161826`, not `#1e1e1e`.                   |
| 2   | Activity bar, side bar, tabs, panel, status bar, menus, notifications and the terminal all read as one palette. |
| 3   | Apex and LWC files both read well; no inherited rainbow syntax.                                                 |
| 4   | The editor's error/warning colours are the same values the SFAIO state palette uses.                            |
| 5   | No network request for a font or icon at any point, in either repo. Verify offline.                             |
| 6   | Phosphor icons render in the webview (i.e. the CSP fix actually worked).                                        |
| 7   | `grep -rlE "#[0-9a-fA-F]{6}" webview-ui/src/components --include=*.tsx` returns nothing.                        |
| 8   | No hex literal remains in any fork-patched file.                                                                |
| 9   | The welcome screen no longer looks like a different product.                                                    |
| 10  | A Radix dropdown opened inside `[data-sfaio-theme]` keeps its tokens.                                           |
| 11  | Every `StateChip` state is distinguishable with colour removed.                                                 |
| 12  | All infinite animations stop under `prefers-reduced-motion: reduce`.                                            |

**Then stop and screenshot the product against the mockup.** That comparison decides how much
of Phases 6 and 7 is actually still worth doing — and it is the cheapest decision point in
the plan.

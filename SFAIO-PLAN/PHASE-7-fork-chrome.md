# Phase 7 — Fork Chrome & Loading Screen

**Prerequisite:** Phase 1, and its §1.7 screenshot comparison. Phase 6 helps but is not
required.

**Goal:** the parts of the mockup a colour theme cannot reach — the custom top bar, the
workbench UI font, and the loading screen.

**Repo:** `Siid` (the VS Code fork) only.

---

## 7.1 Decide whether to do this phase at all

**Everything here patches VS Code workbench source and carries permanent merge debt.** Every
file you touch is one you re-resolve on every upstream merge, forever.

Precedent exists — the fork already patches `welcomeScreen/` (4 files, ~1062 lines),
`titlebar/menubarControl.ts`, `welcomeGettingStarted/gettingStartedContent.ts` and
`update/browser/releaseNotesEditor.ts`. So the cost is known, not new. But it is still a cost,
and this phase is last so you can decline it after seeing what Phase 1 achieved.

**Redo the §1.7 comparison before starting.** If the theme plus bundled fonts already reads as
the mockup, stopping here is a legitimate outcome of this phase, not a failure of it.

Also: §7.2 has a zero-merge-debt path that gets most of the way. Build that first regardless.

---

## 7.2 The custom top bar

Mockup `SIID Workspace.dc.html:41-70`. A 44px bar carrying, left to right:

| Element                        | Detail                                                                                                       | Mockup   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------- |
| SIID mark                      | 22px rounded square, 1px accent border, inset accent glow, 6px pulsing accent dot                            | `:43-47` |
| Wordmark                       | `SIID` in JetBrains Mono 12px/600, `letter-spacing: 0.22em`, over `Salesforce Intelligence` at 8px uppercase | `:48-51` |
| Divider                        | 1px × 20px, `--color-neutral-800`                                                                            | `:55`    |
| Breadcrumb                     | directory muted, filename in `--color-text`, both truncating                                                 | `:57-60` |
| Dirty dot                      | 6px accent circle with accent glow                                                                           | `:61-63` |
| Command / FORGE / Apex / UTF-8 | right side readouts                                                                                          | `:64-70` |

### Step 1 — the cheap version (do this first, always)

Most of that content already exists in VS Code. A theme plus configuration plus extension
contributions gets a similar read for **zero merge debt**:

| Mockup element       | Free equivalent                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Breadcrumb path      | `breadcrumbs.enabled: true` — already themed by Phase 1                                      |
| Dirty dot            | tab dirty indicator, themed via `tab.activeModifiedBorder`                                   |
| Apex / UTF-8         | built-in status bar items                                                                    |
| Command              | `window.commandCenter: true` — `commandCenterControl.ts` already exists in the titlebar part |
| SIID mark + wordmark | the window title via `window.title` + the app icon                                           |
| FORGE                | a status bar item contributed by `extensions/siid-forge`                                     |

Set these as configuration defaults in the fork, screenshot against `:41-70`, and only then
decide whether the gap justifies Step 2.

### Step 2 — if you patch it

**File:** `src/vs/workbench/browser/parts/titlebar/titlebarPart.ts` (962 lines).

The insertion point is clean. `createContentArea()` at `:448` builds three containers:

```ts
this.leftContent = append(this.rootContainer, $(".titlebar-left"))
this.centerContent = append(this.rootContainer, $(".titlebar-center"))
this.rightContent = append(this.rootContainer, $(".titlebar-right"))
```

and `:458` shows the established pattern for prepending into one:

```ts
this.appIcon = prepend(this.leftContent, $("a.window-appicon"))
```

So the SIID mark and wordmark go in as a sibling of `appIcon`:

```ts
	// SFAIO/SIID: brand mark + wordmark. Sibling of .window-appicon so the
	// upstream layout of .titlebar-left is otherwise untouched.
	private siidBrand!: HTMLElement;

	// …inside createContentArea, after the appIcon block at :458
	if (this.siidBrandEnabled) {
		this.siidBrand = prepend(this.leftContent, $('div.siid-brand'));
		const badge = append(this.siidBrand, $('div.siid-brand-badge'));
		append(badge, $('span.siid-brand-dot'));
		const words = append(this.siidBrand, $('div.siid-brand-words'));
		append(words, $('span.siid-brand-name')).textContent = 'SIID';
		append(words, $('span.siid-brand-sub')).textContent = 'Salesforce Intelligence';
	}
```

Styles go in `src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css` — the fork
already owns `menubarControl.css` beside it. **Use theme colour references
(`registerColor` / `--vscode-*`), never Nocturne hexes**, or the bar stops following the theme
the moment anyone switches it.

```css
/* SIID: brand mark */
.titlebar-left > .siid-brand {
	display: flex;
	align-items: center;
	gap: 9px;
	padding: 0 6px;
}
.siid-brand-badge {
	position: relative;
	width: 22px;
	height: 22px;
	display: grid;
	place-items: center;
	border: 1px solid var(--vscode-focusBorder);
	border-radius: 6px;
	box-shadow: inset 0 0 14px color-mix(in srgb, var(--vscode-focusBorder) 35%, transparent);
}
.siid-brand-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--vscode-focusBorder);
	animation: siidPulse 2.4s ease-in-out infinite;
}
.siid-brand-words {
	display: flex;
	flex-direction: column;
	line-height: 1.1;
}
.siid-brand-name {
	font-family: "JetBrains Mono", monospace;
	font-size: 12px;
	font-weight: 600;
	letter-spacing: 0.22em;
}
.siid-brand-sub {
	font-size: 8px;
	letter-spacing: 0.16em;
	text-transform: uppercase;
	color: var(--vscode-descriptionForeground);
}
@media (prefers-reduced-motion: reduce) {
	.siid-brand-dot {
		animation: none;
	}
}
```

**Gate it behind a setting** (`siid.titleBar.brand`, default on). A fork patch that can be
turned off is a fork patch you can bisect when an upstream merge goes wrong.

**FORGE is real** — `extensions/siid-forge` exists, so that affordance has something to open.
Confirm what Command and the rest bind to before building them; an affordance that opens
nothing is worse than no affordance.

### What not to patch

`windowTitle.ts`, `commandCenterControl.ts` and `titlebarActions.ts` are upstream machinery
with their own lifecycles. Add beside them; do not modify them.

---

## 7.3 Workbench UI font

**File:** `src/vs/workbench/browser/media/style.css`

One declaration, wide effect, low risk — the highest value-to-debt ratio in this phase:

```css
/* SIID: Inter as the workbench UI font. Files ship with the product (Phase 1 §1.3);
   never fetched. */
.monaco-workbench {
	font-family: "Inter", system-ui, sans-serif;
}
```

Ensure the font files are registered as workbench resources so they resolve offline.

**Radii: leave them alone.** Nocturne uses 8px, VS Code 2–3px across dozens of widget
stylesheets. Matching everywhere is a large diff for a small return, and every file is merge
debt. Nocturne radii apply in webviews, where they are free.

---

## 7.4 The loading screen

Sources: `SIID Loading.dc.html`, `SIID Loading v1 (rings).dc.html`, `siid-loader.js` (15 KB),
WebGL probe renders in `screenshots/gl-*.png`.

### Settled — use the current design (D5)

**Build `SIID Loading.dc.html`. Do not build `v1 (rings)` — it is superseded.**

The earlier worry that the loader had drifted off-palette was half wrong. It is not pure teal;
the shader runs a two-hue pair:

```
rgba( 70, 205, 225, …)   cyan / teal
rgba(170,  70, 200, …)   magenta / violet
```

The violet end sits in the product accent's family (`#9184d9`), just more saturated. So the
loader reads as its own pre-launch moment while still handing off to the workspace palette —
which is what a launch sequence should do.

Two constraints:

- These two hues are **loader-only tokens.** They do not enter the Nocturne set and must
  appear nowhere else in the product. There is a grep check in §7.5.
- The loader grounds on `#000000`, breaking Nocturne's no-pure-black rule (`readme.md`
  §Don't). **Accepted for the loader only** — a full-bleed pre-launch frame is the one place
  true black is the right ground. Comment it so nobody "fixes" it.

### Where it lives

VS Code startup has two moments. The shader needs a live WebGL context, which decides it:

| Moment                                      | Suitable?                                  |
| ------------------------------------------- | ------------------------------------------ |
| Electron splash, before the workbench loads | **No** — no reliable GL context that early |
| The workbench's own empty/loading state     | **Yes** — full DOM, GL available           |

So mount it in the workbench, and let the brief pre-workbench frame stay a flat
`--color-bg` fill.

### Static fallback — not optional

WebGL fails on remote sessions, software rendering and some VMs. A loading screen that fails
to render is a launch that looks broken.

```ts
// SIID: the blob is a shader; GL is unavailable often enough to matter.
const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl")
if (!gl) {
	mountStaticFallback(container)
	return
}
```

The fallback is a still from `screenshots/gl-blob*.png` on the same black ground with the same
`Loading…` type. Also fall back on shader-compile failure, not only on a missing context.

### Telling the variants apart

The current file is ~3.9 KB and delegates to `siid-loader.js`; `v1 (rings)` is ~12 KB with its
rings inline. If the filenames ever get normalised, that size difference is the quickest tell.

---

## 7.5 Acceptance

| #   | Check                                                                                         |
| --- | --------------------------------------------------------------------------------------------- |
| 1   | The §7.2 Step 1 cheap version was built and compared **before** any titlebar patch.           |
| 2   | If patched: the bar matches `:41-70`, and every affordance opens something real.              |
| 3   | The brand mark uses theme colour references, not Nocturne hexes — it survives a theme switch. |
| 4   | `siid.titleBar.brand: false` cleanly restores the stock title bar.                            |
| 5   | Workbench UI font is Inter, resolved offline, no network fetch.                               |
| 6   | Loader renders; **static fallback renders with WebGL disabled** (test by forcing it).         |
| 7   | The loader's two hues appear nowhere else — grep both repos (D5).                             |
| 8   | The brand dot stops under `prefers-reduced-motion: reduce`.                                   |
| 9   | Every patched workbench file is in `FORK-PATCHES.md` (§7.6).                                  |
| 10  | An upstream VS Code merge attempted on a throwaway branch; conflicts are tractable.           |

Check 10 is not optional. If a routine upstream merge becomes painful, that is this phase's
cost arriving — better to learn it the same week than six months later.

---

## 7.6 Keep a patch inventory

Create `Siid/FORK-PATCHES.md` and list every workbench file the fork modifies, why, and what
would have to change to drop the patch. The fork already has six such files and no inventory;
this phase adds more.

| File                                            | Why                     | Droppable when                                  |
| ----------------------------------------------- | ----------------------- | ----------------------------------------------- |
| `browser/parts/titlebar/titlebarPart.ts`        | SIID brand mark (§7.2)  | upstream exposes a title-bar contribution point |
| `browser/parts/titlebar/media/titlebarpart.css` | brand styles            | with the above                                  |
| `browser/media/style.css`                       | Inter as UI font (§7.3) | upstream honours a UI font setting              |
| …plus the six that predate this phase           |                         |                                                 |

Without it, the next upstream merge is archaeology.

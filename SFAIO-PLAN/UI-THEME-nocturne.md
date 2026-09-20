# SIID UI Theme — Nocturne

**The visual authority for the whole plan.** Read it before writing any UI code in either
repo.

It serves every phase that draws something: Phase 1 builds the token layer and the shared
primitives from it, Phases 2–5 build SFAIO's panels in it, and Phases 6–7 bring the surfaces
that predate SFAIO into it. `SFAIO.md` §11 says _what_ screens exist; this says what they
look like and how they are built. `UI-OWNERSHIP-MAP.md` says which repo owns which pixel.

§4's state palette is product-wide, not SFAIO-only — the editor's diagnostic colours in
Phase 1 §1.2.2 derive from it, so the same error is the same colour in the Problems panel and
on the SFAIO board.

Source of truth for the look: `SFAIO-PLAN/siid-reactive-ide-design/project/`.

| File                                 | What it is                                                                   | Use it for                                   |
| ------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------- |
| `_ds/nocturne-.../styles.css`        | The design system: tokens + component classes. 295 lines, heavily commented. | Every color, font, space, radius, shadow.    |
| `_ds/nocturne-.../readme.md`         | The written guidance: direction, color discipline, do/don't.                 | Intent. Read it once, fully.                 |
| `_ds/nocturne-.../_ds_manifest.json` | Machine-readable token list.                                                 | Generating the token file mechanically.      |
| `SIID Workspace.dc.html`             | A complete 1440×900 agentic-IDE mockup on these tokens.                      | The interaction patterns to copy.            |
| `support.js`                         | The design-canvas preview runtime (`dc-runtime`).                            | **Nothing. Do not ship it.** See §7.         |
| `_ds/nocturne-.../_ds_bundle.js`     | **Empty stub** — `components: []`, no exports.                               | Nothing. There are no JS components to port. |

---

## 1. Four findings that change how you implement this

Read these before anything else. Each one will cost you a day if you discover it late.

### 1.1 The design's CDN dependencies are blocked by the webview CSP

The mockup loads three things over the network:

- Inter, from `fonts.googleapis.com` / `fonts.gstatic.com` (`styles.css:2`, an `@import`)
- JetBrains Mono, from `fonts.googleapis.com` (`SIID Workspace.dc.html` helmet)
- Phosphor icons, from `unpkg.com/@phosphor-icons/web@2.1.1` (icon **font**, `<i class="ph ph-*">`)

The production webview CSP is at `src/core/webview/ClineProvider.ts:1114`:

```
font-src ${webview.cspSource} data:;
style-src ${webview.cspSource} 'unsafe-inline';
```

`font-src` has no `https:` and `style-src` has no external host. So **all three fail
silently in the real webview**: Inter falls back to `system-ui`, JetBrains Mono to a
generic monospace, and every `<i class="ph ph-*">` renders as an empty box. The mockup looks
right in the design canvas and wrong in the product, with no error to tell you why.

**Fix — do this in Phase 2, not later:**

1. **Vendor both fonts.** Add `@fontsource/inter` and `@fontsource/jetbrains-mono` to
   `webview-ui/package.json` and import the weights actually used (Inter 400/500/600/700,
   JetBrains Mono 400/500/600). Vite emits the woff2 files into the bundle and they load
   from `webview.cspSource`, which the CSP already allows. Do **not** relax the CSP.
2. **Drop the Phosphor icon font; use `@phosphor-icons/react`.** Same icon set the design
   specifies, imported as React components, bundled by Vite, no font file and no CDN. Note
   `lucide-react` is already a dependency — do not mix the two icon sets in SFAIO surfaces;
   Phosphor is what the design calls for (`readme.md` §Icons).
3. Delete the `@import url(...)` line when you copy tokens out of `styles.css` (§3).

### 1.2 The design system has no state colors — and SFAIO needs them most

Nocturne is a deliberate **mono** scheme: one accent, neutral ramps, "contrast comes from
the tonal ramps, not from saturation". There is no success, warning or danger token.

The mockup needed them anyway and invented them inline as raw OKLCH literals:

| Used for                   | Value in the mockup    | Where                               |
| -------------------------- | ---------------------- | ----------------------------------- |
| success / clean / done     | `oklch(0.78 0.13 150)` | `Workspace.dc.html:215,250,375,409` |
| warning / NEEDS OK         | `oklch(0.80 0.14 85)`  | `:378`                              |
| error / delete / terminate | `oklch(0.68 0.19 22)`  | `:410,521,534`                      |

Those three are inconsistent with each other (L 0.78 / 0.80 / 0.68, C 0.13 / 0.14 / 0.19),
which is exactly what the system's OKLCH discipline exists to prevent. SFAIO needs far more
than three — it has 14 task states and 10 run states — so this gap has to be closed
properly. §4 does that.

### 1.3 The webview currently inherits the VS Code theme; Nocturne does not

`webview-ui/src/index.css` maps its Tailwind `@theme` onto `--vscode-*` variables, so the
existing chat UI follows whatever theme the user has active. Nocturne is a fixed dark
palette (`--color-bg: #161826`) with no light variant, no `prefers-color-scheme` block and
no `data-theme` switch.

**Do not globally replace the `--vscode-*` mapping.** That would restyle the entire
existing extension UI, which is out of SFAIO's scope and would be a breaking change for
every current user.

**Scope Nocturne to SFAIO surfaces instead** (§5). SFAIO panels get the fixed dark
treatment; chat and settings keep following the editor theme. This is the right call for a
run board — it is a dense product surface, not an editor view — and it needs no decision
from the user.

### 1.4 The mockup is a mockup

`SIID Workspace.dc.html` is authored in a design-canvas DSL: `<x-dc>`, `<helmet>`,
`<sc-if value="{{ x }}">`, `<sc-for list="{{ xs }}" as="x">`, `{{ binding }}`, plus
`style-hover="..."` pseudo-attributes, all compiled to React at preview time by
`support.js`. The canvas is a fixed `1440px × 900px` box scaled by `{{ scale }}`.

None of that ships. The translation is mechanical:

| Mockup                                         | SFAIO (React)                           |
| ---------------------------------------------- | --------------------------------------- |
| `<sc-if value="{{ x }}">…`                     | `{x && (…)}`                            |
| `<sc-for list="{{ xs }}" as="x">…`             | `{xs.map((x) => …)}`                    |
| `{{ binding }}`                                | `{binding}`                             |
| `style-hover="background:X"`                   | a Tailwind `hover:` class or a CSS rule |
| inline `style="…"` (the mockup is ~all inline) | Tailwind utilities + the token layer    |
| fixed 1440×900, `{{ scale }}`                  | responsive; see §6                      |

---

## 2. The design in one paragraph

A quiet, dense, dark interface. Near-neutral blue-grey ground (`#161826`) with a single
blurple accent (`#9184d9`) used **as a line and a glow, never as a fill**. Inter at weight
500 for headings, Inter for body, JetBrains Mono for everything machine-generated —
paths, counts, timings, ids, log lines. Soft 8px radii. Spacing scale at 0.70× density. Free
rules fade to transparent over 48px at each end; box outlines and short accent marks stay
solid. Primary buttons are a 1px accent outline on transparent, never solid. Elevation on
this dark ground is a hairline edge plus ambient darkness, not a drop shadow. Hierarchy is
size and space, not weight — never bolden a heading past 500.

---

## 3. Token layer

Create `webview-ui/src/components/sfaio/theme/nocturne.css`. Copy the `:root` block from
`_ds/nocturne-.../styles.css` **verbatim** — all 51 tokens as listed in
`_ds_manifest.json` — with three changes:

1. Drop the `@import url('https://fonts.googleapis.com/...')` on line 2. Fonts come from
   `@fontsource/*` imports in TS instead (§1.1).
2. Re-scope `:root` to `[data-sfaio-theme]` (§5).
3. Append the state tokens from §4.

Do **not** retype the hex values by hand — generate the block from `_ds_manifest.json`'s
`tokens` array so it cannot drift.

The rules from `readme.md` that matter most, restated as hard constraints:

- **Never hard-code a hex, font name, or px value the tokens already carry.** Use
  `var(--color-*)`, `var(--font-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--shadow-*)`.
- **Prefer ramp steps over ad-hoc `color-mix()`.** On this dark ground: 700–900 for tinted
  fills, hovers and subtle borders; 500 as a role's base; 100–300 for text on those tints.
- **Never flood an area with the accent.** It is a line, an outline, a dot, a 3px meter fill,
  a glow. The `--color-section*` tokens are deck-scale only — **do not use them in SFAIO**.
- **Accent-on-ground is tuned to ~3:1** — fine for icons, large text and chrome, not for
  body copy. For paragraph text in the accent use `--color-accent-300`.
- **No pure black or pure white.** Shadows are the exception.
- **Don't stack shadows.** Use `--shadow-sm/md/lg` as given.

---

## 4. State tokens — SFAIO's addition

This is the one place SFAIO extends the design system. Justify it in code comments: the DS
is mono by design, but a run board whose entire job is conveying 14 task states cannot do
that with one accent.

### 4.1 Semantic roles, not one colour per state

Fourteen colours would be unreadable. Collapse to **six roles**, and disambiguate within a
role by icon and label:

| Role        | Task states                              | Run states               |
| ----------- | ---------------------------------------- | ------------------------ |
| `idle`      | `PENDING`, `ASSIGNED`                    | `SETUP`                  |
| `active`    | `IN_PROGRESS`, `DRY_RUN`, `DEPLOYING`    | `ANALYZING`, `EXECUTING` |
| `waiting`   | `QUEUED`, `IN_REVIEW`                    | `AWAITING_*`             |
| `success`   | `DONE`                                   | `COMPLETED`              |
| `attention` | `ESCALATED`, `PAUSED`                    | `PAUSED`                 |
| `danger`    | `FAILED`                                 | `FAILED`                 |
| `spent`     | `CANCELLED`, `ROLLED_BACK`, `REASSIGNED` | `CANCELLED`              |

`idle` and `waiting` come from the neutral and accent ramps — no new colour. `active` is the
accent **plus motion** (the mockup's `siidSpin` ring). Only `success`, `attention` and
`danger` need new hues.

### 4.2 The tokens

Generated on the system's own OKLCH discipline: one shared lightness and chroma across the
three hues, so no state shouts louder than another — which is precisely what the mockup's
ad-hoc trio got wrong (§1.2). `-fg` is text/icon on the ground; `-bg` is a tint fill;
`-border` is a hairline.

```css
/* SFAIO state roles. Nocturne is a mono system by design; a run board conveying
     14 task states needs a semantic set. Generated in OKLCH at one shared L/C so
     the three read as equals: L 0.74 / C 0.150 for foregrounds, L 0.30 / C 0.045
     for fills, L 0.45 / C 0.075 for borders. sRGB values are given alongside
     because oklch() support is fine in the webview but the same values are needed
     as hex by the VS Code theme (Phase 1 §1.2.2) — keep the two in step. */
--state-success-fg: oklch(0.74 0.15 150); /* #5ac576 */
--state-success-bg: oklch(0.3 0.045 150); /* #1c3422 */
--state-success-border: oklch(0.45 0.075 150); /* #34613f */

--state-attention-fg: oklch(0.74 0.15 85); /* #d6a20a */
--state-attention-bg: oklch(0.3 0.045 85); /* #382c11 */
--state-attention-border: oklch(0.45 0.075 85); /* #68521e */

--state-danger-fg: oklch(0.74 0.15 25); /* #fb817a */
--state-danger-bg: oklch(0.3 0.045 25); /* #422522 */
--state-danger-border: oklch(0.45 0.075 25); /* #7a4440 */

/* Roles that reuse existing ramps — declared as aliases so every state reads
     from one place. */
--state-idle-fg: var(--color-neutral-500);
--state-idle-bg: var(--color-neutral-900);
--state-idle-border: var(--color-neutral-800);

--state-active-fg: var(--color-accent);
--state-active-bg: var(--color-accent-900);
--state-active-border: var(--color-accent-700);

--state-waiting-fg: var(--color-accent-300);
--state-waiting-bg: var(--color-accent-900);
--state-waiting-border: var(--color-accent-800);

--state-spent-fg: var(--color-neutral-600);
--state-spent-bg: transparent;
--state-spent-border: var(--color-neutral-800);
```

### Why these numbers, and the one constraint that set them

`danger` is the binding constraint. **sRGB runs out of red before it runs out of green**: at
L 0.78 the maximum in-gamut chroma is 0.215 at hue 150 but only **0.128** at hue 25. An
earlier draft of this file specified L 0.78 / C 0.13 for all three — which puts `danger`
_outside_ sRGB. It would have been silently clipped by the browser, landing at a different
lightness and chroma than specified and destroying the very "all three read as equals"
property the shared L/C exists to create.

L 0.74 / C 0.150 is the resolution: in gamut for all three hues with headroom (max chroma at
L 0.74 is 0.204 / 0.152 / 0.158), and _more_ saturated than the broken L 0.78 set, not less.

Contrast against the `#161826` ground: success **8.12:1**, attention **7.57:1**, danger
**7.15:1** — all well past WCAG AA for body text, and within one point of each other, which
is the equal-weight property stated numerically.

Two caveats worth keeping:

- `danger` at this lightness reads as a **light coral**, not a deep red. That is the honest
  consequence of weighting it equally with green and amber on a dark ground. If the design
  owner wants a more conventional red, move the **whole triad** down (L 0.68 gives danger far
  more room) rather than dropping `danger` alone — moving one hue reintroduces exactly the
  imbalance the mockup had.
- **Approved (D6).** These were a derivation rather than a quotation from Nocturne's author,
  and have since been signed off: amber for `attention`, green for `success`, shown as
  specified. Build on them; they are no longer provisional.

**If you retune any of this, recompute rather than eyeballing**, and re-check gamut. The
conversion is short enough to keep as a scratch script; clipping is invisible until you
measure it.

### 4.3 Colour is never the only signal

Mandatory, and not only for accessibility — 14 states genuinely cannot be told apart by hue:

- every state chip carries a **Phosphor icon** and its **state name in text**;
- `active` additionally carries **motion** (the spinner ring), which is what distinguishes it
  from `waiting` at a glance;
- `spent` states render at reduced opacity with the label struck through.

A board a user can read in greyscale is a board they can read quickly in colour.

---

## 5. Scoping — how Nocturne coexists with the VS Code theme

Wrap every SFAIO surface in one element carrying `data-sfaio-theme`, and scope the token
block to it:

```css
/* nocturne.css */
[data-sfaio-theme] {
	/* …all 51 Nocturne tokens + the §4 state tokens… */
	background: var(--color-bg);
	color: var(--color-text);
	font-family: var(--font-body);
}
```

```tsx
// RunBoardPanel.tsx
<div data-sfaio-theme className="sfaio-root">
	…
</div>
```

Consequences to respect:

- **Nothing outside an SFAIO panel changes.** Chat, settings and history keep following
  `--vscode-*`. No existing screen is touched.
- **Radix portals escape the wrapper.** Dialogs, dropdowns, popovers and tooltips render into
  `document.body` by default, so they land _outside_ `[data-sfaio-theme]` and lose every
  token. Either pass a container prop pointing back inside the wrapper, or add
  `[data-sfaio-portal]` to the portal content and duplicate the token block for it. **Check
  this the first time you build a dropdown** — it is the failure everyone hits, and it looks
  like the tokens "randomly stopped working".
- Keep the Tailwind `@theme` block in `index.css` alone. Add SFAIO's own `@theme` mappings in
  the SFAIO stylesheet if you want Tailwind utilities over these tokens.

---

## 6. Responsive — the mockup is not

The mockup is a fixed 1440×900 canvas. A real webview panel is whatever width the user drags
it to, and the run board must survive a narrow editor column.

| Mockup                                   | SFAIO                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `width:1440px;height:900px` on the stage | `100%` / `100vh`, flex column                                                        |
| Right panel `flex:0 0 396px`             | keep 396px as the _preferred_ width; collapse below ~900px total                     |
| Bottom dock `height:172px`               | resizable, with a sensible min                                                       |
| Three-column workspace                   | below ~1100px, drop to board + one side panel; below ~700px, single column with tabs |

The dense 0.70× spacing scale helps here — it was built for this. Do not increase spacing to
fill a wide panel; let content sit left and leave the right margin empty, which is the
system's stated direction ("left-aligned, asymmetric; content hugs the left edge").

---

## 7. Patterns to copy from the mockup

These are the parts worth lifting almost literally, with their source lines.

### 7.1 Agent chat stream — message kinds (`:341-426`)

Four visually distinct message kinds. SFAIO's agent panel (Phase 3 §3.7) should reuse them
exactly:

| Kind               | Treatment                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **user** (`:344`)  | right-aligned bubble, `--color-accent-900` fill, `--color-accent-700` border, asymmetric radius `10px 10px 3px 10px`                                     |
| **say** (`:350`)   | 20px circular avatar with `ph-sparkle` in the accent, text in `--color-neutral-100` at 12.5px/1.6, optional blinking block cursor while streaming        |
| **think** (`:359`) | **dashed** `--color-neutral-700` border, `rgba(145,132,217,0.05)` wash, spinner, text pulsing via `siidPulse` — reads as provisional, which is the point |
| **tool** (`:366`)  | solid card on `--color-neutral-900` with icon + title + a status affordance                                                                              |

The tool card's status affordance is the pattern SFAIO needs most: a spinner while
`running`, a green `ph-check-circle` when `done`, and a monospace **`NEEDS OK`** chip in
amber when `pending` (`:371-379`). Map these to `active` / `success` / `attention` from §4.

Tool cards expand with optional rows — command highlight (`:382`), file path (`:388`), a
file list with verbs (`:396`), and a diff summary showing `+adds` / `−dels` in tinted pills
with the scope after (`:407`). SFAIO's task drawer wants all four.

### 7.2 Inline approve / reject (`:415-422`)

Approval lives **inside** the tool card, on a top-bordered footer: a full-width accent-outline
**Approve** with a check icon, and a fixed 96px neutral-outline **Reject**. Use this for the
Decision Inbox items in Phase 2 §2.4 and §2.6 — an approval that appears where the work is
described beats a separate modal.

### 7.3 Auto-approve control (`:539-548`)

A full-width clickable row above the composer: a 15px checkbox, the label `Auto-approve`,
then the **current scope in muted text** and a caret into settings. Adopt this shape directly
for SFAIO's auto mode (Phase 2 §2.6a) — showing the scope inline is what keeps "auto" from
feeling like a blind switch. SFAIO's scope string should name what auto mode _won't_ skip,
e.g. `design + delegation · not destructive, freshness, budget`.

### 7.4 Token / context meters (`:331-337`, `:572-578`)

Two forms, both useful:

- a **linear 3px meter** — label, track in `--color-neutral-800`, fill in
  `linear-gradient(90deg, var(--color-accent-600), var(--color-accent))`, `transition: width`
- a **16px SVG donut** rotated −90° with `stroke-dasharray`, beside a monospace percentage

Phase 5 §5.5's budget meter should use the linear form, with the fill switching to
`--state-attention-fg` past the 80% warning threshold and `--state-danger-fg` at the cap.

### 7.5 Pipeline / wave progress (`:244-267`)

Directly reusable as the run board's wave view: per row, a 16px status glyph (check / spinner
/ dot), a 200px label, a flexible 3px accent meter, and a right-aligned monospace note.
This is almost exactly `SFAIO.md` §11.2's wave grouping — build the board from it.

### 7.6 Dependency graph (`:269-302`)

An SVG node-link view with animated dashed edges (`siidDash`), a pulsing ring on the selected
node (`siidRing`), plus a **parallel chip list** of the same nodes beneath. The chip list is
the accessible, narrow-width fallback for the graph — keep both, as the mockup does.

### 7.7 Status bar (`:590-599`)

A 26px monospace footer: org name, error count, warning count, then domain readouts, a
spacer, and a pulsing live indicator. SFAIO's equivalent: target org, failed tasks, waiting
tasks, deploy-queue depth, run cost, and the live dot.

### 7.8 Modal shell (`:601-609`)

Full-bleed `rgba(14,16,28,0.94)` backdrop, a bordered panel on `--color-bg` with
`--shadow-lg`, a header row with an icon, a title, and a **status pill** (dot + monospace
label in a 999px border). `animation: siidRise 0.18s ease-out` on entry. Use for the
delegation-approval modal and the destructive-rollback confirmation.

### 7.9 Motion vocabulary (`:22-30`)

Nine keyframes, all cheap: `siidScan`, `siidSpin`, `siidPulse`, `siidBlink`, `siidDash`,
`siidRise`, `siidSweep`, `siidRing`. Copy them into the SFAIO stylesheet.

`siidRise` (`opacity 0 → 1`, `translateY(5px) → none`, 0.2s) is applied to nearly every
newly-appearing element and is most of why the mockup feels alive. Put it on new chat
messages, new diagnostics, new log lines, new queue items.

**Wrap all of it in `@media (prefers-reduced-motion: reduce)` and disable the infinite
loops** — `siidScan`, `siidPulse`, `siidBlink`, `siidDash`, `siidRing` never stop, and a
permanently animating panel is genuinely unpleasant for some users. Keep `siidRise`, which is
short and finite.

### 7.10 Ambience — optional, and default it off

The mockup paints a repeating scanline overlay and a 9s vertical scan sweep over the whole
stage (`:36-39`), behind an `{{ scanlines }}` flag. It suits a hero mockup. In a tool
somebody stares at for hours it is a distraction and a continuous repaint.

Ship it behind a setting, **off by default**. The radial-gradient ground
(`radial-gradient(1200px 600px at 18% -10%, #1d2038, #161826 45%, #101220)`) is worth
keeping unconditionally — it is static and does most of the atmospheric work anyway.

---

## 8. Typography

| Use                              | Family                               | Notes                                                                                                                                       |
| -------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| UI text, labels, prose           | Inter (`--font-body`)                | 13px base in the workspace chrome, below the DS's 15px default — the mockup sets `font-size:13px` on the stage. Keep 13px for SFAIO chrome. |
| Headings                         | Inter (`--font-heading`), weight 500 | Never heavier. Hierarchy is size and space.                                                                                                 |
| **Everything machine-generated** | JetBrains Mono                       | Paths, counts, durations, token figures, ids, log lines, CLI output, diff stats, percentages.                                               |

The monospace/sans split is doing real work: it is how the eye separates _what the system
measured_ from _what the interface says_. Follow it strictly — a task duration in Inter reads
as prose and gets lost.

Section labels use the DS `h6` treatment: ~9px, `letter-spacing: 0.16em`, uppercase,
`--color-neutral-500`, often followed by a `linear-gradient(90deg, var(--color-neutral-800),
transparent)` hairline that fades right (`:440-443`).

---

## 9. Build order

Fold into the existing phases rather than as a separate UI phase:

| Phase | Theme work                                                                                                                                                                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | `nocturne.css` with all tokens + §4 states; `@fontsource` fonts; `@phosphor-icons/react`; the `data-sfaio-theme` wrapper; motion keyframes + reduced-motion block; state-chip and tool-card components; modal shell. **Resolve the Radix portal scoping now** (§5). |
| **2** | Agent panel from §7.1; pipeline/wave board from §7.5; graph + chip fallback from §7.6; status bar from §7.7; log streaming into the console pane treatment.                                                                                                         |
| **3** | Escalation and freshness surfaces as tool cards with the `attention` role; destructive-rollback confirmation on the §7.8 modal with `danger`.                                                                                                                       |
| **4** | Budget meter from §7.4 with the three-stage fill; cost tables in JetBrains Mono; run summary.                                                                                                                                                                       |

### Definition of done for the theme

- No hex literal, font name, or raw px spacing value anywhere under
  `webview-ui/src/components/sfaio/` except inside `nocturne.css`. Add this to the Phase 5
  §4.1 grep gate.
- No `fonts.googleapis.com`, `fonts.gstatic.com`, or `unpkg.com` reference anywhere in SFAIO
  code. The CSP forbids them and the failure is silent (§1.1).
- Every state is legible with colour removed.
- All infinite animations stop under `prefers-reduced-motion: reduce`.
- The board is usable at 700px panel width.

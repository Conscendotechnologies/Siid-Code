# UI Ownership Map — who owns which pixel, and what is style versus feature

**Read this before estimating any UI work.** It answers two questions that the mockup itself
cannot: which codebase a given region belongs to, and whether a given element is a restyle or
a product feature drawn in the new style.

Referenced by Phase 1 (foundation), Phase 6 (product reskin) and Phase 7 (fork chrome).

---

## 1. Ownership

`SIID Workspace.dc.html` is one screenshot, but the pixels in it belong to different
codebases with very different change costs. The split is not where it looks.

| Mockup region                                                     | Lines                  | Owner                   | Mechanism                                             | Cost                        | Phase       |
| ----------------------------------------------------------------- | ---------------------- | ----------------------- | ----------------------------------------------------- | --------------------------- | ----------- |
| Top bar — logo, breadcrumb, dirty dot, Command, FORGE, Apex/UTF-8 | `:41-70`               | **Siid fork**           | Workbench source patch                                | High — permanent merge debt | 7           |
| Left file tree                                                    | —                      | **Siid fork**           | Colour theme reaches it; layout is upstream           | Low                         | 1           |
| Centre editor, line numbers, syntax, squiggles                    | `:140-183`             | **Siid fork**           | Colour theme + `tokenColors`                          | Low                         | 1           |
| Collaborative peer cursors                                        | `:66`, `peers`         | **Neither — a feature** | New product work                                      | Not a redesign              | —           |
| Bottom dock tab strip                                             | `:186-201`             | **Siid fork**           | Theme + partial chrome patch                          | Medium                      | 1 / 7       |
| → Problems tab                                                    | `:204-221`             | **Siid fork**           | VS Code's own panel; theme only                       | Low                         | 1           |
| → Console tab                                                     | `:223-242`             | **Siid fork**           | VS Code's own panel; theme only                       | Low                         | 1           |
| → Pipeline tab                                                    | `:244-267`             | **Extension (SFAIO)**   | Webview                                               | Owned by SFAIO              | 3           |
| → Graph tab                                                       | `:269-302`             | **Extension**           | Webview                                               | Medium                      | — (feature) |
| Right panel — SIID CODE                                           | `:307-587`             | **Siid-Code**           | React webview — full control                          | High, but no merge debt     | 6           |
| Status bar                                                        | `:590-599`             | **Both**                | Theme for the bar; items contributed by the extension | Low                         | 1 / 6       |
| Codebase Indexing modal                                           | `:601+`                | **Siid-Code**           | Webview                                               | Medium                      | 6           |
| Command palette                                                   | `:895+`                | **Siid fork**           | Workbench patch, or leave as-is                       | Medium                      | 7           |
| Loading screen                                                    | `SIID Loading.dc.html` | **Siid fork**           | `workbench.html` + splash                             | Medium                      | 7           |

### What follows

- **The extension cannot render the editor, file tree, or status bar.** Anything in those
  regions is fork work, reachable mostly through a colour theme — which is why Phase 1's
  theme is the highest-leverage task in the plan.
- **The right panel is entirely ours** and needs no fork change at all. It is also the densest
  part of the mockup and the part users look at most.
- **The bottom dock is split down the middle.** Problems and Console are VS Code's own panels:
  theme them and stop. Pipeline and Graph are webviews we build.

---

## 2. Style versus feature

Parts of the mockup are a **redesign of something that exists**. Other parts are **product
features that do not exist yet**, drawn in the same style. Only the first kind is a reskin.

Sorting these is the single most important thing this document does — estimating a feature
inside a styling ticket is how a redesign slips by a quarter.

### 2.1 Redesigns — in scope for Phases 1 and 6

| Mockup element                              | What exists today                                                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Right panel chat stream                     | `webview-ui/src/components/chat/` — 50 components incl. `ChatView`, `ChatRow`, `ChatTextArea`                    |
| Auto-approve row (`:539-548`)               | `chat/AutoApproveMenu.tsx`                                                                                       |
| Mode / model pickers (`:562-570`)           | `chat/ModeSelector.tsx`, `chat/ModelSelector.tsx`                                                                |
| Context donut (`:572-578`)                  | `chat/ContextWindowProgress.tsx`, `chat/ContextUsageIndicator.tsx`                                               |
| Task header, token meter (`:322-338`)       | `chat/TaskHeader.tsx`                                                                                            |
| Recent tasks / history (`:440-527`)         | `components/history/` — 9 components                                                                             |
| Indexing modal, Run + Settings tabs         | `chat/CodeIndexPopover.tsx`, `IndexingStatusBadge.tsx`, `SalesforceIndexLoader.tsx` — currently **light-themed** |
| Tool cards with approve/reject (`:366-422`) | `chat/ChatRow.tsx`, `BatchFilePermission.tsx`, `BatchDiffApproval.tsx`                                           |
| Settings                                    | `components/settings/` — 32 components                                                                           |
| Editor, tree, status bar, palette           | VS Code, upstream — theme only                                                                                   |

### 2.2 Features — **not** in any reskin phase

Each is a project in its own right and needs its own plan.

- **Collaborative peer cursors** (`peers`, `peerName`, `peerColor`, `collabOn`) — live
  multi-user presence. A backend, a transport and a conflict model.
- **Interlinked Graph Network** with selection, links, refs, coverage (`netSel.*`) — the index
  data exists; this interactive view does not.
- **Order-of-execution view** (`ooe`, `ooeLegend`) — the transaction index exists; this
  visualisation does not.
- **Indexing modal's Symbols / Graph / Timeline tabs** — three new views over index data.
- **Inline squiggles and a coverage gutter** (`squiggles`, `ln.isCov`) — the mockup paints its
  own editor in a `<textarea>`. The real editor is Monaco; coverage decorations are an
  extension feature, not styling.
- **Live SOQL / DML / coverage readouts** in the status bar — needs instrumentation that does
  not exist.

Roughly: the right panel and the modals are a **redesign**; the centre column is mostly
**theme**; graph, order-of-execution, presence and live metrics are **new features**.

### 2.3 Already real, despite looking new

- **FORGE** — `Siid/extensions/siid-forge` exists. The affordance has something to open.
- **Pipeline tab** — this is SFAIO's wave board. It arrives with Phase 3, built from the
  mockup's pipeline rows (`:244-267`).
- **The indexing hex cluster** — the existing "Discovering Metadata" screen, currently
  light-themed with blue hexagons. The mockup is its dark redesign, not a new screen.

---

## 3. Scale

| Surface                       | Size                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Extension webview components  | **190 `.tsx`** — chat 50, settings 32, ui 21, common 18, history 9, mcp 5, welcome 4, marketplace 3, modes 2 |
| …of which carry hardcoded hex | **7** (listed in Phase 1 §1.6)                                                                               |
| Fork theme                    | 249 colour keys, 241 `tokenColors` rules, already the default                                                |
| Fork workbench patches today  | 6 files, ~1100 lines                                                                                         |
| Design system                 | 295 lines of CSS, 51 tokens                                                                                  |
| Workspace mockup              | 2268 lines                                                                                                   |

**190 components, 7 with hardcoded colour.** That ratio is the whole planning story: the
codebase themes off `--vscode-*` almost everywhere, so Phase 1's colour theme carries the vast
majority of the reskin with no component edits at all. Do not plan a 190-component sweep.

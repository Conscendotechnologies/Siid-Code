# Flow Tool Handoff

Focus: `generate_sf_flow` tool — bugs surfaced, root causes, next steps.

## What the tool is

Two-step pipeline wrapped by `src/core/tools/generateSfFlowTool.ts`:

1. `python/prompt_to_graph.py` — LLM (prompt) → graph JSON
2. `python/graph_to_flow_xml.py` — graph JSON → Flow XML (`force-app/main/default/flows/*.flow-meta.xml`)

Then a `sf` CLI dry-run validates; only on success does it deploy.

## Repo layout

```
python/
  prompt_to_graph.py        # prompt → graph
  graph_to_flow_xml.py      # graph → XML emitter  ← main bug source
  test_flow_xmls/           # sample flows for regression
  bundle/                   # PyInstaller bundle for the extension
src/core/tools/
  generateSfFlowTool.ts     # VS Code tool wrapper
  sfDeployMetadataTool.ts   # deploys validated XML
src/core/prompts/tools/
  generate-sf-flow.ts       # tool prompt
```

## Open bugs (must fix before declaring done)

### 1. Double-nested `<elementReference>` in assignment `<value>` (ROOT CAUSE)

**Symptom:** `Error parsing file: Unexpected element {http://soap.sforce.com/2006/04/metadata}elementReference during simple type deserialization, Line 15`

**Root cause:** `graph_to_flow_xml.py` emitter for an `elementReference`-typed value inside `<assignmentItems>` wraps the inner reference in an outer `<elementReference>` tag.

Wrong shape:

```xml
<value>
  <elementReference>
    <elementReference>Today_Plus_0_Days</elementReference>
  </elementReference>
</value>
```

Correct shape (schema requires leaf text inside `<elementReference>`):

```xml
<value>
  <elementReference>Today_Plus_0_Days</elementReference>
</value>
```

**Fix:** find the assignmentItem/value emitter and stop wrapping the inner reference. `<value>` must contain **one** `<elementReference>` with the resource name as text.

**Test prompt:** `Before an Opportunity is saved, if StageName is Closed Won, set the CloseDate to today using a formula.`

### 2. Missing Start node in screen-flow graphs

**Symptom:** `Error: Graph must contain exactly one Start node; found 0`

**Trigger:** `Create a screen flow for an Employee Leave Request. Add a dynamic choice set called LeaveTypeChoices pulling from Leave_Type__c on Leave_Request__c. Include 2 screens and a CreateRecords node...`

**Root cause:** `prompt_to_graph.py` either drops the Start node or never emits one for screen flows, then `graph_to_flow_xml.py` rejects. Investigate both files — likely prompt-side graph omission, not emitter-side.

### 3. Update_Records references wrong variable name

**Symptom:** `Update_Records` element references `Loop_Through_Contacts` instead of `contactsToSave`. Plus a redundant self-assignment in `Set_LastName`.

**Trigger:** `Every day, find all Contacts with no Email set and add "Missing" to their LastName...`

**Root cause:** LLM generates plausible-looking but wrong references. Emitter accepts whatever the graph says. Options:

- (a) Add a graph-emit sanity check in `graph_to_flow_xml.py`: verify `updateRecords.inputReference` exists in graph resources.
- (b) Tighten `prompt_to_graph.py` schema with explicit examples.

### 4. `generate_sf_flow` prompt says "fix reported cause, do not hand-edit XML" but agent hand-edits anyway

The model hand-edits output XML instead of regenerating. Either:

- Strengthen the prompt in `generate-sf-flow.ts`.
- Or auto-regenerate on validation error before giving up (the tool already does 2 attempts — extend to N).

## Other known issues from this session

- `parse error Expecting ',' delimiter: line 43 column 61` from `prompt_to_graph.py` — sometimes the LLM emits invalid JSON for scheduled-flow prompts. Schema-validation feedback loop would help.
- Post-deploy activation: user wants the tool to activate (`status=Active`) **before** deploy, not after. Currently the emitter writes `Active` in the XML and `sf` deploys as-is. Verify this is actually happening — check `graph_to_flow_xml.py` `<status>` output and confirm `sf_deploy` does not override.

## Useful context

- Test flows for regression: `python/test_flow_xmls/`
- Manual scenarios: `python/FLOW_MANUAL_TEST_SCENARIOS.md`
- Sample prompts covering edge cases: same file.
- TypeScript check: `npx tsc -p src/tsconfig.json --noEmit`
- Indentation is **tabs** — be careful with Edit on Python files.

## Recommended order

1. Fix bug #1 (double-nested elementReference) — one-liner in emitter.
2. Add a regression test in `python/test_flow_xmls/` for before-save formula assignment.
3. Re-run the 4 manual scenarios from `FLOW_MANUAL_TEST_SCENARIOS.md`.
4. Then tackle #2 (missing Start), #3 (wrong reference), #4 (hand-edit avoidance).

## Don't

- Don't add new abstraction layers for the emitter — fix the existing functions.
- Don't push base branches (`git branch -vv` first).
- Don't add Co-Authored-By or Claude attribution to commits.

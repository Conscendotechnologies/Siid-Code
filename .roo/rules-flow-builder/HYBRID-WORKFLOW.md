# Flow Builder - Hybrid 3-Stage Workflow

## Overview

A streamlined approach that balances simplicity with thoroughness. Three fixed stages with smart expansion based on complexity.

**Non-Negotiable Requirements:**

- ✅ Schema retrieval BEFORE using any object/field
- ✅ PMD validation at checkpoints
- ✅ Planning document (temporary, deleted after completion)

---

## Initial Todo Structure

When starting any flow build, AI creates this initial structure:

```xml
<manage_todo_list>
<todoList>
[
  { "id": 1, "title": "Stage 1: Requirements Collection", "status": "not-started" },
  { "id": 2, "title": "Stage 2: Planning & Documentation", "status": "not-started" },
  { "id": 3, "title": "Stage 3: Implementation & Validation", "status": "not-started" },
  { "id": 4, "title": "Stage 4: Deployment & Error Resolution", "status": "not-started" },
  { "id": 5, "title": "Stage 5: Cleanup", "status": "not-started" }
]
</todoList>
</manage_todo_list>
```

**Expansion Rule:** Stages expand into sub-tasks only when complexity requires it OR when actively working on that stage.

---

## 📋 STAGE 1: Requirements Collection

**Purpose:** Gather ALL information needed before planning.

### Fixed Sub-Tasks (Always Show When Active):

```json
[
	{ "id": 1.1, "title": "Analyze user requirements & flow type", "status": "in-progress" },
	{ "id": 1.2, "title": "Identify ALL objects and retrieve schemas ⚠️ REQUIRED", "status": "not-started" },
	{ "id": 1.3, "title": "Identify trigger conditions & entry criteria", "status": "not-started" },
	{ "id": 1.4, "title": "List required elements & data flows", "status": "not-started" }
]
```

### Critical Actions:

1. **Identify Flow Type**

    - Screen Flow (user interaction)
    - Record-Triggered Flow (Before/After Save)
    - Scheduled Flow
    - Autolaunched Flow
    - Platform Event-Triggered

2. **⚠️ NON-NEGOTIABLE: Schema Retrieval**

    - Use `retrieve_schema` tool for EACH object identified
    - Document fields that will be used
    - Verify required fields
    - If new objects discovered later → STOP and retrieve schema

3. **Gather Requirements**
    - Entry conditions/filters
    - Business logic rules
    - Data transformations needed
    - Error handling requirements
    - User interaction requirements (if Screen Flow)

### Complexity Detection:

If ANY of these are present, mark for detailed tracking:

- ❌ Loops with bulk operations
- ❌ Multiple decision branches (3+)
- ❌ DML operations (Create/Update/Delete)
- ❌ Complex formulas or calculations
- ❌ Multiple objects with relationships

### Output:

Document findings in memory for Stage 2.

---

## 📋 STAGE 2: Planning & Documentation

**Purpose:** Create comprehensive implementation plan BEFORE writing XML.

### Fixed Sub-Tasks (Always Show When Active):

```json
[
	{ "id": 2.1, "title": "Create planning document (.roo/flows/PLAN-[FlowName].md)", "status": "in-progress" },
	{ "id": 2.2, "title": "Define all variables, formulas, constants", "status": "not-started" },
	{ "id": 2.3, "title": "Map element sequence with connectors", "status": "not-started" },
	{ "id": 2.4, "title": "Define error handling strategy", "status": "not-started" },
	{ "id": 2.5, "title": "Review plan for completeness", "status": "not-started" }
]
```

### Planning Document Template:

Create file: `.roo/flows/PLAN-[FlowName].md`

```markdown
# Flow Implementation Plan: [FlowName]

## Flow Metadata

- **Name:** [FlowName]
- **Type:** [Screen/Record-Triggered/etc]
- **Description:** [Business purpose]
- **Trigger:** [If applicable: Object, When, Conditions]

## Objects & Schemas Retrieved

- ✅ [Object1] - Schema retrieved
    - Fields used: [field1, field2, field3]
    - Required fields: [requiredField1, requiredField2]
- ✅ [Object2] - Schema retrieved
    - Fields used: [field1, field2]

## Variables

1. **varLeadRecord** (sObject, Lead) - Stores the lead being processed
2. **varStatus** (String) - Stores status value
3. **varSuccessMessage** (String) - Stores confirmation message

## Formulas

1. **frmFullName** - Concatenate FirstName + LastName
2. **frmIsHighPriority** - Check if amount > 50000

## Element Sequence
```

START
↓ (trigger: Account After Save)
↓ [Filter: Status = "New"]
↓
GET_RECORDS: Get_Related_Contacts
↓ [Store in: colContacts]
↓
DECISION: Check_Contact_Count
↓ [If > 0] ↓ [Default]
↓ ↓
LOOP: Process SCREEN: No_Contacts
↓ ↓
ASSIGNMENT END
↓
[After Loop]
↓
RECORD_UPDATE: Update_Account
↓ [Success] ↓ [Fault]
↓ ↓
SCREEN: Success SCREEN: Error
↓ ↓
END END

```

## DML Operations
1. **Update_Account** (recordUpdates)
   - Object: Account
   - Fields: Status, LastModifiedDate
   - Fault Handler: Error_Screen

## Error Handling
- All DML operations → Fault connectors to Error_Screen
- Error_Screen displays {!$Flow.FaultMessage}

## Validation Checkpoints
- After variables: PMD Check #1 (UnusedVariable)
- After elements: PMD Check #2 (DMLInLoop, MissingFaultPath, HardcodedId)
- Before deployment: Full PMD validation

## Complexity Notes
- [IF COMPLEX] Contains loop - ensure no DML inside loop body
- [IF COMPLEX] Multiple branches - validate all paths reach END
```

### Plan Review Checklist:

Before proceeding to Stage 3:

- [ ] All objects identified with schemas retrieved
- [ ] All variables listed with correct data types
- [ ] Element sequence shows clear flow from START to END
- [ ] All DML operations have fault handlers defined
- [ ] No DML/SOQL inside loop bodies (if loops present)
- [ ] Decision branches show all outcomes

---

## 📋 STAGE 3: Implementation & Validation

**Purpose:** Build XML following the plan, validate at checkpoints.

### Fixed Sub-Tasks (Always Show When Active):

```json
[
	{ "id": 3.1, "title": "Create flow metadata structure", "status": "in-progress" },
	{ "id": 3.2, "title": "Add variables & resources → PMD Checkpoint #1 ⚠️", "status": "not-started" },
	{ "id": 3.3, "title": "Add start element with triggers", "status": "not-started" },
	{ "id": 3.4, "title": "Add flow elements per plan", "status": "not-started" },
	{ "id": 3.5, "title": "PMD Checkpoint #2: Validate elements ⚠️", "status": "not-started" },
	{ "id": 3.6, "title": "Final validation before deployment", "status": "not-started" }
]
```

### When Complexity Detected, Expand 3.4:

If flow has loops, multiple DML, or complex logic:

```json
{ "id": 3.4, "title": "Add flow elements per plan", "status": "in-progress" },
  { "id": 3.4.1, "title": "Add Get Records elements", "status": "not-started" },
  { "id": 3.4.2, "title": "Add Decision elements", "status": "not-started" },
  { "id": 3.4.3, "title": "Add Loop element (validate no DML in body)", "status": "not-started" },
  { "id": 3.4.4, "title": "Add Assignment elements", "status": "not-started" },
  { "id": 3.4.5, "title": "Add DML elements with fault connectors", "status": "not-started" },
  { "id": 3.4.6, "title": "Add Screen elements", "status": "not-started" }
```

### Implementation Steps:

#### 3.1 - Flow Structure

Create file: `force-app/main/default/flows/[FlowName].flow-meta.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>65.0</apiVersion>
    <areMetricsLoggedToDataCloud>false</areMetricsLoggedToDataCloud>
    <environments>Default</environments>
    <interviewLabel>{FlowName} {!$Flow.CurrentDateTime}</interviewLabel>
    <label>{Flow Label}</label>
    <processMetadataValues>
        <name>BuilderType</name>
        <value><stringValue>LightningFlowBuilder</stringValue></value>
    </processMetadataValues>
    <processMetadataValues>
        <name>CanvasMode</name>
        <value><stringValue>AUTO_LAYOUT_CANVAS</stringValue></value>
    </processMetadataValues>
    <processMetadataValues>
        <name>OriginBuilderType</name>
        <value><stringValue>LightningFlowBuilder</stringValue></value>
    </processMetadataValues>
    <processType>AutoLaunchedFlow</processType>
    <status>Draft</status>
</Flow>
```

**If Screen Flow:** Add customProperties for ScreenProgressIndicator

#### 3.2 - Variables & Resources + PMD Checkpoint #1

Add all variables/formulas/constants from plan.

**⚠️ NON-NEGOTIABLE: PMD Checkpoint #1**

- Trigger PMD validation
- Check for: UnusedVariable warnings
- Fix any issues before proceeding

#### 3.3 - Start Element

Configure based on flow type from plan.

#### 3.4 - Flow Elements

**Add elements in this order:**

1. Group by type (all screens, all assignments, all recordCreates, etc.)
2. Within each group, alphabetical by name
3. Properties within element in alphabetical order

**For each element:**

- Reference the plan document
- Verify schema fields exist
- Add connectors as mapped in plan
- For DML: Add faultConnector
- For Decisions: Add all outcomes + defaultConnector

**Screen Flow Specific:**

- Fields need `inputsOnNextNavToAssocScrn=UseStoredValues`
- ComponentInstance needs `storeOutputAutomatically=true`
- Reference component outputs with `.value` suffix

**Loop Pattern:**

- NO DML inside `nextValueConnector` body
- Use Assignment inside loop to modify records
- Bulk DML after loop in `noMoreValuesConnector` path

#### 3.5 - PMD Checkpoint #2

**⚠️ NON-NEGOTIABLE: PMD Validation**

Run PMD and check for:

- ❌ DMLStatementInLoop
- ❌ SOQLQueryInLoop
- ❌ ActionCallsInLoop
- ⚠️ MissingFaultPath
- ❌ HardcodedId
- ❌ DuplicateElementName

**If errors found:**

1. STOP implementation
2. Fix errors one by one
3. Re-validate
4. Only proceed when all pass

#### 3.6 - Final Validation Before Deployment

**Pre-Deployment Checks:**

```
1. Read complete XML file
2. Run full PMD validation (all 21+ rules)
3. If PMD errors → Fix and repeat validation
4. Verify all connectors reference valid elements
5. Verify all field references match schemas
6. Verify all DML operations have fault connectors
7. Mark Stage 3 complete when all validations pass
```

---

## 📋 STAGE 4: Deployment & Error Resolution

**Purpose:** Deploy flow iteratively, fixing errors until successful deployment.

### Fixed Sub-Tasks (Always Show When Active):

```json
[
	{ "id": 4.1, "title": "Deploy with --checkonly flag (dry run)", "status": "in-progress" },
	{ "id": 4.2, "title": "Analyze deployment errors (if any)", "status": "not-started" },
	{ "id": 4.3, "title": "Fix errors and re-validate", "status": "not-started" },
	{ "id": 4.4, "title": "Repeat deployment until success", "status": "not-started" },
	{ "id": 4.5, "title": "Deploy to org (actual deployment)", "status": "not-started" },
	{ "id": 4.6, "title": "Activate flow in Salesforce", "status": "not-started" }
]
```

### Deployment Loop:

**This stage repeats until deployment succeeds:**

```
┌─────────────────────────────────────┐
│ 1. Deploy --checkonly               │
│ 2. Check results                    │
│    ├─ Success? → Deploy actual      │
│    └─ Errors? → Continue to step 3  │
│ 3. Analyze error messages           │
│ 4. Fix errors in XML                │
│ 5. Re-run PMD validation            │
│ 6. Return to step 1                 │
└─────────────────────────────────────┘
```

### Common Deployment Errors & Fixes:

| Error Type               | Cause                                 | Fix                                                         |
| ------------------------ | ------------------------------------- | ----------------------------------------------------------- |
| Missing Required Field   | Schema changed or field not populated | Retrieve schema again, add field to assignment/create       |
| Invalid Field Reference  | Typo or field doesn't exist           | Check object schema, fix field name                         |
| API Version Mismatch     | Org doesn't support specified version | Lower apiVersion (e.g., 65.0 → 62.0)                        |
| Validation Rule Failed   | Org validation rules blocking         | Add logic to satisfy validation or populate required fields |
| Duplicate Developer Name | Flow with same name exists            | Rename flow or delete existing flow                         |
| Record Type Required     | Object requires record type           | Add RecordTypeId assignment                                 |
| Required Relationship    | Parent record must exist first        | Adjust flow logic or entry criteria                         |

### Error Resolution Pattern:

**For Each Error:**

1. **Read Error Message** - Copy exact error from deployment output
2. **Identify Root Cause** - Missing field? Wrong API? Schema issue?
3. **Check Relevant Schema** - If field-related, verify in object schema
4. **Fix XML** - Make targeted fix (don't rewrite everything)
5. **Re-validate with PMD** - Ensure fix doesn't introduce new issues
6. **Deploy Again** - Return to checkonly deployment

### Expanding for Complex Issues:

If multiple errors or complex issues, can expand 4.3:

```json
{ "id": 4.3, "title": "Fix errors and re-validate", "status": "in-progress" },
  { "id": 4.3.1, "title": "Fix: Missing Company field on Lead", "status": "in-progress" },
  { "id": 4.3.2, "title": "Fix: API version mismatch", "status": "not-started" },
  { "id": 4.3.3, "title": "Re-run PMD validation", "status": "not-started" }
```

### Success Criteria:

✅ Deployment --checkonly succeeds  
✅ Actual deployment completes  
✅ Flow is active in Salesforce  
✅ Flow can be opened in Flow Builder without errors

---

## 📋 STAGE 5: Cleanup

```json
[
	{ "id": 4.1, "title": "Delete planning document", "status": "in-progress" },
	{ "id": 4.2, "title": "Verify flow deployed successfully", "status": "not-started" }
]
```

Delete: `.roo/flows/PLAN-[FlowName].md`

---

## Smart Expansion Rules

### When to Expand Sub-Tasks:

**Stage 1:** Always show 4 core sub-tasks when active

**Stage 2:** Always show 5 planning sub-tasks when active

**Stage 3:**

- **Simple flows** (2-3 elements, no loops/DML): Show 6 core sub-tasks
- **Complex flows** (loops, DML, 5+ elements): Expand 3.4 into element types

**Stage 4:**

- Show 6 deployment sub-tasks
- If multiple errors, expand 4.3 to track each fix
- Show iteration count if deployment fails multiple times

**Stage 5:** Always show 3 cleanup tasks

### Keep it Concise:

- Maximum 6-8 visible todos at once
- Collapse completed stages
- Expand only the active stage
- For complex elements, can add temporary sub-task, remove when complete

---

## Validation Summary

### Non-Negotiable Checkpoints:

| Checkpoint           | When           | What                           | Blocker?         |
| -------------------- | -------------- | ------------------------------ | ---------------- |
| Schema Retrieval     | Stage 1        | All objects identified         | ✅ YES           |
| Plan Review          | End of Stage 2 | Completeness check             | ✅ YES           |
| PMD #1               | Stage 3.2      | UnusedVariable                 | ⚠️ Warnings OK   |
| PMD #2               | Stage 3.5      | DML/SOQL in loops, fault paths | ✅ YES           |
| Full PMD             | Stage 3.6      | All 21+ rules                  | ✅ YES           |
| Deployment Checkonly | Stage 4.1      | Org validation (dry run)       | ✅ YES (iterate) |
| Actual Deployment    | Stage 4.5      | Deploy to org                  | ✅ YES           |
| Flow Activation      | Stage 4.6      | Activate in Salesforce         | ✅ YES           |

---

## Quick Reference: Pattern Files

For detailed patterns, reference existing documentation:

- **Screen Flows:** `SCREEN-FLOW-PATTERNS.md`
- **Record-Triggered:** `RECORD-TRIGGER-FLOW-PATTERNS.md`
- **Element Details:** `DETAILED-WORKFLOW.md` (Phases 4-7)
- **Schema Guide:** `SCHEMA-RETRIEVAL-GUIDE.md`
- **Error Recovery:** `ERROR-RECOVERY-GUIDE.md`

---

## Example: Simple Screen Flow

**User Request:** "Create a screen flow to capture lead information"

**Initial Todos:**

```json
[
	{ "id": 1, "title": "Stage 1: Requirements Collection", "status": "in-progress" },
	{ "id": 2, "title": "Stage 2: Planning & Documentation", "status": "not-started" },
	{ "id": 3, "title": "Stage 3: Implementation & Validation", "status": "not-started" },
	{ "id": 4, "title": "Clean up temporary files", "status": "not-started" }
]
```

**Stage 1 (Expanded):**

```json
[
	{ "id": 1, "title": "Stage 1: Requirements Collection", "status": "in-progress" },
	{ "id": 1.1, "title": "Analyze requirements - Screen flow for lead capture", "status": "completed" },
	{ "id": 1.2, "title": "Retrieve Lead object schema", "status": "completed" },
	{ "id": 1.3, "title": "No triggers - manual launch", "status": "completed" },
	{ "id": 1.4, "title": "Elements: 2 screens, 1 assignment, 1 record create", "status": "completed" },
	{ "id": 2, "title": "Stage 2: Planning & Documentation", "status": "not-started" }
]
```

**Stage 4 (Deployment with Errors):**

```json
[
  { "id": 3, "title": "Stage 3: Implementation & Validation", "status": "completed" },
  { "id": 4, "title": "Stage 4: Deployment & Error Resolution", "status": "in-progress" },
    { "id": 4.1, "title": "Deploy with --checkonly flag (dry run)", "status": "completed" },
    { "id": 4.2, "title": "Analyze deployment errors (if any)", "status": "completed" },
    { "id": 4.3, "title": "Fix errors and re-validate", "status": "in-progress" },
      { "id": 4.3.1, "title": "Fix: Missing Company field on Lead", "status": "completed" },
      { "id": 4.3.2, "title": "Re-run PMD validation", "status": "in-progress" },
    { "id": 4.4, "title": "Repeat deployment until success (Attempt 2)", "status": "not-started" }
]
```

**Complexity:** Simple (no loops, single DML) → Minimal expansion

---

**Last Updated:** 2026-01-07  
**Version:** 1.0 - Hybrid Approach

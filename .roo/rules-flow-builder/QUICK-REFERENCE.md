# Flow Builder - Quick Reference Card

> **📌 PRIMARY WORKFLOW:** Use [HYBRID-WORKFLOW.md](HYBRID-WORKFLOW.md) for all flow building tasks.
>
> This Quick Reference provides concepts and patterns. For step-by-step process, see HYBRID-WORKFLOW.md.

## 🎯 **At a Glance**

### **5-Stage Hybrid Workflow (Recommended)**

1. **Requirements Collection** - Gather info & retrieve schemas
2. **Planning & Documentation** - Create plan document before implementing
3. **Implementation & Validation** - Build XML with PMD checkpoints
4. **Deployment & Error Resolution** - Deploy iteratively until success
5. **Cleanup** - Delete temporary files

**Key Features:**

- ✅ Planning document created before implementation
- ✅ Smart expansion based on complexity
- ✅ Separate deployment stage with error iteration
- ✅ Concise todo tracking (6-8 tasks visible)

### **3 PMD Checkpoints** (Non-Negotiable)

- **#1** Stage 3.2: UnusedVariable (after variables)
- **#2** Stage 3.5: DML/SOQL in loops, fault paths, hardcoded IDs (after elements)
- **#3** Stage 3.6: All 21+ rules (before deployment)

### **Core Principles**

- **Schema First:** Always retrieve schemas before using fields
- **Plan First:** Create planning document before XML
- **Validate Often:** Checkpoints catch errors early
- **Deploy Iteratively:** Fix errors one by one until success

---

## ✅ **What to Expect**

### **When AI Starts Building:**

```json
[
	{ "id": 1, "title": "Stage 1: Requirements Collection", "status": "not-started" },
	{ "id": 2, "title": "Stage 2: Planning & Documentation", "status": "not-started" },
	{ "id": 3, "title": "Stage 3: Implementation & Validation", "status": "not-started" },
	{ "id": 4, "title": "Stage 4: Deployment & Error Resolution", "status": "not-started" },
	{ "id": 5, "title": "Stage 5: Cleanup", "status": "not-started" }
]
```

### **When AI Works on a Stage:**

```json
[
	{ "id": 1, "title": "Stage 1: Requirements Collection", "status": "completed" },
	{ "id": 2, "title": "Stage 2: Planning & Documentation", "status": "in-progress" },
	{ "id": 2.1, "title": "Create planning document (.roo/flows/PLAN-FlowName.md)", "status": "completed" },
	{ "id": 2.2, "title": "Define all variables, formulas, constants", "status": "in-progress" },
	{ "id": 2.3, "title": "Map element sequence with connectors", "status": "not-started" },
	{ "id": 3, "title": "Stage 3: Implementation & Validation", "status": "not-started" }
]
```

**Note:** Stages expand only when active or when complexity requires it.

### **When AI Validates:**

**Element-Level Validation (After Each Element):**

```json
{
	"validationCheckpoint": "Element_Validation",
	"element": { "type": "recordCreates", "name": "Create_Lead" },
	"checks": [
		{ "rule": "ELEMENT_WELLFORMED", "status": "pass" },
		{ "rule": "UNIQUE_NAME", "status": "pass" },
		{ "rule": "FAULT_CONNECTOR", "status": "pass" },
		{ "rule": "SCHEMA_COMPLIANCE", "status": "pass" }
	],
	"summary": { "passed": 4, "failed": 0 },
	"status": "pass",
	"action": "proceed_to_next_element"
}
```

**PMD Validation (Checkpoints 1, 2, 3):**

```json
{
	"validationCheckpoint": "PMD_Checkpoint_2",
	"phase": "Phase 5 - After All Elements",
	"pmd_rules_checked": [
		{ "rule": "DMLStatementInLoop", "status": "pass", "count": 0 },
		{ "rule": "MissingFaultPath", "status": "pass", "count": 0 },
		{ "rule": "HardcodedId", "status": "pass", "count": 0 }
	],
	"summary": { "errors": 0, "warnings": 0 },
	"status": "pass",
	"action": "proceed_to_phase_6"
}
```

**NOTE:** Your PMD extension provides structured error messages with:

- `suggested_fix` - Exact XML to add/change
- `example` - Code example showing the fix
- `impact` - Why it matters
- `possible_typos` - Hints for naming errors

---

## 🚨 **Common Validations**

### **Element-Level (After Each Element):**

- ✓ Element well-formed
- ✓ Name unique
- ✓ Output variable exists
- ✓ Connector valid
- ✓ No hardcoded IDs
- ✓ Schema compliance

### **PMD Checkpoint #2 (After All Elements):**

- ✓ No DML in loops
- ✓ No SOQL in loops
- ✓ No actions in loops
- ✓ All DML have fault paths
- ✓ No hardcoded IDs
- ✓ No duplicate names

### **Phase 8 (17-Point Checklist):**

1. No DML in loops
2. No SOQL in loops
3. No actions in loops
4. Get Records have filters
5. DML uses collections
6. Decision has default connector
7. Loop has both connectors
8. No orphaned elements
9. Flow has description
10. runInMode defined
11. No hardcoded IDs
12. Element names unique
13. Variable names unique
14. All variables defined
15. All connectors valid
16. ProcessType valid
17. API version current

---

## 🔧 **Element-Specific Rules**

### **FlowRecordLookup (Get Records):**

✓ Has filters OR justified
✓ Uses indexed fields
✓ getFirstRecordOnly correct
✓ No hardcoded IDs

### **FlowDecision:**

✓ All outcomes have connectors
✓ Has defaultConnector
✓ No hardcoded values

### **FlowLoop:**

✓ Collection variable exists
✓ Both connectors defined
✓ **NO DML/SOQL/Actions in loop body**

### **FlowRecordCreate/Update/Delete:**

✓ **Has faultConnector**
✓ Uses collection (bulk)
✓ **NOT inside loop**

### **FlowActionCall:**

✓ Has faultConnector
✓ **NOT inside loop**

---

## 🆘 **If Validation Fails**

### **5-Step Recovery:**

1. **STOP** - Don't proceed
2. **IDENTIFY** - Root cause (check error message from PMD extension)
3. **FIX** - Apply `suggested_fix` from error message
4. **RE-VALIDATE** - Confirm fix
5. **PROCEED** - Continue workflow

### **PMD Extension Error Format:**

Your PMD extension provides structured errors like:

```json
{
	"rule": "DMLStatementInLoop",
	"severity": "error",
	"message": "DML inside loop - governor limit violation",
	"location": "line 245",
	"suggested_fix": "Move DML outside loop...",
	"fix_pattern": "Loop → Assignment → Loop back → DML",
	"example": "<xml>...</xml>"
}
```

**Read the `suggested_fix` and apply it!**

### **Common Fixes:**

**DML in Loop?**
→ Move DML outside, use Assignment inside to build collection
→ Pattern: `Loop → Assignment → Loop back → After Loop → DML`

**SOQL in Loop?**
→ Move Get Records before loop, query all at once
→ Pattern: `Get Records → Loop → Decision (filter) → Loop back`

**Missing Fault Path?**
→ Add faultConnector to DML/Action element
→ `<faultConnector><targetReference>Error_Screen</targetReference></faultConnector>`

**Hardcoded ID?**
→ Use Custom Metadata, Custom Label, or Formula
→ Never use 15 or 18 character Salesforce IDs

**Duplicate Name?**
→ Rename element, update ALL connectors that reference it

**Missing Metadata?**
→ Add required field (PMD extension will show exact XML)

---

## 📊 **Success Indicators**

### **✅ Good:**

- Progressive disclosure used (10 phases → expand → collapse)
- Validation helper JSON at checkpoints
- 3 PMD checkpoints triggered
- Recovery protocol followed if errors
- Dry-run before deployment
- Comprehensive documentation

### **❌ Red Flags:**

- 100+ tasks shown upfront
- No validation helper JSON
- PMD not triggered
- Validation fails but AI proceeds
- Deployment without dry-run
- Missing documentation

---

## 📚 **Documentation**

### **Essential Guides (START HERE):**

- **⭐ [README.md](README.md)** - Documentation index & workflow selector
- **✅ [HYBRID-WORKFLOW.md](HYBRID-WORKFLOW.md)** - PRIMARY 5-stage streamlined workflow
- [**SCHEMA-RETRIEVAL-GUIDE.md**](SCHEMA-RETRIEVAL-GUIDE.md) - How to use retrieve_schema tool
- [**ERROR-RECOVERY-GUIDE.md**](ERROR-RECOVERY-GUIDE.md) - Fix common errors (10+ scenarios)

### **Pattern Reference:**

- [SCREEN-FLOW-PATTERNS.md](SCREEN-FLOW-PATTERNS.md) - Screen flow patterns & examples
- [RECORD-TRIGGER-FLOW-PATTERNS.md](RECORD-TRIGGER-FLOW-PATTERNS.md) - Record-triggered patterns & examples
- [DETAILED-WORKFLOW.md](DETAILED-WORKFLOW.md) - Granular 9-phase workflow (reference only)

### **Analysis & Validation:**

- [VALIDATION-SUMMARY.md](VALIDATION-SUMMARY.md) - Configuration assessment
- [ANALYSIS-AND-IMPROVEMENTS.md](ANALYSIS-AND-IMPROVEMENTS.md) - Detailed analysis
- [TEST-SAMPLE-FLOW.md](TEST-SAMPLE-FLOW.md) - Sample flow test results

---

## 🎯 **Quick Test**

**Ask AI:** "Create a record-triggered flow on Account that sends email when Annual Revenue > $1M"

**Expect:**

1. ✅ 5-stage todo created (collapsed)
2. ✅ Stage 1: Requirements Collection
    - Identifies Record-Triggered flow
    - Retrieves Account schema
    - Documents trigger conditions
3. ✅ Stage 2: Planning & Documentation
    - Creates temporary planning document
    - Maps complete flow logic
4. ✅ Stage 3: Implementation & Validation
    - Creates XML structure
    - Adds variables → PMD #1
    - Adds elements → PMD #2
    - Final validation → PMD #3
5. ✅ Stage 4: Deployment & Error Resolution
    - Deploy --checkonly
    - Fix any errors (iterative)
    - Deploy actual
    - Activate flow
6. ✅ Stage 5: Cleanup
    - Delete planning document
    - Verify flow is active

**Result:** Successfully deployed and activated flow! 🎉

---

**Quick Reference v2.0 | 2026-01-07**

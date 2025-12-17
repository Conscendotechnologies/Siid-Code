# Flow Builder - Quick Reference Card

## 🎯 **At a Glance**

### **10 Phases**

1. Planning & Schema Retrieval
2. Flow Structure Creation
3. Variables & Resources → **PMD #1**
4. Start Element Configuration
5. Flow Elements → **PMD #2**
6. Connectors & Flow Logic
7. Error Handling & Fault Paths
8. Pre-Deployment Validation → **PMD #3** + **17-Point Checklist**
9. Deployment (Dry-run → Deploy)
10. Documentation & Testing

### **3 PMD Checkpoints**

- **#1** Phase 3: UnusedVariable
- **#2** Phase 5: DML/SOQL in loops, fault paths, hardcoded IDs
- **#3** Phase 8: All 21+ rules

### **3 Priority 3 Features**

- **Progressive Disclosure:** Start with 10 phases, expand as you work
- **Validation Helper:** JSON-based systematic validation
- **Recovery Protocol:** 5-step error fixing guide

---

## ✅ **What to Expect**

### **When AI Starts Building:**

```xml
<update_todo_list>
<todos>
[ ] Phase 1: Planning & Schema Retrieval
[ ] Phase 2: Flow Structure Creation
[ ] Phase 3: Variables & Resources
[ ] Phase 4: Start Element Configuration
[ ] Phase 5: Flow Elements
[ ] Phase 6: Connectors & Flow Logic Validation
[ ] Phase 7: Error Handling & Fault Paths
[ ] Phase 8: Pre-Deployment Validation
[ ] Phase 9: Deployment
[ ] Phase 10: Documentation & Testing
</todos>
</update_todo_list>
```

### **When AI Works on a Phase:**

```xml
<update_todo_list>
<todos>
[x] Phase 1: Planning & Schema Retrieval (10/10 completed)
[-] Phase 2: Flow Structure Creation
  [ ] 2.1 - Create flow metadata file
  [ ] 2.2 - Add XML declaration
  ... (expanded sub-tasks)
[ ] Phase 3-10: (collapsed)
</todos>
</update_todo_list>
```

### **When AI Validates:**

```json
{
	"validationCheckpoint": "Element 1 Validation",
	"checks": [
		{ "rule": "ELEMENT_WELLFORMED", "status": "pass" },
		{ "rule": "UNIQUE_NAME", "status": "pass" },
		{ "rule": "SCHEMA_COMPLIANCE", "status": "pass" }
	],
	"overallStatus": "pass",
	"actionRequired": "proceed"
}
```

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
2. **IDENTIFY** - Root cause
3. **FIX** - Follow instructions
4. **RE-VALIDATE** - Confirm fix
5. **PROCEED** - Continue workflow

### **Common Fixes:**

**DML in Loop?**
→ Move DML outside, use Assignment inside to build collection

**SOQL in Loop?**
→ Move Get Records before loop, query all at once

**Missing Fault Path?**
→ Add faultConnector to DML/Action element

**Hardcoded ID?**
→ Use Custom Metadata, Custom Label, or Formula

**Duplicate Name?**
→ Rename element, update connectors

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

### **Full Guides:**

- [COMPLETE-PROJECT-SUMMARY.md](COMPLETE-PROJECT-SUMMARY.md) - Complete overview
- [ENHANCED-WORKFLOW-GUIDE.md](ENHANCED-WORKFLOW-GUIDE.md) - Detailed workflow
- [PRIORITY-3-IMPLEMENTATION.md](PRIORITY-3-IMPLEMENTATION.md) - P3 features

### **Reference:**

- [IMPLEMENTATION-SUMMARY.md](IMPLEMENTATION-SUMMARY.md) - P1 & P2 details
- [RETRIEVE_SCHEMA_TOOL.md](RETRIEVE_SCHEMA_TOOL.md) - Schema tool usage

### **Source:**

- [packages/types/src/instructions.js](../../packages/types/src/instructions.js:850-2100)

---

## 🎯 **Quick Test**

**Ask AI:** "Create a record-triggered flow on Account that sends email when Annual Revenue > $1M"

**Expect:**

1. ✅ 10-phase todo created
2. ✅ Phase 1 expands, completes
3. ✅ Phase 2 expands, creates structure
4. ✅ Phase 3 expands, adds variables, PMD #1
5. ✅ Phase 4 expands, configures trigger
6. ✅ Phase 5 expands elements one-by-one, PMD #2
7. ✅ Phase 6 validates connectors
8. ✅ Phase 7 validates fault paths
9. ✅ Phase 8 runs 17-point checklist + PMD #3
10. ✅ Phase 9 dry-run → deploy
11. ✅ Phase 10 documentation

**Result:** Successfully deployed flow with zero errors! 🎉

---

**Quick Reference v1.0 | 2025-12-16**

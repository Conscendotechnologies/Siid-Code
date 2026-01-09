# Salesforce Flow Builder - Documentation Index

## 🎯 Start Here

When a user asks to create or modify a Salesforce Flow, **use the HYBRID-WORKFLOW.md** as your primary guide.

### **Primary Workflow (RECOMMENDED)**

**[HYBRID-WORKFLOW.md](HYBRID-WORKFLOW.md)** - Streamlined 5-stage approach

- ✅ **Best for:** All flow types - optimal balance of simplicity and thoroughness
- ✅ **Structure:** 5 clear stages with smart expansion
- ✅ **Focus:** Planning first, then implementation, then deployment
- ✅ **Todo Management:** Concise tracking (6-8 visible tasks)
- ✅ **Validation:** 3 PMD checkpoints + deployment iteration

**Use this workflow by default for all flow creation requests.**

---

## 📚 Supporting Documentation

### Essential Guides

| Document                                                           | Purpose                                    | When to Use                          |
| ------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------ |
| [HYBRID-WORKFLOW.md](HYBRID-WORKFLOW.md)                           | **PRIMARY** - 5-stage streamlined workflow | Always start here                    |
| [SCHEMA-RETRIEVAL-GUIDE.md](SCHEMA-RETRIEVAL-GUIDE.md)             | How to retrieve and use Salesforce schemas | Stage 1 - Requirements               |
| [SCREEN-FLOW-PATTERNS.md](SCREEN-FLOW-PATTERNS.md)                 | Screen flow specific patterns and examples | When building Screen Flows           |
| [RECORD-TRIGGER-FLOW-PATTERNS.md](RECORD-TRIGGER-FLOW-PATTERNS.md) | Record-triggered flow patterns             | When building Record-Triggered Flows |
| [ERROR-RECOVERY-GUIDE.md](ERROR-RECOVERY-GUIDE.md)                 | How to fix common errors                   | Stage 4 - Deployment errors          |

### Reference Materials

| Document                                       | Purpose                                | When to Use                                             |
| ---------------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| [QUICK-REFERENCE.md](QUICK-REFERENCE.md)       | Quick lookup for concepts and patterns | When you need a quick reminder                          |
| [DETAILED-WORKFLOW.md](DETAILED-WORKFLOW.md)   | Granular 9-phase workflow (legacy)     | When you need very detailed element-by-element guidance |
| [VALIDATION-SUMMARY.md](VALIDATION-SUMMARY.md) | Validation rules and PMD checkpoints   | When validating flows                                   |
| [TEST-SAMPLE-FLOW.md](TEST-SAMPLE-FLOW.md)     | Example flow creation walkthrough      | Learning the process                                    |

---

## 🚀 Quick Start Guide

### For AI Agents: Building a Flow

**Step 1: Understand the Request**

- Read user requirements
- Identify flow type (Screen, Record-Triggered, Autolaunched, etc.)

**Step 2: Follow HYBRID-WORKFLOW.md**

```
Stage 1: Requirements Collection
  ├─ Identify flow type
  ├─ Retrieve ALL object schemas (NON-NEGOTIABLE)
  └─ Document requirements

Stage 2: Planning & Documentation
  ├─ Create temporary planning document
  ├─ Define variables, elements, connectors
  └─ Map complete flow logic

Stage 3: Implementation & Validation
  ├─ Build XML structure
  ├─ Add variables → PMD Checkpoint #1
  ├─ Add elements → PMD Checkpoint #2
  └─ Final validation

Stage 4: Deployment & Error Resolution
  ├─ Deploy --checkonly
  ├─ Fix errors (iterative)
  ├─ Deploy actual
  └─ Activate flow

Stage 5: Cleanup
  └─ Delete planning document
```

**Step 3: Reference Patterns as Needed**

- Screen Flows → [SCREEN-FLOW-PATTERNS.md](SCREEN-FLOW-PATTERNS.md)
- Record-Triggered → [RECORD-TRIGGER-FLOW-PATTERNS.md](RECORD-TRIGGER-FLOW-PATTERNS.md)
- Specific elements → [DETAILED-WORKFLOW.md](DETAILED-WORKFLOW.md) Phase 5

---

## 🔑 Key Principles

### Non-Negotiable Requirements

1. **Schema Retrieval First** (Stage 1)

    - ALWAYS retrieve object schemas before using fields
    - Use `retrieve_schema` tool for each object
    - Document available fields

2. **Planning Document** (Stage 2)

    - Create `.roo/flows/PLAN-[FlowName].md`
    - Map complete flow before writing XML
    - Delete after completion

3. **PMD Validation Checkpoints**

    - **Checkpoint #1:** After variables (UnusedVariable)
    - **Checkpoint #2:** After elements (DML/SOQL in loops, fault paths)
    - **Checkpoint #3:** Before deployment (all 21+ rules)

4. **Deployment Iteration** (Stage 4)
    - Deploy with --checkonly first
    - Fix errors one by one
    - Re-validate and retry until success
    - Only then do actual deployment

### Best Practices

- **Todo Management:** Keep 6-8 visible tasks maximum
- **Expand Smartly:** Only expand complexity when needed
- **Reference Patterns:** Use supporting docs for specific element types
- **Validate Early:** Catch errors at checkpoints, not at deployment
- **No DML in Loops:** Use bulk operations after loops

---

## 📖 Document Descriptions

### HYBRID-WORKFLOW.md ⭐

**The primary workflow document.** Streamlined 5-stage approach with smart expansion based on complexity. Uses temporary planning document. Has clear deployment iteration loop.

**Best for:** All flow types, all complexity levels

### DETAILED-WORKFLOW.md

**Legacy granular workflow.** 9-phase approach with 100+ sub-tasks. Very detailed element-by-element instructions. Good reference for specific element patterns.

**Best for:** When you need extremely detailed guidance on specific elements

### SCHEMA-RETRIEVAL-GUIDE.md

Step-by-step guide for retrieving Salesforce object schemas using the `retrieve_schema` tool. Critical for Stage 1.

### SCREEN-FLOW-PATTERNS.md

Complete patterns for Screen Flows including:

- Field types (InputField vs ComponentInstance)
- Field properties (storeOutputAutomatically, inputsOnNextNavToAssocScrn)
- Reference syntax (when to use `.value` suffix)
- Complete working examples

### RECORD-TRIGGER-FLOW-PATTERNS.md

Patterns for Record-Triggered Flows including:

- Trigger types (Before Save, After Save)
- Entry criteria and filters
- $Record references
- DML best practices

### ERROR-RECOVERY-GUIDE.md

Common errors and how to fix them:

- Deployment errors
- PMD violations
- Schema mismatches
- Connector errors

---

## 🎯 Workflow Selection

### When to Use HYBRID-WORKFLOW (99% of cases)

**All flow types:**

- ✅ Screen Flows
- ✅ Record-Triggered Flows
- ✅ Autolaunched Flows
- ✅ Scheduled Flows
- ✅ Platform Event-Triggered Flows

**All complexity levels:**

- ✅ Simple (2-3 elements)
- ✅ Medium (5-10 elements, some decisions)
- ✅ Complex (loops, bulk operations, multiple DML)

**Advantages:**

- Clear stages with natural progression
- Planning document ensures completeness
- Separate deployment stage for iterative fixes
- Concise todo tracking
- Smart expansion for complexity

### When to Reference DETAILED-WORKFLOW

**Specific scenarios only:**

- Need detailed element property explanations
- Want to see all possible element configurations
- Learning specific element patterns (Phase 5 sections)
- Troubleshooting specific element issues

**Note:** DETAILED-WORKFLOW is kept as reference material but HYBRID-WORKFLOW is the primary approach.

---

## 🛠️ Tools Required

The flow builder workflow assumes these tools are available:

1. **retrieve_schema** - Retrieve Salesforce object schemas
2. **PMD validation** - Validate flow XML against PMD rules
3. **Salesforce CLI** - Deploy flows to Salesforce org
4. **File operations** - Create/edit/read XML and markdown files

---

## 📝 Planning Document Template

Location: `.roo/flows/PLAN-[FlowName].md`

See [HYBRID-WORKFLOW.md Stage 2](HYBRID-WORKFLOW.md#-stage-2-planning--documentation) for complete template.

Key sections:

- Flow Metadata
- Objects & Schemas Retrieved
- Variables & Formulas
- Element Sequence (visual diagram)
- DML Operations & Fault Handlers
- Error Handling Strategy
- Validation Checkpoints

**Lifecycle:** Created in Stage 2, used throughout Stage 3, deleted in Stage 5

---

## 🔄 Workflow Evolution

**Current Version:** HYBRID-WORKFLOW v1.0 (January 2026)

**Previous Versions:**

- DETAILED-WORKFLOW - 9-phase granular approach (now reference material)

**Philosophy:**

- Start simple, expand when needed
- Plan before implementing
- Validate at checkpoints
- Iterate deployment until success

---

## 📞 Support

For questions or issues with flow builder workflow:

1. Check [ERROR-RECOVERY-GUIDE.md](ERROR-RECOVERY-GUIDE.md)
2. Reference specific pattern documents
3. Check [VALIDATION-SUMMARY.md](VALIDATION-SUMMARY.md) for PMD rules

---

**Last Updated:** 2026-01-07  
**Recommended Workflow:** HYBRID-WORKFLOW.md  
**Status:** ✅ Production Ready

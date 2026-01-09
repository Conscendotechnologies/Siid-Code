# Flow Builder Workflow - Migration Guide

## What Changed?

**Old Approach:** DETAILED-WORKFLOW.md (9-phase granular workflow with 100+ sub-tasks)  
**New Approach:** HYBRID-WORKFLOW.md (5-stage streamlined workflow with smart expansion)

**Status:** HYBRID-WORKFLOW is now the **PRIMARY** workflow. DETAILED-WORKFLOW remains as reference material.

---

## Key Improvements

### 1. **Simplified Structure**

**Before (9 phases):**

```
Phase 1: Planning & Schema Retrieval
Phase 2: Flow Structure Creation
Phase 3: Variables & Resources → PMD #1
Phase 4: Start Element Configuration
Phase 5: Flow Elements → PMD #2
Phase 6: Connectors & Flow Logic
Phase 7: Error Handling & Fault Paths
Phase 8: Pre-Deployment Validation → PMD #3
Phase 9: Deployment
```

**After (5 stages):**

```
Stage 1: Requirements Collection
Stage 2: Planning & Documentation
Stage 3: Implementation & Validation
Stage 4: Deployment & Error Resolution
Stage 5: Cleanup
```

### 2. **Planning Document**

**New Feature:** Stage 2 creates a temporary planning document (`.roo/flows/PLAN-[FlowName].md`) that:

- Maps complete flow logic before implementation
- Serves as single source of truth during implementation
- Gets deleted after completion

**Benefit:** Prevents reactive fixes by ensuring complete planning upfront.

### 3. **Separate Deployment Stage**

**Old:** Deployment was part of Phase 9  
**New:** Stage 4 is dedicated to iterative deployment with error resolution

**Benefit:** Clear separation between implementation and deployment. Makes error iteration explicit.

### 4. **Concise Todo Tracking**

**Old:** 100+ sub-tasks visible upfront  
**New:** 5 main stages, expand only when active or complexity requires

**Benefit:** Reduces cognitive load, cleaner progress tracking.

### 5. **Smart Expansion**

**Old:** All phases expand into detailed sub-tasks  
**New:** Stages expand based on:

- Current stage being worked on
- Flow complexity (simple vs complex)
- Number of errors during deployment

**Benefit:** Adapts to flow complexity automatically.

---

## What Stayed the Same

✅ **Schema Retrieval** - Still mandatory before using fields  
✅ **3 PMD Checkpoints** - Same validation points (after variables, after elements, before deployment)  
✅ **Element Patterns** - Same patterns for Screen Flows, Record-Triggered, etc.  
✅ **Error Recovery** - Same error fixing approaches  
✅ **Best Practices** - No DML in loops, fault connectors, etc.

---

## Migration for AI Agents

### If You're Currently Using DETAILED-WORKFLOW:

**Step 1: Switch to HYBRID-WORKFLOW**

- Primary reference: `HYBRID-WORKFLOW.md`
- Start page: `README.md`

**Step 2: Use DETAILED-WORKFLOW as Reference Only**

- For specific element patterns (Phase 5 sections)
- For detailed property explanations
- When troubleshooting specific element issues

**Step 3: Follow the New Todo Structure**

```json
[
	{ "id": 1, "title": "Stage 1: Requirements Collection", "status": "not-started" },
	{ "id": 2, "title": "Stage 2: Planning & Documentation", "status": "not-started" },
	{ "id": 3, "title": "Stage 3: Implementation & Validation", "status": "not-started" },
	{ "id": 4, "title": "Stage 4: Deployment & Error Resolution", "status": "not-started" },
	{ "id": 5, "title": "Stage 5: Cleanup", "status": "not-started" }
]
```

### Key Behavioral Changes

| Aspect             | Old Behavior                    | New Behavior                              |
| ------------------ | ------------------------------- | ----------------------------------------- |
| **Start**          | Show all 9 phases               | Show 5 stages (collapsed)                 |
| **Planning**       | Mental planning only            | Create planning document                  |
| **Implementation** | Expand phase by phase           | Expand only active stage                  |
| **Elements**       | Track each element individually | Group elements by type, expand if complex |
| **Deployment**     | Part of Phase 9                 | Separate Stage 4 with iteration tracking  |
| **Error Handling** | Fix and continue                | Explicit iteration with sub-task tracking |
| **Completion**     | Mark phase complete             | Delete planning doc + verify              |

---

## Comparison Table

| Feature                 | DETAILED-WORKFLOW            | HYBRID-WORKFLOW            |
| ----------------------- | ---------------------------- | -------------------------- |
| **Phases/Stages**       | 9 phases                     | 5 stages                   |
| **Initial Todos**       | 9 collapsed phases           | 5 collapsed stages         |
| **When Expanded**       | All eventually expand        | Only active stage expands  |
| **Planning**            | Mental/in-memory             | Written document           |
| **Sub-tasks**           | 100+ total                   | 20-30 total (expanded)     |
| **Deployment**          | Part of Phase 9              | Dedicated Stage 4          |
| **Error Iteration**     | Implicit                     | Explicit with tracking     |
| **Complexity Handling** | Same level of detail for all | Adapts based on complexity |
| **Planning Document**   | No                           | Yes (temporary)            |
| **Best For**            | Learning detailed patterns   | Production flow building   |

---

## When to Use Which Workflow

### Use HYBRID-WORKFLOW (99% of cases)

**Always use for:**

- ✅ Building new flows (any type)
- ✅ Any complexity level
- ✅ Production workflows
- ✅ When you need clean todo tracking

**Advantages:**

- Cleaner, more concise
- Planning document ensures completeness
- Explicit deployment iteration
- Adapts to complexity

### Reference DETAILED-WORKFLOW

**Use as reference for:**

- 📖 Specific element property explanations
- 📖 Understanding all element configuration options
- 📖 Learning detailed element patterns
- 📖 Troubleshooting specific element issues

**Sections to reference:**

- Phase 5 sections (element-by-element guides)
- Validation checkpoint formats
- Detailed element examples

---

## Example: Same Flow, Both Workflows

**Request:** "Create a screen flow to capture lead information"

### Old Approach (DETAILED-WORKFLOW)

```
[ ] Phase 1: Planning & Schema Retrieval
  [ ] 1.1 - Analyze requirements
  [ ] 1.2 - Identify flow type
  [ ] 1.3 - Identify trigger conditions
  [ ] 1.4 - List required objects
  [ ] 1.5 - Retrieve Lead schema
  [ ] 1.6 - List required variables
  ... (10+ sub-tasks)
[ ] Phase 2: Flow Structure Creation
  [ ] 2.1 - Create metadata file
  [ ] 2.2 - Add XML declaration
  ... (24+ sub-tasks)
... (7 more phases)
```

**Total initial view:** 9 phases, expands to 100+ tasks

### New Approach (HYBRID-WORKFLOW)

```
[ ] Stage 1: Requirements Collection
[ ] Stage 2: Planning & Documentation
[ ] Stage 3: Implementation & Validation
[ ] Stage 4: Deployment & Error Resolution
[ ] Stage 5: Cleanup
```

**When Stage 1 active:**

```
[>] Stage 1: Requirements Collection
  [ ] 1.1 - Analyze requirements & flow type
  [ ] 1.2 - Retrieve Lead object schema ⚠️ REQUIRED
  [ ] 1.3 - Identify trigger conditions
  [ ] 1.4 - List required elements
[ ] Stage 2: Planning & Documentation
...
```

**When Stage 2 active:**

```
[x] Stage 1: Requirements Collection
[>] Stage 2: Planning & Documentation
  [ ] 2.1 - Create planning document (.roo/flows/PLAN-LeadCapture.md)
  [ ] 2.2 - Define variables, formulas
  [ ] 2.3 - Map element sequence
  [ ] 2.4 - Define error handling
  [ ] 2.5 - Review plan completeness
[ ] Stage 3: Implementation & Validation
...
```

**Total view at any time:** 5 stages + 4-6 active sub-tasks = cleaner, more focused

---

## FAQs

### Q: Do I need to relearn everything?

**A:** No! The core concepts remain the same:

- Schema retrieval still required
- PMD checkpoints same
- Element patterns same
- Only the organization and tracking changed

### Q: What if I prefer the detailed workflow?

**A:** You can still reference DETAILED-WORKFLOW.md for:

- Element-specific details
- All configuration options
- Learning patterns

But use HYBRID-WORKFLOW.md for the overall process.

### Q: Will this work for complex flows?

**A:** Yes! The hybrid approach automatically expands for complexity:

- Simple flows: Stay concise (6 core sub-tasks)
- Complex flows: Expand Stage 3.4 into element types
- Many deployment errors: Expand Stage 4.3 to track each fix

### Q: What about the planning document?

**A:**

- Created in Stage 2: `.roo/flows/PLAN-[FlowName].md`
- Used throughout Stage 3 implementation
- Deleted automatically in Stage 5 cleanup
- Ensures complete planning before implementation

### Q: How does deployment iteration work?

**A:** Stage 4 makes iteration explicit:

1. Deploy --checkonly (dry run)
2. If errors → expand 4.3 to track fixes
3. Fix errors → re-validate → deploy again
4. Repeat until success
5. Deploy actual + activate

---

## Implementation Checklist

For AI integrating the new workflow:

- [x] ✅ README.md created (documentation index)
- [x] ✅ HYBRID-WORKFLOW.md created (primary workflow)
- [x] ✅ QUICK-REFERENCE.md updated (references hybrid)
- [x] ✅ Migration guide created (this document)
- [ ] ⚠️ Test with sample flow
- [ ] ⚠️ Verify planning document creation works
- [ ] ⚠️ Verify deployment iteration tracking
- [ ] ⚠️ Verify cleanup deletes planning doc

---

## Support

- **Primary Workflow:** [HYBRID-WORKFLOW.md](HYBRID-WORKFLOW.md)
- **Documentation Index:** [README.md](README.md)
- **Quick Reference:** [QUICK-REFERENCE.md](QUICK-REFERENCE.md)
- **Pattern Reference:** [DETAILED-WORKFLOW.md](DETAILED-WORKFLOW.md) Phase 5 sections
- **Error Recovery:** [ERROR-RECOVERY-GUIDE.md](ERROR-RECOVERY-GUIDE.md)

---

**Version:** 1.0  
**Migration Date:** 2026-01-07  
**Status:** ✅ Ready for Production

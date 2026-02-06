// ====================
// PLANNING INSTRUCTIONS
// ====================

export const PLANNING_INSTRUCTIONS = `
## Planning File Creation Protocol

**When to Create Planning Files:**
- For multi-phase tasks with dependencies between components
- When coordinating work across multiple modes (salesforce-agent, code)
- For complex scenarios requiring sequential execution

**Planning File Location:** \`.siid-code/planning/[descriptive-name]-plan.md\`

**IMPORTANT: Use MEANINGFUL names based on what the task does, NOT timestamps!**
- Good: \`invoice-object-trigger-plan.md\`, \`user-registration-flow-plan.md\`, \`case-automation-plan.md\`
- Bad: \`task-20260128-1030.md\`, \`task-1.md\`, \`plan.md\`

**Why meaningful names?**
- Easier for AI to find the correct planning file later
- Avoids confusion when multiple subtasks create planning files
- Self-documenting for future reference

**Note:** Planning files are automatically shown in environment_details and will be auto-deleted when the task completes via attempt_completion.

**Planning File Template:**
\`\`\`markdown
# Orchestration Task Plan
**Created:** [timestamp]
**Status:** 🔄 In Progress

---

## Original Request
"[Full user request here]"

---

## Request Analysis

**Components Identified:**
1. [Component 1] → [Which mode]
2. [Component 2] → [Which mode]
3. [Component 3] → [Which mode]

---

## Phase Plan

**Phase 1/N: [Description] ([mode-name])**
- **Deliverables:** [What will be created]
- **Dependencies:** [What must be done first]
- **Estimated complexity:** [Simple | Medium | Complex]

**Phase 2/N: [Description] ([mode-name])**
- **Deliverables:** [What will be created]
- **Dependencies:** [What must be done first]
- **Estimated complexity:** [Simple | Medium | Complex]

---

## Execution Log

**Phase 1: [Status]**
- Started: [timestamp]
- Completed: [timestamp]
- Files Created: [list]
- Notes: [any issues or important details]

**Phase 2: [Status]**
- Started: [timestamp]
- Completed: [timestamp]
- Files Created: [list]
- Notes: [any issues or important details]

---

## Final Summary
[Summary of all work completed, files created, and any remaining tasks]
\`\`\`

**Update Protocol:**
- Update the execution log section after EACH phase completion using write_to_file tool
- Mark phases as complete and note any issues
- Include final summary when all phases are done
`

// ====================
// PLANNING WORKFLOW STEPS
// ====================

export const PLANNING_WORKFLOW_STEPS = `
### Planning Workflow

1. **Create Planning File** at \`.siid-code/planning/[descriptive-name]-plan.md\`
   - Use meaningful names (e.g., \`invoice-trigger-plan.md\`)
   - Include: request, components, phases, execution log

2. **Create/Update Todo List** with phases:
   - [ ] pending, [-] in_progress, [x] completed
   - ONE task in_progress at a time

3. **Execute & Validate** each phase before proceeding
`

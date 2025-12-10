# Agent Todo Workflow Template

Use this template for every non-trivial task. Maintain it via the `update_todo_list` tool only. Keep steps small and update statuses as you progress.

Status legend: `[ ]` pending, `[-]` in_progress, `[x]` completed.

```
[ ] Capture task requirements
  - Write a concise task brief with explicit requirements, success criteria, constraints, and any implicit assumptions.
[ ] Locate relevant code areas
  - Identify packages, folders, and files impacted by the task (e.g., Siid-Code/packages/*, apps/*). List key symbols and configs.
[ ] Break task into subtasks
  - Create 3–8 actionable subtasks with inputs/outputs and acceptance checks for each. Keep steps small to avoid context loss.
[ ] Define assumptions & risks
  - Note 1–2 reasonable assumptions and any risks or unknowns. Ask targeted clarifying questions only if truly blocked.
[ ] Plan tool batches
  - For each subtask, outline which tools/commands will run and the expected outcome. Group independent read-only ops in parallel.
[ ] Execute first subtask
  - Start with the smallest, highest-value subtask. Run planned reads/edits, then update the todo status immediately.
[ ] Run build/lint/tests
  - After substantive changes, run project build, linters, and minimal tests. Record PASS/FAIL and fix issues before proceeding.
[ ] Iterate on errors
  - If failures occur, apply up to three targeted fixes. Record root cause and resolution. Stop and summarize if still failing.
[ ] Execute remaining subtasks
  - Proceed subtask by subtask, updating statuses and keeping batches small. Avoid repeating unchanged plans.
[ ] Finalize & summarize
  - Provide a completion summary: actions taken, files changed, validation results, and immediate next steps.
```

## Required usage

Before using any other tools, create or update the checklist via:

```
<update_todo_list>
<todos>
[ ] Capture task requirements
[ ] Locate relevant code areas
[ ] Break task into subtasks
[ ] Define assumptions & risks
[ ] Plan tool batches
[ ] Execute first subtask
[ ] Run build/lint/tests
[ ] Iterate on errors
[ ] Execute remaining subtasks
[ ] Finalize & summarize
</todos>
</update_todo_list>
```

Persist and restore the todo list via messages only; do not read or write files directly for todos.

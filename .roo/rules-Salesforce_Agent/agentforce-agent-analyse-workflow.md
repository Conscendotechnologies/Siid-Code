# Agentforce Agent Analyse And Enhance Workflow

**Purpose:** This workflow analyzes agent configuration, instructions, topics, and actions to identify quality issues and provide recommendations. Focus on **instruction quality and structure**, not basic metadata.

**CRITICAL EXECUTION RULES:**

1. **Execute the workflow completely** - don't stop after creating todo list
2. **Ask for missing info immediately** and continue once you have it
3. **Be proactive** - proceed through all steps without unnecessary pauses
4. **Focus on analysis** - this is analysis-only, get user confirmation before making changes

**What to analyze:**

- ✅ Instruction clarity, completeness, and correctness
- ✅ Topic structure and organization
- ✅ Action configuration and bindings
- ❌ NOT basic metadata (name, description counts, etc.)

**Important:** This is analysis-only. Present findings to user for confirmation before making changes.

## Before Starting: Create Task-Specific Todo List

**CRITICAL:** Before using any other tools, create a todo list specific to this agent analysis task:

```
[ ] Collect agent name
[ ] Retrieve agent files (GenAiPlannerBundle only for modification)
[ ] Review GenAiPlugin/GenAiFunction (read-only reference for existing global topics/actions)
[ ] Review agent configuration structure
[ ] Analyze instruction clarity and completeness
[ ] Check topic organization and scope
[ ] Review action configurations and bindings
[ ] Identify critical/high/medium/low issues
[ ] Document specific line numbers with issues
[ ] Generate detailed analysis report
[ ] Present findings to user
[ ] Wait for user confirmation on fixes
[ ] (If approved) Modify ONLY GenAiPlannerBundle file
[ ] (If approved) Deploy ONLY GenAiPlannerBundle
```

**Do NOT use generic template** - this is the actual sequence for agent analysis.

## Workflow Steps

### Step 1: Locate Agent Files

Collect from user (if not in prompt):

- Agent name or API name

**CRITICAL:**

- You MUST retrieve files from org. Do NOT try to list local files.
- Do NOT stop or wait unnecessarily - continue to next step as soon as you have the required information

### Step 2: Retrieve Agent Configuration

Run command to get agent components:

**Retrieve individual components:**

**Retrieve agent (required for modification):**

```bash
sf project retrieve start --metadata GenAiPlannerBundle
```

**Retrieve GenAiPlugin/GenAiFunction (optional, reference only):**

```bash
sf project retrieve start --metadata GenAiPlugin
sf project retrieve start --metadata GenAiFunction
```

**IMPORTANT:** GenAiPlugin and GenAiFunction are for reading/understanding existing global topics/actions only. **Do not modify or deploy these files** unless explicitly working with shared global resources.

### Step 3: Analyze and Understand Agent Files

**FOCUS ON QUALITY, NOT METADATA:**

- ❌ Don't report basic info: agent name, number of topics, simple descriptions
- ✅ Do analyze: instruction quality, structure correctness, issues in topics/actions

Review the following files:

- **GenAiPlannerBundle** - Main file to check and modify (local topics/actions)
- **GenAiPlugin** - Reference only (existing global topics - DO NOT MODIFY)
- **GenAiFunction** - Reference only (existing global actions - DO NOT MODIFY)
- **Agent Instructions** - Review custom instructions for clarity and completeness

**Note:** For detailed topic analysis (instructions, actions, schema), use **`agentforce-topic-analyse-workflow.md`**

### Step 4: Check for Issues

**Configuration Issues:**

- Missing required fields
- Incorrect agent type (customer vs internal)
- Invalid API names or references

**Instruction Issues:**

- Unclear or ambiguous instructions
- Missing context or examples
- Contradictory guidance
- Incomplete step-by-step procedures

**Topic Issues:**

- Overlapping topics
- Missing essential topics for the agent's role
- Topics too broad or too narrow
- Insufficient topic descriptions

**For detailed topic analysis:**

- Use **`.roo/rules-Salesforce_Agent/agentforce-topic-analyse-workflow.md`** workflow
- That workflow provides in-depth analysis of topic structure, instructions, actions, and integration
- Use it when user requests specific topic analysis or when issues are found in topics

**Action Issues:**

- Missing required actions
- Incorrect action parameters
- Broken action bindings
- Missing error handling

**General Issues:**

- Inconsistent naming conventions
- Missing documentation
- Security concerns
- Performance considerations

### Step 5: Generate Analysis Report

**IMPORTANT:** Focus on actionable findings, not basic metadata.

Summarize findings:

- List identified issues with severity (critical/high/medium/low)
- Provide specific line numbers or sections with issues
- Explain impact of each issue
- **Skip basic metadata** (agent name, topic count, simple descriptions)

**If topic-specific issues found:**

- Consider using **`agentforce-topic-analyse-workflow.md`** for deeper topic analysis
- That workflow provides detailed topic structure, instruction, and action analysis

### Step 6: Wait for User Confirmation

**After presenting the analysis report:**

1. **Ask user:** "Would you like me to implement any of these fixes?"
2. **Wait for explicit confirmation** before making changes
3. **If user approves changes:** Proceed to Step 7
4. **If user declines:** Analysis complete, no changes made

### Step 7: Enhance Agent Configuration (Only if approved by user)

Make improvements to:

- Fix identified issues (critical and high-priority first)
- Optimize instructions for clarity and effectiveness
- **Add or refine topics as LOCAL topics** (inside GenAiPlannerBundle)
- **Add new actions as LOCAL actions** (inside local topics)
- Improve action configurations and parameters
- Add missing documentation and descriptions
- Enhance error handling and validation

**Creating/Modifying Topics and Actions:**

**IMPORTANT:** When adding new topics/actions to an existing agent, ALWAYS create them as LOCAL (not global).

Refer to **`.roo/rules-Salesforce_Agent/agentforce-topics-actions-guide.md`** for:

- Local vs global topics/actions structure
- XML syntax and best practices
- Priority rule: Always prefer LOCAL over GLOBAL

**If adding new Apex actions:**

- **SALESFORCE AGENT MODE MUST NEVER WRITE APEX CODE**
- **Must delegate to Code mode** for any Apex action creation
- When creating subtask or switching to Code mode, specify: **"Follow the guide in .roo/rules-code/agentforce-apex-guide.md to create an invocable Apex action"**
- **Do NOT use apex-guide.md** - only agentforce-apex-guide.md is for invocable actions
- Wait for Code mode to complete and deploy the Apex class
- Update agent xml to reference the created Apex class

### Step 8: Deploy Enhanced Agent

Update the org with enhanced agent:

```bash
sf project deploy start --metadata GenAiPlannerBundle:Agent_Name
```

---

## Example

**User wants:** "Analyze and enhance my resort manager agent"

1. Get agent name (Resort_Manager)
2. Retrieve: `sf project retrieve start --metadata GenAiPlannerBundle:Resort_Manager`
3. Review files in `force-app/main/default/genAiPlannerBundles/`
4. Identify issues in configuration, instructions, topics, actions
5. Generate analysis report with findings
6. Ask user for confirmation
7. If approved, enhance GenAiPlannerBundle file (fix issues, improve instructions, optimize topics)
8. Deploy: `sf project deploy start --metadata GenAiPlannerBundle:Agent_Name`

---

## Example with Adding New Apex Action

**User wants:** "Analyze my customer support agent and add ability to create service cases"

**Steps 1-2:** Retrieve agent using `GenAiPlannerBundle:Customer_Support`,`GenAiPlugin`,`GenAiFunction`

**Steps 3-5:** Analyze agent and generate report

**Step 6:** User confirms they want to add case creation functionality

**Step 7:** Enhance agent with new Apex action

1. Identify requirement: Agent needs to create cases in Salesforce
2. **Delegate to Code mode:**
    - Create subtask or switch to Code mode
    - Instruction: **"Follow the guide in .roo/rules-code/agentforce-apex-guide.md to create an invocable Apex action 'CaseCreator' with a method to create service cases"**
    - Specify: "Method should accept case details and return the created case ID"
    - **Important:** Code mode must use agentforce-apex-guide.md, NOT apex-guide.md
3. Wait for Code mode to complete and deploy the Apex class
4. Update agent xml to reference the new Apex class:
   in local action.

**Step 8:** Deploy enhanced agent:

```bash
sf project deploy start --metadata GenAiPlannerBundle:Agent_Name
```

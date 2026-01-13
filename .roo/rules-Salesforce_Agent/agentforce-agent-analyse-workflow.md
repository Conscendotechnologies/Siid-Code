# Agentforce Agent Analyse And Enhance Workflow

## Workflow Steps

### Step 1: Locate Agent Files

Collect from user (if not in prompt):

- Agent name or API name
- Target org (to retrieve agent files)

### Step 2: Retrieve Agent Configuration

Run command to get agent components:

**Retrieve individual components:**

```bash
sf project retrieve start --metadata GenAiPlannerBundle --target-org <org>

sf project retrieve start --metadata GenAiPlugin --target-org <org>

sf project retrieve start --metadata GenAiFunction --target-org <org>
```

**Or retrieve all at once:**

```bash
sf project retrieve start --metadata GenAiPlannerBundle,GenAiPlugin,GenAiFunction --target-org <org>
```

### Step 3: Analyze and Understand Agent Files

Review the following files:

- **GenAiPlannerBundle** - Check agent configuration, topics, and overall structure
- **GenAiPlugin** - Review plugin configurations and action definitions
- **GenAiFunction** - Analyze function implementations and parameters
- **Agent Instructions** - Review custom instructions for clarity and completeness

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

Summarize findings:

- List identified issues with severity (critical/high/medium/low)
- Provide specific line numbers or sections with issues
- Explain impact of each issue

### Step 6: Enhance Agent Configuration

Make improvements to:

- Fix identified issues (critical and high-priority first)
- Optimize instructions for clarity and effectiveness
- Add or refine topics based on agent's role
- Improve action configurations and parameters
- Add missing documentation and descriptions
- Enhance error handling and validation

**If adding new Apex actions:**

- **SALESFORCE AGENT MODE MUST NEVER WRITE APEX CODE**
- **Must delegate to Code mode** for any Apex action creation
- When creating subtask or switching to Code mode, specify: **"Follow the guide in .roo/rules-code/agentforce-apex-guide.md to create an invocable Apex action"**
- **Do NOT use apex-guide.md** - only agentforce-apex-guide.md is for invocable actions
- Wait for Code mode to complete and deploy the Apex class
- Update GenAiPlugin/GenAiFunction to reference the created Apex class

### Step 7: Deploy Enhanced Agent

Update the org with enhanced agent:

```bash
sf project deploy start --metadata GenAiPlannerBundle,GenAiPlugin,GenAiFunction --target-org <org>
```

---

## Example

**User wants:** "Analyze and enhance my resort manager agent"

1. Get agent name and org
2. Retrieve: `sf project retrieve start --metadata GenAiPlannerBundle,GenAiPlugin,GenAiFunction --target-org my-org`
3. Review files in `force-app/main/default/`
4. Identify issues in configuration, instructions, topics, actions
5. Generate analysis report with findings
6. Enhance agent files (fix issues, improve instructions, optimize topics)
7. Deploy: `sf project deploy start --metadata GenAiPlannerBundle,GenAiPlugin,GenAiFunction --target-org my-org`

---

## Example with Adding New Apex Action

**User wants:** "Analyze my customer support agent and add ability to create service cases"

**Steps 1-4:** Retrieve and analyze agent

**Step 5:** Analysis finds agent lacks case creation functionality

**Step 6:** Enhance agent with new Apex action

1. Identify requirement: Agent needs to create cases in Salesforce
2. **Delegate to Code mode:**
    - Create subtask or switch to Code mode
    - Instruction: **"Follow the guide in .roo/rules-code/agentforce-apex-guide.md to create an invocable Apex action 'CaseCreator' with a method to create service cases"**
    - Specify: "Method should accept case details and return the created case ID"
    - **Important:** Code mode must use agentforce-apex-guide.md, NOT apex-guide.md
3. Wait for Code mode to complete and deploy the Apex class
4. Update GenAiFunction to reference the new Apex class:
    ```xml
    <apexClass>CaseCreator</apexClass>
    <method>createCase</method>
    ```
5. Update GenAiPlugin to link the function to relevant topic

**Step 7:** Deploy enhanced agent:

```bash
sf project deploy start --metadata GenAiPlannerBundle,GenAiPlugin,GenAiFunction --target-org my-org
```

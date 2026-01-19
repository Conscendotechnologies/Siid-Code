# Agentforce Agent Creation Workflow

**Important:** This workflow creates a **template agent** with basic structure. After creation, you must customize and enhance the agent according to specific requirements.

## Workflow Steps

### Step 1: Collect Information for Agent Spec

Collect the following from user (if not in prompt):

**Required:**

- Agent Role (description of what agent does)
- Agent Type (`customer` or `internal`)
- Company Name
- Company Description

**Optional:**

- Max Topics (default: 1)
- Output File Path (default: `specs/<agentName>.yaml`)

### Step 2: Generate Agent Specification

Note: no of topics can't be zero in this command, so if user fully custom agent, create 1 topics that we can remove later.

Run command:

```bash
sf agent generate agent-spec --max-topics <number> --output-file <path> --type <customer|internal> --role "<role>" --company-name "<name>" --company-description "<description>"
```

### Step 3: Collect Information for Agent Creation

Collect the following from user:

**Required:**

- Agent Name (display name)
- API Name (e.g., `Agent_Name`)
- Target Org (org alias or username)

### Step 4: Create Agent in Org

Run command:

```bash
sf agent create --name "<name>" --api-name <API_Name> --spec <path-to-spec> --target-org <org>
```

### Step 5: Customize Agent Files

**Note:** After creating the agent, GenAiPlannerBundle, GenAiPlugin, and GenAiFunction files are automatically generated in your project. Since we created the agent with max-topics=1 (minimum required), you MUST now customize it with your specific topics and actions.

**Required customization:**

- Review and update GenAiPlannerBundle (agent configuration)
- **Remove the AI-generated topic** (it was only created because max-topics can't be 0)
- **Add your custom topics as LOCAL topics** (inside GenAiPlannerBundle)
- **Add Apex actions as LOCAL actions** (inside local topics)
- **IMPORTANT:** When adding new topics/actions to an agent, ALWAYS create them as LOCAL (not global)
- **Only Apex actions are supported** for customization
- Maximum 1-2 actions per topic
- Update instructions to match specific use case

**Important - Apex Code Creation:**

- **SALESFORCE AGENT MODE MUST NEVER WRITE APEX CODE**
- **Must delegate to Code mode** for any Apex action creation
- When creating subtask or switching to Code mode, specify: **"Follow the guide in .roo/rules-code/agentforce-apex-guide.md to create an invocable Apex action"**
- **Do NOT use apex-guide.md** - only agentforce-apex-guide.md is for invocable actions
- Wait for subtask completion before linking the Apex action to the agent
- Update GenAiPlugin/GenAiFunction to reference the created Apex class

**Deploy customized agent:**

```bash
sf project deploy start --metadata GenAiPlannerBundle,GenAiPlugin,GenAiFunction --target-org <org>
```

---

## Example

**User wants:** "Create a resort manager agent"

1. Collect: role, type, company name, company description, agent name, org
2. Generate spec: `sf agent generate agent-spec --max-topics 1 --output-file specs/resortManagerAgent.yaml --type customer --role "Field customer complaints and manage employee schedules." --company-name "Coral Cloud Resorts" --company-description "Provide customers with exceptional destination activities, unforgettable experiences, and reservation services."`
3. Create agent: `sf agent create --name "Resort Manager" --api-name Resort_Manager --spec specs/resortManagerAgent.yaml --target-org my-org`
4. Remove the auto-generated topic and add custom topics with Apex actions
5. Deploy: `sf project deploy start --metadata GenAiPlannerBundle,GenAiPlugin,GenAiFunction --target-org my-org`

---

## Example with Apex Action

**User wants:** "Create an inventory management agent that can check stock levels"

**Step 1-3:** Create basic agent (same as above)

**Step 4:** User needs custom Apex action to check inventory

1. Identify requirement: Agent needs to query real-time stock levels from Inventory\_\_c object
2. **Delegate to Code mode:**
    - Create subtask or switch to Code mode
    - Instruction: **"Follow the guide in .roo/rules-code/agentforce-apex-guide.md to create an invocable Apex action 'InventoryChecker' with a method to check stock levels for a product ID"**
    - Specify: "Method should query Inventory\_\_c and return current stock count"
    - **Important:** Code mode must use agentforce-apex-guide.md, NOT apex-guide.md
3. Wait for Code mode to complete the Apex class creation and deployment
4. After Apex is deployed, update GenAiFunction to reference:
    ```xml
    <apexClass>InventoryChecker</apexClass>
    <method>checkStockLevel</method>
    ```
5. Update GenAiPlugin to link the function to relevant topic

**Step 5:** Deploy customized agent:

```bash
sf project deploy start --metadata GenAiPlannerBundle,GenAiPlugin,GenAiFunction --target-org my-org
```

**Key Points:**

- **Salesforce Agent mode NEVER writes Apex code** - it only configures agent files
- **Must delegate to Code mode** with specific instruction to use .roo/rules-code/agentforce-apex-guide.md
- Code mode follows agentforce-apex-guide.md to create invocable Apex actions
- After Apex is ready and deployed, Salesforce Agent mode configures the agent to use it
- Only then deploys the complete agent configuration

---

## Creating Topics and Actions

When customizing agents with topics and actions, refer to:
**`.roo/rules-Salesforce_Agent/agentforce-topics-actions-guide.md`**

This guide provides:

- Detailed XML structure for local and global topics/actions
- Best practices and naming conventions
- Priority rule: Always prefer LOCAL over GLOBAL
- Examples and deployment instructions

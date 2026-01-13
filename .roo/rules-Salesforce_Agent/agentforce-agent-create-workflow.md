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

- Max Topics (default: 5)
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

### Step 5: Customize Agent Files (Optional)

**Note:** After creating the agent, GenAiPlannerBundle, GenAiPlugin, and GenAiFunction files are automatically generated in your project.

**If customization is needed:**

- Review and update GenAiPlannerBundle (agent configuration)
- Remove AI-generated topics if not needed
- Add custom topics and Apex actions based on user requirements
- **Only Apex actions are supported** for customization
- Maximum 1-2 actions per topic
- Update instructions to match specific use case

**Important - Apex Code Creation:**

- **Do NOT write Apex code yourself**
- Create a subtask for Code mode to handle Apex class creation
- Wait for subtask completion before linking the Apex action to the agent
- Update GenAiPlugin/GenAiFunction to reference the created Apex class

**Deploy only if files were modified:**

```bash
sf project deploy start --metadata GenAiPlannerBundle,GenAiPlugin,GenAiFunction --target-org <org>
```

---

## Example

**User wants:** "Create a resort manager agent"

1. Collect: role, type, company name, company description, agent name, org
2. Generate spec: `sf agent generate agent-spec --max-topics 5 --output-file specs/resortManagerAgent.yaml --type customer --role "Field customer complaints and manage employee schedules." --company-name "Coral Cloud Resorts" --company-description "Provide customers with exceptional destination activities, unforgettable experiences, and reservation services."`
3. Create agent: `sf agent create --name "Resort Manager" --api-name Resort_Manager --spec specs/resortManagerAgent.yaml --target-org my-org`
4. (Optional) Customize generated agent files - add Apex actions if needed
5. (Optional) Deploy only if customized: `sf project deploy start --metadata GenAiPlannerBundle,GenAiPlugin,GenAiFunction --target-org my-org`

---

## Example with Apex Action

**User wants:** "Create an inventory management agent that can check stock levels"

**Step 1-3:** Create basic agent (same as above)

**Step 4:** User needs custom Apex action to check inventory

1. Identify requirement: Agent needs to query real-time stock levels from Inventory\_\_c object
2. **Create subtask for Code mode:**
    - "Create an Apex class 'InventoryChecker' with a method to check stock levels for a product ID"
    - "Method should query Inventory\_\_c and return current stock count"
3. Wait for Code mode to complete the Apex class creation
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

- Salesforce Agent mode identifies need for Apex
- Creates subtask for Code mode to write the Apex class
- After Apex is ready, Salesforce Agent mode configures the agent to use it
- Only then deploys the complete agent configuration

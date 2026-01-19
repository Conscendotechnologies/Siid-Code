# Agentforce Agent Creation Workflow

**Important:** This workflow creates a **template agent** with basic structure. After creation, you must customize and enhance the agent according to specific requirements.

## Before Starting: Create Task-Specific Todo List

**CRITICAL:** Before using any other tools, create a todo list specific to this agent creation task:

```
[ ] Collect agent requirements (role, type, company, org)
[ ] Generate agent specification YAML
[ ] Create agent in Salesforce org
[ ] Retrieve created agent files (GenAiPlannerBundle)
[ ] Review auto-generated structure
[ ] Remove AI-generated placeholder topic
[ ] Create custom local topic with clear instructions
[ ] Delegate Apex action creation to Code mode (if needed)
[ ] Create local action in topic with invocationTarget
[ ] Create schema files (input/output) for action
[ ] Link action to topic with localActionLinks
[ ] Link topic to agent with localTopicLinks
[ ] Deploy customized agent to org
[ ] Test agent functionality
```

**Do NOT use generic template** - this is the actual sequence for agent creation.

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

**Note:** After creating the agent, GenAiPlannerBundle files are automatically generated in your project. Since we created the agent with max-topics=1 (minimum required), you MUST now customize it with your specific topics and actions.

**CRITICAL - CREATE ONLY LOCAL TOPICS AND ACTIONS:**

- ✅ **DO:** Create topics in `<localTopics>` section of GenAiPlannerBundle
- ✅ **DO:** Create actions in `<localActions>` section within local topics
- ✅ **DO:** Link topics with `<localTopicLinks>` in GenAiPlannerBundle
- ✅ **DO:** Link actions with `<localActionLinks>` within local topics
- ❌ **DON'T:** Create new GenAiPlugin files (those are for global topics)
- ❌ **DON'T:** Create new GenAiFunction files (those are for global actions)
- ❌ **DON'T:** Modify auto-generated GenAiPlugin/GenAiFunction files

**Required customization:**

- Review and update GenAiPlannerBundle (agent configuration)
- **Remove the AI-generated topic** (it was only created because max-topics can't be 0)
- **Add your custom topics as LOCAL topics** (inside GenAiPlannerBundle `<localTopics>` section)
- **Add Apex actions as LOCAL actions** (inside `<localActions>` section of local topics)
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
- **After Apex is deployed:** Update the LOCAL action in GenAiPlannerBundle to reference the Apex class (NOT GenAiPlugin/GenAiFunction files)

**Deploy customized agent:**

```bash
sf project deploy start --metadata GenAiPlannerBundle --target-org <org>
```

---

## Example

**User wants:** "Create a resort manager agent"

1. Collect: role, type, company name, company description, agent name, org
2. Generate spec: `sf agent generate agent-spec --max-topics 1 --output-file specs/resortManagerAgent.yaml --type customer --role "Field customer complaints and manage employee schedules." --company-name "Coral Cloud Resorts" --company-description "Provide customers with exceptional destination activities, unforgettable experiences, and reservation services."`
3. Create agent: `sf agent create --name "Resort Manager" --api-name Resort_Manager --spec specs/resortManagerAgent.yaml --target-org my-org`
4. Remove the auto-generated topic and add custom topics with Apex actions
5. Deploy: `sf project deploy start --metadata GenAiPlannerBundle --target-org my-org`

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
4. After Apex is deployed, add LOCAL action in GenAiPlannerBundle:
    ```xml
    <localActions>
        <fullName>Check_Stock_Level_123</fullName>
        <description>Check inventory stock level for a product</description>
        <developerName>Check_Stock_Level_123</developerName>
        <invocationTarget>InventoryChecker</invocationTarget>
        <invocationTargetType>apex</invocationTargetType>
        <isConfirmationRequired>false</isConfirmationRequired>
        <isIncludeInProgressIndicator>false</isIncludeInProgressIndicator>
        <localDeveloperName>Check_Stock_Level</localDeveloperName>
        <masterLabel>Check Stock Level</masterLabel>
    </localActions>
    ```
5. Link the action to local topic:
    ```xml
    <localActionLinks>
        <functionName>Check_Stock_Level_123</functionName>
    </localActionLinks>
    ```

**Step 5:** Deploy customized agent:

```bash
sf project deploy start --metadata GenAiPlannerBundle --target-org my-org
```

**Key Points:**

- **Salesforce Agent mode NEVER writes Apex code** - it only configures agent files
- **Must delegate to Code mode** with specific instruction to use .roo/rules-code/agentforce-apex-guide.md
- Code mode follows agentforce-apex-guide.md to create invocable Apex actions
- After Apex is ready and deployed, Salesforce Agent mode configures the agent to use it
- Only then deploys the complete agent configuration

---

## Complete Example: Adding Local Topic with Action

Here's the EXACT structure to create a local topic with action in GenAiPlannerBundle:

**Step 1: Add Local Topic in GenAiPlannerBundle XML:**

```xml
<GenAiPlanner xmlns="http://soap.sforce.com/2006/04/metadata">
    <masterLabel>Your Agent Name</masterLabel>
    <!-- ... other agent config ... -->

    <!-- ADD LOCAL TOPIC HERE -->
    <localTopics>
        <fullName>Case_Creation_Topic_001</fullName>
        <canEscalate>false</canEscalate>
        <description>Handles creation of support cases</description>
        <developerName>Case_Creation_Topic_001</developerName>
        <genAiPluginInstructions>
            <description>When user wants to create a support case, identify the issue clearly. Collect required information like subject and description. Call the CreateCase action to create the case. Confirm successful case creation to the user.</description>
            <developerName>instructions_0</developerName>
            <language>en_US</language>
            <masterLabel>instructions_0</masterLabel>
            <sortOrder>0</sortOrder>
        </genAiPluginInstructions>
        <language>en_US</language>

        <!-- LINK ACTION TO TOPIC -->
        <localActionLinks>
            <functionName>Create_Support_Case_001</functionName>
        </localActionLinks>

        <!-- DEFINE LOCAL ACTION -->
        <localActions>
            <fullName>Create_Support_Case_001</fullName>
            <description>Creates a support case with given subject and description</description>
            <developerName>Create_Support_Case_001</developerName>
            <invocationTarget>CaseSupportHandler</invocationTarget>
            <invocationTargetType>apex</invocationTargetType>
            <isConfirmationRequired>false</isConfirmationRequired>
            <isIncludeInProgressIndicator>false</isIncludeInProgressIndicator>
            <localDeveloperName>Create_Support_Case</localDeveloperName>
            <masterLabel>Create Support Case</masterLabel>
        </localActions>

        <localDeveloperName>Case_Creation_Topic</localDeveloperName>
        <masterLabel>Case Creation</masterLabel>
        <pluginType>Topic</pluginType>
        <scope>Create and manage support cases for users</scope>
    </localTopics>

    <!-- LINK TOPIC TO AGENT -->
    <localTopicLinks>
        <genAiPluginName>Case_Creation_Topic_001</genAiPluginName>
    </localTopicLinks>
</GenAiPlanner>
```

**Step 2: Create Schema Files:**

Create folder structure:

```
force-app/main/default/genAiPlannerBundles/Your_Agent_Name/
  localActions/
    Create_Support_topic_<TopicId>/Create_Support_Case_<ActionId>
      input/
        schema
      output/
        schema
```

Note:
TopicId: 16jKZ0000000(prefix)+(3char capital later)
ActionId: 179KZ0000000(prefix)+(3char capital later)

**File: `input/schema`** (no extension):

```json
{
	"required": ["subject", "description"],
	"unevaluatedProperties": false,
	"properties": {
		"subject": {
			"title": "Case Subject",
			"description": "Brief summary of the issue",
			"lightning:type": "lightning_textType",
			"lightning:isPII": false,
			"copilotAction:isUserInput": true
		},
		"description": {
			"title": "Case Description",
			"description": "Detailed description of the issue",
			"lightning:type": "lightning_textType",
			"lightning:isPII": false,
			"copilotAction:isUserInput": true
		}
	},
	"lightning:type": "lightning_objectType"
}
```

**File: `output/schema`** (no extension):

```json
{
	"unevaluatedProperties": false,
	"properties": {
		"caseId": {
			"title": "Case ID",
			"description": "ID of the created case",
			"lightning:type": "lightning_textType"
		},
		"caseNumber": {
			"title": "Case Number",
			"description": "Case number for reference",
			"lightning:type": "lightning_textType"
		}
	},
	"lightning:type": "lightning_objectType"
}
```

---

## Creating Topics and Actions

When customizing agents with topics and actions, refer to:
**`.roo/rules-Salesforce_Agent/agentforce-topics-actions-guide.md`**

This guide provides:

- Detailed XML structure for local topics/actions
- Best practices and naming conventions
- Priority rule: Always prefer LOCAL over GLOBAL
- Examples and deployment instructions

# Agentforce Agent Creation Workflow

**Important:** This workflow creates a **template agent** with basic structure. After creation, you must customize and enhance the agent according to specific requirements.

## Before Starting: Create Task-Specific Todo List

**CRITICAL:** Before using any other tools, create a todo list specific to this agent creation task:

```
[ ] Collect agent requirements (role, type, company, org)
[ ] Generate agent specification YAML
[ ] Create agent in Salesforce org (automatically retrieves GenAiPlannerBundle)
[ ] Review auto-generated structure in local project
[ ] Remove AI-generated placeholder topic
[ ] Create custom local topic with clear instructions (WITHOUT actions yet)
[ ] Delegate Apex action creation to Code mode (if needed)
[ ] WAIT for Code mode to create AND deploy Apex (verify deployment, do NOT retrieve)
[ ] AFTER Apex deployed: Create local action in topic with invocationTarget
[ ] Create schema files (input/output) for action - VERIFY ALL REQUIRED PROPERTIES
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

### Step 4: Create Agent in Org

Run command:

```bash
sf agent create --name "<name>" --api-name <API_Name> --spec <path-to-spec>
```

**⚠️ IMPORTANT:** This command automatically:

1. Creates the agent in the Salesforce org
2. **Retrieves the GenAiPlannerBundle files to your local project** (NO separate retrieve step needed!)
3. Downloads all auto-generated files (GenAiPlannerBundle, GenAiPlugin, GenAiFunction)

After this command completes, check your `force-app/main/default/genAiPlannerBundles/` folder - the agent files are already there.

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

**⚠️ CRITICAL: Determine if Adaptive Response is Needed**

Before delegating to Code mode, analyze if Adaptive Response should be used:

**Detection Criteria - Adaptive Response is applicable when:**

- Action returns a **list of items** (products, recommendations, cases, options)
- Data includes **rich content** (images, descriptions, multiple fields)
- Use case involves **browsing, comparing, or selecting** from options
- Visual presentation would enhance user experience

**When Detected - ALWAYS Ask Developer:**

```
I've analyzed your requirements. This action can be implemented in two ways:

1. **Adaptive Response** (Recommended)
   - Visual cards with images and rich UI
   - Interactive browsing experience
   - Better for displaying multiple options

2. **Plain Text Response**
   - Simple text-based output
   - Straightforward implementation

Which approach would you prefer?
```

**After Developer Decides:**

When creating subtask for Code mode, include the decision:

- Add property: `useAdaptiveResponse: true` (if developer chose Adaptive Response)
- Add property: `useAdaptiveResponse: false` (if developer chose Plain Text)
- Specify guides for Adaptive Response: **"Follow .roo/rules-Salesforce_Agent/agentforce-topics-actions-guide.md (base), .roo/rules-code/agentforce-apex-guide.md, AND .roo/rules-code/ADAPTIVE_RESPONSE_AGENT_INSTRUCTIONS.md (adaptive-specific)"**
- Specify guides for Plain Text: **"Follow .roo/rules-Salesforce_Agent/agentforce-topics-actions-guide.md (base) and .roo/rules-code/agentforce-apex-guide.md"**

**CRITICAL:** The base guide (agentforce-topics-actions-guide.md) is ALWAYS required - it contains schema structure, naming conventions, permissions. The adaptive guide only adds wrapper class field names.

**⚠️ CRITICAL EXECUTION ORDER:**

1. **FIRST:** Delegate to Code mode to create Apex action (with `useAdaptiveResponse` property)
2. **SECOND:** Wait for Code mode to complete AND deploy the Apex class
3. **THIRD:** **VERIFY deployment success** (do NOT retrieve - just check `sf project deploy report`)
4. **FOURTH:** ONLY AFTER Apex is deployed and verified, add the local action XML that references it
5. **FIFTH:** Deploy the GenAiPlannerBundle with the action reference

**DO NOT add `<localActions>` XML before Apex exists and is deployed!**

**⚠️ VERIFICATION vs RETRIEVAL:**

- ✅ **VERIFY:** Use `sf project deploy report --job-id <id>` to confirm deployment succeeded
- ❌ **DON'T RETRIEVE:** Do NOT run `sf project retrieve` after deploying - just verify status

- **SALESFORCE AGENT MODE MUST NEVER WRITE APEX CODE**
- **Must delegate to Code mode** for any Apex action creation
- When creating subtask or switching to Code mode, specify: **"Follow the guide in .roo/rules-code/agentforce-apex-guide.md to create an invocable Apex action"**
- **If Adaptive Response:** Also specify: **"Check useAdaptiveResponse property and follow .roo/rules-code/ADAPTIVE_RESPONSE_AGENT_INSTRUCTIONS.md"**
- **Do NOT use apex-guide.md** - only agentforce-apex-guide.md is for invocable actions
- **WAIT for Code mode to finish creating AND deploying the Apex class**
- **After Apex is deployed:** THEN update the LOCAL action in GenAiPlannerBundle to reference the Apex class
- **DO NOT create GenAiPlugin/GenAiFunction files** - only update GenAiPlannerBundle

**Deploy customized agent:**

```bash
sf project deploy start --metadata GenAiPlannerBundle:Agent_Name
```

---

## Example

**User wants:** "Create a resort manager agent"

1. Collect: role, type, company name, company description, agent name, org
2. Generate spec: `sf agent generate agent-spec --max-topics 1 --output-file specs/resortManagerAgent.yaml --type customer --role "Field customer complaints and manage employee schedules." --company-name "Coral Cloud Resorts" --company-description "Provide customers with exceptional destination activities, unforgettable experiences, and reservation services."`
3. Create agent: `sf agent create --name "Resort Manager" --api-name Resort_Manager --spec specs/resortManagerAgent.yaml`
4. Remove the auto-generated topic and add custom topics with Apex actions
5. Deploy: `sf project deploy start --metadata GenAiPlannerBundle:Agent_Name`

---

## Example with Apex Action (Plain Text)

**User wants:** "Create an inventory management agent that can check stock levels"

**Step 1-3:** Create basic agent (same as above)

**Step 4:** Analyze and ask about Adaptive Response

**Analysis:** This action returns a simple stock count (number), not a list of items with images.
**Decision:** Plain text is appropriate (no need to ask developer - clearly not adaptive response scenario)

**Step 5:** User needs custom Apex action to check inventory

**CORRECT SEQUENCE:**

1. Identify requirement: Agent needs to query real-time stock levels from Inventory\_\_c object
2. **FIRST - Delegate to Code mode to CREATE Apex:**
    - Create subtask or switch to Code mode
    - Add property: `useAdaptiveResponse: false`
    - Instruction: **"Follow the guide in .roo/rules-code/agentforce-apex-guide.md to create an invocable Apex action 'InventoryChecker' with a method to check stock levels for a product ID"**
    - Specify: "Method should query Inventory\_\_c and return current stock count"
    - **Important:** Code mode must use agentforce-apex-guide.md, NOT apex-guide.md
3. **WAIT for Code mode to complete the Apex class creation AND deployment**
4. **AFTER Apex is deployed - Add LOCAL action reference in GenAiPlannerBundle:**
    ```xml
    <localActions>
        <fullName>Check_Stock_Level</fullName>
        <description>Check inventory stock level for a product</description>
        <developerName>Check_Stock_Level</developerName>
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
        <functionName>Check_Stock_Level</functionName>
    </localActionLinks>
    ```

**Step 5:** Deploy customized agent:

```bash
sf project deploy start --metadata GenAiPlannerBundle:Agent_Name
```

**Key Points:**

- **Salesforce Agent mode NEVER writes Apex code** - it only configures agent files
- **Must delegate to Code mode** with specific instruction to use .roo/rules-code/agentforce-apex-guide.md
- Code mode follows agentforce-apex-guide.md to create invocable Apex actions
- After Apex is ready and deployed, Salesforce Agent mode configures the agent to use it
- Only then deploys the complete agent configuration

---

## Example with Adaptive Response

**User wants:** "Create a product recommendation agent that shows products with images"

**Step 1-3:** Create basic agent (same as above)

**Step 4:** Analyze and ask about Adaptive Response

**Analysis:**

- Action returns a **list of products**
- Data includes **images, names, descriptions** (rich content)
- Use case: **browsing and selecting** products
- **✅ Adaptive Response is applicable**

**Ask Developer:**

```
I've analyzed your requirements. This action can be implemented in two ways:

1. **Adaptive Response** (Recommended)
   - Visual cards with product images and descriptions
   - Interactive browsing experience
   - Better for displaying multiple product options

2. **Plain Text Response**
   - Simple text list of product names
   - Straightforward implementation

Which approach would you prefer?
```

**Developer chooses:** "Adaptive Response"

**Step 5:** Delegate to Code mode with Adaptive Response flag

**CORRECT SEQUENCE:**

1. **FIRST - Delegate to Code mode to CREATE Apex:**
    - Create subtask or switch to Code mode
    - **Add property:** `useAdaptiveResponse: true`
    - Instruction: **"Follow .roo/rules-Salesforce_Agent/agentforce-topics-actions-guide.md (base guide for schema structure), .roo/rules-code/agentforce-apex-guide.md (Apex patterns), and .roo/rules-code/ADAPTIVE_RESPONSE_AGENT_INSTRUCTIONS.md (exact field names) to create an invocable Apex action 'ProductRecommendationAction'"**
    - Specify: "Method should query Product2 records and return as visual cards"
    - Specify: "Use base guide for schema structure, adaptive guide for exact wrapper class field names (name, imageUrl, mimeType, description)"
2. **WAIT for Code mode to complete the Apex class creation AND deployment**
3. **AFTER Apex is deployed - Add LOCAL action reference in GenAiPlannerBundle:**
    ```xml
    <localActions>
        <fullName>Get_Product_Recommendations</fullName>
        <description>Get product recommendations with images</description>
        <developerName>Get_Product_Recommendations</developerName>
        <invocationTarget>ProductRecommendationAction</invocationTarget>
        <invocationTargetType>apex</invocationTargetType>
        <isConfirmationRequired>false</isConfirmationRequired>
        <isIncludeInProgressIndicator>false</isIncludeInProgressIndicator>
        <localDeveloperName>Get_Product_Recommendations</localDeveloperName>
        <masterLabel>Get Product Recommendations</masterLabel>
    </localActions>
    ```
4. **Create schema files** (input/output) with `lightning__listType`:
    - See `.roo/rules-Salesforce_Agent/agentforce-topics-actions-guide.md` for schema structure
    - Use `lightning__listType` for products output
    - Add `maxItems: 2000` and `items` with Apex class reference

**Step 6:** Deploy customized agent:

```bash
sf project deploy start --metadata GenAiPlannerBundle:Agent_Name
```

**Key Differences for Adaptive Response:**

- ✅ Set `useAdaptiveResponse: true` property
- ✅ Include both agentforce-apex-guide.md AND ADAPTIVE_RESPONSE_AGENT_INSTRUCTIONS.md
- ✅ Code mode uses EXACT field names: `name`, `imageUrl`, `mimeType`, `description`
- ✅ Schema uses `lightning__listType` with Apex class reference
- ✅ Specify LIMIT 5 for Chat channel (or LIMIT 10 for Facebook)

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
        <fullName>Case_Creation_Topic</fullName>
        <canEscalate>false</canEscalate>
        <description>Handles creation of support cases</description>
        <developerName>Case_Creation_Topic</developerName>
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
            <functionName>Create_Support_Case</functionName>
        </localActionLinks>

        <!-- DEFINE LOCAL ACTION -->
        <localActions>
            <fullName>Create_Support_Case</fullName>
            <description>Creates a support case with given subject and description</description>
            <developerName>Create_Support_Case</developerName>
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
        <genAiPluginName>Case_Creation_Topic</genAiPluginName>
    </localTopicLinks>
</GenAiPlanner>
```

**Step 2: Create Schema Files:**

Create folder structure:

```
force-app/main/default/genAiPlannerBundles/Your_Agent_Name/
  localActions/
    Case_Creation_Topic/Create_Support_Case/
      input/
        schema
      output/
        schema
```

**CRITICAL - Naming Consistency:**

**For Topics**, these fields MUST use the EXACT same name (e.g., `Case_Creation_Topic`):

- `<fullName>Case_Creation_Topic</fullName>`
- `<developerName>Case_Creation_Topic</developerName>`
- `<localDeveloperName>Case_Creation_Topic</localDeveloperName>`
- `<localTopicLinks><genAiPluginName>Case_Creation_Topic</genAiPluginName></localTopicLinks>`
- Folder path: `localActions/Case_Creation_Topic/`

**For Actions**, these fields MUST use the EXACT same name (e.g., `Create_Support_Case`):

- `<fullName>Create_Support_Case</fullName>`
- `<developerName>Create_Support_Case</developerName>`
- `<localDeveloperName>Create_Support_Case</localDeveloperName>`
- `<localActionLinks><functionName>Create_Support_Case</functionName></localActionLinks>`
- Folder path: `localActions/Case_Creation_Topic/Create_Support_Case/`

**Exception:** `<masterLabel>` can have spaces for display (e.g., `Case Creation`, `Create Support Case`)

**Format:** Use underscores to separate words in names (e.g., `Case_Creation_Topic`, `Create_Support_Case`)

**File: `input/schema.json`**:

```json
{
	"required": ["subject", "description"],
	"unevaluatedProperties": false,
	"properties": {
		"subject": {
			"title": "Case Subject",
			"description": "Brief summary of the issue",
			"lightning:type": "lightning__textType",
			"lightning:isPII": false,
			"copilotAction:isUserInput": true
		},
		"description": {
			"title": "Case Description",
			"description": "Detailed description of the issue",
			"lightning:type": "lightning__textType",
			"lightning:isPII": false,
			"copilotAction:isUserInput": true
		}
	},
	"lightning:type": "lightning__objectType"
}
```

**File: `output/schema.json`**:

⚠️ **CRITICAL: Every output property MUST have ALL required fields!**

```json
{
	"unevaluatedProperties": false,
	"properties": {
		"caseId": {
			"title": "Case ID",
			"description": "ID of the created case",
			"lightning:type": "lightning__textType",
			"lightning:isPII": false,
			"copilotAction:isDisplayable": true,
			"copilotAction:isUsedByPlanner": true,
			"copilotAction:useHydratedPrompt": false
		},
		"caseNumber": {
			"title": "Case Number",
			"description": "Case number for reference",
			"lightning:type": "lightning__textType",
			"lightning:isPII": false,
			"copilotAction:isDisplayable": true,
			"copilotAction:isUsedByPlanner": true,
			"copilotAction:useHydratedPrompt": false
		}
	},
	"lightning:type": "lightning__objectType"
}
```

**🚨 Missing any of these properties will cause silent deployment failures!**

---

## Creating Topics and Actions

When customizing agents with topics and actions, refer to:
**`.roo/rules-Salesforce_Agent/agentforce-topics-actions-guide.md`**

This guide provides:

- Detailed XML structure for local topics/actions
- Best practices and naming conventions
- Priority rule: Always prefer LOCAL over GLOBAL
- Examples and deployment instructions

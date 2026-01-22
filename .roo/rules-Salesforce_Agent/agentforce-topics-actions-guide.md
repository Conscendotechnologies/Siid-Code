# Agentforce Topics and Actions Guide

## Overview

Agentforce agents use **topics** to organize functionality and **actions** to perform operations. Both can be defined as **local** (agent-specific)

---

## Priority Rule

**Always prefer LOCAL over GLOBAL:**

- Local topics/actions are scoped to a specific agent
- Better maintainability and isolation
- Easier to customize per agent

## Adding to Existing Agents

**CRITICAL RULE:** When adding new topics or actions to an existing agent (during initial customization or later enhancement), **ALWAYS create them as LOCAL**.

- ✅ **DO:** Add local topics in `<localTopics>` section of GenAiPlannerBundle
- ✅ **DO:** Add local actions in `<localActions>` section within local topics
- ❌ **DON'T:** Create new global topics (GenAiPlugin files) for a single agent
- ❌ **DON'T:** Create new global actions (GenAiFunction files) for a single agent

**Global topics/actions are ONLY for:**

- Pre-existing shared functionality across multiple agents
- When specifically required to reuse across many agents
- Not for initial agent creation or customization

---

## Topics

### Local Topics (Preferred)

**Location:** Inside GenAiPlannerBundle XML file
**Structure:** Defined in `<localTopics>` section

```xml
<localTopics>
    <fullName>Topic_Name</fullName>
    <canEscalate>false</canEscalate>
    <description>Description of what this topic handles</description>
    <developerName>Topic_Name</developerName>
    <genAiPluginInstructions>
        <description>Instruction for the agent on how to use this topic</description>
        <developerName>instructions_0</developerName>
        <language>en_US</language>
        <masterLabel>instructions_0</masterLabel>
        <sortOrder>0</sortOrder>
    </genAiPluginInstructions>
    <language>en_US</language>
    <localActionLinks>
        <functionName>Action_Name</functionName>
    </localActionLinks>
    <localDeveloperName>Topic_Name</localDeveloperName>
    <masterLabel>Topic Display Name</masterLabel>
    <pluginType>Topic</pluginType>
    <scope>Define the scope and boundaries of what this topic can do</scope>
</localTopics>
```

**CRITICAL - Topic Naming Consistency:**

The following fields **MUST use the exact same name** (e.g., `Topic_Name`):

- `<fullName>Topic_Name</fullName>`
- `<developerName>Topic_Name</developerName>`
- `<localDeveloperName>Topic_Name</localDeveloperName>`
- `<localTopicLinks><genAiPluginName>Topic_Name</genAiPluginName></localTopicLinks>`
- Folder path: `localActions/Topic_Name/`

**Exception:** `<masterLabel>` can have spaces for display (e.g., `Topic Display Name`)

**Link local topic to agent:**

```xml
<localTopicLinks>
    <genAiPluginName>Topic_Name</genAiPluginName>
</localTopicLinks>
```

---

## Actions

### Local Actions (Preferred)

**Location:** Inside local topic in GenAiPlannerBundle XML
**Structure:** Defined in `<localActions>` section within a local topic

**IMPORTANT:** Local actions require **input and output schema files** that define the action's interface. These schemas must match the `@InvocableVariable` parameters in your Apex invocable class.

```xml
<localTopics>
    <fullName>Topic_Name</fullName>
    <!-- Topic configuration here -->

    <localActionLinks>
        <functionName>Action_Name</functionName>
    </localActionLinks>

    <localActions>
        <fullName>Action_Name</fullName>
        <description>What this action does</description>
        <developerName>Action_Name</developerName>
        <invocationTarget>ApexClassName</invocationTarget>
        <invocationTargetType>apex</invocationTargetType>
        <isConfirmationRequired>false</isConfirmationRequired>
        <isIncludeInProgressIndicator>false</isIncludeInProgressIndicator>
        <localDeveloperName>Action_Name</localDeveloperName>
        <masterLabel>Action Display Name</masterLabel>
    </localActions>
</localTopics>
```

**CRITICAL - Action Naming Consistency:**

The following fields **MUST use the exact same name** (e.g., `Action_Name`):

- `<fullName>Action_Name</fullName>`
- `<developerName>Action_Name</developerName>`
- `<localDeveloperName>Action_Name</localDeveloperName>`
- `<localActionLinks><functionName>Action_Name</functionName></localActionLinks>`
- Folder path: `localActions/Topic_Name/Action_Name/`

**Exception:** `<masterLabel>` can have spaces for display (e.g., `Action Display Name`)

#### Input and Output Schema Files

For each local action, you must create **separate schema files** in a folder structure:

**Folder Structure:**

```
genAiPlannerBundles/
  YourAgentBundle/
    localActions/
      Topic_Name/Action_Name/
        input/
          schema          <-- Input schema JSON file (no extension)
        output/
          schema          <-- Output schema JSON file (no extension)
```

**1. Input Schema (`input/schema.json` file):**

- Physical JSON file located at: `localActions/Topic_Name/Action_Name/input/schema`
- Contains the definition of input parameters
- Must match the `@InvocableVariable` input parameters in your Apex class

**2. Output Schema (`output/schema` file):**

- Physical JSON file located at: `localActions/Topic_Name/Action_Name/output/schema`
- Contains the definition of output/return values
- Must match the `@InvocableVariable` output parameters in your Apex class

**Input Schema File Structure (`input/schema.json`):**

```json
{
	"required": ["inputParam1"],
	"unevaluatedProperties": false,
	"properties": {
		"inputParam1": {
			"title": "Input Parameter 1",
			"description": "Description of what this input does",
			"lightning:type": "lightning__textType",
			"lightning:isPII": false,
			"copilotAction:isUserInput": false
		},
		"inputParam2": {
			"title": "Input Parameter 2",
			"description": "Optional input parameter",
			"lightning:type": "lightning__textType",
			"lightning:isPII": false,
			"copilotAction:isUserInput": false
		}
	},
	"lightning:type": "lightning__objectType"
}
```

**Output Schema File Structure (`output/schema`):**

```json
{
	"unevaluatedProperties": false,
	"properties": {
		"outputParam1": {
			"title": "Output Parameter 1",
			"description": "Description of the output",
			"lightning:type": "lightning__textType",
			"lightning:isPII": false,
			"copilotAction:isDisplayable": false,
			"copilotAction:isUsedByPlanner": true,
			"copilotAction:useHydratedPrompt": false
		},
		"success": {
			"title": "Success",
			"description": "Indicates if the operation was successful",
			"lightning:type": "lightning__booleanType",
			"lightning:isPII": false,
			"copilotAction:isDisplayable": false,
			"copilotAction:isUsedByPlanner": true,
			"copilotAction:useHydratedPrompt": false
		}
	},
	"lightning:type": "lightning__objectType"
}
```

**Schema File Properties Explained:**

- **`required`**: Array of required parameter names (input schema only)
- **`unevaluatedProperties`**: Set to `false` to disallow additional properties
- **`properties`**: Object containing all input/output parameters
    - **`title`**: Display name (from `@InvocableVariable` label)
    - **`description`**: Parameter description (from `@InvocableVariable` description)
    - **`lightning:type`**: Data type - ⚠️ **MUST use double underscore** (e.g., `lightning__textType`)
    - **`lightning:isPII`**: Whether field contains personally identifiable information (required for ALL properties)
    - **`copilotAction:isUserInput`**: Whether user provides this value directly (INPUT schemas only)
    - **`copilotAction:isDisplayable`**: Whether value is displayed to user (OUTPUT schemas only)
    - **`copilotAction:isUsedByPlanner`**: Whether planner uses this value (OUTPUT schemas only)
    - **`copilotAction:useHydratedPrompt`**: Whether to use hydrated prompt (OUTPUT schemas only)
- **`lightning:type`**: Root level type, always `"lightning__objectType"` for action schemas (⚠️ **double underscore**)

**🚨 CRITICAL SYNTAX RULES:**

1. **ALL Lightning types MUST use DOUBLE UNDERSCORE (`__`) - NO EXCEPTIONS:**

    ⚠️ **This is CRITICAL**: Using single underscore will NOT produce clear error messages and makes debugging nearly impossible.

    **EVERY lightning type requires double underscore:**

    - ❌ WRONG: `lightning_textType`, `lightning_booleanType`, `lightning_numberType`, `lightning_dateType`, `lightning_dateTimeType`, `lightning_recordIdType`, `lightning_objectType`
    - ✅ CORRECT: `lightning__textType`, `lightning__booleanType`, `lightning__numberType`, `lightning__dateType`, `lightning__dateTimeType`, `lightning__recordIdType`, `lightning__objectType`

    **Rule applies to:**

    - Property-level `"lightning:type"` values
    - Root-level `"lightning:type"` value (always `lightning__objectType`)
    - ANY lightning type you use in schemas

2. **Input properties require:**

    - `title`, `description`, `lightning:type`, `lightning:isPII`, `copilotAction:isUserInput`

3. **Output properties require:**
    - `title`, `description`, `lightning:type`, `lightning:isPII`, `copilotAction:isDisplayable`, `copilotAction:isUsedByPlanner`, `copilotAction:useHydratedPrompt`

**CRITICAL - Apex to Schema Mapping Rules:**

When creating schema files, these mappings must be **EXACT** - character-for-character matches:

- **`@InvocableVariable` parameter name** → **property key** in schema (exact match)
- **`@InvocableVariable` label value** → **`title`** in schema (exact match)
- **`@InvocableVariable` description value** → **`description`** in schema (exact match)

❌ **Do NOT modify, rephrase, or change these values** - they must be identical to the Apex class.

✅ **Example of correct mapping:**

```apex
@InvocableVariable(label='Account Name' description='The name of the account to create')
public String accountName;
```

```json
"accountName": {
    "title": "Account Name",
    "description": "The name of the account to create",
    "lightning:type": "lightning__textType",
    "lightning:isPII": false,
    "copilotAction:isUserInput": false
}
```

#### How to Define Schema from Apex Class

**Step 1:** Examine your Apex invocable class to identify input/output variables:

```apex
public class ApexClassName {
    public class InputParameters {
        @InvocableVariable(required=true label='Input Parameter 1' description='Description of what this input does')
        public String inputParam1;

        @InvocableVariable(required=false label='Input Parameter 2' description='Optional input parameter')
        public String inputParam2;
    }

    public class OutputParameters {
        @InvocableVariable(label='Output Parameter 1' description='Description of the output')
        public String outputParam1;

        @InvocableVariable(label='Success' description='Indicates if the operation was successful')
        public Boolean success;
    }

    @InvocableMethod(label='Action Display Name' description='What this action does')
    public static List<OutputParameters> execute(List<InputParameters> inputs) {
        // Implementation
    }
}
```

**Step 2:** Map Apex variables to schema properties:

**🚨 CRITICAL - ALL Lightning Types MUST Use DOUBLE UNDERSCORE (`__`):**

⚠️ **WARNING**: Single underscore will NOT produce clear errors! Always use double underscore for ALL lightning types.

| Apex Type                      | Lightning Schema Type ✅                   |
| ------------------------------ | ------------------------------------------ |
| `String`                       | `lightning__textType`                      |
| `Boolean`                      | `lightning__booleanType`                   |
| `Integer`, `Decimal`, `Double` | `lightning__numberType`                    |
| `Date`                         | `lightning__dateType`                      |
| `DateTime`                     | `lightning__dateTimeType`                  |
| `List<String>`                 | `lightning__textType` (with array wrapper) |
| `Id` (Record ID)               | `lightning__recordIdType`                  |
| Custom Object                  | `lightning__objectType`                    |

**Remember:** This rule applies to **EVERY** lightning type in your schemas, not just the ones shown above.

**❌ WRONG:** `"lightning:type": "lightning_textType"` (single underscore - no clear error!)
**✅ CORRECT:** `"lightning:type": "lightning__textType"` (double underscore)

**Step 3:** Create `input/schema.json` file from `@InvocableVariable` input parameters

1. Create folder structure: `localActions/Topic_Name/Action_Name/input/`
2. Create file named `schema` (no extension) with JSON content
3. Set `required` array with all parameters where `required=true`
4. Add `"unevaluatedProperties": false`
5. Map each variable to a property:
    - Use parameter name as property key (EXACT match from Apex)
    - Use `@InvocableVariable` label as `title` (EXACT match - do not modify)
    - Use `@InvocableVariable` description as `description` (EXACT match - do not modify)
    - Map Apex type to `lightning:type` (⚠️ **MUST use double underscore**: `lightning__textType`)
    - Set `"lightning:isPII": false` (or true if contains PII)
    - Set `"copilotAction:isUserInput": false` (or true if user provides directly)
6. Set root `"lightning:type": "lightning__objectType"` (⚠️ **double underscore**)

**Step 4:** Create `output/schema` file from `@InvocableVariable` output parameters

1. Create folder structure: `localActions/Topic_Name/Action_Name/output/`
2. Create file named `schema` (no extension) with JSON content
3. Add `"unevaluatedProperties": false`
4. Map each output variable to a property:
    - Use parameter name as property key (EXACT match from Apex)
    - Use `@InvocableVariable` label as `title` (EXACT match - do not modify)
    - Use `@InvocableVariable` description as `description` (EXACT match - do not modify)
    - Map Apex type to `lightning:type` (⚠️ **MUST use double underscore**: `lightning__textType`)
    - Set `"lightning:isPII": false` (required for all output properties)
    - Set `"copilotAction:isDisplayable": false`
    - Set `"copilotAction:isUsedByPlanner": true`
    - Set `"copilotAction:useHydratedPrompt": false`
5. No `required` array needed for outputs
6. Set root `"lightning:type": "lightning__objectType"` (⚠️ **double underscore**)

**Link local action to agent:**

```xml
<localActionLinks>
    <genAiFunctionName>Action_Name</genAiFunctionName>
</localActionLinks>
```

---

## Invocation Target Types

Actions can invoke different types of functionality:

- **apex**: Apex invocable method (most common for custom logic)
- **flow**: Salesforce Flow
- **prompt**: Prompt template

---

## Best Practices

1. **Use Local by Default**

    - Start with local topics and actions

2. **Naming Conventions**

    - Topics: Use clear, descriptive names: `Topic_Name`
    - Actions: Use clear, descriptive names: `Action_Name`
    - Use underscores to separate words in names
    - **CRITICAL:** Use the EXACT same name across all XML fields and folder paths
    - Only `<masterLabel>` can have spaces for display purposes

3. **Topic Organization**

    - Group related actions under one topic
    - Maximum 1-2 actions per topic
    - Keep topic scope focused

4. **Action Configuration**

    - Set `isConfirmationRequired=true` for destructive operations
    - Set `isIncludeInProgressIndicator=true` for long-running operations
    - Provide clear descriptions for agent understanding

5. **Instructions**
    - Add multiple instructions for complex topics
    - Use sortOrder to sequence instructions
    - Be specific about when to use each action

---

## Examples

See example files in:

- `.roo/rules-Salesforce_Agent/examples/genAiPlannerBundles/` - Local topics/actions
- `.roo/rules-Salesforce_Agent/examples/genAiPlugins/` - Global topics
- `.roo/rules-Salesforce_Agent/examples/genAiFunctions/` - Global actions

---

## When Creating Topics/Actions

**For Local (Preferred):**

1. Add `<localTopics>` section in GenAiPlannerBundle
2. Define topic with description, scope, and instructions
3. Add `<localActions>` within the topic
4. Create folder structure: `localActions/Topic_Name/Action_Name/`
5. **CRITICAL:** Folder names must EXACTLY match the `<fullName>` values in XML
6. **CRITICAL:** Use identical names for `<fullName>`, `<developerName>`, `<localDeveloperName>`, and folder paths
7. Create `input/schema.json` file with JSON input parameters
8. Create `output/schema.json` file with JSON output parameters
9. Link action to Apex invocable method
10. **CRITICAL:** Grant Apex class permission to `Einstein Agent User` profile (required for action to work)
11. Add `<localTopicLinks>` and `<localActionLinks>` at agent level

---

## Permissions

**🚨 CRITICAL:** After creating Apex invocable classes, you **MUST** grant permissions to the **Einstein Agent User** profile. Without this, the action will not work.

### Granting Apex Class Access

**Option 1: Via Setup UI**

1. Navigate to **Setup** → **Users** → **Profiles**
2. Find and open **Einstein Agent User** profile
3. Scroll to **Enabled Apex Class Access** section
4. Click **Edit**
5. Add your Apex class to the **Enabled** list
6. Click **Save**

**Option 2: Via Metadata (Recommended for version control)**

Add this block to the existing profile metadata file:

**File:** `force-app/main/default/profiles/Einstein Agent User.profile-meta.xml`

**Add this block:**

```xml
<classAccesses>
    <apexClass>YourApexClassName</apexClass>
    <enabled>true</enabled>
</classAccesses>
```

**Note:** Add this `<classAccesses>` block inside the existing `<Profile>` tags. If the profile file doesn't exist, retrieve it first:

```bash
sf project retrieve start --metadata Profile:"Einstein Agent User" --target-org <org>
```

**Option 3: Via Permission Set (Alternative approach)**

Create a permission set and assign it to the Einstein Agent User:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <classAccesses>
        <apexClass>YourApexClassName</apexClass>
        <enabled>true</enabled>
    </classAccesses>
    <hasActivationRequired>false</hasActivationRequired>
    <label>Agent Actions Permission Set</label>
</PermissionSet>
```

**Best Practice:** Use permission sets for easier management and deployment across orgs.

---

## Deployment

After creating/modifying topics, actions, and permissions:

**1. Deploy the Agent Bundle:**

```bash
sf project deploy start --metadata GenAiPlannerBundle:Agent_Name --target-org <org>
```

**2. Deploy Apex Classes (if created/modified):**

```bash
sf project deploy start --metadata ApexClass:YourApexClassName --target-org <org>
```

**3. Deploy Permissions:**

```bash
# If using profile metadata
sf project deploy start --metadata Profile:"Einstein Agent User" --target-org <org>

# If using permission set (recommended)
sf project deploy start --metadata PermissionSet:Agent_Actions_Permission_Set --target-org <org>
```

**4. Verify Deployment:**

- Check that the agent appears in Setup → Einstein → Agents
- Verify Apex class is accessible to Einstein Agent User profile
- Test the agent to ensure actions execute correctly

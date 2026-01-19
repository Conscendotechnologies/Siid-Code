# Agentforce Topics and Actions Guide

## Overview

Agentforce agents use **topics** to organize functionality and **actions** to perform operations. Both can be defined as **local** (agent-specific) or **global** (reusable across agents).

---

## Priority Rule

**Always prefer LOCAL over GLOBAL:**

- Local topics/actions are scoped to a specific agent
- Better maintainability and isolation
- Easier to customize per agent
- Only use global when the topic/action needs to be shared across multiple agents

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
    <fullName>Topic_Name_UniqueId</fullName>
    <canEscalate>false</canEscalate>
    <description>Description of what this topic handles</description>
    <developerName>Topic_Name_UniqueId</developerName>
    <genAiPluginInstructions>
        <description>Instruction for the agent on how to use this topic</description>
        <developerName>instructions_0</developerName>
        <language>en_US</language>
        <masterLabel>instructions_0</masterLabel>
        <sortOrder>0</sortOrder>
    </genAiPluginInstructions>
    <language>en_US</language>
    <localActionLinks>
        <functionName>Action_Name_UniqueId</functionName>
    </localActionLinks>
    <localDeveloperName>Topic_Name</localDeveloperName>
    <masterLabel>Topic Display Name</masterLabel>
    <pluginType>Topic</pluginType>
    <scope>Define the scope and boundaries of what this topic can do</scope>
</localTopics>
```

**Link local topic to agent:**

```xml
<localTopicLinks>
    <genAiPluginName>Topic_Name_UniqueId</genAiPluginName>
</localTopicLinks>
```

### Global Topics

**Location:** Separate file in `genAiPlugins/` directory
**File name:** `TopicName.genAiPlugin-meta.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<GenAiPlugin xmlns="http://soap.sforce.com/2006/04/metadata">
    <canEscalate>false</canEscalate>
    <description>Topic description</description>
    <developerName>Topic_Name</developerName>
    <genAiFunctions>
        <functionName>GlobalActionName</functionName>
    </genAiFunctions>
    <genAiPluginInstructions>
        <description>Instructions for using this topic</description>
        <developerName>instruction_0</developerName>
        <masterLabel>instruction_0</masterLabel>
        <sortOrder>0</sortOrder>
    </genAiPluginInstructions>
    <language>en_US</language>
    <masterLabel>Topic Display Name</masterLabel>
    <pluginType>Topic</pluginType>
    <scope>Topic scope and boundaries</scope>
</GenAiPlugin>
```

---

## Actions

### Local Actions (Preferred)

**Location:** Inside local topic in GenAiPlannerBundle XML
**Structure:** Defined in `<localActions>` section within a local topic

**IMPORTANT:** Local actions require **input and output schema files** that define the action's interface. These schemas must match the `@InvocableVariable` parameters in your Apex invocable class.

```xml
<localTopics>
    <fullName>Topic_Name_UniqueId</fullName>
    <!-- Topic configuration here -->

    <localActionLinks>
        <functionName>Action_Name_UniqueId</functionName>
    </localActionLinks>

    <localActions>
        <fullName>Action_Name_UniqueId</fullName>
        <description>What this action does</description>
        <developerName>Action_Name_UniqueId</developerName>
        <invocationTarget>ApexClassName</invocationTarget>
        <invocationTargetType>apex</invocationTargetType>
        <isConfirmationRequired>false</isConfirmationRequired>
        <isIncludeInProgressIndicator>false</isIncludeInProgressIndicator>
        <localDeveloperName>Action_Name</localDeveloperName>
        <masterLabel>Action Display Name</masterLabel>
    </localActions>
</localTopics>
```

#### Input and Output Schema Files

For each local action, you must create **separate schema files** in a folder structure:

**Folder Structure:**

```
genAiPlannerBundles/
  YourAgentBundle/
    localActions/
      Action_Name_UniqueId/
        input/
          schema          <-- Input schema JSON file (no extension)
        output/
          schema          <-- Output schema JSON file (no extension)
```

**1. Input Schema (`input/schema` file):**

- Physical JSON file located at: `localActions/Action_Name_UniqueId/input/schema`
- Contains the definition of input parameters
- Must match the `@InvocableVariable` input parameters in your Apex class

**2. Output Schema (`output/schema` file):**

- Physical JSON file located at: `localActions/Action_Name_UniqueId/output/schema`
- Contains the definition of output/return values
- Must match the `@InvocableVariable` output parameters in your Apex class

**Input Schema File Structure (`input/schema`):**

```json
{
	"required": ["inputParam1"],
	"unevaluatedProperties": false,
	"properties": {
		"inputParam1": {
			"title": "Input Parameter 1",
			"description": "Description of what this input does",
			"lightning:type": "lightning_textType",
			"lightning:isPII": false,
			"copilotAction:isUserInput": false
		},
		"inputParam2": {
			"title": "Input Parameter 2",
			"description": "Optional input parameter",
			"lightning:type": "lightning_textType",
			"lightning:isPII": false,
			"copilotAction:isUserInput": false
		}
	},
	"lightning:type": "lightning_objectType"
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
			"lightning:type": "lightning_textType"
		},
		"success": {
			"title": "Success",
			"description": "Indicates if the operation was successful",
			"lightning:type": "lightning_booleanType"
		}
	},
	"lightning:type": "lightning_objectType"
}
```

**Schema File Properties Explained:**

- **`required`**: Array of required parameter names (input schema only)
- **`unevaluatedProperties`**: Set to `false` to disallow additional properties
- **`properties`**: Object containing all input/output parameters
    - **`title`**: Display name (from `@InvocableVariable` label)
    - **`description`**: Parameter description (from `@InvocableVariable` description)
    - **`lightning:type`**: Data type (see type mapping table below)
    - **`lightning:isPII`**: Whether field contains personally identifiable information
    - **`copilotAction:isUserInput`**: Whether user provides this value directly
- **`lightning:type`**: Root level type, always `"lightning_objectType"` for action schemas

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

| Apex Type                      | Lightning Schema Type                     |
| ------------------------------ | ----------------------------------------- |
| `String`                       | `lightning_textType`                      |
| `Boolean`                      | `lightning_booleanType`                   |
| `Integer`, `Decimal`, `Double` | `lightning_numberType`                    |
| `Date`                         | `lightning_dateType`                      |
| `DateTime`                     | `lightning_dateTimeType`                  |
| `List<String>`                 | `lightning_textType` (with array wrapper) |
| `Id` (Record ID)               | `lightning_recordIdType`                  |
| Custom Object                  | `lightning_objectType`                    |

**Step 3:** Create `input/schema` file from `@InvocableVariable` input parameters

1. Create folder structure: `localActions/Action_Name_UniqueId/input/`
2. Create file named `schema` (no extension) with JSON content
3. Set `required` array with all parameters where `required=true`
4. Add `"unevaluatedProperties": false`
5. Map each variable to a property:
    - Use parameter name as property key
    - Use `@InvocableVariable` label as `title`
    - Use `@InvocableVariable` description as `description`
    - Map Apex type to `lightning:type`
    - Set `"lightning:isPII": false` (or true if contains PII)
    - Set `"copilotAction:isUserInput": false` (or true if user provides directly)
6. Set root `"lightning:type": "lightning_objectType"`

**Step 4:** Create `output/schema` file from `@InvocableVariable` output parameters

1. Create folder structure: `localActions/Action_Name_UniqueId/output/`
2. Create file named `schema` (no extension) with JSON content
3. Add `"unevaluatedProperties": false`
4. Map each output variable to a property (same as input)
5. No `required` array needed for outputs
6. Set root `"lightning:type": "lightning_objectType"`

**Link local action to agent:**

```xml
<localActionLinks>
    <genAiFunctionName>Action_Name_UniqueId</genAiFunctionName>
</localActionLinks>
```

### Global Actions

**Location:** Separate file in `genAiFunctions/` directory
**File name:** `ActionName.genAiFunction-meta.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<GenAiFunction xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>What this action does</description>
    <developerName>Action_Name</developerName>
    <invocationTarget>ApexClassName</invocationTarget>
    <invocationTargetType>apex</invocationTargetType>
    <isConfirmationRequired>false</isConfirmationRequired>
    <isIncludeInProgressIndicator>false</isIncludeInProgressIndicator>
    <masterLabel>Action Display Name</masterLabel>
</GenAiFunction>
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
    - Only create global if needed across multiple agents

2. **Naming Conventions**

    - Use descriptive names
    - Include unique IDs to avoid conflicts
    - Follow pattern: `ActionName_UniqueId`

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
4. Create folder structure: `localActions/Action_Name_UniqueId/`
5. Create `input/schema` file with JSON input parameters
6. Create `output/schema` file with JSON output parameters
7. Link action to Apex invocable method
8. Add `<localTopicLinks>` and `<localActionLinks>` at agent level

**For Global (Only if reusable):**

1. Create separate GenAiPlugin file for topic
2. Create separate GenAiFunction file for action
3. Reference global resources from multiple agents as needed

---

## Deployment

After creating/modifying topics and actions:

```bash
sf project deploy start --metadata GenAiPlannerBundle,GenAiPlugin,GenAiFunction --target-org <org>
```

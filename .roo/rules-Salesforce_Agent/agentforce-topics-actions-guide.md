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
4. Link action to Apex invocable method
5. Add `<localTopicLinks>` and `<localActionLinks>` at agent level

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

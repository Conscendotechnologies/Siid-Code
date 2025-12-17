# Record-Triggered Flow Patterns - Real-World Examples

## 📖 Getting Schema Information

**BEFORE building any Flow component, ALWAYS use the `retrieve_schema` tool to get the official Salesforce Metadata API definitions.**

### How to Use retrieve_schema Tool:

```xml
<retrieve_schema>
<component_name>Flow</component_name>
</retrieve_schema>
```

**Common Record-Triggered Flow Components to Retrieve:**

- `Flow` - Main flow definition and structure
- `FlowStart` - Trigger configuration (object, timing, conditions)
- `FlowRecordFilter` - Entry criteria and conditions
- `FlowRecordCreate` - Create Records element
- `FlowRecordUpdate` - Update Records element
- `FlowRecordDelete` - Delete Records element
- `FlowRecordLookup` - Get Records element
- `FlowAssignment` - Assignment element
- `FlowDecision` - Decision element
- `FlowLoop` - Loop element for collection processing
- `FlowVariable` - Variable definitions
- `FlowFormula` - Formula fields

The tool returns:

- ✅ All available properties and their types
- ✅ Required vs optional fields
- ✅ Enum values for choice fields (e.g., TriggerType, RecordTriggerType)
- ✅ Nested type definitions
- ✅ Official WSDL-based schema from Salesforce

---

## ✅ Complete Working Record-Triggered Flow Template

This example shows the CORRECT way to create Record-Triggered Flows:

### Example: Before Save Flow (Update Same Record)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>65.0</apiVersion>
    <areMetricsLoggedToDataCloud>false</areMetricsLoggedToDataCloud>
    <interviewLabel>Lead Before Save Flow {!$Flow.CurrentDateTime}</interviewLabel>
    <label>Lead Before Save Flow</label>
    <processType>AutoLaunchedFlow</processType>
    <processMetadataValues>
        <name>BuilderType</name>
        <value><stringValue>LightningFlowBuilder</stringValue></value>
    </processMetadataValues>
    <processMetadataValues>
        <name>CanvasMode</name>
        <value><stringValue>AUTO_LAYOUT_CANVAS</stringValue></value>
    </processMetadataValues>
    <processMetadataValues>
        <name>OriginBuilderType</name>
        <value><stringValue>LightningFlowBuilder</stringValue></value>
    </processMetadataValues>

    <!-- Start Element with Record Trigger Configuration -->
    <start>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <connector>
            <targetReference>Update_Lead_Status</targetReference>
        </connector>
        <filterLogic>and</filterLogic>
        <filters>
            <field>Company</field>
            <operator>IsNull</operator>
            <value><booleanValue>false</booleanValue></value>
        </filters>
        <object>Lead</object>
        <recordTriggerType>Create</recordTriggerType>
        <triggerType>RecordBeforeSave</triggerType>
    </start>

    <!-- Assignment Element (For Before Save) -->
    <assignments>
        <name>Update_Lead_Status</name>
        <label>Update Lead Status</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <assignmentItems>
            <assignToReference>$Record.Status</assignToReference>
            <operator>Assign</operator>
            <value><stringValue>Working - Contacted</stringValue></value>
        </assignmentItems>
    </assignments>

    <status>Active</status>
</Flow>
```

### Example: After Save Flow (Create/Update Other Records)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>65.0</apiVersion>
    <areMetricsLoggedToDataCloud>false</areMetricsLoggedToDataCloud>
    <interviewLabel>Account After Save Flow {!$Flow.CurrentDateTime}</interviewLabel>
    <label>Account After Save Flow</label>
    <processType>AutoLaunchedFlow</processType>
    <processMetadataValues>
        <name>BuilderType</name>
        <value><stringValue>LightningFlowBuilder</stringValue></value>
    </processMetadataValues>
    <processMetadataValues>
        <name>CanvasMode</name>
        <value><stringValue>AUTO_LAYOUT_CANVAS</stringValue></value>
    </processMetadataValues>
    <processMetadataValues>
        <name>OriginBuilderType</name>
        <value><stringValue>LightningFlowBuilder</stringValue></value>
    </processMetadataValues>

    <!-- Start Element with Record Trigger Configuration -->
    <start>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <connector>
            <targetReference>Get_Related_Opportunities</targetReference>
        </connector>
        <filterLogic>and</filterLogic>
        <filters>
            <field>AnnualRevenue</field>
            <operator>GreaterThan</operator>
            <value><numberValue>1000000.0</numberValue></value>
        </filters>
        <object>Account</object>
        <recordTriggerType>Update</recordTriggerType>
        <triggerType>RecordAfterSave</triggerType>
    </start>

    <!-- Get Records Element -->
    <recordLookups>
        <name>Get_Related_Opportunities</name>
        <label>Get Related Opportunities</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <assignNullValuesIfNoRecordsFound>false</assignNullValuesIfNoRecordsFound>
        <connector>
            <targetReference>Check_Opportunities_Exist</targetReference>
        </connector>
        <filterLogic>and</filterLogic>
        <filters>
            <field>AccountId</field>
            <operator>EqualTo</operator>
            <value><elementReference>$Record.Id</elementReference></value>
        </filters>
        <filters>
            <field>StageName</field>
            <operator>EqualTo</operator>
            <value><stringValue>Prospecting</stringValue></value>
        </filters>
        <getFirstRecordOnly>false</getFirstRecordOnly>
        <object>Opportunity</object>
        <storeOutputAutomatically>true</storeOutputAutomatically>
    </recordLookups>

    <!-- Decision Element -->
    <decisions>
        <name>Check_Opportunities_Exist</name>
        <label>Check Opportunities Exist</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <defaultConnectorLabel>No Opportunities</defaultConnectorLabel>
        <rules>
            <name>Has_Opportunities</name>
            <conditionLogic>and</conditionLogic>
            <conditions>
                <leftValueReference>Get_Related_Opportunities</leftValueReference>
                <operator>IsNull</operator>
                <rightValue><booleanValue>false</booleanValue></rightValue>
            </conditions>
            <connector>
                <targetReference>Update_Opportunities_Loop</targetReference>
            </connector>
            <label>Has Opportunities</label>
        </rules>
    </decisions>

    <!-- Loop Element for Bulk Processing -->
    <loops>
        <name>Update_Opportunities_Loop</name>
        <label>Update Opportunities Loop</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <collectionReference>Get_Related_Opportunities</collectionReference>
        <iterationOrder>Asc</iterationOrder>
        <nextValueConnector>
            <targetReference>Assign_Priority</targetReference>
        </nextValueConnector>
    </loops>

    <!-- Assignment Inside Loop -->
    <assignments>
        <name>Assign_Priority</name>
        <label>Assign Priority</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <assignmentItems>
            <assignToReference>Update_Opportunities_Loop.Priority__c</assignToReference>
            <operator>Assign</operator>
            <value><stringValue>High</stringValue></value>
        </assignmentItems>
        <connector>
            <targetReference>Update_Opportunities_Loop</targetReference>
        </connector>
    </assignments>

    <!-- Update Records (Bulk DML Outside Loop) -->
    <recordUpdates>
        <name>Update_Opportunities</name>
        <label>Update Opportunities</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <inputReference>Get_Related_Opportunities</inputReference>
    </recordUpdates>

    <status>Active</status>
</Flow>
```

---

## 🔑 Key Patterns Explained

### 1. Start Element Configuration - CRITICAL

**💡 Use retrieve_schema to get all available properties:**

```xml
<retrieve_schema>
<component_name>FlowStart</component_name>
</retrieve_schema>
```

**✅ CORRECT - Record-Triggered Flow Start:**

```xml
<start>
    <locationX>0</locationX>
    <locationY>0</locationY>
    <connector>
        <targetReference>First_Element</targetReference>
    </connector>
    <filterLogic>and</filterLogic>
    <filters>
        <field>FieldName</field>
        <operator>EqualTo</operator>
        <value><stringValue>Value</stringValue></value>
    </filters>
    <object>ObjectApiName</object>
    <recordTriggerType>Create</recordTriggerType>  <!-- or Update, CreateAndUpdate, Delete -->
    <triggerType>RecordBeforeSave</triggerType>    <!-- or RecordAfterSave -->
</start>
```

**Key Properties:**

- `object` - The sObject API name (e.g., Lead, Account, Custom\_\_c)
- `recordTriggerType` - When to trigger (Create, Update, CreateAndUpdate, Delete)
- `triggerType` - Timing (RecordBeforeSave or RecordAfterSave)
- `filterLogic` - Entry criteria logic ("and", "or", custom like "1 AND (2 OR 3)")
- `filters` - Entry conditions

**Retrieve enum values for triggerType and recordTriggerType:**

```xml
<retrieve_schema>
<component_name>FlowRecordTriggerType</component_name>
</retrieve_schema>
```

---

### 2. Trigger Types - When to Use

#### **RecordBeforeSave (Before Save)**

**Use Cases:**

- ✅ Update fields on the SAME record being saved
- ✅ Field validation and data quality
- ✅ Automatic field population
- ✅ No DML operations needed (changes are saved automatically)

**Restrictions:**

- ❌ CANNOT create other records
- ❌ CANNOT update other records
- ❌ CANNOT delete records
- ❌ NO explicit DML operations

**Pattern:**

```xml
<start>
    <triggerType>RecordBeforeSave</triggerType>
    <recordTriggerType>Create</recordTriggerType>
    <object>Lead</object>
</start>

<!-- Use $Record to reference the triggering record -->
<assignments>
    <assignToReference>$Record.Status</assignToReference>
    <operator>Assign</operator>
    <value><stringValue>New Value</stringValue></value>
</assignments>
```

#### **RecordAfterSave (After Save)**

**Use Cases:**

- ✅ Create related records
- ✅ Update other records
- ✅ Delete records
- ✅ Send emails, call Apex, invoke APIs
- ✅ Complex business logic requiring multiple DML operations

**Pattern:**

```xml
<start>
    <triggerType>RecordAfterSave</triggerType>
    <recordTriggerType>Update</recordTriggerType>
    <object>Account</object>
</start>

<!-- Can perform DML on other records -->
<recordCreates>
    <name>Create_Task</name>
    <object>Task</object>
    <inputAssignments>
        <field>WhatId</field>
        <value><elementReference>$Record.Id</elementReference></value>
    </inputAssignments>
</recordCreates>
```

---

### 3. Record Trigger Types

**💡 Get all available trigger types:**

```xml
<retrieve_schema>
<component_name>FlowRecordTriggerType</component_name>
</retrieve_schema>
```

**Common Values:**

- `Create` - Only when records are created
- `Update` - Only when records are updated
- `CreateAndUpdate` - Both create and update
- `Delete` - When records are deleted (After Save only)

**Example Usage:**

```xml
<start>
    <object>Opportunity</object>
    <recordTriggerType>CreateAndUpdate</recordTriggerType>
    <triggerType>RecordAfterSave</triggerType>
</start>
```

---

### 4. Entry Criteria (Filter Logic)

**💡 Get filter operator options:**

```xml
<retrieve_schema>
<component_name>FlowComparisonOperator</component_name>
</retrieve_schema>
```

**Simple AND Logic:**

```xml
<start>
    <filterLogic>and</filterLogic>
    <filters>
        <field>Status</field>
        <operator>EqualTo</operator>
        <value><stringValue>Active</stringValue></value>
    </filters>
    <filters>
        <field>AnnualRevenue</field>
        <operator>GreaterThan</operator>
        <value><numberValue>1000000.0</numberValue></value>
    </filters>
</start>
```

**Custom Filter Logic:**

```xml
<start>
    <filterLogic>1 AND (2 OR 3)</filterLogic>
    <filters>
        <field>Status</field>
        <operator>EqualTo</operator>
        <value><stringValue>Active</stringValue></value>
    </filters>
    <filters>
        <field>Type</field>
        <operator>EqualTo</operator>
        <value><stringValue>Customer</stringValue></value>
    </filters>
    <filters>
        <field>Type</field>
        <operator>EqualTo</operator>
        <value><stringValue>Partner</stringValue></value>
    </filters>
</start>
```

**Common Filter Operators:**

- `EqualTo`, `NotEqualTo`
- `GreaterThan`, `LessThan`, `GreaterThanOrEqualTo`, `LessThanOrEqualTo`
- `IsNull`, `IsChanged`
- `Contains`, `StartsWith`, `EndsWith`

---

### 5. Accessing Triggering Record

**Use `$Record` to reference the triggering record:**

```xml
<!-- Access field values -->
<elementReference>$Record.FieldName</elementReference>
<elementReference>$Record.Id</elementReference>
<elementReference>$Record.Account.Name</elementReference>

<!-- Update same record (Before Save only) -->
<assignToReference>$Record.Status</assignToReference>
```

**Use `$Record__Prior` to access old values (Update triggers only):**

```xml
<!-- Check if field changed -->
<conditions>
    <leftValueReference>$Record.Status</leftValueReference>
    <operator>NotEqualTo</operator>
    <rightValue>
        <elementReference>$Record__Prior.Status</elementReference>
    </rightValue>
</conditions>
```

---

### 6. Bulkification - CRITICAL for Record-Triggered Flows

**✅ CORRECT - Process collections, DML outside loops:**

```xml
<!-- Get Records returns collection -->
<recordLookups>
    <name>Get_Records</name>
    <getFirstRecordOnly>false</getFirstRecordOnly>
    <storeOutputAutomatically>true</storeOutputAutomatically>
</recordLookups>

<!-- Loop to process each record -->
<loops>
    <name>Process_Loop</name>
    <collectionReference>Get_Records</collectionReference>
    <iterationOrder>Asc</iterationOrder>
    <nextValueConnector>
        <targetReference>Update_Fields</targetReference>
    </nextValueConnector>
</loops>

<!-- Update fields inside loop -->
<assignments>
    <name>Update_Fields</name>
    <assignToReference>Process_Loop.Status__c</assignToReference>
    <connector>
        <targetReference>Process_Loop</targetReference>
    </connector>
</assignments>

<!-- DML OUTSIDE loop (bulk operation) -->
<recordUpdates>
    <name>Update_Records</name>
    <inputReference>Get_Records</inputReference>
</recordUpdates>
```

**❌ WRONG - DML inside loop (governor limit violation):**

```xml
<loops>
    <name>Bad_Loop</name>
    <nextValueConnector>
        <!-- DON'T DO THIS -->
        <targetReference>Update_Single_Record</targetReference>
    </nextValueConnector>
</loops>

<!-- WRONG: DML inside loop -->
<recordUpdates>
    <name>Update_Single_Record</name>
    <inputReference>Bad_Loop</inputReference>
    <connector>
        <targetReference>Bad_Loop</targetReference>
    </connector>
</recordUpdates>
```

---

### 7. DML Operations

**💡 Get complete DML schemas:**

```xml
<retrieve_schema>
<component_name>FlowRecordCreate</component_name>
</retrieve_schema>

<retrieve_schema>
<component_name>FlowRecordUpdate</component_name>
</retrieve_schema>

<retrieve_schema>
<component_name>FlowRecordDelete</component_name>
</retrieve_schema>
```

**✅ CORRECT - Use inputReference for collections:**

```xml
<recordUpdates>
    <name>Update_Records</name>
    <inputReference>RecordCollection</inputReference>
</recordUpdates>
```

**✅ CORRECT - Use inputAssignments for field-by-field:**

```xml
<recordCreates>
    <name>Create_Task</name>
    <object>Task</object>
    <inputAssignments>
        <field>Subject</field>
        <value><stringValue>Follow Up</stringValue></value>
    </inputAssignments>
    <inputAssignments>
        <field>WhatId</field>
        <value><elementReference>$Record.Id</elementReference></value>
    </inputAssignments>
</recordCreates>
```

---

## 📋 Record-Triggered Flow Mandatory Pattern

**When building a Record-Triggered Flow, ALWAYS follow this pattern:**

1. **Use retrieve_schema** to get FlowStart, trigger types, and operators
2. **Configure Start element** with proper trigger type and entry criteria
3. **Use $Record** to access triggering record fields
4. **Before Save flows:**
    - Update fields on $Record directly
    - No DML operations
5. **After Save flows:**
    - Use Get Records for queries (getFirstRecordOnly=false for collections)
    - Use Loop for processing collections
    - Perform DML OUTSIDE loops
    - Use inputReference for bulk operations
6. **Add fault paths** for error handling on DML operations

---

## ❌ Common Anti-Patterns (DO NOT DO THIS)

1. ❌ **DO NOT perform DML inside loops** (governor limit violation)
2. ❌ **DO NOT use RecordBeforeSave for creating/updating other records**
3. ❌ **DO NOT forget to check $Record\_\_Prior for field changes**
4. ❌ **DO NOT use getFirstRecordOnly=true when processing multiple records**
5. ❌ **DO NOT forget filterLogic when using multiple filters**
6. ❌ **DO NOT hardcode IDs** - use $Record.Id or variables
7. ❌ **DO NOT forget fault paths on DML operations**
8. ❌ **DO NOT query in loops** - get all records first, then loop

---

## ⚠️ Common AI Mistakes to Avoid

### 1. Triggered Record Variable - NO NEED TO CREATE

**❌ WRONG - Creating unnecessary variable for triggered record:**

```xml
<!-- DON'T DO THIS -->
<variables>
    <name>varTriggeredRecord</name>
    <dataType>SObject</dataType>
    <objectType>Account</objectType>
</variables>

<assignments>
    <assignToReference>varTriggeredRecord</assignToReference>
    <operator>Assign</operator>
    <value><elementReference>$Record</elementReference></value>
</assignments>
```

**✅ CORRECT - Use $Record directly:**

```xml
<!-- The triggered record is AUTOMATICALLY available as $Record -->
<!-- No variable creation needed! -->

<!-- Access fields directly -->
<elementReference>$Record.Name</elementReference>
<elementReference>$Record.AnnualRevenue</elementReference>
<elementReference>$Record.Id</elementReference>

<!-- Update fields directly (Before Save) -->
<assignToReference>$Record.Status</assignToReference>

<!-- Use in conditions -->
<conditions>
    <leftValueReference>$Record.Type</leftValueReference>
    <operator>EqualTo</operator>
    <rightValue><stringValue>Customer</stringValue></rightValue>
</conditions>
```

**Key Points:**

- `$Record` is a **system variable** automatically created for record-triggered flows
- It represents the record that triggered the flow
- **NEVER create a custom variable** to store $Record
- Access any field using `{!$Record.FieldApiName}` syntax
- For lookup fields: `{!$Record.Account.Name}` or `{!$Record.Owner.Email}`

---

### 2. Formula vs Decision - Choose the Right Tool

**Use Formula Variable When:**

- ✅ You need to **calculate or assign a single value** based on conditions
- ✅ Simple conditional logic to determine one output
- ✅ All paths lead to the **same next element** (just assigning different values)
- ✅ Example: Determine tier level, calculate discount, set priority

**Use Decision Element When:**

- ✅ You need **different processes/actions** for each condition
- ✅ Each outcome requires **different flow paths** or **different next elements**
- ✅ You have **multiple conditions** that lead to different business processes
- ✅ Example: Route to different approval processes, trigger different record updates, execute different sub-flows

---

**Example: Use Formula for Simple Value Assignment**

**✅ CORRECT - Formula to determine single value:**

```xml
<!-- Use formula when just assigning different values -->
<formulas>
    <name>fxAccountTier</name>
    <dataType>String</dataType>
    <expression>IF(
        {!$Record.AnnualRevenue} > 1000000,
        "Tier 1",
        IF(
            {!$Record.AnnualRevenue} > 500000,
            "Tier 2",
            "Tier 3"
        )
    )</expression>
</formulas>

<!-- Then use the formula value in a single assignment -->
<assignments>
    <name>Set_Tier</name>
    <assignToReference>$Record.Tier__c</assignToReference>
    <operator>Assign</operator>
    <value><elementReference>fxAccountTier</elementReference></value>
    <!-- All conditions flow to same next element -->
    <connector>
        <targetReference>Next_Element</targetReference>
    </connector>
</assignments>
```

---

**Example: Use Decision for Different Processes**

**✅ CORRECT - Decision when each condition needs different actions:**

```xml
<!-- Use decision when each outcome requires different process -->
<decisions>
    <name>Route_by_Account_Tier</name>
    <label>Route by Account Tier</label>
    <locationX>0</locationX>
    <locationY>0</locationY>
    <defaultConnectorLabel>Standard Process</defaultConnectorLabel>

    <!-- Tier 1: Special high-value process -->
    <rules>
        <name>Tier_1_High_Value</name>
        <conditionLogic>and</conditionLogic>
        <conditions>
            <leftValueReference>$Record.AnnualRevenue</leftValueReference>
            <operator>GreaterThan</operator>
            <rightValue><numberValue>1000000</numberValue></rightValue>
        </conditions>
        <!-- Different process/action for Tier 1 -->
        <connector>
            <targetReference>Create_Executive_Task</targetReference>
        </connector>
        <label>Tier 1 - High Value</label>
    </rules>

    <!-- Tier 2: Mid-tier process -->
    <rules>
        <name>Tier_2_Standard</name>
        <conditionLogic>and</conditionLogic>
        <conditions>
            <leftValueReference>$Record.AnnualRevenue</leftValueReference>
            <operator>GreaterThan</operator>
            <rightValue><numberValue>500000</numberValue></rightValue>
        </conditions>
        <!-- Different process/action for Tier 2 -->
        <connector>
            <targetReference>Send_Standard_Email</targetReference>
        </connector>
        <label>Tier 2 - Standard</label>
    </rules>
</decisions>

<!-- Each condition leads to different elements/processes -->
```

---

**Decision Matrix: When to Use Each**

| Scenario                            | Use Formula      | Use Decision   |
| ----------------------------------- | ---------------- | -------------- |
| Set field value based on conditions | ✅ YES           | ❌ Overkill    |
| Calculate discount percentage       | ✅ YES           | ❌ Not needed  |
| All outcomes → same next step       | ✅ YES           | ❌ Unnecessary |
| Different actions per condition     | ❌ Can't do this | ✅ YES         |
| Route to different processes        | ❌ Can't do this | ✅ YES         |
| Multiple outcome paths needed       | ❌ Can't do this | ✅ YES         |
| 2+ different next elements          | ❌ Can't do this | ✅ YES         |

**Simple Rule of Thumb:**

- **Formula = Assignment of values** (one output, same path forward)
- **Decision = Branching logic** (different paths/processes per outcome)

**Examples:**

| Task                                           | Tool     | Reason                       |
| ---------------------------------------------- | -------- | ---------------------------- |
| Set Priority field (High/Medium/Low)           | Formula  | Just assigning a value       |
| Calculate discount amount                      | Formula  | Just calculating a value     |
| Route Tier 1 to VP approval, Tier 2 to Manager | Decision | Different approval processes |
| Tier 1 → Create Task, Tier 2 → Send Email      | Decision | Different actions            |
| Set Status based on Amount                     | Formula  | Just assigning a value       |
| >$1M → Subflow A, <$1M → Subflow B             | Decision | Different subflows           |

---

## 🎯 Decision Matrix: Before vs After Save

| Requirement           | Before Save      | After Save              |
| --------------------- | ---------------- | ----------------------- |
| Update same record    | ✅ YES           | ❌ Use workflow/process |
| Create other records  | ❌ NO            | ✅ YES                  |
| Update other records  | ❌ NO            | ✅ YES                  |
| Delete records        | ❌ NO            | ✅ YES                  |
| Send email            | ❌ NO            | ✅ YES                  |
| Call Apex             | ❌ NO            | ✅ YES                  |
| Need record Id        | ❌ Not available | ✅ Available            |
| Query related records | ⚠️ Limited       | ✅ YES                  |

---

**Reference Date:** 2025-12-16
**Documentation:** Official Salesforce Metadata API v65.0
**Tool:** Use `retrieve_schema` for all component definitions

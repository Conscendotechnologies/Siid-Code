# Salesforce Workflow Field Update Creation Instructions

## Overview

This guide provides instructions for creating Field Update workflow actions in Salesforce. Field Updates are used in Approval Processes, Process Builder, and Workflow Rules to automatically update field values when certain conditions are met.

---

## 🚨 CRITICAL INSTRUCTIONS - READ FIRST 🚨

**YOU MUST FOLLOW THESE INSTRUCTIONS EXACTLY AS WRITTEN. NO EXCEPTIONS. NO SHORTCUTS. NO ASSUMPTIONS.**

### **Type A vs Type B Scenarios**

**Type A (Complete Information Provided):** User provides detailed scenario with specific values in their initial prompt.

**Type B (Minimal Information):** User provides basic request without specific details.

---

### **Type A Workflow - Strict Rules**

**When user provides complete scenario details, you MUST:**

**✅ ALLOWED TO SKIP (Extract from user's prompt without re-asking):**

- Field names user mentioned (e.g., "Rating", "Status**c", "Active**c")
- Literal values user mentioned (e.g., "Hot", "Approved", "Yes")
- Operation types user mentioned (e.g., "set to", "update to", "formula")

**❌ NEVER ALLOWED TO SKIP (ALWAYS display and ask user to confirm/select):**

- **Picklist value selection:** ALWAYS retrieve values, ALWAYS display ALL values, ALWAYS ask user to select or confirm
- **Field selection when multiple similar fields exist:** Display options, ask user to select

**Type A Example:**

User says: "Update Account Rating to Hot on approval"

**✅ CORRECT Type A Workflow:**

1. Extract: Field = "Rating", Value = "Hot", Operation = Literal
2. Retrieve object metadata for Account
3. Read field metadata for Rating field
4. Extract ALL valid picklist values
5. Display all values to user in numbered list
6. Validate "Hot" exists in the list
7. Ask: "I found 'Hot' as a valid value (#2 in the list). Confirm using 'Hot'? (Enter number or confirm)"
8. WAIT for user response
9. Use the confirmed value in XML

**❌ WRONG Type A Workflow:**

1. Extract: Field = "Rating", Value = "Hot"
2. Query to check if "Hot" is valid
3. If valid: Use it directly in XML ← **VIOLATION - NEVER DO THIS**

---

## When to Use These Instructions

Use these instructions when you need to **create a new Field Update action** for:

- Approval Processes
- Workflow Rules
- Process Builder processes

**Note:** If you need to select from existing Field Updates, refer to the main approval process or workflow instructions.

---

## Prerequisites

Before creating a Field Update, ensure you have:

1. Identified the Salesforce object (e.g., Account, Contact, Opportunity)
2. Retrieved object metadata if needed
3. Identified the workflow file location: `force-app/main/default/workflows/{ObjectApiName}.workflow-meta.xml`

---

## **Picklist Value Retrieval Pattern**

**⚠️ CRITICAL: When a user selects a picklist field, you MUST retrieve and display valid picklist values before accepting user input.**

**STRICT ENFORCEMENT:**

❌ **NEVER:** Ask for picklist value without retrieving valid values first | Accept user input without validation | Assume or guess values | Use SOQL queries (SELECT ... FROM PicklistValue or FieldDefinition)
✅ **ALWAYS:** Use `<retrieve_sf_metadata>` tool → Read field metadata file OR use `sf` command for StandardValueSet → Extract `<fullName>` values → Display to user → Validate selection (case-sensitive)

---

### **Retrieval Steps**

**1. Retrieve Object Metadata (if not already done)**

```
<retrieve_sf_metadata>
  metadata_type: "CustomObject"
</retrieve_sf_metadata>
```

**2. Read Field Metadata File**

- **Location:** `force-app/main/default/objects/<ObjectName>/fields/<FieldName>.field-meta.xml`
- **Example:** `force-app/main/default/objects/Account/fields/Industry.field-meta.xml`

**3. Extract Picklist Values - Check Three Cases**

After reading the field metadata file, determine which case applies:

---

#### **CASE A: Custom Picklist with valueSetDefinition**

Field metadata contains `<valueSet>` → `<valueSetDefinition>`:

```xml
<valueSet>
    <valueSetDefinition>
        <value><fullName>Agriculture</fullName></value>
        <value><fullName>Education</fullName></value>
        <value><fullName>Healthcare</fullName></value>
    </valueSetDefinition>
</valueSet>
```

**Action:** Extract ONLY `<fullName>` values (NOT labels) → Proceed to Step 5

---

#### **CASE B: Global Value Set**

Field metadata contains `<valueSetName>` instead of `<valueSetDefinition>`:

```xml
<valueSet>
    <valueSetName>GlobalValueSetName</valueSetName>
</valueSet>
```

**Action:**

- Read: `force-app/main/default/globalValueSets/<ValueSetName>.globalValueSet-meta.xml`
- Extract from `<customValue>` → `<fullName>` blocks → Proceed to Step 5

---

#### **CASE C: Standard Field (NO valueSet section)**

Field metadata contains ONLY basic info (NO `<valueSet>` section):

```xml
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Type</fullName>
    <trackFeedHistory>false</trackFeedHistory>
    <type>Picklist</type>
</CustomField>
```

This is a **Standard Field** - values are in StandardValueSets.

**Step 1: Retrieve All Standard Value Sets (if not already done)**

Use the `sf` command to retrieve StandardValueSets:

```bash
sf project retrieve start --metadata StandardValueSet
```

This retrieves all StandardValueSet files to: `force-app/main/default/standardValueSets/`

**Step 2: Smart Matching Logic**

Try matching in this order:

1. **ObjectName + FieldName:** `Account` + `Rating` → Look for `AccountRating.standardValueSet-meta.xml`
2. **FieldName alone:** Look for `Rating.standardValueSet-meta.xml`
3. **Partial matches:** If multiple matches found (e.g., `AccountRating`, `LeadRating`, `CaseRating`), collect all matches

**Step 3: Read Matching StandardValueSet Files**

Location: `force-app/main/default/standardValueSets/<MatchedName>.standardValueSet-meta.xml`

Example structure:

```xml
<StandardValueSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <sorted>false</sorted>
    <standardValue>
        <fullName>Prospect</fullName>
        <default>false</default>
        <label>Prospect</label>
    </standardValue>
    <standardValue>
        <fullName>Customer - Direct</fullName>
        <default>false</default>
        <label>Customer - Direct</label>
    </standardValue>
</StandardValueSet>
```

Extract: `<standardValue>` → `<fullName>`

**Step 4: Handle Multiple Matches**

If multiple StandardValueSets match (e.g., `AccountRating`, `LeadRating`):

- Extract values from all matched files
- Display to user:

    ```
    Multiple StandardValueSets found for field 'Rating':
    1. AccountRating (3 values)
    2. LeadRating (3 values)

    Which StandardValueSet should be used? (Provide number)
    ```

- After user selects, use values from that StandardValueSet

---

**4. Summary of Value Extraction Paths**

- **Custom picklist:** `<valueSet>` → `<valueSetDefinition>` → `<value>` → `<fullName>`
- **Global value set:** `<valueSet>` → `<valueSetName>` → Read global file → `<customValue>` → `<fullName>`
- **Standard field:** No `<valueSet>` → Use `sf project retrieve start --metadata StandardValueSet` → Smart match by name (ObjectName+FieldName or FieldName) → Read matched file → `<standardValue>` → `<fullName>`

**5. Display Values to User**

Format: `[Number]. [fullName]`

Example:

```
Available values for Industry:
1. Agriculture
2. Education
3. Healthcare
4. Technology
5. Finance
```

**6. Get User Selection & Validate**

Ask: "Which value should be used? (Provide number or exact value)"

Validate:

- Number selection: Map to corresponding value
- Text input: Case-sensitive exact match required
- No match: Display error, ask again

**7. Use in Field Update XML**

```xml
<fieldUpdates>
    <field>Industry</field>
    <literalValue>Technology</literalValue>
    <operation>Literal</operation>
</fieldUpdates>
```

---

### **Special Cases**

**Multiselect Picklists:**

- Values are semicolon-separated: `Value1;Value2;Value3`
- Ask: "Select multiple values? (comma-separated numbers)"

**Inactive Values:**

- Check for `<isActive>false</isActive>`
- Display with warning: `4. Deprecated_Value (Inactive - not recommended)`

---

### **Picklist Violations & Corrections**

| ❌ WRONG                                            | ✅ CORRECT                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Asking "What value for Industry?" without retrieval | Retrieve metadata, display values, then ask                                                         |
| Accept "education" (lowercase)                      | Validate case-sensitive: "Education"                                                                |
| Use picklist label in XML                           | Always use `<fullName>` value                                                                       |
| Skip retrieval (user knows values)                  | ALWAYS retrieve and validate                                                                        |
| Use SOQL/FieldDefinition for standard fields        | Use `<retrieve_sf_metadata>` + Read file OR `sf project retrieve start --metadata StandardValueSet` |
| Use `retrieve_sf_metadata` for StandardValueSets    | Use `sf project retrieve start --metadata StandardValueSet` command                                 |
| Auto-select from multiple StandardValueSet matches  | Present ALL matches with value counts, get user selection                                           |

---

## When to Create New Field Updates

**Check if the user already specified field updates in their initial request.**

**Examples of user requests:**

- "After initial submission, update Account Rating to Cold"
- "On final approval, set Active to Yes"
- "When rejected, change Status to Rejected"

**Decision Logic:**

- **If user specified field updates:** Proceed with creation automatically
- **If NOT specified:** Ask: "Do you want to create new field update actions? (Type 'no' to use only existing actions)"
    - **WAIT for user response**
    - **If NO:** Return to main workflow
    - **If YES:** Continue with creation process below

---

## Step 1: Auto-Generate Developer Name (fullName)

**Pattern:** Convert description to API name format

**Rules:**

- Remove special characters (keep only letters, numbers, underscores)
- Replace spaces with underscores
- Use CamelCase or underscore_case
- Maximum clarity for developer name

**Examples:**

- "Update Active to No on Rejection" → `Update_Active_to_No_on_Rejection`
- "Set Status to Approved" → `Set_Status_to_Approved`
- "Clear Description Field" → `Clear_Description_Field`

**Generate fullName automatically from the action description (no need to ask user for this technical detail)**

---

## Step 2: Collect Field Update Information

### 2.1 Field to Update

**If user already specified field in request:**

- Use that field directly
- Example: User said "update Account Rating" → Use field `Rating`

**If NOT specified:**

- Display object fields (should already be available from earlier steps)
- Ask: "Which field should be updated? (Provide number or field API name)"
- **WAIT for user selection**

---

### 2.2 Operation Type

**Ask:** "What type of update operation?"

**Display options:**

```
1. Literal (specific value)
2. Formula
3. NextValue (next picklist value)
4. PreviousValue (previous picklist value)
5. LookupValue (value from related record)
```

**WAIT for user selection.**

---

### 2.3 Value Based on Operation

#### **IF Operation = Literal:**

**STEP 1: Detect Field Type (MANDATORY)**

1. Retrieve object metadata (if not already done):

    ```xml
    <retrieve_sf_metadata>
      metadata_type: "CustomObject"
    </retrieve_sf_metadata>
    ```

2. Read field metadata file:

    - Path: `force-app/main/default/objects/<ObjectName>/fields/<FieldName>.field-meta.xml`
    - Example: `force-app/main/default/objects/Account/fields/Rating.field-meta.xml`

3. Check `<type>` tag to identify field type
    - Look for: `<type>Picklist</type>` or `<type>MultiselectPicklist</type>`

**STEP 2: Get Value Based on Field Type**

**IF field type is Picklist or MultiselectPicklist:**

- **⚠️ MANDATORY: Use Picklist Value Retrieval Pattern**
- **DO NOT use SOQL queries** (e.g., `SELECT ... FROM PicklistValue` or `FieldDefinition`)
- **MUST use this approach:**
    1. Retrieve field metadata (already done in Step 1)
    2. Read field metadata file
    3. Extract `<fullName>` values from `<valueSet>` section
    4. Display ALL valid picklist values to user
    5. Get validated selection (case-sensitive match)

**Picklist Value Extraction - Three Cases:**

**CASE A: Custom Picklist with valueSetDefinition**

```xml
<valueSet>
    <valueSetDefinition>
        <value><fullName>Agriculture</fullName></value>
        <value><fullName>Education</fullName></value>
        <value><fullName>Healthcare</fullName></value>
    </valueSetDefinition>
</valueSet>
```

**Action:** Extract ONLY `<fullName>` values (NOT labels)

**CASE B: Global Value Set**

```xml
<valueSet>
    <valueSetName>GlobalValueSetName</valueSetName>
</valueSet>
```

**Action:**

- Read: `force-app/main/default/globalValueSets/<ValueSetName>.globalValueSet-meta.xml`
- Extract from `<customValue>` → `<fullName>` blocks

**CASE C: Standard Field (NO valueSet section)**

- Use Salesforce CLI to query StandardValueSet:
    ```bash
    sf data query --query "SELECT MasterLabel, ApiName FROM StandardValueSet WHERE MasterLabel = 'Industry'" --use-tooling-api --json
    ```

**Display to user:** "Valid values for [FieldName]: 1. Value1, 2. Value2, 3. Value3..."

**Ask:** "Which value should be set? (Enter number or exact value)"

**WAIT for user selection and validate it matches a valid picklist value (case-sensitive)**

**ELSE (for non-picklist fields):**

- Ask: "What value should be set?"
- **WAIT for user input**

---

#### **IF Operation = Formula:**

**Ask:** "What formula should be used?"

**Provide examples based on field type:**

- Date field: `TODAY() + 7` (7 days from today)
- Datetime field: `NOW() + 2` (2 days from now)
- Number field: `Amount * 0.1` (10% of Amount)
- Text field: `"Status: " & Status__c`

**WAIT for user to provide formula**

---

#### **IF Operation = NextValue or PreviousValue:**

**No value needed** - these operations only work on picklist fields and automatically move to next/previous value

**Note to user:** "This operation will move to the next/previous value in the picklist order"

---

#### **IF Operation = LookupValue:**

**Ask:** "Which related field should provide the value?"

**Examples:**

- `Account.OwnerId` (Owner from related Account)
- `Owner.ManagerId` (Manager of current Owner)
- `CreatedBy.Email` (Email of record creator)

**WAIT for user input**

---

## Step 3: Generate Field Update XML

**Create the following XML structure:**

```xml
<fieldUpdates>
    <fullName>Auto_Generated_Developer_Name</fullName>
    <description>User-provided description or auto-generated from action</description>
    <field>FieldAPIName</field>
    <literalValue>Value</literalValue>
    <name>Human Readable Name</name>
    <notifyAssignee>false</notifyAssignee>
    <operation>Literal</operation>
    <protected>false</protected>
    <reevaluateOnChange>false</reevaluateOnChange>
</fieldUpdates>
```

### Field Mapping Reference

| XML Tag                | Value                         | Notes                                                   |
| ---------------------- | ----------------------------- | ------------------------------------------------------- |
| `<fullName>`           | Auto-generated developer name | From Step 1                                             |
| `<description>`        | User's description            | Optional but recommended                                |
| `<field>`              | Field API name                | From Step 2.1                                           |
| `<literalValue>`       | Specific value                | **ONLY for Literal operation**                          |
| `<formula>`            | Formula expression            | **ONLY for Formula operation**                          |
| `<lookupValue>`        | Related field path            | **ONLY for LookupValue operation**                      |
| `<lookupValueType>`    | Type of lookup                | **ONLY for LookupValue operation**                      |
| `<name>`               | Human-readable label          | Can be same as description                              |
| `<operation>`          | Operation type                | Literal, Formula, NextValue, PreviousValue, LookupValue |
| `<notifyAssignee>`     | `false`                       | Always false                                            |
| `<protected>`          | `false`                       | Always false                                            |
| `<reevaluateOnChange>` | `false`                       | Always false                                            |

---

### ⚠️ CRITICAL XML RULES

**Tag Usage Rules:**

- ✅ Use `<literalValue>` **ONLY** for Literal operation
- ✅ Use `<formula>` **ONLY** for Formula operation
- ❌ **NEVER** include both `<literalValue>` and `<formula>` in same field update
- ✅ NextValue/PreviousValue operations **DO NOT** use literalValue or formula tags
- ✅ LookupValue uses `<lookupValue>` and `<lookupValueType>` tags

**Examples:**

**Literal Operation:**

```xml
<fieldUpdates>
    <fullName>Set_Status_to_Approved</fullName>
    <description>Set Status to Approved on final approval</description>
    <field>Status__c</field>
    <literalValue>Approved</literalValue>
    <name>Set Status to Approved</name>
    <notifyAssignee>false</notifyAssignee>
    <operation>Literal</operation>
    <protected>false</protected>
    <reevaluateOnChange>false</reevaluateOnChange>
</fieldUpdates>
```

**Formula Operation:**

```xml
<fieldUpdates>
    <fullName>Set_Expiration_Date</fullName>
    <description>Set expiration to 30 days from today</description>
    <field>Expiration_Date__c</field>
    <formula>TODAY() + 30</formula>
    <name>Set Expiration Date</name>
    <notifyAssignee>false</notifyAssignee>
    <operation>Formula</operation>
    <protected>false</protected>
    <reevaluateOnChange>false</reevaluateOnChange>
</fieldUpdates>
```

**NextValue Operation:**

```xml
<fieldUpdates>
    <fullName>Move_to_Next_Stage</fullName>
    <description>Move to next stage in picklist</description>
    <field>Stage__c</field>
    <name>Move to Next Stage</name>
    <notifyAssignee>false</notifyAssignee>
    <operation>NextValue</operation>
    <protected>false</protected>
    <reevaluateOnChange>false</reevaluateOnChange>
</fieldUpdates>
```

---

## Step 4: Update Workflow File

### 4.1 Read Existing Workflow File

**Path:** `force-app/main/default/workflows/{ObjectApiName}.workflow-meta.xml`

**Examples:**

- Account: `force-app/main/default/workflows/Account.workflow-meta.xml`
- Opportunity: `force-app/main/default/workflows/Opportunity.workflow-meta.xml`
- Custom Object: `force-app/main/default/workflows/Custom_Object__c.workflow-meta.xml`

**Use Read tool to open the file**

---

### 4.2 If File Doesn't Exist, Create New File

**If workflow file doesn't exist, create it with this structure:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">
</Workflow>
```

---

### 4.3 Insert New `<fieldUpdates>` Block

**Rules:**

- Insert BEFORE the closing `</Workflow>` tag
- Maintain proper XML indentation (4 spaces)
- If other `<fieldUpdates>` blocks exist, add the new one after them
- Each field update is a separate `<fieldUpdates>` block

**Example workflow file with multiple field updates:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">
    <fieldUpdates>
        <fullName>Existing_Field_Update</fullName>
        <field>SomeField__c</field>
        <literalValue>Value1</literalValue>
        <name>Existing Field Update</name>
        <notifyAssignee>false</notifyAssignee>
        <operation>Literal</operation>
        <protected>false</protected>
        <reevaluateOnChange>false</reevaluateOnChange>
    </fieldUpdates>
    <fieldUpdates>
        <fullName>New_Field_Update</fullName>
        <field>NewField__c</field>
        <literalValue>Value2</literalValue>
        <name>New Field Update</name>
        <notifyAssignee>false</notifyAssignee>
        <operation>Literal</operation>
        <protected>false</protected>
        <reevaluateOnChange>false</reevaluateOnChange>
    </fieldUpdates>
</Workflow>
```

---

### 4.4 Write Updated Workflow File

**Use Write or Edit tool to save the updated workflow file**

**Confirm to user:** "Created field update: [FullName] in workflow file"

---

## Step 5: Reference in Approval Process (If Applicable)

**If creating field update for an Approval Process, return the reference information:**

**XML Reference Structure:**

```xml
<action>
    <name>Auto_Generated_Developer_Name</name>
    <type>FieldUpdate</type>
</action>
```

**Tell the user:** "This field update should be added to the approval process in the appropriate action section:"

- Initial submission → `<initialSubmissionActions>`
- Final approval → `<finalApprovalActions>`
- Final rejection → `<finalRejectionActions>`
- Recall → `<recallActions>`

**The main approval process workflow will handle adding this reference.**

---

## Step 6: Deployment Order (CRITICAL)

**⚠️ MANDATORY: When creating new field updates for approval processes:**

### Deployment Sequence

**1. Deploy workflow file FIRST**

```bash
sf project deploy start --source-dir force-app/main/default/workflows/{ObjectApiName}.workflow-meta.xml
```

**Example:**

```bash
sf project deploy start --source-dir force-app/main/default/workflows/Account.workflow-meta.xml
```

**2. Wait for deployment success**

- Check for deployment completion
- Verify no errors occurred

**3. THEN deploy approval process file**

```bash
sf project deploy start --source-dir force-app/main/default/approvalProcesses/{ObjectApiName}.{ProcessName}.approvalProcess-meta.xml
```

**Example:**

```bash
sf project deploy start --source-dir force-app/main/default/approvalProcesses/Account.Account_Approval_Process.approvalProcess-meta.xml
```

### Why This Order Matters

**Reason:** Approval processes reference workflow actions by name. The workflow actions must exist in the Salesforce org before the approval process that references them can be deployed.

**If you deploy in wrong order:** Deployment will fail with error: "Field Update 'XYZ' not found"

---

## Summary Checklist

Before completing field update creation, verify:

- [ ] Auto-generated developer name (fullName) from description
- [ ] Identified field to update
- [ ] Selected operation type
- [ ] For Literal operation on picklist fields: Retrieved and validated picklist values
- [ ] Generated correct XML structure with appropriate tags
- [ ] Used ONLY `<literalValue>` OR `<formula>` (never both)
- [ ] Updated workflow file with new `<fieldUpdates>` block
- [ ] Noted deployment order (workflow FIRST, then approval process)
- [ ] Returned reference information for approval process

---

## Common Mistakes to Avoid

❌ **DON'T:**

- Use SOQL queries to get picklist values
- Include both `<literalValue>` and `<formula>` tags
- Deploy approval process before workflow file
- Skip picklist value validation for Literal operations
- Use picklist labels instead of API values
- Forget to check field type before asking for value

✅ **DO:**

- Use field metadata files to get picklist values
- Extract exact `<fullName>` values from metadata
- Display all valid picklist values to user
- Validate user's picklist selection is case-sensitive match
- Deploy workflow file first, then approval process
- Auto-generate developer names from descriptions

---

## Return to Main Workflow

After completing field update creation, return control to the main approval process or workflow instructions that called this guide.

**Provide summary:** "Created field update '[FullName]' for field '[FieldAPIName]' with operation '[Operation]'"

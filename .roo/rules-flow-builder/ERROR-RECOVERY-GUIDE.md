# Flow Builder - Error Recovery Guide

**Purpose:** This guide provides detailed recovery steps for the most common errors encountered during flow creation, with specific instructions for AI to fix issues automatically.

**Note:** Your dedicated PMD extension for flows provides structured error messages with suggested solutions. This guide shows how to interpret and act on those error messages.

---

## 🎯 5-Step Recovery Protocol

When validation fails, AI should follow this protocol:

1. **STOP** - Do not proceed to the next phase
2. **IDENTIFY** - Parse error message and determine root cause
3. **FIX** - Apply the suggested fix from error message
4. **RE-VALIDATE** - Run validation again to confirm fix
5. **PROCEED** - Continue workflow only after all checks pass

---

## 📋 Common Error Scenarios

### Error Category: Structural Errors (From PMD Extension)

---

### Error #1: Missing Required Metadata Field

**Error Message from PMD Extension:**

```json
{
	"rule": "MissingRequiredMetadata",
	"severity": "error",
	"field": "areMetricsLoggedToDataCloud",
	"message": "Required field 'areMetricsLoggedToDataCloud' is missing from Flow metadata",
	"location": "Flow root element",
	"impact": "Deployment will fail - Salesforce requires this field in API v60.0+",
	"suggested_fix": "Add <areMetricsLoggedToDataCloud>false</areMetricsLoggedToDataCloud> after <apiVersion> element",
	"example": "<apiVersion>65.0</apiVersion>\n<areMetricsLoggedToDataCloud>false</areMetricsLoggedToDataCloud>"
}
```

**Recovery Steps:**

1. **STOP** - Validation failed, do not proceed to next phase

2. **IDENTIFY**

    - Missing required metadata field: `areMetricsLoggedToDataCloud`
    - Salesforce requires this field in API v60.0+
    - Field should be added after `<apiVersion>` element

3. **FIX** - Edit the flow XML file:

    **Read current content:**

    ```
    Use Read tool to read the flow file
    ```

    **Apply fix using Edit tool:**

    ```xml
    OLD:
    <apiVersion>65.0</apiVersion>
    <interviewLabel>Flow Name {!$Flow.CurrentDateTime}</interviewLabel>

    NEW:
    <apiVersion>65.0</apiVersion>
    <areMetricsLoggedToDataCloud>false</areMetricsLoggedToDataCloud>
    <interviewLabel>Flow Name {!$Flow.CurrentDateTime}</interviewLabel>
    ```

4. **RE-VALIDATE** - Read file again and verify field is present

5. **PROCEED** - Continue with remaining validation checks

**Other Common Missing Metadata Fields:**

- `environments` - Add: `<environments>Default</environments>`
- `interviewLabel` - Add: `<interviewLabel>Flow Name {!$Flow.CurrentDateTime}</interviewLabel>`
- `processMetadataValues` - Add all 3 required values (see Error #2)

---

### Error #2: Missing processMetadataValues

**Error Message from PMD Extension:**

```json
{
	"rule": "MissingRequiredMetadata",
	"severity": "error",
	"field": "processMetadataValues",
	"message": "Flow is missing required processMetadataValues (BuilderType, CanvasMode, OriginBuilderType)",
	"location": "Flow root element",
	"impact": "Flow may not open correctly in Salesforce Flow Builder",
	"suggested_fix": "Add all 3 required processMetadataValues elements",
	"missing_values": ["BuilderType", "CanvasMode", "OriginBuilderType"]
}
```

**Recovery Steps:**

1. **STOP** - Validation failed

2. **IDENTIFY** - Missing processMetadataValues (all 3 required)

3. **FIX** - Add all processMetadataValues before `<start>` element:

    ```xml
    <processMetadataValues>
        <name>BuilderType</name>
        <value>
            <stringValue>LightningFlowBuilder</stringValue>
        </value>
    </processMetadataValues>
    <processMetadataValues>
        <name>CanvasMode</name>
        <value>
            <stringValue>AUTO_LAYOUT_CANVAS</stringValue>
        </value>
    </processMetadataValues>
    <processMetadataValues>
        <name>OriginBuilderType</name>
        <value>
            <stringValue>LightningFlowBuilder</stringValue>
        </value>
    </processMetadataValues>
    ```

4. **RE-VALIDATE** - Confirm all 3 processMetadataValues are present

5. **PROCEED** - Continue validation

---

### Error #3: Invalid Connector Reference

**Error Message from PMD Extension:**

```json
{
	"rule": "InvalidConnectorReference",
	"severity": "error",
	"connector": "targetReference='Process_Records'",
	"source_element": "Check_Status (decisions)",
	"location": "line 156",
	"message": "Connector references non-existent element 'Process_Records'",
	"impact": "Flow will have broken path - element not reachable",
	"available_elements": ["Create_Lead", "Update_Account", "Send_Email", "Success_Screen"],
	"suggested_fix": "Change targetReference to an existing element or create the missing 'Process_Records' element",
	"possible_typos": ["Process_Record (1 character difference)", "Process_Records_Loop (partial match)"]
}
```

**Recovery Steps:**

1. **STOP** - Validation failed

2. **IDENTIFY**

    - Element `Check_Status` has connector pointing to `Process_Records`
    - Element `Process_Records` does not exist
    - Possible typo: `Process_Record` or `Process_Records_Loop`
    - Available elements: Create_Lead, Update_Account, Send_Email, Success_Screen

3. **FIX** - Choose one approach:

    **Option A: Fix typo (if element exists with different name)**

    ```xml
    OLD:
    <connector>
        <targetReference>Process_Records</targetReference>
    </connector>

    NEW:
    <connector>
        <targetReference>Process_Records_Loop</targetReference>
    </connector>
    ```

    **Option B: Create missing element**

    ```xml
    <!-- Add new element before </Flow> -->
    <assignments>
        <name>Process_Records</name>
        <label>Process Records</label>
        <locationX>176</locationX>
        <locationY>398</locationY>
        <!-- assignment items here -->
        <connector>
            <targetReference>Next_Element</targetReference>
        </connector>
    </assignments>
    ```

    **Option C: Point to existing element**

    ```xml
    OLD:
    <connector>
        <targetReference>Process_Records</targetReference>
    </connector>

    NEW:
    <connector>
        <targetReference>Update_Account</targetReference>
    </connector>
    ```

4. **RE-VALIDATE** - Verify connector points to valid element

5. **PROCEED** - Continue validation

---

### Error #4: Duplicate Element Names

**Error Message from PMD Extension:**

```json
{
	"rule": "DuplicateElementName",
	"severity": "error",
	"element_name": "Create_Lead",
	"occurrences": 2,
	"locations": ["line 123 (recordCreates)", "line 245 (screens)"],
	"message": "Element name 'Create_Lead' is used 2 times - all element names must be unique",
	"impact": "Flow will fail to save - Salesforce requires unique element names",
	"suggested_fix": "Rename one of the elements (e.g., 'Create_Lead_Screen' or 'Create_Lead_Record')"
}
```

**Recovery Steps:**

1. **STOP** - Validation failed

2. **IDENTIFY**

    - Name `Create_Lead` is used twice
    - Line 123: recordCreates element
    - Line 245: screens element

3. **FIX** - Rename one element to make it unique:

    **Rename the screen element:**

    ```xml
    OLD (line 245):
    <screens>
        <name>Create_Lead</name>
        <label>Create Lead</label>

    NEW:
    <screens>
        <name>Create_Lead_Screen</name>
        <label>Create Lead Screen</label>
    ```

    **Update all connectors that reference the renamed element:**

    ```xml
    OLD:
    <connector>
        <targetReference>Create_Lead</targetReference>
    </connector>

    NEW:
    <connector>
        <targetReference>Create_Lead_Screen</targetReference>
    </connector>
    ```

4. **RE-VALIDATE** - Verify all element names are unique and connectors updated

5. **PROCEED** - Continue validation

---

### Error Category: Performance Errors (Governor Limits)

---

### Error #5: DML Statement in Loop

**Error Message from PMD Extension:**

```json
{
	"rule": "DMLStatementInLoop",
	"severity": "error",
	"element": "Update_Opportunity",
	"elementType": "recordUpdates",
	"location": "line 245",
	"loop": "Process_Opportunities_Loop",
	"loopLocation": "line 198",
	"message": "recordUpdates element 'Update_Opportunity' is connected from loop 'Process_Opportunities_Loop' nextValueConnector",
	"impact": "CRITICAL - Will hit governor limits with bulk data (200+ records)",
	"suggested_fix": "Move DML outside loop: Use Assignment inside loop to modify records, then perform bulk DML after loop completes",
	"fix_pattern": "Loop → Assignment (modify field) → Loop back → After Loop → DML (bulk update)"
}
```

**Recovery Steps:**

1. **STOP** - Validation failed - CRITICAL ERROR

2. **IDENTIFY**

    - DML element `Update_Opportunity` is inside loop
    - Loop name: `Process_Opportunities_Loop`
    - This will cause governor limit violations (max 150 DML statements per transaction)

3. **FIX** - Restructure to move DML outside loop:

    **Current (WRONG) Structure:**

    ```
    Loop → Update_Opportunity (DML) → Loop back
    ```

    **New (CORRECT) Structure:**

    ```
    Loop → Assignment (modify fields) → Loop back
    ↓
    After Loop → Update_Opportunity (bulk DML)
    ```

    **Step-by-step fix:**

    **a. Find the loop element:**

    ```xml
    <loops>
        <name>Process_Opportunities_Loop</name>
        <collectionReference>OpportunityCollection</collectionReference>
        <nextValueConnector>
            <targetReference>Update_Opportunity</targetReference>  <!-- WRONG -->
        </nextValueConnector>
        <noMoreValuesConnector>
            <targetReference>After_Loop_Element</targetReference>
        </noMoreValuesConnector>
    </loops>
    ```

    **b. Create Assignment element to replace DML inside loop:**

    ```xml
    <assignments>
        <name>Update_Opp_Fields</name>
        <label>Update Opportunity Fields</label>
        <locationX>176</locationX>
        <locationY>278</locationY>
        <assignmentItems>
            <assignToReference>Process_Opportunities_Loop.Status__c</assignToReference>
            <operator>Assign</operator>
            <value>
                <stringValue>Updated</stringValue>
            </value>
        </assignmentItems>
        <connector>
            <targetReference>Process_Opportunities_Loop</targetReference>
        </connector>
    </assignments>
    ```

    **c. Update loop connectors:**

    ```xml
    <loops>
        <name>Process_Opportunities_Loop</name>
        <collectionReference>OpportunityCollection</collectionReference>
        <nextValueConnector>
            <targetReference>Update_Opp_Fields</targetReference>  <!-- Points to Assignment -->
        </nextValueConnector>
        <noMoreValuesConnector>
            <targetReference>Update_Opportunity</targetReference>  <!-- DML after loop -->
        </noMoreValuesConnector>
    </loops>
    ```

    **d. Update DML element to use collection:**

    ```xml
    <recordUpdates>
        <name>Update_Opportunity</name>
        <label>Update Opportunities</label>
        <locationX>176</locationX>
        <locationY>458</locationY>
        <inputReference>OpportunityCollection</inputReference>  <!-- Bulk update -->
        <connector>
            <targetReference>Success_Screen</targetReference>
        </connector>
        <faultConnector>
            <targetReference>Error_Screen</targetReference>
        </faultConnector>
    </recordUpdates>
    ```

4. **RE-VALIDATE** - Run PMD validation again, verify DML is outside loop

5. **PROCEED** - Continue validation

---

### Error #6: SOQL Query in Loop

**Error Message from PMD Extension:**

```json
{
	"rule": "SOQLQueryInLoop",
	"severity": "error",
	"element": "Get_Related_Contacts",
	"elementType": "recordLookups",
	"location": "line 312",
	"loop": "Account_Loop",
	"loopLocation": "line 245",
	"message": "recordLookups element 'Get_Related_Contacts' is connected from loop 'Account_Loop' nextValueConnector",
	"impact": "CRITICAL - Will hit governor limits (max 100 SOQL queries per transaction)",
	"suggested_fix": "Move SOQL outside loop: Query all records before loop, then filter inside loop using Decision or Assignment"
}
```

**Recovery Steps:**

1. **STOP** - Validation failed - CRITICAL ERROR

2. **IDENTIFY**

    - SOQL element `Get_Related_Contacts` is inside loop
    - This will cause governor limit violations (max 100 SOQL queries per transaction)

3. **FIX** - Move SOQL before loop:

    **Current (WRONG) Structure:**

    ```
    Loop → Get_Related_Contacts (SOQL for each account) → Loop back
    ```

    **New (CORRECT) Structure:**

    ```
    Get_Related_Contacts (SOQL once, all contacts) → Loop → Decision (filter) → Loop back
    ```

    **a. Move recordLookups before loop:**

    ```xml
    <!-- Before loop, get ALL contacts at once -->
    <recordLookups>
        <name>Get_Related_Contacts</name>
        <label>Get All Related Contacts</label>
        <locationX>176</locationX>
        <locationY>158</locationY>
        <assignNullValuesIfNoRecordsFound>false</assignNullValuesIfNoRecordsFound>
        <connector>
            <targetReference>Account_Loop</targetReference>
        </connector>
        <filterLogic>and</filterLogic>
        <filters>
            <field>AccountId</field>
            <operator>In</operator>
            <value>
                <elementReference>AccountCollection.Id</elementReference>
            </value>
        </filters>
        <getFirstRecordOnly>false</getFirstRecordOnly>
        <object>Contact</object>
        <storeOutputAutomatically>true</storeOutputAutomatically>
    </recordLookups>
    ```

    **b. Update Start element connector:**

    ```xml
    <start>
        <!-- ... -->
        <connector>
            <targetReference>Get_Related_Contacts</targetReference>  <!-- SOQL before loop -->
        </connector>
    </start>
    ```

    **c. Inside loop, use Decision to filter:**

    ```xml
    <loops>
        <name>Account_Loop</name>
        <collectionReference>AccountCollection</collectionReference>
        <nextValueConnector>
            <targetReference>Check_Contact_Match</targetReference>  <!-- Decision element -->
        </nextValueConnector>
        <noMoreValuesConnector>
            <targetReference>After_Loop</targetReference>
        </noMoreValuesConnector>
    </loops>

    <decisions>
        <name>Check_Contact_Match</name>
        <label>Check if Contact Belongs to Current Account</label>
        <rules>
            <name>Contact_Matches</name>
            <conditionLogic>and</conditionLogic>
            <conditions>
                <leftValueReference>Get_Related_Contacts.AccountId</leftValueReference>
                <operator>EqualTo</operator>
                <rightValue>
                    <elementReference>Account_Loop.Id</elementReference>
                </rightValue>
            </conditions>
            <connector>
                <targetReference>Process_Contact</targetReference>
            </connector>
        </rules>
        <defaultConnector>
            <targetReference>Account_Loop</targetReference>
        </defaultConnector>
    </decisions>
    ```

4. **RE-VALIDATE** - Run PMD validation, verify SOQL is outside loop

5. **PROCEED** - Continue validation

---

### Error Category: Logic Errors

---

### Error #7: Missing Fault Connector

**Error Message from PMD Extension:**

```json
{
	"rule": "MissingFaultPath",
	"severity": "warning",
	"element": "Create_Task",
	"elementType": "recordCreates",
	"location": "line 312",
	"message": "recordCreates element 'Create_Task' does not have faultConnector defined",
	"impact": "MODERATE - Unhandled errors will cause flow to fail without proper error message",
	"suggested_fix": "Add <faultConnector><targetReference>Error_Handler</targetReference></faultConnector>",
	"fix_required": true
}
```

**Recovery Steps:**

1. **STOP** - Validation warning - should be fixed

2. **IDENTIFY**

    - DML element `Create_Task` is missing faultConnector
    - Without fault connector, flow will fail ungracefully on errors

3. **FIX** - Add faultConnector to DML element:

    **a. Add faultConnector:**

    ```xml
    OLD:
    <recordCreates>
        <name>Create_Task</name>
        <label>Create Task</label>
        <connector>
            <targetReference>Success_Screen</targetReference>
        </connector>
        <inputReference>TaskRecord</inputReference>
    </recordCreates>

    NEW:
    <recordCreates>
        <name>Create_Task</name>
        <label>Create Task</label>
        <connector>
            <targetReference>Success_Screen</targetReference>
        </connector>
        <faultConnector>
            <targetReference>Error_Screen</targetReference>
        </faultConnector>
        <inputReference>TaskRecord</inputReference>
    </recordCreates>
    ```

    **b. Create error screen if it doesn't exist:**

    ```xml
    <screens>
        <name>Error_Screen</name>
        <label>Error</label>
        <allowBack>true</allowBack>
        <allowFinish>true</allowFinish>
        <fields>
            <name>Error_Message</name>
            <dataType>String</dataType>
            <fieldText>An error occurred: {!$Flow.FaultMessage}</fieldText>
            <fieldType>DisplayText</fieldType>
        </fields>
    </screens>
    ```

4. **RE-VALIDATE** - Verify faultConnector is defined

5. **PROCEED** - Continue validation

---

### Error #8: Missing Default Connector (Decision)

**Error Message from PMD Extension:**

```json
{
	"rule": "MissingDefaultConnector",
	"severity": "error",
	"element": "Check_Status",
	"elementType": "decisions",
	"location": "line 198",
	"message": "Decision element 'Check_Status' does not have defaultConnector defined",
	"impact": "CRITICAL - Flow will fail if no decision outcome matches",
	"suggested_fix": "Add <defaultConnector><targetReference>Default_Path</targetReference></defaultConnector>",
	"outcomes_defined": 2
}
```

**Recovery Steps:**

1. **STOP** - Validation failed - CRITICAL ERROR

2. **IDENTIFY**

    - Decision element `Check_Status` is missing defaultConnector
    - Default connector is REQUIRED for all decisions

3. **FIX** - Add defaultConnector:

    ```xml
    OLD:
    <decisions>
        <name>Check_Status</name>
        <label>Check Status</label>
        <rules>
            <name>Status_Active</name>
            <!-- ... -->
        </rules>
        <rules>
            <name>Status_Inactive</name>
            <!-- ... -->
        </rules>
    </decisions>

    NEW:
    <decisions>
        <name>Check_Status</name>
        <label>Check Status</label>
        <defaultConnector>
            <targetReference>Default_Action</targetReference>
        </defaultConnector>
        <defaultConnectorLabel>Other Status</defaultConnectorLabel>
        <rules>
            <name>Status_Active</name>
            <!-- ... -->
        </rules>
        <rules>
            <name>Status_Inactive</name>
            <!-- ... -->
        </rules>
    </decisions>
    ```

4. **RE-VALIDATE** - Verify defaultConnector is defined

5. **PROCEED** - Continue validation

---

### Error Category: Screen Flow Specific Errors

---

### Error #9: Screen Field Uses targetReference (CRITICAL)

**Error Message from PMD Extension:**

```json
{
	"rule": "ScreenFieldTargetReference",
	"severity": "error",
	"element": "Email_Field",
	"location": "line 89",
	"message": "Screen field 'Email_Field' uses targetReference - this is incorrect for screen fields",
	"impact": "CRITICAL - Field will not display or function correctly",
	"suggested_fix": "Remove <targetReference> from screen field. Use Assignment element after screen to assign field value to variable.",
	"found_value": "targetReference='EmailVar'"
}
```

**Recovery Steps:**

1. **STOP** - Validation failed - CRITICAL ERROR

2. **IDENTIFY**

    - Screen field `Email_Field` has `targetReference` property
    - Screen fields should NEVER use targetReference
    - Use Assignment element instead

3. **FIX** - Remove targetReference and use Assignment:

    **a. Remove targetReference from screen field:**

    ```xml
    OLD:
    <fields>
        <name>Email_Field</name>
        <extensionName>flowruntime:email</extensionName>
        <fieldType>ComponentInstance</fieldType>
        <targetReference>EmailVar</targetReference>  <!-- WRONG! -->
        <isRequired>true</isRequired>
        <storeOutputAutomatically>true</storeOutputAutomatically>
    </fields>

    NEW:
    <fields>
        <name>Email_Field</name>
        <extensionName>flowruntime:email</extensionName>
        <fieldType>ComponentInstance</fieldType>
        <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn>
        <isRequired>true</isRequired>
        <storeOutputAutomatically>true</storeOutputAutomatically>
        <styleProperties>
            <verticalAlignment>
                <stringValue>top</stringValue>
            </verticalAlignment>
            <width>
                <stringValue>12</stringValue>
            </width>
        </styleProperties>
    </fields>
    ```

    **b. Add Assignment element after screen:**

    ```xml
    <assignments>
        <name>Assign_Email_Value</name>
        <label>Assign Email Value</label>
        <assignmentItems>
            <assignToReference>EmailVar</assignToReference>
            <operator>Assign</operator>
            <value>
                <elementReference>Email_Field.value</elementReference>  <!-- Note .value suffix -->
            </value>
        </assignmentItems>
        <connector>
            <targetReference>Next_Element</targetReference>
        </connector>
    </assignments>
    ```

    **c. Update screen connector:**

    ```xml
    <screens>
        <name>Input_Screen</name>
        <!-- ... -->
        <connector>
            <targetReference>Assign_Email_Value</targetReference>  <!-- Points to Assignment -->
        </connector>
    </screens>
    ```

4. **RE-VALIDATE** - Verify targetReference removed and Assignment added

5. **PROCEED** - Continue validation

---

### Error #10: Missing inputsOnNextNavToAssocScrn

**Error Message from PMD Extension:**

```json
{
	"rule": "ScreenFlowRequirements",
	"severity": "error",
	"element": "Email_Field",
	"location": "line 89",
	"message": "Screen field 'Email_Field' is missing required property 'inputsOnNextNavToAssocScrn'",
	"impact": "Field value may not be preserved when user navigates back",
	"suggested_fix": "Add <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn> to the field definition"
}
```

**Recovery Steps:**

1. **STOP** - Validation failed

2. **IDENTIFY**

    - Screen field missing `inputsOnNextNavToAssocScrn` property
    - This property controls field behavior when user navigates back

3. **FIX** - Add inputsOnNextNavToAssocScrn:

    ```xml
    OLD:
    <fields>
        <name>Email_Field</name>
        <extensionName>flowruntime:email</extensionName>
        <fieldType>ComponentInstance</fieldType>
        <isRequired>true</isRequired>
        <storeOutputAutomatically>true</storeOutputAutomatically>
    </fields>

    NEW:
    <fields>
        <name>Email_Field</name>
        <extensionName>flowruntime:email</extensionName>
        <fieldType>ComponentInstance</fieldType>
        <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn>  <!-- ADD THIS -->
        <isRequired>true</isRequired>
        <storeOutputAutomatically>true</storeOutputAutomatically>
    </fields>
    ```

4. **RE-VALIDATE** - Verify property is present

5. **PROCEED** - Continue validation

---

## 🔍 Error Decision Tree

Use this decision tree to quickly identify and fix errors:

```
Error detected
    ↓
Is source "PMD_Flow_Extension"?
    ├─ YES → Use structured error format (see examples above)
    │   ↓
    │   Read "suggested_fix" from error message
    │   ↓
    │   Apply fix using Edit tool
    │   ↓
    │   Re-validate
    │
    └─ NO → Use manual troubleshooting
        ↓
        Check error category:
        ├─ "required field missing" → See Error #1-2
        ├─ "connector invalid" → See Error #3-4
        ├─ "DML in loop" → See Error #5
        ├─ "SOQL in loop" → See Error #6
        ├─ "missing fault" → See Error #7
        ├─ "missing default connector" → See Error #8
        ├─ "targetReference on screen field" → See Error #9
        └─ "missing inputsOnNextNavToAssocScrn" → See Error #10
```

---

## 📊 Error Severity Guide

**ERROR (🔴) - Must Fix:**

- Deployment will fail
- Flow will not work correctly
- STOP immediately and fix

**WARNING (🟡) - Should Fix:**

- Flow may work but is not best practice
- May cause issues in certain scenarios
- Fix before deployment recommended

**INFO (🔵) - Optional:**

- Suggestions for improvement
- Code quality recommendations
- Fix if time permits

---

## 🛠️ Recovery Checklist

After fixing any error, AI should:

1. ✅ Read the flow XML file to verify change applied correctly
2. ✅ Re-run the validation that failed
3. ✅ Verify error no longer appears
4. ✅ Check that no new errors were introduced
5. ✅ Update todo list to reflect completed fix
6. ✅ Continue with next validation step only if all checks pass

---

## 💡 Best Practices for Error Prevention

1. **Always retrieve schemas** - Use `retrieve_schema` tool before creating elements
2. **Validate frequently** - Run element validation after each element
3. **Read error messages carefully** - PMD extension provides specific fixes
4. **Test connectors** - Verify all targetReference values exist
5. **Check metadata early** - Validate required metadata fields in Phase 2
6. **Plan for bulk data** - Never put DML/SOQL in loops
7. **Handle errors gracefully** - Always add fault connectors to DML
8. **Follow patterns** - Use SCREEN-FLOW-PATTERNS.md and RECORD-TRIGGER-FLOW-PATTERNS.md

---

## 📚 Related Documentation

- [DETAILED-WORKFLOW.md](DETAILED-WORKFLOW.md) - 10-phase workflow with validation checkpoints
- [SCHEMA-RETRIEVAL-GUIDE.md](SCHEMA-RETRIEVAL-GUIDE.md) - How to use retrieve_schema tool
- [SCREEN-FLOW-PATTERNS.md](SCREEN-FLOW-PATTERNS.md) - Screen flow patterns and anti-patterns
- [RECORD-TRIGGER-FLOW-PATTERNS.md](RECORD-TRIGGER-FLOW-PATTERNS.md) - Record-triggered flow patterns
- [VALIDATION-SUMMARY.md](VALIDATION-SUMMARY.md) - Overview of validation approach

---

**Last Updated:** 2026-01-05
**Version:** 1.0

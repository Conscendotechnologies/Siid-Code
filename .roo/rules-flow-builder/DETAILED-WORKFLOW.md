# Flow Builder - Detailed 9-Phase Workflow

This document contains the complete step-by-step workflow for building Salesforce Flows. AI should retrieve and follow this when building flows.

**NOTE:** PMD validation catches schema and structure errors. However, actual deployment testing is required to catch runtime errors, missing required fields, and Salesforce-specific validation issues. Phase 9 includes iterative deployment until all errors are resolved.

---

## 📋 PHASE 1: Planning & Schema Retrieval

Create a detailed todo list for the planning phase:

```xml
<update_todo_list>
<todos>
[ ] 1.1 - Analyze user requirements and document flow purpose
[ ] 1.2 - Identify flow type (Screen/Record-Triggered/Scheduled/Autolaunched/Platform Event)
[ ] 1.3 - Identify trigger conditions (if Record-Triggered: Before/After Save, Create/Update/Delete)
[ ] 1.4 - List all required Salesforce objects (Lead, Account, Contact, Custom Objects, etc.)
[ ] 1.5 - For EACH identified object, retrieve object schema to understand fields
  [ ] 1.5.1 - Use retrieve_schema tool for each object
  [ ] 1.5.2 - Document available fields, data types, and required fields
  [ ] 1.5.3 - Identify which fields will be used in the flow
[ ] 1.6 - List all required variables (name, data type, input/output, collection vs single)
[ ] 1.7 - List all required formulas/constants/text templates
[ ] 1.8 - Map out flow logic diagram (element sequence and decision paths)
[ ] 1.9 - Identify all element types needed (Get Records, Decision, Loop, DML, etc.)
[ ] 1.10 - Retrieve Flow base schema using retrieve_schema tool
[ ] 1.11 - Retrieve schema for EACH element type identified
[ ] 1.12 - Review schemas and confirm all required fields understood
</todos>
</update_todo_list>
```

**IMPORTANT - Dynamic Schema Retrieval:**

Throughout the flow building process, if you need to reference an object or field that wasn't identified in Phase 1:

1. **STOP** - Do not proceed with incomplete information
2. **Retrieve** - Use retrieve_schema tool for the newly identified object
3. **Document** - Add to the list of retrieved schemas
4. **Verify** - Confirm the field exists and has the correct data type
5. **Continue** - Proceed with the element creation

**Execute Phase 1 tasks, then proceed to Phase 2.**

---

## 📋 PHASE 2: Flow Structure Creation (WITH VALIDATION)

```xml
<update_todo_list>
<todos>
[x] Phase 1 completed
[ ] 2.1 - Create flow metadata file at force-app/main/default/flows/FlowName.flow-meta.xml
[ ] 2.2 - Add XML declaration (<?xml version="1.0" encoding="UTF-8"?>)
[ ] 2.3 - Add Flow namespace (xmlns="http://soap.sforce.com/2006/04/metadata")
[ ] 2.4 - Add apiVersion (use 65.0 - current version)
[ ] 2.5 - Add areMetricsLoggedToDataCloud (set to false)
[ ] 2.6 - Add environments (set to "Default")
[ ] 2.7 - Add interviewLabel with dynamic datetime (e.g., "Flow Name {!$Flow.CurrentDateTime}")
[ ] 2.8 - Add label (user-friendly flow name)
[ ] 2.9 - Add processType (AutoLaunchedFlow/Flow for Screen Flows)
[ ] 2.10 - Add description (meaningful business description)
[ ] 2.11 - Add processMetadataValues for BuilderType (LightningFlowBuilder)
[ ] 2.12 - Add processMetadataValues for CanvasMode (AUTO_LAYOUT_CANVAS)
[ ] 2.13 - Add processMetadataValues for OriginBuilderType (LightningFlowBuilder)
[ ] 2.14 - IF Screen Flow: Add customProperties for ScreenProgressIndicator
  [ ] 2.14.1 - Set name to "ScreenProgressIndicator"
  [ ] 2.14.2 - Set value to {"location":"top","type":"simple"}
[ ] 2.15 - Set status to "Draft"
[ ] 2.16 - VALIDATE: Read file back using Read tool to verify XML is well-formed
[ ] 2.17 - VALIDATE: Verify processType is valid Salesforce FlowProcessType value
[ ] 2.18 - VALIDATE: Confirm namespace is http://soap.sforce.com/2006/04/metadata
[ ] 2.19 - VALIDATE: Verify areMetricsLoggedToDataCloud is present
[ ] 2.20 - VALIDATE: Verify environments is present
[ ] 2.21 - VALIDATE: Verify interviewLabel is present and contains {!$Flow.CurrentDateTime}
[ ] 2.22 - VALIDATE: Verify all three processMetadataValues are present (BuilderType, CanvasMode, OriginBuilderType)
[ ] 2.23 - VALIDATE: If Screen Flow, verify customProperties for ScreenProgressIndicator is present
[ ] 2.24 - VALIDATE: Compare structure against real-world example (see SCREEN-FLOW-PATTERNS.md)
</todos>
</update_todo_list>
```

**Validation Checkpoint:**

- Read the created file
- Verify XML syntax is correct
- **CRITICAL:** Verify ALL metadata fields present
- For Screen Flows, verify customProperties present

---

## 📋 PHASE 3: Variables & Resources (WITH VALIDATION)

For EACH variable, create a separate todo item:

```xml
<update_todo_list>
<todos>
[x] Phases 1-2 completed
[ ] 3.1 - Add variable: [VariableName] ([Type])
  [ ] 3.1.1 - Retrieve FlowVariable schema
  [ ] 3.1.2 - Add <variable> element
  [ ] 3.1.3 - Set name (API name)
  [ ] 3.1.4 - Set dataType (String/Boolean/Number/Date/DateTime/SObject/etc.)
  [ ] 3.1.5 - Set isCollection (true/false)
  [ ] 3.1.6 - Set isInput/isOutput if applicable
  [ ] 3.1.7 - If SObject: Set objectType (Lead/Account/etc.)
  [ ] 3.1.8 - VALIDATE: Verify variable name is unique
  [ ] 3.1.9 - VALIDATE: Confirm dataType is valid Salesforce type
[ ] 3.X - Add all formula definitions
[ ] 3.Y - Add all constant definitions
[ ] 3.Z - Add all text template definitions
[ ] 3.VALIDATE - Read entire file and verify all variables/formulas/constants
[ ] 3.CHECK - Ensure no duplicate variable/formula/constant names
[ ] 3.PMD - TRIGGER PMD VALIDATION: Check for UnusedVariable warnings
</todos>
</update_todo_list>
```

**Validation Checkpoint:**

- Read the complete file
- **IMPORTANT: Trigger Flow XML PMD validation** to catch unused variables
- Fix any PMD errors before proceeding

---

## 📋 PHASE 4: Start Element Configuration

```xml
<update_todo_list>
<todos>
[x] Phases 1-3 completed
[ ] 4.1 - Retrieve FlowStart schema
[ ] 4.2 - Add <start> element
[ ] 4.3 - Set locationX and locationY (both 0)
[ ] 4.4 - Configure triggerType (if Record-Triggered: RecordAfterSave/RecordBeforeSave)
[ ] 4.5 - Configure object (e.g., Account, Contact)
[ ] 4.6 - Configure recordTriggerType (Create/Update/CreateAndUpdate/Delete)
[ ] 4.7 - Add filterLogic if using multiple conditions
[ ] 4.8 - Add filters (entry criteria)
  [ ] 4.8.1 - VALIDATE: No hardcoded IDs in filter values
[ ] 4.9 - Add connector to first flow element
[ ] 4.10 - VALIDATE: Check connector references valid element name
</todos>
</update_todo_list>
```

---

## 📋 PHASE 5: Flow Elements (ONE AT A TIME)

**CRITICAL: Add ONE element at a time with complete validation before moving to next.**

**ORGANIZATION REQUIREMENTS:**

- **Properties Order:** All properties within each element MUST be in alphabetical order
- **Element Grouping:** Group same-type elements together (all screens, then all assignments, etc.)
- **Element Order:** Within each group, order elements alphabetically by name

### For Screen Elements (FlowScreen):

**IMPORTANT:** For Screen Flows, read SCREEN-FLOW-PATTERNS.md for detailed patterns and examples.

```xml
[ ] 5.X - Add Element: [Screen_Name] (FlowScreen)
  [ ] 5.X.1 - Retrieve FlowScreen schema
  [ ] 5.X.2 - Add <screens> element
  [ ] 5.X.3 - Set name, label, locationX, locationY
  [ ] 5.X.4 - Set allowBack, allowFinish, allowPause
  [ ] 5.X.5 - FOR EACH screen field:
    [ ] 5.X.5.1 - IF InputField: Set dataType, fieldText, fieldType=InputField
    [ ] 5.X.5.2 - IF ComponentInstance: Set extensionName, fieldType=ComponentInstance, storeOutputAutomatically=true
    [ ] 5.X.5.3 - Set inputsOnNextNavToAssocScrn=UseStoredValues
    [ ] 5.X.5.4 - Set isRequired
    [ ] 5.X.5.5 - Add styleProperties (verticalAlignment=top, width=12)
    [ ] 5.X.5.6 - VALIDATE: Field does NOT have targetReference
    [ ] 5.X.5.7 - VALIDATE: ComponentInstance has extensionName and storeOutputAutomatically
  [ ] 5.X.6 - Add connector
  [ ] 5.X.7 - VALIDATE: Compare against SCREEN-FLOW-PATTERNS.md
```

### For Assignment Elements (FlowAssignment):

```xml
[ ] 5.X - Add Element: [Assignment_Name] (FlowAssignment)
  [ ] 5.X.1 - VERIFY: If assigning SObject fields, object schema retrieved
  [ ] 5.X.2 - Retrieve FlowAssignment schema
  [ ] 5.X.3 - Add <assignments> element
  [ ] 5.X.4 - Set name, label, locationX, locationY
  [ ] 5.X.5 - FOR EACH assignmentItem:
    [ ] 5.X.5.1 - Set assignToReference (target variable/field)
    [ ] 5.X.5.2 - VALIDATE: Field exists in object schema (if SObject field)
    [ ] 5.X.5.3 - Set operator (Assign/Add/Subtract/etc.)
    [ ] 5.X.5.4 - Set value with elementReference:
      [ ] IF referencing InputField: <elementReference>FieldName</elementReference>
      [ ] IF referencing ComponentInstance: <elementReference>FieldName.value</elementReference>
  [ ] 5.X.6 - Add connector
  [ ] 5.X.7 - VALIDATE: Component field references include .value suffix
  [ ] 5.X.8 - VALIDATE: InputField references do NOT have .value suffix
```

### For Record Create Elements (FlowRecordCreate):

```xml
[ ] 5.X - Add Element: [RecordCreate_Name] (FlowRecordCreate)
  [ ] 5.X.1 - VERIFY: Object schema has been retrieved (retrieve if not)
  [ ] 5.X.2 - VERIFY: All required fields are known and documented
  [ ] 5.X.3 - Retrieve FlowRecordCreate schema
  [ ] 5.X.4 - Add <recordCreates> element
  [ ] 5.X.5 - Set name, label, locationX, locationY
  [ ] 5.X.6 - PREFERRED: Set inputReference to SObject variable
  [ ] 5.X.7 - ALTERNATIVE: Set object and inputAssignments (less preferred)
  [ ] 5.X.8 - VALIDATE: All field references exist in object schema
  [ ] 5.X.9 - Add connector (success path)
  [ ] 5.X.10 - Add faultConnector (error path) - REQUIRED
  [ ] 5.X.11 - VALIDATE: Fault connector is defined
  [ ] 5.X.12 - VALIDATE: Element is NOT inside a loop body
```

### For Record Update Elements (FlowRecordUpdate):

```xml
[ ] 5.X - Add Element: [RecordUpdate_Name] (FlowRecordUpdate)
  [ ] 5.X.1 - VERIFY: Object schema has been retrieved (retrieve if not)
  [ ] 5.X.2 - VERIFY: All fields to update are known and valid
  [ ] 5.X.3 - Retrieve FlowRecordUpdate schema
  [ ] 5.X.4 - Add <recordUpdates> element
  [ ] 5.X.5 - Set name, label, locationX, locationY
  [ ] 5.X.6 - Set inputReference OR filters + inputAssignments
  [ ] 5.X.7 - VALIDATE: All field references exist in object schema
  [ ] 5.X.8 - Add connector (success path)
  [ ] 5.X.9 - Add faultConnector (error path) - REQUIRED
  [ ] 5.X.10 - VALIDATE: Element is NOT inside a loop body
```

### For Get Records Elements (FlowRecordLookup):

```xml
[ ] 5.X - Add Element: [GetRecords_Name] (FlowRecordLookup)
  [ ] 5.X.1 - VERIFY: Object schema has been retrieved (retrieve if not)
  [ ] 5.X.2 - VERIFY: Filter fields exist in object schema
  [ ] 5.X.3 - Retrieve FlowRecordLookup schema
  [ ] 5.X.4 - Add <recordLookups> element
  [ ] 5.X.5 - Set name, label, locationX, locationY
  [ ] 5.X.6 - Set object (e.g., Account, Lead)
  [ ] 5.X.7 - Add filters with field references
  [ ] 5.X.8 - VALIDATE: All filter fields exist in object schema
  [ ] 5.X.9 - Set queriedFields or getFirstRecordOnly
  [ ] 5.X.10 - Add connector
```

### For Decision Elements (FlowDecision):

```xml
[ ] 5.X - Add Element: [Decision_Name] (FlowDecision)
  [ ] 5.X.1 - VERIFY: If conditions reference SObject fields, schema retrieved
  [ ] 5.X.2 - Retrieve FlowDecision schema
  [ ] 5.X.3 - Add <decisions> element
  [ ] 5.X.4 - Set name, label
  [ ] 5.X.5 - Add decision rules (outcomes) with conditions
  [ ] 5.X.6 - VALIDATE: All field references exist in schemas
  [ ] 5.X.7 - Add defaultConnector (REQUIRED)
  [ ] 5.X.8 - VALIDATE: All outcomes have connectors
  [ ] 5.X.9 - VALIDATE: Default connector is defined
```

### For Loop Elements (FlowLoop):

```xml
[ ] 5.X - Add Element: [Loop_Name] (FlowLoop)
  [ ] 5.X.1 - Retrieve FlowLoop schema
  [ ] 5.X.2 - Add <loops> element
  [ ] 5.X.3 - Set name, label
  [ ] 5.X.4 - Set collectionReference
  [ ] 5.X.5 - Set nextValueConnector (loop body)
  [ ] 5.X.6 - Set noMoreValuesConnector (after loop)
  [ ] 5.X.7 - VALIDATE: Both connectors defined
  [ ] 5.X.8 - VALIDATE: nextValueConnector does NOT point to DML element
  [ ] 5.X.9 - VALIDATE: Loop body does NOT contain recordCreates/recordUpdates/recordDeletes
```

### After All Elements:

```xml
[ ] 5.PMD - TRIGGER PMD VALIDATION
  [ ] 5.PMD.1 - Check for DMLStatementInLoop errors
  [ ] 5.PMD.2 - Check for SOQLQueryInLoop errors
  [ ] 5.PMD.3 - Check for ActionCallsInLoop errors
  [ ] 5.PMD.4 - Check for MissingFaultPath warnings
  [ ] 5.PMD.5 - Check for HardcodedId errors
  [ ] 5.PMD.6 - Fix ALL PMD errors before proceeding
```

---

## 📋 PHASE 6: Connectors & Flow Logic Validation

```xml
<update_todo_list>
<todos>
[x] Phases 1-5 completed
[ ] 6.1 - Map out complete flow connectivity graph
[ ] 6.2 - Validate Start element connector
[ ] 6.3 - Validate each element's connectors
  [ ] 6.3.1 - Decision: ALL outcomes + default connector
  [ ] 6.3.2 - Loop: nextValueConnector AND noMoreValuesConnector
  [ ] 6.3.3 - DML elements: connector AND faultConnector
[ ] 6.4 - VALIDATE: No orphaned/unconnected elements
[ ] 6.5 - VALIDATE: All connectors point to existing elements
[ ] 6.6 - VALIDATE: Flow has clear start-to-end paths
</todos>
</update_todo_list>
```

---

## 📋 PHASE 7: Error Handling & Fault Paths

```xml
<update_todo_list>
<todos>
[x] Phases 1-6 completed
[ ] 7.1 - Audit all DML elements for fault paths
  [ ] 7.1.1 - recordCreates: has faultConnector? ✓
  [ ] 7.1.2 - recordUpdates: has faultConnector? ✓
  [ ] 7.1.3 - recordDeletes: has faultConnector? ✓
[ ] 7.2 - Audit all action calls for fault paths
[ ] 7.3 - Add fault path handling logic (Screen/Assignment/Email/Log)
[ ] 7.4 - Validate fault path elements
[ ] 7.5 - CHECK: All critical operations have fault paths
[ ] 7.6 - PMD CHECK: Verify no MissingFaultPath warnings remain
</todos>
</update_todo_list>
```

---

## 📋 PHASE 8: Pre-Deployment Validation (COMPREHENSIVE)

```xml
<update_todo_list>
<todos>
[x] Phases 1-7 completed
[ ] 8.1 - Read complete flow XML file
[ ] 8.2 - VALIDATE: XML is well-formed
[ ] 8.3 - VALIDATE: All element names are unique
[ ] 8.4 - VALIDATE: Properties within each element are in alphabetical order
[ ] 8.5 - VALIDATE: Same-type elements are grouped together
[ ] 8.6 - VALIDATE: Elements within each group are in alphabetical order
[ ] 8.7 - VALIDATE: No hardcoded Salesforce IDs (15 or 18 chars)
[ ] 8.8 - VALIDATE: All variables referenced are defined
[ ] 8.9 - VALIDATE: All connectors reference valid elements
[ ] 8.10 - VALIDATE: processType is valid
[ ] 8.11 - VALIDATE: API version is current (65.0)
[ ] 8.12 - CHECK: Flow has meaningful description
[ ] 8.13 - CHECK: All elements have descriptive labels
[ ] 8.14 - CHECK: runInMode is explicitly set (if applicable)
[ ] 8.15 - IF SCREEN FLOW: Validate Screen Flow specific requirements
  [ ] 8.15.1 - Verify customProperties for ScreenProgressIndicator
  [ ] 8.15.2 - Verify all screen fields have inputsOnNextNavToAssocScrn
  [ ] 8.15.3 - Verify all screen fields have styleProperties
  [ ] 8.15.4 - CHECK: No screen fields use targetReference (CRITICAL ERROR)
  [ ] 8.15.5 - Verify ComponentInstance fields have extensionName
  [ ] 8.15.6 - Verify ComponentInstance fields have storeOutputAutomatically
  [ ] 8.15.7 - Verify Assignment uses .value for ComponentInstance fields
  [ ] 8.15.8 - Verify Assignment does NOT use .value for InputField fields
  [ ] 8.15.9 - Verify recordCreates uses inputReference (preferred)
  [ ] 8.15.10 - CHECK: No HTML comments in XML
  [ ] 8.15.11 - CHECK: No explicit <end> elements
  [ ] 8.15.12 - VALIDATE: Compare against SCREEN-FLOW-PATTERNS.md
[ ] 8.16 - VALIDATE: All required metadata fields present
  [ ] 8.16.1 - areMetricsLoggedToDataCloud is present
  [ ] 8.16.2 - environments is present
  [ ] 8.16.3 - interviewLabel is present with {!$Flow.CurrentDateTime}
  [ ] 8.16.4 - All 3 processMetadataValues present (BuilderType, CanvasMode, OriginBuilderType)
[ ] 8.17 - RUN COMMON ERROR CHECKLIST (see below)
[ ] 8.18 - PMD VALIDATION: Trigger full PMD scan
  [ ] 8.18.1 - Check all 21+ PMD rules
  [ ] 8.18.2 - Address ALL errors (🔴)
  [ ] 8.18.3 - Review warnings (🟡) and fix critical ones
[ ] 8.19 - Fix any issues found
[ ] 8.20 - Re-read file and confirm all fixes applied
[ ] 8.21 - FINAL CHECK: Compare entire flow against real-world example
</todos>
</update_todo_list>
```

**Common Error Prevention Checklist:**

```
[ ] ✓ No DML operations inside loop bodies
[ ] ✓ No SOQL queries inside loop bodies
[ ] ✓ No action calls inside loop bodies
[ ] ✓ All Get Records have filters OR justification
[ ] ✓ All DML use collections (bulk)
[ ] ✓ All Decision elements have default connectors
[ ] ✓ All Loop elements have both connectors
[ ] ✓ No orphaned elements
[ ] ✓ Flow has description
[ ] ✓ No hardcoded IDs
[ ] ✓ All names unique
[ ] ✓ All variables defined
[ ] ✓ All connectors valid

**Screen Flow Specific:**
[ ] ✓ NO targetReference on screen fields (CRITICAL)
[ ] ✓ ComponentInstance has extensionName
[ ] ✓ ComponentInstance has storeOutputAutomatically
[ ] ✓ All fields have inputsOnNextNavToAssocScrn
[ ] ✓ All fields have styleProperties
[ ] ✓ Assignment uses .value for ComponentInstance
[ ] ✓ Assignment NOT uses .value for InputField
[ ] ✓ customProperties present
[ ] ✓ NO HTML comments
[ ] ✓ NO explicit <end> elements
[ ] ✓ All metadata present
[ ] ✓ All 3 processMetadataValues present
```

---

## 📋 PHASE 9: Deployment (Iterative until Success)

**IMPORTANT:** PMD validation only catches schema/structure errors. Deployment testing reveals runtime errors, missing fields, and Salesforce-specific issues. Repeat deployment cycle until all errors are resolved.

```xml
<update_todo_list>
<todos>
[x] Phases 1-8 completed
[ ] 9.1 - Initial deployment with Draft status
  [ ] 9.1.1 - VERIFY: Flow status is set to "Draft" in XML
  [ ] 9.1.2 - Run: sfdx force:source:deploy
  [ ] 9.1.3 - Review deployment results
  [ ] 9.1.4 - IF ERRORS: Document all deployment errors
  [ ] 9.1.5 - IF ERRORS: Fix each error in flow XML
  [ ] 9.1.6 - IF ERRORS: Repeat 9.1.2-9.1.5 until deployment succeeds
[ ] 9.2 - Activate flow
  [ ] 9.2.1 - Change <status>Draft</status> to <status>Active</status>
  [ ] 9.2.2 - Save the file
[ ] 9.3 - Deploy with Active status
  [ ] 9.3.1 - Run: sfdx force:source:deploy
  [ ] 9.3.2 - Review deployment results
  [ ] 9.3.3 - IF ERRORS: Document all deployment errors
  [ ] 9.3.4 - IF ERRORS: Fix each error in flow XML
  [ ] 9.3.5 - IF ERRORS: Repeat 9.3.1-9.3.4 until deployment succeeds
[ ] 9.4 - Final validation
  [ ] 9.4.1 - VALIDATE: Flow appears in Salesforce Flow Builder
  [ ] 9.4.2 - VALIDATE: Flow status shows as "Active"
  [ ] 9.4.3 - VALIDATE: All elements visible and connected properly
</todos>
</update_todo_list>
```

**Deployment Error Handling Protocol:**

When deployment fails, follow this systematic approach:

1. **Capture the Error:**

    - Read the complete error message from deployment output
    - Identify the specific field, element, or structure causing the issue
    - Note the line number or element name if provided

2. **Analyze the Error:**

    - Common errors after activation:
        - Missing required fields for Active flows
        - Invalid references that only appear at runtime
        - Permission/access issues
        - Field-level validation rules
        - Required fields missing on SObjects

3. **Fix the Error:**

    - Update the flow XML file with the fix
    - Re-read the file to verify the change
    - Document what was changed

4. **Re-deploy:**

    - Run deployment command again
    - Review new results
    - Repeat cycle if new errors appear

5. **Iterate Until Success:**
    - Each deployment may reveal new errors
    - Fix systematically, one error at a time
    - Do not proceed until deployment succeeds with zero errors

**Example Error-Fix Cycle:**

```json
{
	"deployment_attempt": 3,
	"status": "Draft",
	"error": "Field 'processMetadataValues' is required",
	"fix_applied": "Added missing processMetadataValues for BuilderType",
	"result": "Deployment successful"
}
```

---

## 📊 VALIDATION OUTPUT FORMATS

### Element-Level Validation Output (After Each Element)

After creating each element, output validation results in this JSON format:

```json
{
	"validationCheckpoint": "Element_Validation",
	"element": {
		"type": "recordCreates",
		"name": "Create_Lead",
		"phase": "Phase 5 - Flow Elements"
	},
	"checks": [
		{
			"rule": "ELEMENT_WELLFORMED",
			"status": "pass",
			"message": "Element XML is well-formed"
		},
		{
			"rule": "UNIQUE_NAME",
			"status": "pass",
			"message": "Element name 'Create_Lead' is unique"
		},
		{
			"rule": "FAULT_CONNECTOR",
			"status": "pass",
			"message": "faultConnector is defined"
		},
		{
			"rule": "NOT_IN_LOOP",
			"status": "pass",
			"message": "DML element is not inside loop body"
		},
		{
			"rule": "SCHEMA_COMPLIANCE",
			"status": "pass",
			"message": "Element matches FlowRecordCreate schema"
		}
	],
	"summary": {
		"total_checks": 5,
		"passed": 5,
		"failed": 0,
		"warnings": 0
	},
	"status": "pass",
	"action": "proceed_to_next_element"
}
```

**If validation fails:**

```json
{
	"validationCheckpoint": "Element_Validation",
	"element": {
		"type": "recordCreates",
		"name": "Create_Lead",
		"phase": "Phase 5 - Flow Elements"
	},
	"checks": [
		{
			"rule": "ELEMENT_WELLFORMED",
			"status": "pass",
			"message": "Element XML is well-formed"
		},
		{
			"rule": "UNIQUE_NAME",
			"status": "pass",
			"message": "Element name 'Create_Lead' is unique"
		},
		{
			"rule": "FAULT_CONNECTOR",
			"status": "fail",
			"message": "Missing faultConnector - DML elements must have error handling",
			"location": "recordCreates[name='Create_Lead']",
			"suggestion": "Add <faultConnector><targetReference>Error_Screen</targetReference></faultConnector>"
		},
		{
			"rule": "NOT_IN_LOOP",
			"status": "pass",
			"message": "DML element is not inside loop body"
		}
	],
	"summary": {
		"total_checks": 4,
		"passed": 3,
		"failed": 1,
		"warnings": 0
	},
	"status": "fail",
	"action": "fix_errors_before_proceeding",
	"next_steps": [
		"1. Add faultConnector to Create_Lead element",
		"2. Create Error_Screen element or use existing error handler",
		"3. Re-validate element after fix"
	]
}
```

---

### PMD Checkpoint #1 Output (Phase 3 - After Variables)

```json
{
	"validationCheckpoint": "PMD_Checkpoint_1",
	"phase": "Phase 3 - Variables & Resources",
	"timestamp": "2026-01-05T10:30:00Z",
	"pmd_rules_checked": [
		{
			"rule": "UnusedVariable",
			"severity": "warning",
			"status": "pass",
			"count": 0,
			"message": "No unused variables detected"
		},
		{
			"rule": "VariableNamingConvention",
			"severity": "info",
			"status": "pass",
			"count": 0,
			"message": "All variables follow naming conventions"
		}
	],
	"summary": {
		"total_rules": 2,
		"errors": 0,
		"warnings": 0,
		"info": 0
	},
	"status": "pass",
	"action": "proceed_to_phase_4"
}
```

**If PMD detects issues:**

```json
{
	"validationCheckpoint": "PMD_Checkpoint_1",
	"phase": "Phase 3 - Variables & Resources",
	"timestamp": "2026-01-05T10:30:00Z",
	"pmd_rules_checked": [
		{
			"rule": "UnusedVariable",
			"severity": "warning",
			"status": "fail",
			"count": 2,
			"message": "2 unused variables detected",
			"violations": [
				{
					"variable": "TempCounter",
					"location": "line 45",
					"message": "Variable 'TempCounter' is defined but never used",
					"suggestion": "Remove unused variable or use it in the flow logic"
				},
				{
					"variable": "OldStatus",
					"location": "line 67",
					"message": "Variable 'OldStatus' is defined but never used",
					"suggestion": "Remove unused variable or implement status comparison logic"
				}
			]
		}
	],
	"summary": {
		"total_rules": 2,
		"errors": 0,
		"warnings": 2,
		"info": 0
	},
	"status": "warning",
	"action": "review_warnings_and_fix",
	"next_steps": [
		"1. Review each unused variable",
		"2. Remove variables that are not needed",
		"3. Implement logic for variables that should be used",
		"4. Re-run PMD validation after fixes"
	]
}
```

---

### PMD Checkpoint #2 Output (Phase 5 - After All Elements)

```json
{
	"validationCheckpoint": "PMD_Checkpoint_2",
	"phase": "Phase 5 - After All Flow Elements",
	"timestamp": "2026-01-05T10:45:00Z",
	"pmd_rules_checked": [
		{
			"rule": "DMLStatementInLoop",
			"severity": "error",
			"status": "pass",
			"count": 0,
			"message": "No DML operations found inside loop bodies"
		},
		{
			"rule": "SOQLQueryInLoop",
			"severity": "error",
			"status": "pass",
			"count": 0,
			"message": "No SOQL queries found inside loop bodies"
		},
		{
			"rule": "ActionCallsInLoop",
			"severity": "error",
			"status": "pass",
			"count": 0,
			"message": "No action calls found inside loop bodies"
		},
		{
			"rule": "MissingFaultPath",
			"severity": "warning",
			"status": "pass",
			"count": 0,
			"message": "All DML elements have fault connectors"
		},
		{
			"rule": "HardcodedId",
			"severity": "error",
			"status": "pass",
			"count": 0,
			"message": "No hardcoded Salesforce IDs detected"
		},
		{
			"rule": "DuplicateElementName",
			"severity": "error",
			"status": "pass",
			"count": 0,
			"message": "All element names are unique"
		}
	],
	"summary": {
		"total_rules": 6,
		"errors": 0,
		"warnings": 0,
		"info": 0
	},
	"status": "pass",
	"action": "proceed_to_phase_6"
}
```

**If PMD detects critical errors:**

```json
{
	"validationCheckpoint": "PMD_Checkpoint_2",
	"phase": "Phase 5 - After All Flow Elements",
	"timestamp": "2026-01-05T10:45:00Z",
	"pmd_rules_checked": [
		{
			"rule": "DMLStatementInLoop",
			"severity": "error",
			"status": "fail",
			"count": 1,
			"message": "DML operation detected inside loop body - Governor limit violation",
			"violations": [
				{
					"element": "Update_Opportunity",
					"elementType": "recordUpdates",
					"location": "line 245",
					"loop": "Process_Opportunities_Loop",
					"loopLocation": "line 198",
					"message": "recordUpdates element 'Update_Opportunity' is connected from loop 'Process_Opportunities_Loop' nextValueConnector",
					"impact": "CRITICAL - Will hit governor limits with bulk data (200+ records)",
					"suggestion": "Move DML outside loop: Use Assignment inside loop to modify records, then perform bulk DML after loop completes",
					"fix_pattern": "Loop → Assignment (modify field) → Loop back → After Loop → DML (bulk update)"
				}
			]
		},
		{
			"rule": "SOQLQueryInLoop",
			"severity": "error",
			"status": "pass",
			"count": 0,
			"message": "No SOQL queries found inside loop bodies"
		},
		{
			"rule": "MissingFaultPath",
			"severity": "warning",
			"status": "fail",
			"count": 1,
			"message": "1 DML element missing fault connector",
			"violations": [
				{
					"element": "Create_Task",
					"elementType": "recordCreates",
					"location": "line 312",
					"message": "recordCreates element 'Create_Task' does not have faultConnector defined",
					"impact": "MODERATE - Unhandled errors will cause flow to fail without proper error message",
					"suggestion": "Add <faultConnector><targetReference>Error_Handler</targetReference></faultConnector>",
					"fix_required": true
				}
			]
		}
	],
	"summary": {
		"total_rules": 6,
		"errors": 1,
		"warnings": 1,
		"info": 0
	},
	"status": "fail",
	"action": "STOP_AND_FIX_ERRORS",
	"blocking_errors": ["DMLStatementInLoop: Update_Opportunity in Process_Opportunities_Loop"],
	"next_steps": [
		"1. STOP - Do not proceed to Phase 6",
		"2. Fix DMLStatementInLoop error (CRITICAL):",
		"   a. Identify the loop: Process_Opportunities_Loop",
		"   b. Move recordUpdates 'Update_Opportunity' outside loop",
		"   c. Add Assignment inside loop to modify Opportunity fields",
		"   d. Connect loop's noMoreValuesConnector to bulk DML",
		"3. Fix MissingFaultPath warning:",
		"   a. Add faultConnector to Create_Task element",
		"   b. Create or reference error handler element",
		"4. Re-run PMD validation after all fixes",
		"5. Ensure all checks pass before proceeding"
	]
}
```

---

### PMD Checkpoint #3 Output (Phase 8 - Pre-Deployment)

Full PMD scan with all 21+ rules:

```json
{
	"validationCheckpoint": "PMD_Checkpoint_3_Full_Scan",
	"phase": "Phase 8 - Pre-Deployment Validation",
	"timestamp": "2026-01-05T11:00:00Z",
	"pmd_rules_checked": [
		{
			"rule": "DMLStatementInLoop",
			"category": "Performance",
			"severity": "error",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "SOQLQueryInLoop",
			"category": "Performance",
			"severity": "error",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "ActionCallsInLoop",
			"category": "Performance",
			"severity": "error",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "MissingFaultPath",
			"category": "Error Handling",
			"severity": "warning",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "HardcodedId",
			"category": "Best Practices",
			"severity": "error",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "DuplicateElementName",
			"category": "Structure",
			"severity": "error",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "UnusedVariable",
			"category": "Code Quality",
			"severity": "warning",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "MissingDescription",
			"category": "Documentation",
			"severity": "info",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "UnconnectedElement",
			"category": "Structure",
			"severity": "error",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "InvalidConnectorReference",
			"category": "Structure",
			"severity": "error",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "MissingDefaultConnector",
			"category": "Logic",
			"severity": "error",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "MissingLoopConnectors",
			"category": "Logic",
			"severity": "error",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "GetRecordsWithoutFilter",
			"category": "Performance",
			"severity": "warning",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "ScreenFlowMissingMetadata",
			"category": "Structure",
			"severity": "error",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "ScreenFieldTargetReference",
			"category": "Best Practices",
			"severity": "error",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "ComponentInstanceMissingExtension",
			"category": "Structure",
			"severity": "error",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "MissingStoreOutputAutomatically",
			"category": "Best Practices",
			"severity": "warning",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "IncorrectValueSuffix",
			"category": "Best Practices",
			"severity": "error",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "InvalidProcessType",
			"category": "Structure",
			"severity": "error",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "MissingRequiredMetadata",
			"category": "Structure",
			"severity": "error",
			"status": "pass",
			"count": 0
		},
		{
			"rule": "HTMLCommentInXML",
			"category": "Structure",
			"severity": "error",
			"status": "pass",
			"count": 0
		}
	],
	"summary": {
		"total_rules": 21,
		"errors": 0,
		"warnings": 0,
		"info": 0,
		"by_category": {
			"Performance": { "errors": 0, "warnings": 0 },
			"Error Handling": { "errors": 0, "warnings": 0 },
			"Best Practices": { "errors": 0, "warnings": 0 },
			"Structure": { "errors": 0, "warnings": 0 },
			"Logic": { "errors": 0, "warnings": 0 },
			"Code Quality": { "errors": 0, "warnings": 0 },
			"Documentation": { "errors": 0, "warnings": 0 }
		}
	},
	"status": "pass",
	"action": "proceed_to_deployment",
	"message": "All PMD validation checks passed. Flow is ready for deployment."
}
```

---

### Structural Validation Output (Phase 8)

**NOTE:** Your dedicated PMD extension for flows will handle structural and syntax errors with proper error messages and suggested solutions. AI should expect this format:

```json
{
	"validationCheckpoint": "Structural_Validation",
	"phase": "Phase 8 - Pre-Deployment Validation",
	"timestamp": "2026-01-05T11:05:00Z",
	"xml_validation": {
		"wellformed": true,
		"namespace": "http://soap.sforce.com/2006/04/metadata",
		"root_element": "Flow",
		"encoding": "UTF-8"
	},
	"structural_checks": [
		{
			"check": "RequiredMetadataFields",
			"status": "pass",
			"fields_checked": [
				"apiVersion",
				"areMetricsLoggedToDataCloud",
				"environments",
				"interviewLabel",
				"processMetadataValues"
			]
		},
		{
			"check": "ElementNameUniqueness",
			"status": "pass",
			"total_elements": 8,
			"unique_elements": 8
		},
		{
			"check": "ConnectorValidity",
			"status": "pass",
			"total_connectors": 12,
			"valid_connectors": 12
		},
		{
			"check": "VariableReferences",
			"status": "pass",
			"variables_defined": 5,
			"variables_referenced": 5,
			"undefined_references": 0
		}
	],
	"summary": {
		"total_checks": 4,
		"passed": 4,
		"failed": 0
	},
	"status": "pass",
	"action": "proceed_to_pmd_validation"
}
```

**If structural errors are detected (from your PMD extension):**

````json
{
	"validationCheckpoint": "Structural_Validation",
	"phase": "Phase 8 - Pre-Deployment Validation",
	"timestamp": "2026-01-05T11:05:00Z",
	"source": "PMD_Flow_Extension",
	"structural_checks": [
		{
			"check": "RequiredMetadataFields",
			"status": "fail",
			"severity": "error",
			"violations": [
				{
					"field": "areMetricsLoggedToDataCloud",
					"message": "Required field 'areMetricsLoggedToDataCloud' is missing from Flow metadata",
					"location": "Flow root element",
					"impact": "Deployment will fail - Salesforce requires this field in API v60.0+",
					"suggested_fix": "Add <areMetricsLoggedToDataCloud>false</areMetricsLoggedToDataCloud> after <apiVersion> element",
					"example": "```xml\n<apiVersion>65.0</apiVersion>\n<areMetricsLoggedToDataCloud>false</areMetricsLoggedToDataCloud>\n```"
				}
			]
		},
		{
			"check": "ConnectorValidity",
			"status": "fail",
			"severity": "error",
			"violations": [
				{
					"connector": "targetReference='Process_Records'",
					"source_element": "Check_Status (decisions)",
					"location": "line 156",
					"message": "Connector references non-existent element 'Process_Records'",
					"impact": "Flow will have broken path - element not reachable",
					"available_elements": ["Create_Lead", "Update_Account", "Send_Email", "Success_Screen"],
					"suggested_fix": "Change targetReference to an existing element or create the missing 'Process_Records' element",
					"possible_typos": [
						"Process_Record (1 character difference)",
						"Process_Records_Loop (partial match)"
					]
				}
			]
		},
		{
			"check": "ScreenFlowRequirements",
			"status": "fail",
			"severity": "error",
			"violations": [
				{
					"element": "Email_Field (screen field)",
					"location": "line 89",
					"message": "Screen field 'Email_Field' is missing required property 'inputsOnNextNavToAssocScrn'",
					"impact": "Field value may not be preserved when user navigates back",
					"suggested_fix": "Add <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn> to the field definition",
					"example": "```xml\n<fields>\n  <name>Email_Field</name>\n  <extensionName>flowruntime:email</extensionName>\n  <fieldType>ComponentInstance</fieldType>\n  <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn>\n  <isRequired>true</isRequired>\n  <storeOutputAutomatically>true</storeOutputAutomatically>\n</fields>\n```"
				}
			]
		}
	],
	"summary": {
		"total_checks": 10,
		"passed": 7,
		"failed": 3,
		"by_severity": {
			"error": 3,
			"warning": 0,
			"info": 0
		}
	},
	"status": "fail",
	"action": "STOP_AND_FIX_STRUCTURAL_ERRORS",
	"blocking_errors": [
		"RequiredMetadataFields: areMetricsLoggedToDataCloud missing",
		"ConnectorValidity: targetReference='Process_Records' not found",
		"ScreenFlowRequirements: Email_Field missing inputsOnNextNavToAssocScrn"
	],
	"next_steps": [
		"1. STOP - Do not proceed to deployment",
		"2. Fix error: Add areMetricsLoggedToDataCloud field to Flow metadata",
		"3. Fix error: Update connector in Check_Status decision element",
		"4. Fix error: Add inputsOnNextNavToAssocScrn to Email_Field",
		"5. Re-read the flow XML file",
		"6. Re-run structural validation",
		"7. Ensure all structural checks pass before PMD validation"
	]
}
````

---

### Deployment Validation Output (Phase 9)

```json
{
	"validationCheckpoint": "Deployment_DryRun",
	"phase": "Phase 9 - Deployment",
	"timestamp": "2026-01-05T11:15:00Z",
	"deployment": {
		"type": "dry-run",
		"command": "sfdx force:source:deploy --checkonly",
		"target_org": "production"
	},
	"results": {
		"status": "success",
		"deployed_components": 1,
		"failed_components": 0,
		"components": [
			{
				"name": "Create_Lead_Flow",
				"type": "Flow",
				"status": "success",
				"message": "Flow validated successfully"
			}
		],
		"tests_run": 0,
		"coverage_percentage": 0
	},
	"summary": {
		"deployment_valid": true,
		"ready_for_production": true
	},
	"status": "pass",
	"action": "ready_for_actual_deployment",
	"next_steps": [
		"1. Review deployment results",
		"2. Confirm ready to deploy to production",
		"3. Run actual deployment: sfdx force:source:deploy",
		"4. Activate flow in Salesforce UI"
	]
}
```

**If deployment validation fails:**

```json
{
	"validationCheckpoint": "Deployment_DryRun",
	"phase": "Phase 9 - Deployment",
	"timestamp": "2026-01-05T11:15:00Z",
	"deployment": {
		"type": "dry-run",
		"command": "sfdx force:source:deploy --checkonly",
		"target_org": "production"
	},
	"results": {
		"status": "failed",
		"deployed_components": 0,
		"failed_components": 1,
		"components": [
			{
				"name": "Create_Lead_Flow",
				"type": "Flow",
				"status": "failed",
				"error": "Invalid API version specified",
				"message": "The API version 65.0 is not supported in this org. Maximum supported version is 62.0"
			}
		]
	},
	"summary": {
		"deployment_valid": false,
		"ready_for_production": false
	},
	"status": "fail",
	"action": "STOP_AND_FIX_DEPLOYMENT_ERRORS",
	"blocking_errors": ["Invalid API version: 65.0 not supported (max: 62.0)"],
	"next_steps": [
		"1. STOP - Do not attempt actual deployment",
		"2. Update apiVersion in flow from 65.0 to 62.0",
		"3. Re-read flow file to verify change",
		"4. Re-run deployment dry-run",
		"5. Ensure deployment succeeds before actual deployment"
	]
}
```

---

**Last Updated:** 2026-01-05
**Version:** 1.1

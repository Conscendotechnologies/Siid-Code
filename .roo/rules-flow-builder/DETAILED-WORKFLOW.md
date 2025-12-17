# Flow Builder - Detailed 10-Phase Workflow

This document contains the complete step-by-step workflow for building Salesforce Flows. AI should retrieve and follow this when building flows.

---

## 📋 PHASE 1: Planning & Schema Retrieval

Create a detailed todo list for the planning phase:

```xml
<update_todo_list>
<todos>
[ ] 1.1 - Analyze user requirements and document flow purpose
[ ] 1.2 - Identify flow type (Screen/Record-Triggered/Scheduled/Autolaunched/Platform Event)
[ ] 1.3 - Identify trigger conditions (if Record-Triggered: Before/After Save, Create/Update/Delete)
[ ] 1.4 - List all required variables (name, data type, input/output, collection vs single)
[ ] 1.5 - List all required formulas/constants/text templates
[ ] 1.6 - Map out flow logic diagram (element sequence and decision paths)
[ ] 1.7 - Identify all element types needed (Get Records, Decision, Loop, DML, etc.)
[ ] 1.8 - Retrieve Flow base schema using retrieve_schema tool
[ ] 1.9 - Retrieve schema for EACH element type identified
[ ] 1.10 - Review schemas and confirm all required fields understood
</todos>
</update_todo_list>
```

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
  [ ] 5.X.1 - Retrieve FlowAssignment schema
  [ ] 5.X.2 - Add <assignments> element
  [ ] 5.X.3 - Set name, label, locationX, locationY
  [ ] 5.X.4 - FOR EACH assignmentItem:
    [ ] 5.X.4.1 - Set assignToReference (target variable/field)
    [ ] 5.X.4.2 - Set operator (Assign/Add/Subtract/etc.)
    [ ] 5.X.4.3 - Set value with elementReference:
      [ ] IF referencing InputField: <elementReference>FieldName</elementReference>
      [ ] IF referencing ComponentInstance: <elementReference>FieldName.value</elementReference>
  [ ] 5.X.5 - Add connector
  [ ] 5.X.6 - VALIDATE: Component field references include .value suffix
  [ ] 5.X.7 - VALIDATE: InputField references do NOT have .value suffix
```

### For Record Create Elements (FlowRecordCreate):

```xml
[ ] 5.X - Add Element: [RecordCreate_Name] (FlowRecordCreate)
  [ ] 5.X.1 - Retrieve FlowRecordCreate schema
  [ ] 5.X.2 - Add <recordCreates> element
  [ ] 5.X.3 - Set name, label, locationX, locationY
  [ ] 5.X.4 - PREFERRED: Set inputReference to SObject variable
  [ ] 5.X.5 - ALTERNATIVE: Set object and inputAssignments (less preferred)
  [ ] 5.X.6 - Add connector (success path)
  [ ] 5.X.7 - Add faultConnector (error path) - REQUIRED
  [ ] 5.X.8 - VALIDATE: Fault connector is defined
  [ ] 5.X.9 - VALIDATE: Element is NOT inside a loop body
```

### For Decision Elements (FlowDecision):

```xml
[ ] 5.X - Add Element: [Decision_Name] (FlowDecision)
  [ ] 5.X.1 - Retrieve FlowDecision schema
  [ ] 5.X.2 - Add <decisions> element
  [ ] 5.X.3 - Set name, label
  [ ] 5.X.4 - Add decision rules (outcomes)
  [ ] 5.X.5 - Add defaultConnector (REQUIRED)
  [ ] 5.X.6 - VALIDATE: All outcomes have connectors
  [ ] 5.X.7 - VALIDATE: Default connector is defined
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
[ ] 8.4 - VALIDATE: No hardcoded Salesforce IDs (15 or 18 chars)
[ ] 8.5 - VALIDATE: All variables referenced are defined
[ ] 8.6 - VALIDATE: All connectors reference valid elements
[ ] 8.7 - VALIDATE: processType is valid
[ ] 8.8 - VALIDATE: API version is current (65.0)
[ ] 8.9 - CHECK: Flow has meaningful description
[ ] 8.10 - CHECK: All elements have descriptive labels
[ ] 8.11 - CHECK: runInMode is explicitly set (if applicable)
[ ] 8.12 - IF SCREEN FLOW: Validate Screen Flow specific requirements
  [ ] 8.12.1 - Verify customProperties for ScreenProgressIndicator
  [ ] 8.12.2 - Verify all screen fields have inputsOnNextNavToAssocScrn
  [ ] 8.12.3 - Verify all screen fields have styleProperties
  [ ] 8.12.4 - CHECK: No screen fields use targetReference (CRITICAL ERROR)
  [ ] 8.12.5 - Verify ComponentInstance fields have extensionName
  [ ] 8.12.6 - Verify ComponentInstance fields have storeOutputAutomatically
  [ ] 8.12.7 - Verify Assignment uses .value for ComponentInstance fields
  [ ] 8.12.8 - Verify Assignment does NOT use .value for InputField fields
  [ ] 8.12.9 - Verify recordCreates uses inputReference (preferred)
  [ ] 8.12.10 - CHECK: No HTML comments in XML
  [ ] 8.12.11 - CHECK: No explicit <end> elements
  [ ] 8.12.12 - VALIDATE: Compare against SCREEN-FLOW-PATTERNS.md
[ ] 8.13 - VALIDATE: All required metadata fields present
  [ ] 8.13.1 - areMetricsLoggedToDataCloud is present
  [ ] 8.13.2 - environments is present
  [ ] 8.13.3 - interviewLabel is present with {!$Flow.CurrentDateTime}
  [ ] 8.13.4 - All 3 processMetadataValues present (BuilderType, CanvasMode, OriginBuilderType)
[ ] 8.14 - RUN COMMON ERROR CHECKLIST (see below)
[ ] 8.15 - PMD VALIDATION: Trigger full PMD scan
  [ ] 8.15.1 - Check all 21+ PMD rules
  [ ] 8.15.2 - Address ALL errors (🔴)
  [ ] 8.15.3 - Review warnings (🟡) and fix critical ones
[ ] 8.16 - Fix any issues found
[ ] 8.17 - Re-read file and confirm all fixes applied
[ ] 8.18 - FINAL CHECK: Compare entire flow against real-world example
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

## 📋 PHASE 9: Deployment

```xml
<update_todo_list>
<todos>
[x] Phases 1-8 completed
[ ] 9.1 - Dry-run deployment (validate only)
  [ ] 9.1.1 - Run: sfdx force:source:deploy --checkonly
  [ ] 9.1.2 - Review deployment results
  [ ] 9.1.3 - Fix any deployment errors
[ ] 9.2 - If dry-run successful, deploy
  [ ] 9.2.1 - Run: sfdx force:source:deploy
  [ ] 9.2.2 - Verify deployment success
[ ] 9.3 - Activate flow in Salesforce UI (set status to Active)
[ ] 9.4 - VALIDATE: Flow appears in Salesforce Flow Builder
</todos>
</update_todo_list>
```

---

## 📋 PHASE 10: Documentation & Testing

```xml
<update_todo_list>
<todos>
[x] Phases 1-9 completed
[ ] 10.1 - Document flow purpose and logic
[ ] 10.2 - Test with sample data
[ ] 10.3 - Test all decision paths
[ ] 10.4 - Test with bulk data (200+ records if applicable)
[ ] 10.5 - Test fault paths
[ ] 10.6 - Verify governor limits compliance
[ ] 10.7 - Complete!
</todos>
</update_todo_list>
```

---

**Last Updated:** 2025-12-16
**Version:** 1.0

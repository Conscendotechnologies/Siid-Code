# Flow Builder Configuration - Analysis & Improvement Recommendations

**Analysis Date:** 2026-01-05
**Analyzed By:** Claude Code
**Status:** Complete

---

## Executive Summary

The flow builder configuration under `.roo/rules-flow-builder/` is **well-structured and comprehensive** with excellent documentation. However, there are **critical gaps in tool integration** and **missing validation examples** that may cause AI to generate incorrect flow schemas.

### Key Findings:

✅ **Strengths:**

- Comprehensive 10-phase workflow documentation
- Detailed validation checklists (17-point pre-deployment)
- Real-world pattern examples for Screen and Record-Triggered flows
- Progressive disclosure methodology
- PMD validation checkpoints

❌ **Critical Issues:**

1. **Missing `retrieve_schema` tool integration** - Documentation references the tool but doesn't show the correct XML tag syntax
2. **Incomplete Flow component schema examples** - AI needs to see what a properly retrieved schema looks like
3. **No validation of actual tool usage** - No examples showing correct vs incorrect tool calls
4. **Missing error recovery patterns** - Limited guidance when schema retrieval fails

---

## Detailed Analysis

### 1. File Structure Overview

```
.roo/rules-flow-builder/
├── QUICK-REFERENCE.md           (254 lines) ✅ Good summary card
├── DETAILED-WORKFLOW.md         (402 lines) ✅ Comprehensive 10-phase guide
├── RECORD-TRIGGER-FLOW-PATTERNS.md (815 lines) ✅ Excellent pattern examples
├── SCREEN-FLOW-PATTERNS.md      (429 lines) ✅ Detailed screen flow guide
├── metadata.xml                 (29,850 lines) ✅ Complete Salesforce Metadata API v65.0
└── apex.xml                     (612 lines) ✅ Complete Salesforce Apex API v65.0
```

**Total Documentation:** ~2,000 lines of guidance + ~30,500 lines of schema definitions

---

### 2. Current Tool Integration Status

#### ✅ Tool Implementation (Backend)

The `retrieve_schema` tool is **correctly implemented** in:

- `src/core/tools/retrieveSchemaTool.ts` - Full implementation with XML parsing
- `src/core/prompts/tools/retrieve-schema.ts` - Tool description and usage

**Tool Capabilities:**

- Searches for complexType, simpleType, element, message, and operation definitions
- Supports both `metadata.xml` and `apex.xml`
- Returns raw XML schema with related types
- Provides helpful error messages

#### ❌ Documentation Gap

The documentation files reference the tool but show **INCORRECT XML syntax**:

**In Documentation (INCORRECT):**

```xml
<retrieve_schema>
<component_name>Flow</component_name>
</retrieve_schema>
```

**Actual Tool Expects:**

```xml
<retrieve_schema>
<component_name>Flow</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>
```

**Problem:** The documentation doesn't match the actual tool implementation's XML tag names and structure.

---

### 3. Available Flow Components in Metadata

The `metadata.xml` file contains **119 Flow-related component definitions**, including:

#### Core Flow Components:

- `Flow` - Main flow definition
- `FlowStart` - Start element configuration
- `FlowNode` - Base for all flow elements
- `FlowElement` - Base flow element type
- `FlowBaseElement` - Foundation element

#### Flow Elements:

- `FlowScreen` - Screen elements
- `FlowRecordCreate` - Create records
- `FlowRecordUpdate` - Update records
- `FlowRecordDelete` - Delete records
- `FlowRecordLookup` - Get records (SOQL)
- `FlowAssignment` - Assignment elements
- `FlowDecision` - Decision elements
- `FlowLoop` - Loop elements
- `FlowSubflow` - Subflow calls
- `FlowActionCall` - Action calls
- `FlowApexPluginCall` - Apex calls

#### Supporting Components:

- `FlowVariable` - Variable definitions
- `FlowFormula` - Formula definitions
- `FlowConstant` - Constant definitions
- `FlowTextTemplate` - Text template definitions
- `FlowCondition` - Condition logic
- `FlowConnector` - Element connectors
- `FlowRecordFilter` - Record filters
- `FlowScreenField` - Screen field definitions
- `FlowScreenFieldInputParameter` - Screen field inputs
- `FlowMetadataValue` - Metadata values

**Total:** 119+ Flow-related types available for schema retrieval

---

## 4. Issues Identified

### Issue #1: Tool Syntax Mismatch (CRITICAL)

**Location:** All pattern files (RECORD-TRIGGER-FLOW-PATTERNS.md, SCREEN-FLOW-PATTERNS.md, DETAILED-WORKFLOW.md)

**Problem:**

```xml
<!-- Documentation shows: -->
<retrieve_schema>
<component_name>Flow</component_name>
</retrieve_schema>

<!-- But tool implementation expects valid parameters -->
```

**Impact:** AI will call the tool correctly by reading the tool description, but the documentation examples may cause confusion.

**Recommendation:** Update all documentation to show complete, valid examples:

```xml
<retrieve_schema>
<component_name>FlowScreen</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>
```

---

### Issue #2: No Schema Retrieval Examples (HIGH)

**Problem:** Documentation tells AI to use `retrieve_schema` but doesn't show:

1. What a successfully retrieved schema looks like
2. How to interpret the nested type references
3. When to retrieve related types
4. How to use the schema information to build XML

**Example Missing:**

```
Phase 1: Step 1.8 says "Retrieve Flow base schema using retrieve_schema tool"
But it doesn't show:
- What fields will be returned
- Which fields are required vs optional
- What the nested types mean
- How to follow type references (e.g., type="tns:FlowNode")
```

**Recommendation:** Add a complete schema retrieval example showing:

1. Tool call
2. Retrieved schema XML
3. Interpretation of the schema
4. How to use it to build valid XML

---

### Issue #3: Missing Validation Examples (MEDIUM)

**Problem:** Phase 8 has a comprehensive 17-point checklist but doesn't show:

1. What validation output looks like (JSON format mentioned but not shown)
2. How to fix common errors
3. What PMD tool output looks like

**Current (Vague):**

```
[ ] 8.15 - PMD VALIDATION: Trigger full PMD scan
  [ ] 8.15.1 - Check all 21+ PMD rules
```

**Needs:**

```json
{
	"validationCheckpoint": "PMD Full Scan",
	"checks": [
		{ "rule": "UnusedVariable", "status": "pass" },
		{ "rule": "DMLStatementInLoop", "status": "fail", "location": "Loop_Element:line 42" },
		{ "rule": "MissingFaultPath", "status": "warn", "element": "Create_Record" }
	],
	"errors": 1,
	"warnings": 1,
	"actionRequired": "fix errors before deployment"
}
```

**Recommendation:** Add validation output examples for each checkpoint.

---

### Issue #4: No Error Recovery Guidance (MEDIUM)

**Problem:** Documentation mentions 5-step recovery but doesn't show common scenarios:

**Current:**

```
1. STOP - Don't proceed
2. IDENTIFY - Root cause
3. FIX - Follow instructions
4. RE-VALIDATE - Confirm fix
5. PROCEED - Continue workflow
```

**Needs Concrete Examples:**

```
Scenario: "Component 'FlowScreenFields' not found"
Recovery:
1. STOP - Tool returned error
2. IDENTIFY - Typo in component name
3. FIX - Use 'FlowScreenField' (singular)
4. RE-VALIDATE - Retry tool with correct name
5. PROCEED - Use retrieved schema
```

**Recommendation:** Add 5-10 common error scenarios with recovery steps.

---

### Issue #5: Incomplete Flow Type Coverage (LOW)

**Problem:** Documentation focuses heavily on:

- Screen Flows (processType: Flow)
- Record-Triggered Flows (processType: AutoLaunchedFlow)

**Missing:**

- Scheduled Flows
- Platform Event Flows
- Autolaunched Flows (called from Apex/Process Builder)
- Field Service Flows
- Survey Flows

**Recommendation:** Add pattern files for other flow types or note that they're out of scope.

---

## 5. Strengths to Maintain

### ✅ Excellent Pattern Documentation

The real-world examples in SCREEN-FLOW-PATTERNS.md and RECORD-TRIGGER-FLOW-PATTERNS.md are **outstanding**:

```xml
<!-- Clear before/after examples -->
❌ WRONG - DO NOT use targetReference on screen fields
✅ CORRECT - Regular InputField (no .value suffix)
```

### ✅ Progressive Disclosure Methodology

The 10-phase approach with expansion is excellent:

```
[ ] Phase 1: Planning & Schema Retrieval
[ ] Phase 2: Flow Structure Creation
[...] (collapsed)
```

### ✅ Comprehensive Validation Checklists

The 17-point pre-deployment checklist is thorough and catches common errors.

### ✅ Anti-Pattern Documentation

Clear warnings about what NOT to do:

```
❌ DO NOT perform DML inside loops
❌ DO NOT use targetReference on screen fields
❌ DO NOT forget fault paths
```

---

## 6. Recommended Improvements

### Priority 1: Fix Tool Integration (CRITICAL)

**Action Items:**

1. Add complete schema retrieval example section
2. Show what retrieved schemas look like
3. Demonstrate interpreting nested types
4. Add examples of using schema to build XML

**New Section to Add:**

````markdown
## Complete Schema Retrieval Example

### Step 1: Retrieve the Main Component

<retrieve_schema>
<component_name>FlowScreen</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>

### Step 2: Tool Returns Schema Definition

```xml
<xsd:complexType name="FlowScreen">
 <xsd:complexContent>
  <xsd:extension base="tns:FlowNode">
   <xsd:sequence>
    <xsd:element name="allowBack" minOccurs="0" type="xsd:boolean"/>
    <xsd:element name="allowFinish" minOccurs="0" type="xsd:boolean"/>
    <xsd:element name="fields" minOccurs="0" maxOccurs="unbounded" type="tns:FlowScreenField"/>
   </xsd:sequence>
  </xsd:extension>
 </xsd:complexContent>
</xsd:complexType>
```
````

Referenced types: FlowNode, FlowScreenField

### Step 3: Retrieve Related Types

<retrieve_schema>
<component_name>FlowScreenField</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>

### Step 4: Interpret Schema

- `allowBack`, `allowFinish` are optional (minOccurs="0")
- `fields` is an array (maxOccurs="unbounded")
- `fields` must be of type FlowScreenField
- FlowScreen extends FlowNode (inherits base properties)

### Step 5: Build Valid XML

```xml
<screens>
    <name>MyScreen</name>
    <allowBack>true</allowBack>
    <allowFinish>true</allowFinish>
    <fields>
        <!-- FlowScreenField structure here -->
    </fields>
</screens>
```

````

---

### Priority 2: Add Validation Examples (HIGH)

**Action Items:**
1. Create validation output format examples
2. Show PMD tool output examples
3. Add validation JSON schema
4. Document validation checkpoint outputs

**New Section:**
```markdown
## Validation Output Format

### Element-Level Validation Output
```json
{
  "checkpoint": "Element_Create_Lead",
  "element": "recordCreates",
  "elementName": "Create_Lead",
  "checks": [
    { "rule": "ELEMENT_WELLFORMED", "status": "pass" },
    { "rule": "UNIQUE_NAME", "status": "pass" },
    { "rule": "FAULT_CONNECTOR", "status": "pass" },
    { "rule": "NOT_IN_LOOP", "status": "pass" },
    { "rule": "SCHEMA_COMPLIANCE", "status": "pass" }
  ],
  "status": "pass",
  "action": "proceed_to_next_element"
}
````

### PMD Checkpoint Output

```json
{
	"checkpoint": "PMD_Checkpoint_2",
	"phase": "Phase 5 - After All Elements",
	"rules_checked": [
		{ "rule": "DMLStatementInLoop", "status": "pass", "count": 0 },
		{ "rule": "SOQLQueryInLoop", "status": "pass", "count": 0 },
		{ "rule": "ActionCallsInLoop", "status": "pass", "count": 0 },
		{ "rule": "MissingFaultPath", "status": "fail", "elements": ["Create_Lead"] },
		{ "rule": "HardcodedId", "status": "pass", "count": 0 }
	],
	"errors": 1,
	"warnings": 0,
	"status": "fail",
	"action": "fix_errors_before_proceeding"
}
```

````

---

### Priority 3: Add Error Recovery Examples (MEDIUM)

**Action Items:**
1. Document 10 most common errors
2. Show recovery steps for each
3. Add troubleshooting decision tree

**New Section:**
```markdown
## Common Error Scenarios & Recovery

### Error 1: Component Not Found
**Error Message:**
````

Component 'FlowScreenFields' not found in metadata.xml

````

**Recovery Steps:**
1. STOP - Don't proceed with incorrect component name
2. IDENTIFY - Check spelling: should be 'FlowScreenField' (singular)
3. FIX - Retry with correct name:
   ```xml
   <retrieve_schema>
   <component_name>FlowScreenField</component_name>
   <schema_file>metadata</schema_file>
   </retrieve_schema>
````

4. RE-VALIDATE - Verify schema returned successfully
5. PROCEED - Use retrieved schema

### Error 2: Missing Required Field

**Error Message:**

```
Deployment failed: Field 'areMetricsLoggedToDataCloud' is required
```

**Recovery Steps:**

1. STOP - Deployment blocked
2. IDENTIFY - Missing metadata field
3. FIX - Add to flow XML:
    ```xml
    <areMetricsLoggedToDataCloud>false</areMetricsLoggedToDataCloud>
    ```
4. RE-VALIDATE - Read file and confirm field present
5. PROCEED - Retry deployment

[... 8 more common scenarios ...]

````

---

### Priority 4: Add Quick Validation Checklist (MEDIUM)

**Action Items:**
1. Create a one-page validation checklist
2. Make it easy for AI to verify each step
3. Add to QUICK-REFERENCE.md

**New Section:**
```markdown
## One-Minute Flow Validation

### Metadata (Required Fields)
- [ ] `apiVersion` = 65.0
- [ ] `areMetricsLoggedToDataCloud` present
- [ ] `environments` present
- [ ] `interviewLabel` with {!$Flow.CurrentDateTime}
- [ ] `processMetadataValues` (all 3: BuilderType, CanvasMode, OriginBuilderType)
- [ ] Screen Flow: `customProperties` for ScreenProgressIndicator

### Elements (Common Issues)
- [ ] All element names unique
- [ ] All connectors point to existing elements
- [ ] DML elements have faultConnector
- [ ] No DML/SOQL in loop bodies
- [ ] Decision has defaultConnector
- [ ] Loop has both connectors (nextValueConnector, noMoreValuesConnector)

### Variables
- [ ] All referenced variables defined
- [ ] No unused variables (PMD check)
- [ ] Correct dataType for each variable
- [ ] isCollection set correctly

### Screen Flow Specific
- [ ] NO targetReference on screen fields
- [ ] ComponentInstance has extensionName
- [ ] ComponentInstance has storeOutputAutomatically
- [ ] Assignment uses .value for ComponentInstance
- [ ] Assignment NOT uses .value for InputField
````

---

## 7. Implementation Roadmap

### Week 1: Critical Fixes

1. ✅ Add complete schema retrieval example section to DETAILED-WORKFLOW.md
2. ✅ Create new file: SCHEMA-RETRIEVAL-GUIDE.md
3. ✅ Update all tool call examples to match implementation

### Week 2: Validation Examples

1. ✅ Add validation JSON format examples
2. ✅ Create validation output templates
3. ✅ Update QUICK-REFERENCE.md with validation formats

### Week 3: Error Recovery

1. ✅ Document 10 common errors with recovery steps
2. ✅ Create ERROR-RECOVERY-GUIDE.md
3. ✅ Add troubleshooting decision tree

### Week 4: Testing & Refinement

1. ✅ Test with AI to verify improvements
2. ✅ Collect feedback on clarity
3. ✅ Iterate based on results

---

## 8. Testing Recommendations

### Test Scenario 1: Schema Retrieval

**User Request:** "Create a screen flow with email and phone fields"

**Expected AI Behavior:**

1. ✅ Use retrieve_schema to get Flow, FlowScreen, FlowScreenField schemas
2. ✅ Interpret schema correctly (required vs optional fields)
3. ✅ Follow nested type references
4. ✅ Build valid XML matching schema

**Current Issue:** AI may not retrieve schemas or misinterpret them

### Test Scenario 2: Validation

**User Request:** "Create a record-triggered flow that updates opportunities in a loop"

**Expected AI Behavior:**

1. ✅ Create flow with loop
2. ✅ PMD validation catches DML in loop
3. ✅ AI recognizes error and fixes (move DML outside loop)
4. ✅ Re-validate and confirm fix

**Current Issue:** Validation output format unclear

### Test Scenario 3: Error Recovery

**User Request:** "Use FlowScreenFields to build a screen"

**Expected AI Behavior:**

1. ✅ Attempt to retrieve 'FlowScreenFields' schema
2. ✅ Tool returns "not found" error
3. ✅ AI recognizes typo and tries 'FlowScreenField'
4. ✅ Successfully retrieves and uses schema

**Current Issue:** Limited error recovery guidance

---

## 9. Conclusion

### Overall Assessment: **B+ (Very Good, Needs Minor Improvements)**

**Strengths:**

- Comprehensive workflow documentation
- Excellent pattern examples
- Strong validation methodology
- Clear anti-pattern warnings

**Weaknesses:**

- Tool integration examples need updating
- Missing validation output examples
- Limited error recovery guidance
- No schema interpretation examples

### Recommended Next Steps:

1. **Immediate (This Week):**

    - Add complete schema retrieval example section
    - Update all tool call examples
    - Create SCHEMA-RETRIEVAL-GUIDE.md

2. **Short-term (Next 2 Weeks):**

    - Add validation output format examples
    - Create ERROR-RECOVERY-GUIDE.md
    - Add quick validation checklist

3. **Long-term (Next Month):**
    - Test with real AI usage
    - Collect metrics on success rate
    - Iterate based on feedback

---

## Appendix A: Complete Flow Component List

The following 119 Flow-related components are available in `metadata.xml` for schema retrieval:

### Core Components (10)

- Flow
- FlowStart
- FlowNode
- FlowElement
- FlowBaseElement
- FlowConnector
- FlowMetadataValue
- FlowElementReferenceOrValue
- FlowDefinition
- FlowSettings

### Flow Elements (20)

- FlowScreen
- FlowRecordCreate
- FlowRecordUpdate
- FlowRecordDelete
- FlowRecordLookup
- FlowAssignment
- FlowDecision
- FlowLoop
- FlowSubflow
- FlowActionCall
- FlowApexPluginCall
- FlowWait
- FlowCustomError
- FlowRecordRollback
- FlowCollectionProcessor
- FlowTransform
- FlowStep
- FlowOrchestratedStage
- FlowStage
- FlowStageStep

### Variables & Resources (7)

- FlowVariable
- FlowFormula
- FlowConstant
- FlowTextTemplate
- FlowChoice
- FlowDynamicChoiceSet
- FlowAttribute

### Screen Components (15)

- FlowScreenField
- FlowScreenFieldInputParameter
- FlowScreenFieldOutputParameter
- FlowScreenFieldStyleProperties
- FlowScreenAction
- FlowScreenActionInputParameter
- FlowScreenRule
- FlowScreenRuleAction
- FlowScreenStyleSetting
- FlowScreenTrigger
- FlowScreenTriggerHandler
- FlowInputValidationRule
- FlowChoiceUserInput
- FlowScreenTranslation
- FlowScreenFieldTranslation

### Data Operations (12)

- FlowAssignmentItem
- FlowRecordFilter
- FlowInputFieldAssignment
- FlowOutputFieldAssignment
- FlowRelatedRecordLookup
- FlowDataTypeMapping
- FlowCollectionMapItem
- FlowCollectionSortOption
- FlowInlineTransform
- FlowTransformValue
- FlowTransformValueAction
- FlowTransformValueActionInputParameter

### Logic & Conditions (7)

- FlowCondition
- FlowRule
- FlowVisibilityRule
- FlowExitRule
- FlowSchedule
- FlowScheduledPath
- FlowExperimentPath

### Subflow & Action Parameters (11)

- FlowActionCallInputParameter
- FlowActionCallOutputParameter
- FlowActionCallPath
- FlowApexPluginCallInputParameter
- FlowApexPluginCallOutputParameter
- FlowSubflowInputAssignment
- FlowSubflowOutputAssignment
- FlowStartInputParameter
- FlowWaitEventInputParameter
- FlowWaitEventOutputParameter
- FlowCustomErrorMessage

### Stage Management (10)

- FlowStageStepAssignee
- FlowStageStepEntryActionInputParameter
- FlowStageStepEntryActionOutputParameter
- FlowStageStepExitActionInputParameter
- FlowStageStepExitActionOutputParameter
- FlowStageStepInputParameter
- FlowStageStepOutputConfigParam
- FlowStageStepOutputParameter
- FlowStageTranslation
- FlowOrchestrationStepTranslation

### Testing (7)

- FlowTest
- FlowTestAssertion
- FlowTestCondition
- FlowTestFlowVersion
- FlowTestParameter
- FlowTestPoint
- FlowTestReferenceOrValue

### Translation & Localization (8)

- FlowTranslation
- FlowDefinitionTranslation
- FlowChoiceTranslation
- FlowChoiceUserInputTranslation
- FlowComplexLiteralTranslation
- FlowCustomErrorMessageTranslation
- FlowInputParameterTranslation
- FlowTextTemplateTranslation

### Miscellaneous (12)

- FlowCategory
- FlowCategoryItems
- FlowCapability
- FlowCapabilityInput
- FlowCustomProperty
- FlowExperiment
- FlowIcon
- FlowNodeGroup
- FlowWaitEvent
- FlowFerovTranslation
- FlowOrchestrationStageTranslation
- FlowCoverageResult (from apex.xml)

**Total:** 119 components available for schema retrieval

---

## Appendix B: Tool Usage Statistics

Based on analysis of the codebase:

**Tool Implementation:**

- ✅ Fully implemented: `src/core/tools/retrieveSchemaTool.ts`
- ✅ Properly registered: `src/shared/tools.ts`
- ✅ Tool description: `src/core/prompts/tools/retrieve-schema.ts`
- ✅ Tests exist: `src/core/tools/__tests__/retrieveSchemaTool.spec.ts`

**Documentation References:**

- SCREEN-FLOW-PATTERNS.md: 8 references
- RECORD-TRIGGER-FLOW-PATTERNS.md: 12 references
- DETAILED-WORKFLOW.md: 10 references

**Tool Capability:**

- Searches: complexType, simpleType, element, message, operation
- Files: metadata.xml (29,850 lines), apex.xml (612 lines)
- Returns: Raw XML + related type list
- Error handling: Comprehensive

---

**End of Analysis Document**
**Version:** 1.0
**Date:** 2026-01-05

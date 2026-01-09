# Schema Retrieval Guide - Complete Examples

**Purpose:** This guide shows AI exactly how to use the `retrieve_schema` tool to get Salesforce Flow component schemas and build valid XML.

---

## Tool Overview

The `retrieve_schema` tool searches WSDL files (metadata.xml and apex.xml) for component definitions and returns the raw XML schema.

**Tool Syntax:**

```xml
<retrieve_schema>
<component_name>ComponentName</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>
```

**Parameters:**

- `component_name` (required): The exact component name (case-sensitive)
- `schema_file` (optional): "metadata" (default), "apex", or "both"

---

## Complete Workflow Example

### Scenario: Create a Screen Flow with Email Field

#### Step 1: Retrieve Main Flow Schema

**Tool Call:**

```xml
<retrieve_schema>
<component_name>Flow</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>
```

**Tool Returns:**

````xml
Schema definition for 'Flow' from Salesforce Metadata API v65.0:

```xml
<xsd:complexType name="Flow">
 <xsd:complexContent>
  <xsd:extension base="tns:Metadata">
   <xsd:sequence>
    <xsd:element name="actionCalls" minOccurs="0" maxOccurs="unbounded" type="tns:FlowActionCall"/>
    <xsd:element name="apiVersion" minOccurs="0" type="xsd:double"/>
    <xsd:element name="areMetricsLoggedToDataCloud" minOccurs="0" type="xsd:boolean"/>
    <xsd:element name="assignments" minOccurs="0" maxOccurs="unbounded" type="tns:FlowAssignment"/>
    <xsd:element name="choices" minOccurs="0" maxOccurs="unbounded" type="tns:FlowChoice"/>
    <xsd:element name="constants" minOccurs="0" maxOccurs="unbounded" type="tns:FlowConstant"/>
    <xsd:element name="customProperties" minOccurs="0" maxOccurs="unbounded" type="tns:FlowCustomProperty"/>
    <xsd:element name="decisions" minOccurs="0" maxOccurs="unbounded" type="tns:FlowDecision"/>
    <xsd:element name="description" minOccurs="0" type="xsd:string"/>
    <xsd:element name="environments" minOccurs="0" maxOccurs="unbounded" type="tns:FlowEnvironment"/>
    <xsd:element name="formulas" minOccurs="0" maxOccurs="unbounded" type="tns:FlowFormula"/>
    <xsd:element name="interviewLabel" minOccurs="0" type="xsd:string"/>
    <xsd:element name="label" minOccurs="0" type="xsd:string"/>
    <xsd:element name="loops" minOccurs="0" maxOccurs="unbounded" type="tns:FlowLoop"/>
    <xsd:element name="processMetadataValues" minOccurs="0" maxOccurs="unbounded" type="tns:FlowMetadataValue"/>
    <xsd:element name="processType" minOccurs="0" type="tns:FlowProcessType"/>
    <xsd:element name="recordCreates" minOccurs="0" maxOccurs="unbounded" type="tns:FlowRecordCreate"/>
    <xsd:element name="recordDeletes" minOccurs="0" maxOccurs="unbounded" type="tns:FlowRecordDelete"/>
    <xsd:element name="recordLookups" minOccurs="0" maxOccurs="unbounded" type="tns:FlowRecordLookup"/>
    <xsd:element name="recordUpdates" minOccurs="0" maxOccurs="unbounded" type="tns:FlowRecordUpdate"/>
    <xsd:element name="screens" minOccurs="0" maxOccurs="unbounded" type="tns:FlowScreen"/>
    <xsd:element name="start" minOccurs="0" type="tns:FlowStart"/>
    <xsd:element name="status" minOccurs="0" type="tns:FlowStatus"/>
    <xsd:element name="subflows" minOccurs="0" maxOccurs="unbounded" type="tns:FlowSubflow"/>
    <xsd:element name="textTemplates" minOccurs="0" maxOccurs="unbounded" type="tns:FlowTextTemplate"/>
    <xsd:element name="variables" minOccurs="0" maxOccurs="unbounded" type="tns:FlowVariable"/>
   </xsd:sequence>
  </xsd:extension>
 </xsd:complexContent>
</xsd:complexType>
````

Referenced types in this definition: Metadata, FlowActionCall, FlowAssignment, FlowChoice, FlowConstant, FlowCustomProperty, FlowDecision, FlowEnvironment, FlowFormula, FlowMetadataValue, FlowProcessType, FlowRecordCreate, FlowRecordDelete, FlowRecordLookup, FlowRecordUpdate, FlowScreen, FlowStart, FlowStatus, FlowSubflow, FlowTextTemplate, FlowVariable

To retrieve any of these related types, use the retrieve_schema tool with the type name.

````

**Interpretation:**
- `apiVersion` is optional (minOccurs="0") - type: double
- `areMetricsLoggedToDataCloud` is optional - type: boolean
- `screens` is an array (maxOccurs="unbounded") - type: FlowScreen
- `processType` is optional - type: FlowProcessType (enum)
- `variables` is an array - type: FlowVariable

---

#### Step 2: Retrieve FlowScreen Schema

**Tool Call:**
```xml
<retrieve_schema>
<component_name>FlowScreen</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>
````

**Tool Returns:**

````xml
Schema definition for 'FlowScreen' from Salesforce Metadata API v65.0:

```xml
<xsd:complexType name="FlowScreen">
 <xsd:complexContent>
  <xsd:extension base="tns:FlowNode">
   <xsd:sequence>
    <xsd:element name="allowBack" minOccurs="0" type="xsd:boolean"/>
    <xsd:element name="allowFinish" minOccurs="0" type="xsd:boolean"/>
    <xsd:element name="allowPause" minOccurs="0" type="xsd:boolean"/>
    <xsd:element name="backButtonLabel" minOccurs="0" type="xsd:string"/>
    <xsd:element name="fields" minOccurs="0" maxOccurs="unbounded" type="tns:FlowScreenField"/>
    <xsd:element name="helpText" minOccurs="0" type="xsd:string"/>
    <xsd:element name="nextOrFinishButtonLabel" minOccurs="0" type="xsd:string"/>
    <xsd:element name="pauseButtonLabel" minOccurs="0" type="xsd:string"/>
    <xsd:element name="pausedText" minOccurs="0" type="xsd:string"/>
    <xsd:element name="rules" minOccurs="0" maxOccurs="unbounded" type="tns:FlowScreenRule"/>
    <xsd:element name="showFooter" minOccurs="0" type="xsd:boolean"/>
    <xsd:element name="showHeader" minOccurs="0" type="xsd:boolean"/>
   </xsd:sequence>
  </xsd:extension>
 </xsd:complexContent>
</xsd:complexType>
````

Referenced types: FlowNode, FlowScreenField, FlowScreenRule

````

**Interpretation:**
- Extends FlowNode (inherits name, label, locationX, locationY, connector)
- All fields optional (minOccurs="0")
- `fields` is an array - must use FlowScreenField type
- Need to retrieve FlowNode and FlowScreenField next

---

#### Step 3: Retrieve FlowNode (Base Class)

**Tool Call:**
```xml
<retrieve_schema>
<component_name>FlowNode</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>
````

**Tool Returns:**

```xml
<xsd:complexType name="FlowNode">
 <xsd:complexContent>
  <xsd:extension base="tns:FlowElement">
   <xsd:sequence>
    <xsd:element name="elementSubtype" minOccurs="0" type="tns:FlowElementSubtype"/>
    <xsd:element name="label" minOccurs="0" type="xsd:string"/>
    <xsd:element name="locationX" minOccurs="0" type="xsd:int"/>
    <xsd:element name="locationY" minOccurs="0" type="xsd:int"/>
   </xsd:sequence>
  </xsd:extension>
 </xsd:complexContent>
</xsd:complexType>
```

Referenced types: FlowElement, FlowElementSubtype

**Interpretation:**

- FlowNode extends FlowElement
- Provides: label, locationX, locationY (all optional)
- Need to retrieve FlowElement to get name and connector

---

#### Step 4: Retrieve FlowElement

**Tool Call:**

```xml
<retrieve_schema>
<component_name>FlowElement</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>
```

**Tool Returns:**

```xml
<xsd:complexType name="FlowElement">
 <xsd:complexContent>
  <xsd:extension base="tns:FlowBaseElement">
   <xsd:sequence>
    <xsd:element name="description" minOccurs="0" type="xsd:string"/>
    <xsd:element name="name" minOccurs="0" type="xsd:string"/>
   </xsd:sequence>
  </xsd:extension>
 </xsd:complexContent>
</xsd:complexType>
```

**Interpretation:**

- FlowElement extends FlowBaseElement
- Provides: name, description (both optional)

---

#### Step 5: Retrieve FlowBaseElement

**Tool Call:**

```xml
<retrieve_schema>
<component_name>FlowBaseElement</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>
```

**Tool Returns:**

```xml
<xsd:complexType name="FlowBaseElement">
 <xsd:sequence>
  <xsd:element name="processMetadataValues" minOccurs="0" maxOccurs="unbounded" type="tns:FlowMetadataValue"/>
 </xsd:sequence>
</xsd:complexType>
```

**Interpretation:**

- Base of all flow elements
- Provides: processMetadataValues (optional array)

**Complete Inheritance Chain:**

```
FlowBaseElement (processMetadataValues)
  └─ FlowElement (name, description)
      └─ FlowNode (label, locationX, locationY, elementSubtype)
          └─ FlowScreen (allowBack, allowFinish, fields, etc.)
```

---

#### Step 6: Retrieve FlowScreenField

**Tool Call:**

```xml
<retrieve_schema>
<component_name>FlowScreenField</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>
```

**Tool Returns:**

```xml
<xsd:complexType name="FlowScreenField">
 <xsd:complexContent>
  <xsd:extension base="tns:FlowElement">
   <xsd:sequence>
    <xsd:element name="choiceReferences" minOccurs="0" maxOccurs="unbounded" type="xsd:string"/>
    <xsd:element name="dataType" minOccurs="0" type="tns:FlowDataType"/>
    <xsd:element name="defaultSelectedChoiceReference" minOccurs="0" type="xsd:string"/>
    <xsd:element name="defaultValue" minOccurs="0" type="tns:FlowElementReferenceOrValue"/>
    <xsd:element name="extensionName" minOccurs="0" type="xsd:string"/>
    <xsd:element name="fieldText" minOccurs="0" type="xsd:string"/>
    <xsd:element name="fieldType" minOccurs="0" type="tns:FlowScreenFieldType"/>
    <xsd:element name="helpText" minOccurs="0" type="xsd:string"/>
    <xsd:element name="inputParameters" minOccurs="0" maxOccurs="unbounded" type="tns:FlowScreenFieldInputParameter"/>
    <xsd:element name="inputsOnNextNavToAssocScrn" minOccurs="0" type="tns:FlowScreenFieldInputsRevisited"/>
    <xsd:element name="isRequired" minOccurs="0" type="xsd:boolean"/>
    <xsd:element name="isVisible" minOccurs="0" type="xsd:boolean"/>
    <xsd:element name="objectFieldReference" minOccurs="0" type="xsd:string"/>
    <xsd:element name="outputParameters" minOccurs="0" maxOccurs="unbounded" type="tns:FlowScreenFieldOutputParameter"/>
    <xsd:element name="regionContainerType" minOccurs="0" type="tns:FlowRegionContainerType"/>
    <xsd:element name="scale" minOccurs="0" type="xsd:int"/>
    <xsd:element name="storeOutputAutomatically" minOccurs="0" type="xsd:boolean"/>
    <xsd:element name="styleProperties" minOccurs="0" maxOccurs="unbounded" type="tns:FlowScreenFieldStyleProperties"/>
    <xsd:element name="validationRule" minOccurs="0" type="tns:FlowInputValidationRule"/>
    <xsd:element name="visibilityRule" minOccurs="0" type="tns:FlowVisibilityRule"/>
   </xsd:sequence>
  </xsd:extension>
 </xsd:complexContent>
</xsd:complexType>
```

Referenced types: FlowElement, FlowDataType, FlowElementReferenceOrValue, FlowScreenFieldType, FlowScreenFieldInputParameter, FlowScreenFieldInputsRevisited, FlowScreenFieldOutputParameter, FlowRegionContainerType, FlowScreenFieldStyleProperties, FlowInputValidationRule, FlowVisibilityRule

**Interpretation:**

- Extends FlowElement (has name, description)
- For InputField: use `dataType`, `fieldText`, `fieldType`
- For ComponentInstance: use `extensionName`, `fieldType`, `storeOutputAutomatically`
- `inputsOnNextNavToAssocScrn` should be set (FlowScreenFieldInputsRevisited enum)
- `styleProperties` is an array

---

#### Step 7: Retrieve Enum Types

**Tool Call:**

```xml
<retrieve_schema>
<component_name>FlowScreenFieldType</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>
```

**Tool Returns:**

```xml
<xsd:simpleType name="FlowScreenFieldType">
 <xsd:restriction base="xsd:string">
  <xsd:enumeration value="DisplayText"/>
  <xsd:enumeration value="InputField"/>
  <xsd:enumeration value="LargeTextArea"/>
  <xsd:enumeration value="PasswordField"/>
  <xsd:enumeration value="RadioButtons"/>
  <xsd:enumeration value="DropdownBox"/>
  <xsd:enumeration value="MultiSelectCheckboxes"/>
  <xsd:enumeration value="MultiSelectPicklist"/>
  <xsd:enumeration value="ComponentInstance"/>
  <xsd:enumeration value="ComponentChoice"/>
  <xsd:enumeration value="ComponentInput"/>
  <xsd:enumeration value="ObjectProvided"/>
  <xsd:enumeration value="Region"/>
  <xsd:enumeration value="RegionContainer"/>
 </xsd:restriction>
</xsd:simpleType>
```

**Interpretation:**

- Use `InputField` for basic text inputs
- Use `ComponentInstance` for specialized components (email, phone, etc.)

---

#### Step 8: Retrieve FlowConnector

**Tool Call:**

```xml
<retrieve_schema>
<component_name>FlowConnector</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>
```

**Tool Returns:**

```xml
<xsd:complexType name="FlowConnector">
 <xsd:sequence>
  <xsd:element name="isGoTo" minOccurs="0" type="xsd:boolean"/>
  <xsd:element name="targetReference" minOccurs="0" type="xsd:string"/>
 </xsd:sequence>
</xsd:complexType>
```

**Interpretation:**

- `targetReference` points to another element's name
- `isGoTo` indicates a "Go To" connector

---

## Building Valid XML from Schema

### Example: Create Screen Element

**From Schema, We Know:**

1. FlowScreen extends FlowNode extends FlowElement
2. Required inherited fields: name
3. Useful optional fields: label, locationX, locationY, allowBack, allowFinish
4. Screen fields use FlowScreenField type
5. Must add connector to next element

**Valid XML:**

```xml
<screens>
    <!-- From FlowElement -->
    <name>Email_Screen</name>

    <!-- From FlowNode -->
    <label>Enter Email</label>
    <locationX>176</locationX>
    <locationY>158</locationY>

    <!-- From FlowScreen -->
    <allowBack>true</allowBack>
    <allowFinish>true</allowFinish>
    <allowPause>false</allowPause>

    <!-- FlowScreenField (ComponentInstance) -->
    <fields>
        <name>Email_Field</name>
        <extensionName>flowruntime:email</extensionName>
        <fieldType>ComponentInstance</fieldType>
        <inputParameters>
            <name>label</name>
            <value>
                <stringValue>Email Address</stringValue>
            </value>
        </inputParameters>
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

    <!-- FlowConnector -->
    <connector>
        <targetReference>Next_Element</targetReference>
    </connector>

    <showFooter>true</showFooter>
    <showHeader>true</showHeader>
</screens>
```

---

## Common Component Retrieval Patterns

### Pattern 1: DML Element (Create Records)

**Tool Calls:**

```xml
<retrieve_schema>
<component_name>FlowRecordCreate</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>
```

**Key Schema Fields:**

- `object` - SObject type to create
- `inputReference` - Variable containing record(s)
- `inputAssignments` - Field-by-field assignments
- `connector` - Success path
- `faultConnector` - Error path (REQUIRED)

**Valid XML:**

```xml
<recordCreates>
    <name>Create_Lead</name>
    <label>Create Lead</label>
    <locationX>176</locationX>
    <locationY>458</locationY>

    <!-- Use inputReference for variable-based creation -->
    <inputReference>LeadRecord</inputReference>

    <!-- Or use inputAssignments for field-by-field -->
    <!-- <object>Lead</object>
    <inputAssignments>
        <field>FirstName</field>
        <value>
            <elementReference>First_Name_Field</elementReference>
        </value>
    </inputAssignments> -->

    <connector>
        <targetReference>Success_Screen</targetReference>
    </connector>

    <!-- REQUIRED for DML -->
    <faultConnector>
        <targetReference>Error_Screen</targetReference>
    </faultConnector>
</recordCreates>
```

---

### Pattern 2: Decision Element

**Tool Calls:**

```xml
<retrieve_schema>
<component_name>FlowDecision</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>

<retrieve_schema>
<component_name>FlowRule</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>

<retrieve_schema>
<component_name>FlowCondition</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>
```

**Key Schema Fields:**

- `rules` - Array of FlowRule (outcomes)
- `defaultConnector` - Fallback path (REQUIRED)
- `defaultConnectorLabel` - Label for default path
- Each rule has conditions and connector

**Valid XML:**

```xml
<decisions>
    <name>Check_Annual_Revenue</name>
    <label>Check Annual Revenue</label>
    <locationX>176</locationX>
    <locationY>278</locationY>

    <!-- Default path REQUIRED -->
    <defaultConnector>
        <targetReference>Default_Action</targetReference>
    </defaultConnector>
    <defaultConnectorLabel>Less than $1M</defaultConnectorLabel>

    <!-- Outcome 1 -->
    <rules>
        <name>High_Value</name>
        <conditionLogic>and</conditionLogic>
        <conditions>
            <leftValueReference>$Record.AnnualRevenue</leftValueReference>
            <operator>GreaterThan</operator>
            <rightValue>
                <numberValue>1000000</numberValue>
            </rightValue>
        </conditions>
        <connector>
            <targetReference>High_Value_Action</targetReference>
        </connector>
        <label>Annual Revenue > $1M</label>
    </rules>
</decisions>
```

---

### Pattern 3: Loop Element

**Tool Calls:**

```xml
<retrieve_schema>
<component_name>FlowLoop</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>
```

**Key Schema Fields:**

- `collectionReference` - Collection variable to iterate
- `iterationOrder` - Asc or Desc
- `nextValueConnector` - Loop body path (REQUIRED)
- `noMoreValuesConnector` - After loop path (REQUIRED)

**Valid XML:**

```xml
<loops>
    <name>Process_Opportunities</name>
    <label>Loop Through Opportunities</label>
    <locationX>176</locationX>
    <locationY>398</locationY>

    <collectionReference>OpportunityCollection</collectionReference>
    <iterationOrder>Asc</iterationOrder>

    <!-- Loop body - CANNOT contain DML -->
    <nextValueConnector>
        <targetReference>Update_Fields_Assignment</targetReference>
    </nextValueConnector>

    <!-- After loop completes -->
    <noMoreValuesConnector>
        <targetReference>Bulk_Update_DML</targetReference>
    </noMoreValuesConnector>
</loops>
```

---

### Pattern 4: Assignment Element

**Tool Calls:**

```xml
<retrieve_schema>
<component_name>FlowAssignment</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>

<retrieve_schema>
<component_name>FlowAssignmentItem</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>
```

**Key Schema Fields:**

- `assignmentItems` - Array of FlowAssignmentItem
- Each item has: `assignToReference`, `operator`, `value`
- `operator` can be: Assign, Add, Subtract, etc.

**Valid XML:**

```xml
<assignments>
    <name>Set_Lead_Fields</name>
    <label>Assign Lead Values</label>
    <locationX>176</locationX>
    <locationY>278</locationY>

    <!-- Assignment 1: Simple value -->
    <assignmentItems>
        <assignToReference>LeadRecord.Company</assignToReference>
        <operator>Assign</operator>
        <value>
            <elementReference>Company_Field</elementReference>
        </value>
    </assignmentItems>

    <!-- Assignment 2: Component field (needs .value) -->
    <assignmentItems>
        <assignToReference>LeadRecord.Email</assignToReference>
        <operator>Assign</operator>
        <value>
            <elementReference>Email_Field.value</elementReference>
        </value>
    </assignmentItems>

    <!-- Assignment 3: Static value -->
    <assignmentItems>
        <assignToReference>LeadRecord.Status</assignToReference>
        <operator>Assign</operator>
        <value>
            <stringValue>Working - Contacted</stringValue>
        </value>
    </assignmentItems>

    <connector>
        <targetReference>Create_Lead</targetReference>
    </connector>
</assignments>
```

---

### Pattern 5: Variable Definition

**Tool Calls:**

```xml
<retrieve_schema>
<component_name>FlowVariable</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>

<retrieve_schema>
<component_name>FlowDataType</component_name>
<schema_file>metadata</schema_file>
</retrieve_schema>
```

**Key Schema Fields:**

- `name` - Variable API name
- `dataType` - Type enum (String, Boolean, Number, Date, SObject, etc.)
- `isCollection` - Single vs collection
- `isInput` / `isOutput` - For subflows/autolaunched flows
- `objectType` - For SObject variables

**Valid XML:**

```xml
<!-- String Variable -->
<variables>
    <name>CompanyName</name>
    <dataType>String</dataType>
    <isCollection>false</isCollection>
    <isInput>false</isInput>
    <isOutput>false</isOutput>
</variables>

<!-- SObject Variable -->
<variables>
    <name>LeadRecord</name>
    <dataType>SObject</dataType>
    <isCollection>false</isCollection>
    <isInput>false</isInput>
    <isOutput>false</isOutput>
    <objectType>Lead</objectType>
</variables>

<!-- Collection Variable -->
<variables>
    <name>OpportunityList</name>
    <dataType>SObject</dataType>
    <isCollection>true</isCollection>
    <isInput>false</isInput>
    <isOutput>false</isOutput>
    <objectType>Opportunity</objectType>
</variables>
```

---

## Quick Reference: Common Components to Retrieve

### Flow Structure

- `Flow` - Main flow definition
- `FlowStart` - Start element
- `FlowMetadataValue` - Metadata properties
- `FlowCustomProperty` - Custom properties

### Flow Elements

- `FlowScreen` - Screen elements
- `FlowRecordCreate` - Create records
- `FlowRecordUpdate` - Update records
- `FlowRecordDelete` - Delete records
- `FlowRecordLookup` - Get records
- `FlowAssignment` - Assignment
- `FlowDecision` - Decision
- `FlowLoop` - Loop
- `FlowSubflow` - Call subflow
- `FlowActionCall` - Call action
- `FlowApexPluginCall` - Call Apex

### Variables & Resources

- `FlowVariable` - Variables
- `FlowFormula` - Formulas
- `FlowConstant` - Constants
- `FlowTextTemplate` - Text templates
- `FlowChoice` - Picklist choices
- `FlowDynamicChoiceSet` - Dynamic picklist

### Supporting Types

- `FlowConnector` - Connectors
- `FlowCondition` - Conditions
- `FlowRule` - Decision outcomes
- `FlowRecordFilter` - Record filters
- `FlowScreenField` - Screen fields
- `FlowAssignmentItem` - Assignment items
- `FlowInputFieldAssignment` - DML field assignments
- `FlowScreenFieldInputParameter` - Screen field parameters
- `FlowScreenFieldStyleProperties` - Screen field styling

### Enums (Important)

- `FlowProcessType` - Flow type (Flow, AutoLaunchedFlow, etc.)
- `FlowDataType` - Variable data types
- `FlowScreenFieldType` - Screen field types
- `FlowComparisonOperator` - Condition operators
- `FlowAssignmentOperator` - Assignment operators
- `FlowRecordTriggerType` - Trigger types (Create, Update, Delete)
- `FlowTriggerType` - Timing (RecordBeforeSave, RecordAfterSave)

---

## Best Practices

### 1. Always Start with Main Component

Retrieve the primary component first (Flow, FlowScreen, FlowRecordCreate), then follow references to related types.

### 2. Follow the Inheritance Chain

When you see `<xsd:extension base="tns:FlowNode">`, retrieve FlowNode to understand inherited fields.

### 3. Check minOccurs and maxOccurs

- `minOccurs="0"` = Optional field
- No minOccurs or minOccurs="1" = Required field
- `maxOccurs="unbounded"` = Array/collection

### 4. Retrieve Enum Types

When you see `type="tns:FlowProcessType"`, retrieve that enum to see valid values.

### 5. Validate Against Schema

After building XML, cross-check that:

- All required fields are present
- Field types match schema (string, boolean, int)
- Array fields use proper structure
- Enum values are valid

---

## Troubleshooting

### Component Not Found

**Error:** `Component 'FlowScreenFields' not found`

**Solution:**

1. Check spelling (case-sensitive)
2. Try singular form: FlowScreenField
3. Search both files: `<schema_file>both</schema_file>`

### Too Many Related Types

**Problem:** Schema shows 20+ referenced types

**Solution:**

1. Start with the main type
2. Only retrieve types you'll actually use
3. Use inheritance chain to understand structure
4. Refer to pattern examples for common combinations

### Unclear Field Purpose

**Problem:** Schema shows field but purpose unclear

**Solution:**

1. Check SCREEN-FLOW-PATTERNS.md or RECORD-TRIGGER-FLOW-PATTERNS.md for examples
2. Retrieve enum type if field uses enum
3. Look at minOccurs to determine if required
4. Refer to official Salesforce documentation

---

**End of Schema Retrieval Guide**
**Version:** 1.0
**Last Updated:** 2026-01-05

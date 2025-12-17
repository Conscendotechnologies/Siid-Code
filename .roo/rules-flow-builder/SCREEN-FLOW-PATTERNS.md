# Screen Flow Patterns - Real-World Examples

## 📖 Getting Schema Information

**BEFORE building any Flow component, ALWAYS use the `retrieve_schema` tool to get the official Salesforce Metadata API definitions.**

### How to Use retrieve_schema Tool:

```xml
<retrieve_schema>
<component_name>Flow</component_name>
</retrieve_schema>
```

**Common Flow Components to Retrieve:**

- `Flow` - Main flow definition and structure
- `FlowScreen` - Screen element with fields
- `FlowRecordCreate` - Create Records element
- `FlowRecordUpdate` - Update Records element
- `FlowRecordDelete` - Delete Records element
- `FlowRecordLookup` - Get Records element
- `FlowAssignment` - Assignment element
- `FlowDecision` - Decision element
- `FlowLoop` - Loop element
- `FlowVariable` - Variable definitions
- `FlowStart` - Start element configuration

The tool returns:

- ✅ All available properties and their types
- ✅ Required vs optional fields
- ✅ Enum values for choice fields
- ✅ Nested type definitions
- ✅ Official WSDL-based schema from Salesforce

---

## ✅ Complete Working Screen Flow Template

This example shows the CORRECT way Salesforce UI generates Screen Flows:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>65.0</apiVersion>
    <areMetricsLoggedToDataCloud>false</areMetricsLoggedToDataCloud>
    <interviewLabel>Create Lead {!$Flow.CurrentDateTime}</interviewLabel>
    <label>Create Lead</label>
    <processType>Flow</processType>
    <environments>Default</environments>

    <!-- Metadata Properties (REQUIRED) -->
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

    <!-- Custom Properties for Screen Flows -->
    <customProperties>
        <name>ScreenProgressIndicator</name>
        <value><stringValue>{"location":"top","type":"simple"}</stringValue></value>
    </customProperties>

    <!-- Variables -->
    <variables>
        <name>LeadRecord</name>
        <dataType>SObject</dataType>
        <isCollection>false</isCollection>
        <isInput>false</isInput>
        <isOutput>false</isOutput>
        <objectType>Lead</objectType>
    </variables>

    <!-- Start Element -->
    <start>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <connector>
            <targetReference>Lead_Screen</targetReference>
        </connector>
    </start>

    <!-- Screen Element (CRITICAL PATTERN) -->
    <screens>
        <name>Lead_Screen</name>
        <label>Lead Information</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <allowBack>true</allowBack>
        <allowFinish>true</allowFinish>
        <allowPause>true</allowPause>
        <connector>
            <targetReference>Lead_Assignment</targetReference>
        </connector>

        <!-- Input Field (Text/String) -->
        <fields>
            <name>Company_Field</name>
            <dataType>String</dataType>
            <fieldText>Company</fieldText>
            <fieldType>InputField</fieldType>
            <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn>
            <isRequired>false</isRequired>
            <styleProperties>
                <verticalAlignment><stringValue>top</stringValue></verticalAlignment>
                <width><stringValue>12</stringValue></width>
            </styleProperties>
        </fields>

        <!-- Component Instance (Email) - CORRECT PATTERN -->
        <fields>
            <name>Email_Field</name>
            <extensionName>flowruntime:email</extensionName>
            <fieldType>ComponentInstance</fieldType>
            <inputParameters>
                <name>label</name>
                <value><stringValue>Email</stringValue></value>
            </inputParameters>
            <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn>
            <isRequired>true</isRequired>
            <storeOutputAutomatically>true</storeOutputAutomatically>
            <styleProperties>
                <verticalAlignment><stringValue>top</stringValue></verticalAlignment>
                <width><stringValue>12</stringValue></width>
            </styleProperties>
        </fields>

        <!-- Component Instance (Phone) - CORRECT PATTERN -->
        <fields>
            <name>Phone_Field</name>
            <extensionName>flowruntime:phone</extensionName>
            <fieldType>ComponentInstance</fieldType>
            <inputParameters>
                <name>label</name>
                <value><stringValue>Phone</stringValue></value>
            </inputParameters>
            <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn>
            <isRequired>true</isRequired>
            <storeOutputAutomatically>true</storeOutputAutomatically>
            <styleProperties>
                <verticalAlignment><stringValue>top</stringValue></verticalAlignment>
                <width><stringValue>12</stringValue></width>
            </styleProperties>
        </fields>

        <showFooter>false</showFooter>
        <showHeader>true</showHeader>
    </screens>

    <!-- Assignment Element (CORRECT REFERENCE PATTERN) -->
    <assignments>
        <name>Lead_Assignment</name>
        <label>Assign Lead Fields</label>
        <locationX>0</locationX>
        <locationY>0</locationY>

        <!-- Regular InputField - use elementReference directly -->
        <assignmentItems>
            <assignToReference>LeadRecord.Company</assignToReference>
            <operator>Assign</operator>
            <value>
                <elementReference>Company_Field</elementReference>
            </value>
        </assignmentItems>

        <!-- Component Field - MUST use .value suffix -->
        <assignmentItems>
            <assignToReference>LeadRecord.Email</assignToReference>
            <operator>Assign</operator>
            <value>
                <elementReference>Email_Field.value</elementReference>
            </value>
        </assignmentItems>

        <!-- Component Field - MUST use .value suffix -->
        <assignmentItems>
            <assignToReference>LeadRecord.Phone</assignToReference>
            <operator>Assign</operator>
            <value>
                <elementReference>Phone_Field.value</elementReference>
            </value>
        </assignmentItems>

        <connector>
            <targetReference>Create_Lead</targetReference>
        </connector>
    </assignments>

    <!-- DML Element (CORRECT PATTERN - inputReference) -->
    <recordCreates>
        <name>Create_Lead</name>
        <label>Create Lead</label>
        <locationX>0</locationX>
        <locationY>0</locationY>
        <inputReference>LeadRecord</inputReference>
    </recordCreates>

    <status>Active</status>
</Flow>
```

---

## 🔑 Key Patterns Explained

### 1. Screen Field Configuration - CRITICAL DIFFERENCES

**✅ CORRECT - Input Field (Text/String/Number):**

```xml
<fields>
    <name>Company_Field</name>
    <dataType>String</dataType>
    <fieldText>Company</fieldText>
    <fieldType>InputField</fieldType>
    <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn>
    <isRequired>false</isRequired>
    <styleProperties>
        <verticalAlignment><stringValue>top</stringValue></verticalAlignment>
        <width><stringValue>12</stringValue></width>
    </styleProperties>
</fields>
```

**✅ CORRECT - Component Instance (Email/Phone):**

```xml
<fields>
    <name>Email_Field</name>
    <extensionName>flowruntime:email</extensionName>
    <fieldType>ComponentInstance</fieldType>
    <inputParameters>
        <name>label</name>
        <value><stringValue>Email</stringValue></value>
    </inputParameters>
    <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn>
    <isRequired>true</isRequired>
    <storeOutputAutomatically>true</storeOutputAutomatically>
    <styleProperties>
        <verticalAlignment><stringValue>top</stringValue></verticalAlignment>
        <width><stringValue>12</stringValue></width>
    </styleProperties>
</fields>
```

**❌ WRONG - DO NOT use targetReference on screen fields:**

```xml
<!-- NEVER DO THIS -->
<fields>
    <name>Email_Field</name>
    <fieldType>InputField</fieldType>
    <targetReference>email</targetReference>  <!-- WRONG! -->
</fields>
```

---

### 2. Assignment Element Reference Pattern

**✅ CORRECT - Regular InputField (no .value suffix):**

```xml
<assignmentItems>
    <assignToReference>LeadRecord.Company</assignToReference>
    <operator>Assign</operator>
    <value>
        <elementReference>Company_Field</elementReference>
    </value>
</assignmentItems>
```

**✅ CORRECT - Component Field (MUST have .value suffix):**

```xml
<assignmentItems>
    <assignToReference>LeadRecord.Email</assignToReference>
    <operator>Assign</operator>
    <value>
        <elementReference>Email_Field.value</elementReference>
    </value>
</assignmentItems>
```

---

### 3. DML Pattern for Screen Flows

**✅ CORRECT - Use inputReference with SObject variable:**

```xml
<recordCreates>
    <name>Create_Lead</name>
    <label>Create Lead</label>
    <inputReference>LeadRecord</inputReference>
</recordCreates>
```

**⚠️ SUBOPTIMAL - Field-by-field inputAssignments (works but verbose):**

```xml
<recordCreates>
    <name>Create_Lead</name>
    <label>Create Lead</label>
    <object>Lead</object>
    <inputAssignments>
        <field>Company</field>
        <value><elementReference>Company_Field</elementReference></value>
    </inputAssignments>
    <inputAssignments>
        <field>Email</field>
        <value><elementReference>Email_Field.value</elementReference></value>
    </inputAssignments>
    <!-- ... more fields ... -->
</recordCreates>
```

---

### 4. Mandatory Metadata Fields (ALWAYS INCLUDE)

```xml
<!-- These are REQUIRED in every flow -->
<apiVersion>65.0</apiVersion>
<areMetricsLoggedToDataCloud>false</areMetricsLoggedToDataCloud>
<environments>Default</environments>
<interviewLabel>Flow Name {!$Flow.CurrentDateTime}</interviewLabel>

<!-- processMetadataValues - REQUIRED -->
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

<!-- For Screen Flows, add customProperties -->
<customProperties>
    <name>ScreenProgressIndicator</name>
    <value><stringValue>{"location":"top","type":"simple"}</stringValue></value>
</customProperties>
```

---

### 5. Component Extension Names (Common Components)

- **Email:** `flowruntime:email`
- **Phone:** `flowruntime:phone`
- **URL:** `flowruntime:url`
- **Currency:** `flowruntime:currency`
- **Number:** `flowruntime:number`
- **Date:** `flowruntime:date`
- **DateTime:** `flowruntime:datetime`
- **Checkbox:** `flowruntime:checkbox`
- **Picklist:** `flowruntime:picklist`
- **Radio Buttons:** `flowruntime:radioButtons`

**💡 To get complete schema and all properties for any component:**

```xml
<retrieve_schema>
<component_name>FlowScreenField</component_name>
</retrieve_schema>
```

This returns all available properties, their data types, and enum values for the component.

---

## 📋 Screen Flow Mandatory Pattern

**When building a Screen Flow, ALWAYS follow this pattern:**

1. **Define SObject variable** (e.g., LeadRecord, AccountRecord)
2. **Screen with proper field configuration:**
    - InputField for text/string/number with `dataType` and `fieldType`
    - ComponentInstance for specialized fields (email, phone) with `extensionName` and `storeOutputAutomatically`
    - NEVER use `targetReference` on screen fields
    - ALWAYS include `inputsOnNextNavToAssocScrn`
    - ALWAYS include `styleProperties`
3. **Assignment element:**
    - Assign screen field values to SObject variable fields
    - Use `<elementReference>FieldName</elementReference>` for InputField
    - Use `<elementReference>FieldName.value</elementReference>` for ComponentInstance
4. **DML element:**
    - Use `<inputReference>` with SObject variable
    - NOT `inputAssignments` (field-by-field)

**Example Flow:**

```
Screen (Email_Field) → Assignment (Email_Field.value → LeadRecord.Email) → Create Records (inputReference: LeadRecord)
```

---

## ❌ Common Anti-Patterns (DO NOT DO THIS)

1. ❌ **DO NOT use targetReference on screen fields**
2. ❌ **DO NOT forget extensionName for component fields**
3. ❌ **DO NOT forget storeOutputAutomatically for component fields**
4. ❌ **DO NOT forget .value suffix when referencing component fields in assignments**
5. ❌ **DO NOT add HTML comments in Flow XML** (`<!-- comment -->`)
6. ❌ **DO NOT define explicit `<end>` elements** (Salesforce handles automatically)
7. ❌ **DO NOT forget metadata fields** (areMetricsLoggedToDataCloud, environments, processMetadataValues)
8. ❌ **DO NOT forget customProperties for Screen Flows**

---

**Reference Date:** 2025-12-16
**Source:** Manually created flow from Salesforce UI
**File:** `Create_lead_Mannually_created.flow-meta.xml`

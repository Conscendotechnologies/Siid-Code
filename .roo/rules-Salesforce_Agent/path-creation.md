**Salesforce Path Creation**

# Mode Overview

This mode assists the AI model in creating Salesforce Paths by generating the necessary XML files in the pathAssistants directory. Paths are guidance tools that help users navigate through stages of a process based on picklist field values. The generated XML is compliant with Salesforce Metadata API standards and ready for deployment.

**Instructions(IMPORTANT!!)**

# Strict Rules for Salesforce Path Creation

## Gather Required Information

- Before creating a path, you MUST have:
    1. **Object Name** - The object where the path will be created (e.g., Opportunity, Lead, Custom_Object\_\_c)
    2. **Picklist Field Name** - The field that contains the stages/steps for the path (e.g., StageName, Status, Stage\_\_c)
- If the user does not provide BOTH pieces of information:
    - Ask: "On which object would you like to create the path?"
    - Ask: "Which picklist field should the path be based on?"
- Examples of user requests:
    - ❌ "Create a path" → Ask for object AND field
    - ❌ "Create a path on Opportunity" → Ask for the picklist field
    - ❌ "Create a path on StageName" → Ask for the object
    - ✅ "Create a path on Opportunity StageName" → Proceed

## Retrieve Object Metadata (MANDATORY FIRST STEP)

- **CRITICAL: Before proceeding with path creation, you MUST retrieve the object metadata.**
- **Use the <retrieve_sf_metadata> tool with metadata_type "CustomObject" to retrieve all objects**
- This will retrieve the complete object metadata structure including all subfolders and files.

**Understanding the Object Folder Structure (CRITICAL):**

The retrieved object metadata is organized in subfolders, NOT in a single XML file:

```
force-app/main/default/objects/<ObjectName>/
├── <ObjectName>.object-meta.xml         (Main object definition - NOT ALL METADATA)
├── fields/                              (All field definitions)
│   ├── <FieldName1>.field-meta.xml
│   ├── <FieldName2>.field-meta.xml
│   └── <Mic_Color__c>.field-meta.xml
├── recordTypes/                         (All record type definitions)
│   ├── <RecordType1>.recordType-meta.xml
│   └── <RecordType2>.recordType-meta.xml
├── listViews/                           (All list view definitions)
│   └── <ListView1>.listView-meta.xml
├── validationRules/                     (All validation rules)
│   └── <Rule1>.validationRule-meta.xml
└── ... (other subfolders)
```

**IMPORTANT:**

- The main `<ObjectName>.object-meta.xml` file contains basic object settings only
- Fields are in the `fields/` subfolder
- Record types are in the `recordTypes/` subfolder
- Each component has its own separate XML file

## Parse Object Metadata and Extract Record Types (MANDATORY SECOND STEP)

- **After retrieval completes, read and parse the object metadata.**
- **IMPORTANT: Record types are stored in separate files, NOT in the main object XML file.**
- **Location of record type files:** `force-app/main/default/objects/<ObjectName>/recordTypes/`
- Each record type has its own file: `<RecordTypeDeveloperName>.recordType-meta.xml`
- Read each record type file in the recordTypes folder to extract all record type names from `<fullName>` tags.

**Example of Record Type in Metadata XML:**

```xml
<recordTypes>
    <fullName>Enterprise</fullName>
    <label>Enterprise Sales</label>
    <active>true</active>
</recordTypes>
<recordTypes>
    <fullName>SMB</fullName>
    <label>Small Business</label>
    <active>true</active>
</recordTypes>
```

- **Extract the record type API names** (the value in `<fullName>` tags).
- Store all found record types in a list.

## Record Type Selection (MANDATORY THIRD STEP)

- **CRITICAL: User must select a record type before proceeding.**
- **Salesforce allows only ONE active path per object per record type.**

- **If record types exist in the metadata:**
    - List all available record types to the user with their full names.
    - Ask: "This object has multiple record types. Which record type should this path be created for?"
    - Display format: "Available record types: [RecordType1], [RecordType2], [RecordType3]"
    - **Example:** "Available record types: Enterprise, SMB, Partner"
    - **User MUST select one record type** - do not proceed without selection.
    - **WAIT for user to select a record type.**
- **If NO record types exist in the metadata:**

    - Inform the user: "This object uses the Master record type. Creating path for the Master record type."
    - Automatically select Master as the record type.
    - No user selection needed - proceed to next step.

- **NEVER create a path without checking for record types first.**

**CRITICAL RULE - RECORD TYPE IS ALWAYS REQUIRED:**

- Every path XML MUST include `<recordTypeName>` tag
- If NO record types exist on object → Use Master
- If specific record types exist → User must select one
- XML MUST ALWAYS have: `<recordTypeName>Master</recordTypeName>` OR `<recordTypeName>SpecificRecordType</recordTypeName>`
- NEVER omit `<recordTypeName>` tag
- **ERROR: "Required field is missing: recordTypeName" occurs if this tag is missing**

## Verify Picklist Field (MANDATORY FOURTH STEP)

- **After record type is selected, verify the picklist field exists in the metadata.**
- **IMPORTANT: Fields are stored in separate files, NOT in the main object XML file.**
- **Location of field files:** `force-app/main/default/objects/<ObjectName>/fields/`
- The field should be in: `force-app/main/default/objects/<ObjectName>/fields/<FieldName>.field-meta.xml`
- **Read the field XML file to verify the field type is picklist:**
    - Look for `<type>Picklist</type>` tag
- **If the field doesn't exist or is not a picklist:**
    - Inform the user immediately
    - STOP the process
    - Do not proceed with path creation

## Check for Existing Paths (MANDATORY FIFTH STEP)

**🛑 CRITICAL STOP POINT - EXISTING PATH CHECK:**

- **CRITICAL: Before creating a new path, check if a path already exists for the selected record type.**
- **Use the <retrieve_sf_metadata> tool with metadata_type "PathAssistant" to retrieve all existing paths**
- Check if a path exists for the object/field/record type combination.
- **If an existing path is found:**
    - **STOP IMMEDIATELY - DO NOT PROCEED WITH PATH CREATION**
    - **DO NOT create XML file**
    - Inform the user: "A path already exists for [Object].[Field] on the [RecordType] record type."
    - Present two options:
        1. "Would you like to UPDATE the existing path?"
        2. "Would you like to DELETE the existing path and create a new one?"
    - **If user chooses UPDATE:**
        - Retrieve the existing path XML
        - Ask what changes they want to make
        - Update the XML accordingly
        - Deploy the updated path
    - **If user chooses DELETE:**
        - Execute the delete command:
            ```bash
            sf project delete source --metadata PathAssistant:<ObjectName>_<FieldName> --json
            ```
        - **WAIT for command completion**
        - Or use destructive changes:
            ```bash
            sf project deploy start --metadata-dir force-app/main/default/pathAssistants/<ObjectName>_<FieldName>.pathAssistant-meta.xml --pre-destructive-changes destructiveChanges.xml --json
            ```
        - Confirm deletion was successful
        - Proceed with creating the new path
- **If NO existing path is found:**
    - Proceed with creating a new path.
- **VIOLATION OF THIS RULE CAUSES ERROR: "Cannot create more than 1 Path per sobjectType and recordType"**
- **Remember: Only ONE path can be active per object per record type at a time.**

## Fetch Picklist Values (MANDATORY SIXTH STEP)

- **Extract all picklist values from the specified field from the already retrieved metadata.**
- **Read the field file:** `force-app/main/default/objects/<ObjectName>/fields/<FieldName>.field-meta.xml`
- The picklist values are in the field metadata under `<valueSet>` → `<valueSetDefinition>` → `<value>` tags.
- **Example of picklist values in metadata:**

```xml
<fields>
    <fullName>StageName</fullName>
    <type>Picklist</type>
    <valueSet>
        <valueSetDefinition>
            <value>
                <fullName>Prospecting</fullName>
                <default>true</default>
                <label>Prospecting</label>
            </value>
            <value>
                <fullName>Qualification</fullName>
                <default>false</default>
                <label>Qualification</label>
            </value>
            <value>
                <fullName>Closed Won</fullName>
                <default>false</default>
                <label>Closed Won</label>
            </value>
        </valueSetDefinition>
    </valueSet>
</fields>
```

- **Extract the `<fullName>` value from each `<value>` block** - these are the picklist values.
- **Important**: If the field has record type-specific picklist values, use only the values available for the selected record type.
- Look for `<recordType>` tags within the field metadata to identify record-type-specific values.
- Picklist values are case-sensitive and must match exactly.
- Store these values - the path will work for all picklist values even if no key fields are specified.

## File Creation

- **IMPORTANT:** Create the path XML file directly in the pathAssistants directory.
- File structure: `force-app/main/default/pathAssistants/<CleanObjectName>_<CleanFieldName>.pathAssistant-meta.xml`
- **Use underscore (\_) to separate object and field names, NOT a dot (.)**
- **CRITICAL: Remove `__c` suffix from custom object and field names to avoid consecutive underscores**

**FILE NAMING RULES:**

1. **Remove `__c` from custom objects:**

    - `Nineteen__c` becomes `Nineteen`
    - `Custom_Object__c` becomes `Custom_Object`

2. **Remove `__c` from custom fields:**

    - `Mic_Color__c` becomes `Mic_Color`
    - `Stage__c` becomes `Stage`

3. **Keep standard names as-is:**

    - `Opportunity` stays `Opportunity`
    - `StageName` stays `StageName`

4. **Combine with single underscore:**
    - Format: `<CleanObjectName>_<CleanFieldName>.pathAssistant-meta.xml`

**Examples:**

- Object: `Nineteen__c`, Field: `Mic_Color__c` → File: `force-app/main/default/pathAssistants/Nineteen_Mic_Color.pathAssistant-meta.xml` ✅
- Object: `Opportunity`, Field: `StageName` → File: `force-app/main/default/pathAssistants/Opportunity_StageName.pathAssistant-meta.xml` ✅
- Object: `Account`, Field: `Rating` → File: `force-app/main/default/pathAssistants/Account_Rating.pathAssistant-meta.xml` ✅
- Object: `Custom_Object__c`, Field: `Stage__c` → File: `force-app/main/default/pathAssistants/Custom_Object_Stage.pathAssistant-meta.xml` ✅

## Naming Conventions

- **CRITICAL: Path file name format MUST use underscores:** `<ObjectName>_<FieldAPIName>.pathAssistant-meta.xml`
- **NEVER use dots (.) in the file name - this will cause deployment errors!**
- Master label format: `<Object Label> <Field Label> Path` (e.g., "Opportunity Stage Path")
- If record type specific, append record type: `<Object Label> <Field Label> Path - <RecordType>` (e.g., "Opportunity Stage Path - Enterprise")
- Replace spaces with underscores in developer names.

**CRITICAL API NAME RULES - AVOIDING DOUBLE UNDERSCORES:**

**The Problem:**

- Custom objects end with `__c` (e.g., `Custom_Object__c`)
- Custom fields end with `__c` (e.g., `Field_Name__c`)
- When combining them with underscore separator: `Custom_Object__c_Field_Name__c`
- This creates **consecutive double underscores** (`__c_`) which violates Salesforce API naming rules
- **ERROR: "Api Name: The Path Assistant API Name can only contain underscores and alphanumeric characters. It must not contain two consecutive underscores."**

**The Solution - Remove Trailing Underscores Before Combining:**

1. **For Custom Objects (ending with `__c`):**

    - Remove the `__c` suffix before adding separator
    - Example: `Nineteen__c` → `Nineteen`

2. **For Custom Fields (ending with `__c`):**

    - Remove the `__c` suffix before adding separator
    - Example: `Mic_Color__c` → `Mic_Color`

3. **Combine with single underscore:**

    - Pattern: `<ObjectWithout__c>_<FieldWithout__c>`
    - Example: `Nineteen_Mic_Color`

4. **Add `.pathAssistant-meta.xml` extension:**
    - Final: `Nineteen_Mic_Color.pathAssistant-meta.xml`

**FILE NAMING ALGORITHM:**

```
IF ObjectName ends with "__c" THEN
    CleanObjectName = ObjectName without "__c"
ELSE
    CleanObjectName = ObjectName

IF FieldName ends with "__c" THEN
    CleanFieldName = FieldName without "__c"
ELSE
    CleanFieldName = FieldName

FileName = CleanObjectName + "_" + CleanFieldName + ".pathAssistant-meta.xml"
```

**Examples of CORRECT file names:**

**Standard Objects + Standard Fields:**

- `Opportunity_StageName.pathAssistant-meta.xml` ✅
- `Account_Rating.pathAssistant-meta.xml` ✅
- `Lead_Status.pathAssistant-meta.xml` ✅

**Custom Objects + Custom Fields (Double underscores removed):**

- `Nineteen__c` + `Mic_Color__c` → `Nineteen_Mic_Color.pathAssistant-meta.xml` ✅
- `Custom_Object__c` + `Stage__c` → `Custom_Object_Stage.pathAssistant-meta.xml` ✅
- `Project__c` + `Status__c` → `Project_Status.pathAssistant-meta.xml` ✅

**Standard Object + Custom Field:**

- `Account` + `Custom_Status__c` → `Account_Custom_Status.pathAssistant-meta.xml` ✅

**Custom Object + Standard Field:**

- `Project__c` + `Status` → `Project_Status.pathAssistant-meta.xml` ✅

**Examples of INCORRECT file names:**

- `Opportunity.StageName.pathAssistant-meta.xml` ❌ (Using dots)
- `Account.Rating.pathAssistant-meta.xml` ❌ (Using dots)
- `Nineteen__c_Mic_Color__c.pathAssistant-meta.xml` ❌ (Consecutive underscores: `__c_`)
- `Custom_Object__c_Stage__c.pathAssistant-meta.xml` ❌ (Consecutive underscores: `__c_`)
- `Project__c_Custom_Field__c.pathAssistant-meta.xml` ❌ (Consecutive underscores: `__c_`)

## Path XML Structure (MANDATORY)

- **Every path XML file must follow this exact structure:**

**MINIMAL PATH XML (No Key Fields Specified):**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<PathAssistant xmlns="http://soap.sforce.com/2006/04/metadata">
    <active>true</active>
    <entityName>ObjectName</entityName>
    <fieldName>FieldAPIName</fieldName>
    <masterLabel>Object Field Path</masterLabel>
    <recordTypeName>__MASTER__</recordTypeName>
</PathAssistant>
```

**PATH XML WITH KEY FIELDS (When User Specifies Fields):**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<PathAssistant xmlns="http://soap.sforce.com/2006/04/metadata">
    <active>true</active>
    <entityName>ObjectName</entityName>
    <fieldName>FieldAPIName</fieldName>
    <masterLabel>Object Field Path</masterLabel>
    <pathAssistantSteps>
        <fieldNames>Field1__c</fieldNames>
        <fieldNames>Field2__c</fieldNames>
        <picklistValueName>PicklistValue1</picklistValueName>
    </pathAssistantSteps>
    <pathAssistantSteps>
        <fieldNames>Field3__c</fieldNames>
        <picklistValueName>PicklistValue2</picklistValueName>
    </pathAssistantSteps>
    <recordTypeName>__MASTER__</recordTypeName>
</PathAssistant>
```

**CRITICAL XML RULES:**

- ✅ `<active>` should be set to `true` to activate the path immediately.
- ✅ `<entityName>` is the API name of the object (e.g., Opportunity, Lead, Custom_Object\_\_c).
- ✅ `<fieldName>` is the API name of the picklist field (e.g., StageName, Status, Stage\_\_c).
- ✅ `<masterLabel>` is the user-facing name of the path.
- ✅ `<recordTypeName>` is ALWAYS REQUIRED - use **MASTER** (with double underscores) or specific record type API name.
- ✅ `<pathAssistantSteps>` - Create ONLY when user specifies key fields for a picklist value.
- ✅ `<fieldNames>` - Key fields to display for this stage (up to 5 fields).
- ✅ `<picklistValueName>` - The exact picklist value from the field.
- ❌ **NEVER include `<info>` tags in the XML structure**
- ❌ **DO NOT add guidance text to the XML**
- ❌ **DO NOT include `<p>` tags or any HTML tags**
- ❌ **NEVER use `<recordTypeName>Master</recordTypeName>` - always use `<recordTypeName>__MASTER__</recordTypeName>`**

## XML Validation Rules - ERROR PREVENTION

**Before creating ANY path XML, verify these rules:**

**RULE 1 - Record Type Tag (MANDATORY):**

- ✅ XML MUST include `<recordTypeName>` tag
- ✅ If no record types on object → Use **MASTER**
- ✅ If specific record type selected → Use that record type API name
- ❌ NEVER omit this tag
- ❌ NEVER use "Master" (without underscores) - it will cause errors
- ❌ **ERROR if missing: "Required field is missing: recordTypeName"**

**RULE 2 - PathAssistantSteps (CONDITIONAL):**

- ✅ Include `<pathAssistantSteps>` ONLY if user specified key fields
- ✅ One block per picklist value that has fields
- ✅ If NO fields specified → Create minimal XML with NO `<pathAssistantSteps>` blocks
- ❌ DO NOT create empty `<pathAssistantSteps>` blocks
- ❌ DO NOT include steps for all picklist values by default

**RULE 3 - Info Tags (FORBIDDEN):**

- ❌ NEVER include `<info>` tags
- ❌ NO guidance text in XML
- ❌ NO HTML tags like `<p>`, `<br>`, etc.
- ❌ **ERROR if included: "Unexpected element {http://soap.sforce.com/2006/04/metadata}p during simple type deserialization"**

**RULE 4 - Existing Path Check (BLOCKING):**

- ❌ NEVER create path if one exists for object/field/recordType
- 🛑 STOP if existing path found
- ✅ MUST ask: UPDATE or DELETE existing path first
- ❌ **ERROR if violated: "Cannot create more than 1 Path per sobjectType and recordType"**

**RULE 5 - API Name Double Underscore Prevention (CRITICAL):**

- ❌ NEVER create file names with consecutive double underscores (`__c_`)
- ✅ ALWAYS remove `__c` suffix from custom objects before combining
- ✅ ALWAYS remove `__c` suffix from custom fields before combining
- ✅ Combine cleaned names with single underscore
- ❌ **ERROR if violated: "Api Name: The Path Assistant API Name can only contain underscores and alphanumeric characters. It must not contain two consecutive underscores."**
- **Example:** `Nineteen__c` + `Mic_Color__c` → Clean to `Nineteen` + `Mic_Color` → File: `Nineteen_Mic_Color.pathAssistant-meta.xml` ✅

## Path Steps Configuration

**CRITICAL: PathAssistantSteps are OPTIONAL and CONDITIONAL**

- `<pathAssistantSteps>` blocks are created ONLY when user specifies key fields
- If user does NOT specify fields for a picklist value → NO `<pathAssistantSteps>` for that value
- If user does NOT specify fields for ANY picklist value → XML has NO `<pathAssistantSteps>` blocks at all

**Key Fields Process:**

1. Ask: "Would you like to add key fields to display for any stages? (Up to 5 fields per stage)"
2. **If user says NO or doesn't specify fields:**
    - Create path XML with NO `<pathAssistantSteps>` blocks
    - Path will still work - it just won't show key fields
    - Use minimal XML structure
3. **If user says YES:**
    - Ask: "Which stage/picklist value would you like to add fields to?"
    - Ask: "Which fields should be displayed? (Up to 5 fields)"
    - **Use the <retrieve_sf_metadata> tool with metadata_type "CustomObject" to retrieve all objects (if not already retrieved)**
    - Verify each field exists on the object
    - Create `<pathAssistantSteps>` ONLY for picklist values with specified fields
    - Repeat for each picklist value the user wants to customize

**XML Structure Rules:**

- Each `<pathAssistantSteps>` block MUST have:
    - At least one `<fieldNames>` tag (1-5 fields)
    - Exactly one `<picklistValueName>` tag
- NO `<info>` tags allowed
- NO HTML tags allowed

## Default Path Configuration

**If user does NOT specify key fields:**

- Create a MINIMAL path XML with:
    - `<active>true</active>`
    - `<entityName>`, `<fieldName>`, `<masterLabel>`
    - `<recordTypeName>` (Master or selected record type)
    - NO `<pathAssistantSteps>` blocks at all

**Example Minimal Path XML:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<PathAssistant xmlns="http://soap.sforce.com/2006/04/metadata">
    <active>true</active>
    <entityName>Opportunity</entityName>
    <fieldName>StageName</fieldName>
    <masterLabel>Opportunity Stage Path</masterLabel>
    <recordTypeName>__MASTER__</recordTypeName>
</PathAssistant>
```

**This creates a working path that displays all picklist values without key fields.**

## CLI Command Execution Rules

**CRITICAL: Run commands ONE AT A TIME**

**Execution Sequence:**

1. Run retrieve metadata command
2. **WAIT for command completion**
3. Analyze results
4. Run next command (if needed)
5. **WAIT for command completion**
6. NEVER combine or batch commands

**Example Correct Sequence:**

```
Step 1: Use <retrieve_sf_metadata> tool with metadata_type "CustomObject" to retrieve all objects
[WAIT for completion]
Step 2: [Analyze metadata]
Step 3: Use <retrieve_sf_metadata> tool with metadata_type "PathAssistant"
[WAIT for completion]
Step 4: [Check for existing paths]
Step 5: [Create XML file]
Step 6: sf project deploy start --source-dir force-app/main/default/pathAssistants/Account_Rating.pathAssistant-meta.xml
[WAIT for completion]
```

**NEVER do this:**

```
❌ Running multiple retrieve operations simultaneously
❌ Batching retrieval commands together
```

**ONE OPERATION AT A TIME - ALWAYS**

## Automatic Deployment (CRITICAL - MUST FOLLOW)

- **After creating the complete path XML file (with all fields and customizations), you MUST immediately execute the deployment command.**
- **This is not optional. Deployment must happen automatically after path creation.**
- **Never skip the deployment step. Always run the sf deploy command after file creation.**
- **EXECUTE THE DEPLOYMENT COMMAND EVERY SINGLE TIME WITHOUT EXCEPTION.**
- **Deploy only ONCE - after the complete path XML with all fields is created.**

## Deployment Command

- **After creating the complete path XML file with all customizations, deploy it immediately:**
    ```bash
    sf project deploy start --source-dir force-app/main/default/pathAssistants/<CleanObjectName>_<CleanFieldName>.pathAssistant-meta.xml --json
    ```
- **CRITICAL: Use underscores (\_) in the file name, NOT dots (.)**
- **CRITICAL: Remove `__c` from custom object and field names to avoid consecutive underscores**
- **Examples:**
    ```bash
    sf project deploy start --source-dir force-app/main/default/pathAssistants/Opportunity_StageName.pathAssistant-meta.xml --json
    ```
    ```bash
    sf project deploy start --source-dir force-app/main/default/pathAssistants/Account_Rating.pathAssistant-meta.xml --json
    ```
    ```bash
    sf project deploy start --source-dir force-app/main/default/pathAssistants/Nineteen_Mic_Color.pathAssistant-meta.xml --json
    ```
    ```bash
    sf project deploy start --source-dir force-app/main/default/pathAssistants/Custom_Object_Stage.pathAssistant-meta.xml --json
    ```
- **MANDATORY: Execute this command immediately after file creation. Do not skip this step.**
- **Deploy ONLY ONCE with the complete, finalized path XML.**
- **WAIT for deployment completion before confirming success.**

### Dry Run Before Deployment (Pre-check)

- Before executing the deployment, perform a dry run using the same deployment command with the `--dry-run` flag.
- If you have multiple path files to deploy, perform a single consolidated dry run for all of them at once by including all intended targets in one command along with `--dry-run`.

## Path Activation

- Paths are automatically activated when `<active>true</active>` is set in the XML.
- After deployment, inform the user:
    - "Path deployed successfully! Users will see the path on [Object] record pages."
    - If record type specific: "This path will appear on [Object] records using the [RecordType] record type."
    - "To customize the path layout, go to Setup > Path Settings."
- **Remember: Only ONE path can be active per object per record type.**

## Path Deactivation and Deletion

- **To delete a path:**
    - Execute the delete command:
        ```bash
        sf project delete source --metadata PathAssistant:<CleanObjectName>_<CleanFieldName> --json
        ```
    - **WAIT for command completion**
    - Or use destructive changes:
        ```bash
        sf project deploy start --metadata-dir force-app/main/default/pathAssistants/<CleanObjectName>_<CleanFieldName>.pathAssistant-meta.xml --pre-destructive-changes destructiveChanges.xml --json
        ```
    - **IMPORTANT: Use underscores (\_) in the metadata name, NOT dots (.)**
    - **IMPORTANT: Remove `__c` from custom object and field names**
    - **Examples:**
        ```bash
        sf project delete source --metadata PathAssistant:Nineteen_Mic_Color --json
        ```
        ```bash
        sf project delete source --metadata PathAssistant:Custom_Object_Stage --json
        ```
    - Confirm: "Path has been deleted successfully."
- **Note:** Deactivating a path (setting `<active>false</active>`) does not allow creation of a new path. You must either delete the existing path or update it.

## Compliance

- The XML must follow Salesforce Metadata API standards.
- The XML must be deployable via:
    - Salesforce Change Sets
    - VS Code Salesforce Extensions
    - Salesforce CLI (sf/sfdx)

## Session Behavior - Complete Workflow

- When the user requests path creation, follow these steps IN ORDER:
  **Step 1: Gather Information**
    - Check if both object and field are provided. If not, ask for missing information.
      **Step 2: Retrieve Object Metadata (MANDATORY)**
    - Use <retrieve_sf_metadata> tool with metadata_type "CustomObject" to retrieve all objects
    - Read the retrieved metadata XML file from: `force-app/main/default/objects/<ObjectName>/<ObjectName>.object-meta.xml`
      **Step 3: Parse and Extract Record Types (MANDATORY)**
    - Parse the object metadata XML file
    - Look for `<recordTypes>` sections
    - Extract all `<fullName>` values from each `<recordTypes>` block
    - Store the record type API names in a list
      **Step 4: Record Type Selection (MANDATORY)**
    - **If record types exist:**
        - Present all record types to the user
        - Ask: "Which record type should this path be created for?"
        - **WAIT for user selection**
        - Store the selected record type
    - **If no record types exist:**
        - Automatically select **MASTER** record type
        - Inform user: "This object uses the Master record type."
    - **CRITICAL: Selected record type (**MASTER** or specific) MUST be included in XML as `<recordTypeName>` tag**
      **Step 5: Verify Picklist Field (MANDATORY)**
    - Verify the picklist field exists in the metadata
    - Check field type is Picklist
    - If field doesn't exist or is not a picklist, inform the user and STOP
      **Step 6: Check for Existing Paths (MANDATORY)**
    - Use <retrieve_sf_metadata> tool with metadata_type "PathAssistant" to retrieve all existing paths
    - Check if a path exists for the object/field/record type combination
    - **If path exists: STOP IMMEDIATELY**
        - Inform user about existing path
        - Ask user to UPDATE or DELETE+CREATE NEW
        - Do NOT proceed with creation until user responds
    - If no path exists: Proceed with creation
      **Step 7: Extract Picklist Values (MANDATORY)**
    - Extract picklist values from the field metadata
    - Look in `<valueSet>` → `<valueSetDefinition>` → `<value>` → `<fullName>` tags
    - Filter by record type if the field has record-type-specific values
    - Store these values for reference (path will work for all values even without steps)
      **Step 8: Gather Field Customizations (BEFORE Creating XML)**
    - Ask: "Would you like to add key fields to display for any stages? (Up to 5 fields per stage)"
    - **If NO or user doesn't specify fields:**
        - Proceed to create minimal path XML with NO `<pathAssistantSteps>` blocks
        - Skip to Step 9
    - **If YES:** - For each picklist value the user wants to customize: - Ask which picklist value to customize - Ask which fields to add (up to 5) - Verify each field exists in the already retrieved object metadata - Note all fields to be included in the XML - **Collect ALL customizations BEFORE creating the XML file**
      **Step 9: Create Complete Path XML**
    - **CRITICAL: Calculate clean file name by removing `__c` suffixes:**
        - If ObjectName ends with `__c` → Remove it (e.g., `Nineteen__c` → `Nineteen`)
        - If FieldName ends with `__c` → Remove it (e.g., `Mic_Color__c` → `Mic_Color`)
        - Combine with single underscore: `CleanObjectName_CleanFieldName`
    - Create the path XML file with proper structure at: `force-app/main/default/pathAssistants/<CleanObjectName>_<CleanFieldName>.pathAssistant-meta.xml`
    - Include `<recordTypeName>` tag (MANDATORY - Master or specific record type)
    - **If fields were specified in Step 8:**
        - Include `<pathAssistantSteps>` for ONLY those picklist values with fields
        - Each step must have `<fieldNames>` and `<picklistValueName>`
    - **If NO fields specified:**
        - Create minimal XML with NO `<pathAssistantSteps>` blocks
    - NEVER include `<info>` tags
    - NEVER include HTML tags
    - **The XML file must be complete and finalized with all customizations included**
      **Step 10: Deploy Automatically (MANDATORY - CANNOT BE SKIPPED)**
    - Execute deployment command immediately using the cleaned file name:
        ```bash
        sf project deploy start --source-dir force-app/main/default/pathAssistants/<CleanObjectName>_<CleanFieldName>.pathAssistant-meta.xml --json
        ```
    - **WAIT for deployment completion**
    - **Deploy ONLY ONCE with the complete path**
    - Verify deployment success
      **Step 11: Final Confirmation**
    - Confirm successful deployment and activation
    - Inform user: "Path deployed successfully! Users will see the path on [Object] record pages."
    - If record type specific, mention which record type
    - Provide next steps: "To customize the path layout further, go to Setup > Path Settings."

## Critical Reminders

- **ALWAYS retrieve metadata BEFORE creating paths.**
- **ALWAYS check for existing paths BEFORE creating new ones - STOP if found.**
- **ALWAYS include `<recordTypeName>` tag - use **MASTER** if no record types exist.**
- **ALWAYS remove `__c` suffix from custom objects and fields when creating file names.**
- **NEVER create file names with consecutive double underscores (e.g., `__c_`).**
- **GATHER ALL CUSTOMIZATIONS (fields only) BEFORE creating the XML.**
- **CREATE `<pathAssistantSteps>` ONLY when user specifies key fields.**
- **CREATE minimal XML with NO steps if user doesn't specify fields.**
- **NEVER include `<info>` tags or HTML tags in XML.**
- **DEPLOY ONLY ONCE after the complete XML is created.**
- **RUN CLI COMMANDS ONE AT A TIME - NEVER batch or combine.**
- **WAIT for each command to complete before proceeding.**
- **ONLY ONE active path per object per record type.**
- **Key fields must be verified to exist BEFORE adding to XML.**
- **Up to 5 key fields can be added per picklist value.**
- **Deployment is NOT optional - it MUST happen automatically after the complete XML is created.**
- **No re-deployment - everything is done in a single deployment.**
- **Deactivating a path does NOT allow creating a new one - you must DELETE or UPDATE existing paths.**

## Error Prevention Summary

**To prevent "Unexpected element" error:**

- ❌ NEVER include `<info>` tags
- ❌ NEVER include `<p>` or any HTML tags
- ✅ Only include: `<active>`, `<entityName>`, `<fieldName>`, `<masterLabel>`, `<pathAssistantSteps>` (conditional), `<recordTypeName>`

**To prevent "Cannot create more than 1 Path" error:**

- 🛑 ALWAYS check for existing paths FIRST
- 🛑 STOP if existing path found
- ✅ Ask user to UPDATE or DELETE before proceeding

**To prevent "Required field is missing: recordTypeName" error:**

- ✅ ALWAYS include `<recordTypeName>` tag
- ✅ Use **MASTER** (with double underscores) if no record types exist
- ✅ Use specific record type API name if selected
- ❌ NEVER omit this tag
- ❌ NEVER use "Master" without underscores

**To prevent "Api Name can only contain underscores and alphanumeric characters" error:**

- ❌ NEVER create file names with consecutive double underscores (`__c_`)
- ✅ ALWAYS remove `__c` suffix from custom objects (e.g., `Nineteen__c` → `Nineteen`)
- ✅ ALWAYS remove `__c` suffix from custom fields (e.g., `Mic_Color__c` → `Mic_Color`)
- ✅ Combine cleaned names with single underscore
- ✅ Example: `Nineteen__c` + `Mic_Color__c` → File: `Nineteen_Mic_Color.pathAssistant-meta.xml`

**Command Execution:**

- ✅ Run ONE command at a time
- ✅ WAIT for completion
- ✅ Analyze results
- ✅ Then proceed to next command
- ❌ NEVER batch or combine commands

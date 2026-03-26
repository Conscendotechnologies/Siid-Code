**Salesforce Object Creation**

# Mode Overview

This mode assists the AI model in creating Salesforce objects by generating the necessary XML files in the objects directory. It ensures that object names follow Salesforce conventions. The generated XML is compliant with Salesforce Metadata API standards and ready for deployment.

**IMPORTANT: This workflow supports MULTIPLE OBJECTS AND FIELDS**

- If user requests creation of 3 objects with 3 fields each, this workflow handles all 9 field creations
- ALL steps (creation, dry run, deployment, tabs, permissions, page layout) are executed for EACH object and EACH field
- This is a COMPLETE end-to-end workflow that ensures all objects and fields are fully configured

**Instructions(IMPORTANT!!)**

# Strict Rules for Salesforce Object Creation

## Check Existing Object

- Before creating a new object, check if the object already exists:
    - First, check locally in the objects directory (force-app/main/default/objects/)
    - Also use the <retrieve_sf_metadata> tool with metadata_type "CustomObject" and metadata_name "<ObjectApiName>" to check if the object exists in the Salesforce org
- If the object already exists (either locally or in the org):
    - Inform the user that the object is already present.
    - Ask: "Do you want to create new fields for this object or create a completely new object?"
- If the object does not exist in both locations, continue with the rules below.

## Folder Creation

Always create a folder in the objects directory with the same name as the object.
Example: For object Invoice_Item__c, create folder objects/Invoice_Item__c.

## File Creation

Inside the folder, create the object XML file with this format:
<ObjectApiName>.object-meta.xml
Example: Invoice_Item__c/Invoice_Item__c.object-meta.xml.

## Naming Conventions

- Replace spaces with underscores in object and file names.
    ### objectApiName rules:
    - Only letters, numbers, and underscores allowed.
    - Must start with a letter.
    - Must be unique.
    - Cannot end with an underscore.
    - Cannot contain consecutive underscores.

## Labels and Pluralization

- The label must always be the singular form of the object name.
- The pluralLabel must always be the plural form, unless the word should never be pluralized (e.g., Country, City, Person, Name, Data).
- Examples:
    - Flower -> Label: Flower | PluralLabel: Flowers
    - Invoice -> Label: Invoice | PluralLabel: Invoices
    - Country -> Label: Country | PluralLabel: Country (no pluralization applied)

## Enable Features

- Always set the following to true in the XML definition:
    - enableReports
    - enableActivities
    - enableFeeds
    - enableHistory

## Tab Creation (MANDATORY)

- When creating a custom object you MUST also create a corresponding custom tab. Tab creation is required and cannot be skipped.
- Create the tab file at:

```text
force-app/main/default/tabs/<ObjectApiName>.tab-meta.xml
```

- Example minimal Tab XML (replace placeholders):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomTab xmlns="http://soap.sforce.com/2006/04/metadata">
    <customObject>true</customObject>
    <motif>Custom53: Bell</motif>
</CustomTab>
```

- Ensure the tab file name and the object API name match the custom object. The tab file must be staged and deployed together with the object and any related metadata.

## Admin Profile Tab Permission Assignment (!!IMPORTANT - MANDATORY)

- **After creating the tab, MUST assign permission to Admin profile with default settings**
- Retrieve the Admin profile using `<retrieve_sf_metadata>` tool with:
    - metadata_type: "Profile"
    - metadata_name: "Admin"
- File location: `force-app/main/default/profiles/Admin.profile-meta.xml`
- Add tab visibility permission with **default settings** (MANDATORY):

```xml
<tabVisibilities>
  <tab>{ObjectApiName}</tab>
  <visibility>DefaultOn</visibility>
</tabVisibilities>
```

**Important:**

- **visibility MUST be set to `DefaultOn`** (mandatory default setting)
- This makes the tab visible by default for Admin users
- Tab API name must match the tab's fullName (e.g., Invoice__c)
- Profile must be deployed together with the tab for complete setup
- Profile metadata name is exactly: "Admin"

## MANDATORY DEPLOYMENT FOR OBJECTS (!!CRITICAL - MUST FOLLOW EVERY TIME)

**AFTER EVERY CUSTOM OBJECT CREATION, YOU MUST IMMEDIATELY DEPLOY USING `<sf_deploy_metadata>` TOOL**

**THIS IS NOT OPTIONAL. THIS STEP MUST NOT BE SKIPPED UNDER ANY CIRCUMSTANCES.**

- (**!CRITICAL**) **You MUST use the `<sf_deploy_metadata>` tool for ALL custom object deployments**
- (**!CRITICAL**) **Do NOT attempt to use CLI commands like `sf project deploy start`**
- (**!CRITICAL**) **Provide all object metadata files to the tool at once for batch deployment**
- The tool will automatically handle both dry-run validation and actual deployment
- If there are any errors, the tool will report them - fix and retry the deployment
- After successful deployment, all objects will be available in the Salesforce org

**MUST DO THIS AFTER EVERY SINGLE CUSTOM OBJECT - NO EXCEPTIONS**

## MANDATORY DEPLOYMENT FOR TABS (!!CRITICAL - MUST FOLLOW EVERY TIME)

**AFTER EVERY CUSTOM TAB CREATION, YOU MUST IMMEDIATELY DEPLOY USING `<sf_deploy_metadata>` TOOL**

**THIS IS NOT OPTIONAL. THIS STEP MUST NOT BE SKIPPED UNDER ANY CIRCUMSTANCES.**

- (**!CRITICAL**) **You MUST use the `<sf_deploy_metadata>` tool for ALL custom tab deployments**
- (**!CRITICAL**) **Provide all tab metadata files to the tool at once for batch deployment**
- The tool will automatically handle both dry-run validation and actual deployment
- If there are any errors during validation, the tool will report them - fix and retry the deployment
- After successful deployment, all tabs will be visible to Admin users

**MUST DO THIS AFTER EVERY SINGLE CUSTOM TAB - NO EXCEPTIONS**

- Replace `<ObjectApiNames>` with all the objects that are created

## Compliance

- The XML must follow Salesforce Metadata API standards.
- The XML must be deployable via the `<sf_deploy_metadata>` tool.

## Session Behavior

- When the session starts:
  -Immediately initialize the workflow.
  -Begin the object creation process without asking what the user wants.

## Complete Example

Scenario: Creating a "Test" Custom Object
When creating a custom object named "Test", follow these steps:

- Step 1: Folder Structure
  Create the following directory structure:
  force-app/main/default/
  |-- objects/
  |   |-- Test__c/
  |   |   `-- Test__c.object-meta.xml
  `-- tabs/
      `-- Test__c.tab-meta.xml

- Step 2: Object XML File
  File: objects/Test__c/Test__c.object-meta.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
  <deploymentStatus>Deployed</deploymentStatus>
  <enableActivities>true</enableActivities>
  <enableFeeds>true</enableFeeds>
  <enableHistory>true</enableHistory>
  <enableReports>true</enableReports>
  <label>Test</label>
  <pluralLabel>Tests</pluralLabel>
  <nameField>
    <label>Test Name</label>
    <type>Text</type>
  </nameField>
  <sharingModel>ReadWrite</sharingModel>
</CustomObject>
```

- Step 3: Tab XML File
  File: tabs/Test__c.tab-meta.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomTab xmlns="http://soap.sforce.com/2006/04/metadata">
  <customObject>true</customObject>
  <motif>Custom53: Bell</motif>
</CustomTab>
```

- Step 4: Dry Run and Deployment

Use the `<sf_deploy_metadata>` tool for both objects and tabs:

**For Objects:**

- Provide the object metadata file to the `<sf_deploy_metadata>` tool
- Example: `force-app/main/default/objects/Test__c`
- The tool will automatically validate (dry-run) and deploy the object

**For Tabs:**

- Provide the tab metadata file to the `<sf_deploy_metadata>` tool
- Example: `force-app/main/default/tabs/Test__c.tab-meta.xml`
- The tool will automatically validate (dry-run) and deploy the tab

---

# Additional Instructions for Custom Metadata Types, Custom Settings, Custom Metadata Records, and Custom Setting Records

These are additive instructions. Keep all of the custom object rules above exactly as-is.

## Core Rules for Additional Metadata

- Always check whether the target already exists locally and in the org before creating it.
- Use `<retrieve_sf_metadata>` for org checks.
- Use `<sf_deploy_metadata>` for deployable metadata.
- Use `<sf_execute_anonymous>` for runtime data setup that is not deployable metadata, especially custom setting records.
- Do not use raw `sf project deploy start` or raw `sf apex run` commands directly when these dedicated tools exist.
- Execute deployment and anonymous Apex automatically through the tools.
- Do not tell the user to run Salesforce deployment or Apex commands manually when the tools can perform the action directly.

## 1. Custom Metadata Type

- A custom metadata type is a `CustomObject` whose API name ends with `__mdt`.
- Check local path: `force-app/main/default/objects/<TypeApiName>/`
- Check org with:
  - `metadata_type`: `CustomObject`
  - `metadata_name`: `<TypeApiName>`
- Create:
  - `force-app/main/default/objects/<TypeApiName>/<TypeApiName>.object-meta.xml`
- The XML must define custom metadata behavior.
- `deploymentStatus` must not be included for custom metadata types.
- If a custom metadata type field uses `Checkbox`, the field XML must include `<defaultValue>true</defaultValue>` or `<defaultValue>false</defaultValue>`.
- Custom metadata types must be deployed without test coverage checks.
- Do not request `RunLocalTests`, `RunAllTestsInOrg`, or `RunSpecifiedTests` for custom metadata types.
- Use `<sf_deploy_metadata>` with the default `NoTestRun` behavior.
- Do not create a tab unless the user explicitly asks for one.
- Deploy with `<sf_deploy_metadata>` using:
  - `metadata_type`: `CustomObject`
  - `metadata_name`: `<TypeApiName>`

## 2. Custom Setting

- A custom setting is also stored as `CustomObject` metadata.
- Check local path: `force-app/main/default/objects/<SettingApiName>/`
- Check org with:
  - `metadata_type`: `CustomObject`
  - `metadata_name`: `<SettingApiName>`
- Create:
  - `force-app/main/default/objects/<SettingApiName>/<SettingApiName>.object-meta.xml`
- The XML must include `customSettingsType` with the correct value such as `Hierarchy` or `List`.
- For custom settings, use a minimal XML shape.
- Only include these fields for custom setting XML in this workflow:
  - `fullName`
  - `label`
  - `description`
  - `customSettingsType`
  - `visibility`
- Do not add normal custom-object feature flags such as:
  - `enableHistory`
  - `enableFeeds`
  - `enableActivities`
  - `enableSharing`
  - `enableSearch`
  - `enableBulkApi`
  - `enableStreamingApi`
  - `enableEnhancedLookup`
  - `enableLicensing`
- `deploymentStatus` must not be included for custom settings in this workflow.
- `sharingModel` must not be included for custom settings in this workflow.
- `pluralLabel` must not be included for custom settings in this workflow.
- Custom settings must be deployed without test coverage checks.
- Do not request `RunLocalTests`, `RunAllTestsInOrg`, or `RunSpecifiedTests` for custom settings.
- Use `<sf_deploy_metadata>` with the default `NoTestRun` behavior.
- Preferred custom setting XML pattern:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>{SettingApiName}</fullName>
    <label>{Label}</label>
    <description>{Description}</description>
    <customSettingsType>{HierarchyOrList}</customSettingsType>
    <visibility>Public</visibility>
</CustomObject>
```

- Example for a List custom setting:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Global_Config__c</fullName>
    <label>Global Config</label>
    <description>Global configuration settings for the system</description>
    <customSettingsType>List</customSettingsType>
    <visibility>Public</visibility>
</CustomObject>
```

- Do not create a tab unless the user explicitly asks for one.
- Deploy with `<sf_deploy_metadata>` using:
  - `metadata_type`: `CustomObject`
  - `metadata_name`: `<SettingApiName>`

## 3. Custom Metadata Record

- A custom metadata record is deployable metadata.
- Check local path:
  - `force-app/main/default/customMetadata/<TypeApiName>.<RecordApiName>.md-meta.xml`
- Check org with:
  - `metadata_type`: `CustomMetadata`
  - `metadata_name`: `<TypeApiName>.<RecordApiName>`
- Create:
  - `force-app/main/default/customMetadata/<TypeApiName>.<RecordApiName>.md-meta.xml`
- The file must use Salesforce Metadata API XML for `CustomMetadata`.
- Custom metadata record XML must include:
  - `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`
  - `xmlns:xsd="http://www.w3.org/2001/XMLSchema"`
- Field values in custom metadata record XML must use `xsi:type` with the appropriate `xsd` type.
- Example custom metadata record XML pattern:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <label>{RecordLabel}</label>
    <protected>false</protected>
    <values>
        <field>{FieldApiName}</field>
        <value xsi:type="xsd:string">{FieldValue}</value>
    </values>
</CustomMetadata>
```
- Custom metadata records must be deployed without test coverage checks.
- Do not request `RunLocalTests`, `RunAllTestsInOrg`, or `RunSpecifiedTests` for custom metadata records.
- Use `<sf_deploy_metadata>` with the default `NoTestRun` behavior.
- Deploy with `<sf_deploy_metadata>` using:
  - `metadata_type`: `CustomMetadata`
  - `metadata_name`: `<TypeApiName>.<RecordApiName>`

## 4. Custom Setting Record

- Custom setting records are org data, not deployable metadata.
- Do not create a metadata file for the record.
- Use `<sf_execute_anonymous>` with idempotent Apex when possible.
- For hierarchy settings, prefer `getOrgDefaults()`, `getInstance(UserInfo.getUserId())`, or equivalent based on scope.
- For list settings, query by `Name` first and then `insert`, `update`, or `upsert`.
- Anonymous Apex must set all requested fields explicitly.

Example:

```xml
<sf_execute_anonymous>
<content>
My_Setting__c setting = My_Setting__c.getOrgDefaults();
if (setting == null) {
    setting = new My_Setting__c();
}
setting.SetupOwnerId = UserInfo.getOrganizationId();
setting.Name = 'Org Default';
setting.Feature_Enabled__c = true;
upsert setting;
</content>
</sf_execute_anonymous>
```

- Example for a hierarchy custom setting record:

```xml
<sf_execute_anonymous>
<content>
Application_Config__c setting = Application_Config__c.getOrgDefaults();
if (setting == null) {
    setting = new Application_Config__c();
}
setting.SetupOwnerId = UserInfo.getOrganizationId();
setting.Name = 'Org Default';
setting.Feature_Enabled__c = true;
upsert setting;
</content>
</sf_execute_anonymous>
```

- Example for a list custom setting record:

```xml
<sf_execute_anonymous>
<content>
List<Application_Config__c> existingSettings = [
    SELECT Id, Name, Feature_Enabled__c
    FROM Application_Config__c
    WHERE Name = 'Default_Config'
    LIMIT 1
];

Application_Config__c setting;
if (existingSettings.isEmpty()) {
    setting = new Application_Config__c();
    setting.Name = 'Default_Config';
} else {
    setting = existingSettings[0];
}

setting.Feature_Enabled__c = true;
upsert setting;
</content>
</sf_execute_anonymous>
```

## Deployment Rules for Additional Metadata

- Deployment is mandatory immediately after creating deployable metadata.
- Always use `<sf_deploy_metadata>`.
- Run the deployment directly through `<sf_deploy_metadata>` instead of asking the user to execute deployment commands.
- Fix validation failures and retry.
- Deploy dependencies in order:
  1. Type or object
  2. Fields if any
  3. Records
  4. Tab/profile updates when relevant

## Decision Rules for Additional Metadata

- If the user asks for a deployable definition, create files and deploy them.
- If the user asks for a custom metadata record, create the metadata file and deploy it.
- If the user asks for a custom setting record, use `<sf_execute_anonymous>`.
- If a target already exists, update it instead of blindly duplicating it.
- When deployment or anonymous Apex execution is required, perform it through the tool in the same workflow instead of deferring the execution to the user.

## Compliance for Additional Metadata

- All XML must follow Salesforce Metadata API format.
- All deployable work must be compatible with `<sf_deploy_metadata>`.
- All custom setting record creation must use `<sf_execute_anonymous>`, not metadata deployment.

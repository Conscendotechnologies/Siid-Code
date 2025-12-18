import { ToolArgs } from "./types"

export function getRetrieveSfMetadataDescription(args: ToolArgs): string {
	return `## retrieve_sf_metadata
Description: Dynamically retrieves metadata from a Salesforce org using Salesforce CLI commands. This tool intelligently analyzes the metadata type and name to determine which SF CLI command to execute. It can retrieve full metadata of a type or specific named metadata components.

Supported Metadata Types and Commands:
- ApexClass: Retrieves Apex class source code
- ApexTrigger: Retrieves Apex trigger source code
- CustomObject: Retrieves custom object definition
- CustomField: Retrieves custom field definition (use format: ObjectName.FieldName)
- LightningComponentBundle: Retrieves Lightning Web Component bundle
- AuraDefinitionBundle: Retrieves Aura component bundle
- FlexiPage: Retrieves Lightning page definition
- Flow: Retrieves Flow definition
- PermissionSet: Retrieves permission set definition
- Profile: Retrieves profile definition
- Layout: Retrieves page layout definition
- ApexPage: Retrieves Visualforce page
- ApexComponent: Retrieves Visualforce component
- StaticResource: Retrieves static resource
- CustomTab: Retrieves custom tab definition
- CustomApplication: Retrieves custom application definition
- StandardValueSet: Retrieves standard value set (picklist values)
- GlobalValueSet: Retrieves global value set
- RecordType: Retrieves record type definition (use format: ObjectName.RecordTypeName)
- ValidationRule: Retrieves validation rule (use format: ObjectName.ValidationRuleName)
- Role: Retrieves role hierarchy definition
- AssignmentRule: Retrieves assignment rule (use format: ObjectName.RuleName, e.g., Case.Standard_Case_Assignment or Lead.Lead_Assignment)
- AssignmentRules: Retrieves all assignment rules for an object (use format: ObjectName, e.g., Case or Lead)
- PathAssistant: Retrieves Sales Path / Path Assistant definition
- PathAssistantSettings: Retrieves Path Assistant settings

Parameters:
- metadata_type: (required) The type of Salesforce metadata to retrieve (e.g., ApexClass, CustomObject, LightningComponentBundle, StandardValueSet, Layout, etc.)
- metadata_name: (optional) The API name of the specific metadata component to retrieve. If not provided, retrieves a list of all metadata of that type.
  - For CustomField: Use format ObjectName.FieldName (e.g., Account.Industry, Invoice__c.Customer_Type__c)
  - For RecordType: Use format ObjectName.RecordTypeName (e.g., Account.Partner)
  - For ValidationRule: Use format ObjectName.ValidationRuleName (e.g., Account.Email_Required)
  - For Layout: Use format ObjectName-LayoutName (e.g., Account-Account Layout)
  - For AssignmentRule: Use format ObjectName.RuleName (e.g., Case.Standard_Case_Assignment)
  - For AssignmentRules: Use the object name (e.g., Case, Lead)
  - For PathAssistant: Use the path name (e.g., Opportunity_Path)

Usage:
<retrieve_sf_metadata>
<metadata_type>MetadataType</metadata_type>
<metadata_name>MetadataApiName</metadata_name>
</retrieve_sf_metadata>

Example: Retrieve a specific Apex class
<retrieve_sf_metadata>
<metadata_type>ApexClass</metadata_type>
<metadata_name>AccountHandler</metadata_name>
</retrieve_sf_metadata>

Example: List all Apex classes in the org
<retrieve_sf_metadata>
<metadata_type>ApexClass</metadata_type>
</retrieve_sf_metadata>

Example: Retrieve a specific custom object
<retrieve_sf_metadata>
<metadata_type>CustomObject</metadata_type>
<metadata_name>Invoice__c</metadata_name>
</retrieve_sf_metadata>

Example: Retrieve a custom field
<retrieve_sf_metadata>
<metadata_type>CustomField</metadata_type>
<metadata_name>Account.Industry</metadata_name>
</retrieve_sf_metadata>

Example: Retrieve a Lightning Web Component
<retrieve_sf_metadata>
<metadata_type>LightningComponentBundle</metadata_type>
<metadata_name>myComponent</metadata_name>
</retrieve_sf_metadata>

Example: Retrieve a Standard Value Set (picklist)
<retrieve_sf_metadata>
<metadata_type>StandardValueSet</metadata_type>
<metadata_name>Industry</metadata_name>
</retrieve_sf_metadata>

Example: Retrieve a page layout
<retrieve_sf_metadata>
<metadata_type>Layout</metadata_type>
<metadata_name>Account-Account Layout</metadata_name>
</retrieve_sf_metadata>

Example: Retrieve a specific role
<retrieve_sf_metadata>
<metadata_type>Role</metadata_type>
<metadata_name>CEO</metadata_name>
</retrieve_sf_metadata>

Example: List all roles in the org
<retrieve_sf_metadata>
<metadata_type>Role</metadata_type>
</retrieve_sf_metadata>

Example: Retrieve Case assignment rules
<retrieve_sf_metadata>
<metadata_type>AssignmentRules</metadata_type>
<metadata_name>Case</metadata_name>
</retrieve_sf_metadata>

Example: Retrieve a specific assignment rule
<retrieve_sf_metadata>
<metadata_type>AssignmentRule</metadata_type>
<metadata_name>Lead.Standard_Lead_Assignment</metadata_name>
</retrieve_sf_metadata>

Example: Retrieve a Sales Path
<retrieve_sf_metadata>
<metadata_type>PathAssistant</metadata_type>
<metadata_name>Opportunity_Path</metadata_name>
</retrieve_sf_metadata>

Example: List all Sales Paths
<retrieve_sf_metadata>
<metadata_type>PathAssistant</metadata_type>
</retrieve_sf_metadata>

Example: Retrieve all Visualforce pages (MANDATORY before creating new pages)
<retrieve_sf_metadata>
<metadata_type>ApexPage</metadata_type>
</retrieve_sf_metadata>

Example: Retrieve a specific Visualforce page
<retrieve_sf_metadata>
<metadata_type>ApexPage</metadata_type>
<metadata_name>ContactForm</metadata_name>
</retrieve_sf_metadata>

Example: Retrieve a specific Apex controller for a Visualforce page (ONLY if needed)
<retrieve_sf_metadata>
<metadata_type>ApexClass</metadata_type>
<metadata_name>ContactController</metadata_name>
</retrieve_sf_metadata>

Example: Retrieve a specific Visualforce component
<retrieve_sf_metadata>
<metadata_type>ApexComponent</metadata_type>
<metadata_name>MyCustomComponent</metadata_name>
</retrieve_sf_metadata>`
}

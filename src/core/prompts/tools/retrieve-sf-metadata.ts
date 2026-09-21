import { ToolArgs } from "./types"

export function getRetrieveSfMetadataDescription(args: ToolArgs): string {
	return `## retrieve_sf_metadata
Description: Dynamically retrieve metadata from a Salesforce org using SF CLI. Analyzes the type and name to determine the correct command. Can retrieve a single named component or list all components of a type.

Supported metadata types:
ApexClass, ApexTrigger, CustomObject, CustomField (Object.Field), LightningComponentBundle, AuraDefinitionBundle, FlexiPage, Flow, PermissionSet, Profile, Layout (Object-Layout Name), ApexPage, ApexComponent, StaticResource, CustomTab, CustomApplication, StandardValueSet, GlobalValueSet, RecordType (Object.RecordType), ValidationRule (Object.Rule), Role, AssignmentRule (Object.Rule), AssignmentRules (Object), PathAssistant, PathAssistantSettings

Parameters:
- metadata_type: (required) The metadata type (see list above)
- metadata_name: (optional) API name of the component. Omit to list all of that type. Format-specific:
  - CustomField: ObjectName.FieldName (e.g., Account.Industry)
  - RecordType / ValidationRule / AssignmentRule: ObjectName.ComponentName
  - Layout: ObjectName-LayoutName (e.g., Account-Account Layout)
- target_org: (optional) Target org alias. Must be specified during SFAIO runs.

Usage:
<retrieve_sf_metadata>
<metadata_type>ApexClass</metadata_type>
<metadata_name>AccountHandler</metadata_name>
</retrieve_sf_metadata>

<retrieve_sf_metadata>
<metadata_type>CustomField</metadata_type>
<metadata_name>Invoice__c.Amount__c</metadata_name>
</retrieve_sf_metadata>

<retrieve_sf_metadata>
<metadata_type>ApexClass</metadata_type>
</retrieve_sf_metadata>`
}

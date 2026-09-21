import { ToolArgs } from "./types"

export function getSfDeployMetadataDescription(args: ToolArgs): string {
	return `## sf_deploy_metadata
Description: Deploy Salesforce metadata with mandatory dry-run first. Phase 1 validates, Phase 2 deploys only if validation passes. Prefer one component at a time to isolate failures.

Supported types: ApexClass, ApexTrigger, ApexPage, ApexComponent, LightningComponentBundle, AuraDefinitionBundle, FlexiPage, CustomObject, CustomField, ValidationRule, RecordType, PermissionSet, Profile, Role, Layout, CustomTab, CustomApplication, Flow, AssignmentRule, AssignmentRules, PathAssistant, GenAiPlannerBundle, Bot, StaticResource

Parameters:
- metadata_type: (required) Type from list above
- metadata_name: (required) API name. Format-specific:
  - CustomField: ObjectApi.FieldApi (e.g., Patient__c.Email__c)
  - ValidationRule / RecordType / AssignmentRule: ObjectApi.ComponentApi
  - Layout: ObjectApi-Layout Name
  - AssignmentRules: ObjectApi only (e.g., Lead)
- test_level: (optional) NoTestRun | RunLocalTests | RunAllTestsInOrg | RunSpecifiedTests
- tests: (optional) Comma-separated test class names (required with RunSpecifiedTests)
- ignore_warnings: (optional) true | false
- target_org: (optional) Target org alias. Must be specified during SFAIO runs.
- dry_run_only: (optional) true | false. When true, performs validation only. SFAIO tasks must set this to true.

Usage:
<sf_deploy_metadata>
<metadata_type>CustomObject</metadata_type>
<metadata_name>Invoice__c</metadata_name>
</sf_deploy_metadata>

<sf_deploy_metadata>
<metadata_type>ApexClass</metadata_type>
<metadata_name>InvoiceService</metadata_name>
<test_level>RunLocalTests</test_level>
</sf_deploy_metadata>

Workflow: deploy objects before fields, fields before rules/layouts. Fix dry-run errors before retrying.`
}

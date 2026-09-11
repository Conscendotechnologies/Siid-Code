import { ToolArgs } from "./types"

export function getSfDeployMetadataDescription(args: ToolArgs): string {
	return `## sf_deploy_metadata
Description: Deploy Salesforce metadata with mandatory dry-run validation first, then actual deploy only if validation succeeds.

IMPORTANT:
1. This tool always runs in two phases:
   - Phase 1: Dry run validation
   - Phase 2: Actual deployment (only if phase 1 passes)
2. If dry run fails, deployment is aborted and error details are returned.
3. Prefer deploying one metadata component at a time to isolate failures quickly.

Supported Metadata Types:
- ApexClass
- ApexTrigger
- ApexPage
- ApexComponent
- LightningComponentBundle
- AuraDefinitionBundle
- FlexiPage
- CustomObject
- CustomField
- ValidationRule
- RecordType
- PermissionSet
- Profile
- Role
- Layout
- CustomTab
- CustomApplication
- Flow
- AssignmentRule
- AssignmentRules
- PathAssistant
- GenAiPlannerBundle
- Bot
- StaticResource

Parameters:
- metadata_type: (required) Salesforce metadata type from the supported list above.
- metadata_name: (required) Component API name(s). For best reliability, deploy one component at a time.
  - For CustomField use ObjectApi.FieldApi (example: Patient__c.Email__c)
  - For ValidationRule use ObjectApi.RuleApi
  - For RecordType use ObjectApi.RecordTypeApi
  - For Layout use ObjectApi-Layout Name
  - For AssignmentRule use ObjectApi.RuleApi
  - For AssignmentRules use ObjectApi (example: Lead)
- test_level: (optional) NoTestRun | RunLocalTests | RunAllTestsInOrg | RunSpecifiedTests
  WARNING: do NOT pass test_level to run tests. Deploy without it, then run tests with the siid_forge \`runApexTests\` feature — it returns structured pass/fail, per-failure messages, coverage, and debug logs, none of which a deploy test_level gives you.
- tests: (optional) Required only with RunSpecifiedTests (comma-separated test class names)
- ignore_warnings: (optional) true | false
- source_dir: (optional) currently ignored by the tool command builder

Usage:
Single metadata (recommended):
<sf_deploy_metadata>
<metadata_type>CustomObject</metadata_type>
<metadata_name>Patient__c</metadata_name>
</sf_deploy_metadata>

Same metadata type, different components (call tool separately for each):
<sf_deploy_metadata>
<metadata_type>CustomObject</metadata_type>
<metadata_name>Patient__c</metadata_name>
</sf_deploy_metadata>

<sf_deploy_metadata>
<metadata_type>CustomObject</metadata_type>
<metadata_name>Appointment__c</metadata_name>
</sf_deploy_metadata>

Custom fields, one at a time:
<sf_deploy_metadata>
<metadata_type>CustomField</metadata_type>
<metadata_name>Medical_History__c.Visit_Date__c</metadata_name>
</sf_deploy_metadata>

<sf_deploy_metadata>
<metadata_type>CustomField</metadata_type>
<metadata_name>Medical_History__c.Diagnosis__c</metadata_name>
</sf_deploy_metadata>

Optional: multiple components in one call (same metadata_type, comma-separated names):
<sf_deploy_metadata>
<metadata_type>CustomObject</metadata_type>
<metadata_name>Patient__c,Appointment__c,Prescription__c</metadata_name>
</sf_deploy_metadata>

With explicit test level:
<sf_deploy_metadata>
<metadata_type>ApexClass</metadata_type>
<metadata_name>AppointmentReminderBatch</metadata_name>
<test_level>RunLocalTests</test_level>
</sf_deploy_metadata>

With specified tests:
<sf_deploy_metadata>
<metadata_type>ApexClass</metadata_type>
<metadata_name>AppointmentReminderBatch</metadata_name>
<test_level>RunSpecifiedTests</test_level>
<tests>AppointmentReminderBatchTest,PrescriptionRefillBatchTest</tests>
</sf_deploy_metadata>

Workflow guidance:
1. Deploy dependencies first (objects before fields, fields before rules/layouts where applicable).
2. Use one-component deploys while debugging.
3. If dry run fails, fix the reported issue before retrying.
4. Exception: if the failing metadata_type is Flow and the file was produced by generate_sf_flow, do NOT hand-edit the .flow-meta.xml — call generate_sf_flow again with the original prompt plus the deployment error appended, and let it regenerate the file.`
}

import { ToolArgs } from "./types"

export function getDeploySfMetadataDescription(args: ToolArgs): string {
	return `## deploy_sf_metadata
Description: Deploys Salesforce metadata to an org with mandatory dry-run validation. This tool follows a two-phase deployment process to ensure safe deployments.

⚠️ **IMPORTANT: ONE TOOL CALL DOES EVERYTHING** - You only need to call this tool once. It automatically:
1. Executes dry-run validation (Phase 1)
2. If validation passes, proceeds with deployment (Phase 2)
3. If validation fails, aborts and returns errors

**Phase 1 (DRY RUN):** Validates metadata, runs tests, checks for conflicts
**Phase 2 (DEPLOY):** Only executes if dry run passes successfully

This ensures safe deployments by catching errors before they affect the org. The tool will NOT proceed with deployment if the dry run fails.

Supported Metadata Types:
- ApexClass: Deploy Apex class source code
- ApexTrigger: Deploy Apex trigger source code
- CustomObject: Deploy custom object definition
- CustomField: Deploy custom field definition (use format: ObjectName.FieldName)
- LightningComponentBundle: Deploy Lightning Web Component bundle
- AuraDefinitionBundle: Deploy Aura component bundle
- FlexiPage: Deploy Lightning page definition
- Flow: Deploy Flow definition
- PermissionSet: Deploy permission set definition
- Profile: Deploy profile definition
- Layout: Deploy page layout definition
- ApexPage: Deploy Visualforce page
- ApexComponent: Deploy Visualforce component
- StaticResource: Deploy static resource
- CustomTab: Deploy custom tab definition
- CustomApplication: Deploy custom application definition
- ValidationRule: Deploy validation rule (use format: ObjectName.ValidationRuleName)
- RecordType: Deploy record type definition (use format: ObjectName.RecordTypeName)
- Role: Deploy role hierarchy definition
- AssignmentRule: Deploy assignment rule (use format: ObjectName.RuleName)
- AssignmentRules: Deploy all assignment rules for an object (use format: ObjectName)
- PathAssistant: Deploy Sales Path / Path Assistant definition

Parameters:
- metadata_type: (required) The type of Salesforce metadata to deploy (e.g., ApexClass, CustomObject, LightningComponentBundle, etc.)
- metadata_name: (required) The API name of the specific metadata component(s) to deploy. For multiple components of the same type, separate with commas (e.g., "Class1,Class2,Class3").
  - For CustomField: Use format ObjectName.FieldName (e.g., Account.Industry, Invoice__c.Customer_Type__c)
  - For RecordType: Use format ObjectName.RecordTypeName (e.g., Account.Partner)
  - For ValidationRule: Use format ObjectName.ValidationRuleName (e.g., Account.Email_Required)
  - For Layout: Use format ObjectName-LayoutName (e.g., Account-Account Layout)
  - For AssignmentRule: Use format ObjectName.RuleName (e.g., Case.Standard_Case_Assignment)
  - For AssignmentRules: Use the object name (e.g., Case, Lead)
- source_dir: (optional) Path to the source directory containing the metadata files. If not provided, uses the default project structure.
- test_level: (optional) The level of Apex tests to run during deployment. Options:
  - NoTestRun: No tests will run (default for faster deployments)
  - RunLocalTests: Run all tests in the org except those from managed packages
  - RunAllTestsInOrg: Run all tests including those from managed packages
  - RunSpecifiedTests: Run only specified test classes (requires 'tests' parameter)
- tests: (optional) Comma-separated list of Apex test class names to run when test_level is RunSpecifiedTests (e.g., "TestClass1,TestClass2")
- ignore_warnings: (optional) If true, allows deployment even if warnings are present (default: false)

Usage:
<deploy_sf_metadata>
<metadata_type>MetadataType</metadata_type>
<metadata_name>MetadataApiName</metadata_name>
<test_level>RunLocalTests</test_level>
</deploy_sf_metadata>

Example: Deploy an Apex class with local tests
<deploy_sf_metadata>
<metadata_type>ApexClass</metadata_type>
<metadata_name>AccountHandler</metadata_name>
<test_level>RunLocalTests</test_level>
</deploy_sf_metadata>

Example: Deploy a custom object without running tests (default)
<deploy_sf_metadata>
<metadata_type>CustomObject</metadata_type>
<metadata_name>Invoice__c</metadata_name>
<test_level>NoTestRun</test_level>
</deploy_sf_metadata>

Example: Deploy an Apex trigger with specific tests
<deploy_sf_metadata>
<metadata_type>ApexTrigger</metadata_type>
<metadata_name>AccountTrigger</metadata_name>
<test_level>RunSpecifiedTests</test_level>
<tests>TestAccountTrigger,TestAccountHandler</tests>
</deploy_sf_metadata>

Example: Deploy a Lightning Web Component from a specific directory
<deploy_sf_metadata>
<metadata_type>LightningComponentBundle</metadata_type>
<metadata_name>myComponent</metadata_name>
<source_dir>force-app/main/default/lwc/myComponent</source_dir>
<test_level>RunLocalTests</test_level>
</deploy_sf_metadata>

Example: Deploy a custom field
<deploy_sf_metadata>
<metadata_type>CustomField</metadata_type>
<metadata_name>Account.Industry</metadata_name>
<test_level>NoTestRun</test_level>
</deploy_sf_metadata>

Example: Deploy multiple Apex classes at once
<deploy_sf_metadata>
<metadata_type>ApexClass</metadata_type>
<metadata_name>AccountHandler,ContactHandler,LeadProcessor</metadata_name>
<test_level>RunLocalTests</test_level>
</deploy_sf_metadata>

Example: Deploy a validation rule
<deploy_sf_metadata>
<metadata_type>ValidationRule</metadata_type>
<metadata_name>Account.Email_Required</metadata_name>
<test_level>NoTestRun</test_level>
</deploy_sf_metadata>

IMPORTANT DEPLOYMENT WORKFLOW:
1. The tool will first execute a DRY RUN to validate the deployment
2. If the dry run PASSES:
   - All metadata syntax is valid
   - All tests pass with sufficient code coverage
   - No conflicts detected
   - Then actual deployment proceeds
3. If the dry run FAILS:
   - Deployment is ABORTED
   - Error details are returned
   - You must fix the issues before attempting deployment again

SAFETY FEATURES:
- Mandatory dry-run validation cannot be bypassed
- Test execution is required (configurable via test_level)
- Detailed error messages for failed validations
- Code coverage requirements enforced
- Conflict detection before deployment`
}

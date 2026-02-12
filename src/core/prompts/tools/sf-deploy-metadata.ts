import { ToolArgs } from "./types"

export function getSfDeployMetadataDescription(args: ToolArgs): string {
	return `## sf_deploy_metadata
Description: Deploys Salesforce metadata to an org with mandatory dry-run validation. This tool follows a two-phase deployment process to ensure safe deployments.

⚠️ **IMPORTANT: ONE TOOL CALL DOES EVERYTHING** - You only need to call this tool once. It automatically:
1. Executes dry-run validation (Phase 1)
2. If validation passes, proceeds with deployment (Phase 2)
3. If validation fails, aborts and returns errors

**Phase 1 (DRY RUN):** Validates metadata, runs tests, checks for conflicts
**Phase 2 (DEPLOY):** Only executes if dry run passes successfully

This ensures safe deployments by catching errors before they affect the org. The tool will NOT proceed with deployment if the dry run fails.

Supported Metadata Types:
- **Apex**: ApexClass, ApexTrigger, ApexPage, ApexComponent
- **Lightning**: LightningComponentBundle, AuraDefinitionBundle, FlexiPage
- **Objects**: CustomObject, CustomField, ValidationRule, RecordType
- **Security**: PermissionSet, Profile, Role
- **Configuration**: Layout, CustomTab, CustomApplication, Flow
- **Automation**: AssignmentRule, AssignmentRules, PathAssistant
- **AI & Bots**: GenAiPlannerBundle, Bot
- **Resources**: StaticResource

Parameters:


Usage:


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

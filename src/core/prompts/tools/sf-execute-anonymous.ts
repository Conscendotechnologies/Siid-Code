export function getSfExecuteAnonymousDescription(): string {
	return `## sf_execute_anonymous
Description: Execute Salesforce anonymous Apex in the target org. Use this for org data setup tasks that are not deployable metadata, such as creating or updating hierarchy/list custom setting records.

IMPORTANT:
1. This tool executes Apex directly in the org. It is not a metadata deploy.
2. Prefer metadata files plus \`sf_deploy_metadata\` for deployable assets such as custom objects, custom metadata types, and custom metadata records.
3. Use this tool when the task specifically requires runtime data mutation in Salesforce, especially custom setting records.
4. The Apex must be self-contained and safe to run multiple times when possible.
5. Execute the Apex through this tool directly. Do not tell the user to run anonymous Apex commands manually when this tool can do it.

Parameters:
- content: (required) The anonymous Apex script to run.

Usage:
<sf_execute_anonymous>
<content>
My_Setting__c setting = My_Setting__c.getOrgDefaults();
if (setting == null) {
    setting = new My_Setting__c();
}
setting.Name = 'My_Setting';
setting.Feature_Enabled__c = true;
upsert setting;
</content>
</sf_execute_anonymous>`
}

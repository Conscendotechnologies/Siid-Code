import { ToolArgs } from "./types"

export function getGenerateSfFlowDescription(_args: ToolArgs): string {
	return `## generate_sf_flow
Description: Generates a deployable Salesforce Flow (.flow-meta.xml) directly from a natural-language description.

MANDATORY RULE: You MUST use this tool whenever the user asks to create, build, or generate a Salesforce Flow. NEVER write .flow-meta.xml content directly with write_to_file or any other file-writing tool — doing so bypasses schema retrieval, graph validation, and the structured generation pipeline. Even if you think you can write the XML yourself, you must NOT. Always call generate_sf_flow instead.

If the tool call FAILS (e.g. a graph-parsing error), do NOT fall back to hand-writing the Flow XML. Instead retry generate_sf_flow ONCE with a shorter, simpler prompt (split compound conditions into plainer sentences). If it fails again after up to 3 retries (the tool retries automatically), report the exact error to the user and stop — never write .flow-meta.xml by hand as a workaround.

If generate_sf_flow SUCCEEDS but the resulting XML later FAILS to deploy (sf_deploy_metadata dry-run error), do NOT hand-edit the generated .flow-meta.xml to patch it — you were not trained on this XML format and will likely make it worse. Instead call generate_sf_flow again with the original prompt plus the deployment error appended (e.g. "...also, the previous attempt failed to deploy with: <error>"), so the pipeline regenerates a corrected flow. If it still fails after that retry, report the exact deployment error to the user and stop.

After generate_sf_flow SUCCEEDS, do NOT read or re-verify the generated .flow-meta.xml file. The tool's success result already includes the file path; trust it and proceed directly to deployment. If the result includes a "⚠️ Warning: these custom field(s) were not found in the org schema" line, create those fields with sf_deploy_metadata (CustomField) BEFORE deploying the Flow — deploying it first will fail.

Do NOT use this for editing an existing flow's XML directly, or for non-Flow automation (Apex triggers, Process Builder, etc.) — only for generating a NEW Flow from a description.

Parameters:
- prompt: (required) A clear natural-language description of the automation the flow should perform — trigger condition, object(s) involved, and the actions to take.
- output_path: (optional) Relative path to the flows folder. Defaults to "force-app/main/default/flows".

Usage:
<generate_sf_flow>
<prompt>Your flow description here</prompt>
</generate_sf_flow>

Example: record-triggered flow
<generate_sf_flow>
<prompt>When an Opportunity's StageName changes to Closed Won, create a follow-up Task assigned to the owner with Subject "Send welcome package", due 3 days from today.</prompt>
</generate_sf_flow>

Example: scheduled flow
<generate_sf_flow>
<prompt>Run daily at 8 AM. Find all Patient_Management__c records where Status__c is "Active" and Date_of_Birth__c is more than 65 years ago, then set Status__c to "Inactive".</prompt>
</generate_sf_flow>`
}

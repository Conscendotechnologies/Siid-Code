#!/usr/bin/env python3
"""
Prompt to Graph Parser - Converts natural language prompts to Salesforce Flow graphs

using OpenRouter API for AI prremoocessing.
Usage:
    cd python
    python prompt_to_graph.py "Your flow description here" --output output.json
    # or from repo root:
    python python/prompt_to_graph.py "Your flow description here" --output output.json
"""

import argparse
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, Optional
import re

import requests
import sys
from pathlib import Path


def load_env_file(env_path: Optional[Path] = None) -> None:
    """Load environment variables from .env file.

    Checks (in order):
    1. The provided env_path
    2. .env in the script directory (python/.env)
    3. .env in the current working directory
    """
    if env_path is not None:
        candidates = [env_path]
    else:
        script_dir = Path(__file__).resolve().parent
        cwd = Path.cwd()
        candidates = [script_dir / ".env", cwd / ".env"]

    loaded = False
    for candidate in candidates:
        if candidate.exists():
            with open(candidate, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, value = line.split("=", 1)
                        key = key.strip()
                        value = value.strip()
                        if key not in os.environ:  # Don't override existing env vars
                            os.environ[key] = value
            if not loaded:
                loaded = True

DEFAULT_GRAPHS_DIR = Path(__file__).resolve().parent.parent / "graphs"


def load_schema_context(schema_path: Optional[str]) -> Optional[str]:
    """Load a schema-context JSON file (written by schemaRetriever.ts) and
    render it into a compact text block for injection into the system prompt.

    Per 03_PROMPT_TO_GRAPH_INSTRUCTIONS.md, Rule 2/5: this must never raise —
    any problem loading/parsing the file just results in no schema context,
    with a warning on stderr, and the caller falls back to current behavior.
    """
    if not schema_path:
        return None

    try:
        path_obj = Path(schema_path)
        if not path_obj.exists():
            print(f"Warning: --schema-context file not found: {schema_path}", file=sys.stderr)
            return None

        with open(path_obj, "r", encoding="utf-8") as f:
            data = json.load(f)

        objects = data.get("objects")
        if not isinstance(objects, dict) or not objects:
            return None

        lines = []
        for obj_name, obj_data in objects.items():
            fields = obj_data.get("fields", []) if isinstance(obj_data, dict) else []
            field_parts = []
            for field in fields:
                if not isinstance(field, dict) or not field.get("name"):
                    continue
                piece = f"{field['name']} ({field.get('type', 'unknown')}"
                if field.get("required"):
                    piece += ", required"
                if field.get("type") == "picklist" and field.get("picklistValues"):
                    values = "|".join(field["picklistValues"][:10])
                    piece += f": {values}"
                if field.get("type") == "reference" and field.get("referenceTo"):
                    piece += f" -> {'/'.join(field['referenceTo'])}"
                piece += ")"
                field_parts.append(piece)
            if field_parts:
                lines.append(f"{obj_name}: " + ", ".join(field_parts))

        if not lines:
            return None

        schema_preview = "\n".join(lines)
        print(
            f"[sfflow] Loaded schema context from {path_obj} ({len(lines)} object block(s))",
            file=sys.stderr,
        )
        print(f"[sfflow] Schema preview:\n{schema_preview}", file=sys.stderr)
        return (
            "Schema source: " + str(path_obj) + "\n"
            + schema_preview
        )
    except Exception as e:
        print(f"Warning: failed to load --schema-context ({e}). Continuing without it.", file=sys.stderr)
        return None


class PromptToGraphError(Exception):
    """Raised when prompt cannot be converted to graph."""

    def __init__(self, message: str, usage: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.usage = usage


class OpenRouterClient:
    """Client for OpenRouter API."""
    
    BASE_URL = "https://openrouter.ai/api/v1"
    DEFAULT_MODEL = "openai/gpt-5.5"
    
    # [2026-08-27] Added base_url param so this script can target 9router/OmniRoute/
    # custom endpoints passed down from flowRunner.ts, not just openrouter.ai.
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        """Initialize OpenRouter client."""
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        self.base_url = (base_url or "").rstrip("/") or self.BASE_URL
        self.last_usage: Optional[Dict[str, Any]] = None
        if not self.api_key:
            raise PromptToGraphError(
                "OpenRouter API key not provided. Set OPENROUTER_API_KEY environment variable "
                "or pass --api-key argument."
            )
    
    def generate_graph(
        self,
        prompt: str,
        model: str = DEFAULT_MODEL,
        schema_context: Optional[str] = None,
        context_log_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Call OpenRouter API to generate flow graph from prompt.

        Returns a graph object with an optional top-level "usage" block so the
        caller can display token and cost information in the UI.

        schema_context: optional pre-rendered text block (see
        load_schema_context()) describing real field API names/types for the
        sObjects referenced in the prompt. When present, it is prepended to
        the system prompt per 03_PROMPT_TO_GRAPH_INSTRUCTIONS.md, Rule 3, to
        ground the model and reduce field-name hallucination.

        context_log_path: optional file path. When present, the EXACT system
        prompt + user prompt sent to the AI (including the injected schema
        block, verbatim) is written there before the API call, so the schema
        payload can be inspected directly instead of trusted blindly.
        """
        system_prompt = """You are an expert Salesforce Flow designer. Convert the user's natural language description into a valid Salesforce Flow graph JSON structure.

The graph must have this structure:
{
  "flow_name": "PascalCase_Or_Snake_Case_no_spaces",
  "process_type": "AutoLaunchedFlow",
  "api_version": 66.0,
  "status": "Active",
  "description": "optional one-line description of what the flow does",
  "nodes": [array of node objects],
  "edges": [array of edge objects],
  "formulas": [optional array of formula objects],
  "variables": [optional array of variable objects],
  "choices": [optional array of choice objects for screen flows],
  "constants": [optional array of constant objects],
  "custom_properties": [optional array of custom property objects],
  "custom_errors": [optional array of custom error objects]
}

process_type options:
  "AutoLaunchedFlow" — record-triggered or scheduled flows (default)
  "Flow" — screen flows (when user interaction/pages are involved)

status options:
  "Active" — flow is live (default for working flows)
  "Draft" — flow is being developed
  "Obsolete" — flow is no longer in use

api_version: use 66.0 for modern flows (2025+), 62.0, 59.0, or 65.0 for older codebases

REQUIRED Node structure:
{
  "id": "unique_snake_case_id",
  "type": "Start|Decision|Assignment|GetRecords|UpdateRecords|CreateRecords|Loop|Screen|Wait|ActionCall|Subflow|End",
  "label": "Display label",
  "metadata": { ... see per-type rules below ... }
}

═══ START NODE (type: Start) ═══
{
  "id": "Start",
  "type": "Start",
  "label": "Start",
  "metadata": {
    "name": "Start",
    "original_tag": "start",
    "triggerType": "RecordAfterSave",
    "recordTriggerType": "Create",
    "object": "Case",
    "filterLogic": "and",
    "filters": [
      {"field": "Status", "operator": "EqualTo", "value": {"stringValue": "New"}}
    ],
    "filter_formula": null,
    "position": {"x": 50, "y": 0}
  }
}

triggerType options:
  "RecordBeforeSave" — runs BEFORE the record is saved (default)
  "RecordAfterSave"  — runs AFTER the record is saved
  "Scheduled"        — time-based (every hour/day/week/month)
  Omit entirely for Screen Flows (processType: Flow)

CRITICAL FAST FIELD UPDATES RULE:
- If triggerType is "RecordBeforeSave", NEVER generate UpdateRecords nodes.
- Use Assignment nodes to set fields directly on $Record instead.
- Do not try to update the triggering record with an UpdateRecords element in a before-save flow.

recordTriggerType options: "Create", "Update", "CreateAndUpdate", "Delete"
Omit entirely for Scheduled flows or Screen Flows.

═══ START FILTERS — CRITICAL DETAILS ═══
filterLogic supports positional and parenthesized notation from real XML:
  Simple: "and" / "or"
  Positional: "1 AND 2 AND 3"  (filter indices separated by AND/OR)
  Complex: "1 AND (2 OR 3 OR 4)"  (parenthesized groups)
  Complex: "(1 AND 2) OR (3 AND 4) OR (5 AND 6)"  (multi-group)

Use positional/parenthesized filterLogic when there are 3+ filters with mixed AND/OR.
In positions: 1 = first filter, 2 = second filter, etc. Use CAPITAL AND/OR.

Operator "IsChanged" — checks if a field was modified (only in Start filters):
  {"field": "Status", "operator": "IsChanged", "value": {"booleanValue": true}}
  Always pair IsChanged with an additional filter checking the desired value.

Example — "run when discount is changed AND not already approved":
"filterLogic": "(1 AND 2)",
"filters": [
  {"field": "Max_Discount_Given__c", "operator": "IsChanged", "value": {"booleanValue": true}},
  {"field": "Discount_Approved__c", "operator": "EqualTo", "value": {"booleanValue": false}}
]

Example — "run when End_User_Name is changed and not null, OR Contact email changed and not null":
"filterLogic": "(1 AND 2) OR (3 AND 4)",
"filters": [
  {"field": "End_User_Name__c", "operator": "IsChanged", "value": {"booleanValue": true}},
  {"field": "End_User_Name__c", "operator": "IsNull",   "value": {"booleanValue": false}},
  {"field": "Contact_Email__c",  "operator": "IsChanged", "value": {"booleanValue": true}},
  {"field": "Contact_Email__c",  "operator": "IsNull",   "value": {"booleanValue": false}}
]

CRITICAL: IsChanged only works in Start filters. For conditions inside Decision nodes, use ISCHANGED() in a formula.

═══ START FILTER FORMULA (optional) ═══
For complex entry conditions that can't be expressed as simple filters, use filter_formula
with a Salesforce formula expression. Use ISPICKVAL(), ISNEW(), ISCHANGED(), BEGINS(), etc.
Example for "when Lead is New or Status/OwnerId changes, AND Status is New, AND Owner is a User":
"filter_formula": "AND(ISPICKVAL({!$Record.Status}, \\\"New\\\"), BEGINS({!$Record.OwnerId}, \\\"005\\\"), OR(ISNEW(), ISCHANGED({!$Record.OwnerId}), ISCHANGED({!$Record.Status})))"

CRITICAL: If user DOES NOT mention complex entry conditions, OMIT filter_formula entirely (set to null or omit).
Only use filter_formula when the user explicitly says things like "only run when Status changes to...",
"trigger when field X changes", or describes conditions requiring ISNEW/ISCHANGED/ISPICKVAL.

═══ SCREEN FLOW START (NO trigger object) ═══
When the flow is a screen flow (user says "screen", "guided flow", "user input"), omit
triggerType, recordTriggerType, and object entirely:
{
  "id": "Start",
  "type": "Start",
  "label": "Start",
  "metadata": {
    "name": "Start",
    "original_tag": "start",
    "position": {"x": 50, "y": 0}
  }
}
The downstream parser will produce a start without object/triggerType → processType "Flow".

═══ SCHEDULED FLOWS ═══
When triggerType is "Scheduled" (user says "every day", "weekly", "scheduled"):
"scheduled_paths": [
  {
    "name": "Daily_8AM",
    "label": "Daily at 8 AM",
    "frequency": "Daily",
    "startDate": "2026-01-01",
    "startTime": "08:00:00.000Z",
    "offset_number": 0,
    "offset_unit": "Hours"
  }
]
frequency options: "Daily", "Weekly"
Do NOT set recordTriggerType or object for scheduled flows.
For prompts about closing stale Opportunities daily, the Start node must still be a real scheduled start:
  - triggerType: "Scheduled"
  - include scheduled_paths
  - never leave triggerType null
  - never use recordTriggerType for this pattern
  - if the flow is about Opportunities older than 90 days, model it as:
    Start → Get Stale Opportunities → Loop Through Stale Opportunities → Assignment(s) → Update Stale Opportunities
    with a collection variable (isCollection: true) that stores the loop items to update
  - the UpdateRecords step should use that collection variable, not a filter on Opportunity Id

═══ SPECIAL FIELD REFERENCES ═══
- $Record__Prior.FieldName — the value of the field BEFORE the current update
  Use this when checking what a field was changed FROM (e.g., "stage was changed from Qualification")
- $Label.LabelName — reference a custom label value
  Use when the user mentions configurable thresholds or label-based values
- $Record.Owner:User.Email — traverse relationship to User object from Owner field
- $Record.Account.Name — traverse parent relationship for parent fields

═
═══ DECISION NODE (type: Decision) — READ CAREFULLY ═══
Rules array has ONE entry per non-default outgoing edge.
Each rule MUST have: name (snake_case), label (human readable), conditionLogic ("and"/"or"), conditions array.
Each condition MUST have: left_value_reference ("$Record.FieldApiName"), operator, right_value.
Use operator "EqualTo" for equality checks.

DEFAULT CONNECTOR:
The default/else branch connector is specified inside the Decision metadata as:
  "default_connector_target": "TargetNodeId",
  "default_connector_label": "Default Outcome"
This maps to XML's <defaultConnector>/<defaultConnectorLabel> at the decision level,
NOT inside rules.

CRITICAL BRANCHING EXAMPLE:
If the user says "when Industry is Education, make Account Name = Suhas":
  - The rule branch labeled "Industry is Education" MUST go to the action node that updates Account Name to Suhas.
  - The default/else branch MUST go to End or to the path that does nothing.
  - Do NOT put the update action on the default branch unless the user explicitly says the action happens when the condition is false.

EXACT BRANCH COUNT:
Decision nodes must have exactly one default/else branch and all other outgoing branches must have explicit conditions.
If the user says "when Opportunity is created today then set stage to Prospecting", the "created today" path must be the labeled condition branch, not the default branch.

CONDITIONLOGIC IN RULES:
For simple single-condition rules: "conditionLogic": "and"
For multiple conditions: "conditionLogic": "and" (all must match)
For OR logic across conditions within ONE rule: "conditionLogic": "or"
For complex positional: "conditionLogic": "1 OR 2 OR 3" (if individual conditions should be OR'd)

DECISION RULE NAMES:
Real Salesforce XML uses auto-generated rule names like "Outcome_1_of_Check_Priority"
for the first outcome, "Outcome_2_of_Check_Priority" for the second, etc.
When providing rule names, use this pattern: "Outcome_<N>_of_<DecisionName>"
The first rule gets N=1, second gets N=2, etc. Labels stay human-readable.

Example — "if Priority is High":
{
  "id": "Check_Priority",
  "type": "Decision",
  "label": "Is Priority High?",
  "metadata": {
    "name": "Check_Priority",
    "original_tag": "decisions",
    "default_connector_target": "End",
    "default_connector_label": "Default Outcome",
    "rules": [
      {
        "name": "Outcome_1_of_Check_Priority",
        "label": "Priority Is High",
        "conditionLogic": "and",
        "conditions": [
          {
            "left_value_reference": "$Record.Priority",
            "operator": "EqualTo",
            "right_value": {"stringValue": "High"}
          }
        ],
        "connector_target": "Update_Status"
      }
    ],
    "position": {"x": 150, "y": 100}
  }
}
Edges for this decision node:
  Non-default branch → "condition" MUST exactly match the rule "label":
    {"from": "Check_Priority", "to": "Update_Status", "condition": "Priority Is High", "metadata": {}}
  Default/else branch → OMIT "condition" entirely:
    {"from": "Check_Priority", "to": "End", "metadata": {}}

NEVER use "True"/"False" as edge conditions. Use descriptive rule labels.
Do NOT use the downstream action label as the edge condition.
Bad: "Update Account Rating to Warm"
Good: "Warm"

DECISION CONDITION OPERATORS:
Standard: "EqualTo", "NotEqualTo", "GreaterThan", "GreaterThanOrEqualTo", "LessThan", "LessThanOrEqualTo"
Null checks: "IsNull", "IsNotNull" (right_value {"booleanValue": true/false})
Collection checks: "IsEmpty" (checks if a collection/query returned results)
String checks: "Contains", "NotContains", "StartsWith", "EndsWith"

DECISION WITH COLLECTION ISNULL PATTERN (from real flows):
To check if a collection from GetRecords has results:
{
  "name": "Outcome_1_of_Decision_1",
  "conditionLogic": "and",
  "conditions": [
    {
      "left_value_reference": "Get_Records_Name",
      "operator": "IsNull",
      "right_value": {"booleanValue": false}
    }
  ],
  "connector_target": "Process_Records",
  "label": "Found Records"
}
IsNull check on a collection: IsNull means "is empty?" with booleanValue:
  true  → records found (confusing but correct: IsNull true = "is null" = "has no records")
  false → records found (IsNull false = "is not null" = "has records")
So to branch when records ARE found: IsNull + booleanValue false.
To branch when records are NOT found: IsNull + booleanValue true OR use default branch.

MULTI-CONDITION DECISION RULES (from real XML):
Multiple conditions in one rule use numbered filterLogic:
{
  "name": "Outcome_2_of_Check_Discount_Range",
  "conditionLogic": "and",
  "conditions": [
    {"left_value_reference": "$Record.Discount__c", "operator": "GreaterThan", "right_value": {"numberValue": 5.0}},
    {"left_value_reference": "$Record.Discount__c", "operator": "LessThanOrEqualTo", "right_value": {"numberValue": 10.0}}
  ],
  "connector_target": "Submit_for_L1",
  "label": ">5 <=10"
}

MULTI-BRANCH THRESHOLD EXAMPLE:
If the user says:
  "When Amount changes, set Account Rating as:
   Hot if Amount > 100000
   Warm if Amount > 50000
   Cold otherwise"
Then create:
  - three decision outcomes with labels exactly: "Hot", "Warm", "Cold"
  - edge conditions exactly matching those labels
  - one default/else branch only for "Cold" or the fallback path
Do NOT use a generic edge label like "Amount Changed" for any outcome.

═══ SUBFLOW NODE (type: Subflow) ═══
Call another flow as a sub-process. The subflow receives input variables and can pass outputs back.

{
  "id": "Lead_New_Task_Creation_Logic",
  "type": "Subflow",
  "label": "Lead New Task Creation Logic",
  "metadata": {
    "name": "Lead_New_Task_Creation_Logic",
    "original_tag": "subflows",
    "flow_name": "Lead_Task_Logic",
    "input_assignments": [
      {"name": "newStatus", "value": {"elementReference": "$Record.Status"}},
      {"name": "ownerId",  "value": {"elementReference": "$Record.OwnerId"}},
      {"name": "recordId", "value": {"elementReference": "$Record.Id"}}
    ],
    "position": {"x": 250, "y": 200}
  }
}

Subflow edges work like Assignment nodes: one outgoing edge (chain to next).
The flow_name must match the target flow's label/API name.
input_assignments: {name: variableName in subflow, value: what to pass (elementReference or literal)}.

═══ UPDATE RECORDS NODE (type: UpdateRecords) ═══

TWO APPROACHES:
1. Simple: Direct update of trigger record with field values (NO filters needed)
2. Complex: Use GetRecords first, then reference its collection via input_reference

APPROACH 1 — Update Trigger Record Only:
{
  "id": "Update_Case_Status",
  "type": "UpdateRecords",
  "label": "Update Case Status",
  "metadata": {
    "name": "Update_Case_Status",
    "original_tag": "recordUpdates",
    "object": "Case",
    "input_assignments": [
      {"field": "Status", "value": {"stringValue": "Working"}}
    ],
    "position": {"x": 250, "y": 200}
  }
}
(No filters/input_reference = updates the trigger record automatically)

APPROACH 2 — Use GetRecords Collection (for related records):
If you need to update related records (e.g., update Opportunities linked to an Account):
1. Add GetRecords node first to query related records
2. In UpdateRecords, reference the GetRecords collection via input_reference

Example flow: Account (trigger) → GetRecords Opportunities → UpdateRecords uses collection

APPROACH 3 — Cross-Object Update via inputReference (real XML pattern):
To update a parent/related record directly without GetRecords, use inputReference
pointing to a relationship traverse:
{
  "id": "Sync_Opportunity_with_Accepted_Quote",
  "type": "UpdateRecords",
  "label": "Sync Opportunity with Accepted Quote",
  "metadata": {
    "name": "Sync_Opportunity_with_Accepted_Quote",
    "original_tag": "recordUpdates",
    "object": "Opportunity",
    "input_reference": "$Record.Opportunity",
    "input_assignments": [
      {"field": "SyncedQuoteId", "value": {"elementReference": "$Record.Id"}}
    ],
    "position": {"x": 250, "y": 200}
  }
}
This updates the parent opportunity using $Record.Opportunity as the input reference.
Use this when the user says "update the related Opportunity/Account/Case".

APPROACH 4 — Update with Filters + inputAssignments (idempotent update):
When you need to update a specific record with both filters and field values:
{
  "id": "Update_item_Record",
  "type": "UpdateRecords",
  "label": "Update item Record",
  "metadata": {
    "name": "Update_item_Record",
    "original_tag": "recordUpdates",
    "object": "OrderApi__Item__c",
    "filter_logic": "and",
    "filters": [
      {"field": "Id", "operator": "EqualTo", "value": {"elementReference": "$Record.OrderApi__Item__c"}}
    ],
    "input_assignments": [
      {"field": "OrderApi__Average_Review_Score__c", "value": {"elementReference": "AverageReviewScore"}}
    ],
    "position": {"x": 250, "y": 200}
  }
}
This pattern uses filters + input_assignments WITHOUT input_reference.
Use this when updating a different object than the trigger record (with explicit filters).

FAULT CONNECTOR (error handling):
UpdateRecords can have a faultConnector that fires on error:
"fault_connector_target": "Error_Handler_Node"
This maps to XML's <faultConnector>. Add it to metadata when error handling is needed.

GetRecords node:
{
  "id": "Get_Related_Opportunities",
  "type": "GetRecords",
  "label": "Get Related Opportunities",
  "metadata": {
    "name": "Get_Related_Opportunities",
    "original_tag": "recordLookups",
    "object": "Opportunity",
    "filter_logic": "and",
    "filters": [
      {
        "field": "AccountId",
        "operator": "EqualTo",
        "value": {"elementReference": "$Record.Id"}
      },
      {
        "field": "IsClosed",
        "operator": "EqualTo",
        "value": {"booleanValue": false}
      }
    ],
    "store_output_automatically": true,
    "get_first_record_only": false,
    "assign_null_values_if_no_records_found": false,
    "position": {"x": 250, "y": 150}
  }
}

UpdateRecords node (references the collection):
{
  "id": "Update_Related_Opportunities",
  "type": "UpdateRecords",
  "label": "Update Opportunities to Closed Lost",
  "metadata": {
    "name": "Update_Related_Opportunities",
    "original_tag": "recordUpdates",
    "object": "Opportunity",
    "input_reference": "Get_Related_Opportunities",
    "input_assignments": [
      {"field": "StageName", "value": {"stringValue": "Closed Lost"}}
    ],
    "position": {"x": 350, "y": 250}
  }
}

DESCRIPTION FIELD (optional on any node):
All record/action/decision nodes can have a "description" field explaining their purpose.
{
  "metadata": {
    ...
    "description": "Fetches all Review records related to the same item record as the triggering record",
    ...
  }
}

FAULT CONNECTOR (error handling):
When a user mentions "error handling", "if update fails", "fault path", or troubleshooting:
{
  "metadata": {
    ...
    "fault_connector_target": "Error_Screen",
    ...
  }
}
The downstream parser maps this to XML's <faultConnector>.

CRITICAL FIELD MAPPING RULES:
- Before-save / Fast Field Updates flows must only use Assignment nodes to modify $Record fields.
- Never emit UpdateRecords for a before-save flow, even if the user wants to change the triggering record.
- When UpdateRecords has input_assignments (field values): The parser copies filters from GetRecords automatically
  → You don't need to set input_reference; the filters determine which records to update
- When UpdateRecords has NO input_assignments (bulk delete only): Use input_reference to reference the collection
- Filters in GetRecords use relationship fields: "AccountId" (not "Id") to link Opportunity → Account
- Without GetRecords, UpdateRecords updates the trigger record directly
- IMPORTANT: Salesforce rejects the combination of inputReference + inputAssignments
  The parser handles this by using filters when assignments are present

CRITICAL LOOP RULE:
- If the prompt means "for each related Case/Contact/Opportunity", you MUST use a Loop node.
- Do NOT put a Decision directly on a GetRecords collection output.
- A Decision that checks a field on related records must be inside the Loop and use the loop item reference
  (for example: "Loop_Through_Cases.Priority"), not "Get_Related_Cases.Priority".
- If you are updating every matching related record, the pattern is:
  GetRecords → Loop → Decision (optional) → UpdateRecords/CreateRecords → back to Loop

═══ CREATE RECORDS NODE (type: CreateRecords) ═══
LOOP BODY UPDATE PATTERN:
When the prompt says to fetch stale Opportunities and then close each one:
  - Use a GetRecords node named "Get Stale Opportunities"
  - Use a Loop node named "Loop Through Stale Opportunities"
  - Inside the Loop, use Assignment nodes to set the fields on the current loop item
  - Also inside the Loop, add the current loop item to a collection variable, e.g. "Stale_Opportunities_To_Update"
  - After the Loop finishes, use a single UpdateRecords node that updates that collection variable
  - Do NOT add filters or conditions on the UpdateRecords node itself
  - Do NOT invent a Decision node just to gate the update step
  - Declare the collection variable with isCollection: true and objectType: Opportunity

Same as UpdateRecords but original_tag is "recordCreates".

IMPORTANT: To create ONE record per item in a collection, use Loop pattern:
  1. GetRecords → fetch collection
  2. Loop → iterate through collection
  3. Inside Loop: CreateRecords with input_assignments referencing loop items
  Do NOT use input_reference + input_assignments together (Salesforce rejects this)

Example — create a single Task linked to the triggering Opportunity:
{
  "id": "Create_Task",
  "type": "CreateRecords",
  "label": "Create Follow-up Task",
  "metadata": {
    "name": "Create_Task",
    "original_tag": "recordCreates",
    "object": "Task",
    "input_assignments": [
      {"field": "Subject",      "value": {"stringValue": "Follow-up"}},
      {"field": "OwnerId",      "value": {"elementReference": "$Record.OwnerId"}},
      {"field": "WhatId",       "value": {"elementReference": "$Record.Id"}},
      {"field": "ActivityDate", "value": {"elementReference": "Due_Date_7_Days"}}
    ],
    "position": {"x": 250, "y": 200}
  }
}

Example — create Tasks for each Contact in a collection (REQUIRES LOOP):
Fetch Contacts → Loop through Contacts → Create Task for each
Loop node:
{
  "id": "Loop_Contacts",
  "type": "Loop",
  "label": "Loop Through Contacts",
  "metadata": {
    "name": "Loop_Contacts",
    "collection_reference": "Get_Related_Contacts",
    "position": {"x": 350, "y": 250}
  }
}
CreateRecords inside Loop (connected from Loop):
{
  "id": "Create_Task_Per_Contact",
  "type": "CreateRecords",
  "label": "Create Task for Contact",
  "metadata": {
    "name": "Create_Task_Per_Contact",
    "original_tag": "recordCreates",
    "object": "Task",
    "input_assignments": [
      {"field": "Subject",      "value": {"stringValue": "Follow-up"}},
      {"field": "WhoId",        "value": {"elementReference": "Get_Related_Contacts.Id"}},
      {"field": "ActivityDate", "value": {"elementReference": "Due_Date_7_Days"}}
    ],
    "position": {"x": 450, "y": 300}
  }
}

CRITICAL TASK FIELD RULES:
─ WhoId (Name): Used for PEOPLE records (Contact, Lead)
─ WhatId (Related To): Used for BUSINESS objects (Account, Opportunity, Case)

Example: If triggered on Contact creation and you're creating a Task:
  ✓ CORRECT: {"field": "WhoId", "value": {"elementReference": "$Record.Id"}}
  ✗ WRONG:   {"field": "WhatId", "value": {"elementReference": "$Record.Id"}}
             (WhatId cannot accept Contact IDs — will fail with FIELD_INTEGRITY_EXCEPTION)

If triggered on Opportunity and creating a Task:
  ✓ CORRECT: {"field": "WhatId", "value": {"elementReference": "$Record.Id"}}
  ✓ CORRECT: {"field": "WhoId", "value": {"elementReference": "$Record.OwnerId"}}
             (Both can be used; WhoId refs the person, WhatId refs the business object)

═══ ACTION CALL NODE (type: ActionCall) ═══
Use for email alerts, simple emails, approval submissions, and any invocable action.
The downstream parser maps this to an Assignment node with original_tag "actionCalls".

CRITICAL: When the user says "send email", "email alert", "notify", "submit for approval",
use ActionCall type — NOT SendEmail. The SendEmail type does not map correctly to Flow XML.

REQUIRED FIELDS for ALL action calls:
- store_output_automatically: true (ALWAYS required by Salesforce)
- nameSegment: same value as action_name (ALWAYS required by Salesforce)
- offset: 0 (ALWAYS required by Salesforce)

═══ EMAIL SIMPLE (actionType: "emailSimple") ═══
{
  "id": "Send_Accepted_Email",
  "type": "ActionCall",
  "label": "Send Accepted Email to Contact",
  "metadata": {
    "name": "Send_Accepted_Email",
    "original_tag": "actionCalls",
    "action_name": "emailSimple",
    "action_type": "emailSimple",
    "flow_transaction_model": "CurrentTransaction",
    "store_output_automatically": true,
    "nameSegment": "emailSimple",
    "offset": 0,
    "input_parameters": [
      {"name": "recipientAddresses", "value": {"collectionElements": [{"elementReference": "$Record.Contact.Email"}]}},
      {"name": "emailSubject", "value": {"stringValue": "Inkarp | Quotation Accepted"}},
      {"name": "emailBody", "value": {"inputConfiguratorMode": "Custom", "stringValue": "<p>Your quote has been accepted.</p>"}},
      {"name": "sendRichBody", "value": {"booleanValue": true}},
      {"name": "composeEmailContent", "value": {"stringValue": "True"}}
    ],
    "position": {"x": 250, "y": 200}
  }
}
recipientAddresses: array of email addresses wrapped in collectionElements
ccAddresses (optional): array of CC addresses wrapped in collectionElements
emailSubject: string subject line
emailBody: HTML body text — use this structure for the value to include inputConfiguratorMode:
  {"value": {"inputConfiguratorMode": "Custom", "stringValue": "<p>Your quote has been accepted.</p>"}}
  The generator produces <inputConfiguratorMode>Custom</inputConfiguratorMode> which Salesforce requires for emailSimple body values.
When the user mentions a formula variable like "!ClosedWonEmailContent", reference it:
  {"elementReference": "ClosedWonEmailContent"} (NOT inside stringValue)

═══ EMAIL ALERT (actionType: "emailAlert") ═══
When the user says "send email alert" or references a specific email alert name:
{
  "id": "Send_Opp_Email_Alert",
  "type": "ActionCall",
  "label": "Send Opportunity Email Alert",
  "metadata": {
    "name": "Send_Opp_Email_Alert",
    "original_tag": "actionCalls",
    "action_name": "Opportunity.Quotation_Stage_Opp_Email_Alert",
    "action_type": "emailAlert",
    "flow_transaction_model": "CurrentTransaction",
    "store_output_automatically": true,
    "nameSegment": "Opportunity.Quotation_Stage_Opp_Email_Alert",
    "offset": 0,
    "input_parameters": [
      {"name": "SObjectRowId", "value": {"elementReference": "$Record.Id"}}
    ],
    "position": {"x": 250, "y": 200}
  }
}


═══ HTTP CALLOUT (actionType: "externalService") ═══
{
  "id": "Get_Quote",
  "type": "ActionCall",
  "label": "Get Random Quote",
  "metadata": {
    "name": "Get_Quote",
    "original_tag": "actionCalls",
    "action_name": "GetRandomQuote.Get Random Quote",
    "action_type": "externalService",
    "flow_transaction_model": "CurrentTransaction",
    "store_output_automatically": true,
    "nameSegment": "GetRandomQuote.Get Random Quote",
    "offset": 0
  }
}

═══ SUBMIT FOR APPROVAL (actionType: "submit") ═══
Requires TWO input parameters:
  - "objectId" → elementReference to the record (e.g., $Record.Id)
  - "processDefinitionNameOrId" → stringValue with the approval process API name

{
  "id": "Submit_for_L1",
  "type": "ActionCall",
  "label": "Submit for L1 Approval",
  "metadata": {
    "name": "Submit_for_L1",
    "original_tag": "actionCalls",
    "action_name": "submit",
    "action_type": "submit",
    "flow_transaction_model": "CurrentTransaction",
    "store_output_automatically": true,
    "nameSegment": "submit",
    "offset": 0,
    "input_parameters": [
      {"name": "objectId", "value": {"elementReference": "$Record.Id"}},
      {"name": "processDefinitionNameOrId", "value": {"stringValue": "End_User_Details_Approval"}}
    ],
    "position": {"x": 250, "y": 200}
  }
}

ActionCall edges work like Assignment nodes: they have one outgoing edge (chain to next node).
ActionCall CAN target back to a Loop node (loop body pattern).

═══ ASSIGNMENT NODE (type: Assignment) ═══
Use to set or modify variable values. Required for aggregation (summing loop values), initializing counters, or setting variables for later use.

CRITICAL: The key for assignment items is "assignment_items" (NOT "assignments", NOT "assignmentItems").

{
  "id": "Initialize_Total",
  "type": "Assignment",
  "label": "Initialize Total Amount",
  "metadata": {
    "name": "Initialize_Total",
    "original_tag": "assignments",
    "assignment_items": [
      {
        "assign_to_reference": "TotalAmount",
        "operator": "Assign",
        "value": {"numberValue": 0}
      }
    ],
    "position": {"x": 350, "y": 300}
  }
}

Operators for assignment_items:
  "Assign"      — set variable to value (use to initialize)
  "Add"         — add value to variable (use for aggregation in loops)
  "Subtract"    — subtract value from variable
  "Multiply"    — multiply variable by value
  "AssignCount" — set variable to the count of items in a collection
    {"assign_to_reference": "RecordCount", "operator": "AssignCount", "value": {"elementReference": "Get_Related_Reviews"}}

Example — summing Opportunity.Amount in a loop:
Variables: [{"name": "TotalAmount", "dataType": "Currency", "isCollection": false, "isInput": false, "isOutput": false}]

Step 1 — Initialize before the Loop:
{
  "id": "Initialize_Total",
  "type": "Assignment",
  "label": "Initialize Total",
  "metadata": {
    "name": "Initialize_Total",
    "original_tag": "assignments",
    "assignment_items": [
      {"assign_to_reference": "TotalAmount", "operator": "Assign", "value": {"numberValue": 0}}
    ],
    "position": {"x": 350, "y": 300}
  }
}

Step 2 — Add inside the Loop body:
{
  "id": "Add_To_Total",
  "type": "Assignment",
  "label": "Add Amount to Total",
  "metadata": {
    "name": "Add_To_Total",
    "original_tag": "assignments",
    "assignment_items": [
      {"assign_to_reference": "TotalAmount", "operator": "Add", "value": {"elementReference": "Loop_Through_Opps.Amount"}}
    ],
    "position": {"x": 550, "y": 500}
  }
}

═══ GET RECORDS NODE (type: GetRecords) ═══
Query records from Salesforce before performing actions on them.
{
  "id": "Get_Related_Account",
  "type": "GetRecords",
  "label": "Get Account Details",
  "metadata": {
    "name": "Get_Related_Account",
    "original_tag": "recordLookups",
    "object": "Account",
    "filter_logic": "and",
    "filters": [
      {
        "field": "Id",
        "operator": "EqualTo",
        "value": {"elementReference": "$Record.AccountId"}
      }
    ],
    "store_output_automatically": true,
    "get_first_record_only": false,
    "assign_null_values_if_no_records_found": false,
    "position": {"x": 250, "y": 200}
  }
}

CRITICAL: original_tag MUST be "recordLookups" (not recordGets)
filter_logic options: "and", "or"
Operator options: "EqualTo", "NotEqualTo", "GreaterThan", "LessThan", "IsNull", "IsNotNull", "Contains", "NotContains"
store_output_automatically: true = store all fields from queried records (REQUIRED: set to true or false)
get_first_record_only: true = fetch only 1st record; false = fetch all records (REQUIRED: set to true or false)
assign_null_values_if_no_records_found: true = if no records found, set variables to null (REQUIRED: set to true or false)
To reference trigger record field: {"elementReference": "$Record.FieldApiName"}
To reference a formula: {"elementReference": "Formula_Name"}
To reference a hard-coded value: {"stringValue": "value"}, {"numberValue": 42}, {"booleanValue": true}
NEVER use JavaScript string concatenation ("a" + "b") inside JSON — it is invalid JSON.
  - To combine a literal and a field reference in a Description or similar text field, create a
    Formula node of dataType Text with expression CONCAT("Opportunity closed: ", $Record.Name)
    and reference it with {"elementReference": "Formula_Name"}.
  - If only a literal is needed: {"stringValue": "literal text"}.

COMPLEX FILTER LOGIC (positional) — for combining 3+ filters with mixed AND/OR:
"filter_logic": "1 AND 2 AND 3 AND 4"     — all filters 1-4 must match
"filter_logic": "1 AND (2 OR 3 OR 4)"     — filter 1 AND (any of 2, 3, or 4)
Numbers = filter position (1-indexed). Use CAPITAL AND/OR.

SORT FIELDS (for ordered result sets):
"sort_field": "Name",
"sort_order": "Asc"
sort_order options: "Asc", "Desc"

DESCRIPTION FIELD (optional):
{
  "metadata": {
    "description": "Fetches all Review records related to the same item",
    ...
  }
}

REAL-WORLD FULL EXAMPLE with all options:
{
  "id": "Get_Related_Vendor_Accounts",
  "type": "GetRecords",
  "label": "Get Vendor Accounts",
  "metadata": {
    "name": "Get_Related_Vendor_Accounts",
    "original_tag": "recordLookups",
    "object": "Account",
    "filter_logic": "and",
    "filters": [
      {"field": "RecordTypeId", "operator": "EqualTo", "value": {"elementReference": "get_vendor_record_type.Id"}},
      {"field": "IsActive", "operator": "EqualTo", "value": {"booleanValue": true}}
    ],
    "store_output_automatically": true,
    "get_first_record_only": false,
    "assign_null_values_if_no_records_found": false,
    "sort_field": "Name",
    "sort_order": "Asc",
    "position": {"x": 250, "y": 200}
  }
}

═══ REFERENCING TRIGGER RECORD FIELDS — CRITICAL ═══
To reference a field on the triggering record, use: {"elementReference": "$Record.FieldApiName"}
Examples:
  Owner Id     → {"elementReference": "$Record.OwnerId"}
  Record Id    → {"elementReference": "$Record.Id"}
  Account Id   → {"elementReference": "$Record.AccountId"}
  Stage Name   → {"elementReference": "$Record.StageName"}
NEVER create a separate variable just to hold a value from $Record. Reference it directly.

═══ VARIABLES — ONLY WHEN NEEDED ═══
Only declare variables when you need to store intermediate computed values.
Valid dataType values: String, Boolean, Currency, Date, DateTime, Number, SObject
NEVER use "Reference" or "Id" as a dataType — use "String" instead.
NEVER declare a variable just to copy a $Record field value.

BASIC VARIABLE:
{
  "name": "TotalAmount",
  "dataType": "Currency",
  "isCollection": false,
  "isInput": false,
  "isOutput": false
}

COLLECTION VARIABLE (SObject type — for looping):
{
  "name": "Related_Vendor_Record",
  "dataType": "SObject",
  "isCollection": true,
  "isInput": true,
  "isOutput": true,
  "objectType": "Related_Vendor__c"
}
For SObject collections, ALWAYS include "objectType" with the API name of the object.

VARIABLE WITH DEFAULT VALUE:
{
  "name": "RecordCount",
  "dataType": "Number",
  "isCollection": false,
  "isInput": true,
  "isOutput": false,
  "scale": 2,
  "value": {"numberValue": 0.0}
}
Variables can have "scale" (decimal places for Number/Currency) and a default "value".
Always use numberValue for Number/Currency defaults.

VARIABLE WITH DEFAULT STRING:
{
  "name": "errorMessage",
  "dataType": "String",
  "isCollection": false,
  "isInput": false,
  "isOutput": false,
  "value": {"stringValue": ""}
}

INPUT VARIABLE (processType: Flow — Screen Flows / Subflows receive these):
{
  "name": "recordId",
  "dataType": "String",
  "isCollection": false,
  "isInput": true,
  "isOutput": true
}
isInput: true  → the flow receives this from the caller (for Screen Flows and Subflows)
isOutput: true → the flow returns this to the caller

═══ CHOICES (for Screen Flow picklists/checkboxes) ═══

═══ DYNAMIC CHOICE SETS ═══
For picklists loaded from an object field, add a choice object with type "dynamicChoiceSets":
{
  "name": "LeaveTypeChoices",
  "type": "dynamicChoiceSets",
  "dataType": "Picklist",
  "picklistField": "Leave_Type__c",
  "picklistObject": "Leave_Request__c"
}

Choices define the options available in Screen components. They map to
<choices> elements in Flow XML.

{
  "name": "closedWon",
  "choiceText": "Closed Won",
  "dataType": "String",
  "value": {"stringValue": "Closed Won"}
}
{
  "name": "closedLost",
  "choiceText": "Closed Lost",
  "dataType": "String",
  "value": {"stringValue": "Closed Lost"}
}

Include a "choices" array at the top level of the graph for screen flows with
picklists. Reference choices in Screen fields via:
{"elementReference": "closedWon"} in inputParameters' collectionElements.

═══ CONSTANTS (for static text values used in Screen Flows) ═══
Constants are string values that never change. They map to <constants> in XML.

{
  "name": "lostAgainstCompetitorMessage",
  "dataType": "String",
  "value": {"stringValue": "Please enter Lost Reason and Lost Against Competitor Value"}
}

═══ CUSTOM PROPERTIES (for Screen Flows) ═══
Used to configure screen-level settings like progress indicators:
{
  "name": "ScreenProgressIndicator",
  "value": {"stringValue": "{\"location\":\"top\",\"type\":\"simple\"}"}
}
Add a "custom_properties" array at the top level for Screen Flows.

═══ CUSTOM ERRORS (for validation errors in before-save flows) ═══
Use a CustomError NODE (not an ActionCall) when the flow must prevent a record save and show an error.
NEVER use action_type "displayError" or "addError" — those are not valid Salesforce InvocableActionType values.

Add CustomError as a node in the "nodes" array and connect to it from a Decision outcome:
{
  "id": "Err_Amount_Negative",
  "type": "CustomError",
  "label": "Amount Cannot Be Negative",
  "metadata": {
    "customErrorMessages": [
      {"errorMessage": "Opportunity Amount cannot be negative", "isFieldError": true, "fieldSelection": "Amount"}
    ]
  }
}

Set isFieldError=true and fieldSelection to the API field name to display the error on a specific field.
Set isFieldError=false to show a page-level error.
CustomError nodes are terminal — do NOT add an outgoing edge from them.
Connect a Decision outcome to a CustomError node exactly like any other node: add an edge {"source": "Decision_Id", "target": "Err_Amount_Negative", "condition": "negative"}.

Do NOT use the legacy top-level "custom_errors" array for new flows.

═══ DATE VALUES — CRITICAL ═══
NEVER use relative date strings like "+7D", "TODAY+7", or "+7 days" inside a "dateValue" field.
Salesforce XML only accepts literal ISO dates (e.g. "2025-01-01") in dateValue.

For computed dates (e.g. "due in 7 days", "30 days from now"):
1. Declare a formula in the top-level "formulas" array with dataType "Date"
2. Reference it via {"elementReference": "Formula_Name"} in the input_assignment value

Example — "create a Task due in 7 days":
Top-level formulas array:
[
  {
    "name": "Due_Date_7_Days",
    "dataType": "Date",
    "expression": "TODAY() + 7"
  }
]

FORMULA WITH SCALE (for Number types):
{
  "name": "AverageReviewScore",
  "dataType": "Number",
  "expression": "{!TotalScore} / {!RecordCount}",
  "scale": 0
}
Use scale for Number/Currency formulas. Scale = decimal places (0 = integer).

FORMULA WITH DESCRIPTION (optional):
{
  "name": "ConversionFormula",
  "dataType": "Number",
  "expression": "CASE({!Review_Score}, \"5\", 5, \"4\", 4, \"3\", 3, \"2\", 2, \"1\", 1, 0)",
  "scale": 0
}
Wrap variable references in {!VariableName} inside formula expressions.
Use CASE(), IF(), CONTAINS(), ISPICKVAL() standard Salesforce formula functions.
input_assignment for ActivityDate:
{"field": "ActivityDate", "value": {"elementReference": "Due_Date_7_Days"}}

Other date formula examples:
  30 days from now → "expression": "TODAY() + 30"
  Yesterday        → "expression": "TODAY() - 1"
  In 2 weeks       → "expression": "TODAY() + 14"
  65 years ago     → "expression": "DATE(YEAR(TODAY()) - 65, MONTH(TODAY()), DAY(TODAY()))"
  18 years ago     → "expression": "DATE(YEAR(TODAY()) - 18, MONTH(TODAY()), DAY(TODAY()))"

NEVER emit a node with type "Formula". Formulas belong ONLY in the top-level "formulas" array.
For "X years ago" comparisons, declare a formula in the "formulas" array with the DATE(YEAR(TODAY())-X, ...) expression and reference it with {"elementReference": "Formula_Name"} in filter conditions or assignments.

═══ LOOP NODE (type: Loop) ═══
Iterate through a collection (e.g., records from GetRecords) and perform actions on each item.

Example: After GetRecords fetches a collection, use Loop to process each record.
{
  "id": "Loop_Through_Contacts",
  "type": "Loop",
  "label": "Loop Through Contacts",
  "metadata": {
    "name": "Loop_Through_Contacts",
    "collection_reference": "Get_Related_Contacts",
    "iteration_order": "Asc",
    "position": {"x": 350, "y": 250}
  }
}

CRITICAL — LOOP EDGES (read carefully):
A Loop node has exactly TWO outgoing edges and ONE back-edge:
  1. Loop → body node (e.g., CreateRecords) — NO condition, omit "condition" field entirely
  2. Loop → End — NO condition, omit "condition" field entirely
  3. Body node → Loop — back-edge to re-enter the loop, NO condition

The parser classifies these automatically by topology:
  - Non-terminal target = loop body (nextValueConnector)
  - Terminal target (End) = exit connector (noMoreValuesConnector)
NEVER add "condition": "loop" or "condition": "exit" — omit condition entirely on all loop edges.

Complete Loop edge pattern:
{"from": "Get_Related_Contacts", "to": "Loop_Through_Contacts", "metadata": {}}
{"from": "Loop_Through_Contacts", "to": "Create_Task_Per_Contact", "metadata": {}}
{"from": "Create_Task_Per_Contact", "to": "Loop_Through_Contacts", "metadata": {}}
{"from": "Loop_Through_Contacts", "to": "End", "metadata": {}}

Loop metadata fields:
- collection_reference: Name of GetRecords node or variable collection
- iteration_order: "Asc" (ascending) or "Desc" (descending)

When referencing loop items in CreateRecords/UpdateRecords inside the Loop:
  Use: {"elementReference": "Get_Related_Contacts.FieldName"}  (not with input_reference)
  This references the current item being processed by the loop.

═══ SCREEN NODE (type: Screen) ═══
Display an interactive UI screen to the user. Only valid in processType "Flow" (Screen Flow).

{
  "id": "Select_Stage",
  "type": "Screen",
  "label": "Select Stage",
  "metadata": {
    "name": "Select_Stage",
    "original_tag": "screens",
    "allowBack": true,
    "allowFinish": true,
    "allowPause": false,
    "showFooter": true,
    "showHeader": true,
    "fields": [
      {
        "name": "Stage",
        "fieldType": "ComponentInstance",
        "extensionName": "flowruntime:selectCheckboxes",
        "dataTypeMappings": [{"typeName": "T"}],
        "isRequired": true,
        "inputParameters": [
          {"name": "label", "value": {"stringValue": "Select Stage"}},
          {"name": "choiceDisplayType", "value": {"stringValue": "vertical"}},
          {"name": "choices", "value": {"collectionElements": [
            {"elementReference": "closedWon"},
            {"elementReference": "closedLost"}
          ]}}
        ],
        "outputParameters": [
          {"name": "selectedValue", "assignToReference": "Stage"}
        ]
      },
      {
        "name": "Response_Text",
        "fieldType": "DisplayText",
        "fieldText": "<p>User details successfully retrieved.</p>",
        "styleProperties": {
          "verticalAlignment": {"stringValue": "top"},
          "width": {"stringValue": "12"}
        }
      }
    ],
    "position": {"x": 250, "y": 200}
  }
}

FIELD COMPONENT TYPES (fieldType and extensionName):
For standard inputs, do NOT use ComponentInstance/extensionName. Use proper fieldType and dataType. Always provide "fieldText" for the label:
- Text Input: "fieldType": "InputField", "dataType": "String", "fieldText": "Label Here"
- Text Area: "fieldType": "LargeTextArea", "dataType": "String", "fieldText": "Label Here"
- Number Input: "fieldType": "InputField", "dataType": "Number", "scale": 0, "fieldText": "Label Here"
- Currency Input: "fieldType": "InputField", "dataType": "Currency", "scale": 2, "fieldText": "Label Here"
- Dropdown/Picklist: "fieldType": "DropdownBox", "dataType": "String", "fieldText": "Label Here" (Include "choice_references" array)
- Radio Buttons: "fieldType": "RadioButtons", "dataType": "String", "fieldText": "Label Here" (Include "choice_references" array)
- Checkbox (Boolean): "fieldType": "InputField", "dataType": "Boolean", "fieldText": "Label Here"
- Read-Only Text: "fieldType": "DisplayText", "fieldText": "Message Here"

Only use "fieldType": "ComponentInstance" with "extensionName" for these specific LWC components:
- "flowruntime:selectCheckboxes"  — multi-select checkboxes (choices via collectionElements)
- "flowruntime:datatable"         — data table with columns (uses Selected_Records multi-pick pattern)
- "flowruntime:fileupload"        — file upload component

For read-only text, use "fieldType": "DisplayText" and provide "fieldText".

DATATABLE EXAMPLE — multi-select table:
{
  "name": "Vendor_Accounts",
  "fieldType": "ComponentInstance",
  "extensionName": "flowruntime:datatable",
  "dataTypeMappings": [{"typeName": "T", "typeValue": "Account"}],
  "isRequired": true,
  "inputParameters": [
    {"name": "label",           "value": {"stringValue": "Vendor Accounts"}},
    {"name": "selectionMode",   "value": {"stringValue": "MULTI_SELECT"}},
    {"name": "minRowSelection", "value": {"numberValue": 0}},
    {"name": "tableData",       "value": {"elementReference": "Get_Account"}},
    {"name": "columns",         "value": {"stringValue": "[{\"apiName\":\"Name\",\"label\":\"Account Name\",\"type\":\"text\"}]"}},
    {"name": "isShowSearchBar", "value": {"booleanValue": true}}
  ],
  "outputParameters": [
    {"name": "selectedRows", "assignToReference": "Selected_Records"}
  ]
}

Use "inputsOnNextNavToAssocScrn": "UseStoredValues" to preserve selections on back-navigation.
Use "styleProperties" for layout: {"verticalAlignment": {"stringValue": "top"}, "width": {"stringValue": "12"}}

SCREEN CONNECTORS — Screen nodes connect to the next element in the flow chain:
{"from": "Select_Stage", "to": "Get_Child_Quotes", "metadata": {}}

═══ WAIT NODE (type: Wait) ═══
Pause flow execution for a specified duration or until a time event.
{
  "id": "Wait_24_Hours",
  "type": "Wait",
  "label": "Wait 24 Hours",
  "metadata": {
    "name": "Wait_24_Hours",
    "wait_events": [
      {
        "event_type": "AlarmEvent",
        "alarm_time_offset": 1,
        "alarm_time_unit": "Days",
        "label": "In 1 day"
      }
    ],
    "position": {"x": 250, "y": 200}
  }
}

alarm_time_unit options: "Minutes", "Hours", "Days"
event_type: Use "AlarmEvent" for time-based waits
alarm_time_offset: Number of units to wait (e.g., 24 for hours, 1 for days)

═══ EMAIL / SEND EMAIL — USE ActionCall ═══
ALWAYS use ActionCall node type for emails (see ActionCall section above).
The old "SendEmail" node type is DEPRECATED and may not generate valid XML.
Use "emailSimple" action_type for custom emails and "emailAlert" for email alerts.

═══ END NODE (type: End) ═══
{
  "id": "End",
  "type": "End",
  "label": "End",
  "metadata": {"position": {"x": 300, "y": 400}}
}

ABSOLUTE RULES:
1. Exactly ONE Start node (id must be "Start")
2. At least ONE End node
3. Every node connected by edges; last action connects to End
4. Decision non-default edges: condition = exact rule label string
5. Decision default/else edges: no condition field at all
6. snake_case for all ids and names
7. original_tag for Decision MUST be "decisions" (plural)
8. NEVER put relative date expressions inside dateValue — use formulas + elementReference
9. Use {"elementReference": "$Record.FieldName"} to reference trigger record fields directly
10. Variable dataType MUST be one of: String, Boolean, Currency, Date, DateTime, Number, SObject — never "Reference" or "Id"
11. For bulk operations (create/update multiple records from a collection):
    - Use GetRecords → Loop → CreateRecords/UpdateRecords pattern
    - Inside Loop, reference collection items via: {"elementReference": "CollectionName.FieldName"}
    - DO NOT combine inputReference + inputAssignments (Salesforce rejects this)
    - Loop is REQUIRED when creating/updating one record per item in a collection
12. FLOW IS STRICTLY SEQUENTIAL — NO PARALLEL BRANCHES EVER:
    - Every node (except Decision/Loop) has EXACTLY ONE outgoing edge
    - Start node has EXACTLY ONE outgoing edge
    - When updating multiple objects (e.g., Contacts AND Opportunities), chain them in series:
      Start → GetRecords_A → UpdateRecords_A → GetRecords_B → UpdateRecords_B → End
    - NEVER write two edges from the same non-Decision/Loop node
    - WRONG: Start→GetContacts AND Start→GetOpportunities (two edges from Start = crash)
    - CORRECT: Start→GetContacts→UpdateContacts→GetOpportunities→UpdateOpportunities→End
13. ActionCall nodes (for emails, alerts, approvals) also count as Decision/Loop exceptions:
    - ActionCall has ONE outgoing edge like Assignment
    - ActionCall CAN target back to a Loop node (for loop body patterns)
14. For scheduled flows (user says "daily", "weekly", "every morning"):
    - Set triggerType to "Scheduled"
    - Add scheduled_paths to Start metadata with frequency, startDate, startTime
    - Do NOT set object or recordTriggerType for scheduled flows
15. $Record__Prior.FieldName = value BEFORE update (for "changed from X to Y" checks)
16. $Label.LabelName = reference to a custom label value
17. For collection variables used in loops, declare them with isCollection: true

═══ MULTI-OBJECT UPDATE PATTERN (for scenarios like "update Contacts AND Opportunities") ═══
Always chain them sequentially. Example — "Update Contacts and Opportunities":
Edges:
{"from": "Start",                     "to": "Get_Related_Contacts",         "metadata": {}}
{"from": "Get_Related_Contacts",      "to": "Update_Contact_Descriptions",  "metadata": {}}
{"from": "Update_Contact_Descriptions","to": "Get_Related_Opportunities",   "metadata": {}}
{"from": "Get_Related_Opportunities", "to": "Update_Opp_Descriptions",      "metadata": {}}
{"from": "Update_Opp_Descriptions",   "to": "End",                          "metadata": {}}

Return ONLY valid JSON. No markdown, no explanations, no code fences."""

        if schema_context:
            print("[sfflow] Injecting schema context into the AI prompt before XML generation.", file=sys.stderr)
            system_prompt = (
                "═══ REAL ORG SCHEMA (authoritative — read before writing any field reference) ═══\n"
                f"{schema_context}\n\n"
                "SCHEMA RULES (mandatory, not suggestions):\n"
                "1. For every object listed above, you MUST use ONLY the field API names that "
                "appear in this schema, copied EXACTLY as written — same case, same characters, "
                "same trailing __c. Do not re-capitalize, re-guess, or 'clean up' a field name.\n"
                "2. A field name you invent from the prompt wording (e.g. guessing 'Type__c' "
                "because the user said 'type') is WRONG unless that exact string appears in the "
                "schema above. If the user's wording suggests a field that is NOT in the schema "
                "under that exact name, search the schema's field list for the closest actual "
                "match and use that instead.\n"
                "3. If an object referenced in the request has no schema block above, or the "
                "field truly does not exist in that object's field list, use a plausible standard "
                "Salesforce field name and explicitly note the assumption in the flow's "
                "\"description\" field — do not silently guess.\n\n"
                + system_prompt
            )

        if context_log_path:
            try:
                log_path = Path(context_log_path)
                log_path.parent.mkdir(parents=True, exist_ok=True)
                log_content = (
                    f"Timestamp: {__import__('datetime').datetime.now().isoformat()}\n"
                    f"Model: {model}\n"
                    f"Schema context present: {bool(schema_context)}\n"
                    "\n"
                    "════════════════════ USER PROMPT ════════════════════\n"
                    f"{prompt}\n"
                    "\n"
                    "══════════════ FINAL SYSTEM PROMPT (verbatim, exactly what the AI receives) ══════════════\n"
                    f"{system_prompt}\n"
                )
                log_path.write_text(log_content, encoding="utf-8")
                print(f"[sfflow] Wrote exact AI request context to {log_path}", file=sys.stderr)
            except Exception as e:
                print(f"Warning: failed to write --context-log ({e}). Continuing.", file=sys.stderr)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": f"Create a Salesforce Flow graph for: {prompt}"
                }
            ],
            "temperature": 0.3,
            "max_tokens": 8192,
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=100
            )
            response.raise_for_status()
        except requests.RequestException as e:
            raise PromptToGraphError(f"OpenRouter API request failed: {e}")

        # [2026-08-27] Some providers (e.g. OmniRoute) always respond with an SSE stream
        # (text/event-stream), ignoring a missing/false "stream" field. Parse
        # SSE if that's what came back; otherwise treat the body as plain JSON.
        # Without this, non-streaming callers got an empty/garbled content string.
        content_type = response.headers.get("content-type", "")
        if "text/event-stream" in content_type:
            content = ""
            usage = {}
            cost = None
            for line in response.text.splitlines():
                line = line.strip()
                if not line.startswith("data:"):
                    continue
                data = line[len("data:"):].strip()
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                if "error" in chunk:
                    raise PromptToGraphError(f"OpenRouter API error: {chunk['error']}")
                delta = chunk.get("choices", [{}])[0].get("delta", {})
                content += delta.get("content") or ""
                if chunk.get("usage"):
                    usage = chunk["usage"]
                    cost = chunk.get("cost")
            if not content:
                raise PromptToGraphError("No response from OpenRouter API")
        else:
            try:
                result = response.json()
            except json.JSONDecodeError as e:
                raise PromptToGraphError(f"Invalid JSON response from OpenRouter: {e}")

            if "error" in result:
                raise PromptToGraphError(f"OpenRouter API error: {result['error']}")

            if "choices" not in result or not result["choices"]:
                raise PromptToGraphError("No response from OpenRouter API")

            content = result["choices"][0].get("message", {}).get("content", "")
            usage = result.get("usage") or {}
            cost = result.get("cost")

        self.last_usage = {
            "prompt_tokens": usage.get("prompt_tokens"),
            "completion_tokens": usage.get("completion_tokens"),
            "total_tokens": usage.get("total_tokens"),
            "cost": cost,
        }

        # Extract JSON from response (handle markdown code blocks)
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
        if json_match:
            content = json_match.group(1)

        # Strip JS-style // line comments the model sometimes emits after JSON values.
        # (?<!:) guards against stripping the "//" inside "http://..." string values.
        # ponytail: naive heuristic, not a real tokenizer — could mis-strip a literal
        # "//" inside a string value; upgrade to a proper JSON5 parser if that happens.
        content = re.sub(r'(?<!:)//[^\n]*', '', content)

        # Sanitize JS-style string concatenation the model sometimes emits, e.g.:
        #   "stringValue": "Opportunity closed: " + "$Record.Name"
        # Collapse adjacent quoted strings joined by + into one string, repeating
        # until stable so chained `+` (A + B + C) is fully folded.
        _prev = None
        while _prev != content:
            _prev = content
            content = re.sub(
                r'"((?:[^"\\]|\\.)*?)"\s*\+\s*"((?:[^"\\]|\\.)*?)"',
                lambda m: '"' + m.group(1) + m.group(2) + '"',
                content,
            )

        try:
            graph = json.loads(content)
        except json.JSONDecodeError as e:
            raise PromptToGraphError(
                f"Failed to parse graph JSON from response: {e}\nResponse: {content}",
                usage=self.last_usage,
            )
        
        # Validate basic structure
        if not isinstance(graph, dict):
            raise PromptToGraphError("Graph must be a JSON object", usage=self.last_usage)

        if "flow_name" not in graph or not isinstance(graph.get("flow_name"), str):
            raise PromptToGraphError("Graph must have a flow_name string", usage=self.last_usage)
        
        if "nodes" not in graph or not isinstance(graph.get("nodes"), list):
            raise PromptToGraphError("Graph must have a nodes array", usage=self.last_usage)
        
        if "edges" not in graph or not isinstance(graph.get("edges"), list):
            raise PromptToGraphError("Graph must have an edges array", usage=self.last_usage)

        # Ensure a Start node exists — the LLM sometimes omits it for screen flows.
        _ensure_start_node(graph)

        if isinstance(usage, dict) and usage:
            graph["usage"] = {
                "prompt_tokens": usage.get("prompt_tokens"),
                "completion_tokens": usage.get("completion_tokens"),
                "total_tokens": usage.get("total_tokens"),
                "cost": cost,
            }
        elif cost is not None:
            graph["usage"] = {
                "cost": cost,
            }

        validate_before_save_graph(graph)
        _validate_input_references(graph)

        return graph


def _ensure_start_node(graph: Dict[str, Any]) -> None:
    """Inject a default Start node if the LLM omitted one (common in screen flows)."""
    nodes = graph.get("nodes")
    if not isinstance(nodes, list):
        return
    for node in nodes:
        if isinstance(node, dict) and node.get("type") == "Start":
            return  # Start node already present
    # Build a default screen-flow Start node
    start_node = {
        "id": "Start",
        "type": "Start",
        "label": "Start",
        "metadata": {
            "name": "Start",
            "original_tag": "start",
            "position": {"x": 50, "y": 0},
        },
    }
    nodes.insert(0, start_node)
    # Wire Start → first node that has no incoming edge
    edges = graph.get("edges")
    if not isinstance(edges, list):
        graph["edges"] = []
        edges = graph["edges"]
    targets_with_incoming = {e.get("to") for e in edges if isinstance(e, dict)}
    for node in nodes[1:]:  # skip the Start node we just inserted
        nid = node.get("id") if isinstance(node, dict) else None
        if nid and nid not in targets_with_incoming:
            edges.insert(0, {"from": "Start", "to": nid, "metadata": {}})
            return
    # Fallback: if every node already has an incoming edge, connect to the second node anyway
    if len(nodes) > 1:
        nid = nodes[1].get("id") if isinstance(nodes[1], dict) else None
        if nid:
            edges.insert(0, {"from": "Start", "to": nid, "metadata": {}})


def _validate_input_references(graph: Dict[str, Any]) -> None:
    """Strip input_reference values that point to non-existent or wrong-type nodes.

    The LLM sometimes sets input_reference to a Loop node name instead of a
    collection variable or GetRecords node.  When the referenced id is not a
    valid node in the graph, remove it so the emitter falls back to filters.
    """
    nodes = graph.get("nodes")
    if not isinstance(nodes, list):
        return
    node_ids = {n.get("id") for n in nodes if isinstance(n, dict) and n.get("id")}
    # Also collect variable names so references like "contactsToSave" are valid
    variables = graph.get("variables")
    var_names: set = set()
    if isinstance(variables, list):
        for v in variables:
            if isinstance(v, dict) and v.get("name"):
                var_names.add(v["name"])

    valid_refs = node_ids | var_names

    for node in nodes:
        if not isinstance(node, dict):
            continue
        if node.get("type") not in ("UpdateRecords", "DeleteRecords"):
            continue
        meta = node.get("metadata")
        if not isinstance(meta, dict):
            continue
        ref = meta.get("input_reference")
        if ref and ref not in valid_refs:
            # Drop the invalid reference — emitter will use filters instead
            del meta["input_reference"]


def _graph_trigger_type(graph: Dict[str, Any]) -> Optional[str]:
    nodes = graph.get("nodes")
    if not isinstance(nodes, list):
        return None

    for node in nodes:
        if not isinstance(node, dict) or node.get("type") != "Start":
            continue
        metadata = node.get("metadata")
        if not isinstance(metadata, dict):
            return None
        trigger_type = metadata.get("trigger_type") or metadata.get("triggerType")
        return trigger_type if isinstance(trigger_type, str) else None
    return None


def validate_before_save_graph(graph: Dict[str, Any]) -> None:
    """Reject graph shapes that Salesforce cannot support in before-save flows."""
    if _graph_trigger_type(graph) != "RecordBeforeSave":
        return

    nodes = graph.get("nodes")
    if not isinstance(nodes, list):
        return

    offending_nodes = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        if node.get("type") != "UpdateRecords":
            continue
        node_id = node.get("id") or node.get("label") or "unknown"
        offending_nodes.append(str(node_id))

    if offending_nodes:
        raise PromptToGraphError(
            "Generated graph is invalid for a before-save/Fast Field Updates flow: "
            f"found UpdateRecords node(s) {', '.join(offending_nodes)}. "
            "Use Assignment nodes to set $Record fields instead."
        )


def _prompt_indicates_scheduled_flow(prompt: str) -> bool:
    text = prompt.lower()
    return any(
        phrase in text
        for phrase in (
            "scheduled flow",
            "schedule",
            "scheduled",
            "daily",
            "every day",
            "each day",
            "weekly",
            "every week",
            "every morning",
            "every night",
            "once a day",
        )
    )


def _default_scheduled_path() -> Dict[str, Any]:
    tomorrow = date.today() + timedelta(days=1)
    return {
        "name": "Daily_8AM",
        "label": "Daily at 8 AM",
        "frequency": "Daily",
        "startDate": tomorrow.isoformat(),
        "startTime": "08:00:00.000Z",
        "offset_number": 0,
        "offset_unit": "Hours",
    }


def normalize_generated_graph(prompt: str, graph: Dict[str, Any]) -> Dict[str, Any]:
    """Repair common generator mistakes before writing the graph to disk."""
    if not isinstance(graph, dict):
        return graph

    if not _prompt_indicates_scheduled_flow(prompt):
        return graph

    nodes = graph.get("nodes")
    if not isinstance(nodes, list):
        return graph

    for node in nodes:
        if not isinstance(node, dict) or node.get("type") != "Start":
            continue

        metadata = node.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}
            node["metadata"] = metadata

        trigger_type = metadata.get("trigger_type") or metadata.get("triggerType")
        if trigger_type != "Scheduled":
            metadata["trigger_type"] = "Scheduled"
            metadata["triggerType"] = "Scheduled"

        # Scheduled flows must not carry record-triggered start fields.
        metadata.pop("object", None)
        metadata.pop("recordTriggerType", None)
        metadata.pop("record_trigger_type", None)

        scheduled_paths = metadata.get("scheduled_paths")
        if not isinstance(scheduled_paths, list) or not scheduled_paths:
            metadata["scheduled_paths"] = [_default_scheduled_path()]
        break

    return graph


def main():
    """Main entry point."""
    # Load API key from .env file if it exists
    load_env_file()
    
    parser = argparse.ArgumentParser(
        description="Convert natural language prompts to Salesforce Flow graphs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run from repo root:
  python python/prompt_to_graph.py "Create a flow that approves quotes"

  # Or cd into python/ first:
  cd python
  python prompt_to_graph.py "Create a flow..." --api-key your-key

  # Then convert to XML:
  python python/graph_to_flow_xml.py graphs/flow_name/flow_name.json
        """
    )
    
    parser.add_argument(
        "prompt",
        help="Natural language description of the flow"
    )
    
    parser.add_argument(
        "--api-key",
        help="OpenRouter API key (or set OPENROUTER_API_KEY env var)"
    )

    # [2026-08-27] New CLI arg: flowRunner.ts passes the resolved provider base URL here.
    parser.add_argument(
        "--base-url",
        default="",
        help="API base URL (default: https://openrouter.ai/api/v1). Use for OmniRoute or other providers."
    )
    
    parser.add_argument(
        "--model",
        default=OpenRouterClient.DEFAULT_MODEL,
        help=f"OpenRouter model to use (default: {OpenRouterClient.DEFAULT_MODEL})"
    )

    parser.add_argument(
        "--output",
        help="Write the generated graph JSON to this path instead of the default graphs/<flow>/<flow>.json"
    )

    parser.add_argument(
        "--schema-context",
        help="Path to a schema-context JSON file (produced by `sf sobject describe`) "
             "to ground field/object names and reduce hallucination. Optional — if "
             "missing or unreadable, generation proceeds without it."
    )

    parser.add_argument(
        "--context-log",
        help="Path to write the EXACT final system prompt + user prompt sent to the "
             "AI (schema included, verbatim) for inspection/debugging. Optional."
    )

    args = parser.parse_args()

    schema_context = load_schema_context(args.schema_context)

    # Generate graph
    try:
        client = OpenRouterClient(args.api_key, args.base_url)
        print(f"Generating graph from prompt: {args.prompt[:60]}...", file=sys.stderr)
        if schema_context:
            print("Using schema context to ground field/object names.", file=sys.stderr)
        graph = client.generate_graph(
            args.prompt,
            args.model,
            schema_context=schema_context,
            context_log_path=args.context_log,
        )
        graph = normalize_generated_graph(args.prompt, graph)
        
        # Get flow name from graph
        flow_name = graph.get('flow_name', 'unnamed_flow')
        # Sanitize flow name for use as folder/file name
        safe_name = flow_name.lower().replace(' ', '_').replace('-', '_')
        
        # Create output directory structure: graphs/flow_name/
        # Default is relative to the repo root (parent of the python/ script dir)
        repo_root = Path(__file__).resolve().parent.parent
        if args.output:
            output_file = Path(args.output)
            output_file.parent.mkdir(parents=True, exist_ok=True)
        else:
            output_dir = repo_root / "graphs" / safe_name
            output_dir.mkdir(parents=True, exist_ok=True)
            output_file = output_dir / f"{safe_name}.json"

        # Write output
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(graph, f, indent=2)
        
        print(f"✓ Graph generated successfully: {output_file}", file=sys.stderr)
        print(f"Flow name: {graph.get('flow_name')}")
        print(f"Nodes: {len(graph.get('nodes', []))}")
        print(f"Edges: {len(graph.get('edges', []))}")
        print(f"\nNext: python python/graph_to_flow_xml.py {output_file}")
        
    except PromptToGraphError as e:
        print(f"Error: {e}", file=sys.stderr)
        if getattr(e, "usage", None):
            print(f"Usage: {json.dumps(e.usage)}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

# Salesforce Record Type Creation - Complete Instructions

## Mode Overview

This mode assists the AI model in creating and managing Salesforce Record Types by generating the necessary XML files in the recordTypes directory. It ensures that record type names follow Salesforce conventions, handles picklist field value management, and creates required business processes for Lead, Opportunity, and Case objects. The generated XML is compliant with Salesforce Metadata API standards and ready for deployment.

---

## Instructions (IMPORTANT!!)

# Strict Rules for Salesforce Record Type Creation

## Initial Information Collection

When a user requests record type creation, collect the following basic information:

1. **Object Name**: Which object is this record type for? (e.g., Account, Contact, Lead, Opportunity, Case, Custom_Object\_\_c)
2. **Record Type Label**: The user-friendly name (e.g., "Enterprise Account")
3. **Record Type Developer Name**: API name with underscores (e.g., Enterprise_Account)
4. **Description**: Brief description of the record type's purpose
5. **Active Status**: Should this record type be active? (default: true)

---

## Picklist Fields Configuration

After collecting basic information, **MANDATORY STEP**:

### Ask About Picklist Fields

Display this message to the user:

> "Would you like to add any picklist fields to this record type? (Yes/No)"
>
> "If yes, I'll retrieve all available picklist fields for the [Object Name] object and let you select which ones to include and configure their values."

### If User Says YES:

#### Step 1: Retrieve All Picklist Fields

- Execute command to retrieve object metadata:
    ```bash
    sf project retrieve start --metadata CustomObject:<ObjectName>
    ```
- Parse the object XML to identify all picklist fields (both standard and custom).

```markdown
# Record Type Creation — Condensed Instructions

Goal: Short, deterministic steps for creating record types, handling picklists, business processes (Lead/Opportunity/Case), profile assignments, dry-run validation, and deployment.

Workflow (when user requests a record type for any object):

- Collect basic info: ObjectName, Record Type Label, DeveloperName (underscores), Description, Active(true/false).
- Retrieve picklist fields for the object. If that fails, retrieve full object metadata and extract picklist fields. Display the list of available fields to the user.
- After showing the list, let the user type their selections (they may provide label text, API names, or numbers). Do NOT force numeric-only selection. For each selected field, display the picklist values and let the user type the values they want (label text, API name, or shown number) and optionally specify one default.
- If object is Lead or Opportunity (Case optional), create a Business Process: retrieve stage/status values, let user select values and default.
- Generate metadata files:
    - RecordType: `force-app/main/default/objects/<Object>/recordTypes/<DevName>.recordType-meta.xml`
    - BusinessProcess (if required): `force-app/main/default/objects/<Object>/businessProcesses/<BP_DevName>.businessProcess-meta.xml`
- Retrieve profiles, show list, let user select profiles to assign the record type; update profile XMLs with recordTypeVisibilities (alphabetically sorted) and default handling.
- Run dry-run validation on changed files; fix errors and re-run until dry-run passes.
- Deploy in order: BusinessProcess (if any) → RecordType → Profiles.

Key rules (short):

- Always use one `--metadata` flag per metadata entity. Do NOT use comma-separated lists in a single flag.
    - Standard: `--metadata StandardValueSet:FieldName`
    - Custom: `--metadata CustomField:ObjectName.FieldAPIName__c`
- If retrieval fails with "cannot be found", verify API names and retry with separate flags.

Picklist retrieval and selection (chat UX):

- Show a clear list of picklist fields (Label + API). Do not require numeric-only responses — allow the user to type the field label, API name, or the displayed number.
- For each chosen field: display the picklist values. Allow the user to select values by typing the label, API name, or the displayed number, and to indicate one default value (same selection formats allowed).

Business process (Lead/Opportunity/Case):

- Inform user a business process is required for these objects.
- Retrieve StandardValueSet:OpportunityStage / LeadStatus / CaseStatus, show values, collect selected values and default.

RecordType XML essentials:

- Must include `<fullName>`, `<label>`, `<description>`, `<active>`. For Lead/Opportunity/Case include `<businessProcess>`.
- For picklists include one `<picklistValues>` section per field with chosen `<values>` and `<default>`.

Profile assignment (concise & MANDATORY after record type creation):

- IMPORTANT — after generating the RecordType XML (and BusinessProcess XML if applicable), automatically retrieve all profiles and display them immediately. This profile-assignment step occurs after XML generation and before final deploy steps.
- Present profiles in a list; allow the user to select profiles by typing profile names, partial names, or the displayed number. Be flexible in input parsing but validate matches before making changes.
- For each selected profile, add a `<recordTypeVisibilities>` entry: `<recordType>Object.DevName</recordType>`, `<visible>true</visible>`, `<default>true|false>`.
- If the user sets `<default>true>` for a profile, unset the existing default for that object in that profile.
- Keep recordType entries sorted alphabetically by `<recordType>`.

Validation & deployment (strict):

- Always perform dry-run; do not deploy until dry-run succeeds.
- Dry-run examples:
    - RT only: `sf project deploy start --dry-run --source-dir force-app/main/default/objects/<Object>/recordTypes/<RT>.recordType-meta.xml`
    - BP + RT: `sf project deploy start --dry-run --source-dir force-app/main/default/objects/<Object>/businessProcesses/<BP>.businessProcess-meta.xml force-app/main/default/objects/<Object>/recordTypes/<RT>.recordType-meta.xml`
- Deploy order: BusinessProcess → RecordType → Profiles.

Error handling (short):

- On dry-run failure: present error, auto-fix common problems when safe (invalid API names, XML syntax, invalid picklist values), re-run dry-run. Only deploy once dry-run passes.
- On retrieval failure: check API names and reconstruct commands with separate `--metadata` flags.

Naming rules (short):

- Developer names: letters, numbers, underscores; start with letter; no trailing or consecutive underscores. Replace spaces with underscores.

Chat guidance:

- Use natural language, show numbered choices, confirm selections and defaults before generating files or deploying.

Confirmation (after complete deploys):

- Show a short summary: Object, Record Type Label, BP (if any), Assigned Profiles (with defaults).

---

End of condensed instructions.
```

## Input validation & sample prompts (quick reference)

Use these exact, short prompts in the chat UI and validate user input before acting.

- Prompt: Show picklist fields

    - Message: "Here are the picklist fields for <Object>:\n1. Industry (API: Industry)\n2. Type (API: Type)\n3. SLA**c (API: SLA**c)\nPlease enter which fields you want to configure. You may reply with numbers, API names, or labels."

- Valid user responses (examples):

    - "1,3" → numbers
    - "Industry, SLA\_\_c" → labels/API names
    - "Type" → single label

- Invalid responses: empty reply, punctuation-only, or ambiguous partials that match multiple fields without clarification.

- Prompt: Select picklist values for a field

    - Message: "Values for Industry:\n1. Agriculture\n2. Finance\n3. Technology\nEnter the values you want (numbers, labels, or API-style). Optionally mark one default by adding ` default:` plus the selection. Example: `1,3 default:3` or `Finance,Technology default:Technology`."

- Validation rules (apply before creating XML):

    1. Trim input and split by common separators (commas, semicolons, newlines).
    2. Map numeric selections to displayed entries (1 -> first entry). If number out of range → ask to re-enter.
    3. Match API name or label case-insensitively. If multiple matches found for a partial, request clarification.
    4. Allow a single explicit default. If unspecified, no `<default>true>` is set.

- Prompt: Profile assignment (after XML created)

    - Message: "Record Type created. Fetching profiles... Here are available profiles:\n1. System Administrator\n2. Sales User\n3. Marketing User\nEnter the profiles to assign (names, partial names, or numbers)."

- Profile selection validation:
    - Accept numbers, exact names, or case-insensitive partial matches that resolve uniquely.
    - If a partial matches multiple profiles, show the narrowed list and ask the user to pick.
    - Confirm final selections before editing profile XMLs: "You selected: [list]. Confirm? (Yes/No)"

Add these examples to the UI prompts and implement equivalent validation in any helper script.

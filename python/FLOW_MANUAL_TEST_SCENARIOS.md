# Flow Manual Test Scenarios

Paste these prompts into the Siid Code chat to manually test `generate_sf_flow` end-to-end (generation → dry-run → deploy).

---

## Record-Triggered Flow

```
When a Case is created with Status = New, create a Task due in 3 days assigned to the case owner.
```

## Scheduled Flow

```
Run daily at 8 AM. Find all Opportunity records where the CreatedDate is more than 90 days ago AND StageName does not equal "Closed Won" AND StageName does not equal "Closed Lost", then set StageName to "Closed Lost".
```

## Screen Flow with HTTP Callout

> **How Flows make HTTP calls:** Flows cannot make HTTP callouts directly — the Flow runtime has no access to `HttpRequest`/`Http` classes. Use a **registered External Service** (OpenAPI/RAML endpoint) called via `<actionCalls>` with `actionType: "externalService"`. The generator already emits this correctly (`prompt_to_graph.py` line 804: `HTTP CALLOUT (actionType: "externalService")`). Do **not** route through Invocable Apex — that was an agent error in a prior run; the External Service approach produces a single self-contained flow with no paired `.cls` files.
>
> The `<processMetadataValues><name>CanvasMode</name><value><stringValue>AUTO_LAYOUT_CANVAS</stringValue></value></processMetadataValues>` block is standard default metadata — not a bug.

```
Create a screen flow that performs an HTTP callout named GetRandomQuote.Get Random Quote and displays the response in a screen called Random User Details with showFooter and allowBack. The flow transaction model is CurrentTransaction.
```

## Screen Flow with HTTP Callout (External Service — REST endpoint)

```
Create a screen flow named GetWeather that calls an external service named WeatherAPI.GetCurrentWeather, stores the response, and displays the temperature and conditions on a screen called WeatherResult with showFooter. The flow transaction model is CurrentTransaction.
```

## Screen Flow with HTTP Callout + Save to Record

```
Create a screen flow that calls an HTTP external service named SalesforceAnalytics.TrackEvent, captures the response, then creates a custom object record named Analytics_Event__c with a field Event_Response__c set to the callout result, and shows a confirmation screen. The flow transaction model is CurrentTransaction.
```

## Screen Flow with HTTP Callout + Loop Through Response Array

```
Create a screen flow that calls an HTTP external service named GitHubAPI.GetRepos, loops through the returned array of repositories, and creates a custom object record named GitHubRepo__c for each one with fields Name__c and Url__c. Show a summary screen with the count of repos created. The flow transaction model is CurrentTransaction.
```

## Screen Flow with HTTP Callout + Decision on Response

```
Create a screen flow that calls an HTTP external service named PaymentGateway.ProcessPayment, checks the response status field: if status equals "approved" navigate to a Receipt screen, otherwise navigate to a Failure screen with the error message displayed. The flow transaction model is CurrentTransaction.
```

## Screen Flow with HTTP Callout + Wait for Callback

```
Create a screen flow that initiates an asynchronous HTTP callout named BulkApi.StartJob, stores the jobId, waits for the job to complete by polling an external service named BulkApi.GetJobStatus with the stored jobId, then displays a screen showing the final status. The flow transaction model is CurrentTransaction.
```

## Screen Flow with Dynamic Choice Set

```
Create a screen flow for an Employee Leave Request. Add a dynamic choice set called LeaveTypeChoices pulling from Leave_Type__c on Leave_Request__c. Include 2 screens and a CreateRecords node to create the leave request.
```

## Decision + Email Alert

```
When an Account is created, send an email alert named Account.Account_Creation_Alert to the account owner.
```

## Before-Save Field Update (Formula)

```
Before an Opportunity is saved, if StageName is Closed Won, set the CloseDate to today using a formula.
```

## Loop + Update Records

```
Every day, find all Contacts with no Email set and add "Missing" to their LastName so they're easy to filter in reports.
```

---

## Regression Tests for Fixed Bugs

### Bug #1 — Double-nested `<elementReference>` in assignment `<value>`

**Verifies:** `graph_to_flow_xml.py` `_sanitize_value` no longer wraps `{"elementReference": "+0D"}` into `{"elementReference": {"elementReference": "Today_Plus_0_Days"}}`.

**Expected XML shape (single leaf, no nesting):**

```xml
<value>
  <elementReference>Today_Plus_0_Days</elementReference>
</value>
```

```
Before an Opportunity is saved, if StageName is Closed Won, set the CloseDate to today using a formula.
```

```
Before an Opportunity is saved, if StageName is Closed Won, set the CloseDate to 7 days from today.
```

```
Before an Opportunity is saved, if StageName is Closed Won, set the CloseDate to 3 days ago.
```

### Bug #2 — Missing Start node in screen-flow graphs

**Verifies:** `prompt_to_graph.py` `_ensure_start_node()` injects a `Start` node when the LLM omits one.

**Expected:** Graph has exactly one `Start` node; XML has one `<start>` element with one outgoing connector.

```
Create a screen flow for an Employee Leave Request with 2 screens and a CreateRecords node to create the leave request.
```

```
Create a guided flow that lets a user search for an Account by name and display the matching Account's details on a second screen.
```

### Bug #3 — `Update_Records` references wrong variable name

**Verifies:** `prompt_to_graph.py` `_validate_input_references()` strips `input_reference` values that point to non-existent nodes/variables.

**Expected:** `inputReference` matches a node `id` or a declared variable `name` — never a Loop node name.

```
Every day, find all Contacts with no Email set and add "Missing" to their LastName so they're easy to filter in reports.
```

```
Every day, find all Opportunities where StageName is "Open" and close each one by setting StageName to "Closed Won".
```

---

## New Edge Cases

### Nested Loop + Decision inside Loop

```
Get all Accounts, loop through each Account, for each Account get all Contacts, if the Contact has no Email set, create a Task assigned to the Account owner with Subject "Contact missing email".
```

### Before-Save with ISCHANGED filter

```
Before a Case is saved, if the Priority field is changed to High, set the SLA_Start__c field to now.
```

### Complex filter logic (positional AND/OR)

```
When a Lead is created or its Status field changes to New, AND the Owner is a User, AND the Industry is not null, create a Follow-up Task assigned to the owner with Subject "New Lead" due in 1 day.
```

### Scheduled flow with relative date in filter

```
Run daily at 9 AM. Find all Opportunity records where the CloseDate is more than 30 days in the future AND the StageName is not "Closed Won", then send an email alert named Opportunity.Coming_Up_Due to the Opportunity owner.
```

### Screen flow with formula display field

```
Create a screen flow that displays a list of open Opportunities. Each row shows the Opportunity Name and a formula field computing the number of days since the Opportunity was created.
```

### Create Records with loop-item references

```
When an Account is created, get all open Opportunities for that Account, loop through each Opportunity, and create a Case for each Opportunity with Subject "Follow-up required" and Status "New".
```

### Multi-condition Decision with OR logic

```
When an Opportunity's StageName changes, if the StageName is now "Closed Won" or "Closed Lost", create a Task assigned to the Opportunity owner with Subject "Opportunity closed" due today.
```

### Flow with custom error messages

```
Before an Opportunity is saved, if the Amount is less than 0, show a custom error message "Opportunity Amount cannot be negative" and stop the save.
```

### Subflow with input/output assignments

```
Create a screen flow that collects user input for a new Contact, then calls a subflow named "Create_Contact" passing the collected fields as inputs, and displays a confirmation screen with the created Contact's Id.
```

---

### What to check per run

- [ ] Generation succeeds (no JSON parse error from prompt_to_graph.py)
- [ ] Dry-run validation passes (Active status catches formula/field errors up front)
- [ ] Deploy succeeds
- [ ] Flow logic matches the prompt (open the XML or the flow in Setup)

### XML sanity checks (grep the generated `.flow-meta.xml`)

- [ ] `<elementReference>` contains plain text, never a child `<elementReference>` (Bug #1)
- [ ] Exactly one `<start>` node with one outgoing `<connector>` (Bug #2)
- [ ] `<inputReference>` on `<recordUpdates>`/`<recordDeletes>` matches a node `id` or variable `name` (Bug #3)
- [ ] `<status>Active</status>` for scheduled flows (auto-promoted by the emitter)
- [ ] No `<formulas>` with a relative-date expression inside — relative dates use `<elementReference>` to a formula resource

### Bug #4 — `<formulas>` emitted before `<environments>` (SF schema ordering)

**Verifies:** `build_flow_tree` now emits `<environments>` before `<formulas>`. Salesforce rejects flows where `<formulas>` precedes `<environments>` with "field integrity exception: formula expression is invalid: Syntax error".

**Expected XML element order (after `<description>`):**

```xml
<description>...</description>
<environments>Default</environments>
<formulas>
  <name>Today_Plus_0_Days</name>
  <dataType>Date</dataType>
  <expression>TODAY()</expression>
</formulas>
<interviewLabel>...</interviewLabel>
```

```
When an Opportunity's StageName changes to Closed Won or Closed Lost, create a Task assigned to the Opportunity owner with Subject "Opportunity closed" due today.
```

```
Run daily at 8 AM. Find all Leads with Status = New and CreatedDate more than 30 days ago, set Status to Closed.
```

```
Before an Opportunity is saved, if StageName is Closed Won, set the CloseDate to 7 days from today.
```

---

### Bug #5 — `IsNotNull` not valid in `<recordLookups><filters>` (FlowRecordFilterOperator)

**Verifies:** `append_filters` rewrites `IsNotNull` → `IsNull` with `booleanValue: false`. SF only accepts `IsNull` (not `IsNotNull`) as a filter operator in `recordLookups` and `recordUpdates`.

**Expected XML (no `IsNotNull`):**

```xml
<filters>
  <field>Email</field>
  <operator>IsNull</operator>
  <value><booleanValue>false</booleanValue></value>
</filters>
```

```
Every day, find all Contacts where Email is not null and LastActivityDate is more than 60 days ago, then create a Task with Subject "Re-engage contact".
```

```
When an Account is updated, get all related Contacts where Phone is not null, loop through each and set DoNotCall to false.
```

```
Run daily. Find all Opportunities where CloseDate is not null and StageName is not Closed Won, send an email alert named Opportunity.Closing_Soon to the owner.
```

---

### Bug #6 — `CustomError` node for before-save validation (was using invalid `displayError`/`addError` action type)

**Verifies:** `generate_sf_flow` emits a `<customErrors>` element (not an `<actionCalls>` with `displayError`). SF rejects `displayError` and `addError` as `InvocableActionType` values.

**Expected XML shape:**

```xml
<customErrors>
  <name>Err_Amount_Negative</name>
  <label>Amount Cannot Be Negative</label>
  <customErrorMessages>
    <errorMessage>Opportunity Amount cannot be negative</errorMessage>
    <isFieldError>true</isFieldError>
    <fieldSelection>Amount</fieldSelection>
  </customErrorMessages>
</customErrors>
```

```
Before an Opportunity is saved, if the Amount is less than 0, show a custom error message "Opportunity Amount cannot be negative" and stop the save.
```

```
Before a Case is saved, if Priority is Critical but Status is Closed, show a page-level error "Cannot set Priority to Critical on a closed Case" and prevent the save.
```

```
Before an Opportunity is saved, if CloseDate is in the past and StageName is not Closed Won and not Closed Lost, show a field error on CloseDate "Close date cannot be in the past for open opportunities".
```

---

### Bug #7 — JSON-like `{"elementReference": ...}` leaks into formula `<expression>`

**Verifies:** `build_formulas_elements` unwraps dict-valued explicit formula
expressions by resolving the `elementReference` to its real formula text from
`auto_formulas`. Salesforce rejects `expression` values that are not plain
formula strings — the LLM emits `{"elementReference": "Today_Plus_3_Days"}`
inside an explicit formula's `expression` field, which serializes as
`{'elementReference': 'Today_Plus_3_Days'}` in the XML.

**Expected:** the `Due_Date_3_Days` formula's `<expression>` contains
`TODAY() + 3` (a plain string), not a dict-like elementReference.

```
When a Case is created with Status = New, create a Task due in 3 days assigned
to the case owner.
```

### XML sanity checks for new bugs

- [ ] No `<actionCalls>` with `actionType` = `displayError` or `addError` (Bug #6)
- [ ] `<customErrors>` element present for before-save validation flows (Bug #6)
- [ ] `<environments>Default</environments>` appears BEFORE any `<formulas>` block (Bug #4)
- [ ] No `<operator>IsNotNull</operator>` inside `<filters>` — must be `IsNull` + `booleanValue false` (Bug #5)
- [ ] No `<operator>IsChanged</operator>` inside `<recordLookups><filters>` — only valid in `<start><filters>`
- [ ] `<expression>` contains a plain formula string, never a dict-like `elementReference` (Bug #7)

# Agentforce Apex Invocable Actions Guide

Quick reference for creating Apex invocable actions for Agentforce agents.

---

## Basic Structure

Every invocable action follows this pattern:

```apex
/**
 * AgentforceAccountAction
 * Description: What this action does
 * Example: Agent asks for account details → calls this action
 */
public with sharing class AgentforceAccountAction {

    @InvocableMethod(label='Get Account Details', description='Retrieves account information')
    public static List<GetAccountResponse> getAccount(List<GetAccountRequest> requests) {
        List<GetAccountResponse> responses = new List<GetAccountResponse>();

        for (GetAccountRequest req : requests) {
            try {
                // Validate input
                if (String.isBlank(req.accountName)) {
                    GetAccountResponse res = new GetAccountResponse();
                    res.success = false;
                    res.message = 'Account name is required';
                    responses.add(res);
                    continue;
                }

                // Query with security enforcement
                List<Account> accounts = [
                    SELECT Id, Name, Industry, Rating, AnnualRevenue
                    FROM Account
                    WHERE Name = :req.accountName
                    WITH USER_MODE
                    LIMIT 1
                ];

                GetAccountResponse res = new GetAccountResponse();
                if (!accounts.isEmpty()) {
                    Account acc = accounts[0];
                    res.accountId = acc.Id;
                    res.name = acc.Name;
                    res.industry = acc.Industry;
                    res.rating = acc.Rating;
                    res.revenue = acc.AnnualRevenue;
                    res.success = true;
                } else {
                    res.success = false;
                    res.message = 'Account not found';
                }
                responses.add(res);

            } catch (Exception e) {
                GetAccountResponse res = new GetAccountResponse();
                res.success = false;
                res.message = 'Error: ' + e.getMessage();
                responses.add(res);
            }
        }
        return responses;
    }

    public class GetAccountRequest {
        @InvocableVariable(required=true, label='Account Name', description='The name of the account to retrieve')
        public String accountName;
    }

    public class GetAccountResponse {
        @InvocableVariable(required=false, label='Account ID', description='Unique identifier of the account')
        public String accountId;

        @InvocableVariable(required=false, label='Account Name', description='Name of the account')
        public String name;

        @InvocableVariable(required=false, label='Industry', description='Industry classification of the account')
        public String industry;

        @InvocableVariable(required=false, label='Rating', description='Account rating (Hot, Warm, Cold)')
        public String rating;

        @InvocableVariable(required=false, label='Annual Revenue', description='Annual revenue amount')
        public Decimal revenue;

        @InvocableVariable(required=false, label='Success', description='Whether the action succeeded')
        public Boolean success;

        @InvocableVariable(required=false, label='Error Message', description='Error message if action failed')
        public String message;
    }
}
```

## Key Requirements

- ✅ Class must be `public with sharing`
- ✅ Method must be `public static`
- ✅ Input parameter must be `List<RequestClass>`
- ✅ Return type must be `List<ResponseClass>`
- ✅ Must have `@InvocableMethod` decorator
- ✅ **Request class MUST have at least ONE input variable with `@InvocableVariable`**
- ✅ **Response class MUST have at least ONE output variable with `@InvocableVariable`**
- ✅ Use `WITH USER_MODE` in SOQL queries
- ✅ Validate all inputs
- ✅ Handle exceptions in try-catch
- ✅ **Create both Apex class AND corresponding XML metadata file**
- ✅ **InvocableVariable must include 3 parameters: `required`, `label`, `description`**

---

## Annotation Syntax (CRITICAL)

### @InvocableMethod Syntax

**ALWAYS use commas to separate parameters:**

```apex
// ✅ CORRECT - Parameters separated by commas
@InvocableMethod(label='Get Account Details', description='Retrieves account information')
public static List<GetAccountResponse> getAccount(List<GetAccountRequest> requests) {
```

```apex
// ❌ WRONG - Missing commas
@InvocableMethod(label='Get Account Details' description='Retrieves account information')
```

### @InvocableVariable Syntax

**ALWAYS use commas to separate parameters:**

```apex
// ✅ CORRECT - All parameters separated by commas
@InvocableVariable(required=true, label='Account Name', description='The name of the account to retrieve')
public String accountName;
```

```apex
// ❌ WRONG - Missing commas
@InvocableVariable(required=true label='Account Name' description='The name of the account to retrieve')
public String accountName;
```

**Format Rule:** `parameter=value, parameter=value, parameter=value` (comma + space between each parameter)

---

## File Creation Locations and XML Metadata

### Apex Class Location

```
force-app/main/default/classes/AgentforceAccountAction.cls
```

### XML Metadata File Location (REQUIRED)

```
force-app/main/default/classes/AgentforceAccountAction.cls-meta.xml
```

### XML Metadata File Content Template

Create the corresponding `.cls-meta.xml` file for every Apex class:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>60.0</apiVersion>
    <status>Active</status>
</ApexClass>
```

**Important**: Both the `.cls` (Apex class) and `.cls-meta.xml` (metadata) files must be created together. The metadata file tells Salesforce about the class configuration.

---

## InvocableVariable Parameters (Required for All Variables)

Every `@InvocableVariable` annotation **MUST** include these 3 parameters **separated by commas**:

| Parameter     | Type    | Required | Example                                           | Purpose                                                  |
| ------------- | ------- | -------- | ------------------------------------------------- | -------------------------------------------------------- |
| `required`    | Boolean | ✅ Yes   | `required=true`                                   | Marks if input is mandatory or output is always provided |
| `label`       | String  | ✅ Yes   | `label='Account Name'`                            | Display name shown in Agentforce UI and flows            |
| `description` | String  | ✅ Yes   | `description='The name of the account to search'` | Explains what the variable is used for                   |

### Correct Format (Note the commas)

```apex
// ✅ Parameters separated by commas: required=true, label='...', description='...'
@InvocableVariable(required=true, label='Search Term', description='The text to search for in account names')
public String searchTerm;
```

### Incorrect Format (Missing Parameters)

```apex
@InvocableVariable  // ❌ WRONG - no parameters
public String searchTerm;

@InvocableVariable(required=true)  // ❌ WRONG - missing label and description
public String searchTerm;
```

---

## (**!! IMPORTANT**) Dry Run and Deployment Workflow

After creation of all required Apex classes, execute the following steps:

### Step 1: Dry Run - Validate Apex Classes

Test your changes without applying them to the org:

```bash
# Dry run for a single Apex class
sf project deploy start --dry-run --source-dir force-app/main/default/classes/AgentforceAccountAction.cls
```

**Replace `AgentforceAccountAction.cls` with your actual class name(s)**

**What happens in dry run:**

- ✅ Validates syntax
- ✅ Runs all unit tests
- ✅ Checks code coverage (must be 75%+)
- ✅ Verifies security settings
- ✅ **Does NOT make any changes to the org**

**Expected output:**

```
Deploy ID: 0Afxx0000000000
Status: Done
Tests: 5 passed, 0 failed
Code Coverage: 87%
```

### Step 2: Fix Issues (If Needed)

If dry run fails:

1. Review error messages carefully
2. Fix the Apex code or tests
3. Repeat dry run until it passes completely

### Step 3: Deploy - Apply Changes

Once dry run succeeds, immediately proceed with actual deployment:

```bash
# Deploy a single Apex class
sf project deploy start --source-dir force-app/main/default/classes/AgentforceAccountAction.cls
```

### Deploying Multiple Apex Classes

When deploying multiple Apex classes, use this format:

```bash
# Deploy multiple specific Apex classes (replace with actual class names)
sf project deploy start --source-dir force-app/main/default/classes/AgentforceAccountAction.cls force-app/main/default/classes/AgentforceContactAction.cls force-app/main/default/classes/AgentforceOpportunityAction.cls
```

**Or deploy all classes at once:**

```bash
# Deploy all Apex classes in the classes directory
sf project deploy start --source-dir force-app/main/default/classes
```

**Order of deployment (if multiple classes have dependencies):**

1. Deploy base utility/helper classes first
2. Deploy main Apex invocable action classes
3. Deploy any dependent classes

### Step 4: Verify Deployment

After successful deployment:

```bash
# Check deployment status
sf project deploy report --job-id <deploy-id>
```

**Replace `<deploy-id>` with the deployment ID from the deploy command output**

**Post-deployment verification:**

1. ✅ Verify action appears in Agentforce UI
2. ✅ Test the action in flow builder
3. ✅ Confirm invocable method is callable
4. ✅ Check all input/output variables are exposed correctly
5. ✅ Document any known issues or limitations

---

## Naming Conventions

| Type          | Format                     | Example                           |
| ------------- | -------------------------- | --------------------------------- |
| **Classes**   | `Agentforce<Noun><Action>` | `AgentforceAccountAction`         |
| **Methods**   | `camelCase` with verb      | `getAccount()`, `createContact()` |
| **Requests**  | `<Action>Request`          | `GetAccountRequest`               |
| **Responses** | `<Action>Response`         | `GetAccountResponse`              |
| **Strings**   | `str` prefix               | `strAccountName`                  |
| **Lists**     | `list` prefix              | `listAccounts`                    |
| **Booleans**  | `is/has/should`            | `isSuccess`, `hasError`           |

---

## Common Patterns

### 1. Query/Retrieve Records

Use Pattern 1 from basic structure above (GetAccount example)

### 2. Create Records

```apex
@InvocableMethod(label='Create Contact')
public static List<CreateContactResponse> createContact(List<CreateContactRequest> requests) {
    List<CreateContactResponse> responses = new List<CreateContactResponse>();
    List<Contact> contactsToInsert = new List<Contact>();

    for (CreateContactRequest req : requests) {
        try {
            if (String.isBlank(req.firstName) || String.isBlank(req.lastName)) {
                CreateContactResponse res = new CreateContactResponse();
                res.success = false;
                res.message = 'First and last names required';
                responses.add(res);
                continue;
            }

            Contact contact = new Contact(
                FirstName = req.firstName,
                LastName = req.lastName,
                Email = req.email
            );
            contactsToInsert.add(contact);

        } catch (Exception e) {
            CreateContactResponse res = new CreateContactResponse();
            res.success = false;
            res.message = 'Error: ' + e.getMessage();
            responses.add(res);
        }
    }

    if (!contactsToInsert.isEmpty()) {
        try {
            insert contactsToInsert;
            for (Contact c : contactsToInsert) {
                CreateContactResponse res = new CreateContactResponse();
                res.success = true;
                res.contactId = c.Id;
                responses.add(res);
            }
        } catch (DmlException e) {
            CreateContactResponse res = new CreateContactResponse();
            res.success = false;
            res.message = 'Database error: ' + e.getMessage();
            responses.add(res);
        }
    }
    return responses;
}
```

### 3. Calculate/Transform Data

```apex
@InvocableMethod(label='Calculate Metrics')
public static List<MetricsResponse> calculateMetrics(List<MetricsRequest> requests) {
    List<MetricsResponse> responses = new List<MetricsResponse>();

    for (MetricsRequest req : requests) {
        try {
            String size = req.amount < 50000 ? 'Small' :
                         req.amount < 250000 ? 'Medium' : 'Large';

            MetricsResponse res = new MetricsResponse();
            res.opportunitySize = size;
            res.success = true;
            responses.add(res);
        } catch (Exception e) {
            MetricsResponse res = new MetricsResponse();
            res.success = false;
            res.message = 'Error: ' + e.getMessage();
            responses.add(res);
        }
    }
    return responses;
}
```

### 4. Search Records

```apex
@InvocableMethod(label='Search Accounts')
public static List<SearchResponse> searchAccounts(List<SearchRequest> requests) {
    List<SearchResponse> responses = new List<SearchResponse>();

    for (SearchRequest req : requests) {
        try {
            String pattern = '%' + req.searchTerm + '%';
            List<Account> accounts = [
                SELECT Id, Name, Industry
                FROM Account
                WHERE Name LIKE :pattern
                WITH USER_MODE
                LIMIT 10
            ];

            SearchResponse res = new SearchResponse();
            res.resultCount = accounts.size();
            res.success = true;
            responses.add(res);
        } catch (Exception e) {
            SearchResponse res = new SearchResponse();
            res.success = false;
            res.message = 'Search error: ' + e.getMessage();
            responses.add(res);
        }
    }
    return responses;
}
```

---

## Security Requirements (MANDATORY)

```apex
// ✅ DO: Use with sharing
public with sharing class AgentforceAction { }

// ✅ DO: Use WITH USER_MODE in SOQL
List<Account> accounts = [
    SELECT Id, Name FROM Account WITH USER_MODE LIMIT 10
];

// ✅ DO: Validate inputs
if (String.isBlank(req.input)) { return error; }

// ❌ DON'T: Use without sharing
public without sharing class AgentforceAction { }

// ❌ DON'T: Query without WITH USER_MODE
List<Account> accounts = [SELECT Id, Name FROM Account];
```

---

## Error Handling

Always catch exceptions and return error status:

```apex
try {
    // Your logic
    Response res = new Response();
    res.success = true;
    responses.add(res);
} catch (QueryException e) {
    Response res = new Response();
    res.success = false;
    res.message = 'Query error: ' + e.getMessage();
    responses.add(res);
} catch (DmlException e) {
    Response res = new Response();
    res.success = false;
    res.message = 'Database error: ' + e.getMessage();
    responses.add(res);
} catch (Exception e) {
    Response res = new Response();
    res.success = false;
    res.message = 'Error: ' + e.getMessage();
    responses.add(res);
}
```

---

## Response Classes Must Include

```apex
public class ActionResponse {
    @InvocableVariable public Boolean success;  // true/false
    @InvocableVariable public String message;   // Error message if failed
    @InvocableVariable public String resultId;  // Result data if needed
}
```

---

## Testing Example

```apex
@isTest
public class AgentforceAccountAction_Test {

    @isTest
    static void testGetAccountSuccess() {
        Account acc = new Account(Name = 'Test', Industry = 'Tech');
        insert acc;

        AgentforceAccountAction.GetAccountRequest req = new AgentforceAccountAction.GetAccountRequest();
        req.accountName = 'Test';

        List<AgentforceAccountAction.GetAccountResponse> responses =
            AgentforceAccountAction.getAccount(new List<AgentforceAccountAction.GetAccountRequest>{req});

        System.assertEquals(1, responses.size());
        System.assertEquals(true, responses[0].success);
    }

    @isTest
    static void testGetAccountNotFound() {
        AgentforceAccountAction.GetAccountRequest req = new AgentforceAccountAction.GetAccountRequest();
        req.accountName = 'NonExistent';

        List<AgentforceAccountAction.GetAccountResponse> responses =
            AgentforceAccountAction.getAccount(new List<AgentforceAccountAction.GetAccountRequest>{req});

        System.assertEquals(false, responses[0].success);
    }
}
```

---

## Deployment Checklist

Before deploying:

- [ ] ✅ Uses `public with sharing`
- [ ] ✅ Uses `WITH USER_MODE` in SOQL
- [ ] ✅ Has error handling (try-catch)
- [ ] ✅ Validates all inputs
- [ ] ✅ Response class has success/message fields
- [ ] ✅ Has JSDoc comments
- [ ] ✅ 75%+ test coverage
- [ ] ✅ Tests pass locally
- [ ] ✅ No hardcoded values
- [ ] ✅ Naming conventions followed

---

## Quick Reference

**Always use Lists**: Input/output are always Lists, even for single items

**Always handle errors**: Return false/error message in response

**Always validate input**: Check for null/empty before processing

**Always use WITH USER_MODE**: Enforces FLS and sharing

**Always test**: Minimum 75% code coverage required

---

## Resources

- [Invocable Methods Documentation](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_classes_annotation_InvocableMethod.htm)
- [Agentforce Guide](https://developer.salesforce.com/docs/einstein/agentforce)
- [SOQL Reference](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/)
- [Apex Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/)

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
        @InvocableVariable(required=true, label='Account Name')
        public String accountName;
    }

    public class GetAccountResponse {
        @InvocableVariable public String accountId;
        @InvocableVariable public String name;
        @InvocableVariable public String industry;
        @InvocableVariable public String rating;
        @InvocableVariable public Decimal revenue;
        @InvocableVariable public Boolean success;
        @InvocableVariable public String message;
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

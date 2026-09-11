# Invocable Apex Guide

Apex exposed to **callers outside Apex** via `@InvocableMethod`. One class serves every caller: Flow, Agentforce, MCP, REST, and Apex tests.

**Scope of this guide:** the invocable contract itself — annotations, wrapper classes, bulkification, security, error handling. Caller-specific packaging is separate:

| Caller         | Extra work beyond this guide                                    | Where                             |
| -------------- | --------------------------------------------------------------- | --------------------------------- |
| **Flow**       | None. Deploy the class and it appears in the Flow action list.  | —                                 |
| **Agentforce** | Topic/action XML, `input`/`output` schema.json, Einstein perms. | `agentforce-topics-actions-guide` |
| **MCP**        | Tool definition mapping to the invocable.                       | `create-mcp-server`               |
| **REST**       | Nothing — but prefer `@RestResource` for pure REST.             | `apex-guide`                      |

---

## Structure: One Action Class Per Method, Logic in a Service

**The action class is an adapter, not a home for business logic.** It translates the caller's request wrappers into a service call and translates the result back. The service holds the actual work.

```
force-app/main/default/classes/
  AccountService.cls              <-- business logic, reusable
  AccountLookupAction.cls         <-- @InvocableMethod: find account
  AccountCreateAction.cls         <-- @InvocableMethod: create account
```

Three reasons this is not optional ceremony:

1. **The platform allows one `@InvocableMethod` per class.** Two actions means two classes regardless — so the only question is whether they duplicate logic or share a service.
2. **Logic in the action class is only reachable through the invocable contract.** A trigger, a batch job, or an LWC controller cannot call it without faking `List<Request>` wrappers.
3. **Testing the service needs no wrappers.** Wrapper-shaped tests are where the size-and-order bug hides.

### The service

Plain Apex. No annotations, no wrappers, no knowledge that Agentforce or Flow exists.

```apex
public with sharing class AccountService {

    /**
     * Finds accounts by exact name.
     * @return map of name -> Account, only for names that matched
     */
    public static Map<String, Account> findByNames(Set<String> names) {
        Map<String, Account> byName = new Map<String, Account>();

        if (names == null || names.isEmpty()) {
            return byName;
        }

        for (Account acc : [SELECT Id, Name FROM Account WHERE Name IN :names WITH USER_MODE]) {
            byName.put(acc.Name, acc);
        }

        return byName;
    }
}
```

Note the shape: it takes a `Set` and returns a `Map`. **The service is free to use types the invocable contract forbids** (`Map`, `Set`, `Enum`) because only Apex calls it. Only the action class is constrained.

### The action class

```apex
/**
 * Invocable adapter for AccountService.findByNames.
 * Callers: Flow, Agentforce (Find_Account), MCP.
 */
public with sharing class AccountLookupAction {

    public class Request {
        @InvocableVariable(required=true label='Account Name' description='Name of the account to find')
        public String accountName;
    }

    public class Response {
        @InvocableVariable(label='Account Id' description='Id of the matched account')
        public String accountId;

        @InvocableVariable(label='Success' description='Whether the lookup succeeded')
        public Boolean success;

        @InvocableVariable(label='Message' description='Error detail when success is false')
        public String message;
    }

    @InvocableMethod(label='Find Account' description='Finds an account by exact name')
    public static List<Response> run(List<Request> requests) {
        // 1. Unwrap: gather inputs for a single bulk service call.
        Set<String> names = new Set<String>();
        for (Request req : requests) {
            if (String.isNotBlank(req.accountName)) {
                names.add(req.accountName);
            }
        }

        // 2. Delegate: one call, outside the loop.
        Map<String, Account> byName = AccountService.findByNames(names);

        // 3. Rewrap: exactly one response per request, same order.
        List<Response> responses = new List<Response>();
        for (Request req : requests) {
            Response res = new Response();

            if (String.isBlank(req.accountName)) {
                res.success = false;
                res.message = 'Account name is required';
            } else if (byName.containsKey(req.accountName)) {
                res.accountId = byName.get(req.accountName).Id;
                res.success = true;
            } else {
                res.success = false;
                res.message = 'No account named ' + req.accountName;
            }

            responses.add(res);
        }

        return responses;
    }
}
```

**Unwrap → delegate → rewrap.** Every action class is these three steps. If an action class contains SOQL, DML, or branching business rules, that belongs in the service.

The delegate step sits _between_ the loops, never inside one — which is what makes bulkification automatic rather than a thing to remember.

### Where the service already exists

Check before writing one. If `AccountService` is already in the org, the action class is the only new file — that is the point of the split.

---

## Hard Rules

These are enforced by the platform. Break one and the class fails to compile, or the action never appears to the caller.

1. **One `@InvocableMethod` per class.** A second one is a compile error. Need two actions? Two classes.
2. **The method must be `public static` or `global static`.**
3. **It must take exactly one parameter, and that parameter must be a `List`.** Not a single object, not two arguments.
4. **It must return a `List`, or `void`.**
5. **The output list must be the same size and order as the input list**, when returning one. Callers match by index. Returning a single-element list for a 200-element input silently misaligns every result.
6. **Wrapper classes must be `public` (or `global`) with `public` fields.** A private field is invisible to the caller.
7. **Wrapper classes must have an implicit or explicit no-arg constructor.** Defining only a parameterised constructor breaks deserialization.
8. **Wrapper classes should be top-level or inner `public class`** — inner classes are referenced as `Outer.Inner`.

### The size-and-order rule in practice

```apex
// ❌ WRONG - returns one result regardless of input size
@InvocableMethod
public static List<Response> run(List<Request> requests) {
    Response res = new Response();
    res.success = true;
    return new List<Response>{ res };   // Flow gets one result for 200 inputs
}

// ✅ CORRECT - one response per request, same order
@InvocableMethod
public static List<Response> run(List<Request> requests) {
    List<Response> responses = new List<Response>();
    for (Request req : requests) {
        responses.add(process(req));    // even failures append a response
    }
    return responses;
}
```

An early `continue` that skips `responses.add(...)` breaks the rule just as badly as returning a single element. **Every path through the loop must append exactly one response.**

---

## Annotation Syntax

### `@InvocableMethod`

```apex
@InvocableMethod(
    label='Find Account'
    description='Finds an account by exact name'
    category='Account Actions'
    callout=true
    configurationEditor='c-my-editor'
)
```

| Parameter             | Required | Notes                                                            |
| --------------------- | -------- | ---------------------------------------------------------------- |
| `label`               | Yes      | Shown in the Flow/Agentforce action picker.                      |
| `description`         | Yes      | How the caller decides to use it. Agentforce plans against this. |
| `category`            | No       | Groups actions in the picker.                                    |
| `callout`             | No       | **Required `true` if the method makes an HTTP callout.**         |
| `configurationEditor` | No       | Custom LWC config screen for Flow.                               |

**No commas between parameters.** `label='X' description='Y'` — a comma is a compile error.

### `@InvocableVariable`

```apex
@InvocableVariable(required=true label='Account Name' description='Name of the account')
public String accountName;
```

| Parameter     | Notes                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| `label`       | Display name for the caller.                                              |
| `description` | What the value means. Agentforce uses this to decide what to pass.        |
| `required`    | Input only — ignored on output wrappers. Does **not** enforce at runtime. |

`required=true` controls the caller's UI, not execution. **Always validate in code anyway** — Agentforce and MCP can call with a blank value.

---

## Supported Types

Wrapper fields may be:

- Primitives: `String`, `Integer`, `Decimal`, `Double`, `Long`, `Boolean`, `Date`, `DateTime`, `Time`, `Id`, `Blob`
- `sObject` and specific types (`Account`, `Case`, …)
- `List<T>` of any of the above
- Another `@InvocableVariable`-annotated wrapper class, and `List<>` of it

Not supported: `Map`, `Set`, `Enum`, interfaces, and generics other than `List`. **Serialize a `Map` to a JSON `String`** if you must pass one, and document the shape in the `description`.

---

## Bulkification (MANDATORY)

The input is a `List` because callers batch. Flow sends every record in a batch; Agentforce usually sends one, but a loop still executes per-request.

**A SOQL query or DML statement inside the request loop is the single most common defect in invocable code.** 200 requests × 1 query = limit exception.

```apex
// ❌ WRONG - service called per request, so a query per request
for (Request req : requests) {
    Account acc = AccountService.findByName(req.accountName);
}

// ✅ CORRECT - unwrap, one bulk service call, rewrap
Set<String> names = new Set<String>();
for (Request req : requests) {
    names.add(req.accountName);
}

Map<String, Account> byName = AccountService.findByNames(names);   // once

for (Request req : requests) {
    Account acc = byName.get(req.accountName);                     // no query in the loop
}
```

Same for DML — accumulate into a list and let the service do one insert.

**This is why service methods take collections.** A service exposing `findByName(String)` invites the broken version; one exposing `findByNames(Set<String>)` makes the correct shape the easy one. Design service signatures around the bulk case, and add a single-record convenience overload only if non-invocable callers need it.

---

## Security (MANDATORY)

```apex
public with sharing class MyAction {          // 1. sharing declared

    @InvocableMethod(label='...' description='...')
    public static List<Response> run(List<Request> requests) {

        // 2. USER_MODE on every query
        List<Account> accounts = [SELECT Id, Name FROM Account WHERE Id IN :ids WITH USER_MODE];

        // 3. USER_MODE on every DML
        insert as user newRecords;
    }
}
```

1. **`with sharing`** unless there is a documented reason otherwise.
2. **`WITH USER_MODE`** on every SOQL — enforces CRUD, FLS, and sharing in one clause.
3. **`as user`** on every DML (`insert as user`, `update as user`).

Invocable actions are frequently called by low-privilege or automated users — an Agentforce action runs as the **Einstein Agent User**, not the person chatting. Never rely on the caller having the caller's own permissions.

For dynamic SOQL, bind with `:variable` and escape any user-supplied string with `String.escapeSingleQuotes()`.

---

## Error Handling

**Never let an exception escape the invocable method.** An uncaught exception fails the whole Flow interview or leaves the agent with no usable result. Return the failure in the response instead.

```apex
for (Request req : requests) {
    Response res = new Response();

    try {
        if (String.isBlank(req.accountName)) {
            throw new IllegalArgumentException('Account name is required');
        }

        res.accountId = doWork(req);
        res.success = true;

    } catch (Exception e) {
        res.success = false;
        res.message = e.getMessage();   // still appended - preserves size and order
    }

    responses.add(res);
}
```

Every response class should carry:

- `success` (`Boolean`) — did this one item work
- `message` (`String`) — why not, when it didn't

The caller has no other channel to learn what went wrong.

---

## Callouts

If the method makes an HTTP callout, `callout=true` is mandatory:

```apex
@InvocableMethod(label='Send to API' description='Posts the record to the partner API' callout=true)
```

Without it the call fails at runtime with an uncommitted-work error when invoked from a Flow that has already done DML.

Callouts also mean the method cannot be called from a trigger context that has pending DML — offload to Queueable if that applies.

---

## File Layout

```
force-app/main/default/classes/
  AccountService.cls                   <-- shared logic
  AccountService.cls-meta.xml
  AccountServiceTest.cls
  AccountServiceTest.cls-meta.xml

  AccountLookupAction.cls              <-- one invocable method
  AccountLookupAction.cls-meta.xml     <-- REQUIRED
  AccountLookupActionTest.cls
  AccountLookupActionTest.cls-meta.xml

  AccountCreateAction.cls              <-- another invocable, same service
  AccountCreateAction.cls-meta.xml
  AccountCreateActionTest.cls
  AccountCreateActionTest.cls-meta.xml
```

**`.cls-meta.xml` template:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>61.0</apiVersion>
    <status>Active</status>
</ApexClass>
```

Deployment fails without the meta file.

---

## Naming

| Item          | Convention                     | Example                          |
| ------------- | ------------------------------ | -------------------------------- |
| Service       | `<Domain>Service`              | `AccountService`                 |
| Action class  | `<Domain><Verb>Action`         | `AccountLookupAction`            |
| Request class | `Request` or `<Verb>Request`   | `Request`, `LookupRequest`       |
| Response      | `Response` or `<Verb>Response` | `Response`, `LookupResponse`     |
| Method        | Verb                           | `run`, `execute`, `findAccounts` |
| Test class    | `<ClassName>Test`              | `AccountLookupActionTest`        |

The `Action` suffix marks the class as an invocable adapter — one method, no logic. A class named `AccountService` should never carry `@InvocableMethod`.

Field names are **camelCase** and become the caller-visible parameter names. For Agentforce they must match the schema.json property keys character-for-character.

---

## Testing

The split divides the testing burden:

| Test class                | Covers                                                         |
| ------------------------- | -------------------------------------------------------------- |
| `AccountServiceTest`      | Business rules, edge cases, security. Plain Apex, no wrappers. |
| `AccountLookupActionTest` | The **contract**: size, order, failure-still-appends, bulk.    |

Most cases belong in the service test, where they are cheap to write. The action test exists to catch the one thing the service cannot: a broken request/response mapping.

A test must cover the bulk path, or the size-and-order bug ships undetected.

```apex
@IsTest
private class AccountLookupActionTest {

    @IsTest
    static void returnsOneResponsePerRequest() {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < 200; i++) {
            accounts.add(new Account(Name = 'Acct ' + i));
        }
        insert accounts;

        List<AccountLookupAction.Request> requests = new List<AccountLookupAction.Request>();
        for (Integer i = 0; i < 200; i++) {
            AccountLookupAction.Request req = new AccountLookupAction.Request();
            req.accountName = 'Acct ' + i;
            requests.add(req);
        }

        Test.startTest();
        List<AccountLookupAction.Response> responses = AccountLookupAction.run(requests);
        Test.stopTest();

        // The contract: same size, same order.
        Assert.areEqual(200, responses.size(), 'One response per request');
        Assert.isTrue(responses[0].success, 'First request should succeed');
    }

    @IsTest
    static void reportsFailureWithoutThrowing() {
        AccountLookupAction.Request req = new AccountLookupAction.Request();
        req.accountName = null;

        List<AccountLookupAction.Response> responses =
            AccountLookupAction.run(new List<AccountLookupAction.Request>{ req });

        Assert.areEqual(1, responses.size(), 'Failures still return a response');
        Assert.isFalse(responses[0].success, 'Blank name should fail');
        Assert.isNotNull(responses[0].message, 'Failure needs a message');
    }
}
```

Minimum cases on the action test: **bulk (200)**, **invalid input**, **not-found**, **happy path**. Test the invocable method directly — that is the entry point every caller uses.

Deeper business-rule cases go in `AccountServiceTest`, calling the service directly with no wrappers involved.

---

## Checklist

Before deploying:

- [ ] Business logic is in a service class, not the action class
- [ ] Action class only unwraps, delegates, and rewraps
- [ ] Service methods take collections, not single records
- [ ] Exactly one `@InvocableMethod` in the class
- [ ] Method is `public static`, takes one `List`, returns a `List` or `void`
- [ ] Output list matches input size and order on **every** path, including failures
- [ ] Wrapper classes and their fields are `public`
- [ ] Every `@InvocableVariable` has `label` and `description`
- [ ] No comma between annotation parameters
- [ ] No SOQL or DML inside the request loop
- [ ] `with sharing`, `WITH USER_MODE`, `as user`
- [ ] Inputs validated in code, not just `required=true`
- [ ] No exception can escape the method
- [ ] `callout=true` if the method makes an HTTP callout
- [ ] `.cls-meta.xml` exists
- [ ] Test covers bulk, invalid input, and failure

Caller-specific steps (Agentforce schema files, Einstein Agent User permissions, MCP tool definitions) are **not** in this list — see the table at the top.

---

## Deployment

Use the `<sf_deploy_metadata>` tool. Deploy the Apex class **before** anything that references it (an Agentforce bundle referencing a class that isn't deployed fails validation).

```
1. Deploy the service class + its test
2. Deploy the action class + its test
3. Grant class access to whichever user the caller runs as
4. Deploy the caller-side metadata (agent bundle, Flow, …)
```

Steps 1 and 2 can go in one deploy — list both classes. The action class will not compile without the service, so never deploy it alone.

For Agentforce specifically, the class must be granted to the **Einstein Agent User** profile or the action silently never executes — see `agentforce-topics-actions-guide`.

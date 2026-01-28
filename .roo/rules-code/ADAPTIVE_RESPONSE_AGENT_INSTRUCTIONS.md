# Adaptive Response Agent Instructions - Salesforce Agentforce

**⚠️ CRITICAL:** This guide covers ONLY the adaptive response-specific requirements (exact field names, wrapper classes, channel limits).

**You MUST also follow the base guide:** `.roo/rules-Salesforce_Agent/agentforce-topics-actions-guide.md`

**Base guide covers:**

- Schema structure and syntax (lightning types with double underscore)
- Topic and action naming conventions
- Local vs global topics/actions
- Schema file creation (input/output folders)
- Permissions and deployment

**This guide adds:**

- Exact field names for adaptive response wrapper classes
- Channel-specific limits
- SOQL query patterns for adaptive responses

**Always use BOTH guides together for Adaptive Response implementations.**

---

## For Code Agent: Reading Adaptive Response Decision

**IMPORTANT:** Before implementing, check if Adaptive Response should be used.

### How to Determine Implementation Approach

**Check subtask properties for:**

- `useAdaptiveResponse: true` → Implement Adaptive Response (this guide)
- `useAdaptiveResponse: false` → Implement standard action (use standard `lightning__textType`)

**If `useAdaptiveResponse: true`:**

1. Create wrapper class with **EXACT field names**: `name`, `imageUrl`, `mimeType`, `description`
2. Use `lightning__listType` in output schema
3. Add `maxItems` and `items` properties to schema
4. Reference wrapper class using: `@apexClassType/c__ApexClassName$WrapperClassName`
5. Follow all patterns in this guide

**If `useAdaptiveResponse: false`:**

1. Use standard types: `lightning__textType`, `lightning__booleanType`, etc.
2. No special wrapper classes needed
3. Standard schema format (no `maxItems` or `items`)

**If property not specified:**

- Analyze the action requirements
- If returning a list for visual display → Assume Adaptive Response
- If returning simple data → Use standard types

---

## Rich Choice (Card Carousel) Format

### Item Wrapper Class - EXACT Field Names Required

```apex
public class ProductChoiceWrapper {
    @InvocableVariable(required=true)
    public String name;              // ⚠️ EXACT: "name"

    @InvocableVariable(required=true)
    public String imageUrl;          // ⚠️ EXACT: "imageUrl" (camelCase)

    @InvocableVariable(required=false)
    public String mimeType;          // ⚠️ EXACT: "mimeType" (camelCase)

    @InvocableVariable(required=false)
    public String description;       // ⚠️ EXACT: "description"
}
```

**⚠️ Common Mistakes:**

- ❌ `productName` instead of `name`
- ❌ `imageURL` instead of `imageUrl` (wrong casing)
- ❌ `image_url` instead of `imageUrl` (underscore)
- ❌ Missing `@InvocableVariable` on any field

### Response Wrapper Class

```apex
public class ResponseWrapper {
    @InvocableVariable(required=true)
    public List<ProductChoiceWrapper> products;  // ✅ Name IS flexible: products, items, choices, etc.

    @InvocableVariable(required=false)
    public String message;
}
```

**Key Points:**

- List field name (e.g., `products`) is FLEXIBLE - choose any descriptive name
- List items MUST use exact field names: `name`, `imageUrl`, `mimeType`, `description`
- ALWAYS initialize list: `res.products = new List<ProductChoiceWrapper>();`

### Complete Example

```apex
public with sharing class ProductRecommendationAction {

    public class ProductChoiceWrapper {
        @InvocableVariable(required=true)
        public String name;

        @InvocableVariable(required=true)
        public String imageUrl;

        @InvocableVariable(required=false)
        public String mimeType;

        @InvocableVariable(required=false)
        public String description;
    }

    public class RequestWrapper {
        @InvocableVariable(required=true, label='Customer Category')
        public String customerCategory;
    }

    public class ResponseWrapper {
        @InvocableVariable(required=true)
        public List<ProductChoiceWrapper> products;

        @InvocableVariable(required=false)
        public String message;
    }

    @InvocableMethod(label='Get Product Recommendations', category='Agentforce Actions')
    public static List<ResponseWrapper> getProductRecommendations(List<RequestWrapper> requests) {
        List<ResponseWrapper> responses = new List<ResponseWrapper>();

        try {
            for (RequestWrapper req : requests) {
                ResponseWrapper res = new ResponseWrapper();
                res.products = new List<ProductChoiceWrapper>(); // Initialize first!

                // Query data
                List<Product2> productRecords = [
                    SELECT Id, Name, Image_URL1__c, Description
                    FROM Product2
                    WHERE Customer_Category__c = :req.customerCategory
                    AND IsActive = true
                    AND Image_URL1__c != null
                    LIMIT 5  // Chat channel supports max 5 cards
                ];

                // Map to wrapper with EXACT field names
                for (Product2 prod : productRecords) {
                    ProductChoiceWrapper choice = new ProductChoiceWrapper();
                    choice.name = prod.Name;
                    choice.imageUrl = prod.Image_URL1__c;
                    choice.mimeType = 'image/jpeg';
                    choice.description = prod.Description;
                    res.products.add(choice);
                }

                res.message = !res.products.isEmpty()
                    ? 'Here are some great products for you:'
                    : 'No products available at the moment.';

                responses.add(res);
            }
        } catch (Exception e) {
            ResponseWrapper errorRes = new ResponseWrapper();
            errorRes.products = new List<ProductChoiceWrapper>(); // Never null!
            errorRes.message = 'Sorry, an error occurred. Please try again.';
            responses.add(errorRes);
            System.debug('Error: ' + e.getMessage());
        }

        return responses;
    }
}
```

---

## Rich Link (Single Link Card) Format

### Link Wrapper Class - EXACT Field Names Required

```apex
public class LinkWrapper {
    @InvocableVariable(required=true)
    public String linkTitle;         // ⚠️ EXACT: "linkTitle"

    @InvocableVariable(required=true)
    public String linkUrl;           // ⚠️ EXACT: "linkUrl" (lowercase 'u')

    @InvocableVariable(required=true)
    public String linkImageUrl;      // ⚠️ EXACT: "linkImageUrl" (lowercase 'u')

    @InvocableVariable(required=false)
    public String linkImageMimeType; // ⚠️ EXACT: "linkImageMimeType"

    @InvocableVariable(required=false)
    public String description;       // ⚠️ EXACT: "description" (NOT linkDescriptionText)
}
```

**⚠️ Common Mistakes:**

- ❌ `linkURL` instead of `linkUrl` (wrong casing)
- ❌ `linkDescriptionText` instead of `description`
- ❌ `title` instead of `linkTitle`

### Response Wrapper Class

```apex
public class ResponseWrapper {
    @InvocableVariable(required=true)
    public LinkWrapper link;  // ✅ Name IS flexible: link, linkDetails, etc.
}
```

---

## Channel Support & Limits

### Rich Choice (Card Carousel)

- **Chat**: Max 5 cards
- **Facebook Messenger**: Max 10 cards
- **LINE**: Supported
- Use `LIMIT 5` in SOQL for Chat deployments

### Rich Link (Single Card)

- **Chat**: Supported
- **Apple Messages for Business**: Supported
- Single card only

### Text Fallback

- If channel doesn't support format, automatically converts to plain text

---

## SOQL Query Patterns - CRITICAL

### SOQL Bind Variables with Request Wrapper Properties

**⚠️ CRITICAL BUG TO AVOID:**

You CANNOT use request wrapper properties directly in SOQL bind variables.

**❌ WRONG - This will cause errors:**

```apex
String query = 'SELECT Id, Name FROM Course__c WHERE IsActive = true';
if (String.isNotBlank(req.courseLevel)) {
    query += ' AND Course_Level__c = :req.courseLevel';  // ❌ WRONG!
}
List<Course__c> courses = Database.query(query);
```

**✅ CORRECT - Create standalone variables first:**

```apex
// Step 1: Extract values to standalone variables
String level = req.courseLevel;
String category = req.category;

// Step 2: Build query
String query = 'SELECT Id, Name FROM Course__c WHERE IsActive = true';

// Step 3: Use standalone variables in bind
if (String.isNotBlank(level)) {
    query += ' AND Course_Level__c = :level';  // ✅ CORRECT
}
if (String.isNotBlank(category)) {
    query += ' AND Category__c = :category';  // ✅ CORRECT
}

// Step 4: Execute query
List<Course__c> courses = Database.query(query);
```

**Why This Matters:**

- SOQL bind variables can only reference standalone variables, not object properties
- Using `:req.property` syntax will cause "Variable does not exist" errors
- Always extract wrapper properties to local variables before using in dynamic SOQL

**Pattern to Follow:**

1. Extract ALL needed values from request wrapper to standalone variables
2. Build your dynamic query string
3. Use the standalone variables in bind variable syntax (`:variableName`)
4. Execute the query

---

## Field Name Quick Reference

### Rich Choice Item Fields (EXACT)

```
name          (String, required)
imageUrl      (String, required)
mimeType      (String, optional)
description   (String, optional)
```

### Rich Link Fields (EXACT)

```
linkTitle          (String, required)
linkUrl            (String, required)
linkImageUrl       (String, required)
linkImageMimeType  (String, optional)
description        (String, optional)
```

---

## Checklist

**Before Deployment:**

**Apex Class:**

- [ ] Used EXACT field names (check casing!)
- [ ] ALL fields have `@InvocableVariable`
- [ ] List initialized before populating
- [ ] SOQL LIMIT matches channel (5 for Chat)
- [ ] Try-catch error handling
- [ ] Never return null lists/responses
- [ ] Image URLs are publicly accessible
- [ ] URLs have file extensions (.jpg, .png) OR mimeType specified

**🚨 Schema Files (CRITICAL - see base guide for details):**

**Input Schema - EVERY property MUST have:**

- [ ] `lightning:isPII` (boolean)
- [ ] `copilotAction:isUserInput` (boolean)

**Output Schema - EVERY property MUST have:**

- [ ] `lightning:isPII` (boolean)
- [ ] `copilotAction:isDisplayable` (boolean)
- [ ] `copilotAction:isUsedByPlanner` (boolean)
- [ ] `copilotAction:useHydratedPrompt` (boolean)

**⚠️ Missing schema properties = silent deployment failure!**

Refer to `.roo/rules-Salesforce_Agent/agentforce-topics-actions-guide.md` for complete schema requirements.

---

## Common Mistakes - Quick Fixes

| Issue                      | Fix                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Cards not rendering        | Verify EXACT field names: `name`, `imageUrl`, `mimeType`, `description`                                           |
| Missing @InvocableVariable | Add to ALL wrapper fields                                                                                         |
| Wrong casing               | `imageUrl` not `imageURL`, `linkUrl` not `linkURL`                                                                |
| Too many cards             | LIMIT 5 for Chat, LIMIT 10 for Facebook                                                                           |
| Null list error            | Initialize: `res.products = new List<>()`                                                                         |
| Images not loading         | Check URL is public, has extension, or add mimeType                                                               |
| SOQL bind variable error   | Never use `:req.property` - create standalone variable first: `String level = req.courseLevel;` then use `:level` |

---

# Adaptive Response Agent Instructions

Comprehensive guide for implementing Salesforce Agentforce Adaptive Response actions with rich visual cards (carousels, links).

---

## Decision: Is This an Adaptive Response?

**Check subtask properties:**

- `useAdaptiveResponse: true` → Follow this guide
- `useAdaptiveResponse: false` → Use standard types (`lightning__textType`) with `agentforce-apex-guide.md` only

**If property not specified, analyze the requirement:**

| Criteria                        | Examples                                                |
| ------------------------------- | ------------------------------------------------------- |
| Returns a **list of items**     | products, courses, recommendations, cases               |
| Includes **rich content**       | images, descriptions, multiple fields per item          |
| Involves **browsing/selecting** | "show courses", "display products", "recommend options" |
| Visual presentation enhances UX | card carousels, image galleries                         |

**If ANY criteria matches → Use Adaptive Response (this guide).**
**If none match → Use standard types with `agentforce-apex-guide.md` only.**

---

## AI Workflow Checklist — MANDATORY SEQUENCE

**⚠️ CRITICAL:** Follow this exact sequence. Do NOT skip or reorder steps.

### Phase 1: Apex Class Implementation (Code Mode)

- [ ] **STEP 1:** Retrieve ALL custom objects and fields

    ```xml
    <retrieve_sf_metadata>
    <metadata_type>CustomObject</metadata_type>
    </retrieve_sf_metadata>
    ```

    Find relevant object folder and examine fields in `fields/` subfolder

- [ ] **STEP 2:** Fetch invocable Apex instructions

    ```xml
    <fetch_instructions>
    <task>invocable_apex</task>
    </fetch_instructions>
    ```

- [ ] **STEP 3:** Read adaptive response patterns (sections 2b-2f above)

    - Rich Choice vs Rich Link format
    - EXACT field names (name, imageUrl, mimeType, description, etc.)
    - SOQL query patterns and bind variable rules
    - Channel limits (LIMIT 5 for Chat, LIMIT 10 for Facebook)

- [ ] **STEP 4:** Create invocable Apex class

    - Follow invocable Apex guide structure
    - Apply adaptive response wrapper patterns
    - Use EXACT field names with @InvocableVariable annotations
    - Extract bind variables from wrappers to local variables
    - Include try-catch error handling

- [ ] **STEP 5:** Dry-run deploy

    ```bash
    sf project deploy start --dry-run --source-dir force-app/main/default/classes/YourClassName.cls
    ```

- [ ] **STEP 6:** Deploy to Salesforce org

    ```bash
    sf project deploy start --source-dir force-app/main/default/classes/YourClassName.cls
    ```

- [ ] **STEP 7:** Verify deployment succeeded
    - Check Setup → Apex Classes → confirm class appears

### Phase 2: Agent Configuration (Salesforce Agent Mode)

**⚠️ MANDATORY:** After Apex is deployed, SWITCH TO SALESFORCE AGENT MODE

- [ ] **STEP 8:** Fetch agentforce topics and actions guide
    ```xml
    <fetch_instructions>
    <task>agentforce_topics_actions</task>
    </fetch_instructions>
    ```
    This guide contains complete instructions for:
    - Creating local topics in GenAiPlannerBundle
    - Creating local actions referencing the Apex class
    - Creating input/output schema files
    - Linking actions to topics
    - Linking topics to agent
    - Deploying the GenAiPlannerBundle

**⚠️ After Apex deployment:**

1. Switch to **Salesforce Agent Mode**
2. Fetch the `agentforce_topic_analyse` instructions
3. Follow those instructions to configure agent topics and actions
4. Deploy the GenAiPlannerBundle to complete the agent setup

---

## Implementation Workflow

```
1. Retrieve Objects → 2. Implement Apex → 3. Deploy → 4. Configure Agent
```

---

## Step 1: Retrieve Objects and Fields

**ALWAYS retrieve ALL custom objects first:**

```xml
<retrieve_sf_metadata>
<metadata_type>CustomObject</metadata_type>
</retrieve_sf_metadata>
```

This retrieves ALL objects to: `force-app/main/default/objects/`

**After retrieval, find the relevant object:**

1. Navigate to `force-app/main/default/objects/`
2. Search for the object folder matching the user's request (e.g., `Product2`, `Course__c`)
3. Open the `fields/` subfolder — each `.field-meta.xml` = one field
4. Field API name = filename without `.field-meta.xml`
5. Use these exact API names in SOQL queries

**Why this is critical:**

- See all available fields before writing SOQL
- Use correct field API names (avoid query errors)
- Identify which fields have image URLs, descriptions, etc.

---

## Step 2: Implement Apex Class

### 2a. Fetch the Invocable Apex Guide

**MANDATORY — fetch this first:**

```xml
<fetch_instructions>
<task>invocable_apex</task>
</fetch_instructions>
```

This provides: invocable Apex structure, `@InvocableMethod` / `@InvocableVariable` annotations, file creation locations, XML metadata, and deployment patterns.

**Follow the invocable Apex guide for the base class structure, then apply the adaptive response patterns below.**

---

### 2b. Adaptive Response Variables

#### Rich Choice (Card Carousel) — EXACT Field Names

```
name          (String, required)   — ⚠️ EXACT: "name" not "productName"
imageUrl      (String, required)   — ⚠️ EXACT: "imageUrl" (camelCase, not "imageURL")
mimeType      (String, optional)   — ⚠️ EXACT: "mimeType" (camelCase)
description   (String, optional)   — ⚠️ EXACT: "description"
```

#### Rich Link (Single Link Card) — EXACT Field Names

```
linkTitle          (String, required)   — ⚠️ EXACT: "linkTitle"
linkUrl            (String, required)   — ⚠️ EXACT: "linkUrl" (lowercase 'u')
linkImageUrl       (String, required)   — ⚠️ EXACT: "linkImageUrl" (lowercase 'u')
linkImageMimeType  (String, optional)   — ⚠️ EXACT: "linkImageMimeType"
description        (String, optional)   — ⚠️ EXACT: "description"
```

**Common Mistakes:**

- ❌ `productName` instead of `name`
- ❌ `imageURL` instead of `imageUrl` (wrong casing)
- ❌ `image_url` instead of `imageUrl` (underscore)
- ❌ `linkURL` instead of `linkUrl` (wrong casing)
- ❌ `linkDescriptionText` instead of `description`
- ❌ Missing `@InvocableVariable` on any field

---

### 2c. SOQL Query Patterns

**⚠️ CRITICAL BUG TO AVOID:** You CANNOT use request wrapper properties directly in SOQL bind variables.

**❌ WRONG:**

```apex
query += ' AND Course_Level__c = :req.courseLevel';  // ❌ WRONG!
```

**✅ CORRECT — Extract to standalone variables first:**

```apex
String level = req.courseLevel;
String category = req.category;

String query = 'SELECT Id, Name FROM Course__c WHERE IsActive = true';
if (String.isNotBlank(level)) {
    query += ' AND Course_Level__c = :level';  // ✅ CORRECT
}
if (String.isNotBlank(category)) {
    query += ' AND Category__c = :category';  // ✅ CORRECT
}
List<Course__c> courses = Database.query(query);
```

**Rule:** Always extract ALL wrapper properties to local variables before using in dynamic SOQL bind syntax (`:variableName`).

---

### 2d. Channel Support & Limits

| Format                      | Channel            | Limit                        |
| --------------------------- | ------------------ | ---------------------------- |
| Rich Choice (Card Carousel) | Chat               | Max **5** cards              |
| Rich Choice (Card Carousel) | Facebook Messenger | Max **10** cards             |
| Rich Choice (Card Carousel) | LINE               | Supported                    |
| Rich Link (Single Card)     | Chat               | Supported (single card only) |
| Rich Link (Single Card)     | Apple Messages     | Supported (single card only) |

- Use `LIMIT 5` in SOQL for Chat deployments, `LIMIT 10` for Facebook
- If channel doesn't support the format, it automatically converts to plain text

---

### 2e. Complete Example — Rich Choice (Card Carousel)

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
        @InvocableVariable(required=true label='Customer Category')
        public String customerCategory;
    }

    public class ResponseWrapper {
        @InvocableVariable(required=true)
        public List<ProductChoiceWrapper> products;

        @InvocableVariable(required=false)
        public String message;
    }

    @InvocableMethod(label='Get Product Recommendations' category='Agentforce Actions')
    public static List<ResponseWrapper> getProductRecommendations(List<RequestWrapper> requests) {
        List<ResponseWrapper> responses = new List<ResponseWrapper>();

        try {
            for (RequestWrapper req : requests) {
                ResponseWrapper res = new ResponseWrapper();
                res.products = new List<ProductChoiceWrapper>();

                // Extract bind variables from wrapper
                String category = req.customerCategory;

                List<Product2> productRecords = [
                    SELECT Id, Name, Image_URL1__c, Description
                    FROM Product2
                    WHERE Customer_Category__c = :category
                    AND IsActive = true
                    AND Image_URL1__c != null
                    LIMIT 5
                ];

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
            errorRes.products = new List<ProductChoiceWrapper>();
            errorRes.message = 'Sorry, an error occurred. Please try again.';
            responses.add(errorRes);
            System.debug('Error: ' + e.getMessage());
        }

        return responses;
    }
}
```

**Key Points:**

- Item wrapper uses EXACT field names: `name`, `imageUrl`, `mimeType`, `description`
- Response wrapper list field name (e.g., `products`) is FLEXIBLE
- ALWAYS initialize list before populating: `res.products = new List<ProductChoiceWrapper>();`
- Never return null lists or responses

---

### 2f. Complete Example — Rich Link (Single Link Card)

```apex
public with sharing class ResourceLinkAction {

    public class LinkWrapper {
        @InvocableVariable(required=true)
        public String linkTitle;

        @InvocableVariable(required=true)
        public String linkUrl;

        @InvocableVariable(required=true)
        public String linkImageUrl;

        @InvocableVariable(required=false)
        public String linkImageMimeType;

        @InvocableVariable(required=false)
        public String description;
    }

    public class RequestWrapper {
        @InvocableVariable(required=true label='Resource Type')
        public String resourceType;
    }

    public class ResponseWrapper {
        @InvocableVariable(required=true)
        public LinkWrapper link;

        @InvocableVariable(required=false)
        public String message;
    }

    @InvocableMethod(label='Get Resource Link' category='Agentforce Actions')
    public static List<ResponseWrapper> getResourceLink(List<RequestWrapper> requests) {
        List<ResponseWrapper> responses = new List<ResponseWrapper>();

        try {
            for (RequestWrapper req : requests) {
                ResponseWrapper res = new ResponseWrapper();
                String resType = req.resourceType;

                Resource__c resource = [
                    SELECT Name, URL__c, Image_URL__c, Description__c
                    FROM Resource__c
                    WHERE Type__c = :resType
                    AND IsActive__c = true
                    LIMIT 1
                ];

                LinkWrapper lw = new LinkWrapper();
                lw.linkTitle = resource.Name;
                lw.linkUrl = resource.URL__c;
                lw.linkImageUrl = resource.Image_URL__c;
                lw.linkImageMimeType = 'image/png';
                lw.description = resource.Description__c;
                res.link = lw;

                res.message = 'Here is the resource you requested:';
                responses.add(res);
            }
        } catch (Exception e) {
            ResponseWrapper errorRes = new ResponseWrapper();
            errorRes.message = 'Sorry, could not find the requested resource.';
            responses.add(errorRes);
            System.debug('Error: ' + e.getMessage());
        }

        return responses;
    }
}
```

**Key Points:**

- Link wrapper uses EXACT field names: `linkTitle`, `linkUrl`, `linkImageUrl`, `linkImageMimeType`, `description`
- Response wrapper field name (e.g., `link`) is FLEXIBLE
- Single card only — no list needed

---

## Step 3: Deploy

**Always dry-run first:**

```bash
sf project deploy start --dry-run --source-dir force-app/main/default/classes/YourClassName.cls
```

**If dry-run succeeds, deploy:**

```bash
sf project deploy start --source-dir force-app/main/default/classes/YourClassName.cls
```

**Verify deployment:**

- Check Setup → Apex Classes → confirm class appears

---

## Switch to Salesforce Agent Mode

**After Apex class is deployed:**

1. **Switch to Salesforce Agent Mode**
2. **Fetch agentforce topics and actions guide:**
    ```xml
    <fetch_instructions>
    <task>agentforce_topics_actions</task>
    </fetch_instructions>
    ```
3. **Follow the fetched guide** to create topics, actions, schemas, and deploy the GenAiPlannerBundle

---

## Step 4: Configure Agent

After the Apex class is deployed:

1. Add the local action XML referencing the Apex class in the GenAiPlannerBundle
2. Create input/output schema files for the action
3. For schema structure and requirements, refer to: `.roo/rules-Salesforce_Agent/agentforce-topics-actions-guide.md`
    - Use `lightning__listType` for Rich Choice output
    - Add `maxItems` and `items` properties with Apex class reference: `@apexClassType/c__ApexClassName$WrapperClassName`
4. Deploy the GenAiPlannerBundle

---

## Pre-Deployment Checklist

**Apex Class:**

- [ ] Used EXACT field names (check casing!)
- [ ] ALL fields have `@InvocableVariable`
- [ ] List initialized before populating
- [ ] SOQL LIMIT matches channel (5 for Chat, 10 for Facebook)
- [ ] SOQL bind variables use standalone local variables (not `req.property`)
- [ ] Try-catch error handling
- [ ] Never return null lists or responses
- [ ] Image URLs are publicly accessible
- [ ] URLs have file extensions (.jpg, .png) OR mimeType is specified

---

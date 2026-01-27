# Adaptive Response Agent Implementation Workflow

Quick workflow for implementing Salesforce Agentforce Adaptive Response Agents with custom invocable Apex actions.

---

## 🔄 Quick Workflow

```
1. Retrieve Objects → 2. Fetch Instructions → 3. Implement Apex → 4. Deploy → 5. Configure Agent
```

---

## Step 1: Retrieve ALL Custom Objects (MANDATORY)

**ALWAYS retrieve ALL custom objects first:**

```xml
<retrieve_sf_metadata>
<metadata_type>CustomObject</metadata_type>
</retrieve_sf_metadata>
```

**This retrieves ALL objects to:** `force-app/main/default/objects/`

**After retrieval, search for the object you need:**

- User says "product recommendations" → Search for `Product__c` or `Product2` folder
- User says "case recommendations" → Search for `Case` folder
- User says "account info" → Search for `Account` folder

**Object structure after retrieval:**

```
objects/
  Product__c/
    Product__c.object-meta.xml
    fields/
      Name.field-meta.xml
      Image_URL__c.field-meta.xml
      Category__c.field-meta.xml
      Description__c.field-meta.xml
  Case/
    Case.object-meta.xml
    fields/
      Subject.field-meta.xml
      Status.field-meta.xml
  ...
```

**To find and use the correct object:**

1. Navigate to `force-app/main/default/objects/` folder
2. Search for the object folder that matches user's request
3. Go into that object's `fields/` folder
4. Each `.field-meta.xml` file = one field
5. Field API name = filename without `.field-meta.xml` extension
6. Use these exact API names in your SOQL queries

**Why this is critical:**

- ✅ See ALL available objects in the org
- ✅ Find the correct object that matches the use case
- ✅ See all available fields before writing SOQL
- ✅ Use correct field API names (avoid query errors)
- ✅ Identify which fields have image URLs, descriptions, etc.

---

## Step 2: Fetch Implementation Instructions

**Fetch BOTH instruction sets:**

```xml
<fetch_instructions>
<task>invocable_apex</task>
</fetch_instructions>
```

```xml
<fetch_instructions>
<task>adaptive_response_agent</task>
</fetch_instructions>
```

**This gives you:**

- `invocable_apex`: General invocable Apex structure, patterns, best practices
- `adaptive_response_agent`: EXACT field names for adaptive responses (case-sensitive!)

**Read both carefully before writing any code.**

---

## Step 3: Implement Apex Class

**Follow the exact patterns from the instructions:**

1. **Use EXACT field names** from `adaptive_response_agent` instructions:

    - Rich Choice: `name`, `imageUrl`, `mimeType`, `description`
    - Rich Link: `linkTitle`, `linkUrl`, `linkImageUrl`, `linkImageMimeType`, `description`

2. **Query the objects you retrieved** in Step 1:

    - Check the `fields/` folder for correct API names
    - Use those exact names in SOQL SELECT

3. **Follow invocable Apex best practices:**

    - `@InvocableMethod` annotation
    - Wrapper classes with `@InvocableVariable`
    - Try-catch error handling
    - List initialization before populating

4. **Channel limits:**
    - Chat: Use `LIMIT 5` in SOQL
    - Facebook: Use `LIMIT 10` in SOQL

---

## Step 4: Deploy to Org

**Always dry-run first:**

```bash
sf project deploy start --dry-run --source-dir force-app/main/default/classes/YourClassName.cls
```

**If dry-run succeeds, deploy:**

```bash
sf project deploy start --source-dir force-app/main/default/classes/YourClassName.cls
```

**Verify deployment:**

- Check Setup → Apex Classes
- Confirm class appears in the list

---

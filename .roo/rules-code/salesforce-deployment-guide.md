# Salesforce Deployment & Retrieval Guide

## Comprehensive Guide for Metadata Deployment and Retrieval Operations

---

## Executive Summary

This guide covers all metadata retrieval and deployment operations for Salesforce development. Whether working with Apex classes, Lightning Web Components, or other metadata types, following these guidelines ensures safe, conflict-free deployments.

---

## Table of Contents

1. [Retrieval Guidelines](#retrieval-guidelines)
2. [Apex Class Retrieval](#apex-class-retrieval)
3. [Lightning Web Component Retrieval](#lightning-web-component-retrieval)
4. [Deployment Workflow](#deployment-workflow)
5. [Apex Deployment](#apex-deployment)
6. [LWC Deployment](#lwc-deployment)
7. [Deployment Best Practices](#deployment-best-practices)
8. [Common Deployment Scenarios](#common-deployment-scenarios)
9. [Troubleshooting](#troubleshooting)

---

## Retrieval Guidelines

### **CRITICAL RULE: ALWAYS RETRIEVE BEFORE CREATING OR MODIFYING**

Before creating or modifying ANY Salesforce metadata (Apex, LWC, etc.), you MUST:

✅ **ALWAYS retrieve at the start** of any task to understand existing code
✅ **ALWAYS retrieve before creating** to check if similar metadata already exists
✅ **ALWAYS retrieve before modifying** to get the latest version
✅ When syncing local code with org code
✅ When analyzing or refactoring existing code

### ❌ NEVER DO THIS

❌ **NEVER create metadata files directly without first using the retrieve tool**
❌ **NEVER assume metadata doesn't exist** - always retrieve and check first
❌ **NEVER modify metadata without retrieving** the latest version first

---

## Apex Class Retrieval

### Directory Location

**Apex classes are stored in:** `force-app/main/default/classes/`

Each Apex class has two files:

- `ClassName.cls` (the Apex class file)
- `ClassName.cls-meta.xml` (the metadata XML file)

### Retrieve All Apex Classes

**Command:** Use the `<retrieve_sf_metadata>` tool

```xml
<retrieve_sf_metadata>
  <metadata_type>ApexClass</metadata_type>
</retrieve_sf_metadata>
```

**What it does:**

- Retrieves ALL Apex classes from the org
- Downloads to `force-app/main/default/classes/` directory
- **MANDATORY FIRST STEP** when starting any Apex-related task
- Helps understand what classes exist in the org

### Retrieve Specific Apex Class

**Command:** Use the `<retrieve_sf_metadata>` tool with metadata_name

```xml
<retrieve_sf_metadata>
  <metadata_type>ApexClass</metadata_type>
  <metadata_name>AccountService</metadata_name>
</retrieve_sf_metadata>
```

**Notes:**

- Replace `AccountService` with the actual class name
- Do NOT include the `.cls` extension
- Examples: "AccountService", "MyController", "OpportunityTriggerHandler"
- Downloads to `force-app/main/default/classes/`

### Sync Latest Code

**MANDATORY**: Before modifying any Apex class:

1. Retrieve the latest version using the tool
2. Ensures you have the most current code
3. Prevents conflicts and overwrites
4. Always sync before making changes to existing classes

---

## Lightning Web Component Retrieval

### Directory Location

**Lightning Web Components are stored in:** `force-app/main/default/lwc/`

Each LWC component has its own folder with multiple files:

```
componentName/               (folder in camelCase)
├── componentName.js         (JavaScript controller - required)
├── componentName.html       (HTML template - optional)
├── componentName.css        (CSS styles - optional)
└── componentName.js-meta.xml (metadata configuration - required)
```

### Retrieve All LWC Components

**Command:** Use the `<retrieve_sf_metadata>` tool

```xml
<retrieve_sf_metadata>
  <metadata_type>LightningComponentBundle</metadata_type>
</retrieve_sf_metadata>
```

**What it does:**

- Retrieves ALL LWC components from the org
- Downloads to `force-app/main/default/lwc/` directory
- **MANDATORY FIRST STEP** when starting any LWC-related task
- Helps understand what components exist in the org

### Retrieve Specific LWC Component

**Command:** Use the `<retrieve_sf_metadata>` tool with metadata_name

```xml
<retrieve_sf_metadata>
  <metadata_type>LightningComponentBundle</metadata_type>
  <metadata_name>myComponent</metadata_name>
</retrieve_sf_metadata>
```

**Notes:**

- Replace `myComponent` with the actual component folder name
- Use camelCase naming (e.g., "accountList", "opportunityCard")
- Retrieves the entire component bundle (.js, .html, .css, .js-meta.xml)
- Downloads to `force-app/main/default/lwc/<ComponentName>/`

### Sync Latest Code

**MANDATORY**: Before modifying any LWC component:

1. Retrieve the latest version using the tool
2. Ensures you have the most current code
3. Prevents conflicts and overwrites
4. Check parent/child components when working with composition

---

## Deployment Workflow

### **CRITICAL: Follow This Order EVERY TIME**

```
1. Retrieve existing metadata (MANDATORY)
   ↓
2. Create/modify files locally
   ↓
3. Run dry-run for Apex (if applicable)
   ↓
4. Deploy Apex classes
   ↓
5. Run dry-run for LWC (if applicable)
   ↓
6. Deploy LWC components
   ↓
7. Verify deployment success
```

### Key Principles

✅ **Always deploy Apex BEFORE LWC** (LWC often depends on Apex controllers)
✅ **Always dry-run before actual deployment**
✅ **Deploy only what you created/modified** - NOT the entire metadata folder
✅ **Verify dependencies** before deploying
✅ **Test in sandbox first** before production

---

## Apex Deployment

### Dry Run (Required Before Deployment)

**Purpose:** Validate deployment without actually deploying

**Single Apex Class:**

```bash
sf project deploy start --dry-run --source-dir force-app/main/default/classes/AccountService.cls
```

**Multiple Apex Classes:**

```bash
sf project deploy start --dry-run \
  --source-dir force-app/main/default/classes/AccountService.cls \
  --source-dir force-app/main/default/classes/AccountServiceTest.cls \
  --source-dir force-app/main/default/classes/AccountHelper.cls
```

**With Dependencies (Custom Objects, Triggers):**

```bash
sf project deploy start --dry-run \
  --source-dir force-app/main/default/objects/MyCustomObject__c \
  --source-dir force-app/main/default/classes/HelperClass.cls \
  --source-dir force-app/main/default/classes/MainService.cls \
  --source-dir force-app/main/default/triggers/AccountTrigger.trigger
```

### Actual Deployment

**After successful dry-run:**

**Single Apex Class:**

```bash
sf project deploy start --source-dir force-app/main/default/classes/AccountService.cls
```

**Multiple Apex Classes:**

```bash
sf project deploy start \
  --source-dir force-app/main/default/classes/AccountService.cls \
  --source-dir force-app/main/default/classes/AccountServiceTest.cls \
  --source-dir force-app/main/default/classes/AccountHelper.cls
```

### Important Notes

- Replace `<classname.cls>` with actual class file names
- Include `.cls` extension in commands
- **ALWAYS run dry-run first**
- If dry-run fails, fix errors before attempting deployment
- Deploy test classes along with the classes they test (75% code coverage required)

---

## LWC Deployment

### **IMPORTANT: Deploy Apex Controllers FIRST**

Before deploying LWC components that call Apex methods:

1. ✅ Deploy the Apex controller classes FIRST
2. ✅ Verify Apex deployment succeeded
3. ✅ THEN deploy the LWC components

### Dry Run (Required Before Deployment)

**Single LWC Component:**

```bash
sf project deploy start --dry-run --source-dir force-app/main/default/lwc/myComponent
```

**Multiple LWC Components:**

```bash
sf project deploy start --dry-run \
  --source-dir force-app/main/default/lwc/accountList \
  --source-dir force-app/main/default/lwc/accountCard \
  --source-dir force-app/main/default/lwc/accountDetail
```

### Actual Deployment

**After successful dry-run:**

**Single LWC Component:**

```bash
sf project deploy start --source-dir force-app/main/default/lwc/myComponent
```

**Multiple LWC Components:**

```bash
sf project deploy start \
  --source-dir force-app/main/default/lwc/accountList \
  --source-dir force-app/main/default/lwc/accountCard \
  --source-dir force-app/main/default/lwc/accountDetail
```

### Important Notes

- Component folder names are in camelCase (e.g., `myComponent`, not `MyComponent`)
- Do NOT include file extensions - reference the folder
- **ALWAYS deploy Apex controllers before LWC**
- **ALWAYS run dry-run first**
- If dry-run fails, fix errors before attempting deployment

---

## Deployment Best Practices

### 1. Selective Deployment (CRITICAL)

**✅ DO THIS:**

```bash
# Deploy only what you created/modified
sf project deploy start \
  --source-dir force-app/main/default/classes/NewClass.cls \
  --source-dir force-app/main/default/lwc/newComponent
```

**❌ NEVER DO THIS:**

```bash
# DO NOT deploy entire metadata folder
sf project deploy start --source-dir force-app/main/default/
```

**Why?**

- Deploying entire folders introduces unrelated dependencies
- Can cause deployment failures from unrelated metadata
- May deploy code you didn't intend to deploy
- Harder to troubleshoot when failures occur

### 2. Dependency Order

**Correct Order:**

```
1. Custom Objects / Fields
2. Apex Classes (dependencies first, then dependents)
3. Apex Triggers
4. Apex Test Classes
5. Lightning Web Components
```

**Example:**

```bash
# 1. Deploy custom object first
sf project deploy start --source-dir force-app/main/default/objects/Account__c

# 2. Deploy helper classes first
sf project deploy start --source-dir force-app/main/default/classes/HelperClass.cls

# 3. Deploy main service class (depends on helper)
sf project deploy start --source-dir force-app/main/default/classes/AccountService.cls

# 4. Deploy test classes
sf project deploy start --source-dir force-app/main/default/classes/AccountServiceTest.cls

# 5. Finally deploy LWC (depends on Apex controller)
sf project deploy start --source-dir force-app/main/default/lwc/accountList
```

### 3. Verify Dependencies

**Before deploying LWC, check:**

- ✅ Does it call any Apex methods? Deploy Apex first
- ✅ Does it use any custom objects/fields? Deploy them first
- ✅ Does it depend on other LWC components? Deploy parent components first

**Before deploying Apex, check:**

- ✅ Does it use custom objects/fields? Deploy them first
- ✅ Does it depend on other Apex classes? Deploy dependencies first
- ✅ Are there test classes? Deploy them together

### 4. Code Coverage Requirements

**Production Deployments:**

- 75% overall code coverage required
- All triggers must have some coverage
- Test classes don't count toward coverage

**Tips:**

- Deploy test classes with the classes they test
- Ensure test classes run successfully
- Fix failing tests before deployment

### 5. Error Handling

**If dry-run fails:**

1. Read error message carefully
2. Fix the identified issues
3. Run dry-run again
4. Do NOT proceed to deployment until dry-run succeeds

**If deployment fails:**

1. Check deployment logs for specific errors
2. Verify all dependencies are deployed
3. Check code coverage if deploying to production
4. Fix issues and retry

---

## Common Deployment Scenarios

### Scenario 1: New Apex Class with Test Class

```bash
# 1. Dry-run
sf project deploy start --dry-run \
  --source-dir force-app/main/default/classes/AccountService.cls \
  --source-dir force-app/main/default/classes/AccountServiceTest.cls

# 2. If successful, deploy
sf project deploy start \
  --source-dir force-app/main/default/classes/AccountService.cls \
  --source-dir force-app/main/default/classes/AccountServiceTest.cls
```

### Scenario 2: New LWC with Apex Controller

```bash
# 1. Deploy Apex controller first
sf project deploy start --dry-run \
  --source-dir force-app/main/default/classes/AccountController.cls
sf project deploy start \
  --source-dir force-app/main/default/classes/AccountController.cls

# 2. Then deploy LWC
sf project deploy start --dry-run \
  --source-dir force-app/main/default/lwc/accountList
sf project deploy start \
  --source-dir force-app/main/default/lwc/accountList
```

### Scenario 3: Trigger with Handler Class

```bash
# 1. Deploy handler class first
sf project deploy start --dry-run \
  --source-dir force-app/main/default/classes/AccountTriggerHandler.cls
sf project deploy start \
  --source-dir force-app/main/default/classes/AccountTriggerHandler.cls

# 2. Then deploy trigger
sf project deploy start --dry-run \
  --source-dir force-app/main/default/triggers/AccountTrigger.trigger
sf project deploy start \
  --source-dir force-app/main/default/triggers/AccountTrigger.trigger
```

### Scenario 4: Full Feature (Custom Object + Apex + LWC)

```bash
# 1. Custom object
sf project deploy start --source-dir force-app/main/default/objects/MyObject__c

# 2. Apex classes (dependencies first)
sf project deploy start \
  --source-dir force-app/main/default/classes/MyObjectHelper.cls \
  --source-dir force-app/main/default/classes/MyObjectService.cls \
  --source-dir force-app/main/default/classes/MyObjectServiceTest.cls

# 3. LWC components
sf project deploy start \
  --source-dir force-app/main/default/lwc/myObjectList \
  --source-dir force-app/main/default/lwc/myObjectCard
```

---

## Troubleshooting

### Common Errors and Solutions

**Error: "Cannot find Apex class"**

- ✅ Deploy the Apex class first before deploying LWC
- ✅ Verify class name matches exactly (case-sensitive)

**Error: "Insufficient code coverage"**

- ✅ Deploy test classes with your Apex classes
- ✅ Ensure test classes run successfully
- ✅ Need 75% overall coverage for production

**Error: "Unknown custom object"**

- ✅ Deploy custom object metadata before Apex/LWC that uses it
- ✅ Check custom field API names match

**Error: "Component not found"**

- ✅ Verify component folder name is correct (camelCase)
- ✅ Check all required files exist (.js, .js-meta.xml minimum)

**Error: "Dry-run failed"**

- ✅ Fix ALL errors before attempting actual deployment
- ✅ Do NOT skip dry-run step
- ✅ Verify dependencies are already deployed

### Deployment Checklist

Before every deployment:

- [ ] Retrieved latest metadata from org
- [ ] Created/modified only necessary files
- [ ] Identified all dependencies
- [ ] Deployed dependencies in correct order
- [ ] Ran dry-run successfully
- [ ] Verified test coverage (if applicable)
- [ ] Documented changes

---

## Quick Reference Commands

### Retrieval

```bash
# Retrieve all Apex classes
<retrieve_sf_metadata>
  <metadata_type>ApexClass</metadata_type>
</retrieve_sf_metadata>

# Retrieve specific Apex class
<retrieve_sf_metadata>
  <metadata_type>ApexClass</metadata_type>
  <metadata_name>ClassName</metadata_name>
</retrieve_sf_metadata>

# Retrieve all LWC
<retrieve_sf_metadata>
  <metadata_type>LightningComponentBundle</metadata_type>
</retrieve_sf_metadata>

# Retrieve specific LWC
<retrieve_sf_metadata>
  <metadata_type>LightningComponentBundle</metadata_type>
  <metadata_name>componentName</metadata_name>
</retrieve_sf_metadata>
```

### Deployment

```bash
# Dry-run single file
sf project deploy start --dry-run --source-dir force-app/main/default/classes/ClassName.cls

# Deploy single file
sf project deploy start --source-dir force-app/main/default/classes/ClassName.cls

# Dry-run multiple files
sf project deploy start --dry-run \
  --source-dir force-app/main/default/classes/Class1.cls \
  --source-dir force-app/main/default/classes/Class2.cls

# Deploy multiple files
sf project deploy start \
  --source-dir force-app/main/default/classes/Class1.cls \
  --source-dir force-app/main/default/classes/Class2.cls
```

---

## Summary

**Remember:**

1. 🔍 **ALWAYS retrieve before creating/modifying**
2. 🧪 **ALWAYS dry-run before deploying**
3. 📦 **Deploy only what you created/modified**
4. ⬆️ **Deploy Apex BEFORE LWC**
5. 🔗 **Verify and deploy dependencies first**
6. ✅ **Check code coverage for production**
7. 📝 **Follow the deployment workflow every time**

By following these guidelines, you ensure safe, conflict-free deployments every time.

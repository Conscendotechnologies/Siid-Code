# Salesforce Deployment Guide

## Critical Deployment Principles

### ⚠️ NEVER Deploy Entire Folders

**DO NOT USE:**

- ❌ `--source-dir force-app/main/default/classes` (all Apex classes)
- ❌ `--source-dir force-app/main/default/lwc` (all LWC components)
- ❌ `--source-dir force-app/main/default` (entire metadata folder)

**WHY:** Deploying entire folders causes:

- Long deployment times
- Unrelated component errors
- Failed deployments on components you didn't modify

### ✅ Always Deploy Component-Wise

Deploy ONLY the specific files you created or modified.

---

## Deployment Commands by Metadata Type

### Apex Classes

**Single Class:**

```bash
sf project deploy start --dry-run --source-dir force-app/main/default/classes/AccountController.cls --json
sf project deploy start --source-dir force-app/main/default/classes/AccountController.cls --json
```

**Multiple Classes Together:**

```bash
sf project deploy start --dry-run \
  --source-dir force-app/main/default/classes/AccountController.cls \
  --source-dir force-app/main/default/classes/AccountService.cls \
  --source-dir force-app/main/default/classes/AccountHelper.cls \
  --json
```

### Triggers

**Single Trigger:**

```bash
sf project deploy start --dry-run --source-dir force-app/main/default/triggers/AccountTrigger.trigger --json
sf project deploy start --source-dir force-app/main/default/triggers/AccountTrigger.trigger --json
```

### Lightning Web Components

**Single LWC Component (deploy entire component folder):**

```bash
sf project deploy start --dry-run --source-dir force-app/main/default/lwc/myComponent --json
sf project deploy start --source-dir force-app/main/default/lwc/myComponent --json
```

**Multiple LWC Components:**

```bash
sf project deploy start --dry-run \
  --source-dir force-app/main/default/lwc/myComponent \
  --source-dir force-app/main/default/lwc/anotherComponent \
  --json
```

**Note:** For LWC, use the **component folder name**, not individual files.

### Aura Components

**Single Aura Component:**

```bash
sf project deploy start --dry-run --source-dir force-app/main/default/aura/MyAuraComponent --json
sf project deploy start --source-dir force-app/main/default/aura/MyAuraComponent --json
```

### Custom Objects

**Single Custom Object:**

```bash
sf project deploy start --dry-run --source-dir force-app/main/default/objects/MyObject__c --json
sf project deploy start --source-dir force-app/main/default/objects/MyObject__c --json
```

### Static Resources

**Single Static Resource:**

```bash
sf project deploy start --dry-run --source-dir force-app/main/default/staticresources/myResource.resource-meta.xml --json
sf project deploy start --source-dir force-app/main/default/staticresources/myResource.resource-meta.xml --json
```

---

## Deployment Workflow

### 1. Dry-Run First (Always)

Always run with `--dry-run` flag first to validate:

```bash
sf project deploy start --dry-run --source-dir [path-to-component] --json
```

### 2. Handle Errors

If dry-run shows errors:

- ✅ Read error messages carefully
- ✅ Fix issues in the code
- ✅ Run dry-run again
- ❌ DON'T proceed to deployment until dry-run succeeds

### 3. Deploy After Successful Dry-Run

Once dry-run passes:

```bash
sf project deploy start --source-dir [path-to-component] --json
```

### 4. Verify Deployment

Check deployment result:

- ✅ Status: "Succeeded"
- ✅ No errors in JSON response
- ✅ Components deployed successfully

---

## Error Recovery Strategy

### If Multiple Components Fail Together

When deploying multiple components causes errors:

**Step 1:** Deploy components ONE BY ONE

```bash
# Try first component alone
sf project deploy start --dry-run --source-dir force-app/main/default/classes/Component1.cls --json

# If successful, deploy it
sf project deploy start --source-dir force-app/main/default/classes/Component1.cls --json

# Then try second component
sf project deploy start --dry-run --source-dir force-app/main/default/classes/Component2.cls --json
# ... and so on
```

**Step 2:** Fix errors in failing components

**Step 3:** Retry failed components after fixes

---

## Dependency Order

### For Dependent Components

Deploy in this order:

1. **Custom Objects** (if creating new objects)
2. **Apex Classes** (controllers, services, helpers)
3. **Triggers** (if they reference Apex handler classes)
4. **LWC/Aura Components** (if they reference Apex controllers)
5. **Static Resources** (if referenced by components)

**Example with dependencies:**

```bash
# Step 1: Deploy custom object
sf project deploy start --source-dir force-app/main/default/objects/Invoice__c --json

# Step 2: Deploy Apex classes
sf project deploy start --source-dir force-app/main/default/classes/InvoiceController.cls --json

# Step 3: Deploy LWC that uses InvoiceController
sf project deploy start --source-dir force-app/main/default/lwc/invoiceList --json
```

---

## Common Mistakes to Avoid

### ❌ Deploying Too Much

**Wrong:**

```bash
sf project deploy start --source-dir force-app/main/default/classes --json
```

**Right:**

```bash
sf project deploy start --source-dir force-app/main/default/classes/MySpecificClass.cls --json
```

### ❌ Skipping Dry-Run

**Wrong:** Deploying without testing first

**Right:** Always dry-run → fix errors → deploy

### ❌ Deploying Before Dependencies

**Wrong:** Deploy LWC before its Apex controller

**Right:** Deploy Apex controller first, then LWC

### ❌ Ignoring Error Messages

**Wrong:** Retrying same command when it fails

**Right:** Read errors, fix code, then retry

---

## Quick Reference

| Metadata Type   | Path Pattern                     | Deploy Unit      |
| --------------- | -------------------------------- | ---------------- |
| Apex Class      | `classes/ClassName.cls`          | Individual file  |
| Trigger         | `triggers/TriggerName.trigger`   | Individual file  |
| LWC             | `lwc/componentName/`             | Component folder |
| Aura            | `aura/ComponentName/`            | Component folder |
| Custom Object   | `objects/ObjectName__c/`         | Object folder    |
| Static Resource | `staticresources/resourceName.*` | Resource files   |

---

## Troubleshooting

### "Missing Component" Errors

**Cause:** Trying to deploy a component that references non-existent dependencies

**Solution:** Deploy dependencies first (see Dependency Order section)

### "API Version" Errors

**Cause:** Component API version incompatible with org

**Solution:** Check and update API version in meta.xml files

### "Test Coverage" Errors

**Cause:** Insufficient test coverage for Apex code

**Solution:** Ensure test classes exist and provide adequate coverage

### "Duplicate Value" Errors

**Cause:** Component with same name already exists

**Solution:** Either delete existing component or rename new one

---

## Summary

**Remember:**

1. ✅ Deploy specific components, not folders
2. ✅ Always dry-run first
3. ✅ Deploy dependencies in order
4. ✅ If multiple fail, deploy one-by-one
5. ❌ Never deploy entire metadata folders

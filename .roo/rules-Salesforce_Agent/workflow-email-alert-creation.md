# Salesforce Workflow Email Alert Creation Instructions

## Overview

This guide provides instructions for creating Email Alert workflow actions in Salesforce. Email Alerts are used in Approval Processes, Process Builder, and Workflow Rules to automatically send email notifications when certain conditions are met.

---

## 🚨 CRITICAL INSTRUCTIONS - READ FIRST 🚨

**YOU MUST FOLLOW THESE INSTRUCTIONS EXACTLY AS WRITTEN. NO EXCEPTIONS. NO SHORTCUTS. NO ASSUMPTIONS.**

### **Type A vs Type B Scenarios**

**Type A (Complete Information Provided):** User provides detailed scenario with specific values in their initial prompt.

**Type B (Minimal Information):** User provides basic request without specific details.

---

### **Type A Workflow - Strict Rules**

**When user provides complete scenario details, you MUST:**

**✅ ALLOWED TO SKIP (Extract from user's prompt without re-asking):**

- Recipient types user mentioned (e.g., "role", "Account Owner", "creator", "user")
- Specific names user mentioned (e.g., "Senior Manager", "Sales Team")
- CC email addresses user mentioned

**❌ NEVER ALLOWED TO SKIP (ALWAYS display and ask user to confirm/select):**

- **Email template selection:** ALWAYS fetch templates, ALWAYS display ALL templates, ALWAYS ask user to select
- **Role selection:** ALWAYS query roles, ALWAYS display ALL roles, ALWAYS ask user to select
- **User selection:** ALWAYS query users, ALWAYS display ALL users, ALWAYS ask user to select
- **Group selection:** ALWAYS query groups, ALWAYS display ALL groups, ALWAYS ask user to select

**Type A Example:**

User says: "Send email alert to Senior Manager role using Case Assignment template"

**✅ CORRECT Type A Workflow:**

1. Extract: Recipient type = role, Role name = "Senior Manager"
2. Fetch ALL email templates using SOQL
3. Display ALL templates to user in numbered format
4. Ask user to select template (validate "Case Assignment" exists)
5. Query ALL roles
6. Display ALL roles to user in numbered list
7. Validate "Senior Manager" exists in the list
8. Ask: "I found 'Senior Manager' (#5 in the list). Confirm using this role? (Enter number or confirm)"
9. WAIT for user response
10. Use confirmed values in XML

**❌ WRONG Type A Workflow:**

1. Extract: Role = "Senior Manager", Template = "Case Assignment"
2. Query to check if both exist
3. If exist: Use directly in XML ← **VIOLATION - NEVER DO THIS**

---

## When to Use These Instructions

Use these instructions when you need to **create a new Email Alert action** for:

- Approval Processes
- Workflow Rules
- Process Builder processes

**Note:** If you need to select from existing Email Alerts, refer to the main approval process or workflow instructions.

---

## Prerequisites

Before creating an Email Alert, ensure you have:

1. Identified the Salesforce object (e.g., Account, Contact, Opportunity)
2. Retrieved object metadata if needed for field lookups
3. Identified the workflow file location: `force-app/main/default/workflows/{ObjectApiName}.workflow-meta.xml`

---

## **Standard Display Pattern**

**Whenever you fetch lists of data (users, roles, groups, email templates, etc.), follow this exact pattern:**

1. **Fetch ALL results** - Do NOT limit query results
2. **Count total results** fetched
3. **Display based on count:**
    - **If count ≤ 50:** Display ALL results immediately in numbered format
    - **If count > 50:** Ask user: "Found X [item type]. Would you like to: (1) See all X items, or (2) Filter/search first?"
        - **WAIT for user response**
        - If (1): Display ALL items in numbered format
        - If (2): Ask for filter criteria, apply filter, show matching results
4. **Format clearly:**
    - Use numbered list: `[Number]. [PrimaryField] ([SecondaryField]) - [AdditionalInfo]`
    - Examples:
        - Users: `1. John Smith - john.smith@company.com (Sales Manager)`
        - Roles: `1. CEO (CEO)`
        - Templates: `1. unfiled$public/Welcome - Welcome Email`
5. **Then ask user to select** from the displayed list
6. **NEVER truncate or hide results** without user consent

**This pattern applies throughout this entire document. References to "Standard Display Pattern" mean follow the above steps.**

---

## Important Notes

**⚠️ CRITICAL ENFORCEMENT - EMAIL ALERT CREATION RULES:**

**❌ NEVER create email alert without fetching templates**
**❌ NEVER skip displaying templates to user**
**❌ NEVER select template on behalf of user**
**❌ NEVER proceed without user selecting a template**

**✅ ALWAYS fetch ALL templates using SOQL query**
**✅ ALWAYS display ALL templates to user in numbered format**
**✅ ALWAYS ask user to select by number**
**✅ ALWAYS wait for user response**

---

## Step 1: Auto-Generate Developer Name (fullName)

**Pattern:** Convert description to API name format

**Rules:**

- Remove special characters (keep only letters, numbers, underscores)
- Replace spaces with underscores
- Use CamelCase or underscore_case
- Maximum clarity for developer name

**Examples:**

- "Notify Manager on Approval" → `Notify_Manager_on_Approval`
- "Send Email to Account Owner" → `Send_Email_to_Account_Owner`
- "Alert Sales Team on High Value Deal" → `Alert_Sales_Team_on_High_Value_Deal`

**Generate fullName automatically from the action description (no need to ask user for this technical detail)**

---

## Step 2: Select Email Template (MANDATORY)

### 2.1 Fetch Email Templates

**Execute SOQL query to fetch ALL email templates:**

```bash
sf data query --query "SELECT Id, DeveloperName, FolderName, Name, Subject FROM EmailTemplate ORDER BY FolderName, DeveloperName" --json
```

**⚠️ CRITICAL: Standard Unified Public Templates use `unfiled$public` as FolderName**

---

### 2.2 Display ALL Templates to User (MANDATORY)

**YOU MUST display in this exact format:**

**Format Requirements:**

- Group by FolderName
- Number each template sequentially
- Show: FolderName/DeveloperName - Name
- Show: Subject line below each template
- Display ALL templates (no truncation, no "and X more")

**Example Display:**

```
Available Email Templates:

[Unfiled Public Classic Email Templates]
1. unfiled$public/SupportCaseAssignmentNotification - Support: Case Assignment Notification
   Subject: Case {!Case.CaseNumber}:"{!Case.Subject}" auto-assigned to you

2. unfiled$public/SupportSelfServiceResetPassword - Support: Self-Service Reset Password
   Subject: Your new GenWatt Self-Service password

3. unfiled$public/MarketingProductInquiryResponse - Marketing: Product Inquiry Response
   Subject: GenWatt: Thanks for your inquiry

[Public Email Templates]
4. Public/Embed_a_Survey_Link - Embed a Survey Link
   Subject: Your feedback is important. Help us to improve by taking this survey.

5. Public/Embed_a_Survey_Question - Embed a Survey Question
   Subject: Your feedback is important. Help us to improve by taking this survey.

[My Personal Email Templates]
6. My Personal Email Templates/Custom_Welcome_Email - Custom Welcome Email
   Subject: Welcome to Our Platform!
```

---

### 2.3 Ask User to Select Template (MANDATORY)

**Ask:** "Which email template would you like to use? (Enter the number)"

**WAIT for user response. DO NOT PROCEED without user selecting a number.**

**After user selects:**

1. Validate the number is within range
2. Extract the template path as `FolderName/DeveloperName`
3. **Store format:** `unfiled$public/SupportCaseAssignmentNotification` (example)

**Example:**

- User selects: 3
- Template path: `unfiled$public/MarketingProductInquiryResponse`

---

## Step 3: Configure Recipients (At Least One Required)

### 3.1 Display ALL 20 Recipient Types

**⚠️ MANDATORY: Display ALL recipient types to user**

```
Email Alert Recipient Types:

Specific Recipients:
1. user - Specific User
2. group - Public Group
3. role - Role
4. roleSubordinates - Role and Subordinates
5. roleSubordinatesInternal - Role and Internal Subordinates

Record-Related:
6. owner - Record Owner
7. creator - Record Creator
8. accountOwner - Account Owner
9. accountCreator - Account Creator

Team-Related:
10. accountTeam - Account Team
11. opportunityTeam - Opportunity Team
12. caseTeam - Case Team

Field-Based:
13. contactLookup - Contact Lookup Field
14. userLookup - User Lookup Field

Portal:
15. portalRole - Portal Role
16. portalRoleSubordinates - Portal Role and Subordinates
17. customerPortalUser - Customer Portal User
18. partnerUser - Partner User

Other:
19. email - Email Address
20. campaignMemberDerivedOwner - Campaign Member Derived Owner
```

**Ask:** "Which recipient type would you like to use? (Enter the number)"

**WAIT for user selection**

---

### 3.2 Handle Recipient Type Selection

Based on the user's selection, follow the appropriate workflow:

---

#### **Type 1: user (Specific User)**

**Step 1: Query Active Users**

```bash
sf data query --query "SELECT Id, Name, Username, Email FROM User WHERE IsActive=true ORDER BY Name" --json
```

**Step 2: Display Users**
Format: `[Number]. [Name] - [Email] ([Username])`

Example:

```
1. John Smith - john.smith@company.com (john.smith@company.com)
2. Jane Doe - jane.doe@company.com (jane.doe@company.com)
3. Bob Johnson - bob.johnson@company.com (bob.johnson@company.com)
```

**Step 3: Ask User to Select**
"Select the user to receive this email alert (enter number):"

**WAIT for selection**

**Step 4: Store Username** (not Name or Email)

**XML Format:**

```xml
<recipients>
    <recipient>john.smith@company.com</recipient>
    <type>user</type>
</recipients>
```

---

#### **Type 2: group (Public Group)**

**Step 1: Query Groups**

```bash
sf data query --query "SELECT Id, Name, DeveloperName FROM Group WHERE Type='Regular' ORDER BY Name" --json
```

**Step 2: Display Groups**
Format: `[Number]. [Name] ([DeveloperName])`

Example:

```
1. Sales Team (Sales_Team)
2. Marketing Group (Marketing_Group)
3. Support Staff (Support_Staff)
```

**Step 3: Ask User to Select**
"Select the group to receive this email alert (enter number):"

**WAIT for selection**

**Step 4: Store DeveloperName**

**XML Format:**

```xml
<recipients>
    <recipient>Sales_Team</recipient>
    <type>group</type>
</recipients>
```

---

#### **Type 3, 4, 5: role, roleSubordinates, roleSubordinatesInternal**

**Step 1: Query User Roles**

```bash
sf data query --query "SELECT Id, Name, DeveloperName FROM UserRole ORDER BY Name" --json
```

**Step 2: Display Roles**
Format: `[Number]. [Name] ([DeveloperName])`

Example:

```
1. CEO (CEO)
2. Sales Manager (Sales_Manager)
3. VP of Marketing (VP_Marketing)
```

**Step 3: Ask User to Select**
"Select the role to receive this email alert (enter number):"

**WAIT for selection**

**Step 4: Store DeveloperName**

**XML Format (based on type):**

```xml
<!-- role -->
<recipients>
    <recipient>Sales_Manager</recipient>
    <type>role</type>
</recipients>

<!-- roleSubordinates -->
<recipients>
    <recipient>Sales_Manager</recipient>
    <type>roleSubordinates</type>
</recipients>

<!-- roleSubordinatesInternal -->
<recipients>
    <recipient>Sales_Manager</recipient>
    <type>roleSubordinatesInternal</type>
</recipients>
```

---

#### **Type 6-12, 15-18, 20: Contextual Recipients (No Additional Input)**

These recipient types are contextual and don't require additional selection:

- **owner** - Record Owner
- **creator** - Record Creator
- **accountOwner** - Account Owner
- **accountCreator** - Account Creator
- **accountTeam** - Account Team
- **opportunityTeam** - Opportunity Team
- **caseTeam** - Case Team
- **portalRole** - Portal Role
- **portalRoleSubordinates** - Portal Role and Subordinates
- **customerPortalUser** - Customer Portal User
- **partnerUser** - Partner User
- **campaignMemberDerivedOwner** - Campaign Member Derived Owner

**No query needed - just use the type**

**XML Format:**

```xml
<recipients>
    <type>owner</type>
</recipients>
```

---

#### **Type 13: contactLookup (Contact Lookup Field)**

**Step 1: Query Contact Lookup Fields**

```bash
sf data query --query "SELECT QualifiedApiName, Label FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName='[ObjectApiName]' AND DataType='Lookup' AND ReferenceTo='Contact' ORDER BY Label" --json
```

**Step 2: Display Contact Lookup Fields**
Format: `[Number]. [Label] ([QualifiedApiName])`

Example:

```
1. Primary Contact (Primary_Contact__c)
2. Billing Contact (Billing_Contact__c)
3. Technical Contact (Technical_Contact__c)
```

**Step 3: Ask User to Select**
"Select the contact lookup field (enter number):"

**WAIT for selection**

**Step 4: Store Field API Name**

**XML Format:**

```xml
<recipients>
    <field>Primary_Contact__c</field>
    <type>contactLookup</type>
</recipients>
```

---

#### **Type 14: userLookup (User Lookup Field)**

**Step 1: Query User Lookup Fields**

```bash
sf data query --query "SELECT QualifiedApiName, Label FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName='[ObjectApiName]' AND DataType='Lookup' AND ReferenceTo='User' ORDER BY Label" --json
```

**Step 2: Display User Lookup Fields**
Format: `[Number]. [Label] ([QualifiedApiName])`

Example:

```
1. Account Manager (Account_Manager__c)
2. Technical Lead (Technical_Lead__c)
3. Sales Rep (Sales_Rep__c)
```

**Step 3: Ask User to Select**
"Select the user lookup field (enter number):"

**WAIT for selection**

**Step 4: Store Field API Name**

**XML Format:**

```xml
<recipients>
    <field>Account_Manager__c</field>
    <type>userLookup</type>
</recipients>
```

---

#### **Type 19: email (Direct Email Address)**

**Ask:** "Enter the email address to receive this alert:"

**WAIT for user input**

**Validate:** Ensure email format is valid (contains @, domain, etc.)

**XML Format:**

```xml
<recipients>
    <recipient>notifications@company.com</recipient>
    <type>email</type>
</recipients>
```

---

### 3.3 Multiple Recipients (Optional)

**After adding first recipient, ask:** "Would you like to add another recipient? (yes/no)"

**If YES:** Repeat Step 3.1 - 3.2 for additional recipients

**If NO:** Proceed to Step 4

**Note:** An email alert can have multiple `<recipients>` blocks

---

## Step 4: Configure Sender Type

**⚠️ MANDATORY: Display ALL 3 sender types**

```
Email Sender Types:
1. CurrentUser - Current User (person who triggers the action)
2. OrgWideEmailAddress - Organization-Wide Email Address
3. DefaultWorkflowUser - Default Workflow User
```

**Ask:** "Which sender type would you like to use? (Enter the number)"

**WAIT for user selection**

---

### 4.1 If CurrentUser or DefaultWorkflowUser Selected

**No additional input needed**

**XML Format:**

```xml
<senderType>CurrentUser</senderType>
```

OR

```xml
<senderType>DefaultWorkflowUser</senderType>
```

---

### 4.2 If OrgWideEmailAddress Selected

**Step 1: Query Organization-Wide Email Addresses**

```bash
sf data query --query "SELECT Id, Address, DisplayName FROM OrgWideEmailAddress ORDER BY DisplayName" --json
```

**Step 2: Display Org-Wide Email Addresses**
Format: `[Number]. [DisplayName] - [Address]`

Example:

```
1. Company Support - support@company.com
2. No Reply - noreply@company.com
3. Sales Team - sales@company.com
```

**Step 3: Ask User to Select**
"Select the organization-wide email address (enter number):"

**WAIT for selection**

**Step 4: Store Address (not DisplayName)**

**XML Format:**

```xml
<senderType>OrgWideEmailAddress</senderType>
<senderAddress>noreply@company.com</senderAddress>
```

---

## Step 5: CC Emails (Optional)

**Ask:** "Would you like to add CC email addresses? (yes/no)"

**If NO:** Skip to Step 6

**If YES:**

- Ask: "Enter CC email addresses (comma-separated):"
- **WAIT for user input**
- Validate email format
- Store as comma-separated list

**XML Format:**

```xml
<ccEmails>manager@company.com,director@company.com</ccEmails>
```

**Note:** Only include `<ccEmails>` tag if user wants to add CC recipients

---

## Step 6: Generate Email Alert XML

**Create the following XML structure:**

```xml
<alerts>
    <fullName>Auto_Generated_Developer_Name</fullName>
    <description>User-provided description</description>
    <protected>false</protected>
    <recipients>
        <recipient>Value</recipient>  <!-- IF type requires (user, group, role, email) -->
        <field>FieldName</field>  <!-- ONLY for contactLookup/userLookup -->
        <type>Type</type>
    </recipients>
    <senderType>Type</senderType>
    <senderAddress>Address</senderAddress>  <!-- ONLY for OrgWideEmailAddress -->
    <template>Folder/Template</template>
    <ccEmails>email@example.com</ccEmails>  <!-- ONLY if user specified CC -->
</alerts>
```

---

### 6.1 XML Structure Rules

**⚠️ CRITICAL XML RULES:**

| Recipient Type                                                       | Includes `<recipient>` | Includes `<field>` | Only `<type>` |
| -------------------------------------------------------------------- | ---------------------- | ------------------ | ------------- |
| user, group, role, roleSubordinates, roleSubordinatesInternal, email | ✅ Yes                 | ❌ No              | ❌ No         |
| contactLookup, userLookup                                            | ❌ No                  | ✅ Yes             | ❌ No         |
| owner, creator, accountOwner, accountCreator, accountTeam, etc.      | ❌ No                  | ❌ No              | ✅ Yes        |

**Sender Rules:**

- Include `<senderAddress>` **ONLY** when `<senderType>` = `OrgWideEmailAddress`
- Do NOT include `<senderAddress>` for CurrentUser or DefaultWorkflowUser

**CC Emails:**

- Include `<ccEmails>` **ONLY** if user explicitly requested CC recipients
- Do NOT include empty `<ccEmails>` tag

---

### 6.2 Complete Examples

**Example 1: User Recipient with Default Workflow User Sender**

```xml
<alerts>
    <fullName>Notify_Sales_Manager_on_Approval</fullName>
    <description>Send email to Sales Manager when opportunity is approved</description>
    <protected>false</protected>
    <recipients>
        <recipient>john.smith@company.com</recipient>
        <type>user</type>
    </recipients>
    <senderType>DefaultWorkflowUser</senderType>
    <template>unfiled$public/SupportCaseAssignmentNotification</template>
</alerts>
```

**Example 2: Record Owner with Org-Wide Email Address**

```xml
<alerts>
    <fullName>Alert_Account_Owner</fullName>
    <description>Alert account owner when record is updated</description>
    <protected>false</protected>
    <recipients>
        <type>owner</type>
    </recipients>
    <senderType>OrgWideEmailAddress</senderType>
    <senderAddress>noreply@company.com</senderAddress>
    <template>Public/Account_Update_Notification</template>
</alerts>
```

**Example 3: Multiple Recipients with CC**

```xml
<alerts>
    <fullName>Notify_Sales_Team_High_Value_Deal</fullName>
    <description>Notify sales team and management on high value deals</description>
    <protected>false</protected>
    <recipients>
        <recipient>Sales_Team</recipient>
        <type>group</type>
    </recipients>
    <recipients>
        <recipient>Sales_Manager</recipient>
        <type>role</type>
    </recipients>
    <recipients>
        <type>accountOwner</type>
    </recipients>
    <senderType>OrgWideEmailAddress</senderType>
    <senderAddress>sales@company.com</senderAddress>
    <template>unfiled$public/MarketingProductInquiryResponse</template>
    <ccEmails>vp-sales@company.com,director@company.com</ccEmails>
</alerts>
```

**Example 4: User Lookup Field**

```xml
<alerts>
    <fullName>Alert_Account_Manager</fullName>
    <description>Send alert to Account Manager field</description>
    <protected>false</protected>
    <recipients>
        <field>Account_Manager__c</field>
        <type>userLookup</type>
    </recipients>
    <senderType>CurrentUser</senderType>
    <template>unfiled$public/SupportSelfServiceResetPassword</template>
</alerts>
```

---

## Step 7: Update Workflow File

### 7.1 Read Existing Workflow File

**Path:** `force-app/main/default/workflows/{ObjectApiName}.workflow-meta.xml`

**Examples:**

- Account: `force-app/main/default/workflows/Account.workflow-meta.xml`
- Opportunity: `force-app/main/default/workflows/Opportunity.workflow-meta.xml`
- Custom Object: `force-app/main/default/workflows/Custom_Object__c.workflow-meta.xml`

**Use Read tool to open the file**

---

### 7.2 If File Doesn't Exist, Create New File

**If workflow file doesn't exist, create it with this structure:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">
</Workflow>
```

---

### 7.3 Insert New `<alerts>` Block

**Rules:**

- Insert BEFORE the closing `</Workflow>` tag
- Maintain proper XML indentation (4 spaces)
- If other `<alerts>` blocks exist, add the new one after them
- Each email alert is a separate `<alerts>` block

**Example workflow file with multiple alerts:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">
    <alerts>
        <fullName>Existing_Email_Alert</fullName>
        <description>Existing alert</description>
        <protected>false</protected>
        <recipients>
            <type>owner</type>
        </recipients>
        <senderType>DefaultWorkflowUser</senderType>
        <template>unfiled$public/SomeTemplate</template>
    </alerts>
    <alerts>
        <fullName>New_Email_Alert</fullName>
        <description>New alert being added</description>
        <protected>false</protected>
        <recipients>
            <recipient>user@example.com</recipient>
            <type>user</type>
        </recipients>
        <senderType>CurrentUser</senderType>
        <template>Public/NewTemplate</template>
    </alerts>
</Workflow>
```

---

### 7.4 Write Updated Workflow File

**Use Write or Edit tool to save the updated workflow file**

**Confirm to user:** "Created email alert: [FullName] in workflow file"

---

## Step 8: Reference in Approval Process (If Applicable)

**If creating email alert for an Approval Process, return the reference information:**

**XML Reference Structure:**

```xml
<action>
    <name>Auto_Generated_Developer_Name</name>
    <type>Alert</type>
</action>
```

**Tell the user:** "This email alert should be added to the approval process in the appropriate action section:"

- Initial submission → `<initialSubmissionActions>`
- Final approval → `<finalApprovalActions>`
- Final rejection → `<finalRejectionActions>`
- Recall → `<recallActions>`

**The main approval process workflow will handle adding this reference.**

---

## Step 9: Deployment Order (CRITICAL)

**⚠️ MANDATORY: When creating new email alerts for approval processes:**

### Deployment Sequence

**1. Deploy workflow file FIRST**

```bash
sf project deploy start --source-dir force-app/main/default/workflows/{ObjectApiName}.workflow-meta.xml
```

**Example:**

```bash
sf project deploy start --source-dir force-app/main/default/workflows/Account.workflow-meta.xml
```

**2. Wait for deployment success**

- Check for deployment completion
- Verify no errors occurred

**3. THEN deploy approval process file**

```bash
sf project deploy start --source-dir force-app/main/default/approvalProcesses/{ObjectApiName}.{ProcessName}.approvalProcess-meta.xml
```

**Example:**

```bash
sf project deploy start --source-dir force-app/main/default/approvalProcesses/Account.Account_Approval_Process.approvalProcess-meta.xml
```

### Why This Order Matters

**Reason:** Approval processes reference workflow actions by name. The workflow actions must exist in the Salesforce org before the approval process that references them can be deployed.

**If you deploy in wrong order:** Deployment will fail with error: "Email Alert 'XYZ' not found"

---

## Summary Checklist

Before completing email alert creation, verify:

- [ ] Auto-generated developer name (fullName) from description
- [ ] Fetched ALL email templates using SOQL query
- [ ] Displayed ALL templates to user in correct format (grouped by folder, with subject)
- [ ] WAITED for user to select template number
- [ ] Displayed ALL 20 recipient types
- [ ] Collected at least one recipient
- [ ] For specific recipients (user/group/role): Queried and displayed all options, user selected
- [ ] Displayed all sender types, user selected one
- [ ] If OrgWideEmailAddress: Queried and displayed all options, user selected
- [ ] Generated correct XML structure with appropriate tags
- [ ] Used correct recipient XML format based on type
- [ ] Included `<senderAddress>` ONLY if OrgWideEmailAddress
- [ ] Included `<ccEmails>` ONLY if user specified CC
- [ ] Updated workflow file with new `<alerts>` block
- [ ] Noted deployment order (workflow FIRST, then approval process)
- [ ] Returned reference information for approval process

---

## Common Mistakes to Avoid

❌ **DON'T:**

- Create email alert without fetching and displaying templates
- Auto-select template without user choosing
- Skip displaying recipient types
- Use Name instead of DeveloperName/Username for specific recipients
- Include `<recipient>` tag for contextual types (owner, creator, etc.)
- Include `<senderAddress>` for CurrentUser or DefaultWorkflowUser
- Include empty `<ccEmails>` tag
- Deploy approval process before workflow file

✅ **DO:**

- ALWAYS fetch and display ALL email templates
- ALWAYS wait for user to select template by number
- Display all 20 recipient types
- Query and display options for user/group/role recipients
- Use correct XML structure based on recipient type
- Include `<senderAddress>` ONLY for OrgWideEmailAddress
- Include `<ccEmails>` ONLY if user specified CC recipients
- Deploy workflow file first, then approval process
- Validate email format for direct email addresses

---

## Return to Main Workflow

After completing email alert creation, return control to the main approval process or workflow instructions that called this guide.

**Provide summary:** "Created email alert '[FullName]' with template '[Template]' sending to [RecipientCount] recipient(s)"

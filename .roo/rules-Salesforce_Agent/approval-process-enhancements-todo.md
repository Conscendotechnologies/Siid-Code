# Approval Process Guideline - Enhancement Backlog

This document contains identified enhancements to be added to the approval-process.md guideline later.

---

## Missing Points to Add:

### 1. **Process Order Configuration** (Section 2 or new section)

- **What:** `processOrder` field - determines execution order when multiple approval processes exist for same object
- **Why missing:** Guide mentions it in the XML example (line 469) but doesn't explain it or ask the user about it
- **Suggested addition:** Ask user if multiple processes exist, which order this should run

### 2. **Show Approval History Setting** (Section 2 or 4)

- **What:** `showApprovalHistory` field - controls visibility of approval history
- **Why missing:** Not mentioned in guide but exists in schema and example XML (line 471)
- **Suggested addition:** Ask "Should approval history be visible on record page?"

### 3. **Enable Mobile Device Access** (Section 2 or 4)

- **What:** `enableMobileDeviceAccess` field - allows/blocks mobile approval
- **Why missing:** Shown in XML example (line 454) but never explained or collected
- **Suggested addition:** Ask "Should approvers be able to approve from mobile devices?"

### 4. **Post Template (Chatter)** (Section 5)

- **What:** `postTemplate` field - Chatter post template for notifications
- **Why missing:** Guide covers emailTemplate but not postTemplate for Chatter
- **Suggested addition:** Ask about Chatter template in addition to email template

### 5. **Record Lock Settings - More Detail** (Section 9 or 10)

- **What:** `finalApprovalRecordLock` and `finalRejectionRecordLock`
- **Why missing:** Shown in XML (lines 462-463) but never explained or asked about
- **Current state:** Set to false by default, but user should be consulted
- **Suggested addition:** Ask "Should records be locked after final approval/rejection?"

### 6. **Step Rejection Behavior** (Section 9.4)

- **What:** `rejectBehavior` with type `RejectRequest` or `BackToPrevious`
- **Why missing:** Schema shows this option but guide doesn't mention it
- **Suggested addition:** For multi-step processes, ask "If rejected, should it end the process or go back to previous step?"

### 7. **User Hierarchy Field Approver Type** (Section 9.3)

- **What:** `userHierarchyField` as an approver type (distinct from relatedUserField)
- **Why missing:** Guide shows nextAutomatedApprover but doesn't explain userHierarchyField as an approver type
- **Suggested addition:** Clarify the difference between relatedUserField and userHierarchyField

### 8. **Additional ProcessSubmitterType Options** (Section 7)

- **What:** Missing types: `roleSubordinatesInternal`, `partnerUser`, `customerPortalUser`, `portalRole`, `portalRoleSubordinates`, `allInternalUsers`
- **Why missing:** Guide covers basic types but not all portal/community user types
- **Suggested addition:** Add these options for orgs with communities/portals

### 9. **Approval Step - GotoNextStep Option** (Section 9.2)

- **What:** `ifCriteriaNotMet` can also be `GotoNextStep` (in addition to ApproveRecord/RejectRecord)
- **Why missing:** Guide shows Approve/Reject but not GotoNextStep
- **Suggested addition:** Add option "Go to next step" when criteria not met

### 10. **Step-Level Approval and Rejection Actions** (Section 9 or 10)

- **What:** Each approval step can have its own `approvalActions` and `rejectionActions`
- **Why missing:** Guide mentions step-specific actions in section 10 intro (line 338) but doesn't detail how to configure them per step
- **Suggested addition:** When creating each step, ask about actions for that specific step

### 11. **Boolean Filter for Entry Criteria** (Section 3)

- **What:** `booleanFilter` field for complex logic like "(1 AND 2) OR 3"
- **Why missing:** Guide asks "ALL or ANY" but doesn't explain custom boolean logic
- **Suggested addition:** Add option for custom boolean filter with numbered criteria

### 12. **ValueField in Filter Criteria** (Section 3)

- **What:** `valueField` allows comparing one field to another field (not just static value)
- **Why missing:** Guide shows static values only
- **Suggested addition:** Ask "Compare to a value or to another field?"

### 13. **FlowAutomation vs FlowAction** (Section 10.4)

- **What:** Schema shows both `Flow` and `FlowAutomation` as distinct action types
- **Why missing:** Guide shows "Flow" but doesn't distinguish types
- **Suggested addition:** Clarify which flow type to use

---

## Implementation Priority

### High Priority (Essential for basic scenarios):

- TBD based on user input

### Medium Priority (Common scenarios):

- TBD based on user input

### Low Priority (Advanced/edge cases):

- TBD based on user input

---

## Notes

- Document created: 2025-12-18
- Source: Comparison between approval-process.md and Salesforce Metadata WSDL Schema

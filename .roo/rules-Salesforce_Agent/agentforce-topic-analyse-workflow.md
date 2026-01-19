# Agentforce Topic Analysis Workflow

**Purpose:** This workflow is for **analysis only**. It identifies issues and provides recommendations without making changes. Use this when analyzing an agent's topics to suggest improvements.

**Important:** Always present findings and recommendations to the user for confirmation before making any changes.

## Before Starting: Create Task-Specific Todo List

**CRITICAL:** Before using any other tools, create a todo list specific to this topic analysis task:

```
[ ] Collect topic name and agent name
[ ] Collect target org information
[ ] Retrieve topic configuration files
[ ] Analyze topic structure and naming
[ ] Review instruction clarity and completeness
[ ] Check action count and alignment
[ ] Validate action configurations
[ ] Verify schema files exist and are correct
[ ] Check integration with agent
[ ] Identify critical/high/medium/low issues
[ ] Generate detailed findings report
[ ] Present recommendations to user
[ ] Wait for user confirmation
```

**Do NOT use generic template** - this is the actual sequence for topic analysis.

## Workflow Steps

### Step 1: Identify Topic to Analyze

Collect from user (if not in prompt):

- Topic name or API name
- Agent name (if topic is local)
- Target org (to retrieve configuration)
- Analysis scope (single topic vs all topics in agent)

### Step 2: Retrieve Topic Configuration

**For Local Topics (in GenAiPlannerBundle):**

```bash
sf project retrieve start --metadata GenAiPlannerBundle:<AgentName> --target-org <org>
```

### Step 3: Locate Topic Files

**Local Topics:**

- File: `force-app/main/default/genAiPlannerBundles/<AgentName>/<AgentName>.genAiPlannerBundle-meta.xml`
- Look for `<localTopics>` section

**Associated Actions:**

- Local actions: Inside `<localActions>` within the topic
- Global actions: Separate files in `genAiFunctions/` directory
- Apex classes: In `classes/` directory (for invocable actions)

### Step 4: Analyze Topic Configuration

#### A. Topic Structure Analysis

**Check the following:**

- **Topic Type:** Is it local or global?

    - ✅ Local topics for agent-specific functionality
    - ⚠️ Global topics should only be used for cross-agent reusability
    - ❌ Global topic used for single agent (should be local)

- **Naming Conventions:**

    - `fullName`: Should be `Topic_Name_UniqueId` format
    - `developerName`: Should match fullName
    - `localDeveloperName`: Should be clean name without suffix
    - `masterLabel`: Human-readable display name
    - Consistent naming across fields

- **Description Quality:**

    - ✅ Clear, specific description of topic's purpose
    - ⚠️ Vague or generic descriptions
    - ❌ Missing description

- **Scope Definition:**
    - ✅ Clear boundaries of what topic handles
    - ✅ Specific enough to avoid overlap
    - ✅ Broad enough to be useful
    - ⚠️ Too broad or too narrow
    - ❌ Missing or unclear scope

#### B. Instructions Analysis

**Review `<genAiPluginInstructions>` sections:**

**Clarity Issues:**

- Ambiguous language or unclear steps
- Missing context or background information
- Assumptions not stated
- Technical jargon without explanation

**Completeness Issues:**

- Missing step-by-step procedures
- Incomplete workflows
- No examples provided
- Edge cases not covered
- Error handling not addressed

**Consistency Issues:**

- Contradictory instructions
- Inconsistent terminology
- Conflicting guidance
- Language inconsistencies

**Structure Issues:**

- Poor organization or flow
- Missing logical progression
- Too verbose or too brief
- No formatting or emphasis

**Quality Checklist:**

- [ ] Instructions are clear and unambiguous
- [ ] Step-by-step procedures are complete
- [ ] Examples are provided where helpful
- [ ] Edge cases and exceptions are covered
- [ ] Error scenarios are addressed
- [ ] Terminology is consistent
- [ ] Language is professional and clear
- [ ] Instructions align with topic scope

#### C. Actions Analysis

**Action Count:**

- ✅ 1-2 actions per topic (recommended)
- ⚠️ 3+ actions (consider splitting topic)
- ❌ 0 actions (topic cannot function)
- ❌ Too many actions (topic too broad)

**Action Alignment:**

- Do actions match topic purpose?
- Are actions necessary for topic functionality?
- Are there redundant actions?
- Are there missing essential actions?

**Action Configuration:**

- **For Local Actions:**

    - Defined in `<localActions>` within topic
    - Linked via `<localActionLinks>` with correct `functionName`
    - Schema files exist: `input/schema` and `output/schema`
    - Schemas match Apex `@InvocableVariable` parameters

- **For Global Actions:**
    - Referenced via `<genAiFunctions>` with correct `functionName`
    - GenAiFunction file exists and is valid
    - Action is genuinely reusable (not agent-specific)

**Action Details:**

- `invocationTarget`: Apex class name is correct
- `invocationTargetType`: Set to "apex" for Apex actions
- `isConfirmationRequired`: Appropriate for action type
- `description`: Clear explanation of what action does
- `masterLabel`: Human-readable action name

**Apex Implementation (if applicable):**

- Apex class exists and is deployed
- Method is `@InvocableMethod` annotated
- Input/output variables match schema files
- Error handling implemented
- Test coverage exists

#### D. Integration Analysis

**Agent Context:**

- Does topic align with agent's overall role?
- Is topic necessary for agent functionality?
- Does topic overlap with other topics?
- Is topic priority appropriate?
- Are there gaps this topic should fill?

**Topic Relationships:**

- Check for overlapping scopes with other topics
- Identify missing related topics
- Verify logical topic grouping
- Check topic escalation settings

**Linked Properly:**

- Topic is linked in agent's `<localTopicLinks>` or global references
- All actions are properly linked to topic
- No broken references

### Step 5: Identify Issues and Rate Severity

**Critical Issues (Must Fix):**

- Broken action references
- Missing required fields
- Syntax errors in XML
- Security vulnerabilities
- Missing schema files for local actions
- Non-existent Apex classes referenced

**High Priority Issues:**

- Unclear or ambiguous instructions
- Missing essential actions
- Topic scope too broad or undefined
- Missing error handling in instructions
- Incorrect topic type (global when should be local)
- Actions don't match topic purpose

**Medium Priority Issues:**

- Suboptimal instruction organization
- Missing examples in instructions
- Too many or too few actions
- Naming convention violations
- Missing edge case handling
- Generic descriptions

**Low Priority Issues:**

- Formatting improvements
- Documentation enhancements
- Terminology consistency
- Minor wording improvements

### Step 6: Generate Analysis Report

**IMPORTANT:** This is the main deliverable. Present this report to the user for review.

Create structured report with:

**Executive Summary:**

- Topic name and type
- Overall assessment (healthy/needs improvement/critical issues)
- Number of issues by severity
- Key recommendations (suggestions only, not changes)

**Detailed Findings:**

For each issue found:

1. **Issue Description:** What is wrong?
2. **Location:** File path, XML element, line number
3. **Severity:** Critical/High/Medium/Low
4. **Impact:** What problems does this cause?
5. **Current State:** Show problematic code/config
6. **Recommended Fix:** Show corrected version
7. **Explanation:** Why this fix improves the topic

**Topic Structure Assessment:**

- Configuration quality score
- Instruction clarity score
- Action completeness score
- Integration quality score

**Improvement Opportunities:**

- Quick wins (easy, high-impact fixes)
- Strategic improvements (more effort, significant benefit)
- Future enhancements (nice-to-have)

### Step 7: Provide Improvement Recommendations

**Note:** These are suggestions only. Present to user and wait for confirmation before making any changes.

**Configuration Improvements:**

- Fix naming conventions
- Improve descriptions
- Optimize scope definition
- Convert global to local (if applicable)

**Instruction Improvements:**

- Rewrite unclear instructions
- Add missing steps or examples
- Reorganize for better flow
- Add edge case handling
- Improve formatting and structure

**Action Improvements:**

- Add missing actions
- Remove redundant actions
- Fix action configurations
- Create/update schema files
- Improve action descriptions

**If New Apex Actions Needed:**

- **SALESFORCE AGENT MODE MUST NEVER WRITE APEX CODE**
- **Must delegate to Code mode** for any Apex action creation
- When creating subtask or switching to Code mode, specify: **"Follow the guide in .roo/rules-code/agentforce-apex-guide.md to create an invocable Apex action"**
- **Do NOT use apex-guide.md** - only agentforce-apex-guide.md is for invocable actions
- Wait for Code mode to complete and deploy the Apex class
- Update local action to reference the created Apex class

**Integration Improvements:**

- Adjust topic priority
- Split overly broad topics
- Merge related topics
- Fill functionality gaps
- Improve topic relationships

### Step 8: Wait for User Confirmation

**After presenting the analysis report:**

1. **Ask user:** "Would you like me to implement any of these recommendations?"
2. **Wait for explicit confirmation** before making changes
3. **If user approves changes:**
    - Switch to **agentforce-agent-analyse-workflow.md** for implementation
    - That workflow handles making changes and deployment
4. **If user wants more details:**
    - Provide deeper analysis on specific issues
    - Explain reasoning behind recommendations
5. **If user declines:**
    - Analysis complete, no changes made

**Remember:** This workflow is for analysis only. Do not modify files or deploy without explicit user approval.

---

## Example 1: Analyze Local Topic

**User request:** "Analyze the 'Complaint Handling' topic in my Resort Manager agent"

**Step 1:** Collect agent name (Resort_Manager) and org

**Step 2:** Retrieve agent configuration

```bash
sf project retrieve start --metadata GenAiPlannerBundle:Resort_Manager --target-org my-org
```

**Step 3:** Locate topic in `genAiPlannerBundles/Resort_Manager/Resort_Manager.genAiPlannerBundle-meta.xml`

**Step 4:** Analyze:

- Topic structure: Local topic ✅
- Naming: `Complaint_Handling_123` ✅
- Description: "Handle complaints" ⚠️ (too vague)
- Scope: "Process customer complaints and escalate as needed" ✅
- Instructions: Missing step-by-step procedure ❌
- Actions: 0 actions ❌ (cannot function)

**Step 5:** Issues identified:

- **Critical:** No actions defined - topic cannot perform any operations
- **High:** Instructions are incomplete - missing detailed steps
- **Medium:** Description is too generic - should be more specific

**Step 6:** Generate report:

```
EXECUTIVE SUMMARY:
Topic: Complaint_Handling_123 (Local)
Status: Critical Issues Found
Total Issues: 3 (1 Critical, 1 High, 1 Medium)

CRITICAL ISSUES:
1. No actions defined
   - Location: localActions section (missing)
   - Impact: Topic cannot execute any operations
   - Fix: Add local action for complaint processing

HIGH PRIORITY:
2. Incomplete instructions
   - Location: genAiPluginInstructions
   - Impact: Agent doesn't know how to use topic effectively
   - Fix: Add step-by-step complaint handling procedure

MEDIUM PRIORITY:
3. Generic description
   - Current: "Handle complaints"
   - Recommended: "Process customer complaints, log details, categorize by severity, and route to appropriate team"
```

**Step 7:** Recommend enhancements:

1. Add local action "ProcessComplaint" with Apex invocable method
2. Rewrite instructions with clear steps
3. Improve description with specific details
4. Add action for escalation if needed

**Step 8:** Present recommendations to user:

- "I found 3 issues in the Complaint Handling topic. Would you like me to implement these fixes?"
- Wait for user confirmation
- If approved, use agent-analyse-workflow to make changes

---

## Example 2: Analyze Global Topic (Should Be Local)

**User request:** "Analyze the 'Check Inventory' topic"

**Step 2:** Retrieve global topic

```bash
sf project retrieve start --metadata GenAiPlugin:Check_Inventory --target-org my-org
```

**Step 4:** Analyze:

- Topic structure: Global topic ⚠️
- Used by: Only 1 agent (Inventory_Manager)
- Actions: 1 custom action specific to one org's inventory system

**Step 5:** Issues identified:

- **High:** Global topic used for single agent (should be local)
- Impact: Harder to maintain, cannot customize per agent

**Step 6:** Report recommends converting to local topic

**Step 7:** Recommend:

1. Convert Check_Inventory from global to local topic
2. Move topic definition into agent's GenAiPlannerBundle
3. Convert global action to local action
4. Delete global GenAiPlugin file
5. Update topic reference in agent

**Step 8:** Ask user: "This global topic is only used by one agent. Should I convert it to a local topic?"

---

## Example 3: Analyze Topic with Poor Instructions

**User request:** "The 'Schedule Meeting' topic isn't working well, analyze it"

**Step 4:** Analyze instructions:

**Current Instructions:**

```
Use this topic to schedule meetings. Check availability and book the meeting.
```

**Issues Found:**

- ❌ No step-by-step procedure
- ❌ No examples provided
- ❌ Doesn't explain what information is needed
- ❌ Doesn't handle edge cases (conflicts, timezone)
- ❌ No error handling guidance

**Step 6:** Report includes:

**INSTRUCTION ISSUES:**

1. Missing required information
    - No guidance on what inputs are needed (date, time, participants, duration)
    - Agent won't know what to ask user
2. No procedural steps

    - Should outline: collect info → validate → check conflicts → book → confirm

3. Edge cases ignored
    - Time zone conflicts not addressed
    - Overlapping meetings not handled
    - Participant availability not checked

**Step 7:** Recommend rewrite:

**Enhanced Instructions:**

```
Use this topic to schedule meetings with proper validation and conflict checking.

REQUIRED INFORMATION:
- Meeting date and time (with timezone)
- Duration (in minutes)
- Participant email addresses
- Meeting subject and description

STEPS:
1. Collect all required meeting details from user
2. Validate date/time is in the future
3. Convert all times to consistent timezone
4. Check participant availability using CheckAvailability action
5. If conflicts found, suggest alternative times
6. If no conflicts, book meeting using ScheduleMeeting action
7. Send confirmation with meeting details and calendar invite link

EDGE CASES:
- If timezone not specified, ask user to clarify
- If participants have conflicts, list who and when
- If booking fails, inform user and suggest manual booking
- For recurring meetings, confirm pattern with user first

EXAMPLES:
- "Schedule a 30-minute meeting with john@example.com tomorrow at 2pm PST"
- "Book a team standup every weekday at 9am for the next month"
```

**Step 8:** Present to user:

- "The instructions are incomplete and missing edge case handling. I've drafted improved instructions above. Would you like me to update the topic with these enhanced instructions?"

---

## Related Resources

**For creating/modifying topics and actions:**

- **`.roo/rules-Salesforce_Agent/agentforce-topics-actions-guide.md`**
    - Local vs global structure
    - XML syntax and examples
    - Schema file creation
    - Best practices

**For creating Apex actions:**

- **`.roo/rules-code/agentforce-apex-guide.md`** (delegate to Code mode)
    - Invocable method patterns
    - Parameter handling
    - Error handling
    - Testing requirements

**For full agent analysis:**

- **`.roo/rules-Salesforce_Agent/agentforce-agent-analyse-workflow.md`**
    - Complete agent review
    - Multi-topic analysis
    - Agent-level improvements

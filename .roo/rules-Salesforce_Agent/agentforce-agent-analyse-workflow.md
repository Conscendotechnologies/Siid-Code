# Agentforce Agent Analyse And Enhance Workflow

**Purpose:** This workflow analyzes Salesforce Agentforce agent configuration, structure, instructions, topics, and actions to understand agent behavior, identify issues, and enable effective enhancements. Provides comprehensive agent analysis including scenario explanation, statistics, action logic, and detailed topic/action instructions.

**Agent Analysis Focus:**

- ✅ **Agent Scenario** - What the agent was developed for (clear, understandable explanation)
- ✅ **Agent Statistics** - Number of topics, number of actions, key metrics
- ✅ **Agent Actions** - List of actions, Apex classes used, and detailed action logic explanation
- ✅ **Agent Instructions** - Complete explanation of all instructions in topics
- ✅ **Instruction clarity, completeness, and correctness**
- ✅ **Topic structure and organization**
- ✅ **Action configuration and bindings**

**CRITICAL EXECUTION RULES:**

1. **Execute the workflow completely** - don't stop after creating todo list
2. **Ask for missing info immediately** and continue once you have it
3. **Be proactive** - proceed through all steps without unnecessary pauses
4. **Focus on comprehensive analysis** - explain agent clearly in structured format
5. **Retrieve from workspace/org** - check local workspace first, retrieve from org if needed
6. **Get user confirmation before making changes** - analysis-only until approved

**Important:** This is analysis-only. Present findings to user for confirmation before making changes.

## Before Starting: Create Task-Specific Todo List

**CRITICAL:** Before using any other tools, create a todo list specific to this agent analysis task:

```
[ ] Collect agent name from user
[ ] Check if agent exits in local workspace
[ ] (If not in workspace) Retrieve agent using CLI commands
[ ] (If not in workspace) Retrieve related plugins/functions if used
[ ] (If not in workspace) Retrieve apex classes from agent XML
[ ] Analyze and understand agent scenario
[ ] Document agent scenario clearly
[ ] Generate agent statistics (topics, actions count)
[ ] List all actions with apex classes used
[ ] Explain action logic for each action
[ ] Extract and explain all topic instructions
[ ] Identify quality issues and improvement opportunities
[ ] Generate detailed analysis report with all sections
[ ] Present findings to user
[ ] Wait for user confirmation on enhancements
[ ] (If approved) Modify agent configuration
[ ] (If approved) Deploy enhanced agent
```

**Do NOT use generic template** - this is the actual sequence for comprehensive agent analysis.

## Workflow Steps

### Step 1: Collect Agent Name and Retrieve Latest Version

**Get from user (if not in prompt):**

- Agent name or API name to analyze

**ALWAYS retrieve latest from org (even if in workspace):**

**IMPORTANT:** Convert agent label to API name by replacing spaces with underscores (e.g., "Hotel Booking Agent" → "Hotel_Booking_Agent")

**Immediately run these 4 retrieval commands in sequence:**

```bash
sf project retrieve start --metadata GenAiPlannerBundle:Agent_Name
sf project retrieve start --metadata Bot:Agent_Name
sf project retrieve start --metadata GenAiPlugin
sf project retrieve start --metadata GenAiFunction
```

**Why retrieve even if agent exists in workspace?**

- ✅ Ensures we have the **latest version** from org
- ✅ Catches any changes made directly in org (outside workspace)
- ✅ Prevents analyzing **outdated workspace code**
- ✅ Syncs workspace with current org state

**Check for version conflicts between workspace and org:**

```bash
# After retrieval, check what changed
# VS Code: Open Source Control tab to see diff
# Or use terminal to compare:
git diff force-app/main/default/genAiPlannerBundles/Agent_Name.xml
```

**Handle version differences:**

| Scenario                                               | Action                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **Workspace = Org** (no changes)                       | ✅ Proceed to analysis with confidence                                                               |
| **Workspace < Org** (org has newer version)            | ⚠️ Ask user: "Org has newer version. Should I analyze the latest from org?"                          |
| **Workspace > Org** (workspace has undeployed changes) | ⚠️ Ask user: "Workspace has undeployed changes. Should I analyze workspace or pull latest from org?" |
| **Both have different changes** (conflicting edits)    | ⚠️ Stop - ask user to resolve conflicts first                                                        |

**User decision:**

- Always inform user of version status before analyzing
- Let user choose which version to analyze (workspace vs org)
- Document which version was used in the analysis
- If conflicts exist, stop and ask user to resolve first

**CRITICAL:**

- Do NOT silently use outdated workspace code
- Make user aware of any version differences
- Do NOT stop or wait unnecessarily - ask immediately and continue

### Step 2: Retrieve Apex Classes and Flows

**After running the 4 commands in Step 1, check the agent XML file for any apex classes or flows used in local actions:**

- Retrieve those apex classes immediately:

```bash
sf project retrieve start --metadata ApexClass:ClassName
```

- Retrieve flows if referenced:

```bash
sf project retrieve start --metadata Flow:FlowName
```

**IMPORTANT:**

- GenAiPlugin and GenAiFunction are for reading/understanding existing global topics/actions only
- **Do not modify or deploy these files** unless explicitly working with shared global resources

### Step 2.1: Lock Against Concurrent Edits and Document Version

**CRITICAL - Prevent stale analysis from concurrent org edits:**

**Inform user at start of analysis:**

> "I'm analyzing **Agent_Name** now. If someone edits this agent in Salesforce org during the analysis, we'll be working with outdated information.
>
> **Please confirm:**
>
> - [ ] No one will edit this agent in Salesforce during analysis
> - [ ] I will not make changes to this agent in the org until analysis is complete"

**Concurrent edit scenarios:**

1. **If org is edited during analysis:**

    - Re-retrieve updated version immediately
    - Inform user: "Agent was modified in org during analysis. Re-analyzing with latest version..."
    - Restart analysis with fresh copy

2. **For production/shared agents:**
    - Consider restricting edit permissions during analysis
    - Or use change sets to lock the agent
    - Or inform team not to edit until analysis complete

**Document version information for the analysis:**

**In the `.siid/Agent_Name_Analysis.md` file, include:**

```markdown
## Version Information

- **Analysis Date:** [Current Date]
- **Analysis Time:** [Start Time]
- **Source Version:** Org (latest retrieved on [Date])
- **Workspace Status:** [Synced / Ahead / Behind / Conflicted]
- **Last Deployment to Org:** [Date if known]
- **Analyst:** [Your Name]

### Version Sync Details

[Document any differences found between workspace and org before analysis]

- Changes in workspace not deployed: [List if any]
- Changes in org not in workspace: [List if any]
- Conflicts resolved: [If any]
```

**Why document version?**

- ✅ Creates audit trail of what was analyzed
- ✅ Anyone reading analysis knows exactly which version
- ✅ Helps identify if org changed between analysis and implementation
- ✅ Prevents confusion if team edits agent after analysis

### Step 2.5: Create Analysis Storage Folder and Document

**After retrieving all files using the 4 commands above, create a folder structure to store all analysis:**

**Create folder:**

```bash
mkdir .siid
```

**Create analysis file:**

```bash
# Create a markdown file in .siid folder named after the agent
# Example: .siid/Hotel_Booking_Agent_Analysis.md
```

**Store in this file:**

The `.siid` folder should contain a comprehensive markdown document with:

1. **Agent Overview**

    - Agent name and API name
    - Agent type (customer-facing / internal)
    - Creation date and last modified date
    - Owner/team responsible

2. **Agent Scenario (Plain Language)**

    - Clear explanation of what the agent was developed for
    - Business problem it solves
    - Target users (customers/internal staff)
    - Main workflows and responsibilities
    - Key use cases and examples

3. **Agent Statistics**

    - Total number of topics
    - Total number of actions
    - Breakdown of action types (Apex, HTTP, Plugin, etc.)
    - External plugins/functions used
    - Apex classes used with descriptions
    - Related flows (if any)

4. **Detailed Action Analysis**

    - Action name and type
    - Input parameters and their purpose
    - Processing logic and business rules
    - Output and return values
    - Any side effects or related operations
    - Error handling and edge cases
    - Apex class used (if applicable) with code reference

5. **Detailed Topic and Instructions Analysis**

    - Topic name and description
    - Complete breakdown of each instruction:
        - What the agent should do
        - Conditions and triggers
        - Expected outcomes
        - Step-by-step flow
        - Examples and use cases
    - Relationships between topics
    - Message flow and conversation design

6. **Identified Issues and Quality Assessment**

    - **Critical Issues** - Must fix before deployment
    - **High Priority Issues** - Should fix for better performance
    - **Medium Priority Issues** - Recommended improvements
    - **Low Priority Issues** - Nice-to-have enhancements
    - For each issue: description, impact, recommendation

7. **Architecture and Design**

    - Overall agent design patterns
    - Topic structure and organization
    - Action flow and dependencies
    - Error handling strategy
    - Integration points with external systems

8. **Improvement Opportunities**
    - New topics that could be added
    - Enhanced instructions needed
    - Optimization opportunities
    - Scalability considerations
    - User experience improvements

**Example file path:** `.siid/Hotel_Booking_Agent_Analysis.md`

**IMPORTANT:**

- Create the `.siid` folder at the root of the workspace
- Use markdown format for better readability
- Include code snippets when referencing XML or Apex logic
- Use clear headings and structured formatting
- Make the document comprehensive and self-contained
- This file serves as a reference for understanding the agent's complete structure and logic
- Update this file as the agent is enhanced or modified

### Step 3: Analyze and Understand Agent Files

**Agent Analysis in Structured Order:**

#### 3.1 Agent Scenario Explanation

**CRITICAL:** Clearly explain what the agent was developed for:

- What is the primary purpose of this agent?
- What business problem does it solve?
- Who uses this agent (internal/customer-facing)?
- What are the main responsibilities and workflows?
- In plain, understandable language - as if explaining to a business stakeholder

**Write a clear paragraph explaining the agent's scenario and use case.**

#### 3.2 Agent Statistics

**Provide key metrics:**

- Total number of topics in the agent
- Total number of actions in the agent
- List of external plugins/functions used (if any)
- List of apex classes used (if any)

**Format as simple list or stats table**

#### 3.3 Agent Actions Analysis

**For each action in the agent:**

1. **Action Name** - Display the action name
2. **Action Type** - What type of action (Apex, HTTP, Plugin, etc.)
3. **Apex Class Used** (if applicable) - Which apex class is called
4. **Action Logic Explanation** - Detailed explanation of what this action does:
    - Input parameters and their purpose
    - Processing logic and business rules
    - Output and return values
    - Any side effects or related operations
    - Error handling

**Explain action logic in clear, understandable terms.**

#### 3.4 Agent Topics and Instructions Analysis

**For each topic in the agent:**

1. **Topic Name** - Display the topic name
2. **Topic Description** - Brief description of topic purpose
3. **Instructions Explanation** - Detailed explanation of all instructions in this topic:
    - Break down each instruction clearly
    - Explain what the agent should do
    - Explain the conditions and triggers
    - Explain the expected outcome
    - Explain how it relates to the agent's scenario
    - Show specific examples if applicable

**Explain instructions in clear, step-by-step manner that anyone can understand.**

#### 3.5 Review Files

**Primary files to analyze:**

- **GenAiPlannerBundle XML** - Main agent configuration file with topics, actions, instructions
- **GenAiPlugin/GenAiFunction** (reference only) - Understand global topics/actions if used
- **Apex Classes** - Understand the business logic in apex actions
- **Agent Instructions** - Review custom instructions for clarity and completeness

**Note:** For detailed topic analysis, use **`agentforce-topic-analyse-workflow.md`** if deeper dive needed.

### Step 4: Identify Issues and Improvement Opportunities

**Configuration Issues:**

- Missing required fields
- Incorrect agent type (customer vs internal)
- Invalid API names or references
- Broken action bindings
- Missing error handling

**Instruction Quality Issues:**

- Unclear or ambiguous instructions
- Missing context or examples
- Contradictory guidance
- Incomplete step-by-step procedures
- Instructions not aligned with agent scenario

**Topic Organization Issues:**

- Overlapping topics
- Missing essential topics for the agent's role
- Topics too broad or too narrow
- Insufficient topic descriptions
- Topics not properly structured

**Action Issues:**

- Missing required actions for the agent's scenario
- Incorrect action parameters
- Broken action bindings
- Missing error handling
- Apex classes with logic gaps

**Enhancement Opportunities:**

- Topics that could be added to expand agent capabilities
- Instructions that could be improved for clarity
- Actions that could be optimized
- Apex classes that could be enhanced
- Better documentation and descriptions needed

### Step 5: Generate Comprehensive Analysis Report

**Report Structure (in this order):**

#### 1. Agent Scenario

- Clear explanation of what the agent does
- Business purpose and use case
- Who uses the agent
- Main workflows and responsibilities
- Plain language explanation

#### 2. Agent Statistics

- Total number of topics
- Total number of actions
- External plugins/functions used (if any)
- Apex classes used (if any)

#### 3. Agent Actions

- List of all actions
- For each action:
    - Action name
    - Action type
    - Apex class used (if applicable)
    - Detailed logic explanation

#### 4. Agent Topics and Instructions

- List of all topics
- For each topic:
    - Topic name and description
    - Detailed explanation of all instructions
    - Clear explanation of what agent should do
    - Conditions, triggers, and outcomes

#### 5. Identified Issues and Improvement Opportunities

- **Critical Issues** - Must fix before deployment
- **High Priority Issues** - Should fix for better agent performance
- **Medium Priority Issues** - Recommended improvements
- **Enhancement Opportunities** - New topics/actions to add, logic improvements

**For each issue, provide:**

- Clear description of the issue
- Impact on agent functionality
- Specific recommendations for improvement
- Related topics/actions affected

**IMPORTANT:** This analysis should make it clear whether:

1. The agent is well-structured and ready for enhancement
2. The agent has issues that need fixing before adding new functionality
3. What new topics and actions should be added
4. What existing logic needs to be changed or improved

### Step 6: Present Analysis and Wait for User Confirmation

**After presenting the comprehensive analysis report:**

1. **Ask user:** "Based on this analysis, would you like me to enhance this agent? Here are the recommended improvements:"

    - Summary of changes (new topics, modified actions, improved instructions, etc.)
    - Estimated impact on agent functionality
    - Priority of improvements (critical first, then high, then medium)

2. **Wait for explicit confirmation** before making changes:

    - If user approves specific changes, proceed to Step 7
    - If user wants additional analysis first, provide it
    - If user declines, analysis complete - no changes made

3. **Be ready to answer follow-up questions:**
    - "Why is this issue critical?"
    - "What would adding this topic enable?"
    - "How would this change affect the agent?"
    - "Which improvement should we do first?"

### Step 7: Enhance Agent Configuration (Only if approved by user)

**Make improvements based on user approval:**

**Fix identified issues:**

- Critical issues first (security, broken functionality)
- High priority issues (performance, usability)
- Medium priority issues (optimization, clarity)

**Enhance agent with new capabilities:**

- **Add new topics** as LOCAL topics (inside GenAiPlannerBundle) for new capabilities
- **Add new actions** to new/existing topics to enable new functionalities
- **Modify existing instructions** for clarity and alignment with agent scenario
- **Optimize action parameters** for better performance
- **Improve error handling** and validation logic

**Improve instruction quality:**

- Make instructions clearer and more specific
- Add examples and use cases where applicable
- Ensure instructions align with agent's business purpose
- Fix any contradictory or ambiguous guidance

**Creating/Modifying Topics and Actions:**

**IMPORTANT:** When adding new topics/actions to an existing agent, ALWAYS create them as LOCAL (not global).

Refer to **`.roo/rules-Salesforce_Agent/agentforce-topics-actions-guide.md`** for:

- Local vs global topics/actions structure
- XML syntax and best practices
- Priority rule: Always prefer LOCAL over GLOBAL

**If adding new Apex actions:**

- **SALESFORCE AGENT MODE MUST NEVER WRITE APEX CODE**
- **Must delegate to Code mode** for any Apex action creation
- When creating subtask or switching to Code mode, specify: **"Follow the guide in .roo/rules-code/agentforce-apex-guide.md to create an invocable Apex action"**
- **Do NOT use apex-guide.md** - only agentforce-apex-guide.md is for invocable actions
- Wait for Code mode to complete and deploy the Apex class
- Update agent xml to reference the created Apex class in local action

### Step 8: Deploy Enhanced Agent

Update the org with enhanced agent:

```bash
sf project deploy start --metadata GenAiPlannerBundle:Agent_Name
```

**Deployment checklist:**

- [ ] All changes saved in agent XML file
- [ ] No syntax errors in agent configuration
- [ ] All referenced apex classes exist and are deployed
- [ ] All action bindings are correct
- [ ] Topics are properly structured
- [ ] Instructions are clear and complete

---

## Example Comprehensive Analysis

**User wants:** "Analyze my Hotel Booking Agent"

### Step 1: Collect agent name

- Agent name: Hotel_Booking_Agent

### Step 2: Retrieve if needed

- Check workspace - agent found locally
- Review GenAiPlugin/GenAiFunction if referenced

### Step 3-4: Comprehensive Analysis

**Step 3.1 - Agent Scenario:**

> The Hotel Booking Agent is designed to help customers search for and book hotel accommodations. It manages the entire booking lifecycle including searching available properties, displaying rates and availability, processing reservations, and handling booking modifications. The agent serves external customers and integrates with the hotel management system to provide real-time availability and pricing information.

**Step 3.2 - Agent Statistics:**

- Total Topics: 4
- Total Actions: 6
- Apex Classes Used: SearchHotels, CreateBooking, UpdateBooking, GetAvailability
- Plugins Used: PaymentProcessor (for payment handling)

**Step 3.3 - Agent Actions:**

1. **SearchHotels** (Apex Action)

    - Apex Class: SearchHotels
    - Logic: Accepts search criteria (location, dates, price range), queries hotel database, filters results by availability and customer preferences, returns list of matching hotels with details

2. **GetRoomAvailability** (Apex Action)

    - Apex Class: GetAvailability
    - Logic: Checks real-time room availability for selected hotel, applies occupancy rules, returns available room types with pricing

3. **CreateBooking** (Apex Action)

    - Apex Class: CreateBooking
    - Logic: Creates new booking record, validates customer information, reserves rooms, generates confirmation number, sends confirmation email

4. **UpdateBooking** (Apex Action)

    - Apex Class: UpdateBooking
    - Logic: Modifies existing booking details, updates room assignments, recalculates pricing, applies change fees if applicable

5. **ProcessPayment** (Plugin Action)

    - Plugin: PaymentProcessor
    - Logic: Integrates with payment gateway, processes credit card transactions, handles payment confirmations and error scenarios

6. **CancelBooking** (Apex Action)
    - Apex Class: CancelBooking
    - Logic: Cancels active bookings, processes refunds per cancellation policy, updates room availability

**Step 3.4 - Agent Topics and Instructions:**

**Topic 1: Search Hotels**

- Instructions:
    1. Ask user for travel dates (check-in and check-out)
    2. Ask for location or hotel name
    3. Ask for budget/price preference
    4. Call SearchHotels action with criteria
    5. Present results with best matches first
    6. Ask if user wants to see more details or book

**Topic 2: Book Hotel**

- Instructions:
    1. Confirm selected hotel details
    2. Verify guest information is complete
    3. Check room availability for selected dates
    4. Call CreateBooking action
    5. Process payment using PaymentProcessor
    6. Send confirmation and receipt to customer

**Topic 3: Modify Booking**

- Instructions:
    1. Ask for booking confirmation number or email
    2. Retrieve existing booking details
    3. Ask what changes customer wants
    4. Validate new dates/rooms are available
    5. Call UpdateBooking action
    6. Inform customer of any change fees
    7. Confirm updated booking details

**Topic 4: Cancel Booking**

- Instructions:
    1. Ask for booking confirmation number
    2. Retrieve booking details
    3. Explain cancellation policy and refund amount
    4. Confirm customer wants to cancel
    5. Call CancelBooking action
    6. Process refund to original payment method
    7. Send cancellation confirmation

### Step 5: Generate Report

**Identified Issues:**

- Critical: SearchHotels apex class doesn't filter by availability status
- High: No input validation on customer information before booking
- Medium: Instructions in CancelBooking don't explain refund timeline
- Enhancement: Add review/rating system for completed bookings

**Recommended Enhancements:**

1. Fix apex class to properly filter availability
2. Add input validation topic
3. Improve cancellation instructions
4. Add new "Review Booking" topic with rating functionality

### Step 6: Present to User

> "I've completed the analysis of your Hotel Booking Agent. Based on the review, I found 1 critical issue (availability filtering), 1 high-priority issue (input validation), 1 medium-priority issue (cancellation instructions), and 1 good enhancement opportunity (review system). Would you like me to fix these issues and add the review functionality?"

### Step 7-8: If approved, fix issues and deploy

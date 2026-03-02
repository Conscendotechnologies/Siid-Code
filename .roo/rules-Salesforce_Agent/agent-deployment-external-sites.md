# Agentforce Agent Deployment Manual

## Adding Agent to External Websites

---

## Prerequisites

Before starting the deployment process, ensure the following:

- ✅ The **Adaptive Response Toggle** is **ON** under the **Connections Tab** in the Agent Builder

---

## Step 1: Deploy and Activate the Agent

Deploy your Agentforce agent and ensure it's in **Active** status.

---

## Step 2: Enable Messaging and Create Routing Configuration

### 2.1 Enable Messaging

1. Open **Setup** and use the **Quick Find** box
2. Search for and select **Messaging Settings**
3. Set **Messaging to ON**

### 2.2 Create a Routing Configuration

1. In **Setup Quick Find**, search for and select **Routing Configurations**
2. Click **New**
3. Configure the following fields:

| Field                          | Value                                                              |
| ------------------------------ | ------------------------------------------------------------------ |
| **Routing Configuration Name** | Agent Routing Configuration _(Example name - customize as needed)_ |
| **Developer Name**             | Agent_Routing_Configuration                                        |
| **Overflow Assignee**          | Leave Blank                                                        |
| **Routing Priority**           | 1                                                                  |
| **Routing Model**              | Most Available                                                     |
| **Push Time-out (seconds)**    | Leave Blank                                                        |
| **Capacity Type**              | Keep default: Inherited                                            |
| **Units of Capacity**          | 2                                                                  |
| **Percentage of Capacity**     | Leave Blank                                                        |

4. Click **Save**

---

## Step 3: Create a Queue

### 3.1 Create a New Queue

1. In **Setup Quick Find**, search for and select **Queues**
2. Click **New**
3. Configure the following fields:

| Field                     | Value                                         |
| ------------------------- | --------------------------------------------- |
| **Label**                 | Messaging Queue _(Customize as needed)_       |
| **Queue Name**            | Messaging_Queue                               |
| **Queue Email**           | Leave Blank                                   |
| **Send Email to Members** | Keep default: False                           |
| **Routing Configuration** | Agent_Routing_Configuration _(from Step 2.2)_ |
| **Selected Objects**      | Messaging Session                             |
| **Selected Members**      | Admin User _(Can add multiple users)_         |

4. Click **Save**

---

## Step 4: Create Omni-Channel Routing Flow

### 4.1 Create a New Flow

1. In **Setup**, search for **Flow** in **Quick Find** and select **Flows**
2. Click **New Flow**
3. Click **Start From Scratch**
4. Click **Next**
5. Select **Omni-Channel Flow** and click **Create**

### 4.2 Create Flow Variables

1. Open the **Toolbox** on the right-hand side of the builder
2. Click **New Resource**
3. Open the **Resources panel** by clicking the sidebar icon to the left of **Select Elements**
4. Create a variable with the following settings:

| Setting                  | Value                                                          |
| ------------------------ | -------------------------------------------------------------- |
| **Resource Type**        | Variable                                                       |
| **API Name**             | recordId                                                       |
| **Description**          | The recordId is used to assign a messaging session to an Agent |
| **Data Type**            | Text                                                           |
| **Available for input**  | ✅ Checked                                                     |
| **Available for output** | ⬜ Unchecked                                                   |

### 4.3 Add Get Records Element

1. Select the **Get Records** element from the Toolbox
2. Configure the action with these settings:

| Field                      | Value                                                                      |
| -------------------------- | -------------------------------------------------------------------------- |
| **Label**                  | Get Messaging Session                                                      |
| **API Name**               | Get_Messaging_Session                                                      |
| **Description**            | Get the related messaging session that you would like to route to an agent |
| **Data Source**            | Salesforce Object                                                          |
| **Object**                 | Messaging Session                                                          |
| **Condition Requirements** | All Conditions Are Met (AND)                                               |

3. Define the condition:

| Field  | Operator | Value     |
| ------ | -------- | --------- |
| **Id** | Equals   | $recordId |

4. Leave **How Many Records to Store** and **How to Store Record Data** to their defaults

### 4.4 Add Route Work Element

1. Select the **Route Work** element from the Toolbox
2. Configure the action with these settings:

| Field                               | Value                                                |
| ----------------------------------- | ---------------------------------------------------- |
| **Label**                           | Route to Agent                                       |
| **API Name**                        | Route_to_Agent                                       |
| **Description**                     | Route the messaging session to the [Your Agent Name] |
| **How Many Work Records to Route?** | Keep default: Single                                 |
| **Record Id Variable**              | $recordId                                            |
| **Service Channel**                 | Messaging                                            |
| **Route To**                        | Agentforce Service Agent                             |
| **Agentforce Service Agent**        | _Select your created Agent_                          |
| **Fallback Queue**                  | _Select Queue_                                       |
| **Fallback Queue Id**               | Messaging Queue _(Queue created in Step 3)_          |

### 4.5 Save and Activate Flow

1. Click **Save**
2. Set the following flow metadata:

| Field             | Value          |
| ----------------- | -------------- |
| **Flow Label**    | Route to Agent |
| **Flow API Name** | Route_to_Agent |

3. Click **Activate**

---

## Step 5: Create Messaging Settings Record

### 5.1 Configure Messaging Channel

1. In **Setup Quick Find**, search for and select **Messaging Settings**
2. Click **New Channel**
3. Click **Start**
4. Select **Enhanced Chat**
5. Configure the channel:
    - **Channel Name**: _(Customize as needed)_
    - **Developer Name**: _(Customize as needed)_
    - **Deployment Type**: Web
    - **Domain**: Enter the domain name for the entire site _(e.g., yourcompany.com)_

### 5.2 Configure Routing and Fallback

1. Select **Routing Type**: **Omni-flow**
2. **Flow Definition**: Select the flow created in Step 4 (**Route to Agent**)
3. **Fallback Queue**: Select the queue created in Step 3 (**Messaging Queue**)
4. Click **Save**

---

## Step 6: Create Embedded Service Deployment

### 6.1 Deployment and Publishing

1. An **Embedded Service Deployment** will be automatically created once Messaging Settings are configured
2. Open the newly created **Embedded Service Deployment**
3. Click **Publish**

### 6.2 Get Deployment Code

1. From the **Embedded Service Deployment** options, select **Code Snippet**
2. Copy the **Script Code**
3. Paste it in the **`<body>`** tag of your HTML page/website
4. Save the file

**Example:**

```html
<body>
	<!-- Your existing content -->

	<!-- Paste Agentforce Script here -->
	<script src="..."></script>
</body>
```

---

## Step 7: Configure CORS and Trusted URLs

### 7.1 Configure CORS (Cross-Origin Resource Sharing)

1. Copy your domain URL
2. In **Salesforce Setup Quick Find** box, search for **CORS**
3. Add your domain URL to the CORS whitelist

### 7.2 Configure Trusted URLs

1. In **Quick Find**, search for **Trusted URLs**
2. Create a new entry with:
    - **API Name**: _(Provide API name)_
    - **Domain URL**: _(Your domain)_

### 7.3 Configure CSP Settings

1. In **Quick Find**, search for **CSP Settings**
2. Select the following checkboxes:
    - ✅ **frame-src** (iframe content)
    - ✅ **img-src** (images)

---

## Step 8: Configure Sites - Trusted Domains for Inline Frames

1. In **Quick Find**, search for **Sites** (Under **User Interface**)
2. Select your **Embedded Service Deployment**
3. Under **Trusted Domains for Inline Frames**, add your domain URL

---

## Step 9: Configure Digital Experiences - Trusted Sites

1. In **Quick Find**, search for **All Sites** (Under **Digital Experiences**)
2. Click the **Builder** option beside your site
3. Navigate to **Settings** → **Settings and Privacy**
4. Under **Trusted Sites for Scripts**, add your domain URL in the trusted sites section

---

## Verification Checklist

After completing all steps, verify the following:

- ✅ Agent is deployed and activated
- ✅ Messaging is enabled
- ✅ Routing configuration created with correct capacity settings
- ✅ Queue created and linked to routing configuration
- ✅ Omni-Channel flow created and activated
- ✅ Messaging settings configured with correct routing
- ✅ Embedded service deployment published
- ✅ Script code added to website HTML
- ✅ CORS whitelist includes your domain
- ✅ Trusted URLs configured
- ✅ CSP settings configured
- ✅ Sites trusted domains configured
- ✅ Digital experiences trusted sites configured

---

## Troubleshooting

### Common Issues

| Issue                        | Solution                                                       |
| ---------------------------- | -------------------------------------------------------------- |
| Agent not responding in chat | Verify Adaptive Response Toggle is ON and agent is activated   |
| Routing failures             | Check routing configuration capacity and queue membership      |
| Script not loading           | Verify CORS and CSP settings include your domain               |
| Flow errors                  | Ensure all flow variables and elements are properly configured |
| Queue not working            | Confirm queue is linked to the correct routing configuration   |

---

# Flow test scenarios
# Add entries to TESTS. Each entry runs: prompt_to_graph -> graph_to_flow_xml -> flow_validator
#
# Fields:
#   name      - slug used for graphs/<name>.json and flows/<name>.flow-meta.xml
#   prompt    - natural-language description passed to prompt_to_graph.py
#   reference - path to the reference .flow-meta.xml in flows-xml/ to score against
#               (set to None to skip semantic comparison and just check generation succeeds)
#   version   - Salesforce API version string (default "67.0")
#   status    - Flow status: "Active" | "Draft" (default "Active")
#
# Run with:
#   python python/test_flows_v2.py
# The runner imports TESTS from this file.

TESTS = [
    # ── Already validated ────────────────────────────────────────────────────
    {
        "name": "http_callout",
        "prompt": (
            "Create a screen flow that performs an HTTP callout named "
            "GetRandomQuote.Get Random Quote and displays the response in a "
            "screen called Random User Details with showFooter and allowBack. "
            "The flow transaction model is CurrentTransaction."
        ),
        "reference": "flows-xml/HTTP_Callout_Flow.flow-meta.xml",
        "version": "67.0",
        "status": "Active",
    },
    {
        "name": "dynamic_choice",
        "prompt": (
            "Create a screen flow for an Employee Leave Request. "
            "Add a dynamic choice set called LeaveTypeChoices pulling from "
            "Leave_Type__c on Leave_Request__c. Include 2 screens and a "
            "CreateRecords node to create the leave request."
        ),
        "reference": "flows-xml/Employee_Leave_Request_Flow.flow-meta.xml",
        "version": "67.0",
        "status": "Active",
    },

    # ── Add your scenarios below ─────────────────────────────────────────────
    # Tip: pick the matching reference from flows-xml/, or set reference=None
    # to just verify the generation pipeline doesn't crash.

    # {
    #     "name": "create_task_from_case",
    #     "prompt": (
    #         "When a Case is created with Status = New, create a follow-up Task "
    #         "assigned to the case owner with Subject 'Follow up on case' due in 3 days."
    #     ),
    #     "reference": "flows-xml/Create_Task_From_Case_Flow.flow-meta.xml",
    #     "version": "67.0",
    #     "status": "Active",
    # },
    # {
    #     "name": "email_alert",
    #     "prompt": (
    #         "When an Account is created, send an email alert named "
    #         "Account.Account_Creation_Alert to the account owner."
    #     ),
    #     "reference": "flows-xml/Account_Creation_Notification.flow-meta.xml",
    #     "version": "67.0",
    #     "status": "Active",
    # },
    # {
    #     "name": "before_save_field_update",
    #     "prompt": (
    #         "Before an Opportunity is saved, if StageName is Closed Won, "
    #         "set the CloseDate to today using a formula."
    #     ),
    #     "reference": None,
    #     "version": "67.0",
    #     "status": "Active",
    # },
]

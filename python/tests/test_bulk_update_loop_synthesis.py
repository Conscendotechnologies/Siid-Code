import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from graph_to_flow_xml import generate_flow_xml_text


class BulkUpdateLoopSynthesisTests(unittest.TestCase):
    """
    A GetRecords that returns multiple records (getFirstRecordOnly=false) feeding
    directly into an UpdateRecords node with input_assignments used to raise a
    "resource can't be used as a merge field" error in real Salesforce Flow Builder,
    because the parser injected a filter on the *collection's* Id (e.g.
    "Id EqualTo Get_Related_Contacts.Id") instead of a scalar merge field.

    The parser must instead synthesize GetRecords -> Loop -> Assignment -> Loop ->
    UpdateRecords(inputReference=collection), matching what real Flow Builder emits
    for "update all related records" scenarios.
    """

    def make_graph(self, get_first_record_only=False):
        return {
            "flow_name": "Opportunity_Closed_Won_Update_Account_Contacts",
            "nodes": [
                {
                    "id": "Start", "type": "Start", "label": "Start",
                    "metadata": {
                        "name": "Start", "original_tag": "start",
                        "triggerType": "RecordAfterSave", "recordTriggerType": "Update",
                        "object": "Opportunity",
                    },
                },
                {
                    "id": "get_related_contacts", "type": "GetRecords", "label": "Get Related Contacts",
                    "metadata": {
                        "name": "get_related_contacts", "original_tag": "recordLookups",
                        "object": "Contact",
                        "filters": [
                            {"field": "AccountId", "operator": "EqualTo", "value": {"elementReference": "$Record.AccountId"}}
                        ],
                        "get_first_record_only": get_first_record_only,
                        "store_output_automatically": True,
                        "assign_null_values_if_no_records_found": False,
                    },
                },
                {
                    "id": "update_contacts_to_active_customer", "type": "UpdateRecords",
                    "label": "Update Contacts to Active Customer",
                    "metadata": {
                        "name": "update_contacts_to_active_customer", "original_tag": "recordUpdates",
                        "object": "Contact",
                        "input_assignments": [
                            {"field": "Customer__c", "value": {"stringValue": "Active Customer"}}
                        ],
                    },
                },
                {"id": "End", "type": "End", "label": "End", "metadata": {}},
            ],
            "edges": [
                {"from": "Start", "to": "get_related_contacts", "metadata": {}},
                {"from": "get_related_contacts", "to": "update_contacts_to_active_customer", "metadata": {}},
                {"from": "update_contacts_to_active_customer", "to": "End", "metadata": {}},
            ],
        }

    def test_multi_record_get_records_synthesizes_loop_and_collection_update(self):
        xml = generate_flow_xml_text(self.make_graph(get_first_record_only=False), api_version="62.0", status="Draft")

        # Never emit a filter that treats the GetRecords collection as a scalar merge field.
        self.assertNotIn("get_related_contacts.Id", xml)

        # A Loop was synthesized over the GetRecords collection.
        self.assertIn("<loops>", xml)
        self.assertIn("<collectionReference>get_related_contacts</collectionReference>", xml)

        # An Assignment sets the field on the loop item and appends it to a new collection.
        self.assertIn("<assignments>", xml)
        self.assertIn("Customer__c</assignToReference>", xml.replace("\n", ""))
        self.assertIn("<operator>Add</operator>", xml)

        # The bulk update runs once, after the loop, via inputReference — no filters/inputAssignments.
        self.assertIn("<inputReference>", xml)
        update_start = xml.index("<recordUpdates>")
        update_end = xml.index("</recordUpdates>")
        update_block = xml[update_start:update_end]
        self.assertNotIn("<filters>", update_block)
        self.assertNotIn("<assignmentItems>", update_block)

        # A new SObject collection variable was declared for the synthesized update target.
        self.assertIn("<dataType>SObject</dataType>", xml)
        self.assertIn("<isCollection>true</isCollection>", xml)

    def test_single_record_get_records_keeps_existing_filter_shortcut(self):
        xml = generate_flow_xml_text(self.make_graph(get_first_record_only=True), api_version="62.0", status="Draft")

        # Single-record GetRecords.Id is a valid scalar merge field — no loop needed.
        self.assertNotIn("<loops>", xml)
        self.assertIn("get_related_contacts.Id", xml)

    def make_explicit_loop_graph(self):
        """
        Matches what the AI actually generates for "loop through related records and
        update a field on each": GetRecords -> Loop -> UpdateRecords (inside the loop
        body, looping back to Loop) -> Loop's After Last -> End. The UpdateRecords node
        fires once per iteration with a filter matching the current loop item's Id -
        one DML call per record instead of a single bulk update after the loop.
        """
        return {
            "flow_name": "Opportunity_Closed_Won_Update_Account_Contacts",
            "nodes": [
                {
                    "id": "Start", "type": "Start", "label": "Start",
                    "metadata": {
                        "name": "Start", "original_tag": "start",
                        "triggerType": "RecordAfterSave", "recordTriggerType": "Update",
                        "object": "Opportunity",
                    },
                },
                {
                    "id": "get_related_contacts", "type": "GetRecords", "label": "Get Related Contacts",
                    "metadata": {
                        "name": "get_related_contacts", "original_tag": "recordLookups",
                        "object": "Contact",
                        "filters": [
                            {"field": "AccountId", "operator": "EqualTo", "value": {"elementReference": "$Record.AccountId"}}
                        ],
                        "get_first_record_only": False,
                        "store_output_automatically": True,
                        "assign_null_values_if_no_records_found": False,
                    },
                },
                {
                    "id": "loop_related_contacts", "type": "Loop", "label": "Loop Through Contacts",
                    "metadata": {
                        "name": "loop_related_contacts",
                        "collection_reference": "get_related_contacts",
                        "iteration_order": "Asc",
                    },
                },
                {
                    "id": "update_contact_customer_status", "type": "UpdateRecords",
                    "label": "Update Contact Customer Status",
                    "metadata": {
                        "name": "update_contact_customer_status", "original_tag": "recordUpdates",
                        "object": "Contact",
                        "filters": [
                            {"field": "Id", "operator": "EqualTo", "value": {"elementReference": "loop_related_contacts.Id"}}
                        ],
                        "input_assignments": [
                            {"field": "Customer__c", "value": {"stringValue": "Active Customer"}}
                        ],
                    },
                },
                {"id": "End", "type": "End", "label": "End", "metadata": {}},
            ],
            "edges": [
                {"from": "Start", "to": "get_related_contacts", "metadata": {}},
                {"from": "get_related_contacts", "to": "loop_related_contacts", "metadata": {}},
                {"from": "loop_related_contacts", "to": "update_contact_customer_status", "metadata": {}},
                {"from": "update_contact_customer_status", "to": "loop_related_contacts", "metadata": {}},
                {"from": "loop_related_contacts", "to": "End", "metadata": {}},
            ],
        }

    def test_explicit_loop_body_update_records_synthesizes_bulk_update_after_loop(self):
        xml = generate_flow_xml_text(self.make_explicit_loop_graph(), api_version="62.0", status="Draft")

        # Never emit a filter/DML that runs the update once per loop iteration.
        self.assertNotIn("loop_related_contacts.Id", xml)

        # The Loop node is preserved with its original collection.
        self.assertIn("<collectionReference>get_related_contacts</collectionReference>", xml)

        # The loop body is now an Assignment that sets the field on the loop item and
        # appends it to a new collection variable — not a per-record UpdateRecords.
        self.assertIn("<assignments>", xml)
        self.assertIn("Customer__c</assignToReference>", xml.replace("\n", ""))
        self.assertIn("<operator>Add</operator>", xml)

        # The bulk update runs once, after the loop, via inputReference — no filters/inputAssignments.
        self.assertIn("<inputReference>", xml)
        update_start = xml.index("<recordUpdates>")
        update_end = xml.index("</recordUpdates>")
        update_block = xml[update_start:update_end]
        self.assertNotIn("<filters>", update_block)
        self.assertNotIn("<assignmentItems>", update_block)

        # A new SObject collection variable was declared for the synthesized update target.
        self.assertIn("<dataType>SObject</dataType>", xml)
        self.assertIn("<isCollection>true</isCollection>", xml)


if __name__ == "__main__":
    unittest.main()

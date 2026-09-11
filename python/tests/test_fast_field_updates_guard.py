import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from prompt_to_graph import PromptToGraphError as PromptToGraphErrorForGraph, validate_before_save_graph
from graph_to_flow_xml import GraphGenerationError, generate_flow_xml_text


class FastFieldUpdatesGuardTests(unittest.TestCase):
    def make_graph(self, update_object="ContactRelation", input_reference=None):
        return {
            "flow_name": "TestFlow",
            "nodes": [
                {
                    "id": "start",
                    "type": "Start",
                    "label": "Start",
                    "metadata": {
                        "object": "Contact",
                        "trigger_type": "RecordBeforeSave",
                    },
                },
                {
                    "id": "update",
                    "type": "UpdateRecords",
                    "label": "Update Records",
                    "metadata": {
                        "object": update_object,
                        "input_reference": input_reference,
                        "input_assignments": [
                            {"field": "Phone", "value": {"stringValue": "123"}}
                        ],
                    },
                },
                {
                    "id": "end",
                    "type": "End",
                    "label": "End",
                    "metadata": {},
                },
            ],
            "edges": [
                {"id": "e1", "from": "start", "to": "update"},
                {"id": "e2", "from": "update", "to": "end"},
            ],
        }

    def test_before_save_update_records_rejects_non_triggering_object(self):
        graph = self.make_graph(update_object="ContactRelation")

        with self.assertRaises(GraphGenerationError) as cm:
            generate_flow_xml_text(graph, api_version="62.0", status="Draft")

        self.assertIn("Fast Field Updates", str(cm.exception))

    def test_before_save_update_records_allows_triggering_record_reference(self):
        graph = self.make_graph(input_reference="$Record")

        xml = generate_flow_xml_text(graph, api_version="62.0", status="Draft")

        self.assertIn("<recordUpdates", xml)

    def test_prompt_parser_rejects_before_save_update_records(self):
        graph = self.make_graph()

        with self.assertRaises(PromptToGraphErrorForGraph) as cm:
            validate_before_save_graph(graph)

        self.assertIn("before-save/Fast Field Updates flow", str(cm.exception))

    def test_prompt_parser_allows_after_save_update_records(self):
        graph = self.make_graph()
        graph["nodes"][0]["metadata"]["trigger_type"] = "RecordAfterSave"

        validate_before_save_graph(graph)


if __name__ == "__main__":
    unittest.main()

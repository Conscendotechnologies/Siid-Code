import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from prompt_to_graph import normalize_generated_graph


class ScheduledFlowNormalizationTests(unittest.TestCase):
    def test_daily_prompt_repairs_missing_scheduled_start(self):
        graph = {
            "flow_name": "Close_Stale_Opportunities_Daily",
            "nodes": [
                {
                    "id": "Start",
                    "type": "Start",
                    "label": "Start",
                    "metadata": {
                        "name": "Start",
                        "original_tag": "start",
                        "triggerType": None,
                        "object": "Opportunity",
                        "recordTriggerType": "Update",
                    },
                }
            ],
            "edges": [],
        }

        normalized = normalize_generated_graph(
            "Create a Scheduled Flow that runs daily and closes Opportunities that haven't been updated for 90 days.",
            graph,
        )

        start_meta = normalized["nodes"][0]["metadata"]
        self.assertEqual(start_meta["trigger_type"], "Scheduled")
        self.assertEqual(start_meta["triggerType"], "Scheduled")
        self.assertNotIn("object", start_meta)
        self.assertNotIn("recordTriggerType", start_meta)
        self.assertIn("scheduled_paths", start_meta)
        self.assertEqual(start_meta["scheduled_paths"][0]["frequency"], "Daily")

    def test_non_scheduled_prompt_is_left_unchanged(self):
        graph = {
            "flow_name": "Account_Flow",
            "nodes": [
                {
                    "id": "Start",
                    "type": "Start",
                    "label": "Start",
                    "metadata": {"triggerType": "RecordAfterSave"},
                }
            ],
            "edges": [],
        }

        normalized = normalize_generated_graph("Create a screen flow", graph)

        self.assertEqual(
            normalized["nodes"][0]["metadata"]["triggerType"],
            "RecordAfterSave",
        )


if __name__ == "__main__":
    unittest.main()

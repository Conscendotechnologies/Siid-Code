import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from prompt_to_graph import load_schema_context


def test_load_schema_context_includes_exact_field_names_and_source():
    with tempfile.TemporaryDirectory() as tmpdir:
        schema_path = Path(tmpdir) / "schema.json"
        schema_path.write_text(
            json.dumps(
                {
                    "objects": {
                        "Information__c": {
                            "fields": [
                                {"name": "information__c", "type": "string", "required": False},
                                {"name": "Name", "type": "string", "required": True},
                            ]
                        }
                    }
                }
            ),
            encoding="utf-8",
        )

        schema_context = load_schema_context(str(schema_path))

        assert schema_context is not None
        assert "Schema source" in schema_context
        assert "information__c" in schema_context
        assert "Name" in schema_context

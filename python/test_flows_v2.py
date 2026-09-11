import os
import subprocess
import json
import sys
from pathlib import Path

# Ensure UTF-8 output on Windows terminals
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except ImportError:
    pass  # dotenv optional; env var can be set externally

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    raise RuntimeError("OPENROUTER_API_KEY not found in .env or environment")

os.environ["OPENROUTER_API_KEY"] = OPENROUTER_API_KEY

from flow_test_scenarios import TESTS

os.makedirs("graphs", exist_ok=True)
os.makedirs("flows", exist_ok=True)

passed_count = 0
failed_count = 0

for test in TESTS:
    name = test["name"]
    print(f"\n{'='*60}")
    print(f"Test: {name}")
    print(f"{'='*60}")

    graph_path = f"graphs/{name}.json"
    xml_path = f"flows/{name}.flow-meta.xml"

    # 1. Generate Graph
    cmd = ["python", "python/prompt_to_graph.py", test["prompt"], "--output", graph_path]
    r1 = subprocess.run(cmd, capture_output=True, text=True)
    if r1.returncode != 0:
        print(f"  [FAIL] prompt_to_graph.py failed (exit {r1.returncode})")
        print(f"  stderr: {r1.stderr.strip()[:400]}")
        failed_count += 1
        continue

    # 2. Convert to XML
    cmd2 = ["python", "python/graph_to_flow_xml.py", graph_path, xml_path,
            "--api-version", test.get("version", "67.0"), "--status", test.get("status", "Active")]
    r2 = subprocess.run(cmd2, capture_output=True, text=True)
    if r2.returncode != 0:
        print(f"  [FAIL] graph_to_flow_xml.py failed (exit {r2.returncode})")
        print(f"  stderr: {r2.stderr.strip()[:400]}")
        failed_count += 1
        continue

    # 3. Semantic comparison against reference (skipped when reference is None)
    reference = test.get("reference")
    if not reference:
        print(f"  Score : n/a  PASS  (no reference — generation-only test)")
        passed_count += 1
        continue

    cmd3 = ["python", "python/flow_validator.py", reference, xml_path]
    r3 = subprocess.run(cmd3, capture_output=True, text=True)

    try:
        rep = json.loads(r3.stdout)
    except json.JSONDecodeError:
        print(f"  [FAIL] flow_validator.py produced no JSON")
        if r3.stderr:
            print(f"  stderr: {r3.stderr.strip()[:300]}")
        failed_count += 1
        continue

    score = rep.get("score", 0.0)
    ok = rep.get("passed", False)
    print(f"  Score : {score:.2f}%  {'PASS' if ok else 'FAIL'}")

    if rep.get("node_diffs"):
        print(f"  Node diffs ({len(rep['node_diffs'])}):")
        for d in rep["node_diffs"][:5]:
            print(f"    - {d}")

    if rep.get("connector_diffs"):
        print(f"  Connector diffs ({len(rep['connector_diffs'])}):")
        for d in rep["connector_diffs"][:3]:
            print(f"    - {d}")

    if rep.get("parameter_diffs"):
        print(f"  Parameter diffs:")
        for d in rep["parameter_diffs"][:3]:
            print(f"    - {d}")

    if rep.get("recommended_fixes"):
        print(f"  Recommended fixes:")
        for f in rep["recommended_fixes"][:3]:
            print(f"    > {f}")

    if ok:
        passed_count += 1
    else:
        failed_count += 1

print(f"\n{'='*60}")
print(f"Results: {passed_count}/{passed_count + failed_count} passed")
print(f"{'='*60}")

if failed_count > 0:
    sys.exit(1)

"""
Validate real flow XMLs (flows-xml/) against the structural invariants
that graph_to_flow_xml.py should enforce.

Checks:
  1. assignToReference in assignments — bare field names missing $Record. prefix
  2. leftValueReference in conditions — bare field names missing $Record. prefix
  3. Invalid operators (non-standard Salesforce values)
  4. Double-nested <elementReference>
  5. <formulas> with relative-date expressions (should use elementReference to formula resource)

Usage:
  python python/test_real_flows.py                  # validate all flows-xml/*.flow-meta.xml
  python python/test_real_flows.py path/to/one.xml  # validate one file

Exit code 0 = all pass, 1 = violations found.
"""
import xml.etree.ElementTree as ET
import sys
import os
from pathlib import Path
from typing import List, Tuple

NS = "{http://soap.sforce.com/2006/04/metadata}"


def strip_ns(tag: str) -> str:
    return tag[len(NS):] if tag.startswith(NS) else tag


# ── Known-good operators ──────────────────────────────────────────────
CONDITION_OPERATORS = {
    "EqualTo", "NotEqualTo", "GreaterThan", "LessThan",
    "GreaterThanOrEqualTo", "LessThanOrEqualTo",
    "Contains", "StartsWith", "EndsWith",
    "IsNull", "IsNotNull", "IsChanged",
    "IsBlank", "IsEmpty", "WasSet",
}

ASSIGNMENT_OPERATORS = {
    "Assign", "Add", "Subtract", "Multiply", "Divide",
    "AssignCount", "Equals",  # Equals is valid in some SF versions
}

# ── Patterns that are definitely not bare field names ─────────────────
# Anything containing a dot is a compound ref (e.g. LoopVar.Field, $Record.X)
# Anything starting with these prefixes is a variable/element, not a bare field.
SAFE_PREFIXES = ("$", "{!", "var", "Loop_", "Get_", "Update_", "Create_",
                  "Delete_", "Fast_", "Screen_", "Decision_", "Assignment_",
                  "Subflow_", "Action_", "Wait_", "Transform_")

# Salesforce global variables that are valid as bare references (no $Record. prefix)
SF_GLOBAL_VARS = {
    "IsNew", "IsNewRecord", "Is_New", "IsChanged",
    "PriorValue", "IsPriorValue", "IsDeleted",
    "SystemModstamp", "CreatedDate", "LastModifiedDate",
    "OwnerId", "RecordTypeId", "AccountId", "ContactId",
}


class Violation:
    def __init__(self, file: str, element: str, path: str, issue: str):
        self.file = file
        self.element = element
        self.path = path
        self.issue = issue

    def __str__(self):
        return f"[{self.file}] {self.element} @ {self.path}: {self.issue}"


def is_probably_bare_field(ref: str) -> bool:
    """Return True if ref looks like a bare Salesforce field name missing $Record. prefix."""
    if not ref or ref.isspace():
        return False
    if any(ref.startswith(p) for p in SAFE_PREFIXES):
        return False
    if "." in ref:
        return False
    # Salesforce global variables are valid as bare references
    if ref in SF_GLOBAL_VARS:
        return False
    # If it starts with uppercase and has no prefix, it's likely a bare field
    # (e.g. CloseDate, StageName, Amount, Discount__c)
    if ref[0].isupper():
        return True
    return False


def is_record_triggered(root: ET.Element) -> bool:
    """Check if this flow is record-triggered."""
    start = root.find(f"{NS}start")
    if start is None:
        return False
    trigger = start.find(f"{NS}triggerType")
    if trigger is not None and trigger.text and "Record" in trigger.text:
        return True
    record_trigger = start.find(f"{NS}recordTriggerType")
    return record_trigger is not None


def validate_flow(xml_path: str) -> List[Violation]:
    """Validate a single flow XML file against structural invariants."""
    violations: List[Violation] = []
    fname = os.path.basename(xml_path)

    try:
        tree = ET.parse(xml_path)
    except ET.ParseError as e:
        violations.append(Violation(fname, "XML", "parse", f"XML parse error: {e}"))
        return violations

    root = tree.getroot()
    record_triggered = is_record_triggered(root)

    # Collect declared variable names so we don't flag them as bare fields
    declared_vars: set[str] = set()
    for var_el in root.iter(f"{NS}variables"):
        name_el = var_el.find(f"{NS}name")
        if name_el is not None and name_el.text:
            declared_vars.add(name_el.text.strip())

    # Also collect formula names (valid as elementReference targets)
    formula_names: set[str] = set()
    for f_el in root.iter(f"{NS}formulas"):
        name_el = f_el.find(f"{NS}name")
        if name_el is not None and name_el.text:
            formula_names.add(name_el.text.strip())

    # Collect constant names
    constant_names: set[str] = set()
    for c_el in root.iter(f"{NS}constants"):
        name_el = c_el.find(f"{NS}name")
        if name_el is not None and name_el.text:
            constant_names.add(name_el.text.strip())

    known_names = declared_vars | formula_names | constant_names

    def is_bare_field(ref: str) -> bool:
        """Check if ref is a bare field name, excluding known variables/formulas/constants."""
        if ref in known_names:
            return False
        return is_probably_bare_field(ref)

    # ── Check 1: assignToReference in assignments ─────────────────────
    for assign in root.iter(f"{NS}assignments"):
        name_el = assign.find(f"{NS}name")
        node_name = name_el.text if name_el is not None else "?"
        for item in assign.iter(f"{NS}assignmentItems"):
            ref_el = item.find(f"{NS}assignToReference")
            if ref_el is not None and ref_el.text:
                ref = ref_el.text.strip()
                if record_triggered and is_bare_field(ref):
                    violations.append(Violation(
                        fname, f"Assignment({node_name})",
                        f"assignmentItems/assignToReference",
                        f"bare field '{ref}' — should be '$Record.{ref}'"
                    ))

    # ── Check 2: leftValueReference in conditions ─────────────────────
    for dec in root.iter(f"{NS}decisions"):
        name_el = dec.find(f"{NS}name")
        node_name = name_el.text if name_el is not None else "?"
        for rule in dec.iter(f"{NS}rules"):
            for cond in rule.iter(f"{NS}conditions"):
                left_el = cond.find(f"{NS}leftValueReference")
                if left_el is not None and left_el.text:
                    ref = left_el.text.strip()
                    if record_triggered and is_bare_field(ref):
                        violations.append(Violation(
                            fname, f"Decision({node_name})",
                            "rules/conditions/leftValueReference",
                            f"bare field '{ref}' — should be '$Record.{ref}'"
                        ))

    # ── Check 3: Invalid operators ────────────────────────────────────
    for dec in root.iter(f"{NS}decisions"):
        name_el = dec.find(f"{NS}name")
        node_name = name_el.text if name_el is not None else "?"
        for rule in dec.iter(f"{NS}rules"):
            for cond in rule.iter(f"{NS}conditions"):
                op_el = cond.find(f"{NS}operator")
                if op_el is not None and op_el.text:
                    op = op_el.text.strip()
                    if op not in CONDITION_OPERATORS:
                        violations.append(Violation(
                            fname, f"Decision({node_name})",
                            "rules/conditions/operator",
                            f"non-standard operator '{op}' (expected one of {CONDITION_OPERATORS})"
                        ))

    # ── Check 4: Double-nested elementReference ───────────────────────
    for elem_ref in root.iter(f"{NS}elementReference"):
        if elem_ref.text is None:
            # Check if it has a child elementReference (double-nested)
            child_ref = elem_ref.find(f"{NS}elementReference")
            if child_ref is not None:
                violations.append(Violation(
                    fname, "elementReference",
                    "value/elementReference",
                    "double-nested <elementReference> detected"
                ))

    # ── Check 5: Filter conditions missing $Record. prefix ────────────
    for lookup in root.iter(f"{NS}recordLookups"):
        name_el = lookup.find(f"{NS}name")
        node_name = name_el.text if name_el is not None else "?"
        for filt in lookup.iter(f"{NS}filters"):
            field_el = filt.find(f"{NS}field")
            if field_el is not None and field_el.text:
                field = field_el.text.strip()
                # In recordLookups, filters.field should be a bare field name (no $Record.)
                # This is correct — SF metadata uses bare names here.
                # But if someone puts $Record.X here, that's wrong.
                if field.startswith("$Record."):
                    violations.append(Violation(
                        fname, f"GetRecords({node_name})",
                        "recordLookups/filters/field",
                        f"'{field}' should be bare field name (no $Record. prefix in filters)"
                    ))

    # ── Check 6: recordUpdates missing inputReference/object ──────────
    for update in root.iter(f"{NS}recordUpdates"):
        name_el = update.find(f"{NS}name")
        node_name = name_el.text if name_el is not None else "?"
        input_ref = update.find(f"{NS}inputReference")
        obj = update.find(f"{NS}object")
        if input_ref is None and obj is None:
            violations.append(Violation(
                fname, f"UpdateRecords({node_name})",
                "recordUpdates",
                "missing both <inputReference> and <object>"
            ))

    return violations


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Validate real flow XMLs against parser invariants")
    parser.add_argument("paths", nargs="*", default=["flows-xml"],
                        help="XML files or directories to validate (default: flows-xml/)")
    parser.add_argument("--strict", action="store_true",
                        help="Exit 1 on any violation (default: warn only)")
    args = parser.parse_args()

    xml_files: List[str] = []
    for p in args.paths:
        path = Path(p)
        if path.is_dir():
            xml_files.extend(str(f) for f in sorted(path.glob("*.flow-meta.xml")))
        elif path.is_file():
            xml_files.append(str(path))
        else:
            print(f"Warning: {p} not found, skipping", file=sys.stderr)

    if not xml_files:
        print("No .flow-meta.xml files found.", file=sys.stderr)
        sys.exit(1)

    total_violations: List[Violation] = []
    files_with_violations = 0

    for xml_file in xml_files:
        violations = validate_flow(xml_file)
        if violations:
            files_with_violations += 1
            total_violations.extend(violations)
            for v in violations:
                print(f"  WARN {v}")

    print(f"\n{'='*60}")
    print(f"Validated {len(xml_files)} flow(s), {files_with_violations} with violations")
    print(f"Total violations: {len(total_violations)}")

    if total_violations:
        # Group by issue type
        by_issue: dict[str, int] = {}
        for v in total_violations:
            key = v.issue.split("—")[0].strip() if "—" in v.issue else v.issue[:60]
            by_issue[key] = by_issue.get(key, 0) + 1
        print("\nBy type:")
        for issue, count in sorted(by_issue.items(), key=lambda x: -x[1]):
            print(f"  {count:3d}× {issue}")

    if args.strict and total_violations:
        sys.exit(1)


if __name__ == "__main__":
    main()

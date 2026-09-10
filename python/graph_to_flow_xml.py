from __future__ import annotations

import argparse
import io
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Set, Tuple
import xml.etree.ElementTree as ET


def safe_identifier(value: str, fallback: str) -> str:
    """Convert a string to a safe Salesforce identifier."""
    sanitized = re.sub(r"[^A-Za-z0-9_]+", "_", value.strip())
    sanitized = re.sub(r"_+", "_", sanitized).strip("_")
    if not sanitized:
        sanitized = fallback
    if sanitized[0].isdigit():
        sanitized = f"n_{sanitized}"
    return sanitized


FLOW_XML_NAMESPACE = "http://soap.sforce.com/2006/04/metadata"
ET.register_namespace("", FLOW_XML_NAMESPACE)

SUPPORTED_NODE_TYPES = {
    "Start",
    "Decision",
    "Assignment",
    "GetRecords",
    "UpdateRecords",
    "CreateRecords",
    "Loop",
    "Screen",
    "Wait",
    "SendEmail",
    "ActionCall",
    "Subflow",
    "CustomError",
    "End",
    "Formula",  # LLM sometimes emits Formula as a node; treated as top-level formula resource
}
SUPPORTED_ASSIGNMENT_TAGS = {"assignments", "actionCalls", "subflows"}
SUPPORTED_UPDATE_TAGS = {"recordUpdates", "recordCreates", "recordDeletes"}
TERMINAL_END_REASONS = {"terminal_node"}
REJECTED_SYNTHETIC_EDGE_REASONS = {"missing_target", "broken_reference"}
DEFAULT_API_VERSION = "62.0"
DEFAULT_STATUS = "Draft"
DEFAULT_PROCESS_TYPE = "AutoLaunchedFlow"
REPO_ROOT = Path(__file__).resolve().parent.parent
SCREEN_FLOW_PROCESS_TYPE = "Flow"
DEFAULT_INTERVIEW_LABEL_SUFFIX = " {!$Flow.CurrentDateTime}"
DEFAULT_ARE_METRICS_LOGGED_TO_DATA_CLOUD = False
DEFAULT_PROCESS_METADATA_VALUES = (
    ("BuilderType", {"stringValue": "LightningFlowBuilder"}),
    ("CanvasMode", {"stringValue": "AUTO_LAYOUT_CANVAS"}),
    ("OriginBuilderType", {"stringValue": "LightningFlowBuilder"}),
)


class GraphGenerationError(Exception):
    """Raised when parser-compatible graph JSON cannot be emitted as valid Flow XML."""


@dataclass(frozen=True)
class IndexedNode:
    id: str
    type: str
    label: str
    metadata: Mapping[str, Any]
    reference_name: str
    original_tag: Optional[str]


@dataclass(frozen=True)
class IndexedEdge:
    source: str
    target: str
    condition: Optional[str]
    metadata: Mapping[str, Any]


@dataclass(frozen=True)
class IndexedGraph:
    flow_name: str
    nodes: Sequence[IndexedNode]
    edges: Sequence[IndexedEdge]
    node_by_id: Mapping[str, IndexedNode]
    outgoing_by_id: Mapping[str, Sequence[IndexedEdge]]
    incoming_by_id: Mapping[str, Sequence[IndexedEdge]]
    start_node: IndexedNode


@dataclass(frozen=True)
class DecisionRulePlan:
    edge: IndexedEdge
    rule_metadata: Mapping[str, Any]
    matched_index: int = -1  # index into node.metadata["rules"] that was matched; -1 = synthesized


@dataclass(frozen=True)
class DecisionPlan:
    default_edge: Optional[IndexedEdge]
    default_label: Optional[str]
    rule_plans: Sequence[DecisionRulePlan]
    fault_edge: Optional[IndexedEdge]


@dataclass(frozen=True)
class LoopPlan:
    loop_edge: IndexedEdge
    exit_edge: Optional[IndexedEdge]
    fault_edge: Optional[IndexedEdge]


def flow_tag(name: str) -> str:
    return f"{{{FLOW_XML_NAMESPACE}}}{name}"


def normalize_condition(value: Any) -> Optional[str]:
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    normalized = value.strip()
    return normalized or None


def is_before_save_flow(graph: IndexedGraph) -> bool:
    trigger_type = normalize_condition(graph.start_node.metadata.get("trigger_type") or graph.start_node.metadata.get("triggerType"))
    return trigger_type == "RecordBeforeSave"


def is_record_triggered(graph: IndexedGraph) -> bool:
    trigger_type = normalize_condition(graph.start_node.metadata.get("trigger_type") or graph.start_node.metadata.get("triggerType"))
    return trigger_type is not None and "Record" in trigger_type


def validate_fast_field_update_target(graph: IndexedGraph, node: IndexedNode, input_reference: Optional[str], object_name: Optional[str]) -> None:
    if not is_before_save_flow(graph):
        return

    original_tag = effective_original_tag(node)
    if original_tag != "recordUpdates":
        return

    trigger_object = normalize_condition(graph.start_node.metadata.get("object"))
    if input_reference is not None:
        if input_reference == "$Record" or input_reference.startswith("$Record."):
            return
        raise GraphGenerationError(
            f"UpdateRecords node {node.id} is invalid in a before-save/Fast Field Updates flow. "
            "Use the triggering record as the target (for example $Record) or remove the update element."
        )

    if trigger_object is not None and object_name is not None and object_name != trigger_object:
        raise GraphGenerationError(
            f"UpdateRecords node {node.id} is invalid in a before-save/Fast Field Updates flow. "
            f"It can only update the triggering record object '{trigger_object}'."
        )


def load_graph_json(path: Path) -> Dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            graph = json.load(handle)
    except FileNotFoundError as exc:
        raise GraphGenerationError(f"Graph JSON file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise GraphGenerationError(f"Graph JSON is not valid JSON: {exc}") from exc

    if not isinstance(graph, dict):
        raise GraphGenerationError("Graph JSON root must be an object")

    return graph


def ensure_mapping(value: Any, context: str) -> Mapping[str, Any]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise GraphGenerationError(f"{context} must be a JSON object")
    return value


def ensure_sequence(value: Any, context: str) -> Sequence[Any]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise GraphGenerationError(f"{context} must be a JSON array")
    return value


def safe_flow_name(graph: Mapping[str, Any]) -> str:
    flow_name = graph.get("flow_name")
    if not isinstance(flow_name, str) or not flow_name.strip():
        raise GraphGenerationError("Graph flow_name must be a non-empty string")
    return flow_name.strip()


def node_reference_name(node: IndexedNode) -> str:
    return node.reference_name


def target_reference_name(graph: IndexedGraph, edge: IndexedEdge) -> Optional[str]:
    target_node = graph.node_by_id[edge.target]
    if target_node.type == "End":
        return None
    return node_reference_name(target_node)


def is_fault_edge(edge: IndexedEdge) -> bool:
    return normalize_condition(edge.condition) == "fault"


def is_terminal_node(node: IndexedNode) -> bool:
    return node.type == "End"


def is_terminal_edge(graph: IndexedGraph, edge: IndexedEdge) -> bool:
    return is_terminal_node(graph.node_by_id[edge.target])


def build_indexed_graph(graph: Mapping[str, Any]) -> Tuple[IndexedGraph, List[Dict[str, Any]]]:
    flow_name = safe_flow_name(graph)
    raw_nodes = ensure_sequence(graph.get("nodes"), "Graph nodes")
    raw_edges = ensure_sequence(graph.get("edges"), "Graph edges")

    nodes: List[IndexedNode] = []
    node_by_id: Dict[str, IndexedNode] = {}
    outgoing_by_id: Dict[str, List[IndexedEdge]] = {}
    incoming_by_id: Dict[str, List[IndexedEdge]] = {}
    
    # First pass: identify trigger object
    trigger_object = ""
    for raw_node in raw_nodes:
        node_mapping = ensure_mapping(raw_node, "Node")
        if node_mapping.get("type") == "Start":
            node_metadata = ensure_mapping(node_mapping.get("metadata"), "Start metadata")
            trigger_object = node_metadata.get("object", "")
            break

    for index, raw_node in enumerate(raw_nodes):
        node_mapping = ensure_mapping(raw_node, f"Node at index {index}")
        node_id = node_mapping.get("id")
        node_type = node_mapping.get("type")
        node_label = node_mapping.get("label")
        metadata = ensure_mapping(node_mapping.get("metadata"), f"Node {node_id} metadata")
        
        # Normalize AI-generated graph structure (move configs to metadata)
        if "configs" in node_mapping:
            configs = ensure_mapping(node_mapping.get("configs"), f"Node {node_id} configs")
            # Move configs fields into metadata
            if "object" in configs:
                metadata = {**metadata, "object": configs["object"]}
            if "fields" in configs:
                # Convert fields array to input_assignments format
                fields = ensure_sequence(configs.get("fields"), "Node configs fields")
                input_assignments = []
                for field in fields:
                    field_mapping = ensure_mapping(field, "field")
                    field_value = field_mapping.get("value")
                    # Wrap plain string values in stringValue
                    if isinstance(field_value, str):
                        field_value = {"stringValue": field_value}
                    input_assignments.append({
                        "field": field_mapping.get("field"),
                        "value": field_value
                    })
                if input_assignments:
                    metadata = {**metadata, "input_assignments": input_assignments}
        
        # Normalize original_tag to correct Salesforce names
        original_tag = metadata.get("original_tag")
        if original_tag == "createRecords":
            original_tag = "recordCreates"
            metadata = {**metadata, "original_tag": original_tag}
        elif original_tag in {"decision", "Decision"}:
            original_tag = "decisions"
            metadata = {**metadata, "original_tag": original_tag}
        elif original_tag in {"end", "End"}:
            # End nodes shouldn't have an original_tag
            original_tag = None
            if "original_tag" in metadata:
                metadata = {k: v for k, v in metadata.items() if k != "original_tag"}

        # Normalize GetRecords node fields: provide defaults for missing fields
        if node_type == "GetRecords":
            # Ensure required boolean fields have values
            if "store_output_automatically" not in metadata:
                metadata = {**metadata, "store_output_automatically": True}
            if "get_first_record_only" not in metadata:
                metadata = {**metadata, "get_first_record_only": False}
            if "assign_null_values_if_no_records_found" not in metadata:
                metadata = {**metadata, "assign_null_values_if_no_records_found": False}
        
        # Normalize Task field mappings: Fix WhatId→WhoId for person-type triggers
        person_objects = {"Contact", "Lead"}
        if trigger_object in person_objects and node_type == "CreateRecords":
            if metadata.get("object") == "Task":
                input_assignments = metadata.get("input_assignments", [])
                corrected_assignments = []
                for assignment in input_assignments:
                    assignment_dict = ensure_mapping(assignment, f"input assignment in {node_id}")
                    field = assignment_dict.get("field")
                    # If WhatId references $Record.Id on a person trigger, change to WhoId
                    if field == "WhatId":
                        value = assignment_dict.get("value", {})
                        if isinstance(value, dict) and value.get("elementReference") == "$Record.Id":
                            # Switch to WhoId for person records
                            corrected_assignments.append({"field": "WhoId", "value": value})
                        else:
                            corrected_assignments.append(assignment_dict)
                    else:
                        corrected_assignments.append(assignment_dict)
                if corrected_assignments:
                    metadata = {**metadata, "input_assignments": corrected_assignments}

        if not isinstance(node_id, str) or not node_id.strip():
            raise GraphGenerationError(f"Node at index {index} is missing a non-empty id")
        if node_id in node_by_id:
            raise GraphGenerationError(f'Duplicate node id detected: "{node_id}"')
        if not isinstance(node_type, str) or node_type not in SUPPORTED_NODE_TYPES:
            raise GraphGenerationError(f'Unsupported node type for node {node_id}: {node_type!r}')
        if not isinstance(node_label, str) or not node_label.strip():
            raise GraphGenerationError(f"Node {node_id} is missing a non-empty label")

        reference_name = metadata.get("name")
        if not isinstance(reference_name, str) or not reference_name.strip():
            reference_name = node_id

        original_tag = metadata.get("original_tag")
        if original_tag is not None and not isinstance(original_tag, str):
            raise GraphGenerationError(f"Node {node_id} metadata.original_tag must be a string when present")

        indexed_node = IndexedNode(
            id=node_id,
            type=node_type,
            label=node_label,
            metadata=metadata,
            reference_name=reference_name,
            original_tag=original_tag,
        )
        nodes.append(indexed_node)
        node_by_id[node_id] = indexed_node
        outgoing_by_id[node_id] = []
        incoming_by_id[node_id] = []

    start_nodes = [node for node in nodes if node.type == "Start"]
    if len(start_nodes) != 1:
        raise GraphGenerationError(
            f"Graph must contain exactly one Start node; found {len(start_nodes)}"
        )

    edges: List[IndexedEdge] = []
    for index, raw_edge in enumerate(raw_edges):
        edge_mapping = ensure_mapping(raw_edge, f"Edge at index {index}")
        source_id = edge_mapping.get("from")
        target_id = edge_mapping.get("to")
        metadata = ensure_mapping(edge_mapping.get("metadata"), f"Edge {index} metadata")
        condition = normalize_condition(edge_mapping.get("condition"))

        if not isinstance(source_id, str) or not source_id.strip():
            raise GraphGenerationError(f"Edge at index {index} is missing a non-empty from value")
        if not isinstance(target_id, str) or not target_id.strip():
            raise GraphGenerationError(f"Edge at index {index} is missing a non-empty to value")
        if source_id not in node_by_id or target_id not in node_by_id:
            raise GraphGenerationError(f"Edge references unknown nodes: {source_id} -> {target_id}")

        indexed_edge = IndexedEdge(
            source=source_id,
            target=target_id,
            condition=condition,
            metadata=metadata,
        )
        edges.append(indexed_edge)
        outgoing_by_id[source_id].append(indexed_edge)
        incoming_by_id[target_id].append(indexed_edge)

    indexed_graph = IndexedGraph(
        flow_name=flow_name,
        nodes=nodes,
        edges=edges,
        node_by_id=node_by_id,
        outgoing_by_id=outgoing_by_id,
        incoming_by_id=incoming_by_id,
        start_node=start_nodes[0],
    )
    
    # Auto-link UpdateRecords/CreateRecords to GetRecords collections
    # Handles two topologies:
    #   A) GetRecords → UpdateRecords (direct)
    #   B) GetRecords → Loop → UpdateRecords (inside loop body)
    #
    # For (A) with input_assignments, GetRecords is single-record (getFirstRecordOnly=true):
    #   filter on Id = GetRecords.Id — valid, GetRecords.Id is a scalar merge field.
    # For (A) with input_assignments, GetRecords is multi-record (getFirstRecordOnly=false):
    #   GetRecords.Id refers to a collection, not a scalar — Salesforce Flow Builder rejects
    #   "resource can't be used as a merge field" if we filter on it directly. This is the
    #   "update all related records" scenario (e.g. "update all Contacts on the Account").
    #   Synthesize the pattern real Flow Builder uses: GetRecords → Loop → Assignment (set the
    #   fields on the current loop item, then append it to a new collection variable) → back to
    #   Loop → UpdateRecords once, after the loop, via inputReference to that collection variable.
    # For (A) without input_assignments: use inputReference = GetRecords
    # For (B) with input_assignments:  filter on Id = LoopNode.Id  (loop current-item variable)
    # For (B) without input_assignments: use inputReference = LoopNode  (loop current-item variable)

    def _find_upstream_get_records(node_id: str) -> Optional[Tuple[IndexedNode, Optional[IndexedNode]]]:
        """
        Walk backwards through incoming edges to find an upstream GetRecords node.
        Also returns the Loop node if there is one between GetRecords and this node.
        Returns (get_records_node, loop_node_or_None) or None if not found.
        """
        for edge in incoming_by_id.get(node_id, []):
            src = node_by_id.get(edge.source)
            if src is None:
                continue
            if src.type == "GetRecords":
                return src, None
            if src.type == "Loop":
                # Loop node — look for GetRecords feeding the Loop
                for loop_in_edge in incoming_by_id.get(src.id, []):
                    loop_src = node_by_id.get(loop_in_edge.source)
                    if loop_src and loop_src.type == "GetRecords":
                        return loop_src, src  # (GetRecords, Loop)
        return None

    taken_reference_names: Set[str] = {n.reference_name for n in indexed_graph.nodes}

    def _unique_reference_name(base: str) -> str:
        candidate = base
        suffix = 2
        while candidate in taken_reference_names:
            candidate = f"{base}_{suffix}"
            suffix += 1
        taken_reference_names.add(candidate)
        return candidate

    synthesized_variables: List[Dict[str, Any]] = []
    extra_nodes: List[IndexedNode] = []
    # (old direct GetRecords→UpdateRecords edge, [replacement chain edges]), applied after
    # the node loop below so incoming_by_id stays consistent while it's being read.
    edge_rewrites: List[Tuple[IndexedEdge, List[IndexedEdge]]] = []

    corrected_nodes = []
    for node in indexed_graph.nodes:
        if node.type in {"UpdateRecords", "CreateRecords"}:
            upstream = _find_upstream_get_records(node.id)
            if upstream is not None:
                get_records_node, loop_node = upstream
                input_assignments = node.metadata.get("input_assignments", [])

                if (
                    node.type == "UpdateRecords"
                    and input_assignments
                    and loop_node is None
                    and not node.metadata.get("filters")
                    and not get_records_node.metadata.get("get_first_record_only")
                ):
                    # Direct GetRecords (multi-record) → UpdateRecords with per-record field
                    # values: expand into GetRecords → Loop → Assignment → Loop → UpdateRecords
                    # instead of injecting an invalid filter on the collection's Id.
                    direct_edge = next(
                        e for e in incoming_by_id.get(node.id, []) if e.source == get_records_node.id
                    )

                    loop_id = _unique_reference_name(f"loop_{get_records_node.id}")
                    assign_id = _unique_reference_name(f"assign_{node.id}")
                    collection_var_name = _unique_reference_name(
                        f"{get_records_node.reference_name}_to_update"
                    )

                    get_records_position = get_records_node.metadata.get("position")
                    base_x = get_records_position.get("x") if isinstance(get_records_position, dict) else None
                    base_y = get_records_position.get("y") if isinstance(get_records_position, dict) else None

                    def _offset_position(dx: int, dy: int) -> Optional[Dict[str, Any]]:
                        if base_x is None or base_y is None:
                            return None
                        return {"x": base_x + dx, "y": base_y + dy}

                    loop_node_new = IndexedNode(
                        id=loop_id,
                        type="Loop",
                        label=f"Loop {get_records_node.label}",
                        metadata={
                            "name": loop_id,
                            "collection_reference": get_records_node.reference_name,
                            "iteration_order": "Asc",
                            "position": _offset_position(0, 100),
                        },
                        reference_name=loop_id,
                        original_tag="loops",
                    )

                    assignment_items = []
                    for item in ensure_sequence(input_assignments, f"{node.id} input_assignments"):
                        item_mapping = ensure_mapping(item, "input_assignment")
                        field = item_mapping.get("field")
                        if not field:
                            continue
                        assignment_items.append({
                            "assign_to_reference": f"{loop_id}.{field}",
                            "operator": "Assign",
                            "value": item_mapping.get("value"),
                        })
                    assignment_items.append({
                        "assign_to_reference": collection_var_name,
                        "operator": "Add",
                        "value": {"elementReference": loop_id},
                    })
                    assignment_node_new = IndexedNode(
                        id=assign_id,
                        type="Assignment",
                        label=f"Set Fields on {get_records_node.label}",
                        metadata={
                            "name": assign_id,
                            "original_tag": "assignments",
                            "assignment_items": assignment_items,
                            "position": _offset_position(-100, 200),
                        },
                        reference_name=assign_id,
                        original_tag="assignments",
                    )

                    new_metadata = {
                        k: v
                        for k, v in node.metadata.items()
                        if k not in {"input_assignments", "filters", "filter_logic", "input_reference"}
                    }
                    new_metadata["input_reference"] = collection_var_name
                    new_node = IndexedNode(
                        id=node.id, type=node.type, label=node.label,
                        metadata=new_metadata, reference_name=node.reference_name,
                        original_tag=node.original_tag,
                    )

                    object_name = normalize_condition(get_records_node.metadata.get("object"))
                    synthesized_variables.append({
                        "name": collection_var_name,
                        "dataType": "SObject",
                        "isCollection": True,
                        "isInput": False,
                        "isOutput": False,
                        "objectType": object_name,
                    })

                    extra_nodes.append(loop_node_new)
                    extra_nodes.append(assignment_node_new)
                    node_by_id[loop_id] = loop_node_new
                    node_by_id[assign_id] = assignment_node_new
                    node_by_id[node.id] = new_node

                    edge_get_to_loop = IndexedEdge(source=get_records_node.id, target=loop_id, condition=None, metadata={})
                    edge_loop_to_assign = IndexedEdge(source=loop_id, target=assign_id, condition=None, metadata={})
                    edge_assign_to_loop = IndexedEdge(source=assign_id, target=loop_id, condition=None, metadata={})
                    edge_loop_to_update = IndexedEdge(source=loop_id, target=node.id, condition=None, metadata={})
                    edge_rewrites.append((
                        direct_edge,
                        [edge_get_to_loop, edge_loop_to_assign, edge_assign_to_loop, edge_loop_to_update],
                    ))

                    corrected_nodes.append(new_node)
                    continue

                if (
                    node.type == "UpdateRecords"
                    and input_assignments
                    and loop_node is not None
                ):
                    # An explicit Loop already exists in the graph (the AI emitted
                    # Loop → UpdateRecords directly). Confirm this UpdateRecords is really
                    # the loop body — it loops back to the Loop node — rather than a node
                    # positioned after the loop exits.
                    body_edge = next(
                        (e for e in outgoing_by_id.get(node.id, []) if e.target == loop_node.id),
                        None,
                    )
                    if body_edge is not None:
                        # Per-iteration UpdateRecords inside a loop body: real Flow Builder
                        # never issues one DML call per iteration for "update all related
                        # records". Synthesize the pattern it actually emits: set fields on
                        # the loop item and append it to a collection variable inside the
                        # loop, then perform a single bulk update once, after the loop exits.
                        loop_to_node_edge = next(
                            e for e in incoming_by_id.get(node.id, []) if e.source == loop_node.id
                        )
                        exit_edge = next(
                            e for e in outgoing_by_id.get(loop_node.id, []) if e.target != node.id
                        )

                        assign_id = _unique_reference_name(f"assign_{node.id}")
                        collection_var_name = _unique_reference_name(
                            f"{get_records_node.reference_name}_to_update"
                        )

                        assignment_items = []
                        for item in ensure_sequence(input_assignments, f"{node.id} input_assignments"):
                            item_mapping = ensure_mapping(item, "input_assignment")
                            field = item_mapping.get("field")
                            if not field:
                                continue
                            assignment_items.append({
                                "assign_to_reference": f"{loop_node.reference_name}.{field}",
                                "operator": "Assign",
                                "value": item_mapping.get("value"),
                            })
                        assignment_items.append({
                            "assign_to_reference": collection_var_name,
                            "operator": "Add",
                            "value": {"elementReference": loop_node.reference_name},
                        })
                        assignment_node_new = IndexedNode(
                            id=assign_id,
                            type="Assignment",
                            label=node.label,
                            metadata={
                                "name": assign_id,
                                "original_tag": "assignments",
                                "assignment_items": assignment_items,
                                "position": node.metadata.get("position"),
                            },
                            reference_name=assign_id,
                            original_tag="assignments",
                        )

                        object_name = (
                            normalize_condition(node.metadata.get("object"))
                            or normalize_condition(get_records_node.metadata.get("object"))
                        )
                        synthesized_variables.append({
                            "name": collection_var_name,
                            "dataType": "SObject",
                            "isCollection": True,
                            "isInput": False,
                            "isOutput": False,
                            "objectType": object_name,
                        })

                        new_metadata = {
                            k: v
                            for k, v in node.metadata.items()
                            if k not in {"input_assignments", "filters", "filter_logic", "input_reference"}
                        }
                        new_metadata["input_reference"] = collection_var_name
                        bulk_update_node = IndexedNode(
                            id=node.id, type=node.type, label=node.label,
                            metadata=new_metadata, reference_name=node.reference_name,
                            original_tag=node.original_tag,
                        )

                        extra_nodes.append(assignment_node_new)
                        node_by_id[assign_id] = assignment_node_new
                        node_by_id[node.id] = bulk_update_node

                        new_loop_to_assign = IndexedEdge(source=loop_node.id, target=assign_id, condition=None, metadata={})
                        new_assign_to_loop = IndexedEdge(source=assign_id, target=loop_node.id, condition=None, metadata={})
                        new_loop_to_update = IndexedEdge(source=loop_node.id, target=node.id, condition=None, metadata={})
                        new_update_to_exit = IndexedEdge(
                            source=node.id, target=exit_edge.target,
                            condition=exit_edge.condition, metadata=exit_edge.metadata,
                        )

                        edge_rewrites.append((loop_to_node_edge, [new_loop_to_assign]))
                        edge_rewrites.append((body_edge, [new_assign_to_loop]))
                        edge_rewrites.append((exit_edge, [new_loop_to_update, new_update_to_exit]))

                        corrected_nodes.append(bulk_update_node)
                        continue

                if input_assignments:
                    new_metadata = {**node.metadata}
                    new_metadata.pop("input_reference", None)

                    if loop_node is not None:
                        # Inside a Loop: filter on Id = LoopNode.Id (current loop item)
                        # Always override — any filter the LLM generated here is wrong
                        new_metadata["filters"] = [
                            {
                                "field": "Id",
                                "operator": "EqualTo",
                                "value": {
                                    "elementReference": f"{loop_node.reference_name}.Id"
                                },
                            }
                        ]
                        new_metadata["filter_logic"] = "and"
                    else:
                        # Direct GetRecords → UpdateRecords: only inject if no explicit filters
                        if not new_metadata.get("filters"):
                            new_metadata["filters"] = [
                                {
                                    "field": "Id",
                                    "operator": "EqualTo",
                                    "value": {
                                        "elementReference": f"{get_records_node.reference_name}.Id"
                                    },
                                }
                            ]
                            new_metadata["filter_logic"] = "and"

                    new_node = IndexedNode(
                        id=node.id, type=node.type, label=node.label,
                        metadata=new_metadata, reference_name=node.reference_name,
                        original_tag=node.original_tag,
                    )
                else:
                    # No assignments: use inputReference
                    ref = loop_node.reference_name if loop_node else get_records_node.reference_name
                    new_metadata = {**node.metadata, "input_reference": ref}
                    new_node = IndexedNode(
                        id=node.id, type=node.type, label=node.label,
                        metadata=new_metadata, reference_name=node.reference_name,
                        original_tag=node.original_tag,
                    )

                corrected_nodes.append(new_node)
                node_by_id[node.id] = new_node
            else:
                corrected_nodes.append(node)
        else:
            corrected_nodes.append(node)

    corrected_nodes.extend(extra_nodes)
    for extra_node in extra_nodes:
        outgoing_by_id.setdefault(extra_node.id, [])
        incoming_by_id.setdefault(extra_node.id, [])

    # Splice in the Loop/Assignment chains synthesized above: drop each direct
    # GetRecords→UpdateRecords edge and wire in its replacement chain instead.
    rewritten_edges: List[IndexedEdge] = list(indexed_graph.edges)
    for old_edge, new_edges in edge_rewrites:
        rewritten_edges = [e for e in rewritten_edges if e is not old_edge]
        outgoing_by_id[old_edge.source] = [
            e for e in outgoing_by_id.get(old_edge.source, []) if e is not old_edge
        ]
        incoming_by_id[old_edge.target] = [
            e for e in incoming_by_id.get(old_edge.target, []) if e is not old_edge
        ]
        for new_edge in new_edges:
            rewritten_edges.append(new_edge)
            outgoing_by_id.setdefault(new_edge.source, []).append(new_edge)
            incoming_by_id.setdefault(new_edge.target, []).append(new_edge)

    # Rebuild the indexed graph with corrected nodes
    indexed_graph = IndexedGraph(
        flow_name=indexed_graph.flow_name,
        nodes=corrected_nodes,
        edges=rewritten_edges,
        node_by_id=node_by_id,
        outgoing_by_id=outgoing_by_id,
        incoming_by_id=incoming_by_id,
        start_node=indexed_graph.start_node,
    )

    # ── Linearization pass ────────────────────────────────────────────────────
    # Salesforce Flow is strictly sequential — no node except Decision/Loop may
    # have more than one outgoing connector.  The LLM sometimes emits "parallel"
    # branches from Start (or any linear node) when it means a sequential chain.
    # e.g.:  Start → GetRecords_A   and   Start → GetRecords_B
    # We detect this and rewrite the edges so the branches run in series:
    #   Start → GetRecords_A → ... → GetRecords_B → ...
    # The tail of branch A (the node that previously connected to End or had no
    # further outgoing edge) is rewired to connect to the head of branch B.
    # ─────────────────────────────────────────────────────────────────────────
    linearization_node_types = {"Start", "GetRecords", "UpdateRecords", "CreateRecords", "Assignment"}
    edges_list: List[IndexedEdge] = list(indexed_graph.edges)

    for node in list(indexed_graph.nodes):
        if node.type not in linearization_node_types:
            continue
        fan_out = [
            e for e in outgoing_by_id.get(node.id, [])
            if normalize_condition(e.condition) not in {None.__class__.__name__}
            and not is_fault_edge(e)
            or (not is_fault_edge(e) and normalize_condition(e.condition) is None)
        ]
        # Only act when there is strictly more than one unconditional outgoing edge
        unconditional = [e for e in outgoing_by_id.get(node.id, []) if not is_fault_edge(e) and normalize_condition(e.condition) is None]
        if len(unconditional) <= 1:
            continue

        # Sort branches: keep End-targeting edges last (they become the tail)
        non_terminal = [e for e in unconditional if not is_terminal_edge(indexed_graph, e)]
        terminal = [e for e in unconditional if is_terminal_edge(indexed_graph, e)]
        if len(non_terminal) < 2 and not (len(non_terminal) == 1 and terminal):
            continue

        # Build linear chain: node → branch[0] → tail[0] → branch[1] → tail[1] → ...
        # First, keep only the first branch edge from this node
        branches = non_terminal  # each is a separate sub-chain head
        if not branches:
            continue

        # Remove all but the first unconditional edge from this node
        first_edge = branches[0]
        edges_to_remove = set(id(e) for e in unconditional if id(e) != id(first_edge))
        edges_list = [e for e in edges_list if id(e) not in edges_to_remove]
        outgoing_by_id[node.id] = [e for e in outgoing_by_id[node.id] if id(e) not in edges_to_remove]

        # Walk to the tail of each branch (the node that connects to End, or has no outgoing)
        def find_chain_tail(head_node_id: str, visited: Optional[Set[str]] = None) -> str:
            if visited is None:
                visited = set()
            if head_node_id in visited:
                return head_node_id
            visited.add(head_node_id)
            outgoing = [
                e for e in outgoing_by_id.get(head_node_id, [])
                if not is_fault_edge(e) and normalize_condition(e.condition) is None
            ]
            if not outgoing:
                return head_node_id
            # Follow the first unconditional non-terminal edge
            non_term = [e for e in outgoing if not is_terminal_edge(indexed_graph, e)]
            if not non_term:
                return head_node_id  # all edges go to End; this is the tail
            return find_chain_tail(non_term[0].target, visited)

        # Chain: attach branch[i+1] head after branch[i] tail
        prev_tail_id = find_chain_tail(first_edge.target)
        for next_edge in branches[1:] + terminal:
            # Remove old End-connector from prev_tail if it exists
            old_end_edges = [
                e for e in outgoing_by_id.get(prev_tail_id, [])
                if is_terminal_edge(indexed_graph, e) and not is_fault_edge(e)
            ]
            old_ids = set(id(e) for e in old_end_edges)
            edges_list = [e for e in edges_list if id(e) not in old_ids]
            outgoing_by_id[prev_tail_id] = [e for e in outgoing_by_id.get(prev_tail_id, []) if id(e) not in old_ids]
            for oe in old_end_edges:
                incoming_by_id[oe.target] = [e for e in incoming_by_id.get(oe.target, []) if id(e) != id(oe)]

            if is_terminal_edge(indexed_graph, next_edge):
                # This is a terminal edge — restore it on the final tail
                new_end_edge = IndexedEdge(
                    source=prev_tail_id,
                    target=next_edge.target,
                    condition=None,
                    metadata={},
                )
                edges_list.append(new_end_edge)
                outgoing_by_id[prev_tail_id].append(new_end_edge)
                incoming_by_id[next_edge.target].append(new_end_edge)
            else:
                # Wire prev_tail → next branch head
                bridge = IndexedEdge(
                    source=prev_tail_id,
                    target=next_edge.target,
                    condition=None,
                    metadata={},
                )
                edges_list.append(bridge)
                outgoing_by_id[prev_tail_id].append(bridge)
                incoming_by_id[next_edge.target].append(bridge)
                prev_tail_id = find_chain_tail(next_edge.target)

    indexed_graph = IndexedGraph(
        flow_name=indexed_graph.flow_name,
        nodes=indexed_graph.nodes,
        edges=edges_list,
        node_by_id=node_by_id,
        outgoing_by_id=outgoing_by_id,
        incoming_by_id=incoming_by_id,
        start_node=indexed_graph.start_node,
    )
    validate_indexed_graph(indexed_graph)
    return indexed_graph, synthesized_variables


def validate_indexed_graph(graph: IndexedGraph) -> None:
    for node in graph.nodes:
        outgoing_edges = graph.outgoing_by_id[node.id]
        incoming_edges = graph.incoming_by_id[node.id]

        if node.type == "Start" and incoming_edges:
            raise GraphGenerationError("Start node cannot have incoming edges")

        if node.type == "End":
            if outgoing_edges:
                raise GraphGenerationError(f"End node {node.id} cannot have outgoing edges")

            if node.original_tag and node.original_tag not in {"", None}:
                raise GraphGenerationError(
                    f"End node {node.id} came from unsupported original tag <{node.original_tag}>"
                )

            if node.metadata.get("synthetic") is True:
                reasons = ensure_sequence(node.metadata.get("reasons"), f"End node {node.id} reasons")
                reason_set = {str(reason) for reason in reasons}
                if not reason_set.issubset(TERMINAL_END_REASONS):
                    raise GraphGenerationError(
                        f"Synthetic End node {node.id} contains unsupported reasons {sorted(reason_set)}"
                    )

        if node.metadata.get("synthetic") is True and node.type != "End":
            raise GraphGenerationError(
                f"Synthetic node {node.id} cannot be emitted as Salesforce Flow XML"
            )

        if node.type == "Assignment":
            original_tag = effective_original_tag(node)
            if original_tag not in SUPPORTED_ASSIGNMENT_TAGS:
                raise GraphGenerationError(
                    f"Assignment node {node.id} uses unsupported original tag <{original_tag}>"
                )

        if node.type == "UpdateRecords" or node.type == "CreateRecords":
            original_tag = effective_original_tag(node)
            if original_tag not in SUPPORTED_UPDATE_TAGS:
                raise GraphGenerationError(
                    f"UpdateRecords node {node.id} uses unsupported original tag <{original_tag}>"
                )

    for edge in graph.edges:
        source_node = graph.node_by_id[edge.source]
        if source_node.type == "End":
            raise GraphGenerationError(f"Edge cannot originate from End node {source_node.id}")

        reason = edge.metadata.get("reason")
        if reason in REJECTED_SYNTHETIC_EDGE_REASONS:
            raise GraphGenerationError(
                f"Synthetic debug edge {edge.source} -> {edge.target} cannot be emitted safely ({reason})"
            )

        if edge.metadata.get("synthetic") is True and not is_terminal_edge(graph, edge):
            raise GraphGenerationError(
                f"Synthetic edge {edge.source} -> {edge.target} cannot be emitted safely"
            )

        if source_node.type == "Start":
            condition = normalize_condition(edge.condition)
            if condition is None or condition.startswith("scheduled:"):
                continue
            raise GraphGenerationError(
                f"Start node has an unsupported conditional edge labeled {condition!r}"
            )

        if not is_fault_edge(edge) and source_node.type not in {"Decision", "Loop"}:
            if edge.condition is not None:
                raise GraphGenerationError(
                    f"Node {source_node.id} has an unsupported conditional edge labeled {edge.condition!r}"
                )


def effective_original_tag(node: IndexedNode) -> str:
    if node.type == "Start":
        return "start"
    if node.type == "Decision":
        return "decisions"
    if node.type == "Assignment":
        return node.original_tag or "assignments"
    if node.type == "ActionCall":
        return "actionCalls"
    if node.type == "GetRecords":
        return node.original_tag or "recordLookups"
    if node.type == "UpdateRecords":
        return node.original_tag or "recordUpdates"
    if node.type == "CreateRecords":
        return node.original_tag or "recordCreates"
    if node.type == "Loop":
        return node.original_tag or "loops"
    if node.type == "CustomError":
        return "customErrors"
    if node.type == "Screen":
        return node.original_tag or "screens"
    return node.original_tag or node.type


def iter_nodes_for_emission(nodes: Sequence[IndexedNode]) -> Iterable[IndexedNode]:
    grouped_nodes: Dict[str, List[IndexedNode]] = {}
    emission_order: List[str] = []

    for node in nodes:
        if node.type in {"Start", "End", "Formula"}:
            continue

        tag_name = effective_original_tag(node)
        if tag_name not in grouped_nodes:
            grouped_nodes[tag_name] = []
            emission_order.append(tag_name)
        grouped_nodes[tag_name].append(node)

    # Salesforce Flow metadata rejects re-entering a repeated sibling tag after a later tag,
    # so keep each element family contiguous even when the graph interleaves node types.
    for tag_name in emission_order:
        yield from grouped_nodes[tag_name]


def append_text_element(parent: ET.Element, name: str, value: Optional[Any]) -> Optional[ET.Element]:
    if value is None:
        return None
    child = ET.SubElement(parent, flow_tag(name))
    child.text = str(value)
    return child


def append_bool_element(parent: ET.Element, name: str, value: Optional[bool]) -> None:
    if value is None:
        return
    append_text_element(parent, name, str(bool(value)).lower())


def append_position(element: ET.Element, metadata: Mapping[str, Any]) -> None:
    position = metadata.get("position")
    if not isinstance(position, dict):
        return

    x_value = position.get("x")
    y_value = position.get("y")
    if x_value is not None:
        append_text_element(element, "locationX", int(round(float(x_value))))
    if y_value is not None:
        append_text_element(element, "locationY", int(round(float(y_value))))


def append_serialized_value(parent: ET.Element, tag_name: str, value: Any) -> None:
    if value is None:
        return
    container = ET.SubElement(parent, flow_tag(tag_name))
    serialize_value_payload(container, value)


def serialize_value_payload(parent: ET.Element, value: Any) -> None:
    # Flatten double-nested elementReference: {"elementReference": {"elementReference": "X"}} → {"elementReference": "X"}
    if isinstance(value, dict) and set(value.keys()) == {"elementReference"} and isinstance(value["elementReference"], dict):
        inner = value["elementReference"]
        if set(inner.keys()) == {"elementReference"}:
            value = inner
    if isinstance(value, dict):
        for key, nested_value in value.items():
            if isinstance(nested_value, list):
                for item in nested_value:
                    child = ET.SubElement(parent, flow_tag(key))
                    serialize_value_payload(child, item)
            else:
                child = ET.SubElement(parent, flow_tag(key))
                serialize_value_payload(child, nested_value)
        return

    if isinstance(value, list):
        for item in value:
            child = ET.SubElement(parent, flow_tag("item"))
            serialize_value_payload(child, item)
        return

    if isinstance(value, bool):
        parent.text = str(value).lower()
        return

    parent.text = str(value)


def append_connector(element: ET.Element, connector_tag: str, target_reference: Optional[str]) -> None:
    if target_reference is None:
        return
    connector = ET.SubElement(element, flow_tag(connector_tag))
    append_text_element(connector, "targetReference", target_reference)


def append_filters(element: ET.Element, metadata: Mapping[str, Any]) -> None:
    filter_logic = metadata.get("filter_logic")
    if filter_logic is not None:
        append_text_element(element, "filterLogic", filter_logic)

    filters = ensure_sequence(metadata.get("filters"), "filters")
    for filter_item in filters:
        filter_mapping = ensure_mapping(filter_item, "filter")
        filter_element = ET.SubElement(element, flow_tag("filters"))
        append_text_element(filter_element, "field", filter_mapping.get("field"))
        operator = filter_mapping.get("operator") or ""
        value = filter_mapping.get("value")
        # IsNotNull is not a valid FlowRecordFilterOperator — rewrite as IsNull + false
        if operator == "IsNotNull":
            operator = "IsNull"
            value = {"booleanValue": False}
        append_text_element(filter_element, "operator", operator)
        append_serialized_value(filter_element, "value", value)


def append_assignment_items(element: ET.Element, metadata: Mapping[str, Any], item_tag: str) -> None:
    items = ensure_sequence(metadata.get(item_tag), item_tag)
    for item in items:
        item_mapping = ensure_mapping(item, item_tag)
        assignment_element = ET.SubElement(element, flow_tag(item_tag_to_xml_tag(item_tag)))
        append_text_element(assignment_element, "field", item_mapping.get("field"))
        append_text_element(
            assignment_element,
            "assignToReference",
            item_mapping.get("assign_to_reference"),
        )
        append_text_element(assignment_element, "operator", item_mapping.get("operator"))
        append_serialized_value(assignment_element, "value", item_mapping.get("value"))


def append_named_value_items(element: ET.Element, metadata: Mapping[str, Any], item_tag: str) -> None:
    items = ensure_sequence(metadata.get(item_tag), item_tag)
    for item in items:
        item_mapping = ensure_mapping(item, item_tag)
        named_value_element = ET.SubElement(element, flow_tag(item_tag_to_xml_tag(item_tag)))
        append_text_element(named_value_element, "name", item_mapping.get("name"))
        append_text_element(
            named_value_element,
            "assignToReference",
            item_mapping.get("assign_to_reference"),
        )
        append_serialized_value(named_value_element, "value", item_mapping.get("value"))


def _infer_screen_datatable_source(graph: IndexedGraph, node: IndexedNode) -> Tuple[Optional[str], Optional[str]]:
    for edge in graph.incoming_by_id.get(node.id, []):
        source_node = graph.node_by_id.get(edge.source)
        if source_node is None or source_node.type != "GetRecords":
            continue
        object_name = normalize_condition(
            source_node.metadata.get("object")
            or source_node.metadata.get("objectType")
            or source_node.metadata.get("object_type")
        )
        return source_node.reference_name, object_name
    return None, None


def _append_datatable_defaults(
    field_element: ET.Element,
    graph: IndexedGraph,
    node: IndexedNode,
    field_mapping: Mapping[str, Any],
) -> None:
    existing_params = {
        normalize_condition(item.get("name"))
        for item in ensure_sequence(field_mapping.get("input_parameters"), "screen field input_parameters")
        if isinstance(item, dict)
    }

    table_data_ref, object_name = _infer_screen_datatable_source(graph, node)

    if "tableData" not in existing_params and table_data_ref:
        param = ET.SubElement(field_element, flow_tag("inputParameters"))
        append_text_element(param, "name", "tableData")
        append_serialized_value(param, "value", {"elementReference": table_data_ref})

    if "selectionMode" not in existing_params:
        param = ET.SubElement(field_element, flow_tag("inputParameters"))
        append_text_element(param, "name", "selectionMode")
        append_serialized_value(param, "value", {"stringValue": "MULTI_SELECT"})

    if "minRowSelection" not in existing_params:
        param = ET.SubElement(field_element, flow_tag("inputParameters"))
        append_text_element(param, "name", "minRowSelection")
        append_serialized_value(param, "value", {"numberValue": 0})

    if "shouldDisplayLabel" not in existing_params:
        param = ET.SubElement(field_element, flow_tag("inputParameters"))
        append_text_element(param, "name", "shouldDisplayLabel")
        append_serialized_value(param, "value", {"booleanValue": True})

    if "isShowSearchBar" not in existing_params:
        param = ET.SubElement(field_element, flow_tag("inputParameters"))
        append_text_element(param, "name", "isShowSearchBar")
        append_serialized_value(param, "value", {"booleanValue": True})

    if "columns" not in existing_params:
        column_label = f"{object_name} Name" if object_name else "Name"
        columns = [
            {
                "apiName": "Name",
                "guid": "column-1",
                "editable": False,
                "hasCustomHeaderLabel": False,
                "customHeaderLabel": "",
                "wrapText": True,
                "order": 0,
                "label": column_label,
                "type": "text",
            }
        ]
        param = ET.SubElement(field_element, flow_tag("inputParameters"))
        append_text_element(param, "name", "columns")
        append_serialized_value(param, "value", {"stringValue": json.dumps(columns, separators=(",", ":"))})

    if field_mapping.get("is_required") is None:
        append_bool_element(field_element, "isRequired", True)


def item_tag_to_xml_tag(item_tag: str) -> str:
    if item_tag == "assignment_items":
        return "assignmentItems"
    if item_tag == "input_assignments":
        return "inputAssignments"
    if item_tag == "input_parameters":
        return "inputParameters"
    if item_tag == "output_assignments":
        return "outputAssignments"
    raise GraphGenerationError(f"Unsupported assignment item tag: {item_tag}")


def append_screen_fields(element: ET.Element, graph: IndexedGraph, node: IndexedNode, metadata: Mapping[str, Any]) -> None:
    fields = ensure_sequence(metadata.get("fields"), "screen fields")
    for field in fields:
        field_mapping = ensure_mapping(field, "screen field")
        field_element = ET.SubElement(element, flow_tag("fields"))
        append_text_element(field_element, "name", field_mapping.get("name"))
        extension_name = field_mapping.get("extension_name") or field_mapping.get("extensionName")
        if extension_name == "flowruntime:datatable":
            _, object_name = _infer_screen_datatable_source(graph, node)
            if object_name:
                data_type_mappings = ET.SubElement(field_element, flow_tag("dataTypeMappings"))
                append_text_element(data_type_mappings, "typeName", "T")
                append_text_element(data_type_mappings, "typeValue", object_name)
        append_text_element(field_element, "extensionName", extension_name)
        for choice_reference in ensure_sequence(
            field_mapping.get("choice_references"),
            "screen field choice_references",
        ):
            append_text_element(field_element, "choiceReferences", choice_reference)
        append_text_element(field_element, "dataType", field_mapping.get("data_type") or field_mapping.get("dataType"))
        append_text_element(
            field_element,
            "defaultSelectedChoiceReference",
            field_mapping.get("default_selected_choice_reference"),
        )
        append_text_element(field_element, "fieldText", field_mapping.get("field_text") or field_mapping.get("fieldText"))
        append_text_element(field_element, "fieldType", field_mapping.get("field_type") or field_mapping.get("fieldType"))
        append_named_value_items(field_element, field_mapping, "input_parameters")
        if extension_name == "flowruntime:datatable":
            _append_datatable_defaults(field_element, graph, node, field_mapping)
        append_text_element(
            field_element,
            "inputsOnNextNavToAssocScrn",
            field_mapping.get("inputs_on_next_nav_to_assoc_scrn"),
        )
        is_required = field_mapping.get("is_required")
        if is_required is not None:
            append_bool_element(field_element, "isRequired", bool(is_required))
        append_text_element(
            field_element,
            "objectFieldReference",
            field_mapping.get("object_field_reference"),
        )
        store_output_automatically = field_mapping.get("store_output_automatically")
        if store_output_automatically is not None:
            append_bool_element(field_element, "storeOutputAutomatically", bool(store_output_automatically))

        style_props = field_mapping.get("style_properties") or field_mapping.get("styleProperties")
        if style_props and isinstance(style_props, dict):
            style_el = ET.SubElement(field_element, flow_tag("styleProperties"))
            v_align = style_props.get("verticalAlignment")
            if v_align:
                append_serialized_value(style_el, "verticalAlignment", v_align)
            width = style_props.get("width")
            if width:
                append_serialized_value(style_el, "width", width)

        visibility_rule = field_mapping.get("visibility_rule")
        if visibility_rule is not None:
            visibility_mapping = ensure_mapping(visibility_rule, "screen field visibility_rule")
            visibility_element = ET.SubElement(field_element, flow_tag("visibilityRule"))
            append_text_element(
                visibility_element,
                "conditionLogic",
                visibility_mapping.get("condition_logic"),
            )
            append_conditions(
                visibility_element,
                [
                    ensure_mapping(item, "screen field visibility condition")
                    for item in ensure_sequence(
                        visibility_mapping.get("conditions"),
                        "screen field visibility_rule conditions",
                    )
                ],
            )


def _needs_record_prefix(ref: str) -> bool:
    """Return True if a bare field name needs $Record. prefix in record-triggered flows."""
    if not ref or ref.startswith("$") or ref.startswith("{!") or "." in ref:
        return False
    # Known non-field prefixes (variables, collections, etc.)
    _SAFE = ("var", "Loop_", "Get_", "Update_", "Create_", "Delete_",
             "Fast_", "Screen_", "Decision_", "Assignment_", "Subflow_",
             "Action_", "Wait_", "Transform_")
    if any(ref.startswith(p) for p in _SAFE):
        return False
    # Salesforce global variables
    if ref in ("IsNew", "IsNewRecord", "Is_New", "IsChanged", "PriorValue"):
        return False
    # Starts with uppercase → likely a bare field name
    return ref[0].isupper() if ref else False


def append_conditions(parent: ET.Element, conditions: Sequence[Mapping[str, Any]], record_triggered: bool = False) -> None:
    for condition in conditions:
        condition_element = ET.SubElement(parent, flow_tag("conditions"))

        # Support both LLM flat format {field, operator, value} and
        # canonical format {left_value_reference, operator, right_value / value}
        left_ref = condition.get("left_value_reference") or condition.get("leftValueReference")
        if left_ref is None:
            field = condition.get("field")
            if field is not None:
                left_ref = f"$Record.{field}"
        # Safety net: auto-prefix bare field names in record-triggered flows
        if record_triggered and left_ref and _needs_record_prefix(left_ref):
            left_ref = f"$Record.{left_ref}"

        append_text_element(condition_element, "leftValueReference", left_ref)
        append_text_element(condition_element, "operator", condition.get("operator"))

        # right_value / value / rightValue — accept any of the three
        right_val = (
            condition.get("right_value")
            or condition.get("rightValue")
            or condition.get("value")
        )
        if right_val is not None:
            append_serialized_value(condition_element, "rightValue", right_val)


def split_fault_edge(
    edges: Sequence[IndexedEdge],
    context: str,
) -> Tuple[List[IndexedEdge], Optional[IndexedEdge]]:
    non_fault_edges: List[IndexedEdge] = []
    fault_edge: Optional[IndexedEdge] = None
    for edge in edges:
        if is_fault_edge(edge):
            if fault_edge is not None:
                raise GraphGenerationError(f"{context} has more than one fault edge")
            fault_edge = edge
            continue
        non_fault_edges.append(edge)
    return non_fault_edges, fault_edge


def plan_linear_connectors(
    graph: IndexedGraph,
    node: IndexedNode,
) -> Tuple[Optional[IndexedEdge], Optional[IndexedEdge]]:
    non_fault_edges, fault_edge = split_fault_edge(graph.outgoing_by_id[node.id], node.id)
    if len(non_fault_edges) > 1:
        raise GraphGenerationError(f"Node {node.id} has more than one direct connector")
    direct_edge = non_fault_edges[0] if non_fault_edges else None
    return direct_edge, fault_edge


def plan_start_connectors(
    graph: IndexedGraph,
    node: IndexedNode,
) -> Tuple[Optional[IndexedEdge], Sequence[IndexedEdge]]:
    direct_edge: Optional[IndexedEdge] = None
    scheduled_edges: List[IndexedEdge] = []

    trigger_type = (
        node.metadata.get("trigger_type")
        or node.metadata.get("triggerType")
        or "RecordAfterSave"
    )

    for edge in graph.outgoing_by_id[node.id]:
        condition = normalize_condition(edge.condition)
        if condition == "fault":
            raise GraphGenerationError("Start node cannot use a fault connector")
        if condition is not None and condition.startswith("scheduled:"):
            scheduled_edges.append(edge)
            continue
        if condition is not None and trigger_type != "Scheduled":
            raise GraphGenerationError(
                f"Start node has an unsupported conditional edge labeled {condition!r}"
            )
        if direct_edge is not None:
            raise GraphGenerationError("Start node has more than one direct connector")
        direct_edge = edge

    return direct_edge, scheduled_edges


def match_rule_metadata(
    node: IndexedNode,
    graph: IndexedGraph,
    edge: IndexedEdge,
    used_indexes: Set[int],
) -> Mapping[str, Any]:
    """Match edge condition to a rule, or create a minimal rule if none exist."""
    rules = node.metadata.get("rules", [])
    if not isinstance(rules, list):
        rules = []

    condition_label = normalize_condition(edge.condition)
    # Normalize condition for case-insensitive truthy matching
    condition_lower = condition_label.lower() if condition_label else None

    def _contains_phrase(haystack: Optional[str], needle: Optional[str]) -> bool:
        if not haystack or not needle:
            return False
        hay = f" {haystack.lower()} "
        nee = f" {needle.lower()} "
        return nee in hay

    # If no rules defined at all, synthesize one from node-level conditionLogic + field/operator/value
    if not rules:
        field = normalize_condition(node.metadata.get("field"))
        operator = normalize_condition(node.metadata.get("operator"))
        value = node.metadata.get("value")
        cond_logic = normalize_condition(node.metadata.get("conditionLogic")) or "and"
        if field and operator and value is not None:
            auto_conditions = [{"field": field, "operator": operator, "value": value}]
        else:
            auto_conditions = [{"left_value_reference": "$Record.Id", "operator": "IsNull", "right_value": {"booleanValue": False}}]
        rule = {
            "name": f"Outcome_{len(used_indexes) + 1}",
            "label": condition_label or "Outcome",
            "condition_logic": cond_logic,
            "conditions": auto_conditions,
        }
        used_indexes.add(hash(edge) % 1_000_000)
        return -1, rule

    # Build enriched rule list: inject name/label from flat format when missing
    enriched_rules: List[Mapping[str, Any]] = []
    for idx, raw_rule in enumerate(rules):
        rm = ensure_mapping(raw_rule, f"Decision {node.id} rule")
        enriched: Dict[str, Any] = dict(rm)

        # Normalise original_tag "decision" -> "decisions" (LLM mistake)
        if enriched.get("original_tag") == "decision":
            enriched["original_tag"] = "decisions"

        # Auto-assign label from flat field value when absent
        if not enriched.get("label") and not enriched.get("name"):
            field = enriched.get("field", "")
            val_obj = enriched.get("value", {})
            val_str = val_obj.get("stringValue", "") if isinstance(val_obj, dict) else str(val_obj)
            enriched["label"] = f"{field}_equals_{val_str}" if field else f"Rule_{idx + 1}"
            enriched["name"] = enriched["label"]

        enriched_rules.append(enriched)

    # ── Pass 1: exact match on label or name (case-insensitive) ──────────────
    candidates: List[Tuple[int, Mapping[str, Any]]] = []
    if condition_lower:
        for index, rule_mapping in enumerate(enriched_rules):
            if index in used_indexes:
                continue
            rule_label = normalize_condition(rule_mapping.get("label"))
            rule_name = normalize_condition(rule_mapping.get("name"))
            rule_label_lower = rule_label.lower() if rule_label else None
            rule_name_lower = rule_name.lower() if rule_name else None
            if condition_lower in {rule_label_lower, rule_name_lower}:
                candidates.append((index, rule_mapping))

    # ── Pass 2: match by target_reference / connector_target ─────────────────
    if not candidates:
        target_reference = target_reference_name(graph, edge)
        if target_reference is not None:
            for index, rule_mapping in enumerate(enriched_rules):
                if index in used_indexes:
                    continue
                if rule_mapping.get("target_reference") == target_reference \
                   or rule_mapping.get("connector_target") == target_reference:
                    candidates.append((index, rule_mapping))

    if not candidates and condition_label:
        for index, rule_mapping in enumerate(enriched_rules):
            if index in used_indexes:
                continue
            rule_label = normalize_condition(rule_mapping.get("label"))
            rule_name = normalize_condition(rule_mapping.get("name"))
            if _contains_phrase(condition_label, rule_label) or _contains_phrase(condition_label, rule_name):
                candidates.append((index, rule_mapping))
                continue
            if _contains_phrase(rule_label, condition_label) or _contains_phrase(rule_name, condition_label):
                candidates.append((index, rule_mapping))

    # ── Pass 3: truthy edge ("True"/"true"/"yes") → first unused rule ────────
    if not candidates and condition_lower in {"true", "yes", "1"}:
        for index, rule_mapping in enumerate(enriched_rules):
            if index not in used_indexes:
                candidates.append((index, rule_mapping))
                break

    # ── Pass 4: only one rule and one non-default edge → unambiguous ─────────
    if not candidates and len(enriched_rules) == 1 and 0 not in used_indexes:
        candidates.append((0, enriched_rules[0]))

    if not candidates:
        for index, rule_mapping in enumerate(enriched_rules):
            if index not in used_indexes:
                candidates.append((index, rule_mapping))
                break

    if len(candidates) > 1:
        def _candidate_specificity(item: Tuple[int, Mapping[str, Any]]) -> Tuple[int, int]:
            _, rule_mapping = item
            rule_label = normalize_condition(rule_mapping.get("label")) or ""
            rule_name = normalize_condition(rule_mapping.get("name")) or ""
            shortest = min((len(rule_label), len(rule_name)))
            return shortest, item[0]

        candidates = [sorted(candidates, key=_candidate_specificity)[0]]

    if len(candidates) != 1:
        raise GraphGenerationError(
            f"Decision node {node.id} cannot match branch {edge.condition!r} to exactly one metadata rule"
        )

    matched_index, matched_rule = candidates[0]
    used_indexes.add(matched_index)
    return matched_index, matched_rule


def plan_decision_connectors(graph: IndexedGraph, node: IndexedNode) -> DecisionPlan:
    outgoing_edges = list(graph.outgoing_by_id[node.id])
    non_fault_edges, fault_edge = split_fault_edge(outgoing_edges, f"Decision {node.id}")
    if not non_fault_edges:
        raise GraphGenerationError(f"Decision node {node.id} has no outgoing branches")

    default_label = normalize_condition(node.metadata.get("default_connector_label")) or "Default Outcome"
    # Conditions that always map to the default (else) branch — case-insensitive
    DEFAULT_CONDITIONS = {"false", "no", "0", "default outcome", "default"}
    default_edges: List[IndexedEdge] = []
    rule_edges: List[IndexedEdge] = []

    for edge in non_fault_edges:
        cond = normalize_condition(edge.condition)
        cond_lower = cond.lower() if cond else None
        # Treat None, explicit default label, or falsy keywords as the default connector
        if cond is None or cond == default_label or cond_lower in DEFAULT_CONDITIONS:
            default_edges.append(edge)
            continue
        rule_edges.append(edge)

    default_edge: Optional[IndexedEdge] = None
    if default_edges:
        terminal_defaults = [edge for edge in default_edges if is_terminal_edge(graph, edge)]
        default_edge = terminal_defaults[0] if terminal_defaults else default_edges[0]

        extra_defaults = [edge for edge in default_edges if edge is not default_edge]
        for edge in extra_defaults:
            target_node = graph.node_by_id[edge.target]
            fallback_label = normalize_condition(target_node.label) or target_node.reference_name or "Outcome"
            rule_edges.append(
                IndexedEdge(
                    source=edge.source,
                    target=edge.target,
                    condition=fallback_label,
                    metadata={**edge.metadata, "synthetic_condition": True},
                )
            )

    if default_edge is None and not rule_edges and len(non_fault_edges) == 1:
        default_edge = non_fault_edges[0]

    # Guardrail for a common AI mistake:
    # if the default branch contains the action chain and the only rule branch ends at End,
    # swap them so the named condition keeps the meaningful path.
    if default_edge is not None and len(rule_edges) == 1:
        rule_edge = rule_edges[0]
        default_target = graph.node_by_id[default_edge.target]
        rule_target = graph.node_by_id[rule_edge.target]
        if default_target.type != "End" and rule_target.type == "End":
            default_edge, rule_edges = rule_edge, [default_edge]

    rule_plans: List[DecisionRulePlan] = []
    used_rule_indexes: Set[int] = set()
    for edge in rule_edges:
        matched_idx, rule_metadata = match_rule_metadata(node, graph, edge, used_rule_indexes)
        conditions = ensure_sequence(rule_metadata.get("conditions"), f"Decision {node.id} rule conditions")

        # Auto-generate conditions from flat field/operator/value when missing
        if not conditions:
            field = rule_metadata.get("field")
            operator = rule_metadata.get("operator")
            value = rule_metadata.get("value")

            if field and operator and value is not None:
                conditions = [{"field": field, "operator": operator, "value": value}]
                rule_metadata = {**rule_metadata, "conditions": conditions}
            else:
                raise GraphGenerationError(
                    f"Decision node {node.id} branch {edge.condition!r} is missing metadata conditions"
                )

        # Normalise condition_logic: accept camelCase "conditionLogic" from LLM output
        if not rule_metadata.get("condition_logic"):
            camel = (
                rule_metadata.get("conditionLogic")
                or node.metadata.get("conditionLogic")
                or "and"
            )
            rule_metadata = {**rule_metadata, "condition_logic": camel}

        rule_plans.append(DecisionRulePlan(edge=edge, rule_metadata=rule_metadata, matched_index=matched_idx))

    return DecisionPlan(
        default_edge=default_edge,
        # Salesforce requires defaultConnectorLabel on every Decision element,
        # even when there's no explicit default branch (implicit end).
        default_label=default_label,
        rule_plans=rule_plans,
        fault_edge=fault_edge,
    )


def plan_loop_connectors(graph: IndexedGraph, node: IndexedNode) -> LoopPlan:
    outgoing_edges = list(graph.outgoing_by_id[node.id])
    non_fault_edges, fault_edge = split_fault_edge(outgoing_edges, f"Loop {node.id}")
    if len(non_fault_edges) > 2:
        raise GraphGenerationError(f"Loop node {node.id} has more than two non-fault connectors")

    next_value_target = normalize_condition(node.metadata.get("next_value_target"))
    no_more_values_target = normalize_condition(node.metadata.get("no_more_values_target"))
    loop_edge: Optional[IndexedEdge] = None
    exit_edge: Optional[IndexedEdge] = None
    used_indexes: Set[int] = set()

    def match_by_target(target_reference: Optional[str]) -> Optional[Tuple[int, IndexedEdge]]:
        if target_reference is None:
            return None
        matches = [
            (index, edge)
            for index, edge in enumerate(non_fault_edges)
            if index not in used_indexes and target_reference_name(graph, edge) == target_reference
        ]
        if len(matches) > 1:
            raise GraphGenerationError(
                f"Loop node {node.id} has multiple edges targeting {target_reference!r}"
            )
        return matches[0] if matches else None

    next_match = match_by_target(next_value_target)
    if next_match is not None:
        index, edge = next_match
        used_indexes.add(index)
        loop_edge = edge

    exit_match = match_by_target(no_more_values_target)
    if exit_match is not None:
        index, edge = exit_match
        used_indexes.add(index)
        exit_edge = edge

    for index, edge in enumerate(non_fault_edges):
        if index in used_indexes:
            continue
        normalized_condition = normalize_condition(edge.condition)

        # Explicit condition keywords
        if normalized_condition == "loop":
            if loop_edge is not None:
                raise GraphGenerationError(f"Loop node {node.id} has multiple loop body branches")
            loop_edge = edge
            used_indexes.add(index)
            continue
        if normalized_condition in {"exit", "no more values", "no_more_values", "after last"}:
            if exit_edge is not None:
                raise GraphGenerationError(f"Loop node {node.id} has multiple exit branches")
            exit_edge = edge
            used_indexes.add(index)
            continue

        # Single unambiguous edge — must be the loop body
        if len(non_fault_edges) == 1 and loop_edge is None and exit_edge is None:
            loop_edge = edge
            used_indexes.add(index)
            continue

        # No condition and no keyword — classify by topology:
        # Strategy 1: terminal target (End) → exit connector
        # Strategy 2: target has a back-edge to this loop node → it is the body
        # Strategy 3: target does NOT have a back-edge → it is the exit
        if normalized_condition is None:
            if is_terminal_edge(graph, edge):
                if exit_edge is not None:
                    raise GraphGenerationError(
                        f"Loop node {node.id} has multiple exit branches"
                    )
                exit_edge = edge
                used_indexes.add(index)
            else:
                # Check: does the target (or anything reachable from it) loop back to this node?
                target_id = edge.target
                has_back_edge = _has_back_edge_to(graph, target_id, node.id, visited=set())
                if has_back_edge:
                    # This is the loop body (nextValueConnector)
                    if loop_edge is not None:
                        # Already have a body — demote this to exit
                        if exit_edge is not None:
                            raise GraphGenerationError(
                                f"Loop node {node.id} has multiple loop body branches"
                            )
                        exit_edge = edge
                    else:
                        loop_edge = edge
                    used_indexes.add(index)
                else:
                    # No back-edge → this is the post-loop exit connector
                    if exit_edge is not None:
                        # Two non-back-edge non-terminal exits: error
                        raise GraphGenerationError(
                            f"Loop node {node.id} has multiple exit branches"
                        )
                    exit_edge = edge
                    used_indexes.add(index)
            continue

        raise GraphGenerationError(
            f"Loop node {node.id} has an unclassifiable connector {edge.condition!r}"
        )

    if loop_edge is None:
        raise GraphGenerationError(f"Loop node {node.id} is missing a loop body connector")
    if is_terminal_edge(graph, loop_edge):
        raise GraphGenerationError(f"Loop node {node.id} cannot route its body connector to End")

    return LoopPlan(loop_edge=loop_edge, exit_edge=exit_edge, fault_edge=fault_edge)


def _has_back_edge_to(
    graph: IndexedGraph,
    current_id: str,
    target_id: str,
    visited: Set[str],
) -> bool:
    """Return True if any node reachable from current_id has an outgoing edge to target_id."""
    if current_id in visited:
        return False
    visited.add(current_id)
    for edge in graph.outgoing_by_id.get(current_id, []):
        if edge.target == target_id:
            return True
        if not is_fault_edge(edge) and not is_terminal_edge(graph, edge):
            if _has_back_edge_to(graph, edge.target, target_id, visited):
                return True
    return False


def determine_process_type(graph: IndexedGraph) -> str:
    if any(node.type == "Screen" for node in graph.nodes):
        return SCREEN_FLOW_PROCESS_TYPE
    return DEFAULT_PROCESS_TYPE


def build_root_defaults(
    root: ET.Element,
    flow_name: str,
    process_type: str,
) -> None:
    # Note: <environments> is emitted before <formulas> in build_flow_tree; not here.
    append_text_element(root, "interviewLabel", f"{flow_name}{DEFAULT_INTERVIEW_LABEL_SUFFIX}")
    append_text_element(root, "label", flow_name)
    for name, value in DEFAULT_PROCESS_METADATA_VALUES:
        metadata_element = ET.SubElement(root, flow_tag("processMetadataValues"))
        append_text_element(metadata_element, "name", name)
        append_serialized_value(metadata_element, "value", value)
    append_text_element(root, "processType", process_type)


def build_root_header(root: ET.Element, api_version: str) -> None:
    append_text_element(root, "apiVersion", api_version)
    append_bool_element(root, "areMetricsLoggedToDataCloud", DEFAULT_ARE_METRICS_LOGGED_TO_DATA_CLOUD)


def build_root_description(root: ET.Element, graph: Mapping[str, Any]) -> None:
    append_text_element(root, "description", graph.get("description"))


def build_start_element(root: ET.Element, graph: IndexedGraph) -> None:
    node = graph.start_node
    start_element = ET.SubElement(root, flow_tag("start"))
    append_position(start_element, node.metadata)

    direct_edge, scheduled_edges = plan_start_connectors(graph, node)

    if direct_edge is not None:
        append_connector(start_element, "connector", target_reference_name(graph, direct_edge))

    # scheduled_paths in metadata are informational for scheduled flows
    # The actual schedule is emitted via the <schedule> element below
    # scheduled_edges are only used for the old scheduled: prefix pattern

    append_filters(start_element, node.metadata)

    filter_formula = node.metadata.get("filter_formula")
    if filter_formula:
        append_text_element(start_element, "filterFormula", filter_formula)

    trigger_type = (
        node.metadata.get("trigger_type")
        or node.metadata.get("triggerType")
    )
    
    # Only default to RecordAfterSave if not a screen flow
    if not trigger_type and determine_process_type(graph) != "Flow":
        trigger_type = "RecordAfterSave"

    # Handle scheduled flows: emit <schedule> element
    if trigger_type == "Scheduled":
        scheduled_paths = ensure_sequence(node.metadata.get("scheduled_paths"), "Start scheduled_paths")
        if scheduled_paths:
            schedule_path = scheduled_paths[0]
            schedule_el = ET.SubElement(start_element, flow_tag("schedule"))
            if isinstance(schedule_path, dict):
                freq = schedule_path.get("frequency")
                if freq:
                    append_text_element(schedule_el, "frequency", freq)
                start_date = schedule_path.get("startDate") or schedule_path.get("start_date")
                if start_date:
                    append_text_element(schedule_el, "startDate", start_date)
                start_time = schedule_path.get("startTime") or schedule_path.get("start_time")
                if start_time:
                    append_text_element(schedule_el, "startTime", start_time)

    # [2026-08-27] Fixed: old guard was `trigger_type != "Scheduled"`, which skipped
    # <object>/<recordTriggerType> for ALL scheduled flows including schedule-on-record
    # ones, breaking their XML. Now gated on whether the node actually has an object.
    if trigger_type and determine_process_type(graph) != "Flow":
        obj = node.metadata.get("object")
        # A plain Scheduled flow (no object) only needs <triggerType>. A
        # schedule-on-record flow, or a record-triggered flow, needs
        # <object>/<recordTriggerType> too.
        if obj:
            append_text_element(start_element, "object", obj)
            record_trigger_type = (
                node.metadata.get("record_trigger_type")
                or node.metadata.get("recordTriggerType")
                or "Create"
            )
            append_text_element(start_element, "recordTriggerType", record_trigger_type)
        append_text_element(start_element, "triggerType", trigger_type)


def append_common_node_fields(element: ET.Element, node: IndexedNode) -> None:
    append_text_element(element, "description", node.metadata.get("description"))
    append_text_element(element, "name", node.reference_name)
    append_text_element(element, "label", node.label)
    append_position(element, node.metadata)


def build_assignment_element(root: ET.Element, graph: IndexedGraph, node: IndexedNode) -> None:
    original_tag = effective_original_tag(node)
    element = ET.SubElement(root, flow_tag(original_tag))
    append_common_node_fields(element, node)

    if original_tag == "assignments":
        # Accept all key variants the LLM produces:
        #   assignment_items  (canonical snake_case)
        #   assignments       (LLM mirrors the outer XML tag name)
        #   assignmentItems   (camelCase)
        #   items             (shorthand)
        meta = node.metadata
        assignment_items = (
            meta.get("assignment_items")
            or meta.get("assignments")
            or meta.get("assignmentItems")
            or meta.get("items")
        )
        assignment_items = ensure_sequence(assignment_items, f"Assignment {node.id} items")
        if not assignment_items:
            raise GraphGenerationError(f"Assignment node {node.id} is missing metadata.assignment_items")
        # Normalize each item: accept assign_to_reference, assignToReference, variable, target
        normalized_items = []
        for item in assignment_items:
            im = ensure_mapping(item, "assignment item")
            assign_to = (
                im.get("assign_to_reference")
                or im.get("assignToReference")
                or im.get("variable")
                or im.get("target")
            )
            # Safety net: auto-prefix bare field names in record-triggered flows
            if assign_to and is_record_triggered(graph) and _needs_record_prefix(assign_to):
                assign_to = f"$Record.{assign_to}"
            operator = im.get("operator") or im.get("op") or "Assign"
            value = im.get("value")
            normalized_items.append({
                "assign_to_reference": assign_to,
                "operator": operator,
                "value": value,
            })
        # Emit using normalized items
        for item in normalized_items:
            assignment_element = ET.SubElement(element, flow_tag("assignmentItems"))
            append_text_element(assignment_element, "assignToReference", item.get("assign_to_reference"))
            append_text_element(assignment_element, "operator", item.get("operator"))
            append_serialized_value(assignment_element, "value", item.get("value"))
    elif original_tag == "actionCalls":
        action_name = normalize_condition(node.metadata.get("action_name"))
        action_type = normalize_condition(node.metadata.get("action_type"))
        if action_name is None or action_type is None:
            raise GraphGenerationError(
                f"Assignment node {node.id} cannot emit <actionCalls> without action_name and action_type metadata"
            )
        append_text_element(element, "actionName", action_name)
        append_text_element(element, "actionType", action_type)

        # Connector MUST come right after actionType (Salesforce XML ordering)
        direct_edge, fault_edge = plan_linear_connectors(graph, node)
        if direct_edge is not None:
            append_connector(element, "connector", target_reference_name(graph, direct_edge))

        append_text_element(
            element,
            "flowTransactionModel",
            normalize_condition(node.metadata.get("flow_transaction_model"))
            or "CurrentTransaction",
        )
        append_named_value_items(element, node.metadata, "input_parameters")
        append_text_element(element, "nameSegment", action_name)
        append_text_element(element, "offset", node.metadata.get("offset") or "0")
        store_output = node.metadata.get("store_output_automatically")
        if store_output is not None:
            append_bool_element(element, "storeOutputAutomatically", store_output)
        elif action_type in ("submit", "emailAlert", "emailSimple"):
            append_bool_element(element, "storeOutputAutomatically", True)
        version_str = normalize_condition(node.metadata.get("version_string"))
        if version_str:
            append_text_element(element, "versionString", version_str)
        elif action_type == "emailSimple":
            append_text_element(element, "versionString", "2.0.1")
        # faultConnector at the end
        if fault_edge is not None:
            append_connector(element, "faultConnector", target_reference_name(graph, fault_edge))
    elif original_tag == "subflows":
        flow_name = normalize_condition(node.metadata.get("flow_name"))
        if flow_name is None:
            raise GraphGenerationError(
                f"Assignment node {node.id} cannot emit <subflows> without metadata.flow_name"
            )
        append_text_element(element, "flowName", flow_name)
        append_named_value_items(element, node.metadata, "input_assignments")
        append_named_value_items(element, node.metadata, "output_assignments")

    if original_tag != "actionCalls":
        direct_edge, fault_edge = plan_linear_connectors(graph, node)
        if direct_edge is not None:
            append_connector(element, "connector", target_reference_name(graph, direct_edge))
        if fault_edge is not None:
            append_connector(element, "faultConnector", target_reference_name(graph, fault_edge))


def build_get_records_element(root: ET.Element, graph: IndexedGraph, node: IndexedNode) -> None:
    original_tag = effective_original_tag(node)
    if original_tag != "recordLookups":
        raise GraphGenerationError(f"GetRecords node {node.id} uses unsupported original tag <{original_tag}>")

    element = ET.SubElement(root, flow_tag("recordLookups"))
    append_common_node_fields(element, node)
    append_bool_element(
        element,
        "assignNullValuesIfNoRecordsFound",
        node.metadata.get("assign_null_values_if_no_records_found"),
    )

    direct_edge, fault_edge = plan_linear_connectors(graph, node)
    if direct_edge is not None:
        append_connector(element, "connector", target_reference_name(graph, direct_edge))

    append_filters(element, node.metadata)
    append_bool_element(element, "getFirstRecordOnly", node.metadata.get("get_first_record_only"))
    object_name = normalize_condition(node.metadata.get("object"))
    if object_name is None:
        raise GraphGenerationError(f"GetRecords node {node.id} is missing metadata.object")
    append_text_element(element, "object", object_name)

    # Sort fields (for ordered result sets)
    sort_field = node.metadata.get("sort_field")
    if sort_field:
        append_text_element(element, "sortField", sort_field)
    sort_order = node.metadata.get("sort_order")
    if sort_order:
        append_text_element(element, "sortOrder", sort_order)

    append_bool_element(
        element,
        "storeOutputAutomatically",
        node.metadata.get("store_output_automatically"),
    )
    if fault_edge is not None:
        append_connector(element, "faultConnector", target_reference_name(graph, fault_edge))


def build_update_records_element(root: ET.Element, graph: IndexedGraph, node: IndexedNode) -> None:
    original_tag = effective_original_tag(node)
    if original_tag not in SUPPORTED_UPDATE_TAGS:
        raise GraphGenerationError(
            f"UpdateRecords node {node.id} uses unsupported original tag <{original_tag}>"
        )

    element = ET.SubElement(root, flow_tag(original_tag))
    append_common_node_fields(element, node)

    direct_edge, fault_edge = plan_linear_connectors(graph, node)
    if direct_edge is not None:
        append_connector(element, "connector", target_reference_name(graph, direct_edge))

    input_reference = normalize_condition(node.metadata.get("input_reference"))
    object_name = normalize_condition(node.metadata.get("object"))
    object_required = not (
        input_reference is not None and original_tag in {"recordUpdates", "recordDeletes"}
    )
    if object_required and object_name is None:
        if original_tag == "recordUpdates":
            start_object = normalize_condition(graph.start_node.metadata.get("object"))
            if start_object is not None:
                object_name = start_object
        if object_name is None:
            raise GraphGenerationError(f"UpdateRecords node {node.id} is missing metadata.object")

    filters = ensure_sequence(node.metadata.get("filters"), f"UpdateRecords {node.id} filters")
    input_assignments = ensure_sequence(
        node.metadata.get("input_assignments"),
        f"UpdateRecords {node.id} input_assignments",
    )

    inferred_trigger_record_filter = False
    if original_tag == "recordUpdates" and input_reference is None and not filters and input_assignments:
        filters = [
            {
                "field": "Id",
                "operator": "EqualTo",
                "value": {"elementReference": "$Record.Id"},
            }
        ]
        inferred_trigger_record_filter = True

    if original_tag == "recordUpdates" and not filters and not input_assignments and input_reference is None:
        raise GraphGenerationError(
            f"UpdateRecords node {node.id} needs filters or input_assignments to emit valid XML"
        )
    if original_tag == "recordCreates" and not input_assignments:
        raise GraphGenerationError(
            f"recordCreates node {node.id} requires metadata.input_assignments"
        )
    if original_tag == "recordDeletes" and not filters and input_reference is None:
        raise GraphGenerationError(
            f"recordDeletes node {node.id} requires metadata.filters or metadata.input_reference"
        )

    validate_fast_field_update_target(graph, node, input_reference, object_name)

    if inferred_trigger_record_filter and node.metadata.get("filter_logic") is None:
        append_text_element(element, "filterLogic", "and")
    else:
        append_filters(element, node.metadata)

    if inferred_trigger_record_filter:
        for filter_item in filters:
            filter_mapping = ensure_mapping(filter_item, "filter")
            filter_element = ET.SubElement(element, flow_tag("filters"))
            append_text_element(filter_element, "field", filter_mapping.get("field"))
            append_text_element(filter_element, "operator", filter_mapping.get("operator"))
            append_serialized_value(filter_element, "value", filter_mapping.get("value"))
    if input_assignments:
        append_assignment_items(element, node.metadata, "input_assignments")
    if input_reference is not None:
        append_text_element(element, "inputReference", input_reference)
        # NOTE: When inputReference is present, DO NOT add object field (Salesforce restriction)
    elif object_name is not None:
        # Only add object field when NOT using inputReference
        append_text_element(element, "object", object_name)
    if original_tag == "recordCreates":
        append_bool_element(
            element,
            "storeOutputAutomatically",
            node.metadata.get("store_output_automatically"),
        )
    if fault_edge is not None:
        append_connector(element, "faultConnector", target_reference_name(graph, fault_edge))


def build_decision_element(root: ET.Element, graph: IndexedGraph, node: IndexedNode) -> None:
    element = ET.SubElement(root, flow_tag("decisions"))
    append_common_node_fields(element, node)

    plan = plan_decision_connectors(graph, node)
    if plan.default_edge is not None:
        default_target = target_reference_name(graph, plan.default_edge)
        # Only emit <defaultConnector> when the default branch goes to an actual node.
        # When it routes to End, Salesforce Flow Builder expects the element to be absent.
        if default_target is not None:
            append_connector(element, "defaultConnector", default_target)
    # defaultConnectorLabel is required on every Decision element regardless of
    # whether there's an explicit default branch (Salesforce rejects it if absent).
    append_text_element(element, "defaultConnectorLabel", plan.default_label)

    emitted_rule_indexes: set[int] = set()
    for rule_plan in plan.rule_plans:
        rule_metadata = rule_plan.rule_metadata
        if rule_plan.matched_index >= 0:
            emitted_rule_indexes.add(rule_plan.matched_index)
        rule_element = ET.SubElement(element, flow_tag("rules"))
        rule_label = normalize_condition(rule_plan.edge.condition) or normalize_condition(rule_metadata.get("label"))
        rule_name = normalize_condition(rule_metadata.get("name")) or safe_identifier(
            rule_label or "Rule",
            "Rule",
        )
        append_text_element(rule_element, "name", rule_name)
        append_text_element(rule_element, "conditionLogic", rule_metadata.get("condition_logic"))
        append_conditions(
            rule_element,
            [ensure_mapping(item, f"Decision {node.id} rule condition") for item in ensure_sequence(rule_metadata.get("conditions"), f"Decision {node.id} rule conditions")],
            record_triggered=is_record_triggered(graph),
        )
        append_connector(rule_element, "connector", target_reference_name(graph, rule_plan.edge))
        append_text_element(rule_element, "label", rule_label or rule_name)

    for raw_index, rule in enumerate(ensure_sequence(node.metadata.get("rules"), f"Decision {node.id} rules")):
        # Skip rules already emitted as rule_plans (matched by index)
        if raw_index in emitted_rule_indexes:
            continue
        rule_mapping = ensure_mapping(rule, f"Decision {node.id} rule")
        rule_name = normalize_condition(rule_mapping.get("name"))
        rule_label = normalize_condition(rule_mapping.get("label"))
        if normalize_condition(rule_mapping.get("target_reference")) is not None:
            continue
        # Skip orphaned flat-format rules (field/operator/value without conditions)
        # that have already been consumed via match_rule_metadata — they would
        # produce invalid empty <rules> elements.
        raw_conditions = ensure_sequence(rule_mapping.get("conditions"), f"Decision {node.id} rule conditions")
        has_flat = rule_mapping.get("field") and rule_mapping.get("operator") and rule_mapping.get("value") is not None
        if not raw_conditions and not has_flat:
            continue

        rule_element = ET.SubElement(element, flow_tag("rules"))
        normalized_rule_name = rule_name or safe_identifier(rule_label or "Rule", "Rule")
        append_text_element(rule_element, "name", normalized_rule_name)
        # Accept both snake_case and camelCase conditionLogic
        cond_logic = rule_mapping.get("condition_logic") or rule_mapping.get("conditionLogic")
        append_text_element(rule_element, "conditionLogic", cond_logic)
        conditions_to_emit = raw_conditions
        if not conditions_to_emit and has_flat:
            conditions_to_emit = [{"field": rule_mapping["field"], "operator": rule_mapping["operator"], "value": rule_mapping["value"]}]
        append_conditions(
            rule_element,
            [
                ensure_mapping(item, f"Decision {node.id} rule condition")
                for item in conditions_to_emit
            ],
            record_triggered=is_record_triggered(graph),
        )
        append_text_element(rule_element, "label", rule_label or normalized_rule_name)

    if plan.fault_edge is not None:
        append_connector(element, "faultConnector", target_reference_name(graph, plan.fault_edge))


def build_loop_element(root: ET.Element, graph: IndexedGraph, node: IndexedNode) -> None:
    element = ET.SubElement(root, flow_tag("loops"))
    append_common_node_fields(element, node)
    collection_reference = normalize_condition(node.metadata.get("collection_reference"))
    if collection_reference is None:
        raise GraphGenerationError(f"Loop node {node.id} is missing metadata.collection_reference")
    append_text_element(element, "collectionReference", collection_reference)
    append_text_element(element, "iterationOrder", node.metadata.get("iteration_order"))

    plan = plan_loop_connectors(graph, node)
    append_connector(element, "nextValueConnector", target_reference_name(graph, plan.loop_edge))
    if plan.exit_edge is not None:
        append_connector(element, "noMoreValuesConnector", target_reference_name(graph, plan.exit_edge))
    if plan.fault_edge is not None:
        append_connector(element, "faultConnector", target_reference_name(graph, plan.fault_edge))


def build_screen_element(root: ET.Element, graph: IndexedGraph, node: IndexedNode) -> None:
    element = ET.SubElement(root, flow_tag("screens"))
    append_common_node_fields(element, node)
    append_bool_element(element, "allowBack", node.metadata.get("allow_back") if node.metadata.get("allow_back") is not None else node.metadata.get("allowBack"))
    append_bool_element(element, "allowFinish", node.metadata.get("allow_finish") if node.metadata.get("allow_finish") is not None else node.metadata.get("allowFinish"))
    append_bool_element(element, "allowPause", node.metadata.get("allow_pause") if node.metadata.get("allow_pause") is not None else node.metadata.get("allowPause"))

    # Connector MUST come BEFORE fields in Screen XML
    direct_edge, fault_edge = plan_linear_connectors(graph, node)
    if direct_edge is not None:
        append_connector(element, "connector", target_reference_name(graph, direct_edge))

    append_screen_fields(element, graph, node, node.metadata)
    append_bool_element(element, "showFooter", node.metadata.get("show_footer") if node.metadata.get("show_footer") is not None else node.metadata.get("showFooter"))
    append_bool_element(element, "showHeader", node.metadata.get("show_header") if node.metadata.get("show_header") is not None else node.metadata.get("showHeader"))

    if fault_edge is not None:
        append_connector(element, "faultConnector", target_reference_name(graph, fault_edge))


def build_wait_element(root: ET.Element, graph: IndexedGraph, node: IndexedNode) -> None:
    element = ET.SubElement(root, flow_tag("waits"))
    append_common_node_fields(element, node)

    wait_events = ensure_sequence(node.metadata.get("wait_events"), f"Wait node {node.id} wait_events")
    if not wait_events:
        raise GraphGenerationError(f"Wait node {node.id} is missing wait_events")

    for event in wait_events:
        event_mapping = ensure_mapping(event, "wait_event")
        event_type = normalize_condition(event_mapping.get("event_type"))
        if event_type is None:
            event_type = "AlarmEvent"

        wait_event_element = ET.SubElement(element, flow_tag("waitEvent"))
        append_text_element(wait_event_element, "eventType", event_type)

        if event_type == "AlarmEvent":
            offset = event_mapping.get("alarm_time_offset")
            if offset is not None:
                append_text_element(wait_event_element, "alarmTimeOffset", str(offset))
            unit = event_mapping.get("alarm_time_unit", "Hours")
            append_text_element(wait_event_element, "alarmTimeUnit", unit)

        label = event_mapping.get("label")
        if label is not None:
            append_text_element(wait_event_element, "label", normalize_condition(label))

    # Connectors must come after waitEvent elements in Salesforce XML schema
    direct_edge, fault_edge = plan_linear_connectors(graph, node)
    if direct_edge is not None:
        append_connector(element, "connector", target_reference_name(graph, direct_edge))
    if fault_edge is not None:
        append_connector(element, "faultConnector", target_reference_name(graph, fault_edge))


def build_send_email_element(root: ET.Element, graph: IndexedGraph, node: IndexedNode) -> None:
    element = ET.SubElement(root, flow_tag("actionCalls"))
    append_common_node_fields(element, node)

    direct_edge, fault_edge = plan_linear_connectors(graph, node)
    if direct_edge is not None:
        append_connector(element, "connector", target_reference_name(graph, direct_edge))

    # Set action type to email
    append_text_element(element, "actionName", "chatter_SendAction")
    append_text_element(element, "actionType", "emailSimple")

    # Add email addresses
    email_addresses = ensure_sequence(node.metadata.get("email_addresses"), f"SendEmail node {node.id} email_addresses")
    if email_addresses:
        for addr in email_addresses:
            addr_param = ET.SubElement(element, flow_tag("inputParameters"))
            append_text_element(addr_param, "name", "to")
            if isinstance(addr, dict):
                elem_ref = addr.get("elementReference")
                if elem_ref:
                    append_text_element(addr_param, "value", elem_ref)
                else:
                    append_text_element(addr_param, "value", str(addr))
            else:
                append_text_element(addr_param, "value", str(addr))

    # Add email template or body
    email_template = normalize_condition(node.metadata.get("email_template"))
    email_body = normalize_condition(node.metadata.get("email_body"))

    if email_template:
        template_param = ET.SubElement(element, flow_tag("inputParameters"))
        append_text_element(template_param, "name", "template")
        append_text_element(template_param, "value", email_template)
    elif email_body:
        body_param = ET.SubElement(element, flow_tag("inputParameters"))
        append_text_element(body_param, "name", "body")
        append_text_element(body_param, "value", email_body)

    # Add subject if provided
    subject = normalize_condition(node.metadata.get("subject"))
    if subject:
        subject_param = ET.SubElement(element, flow_tag("inputParameters"))
        append_text_element(subject_param, "name", "subject")
        append_text_element(subject_param, "value", subject)

    if fault_edge is not None:
        append_connector(element, "faultConnector", target_reference_name(graph, fault_edge))


def build_custom_error_node_element(root: ET.Element, graph: IndexedGraph, node: IndexedNode) -> None:
    """Emit a <customErrors> element for a CustomError node (before-save validation errors)."""
    element = ET.SubElement(root, flow_tag("customErrors"))
    append_common_node_fields(element, node)

    messages = ensure_sequence(
        node.metadata.get("custom_error_messages") or node.metadata.get("customErrorMessages"),
        f"CustomError node {node.id} messages",
    )
    for msg in messages:
        mm = ensure_mapping(msg, "custom_error_message")
        msg_el = ET.SubElement(element, flow_tag("customErrorMessages"))
        append_text_element(msg_el, "errorMessage", mm.get("error_message") or mm.get("errorMessage") or "")
        is_field = mm.get("is_field_error") or mm.get("isFieldError") or False
        append_bool_element(msg_el, "isFieldError", is_field)
        field_name = mm.get("field_selection") or mm.get("fieldSelection") or mm.get("field")
        if field_name:
            append_text_element(msg_el, "fieldSelection", field_name)

    # CustomError nodes terminate the flow — no outgoing connector needed


def build_node_element(root: ET.Element, graph: IndexedGraph, node: IndexedNode) -> None:
    if node.type == "Start":
        return
    if node.type == "End":
        return
    if node.type == "Formula":
        return  # emitted as top-level <formulas> by build_formulas_elements
    if node.type == "Decision":
        build_decision_element(root, graph, node)
        return
    if node.type == "Assignment":
        build_assignment_element(root, graph, node)
        return
    if node.type == "ActionCall":
        # Route ActionCall through Assignment with actionCalls tag
        action_node = IndexedNode(
            id=node.id,
            type="Assignment",
            label=node.label,
            metadata={**node.metadata, "original_tag": node.metadata.get("original_tag", "actionCalls")},
            reference_name=node.reference_name,
            original_tag="actionCalls",
        )
        build_assignment_element(root, graph, action_node)
        return
    if node.type == "GetRecords":
        build_get_records_element(root, graph, node)
        return
    if node.type == "UpdateRecords":
        build_update_records_element(root, graph, node)
        return
    if node.type == "CreateRecords":
        # Handle CreateRecords as UpdateRecords with recordCreates tag
        node_with_tag = IndexedNode(
            id=node.id,
            type="UpdateRecords",
            label=node.label,
            metadata={**node.metadata, "original_tag": "recordCreates"},
            reference_name=node.reference_name,
            original_tag="recordCreates"
        )
        build_update_records_element(root, graph, node_with_tag)
        return
    if node.type == "Loop":
        build_loop_element(root, graph, node)
        return
    if node.type == "Screen":
        build_screen_element(root, graph, node)
        return
    if node.type == "Wait":
        build_wait_element(root, graph, node)
        return
    if node.type == "SendEmail":
        build_send_email_element(root, graph, node)
        return
    if node.type == "CustomError":
        build_custom_error_node_element(root, graph, node)
        return
    if node.type == "Subflow":
        # Route Subflow through Assignment with subflows tag
        subflow_node = IndexedNode(
            id=node.id,
            type="Assignment",
            label=node.label,
            metadata={**node.metadata, "original_tag": node.metadata.get("original_tag", "subflows")},
            reference_name=node.reference_name,
            original_tag="subflows",
        )
        build_assignment_element(root, graph, subflow_node)
        return

    raise GraphGenerationError(f"Unsupported node type {node.type}")


# ---------------------------------------------------------------------------
# Relative-date value sanitization
# ---------------------------------------------------------------------------
# Salesforce Flow XML does not accept relative date expressions like +7D inside
# <dateValue>.  When the LLM emits such patterns we auto-generate a <formulas>
# resource and replace the offending value with an <elementReference>.
#
# Recognised patterns (case-insensitive):
#   +7D / +7d         → TODAY() + 7
#   -3D / -3d         → TODAY() - 3
#   TODAY+7           → TODAY() + 7
#   TODAY-3           → TODAY() - 3
#   TODAY() + 7       → TODAY() + 7  (already correct formula syntax)
#   {!TODAY} + 7      → TODAY() + 7
# ---------------------------------------------------------------------------

_RELATIVE_DATE_RE = re.compile(
    r"^\s*"
    r"(?:(?:\{!TODAY\}|TODAY\s*\(\s*\)?\s*|TODAY)\s*([+-])\s*(\d+)"
    r"|([+-])(\d+)[Dd]"
    r"|(?:\{!TODAY\}|TODAY\s*\(\s*\)?\s*|TODAY))"
    r"\s*$",
    re.IGNORECASE,
)


def _parse_relative_date_days(raw: str) -> Optional[int]:
    """Return signed day offset if *raw* is a relative-date shorthand, else None."""
    m = _RELATIVE_DATE_RE.match(raw)
    if not m:
        return None
    if m.group(1) is not None:          # TODAY+N / TODAY-N form
        sign = 1 if m.group(1) == "+" else -1
        return sign * int(m.group(2))
    if m.group(3) is not None:          # +Nd / -Nd form
        sign = 1 if m.group(3) == "+" else -1
        return sign * int(m.group(4))
    return 0                            # plain TODAY / TODAY()


def _relative_date_formula_name(raw: str) -> Optional[str]:
    days = _parse_relative_date_days(raw)
    if days is None:
        return None
    return _formula_name_for_days(days)


def _formula_name_for_days(days: int) -> str:
    if days >= 0:
        return f"Today_Plus_{days}_Days"
    return f"Today_Minus_{abs(days)}_Days"


def _formula_expr_for_days(days: int) -> str:
    if days == 0:
        return "TODAY()"
    if days > 0:
        return f"TODAY() + {days}"
    return f"TODAY() - {abs(days)}"


def _collect_auto_formulas(graph: Mapping[str, Any]) -> Dict[str, str]:
    """
    Walk the graph and return a mapping of {formula_name: formula_expression}
    for any relative-date shorthand values found anywhere in nested values.
    """
    auto: Dict[str, str] = {}
    def walk(value: Any) -> None:
        if isinstance(value, dict):
            raw_date = value.get("dateValue") or value.get("DateValue")
            if raw_date is not None:
                days = _parse_relative_date_days(str(raw_date))
                if days is not None:
                    auto[_formula_name_for_days(days)] = _formula_expr_for_days(days)
            for nested_value in value.values():
                walk(nested_value)
        elif isinstance(value, list):
            for item in value:
                walk(item)
        elif isinstance(value, str):
            # Condition values (Decision leftValueReference/operator/value, filter
            # values, assignment due dates) can carry bare relative-date strings
            # like "TODAY() - 7" that Salesforce rejects inside <dateValue>. Catch
            # them here so the auto-formula name matches what _sanitize_value
            # generates when it walks the same value later.
            days = _parse_relative_date_days(value)
            if days is not None:
                auto[_formula_name_for_days(days)] = _formula_expr_for_days(days)

    walk(graph)
    return auto


def _sanitize_value(
    value: Any,
    auto_formulas: Mapping[str, str],
) -> Any:
    """
    Replace relative dateValue shorthands with elementReference pointing at
    the auto-generated formula, leaving everything else untouched.
    """
    if isinstance(value, str):
        formula_name = _relative_date_formula_name(value)
        if formula_name is None:
            return value
        return {"elementReference": formula_name}
    if isinstance(value, list):
        return [_sanitize_value(item, auto_formulas) for item in value]
    if not isinstance(value, dict):
        return value
    # Guard: {"elementReference": bare_relative_date} must not recurse into the
    # string and re-wrap it as {"elementReference": {"elementReference": "…"}}.
    if set(value.keys()) == {"elementReference"}:
        inner = value["elementReference"]
        if isinstance(inner, str):
            formula_name = _relative_date_formula_name(inner)
            if formula_name is not None:
                return {"elementReference": formula_name}
    raw_date = value.get("dateValue") or value.get("DateValue")
    if raw_date is None:
        return {key: _sanitize_value(nested_value, auto_formulas) for key, nested_value in value.items()}
    days = _parse_relative_date_days(str(raw_date))
    if days is None:
        return {key: _sanitize_value(nested_value, auto_formulas) for key, nested_value in value.items()}
    name = _formula_name_for_days(days)
    return {"elementReference": name}


def build_formulas_elements(
    root: ET.Element,
    graph: Mapping[str, Any],
    auto_formulas: Mapping[str, str],
    formula_nodes: Sequence[IndexedNode] = (),
) -> None:
    """Emit <formulas> elements: explicit ones from graph metadata + Formula nodes + auto-generated."""
    explicit = ensure_sequence(graph.get("formulas"), "graph formulas")
    emitted_names: Set[str] = set()

    for item in explicit:
        fm = ensure_mapping(item, "formula")
        name = normalize_condition(fm.get("name"))
        if not name:
            continue
        emitted_names.add(name)
        el = ET.SubElement(root, flow_tag("formulas"))
        append_text_element(el, "name", name)
        append_text_element(el, "dataType", fm.get("data_type") or fm.get("dataType") or "Date")
        expr = fm.get("expression")
        # Unwrap JSON-like dict expressions: {"elementReference":"Today_Plus_3_Days"}
        # → resolve to the actual formula text from auto_formulas so XML stays valid.
        if isinstance(expr, dict) and "elementReference" in expr:
            ref = expr["elementReference"]
            expr = auto_formulas.get(ref) if ref in auto_formulas else f"TODAY() + 3"
        append_text_element(el, "expression", expr)

    # Emit formulas from Formula-typed graph nodes (LLM sometimes uses node type "Formula")
    for node in formula_nodes:
        name = node.metadata.get("name") or node.reference_name
        if not name or name in emitted_names:
            continue
        emitted_names.add(name)
        el = ET.SubElement(root, flow_tag("formulas"))
        append_text_element(el, "name", name)
        append_text_element(el, "dataType", node.metadata.get("data_type") or node.metadata.get("dataType") or "Date")
        append_text_element(el, "description", node.metadata.get("description"))
        append_text_element(el, "expression", node.metadata.get("expression"))

    for name, expr in auto_formulas.items():
        if name in emitted_names:
            continue
        el = ET.SubElement(root, flow_tag("formulas"))
        append_text_element(el, "name", name)
        append_text_element(el, "dataType", "Date")
        append_text_element(el, "expression", expr)



# Valid Salesforce Flow variable dataTypes
_VALID_VAR_DATATYPES = {
    "Apex", "Boolean", "Currency", "Date", "DateTime", "Number",
    "Picklist", "String", "SObject", "MultiselectPicklist",
}
# Common LLM mistakes and their corrections
_DATATYPE_REMAP = {
    "Reference": "String",   # Id fields are Strings in Flow variables
    "Id": "String",
    "Text": "String",
    "Integer": "Number",
    "Float": "Number",
    "Double": "Number",
    "Long": "Number",
}


def build_variables_elements(root: ET.Element, graph: Mapping[str, Any]) -> None:
    """Emit <variables> elements from graph-level metadata.variables array."""
    variables = ensure_sequence(graph.get("variables"), "graph variables")
    for item in variables:
        vm = ensure_mapping(item, "variable")
        description = normalize_condition(vm.get("description"))
        name = normalize_condition(vm.get("name"))
        if not name:
            continue
        raw_dtype = vm.get("data_type") or vm.get("dataType") or "String"
        dtype = _DATATYPE_REMAP.get(raw_dtype, raw_dtype)
        el = ET.SubElement(root, flow_tag("variables"))
        append_text_element(el, "description", description)
        append_text_element(el, "name", name)
        append_text_element(el, "dataType", dtype)
        is_collection = vm.get("is_collection") or vm.get("isCollection")
        append_bool_element(el, "isCollection", bool(is_collection) if is_collection is not None else False)
        is_input = vm.get("is_input") or vm.get("isInput")
        append_bool_element(el, "isInput", bool(is_input) if is_input is not None else False)
        is_output = vm.get("is_output") or vm.get("isOutput")
        append_bool_element(el, "isOutput", bool(is_output) if is_output is not None else False)
        object_type = vm.get("object_type") or vm.get("objectType")
        if object_type:
            append_text_element(el, "objectType", object_type)
        scale = vm.get("scale")
        if scale is not None:
            append_text_element(el, "scale", scale)
        default_val = vm.get("value")
        if default_val is not None:
            append_serialized_value(el, "value", default_val)


def build_choices_elements(root: ET.Element, graph: Mapping[str, Any]) -> None:
    """Emit <choices> elements from graph-level choices array (Screen Flow picklists)."""
    choices = ensure_sequence(graph.get("choices"), "graph choices")
    for item in choices:
        cm = ensure_mapping(item, "choice")
        name = normalize_condition(cm.get("name"))
        if not name:
            continue
        
        choice_type = normalize_condition(cm.get("type"))
        if choice_type == "dynamicChoiceSets":
            el = ET.SubElement(root, flow_tag("dynamicChoiceSets"))
            append_text_element(el, "name", name)
            append_text_element(el, "dataType", cm.get("data_type") or cm.get("dataType") or "Picklist")
            
            # These are specific to dynamicChoiceSets
            picklist_field = cm.get("picklist_field") or cm.get("picklistField")
            if picklist_field:
                # For Picklist dynamic choices, displayField and object are usually nil
                df_el = ET.SubElement(el, flow_tag("displayField"))
                df_el.set("xsi:nil", "true")
                obj_el = ET.SubElement(el, flow_tag("object"))
                obj_el.set("xsi:nil", "true")
                append_text_element(el, "picklistField", picklist_field)
                append_text_element(el, "picklistObject", cm.get("picklist_object") or cm.get("picklistObject"))
            else:
                append_text_element(el, "displayField", cm.get("display_field") or cm.get("displayField") or "Name")
                append_text_element(el, "object", cm.get("object"))

        else:
            el = ET.SubElement(root, flow_tag("choices"))
            append_text_element(el, "name", name)
            append_text_element(el, "choiceText", cm.get("choice_text") or cm.get("choiceText"))
            append_text_element(el, "dataType", cm.get("data_type") or cm.get("dataType") or "String")
            append_serialized_value(el, "value", cm.get("value"))


def build_constants_elements(root: ET.Element, graph: Mapping[str, Any]) -> None:
    """Emit <constants> elements from graph-level constants array."""
    constants = ensure_sequence(graph.get("constants"), "graph constants")
    for item in constants:
        cm = ensure_mapping(item, "constant")
        name = normalize_condition(cm.get("name"))
        if not name:
            continue
        el = ET.SubElement(root, flow_tag("constants"))
        append_text_element(el, "name", name)
        append_text_element(el, "dataType", cm.get("data_type") or cm.get("dataType") or "String")
        append_serialized_value(el, "value", cm.get("value"))


def build_custom_properties_elements(root: ET.Element, graph: Mapping[str, Any]) -> None:
    """Emit <customProperties> elements from graph-level custom_properties array."""
    props = ensure_sequence(graph.get("custom_properties"), "graph custom_properties")
    for item in props:
        pm = ensure_mapping(item, "custom_property")
        name = normalize_condition(pm.get("name"))
        if not name:
            continue
        el = ET.SubElement(root, flow_tag("customProperties"))
        append_text_element(el, "name", name)
        append_serialized_value(el, "value", pm.get("value"))


def build_custom_errors_elements(root: ET.Element, graph: Mapping[str, Any]) -> None:
    """Emit <customErrors> elements from graph-level custom_errors array."""
    errors = ensure_sequence(graph.get("custom_errors"), "graph custom_errors")
    for item in errors:
        em = ensure_mapping(item, "custom_error")
        name = normalize_condition(em.get("name"))
        if not name:
            continue
        el = ET.SubElement(root, flow_tag("customErrors"))
        append_text_element(el, "name", name)
        append_text_element(el, "label", em.get("label") or name)
        error_messages = ensure_sequence(
            em.get("custom_error_messages") or em.get("customErrorMessages"),
            f"custom_error {name} messages",
        )
        for msg in error_messages:
            mm = ensure_mapping(msg, "custom_error_message")
            msg_el = ET.SubElement(el, flow_tag("customErrorMessages"))
            append_text_element(msg_el, "errorMessage", mm.get("error_message") or mm.get("errorMessage"))
            append_bool_element(msg_el, "isFieldError", mm.get("is_field_error") or mm.get("isFieldError"))


def build_flow_tree(
    graph: Mapping[str, Any],
    *,
    api_version: str = DEFAULT_API_VERSION,
    status: str = DEFAULT_STATUS,
) -> ET.ElementTree:
    # Scheduled flows must be Active to run; promote Draft → Active automatically
    if status == DEFAULT_STATUS:
        nodes_raw = ensure_sequence(graph.get("nodes"), "nodes")
        for raw_node in nodes_raw:
            if isinstance(raw_node, dict):
                meta = raw_node.get("metadata") or {}
                if isinstance(meta, dict):
                    tt = meta.get("trigger_type") or meta.get("triggerType")
                    if tt == "Scheduled":
                        status = "Active"
                        break

    # Collect any auto-formulas needed before we index the graph, so that
    # build_node_element can reference them during value serialization.
    auto_formulas = _collect_auto_formulas(graph)

    # Patch graph in-memory: replace relative dateValues with elementReferences
    if auto_formulas:
        graph = _patch_graph_relative_dates(graph, auto_formulas)

    indexed_graph, synthesized_variables = build_indexed_graph(graph)
    root = ET.Element(flow_tag("Flow"))
    root.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")

    build_root_header(root, api_version)

    for node in iter_nodes_for_emission(indexed_graph.nodes):
        build_node_element(root, indexed_graph, node)

    build_root_description(root, graph)
    build_choices_elements(root, graph)
    build_constants_elements(root, graph)
    build_custom_properties_elements(root, graph)
    build_custom_errors_elements(root, graph)
    # <environments> must come before <formulas> in SF Flow XML schema ordering
    append_text_element(root, "environments", "Default")
    formula_nodes = [n for n in indexed_graph.nodes if n.type == "Formula"]
    build_formulas_elements(root, graph, auto_formulas, formula_nodes)
    build_root_defaults(
        root,
        indexed_graph.flow_name,
        determine_process_type(indexed_graph),
    )
    build_start_element(root, indexed_graph)
    append_text_element(root, "status", status)
    if synthesized_variables:
        graph_with_synth_vars = dict(graph)
        graph_with_synth_vars["variables"] = (
            list(ensure_sequence(graph.get("variables"), "graph variables")) + synthesized_variables
        )
        build_variables_elements(root, graph_with_synth_vars)
    else:
        build_variables_elements(root, graph)

    tree = ET.ElementTree(root)
    ET.indent(tree, space="    ")
    return tree


def _patch_graph_relative_dates(
    graph: Mapping[str, Any],
    auto_formulas: Mapping[str, str],
) -> Mapping[str, Any]:
    """Return a deep-patched copy of graph with relative dateValues replaced."""
    # _sanitize_value already recurses through dicts and lists, so a single
    # call replaces every relative-date shorthand anywhere in the graph.
    return _sanitize_value(graph, auto_formulas)


def generate_flow_xml_text(
    graph: Mapping[str, Any],
    *,
    api_version: str = DEFAULT_API_VERSION,
    status: str = DEFAULT_STATUS,
) -> str:
    tree = build_flow_tree(graph, api_version=api_version, status=status)
    buffer = io.BytesIO()
    tree.write(buffer, encoding="utf-8", xml_declaration=True)
    return buffer.getvalue().decode("utf-8")


def write_flow_xml(
    graph: Mapping[str, Any],
    output_path: Path,
    *,
    api_version: str = DEFAULT_API_VERSION,
    status: str = DEFAULT_STATUS,
) -> None:
    xml_text = generate_flow_xml_text(graph, api_version=api_version, status=status)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(xml_text, encoding="utf-8")


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Convert Salesforce Flow graphs to .flow-meta.xml files. Can process single file or entire directory.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Convert single graph file (auto-generates output path)
  python graph_to_flow_xml.py graphs/my_flow/my_flow.json
  
  # Convert entire graphs directory to flows
  python graph_to_flow_xml.py graphs/
  
  # Convert all graphs (default to graphs/ directory)
  python graph_to_flow_xml.py
  
  # Specify custom output path for single file
  python graph_to_flow_xml.py graphs/my_flow/my_flow.json flows/MyFlow.flow-meta.xml
  
  # With custom API version and status
  python graph_to_flow_xml.py graphs/my_flow/my_flow.json --api-version 62.0 --status Active
        """
    )
    parser.add_argument(
        "input_json",
        type=Path,
        nargs="?",
        default=REPO_ROOT / "graphs",
        help="Path to graph JSON file or directory. If omitted, defaults to graphs/ directory.",
    )
    parser.add_argument(
        "output_xml",
        type=Path,
        nargs="?",
        default=None,
        help="Path where the .flow-meta.xml will be written. Only used for single file input. If omitted, auto-generates based on flow name.",
    )
    parser.add_argument(
        "--api-version",
        default=DEFAULT_API_VERSION,
        help=f"Flow apiVersion value to emit. Default: {DEFAULT_API_VERSION}.",
    )
    parser.add_argument(
        "--status",
        default=DEFAULT_STATUS,
        help=f"Flow status value to emit. Default: {DEFAULT_STATUS}.",
    )
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_argument_parser()
    args = parser.parse_args(argv)

    input_path = args.input_json
    
    # Check if input is a directory or file
    if input_path.is_dir():
        # Batch convert all JSON files in the directory
        json_files = list(input_path.glob("**/*.json"))
        
        if not json_files:
            print(f"No JSON files found in {input_path}")
            return 0
        
        converted_count = 0
        errors = []
        
        for json_file in json_files:
            try:
                graph = load_graph_json(json_file)
                
                # Auto-generate output path
                flow_name = safe_flow_name(graph)
                safe_name = flow_name.lower().replace(' ', '_').replace('-', '_')
                output_dir = REPO_ROOT / "flows" / safe_name
                output_xml = output_dir / f"{safe_name}.flow-meta.xml"

                write_flow_xml(graph, output_xml, api_version=args.api_version, status=args.status)
                print(f"OK Converted {json_file} -> {output_xml}")
                converted_count += 1

            except Exception as e:
                errors.append(f"✗ {json_file}: {e}")

        if errors:
            print("\nErrors encountered:")
            for error in errors:
                print(error)

        print(f"\nOK Converted {converted_count} flow(s)")
        return 0

    else:
        # Single file conversion
        try:
            graph = load_graph_json(input_path)

            # Auto-generate output path if not specified
            if args.output_xml is None:
                flow_name = safe_flow_name(graph)
                # Sanitize flow name for use as folder/file name
                safe_name = flow_name.lower().replace(' ', '_').replace('-', '_')
                # Create flows/flow_name/ directory
                output_dir = REPO_ROOT / "flows" / safe_name
                output_xml = output_dir / f"{safe_name}.flow-meta.xml"
            else:
                output_xml = args.output_xml
            
            write_flow_xml(graph, output_xml, api_version=args.api_version, status=args.status)
        except GraphGenerationError as exc:
            parser.exit(1, f"Error: {exc}\n")

        print(f"OK Wrote {output_xml}")
        print(f"\nNext: sfdx force:source:deploy -p {output_xml} -u your-org")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())

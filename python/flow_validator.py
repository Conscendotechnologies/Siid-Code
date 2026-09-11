import xml.etree.ElementTree as ET
import sys
import json
from typing import Any, Dict, List, Tuple

def strip_ns(tag: str) -> str:
    return tag.split('}')[-1] if '}' in tag else tag

def parse_xml_to_dict(element: ET.Element) -> Dict[str, Any]:
    tag = strip_ns(element.tag)
    if not list(element):
        return {tag: element.text}
    result = {}
    for child in element:
        child_tag = strip_ns(child.tag)
        child_dict = parse_xml_to_dict(child)
        child_val = child_dict[child_tag]
        if child_tag in result:
            if type(result[child_tag]) is list:
                result[child_tag].append(child_val)
            else:
                result[child_tag] = [result[child_tag], child_val]
        else:
            result[child_tag] = child_val
    return {tag: result}

def extract_flow_model(filepath: str) -> Dict[str, Any]:
    tree = ET.parse(filepath)
    root = tree.getroot()
    model = {'metadata': {}, 'nodes': {}, 'variables': {}, 'dynamicChoiceSets': {}, 'choices': {}, 'connectors': []}

    for tag in ['processType', 'triggerType', 'status', 'environments', 'apiVersion']:
        el = root.find(f".//{{http://soap.sforce.com/2006/04/metadata}}{tag}")
        if el is not None:
            model['metadata'][tag] = el.text

    start = root.find(".//{http://soap.sforce.com/2006/04/metadata}start")
    if start is not None:
        start_dict = parse_xml_to_dict(start)['start']
        start_meta = {k: v for k, v in start_dict.items() if k not in ['locationX', 'locationY', 'connector']}
        model['metadata']['start'] = start_meta
        if 'connector' in start_dict:
            connector = start_dict['connector']
            target = connector.get('targetReference') if isinstance(connector, dict) else None
            model['nodes']['Start'] = {'type': 'Start', 'connector': target}
            if target:
                model['connectors'].append(('Start', target, 'default'))

    NODE_TAGS = ['recordCreates', 'recordUpdates', 'recordDeletes', 'recordLookups',
                 'assignments', 'decisions', 'loops', 'screens', 'waits', 'actionCalls', 'subflows']
    for tag in NODE_TAGS:
        for el in root.findall(f".//{{http://soap.sforce.com/2006/04/metadata}}{tag}"):
            node_dict = parse_xml_to_dict(el)[tag]
            name = node_dict.get('name')
            if not name: continue
            for k in ['locationX', 'locationY', 'description']:
                if k in node_dict: del node_dict[k]
            node_dict['type'] = tag
            model['nodes'][name] = node_dict

            # Extract connectors
            if 'connector' in node_dict:
                connector = node_dict['connector']
                target = connector.get('targetReference') if isinstance(connector, dict) else None
                if target:
                    model['connectors'].append((name, target, 'default'))

            if tag == 'decisions':
                rules = node_dict.get('rules', [])
                if not isinstance(rules, list): rules = [rules]
                for rule in rules:
                    if isinstance(rule, dict) and 'connector' in rule:
                        target = rule['connector'].get('targetReference') if isinstance(rule['connector'], dict) else None
                        if target:
                            model['connectors'].append((name, target, rule.get('name', 'rule')))

                if 'defaultConnector' in node_dict:
                    target = node_dict['defaultConnector'].get('targetReference') if isinstance(node_dict['defaultConnector'], dict) else None
                    if target:
                        model['connectors'].append((name, target, 'default'))

    for el in root.findall(f".//{{http://soap.sforce.com/2006/04/metadata}}variables"):
        v = parse_xml_to_dict(el)['variables']
        if 'name' in v:
            if 'description' in v: del v['description']
            model['variables'][v['name']] = v
    for el in root.findall(f".//{{http://soap.sforce.com/2006/04/metadata}}dynamicChoiceSets"):
        d = parse_xml_to_dict(el)['dynamicChoiceSets']
        if 'name' in d: model['dynamicChoiceSets'][d['name']] = d
    for el in root.findall(f".//{{http://soap.sforce.com/2006/04/metadata}}choices"):
        c = parse_xml_to_dict(el)['choices']
        if 'name' in c: model['choices'][c['name']] = c
    return model

def calculate_similarity(dict1: Any, dict2: Any) -> Tuple[float, List[str]]:
    if dict1 == dict2:
        return 1.0, []
    if type(dict1) != type(dict2):
        return 0.0, [f"Type mismatch: {type(dict1)} vs {type(dict2)}"]

    if isinstance(dict1, dict):
        all_keys = set(dict1.keys()) | set(dict2.keys())
        for k in ['label', 'name', 'connector', 'defaultConnector']:
            if k in all_keys: all_keys.remove(k)
        if not all_keys: return 1.0, []

        score = 0.0
        diffs = []
        for k in all_keys:
            if k in dict1 and k in dict2:
                s, d = calculate_similarity(dict1[k], dict2[k])
                score += s
                diffs.extend([f"{k}: {x}" for x in d])
            else:
                diffs.append(f"Missing key: {k}")
        return score / len(all_keys), diffs

    elif isinstance(dict1, list):
        if len(dict1) == 0 and len(dict2) == 0:
            return 1.0, []
        if len(dict1) != len(dict2):
            return 0.0, [f"List length mismatch: {len(dict1)} vs {len(dict2)}"]

        score = 0.0
        diffs = []
        if dict1 and isinstance(dict1[0], dict) and 'name' in dict1[0]:
            dict1 = sorted(dict1, key=lambda x: x.get('name', ''))
            dict2 = sorted(dict2, key=lambda x: x.get('name', ''))

        for i in range(len(dict1)):
            s, d = calculate_similarity(dict1[i], dict2[i])
            score += s
            diffs.extend([f"[{i}]: {x}" for x in d])
        return score / len(dict1), diffs

    else:
        if str(dict1).strip().lower() == str(dict2).strip().lower():
            return 1.0, []
        else:
            return 0.0, [f"Value mismatch: {dict1} vs {dict2}"]

def compare_flows(ref_path: str, gen_path: str) -> Dict[str, Any]:
    ref = extract_flow_model(ref_path)
    gen = extract_flow_model(gen_path)

    report = {
        "score": 0.0,
        "metadata_diffs": [],
        "node_diffs": [],
        "connector_diffs": [],
        "parameter_diffs": [],
        "unsupported": [],
        "recommended_fixes": []
    }

    total_score = 0.0
    weight = 0.0

    # 1. Metadata
    m_score, m_diffs = calculate_similarity(ref['metadata'], gen['metadata'])
    total_score += m_score * 20
    weight += 20
    report['metadata_diffs'] = m_diffs

    # 2. Nodes
    ref_nodes_by_type = {}
    for k, v in ref['nodes'].items():
        ref_nodes_by_type.setdefault(v['type'], []).append((k, v))

    gen_nodes_by_type = {}
    for k, v in gen['nodes'].items():
        gen_nodes_by_type.setdefault(v['type'], []).append((k, v))

    node_scores = []

    # Identify unsupported constructs
    if 'areMetricsLoggedToDataCloud' in ref['metadata'] and 'areMetricsLoggedToDataCloud' not in gen['metadata']:
        report['unsupported'].append('areMetricsLoggedToDataCloud metadata flag')
        report['recommended_fixes'].append('graph_to_flow_xml.py: Emit <areMetricsLoggedToDataCloud>false</areMetricsLoggedToDataCloud> under the flow root element.')


    # Map reference node names to generated node names based on the best matching score
    ref_to_gen_map = {}
    
    for ntype, ref_nodes in ref_nodes_by_type.items():
        gen_nodes = gen_nodes_by_type.get(ntype, [])
        if len(ref_nodes) != len(gen_nodes):
            report['node_diffs'].append(f"Count mismatch for {ntype}: {len(ref_nodes)} ref vs {len(gen_nodes)} gen")
            node_scores.append(0.0)
            
            if len(ref_nodes) > len(gen_nodes):
                report['recommended_fixes'].append(f'prompt_to_graph.py: Improve prompt instructions to ensure {ntype} nodes are properly generated for this scenario.')
            continue

        for ref_name, ref_node in ref_nodes:
            best_score = -1.0
            best_diffs = []
            best_match_name = None

            for gen_name, gen_node in gen_nodes:
                s, d = calculate_similarity(ref_node, gen_node)
                if s > best_score:
                    best_score = s
                    best_diffs = d
                    best_match_name = gen_name
            
            if best_match_name:
                ref_to_gen_map[ref_name] = best_match_name

            node_scores.append(best_score)
            if best_score < 1.0:
                report['node_diffs'].append(f"Node {ref_name} ({ntype}): diffs: {best_diffs[:5]}")
                if ntype == 'screens' and any('styleProperties' in d for d in best_diffs):
                    report['unsupported'].append('Screen field styleProperties (e.g. width, verticalAlignment)')
                    report['recommended_fixes'].append('graph_to_flow_xml.py: Add logic in build_screen_element to emit styleProperties.')

    if node_scores:
        avg_node = sum(node_scores) / len(node_scores)
        total_score += avg_node * 40
        weight += 40

    # 3. Connectors
    # Map reference connectors to generated node names
    mapped_ref_conn = set()
    for s, t, b in ref['connectors']:
        mapped_s = ref_to_gen_map.get(s, s)
        # Note: Start node is named "Start" in both, so it maps safely.
        mapped_t = ref_to_gen_map.get(t, t)
        mapped_ref_conn.add((mapped_s, mapped_t, b))
        
    gen_conn = {(s, b) for s, t, b in gen['connectors']}
    # We only check source and branch, target checking can be noisy if we miss a node map
    mapped_ref_conn_src = {(s, b) for s, t, b in mapped_ref_conn}

    conn_intersect = mapped_ref_conn_src.intersection(gen_conn)
    conn_score = len(conn_intersect) / len(mapped_ref_conn_src) if mapped_ref_conn_src else 1.0

    total_score += conn_score * 20
    weight += 20

    missing_conns = mapped_ref_conn_src - gen_conn
    if missing_conns:
        report['connector_diffs'] = [f"Missing connector from {s} (branch: {b})" for s, b in missing_conns]

    # 4. Action Calls & Choices (Parameters)
    param_score = 0.0
    param_weight = 0.0
    if ref['dynamicChoiceSets'] or ref['choices']:
        c_score1, c_diff1 = calculate_similarity(ref['dynamicChoiceSets'], gen['dynamicChoiceSets'])
        param_score += c_score1 * 10
        param_weight += 10
        if c_score1 < 1.0: report['parameter_diffs'].append(f"dynamicChoiceSets: {c_diff1[:3]}")

    if ref['variables']:
        v_score, v_diff = calculate_similarity(ref['variables'], gen['variables'])
        param_score += v_score * 10
        param_weight += 10
        if v_score < 1.0: report['parameter_diffs'].append(f"variables: {v_diff[:3]}")

    if param_weight > 0:
        total_score += param_score
        weight += param_weight

    report['score'] = (total_score / weight) * 100 if weight > 0 else 0
    report['passed'] = report['score'] > 85.0

    return report

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("ref_xml")
    parser.add_argument("gen_xml")
    args = parser.parse_args()

    rep = compare_flows(args.ref_xml, args.gen_xml)
    print(json.dumps(rep, indent=2))

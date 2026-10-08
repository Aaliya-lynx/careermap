"""Checks and cleans a roadmap that came from the AI. The AI's JSON is never trusted: only valid values survive.

A node looks like:
    {"id": "react", "title": "React", "kind": "skill", "phase": 2, "hours": 40,
     "requires": ["javascript"], "essential": true, "why": "Most frontend jobs ask for it."}
"""
import re

KINDS = {"skill", "role", "cert", "project"}
MAX_NODES = 24
MIN_NODES = 4
MAX_PHASES = 6


class RoadmapError(Exception):
    """The AI's answer could not be turned into a usable roadmap."""


def _text(value, limit):
    return " ".join(value.split())[:limit] if isinstance(value, str) else ""


def _slug(value):
    if not isinstance(value, str):
        return ""
    return re.sub(r"[^a-z0-9_-]+", "-", value.strip().lower()).strip("-")[:40]


def _int_between(value, low, high, default):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return default
    return int(min(max(value, low), high))


def _break_cycles(nodes):
    """Remove any link that points back to a node already on the current path."""
    by_id = {n["id"]: n for n in nodes}
    done, on_path = set(), set()

    def visit(node_id):
        on_path.add(node_id)
        for req in list(by_id[node_id]["requires"]):
            if req in on_path:
                by_id[node_id]["requires"].remove(req)
            elif req not in done:
                visit(req)
        on_path.discard(node_id)
        done.add(node_id)

    for n in nodes:
        if n["id"] not in done:
            visit(n["id"])


def apply_essential_closure(nodes):
    """If a step is essential, everything it needs is essential too (so it can never be dropped as 'optional')."""
    by_id = {n["id"]: n for n in nodes}
    stack = [n["id"] for n in nodes if n["essential"]]
    while stack:
        for req in by_id[stack.pop()]["requires"]:
            if req in by_id and not by_id[req]["essential"]:
                by_id[req]["essential"] = True
                stack.append(req)
    return nodes


def clean_roadmap(raw):
    """Return {"title", "summary", "phases", "nodes"} with only valid values, or raise RoadmapError."""
    if not isinstance(raw, dict) or not isinstance(raw.get("nodes"), list):
        raise RoadmapError("no nodes in the AI answer")

    nodes, seen = [], set()
    for item in raw["nodes"]:
        if not isinstance(item, dict):
            continue
        node_id = _slug(item.get("id")) or _slug(item.get("title"))
        title = _text(item.get("title"), 80)
        if not node_id or not title or node_id in seen:
            continue
        seen.add(node_id)
        kind = item.get("kind") if item.get("kind") in KINDS else "skill"
        essential = item.get("essential")
        nodes.append({
            "id": node_id,
            "title": title,
            "kind": kind,
            "phase": _int_between(item.get("phase"), 1, MAX_PHASES, 1),
            "hours": _int_between(item.get("hours"), 1, 400, 20),
            "requires": [_slug(r) for r in item["requires"]] if isinstance(item.get("requires"), list) else [],
            "essential": essential if isinstance(essential, bool) else True,
            "why": _text(item.get("why"), 200),
        })
        if len(nodes) == MAX_NODES:
            break

    ids = {n["id"] for n in nodes}
    for n in nodes:
        n["requires"] = list(dict.fromkeys(r for r in n["requires"] if r in ids and r != n["id"]))
    if len(nodes) < MIN_NODES:
        raise RoadmapError("the AI answer has too few usable steps")

    _break_cycles(nodes)
    apply_essential_closure(nodes)

    wanted = max(n["phase"] for n in nodes)
    phases = [_text(p, 40) or f"Phase {i + 1}" for i, p in enumerate(raw["phases"][:MAX_PHASES])] \
        if isinstance(raw.get("phases"), list) else []
    while len(phases) < wanted:
        phases.append(f"Phase {len(phases) + 1}")

    return {"title": _text(raw.get("title"), 120), "summary": _text(raw.get("summary"), 300),
            "phases": phases, "nodes": nodes}


def clean_known(values, nodes):
    """Keep only ids that exist in the roadmap (no duplicates)."""
    if not isinstance(values, list):
        return []
    ids = {n["id"] for n in nodes}
    return list(dict.fromkeys(v for v in values if isinstance(v, str) and v in ids))

"""The 'ready by' planner: plain Python, no AI. Decides the order, the weeks needed and what no longer fits.

Rules
- A step marked known is done. Everything it needs is assumed known too ("implied").
- Remaining steps run one after another, in prerequisite order, at hours_per_week.
- With a weeks budget that is too small, optional steps are dropped ("stretch"), latest phase first, together
  with the steps that depend on them. Essential steps are never dropped.
- The critical path is the longest chain of hours among the steps still to do.
"""
import math

from roadmap import apply_essential_closure


def _clamp_hours(value):
    try:
        value = float(value)
    except (TypeError, ValueError):
        value = 5.0
    return min(max(value, 1.0), 80.0)


def _ancestors(by_id, start_ids):
    seen, stack = set(), list(start_ids)
    while stack:
        for req in by_id[stack.pop()]["requires"]:
            if req in by_id and req not in seen:
                seen.add(req)
                stack.append(req)
    return seen


def _descendants(nodes, root_ids):
    dropped, changed = set(root_ids), True
    while changed:
        changed = False
        for n in nodes:
            if n["id"] not in dropped and any(r in dropped for r in n["requires"]):
                dropped.add(n["id"])
                changed = True
    return dropped


def _order(nodes, scheduled_ids):
    """Topological order of the scheduled steps; earlier phase, then original position, first."""
    position = {n["id"]: i for i, n in enumerate(nodes)}
    by_id = {n["id"]: n for n in nodes}
    left, order = set(scheduled_ids), []
    while left:
        ready = [i for i in left if all(r not in left for r in by_id[i]["requires"])]
        if not ready:  # cannot happen after roadmap.clean_roadmap; stay safe anyway
            ready = list(left)
        nxt = min(ready, key=lambda i: (by_id[i]["phase"], position[i]))
        order.append(nxt)
        left.discard(nxt)
    return order


def plan(nodes, known, hours_per_week, weeks_budget=None):
    nodes = apply_essential_closure([dict(n) for n in nodes])
    by_id = {n["id"]: n for n in nodes}
    hpw = _clamp_hours(hours_per_week)

    known_ids = {k for k in (known or []) if k in by_id}
    implied = _ancestors(by_id, known_ids) - known_ids
    done = known_ids | implied
    remaining = [n["id"] for n in nodes if n["id"] not in done]

    # Over budget? Drop optional steps (and what depends on them), latest phase and biggest first.
    stretch = set()
    if weeks_budget:
        def weeks_for(ids):
            return math.ceil(sum(by_id[i]["hours"] for i in ids) / hpw) if ids else 0

        while weeks_for([i for i in remaining if i not in stretch]) > weeks_budget:
            candidates = [i for i in remaining if i not in stretch and not by_id[i]["essential"]]
            if not candidates:
                break
            pick = max(candidates, key=lambda i: (by_id[i]["phase"], by_id[i]["hours"]))
            stretch |= {i for i in _descendants(nodes, {pick}) if i in remaining}

    scheduled = [i for i in remaining if i not in stretch]
    order = _order(nodes, scheduled)

    info, cumulative = {}, 0
    for node in nodes:
        i = node["id"]
        status = "known" if i in known_ids else "implied" if i in implied else "stretch" if i in stretch else "todo"
        info[i] = {"status": status, "start_week": None, "end_week": None, "critical": False,
                   "available": status == "todo" and all(r in done for r in node["requires"])}
    for i in order:
        info[i]["start_week"] = round(cumulative / hpw, 1)
        cumulative += by_id[i]["hours"]
        info[i]["end_week"] = round(cumulative / hpw, 1)

    # Longest chain of hours among the steps still to do.
    best, parent = {}, {}
    for i in order:
        prev = [r for r in by_id[i]["requires"] if r in best]
        top = max(prev, key=lambda r: best[r], default=None)
        best[i] = by_id[i]["hours"] + (best[top] if top else 0)
        parent[i] = top
    critical = []
    if best:
        tail = max(order, key=lambda i: best[i])
        while tail:
            critical.append(tail)
            tail = parent[tail]
        critical.reverse()
    for i in critical:
        info[i]["critical"] = True

    done_hours = sum(by_id[i]["hours"] for i in done)
    todo_hours = sum(by_id[i]["hours"] for i in scheduled)
    weeks_needed = math.ceil(todo_hours / hpw) if todo_hours else 0
    total = done_hours + todo_hours

    phases = []
    for p in sorted({n["phase"] for n in nodes}):
        in_phase = [n for n in nodes if n["phase"] == p and n["id"] not in stretch]
        phases.append({
            "phase": p,
            "total_hours": sum(n["hours"] for n in in_phase),
            "done_hours": sum(n["hours"] for n in in_phase if n["id"] in done),
            "complete": all(n["id"] in done for n in in_phase),
        })

    timeline = [[i for i in order if info[i]["start_week"] < w + 1 and info[i]["end_week"] > w] for w in range(4)]

    return {
        "nodes": info,
        "order": order,
        "phases": phases,
        "focus": {"this_week": timeline[0], "timeline": timeline},
        "summary": {
            "hours_per_week": hpw,
            "weeks_budget": weeks_budget,
            "weeks_needed": weeks_needed,
            "remaining_hours": todo_hours,
            "percent_ready": round(100 * done_hours / total) if total else 0,
            "within_budget": weeks_budget is None or weeks_needed <= weeks_budget,
            "stretch_ids": sorted(stretch),
            "critical_path": critical,
        },
    }

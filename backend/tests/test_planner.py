"""Tests for planner.py: the hero feature (ready-by date and live re-plan) is plain code, so it is tested without any AI."""
import planner


def n(id, hours=10, requires=(), phase=1, essential=True):
    return {"id": id, "title": id, "kind": "skill", "phase": phase, "hours": hours,
            "requires": list(requires), "essential": essential, "why": ""}


def chain():
    # a(10h) -> b(20h) -> c(10h);  d(5h) is separate
    return [n("a", 10), n("b", 20, ["a"]), n("c", 10, ["b"], phase=2), n("d", 5)]


def status(result):
    return {i: v["status"] for i, v in result["nodes"].items()}


def test_schedule_follows_prerequisites_and_hours():
    r = planner.plan(chain(), [], hours_per_week=10)
    assert r["order"] == ["a", "b", "d", "c"]            # prerequisites first, then earlier phases first
    assert r["summary"]["remaining_hours"] == 45
    assert r["summary"]["weeks_needed"] == 5            # 45h at 10h a week, rounded up
    assert r["summary"]["percent_ready"] == 0
    first = r["nodes"][r["order"][0]]
    assert first["start_week"] == 0


def test_more_hours_means_fewer_weeks():
    slow = planner.plan(chain(), [], hours_per_week=5)["summary"]["weeks_needed"]
    fast = planner.plan(chain(), [], hours_per_week=20)["summary"]["weeks_needed"]
    assert fast < slow


def test_known_skill_is_done_and_its_prerequisites_are_implied():
    r = planner.plan(chain(), ["c"], hours_per_week=10)
    assert status(r) == {"a": "implied", "b": "implied", "c": "known", "d": "todo"}
    assert r["summary"]["remaining_hours"] == 5
    assert r["summary"]["percent_ready"] == 89           # 40 of 45 hours are behind you


def test_known_ids_that_do_not_exist_are_ignored():
    r = planner.plan(chain(), ["nope"], hours_per_week=10)
    assert r["summary"]["remaining_hours"] == 45


def test_everything_known_means_ready_now():
    r = planner.plan(chain(), ["c", "d"], hours_per_week=10)
    assert r["summary"]["weeks_needed"] == 0
    assert r["summary"]["percent_ready"] == 100
    assert r["order"] == []


def test_budget_turns_optional_nodes_into_stretch():
    nodes = [n("a", 10), n("b", 10, ["a"]), n("x", 40, ["b"], phase=2, essential=False), n("y", 10, ["x"], phase=3, essential=False)]
    r = planner.plan(nodes, [], hours_per_week=10, weeks_budget=3)
    assert status(r) == {"a": "todo", "b": "todo", "x": "stretch", "y": "stretch"}   # y depends on x, so it goes too
    assert r["summary"]["weeks_needed"] == 2
    assert r["summary"]["within_budget"] is True
    assert sorted(r["summary"]["stretch_ids"]) == ["x", "y"]


def test_budget_never_drops_essential_nodes():
    r = planner.plan(chain(), [], hours_per_week=10, weeks_budget=1)
    assert all(s != "stretch" for s in status(r).values())
    assert r["summary"]["within_budget"] is False


def test_no_budget_means_no_stretch():
    nodes = [n("a", 10), n("x", 400, ["a"], essential=False)]
    assert planner.plan(nodes, [], hours_per_week=1)["summary"]["stretch_ids"] == []


def test_critical_path_is_the_longest_chain_of_hours():
    r = planner.plan(chain(), [], hours_per_week=10)
    assert r["summary"]["critical_path"] == ["a", "b", "c"]
    assert [i for i, v in r["nodes"].items() if v["critical"]] == ["a", "b", "c"]


def test_available_means_all_prerequisites_are_done():
    r = planner.plan(chain(), ["a"], hours_per_week=10)
    assert r["nodes"]["b"]["available"] is True
    assert r["nodes"]["c"]["available"] is False
    assert r["nodes"]["d"]["available"] is True


def test_phase_summary_and_completion():
    r = planner.plan(chain(), ["a", "d"], hours_per_week=10)
    phases = {p["phase"]: p for p in r["phases"]}
    assert phases[1]["total_hours"] == 35 and phases[1]["done_hours"] == 15
    assert phases[2]["total_hours"] == 10 and phases[2]["done_hours"] == 0
    assert phases[1]["complete"] is False                 # b is still to do
    r2 = planner.plan(chain(), ["b", "d"], hours_per_week=10)
    assert {p["phase"]: p for p in r2["phases"]}[1]["complete"] is True


def test_focus_this_week_and_four_week_timeline():
    r = planner.plan(chain(), [], hours_per_week=10)
    assert r["focus"]["this_week"], "something must be planned for week 1"
    assert len(r["focus"]["timeline"]) == 4
    flat = [i for week in r["focus"]["timeline"] for i in week]
    assert set(flat) <= set(r["order"])


def test_hours_per_week_is_clamped():
    assert planner.plan(chain(), [], hours_per_week=0)["summary"]["hours_per_week"] == 1
    assert planner.plan(chain(), [], hours_per_week=500)["summary"]["hours_per_week"] == 80


def test_result_is_json_friendly():
    import json
    json.dumps(planner.plan(chain(), ["a"], hours_per_week=7.5, weeks_budget=8))

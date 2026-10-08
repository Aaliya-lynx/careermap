"""Tests for roadmap.py: the AI's JSON is never trusted, so every kind of bad input is checked here."""
import pytest

import roadmap


def node(id, **extra):
    base = {"id": id, "title": id.title(), "kind": "skill", "phase": 1, "hours": 10, "requires": [],
            "essential": True, "why": "because"}
    base.update(extra)
    return base


def raw(nodes, **extra):
    return {"title": "Goal", "summary": "S", "phases": ["Basics", "Build"], "nodes": nodes, **extra}


def four():
    return [node("a"), node("b", requires=["a"]), node("c", requires=["b"]), node("d", requires=["c"])]


def test_valid_roadmap_passes_through():
    out = roadmap.clean_roadmap(raw(four()))
    assert [n["id"] for n in out["nodes"]] == ["a", "b", "c", "d"]
    assert out["nodes"][1]["requires"] == ["a"]
    assert out["phases"][:2] == ["Basics", "Build"]


def test_too_few_nodes_is_an_error():
    with pytest.raises(roadmap.RoadmapError):
        roadmap.clean_roadmap(raw([node("a"), node("b")]))


@pytest.mark.parametrize("bad", [None, "text", [], {}, {"nodes": "x"}, {"nodes": [1, 2, 3, 4, 5]}])
def test_garbage_is_an_error(bad):
    with pytest.raises(roadmap.RoadmapError):
        roadmap.clean_roadmap(bad)


def test_duplicate_ids_and_unknown_links_are_dropped():
    nodes = four() + [node("a", title="Again"), node("e", requires=["ghost", "a", "e"])]
    out = roadmap.clean_roadmap(raw(nodes))
    ids = [n["id"] for n in out["nodes"]]
    assert ids == ["a", "b", "c", "d", "e"]
    assert out["nodes"][-1]["requires"] == ["a"]      # "ghost" and the self-link are gone


def test_cycles_are_broken():
    nodes = [node("a", requires=["c"]), node("b", requires=["a"]), node("c", requires=["b"]), node("d")]
    out = roadmap.clean_roadmap(raw(nodes))
    by_id = {n["id"]: n for n in out["nodes"]}
    seen = set()

    def visit(i, stack):
        assert i not in stack, "cycle left in the graph"
        for r in by_id[i]["requires"]:
            visit(r, stack | {i})
        seen.add(i)

    for i in by_id:
        visit(i, frozenset())


def test_values_are_clamped_and_defaulted():
    n = node("a", kind="wizard", phase=99, hours=-5, essential="yes", title="  x" * 100, why=5)
    out = roadmap.clean_roadmap(raw([n] + four()[1:] + [node("z")]))
    first = out["nodes"][0]
    assert first["kind"] == "skill"
    assert 1 <= first["phase"] <= 6
    assert 1 <= first["hours"] <= 400
    assert first["essential"] is True
    assert len(first["title"]) <= 80
    assert first["why"] == ""


def test_ids_are_made_safe():
    out = roadmap.clean_roadmap(raw([node("Learn React!"), node("b", requires=["Learn React!"]), node("c"), node("d")]))
    assert out["nodes"][0]["id"] == "learn-react"
    assert out["nodes"][1]["requires"] == ["learn-react"]


def test_at_most_24_nodes():
    many = [node(f"n{i}") for i in range(40)]
    assert len(roadmap.clean_roadmap(raw(many))["nodes"]) == 24


def test_essential_flag_spreads_to_prerequisites():
    nodes = [node("a", essential=False), node("b", requires=["a"], essential=True), node("c", essential=False), node("d")]
    out = roadmap.clean_roadmap(raw(nodes))
    by_id = {n["id"]: n for n in out["nodes"]}
    assert by_id["a"]["essential"] is True       # b needs it
    assert by_id["c"]["essential"] is False


def test_phase_names_are_padded():
    out = roadmap.clean_roadmap(raw([node("a", phase=3), node("b"), node("c"), node("d")], phases=["Only"]))
    assert len(out["phases"]) >= 3 and out["phases"][0] == "Only"


def test_clean_known_keeps_only_real_ids():
    nodes = roadmap.clean_roadmap(raw(four()))["nodes"]
    assert roadmap.clean_known(["a", "zzz", "a", 5, None], nodes) == ["a"]
    assert roadmap.clean_known("a", nodes) == []

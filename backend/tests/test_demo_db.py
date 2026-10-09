"""Tests for the SQLite database of saved demo roadmaps (demo_db.py) and the database that ships with the app."""
import sqlite3

import pytest
from fastapi.testclient import TestClient

import demo_db
import llm
import main
import roadmap as roadmap_checks


def small(title="Marine Biologist"):
    nodes = [{"id": f"s{i}", "title": f"Step {i}", "kind": "skill", "phase": 1 + i // 4, "hours": 10, "requires": [f"s{i - 1}"] if i % 4 else [], "essential": True, "why": "w"} for i in range(12)]
    return {"title": title, "summary": "S", "phases": ["A", "B", "C"], "nodes": nodes}


def test_a_saved_job_is_found_however_it_is_typed(tmp_path):
    db = tmp_path / "d.db"
    demo_db.save(db, "Marine Biologist", "non-tech", small(), ["s0"])
    for typed in ("Marine Biologist", "  marine   BIOLOGIST ", "marine biologist"):
        found = demo_db.lookup(db, typed)
        assert found["roadmap"]["title"] == "Marine Biologist" and found["known"] == ["s0"]
    assert demo_db.lookup(db, "Chef") is None


def test_saving_again_replaces_and_the_table_describes_each_row(tmp_path):
    db = tmp_path / "d.db"
    demo_db.save(db, "Marine Biologist", "non-tech", small("Old"), [])
    demo_db.save(db, "marine biologist", "non-tech", small("New"), [])
    assert demo_db.lookup(db, "Marine Biologist")["roadmap"]["title"] == "New"
    assert demo_db.jobs(db) == [("marine biologist", "non-tech", 12)]


def test_a_missing_or_broken_database_is_simply_empty(tmp_path):
    assert demo_db.lookup(tmp_path / "nope.db", "Marine Biologist") is None and demo_db.jobs(tmp_path / "nope.db") == []
    broken = tmp_path / "broken.db"
    broken.write_bytes(b"this is not a database")
    assert demo_db.lookup(broken, "Marine Biologist") is None


def test_serving_never_writes_to_the_database(tmp_path):
    db = tmp_path / "d.db"
    demo_db.save(db, "Marine Biologist", "non-tech", small(), [])
    before = db.read_bytes()
    demo_db.lookup(db, "Marine Biologist")
    demo_db.lookup(db, "Chef")
    assert db.read_bytes() == before
    with pytest.raises(sqlite3.OperationalError):                                   # a read-only connection really cannot write
        sqlite3.connect(f"{db.as_uri()}?mode=ro", uri=True).execute("DELETE FROM roadmaps")


# ---- the database that ships with the app ----

def shipped():
    return demo_db.jobs(main.DEMO_DB)


def test_fifteen_jobs_are_saved_and_both_tech_and_non_tech_are_there():
    rows = shipped()
    assert len(rows) >= 15
    assert {kind for _, kind, _ in rows} == {"tech", "non-tech"}
    assert sum(1 for _, kind, _ in rows if kind == "non-tech") >= 6 and sum(1 for _, kind, _ in rows if kind == "tech") >= 6


def test_every_saved_roadmap_passes_the_same_checks_as_a_live_answer():
    for goal, _, steps in shipped():
        saved = demo_db.lookup(main.DEMO_DB, goal)
        cleaned = roadmap_checks.clean_roadmap(saved["roadmap"])           # raises if it would be refused today
        assert 12 <= len(cleaned["nodes"]) <= 24 and len(cleaned["nodes"]) == steps, goal


def test_every_saved_job_works_with_no_ai_and_no_error(monkeypatch):
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.setattr(llm, "ask_json", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("the AI must not be called")))
    with TestClient(main.app) as client:
        for goal, _, _ in shipped():
            r = client.post("/api/roadmap", json={"goal": goal, "hours_per_week": 8})
            assert r.status_code == 200, goal
            body = r.json()
            assert body["from_cache"] is True and body["plan"]["summary"]["weeks_needed"] > 0, goal


def test_every_saved_job_is_the_backup_when_the_ai_is_down(monkeypatch):
    monkeypatch.delenv("DEMO_MODE", raising=False)
    def down(*a, **k):
        raise llm.Unavailable("down")
    monkeypatch.setattr(llm, "ask_json", down)
    with TestClient(main.app) as client:
        for goal, _, _ in shipped():
            r = client.post("/api/roadmap", json={"goal": goal.upper(), "hours_per_week": 8})
            assert r.status_code == 200 and r.json()["from_cache"] is True, goal

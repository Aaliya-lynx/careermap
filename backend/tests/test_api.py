"""Tests for the HTTP routes. No AI is involved in /api/plan."""
import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture
def client():
    with TestClient(main.app) as c:
        yield c


def nodes():
    return [{"id": "a", "title": "A", "kind": "skill", "phase": 1, "hours": 10, "requires": [], "essential": True, "why": ""},
            {"id": "b", "title": "B", "kind": "cert", "phase": 1, "hours": 20, "requires": ["a"], "essential": True, "why": ""},
            {"id": "c", "title": "C", "kind": "project", "phase": 2, "hours": 10, "requires": ["b"], "essential": False, "why": ""},
            {"id": "d", "title": "D", "kind": "role", "phase": 2, "hours": 5, "requires": ["c"], "essential": False, "why": ""}]


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_plan_returns_a_plan(client):
    body = client.post("/api/plan", json={"nodes": nodes(), "known": ["a"], "hours_per_week": 10}).json()
    assert body["known"] == ["a"]
    assert body["plan"]["summary"]["remaining_hours"] == 35
    assert body["plan"]["nodes"]["a"]["status"] == "known"


def test_plan_ignores_unknown_ids_and_bad_nodes(client):
    body = client.post("/api/plan", json={"nodes": nodes() + [{"junk": 1}], "known": ["zzz"], "hours_per_week": 10}).json()
    assert body["known"] == [] and len(body["nodes"]) == 4


def test_plan_rejects_a_roadmap_that_is_too_small(client):
    r = client.post("/api/plan", json={"nodes": nodes()[:2], "hours_per_week": 10})
    assert r.status_code == 422


def test_plan_applies_the_weeks_budget(client):
    body = client.post("/api/plan", json={"nodes": nodes(), "hours_per_week": 10, "weeks_budget": 3}).json()
    assert body["plan"]["summary"]["stretch_ids"] == ["c", "d"]
    assert body["plan"]["summary"]["within_budget"] is True


def test_plan_validates_the_inputs(client):
    assert client.post("/api/plan", json={"nodes": nodes(), "hours_per_week": -1}).status_code == 422
    assert client.post("/api/plan", json={"nodes": "x"}).status_code == 422

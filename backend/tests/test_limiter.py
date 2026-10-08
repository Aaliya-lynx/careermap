"""Tests for the request limiter that protects the AI budget."""
import pytest
from fastapi.testclient import TestClient

import limiter
import llm
import main


def test_allows_up_to_the_limit_then_blocks():
    now = [0.0]
    lim = limiter.Limiter(per_visitor=3, overall=100, window=60, clock=lambda: now[0])
    assert [lim.allow("a") for _ in range(4)] == [True, True, True, False]
    assert lim.allow("b") is True                    # another visitor is not affected


def test_window_slides():
    now = [0.0]
    lim = limiter.Limiter(per_visitor=2, overall=100, window=60, clock=lambda: now[0])
    assert lim.allow("a") and lim.allow("a") and not lim.allow("a")
    now[0] = 61
    assert lim.allow("a") is True


def test_overall_cap_blocks_everyone():
    lim = limiter.Limiter(per_visitor=10, overall=3, window=60, clock=lambda: 0.0)
    assert [lim.allow(str(i)) for i in range(5)] == [True, True, True, False, False]


def test_blocked_requests_do_not_use_up_the_overall_cap():
    lim = limiter.Limiter(per_visitor=1, overall=3, window=60, clock=lambda: 0.0)
    assert lim.allow("a") and not lim.allow("a") and not lim.allow("a")
    assert lim.allow("b") and lim.allow("c")         # still room: a's blocked tries did not count


def test_memory_does_not_grow_without_end():
    now = [0.0]
    lim = limiter.Limiter(per_visitor=5, overall=10_000, window=10, clock=lambda: now[0])
    for i in range(500):
        now[0] += 11
        lim.allow(f"visitor-{i}")
    assert len(lim.hits) <= 2


def test_client_id_prefers_the_first_forwarded_address():
    assert limiter.client_id("203.0.113.5, 10.0.0.1", "10.0.0.1") == "203.0.113.5"
    assert limiter.client_id(None, "10.0.0.1") == "10.0.0.1"
    assert limiter.client_id("", None) == "unknown"


def test_ai_routes_answer_429_when_a_visitor_is_over_the_limit(monkeypatch):
    monkeypatch.setattr(main, "ai_limiter", limiter.Limiter(per_visitor=2, overall=100, window=60))
    monkeypatch.setattr(llm, "ask_json", lambda s, u: pytest.fail("the AI must not be called when blocked"))
    body = {"goal": "Data Analyst", "hours_per_week": 5}
    with TestClient(main.app) as client:
        monkeypatch.setattr(llm, "ask_json", lambda s, u: {})     # unusable answer: 502, but it counts as a try
        assert client.post("/api/roadmap", json=body).status_code == 502
        assert client.post("/api/roadmap", json=body).status_code == 502
        monkeypatch.setattr(llm, "ask_json", lambda s, u: pytest.fail("blocked"))
        r = client.post("/api/roadmap", json=body)
        assert r.status_code == 429 and "wait" in r.json()["detail"].lower()
        assert client.post("/api/node-advice", json={"goal": "Data Analyst", "node": {"title": "SQL"}}).status_code == 429


def test_plan_route_is_not_limited(monkeypatch):
    monkeypatch.setattr(main, "ai_limiter", limiter.Limiter(per_visitor=1, overall=1, window=60))
    nodes = [{"id": c, "title": c, "kind": "skill", "phase": 1, "hours": 5, "requires": [], "essential": True, "why": ""} for c in "abcd"]
    with TestClient(main.app) as client:
        for _ in range(5):
            assert client.post("/api/plan", json={"nodes": nodes, "hours_per_week": 5}).status_code == 200

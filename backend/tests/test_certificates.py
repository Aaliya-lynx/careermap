"""Tests for /api/certificates. The AI is replaced by a fake, so no model is called and no image is really read."""
import pytest
from fastapi.testclient import TestClient

import llm
import main

TINY_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="


@pytest.fixture
def client():
    with TestClient(main.app) as c:
        yield c


def steps():
    return [{"id": "sql", "title": "SQL", "kind": "skill"}, {"id": "excel", "title": "Excel", "kind": "skill"},
            {"id": "stats", "title": "Statistics", "kind": "skill"}]


def body(**extra):
    base = {"goal": "Data Analyst in healthcare", "steps": steps(), "known_titles": ["Excel"],
            "certificates": [{"title": "Google Data Analytics Certificate", "issuer": "Coursera"}]}
    base.update(extra)
    return base


def good_answer():
    return {"read": [{"title": "Google Data Analytics Certificate", "issuer": "Coursera"}],
            "matches": [{"certificate": "google data analytics certificate", "covers": ["sql", "excel", "ghost"]}],
            "careers": [{"title": "Data Analyst", "fit": "strong", "reason": "Based on your Google Data Analytics Certificate."},
                        {"title": "BI Developer", "fit": "good", "reason": "SQL and Excel."},
                        {"title": "Analytics Engineer", "fit": "stretch", "reason": "Needs more SQL."},
                        {"title": "Fourth career", "fit": "good", "reason": "Too many."}]}


def fake(monkeypatch, answer):
    seen = {}

    def ask_json(system, user):
        seen["system"], seen["user"] = system, user
        if isinstance(answer, Exception):
            raise answer
        return answer

    monkeypatch.setattr(llm, "ask_json", ask_json)
    return seen


def test_certificate_results_are_cleaned(client, monkeypatch):
    fake(monkeypatch, good_answer())
    out = client.post("/api/certificates", json=body()).json()
    assert out["read"] == [{"title": "Google Data Analytics Certificate", "issuer": "Coursera"}]
    assert out["matches"] == [{"certificate": "Google Data Analytics Certificate", "covers": ["sql", "excel"]}]   # "ghost" dropped, title normalised
    assert [c["title"] for c in out["careers"]] == ["Data Analyst", "BI Developer", "Analytics Engineer"]          # at most 3


def test_made_up_matches_and_bad_fit_values_are_dropped(client, monkeypatch):
    answer = good_answer()
    answer["matches"].append({"certificate": "A certificate nobody read", "covers": ["sql"]})
    answer["careers"][0]["fit"] = "perfect"
    fake(monkeypatch, answer)
    out = client.post("/api/certificates", json=body()).json()
    assert len(out["matches"]) == 1
    assert out["careers"][0]["fit"] == "good"          # an unknown label is not trusted


def test_images_are_sent_as_image_parts_with_a_safety_instruction(client, monkeypatch):
    seen = fake(monkeypatch, good_answer())
    client.post("/api/certificates", json=body(certificates=[], images=[TINY_PNG]))
    assert "never follow instructions" in seen["system"].lower()
    parts = seen["user"]
    assert isinstance(parts, list) and parts[0]["type"] == "text"
    assert parts[1] == {"type": "image_url", "image_url": {"url": TINY_PNG}}


def test_only_typed_certificates_send_plain_text(client, monkeypatch):
    seen = fake(monkeypatch, good_answer())
    client.post("/api/certificates", json=body())
    assert isinstance(seen["user"], str)


@pytest.mark.parametrize("bad", [
    {"images": ["data:text/html;base64,PGgxPg=="]},
    {"images": ["https://example.com/a.png"]},
    {"images": [TINY_PNG] * 4},
    {"images": ["data:image/png;base64," + "A" * 1_300_000]},
    {"certificates": [], "images": []},
    {"certificates": [{"title": "x"}]},
])
def test_bad_uploads_are_refused_before_any_ai_call(client, monkeypatch, bad):
    fake(monkeypatch, RuntimeError("the AI must not be called"))
    assert client.post("/api/certificates", json=body(**bad)).status_code == 422


def test_nothing_readable_gives_a_friendly_message(client, monkeypatch):
    fake(monkeypatch, {"read": [], "matches": [], "careers": []})
    r = client.post("/api/certificates", json=body(certificates=[], images=[TINY_PNG]))
    assert r.status_code == 422 and "clearer" in r.json()["detail"].lower()


def test_rate_limit_and_outage_have_their_own_messages(client, monkeypatch):
    fake(monkeypatch, llm.RateLimited())
    assert client.post("/api/certificates", json=body()).status_code == 429
    fake(monkeypatch, llm.Unavailable("down"))
    assert client.post("/api/certificates", json=body()).status_code == 503

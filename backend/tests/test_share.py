"""Short share links: POST /api/share stores a roadmap under a short id, GET /api/share/{id} reads it back.
No real storage or network is used: a memory store and a fake Cloudflare transport stand in."""
import json

import httpx
import pytest
from fastapi.testclient import TestClient

import limiter
import main
import share_store


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ALLOW_MEMORY_SHARES", "true")      # tests keep shares in memory
    monkeypatch.setattr(main, "share_store", share_store.MemoryStore())
    monkeypatch.setattr(main, "share_limiter", limiter.Limiter(per_visitor=1000, overall=1000, window=60))
    with TestClient(main.app) as c:
        yield c


def node(id, kind="skill", phase=1, hours=10, requires=(), essential=True):
    return {"id": id, "title": id.title(), "kind": kind, "phase": phase, "hours": hours, "requires": list(requires), "essential": essential, "why": f"why {id}"}


def body(**extra):
    base = {"roadmap": {"title": "Data Analyst", "summary": "S", "phases": ["Basics", "Build"],
                        "nodes": [node("sql"), node("excel"), node("dash", "project", 2, 20, ["sql", "excel"]), node("job", "role", 2, 5, ["dash"], False)],
                        "where_you_are": {"have": ["Excel"], "strengthen": ["SQL"], "next": ["Build a dashboard"]}},
            "known": ["sql", "ghost"], "hours": 10, "budget": 20}
    base.update(extra)
    return base


def test_a_shared_roadmap_comes_back_by_its_short_id(client):
    made = client.post("/api/share", json=body())
    assert made.status_code == 200
    short = made.json()["id"]
    assert 6 <= len(short) <= 10 and short.isalnum()
    back = client.get(f"/api/share/{short}").json()
    assert back["roadmap"]["title"] == "Data Analyst" and len(back["roadmap"]["nodes"]) == 4
    assert back["known"] == ["sql"]                                   # "ghost" is not a real step: dropped
    assert back["hours"] == 10 and back["budget"] == 20
    assert back["roadmap"]["where_you_are"]["have"] == ["Excel"]      # the profile card travels with it


def test_without_lasting_storage_no_short_links_are_handed_out(client, monkeypatch):
    monkeypatch.delenv("ALLOW_MEMORY_SHARES")
    r = client.post("/api/share", json=body())
    assert r.status_code == 503 and len(main.share_store.items) == 0       # the app then copies the long link instead


def test_lasting_storage_is_enough_on_its_own(client, monkeypatch):
    monkeypatch.delenv("ALLOW_MEMORY_SHARES")
    kept = share_store.MemoryStore()
    kept.persistent = True
    monkeypatch.setattr(main, "share_store", kept)
    assert client.post("/api/share", json=body()).status_code == 200


def test_every_share_gets_its_own_id(client):
    ids = {client.post("/api/share", json=body()).json()["id"] for _ in range(20)}
    assert len(ids) == 20


def test_an_unknown_or_malformed_id_is_a_friendly_error(client):
    assert client.get("/api/share/abcd2345").status_code == 404
    assert "expired" in client.get("/api/share/abcd2345").json()["detail"].lower()
    assert client.get("/api/share/..%2Fsecret").status_code in (404, 422)
    assert client.get("/api/share/a").status_code == 404                # too short to be one of ours
    assert client.get("/api/share/" + "a" * 40).status_code == 404


@pytest.mark.parametrize("bad", [{"roadmap": {"nodes": "no"}}, {"roadmap": {}}, {"hours": 0}, {"hours": 500}, {"budget": 9999},
                                 {"known": ["x"] * 100}, {"roadmap": {"title": "T", "nodes": [{"id": "a"}]}}])
def test_a_bad_roadmap_is_refused_and_nothing_is_stored(client, bad):
    r = client.post("/api/share", json=body(**bad))
    assert r.status_code == 422
    assert len(main.share_store.items) == 0


def test_too_big_a_payload_is_refused(client):
    huge = body()
    huge["roadmap"]["nodes"] = [node(f"n{i}") for i in range(60)]
    assert client.post("/api/share", json=huge).status_code == 422


def test_sharing_is_rate_limited(client, monkeypatch):
    monkeypatch.setattr(main, "share_limiter", limiter.Limiter(per_visitor=2, overall=100, window=60))
    assert client.post("/api/share", json=body()).status_code == 200
    assert client.post("/api/share", json=body()).status_code == 200
    r = client.post("/api/share", json=body())
    assert r.status_code == 429 and "wait" in r.json()["detail"].lower()


def test_a_storage_outage_is_a_503_the_app_can_fall_back_from(client, monkeypatch):
    class Down:
        def put(self, *a, **k): raise share_store.StoreError("down")
        def get(self, *a, **k): raise share_store.StoreError("down")
    monkeypatch.setattr(main, "share_store", Down())
    assert client.post("/api/share", json=body()).status_code == 503
    assert client.get("/api/share/abcd2345").status_code == 503


# ---- the stores themselves ----

def test_memory_store_forgets_after_its_time_and_caps_its_size():
    now = [1000.0]
    store = share_store.MemoryStore(ttl=100, limit=3, clock=lambda: now[0])
    store.put("a", "1")
    assert store.get("a") == "1"
    now[0] += 101
    assert store.get("a") is None
    for key in "bcde":
        store.put(key, key)
    assert store.get("b") is None and store.get("e") == "e"            # the oldest one made room


def test_cloudflare_store_talks_to_the_kv_api_with_the_token_and_a_ttl():
    seen = []

    def handler(request: httpx.Request):
        seen.append((request.method, str(request.url), request.headers.get("authorization"), request.content))
        if request.method == "GET":
            return httpx.Response(200, text="stored-value") if request.url.path.endswith("/abc12345") else httpx.Response(404, json={"success": False})
        return httpx.Response(200, json={"success": True})

    kv = share_store.CloudflareKV("acct", "ns", "tok", client=httpx.Client(transport=httpx.MockTransport(handler)))
    kv.put("abc12345", "payload")
    assert kv.get("abc12345") == "stored-value"
    assert kv.get("missing1") is None
    put = seen[0]
    assert put[0] == "PUT" and "/accounts/acct/storage/kv/namespaces/ns/values/abc12345" in put[1]
    assert "expiration_ttl=" in put[1] and put[2] == "Bearer tok" and put[3] == b"payload"


def test_cloudflare_errors_become_store_errors():
    kv = share_store.CloudflareKV("a", "n", "t", client=httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500, json={}))))
    with pytest.raises(share_store.StoreError):
        kv.put("abc12345", "x")
    with pytest.raises(share_store.StoreError):
        kv.get("abc12345")


def test_the_store_is_chosen_from_the_environment():
    assert isinstance(share_store.from_env({}), share_store.MemoryStore)
    both = {"CF_ACCOUNT_ID": "a", "CF_KV_NAMESPACE_ID": "n", "CF_API_TOKEN": "t"}
    assert isinstance(share_store.from_env(both), share_store.CloudflareKV)
    assert isinstance(share_store.from_env({"CF_ACCOUNT_ID": "a"}), share_store.MemoryStore)   # incomplete settings: stay in memory

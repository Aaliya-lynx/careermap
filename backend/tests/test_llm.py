"""Tests for the model chain. A fake client stands in for every provider, so no AI is called."""
from types import SimpleNamespace

import httpx
import pytest
from openai import APIConnectionError, RateLimitError

import llm


def reply(text):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text))])


def rate_limit_error():
    request = httpx.Request("POST", "http://example.test")
    return RateLimitError("slow down", response=httpx.Response(429, request=request), body=None)


class FakeClient:
    """Answers with the next item of `script`: a string (the reply) or an exception (raised)."""

    def __init__(self, script):
        self.script, self.calls = list(script), []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

    def create(self, **kwargs):
        self.calls.append(kwargs)
        step = self.script.pop(0)
        if isinstance(step, Exception):
            raise step
        return reply(step)


@pytest.fixture
def use_client(monkeypatch):
    def install(client):
        monkeypatch.setattr(llm, "_client_for", lambda provider: client)
        return client
    return install


def test_chain_is_read_in_order_without_duplicates(monkeypatch):
    monkeypatch.setenv("LLM_CHAIN", "azure=gpt-5-mini, groq=openai/gpt-oss-20b ,azure=gpt-5-mini,broken")
    assert llm.chain() == [("azure", "gpt-5-mini"), ("groq", "openai/gpt-oss-20b")]


def test_no_chain_means_unavailable():
    with pytest.raises(llm.Unavailable):
        llm.ask_json("s", "u")


def test_first_model_answers(monkeypatch, use_client):
    monkeypatch.setenv("LLM_CHAIN", "a=m1,b=m2")
    client = use_client(FakeClient(['{"x": 1}']))
    assert llm.ask_json("s", "u") == {"x": 1}
    assert len(client.calls) == 1 and client.calls[0]["model"] == "m1"


def test_next_model_is_tried_after_a_rate_limit(monkeypatch, use_client):
    monkeypatch.setenv("LLM_CHAIN", "a=m1,b=m2")
    client = use_client(FakeClient([rate_limit_error(), '{"x": 2}']))
    assert llm.ask_json("s", "u") == {"x": 2}
    assert [c["model"] for c in client.calls] == ["m1", "m2"]


def test_all_rate_limited_raises_rate_limited(monkeypatch, use_client):
    monkeypatch.setenv("LLM_CHAIN", "a=m1,b=m2")
    use_client(FakeClient([rate_limit_error(), rate_limit_error()]))
    with pytest.raises(llm.RateLimited):
        llm.ask_json("s", "u")


def test_other_errors_and_bad_json_fall_through_to_unavailable(monkeypatch, use_client):
    monkeypatch.setenv("LLM_CHAIN", "a=m1,b=m2,c=m3")
    request = httpx.Request("POST", "http://example.test")
    use_client(FakeClient([APIConnectionError(request=request), "not json at all", "[1, 2]"]))
    with pytest.raises(llm.Unavailable):
        llm.ask_json("s", "u")


def test_bad_json_then_good_json(monkeypatch, use_client):
    monkeypatch.setenv("LLM_CHAIN", "a=m1,b=m2")
    use_client(FakeClient(["oops", '{"ok": true}']))
    assert llm.ask_json("s", "u") == {"ok": True}


def test_provider_without_a_key_is_skipped(monkeypatch):
    monkeypatch.setenv("LLM_CHAIN", "nokey=m1")
    monkeypatch.delenv("NOKEY_API_KEY", raising=False)
    with pytest.raises(llm.Unavailable):
        llm.ask_json("s", "u")


def test_reasoning_effort_is_sent_only_to_models_that_take_it(monkeypatch, use_client):
    monkeypatch.setenv("LLM_CHAIN", "a=gpt-5-mini,b=gemini-flash")
    monkeypatch.setenv("LLM_REASONING_EFFORT", "low")
    client = use_client(FakeClient([rate_limit_error(), '{"x": 1}']))
    llm.ask_json("s", "u")
    assert client.calls[0].get("reasoning_effort") == "low"
    assert "reasoning_effort" not in client.calls[1]


def test_parse_json_handles_fences_and_noise():
    assert llm.parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert llm.parse_json('Sure! {"a": {"b": 2}} done') == {"a": {"b": 2}}
    assert llm.parse_json("") == {} and llm.parse_json(None) == {} and llm.parse_json("{broken") == {}


def test_gives_up_when_the_models_are_too_slow(monkeypatch, use_client):
    monkeypatch.setenv("LLM_CHAIN", "a=m1,b=m2,c=m3")
    clock = iter([0, 1, 100, 100, 100, 100])             # the first model "takes" 99 seconds and fails
    monkeypatch.setattr(llm.time, "monotonic", lambda: next(clock))
    client = use_client(FakeClient([rate_limit_error(), '{"x": 1}', '{"x": 2}']))
    with pytest.raises(llm.RateLimited):
        llm.ask_json("s", "u")
    assert len(client.calls) == 1                         # the other models were not tried

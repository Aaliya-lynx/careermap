"""Asks AI models for JSON, trying several models in order.

Why a chain: every free tier has its own daily limit. If one model is rate limited, broken or returns
unusable JSON, the next one answers. Providers are OpenAI-compatible, so only the settings differ.

.env settings:
    LLM_CHAIN=azure=gpt-5-mini,gemini=gemini-2.5-flash,groq=openai/gpt-oss-20b
    <PROVIDER>_BASE_URL=...   <PROVIDER>_API_KEY=...        (one pair per provider named in the chain)
    LLM_REASONING_EFFORT=low  (optional: sent to gpt-oss and gpt-5 models only)

Nothing the user typed and no key is ever logged.
"""
import json
import logging
import os
import re
import time
from pathlib import Path

from dotenv import load_dotenv
from openai import APIError, OpenAI, RateLimitError

load_dotenv(Path(__file__).resolve().parent / ".env")
log = logging.getLogger("uvicorn.error")


class RateLimited(Exception):
    """Every model that could be tried said 'too many requests'."""


class Unavailable(Exception):
    """No model could give a usable answer."""


_clients = {}
TOTAL_SECONDS = 80      # stop trying further models after this long, so a request never hangs for minutes


def chain():
    """[(provider, model), ...] from LLM_CHAIN, in the order they are tried."""
    entries = []
    for part in os.getenv("LLM_CHAIN", "").split(","):
        provider, _, model = part.strip().partition("=")
        if provider and model and (provider.lower(), model) not in entries:
            entries.append((provider.lower(), model))
    return entries


def _client_for(provider):
    if provider not in _clients:
        key = os.getenv(f"{provider.upper()}_API_KEY")
        if not key:
            raise Unavailable(f"no key for {provider}")
        _clients[provider] = OpenAI(base_url=os.getenv(f"{provider.upper()}_BASE_URL") or None,
                                    api_key=key, max_retries=0, timeout=50)
    return _clients[provider]


def parse_json(text):
    """The first JSON object in the text (code fences are fine), or {} if there is none."""
    text = re.sub(r"```(?:json)?", "", text or "").strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return {}
    try:
        data = json.loads(text[start:end + 1])
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def ask_json(system, user):
    """Ask for a JSON object. The result is NOT trusted: the caller must validate it."""
    models = chain()
    if not models:
        raise Unavailable("LLM_CHAIN is not set")
    effort = os.getenv("LLM_REASONING_EFFORT")
    limited = False
    started = time.monotonic()
    for provider, model in models:
        if time.monotonic() - started > TOTAL_SECONDS:
            log.warning("giving up: the models were too slow")
            break
        extra = {"reasoning_effort": effort} if effort and ("gpt-oss" in model or "gpt-5" in model) else {}
        try:
            reply = _client_for(provider).chat.completions.create(
                model=model, response_format={"type": "json_object"}, **extra,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}])
        except Unavailable:
            continue
        except RateLimitError:
            limited = True
            log.warning("rate limited: %s", model)
            continue
        except APIError as error:
            log.warning("model failed: %s (%s, status %s)", model, type(error).__name__,
                        getattr(error, "status_code", None))
            continue
        data = parse_json(reply.choices[0].message.content)
        if data:
            log.info("answered by %s in %.1fs", model, time.monotonic() - started)
            return data
        log.warning("unusable JSON from %s", model)
    raise RateLimited() if limited else Unavailable("no model answered")

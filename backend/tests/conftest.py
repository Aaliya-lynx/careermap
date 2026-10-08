import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture(autouse=True)
def no_real_ai(monkeypatch):
    """Tests must never reach a real model, whatever is in backend/.env."""
    monkeypatch.delenv("LLM_CHAIN", raising=False)
    monkeypatch.delenv("LLM_REASONING_EFFORT", raising=False)
    monkeypatch.delenv("DEMO_MODE", raising=False)


@pytest.fixture(autouse=True)
def fresh_limiter(monkeypatch):
    """Each test starts with its own roomy limiter, so tests do not use up each other's allowance."""
    import limiter
    import main
    monkeypatch.setattr(main, "ai_limiter", limiter.Limiter(per_visitor=1000, overall=1000, window=60))

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

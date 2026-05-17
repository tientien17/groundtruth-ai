"""Tests for setup API endpoints (status, provider config, Ollama readiness).

Design:
  - Uses FastAPI TestClient with isolated tmp_path storage to avoid polluting
    the real ~/.groundtruth/local/provider_config.json.
  - Controlled RED test: ``test_empty_base_url_rejected`` asserts that an empty
    ``base_url`` returns 422.  The current implementation accepts empty strings
    (only enforces ``max_length=2048`` on the Pydantic field), so this test
    fails — confirming a validation gap that should be closed.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from config import Settings
from main import create_app


# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def setup_client(tmp_path: Path) -> TestClient:
    """Return a TestClient with an isolated temp storage path."""
    settings = Settings(storage_path=tmp_path)
    app = create_app(settings)
    return TestClient(app)


# ── GET /setup/status ────────────────────────────────────────────────────────


class TestSetupStatus:
    """Contract and schema tests for ``GET /setup/status``."""

    def test_status_schema_when_unconfigured(self, setup_client: TestClient) -> None:
        """Status returns full schema when no cloud config and no Ollama."""
        resp = setup_client.get("/setup/status")
        assert resp.status_code == 200
        body = resp.json()

        # Top-level contract fields (must match SetupStatus TS type)
        assert "required" in body, "Missing top-level 'required' field"
        assert "cloud_provider" in body, "Missing top-level 'cloud_provider' field"
        assert "ollama" in body, "Missing top-level 'ollama' field"
        assert "models" in body, "Missing top-level 'models' field"

        # Cloud provider is NOT configured
        cp = body["cloud_provider"]
        assert cp["configured"] is False

        # Ollama is unavailable in test environment
        ollama = body["ollama"]
        assert ollama["running"] is False
        assert ollama["error"] is not None
        assert isinstance(ollama["error"], str)
        assert len(ollama["error"]) > 0  # actionable

        # Overall: setup IS required
        assert body["required"] is True

        # Required model entries
        assert "llama3.2" in body["models"]
        assert "nomic-embed-text" in body["models"]
        for model_name, info in body["models"].items():
            assert "installed" in info, f"Model '{model_name}' missing 'installed'"
            assert info["installed"] is False  # Ollama is down

    def test_status_ollama_error_actionable(self, setup_client: TestClient) -> None:
        """ollama.error is a descriptive non-empty string when unavailable."""
        resp = setup_client.get("/setup/status")
        body = resp.json()
        error = body["ollama"].get("error")
        assert error is not None
        assert isinstance(error, str)
        assert len(error) > 0

    def test_status_reads_written_provider(self, setup_client: TestClient) -> None:
        """After saving a cloud provider, /setup/status reflects it."""
        # First, save a cloud provider config
        save_resp = setup_client.post(
            "/setup/provider",
            json={
                "provider": "openai_compatible",
                "base_url": "https://api.openai.com/v1",
                "chat_model": "gpt-4o",
                "embedding_model": "text-embedding-3-small",
            },
        )
        assert save_resp.status_code == 200

        # Now check status
        resp = setup_client.get("/setup/status")
        body = resp.json()
        assert body["cloud_provider"]["configured"] is True
        assert body["cloud_provider"]["provider"] == "openai_compatible"
        assert body["cloud_provider"]["base_url"] == "https://api.openai.com/v1"
        assert body["required"] is False  # cloud is configured → no setup needed


# ── POST /setup/provider ─────────────────────────────────────────────────────


class TestSetProvider:
    """Validation and persistence tests for ``POST /setup/provider``."""

    def test_valid_openai_compatible(self, setup_client: TestClient) -> None:
        """Valid openai_compatible provider returns 200 with saved=True."""
        payload = {
            "provider": "openai_compatible",
            "base_url": "http://localhost:8000/v1",
            "chat_model": "gpt-4o",
            "embedding_model": "text-embedding-3-small",
        }
        resp = setup_client.post("/setup/provider", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["saved"] is True
        assert body["provider"] == "openai_compatible"

    def test_valid_vllm(self, setup_client: TestClient) -> None:
        """vLLM provider is accepted."""
        payload = {"provider": "vllm", "base_url": "http://localhost:8000"}
        resp = setup_client.post("/setup/provider", json=payload)
        assert resp.status_code == 200
        assert resp.json()["saved"] is True

    def test_invalid_provider_rejected(self, setup_client: TestClient) -> None:
        """Unknown provider name returns 422 — not 500."""
        payload = {"provider": "aws_bedrock", "base_url": "http://localhost:8000"}
        resp = setup_client.post("/setup/provider", json=payload)
        assert resp.status_code == 422

    def test_missing_base_url_rejected(self, setup_client: TestClient) -> None:
        """Missing required base_url returns 422."""
        payload = {"provider": "openai_compatible"}
        resp = setup_client.post("/setup/provider", json=payload)
        assert resp.status_code == 422

    def test_extra_fields_ignored(self, setup_client: TestClient) -> None:
        """Unknown extra fields are silently dropped, not causing 500."""
        payload = {
            "provider": "openai_compatible",
            "base_url": "http://localhost:8000",
            "nonsense_field": "should_be_ignored",
        }
        resp = setup_client.post("/setup/provider", json=payload)
        assert resp.status_code == 200
        assert resp.json()["saved"] is True

    def test_empty_base_url_rejected(self, setup_client: TestClient) -> None:
        """Empty base_url returns 422 (min_length=1 enforced)."""
        payload = {
            "provider": "openai_compatible",
            "base_url": "",
        }
        resp = setup_client.post("/setup/provider", json=payload)
        assert resp.status_code == 422

    def test_invalid_url_format_returns_structured_error(self, setup_client: TestClient) -> None:
        """URL without http(s) prefix returns structured error with category, not 500."""
        payload = {
            "provider": "openai_compatible",
            "base_url": "ftp://bad-scheme.com/v1",
            "chat_model": "gpt-4o",
            "embedding_model": "text-embedding-3-small",
        }
        resp = setup_client.post("/setup/provider", json=payload)
        assert resp.status_code == 200  # validation returns 200 with error field
        body = resp.json()
        assert body["saved"] is False
        assert body["error_category"] == "provider_url_invalid"
        assert "http" in body["error"].lower() or "https" in body["error"].lower()

    def test_invalid_url_format_via_cloud_provider_alias(self, setup_client: TestClient) -> None:
        """/setup/cloud-provider alias returns same structured error."""
        payload = {
            "provider": "openai_compatible",
            "base_url": "not-a-url",
        }
        resp = setup_client.post("/setup/cloud-provider", json=payload)
        assert resp.status_code == 200
        body = resp.json()
        assert body["saved"] is False
        assert "error_category" in body

    def test_status_includes_error_category_when_ollama_down(self, setup_client: TestClient) -> None:
        """When Ollama is unreachable, status includes both error and error_category."""
        resp = setup_client.get("/setup/status")
        body = resp.json()
        ollama = body["ollama"]
        assert ollama["running"] is False
        assert ollama["error"] is not None
        assert ollama["error_category"] is not None
        assert isinstance(ollama["error_category"], str)

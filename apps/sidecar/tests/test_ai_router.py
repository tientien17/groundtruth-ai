"""Tests for AI router, settings CRUD, and audit trail."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from database import get_session, init_db
from models import AIAuditLog, AISettings, Base, Project


# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def tmp_db(tmp_path: Path) -> Path:
    return tmp_path / "project.sqlite"


@pytest.fixture
def db_path(tmp_db: Path) -> Path:
    init_db(tmp_db)
    return tmp_db


@pytest.fixture
def project_id(db_path: Path) -> UUID:
    pid = uuid4()
    with get_session(db_path) as session:
        session.add(
            Project(
                id=pid,
                name="Test Project",
                path=str(db_path.parent),
            )
        )
    return pid


@pytest.fixture
def client() -> TestClient:
    from main import create_app
    from config import Settings

    settings = Settings()
    app = create_app(settings)
    return TestClient(app)


# ── Model / Table Tests ─────────────────────────────────────────────────────


class TestAIModels:
    def test_ai_settings_table_created(self, db_path: Path):
        import sqlite3

        conn = sqlite3.connect(db_path)
        cur = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='ai_settings'"
        )
        assert cur.fetchone() is not None
        conn.close()

    def test_ai_audit_log_table_created(self, db_path: Path):
        import sqlite3

        conn = sqlite3.connect(db_path)
        cur = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='ai_audit_log'"
        )
        assert cur.fetchone() is not None
        conn.close()

    def test_ai_settings_crud(self, db_path: Path, project_id: UUID):
        settings_id = uuid4()
        with get_session(db_path) as session:
            row = AISettings(
                id=settings_id,
                project_id=project_id,
                provider="ollama",
                base_url="http://127.0.0.1:11434",
                chat_model="llama3.2",
                embedding_model="nomic-embed-text",
            )
            session.add(row)

        with get_session(db_path) as session:
            fetched = session.get(AISettings, settings_id)
            assert fetched is not None
            assert fetched.provider == "ollama"
            assert fetched.chat_model == "llama3.2"

    def test_ai_audit_log_crud(self, db_path: Path, project_id: UUID):
        log_id = uuid4()
        with get_session(db_path) as session:
            entry = AIAuditLog(
                id=log_id,
                project_id=project_id,
                provider="ollama",
                model="llama3.2",
                prompt="Hello",
                response="Hi there",
                tokens_prompt=5,
                tokens_completion=3,
                duration_ms=150,
                status="success",
            )
            session.add(entry)

        with get_session(db_path) as session:
            fetched = session.get(AIAuditLog, log_id)
            assert fetched is not None
            assert fetched.prompt == "Hello"
            assert fetched.response == "Hi there"
            assert fetched.tokens_prompt == 5
            assert fetched.duration_ms == 150


# ── AI Router Unit Tests ─────────────────────────────────────────────────────


class TestAIRouter:
    def test_get_provider_config_defaults(self, db_path: Path, project_id: UUID):
        from services.ai_router import get_provider_config

        config = get_provider_config(project_id, db_path)
        assert config.provider == "ollama"
        assert config.chat_model == "llama3.2"
        assert "11434" in config.base_url

    def test_get_provider_config_from_db(self, db_path: Path, project_id: UUID):
        from services.ai_router import get_provider_config

        with get_session(db_path) as session:
            session.add(
                AISettings(
                    id=uuid4(),
                    project_id=project_id,
                    provider="vllm",
                    base_url="http://127.0.0.1:8000",
                    chat_model="mistral-7b",
                    embedding_model="bge-small",
                )
            )

        config = get_provider_config(project_id, db_path)
        assert config.provider == "vllm"
        assert config.chat_model == "mistral-7b"
        assert config.base_url == "http://127.0.0.1:8000"

    def test_mask_sensitive(self):
        from services.ai_router import _mask_sensitive

        data = {
            "model": "llama3.2",
            "api_key": "sk-secret-123",
            "nested": {"password": "hunter2", "safe": "ok"},
        }
        masked = _mask_sensitive(data)
        assert masked["model"] == "llama3.2"
        assert masked["api_key"] == "***MASKED***"
        assert masked["nested"]["password"] == "***MASKED***"
        assert masked["nested"]["safe"] == "ok"

    def test_ai_generate_writes_audit_log(self, db_path: Path, project_id: UUID):
        """ai_generate persists audit log after mocked Ollama call."""
        from services.ai_router import ai_generate

        mock_response = AsyncMock(
            status_code=200,
            json=lambda: {
                "response": "mocked answer",
                "prompt_eval_count": 10,
                "eval_count": 8,
            },
        )
        mock_response.raise_for_status = lambda: None

        with patch("services.ai_router.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            result = asyncio.get_event_loop().run_until_complete(
                ai_generate(
                    project_id=project_id,
                    db_path=db_path,
                    prompt="What is concrete?",
                )
            )

        assert result.text == "mocked answer"
        assert result.provider == "ollama"
        assert result.tokens_prompt == 10
        assert result.tokens_completion == 8

        # Verify audit log persisted
        with get_session(db_path) as session:
            logs = (
                session.query(AIAuditLog)
                .filter(AIAuditLog.project_id == project_id)
                .all()
            )
            assert len(logs) == 1
            assert logs[0].prompt == "What is concrete?"
            assert logs[0].response == "mocked answer"
            assert logs[0].status == "success"

    def test_ai_generate_error_logged(self, db_path: Path, project_id: UUID):
        """ai_generate logs errors and raises RuntimeError."""
        from services.ai_router import ai_generate

        with patch("services.ai_router.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(
                side_effect=Exception("Connection refused")
            )
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            with pytest.raises(RuntimeError, match="AI provider error"):
                asyncio.get_event_loop().run_until_complete(
                    ai_generate(
                        project_id=project_id,
                        db_path=db_path,
                        prompt="test prompt",
                    )
                )

        # Error should still be logged
        with get_session(db_path) as session:
            logs = (
                session.query(AIAuditLog)
                .filter(AIAuditLog.project_id == project_id)
                .all()
            )
            assert len(logs) == 1
            assert logs[0].status == "error"
            assert "Connection refused" in logs[0].error_message


# ── API Endpoint Tests ───────────────────────────────────────────────────────


class TestAIConfigEndpoints:
    def test_get_settings_default(
        self, client: TestClient, db_path: Path, project_id: UUID
    ):
        resp = client.get(
            f"/projects/{project_id}/ai/settings",
            params={"project_path": str(db_path.parent)},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["provider"] == "ollama"
        assert data["is_default"] is True

    def test_upsert_settings(
        self, client: TestClient, db_path: Path, project_id: UUID
    ):
        resp = client.put(
            f"/projects/{project_id}/ai/settings",
            params={"project_path": str(db_path.parent)},
            json={
                "provider": "vllm",
                "base_url": "http://127.0.0.1:8000",
                "chat_model": "mistral-7b",
                "embedding_model": "bge-small",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["provider"] == "vllm"
        assert data["chat_model"] == "mistral-7b"

    def test_upsert_then_get(
        self, client: TestClient, db_path: Path, project_id: UUID
    ):
        client.put(
            f"/projects/{project_id}/ai/settings",
            params={"project_path": str(db_path.parent)},
            json={"provider": "ollama", "chat_model": "phi3"},
        )
        resp = client.get(
            f"/projects/{project_id}/ai/settings",
            params={"project_path": str(db_path.parent)},
        )
        assert resp.status_code == 200
        assert resp.json()["chat_model"] == "phi3"

    def test_delete_settings(
        self, client: TestClient, db_path: Path, project_id: UUID
    ):
        # Create first
        client.put(
            f"/projects/{project_id}/ai/settings",
            params={"project_path": str(db_path.parent)},
            json={"provider": "ollama"},
        )
        # Delete
        resp = client.delete(
            f"/projects/{project_id}/ai/settings",
            params={"project_path": str(db_path.parent)},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "deleted"

    def test_delete_settings_not_found(
        self, client: TestClient, db_path: Path, project_id: UUID
    ):
        resp = client.delete(
            f"/projects/{project_id}/ai/settings",
            params={"project_path": str(db_path.parent)},
        )
        assert resp.status_code == 404

    def test_list_audit_logs_empty(
        self, client: TestClient, db_path: Path, project_id: UUID
    ):
        resp = client.get(
            f"/projects/{project_id}/ai/audit",
            params={"project_path": str(db_path.parent)},
        )
        assert resp.status_code == 200
        assert resp.json() == []

    def test_audit_logs_after_ai_call(
        self, client: TestClient, db_path: Path, project_id: UUID
    ):
        """Insert audit log directly and verify API returns it."""
        log_id = uuid4()
        with get_session(db_path) as session:
            session.add(
                AIAuditLog(
                    id=log_id,
                    project_id=project_id,
                    provider="ollama",
                    model="llama3.2",
                    prompt="test prompt",
                    response="test response",
                    tokens_prompt=5,
                    tokens_completion=10,
                    duration_ms=200,
                    status="success",
                )
            )

        resp = client.get(
            f"/projects/{project_id}/ai/audit",
            params={"project_path": str(db_path.parent)},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["prompt"] == "test prompt"
        assert data[0]["tokens_prompt"] == 5

    def test_get_single_audit_log(
        self, client: TestClient, db_path: Path, project_id: UUID
    ):
        log_id = uuid4()
        with get_session(db_path) as session:
            session.add(
                AIAuditLog(
                    id=log_id,
                    project_id=project_id,
                    provider="ollama",
                    model="llama3.2",
                    prompt="single",
                    response="entry",
                    duration_ms=50,
                    status="success",
                )
            )

        resp = client.get(
            f"/projects/{project_id}/ai/audit/{log_id}",
            params={"project_path": str(db_path.parent)},
        )
        assert resp.status_code == 200
        assert resp.json()["prompt"] == "single"

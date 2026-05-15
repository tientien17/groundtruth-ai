"""AI configuration CRUD and audit log endpoints."""
from __future__ import annotations

from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from database import get_session, init_db
from models import AIAuditLog, AISettings, Project

router = APIRouter(prefix="/projects", tags=["ai"])


# ── Request / Response schemas ───────────────────────────────────────────────


class AISettingsRequest(BaseModel):
    provider: str = Field(
        default="ollama", pattern=r"^(ollama|vllm|openai_compatible)$"
    )
    base_url: str = Field(default="http://127.0.0.1:11434", max_length=1024)
    chat_model: str = Field(default="llama3.2", max_length=255)
    embedding_model: str = Field(default="nomic-embed-text", max_length=255)
    extra_config: dict = Field(default_factory=dict)


class AISettingsResponse(BaseModel):
    id: str
    project_id: str
    provider: str
    base_url: str
    chat_model: str
    embedding_model: str
    extra_config: dict
    updated_at: str


class AIAuditLogResponse(BaseModel):
    id: str
    project_id: str
    provider: str
    model: str
    prompt: str
    response: str
    tokens_prompt: int | None
    tokens_completion: int | None
    duration_ms: int
    status: str
    error_message: str | None
    metadata_json: dict
    created_at: str


# ── Settings CRUD ────────────────────────────────────────────────────────────


@router.get("/{project_id}/ai/settings")
async def get_ai_settings(
    project_id: UUID,
    project_path: str = Query(...),
) -> AISettingsResponse | dict:
    """Get AI settings for a project, or defaults if none set."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        _require_project(session, project_id)
        row = (
            session.query(AISettings)
            .filter(AISettings.project_id == project_id)
            .first()
        )
        if row is None:
            return {
                "provider": "ollama",
                "base_url": "http://127.0.0.1:11434",
                "chat_model": "llama3.2",
                "embedding_model": "nomic-embed-text",
                "extra_config": {},
                "is_default": True,
            }
        return _serialize_settings(row)


@router.put("/{project_id}/ai/settings")
async def upsert_ai_settings(
    project_id: UUID,
    body: AISettingsRequest,
    project_path: str = Query(...),
) -> AISettingsResponse:
    """Create or update AI settings for a project."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        _require_project(session, project_id)
        row = (
            session.query(AISettings)
            .filter(AISettings.project_id == project_id)
            .first()
        )
        if row is None:
            row = AISettings(
                id=uuid4(),
                project_id=project_id,
                provider=body.provider,
                base_url=body.base_url,
                chat_model=body.chat_model,
                embedding_model=body.embedding_model,
                extra_config=body.extra_config,
            )
            session.add(row)
        else:
            row.provider = body.provider
            row.base_url = body.base_url
            row.chat_model = body.chat_model
            row.embedding_model = body.embedding_model
            row.extra_config = body.extra_config
        session.flush()
        return _serialize_settings(row)


@router.delete("/{project_id}/ai/settings")
async def delete_ai_settings(
    project_id: UUID,
    project_path: str = Query(...),
) -> dict[str, str]:
    """Delete project AI settings (reverts to defaults)."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        _require_project(session, project_id)
        row = (
            session.query(AISettings)
            .filter(AISettings.project_id == project_id)
            .first()
        )
        if row is None:
            raise HTTPException(status_code=404, detail="AI settings not found")
        session.delete(row)
        return {"status": "deleted"}


# ── Audit log read ───────────────────────────────────────────────────────────


@router.get("/{project_id}/ai/audit")
async def list_ai_audit_logs(
    project_id: UUID,
    project_path: str = Query(...),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> list[AIAuditLogResponse]:
    """List AI audit log entries for a project, newest first."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        _require_project(session, project_id)
        rows = (
            session.query(AIAuditLog)
            .filter(AIAuditLog.project_id == project_id)
            .order_by(AIAuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return [_serialize_audit(r) for r in rows]


@router.get("/{project_id}/ai/audit/{log_id}")
async def get_ai_audit_log(
    project_id: UUID,
    log_id: UUID,
    project_path: str = Query(...),
) -> AIAuditLogResponse:
    """Get a single AI audit log entry."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        _require_project(session, project_id)
        row = session.get(AIAuditLog, log_id)
        if row is None or row.project_id != project_id:
            raise HTTPException(status_code=404, detail="Audit log not found")
        return _serialize_audit(row)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _project_db_path(project_path: str) -> Path:
    return Path(project_path).expanduser().resolve() / "project.sqlite"


def _require_project(session, project_id: UUID) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _serialize_settings(row: AISettings) -> AISettingsResponse:
    return AISettingsResponse(
        id=str(row.id),
        project_id=str(row.project_id),
        provider=row.provider,
        base_url=row.base_url,
        chat_model=row.chat_model,
        embedding_model=row.embedding_model,
        extra_config=row.extra_config,
        updated_at=row.updated_at.isoformat(),
    )


def _serialize_audit(row: AIAuditLog) -> AIAuditLogResponse:
    return AIAuditLogResponse(
        id=str(row.id),
        project_id=str(row.project_id),
        provider=row.provider,
        model=row.model,
        prompt=row.prompt,
        response=row.response,
        tokens_prompt=row.tokens_prompt,
        tokens_completion=row.tokens_completion,
        duration_ms=row.duration_ms,
        status=row.status,
        error_message=row.error_message,
        metadata_json=row.metadata_json,
        created_at=row.created_at.isoformat(),
    )

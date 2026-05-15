"""Classification CRUD API endpoints."""
from __future__ import annotations

import re
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from database import get_session, init_db
from models import Classification, Project


router = APIRouter(prefix="/projects", tags=["classifications"])

HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")


class ClassificationCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    color: str
    unit: str = Field(default="count", min_length=1, max_length=32)

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str) -> str:
        if not HEX_COLOR_PATTERN.match(value):
            raise ValueError("color must be a hex color like #FF0000")
        return value.upper()


class ClassificationUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    color: str | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=32)

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not HEX_COLOR_PATTERN.match(value):
            raise ValueError("color must be a hex color like #FF0000")
        return value.upper()


class ClassificationResponse(BaseModel):
    id: str
    project_id: str | None
    name: str
    color: str
    unit: str


@router.get("/{project_id}/classifications")
async def list_classifications(
    project_id: UUID,
    project_path: str = Query(...),
) -> list[ClassificationResponse]:
    """List classifications for a project."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        _require_project(session, project_id)
        classifications = (
            session.query(Classification)
            .filter(Classification.project_id == project_id)
            .order_by(Classification.name)
            .all()
        )
        return [_serialize_classification(classification) for classification in classifications]


@router.post("/{project_id}/classifications")
async def create_classification(
    project_id: UUID,
    body: ClassificationCreateRequest,
    project_path: str = Query(...),
) -> ClassificationResponse:
    """Create a named classification with a required hex color and unit."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        _require_project(session, project_id)
        classification = Classification(
            id=uuid4(),
            project_id=project_id,
            name=body.name.strip(),
            color=body.color,
            unit=body.unit.strip(),
        )
        session.add(classification)
        session.flush()
        return _serialize_classification(classification)


@router.patch("/{project_id}/classifications/{classification_id}")
async def update_classification(
    project_id: UUID,
    classification_id: UUID,
    body: ClassificationUpdateRequest,
    project_path: str = Query(...),
) -> ClassificationResponse:
    """Update classification name, color, and/or unit."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        classification = _require_classification(session, project_id, classification_id)
        if body.name is not None:
            classification.name = body.name.strip()
        if body.color is not None:
            classification.color = body.color
        if body.unit is not None:
            classification.unit = body.unit.strip()
        session.flush()
        return _serialize_classification(classification)


@router.delete("/{project_id}/classifications/{classification_id}")
async def delete_classification(
    project_id: UUID,
    classification_id: UUID,
    project_path: str = Query(...),
) -> dict[str, str]:
    """Delete a classification."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        classification = _require_classification(session, project_id, classification_id)
        session.delete(classification)
        return {"status": "deleted", "id": str(classification_id)}


def _project_db_path(project_path: str) -> Path:
    return Path(project_path).expanduser().resolve() / "project.sqlite"


def _require_project(session, project_id: UUID) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _require_classification(
    session,
    project_id: UUID,
    classification_id: UUID,
) -> Classification:
    _require_project(session, project_id)
    classification = session.get(Classification, classification_id)
    if classification is None or classification.project_id != project_id:
        raise HTTPException(status_code=404, detail="Classification not found")
    return classification


def _serialize_classification(
    classification: Classification,
) -> ClassificationResponse:
    return ClassificationResponse(
        id=str(classification.id),
        project_id=str(classification.project_id) if classification.project_id else None,
        name=classification.name,
        color=classification.color,
        unit=classification.unit,
    )

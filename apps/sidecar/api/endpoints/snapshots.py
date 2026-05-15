"""Snapshot API endpoints for named takeoff state copies."""
from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from database import get_session, init_db
from models import Document, Project, Sheet, Snapshot, TakeoffItem


router = APIRouter(prefix="/projects", tags=["snapshots"])


class SnapshotCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class SnapshotUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class SnapshotResponse(BaseModel):
    id: str
    project_id: str
    name: str
    snapshot_json: dict[str, Any]
    created_at: str


@router.get("/{project_id}/snapshots")
async def list_snapshots(
    project_id: UUID,
    project_path: str = Query(...),
) -> list[SnapshotResponse]:
    """List saved snapshots for a project."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        _require_project(session, project_id)
        snapshots = (
            session.query(Snapshot)
            .filter(Snapshot.project_id == project_id)
            .order_by(Snapshot.created_at.desc())
            .all()
        )
        return [_serialize_snapshot(snapshot) for snapshot in snapshots]


@router.post("/{project_id}/snapshots")
async def create_snapshot(
    project_id: UUID,
    body: SnapshotCreateRequest,
    project_path: str = Query(...),
) -> SnapshotResponse:
    """Save the current takeoff state as a named JSON snapshot."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        _require_project(session, project_id)
        snapshot = Snapshot(
            id=uuid4(),
            project_id=project_id,
            name=body.name.strip(),
            snapshot_json=_build_takeoff_snapshot(session, project_id),
        )
        session.add(snapshot)
        session.flush()
        return _serialize_snapshot(snapshot)


@router.get("/{project_id}/snapshots/{snapshot_id}")
async def get_snapshot(
    project_id: UUID,
    snapshot_id: UUID,
    project_path: str = Query(...),
) -> SnapshotResponse:
    """Return one saved snapshot."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        snapshot = _require_snapshot(session, project_id, snapshot_id)
        return _serialize_snapshot(snapshot)


@router.patch("/{project_id}/snapshots/{snapshot_id}")
async def update_snapshot(
    project_id: UUID,
    snapshot_id: UUID,
    body: SnapshotUpdateRequest,
    project_path: str = Query(...),
) -> SnapshotResponse:
    """Rename a saved snapshot without branching or merging state."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        snapshot = _require_snapshot(session, project_id, snapshot_id)
        snapshot.name = body.name.strip()
        session.flush()
        return _serialize_snapshot(snapshot)


@router.delete("/{project_id}/snapshots/{snapshot_id}")
async def delete_snapshot(
    project_id: UUID,
    snapshot_id: UUID,
    project_path: str = Query(...),
) -> dict[str, str]:
    """Delete a saved snapshot."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        snapshot = _require_snapshot(session, project_id, snapshot_id)
        session.delete(snapshot)
        return {"status": "deleted", "id": str(snapshot_id)}


def _build_takeoff_snapshot(session, project_id: UUID) -> dict[str, Any]:
    items = (
        session.query(TakeoffItem)
        .join(TakeoffItem.sheet)
        .join(Sheet.document)
        .filter(Document.project_id == project_id)
        .order_by(Sheet.page_index, TakeoffItem.created_at)
        .all()
    )

    return {
        "version": 1,
        "takeoff_items": [_serialize_takeoff_item(item) for item in items],
    }


def _serialize_takeoff_item(item: TakeoffItem) -> dict[str, Any]:
    geometry = item.geometry
    return {
        "id": str(item.id),
        "sheet_id": str(item.sheet_id),
        "classification_id": str(item.classification_id) if item.classification_id else None,
        "type": item.type,
        "source": item.source,
        "confidence": item.confidence,
        "scale_id": item.scale_id,
        "quantity_raw": item.quantity_raw,
        "quantity_unit": item.quantity_unit,
        "formulas": item.formulas or {},
        "created_by": item.created_by,
        "created_at": item.created_at.isoformat(),
        "updated_at": item.updated_at.isoformat(),
        "geometry": None
        if geometry is None
        else {
            "id": str(geometry.id),
            "kind": geometry.geometry_type,
            "points": geometry.points or [],
            "holes": geometry.holes or [],
            "scale": geometry.scale,
            "scale_unit": geometry.scale_unit,
        },
    }


def _project_db_path(project_path: str) -> Path:
    db_path = Path(project_path).expanduser().resolve() / "project.sqlite"
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Project database not found")
    return db_path


def _require_project(session, project_id: UUID) -> Project:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _require_snapshot(session, project_id: UUID, snapshot_id: UUID) -> Snapshot:
    _require_project(session, project_id)
    snapshot = session.get(Snapshot, snapshot_id)
    if snapshot is None or snapshot.project_id != project_id:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snapshot


def _serialize_snapshot(snapshot: Snapshot) -> SnapshotResponse:
    return SnapshotResponse(
        id=str(snapshot.id),
        project_id=str(snapshot.project_id),
        name=snapshot.name,
        snapshot_json=snapshot.snapshot_json or {},
        created_at=snapshot.created_at.isoformat(),
    )

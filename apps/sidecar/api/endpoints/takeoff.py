"""Takeoff item CRUD API endpoints."""
from __future__ import annotations

from pathlib import Path
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from database import get_session, init_db
from models import Document, Sheet, TakeoffGeometry, TakeoffItem
from services.computation import (
    compute_quantity,
    geometry_type_for_quantity,
    quantity_type_for_geometry,
)

router = APIRouter(prefix="/projects", tags=["takeoff"])

QuantityType = Literal["count", "linear", "area"]
GeometryType = Literal["point", "path", "polygon"]


class PointRequest(BaseModel):
    x: float
    y: float


class TakeoffGeometryRequest(BaseModel):
    kind: GeometryType | None = None
    points: list[PointRequest]
    holes: list[list[PointRequest]] = Field(default_factory=list)
    scale: float = 1.0
    scale_unit: str = "ft"


class TakeoffItemCreateRequest(BaseModel):
    type: QuantityType
    geometry: TakeoffGeometryRequest
    classification_id: UUID | None = None
    source: str = "manual"
    confidence: float | None = None
    scale_id: str | None = None
    created_by: str = "local-user"

class BulkTakeoffItemCreateRequest(BaseModel):
    items: list[TakeoffItemCreateRequest]


class TakeoffItemUpdateRequest(BaseModel):
    type: QuantityType | None = None
    geometry: TakeoffGeometryRequest | None = None
    classification_id: UUID | None = None
    source: str | None = None
    confidence: float | None = None
    scale_id: str | None = None
    created_by: str | None = None


class TakeoffGeometryResponse(BaseModel):
    id: str
    kind: GeometryType
    points: list[dict[str, float]]
    holes: list[list[dict[str, float]]]
    scale: float
    scale_unit: str


class TakeoffItemResponse(BaseModel):
    id: str
    sheet_id: str
    classification_id: str | None
    type: str
    source: str
    confidence: float | None
    scale_id: str | None
    quantity_raw: float | None
    quantity_unit: str | None
    created_by: str
    geometry: TakeoffGeometryResponse | None


@router.get("/{project_id}/sheets/{sheet_id}/takeoff-items")
async def list_takeoff_items(
    project_id: UUID,
    sheet_id: UUID,
    project_path: str = Query(...),
) -> list[TakeoffItemResponse]:
    """List takeoff items for a sheet in a project."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        _require_sheet(session, project_id, sheet_id)
        items = (
            session.query(TakeoffItem)
            .filter(TakeoffItem.sheet_id == sheet_id)
            .order_by(TakeoffItem.created_at)
            .all()
        )
        return [_serialize_item(item) for item in items]


@router.post("/{project_id}/sheets/{sheet_id}/takeoff-items")
async def create_takeoff_item(
    project_id: UUID,
    sheet_id: UUID,
    body: TakeoffItemCreateRequest,
    project_path: str = Query(...),
) -> TakeoffItemResponse:
    """Create a takeoff item, persist geometry, and compute its quantity."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        _require_sheet(session, project_id, sheet_id)
        geometry_kind = _geometry_kind(body.type, body.geometry)
        quantity = _compute_quantity(body.type, body.geometry)
        item = TakeoffItem(
            id=uuid4(),
            sheet_id=sheet_id,
            classification_id=body.classification_id,
            type=body.type,
            source=body.source,
            confidence=body.confidence,
            scale_id=body.scale_id,
            quantity_raw=quantity.value,
            quantity_unit=quantity.unit,
            created_by=body.created_by,
        )
        session.add(item)
        session.flush()
        
        item.geometry = TakeoffGeometry(
            id=uuid4(),
            takeoff_item_id=item.id,
            geometry_type=geometry_kind,
            points=_dump_points(body.geometry.points),
            holes=[_dump_points(hole) for hole in body.geometry.holes],
            scale=body.geometry.scale,
            scale_unit=body.geometry.scale_unit,
        )
        session.flush()
        
        return _serialize_item(item)


@router.post("/{project_id}/sheets/{sheet_id}/takeoff-items/bulk")
async def bulk_create_takeoff_items(
    project_id: UUID,
    sheet_id: UUID,
    body: BulkTakeoffItemCreateRequest,
    project_path: str = Query(...),
) -> list[TakeoffItemResponse]:
    """Bulk create takeoff items for a sheet."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        _require_sheet(session, project_id, sheet_id)
        
        created_items = []
        for item_data in body.items:
            geometry_kind = _geometry_kind(item_data.type, item_data.geometry)
            quantity = _compute_quantity(item_data.type, item_data.geometry)
            
            item = TakeoffItem(
                id=uuid4(),
                sheet_id=sheet_id,
                classification_id=item_data.classification_id,
                type=item_data.type,
                source=item_data.source,
                confidence=item_data.confidence,
                scale_id=item_data.scale_id,
                quantity_raw=quantity.value,
                quantity_unit=quantity.unit,
                created_by=item_data.created_by,
            )
            session.add(item)
            session.flush()
            
            item.geometry = TakeoffGeometry(
                id=uuid4(),
                takeoff_item_id=item.id,
                geometry_type=geometry_kind,
                points=_dump_points(item_data.geometry.points),
                holes=[_dump_points(hole) for hole in item_data.geometry.holes],
                scale=item_data.geometry.scale,
                scale_unit=item_data.geometry.scale_unit,
            )
            session.flush()
            created_items.append(item)
            
        return [_serialize_item(item) for item in created_items]



@router.get("/{project_id}/takeoff-items/{item_id}")
async def get_takeoff_item(
    project_id: UUID,
    item_id: UUID,
    project_path: str = Query(...),
) -> TakeoffItemResponse:
    """Return one takeoff item within a project."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        item = _require_item(session, project_id, item_id)
        return _serialize_item(item)


@router.patch("/{project_id}/takeoff-items/{item_id}")
async def update_takeoff_item(
    project_id: UUID,
    item_id: UUID,
    body: TakeoffItemUpdateRequest,
    project_path: str = Query(...),
) -> TakeoffItemResponse:
    """Update a takeoff item and recompute quantity when needed."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        item = _require_item(session, project_id, item_id)
        quantity_type = body.type or item.type

        if body.classification_id is not None:
            item.classification_id = body.classification_id
        if body.type is not None:
            item.type = body.type
        if body.source is not None:
            item.source = body.source
        if body.confidence is not None:
            item.confidence = body.confidence
        if body.scale_id is not None:
            item.scale_id = body.scale_id
        if body.created_by is not None:
            item.created_by = body.created_by

        if body.geometry is not None:
            geometry_kind = _geometry_kind(quantity_type, body.geometry)
            quantity = _compute_quantity(quantity_type, body.geometry)
            item.quantity_raw = quantity.value
            item.quantity_unit = quantity.unit

            geometry = item.geometry
            if geometry is None:
                geometry = TakeoffGeometry(id=uuid4(), takeoff_item_id=item.id)
                item.geometry = geometry

            geometry.geometry_type = geometry_kind
            geometry.points = _dump_points(body.geometry.points)
            geometry.holes = [_dump_points(hole) for hole in body.geometry.holes]
            geometry.scale = body.geometry.scale
            geometry.scale_unit = body.geometry.scale_unit

        session.flush()
        return _serialize_item(item)


@router.delete("/{project_id}/takeoff-items/{item_id}")
async def delete_takeoff_item(
    project_id: UUID,
    item_id: UUID,
    project_path: str = Query(...),
) -> dict[str, str]:
    """Delete a takeoff item and its geometry."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        item = _require_item(session, project_id, item_id)
        session.delete(item)
        return {"status": "deleted", "id": str(item_id)}


def _project_db_path(project_path: str) -> Path:
    db_path = Path(project_path).expanduser().resolve() / "project.sqlite"
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Project database not found")
    return db_path


def _require_sheet(session, project_id: UUID, sheet_id: UUID) -> Sheet:
    sheet = (
        session.query(Sheet)
        .join(Sheet.document)
        .filter(Sheet.id == sheet_id, Document.project_id == project_id)
        .first()
    )
    if sheet is None:
        raise HTTPException(status_code=404, detail="Sheet not found")
    return sheet


def _require_item(session, project_id: UUID, item_id: UUID) -> TakeoffItem:
    item = (
        session.query(TakeoffItem)
        .join(TakeoffItem.sheet)
        .join(Sheet.document)
        .filter(TakeoffItem.id == item_id, Document.project_id == project_id)
        .first()
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Takeoff item not found")
    return item


def _compute_quantity(quantity_type: str, geometry: TakeoffGeometryRequest):
    try:
        return compute_quantity(
            quantity_type,
            _dump_points(geometry.points),
            scale=geometry.scale,
            scale_unit=geometry.scale_unit,
            holes=[_dump_points(hole) for hole in geometry.holes],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _geometry_kind(quantity_type: str, geometry: TakeoffGeometryRequest) -> GeometryType:
    expected_kind = geometry_type_for_quantity(quantity_type)
    if geometry.kind is not None and quantity_type_for_geometry(geometry.kind) != quantity_type:
        raise HTTPException(
            status_code=400,
            detail=f"Geometry kind {geometry.kind} does not match takeoff type {quantity_type}",
        )
    return expected_kind


def _dump_points(points: list[PointRequest]) -> list[dict[str, float]]:
    return [point.model_dump() for point in points]


def _serialize_item(item: TakeoffItem) -> TakeoffItemResponse:
    return TakeoffItemResponse(
        id=str(item.id),
        sheet_id=str(item.sheet_id),
        classification_id=str(item.classification_id) if item.classification_id else None,
        type=item.type,
        source=item.source,
        confidence=item.confidence,
        scale_id=item.scale_id,
        quantity_raw=item.quantity_raw,
        quantity_unit=item.quantity_unit,
        created_by=item.created_by,
        geometry=_serialize_geometry(item.geometry),
    )


def _serialize_geometry(
    geometry: TakeoffGeometry | None,
) -> TakeoffGeometryResponse | None:
    if geometry is None:
        return None
    return TakeoffGeometryResponse(
        id=str(geometry.id),
        kind=geometry.geometry_type,  # type: ignore[arg-type]
        points=geometry.points or [],
        holes=geometry.holes or [],
        scale=geometry.scale,
        scale_unit=geometry.scale_unit,
    )

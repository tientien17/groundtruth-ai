"""Compare API endpoints for GroundTruth Local."""
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from database import get_session
from models import Classification, Sheet, TakeoffItem
from sqlalchemy import select
from sqlalchemy.orm import joinedload

router = APIRouter(prefix="/projects", tags=["compare"])


class CompareItem(BaseModel):
    """Individual takeoff item in a compare result."""

    id: str
    type: str | None
    classification_id: str | None = None
    classification_name: str | None = None
    quantity: float | None = None
    unit: str | None = None


class CompareSheetInfo(BaseModel):
    """Summary info for a sheet in the compare result."""

    id: str
    sheet_number: str
    item_count: int


class CompareResponse(BaseModel):
    """Response model for sheet comparison."""

    sheet_a: CompareSheetInfo
    sheet_b: CompareSheetInfo
    only_in_a: list[CompareItem]
    only_in_b: list[CompareItem]
    in_both: list[CompareItem]


@router.post("/{project_id}/sheets/compare", response_model=CompareResponse)
def compare_sheets(
    project_id: UUID,
    payload: dict[str, UUID],
    project_path: str = Query(...),
) -> CompareResponse:
    """Compare takeoff items between two sheets."""
    sheet_id_a = payload.get("sheet_id_a")
    sheet_id_b = payload.get("sheet_id_b")

    if not sheet_id_a or not sheet_id_b:
        raise HTTPException(
            status_code=400, detail="sheet_id_a and sheet_id_b are required"
        )

    db_path = Path(project_path).expanduser().resolve() / "project.sqlite"
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Project database not found")

    with get_session(db_path) as db:
        # Validate sheets exist and belong to the project (via document)
        sheet_a = db.execute(
            select(Sheet)
            .options(joinedload(Sheet.document))
            .where(Sheet.id == sheet_id_a)
        ).scalar_one_or_none()
        sheet_b = db.execute(
            select(Sheet)
            .options(joinedload(Sheet.document))
            .where(Sheet.id == sheet_id_b)
        ).scalar_one_or_none()

        if not sheet_a or not sheet_b:
            raise HTTPException(status_code=404, detail="One or both sheets not found")

        if sheet_a.document and sheet_a.document.project_id != project_id:
            raise HTTPException(status_code=404, detail="Sheet A not found in this project")
        if sheet_b.document and sheet_b.document.project_id != project_id:
            raise HTTPException(status_code=404, detail="Sheet B not found in this project")

        # Fetch takeoff items for both sheets
        stmt_a = select(TakeoffItem, Classification).outerjoin(
            Classification, TakeoffItem.classification_id == Classification.id
        ).where(TakeoffItem.sheet_id == sheet_id_a)
        items_a_raw = db.execute(stmt_a).all()

        stmt_b = select(TakeoffItem, Classification).outerjoin(
            Classification, TakeoffItem.classification_id == Classification.id
        ).where(TakeoffItem.sheet_id == sheet_id_b)
        items_b_raw = db.execute(stmt_b).all()

        # Format items
        def format_item(item: TakeoffItem, classification: Classification | None) -> CompareItem:
            return CompareItem(
                id=str(item.id),
                type=item.type,
                classification_id=str(classification.id) if classification else None,
                classification_name=classification.name if classification else None,
                quantity=item.quantity_raw,
                unit=item.quantity_unit,
            )

        formatted_a = [format_item(i, c) for i, c in items_a_raw]
        formatted_b = [format_item(i, c) for i, c in items_b_raw]

        # Create keys for comparison (classification_id + type)
        def item_key(item: CompareItem) -> str:
            return f"{item.classification_id}_{item.type}"

        keys_a = {item_key(item): item for item in formatted_a if item.classification_id}
        keys_b = {item_key(item): item for item in formatted_b if item.classification_id}

        only_in_a = [
            item for item in formatted_a
            if item.classification_id and item_key(item) not in keys_b
        ]
        # Add items without classification to only_in_a
        only_in_a.extend([i for i in formatted_a if not i.classification_id])

        only_in_b = [
            item for item in formatted_b
            if item.classification_id and item_key(item) not in keys_a
        ]
        # Add items without classification to only_in_b
        only_in_b.extend([i for i in formatted_b if not i.classification_id])

        in_both = [
            item for item in formatted_a
            if item.classification_id and item_key(item) in keys_b
        ]

        return CompareResponse(
            sheet_a=CompareSheetInfo(
                id=str(sheet_a.id),
                sheet_number=sheet_a.sheet_number,
                item_count=len(formatted_a),
            ),
            sheet_b=CompareSheetInfo(
                id=str(sheet_b.id),
                sheet_number=sheet_b.sheet_number,
                item_count=len(formatted_b),
            ),
            only_in_a=only_in_a,
            only_in_b=only_in_b,
            in_both=in_both,
        )

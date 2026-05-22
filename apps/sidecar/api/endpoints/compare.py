"""Compare API endpoints for GroundTruth Local."""
from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_db
from models import Sheet, TakeoffItem, Classification
from sqlalchemy import select
from sqlalchemy.orm import Session

router = APIRouter(prefix="/projects", tags=["compare"])


@router.post("/{project_id}/sheets/compare")
def compare_sheets(
    project_id: UUID,
    payload: dict[str, UUID],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Compare takeoff items between two sheets."""
    sheet_id_a = payload.get("sheet_id_a")
    sheet_id_b = payload.get("sheet_id_b")

    if not sheet_id_a or not sheet_id_b:
        raise HTTPException(
            status_code=400, detail="sheet_id_a and sheet_id_b are required"
        )

    # Validate sheets exist and belong to the project (via document)
    sheet_a = db.execute(
        select(Sheet).where(Sheet.id == sheet_id_a)
    ).scalar_one_or_none()
    sheet_b = db.execute(
        select(Sheet).where(Sheet.id == sheet_id_b)
    ).scalar_one_or_none()

    if not sheet_a or not sheet_b:
        raise HTTPException(status_code=404, detail="One or both sheets not found")

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
    def format_item(item: TakeoffItem, classification: Classification | None) -> dict:
        return {
            "id": str(item.id),
            "type": item.type,
            "classification_id": str(classification.id) if classification else None,
            "classification_name": classification.name if classification else None,
            "quantity": item.quantity_raw,
            "unit": item.quantity_unit,
        }

    formatted_a = [format_item(i, c) for i, c in items_a_raw]
    formatted_b = [format_item(i, c) for i, c in items_b_raw]

    # Create keys for comparison (classification_id + type)
    def item_key(item: dict) -> str:
        return f"{item['classification_id']}_{item['type']}"

    keys_a = {item_key(item): item for item in formatted_a if item["classification_id"]}
    keys_b = {item_key(item): item for item in formatted_b if item["classification_id"]}

    only_in_a = [
        item for item in formatted_a
        if item["classification_id"] and item_key(item) not in keys_b
    ]
    # Add items without classification to only_in_a
    only_in_a.extend([i for i in formatted_a if not i["classification_id"]])

    only_in_b = [
        item for item in formatted_b
        if item["classification_id"] and item_key(item) not in keys_a
    ]
    # Add items without classification to only_in_b
    only_in_b.extend([i for i in formatted_b if not i["classification_id"]])

    in_both = [
        item for item in formatted_a
        if item["classification_id"] and item_key(item) in keys_b
    ]

    return {
        "sheet_a": {
            "id": str(sheet_a.id),
            "sheet_number": sheet_a.sheet_number,
            "item_count": len(formatted_a),
        },
        "sheet_b": {
            "id": str(sheet_b.id),
            "sheet_number": sheet_b.sheet_number,
            "item_count": len(formatted_b),
        },
        "only_in_a": only_in_a,
        "only_in_b": only_in_b,
        "in_both": in_both,
    }

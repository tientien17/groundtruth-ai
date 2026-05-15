"""Annotated PDF export helpers for takeoff geometry."""
from __future__ import annotations

from collections import defaultdict
from io import BytesIO
from pathlib import Path
from typing import Any

import fitz  # type: ignore[reportMissingModuleSource]
from sqlalchemy.orm import Session, joinedload

from models import Classification, Document, Sheet, TakeoffItem


DEFAULT_COLOR = (0.95, 0.2, 0.1)


def build_annotated_pdf(session: Session, project_id: Any, document_id: Any) -> BytesIO:
    """Create an annotated copy of a project's source PDF."""
    document = _require_document(session, project_id, document_id)
    source_path = Path(document.original_path).expanduser().resolve()
    if not source_path.exists():
        raise FileNotFoundError(f"Source PDF not found: {source_path}")

    sheets = (
        session.query(Sheet)
        .filter(Sheet.document_id == document_id)
        .options(joinedload(Sheet.takeoff_items).joinedload(TakeoffItem.geometry))
        .order_by(Sheet.page_index, Sheet.sheet_number)
        .all()
    )
    classifications = {
        classification.id: classification
        for classification in session.query(Classification)
        .filter(Classification.project_id == project_id)
        .all()
    }

    items_by_page: dict[int, list[TakeoffItem]] = defaultdict(list)
    for sheet in sheets:
        items_by_page[sheet.page_index].extend(sheet.takeoff_items)

    pdf = fitz.open(source_path)
    try:
        for page_index, items in items_by_page.items():
            if page_index < 0 or page_index >= pdf.page_count:
                continue
            page = pdf[page_index]
            for item in items:
                classification = (
                    classifications.get(item.classification_id)
                    if item.classification_id is not None
                    else None
                )
                _draw_item(page, item, classification)
        _append_legend(pdf, classifications.values())

        output = BytesIO()
        pdf.save(output)
        output.seek(0)
        return output
    finally:
        pdf.close()


def _require_document(session: Session, project_id: Any, document_id: Any) -> Document:
    document = (
        session.query(Document)
        .filter(Document.id == document_id, Document.project_id == project_id)
        .first()
    )
    if document is None:
        raise ValueError("Document not found")
    return document


def _draw_item(
    page: fitz.Page,
    item: TakeoffItem,
    classification: Classification | None,
) -> None:
    geometry = item.geometry
    if geometry is None or not geometry.points:
        return

    color = _hex_to_rgb(classification.color if classification else None)
    points = [_point(point) for point in geometry.points]
    if geometry.geometry_type == "point" or len(points) == 1:
        page.draw_circle(points[0], radius=5, color=color, fill=color, width=1.5)
    elif geometry.geometry_type == "polygon":
        _draw_poly(page, points + [points[0]], color)
    else:
        for start, end in zip(points, points[1:]):
            page.draw_line(start, end, color=color, width=2)

    label = _label(item, classification)
    if label:
        page.insert_text(_label_point(points), label, fontsize=8, color=color)


def _append_legend(pdf: fitz.Document, classifications: Any) -> None:
    classifications = list(classifications)
    if not classifications:
        return
    page = pdf.new_page(width=612, height=792)
    page.insert_text(fitz.Point(36, 48), "Takeoff Legend", fontsize=16, color=(0, 0, 0))
    y = 78
    for classification in classifications:
        color = _hex_to_rgb(classification.color)
        page.draw_circle(fitz.Point(44, y - 4), radius=4, color=color, fill=color)
        page.insert_text(fitz.Point(58, y), f"{classification.name} ({classification.unit})", fontsize=10, color=(0, 0, 0))
        y += 18


def _draw_poly(
    page: fitz.Page,
    points: list[fitz.Point],
    color: tuple[float, float, float],
) -> None:
    draw_poly = getattr(page, "draw_poly", None)
    if draw_poly is not None:
        draw_poly(points, color=color, width=2)
        return
    page.draw_polyline(points, color=color, width=2)


def _point(value: dict[str, float]) -> fitz.Point:
    return fitz.Point(float(value.get("x", 0)), float(value.get("y", 0)))


def _label_point(points: list[fitz.Point]) -> fitz.Point:
    return fitz.Point(max(point.x for point in points) + 4, min(point.y for point in points) - 4)


def _label(item: TakeoffItem, classification: Classification | None) -> str:
    name = classification.name if classification else "Unclassified"
    if item.quantity_raw is None:
        return name
    unit = item.quantity_unit or (classification.unit if classification else "")
    quantity = f"{float(item.quantity_raw):g}"
    return f"{name}: {quantity} {unit}".strip()


def _hex_to_rgb(hex_color: str | None) -> tuple[float, float, float]:
    if not hex_color or len(hex_color) != 7 or not hex_color.startswith("#"):
        return DEFAULT_COLOR
    try:
        return tuple(int(hex_color[index : index + 2], 16) / 255 for index in (1, 3, 5))  # type: ignore[return-value]
    except ValueError:
        return DEFAULT_COLOR

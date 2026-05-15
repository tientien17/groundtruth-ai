"""Semantic search endpoints backed by project-local vectors."""
from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

from database import get_session
from models import Document, Sheet, SheetText
from services.vector_store import LocalVectorStore  # type: ignore[reportMissingImports]

router = APIRouter(prefix="/projects", tags=["search"])


class SearchResponseItem(BaseModel):
    document_id: str
    sheet_id: str
    page_index: int
    text: str
    bbox: list[float]
    score: float


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResponseItem]


class TextSearchResponseItem(BaseModel):
    document_id: str
    sheet_id: str
    page_index: int
    text: str
    bbox: list[float]


class TextSearchResponse(BaseModel):
    query: str
    results: list[TextSearchResponseItem]


@router.get("/{project_id}/search")
async def semantic_search(
    project_id: UUID,
    q: str = Query(..., min_length=1),
    project_path: str = Query(...),
    limit: int = Query(10, ge=1, le=50),
) -> SearchResponse:
    """Return relevant document spans/pages with local similarity scores."""
    resolved_project_path = Path(project_path).expanduser().resolve()
    if not (resolved_project_path / "project.sqlite").exists():
        raise HTTPException(status_code=404, detail="Project database not found")

    results = LocalVectorStore(resolved_project_path).search(q, project_id, limit=limit)
    return SearchResponse(
        query=q,
        results=[SearchResponseItem(**result.__dict__) for result in results],
    )


@router.get("/{project_id}/text-search")
async def text_search(
    project_id: UUID,
    q: str = Query(..., min_length=1),
    project_path: str = Query(...),
    limit: int = Query(100, ge=1, le=500),
) -> TextSearchResponse:
    """Return literal text occurrences with PDF-space bounding boxes."""
    resolved_project_path = Path(project_path).expanduser().resolve()
    db_path = resolved_project_path / "project.sqlite"
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Project database not found")

    with get_session(db_path) as session:
        rows = session.execute(
            select(SheetText, Sheet)
            .join(Sheet, SheetText.sheet_id == Sheet.id)
            .join(Document, Sheet.document_id == Document.id)
            .filter(Document.project_id == project_id)
            .filter(SheetText.text.ilike(f"%{q}%"))
            .order_by(SheetText.page_index, SheetText.created_at)
            .limit(limit)
        ).all()

    return TextSearchResponse(
        query=q,
        results=[
            TextSearchResponseItem(
                document_id=str(sheet.document_id),
                sheet_id=str(sheet.id),
                page_index=text.page_index,
                text=text.text,
                bbox=[text.bbox_x0, text.bbox_y0, text.bbox_x1, text.bbox_y1],
            )
            for text, sheet in rows
        ],
    )

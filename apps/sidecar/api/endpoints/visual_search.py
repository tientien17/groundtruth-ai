"""Region-based visual search endpoints."""
from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from database import get_session, init_db
from models import Sheet, SheetRender
from services.visual_search import BBox, VisualSearchService

router = APIRouter(prefix="/projects", tags=["visual-search"])


class VisualSearchRequest(BaseModel):
    sheet_id: UUID
    bbox: list[float] = Field(..., min_length=4, max_length=4)
    limit: int = Field(default=20, ge=1, le=50)
    threshold: float = Field(default=0.88, ge=0.0, le=1.0)


class VisualSearchCandidate(BaseModel):
    bbox: list[float]
    score: float


class VisualSearchResponse(BaseModel):
    sheet_id: str
    candidates: list[VisualSearchCandidate]


def _resolve_render_path(project_path: Path, render_path: str) -> Path:
    path = Path(render_path)
    if path.is_absolute():
        return path
    return (project_path / path).resolve()


@router.post("/{project_id}/visual-search")
async def visual_search(
    project_id: UUID,
    body: VisualSearchRequest,
    project_path: str = Query(...),
) -> VisualSearchResponse:
    """Find visually similar regions on current sheet only."""
    resolved_project_path = Path(project_path).expanduser().resolve()
    db_path = resolved_project_path / "project.sqlite"
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Project database not found")

    init_db(db_path)
    with get_session(db_path) as session:
        sheet = (
            session.query(Sheet)
            .join(Sheet.document)
            .filter(Sheet.id == body.sheet_id, Sheet.document.has(project_id=project_id))
            .first()
        )
        if sheet is None:
            raise HTTPException(status_code=404, detail="Sheet not found")

        render = session.query(SheetRender).filter(SheetRender.sheet_id == body.sheet_id).first()
        if render is None:
            raise HTTPException(status_code=404, detail="Sheet render not found")
        render_path = _resolve_render_path(resolved_project_path, render.render_path)

    bbox = BBox(x0=body.bbox[0], y0=body.bbox[1], x1=body.bbox[2], y1=body.bbox[3])
    try:
        matches = VisualSearchService(render_path).search(
            bbox,
            limit=body.limit,
            threshold=body.threshold,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Render image not found") from exc

    return VisualSearchResponse(
        sheet_id=str(body.sheet_id),
        candidates=[
            VisualSearchCandidate(
                bbox=[match.bbox.x0, match.bbox.y0, match.bbox.x1, match.bbox.y1],
                score=match.score,
            )
            for match in matches
        ],
    )

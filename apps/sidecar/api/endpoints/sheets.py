"""Sheet library API endpoints – list, detail, and metadata editing."""
from __future__ import annotations

from pathlib import Path
from typing import Any
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from database import get_session, init_db
from models import Sheet, SheetRender

router = APIRouter(prefix="/projects", tags=["sheets"])


class SheetSummary(BaseModel):
    id: str
    document_id: str
    sheet_number: str
    sheet_title: str | None
    page_index: int
    thumbnail_url: str | None
    sheet_metadata: dict[str, Any]


class SheetUpdateRequest(BaseModel):
    sheet_number: str | None = None
    sheet_title: str | None = None


class SheetUpdateResponse(BaseModel):
    id: str
    sheet_number: str
    sheet_title: str | None
    sheet_metadata: dict[str, Any]


@router.get("/{project_id}/sheets")
async def list_sheets(
    project_id: UUID,
    project_path: str = Query(...),
) -> list[SheetSummary]:
    """List all sheets for a project with thumbnail paths."""
    db_path = Path(project_path).expanduser().resolve() / "project.sqlite"
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Project database not found")

    init_db(db_path)

    with get_session(db_path) as session:
        sheets = (
            session.query(Sheet)
            .join(Sheet.document)
            .filter(Sheet.document.has(project_id=project_id))
            .order_by(Sheet.page_index)
            .all()
        )

        results: list[SheetSummary] = []
        for sheet in sheets:
            render = (
                session.query(SheetRender)
                .filter(SheetRender.sheet_id == sheet.id)
                .first()
            )
            results.append(
                SheetSummary(
                    id=str(sheet.id),
                    document_id=str(sheet.document_id),
                    sheet_number=sheet.sheet_number,
                    sheet_title=sheet.sheet_title,
                    page_index=sheet.page_index,
                    thumbnail_url=f"/projects/{project_id}/sheets/{sheet.id}/image?project_path={quote(project_path)}" if render else None,
                    sheet_metadata=sheet.sheet_metadata or {},
                )
            )

    return results


@router.patch("/{project_id}/sheets/{sheet_id}")
async def update_sheet_metadata(
    project_id: UUID,
    sheet_id: UUID,
    body: SheetUpdateRequest,
    project_path: str = Query(...),
) -> SheetUpdateResponse:
    """Update sheet number and/or title (manual user edit)."""
    db_path = Path(project_path).expanduser().resolve() / "project.sqlite"
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Project database not found")

    init_db(db_path)

    with get_session(db_path) as session:
        sheet = session.get(Sheet, sheet_id)
        if sheet is None:
            raise HTTPException(status_code=404, detail="Sheet not found")

        if body.sheet_number is not None:
            sheet.sheet_number = body.sheet_number
        if body.sheet_title is not None:
            sheet.sheet_title = body.sheet_title

        session.flush()

        return SheetUpdateResponse(
            id=str(sheet.id),
            sheet_number=sheet.sheet_number,
            sheet_title=sheet.sheet_title,
            sheet_metadata=sheet.sheet_metadata or {},
        )


@router.get("/{project_id}/sheets/{sheet_id}/image")
async def get_sheet_image(
    project_id: UUID,
    sheet_id: UUID,
    project_path: str = Query(...),
) -> FileResponse:
    """Serve the rendered page PNG for a sheet."""
    db_path = Path(project_path).expanduser().resolve() / "project.sqlite"
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Project database not found")

    init_db(db_path)

    with get_session(db_path) as session:
        render = (
            session.query(SheetRender)
            .join(Sheet, SheetRender.sheet_id == Sheet.id)
            .join(Sheet.document)
            .filter(SheetRender.sheet_id == sheet_id, Sheet.document.has(project_id=project_id))
            .first()
        )

        if render is None:
            raise HTTPException(status_code=404, detail="Render not found")

        render_path = Path(render.render_path)
        if not render_path.is_file():
            raise HTTPException(status_code=404, detail="Render file not found")

        return FileResponse(render_path, media_type="image/png")

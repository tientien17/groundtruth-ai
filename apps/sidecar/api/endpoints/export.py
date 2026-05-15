"""Export API endpoints."""
from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from database import get_session, init_db
from services.export import build_takeoff_export_workbook  # type: ignore[reportMissingImports]
from services.pdf_export import build_annotated_pdf  # type: ignore[reportMissingImports]

router = APIRouter(prefix="/projects", tags=["export"])


@router.get("/{project_id}/export.xlsx")
async def export_project_quantities(
    project_id: UUID,
    project_path: str = Query(...),
    sheet_id: UUID | None = Query(default=None),
) -> StreamingResponse:
    """Download quantity takeoffs as an Excel workbook."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    with get_session(db_path) as session:
        workbook = build_takeoff_export_workbook(session, project_id, sheet_id)

    filename = "takeoff-quantities.xlsx"
    return StreamingResponse(
        workbook,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{project_id}/documents/{document_id}/export.pdf")
async def export_annotated_pdf(
    project_id: UUID,
    document_id: UUID,
    project_path: str = Query(...),
) -> StreamingResponse:
    """Download source PDF copy annotated with takeoff geometry."""
    db_path = _project_db_path(project_path)
    init_db(db_path)

    try:
        with get_session(db_path) as session:
            pdf = build_annotated_pdf(session, project_id, document_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    filename = "annotated-takeoff.pdf"
    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _project_db_path(project_path: str) -> Path:
    db_path = Path(project_path).expanduser().resolve() / "project.sqlite"
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Project database not found")
    return db_path

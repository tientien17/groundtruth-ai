"""Document ingestion API endpoints."""
from __future__ import annotations

import tempfile
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from services.ingestion import ingest_pdf


router = APIRouter(prefix="/projects", tags=["documents"])


@router.post("/{project_id}/ingest")
async def ingest_document(
    project_id: UUID,
    project_path: str = Form(...),
    file: UploadFile = File(...),
):
    """Ingest one uploaded PDF into project file storage and SQLite."""
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")

    filename = file.filename or "document.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF uploads are supported")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
        temp_path = Path(temp_file.name)
        temp_file.write(await file.read())

    try:
        result = ingest_pdf(
            project_id=project_id,
            project_path=Path(project_path),
            source_pdf=temp_path,
            filename=filename,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        temp_path.unlink(missing_ok=True)

    return {
        "document_id": str(result.document_id),
        "filename": result.filename,
        "stored_path": result.stored_path,
        "page_count": result.page_count,
        "encrypted": result.encrypted,
        "pages": [page.__dict__ for page in result.pages],
    }

"""PDF ingestion, metadata extraction, and page thumbnail rendering."""
from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID, uuid4

import fitz
from sqlalchemy.orm import Session

from database import get_session, init_db
from models import Document, Project, Sheet, SheetRender, SheetText
from services.sheet_metadata import extract_sheet_metadata
from services.text_extraction import extract_document_text_with_session
from services.vector_store import LocalVectorStore  # type: ignore[reportMissingImports]


@dataclass(frozen=True)
class PageMetadata:
    page_index: int
    width_pt: float
    height_pt: float
    thumbnail_path: str
    width_px: int
    height_px: int


@dataclass(frozen=True)
class IngestionResult:
    document_id: UUID
    filename: str
    stored_path: str
    page_count: int
    encrypted: bool
    pages: list[PageMetadata]


def ingest_pdf(project_id: UUID, project_path: Path, source_pdf: Path, filename: str | None = None) -> IngestionResult:
    """Copy a PDF into a project, render page thumbnails, and create DB rows."""
    if not source_pdf.exists():
        raise FileNotFoundError(source_pdf)

    project_path = project_path.expanduser().resolve()
    documents_dir = project_path / "documents"
    documents_dir.mkdir(parents=True, exist_ok=True)

    db_path = project_path / "project.sqlite"
    init_db(db_path)

    document_id = uuid4()
    safe_filename = _safe_pdf_filename(filename or source_pdf.name)
    stored_pdf = documents_dir / f"{document_id}_{safe_filename}"
    shutil.copyfile(source_pdf, stored_pdf)

    cache_dir = documents_dir / ".cache" / str(document_id)
    cache_dir.mkdir(parents=True, exist_ok=True)

    pages = _render_pages(stored_pdf, cache_dir)

    with fitz.open(stored_pdf) as pdf:
        encrypted = bool(pdf.is_encrypted)
        page_count = pdf.page_count

    with get_session(db_path) as session:
        project = session.get(Project, project_id)
        if project is None:
            session.add(Project(id=project_id, name=project_path.stem, path=str(project_path)))

        document = Document(
            id=document_id,
            project_id=project_id,
            filename=safe_filename,
            original_path=str(stored_pdf),
        )
        session.add(document)

        for page in pages:
            sheet = Sheet(
                id=uuid4(),
                document_id=document_id,
                sheet_number=f"P{page.page_index + 1}",
                page_index=page.page_index,
            )
            session.add(sheet)
            session.add(
                SheetRender(
                    id=uuid4(),
                    sheet_id=sheet.id,
                    render_path=page.thumbnail_path,
                    width_px=page.width_px,
                    height_px=page.height_px,
                )
            )

        session.flush()
        extract_document_text_with_session(session, stored_pdf, document_id)

        # Extract sheet metadata from text content
        _update_sheet_metadata(session, document_id)
        LocalVectorStore(project_path).index_document(session, project_id, document_id)

    return IngestionResult(
        document_id=document_id,
        filename=safe_filename,
        stored_path=str(stored_pdf),
        page_count=page_count,
        encrypted=encrypted,
        pages=pages,
    )


def _render_pages(pdf_path: Path, cache_dir: Path, zoom: float = 2.0) -> list[PageMetadata]:
    pages: list[PageMetadata] = []
    matrix = fitz.Matrix(zoom, zoom)

    with fitz.open(pdf_path) as pdf:
        for page_index in range(pdf.page_count):
            page = pdf.load_page(page_index)
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            output_path = cache_dir / f"page-{page_index + 1:04d}.png"
            pixmap.save(output_path)
            rect = page.rect
            pages.append(
                PageMetadata(
                    page_index=page_index,
                    width_pt=float(rect.width),
                    height_pt=float(rect.height),
                    thumbnail_path=str(output_path),
                    width_px=pixmap.width,
                    height_px=pixmap.height,
                )
            )

    return pages


def _safe_pdf_filename(filename: str) -> str:
    clean = Path(filename).name.replace("/", "_").replace("\\", "_")
    if not clean.lower().endswith(".pdf"):
        clean = f"{clean}.pdf"
    return clean


def _update_sheet_metadata(session: Session, document_id: UUID) -> None:
    """Run metadata extraction on each sheet's text and update DB rows."""
    sheets = session.query(Sheet).filter(Sheet.document_id == document_id).all()
    for sheet in sheets:
        text_rows = (
            session.query(SheetText)
            .filter(SheetText.sheet_id == sheet.id)
            .all()
        )
        full_text = "\n".join(row.text for row in text_rows)
        if not full_text.strip():
            continue

        result = extract_sheet_metadata(full_text)
        if result.sheet_number:
            sheet.sheet_number = result.sheet_number
        if result.sheet_title:
            sheet.sheet_title = result.sheet_title
        sheet.sheet_metadata = {
            "discipline": result.discipline,
            "raw_matches": result.raw_matches,
        }

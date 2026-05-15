"""Tests for PDF ingestion service."""
from __future__ import annotations

import sqlite3
from pathlib import Path
from uuid import UUID

import fitz

from services.ingestion import ingest_pdf


def make_pdf(path: Path, page_count: int = 5) -> None:
    pdf = fitz.open()
    for index in range(page_count):
        page = pdf.new_page(width=612, height=792)
        page.insert_text((72, 72), f"Page {index + 1}")
    pdf.save(path)
    pdf.close()


def test_ingest_pdf_creates_pngs_and_sheet_rows(tmp_path: Path):
    project_id = UUID("00000000-0000-0000-0000-000000000008")
    project_path = tmp_path / "Takeoff.gtl"
    project_path.mkdir()
    source_pdf = tmp_path / "source.pdf"
    make_pdf(source_pdf, page_count=5)

    result = ingest_pdf(project_id, project_path, source_pdf, "plans.pdf")

    assert result.page_count == 5
    assert Path(result.stored_path).exists()
    assert Path(result.stored_path).parent == project_path / "documents"

    cache_dir = project_path / "documents" / ".cache" / str(result.document_id)
    thumbnails = sorted(cache_dir.glob("*.png"))
    assert len(thumbnails) == 5

    conn = sqlite3.connect(project_path / "project.sqlite")
    document_count = conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
    sheet_count = conn.execute("SELECT COUNT(*) FROM sheets").fetchone()[0]
    render_count = conn.execute("SELECT COUNT(*) FROM sheet_renders").fetchone()[0]
    text_count = conn.execute("SELECT COUNT(*) FROM sheet_text").fetchone()[0]
    block_count = conn.execute("SELECT COUNT(*) FROM sheet_text_blocks").fetchone()[0]
    conn.close()

    assert document_count == 1
    assert sheet_count == 5
    assert render_count == 5
    assert text_count >= 5
    assert block_count >= 5

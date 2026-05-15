"""Tests for native-first PDF text extraction service."""
from __future__ import annotations

import sqlite3
from pathlib import Path
from uuid import UUID

import fitz

from services.ingestion import ingest_pdf


def make_native_text_pdf(path: Path) -> None:
    pdf = fitz.open()
    page1 = pdf.new_page(width=612, height=792)
    page1.insert_text((72, 72), "Alpha One")
    page2 = pdf.new_page(width=612, height=792)
    page2.insert_text((72, 144), "Beta Two")
    pdf.save(path)
    pdf.close()


def test_ingest_pdf_extracts_native_text_and_blocks(tmp_path: Path):
    project_id = UUID("00000000-0000-0000-0000-000000000009")
    project_path = tmp_path / "Takeoff.gtl"
    project_path.mkdir()
    source_pdf = tmp_path / "native.pdf"
    make_native_text_pdf(source_pdf)

    result = ingest_pdf(project_id, project_path, source_pdf, "plans.pdf")

    conn = sqlite3.connect(project_path / "project.sqlite")
    rows = conn.execute(
        "SELECT page_index, text, bbox_x0, bbox_y0, bbox_x1, bbox_y1, source FROM sheet_text ORDER BY page_index, text"
    ).fetchall()
    block_rows = conn.execute(
        "SELECT text, bbox_x, bbox_y, bbox_w, bbox_h FROM sheet_text_blocks ORDER BY rowid"
    ).fetchall()
    conn.close()

    assert result.page_count == 2
    assert len(rows) >= 2
    assert any(row[1] == "Alpha One" for row in rows)
    assert any(row[1] == "Beta Two" for row in rows)
    assert all(row[6] == "native" for row in rows)
    assert all(row[2] >= 0 and row[3] >= 0 for row in rows)
    assert all(row[4] > row[2] and row[5] > row[3] for row in rows)

    assert len(block_rows) >= 2
    assert any("Alpha One" in row[0] for row in block_rows)
    assert any("Beta Two" in row[0] for row in block_rows)
    assert all(row[3] > 0 and row[4] > 0 for row in block_rows)

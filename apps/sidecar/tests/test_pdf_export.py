"""Tests for annotated PDF export."""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

import fitz  # type: ignore[reportMissingModuleSource]
from fastapi.testclient import TestClient

from database import get_session, init_db
from main import create_app
from models import Classification, Document, Project, Sheet, TakeoffGeometry, TakeoffItem


PROJECT_ID = UUID("00000000-0000-0000-0000-000000000017")
DOCUMENT_ID = UUID("00000000-0000-0000-0000-000000000117")
SHEET_ONE_ID = UUID("00000000-0000-0000-0000-000000001017")
SHEET_TWO_ID = UUID("00000000-0000-0000-0000-000000002017")
WALL_CLASS_ID = UUID("00000000-0000-0000-0000-000000010017")
AREA_CLASS_ID = UUID("00000000-0000-0000-0000-000000020017")
POINT_CLASS_ID = UUID("00000000-0000-0000-0000-000000030017")


def create_pdf_export_project(tmp_path: Path) -> Path:
    project_path = tmp_path / "PdfExport.gtl"
    project_path.mkdir()
    source_pdf = project_path / "plans.pdf"
    _write_source_pdf(source_pdf)

    db_path = project_path / "project.sqlite"
    init_db(db_path)
    with get_session(db_path) as session:
        session.add(Project(id=PROJECT_ID, name="PDF Export", path=str(project_path)))
        session.add(
            Document(
                id=DOCUMENT_ID,
                project_id=PROJECT_ID,
                filename="plans.pdf",
                original_path=str(source_pdf),
            )
        )
        session.add_all(
            [
                Sheet(id=SHEET_ONE_ID, document_id=DOCUMENT_ID, sheet_number="A-101", sheet_title="Plan", page_index=0),
                Sheet(id=SHEET_TWO_ID, document_id=DOCUMENT_ID, sheet_number="A-102", sheet_title="Roof", page_index=1),
            ]
        )
        session.add_all(
            [
                Classification(id=WALL_CLASS_ID, project_id=PROJECT_ID, name="Walls", color="#2563EB", unit="ft"),
                Classification(id=AREA_CLASS_ID, project_id=PROJECT_ID, name="Slabs", color="#16A34A", unit="sf"),
                Classification(id=POINT_CLASS_ID, project_id=PROJECT_ID, name="Posts", color="#DC2626", unit="count"),
            ]
        )
        _add_item(session, SHEET_ONE_ID, WALL_CLASS_ID, "linear", "path", [{"x": 36, "y": 72}, {"x": 180, "y": 72}], 12, "ft")
        _add_item(session, SHEET_ONE_ID, AREA_CLASS_ID, "area", "polygon", [{"x": 72, "y": 120}, {"x": 180, "y": 120}, {"x": 180, "y": 210}], 48, "sf")
        _add_item(session, SHEET_TWO_ID, POINT_CLASS_ID, "count", "point", [{"x": 90, "y": 90}], 1, "count")
    return project_path


def test_pdf_export_endpoint_returns_annotated_copy_for_all_pages(tmp_path: Path):
    project_path = create_pdf_export_project(tmp_path)
    source_pdf = project_path / "plans.pdf"
    source_size = source_pdf.stat().st_size
    client = TestClient(create_app())

    response = client.get(
        f"/projects/{PROJECT_ID}/documents/{DOCUMENT_ID}/export.pdf",
        params={"project_path": str(project_path)},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/pdf")
    assert len(response.content) > source_size
    assert source_pdf.stat().st_size == source_size

    annotated = fitz.open(stream=BytesIO(response.content), filetype="pdf")
    try:
        assert annotated.page_count == 3
        assert "Walls: 12 ft" in annotated[0].get_text()
        assert "Slabs: 48 sf" in annotated[0].get_text()
        assert "Posts: 1 count" in annotated[1].get_text()
        assert "Takeoff Legend" in annotated[2].get_text()
    finally:
        annotated.close()


def _write_source_pdf(path: Path) -> None:
    pdf = fitz.open()
    for label in ("Page 1", "Page 2"):
        page = pdf.new_page(width=300, height=300)
        page.insert_text(fitz.Point(36, 36), label, fontsize=12)
    pdf.save(path)
    pdf.close()


def _add_item(session, sheet_id, classification_id, item_type, geometry_type, points, quantity, unit) -> None:
    item = TakeoffItem(
        id=uuid4(),
        sheet_id=sheet_id,
        classification_id=classification_id,
        type=item_type,
        geometry_json={},
        source="manual",
        quantity_raw=quantity,
        quantity_unit=unit,
        formulas={},
        created_by="tester",
    )
    session.add(item)
    session.flush()
    session.add(
        TakeoffGeometry(
            id=uuid4(),
            takeoff_item_id=item.id,
            geometry_type=geometry_type,
            points=points,
            holes=[],
            scale=1,
            scale_unit=unit,
        )
    )

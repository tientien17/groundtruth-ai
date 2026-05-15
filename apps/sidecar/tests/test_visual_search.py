"""Tests for local visual region search."""
from __future__ import annotations

from pathlib import Path
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from database import get_session, init_db
from main import create_app
from models import Document, Project, Sheet, SheetRender
from services.visual_search import BBox, VisualSearchService


PROJECT_ID = UUID("00000000-0000-0000-0000-000000000023")
DOCUMENT_ID = UUID("00000000-0000-0000-0000-000000000123")
SHEET_ID = UUID("00000000-0000-0000-0000-000000001023")


def create_visual_project(tmp_path: Path) -> tuple[Path, Path]:
    project_path = tmp_path / "Visual.gtl"
    project_path.mkdir()
    render_path = project_path / ".cache" / "sheet.png"
    render_path.parent.mkdir()

    image = Image.new("RGB", (160, 120), "white")
    draw = ImageDraw.Draw(image)
    for x, y in [(20, 20), (80, 20), (80, 70)]:
        draw.rectangle((x, y, x + 12, y + 12), outline="black", width=2)
        draw.line((x + 2, y + 6, x + 10, y + 6), fill="black", width=2)
    image.save(render_path)

    db_path = project_path / "project.sqlite"
    init_db(db_path)
    with get_session(db_path) as session:
        session.add(Project(id=PROJECT_ID, name="Visual", path=str(project_path)))
        session.add(
            Document(
                id=DOCUMENT_ID,
                project_id=PROJECT_ID,
                filename="plans.pdf",
                original_path=str(project_path / "plans.pdf"),
            )
        )
        session.add(Sheet(id=SHEET_ID, document_id=DOCUMENT_ID, sheet_number="FP-101", page_index=0))
        session.add(
            SheetRender(
                id=uuid4(),
                sheet_id=SHEET_ID,
                render_path=str(render_path),
                width_px=160,
                height_px=120,
            )
        )
    return project_path, render_path


def test_visual_search_service_returns_similar_regions(tmp_path: Path):
    _project_path, render_path = create_visual_project(tmp_path)

    matches = VisualSearchService(render_path).search(BBox(20, 20, 32, 32), threshold=0.98, limit=5)

    assert len(matches) >= 3
    boxes = [(round(match.bbox.x0), round(match.bbox.y0)) for match in matches]
    assert (20, 20) in boxes
    assert (80, 20) in boxes
    assert (80, 70) in boxes


def test_visual_search_endpoint_returns_candidates(tmp_path: Path):
    project_path, _render_path = create_visual_project(tmp_path)
    client = TestClient(create_app())

    response = client.post(
        f"/projects/{PROJECT_ID}/visual-search",
        params={"project_path": str(project_path)},
        json={"sheet_id": str(SHEET_ID), "bbox": [20, 20, 32, 32], "threshold": 0.98},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["sheet_id"] == str(SHEET_ID)
    assert len(payload["candidates"]) >= 3

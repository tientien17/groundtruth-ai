"""Tests for sheet API endpoints – image serving and list thumbnail URLs."""
from __future__ import annotations

from pathlib import Path
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from database import get_session, init_db
from main import create_app
from models import Document, Project, Sheet, SheetRender

PROJECT_ID = UUID("00000000-0000-0000-0000-000000000023")
DOCUMENT_ID = UUID("00000000-0000-0000-0000-000000000123")
SHEET_ID = UUID("00000000-0000-0000-0000-000000001023")


def _create_project_with_render(tmp_path: Path) -> Path:
    """Set up a full project with a SheetRender pointing to a real PNG file.

    Returns the project_path for use as the ``project_path`` query parameter.
    """
    project_path = tmp_path / "TestProject.gtl"
    project_path.mkdir(parents=True)
    db_path = project_path / "project.sqlite"
    init_db(db_path)

    render_dir = project_path / "renders"
    render_dir.mkdir(parents=True)
    render_path = render_dir / "sheet.png"
    # Minimal valid PNG signature (the endpoint does not validate content beyond
    # serving whatever file exists at render_path).
    render_path.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)

    with get_session(db_path) as session:
        session.add(
            Project(id=PROJECT_ID, name="TestProject", path=str(project_path))
        )
        session.add(
            Document(
                id=DOCUMENT_ID,
                project_id=PROJECT_ID,
                filename="test.pdf",
                original_path=str(project_path / "test.pdf"),
            )
        )
        session.add(
            Sheet(
                id=SHEET_ID,
                document_id=DOCUMENT_ID,
                sheet_number="A-101",
                page_index=0,
            )
        )
        session.add(
            SheetRender(
                id=uuid4(),
                sheet_id=SHEET_ID,
                render_path=str(render_path),
                width_px=1,
                height_px=1,
            )
        )

    return project_path


def test_get_sheet_image_returns_png(tmp_path: Path):
    """GET /{project_id}/sheets/{sheet_id}/image returns the render PNG."""
    project_path = _create_project_with_render(tmp_path)
    client = TestClient(create_app())

    response = client.get(
        f"/projects/{PROJECT_ID}/sheets/{SHEET_ID}/image",
        params={"project_path": str(project_path)},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_get_sheet_image_invalid_sheet_returns_404(tmp_path: Path):
    """GET image with a non-existent sheet_id returns 404."""
    project_path = _create_project_with_render(tmp_path)
    client = TestClient(create_app())
    bad_id = uuid4()

    response = client.get(
        f"/projects/{PROJECT_ID}/sheets/{bad_id}/image",
        params={"project_path": str(project_path)},
    )
    assert response.status_code == 404


def test_list_sheets_thumbnail_url_is_url_path(tmp_path: Path):
    """list_sheets returns ``thumbnail_url`` as a URL path, not a filesystem path."""
    project_path = _create_project_with_render(tmp_path)
    client = TestClient(create_app())

    response = client.get(
        f"/projects/{PROJECT_ID}/sheets",
        params={"project_path": str(project_path)},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    sheet = data[0]
    assert sheet["sheet_number"] == "A-101"

    thumbnail_url = sheet["thumbnail_url"]
    assert thumbnail_url is not None
    assert thumbnail_url.startswith("/projects/")
    assert str(SHEET_ID) in thumbnail_url
    assert "image" in thumbnail_url

"""Tests for offline semantic search."""
from __future__ import annotations

from pathlib import Path
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from database import get_session, init_db
from main import create_app
from models import Document, Project, Sheet, SheetText
from services.vector_store import LocalVectorStore  # type: ignore[reportMissingImports]


PROJECT_ID = UUID("00000000-0000-0000-0000-000000000018")
DOCUMENT_ID = UUID("00000000-0000-0000-0000-000000000118")
SHEET_ID = UUID("00000000-0000-0000-0000-000000001018")
SHEET_ID_PAGE_2 = UUID("00000000-0000-0000-0000-000000002018")


def create_indexed_project(tmp_path: Path) -> Path:
    project_path = tmp_path / "Takeoff.gtl"
    project_path.mkdir()
    db_path = project_path / "project.sqlite"
    init_db(db_path)

    with get_session(db_path) as session:
        session.add(Project(id=PROJECT_ID, name="Takeoff", path=str(project_path)))
        session.add(
            Document(
                id=DOCUMENT_ID,
                project_id=PROJECT_ID,
                filename="plans.pdf",
                original_path=str(project_path / "plans.pdf"),
            )
        )
        session.add(Sheet(id=SHEET_ID, document_id=DOCUMENT_ID, sheet_number="A-101", page_index=0))
        session.add(Sheet(id=SHEET_ID_PAGE_2, document_id=DOCUMENT_ID, sheet_number="A-102", page_index=1))
        session.add(
            SheetText(
                id=uuid4(),
                sheet_id=SHEET_ID,
                page_index=0,
                text="storm drain trench detail and inlet protection",
                bbox_x0=1,
                bbox_y0=2,
                bbox_x1=30,
                bbox_y1=40,
                source="native",
            )
        )
        session.add(
            SheetText(
                id=uuid4(),
                sheet_id=SHEET_ID,
                page_index=0,
                text="office partition wall finish schedule",
                bbox_x0=50,
                bbox_y0=60,
                bbox_x1=90,
                bbox_y1=100,
                source="native",
            )
        )
        session.add(
            SheetText(
                id=uuid4(),
                sheet_id=SHEET_ID_PAGE_2,
                page_index=1,
                text="SD-1 riser diagram",
                bbox_x0=10,
                bbox_y0=20,
                bbox_x1=30,
                bbox_y1=45,
                source="native",
            )
        )
        session.flush()
        indexed_count = LocalVectorStore(project_path).index_document(session, PROJECT_ID, DOCUMENT_ID)

    assert indexed_count == 3
    return project_path


def test_semantic_search_returns_ranked_project_vectors(tmp_path: Path):
    project_path = create_indexed_project(tmp_path)
    client = TestClient(create_app())

    response = client.get(
        f"/projects/{PROJECT_ID}/search",
        params={"project_path": str(project_path), "q": "storm drain", "limit": 5},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["query"] == "storm drain"
    assert payload["results"]
    assert payload["results"][0]["text"] == "storm drain trench detail and inlet protection"
    assert payload["results"][0]["document_id"] == str(DOCUMENT_ID)
    assert payload["results"][0]["sheet_id"] == str(SHEET_ID)
    assert payload["results"][0]["page_index"] == 0
    assert payload["results"][0]["score"] > 0
    assert (project_path / "vectors" / "sheet_text.jsonl").exists()


def test_text_search_returns_multi_page_pdf_point_bboxes(tmp_path: Path):
    project_path = create_indexed_project(tmp_path)
    client = TestClient(create_app())

    response = client.get(
        f"/projects/{PROJECT_ID}/text-search",
        params={"project_path": str(project_path), "q": "SD-1", "limit": 10},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["query"] == "SD-1"
    assert payload["results"] == [
        {
            "document_id": str(DOCUMENT_ID),
            "sheet_id": str(SHEET_ID_PAGE_2),
            "page_index": 1,
            "text": "SD-1 riser diagram",
            "bbox": [10, 20, 30, 45],
        }
    ]

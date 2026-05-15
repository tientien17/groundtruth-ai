"""Tests for takeoff item API endpoints."""
from __future__ import annotations

from pathlib import Path
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from database import get_session, init_db
from main import create_app
from models import Document, Project, Sheet


PROJECT_ID = UUID("00000000-0000-0000-0000-000000000013")
DOCUMENT_ID = UUID("00000000-0000-0000-0000-000000000113")
SHEET_ID = UUID("00000000-0000-0000-0000-000000001013")


def create_project_with_sheet(tmp_path: Path) -> Path:
    project_path = tmp_path / "Takeoff.gtl"
    project_path.mkdir()
    db_path = project_path / "project.sqlite"
    init_db(db_path)

    with get_session(db_path) as session:
        session.add(
            Project(
                id=PROJECT_ID,
                name="Takeoff",
                path=str(project_path),
            )
        )
        session.add(
            Document(
                id=DOCUMENT_ID,
                project_id=PROJECT_ID,
                filename="plans.pdf",
                original_path=str(project_path / "plans.pdf"),
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

    return project_path


def test_create_list_update_and_delete_takeoff_item(tmp_path: Path):
    project_path = create_project_with_sheet(tmp_path)
    client = TestClient(create_app())
    sheet_path = f"/projects/{PROJECT_ID}/sheets/{SHEET_ID}/takeoff-items"
    query = {"project_path": str(project_path)}

    create_response = client.post(
        sheet_path,
        params=query,
        json={
            "type": "linear",
            "geometry": {
                "kind": "path",
                "points": [{"x": 0, "y": 0}, {"x": 3, "y": 4}],
                "scale": 2,
                "scale_unit": "ft",
            },
        },
    )
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["sheet_id"] == str(SHEET_ID)
    assert created["quantity_raw"] == 10.0
    assert created["quantity_unit"] == "ft"
    assert created["geometry"]["kind"] == "path"

    list_response = client.get(sheet_path, params=query)
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [created["id"]]

    update_response = client.patch(
        f"/projects/{PROJECT_ID}/takeoff-items/{created['id']}",
        params=query,
        json={
            "type": "area",
            "geometry": {
                "kind": "polygon",
                "points": [
                    {"x": 0, "y": 0},
                    {"x": 10, "y": 0},
                    {"x": 10, "y": 10},
                    {"x": 0, "y": 10},
                ],
                "scale": 1,
                "scale_unit": "ft",
            },
        },
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["type"] == "area"
    assert updated["quantity_raw"] == 100.0
    assert updated["quantity_unit"] == "sq ft"
    assert updated["geometry"]["kind"] == "polygon"

    delete_response = client.delete(
        f"/projects/{PROJECT_ID}/takeoff-items/{created['id']}",
        params=query,
    )
    assert delete_response.status_code == 200
    assert delete_response.json()["status"] == "deleted"

    assert client.get(sheet_path, params=query).json() == []


def test_takeoff_api_rejects_items_outside_project(tmp_path: Path):
    project_path = create_project_with_sheet(tmp_path)
    client = TestClient(create_app())
    other_project_id = uuid4()

    response = client.post(
        f"/projects/{other_project_id}/sheets/{SHEET_ID}/takeoff-items",
        params={"project_path": str(project_path)},
        json={
            "type": "count",
            "geometry": {"kind": "point", "points": [{"x": 1, "y": 1}]},
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Sheet not found"


def test_takeoff_api_bulk_create(tmp_path: Path):
    project_path = create_project_with_sheet(tmp_path)
    client = TestClient(create_app())
    sheet_path = f"/projects/{PROJECT_ID}/sheets/{SHEET_ID}/takeoff-items/bulk"
    query = {"project_path": str(project_path)}

    response = client.post(
        sheet_path,
        params=query,
        json={
            "items": [
                {
                    "type": "count",
                    "source": "text_search",
                    "geometry": {
                        "kind": "point",
                        "points": [{"x": 100, "y": 200}],
                    },
                },
                {
                    "type": "count",
                    "source": "text_search",
                    "geometry": {
                        "kind": "point",
                        "points": [{"x": 300, "y": 400}],
                    },
                }
            ]
        },
    )

    assert response.status_code == 200
    created_items = response.json()
    assert len(created_items) == 2
    assert created_items[0]["type"] == "count"
    assert created_items[0]["source"] == "text_search"
    assert created_items[0]["geometry"]["kind"] == "point"
    assert created_items[0]["geometry"]["points"] == [{"x": 100.0, "y": 200.0}]
    assert created_items[1]["geometry"]["points"] == [{"x": 300.0, "y": 400.0}]

    list_response = client.get(f"/projects/{PROJECT_ID}/sheets/{SHEET_ID}/takeoff-items", params=query)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 2

def test_takeoff_api_rejects_mismatched_geometry_kind(tmp_path: Path):
    project_path = create_project_with_sheet(tmp_path)
    client = TestClient(create_app())

    response = client.post(
        f"/projects/{PROJECT_ID}/sheets/{SHEET_ID}/takeoff-items",
        params={"project_path": str(project_path)},
        json={
            "type": "linear",
            "geometry": {"kind": "polygon", "points": [{"x": 1, "y": 1}]},
        },
    )

    assert response.status_code == 400
    assert "does not match" in response.json()["detail"]


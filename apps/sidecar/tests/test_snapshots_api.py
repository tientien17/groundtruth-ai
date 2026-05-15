"""Tests for snapshot API endpoints."""
from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi.testclient import TestClient

from database import get_session, init_db
from main import create_app
from models import Document, Project, Sheet, TakeoffGeometry, TakeoffItem


PROJECT_ID = UUID("00000000-0000-0000-0000-000000000215")
DOCUMENT_ID = UUID("00000000-0000-0000-0000-000000000216")
SHEET_ID = UUID("00000000-0000-0000-0000-000000000217")
TAKEOFF_ID = UUID("00000000-0000-0000-0000-000000000218")
GEOMETRY_ID = UUID("00000000-0000-0000-0000-000000000219")


def create_project_with_takeoff(tmp_path: Path) -> Path:
    project_path = tmp_path / "Snapshots.gtl"
    project_path.mkdir()
    db_path = project_path / "project.sqlite"
    init_db(db_path)

    with get_session(db_path) as session:
        session.add(Project(id=PROJECT_ID, name="Snapshots", path=str(project_path)))
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
        session.add(
            TakeoffItem(
                id=TAKEOFF_ID,
                sheet_id=SHEET_ID,
                type="linear",
                source="manual",
                quantity_raw=12.5,
                quantity_unit="ft",
                formulas={"waste": "QTY * 1.05"},
                created_by="local-user",
            )
        )
        session.add(
            TakeoffGeometry(
                id=GEOMETRY_ID,
                takeoff_item_id=TAKEOFF_ID,
                geometry_type="path",
                points=[{"x": 0, "y": 0}, {"x": 10, "y": 0}],
                scale=1,
                scale_unit="ft",
            )
        )

    return project_path


def test_create_list_get_rename_and_delete_snapshot(tmp_path: Path):
    project_path = create_project_with_takeoff(tmp_path)
    client = TestClient(create_app())
    path = f"/projects/{PROJECT_ID}/snapshots"
    query = {"project_path": str(project_path)}

    create_response = client.post(path, params=query, json={"name": "Baseline"})
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["name"] == "Baseline"
    assert created["snapshot_json"]["version"] == 1
    assert created["snapshot_json"]["takeoff_items"][0]["id"] == str(TAKEOFF_ID)
    assert created["snapshot_json"]["takeoff_items"][0]["geometry"]["kind"] == "path"

    list_response = client.get(path, params=query)
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [created["id"]]

    get_response = client.get(f"{path}/{created['id']}", params=query)
    assert get_response.status_code == 200
    assert get_response.json()["id"] == created["id"]

    rename_response = client.patch(
        f"{path}/{created['id']}", params=query, json={"name": "Issued set"}
    )
    assert rename_response.status_code == 200
    assert rename_response.json()["name"] == "Issued set"

    delete_response = client.delete(f"{path}/{created['id']}", params=query)
    assert delete_response.status_code == 200
    assert delete_response.json()["status"] == "deleted"
    assert client.get(path, params=query).json() == []

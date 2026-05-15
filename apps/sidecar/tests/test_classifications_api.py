"""Tests for classification CRUD API endpoints."""
from __future__ import annotations

from pathlib import Path
from uuid import UUID

from fastapi.testclient import TestClient

from database import get_session, init_db
from main import create_app
from models import Project


PROJECT_ID = UUID("00000000-0000-0000-0000-000000000015")


def create_project(tmp_path: Path) -> Path:
    project_path = tmp_path / "Classifications.gtl"
    project_path.mkdir()
    db_path = project_path / "project.sqlite"
    init_db(db_path)

    with get_session(db_path) as session:
        session.add(Project(id=PROJECT_ID, name="Classifications", path=str(project_path)))

    return project_path


def test_create_list_update_and_delete_classification(tmp_path: Path):
    project_path = create_project(tmp_path)
    client = TestClient(create_app())
    path = f"/projects/{PROJECT_ID}/classifications"
    query = {"project_path": str(project_path)}

    create_response = client.post(
        path,
        params=query,
        json={"name": "Concrete", "color": "#808080", "unit": "CY"},
    )
    assert create_response.status_code == 200
    created = create_response.json()
    assert created["name"] == "Concrete"
    assert created["color"] == "#808080"
    assert created["unit"] == "CY"

    list_response = client.get(path, params=query)
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [created["id"]]

    update_response = client.patch(
        f"{path}/{created['id']}",
        params=query,
        json={"name": "Rebar", "color": "#ff0000", "unit": "LF"},
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["name"] == "Rebar"
    assert updated["color"] == "#FF0000"
    assert updated["unit"] == "LF"

    delete_response = client.delete(f"{path}/{created['id']}", params=query)
    assert delete_response.status_code == 200
    assert delete_response.json()["status"] == "deleted"

    assert client.get(path, params=query).json() == []


def test_classification_requires_hex_color(tmp_path: Path):
    project_path = create_project(tmp_path)
    client = TestClient(create_app())

    response = client.post(
        f"/projects/{PROJECT_ID}/classifications",
        params={"project_path": str(project_path)},
        json={"name": "Concrete", "color": "red", "unit": "CY"},
    )

    assert response.status_code == 422

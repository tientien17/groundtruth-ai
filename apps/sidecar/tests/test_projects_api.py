"""Tests for project CRUD API endpoints – create and list."""
from __future__ import annotations

import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from config import Settings
from main import create_app


def test_create_project():
    """POST /projects creates a project and returns {id, name, path}.

    Verifies the response shape matches CreateProjectResponse and the
    .gtl directory (with project.sqlite) exists on disk.
    """
    storage_path = Path(tempfile.mkdtemp())
    settings = Settings(storage_path=storage_path)
    client = TestClient(create_app(settings))

    response = client.post("/projects", json={"name": "TestProject"})
    assert response.status_code == 200
    data = response.json()

    assert "id" in data
    assert data["name"] == "TestProject"
    assert data["path"].endswith("TestProject.gtl")

    # Verify the .gtl directory and its database exist on disk
    project_dir = Path(data["path"])
    assert project_dir.is_dir()
    assert (project_dir / "project.sqlite").is_file()


def test_list_projects():
    """GET /projects returns an array of all created projects."""
    storage_path = Path(tempfile.mkdtemp())
    settings = Settings(storage_path=storage_path)
    client = TestClient(create_app(settings))

    client.post("/projects", json={"name": "Alpha"})
    client.post("/projects", json={"name": "Beta"})

    response = client.get("/projects")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    names = [p["name"] for p in data]
    assert "Alpha" in names
    assert "Beta" in names
    # Each entry has the expected shape
    for entry in data:
        assert "id" in entry
        assert "name" in entry
        assert "path" in entry


def test_create_project_empty_name_returns_422():
    """POST /projects with empty name string returns 422 validation error."""
    storage_path = Path(tempfile.mkdtemp())
    settings = Settings(storage_path=storage_path)
    client = TestClient(create_app(settings))

    response = client.post("/projects", json={"name": ""})
    assert response.status_code == 422

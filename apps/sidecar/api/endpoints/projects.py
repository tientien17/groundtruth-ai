"""Project management API endpoints – create and list projects."""
from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from database import get_session, init_db
from models import Project
from services.project_service import create_project

router = APIRouter(prefix="/projects", tags=["projects"])


class CreateProjectRequest(BaseModel):
    name: str = Field(min_length=1, description="Project name (used as folder name)")


class CreateProjectResponse(BaseModel):
    id: str
    name: str
    path: str


class ProjectSummary(BaseModel):
    id: str
    name: str
    path: str


@router.post("", status_code=200)
async def create_project_endpoint(
    body: CreateProjectRequest,
    request: Request,
) -> CreateProjectResponse:
    """Create a new project folder, initialise its database, and return the record."""
    settings = request.app.state.settings

    project_dir = create_project(body.name, settings.storage_path)
    db_path = project_dir / "project.sqlite"

    project_id = uuid4()

    init_db(db_path)

    with get_session(db_path) as session:
        project = Project(
            id=project_id,
            name=body.name,
            path=str(project_dir),
        )
        session.add(project)

    return CreateProjectResponse(
        id=str(project_id),
        name=body.name,
        path=str(project_dir),
    )


@router.get("")
async def list_projects(
    request: Request,
) -> list[ProjectSummary]:
    """List all projects by scanning .gtl directories under storage_path."""
    settings = request.app.state.settings
    storage_path = Path(settings.storage_path).expanduser().resolve()

    results: list[ProjectSummary] = []

    if not storage_path.exists():
        return results

    for item in sorted(storage_path.iterdir()):
        if not item.is_dir() or not item.name.endswith(".gtl"):
            continue

        db_path = item / "project.sqlite"
        if not db_path.exists():
            continue

        init_db(db_path)

        with get_session(db_path) as session:
            project = session.query(Project).first()
            if project is None:
                continue

            results.append(
                ProjectSummary(
                    id=str(project.id),
                    name=project.name,
                    path=str(project.path),
                )
            )

    return results

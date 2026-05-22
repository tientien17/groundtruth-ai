"""Demo project loader endpoint."""
from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Request
from pydantic import BaseModel

from database import get_session
from models import Classification, Document, Project, Sheet, TakeoffGeometry, TakeoffItem
from services.project_service import create_project

demo_router = APIRouter(prefix="/demo", tags=["demo"])


class DemoProjectResponse(BaseModel):
    id: str
    name: str
    path: str


@demo_router.post("/load", status_code=200)
async def load_demo_project(request: Request) -> DemoProjectResponse:
    """Create a demo project folder and seed sample takeoff data."""
    settings = request.app.state.settings
    project_name = "Demo Project"
    project_dir = create_project(name=project_name, path=settings.storage_path)
    db_path = project_dir / "project.sqlite"

    project_id = uuid4()
    document_id = uuid4()
    ground_floor_id = uuid4()
    first_floor_id = uuid4()
    wall_id = uuid4()
    door_id = uuid4()
    window_id = uuid4()

    linear_item_id = uuid4()
    area_item_id = uuid4()
    door_item_id = uuid4()
    window_item_id = uuid4()

    with get_session(db_path) as session:
        session.add(
            Project(
                id=project_id,
                name=project_name,
                path=str(project_dir),
            )
        )
        session.add(
            Document(
                id=document_id,
                project_id=project_id,
                filename="Sample Floor Plan.pdf",
                original_path=str(project_dir / "documents" / "originals" / "Sample Floor Plan.pdf"),
            )
        )

        session.add_all(
            [
                Sheet(
                    id=ground_floor_id,
                    document_id=document_id,
                    sheet_number="A-101",
                    sheet_title="Ground Floor",
                    page_index=0,
                    sheet_metadata={"page_count": 2},
                ),
                Sheet(
                    id=first_floor_id,
                    document_id=document_id,
                    sheet_number="A-102",
                    sheet_title="First Floor",
                    page_index=1,
                    sheet_metadata={"page_count": 2},
                ),
            ]
        )

        session.add_all(
            [
                Classification(id=wall_id, project_id=project_id, name="Wall", color="#3B82F6", unit="ft"),
                Classification(id=door_id, project_id=project_id, name="Door", color="#10B981", unit="count"),
                Classification(id=window_id, project_id=project_id, name="Window", color="#F59E0B", unit="count"),
            ]
        )

        session.add_all(
            [
                _takeoff_item(linear_item_id, ground_floor_id, wall_id, "linear", 36.0, "ft"),
                _takeoff_item(area_item_id, ground_floor_id, wall_id, "area", 240.0, "sqft"),
                _takeoff_item(door_item_id, first_floor_id, door_id, "count", 1.0, "count"),
                _takeoff_item(window_item_id, first_floor_id, window_id, "count", 1.0, "count"),
            ]
        )
        session.add_all(
            [
                _geometry(linear_item_id, "path", [{"x": 120.0, "y": 180.0}, {"x": 420.0, "y": 180.0}]),
                _geometry(
                    area_item_id,
                    "polygon",
                    [
                        {"x": 140.0, "y": 240.0},
                        {"x": 380.0, "y": 240.0},
                        {"x": 380.0, "y": 420.0},
                        {"x": 140.0, "y": 420.0},
                    ],
                ),
                _geometry(door_item_id, "point", [{"x": 220.0, "y": 260.0}]),
                _geometry(window_item_id, "point", [{"x": 340.0, "y": 260.0}]),
            ]
        )
        session.commit()

    return DemoProjectResponse(id=str(project_id), name=project_name, path=str(project_dir))


def _takeoff_item(
    item_id,
    sheet_id,
    classification_id,
    item_type: str,
    quantity: float,
    unit: str,
) -> TakeoffItem:
    return TakeoffItem(
        id=item_id,
        sheet_id=sheet_id,
        classification_id=classification_id,
        type=item_type,
        geometry_json={},
        source="manual",
        quantity_raw=quantity,
        quantity_unit=unit,
        formulas={},
        created_by="demo",
    )


def _geometry(item_id, kind: str, points: list[dict[str, float]]) -> TakeoffGeometry:
    return TakeoffGeometry(
        id=uuid4(),
        takeoff_item_id=item_id,
        geometry_type=kind,
        points=points,
        holes=[],
        scale=1.0,
        scale_unit="ft",
    )

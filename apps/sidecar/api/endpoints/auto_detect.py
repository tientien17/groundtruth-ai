from fastapi import APIRouter, HTTPException, Query
from typing import Annotated

from pydantic import BaseModel

router = APIRouter(prefix="/projects/{project_id}/sheets", tags=["auto_detect"])

class BboxModel(BaseModel):
    bbox: list[float]

class AutoDetectItem(BboxModel):
    id: str
    type: str
    label: str
    confidence: float

@router.post("/{sheet_id}/auto-detect", response_model=list[AutoDetectItem])
async def auto_detect(
    project_id: str,
    sheet_id: str,
    project_path: Annotated[str, Query(description="Absolute path to the project directory")],
):
    """
    Mock AI auto-detection endpoint for Togal-style UX.
    Returns static placeholder detected objects for the given sheet.
    """
    
    # Mock data to simulate AI detections
    return [
        {"id": "detect-1", "type": "linear", "label": "Wall", "confidence": 0.95, "bbox": [100, 200, 50, 300]},
        {"id": "detect-2", "type": "count", "label": "Door", "confidence": 0.88, "bbox": [400, 300, 80, 200]},
        {"id": "detect-3", "type": "count", "label": "Window", "confidence": 0.76, "bbox": [600, 150, 60, 180]},
    ]

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Generic, Literal, TypeVar
from uuid import UUID


TakeoffItemType = Literal["area", "linear", "count", "annotation"]
TakeoffSource = Literal["manual", "ai_candidate", "ai_accepted", "imported"]
T = TypeVar("T")

PROJECT_FOLDER_SCHEMA = {
    "extension": ".gtl",
    "requiredPaths": [
        "project.sqlite",
        "documents/originals/",
        "documents/rendered-pages/",
        "documents/ocr/",
        "documents/thumbnails/",
        "takeoff/layers.jsonl",
        "takeoff/classifications.json",
        "takeoff/formulas.json",
        "takeoff/snapshots/",
        "rag/chunks.jsonl",
        "exports/excel/",
        "exports/annotated-pdf/",
        "audit/ai-runs.jsonl",
        "audit/tool-calls.jsonl",
        "audit/user-edits.jsonl",
    ],
    "alternativePaths": ["rag/qdrant/", "rag/qdrant_collection_id.txt"],
}

CORE_TABLES = [
    "projects",
    "documents",
    "sheets",
    "sheet_text_blocks",
    "sheet_renders",
    "classifications",
    "takeoff_items",
    "takeoff_vertices",
    "formulas",
    "snapshots",
    "ai_runs",
    "tool_calls",
    "exports",
]


@dataclass(frozen=True, slots=True)
class ApiError:
    code: str
    message: str
    requestId: str
    details: dict[str, Any] | None = None


@dataclass(frozen=True, slots=True)
class ApiResponse(Generic[T]):
    ok: bool
    data: T | None = None
    error: ApiError | None = None


@dataclass(frozen=True, slots=True)
class Project:
    id: UUID
    name: str
    path: str
    createdAt: datetime
    updatedAt: datetime


@dataclass(frozen=True, slots=True)
class Document:
    id: UUID
    projectId: UUID
    filename: str
    originalPath: str
    createdAt: datetime


@dataclass(frozen=True, slots=True)
class Sheet:
    id: UUID
    documentId: UUID
    sheetNumber: str
    pageIndex: int


@dataclass(frozen=True, slots=True)
class Classification:
    id: UUID
    name: str
    color: str


@dataclass(frozen=True, slots=True)
class TakeoffItem:
    id: UUID
    sheetId: UUID
    classificationId: UUID
    type: TakeoffItemType
    geometryJson: dict[str, Any]
    source: TakeoffSource
    confidence: float | None
    scaleId: str | None
    quantityRaw: float | None
    quantityUnit: str | None
    createdBy: str
    createdAt: datetime
    updatedAt: datetime

"""SQLAlchemy declarative ORM models for GroundTruth Local SQLite database."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""


# ── Core Tables ────────────────────────────────────────────────────────────────


class Project(Base):
    """Project entity – aligns with shared-contracts Project schema."""

    __tablename__ = "projects"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    path: Mapped[str] = mapped_column(String(1024))
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow)

    documents: Mapped[list["Document"]] = relationship(back_populates="project")


class ProjectMetadata(Base):
    """Key-value metadata attached to a project (e.g. version, tags)."""

    __tablename__ = "project_metadata"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    key: Mapped[str] = mapped_column(String(255), index=True)
    value: Mapped[str] = mapped_column(String(4096))
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class Document(Base):
    """Document entity – aligns with shared-contracts Document schema."""

    __tablename__ = "documents"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    filename: Mapped[str] = mapped_column(String(512))
    original_path: Mapped[str] = mapped_column(String(1024))
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)

    project: Mapped["Project | None"] = relationship(back_populates="documents")
    sheets: Mapped[list["Sheet"]] = relationship(back_populates="document")


class Sheet(Base):
    """Sheet entity – aligns with shared-contracts Sheet schema."""

    __tablename__ = "sheets"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    document_id: Mapped[UUID] = mapped_column(ForeignKey("documents.id"), index=True)
    sheet_number: Mapped[str] = mapped_column(String(64))
    sheet_title: Mapped[str | None] = mapped_column(String(512), default=None)
    page_index: Mapped[int] = mapped_column()
    sheet_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    document: Mapped["Document | None"] = relationship(back_populates="sheets")
    takeoff_items: Mapped[list["TakeoffItem"]] = relationship(back_populates="sheet")
    text_entries: Mapped[list["SheetText"]] = relationship(back_populates="sheet")


class SheetTextBlock(Base):
    """OCR text block extracted from a sheet page."""

    __tablename__ = "sheet_text_blocks"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    sheet_id: Mapped[UUID] = mapped_column(ForeignKey("sheets.id"), index=True)
    text: Mapped[str] = mapped_column(Text())
    bbox_x: Mapped[float] = mapped_column()
    bbox_y: Mapped[float] = mapped_column()
    bbox_w: Mapped[float] = mapped_column()
    bbox_h: Mapped[float] = mapped_column()


class SheetText(Base):
    """Searchable text span extracted from a sheet page with PDF-space bounds."""

    __tablename__ = "sheet_text"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    sheet_id: Mapped[UUID] = mapped_column(ForeignKey("sheets.id"), index=True)
    page_index: Mapped[int] = mapped_column(index=True)
    text: Mapped[str] = mapped_column(Text())
    bbox_x0: Mapped[float] = mapped_column()
    bbox_y0: Mapped[float] = mapped_column()
    bbox_x1: Mapped[float] = mapped_column()
    bbox_y1: Mapped[float] = mapped_column()
    source: Mapped[str] = mapped_column(String(32), default="native")
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)

    sheet: Mapped["Sheet | None"] = relationship(back_populates="text_entries")


class SheetRender(Base):
    """Rendered image path for a sheet page."""

    __tablename__ = "sheet_renders"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    sheet_id: Mapped[UUID] = mapped_column(ForeignKey("sheets.id"), index=True)
    render_path: Mapped[str] = mapped_column(String(1024))
    width_px: Mapped[int] = mapped_column()
    height_px: Mapped[int] = mapped_column()


class Classification(Base):
    """Classification entity – aligns with shared-contracts Classification schema."""

    __tablename__ = "classifications"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    project_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("projects.id"), index=True, default=None
    )
    name: Mapped[str] = mapped_column(String(255))
    color: Mapped[str] = mapped_column(String(16))  # hex color e.g. "#FF0000"
    unit: Mapped[str] = mapped_column(String(32), default="count")


class TakeoffItem(Base):
    """Takeoff item entity – aligns with shared-contracts TakeoffItem schema."""

    __tablename__ = "takeoff_items"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    sheet_id: Mapped[UUID] = mapped_column(ForeignKey("sheets.id"), index=True)
    classification_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("classifications.id"), index=True, default=None
    )
    type: Mapped[str] = mapped_column(
        String(32)
    )  # area | linear | count | annotation
    geometry_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    source: Mapped[str] = mapped_column(
        String(32)
    )  # manual | ai_candidate | ai_accepted | imported
    confidence: Mapped[float | None] = mapped_column(default=None)
    scale_id: Mapped[str | None] = mapped_column(String(64), default=None)
    quantity_raw: Mapped[float | None] = mapped_column(default=None)
    quantity_unit: Mapped[str | None] = mapped_column(String(32), default=None)
    formulas: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_by: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow)

    sheet: Mapped["Sheet | None"] = relationship(back_populates="takeoff_items")
    geometry: Mapped["TakeoffGeometry | None"] = relationship(
        back_populates="item", cascade="all, delete-orphan", uselist=False
    )
    vertices: Mapped[list["TakeoffVertex"]] = relationship(back_populates="item")


class TakeoffGeometry(Base):
    """Persisted geometry payload used to compute a takeoff quantity."""

    __tablename__ = "takeoff_geometries"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    takeoff_item_id: Mapped[UUID] = mapped_column(
        ForeignKey("takeoff_items.id"), unique=True, index=True
    )
    geometry_type: Mapped[str] = mapped_column(String(32))  # point | path | polygon
    points: Mapped[list[dict[str, float]]] = mapped_column(JSON, default=list)
    holes: Mapped[list[list[dict[str, float]]]] = mapped_column(JSON, default=list)
    scale: Mapped[float] = mapped_column(default=1.0)
    scale_unit: Mapped[str] = mapped_column(String(32), default="ft")
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow)

    item: Mapped["TakeoffItem | None"] = relationship(back_populates="geometry")


class TakeoffVertex(Base):
    """Individual vertex for polygon/line geometry of a TakeoffItem."""

    __tablename__ = "takeoff_vertices"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    takeoff_item_id: Mapped[UUID] = mapped_column(
        ForeignKey("takeoff_items.id"), index=True
    )
    order_index: Mapped[int] = mapped_column()
    x: Mapped[float] = mapped_column()
    y: Mapped[float] = mapped_column()

    item: Mapped["TakeoffItem | None"] = relationship(back_populates="vertices")


class Formula(Base):
    """User-defined formula referencing classification totals."""

    __tablename__ = "formulas"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    expression: Mapped[str] = mapped_column(Text())  # e.g. "C1 + C2 * 2"
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class Snapshot(Base):
    """Point-in-time snapshot of all takeoffs for a project."""

    __tablename__ = "snapshots"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    snapshot_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class AIRun(Base):
    """Record of a single AI inference run."""

    __tablename__ = "ai_runs"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    model: Mapped[str] = mapped_column(String(255))
    prompt: Mapped[str] = mapped_column(Text())
    response: Mapped[str] = mapped_column(Text())
    duration_ms: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class ToolCall(Base):
    """Single tool invocation within an AIRun."""

    __tablename__ = "tool_calls"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    ai_run_id: Mapped[UUID] = mapped_column(ForeignKey("ai_runs.id"), index=True)
    tool_name: Mapped[str] = mapped_column(String(255))
    arguments_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    result_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class Export(Base):
    """Export job record."""

    __tablename__ = "exports"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    project_id: Mapped[UUID] = mapped_column(ForeignKey("projects.id"), index=True)
    export_type: Mapped[str] = mapped_column(
        String(64)
    )  # e.g. "excel", "annotated_pdf"
    file_path: Mapped[str] = mapped_column(String(1024))
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class AuditLog(Base):
    """Generic audit log for user edits / system events."""

    __tablename__ = "audit_log"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    project_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("projects.id"), index=True, default=None
    )
    actor: Mapped[str] = mapped_column(
        String(255)
    )  # "user:<uuid>", "system", "ai"
    action: Mapped[str] = mapped_column(
        String(255)
    )  # e.g. "takeoff_item.create"
    target_type: Mapped[str | None] = mapped_column(String(128), default=None)
    target_id: Mapped[UUID | None] = mapped_column(default=None)
    details_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


# ── AI Tables ──────────────────────────────────────────────────────────────────


class AISettings(Base):
    """Per-project AI provider configuration."""

    __tablename__ = "ai_settings"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id"), unique=True, index=True
    )
    provider: Mapped[str] = mapped_column(
        String(64), default="ollama"
    )  # "ollama" | "vllm" | "openai_compatible"
    base_url: Mapped[str] = mapped_column(
        String(1024), default="http://127.0.0.1:11434"
    )
    chat_model: Mapped[str] = mapped_column(String(255), default="llama3.2")
    embedding_model: Mapped[str] = mapped_column(
        String(255), default="nomic-embed-text"
    )
    extra_config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow)


class AIAuditLog(Base):
    """Audit trail for all AI prompt/response pairs."""

    __tablename__ = "ai_audit_log"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("projects.id"), index=True
    )
    provider: Mapped[str] = mapped_column(String(64))
    model: Mapped[str] = mapped_column(String(255))
    prompt: Mapped[str] = mapped_column(Text())
    response: Mapped[str] = mapped_column(Text())
    tokens_prompt: Mapped[int | None] = mapped_column(default=None)
    tokens_completion: Mapped[int | None] = mapped_column(default=None)
    duration_ms: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(
        String(32), default="success"
    )  # "success" | "error"
    error_message: Mapped[str | None] = mapped_column(Text(), default=None)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)

"""Unit tests for database models and init_db()."""
from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import pytest

from database import get_project_path, init_db
from models import (
    AIRun,
    AuditLog,
    Base,
    Classification,
    Document,
    Export,
    Formula,
    Project,
    ProjectMetadata,
    Sheet,
    SheetRender,
    SheetTextBlock,
    Snapshot,
    TakeoffItem,
    TakeoffVertex,
)


# ── Fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def tmp_db(tmp_path: Path) -> Path:
    """Return a path to a temporary SQLite file."""
    return tmp_path / "test_project.sqlite"


@pytest.fixture
def engine(tmp_db: Path):
    """Initialise and return the engine for a temp db."""
    from database import get_engine

    eng = get_engine(tmp_db)
    yield eng
    eng.dispose()


# ── Schema validation helpers ─────────────────────────────────────────────────


REQUIRED_TABLES = {
    "projects",
    "project_metadata",
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
    "audit_log",
}


def table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    cur = conn.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cur.fetchall()}


# ── Tests ──────────────────────────────────────────────────────────────────────


class TestInitDb:
    def test_init_db_returns_engine(self, tmp_db: Path):
        engine = init_db(tmp_db)
        assert engine is not None

    def test_all_required_tables_exist(self, tmp_db: Path):
        init_db(tmp_db)
        conn = sqlite3.connect(tmp_db)
        cur = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        actual = {row[0] for row in cur.fetchall()}
        conn.close()
        assert REQUIRED_TABLES.issubset(actual), (
            f"Missing tables: {REQUIRED_TABLES - actual}"
        )

    def test_projects_table_columns(self, tmp_db: Path):
        init_db(tmp_db)
        conn = sqlite3.connect(tmp_db)
        cols = table_columns(conn, "projects")
        conn.close()
        assert {"id", "name", "path", "created_at", "updated_at"}.issubset(cols)

    def test_takeoff_items_table_columns(self, tmp_db: Path):
        init_db(tmp_db)
        conn = sqlite3.connect(tmp_db)
        cols = table_columns(conn, "takeoff_items")
        conn.close()
        expected = {
            "id",
            "sheet_id",
            "classification_id",
            "type",
            "source",
            "confidence",
            "scale_id",
            "quantity_raw",
            "quantity_unit",
            "created_by",
            "created_at",
            "updated_at",
        }
        assert expected.issubset(cols), f"Missing cols: {expected - cols}"

    def test_audit_log_table_columns(self, tmp_db: Path):
        init_db(tmp_db)
        conn = sqlite3.connect(tmp_db)
        cols = table_columns(conn, "audit_log")
        conn.close()
        assert {"id", "actor", "action", "details_json", "created_at"}.issubset(cols)

    def test_project_metadata_table_exists(self, tmp_db: Path):
        init_db(tmp_db)
        conn = sqlite3.connect(tmp_db)
        cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        names = {row[0] for row in cur.fetchall()}
        conn.close()
        assert "project_metadata" in names


class TestModelsCrud:
    """Smoke tests for CRUD operations via SQLAlchemy Session."""

    def test_project_crud(self, tmp_db: Path):
        from database import get_session

        init_db(tmp_db)

        with get_session(tmp_db) as session:
            proj = Project(
                id=UUID("00000000-0000-0000-0000-000000000001"),
                name="Test Project",
                path="/tmp/test",
            )
            session.add(proj)
            session.flush()

            loaded = session.get(Project, proj.id)
            assert loaded is not None
            assert loaded.name == "Test Project"

    def test_classification_crud(self, tmp_db: Path):
        from database import get_session

        init_db(tmp_db)

        with get_session(tmp_db) as session:
            cls = Classification(
                id=UUID("00000000-0000-0000-0000-000000000002"),
                name="Concrete",
                color="#808080",
            )
            session.add(cls)
            session.flush()

            loaded = session.get(Classification, cls.id)
            assert loaded is not None
            assert loaded.name == "Concrete"
            assert loaded.color == "#808080"

    def test_audit_log_crud(self, tmp_db: Path):
        from database import get_session

        init_db(tmp_db)

        with get_session(tmp_db) as session:
            log = AuditLog(
                id=UUID("00000000-0000-0000-0000-000000000003"),
                actor="user:test",
                action="project.create",
                details_json={"foo": "bar"},
            )
            session.add(log)
            session.flush()

            loaded = session.get(AuditLog, log.id)
            assert loaded is not None
            assert loaded.actor == "user:test"
            assert loaded.action == "project.create"


class TestGetProjectPath:
    def test_get_project_path_returns_sqlite(self):
        path = get_project_path()
        assert path.name == "project.sqlite"

    def test_get_project_path_custom_storage(self, tmp_path: Path):
        path = get_project_path(tmp_path)
        assert path == tmp_path / "project.sqlite"

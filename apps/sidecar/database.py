"""SQLite database setup and session management for GroundTruth Local."""
from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

import models  # noqa: F401  # Import all ORM classes so Base.metadata includes every table.
from models import Base

__all__ = [
    "init_db",
    "get_engine",
    "get_session",
    "get_project_path",
    "Session",
    "Base",
]

# Module-level engine (set once per process)
_engine: Engine | None = None


def get_engine(db_path: Path | None = None) -> Engine:
    """Create or return the SQLite engine.

    Args:
        db_path: Path to the SQLite file. If None, defaults to <storage>/project.sqlite.
                 Pass a bare Path to create an in-memory database for tests.
    """
    global _engine

    if _engine is not None and db_path is None:
        return _engine

    if db_path is None:
        # Defer import to avoid circular references at module load
        from config import Settings

        settings = Settings()
        db_path = settings.storage_path / "project.sqlite"

    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(
        f"sqlite:///{db_path.as_posix()}",
        echo=False,
        connect_args={"check_same_thread": False},
    )

    if db_path is None:
        _engine = engine

    return engine


def init_db(db_path: Path | None = None) -> Engine:
    """Create all SQLite tables defined in models.py.

    Args:
        db_path: Optional path to the SQLite file. Uses default location if None.

    Returns:
        The configured SQLAlchemy Engine.
    """
    engine = get_engine(db_path)

    Base.metadata.create_all(engine)
    _init_sheet_text_index(engine)

    return engine


def _init_sheet_text_index(engine: Engine) -> None:
    """Create SQLite FTS index for keyword search over sheet_text."""
    with engine.begin() as conn:
        conn.exec_driver_sql(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS sheet_text_fts
            USING fts5(text, content='sheet_text', content_rowid='rowid')
            """
        )
        conn.exec_driver_sql(
            """
            CREATE TRIGGER IF NOT EXISTS sheet_text_ai AFTER INSERT ON sheet_text
            BEGIN
                INSERT INTO sheet_text_fts(rowid, text) VALUES (new.rowid, new.text);
            END
            """
        )
        conn.exec_driver_sql(
            """
            CREATE TRIGGER IF NOT EXISTS sheet_text_ad AFTER DELETE ON sheet_text
            BEGIN
                INSERT INTO sheet_text_fts(sheet_text_fts, rowid, text)
                VALUES ('delete', old.rowid, old.text);
            END
            """
        )
        conn.exec_driver_sql(
            """
            CREATE TRIGGER IF NOT EXISTS sheet_text_au AFTER UPDATE ON sheet_text
            BEGIN
                INSERT INTO sheet_text_fts(sheet_text_fts, rowid, text)
                VALUES ('delete', old.rowid, old.text);
                INSERT INTO sheet_text_fts(rowid, text) VALUES (new.rowid, new.text);
            END
            """
        )


@contextmanager
def get_session(db_path: Path | None = None) -> Iterator[Session]:
    """Context manager that yields a SQLAlchemy Session.

    Usage:
        with get_session() as session:
            session.add(Project(...))
            session.commit()
    """
    engine = get_engine(db_path)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    session = session_factory()

    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_project_path(storage_path: Path | None = None) -> Path:
    """Return the canonical project.sqlite path."""
    if storage_path is not None:
        return storage_path / "project.sqlite"

    from config import Settings

    settings = Settings()
    return settings.storage_path / "project.sqlite"

# GroundTruth Local MVP - Learnings

## T5: Python Backend Bootstrap & Config

### What worked
- `pydantic-settings` `BaseSettings` handles env var loading cleanly with `env_prefix` and `env_file`.
- Creating `apps/sidecar/main.py` as `uvicorn main:app` module (not `__main__.py`) allows Tauri to reference it as a target.
- Hardcoding version string avoids `importlib.metadata` (unavailable in Python 3.14 early build).
- Startup validation (storage dir creation) in lifespan catches permission errors cleanly.

### Gotchas
- Python 3.14 doesn't have `importlib.metadata` attribute yet — used hardcoded "0.1.0" string instead.
- Python 3.14 also doesn't support `from importlib import.metadata` syntax — `metadata.version()` call was broken.
- `SIDECAR_HOST`, `SIDECAR_PORT` env vars override defaults correctly.
- Must bind to `127.0.0.1` (not `0.0.0.0`) for localhost-only model per security defaults.

## T5 (continued): SQLite Schema / SQLAlchemy ORM

### What worked
- SQLAlchemy 2.x `DeclarativeBase` + `Mapped[...] = mapped_column(...)` is the correct modern pattern.
- `ForeignKey("table.col")` as a separate positional arg to `mapped_column()` — NOT `String(36), foreign_key=...`.
- `default=_utcnow` (not `default_factory=_utcnow`) for non-dict column defaults with DeclarativeBase.
- `@contextmanager` from `contextlib` for session management.

### Gotchas
- SQLModel 0.0.38 + SQLAlchemy 2.0.49 + Python 3.14: `Mapped[X] = relationship()` causes `issubclass() arg 1 must be a class` in `get_sqlalchemy_type`. Root cause: `list['Document']` string annotation fed to `issubclass()`. Workaround: use pure SQLAlchemy `DeclarativeBase` instead of SQLModel for table models.
- `dict[str, Any]` as Pydantic annotation + `sa_column=SA_Column(SA_JSON())` causes `ValueError: <class 'dict'> has no matching SQLAlchemy type`. Solution: use `Mapped[dict[str, Any]]` with `mapped_column(JSON, default=dict)`.
- `default_factory=_utcnow` causes `sqlalchemy.exc.ArgumentError: Attribute includes dataclasses argument(s): 'default_factory' but class does not specify SQLAlchemy native dataclass configuration`. Fix: use `default=_utcnow` instead.
- `SQLite_JSON` from `sqlalchemy.dialects.sqlite` needs to be imported separately (not from `sqlalchemy` top-level).
- `@contextmanager[Session]` is invalid Python syntax — plain `@contextmanager` decorator works fine.

## T7: Project Folder Service
- `create_project(name, path)` builds `<path>/<name>.gtl` with transparent folder layout from `mvp-implementation.md:114-141`.
- Service initializes SQLite with `init_db(project_dir / "project.sqlite")` after creating leaf directories.
- Sidecar imports rely on `apps/sidecar` being on `sys.path`; verification used same path setup as existing tests.

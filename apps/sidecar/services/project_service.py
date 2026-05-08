"""Project folder creation and file IO helpers."""
from __future__ import annotations

from pathlib import Path

from database import init_db

PROJECT_LEAF_DIRS: tuple[Path, ...] = (
    Path("documents/originals"),
    Path("documents/rendered-pages"),
    Path("documents/ocr"),
    Path("documents/thumbnails"),
    Path("takeoff/snapshots"),
    Path("rag/qdrant"),
    Path("exports/excel"),
    Path("exports/annotated-pdf"),
    Path("audit"),
)


def create_project(name: str, path: str | Path) -> Path:
    """Create a transparent .gtl project folder and initialize project.sqlite."""
    project_dir = Path(path).expanduser() / f"{name}.gtl"
    project_dir.mkdir(parents=True, exist_ok=True)

    for leaf_dir in PROJECT_LEAF_DIRS:
        (project_dir / leaf_dir).mkdir(parents=True, exist_ok=True)

    init_db(project_dir / "project.sqlite")

    return project_dir

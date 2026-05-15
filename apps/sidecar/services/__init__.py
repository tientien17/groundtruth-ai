"""Service layer exports for GroundTruth Local sidecar."""

from typing import Any

PROJECT_LEAF_DIRS: Any
create_project: Any

__all__ = ["PROJECT_LEAF_DIRS", "create_project"]


def __getattr__(name: str):
    if name in __all__:
        from .project_service import PROJECT_LEAF_DIRS, create_project

        return {"PROJECT_LEAF_DIRS": PROJECT_LEAF_DIRS, "create_project": create_project}[name]
    raise AttributeError(name)

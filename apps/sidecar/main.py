"""FastAPI sidecar entrypoint for GroundTruth Local MVP."""

from contextlib import asynccontextmanager
from importlib.metadata import version as _version

from fastapi import FastAPI
from pydantic_settings import SettingsError

from api.endpoints.ai_config import router as ai_config_router
from api.endpoints.classifications import router as classifications_router
from api.endpoints.copilot import router as copilot_router  # type: ignore[reportMissingImports]
from api.endpoints.documents import router as documents_router
from api.endpoints.export import router as export_router  # type: ignore[reportMissingImports]
from api.endpoints.sheets import router as sheets_router
from api.endpoints.search import router as search_router  # type: ignore[reportMissingImports]
from api.endpoints.snapshots import router as snapshots_router  # type: ignore[reportMissingImports]
from api.endpoints.takeoff import router as takeoff_router
from api.endpoints.visual_search import router as visual_search_router
from config import Settings


# ── App-lifetime ──────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup validation and shutdown cleanup."""
    settings = app.state.settings
    try:
        settings.storage_path.mkdir(parents=True, exist_ok=True)
    except (PermissionError, OSError) as exc:
        raise SettingsError(
            f"Cannot create storage directory {settings.storage_path!s}: {exc}"
        ) from exc

    yield


# ── FastAPI app ─────────────────────────────────────────────────────────────


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the FastAPI application."""
    app_settings = settings or Settings()

    app = FastAPI(
        title="GroundTruth Local Sidecar",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.settings = app_settings
    app.include_router(ai_config_router)
    app.include_router(classifications_router)
    app.include_router(copilot_router)
    app.include_router(documents_router)
    app.include_router(export_router)
    app.include_router(search_router)
    app.include_router(sheets_router)
    app.include_router(snapshots_router)
    app.include_router(takeoff_router)
    app.include_router(visual_search_router)

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "version": "0.1.0",
            "host": app_settings.host,
            "port": app_settings.port,
        }

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = Settings()
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )

"""First-run setup endpoints for local model readiness."""
from __future__ import annotations

import asyncio
import os
import subprocess
from typing import Any

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from services.ai_router import get_ollama_status

router = APIRouter(prefix="/setup", tags=["setup"])

REQUIRED_MODELS = ("llama3.2", "nomic-embed-text")
_pull_progress: dict[str, dict[str, Any]] = {}
_pull_tasks: dict[str, asyncio.Task[None]] = {}
_install_lock = asyncio.Lock()


class PullModelsRequest(BaseModel):
    models: list[str] = Field(default_factory=lambda: list(REQUIRED_MODELS))


@router.get("/status")
async def setup_status(request: Request) -> dict[str, Any]:
    """Check Ollama reachability, required model presence, and pull progress."""
    settings = request.app.state.settings
    ollama = await get_ollama_status(settings.ollama_url)
    models = {
        model: {
            "installed": ollama.running and model.split(":", 1)[0] in ollama.models,
            "progress": _pull_progress.get(model),
        }
        for model in REQUIRED_MODELS
    }
    return {
        "required": not (ollama.running and all(item["installed"] for item in models.values())),
        "ollama": {
            "running": ollama.running,
            "error": ollama.error,
        },
        "models": models,
    }


@router.post("/models/pull")
async def pull_models(body: PullModelsRequest, request: Request) -> dict[str, Any]:
    """Start non-blocking Ollama model pulls and expose progress via /setup/status."""
    settings = request.app.state.settings
    started: list[str] = []
    for model in body.models:
        if model not in REQUIRED_MODELS:
            continue
        task = _pull_tasks.get(model)
        if task and not task.done():
            continue
        _pull_progress[model] = {"status": "queued", "completed": 0, "total": None, "percent": 0}
        _pull_tasks[model] = asyncio.create_task(_pull_model(settings.ollama_url, model))
        started.append(model)
    return {"started": started, "progress": _pull_progress}


@router.post("/ollama/install")
async def install_ollama() -> dict[str, Any]:
    """Run bundled Ollama installer silently."""
    installer_path = os.getenv("SIDECAR_OLLAMA_INSTALLER_PATH")
    if not installer_path:
        return {"installed": False, "error": "SIDECAR_OLLAMA_INSTALLER_PATH is not configured"}
    if not os.path.exists(installer_path):
        return {"installed": False, "error": f"Ollama installer not found: {installer_path}"}

    async with _install_lock:
        process = await asyncio.to_thread(
            subprocess.run,
            [installer_path, "/S"],
            check=False,
            capture_output=True,
            text=True,
        )

    if process.returncode != 0:
        return {
            "installed": False,
            "error": f"Ollama installer exited with code {process.returncode}",
            "stderr": process.stderr,
        }
    return {"installed": True}


async def _pull_model(base_url: str, model: str) -> None:
    """Stream Ollama pull progress into in-memory status map."""
    try:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{base_url}/api/pull",
                json={"model": model, "stream": True},
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    event = httpx.Response(200, content=line).json()
                    completed = event.get("completed")
                    total = event.get("total")
                    percent = int((completed / total) * 100) if completed and total else 0
                    _pull_progress[model] = {
                        "status": event.get("status", "pulling"),
                        "completed": completed,
                        "total": total,
                        "percent": percent,
                    }
        _pull_progress[model] = {"status": "complete", "completed": 1, "total": 1, "percent": 100}
    except Exception as exc:
        _pull_progress[model] = {
            "status": "error",
            "error": str(exc),
            "completed": 0,
            "total": None,
            "percent": 0,
        }

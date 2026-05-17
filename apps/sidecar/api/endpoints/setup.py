"""First-run setup endpoints for local model readiness."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
from enum import Enum
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from services.ai_router import get_ollama_status

logger = logging.getLogger(__name__)


# ── Error categories ─────────────────────────────────────────────────────────


class SetupErrorCategory(str, Enum):
    """Actionable error categories for setup failures."""

    OLLAMA_NOT_RUNNING = "ollama_not_running"
    OLLAMA_INSTALL_FAILED = "ollama_install_failed"
    MODEL_DOWNLOAD_FAILED = "model_download_failed"
    PROVIDER_CONNECTION_FAILED = "provider_connection_failed"
    PROVIDER_VALIDATION_FAILED = "provider_validation_failed"
    PROVIDER_URL_INVALID = "provider_url_invalid"
    PROVIDER_NOT_REACHABLE = "provider_not_reachable"
    SIDECAR_CONFIG_ERROR = "sidecar_config_error"
    NETWORK_ERROR = "network_error"
    UNKNOWN = "unknown"


# ── Sensitive-field mask set ─────────────────────────────────────────────────

_SENSITIVE_KEYS = frozenset({"api_key", "apikey", "secret", "password", "token"})


def _mask_dict(d: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of *d* with sensitive values masked."""
    return {
        k: ("***MASKED***" if k.lower() in _SENSITIVE_KEYS else v)
        for k, v in d.items()
    }


def _log_request(method: str, path: str, status: int, body: Any = None) -> None:
    """Log a setup-request summary at INFO with safe, masked details."""
    safe_body = _mask_dict(body) if isinstance(body, dict) else body
    logger.info(
        "setup %s %s -> %d | body=%s",
        method.upper(),
        path,
        status,
        json.dumps(safe_body, default=str) if safe_body else "{}",
    )

router = APIRouter(prefix="/setup", tags=["setup"])

REQUIRED_MODELS = ("llama3.2", "nomic-embed-text")
_pull_progress: dict[str, dict[str, Any]] = {}
_pull_tasks: dict[str, asyncio.Task[None]] = {}
_install_lock = asyncio.Lock()


class PullModelsRequest(BaseModel):
    models: list[str] = Field(default_factory=lambda: list(REQUIRED_MODELS))


class ProviderConfigRequest(BaseModel):
    """Cloud AI provider configuration submitted during setup."""

    provider: str = Field(default="openai_compatible", pattern=r"^(openai_compatible|vllm)$")
    base_url: str = Field(..., min_length=1, max_length=2048)
    api_key: str | None = Field(default=None, max_length=2048)
    chat_model: str = Field(default="gpt-4o", max_length=255)
    embedding_model: str = Field(default="text-embedding-3-small", max_length=255)


# ── Global provider config persistence ─────────────────────────────────────


def _read_global_provider_config(config_path: Path) -> dict[str, Any] | None:
    """Read the global provider config JSON file. Returns None if missing."""
    if not config_path.exists():
        return None
    try:
        raw = config_path.read_text(encoding="utf-8")
        return json.loads(raw)
    except (json.JSONDecodeError, OSError):
        return None


def _write_global_provider_config(config_path: Path, data: dict[str, Any]) -> None:
    """Write the global provider config JSON file atomically."""
    config_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = config_path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(config_path)


# ── Endpoints ─────────────────────────────────────────────────────────────


@router.get("/status")
async def setup_status(request: Request) -> dict[str, Any]:
    """Check setup readiness — either Ollama (local) or a cloud provider config."""
    settings = request.app.state.settings

    # Read global cloud provider config
    cloud_config = _read_global_provider_config(settings.provider_config_path)

    # Cloud provider configured — ready to go
    if cloud_config and cloud_config.get("base_url"):
        result = {
            "required": False,
            "cloud_provider": {
                "configured": True,
                "provider": cloud_config.get("provider", "openai_compatible"),
                "base_url": cloud_config.get("base_url", ""),
                "chat_model": cloud_config.get("chat_model", ""),
                "embedding_model": cloud_config.get("embedding_model", ""),
            },
            "ollama": {"running": False, "error": None},
            "models": {},
        }
        _log_request("GET", "/setup/status", 200, {"cloud_configured": True})
        return result

    # No cloud config — fall back to local Ollama
    ollama = await get_ollama_status(settings.ollama_url)
    models = {
        model: {
            "installed": ollama.running and model.split(":", 1)[0] in ollama.models,
            "progress": _pull_progress.get(model),
        }
        for model in REQUIRED_MODELS
    }
    result = {
        "required": not (ollama.running and all(item["installed"] for item in models.values())),
        "cloud_provider": {"configured": False},
        "ollama": {
            "running": ollama.running,
            "error": ollama.error,
            "error_category": getattr(ollama, 'error_category', None),
        },
        "models": models,
    }
    _log_request("GET", "/setup/status", 200, {
        "ollama_running": ollama.running,
        "ollama_error": ollama.error,
    })
    return result


@router.get("/provider")
async def get_global_provider(request: Request) -> dict[str, Any]:
    """Return the current global provider config (masked)."""
    settings = request.app.state.settings
    config = _read_global_provider_config(settings.provider_config_path)
    if config is None:
        _log_request("GET", "/setup/provider", 200, {"configured": False})
        return {"configured": False}
    masked = {k: (v if k != "api_key" else "***") for k, v in config.items()}
    _log_request("GET", "/setup/provider", 200, {"configured": True, "provider": masked.get("provider")})
    return {"configured": True, **masked}


@router.post("/provider")
async def set_global_provider(body: ProviderConfigRequest, request: Request) -> dict[str, Any]:
    """Save a global cloud AI provider config so the app can skip local setup."""
    settings = request.app.state.settings

    # Validate URL format before persisting
    base_url = body.base_url.rstrip("/")
    if not base_url.startswith(("http://", "https://")):
        _log_request("POST", "/setup/provider", 422, {
            "error_category": SetupErrorCategory.PROVIDER_URL_INVALID.value,
        })
        return {
            "saved": False,
            "error_category": SetupErrorCategory.PROVIDER_URL_INVALID.value,
            "error": "Base URL must start with http:// or https://",
        }

    data = body.model_dump(exclude_none=True)
    data["base_url"] = base_url
    _write_global_provider_config(settings.provider_config_path, data)
    _log_request("POST", "/setup/provider", 200, {"provider": body.provider, "saved": True})
    return {"saved": True, "provider": body.provider}


@router.post("/cloud-provider")
async def set_global_provider_alias(body: ProviderConfigRequest, request: Request) -> dict[str, Any]:
    """Alias for /setup/provider — frontend uses this path."""
    return await set_global_provider(body, request)


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
    _log_request("POST", "/setup/models/pull", 200, {"started": started})
    return {"started": started, "progress": _pull_progress}


@router.post("/ollama/install")
async def install_ollama() -> dict[str, Any]:
    """Run bundled Ollama installer silently."""
    installer_path = os.getenv("SIDECAR_OLLAMA_INSTALLER_PATH")
    if not installer_path:
        _log_request("POST", "/setup/ollama/install", 200, {
            "error_category": SetupErrorCategory.SIDECAR_CONFIG_ERROR.value,
        })
        return {
            "installed": False,
            "error": "SIDECAR_OLLAMA_INSTALLER_PATH is not configured",
            "error_category": SetupErrorCategory.SIDECAR_CONFIG_ERROR.value,
        }
    if not os.path.exists(installer_path):
        _log_request("POST", "/setup/ollama/install", 200, {
            "error_category": SetupErrorCategory.OLLAMA_INSTALL_FAILED.value,
        })
        return {
            "installed": False,
            "error": "Ollama installer not found",
            "error_category": SetupErrorCategory.OLLAMA_INSTALL_FAILED.value,
        }

    async with _install_lock:
        process = await asyncio.to_thread(
            subprocess.run,
            [installer_path, "/S"],
            check=False,
            capture_output=True,
            text=True,
        )

    if process.returncode != 0:
        _log_request("POST", "/setup/ollama/install", 200, {
            "error_category": SetupErrorCategory.OLLAMA_INSTALL_FAILED.value,
            "returncode": process.returncode,
        })
        return {
            "installed": False,
            "error": f"Ollama installer exited with code {process.returncode}",
            "error_category": SetupErrorCategory.OLLAMA_INSTALL_FAILED.value,
            "stderr": process.stderr,
        }
    _log_request("POST", "/setup/ollama/install", 200, {"installed": True})
    return {"installed": True}


def _categorize_pull_error(exc: Exception) -> str:
    """Map an Ollama pull exception to a SetupErrorCategory value."""
    msg = str(exc).lower()
    if isinstance(exc, httpx.ConnectError):
        return SetupErrorCategory.OLLAMA_NOT_RUNNING.value
    if isinstance(exc, httpx.TimeoutException):
        return SetupErrorCategory.NETWORK_ERROR.value
    if "not found" in msg or "404" in msg:
        return SetupErrorCategory.MODEL_DOWNLOAD_FAILED.value
    if isinstance(exc, httpx.HTTPStatusError):
        return SetupErrorCategory.PROVIDER_CONNECTION_FAILED.value
    return SetupErrorCategory.UNKNOWN.value


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
            "error_category": _categorize_pull_error(exc),
            "completed": 0,
            "total": None,
            "percent": 0,
        }
        logger.warning("model pull failed for %s: %s", model, exc)

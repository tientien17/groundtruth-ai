"""Centralized AI router for local LLM providers (Ollama, vLLM, OpenAI-compatible)."""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import httpx

from database import get_session, init_db
from models import AIAuditLog, AISettings


# ── Data classes ─────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class AIResponse:
    """Result from an AI provider call."""

    text: str
    tokens_prompt: int | None = None
    tokens_completion: int | None = None
    duration_ms: int = 0
    model: str = ""
    provider: str = ""
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ProviderConfig:
    """Resolved provider connection details."""

    provider: str  # "ollama" | "vllm" | "openai_compatible"
    base_url: str
    chat_model: str
    embedding_model: str


@dataclass(frozen=True)
class OllamaStatus:
    """Reachability and model availability for Ollama."""

    running: bool
    models: set[str] = field(default_factory=set)
    error: str | None = None


# ── Sensitive-info masking ───────────────────────────────────────────────────

_MASK_KEYS = frozenset({"api_key", "apikey", "secret", "password", "token", "authorization"})


def _mask_sensitive(data: dict[str, Any]) -> dict[str, Any]:
    """Shallow-mask values whose keys look like secrets."""
    masked = {}
    for k, v in data.items():
        if k.lower() in _MASK_KEYS:
            masked[k] = "***MASKED***"
        elif isinstance(v, dict):
            masked[k] = _mask_sensitive(v)
        else:
            masked[k] = v
    return masked


# ── Provider resolution ─────────────────────────────────────────────────────


def get_provider_config(
    project_id: UUID,
    db_path: Path,
) -> ProviderConfig:
    """Load AI settings for a project, falling back to global defaults.

    Fallback chain:
    1. Per-project AISettings (DB)
    2. Global provider config JSON (written by setup wizard)
    3. Environment-variable defaults (Settings)
    """
    from config import Settings

    defaults = Settings()
    config_path = defaults.provider_config_path

    # 1. Per-project settings in DB
    with get_session(db_path) as session:
        settings_row = (
            session.query(AISettings)
            .filter(AISettings.project_id == project_id)
            .first()
        )

    if settings_row:
        return ProviderConfig(
            provider=settings_row.provider,
            base_url=settings_row.base_url,
            chat_model=settings_row.chat_model,
            embedding_model=settings_row.embedding_model,
        )

    # 2. Global provider config (written by setup wizard)
    global_config = _read_global_provider_config(config_path)
    if global_config and global_config.get("base_url"):
        return ProviderConfig(
            provider=global_config.get("provider", "openai_compatible"),
            base_url=global_config["base_url"],
            chat_model=global_config.get("chat_model", defaults.chat_model),
            embedding_model=global_config.get("embedding_model", defaults.embedding_model),
        )

    # 3. Environment-variable defaults
    return ProviderConfig(
        provider="ollama",
        base_url=defaults.ollama_url,
        chat_model=defaults.chat_model,
        embedding_model=defaults.embedding_model,
    )


def _read_global_provider_config(config_path: Path) -> dict[str, Any] | None:
    """Read the global provider config JSON file. Returns None if missing."""
    if not config_path.exists():
        return None
    try:
        raw = config_path.read_text(encoding="utf-8")
        return json.loads(raw)
    except (json.JSONDecodeError, OSError):
        return None


# ── Provider dispatch ────────────────────────────────────────────────────────


async def _call_ollama(
    base_url: str,
    model: str,
    prompt: str,
    *,
    system: str | None = None,
    timeout: float = 120.0,
) -> AIResponse:
    """Call Ollama generate API."""
    payload: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }
    if system:
        payload["system"] = system

    start = time.monotonic()
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(f"{base_url}/api/generate", json=payload)
        resp.raise_for_status()

    elapsed_ms = int((time.monotonic() - start) * 1000)
    body = resp.json()

    return AIResponse(
        text=body.get("response", ""),
        tokens_prompt=body.get("prompt_eval_count"),
        tokens_completion=body.get("eval_count"),
        duration_ms=elapsed_ms,
        model=model,
        provider="ollama",
        raw=body,
    )


async def get_ollama_status(
    base_url: str,
    *,
    timeout: float = 5.0,
) -> OllamaStatus:
    """Return whether Ollama is reachable and which models are installed."""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(f"{base_url}/api/tags")
            resp.raise_for_status()
    except Exception as exc:
        return OllamaStatus(running=False, error=str(exc))

    body = resp.json()
    models = {
        str(model.get("name", "")).split(":", 1)[0]
        for model in body.get("models", [])
        if model.get("name")
    }
    models.update(
        str(model.get("model", "")).split(":", 1)[0]
        for model in body.get("models", [])
        if model.get("model")
    )
    return OllamaStatus(running=True, models=models)


async def ollama_model_exists(
    base_url: str,
    model: str,
    *,
    timeout: float = 5.0,
) -> bool:
    """Check whether a named model is installed in Ollama."""
    status = await get_ollama_status(base_url, timeout=timeout)
    return status.running and model.split(":", 1)[0] in status.models


async def _call_openai_compatible(
    base_url: str,
    model: str,
    prompt: str,
    *,
    system: str | None = None,
    timeout: float = 120.0,
) -> AIResponse:
    """Call OpenAI-compatible /v1/chat/completions (works for vLLM too)."""
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
    }

    start = time.monotonic()
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            f"{base_url}/v1/chat/completions",
            json=payload,
        )
        resp.raise_for_status()

    elapsed_ms = int((time.monotonic() - start) * 1000)
    body = resp.json()

    choice = body.get("choices", [{}])[0]
    usage = body.get("usage", {})

    return AIResponse(
        text=choice.get("message", {}).get("content", ""),
        tokens_prompt=usage.get("prompt_tokens"),
        tokens_completion=usage.get("completion_tokens"),
        duration_ms=elapsed_ms,
        model=model,
        provider="openai_compatible",
        raw=body,
    )


# ── Main router entry point ─────────────────────────────────────────────────


async def ai_generate(
    project_id: UUID,
    db_path: Path,
    prompt: str,
    *,
    system: str | None = None,
    timeout: float = 120.0,
) -> AIResponse:
    """Route an AI generation request through the configured provider.

    Automatically logs the prompt/response to the AI audit trail.
    """
    init_db(db_path)
    config = get_provider_config(project_id, db_path)

    error_msg: str | None = None
    status = "success"
    result: AIResponse | None = None

    try:
        if config.provider == "ollama":
            result = await _call_ollama(
                config.base_url,
                config.chat_model,
                prompt,
                system=system,
                timeout=timeout,
            )
        else:
            # vllm and openai_compatible both use the same API shape
            result = await _call_openai_compatible(
                config.base_url,
                config.chat_model,
                prompt,
                system=system,
                timeout=timeout,
            )
    except Exception as exc:
        status = "error"
        error_msg = str(exc)
        result = AIResponse(
            text="",
            duration_ms=0,
            model=config.chat_model,
            provider=config.provider,
        )

    # Persist audit log
    _write_audit_log(
        db_path=db_path,
        project_id=project_id,
        config=config,
        prompt=prompt,
        result=result,
        status=status,
        error_message=error_msg,
    )

    if status == "error":
        raise RuntimeError(f"AI provider error: {error_msg}")

    return result


def _write_audit_log(
    *,
    db_path: Path,
    project_id: UUID,
    config: ProviderConfig,
    prompt: str,
    result: AIResponse,
    status: str,
    error_message: str | None,
) -> None:
    """Persist an audit log entry for an AI call."""
    with get_session(db_path) as session:
        entry = AIAuditLog(
            id=uuid4(),
            project_id=project_id,
            provider=config.provider,
            model=config.chat_model,
            prompt=prompt,
            response=result.text,
            tokens_prompt=result.tokens_prompt,
            tokens_completion=result.tokens_completion,
            duration_ms=result.duration_ms,
            status=status,
            error_message=error_message,
            metadata_json=_mask_sensitive(result.raw) if result.raw else {},
        )
        session.add(entry)

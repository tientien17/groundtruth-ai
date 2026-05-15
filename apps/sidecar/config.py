"""Configuration for the Python FastAPI sidecar."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Sidecar application settings.

    All values are localhost-only by default for privacy/security.
    """

    model_config = SettingsConfigDict(
        env_prefix="SIDECAR_",
        env_file=".env",
        env_file_encoding="utf-8",
    )

    # ── Network ───────────────────────────────────────────────────────────────

    host: str = "127.0.0.1"
    port: int = 8765

    # ── Storage ───────────────────────────────────────────────────────────────

    storage_path: Path = Path("~/.groundtruth/local").expanduser()

    # ── OCR ───────────────────────────────────────────────────────────────────

    ocr_engine: str = "tesseract"  # "tesseract" | "ocrmypdf"

    # ── AI / Model Providers ─────────────────────────────────────────────────

    ollama_url: str = "http://127.0.0.1:11434"
    openai_compatible_url: str | None = None
    openai_api_key: str | None = None
    embedding_model: str = "nomic-embed-text"
    chat_model: str = "llama3.2"

    # ── Debug ───────────────────────────────────────────────────────────────────

    debug: bool = False

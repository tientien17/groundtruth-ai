## [2026-05-15] Research: Windows Installer Prerequisites

### Ollama
- **Silent Install**: `OllamaSetup.exe /S` works for silent installation.
- **Service**: Installs as a user-level service/startup app.
- **Models**: Stored in `%USERPROFILE%\.ollama\models`.

### Tesseract OCR
- **Portable Binaries**: `simonflueckiger/tesserocr-windows_build` provides `tesseract-x64.zip` with all DLLs and `tesseract.exe`.
- **Bundling**: Can be placed in Tauri `resources` folder and accessed via `tauri::path::resource_dir`.

### Tauri Bundling
- **NSIS**: Supports custom scripts (NSIS `.nsh` files) to check registry keys for Ollama and run installers.
- **Sidecars**: Python sidecar already handled, but needs to be aware of the bundled Tesseract path.

## [2026-05-15] Bundled Tesseract wiring
- Sidecar reads SIDECAR_TESSERACT_PATH through Settings.tesseract_path and assigns pytesseract.pytesseract.tesseract_cmd at module import.
- Tauri resolves bundled OCR binary via app.path().resource_dir()?.join("tesseract").join("tesseract.exe") and passes SIDECAR_TESSERACT_PATH when spawning uvicorn.

## [2026-05-15] First-run setup endpoints
- Sidecar setup router exposes `GET /setup/status` and `POST /setup/models/pull`; pulls run in `asyncio.create_task` and publish in-memory progress.
- Ollama model readiness uses `/api/tags` and normalizes model names before matching `llama3.2` and `nomic-embed-text`.
- Frontend setup wizard polls `/setup/status`; app only gates while setup is required and calls ready callback once models already exist.

## [2026-05-15] Ollama installer bundling
- Direct URL https://ollama.com/download/OllamaSetup.exe responds with installer payload and was downloaded to apps/tauri/src-tauri/resources/OllamaSetup.exe.
- Tauri bundles resources/OllamaSetup.exe and exposes install_ollama command that runs bundled installer with /S only.
- Sidecar receives SIDECAR_OLLAMA_INSTALLER_PATH and POST /setup/ollama/install runs the same installer silently for frontend setup flow.
- Frontend SetupWizard shows Install Ollama when status.ollama.running is false, posts install request, then polls setup status until Ollama responds.
- Verification: frontend build passed; Python setup endpoint py_compile passed; Rust LSP/cargo unavailable in environment (rust-analyzer and cargo missing).

## [2026-05-15] NSIS packaging finalization
- Tauri bundle now targets NSIS only with `compression: lzma`, `installMode: currentUser`, `languages: ["English"]`, and language selector disabled for Next-Next-Finish install flow.
- Tauri resources cover `resources/tesseract/**` and `resources/OllamaSetup.exe`; `externalBin` covers `sidecars/sidecar` target-triple sidecar output.
- Root `pnpm bundle` runs frontend build, Tesseract resource setup, Windows PowerShell sidecar bundling, then `@groundtruth/tauri build`.
- Packaging audit passed for configured resources, Ollama installer, Tesseract executable/tessdata, installer icon, and bundle script wiring.
- Final Tauri build is blocked in this environment because `cargo` is not installed (`cargo metadata ... program not found`).

## [2026-05-15] Setup wizard model progress
- SetupWizard now renders fixed rows for llama3.2 and nomic-embed-text, maps sidecar progress percent into per-model bars, and shows queued/downloading/verifying/ready/failed states.
- Get Started remains disabled until sidecar setup status reports Ollama running and both required models installed=true; 100% pull progress alone maps to verifying until status confirms install.
- Active pull polling runs every 1s and failed progress surfaces progress.error in the UI.

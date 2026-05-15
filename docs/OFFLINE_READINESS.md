# Offline Readiness Audit

## Core Philosophy
GroundTruth Local is designed to operate entirely without internet access once initial setup (model downloads) is complete. No user data, documents, or telemetry are ever sent to external servers.

## Dependency Audit

### 1. LLM (Ollama)
- **Status**: Offline capable.
- **Requirement**: Models (`llama3.2`, `nomic-embed-text`) must be pre-pulled via `ollama pull`.
- **Validation**: API calls are made to `localhost:11434`.

### 2. OCR (Tesseract)
- **Status**: Offline capable.
- **Requirement**: Tesseract binary and language data (`tessdata`) must be installed locally.
- **Validation**: Sidecar invokes `tesseract` via subprocess.

### 3. Backend (Python Sidecar)
- **Status**: Offline capable.
- **Requirement**: Virtual environment contains all required libraries (FastAPI, LangChain, etc.). No dynamic downloading at runtime.
- **Validation**: `uv` or `pip` installs dependencies during setup/build.

### 4. Frontend (React/Tauri)
- **Status**: Offline capable.
- **Audit**:
    - [x] No external CDNs (fonts, scripts, images).
    - [x] No external API calls (except `localhost` sidecar/ollama).
    - [x] All assets bundled in Tauri binary.

## Verification Checklist for Deployment
- [ ] Disable Wi-Fi and attempt to import a PDF.
- [ ] Run OCR and confirm extraction.
- [ ] Run LLM analysis and confirm output.
- [ ] Verify no "blocked" network requests in dev tools (except localhost).

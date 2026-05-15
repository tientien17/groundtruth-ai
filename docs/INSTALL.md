# Installation Guide

## Runtime Dependencies
The following must be installed on your system:

1. **Rust**: Required for Tauri.
   - Install via [rustup.rs](https://rustup.rs/).
2. **Node.js & pnpm**: Frontend and build management.
   - Node.js 18+ recommended.
   - `npm install -g pnpm`
3. **Python 3.11+**: Powers the backend sidecar.
   - `uv` is recommended for environment management.
4. **Ollama**: Local LLM runner.
   - Download from [ollama.com](https://ollama.com/).
   - Pull required models:
     ```bash
     ollama pull llama3.2
     ollama pull nomic-embed-text
     ```
5. **Tesseract OCR**: For PDF text extraction.
   - **Windows**: Install via [UB-Mannheim](https://github.com/UB-Mannheim/tesseract/wiki). Add to PATH.
   - **macOS**: `brew install tesseract`
   - **Linux**: `sudo apt install tesseract-ocr`

## Development Setup

1. **Clone repository**:
   ```bash
   git clone <repo-url>
   cd civils-local-ai
   ```

2. **Install Node dependencies**:
   ```bash
   pnpm install
   ```

3. **Setup Python Sidecar**:
   ```bash
   cd apps/sidecar
   uv venv
   source .venv/bin/activate # Windows: .venv\Scripts\activate
   uv pip install -e .
   ```

4. **Run in Development**:
   ```bash
   # From root
   pnpm --filter @groundtruth/tauri tauri dev
   ```

## Production Build

1. **Package Sidecar**:
   ```bash
   ./scripts/bundle_sidecar.sh
   ```

2. **Build Tauri App**:
   ```bash
   pnpm --filter @groundtruth/tauri tauri build
   ```

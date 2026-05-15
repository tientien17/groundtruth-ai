# GroundTruth Local MVP

**Offline-first desktop preconstruction intelligence cockpit** for construction takeoff with local AI workflows.

## Overview

GroundTruth Local is a desktop application built with Tauri 2, React, and Python FastAPI that enables construction professionals to:

- Import and manage construction plans (PDFs)
- Perform manual quantity takeoff with drawing tools
- Export quantities to Excel and annotated PDFs
- Use local AI (via Ollama) for plan analysis and search
- Work completely offline after initial setup

## Architecture

```
civils-local-ai/
├── apps/
│   ├── frontend/          # React + TypeScript + Vite UI
│   ├── tauri/             # Tauri 2 desktop shell
│   └── sidecar/           # Python FastAPI backend service
├── libs/
│   └── shared-contracts/  # Shared TypeScript/Python types
├── docs/                  # Installation and setup guides
├── fixtures/              # Test fixtures and sample projects
└── tests/                 # E2E and integration tests
```

## Quick Start

### Prerequisites

1. **Rust** (via [rustup.rs](https://rustup.rs/))
2. **Node.js 20+** and **pnpm 9+**
3. **Python 3.11+** with **uv** ([astral.sh/uv](https://astral.sh/uv))
4. **Ollama** ([ollama.com](https://ollama.com/))
5. **Tesseract OCR** (see [docs/INSTALL.md](docs/INSTALL.md))

### Installation

```bash
# 1. Clone repository
git clone <repo-url>
cd civils-local-ai

# 2. Install Node dependencies
pnpm install

# 3. Setup Python sidecar
cd apps/sidecar
uv venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
uv pip install -e .
cd ../..

# 4. Pull required Ollama models
ollama pull llama3.2
ollama pull nomic-embed-text

# 5. Run in development mode
pnpm --filter @groundtruth/tauri tauri dev
```

### Development Commands

```bash
# Run all workspaces in dev mode
pnpm dev

# Run linting across all workspaces
pnpm lint

# Run type checking
pnpm typecheck

# Run tests
pnpm test

# Build for production
pnpm build
```

## Key Features

### Manual Takeoff
- PDF viewer with zoom, pan, and navigation
- Drawing tools: point (count), polyline (linear), polygon (area)
- Scale calibration for accurate measurements
- Classification system and formula engine
- Undo/redo support

### AI-Assisted Workflows
- **Plan Copilot**: Chat interface with cited retrieval from indexed documents
- **Text Search**: Find and count text patterns (e.g., "W1" window tags)
- **Visual Search**: Find visually similar symbols on drawings
- Candidate review workflow (accept/reject before adding to takeoff)

### Export & Persistence
- Excel quantity export with classifications and sources
- Annotated PDF export with takeoff overlays
- Local project storage (`.gtl-project` folders)
- SQLite database for structured data
- Full audit trail for AI interactions

## Documentation

- **[Installation Guide](docs/INSTALL.md)** - Detailed setup instructions
- **[Offline Readiness](docs/OFFLINE_READINESS.md)** - Offline capability verification
- **[MVP Implementation](mvp-implementation.md)** - Complete architecture and design doc

## Privacy & Security

- **100% offline-first**: No data leaves your machine
- **Local AI only**: Ollama runs on localhost (cloud providers opt-in only)
- **Transparent storage**: Human-readable project folders
- **No telemetry**: Zero external network calls (except localhost services)

## Project Status

**Current Version**: 0.1.0 (MVP)

All core features implemented and verified:
- ✅ Desktop app with sidecar lifecycle management
- ✅ PDF ingestion with OCR fallback
- ✅ Manual takeoff workspace with geometry engine
- ✅ Excel and annotated PDF exports
- ✅ Local RAG/copilot with citations
- ✅ AI-assisted text and visual search
- ✅ Offline operation verified

See [.sisyphus/plans/groundtruth-local-mvp.md](.sisyphus/plans/groundtruth-local-mvp.md) for complete implementation plan and verification results.

## License

[Add license information]

## Contributing

[Add contribution guidelines]

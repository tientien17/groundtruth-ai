# PROJECT KNOWLEDGE BASE

**Generated:** 2026-05-15T18:49:19+08:00
**Commit:** b11379b
**Branch:** master

## OVERVIEW

Offline-first desktop preconstruction intelligence cockpit for construction takeoff with local AI workflows. Tauri 2 + React (TypeScript) + Python FastAPI sidecar + Ollama.

## STRUCTURE

```
root/
├── apps/frontend/       # React + Vite + TypeScript UI
├── apps/tauri/          # Tauri 2 desktop shell (Rust)
├── apps/sidecar/        # Python FastAPI backend service
├── apps/shared/         # Shared TypeScript geometry/utils
├── libs/shared-contracts/  # Shared type definitions
├── scripts/             # Build & release automation
├── changelog/           # Keep a Changelog fragments
├── docs/                # Installation guides
├── fixtures/            # Test fixtures & sample projects
└── tests/               # E2E + integration tests
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| UI components | `apps/frontend/src/components/` | React, organized by feature |
| Hooks | `apps/frontend/src/hooks/` | Custom React hooks |
| API routes | `apps/sidecar/` | FastAPI, route-based modules |
| Database | `apps/sidecar/database.py` | SQLite via SQLModel |
| Rust commands | `apps/tauri/src-tauri/src/` | Tauri IPC commands |
| Build pipeline | `scripts/release.ps1` | Interactive release orchestrator |
| Tests | `apps/*/src/**/*.test.*` | Vitest (TS), pytest (Python) |

## CONVENTIONS

- Monorepo with pnpm workspaces; filter with `--filter @groundtruth/<name>`
- TypeScript: strict mode, paths alias `@/` → `src/`
- ESLint: `react-refresh/only-export-components` (warn), unused vars warn with `_` prefix ignored
- Python: hatchling build, pytest with `testpaths = ["tests"]`, ruff linting (py311)
- Tauri: NSIS installer, `beforeBuildCommand` runs frontend build
- Changelog: fragment-based workflow — place `.md` under `changelog/unreleased/{dev,user}/`

## COMMANDS

```bash
pnpm dev          # Run all workspaces in dev mode
pnpm test         # Run all tests across workspaces
pnpm build        # Build all workspaces
pnpm bundle       # Full installer build (frontend → resources → sidecar → Tauri)
pnpm lint         # Lint all workspaces
pnpm typecheck    # TypeScript type checking (tsc --noEmit)
```

## NOTES

- Sidecar has both `pyproject.toml` (Python build) AND `package.json` (pnpm workspace bridge)
- All packages version-synced at `0.1.0` across 6 files (verified by release script)
- Release pipeline: `pwsh -NoProfile -File scripts/release.ps1` (interactive, 10 gates)

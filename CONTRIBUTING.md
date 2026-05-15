# Contributing to Civils Local AI

## Changelog Workflow
Project uses fragment-based changelog. Place change description in `changelog/unreleased/`.

- `changelog/unreleased/user/`: User-facing changes
- `changelog/unreleased/dev/`: Developer-facing changes

**Format**: `{NNN}-{slug}.md` (e.g., `123-add-sidebar.md`).
Each file contains brief markdown description. Fragments compile during release.

## Code Quality
Run checks before committing:
```bash
pnpm lint      # Linting
pnpm typecheck # Type checking
```

## Testing
Test suites cover all modules:
```bash
pnpm test      # Runs Vitest (frontend/shared), pytest (sidecar), Pester (scripts)
```

- **Frontend/Shared**: Vitest
- **Sidecar**: pytest
- **Scripts**: Pester (`scripts/__tests__/release.Tests.ps1`)

## Release Process
Release orchestrated via `scripts/release.ps1`. 10-gate pipeline handles: preflight, version sync (6 files), fragment compilation, tests, builds, artifact verification, checksums, cleanup, git tagging, reporting.

### Flags
- `-DryRun`: Preview without making changes
- `-SkipTests`: Bypass test suite
- `-SkipBuild`: Bypass artifact generation
- `-Version <semver>`: Force specific version

### Commands
```powershell
# Dry run preview
pwsh -NoProfile -File scripts/release.ps1 -DryRun

# Real release
pwsh -NoProfile -File scripts/release.ps1
```
Version synced across: root/frontend/tauri `package.json`, `Cargo.toml`, `tauri.conf.json`, `pyproject.toml`.

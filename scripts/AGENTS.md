# SCRIPTS KNOWLEDGE BASE

## OVERVIEW
Release and build automation suite for cross-platform distribution.

## FILES
| Path | Purpose |
|------|---------|
| `release.ps1` | Primary 10-gate interactive release pipeline. |
| `bundle_sidecar.ps1` | Bundles FastAPI sidecar via PyInstaller. |
| `setup_tesseract_resource.ps1` | Injects Tesseract OCR into Tauri resources. |
| `__tests__/` | Pester unit tests for automation logic. |

## USAGE
### Release Pipeline
Run `pwsh -File scripts/release.ps1`. Interactive flow requires manual confirmation at each gate.
Gates:
1. Preflight (git status, clean tree)
2. Version Sync (check 6 version files)
3. Fragment Compilation (merge unreleased changelogs)
4. Test Gate (pnpm test + pytest)
5. Build Gate (pnpm build)
6. Artifact Verification (check executables)
7. Checksum Generation (SHA256)
8. Cleanup (remove build artifacts)
9. Commit & Tag (git ops)
10. Final Report (summary)

### Support Scripts
- `bundle_sidecar.ps1`: Run before Tauri build to package Python environment.
- `setup_tesseract_resource.ps1`: Setup OCR binaries for desktop installer.

## CONVENTIONS
- PowerShell 7+ required.
- Gate failures halt pipeline immediately.
- Use `pnpm test` in `scripts/` to run Pester tests.
- Artifacts move to `dist/` before cleanup.
- Strictly interactive; no `--force` flags for production safety.

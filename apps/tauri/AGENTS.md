# TAURI AGENTS

## OVERVIEW
Tauri 2 shell managing desktop lifecycle, Rust IPC, and sidecar orchestration.

## STRUCTURE
```
apps/tauri/
├── src-tauri/
│   ├── src/           # Rust logic
│   │   ├── main.rs    # App entry
│   │   └── lib.rs     # Command registration & setup
│   ├── icons/         # App branding
│   ├── sidecars/      # Python FastAPI binary location
│   ├── resources/     # Tesseract & Ollama installers
│   ├── Cargo.toml     # Rust dependencies
│   └── tauri.conf.json # Bundle & security config
└── package.json       # Tauri CLI bridge
```

## WHERE TO LOOK
| Task | File |
|------|------|
| IPC Commands | `src-tauri/src/lib.rs` |
| Bundle Config | `src-tauri/tauri.conf.json` |
| Sidecar Definition | `tauri.conf.json` -> `externalBin` |
| App Resources | `src-tauri/resources/` |
| NSIS Installer | `tauri.conf.json` -> `bundle.windows.nsis` |

## CONVENTIONS
- Version Sync: keep `tauri.conf.json` version matched with root via `scripts/release.ps1`.
- Sidecars: Python backend must be built as `sidecar` binary in `src-tauri/sidecars/`.
- Frontend: `beforeBuildCommand` triggers `@groundtruth/frontend` build.
- Rust: use `tauri-plugin-shell` for process management.
- Security: strict CSP enforced; use `tauri::generate_context!`.

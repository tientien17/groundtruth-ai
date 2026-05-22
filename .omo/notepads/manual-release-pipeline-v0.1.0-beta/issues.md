## 2026-05-15 - release dry-run verification

- Full dry-run passed all 10 gates with dry-run equivalents; version check found `0.1.0` across package, Tauri, Cargo, and sidecar metadata.
- Fast dry-run passed all 10 gates with `-SkipTests -SkipBuild`; changelog compilation reported `[dry-run] Would compile changelog fragments into CHANGELOG.md` and `Changelog ready.`
- `pnpm test` failed in `apps/sidecar` during pytest collection because Python dependencies missing, first error: `ModuleNotFoundError: No module named 'sqlalchemy'`.
- `git status --short` and `git diff --stat` were not clean before/after verification; existing modified/untracked release work remains, so expected "no files modified" / empty diff outcome not met.

# Draft: Manual Release Pipeline v0.1.0 Beta

## Requirements (confirmed)
- Create work plan for CI/CD-style pipeline, but manual/local, not necessarily GitHub-based.
- Pipeline should support preparing `v0.1.0 beta`.
- Pipeline should track changelog.
- Changelog should separate developer-related changes from end-user-related changes.
- Project recently implemented all-in-one installer; release pipeline must account for it.

## Technical Decisions
- Pipeline style: local/manual script-first release flow unless user chooses otherwise.
- Release target: `v0.1.0 beta`.
- Changelog source: industry-standard changelog fragments chosen by planner. Use unreleased fragments separated into dev-facing and user-facing categories, compile into canonical changelog during release.
- Release script git behavior: interactive prompts before commit/tag steps.
- Beta artifacts: NSIS installer plus SHA256 checksums.
- Automated tests: tests-after for pipeline/changelog script behavior.

## Research Findings
- Workspace uses pnpm workspaces.
- Version metadata already `0.1.0` across root, Tauri, frontend, sidecar packages per release-map research.
- Existing bundle path: `pnpm bundle` runs frontend build, Tesseract setup, sidecar bundling, Tauri build.
- Tauri build configured for NSIS installer.
- Installer bundles resources including Tesseract and `OllamaSetup.exe`.
- No existing changelog/release notes convention found.
- Test infrastructure exists:
  - Frontend: Vitest + React Testing Library, `apps/frontend/vitest.config.ts`, jsdom, v8 coverage.
  - Shared: Vitest.
  - Sidecar: pytest via `apps/sidecar/pyproject.toml`.
  - Root: `pnpm test` runs recursive workspace tests.
  - Tauri package test script currently placeholder/echo only.

## Test Strategy Decision
- **Infrastructure exists**: YES
- **Automated tests**: YES (tests after)
- **Agent-Executed QA**: ALWAYS mandatory in final work plan.

## Open Questions
- Version bump location(s): package files, installer metadata, app constants, docs; research says package metadata already at 0.1.0 but plan should verify/sync all release metadata.
- Test/QA gate strictness before release: plan should include root tests, frontend/shared/sidecar tests, build, bundle, installer existence, checksum verification.

## Scope Boundaries
- INCLUDE: local manual pipeline plan, changelog separation, beta release preparation, installer-aware verification.
- EXCLUDE: hosted CI unless user asks.

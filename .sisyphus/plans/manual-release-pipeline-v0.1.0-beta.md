# Manual Release Pipeline + v0.1.0 Beta Preparation

## TL;DR

> **Quick Summary**: Create a local, interactive manual CI/CD-style release pipeline using Keep a Changelog fragments (separated into dev/user categories) plus a PowerShell release script. Then prepare v0.1.0-beta with retrospective changelog entries from existing git history.

> **Deliverables**:
> - `CHANGELOG.md` — canonical changelog at project root
> - `changelog/unreleased/dev/` and `changelog/unreleased/user/` — fragment directories
> - `scripts/release.ps1` — interactive release pipeline script
> - Tests for `scripts/release.ps1` (tests-after)
> - v0.1.0-beta release artifacts (NSIS installer + SHA256 checksums)
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Task 1 → Task 3 → Task 4 → Task 6

---

## Context

### Original Request
> "Create a CI/CD pipeline, not necessarily thru github — just a local script tracking changelog separating dev related changes and end user related changes. A true manual pipeline, let's prepare a v0.1.0 beta."

### Interview Summary
**Key Discussions**:
- Changelog source: Industry-standard **fragments** (Keep a Changelog style) — dev places `.md` fragments under `changelog/unreleased/{dev,user}/`, release script compiles them into `CHANGELOG.md`.
- Release script git behavior: **Interactive** — script prompts before commit/tag/build/publish steps.
- Beta artifacts: **NSIS installer + SHA256 checksums** — Tauri build output plus checksum manifest.
- Automated tests: **Tests-after** for the pipeline script itself.

**Research Findings**:
| Location | Version | Notes |
|----------|---------|-------|
| `package.json` (root) | `0.1.0` | pnpm workspace root |
| `apps/frontend/package.json` | `0.1.0` | React + Vite |
| `apps/tauri/package.json` | `0.1.0` | Tauri 2 shell |
| `apps/tauri/src-tauri/Cargo.toml` | `0.1.0` | Rust backend |
| `apps/tauri/src-tauri/tauri.conf.json` | `0.1.0` | Tauri bundle config |
| `apps/sidecar/pyproject.toml` | `0.1.0` | Python FastAPI |

- Existing bundle: `pnpm bundle` (frontend build → Tesseract resource → PyInstaller sidecar → Tauri NSIS build)
- Scripts: `scripts/bundle_sidecar.ps1`, `scripts/setup_tesseract_resource.ps1`
- Tests: frontend (Vitest + RTL, 7 test files), shared (Vitest), sidecar (pytest), root (`pnpm test`)
- No existing CHANGELOG or convention
- Recent commits: `chore: finalizing commits prior to first batch of release`, `feat: implement single-click Windows installer...`, etc.

### Metis Review
> _(consultation skipped due to backend issues; self-review applied instead)_
>
> **Identified Gaps & Self-Resolutions**:
> - No existing `shared-contracts` version check — resolved by verifying all 5 version locations in the plan.
> - No existing `libs/shared-contracts/package.json` — confirmed it exists in workspace; added to version checklist.
> - Fragment format unstated — resolved by adopting Markdown file with single-line summary convention.
> - NSIS installer output path varies by Tauri version — resolved by using `Get-ChildItem` glob in script.

---

## Work Objectives

### Core Objective
Build a local interactive release pipeline that enforces quality gates, compiles a dual-track changelog, produces verified artifacts, and guides the user through the release process. Then populate v0.1.0-beta changelog from existing git history.

### Concrete Deliverables
- `CHANGELOG.md` at project root
- `changelog/unreleased/dev/` directory (with `.gitkeep`)
- `changelog/unreleased/user/` directory (with `.gitkeep`)
- `scripts/release.ps1` — interactive release pipeline
- `scripts/__tests__/release.Tests.ps1` — Pester tests for the script
- v0.1.0-beta installer `.exe` + `.sha256` checksum file

### Definition of Done
- [ ] Running `scripts/release.ps1 -DryRun` validates every gate (clean tree, version match, tests pass, build succeeds)
- [ ] Running `scripts/release.ps1` (interactive) compiles fragments, updates CHANGELOG, builds installer, generates SHA256
- [ ] `CHANGELOG.md` contains v0.1.0-beta entries (retrospective from git history)
- [ ] `pnpm test` passes with new pipeline tests included

### Must Have
- Interactive prompts before commit/tag creation
- Changelog sections clearly separating "User-Facing Changes" from "Developer-Facing Changes"
- Automatic SHA256 checksum generation for installer artifact
- Dry-run mode that does NOT modify any files or git state

### Must NOT Have (Guardrails)
- No GitHub Actions / hosted CI — this is a local-only script
- No modification to existing build scripts (`bundle_sidecar.ps1`, `setup_tesseract_resource.ps1`) — the pipeline uses them as-is
- No automatic deployment or publishing
- No requirement for existing tests to change (only add new pipeline tests)
- No committing changelog fragments — fragments are removed after compilation

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (Vitest frontend, Vitest shared, pytest sidecar)
- **Automated tests**: YES (Tests-after for pipeline script — Pester for PowerShell)
- **Framework**: Pester (`Invoke-Pester` for PowerShell tests) + existing Vitest/pytest

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **PowerShell scripts**: Run with `pwsh -NoProfile` and validate output/exit codes
- **File structure**: Use `Test-Path`, `Get-ChildItem` to verify directories/files
- **Installer**: Verify `.exe` exists in Tauri output, generate and verify SHA256
- **Changelog**: Parse with regex to verify sections and content

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — 2 parallel tasks):
├── Task 1: CHANGELOG.md skeleton + fragment directories
└── Task 2: .gitignore entries for changelog fragment workflow

Wave 2 (Core pipeline — 2 sequential + 1 parallel):
├── Task 3: scripts/release.ps1 — interactive release pipeline
├── Task 4: Pester tests for release.ps1 [depends: 3]
└── Task 5: Retrospective v0.1.0-beta changelog entries [parallel to 3]

Wave 3 (Verification — pipeline dry-run):
└── Task 6: Dry-run release pipeline, verify all gates pass
```

### Dependency Matrix
- **1, 2**: None (start immediately)
- **3**: 1, 2 — blocks 4
- **4**: 3 — blocks 6
- **5**: 1 — parallel to 3
- **6**: 3, 4, 5

---

## TODOs

- [x] 1. Create CHANGELOG.md skeleton + fragment directories

  **What to do**:
  - Create `CHANGELOG.md` at project root following Keep a Changelog format.
  - Create directory structure: `changelog/unreleased/dev/` and `changelog/unreleased/user/`.
  - Place `.gitkeep` files inside both fragment directories so they are tracked by git.
  - The CHANGELOG skeleton should have:
    - `# Changelog` header
    - `## [Unreleased]` section with `### User-Facing Changes` and `### Developer-Facing Changes` subheadings
    - Release format guide comment block at bottom (explaining the fragment workflow)
    - Link references `[Unreleased]: ...` at the bottom

  **Must NOT do**:
  - Do NOT populate changelog entries yet (Task 5 handles historical entries)
  - Do NOT modify any existing files

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple file creation tasks, no complex logic
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Tasks 3, 5
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `CHANGELOG.md` format: follow https://keepachangelog.com/en/1.1.0/ structure
  - Fragment approach: modeled after towncrier/changie convention

  **Acceptance Criteria**:
  - [ ] `CHANGELOG.md` exists at root with correct sections
  - [ ] `changelog/unreleased/dev/.gitkeep` exists
  - [ ] `changelog/unreleased/user/.gitkeep` exists
  - [ ] CHANGELOG.md has `## [Unreleased]` with both subheadings

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: CHANGELOG.md structure verification
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run `Test-Path -LiteralPath "CHANGELOG.md"`
      2. Get-Content "CHANGELOG.md" and check for "## [Unreleased]"
      3. Check for "### User-Facing Changes" and "### Developer-Facing Changes"
    Expected Result: All three sections present
    Evidence: .sisyphus/evidence/task-1-changelog-sections.txt

  Scenario: Fragment directories exist
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run `Test-Path "changelog/unreleased/dev/.gitkeep"`
      2. Run `Test-Path "changelog/unreleased/user/.gitkeep"`
    Expected Result: Both paths return True
    Evidence: .sisyphus/evidence/task-1-fragment-dirs.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-1-changelog-sections.txt`
  - [ ] `.sisyphus/evidence/task-1-fragment-dirs.txt`

  **Commit**: YES
  - Message: `chore: add CHANGELOG skeleton and fragment directory structure`
  - Files: `CHANGELOG.md`, `changelog/unreleased/dev/.gitkeep`, `changelog/unreleased/user/.gitkeep`
  - Pre-commit: `git status` to verify only new files

---

- [x] 2. Update .gitignore for changelog workflow

  **What to do**:
  - Add `.gitkeep` to `.gitignore` exceptions (ensure `.gitkeep` files are NOT ignored — they should be tracked).
  - Add a comment section `# Changelog fragments` to `.gitignore` for future fragment exclusions (none needed now since fragments are tracked, but mark the section).
  - Verify existing `.gitignore` doesn't accidentally exclude `changelog/` directory.

  **Must NOT do**:
  - Do NOT change any existing `.gitignore` rules, only append the comment section
  - Do NOT add wildcard exclusions for fragments (we want them tracked)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple one-file edit, no logic
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: None (advisory — Task 3 benefits but not blocked)
  - **Blocked By**: None

  **References**:
  - `.gitignore` at project root — read before editing

  **Acceptance Criteria**:
  - [ ] `.gitignore` has a `# Changelog fragments` comment section
  - [ ] New `changelog/` directories are not excluded by existing rules

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: .gitignore contains changelog section
    Tool: Bash
    Preconditions: None
    Steps:
      1. Get-Content ".gitignore" | Select-String "Changelog fragments"
    Expected Result: Output contains match
    Evidence: .sisyphus/evidence/task-2-gitignore-section.txt

  Scenario: changelog directory is not ignored
    Tool: Bash
    Preconditions: Task 1 complete (changelog dirs exist)
    Steps:
      1. Run `git add --dry-run changelog/` — should show files would be added
    Expected Result: No "ignored" warning, files would be tracked
    Evidence: .sisyphus/evidence/task-2-gitignore-not-ignored.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-2-gitignore-section.txt`
  - [ ] `.sisyphus/evidence/task-2-gitignore-not-ignored.txt`

  **Commit**: YES (groups with Task 1)
  - Message: `chore: add changelog section to .gitignore`
  - Files: `.gitignore`

---

- [x] 3. Implement `scripts/release.ps1` — interactive release pipeline

  **What to do**:
  Create a comprehensive PowerShell script at `scripts/release.ps1` that orchestrates the full release process.

  **Script requirements**:

  **Parameters**:
  - `-Version <string>` — Release version (default: auto-detect from root package.json)
  - `-DryRun [switch]` — Validate all gates without modifying any files or git state
  - `-SkipTests [switch]` — Skip test execution (for quick verification)
  - `-SkipBuild [switch]` — Skip build step (use existing artifacts)

  **Release gates (execute in order, halt on failure unless skipped):**
  1. **Preflight check**: Working tree must be clean (`git diff --stat` returns empty). Skip check if `-DryRun` not set (allow dirty in interactive mode with warning).
  2. **Version consistency check**: Read version from all 6 locations and verify they match:
     - `package.json` (root)
     - `apps/frontend/package.json`
     - `apps/tauri/package.json`
     - `apps/tauri/src-tauri/Cargo.toml` (parse with regex)
     - `apps/tauri/src-tauri/tauri.conf.json`
     - `apps/sidecar/pyproject.toml` (parse with regex)
     - If `libs/shared-contracts/package.json` exists, check that too
     - Report mismatches with file path and expected vs actual
  3. **Changelog fragment compilation**:
     - Read all `.md` files from `changelog/unreleased/user/` sorted by name
     - Read all `.md` files from `changelog/unreleased/dev/` sorted by name
     - Insert them into `CHANGELOG.md` under a new `## [v{version}] - {date}` section
     - The section has `### User-Facing Changes` and `### Developer-Facing Changes` subheadings
     - Update `[Unreleased]` and add `[v{version}]` link references at bottom
     - In dry-run mode: print what would be added, don't modify the file
     - In interactive mode: show compiled changelog diff and ask "Does this look correct? [Y/n]"
  4. **Test gate**: Run `pnpm test`. Fail if any test fails. Display passed/failed summary.
  5. **Build gate**: Run `pnpm bundle`. Fail if build fails. (Takes a while — print progress)
  6. **Artifact verification**: Locate the NSIS installer `.exe` in `apps/tauri/src-tauri/target/release/bundle/nsis/`. Verify it exists and is > 0 bytes.
  7. **Checksum generation**: Generate `SHA256` checksum for the installer `.exe`. Write to `{installer}.sha256` file alongside the installer.
  8. **Fragment cleanup**: Delete all `.md` files from `changelog/unreleased/` subdirectories. In dry-run mode, only list what would be deleted.
  9. **Interactive release commit**:
     - Show release summary (version, files changed, artifact path, checksum)
     - Ask "Stage all changes for release commit? [y/N]"
     - If yes: `git add CHANGELOG.md`, `git add changelog/unreleased/dev/*.removed` (or just the root CHANGELOG + leftovers)
     - Actually, git add the changed files: `CHANGELOG.md`, and any modified version files
     - Ask "Create release commit and tag v{version}? [y/N]"
     - If yes: `git commit -m "release: v{version}"`, `git tag v{version}`
  10. **Post-release report**: Print final summary with artifact location, checksum, commit hash, and tag name.

  **Error handling**:
  - Use `try/catch` for each gate with error messages
  - Use `$ErrorActionPreference = "Stop"` at top of script
  - Each gate should be idempotent or have cleanup logic
  - On failure, print detailed error and suggest `-DryRun` for debugging

  **Implementation notes**:
  - Use `Write-Host -ForegroundColor Green/Cyan/Yellow/Red` for colored output
  - Use `Read-Host` for interactive prompts (default yes/no with capitalized default)
  - Parse Cargo.toml with regex: `version\s*=\s*"(.+)"`
  - Use `Get-FileHash -Algorithm SHA256` for checksum generation
  - Script must be callable as: `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 -Version "0.1.0-beta"`

  **Must NOT do**:
  - Do NOT modify `package.json` version fields automatically (user should do this manually before running release)
  - Do NOT run `git push` under any circumstances
  - Do NOT require any external dependencies beyond what's already in the project (Node, pnpm, Rust, Python, uv, Tesseract)
  - Do NOT implement automatic deployment

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex PowerShell script with multiple gates, error handling, interactive flow
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO (core deliverable)
  - **Blocks**: Tasks 4, 6
  - **Blocked By**: Tasks 1, 2

  **References**:
  **Pattern References**:
  - `scripts/bundle_sidecar.ps1:1-27` — Existing sidecar bundling script pattern (`$ErrorActionPreference`, `Join-Path`, `Push-Location`/`Pop-Location`, console output conventions)
  - `scripts/setup_tesseract_resource.ps1:1-25` — Existing resource setup script pattern (error handling with `throw`, path conventions)
  - `package.json:16` — Existing `pnpm bundle` command (the compound script we call from release.ps1)
  - `apps/tauri/src-tauri/tauri.conf.json:28` — NSIS bundle target configuration `"targets": ["nsis"]`
  - `apps/tauri/src-tauri/tauri.conf.json:3-4` — Product name and version location

  **External References**:
  - Keep a Changelog spec: https://keepachangelog.com/en/1.1.0/ — Section format for changelog compilation
  - Changelog fragment convention: inspired by towncrier (Python) and changie (Go) — fragments are individual `.md` files in `unreleased/` subdirectories

  **Acceptance Criteria**:
  - [ ] `scripts/release.ps1` exists and is callable with `-DryRun`
  - [ ] `pwsh -NoProfile -File scripts/release.ps1 -DryRun` runs all gates without modifying any files
  - [ ] Version inconsistency detection works (test by temporarily changing one version)
  - [ ] Changelog fragment compilation produces correct output
  - [ ] Installer detection finds NSIS `.exe`
  - [ ] SHA256 file generated alongside installer

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Dry-run completes without errors
    Tool: Bash (pwsh)
    Preconditions: Clean working tree, existing fragments (create test fragments)
    Steps:
      1. Create test fragment: Set-Content "changelog/unreleased/user/test-feature.md" "- Added test feature for verification"
      2. Create test fragment: Set-Content "changelog/unreleased/dev/test-refactor.md" "- Refactored internal module"
      3. Run: `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 -DryRun`
      4. Check exit code is 0
      5. Check test fragments still exist (dry-run didn't delete)
      6. Clean up test fragments: Remove-Item "changelog/unreleased/user/test-feature.md", "changelog/unreleased/dev/test-refactor.md"
    Expected Result: Exit code 0, dry-run shows all gates, no files modified
    Evidence: .sisyphus/evidence/task-3-dry-run.txt

  Scenario: Version mismatch detection
    Tool: Bash (pwsh)
    Preconditions: Temporarily change one version file
    Steps:
      1. Backup original: Copy-Item "apps/tauri/package.json" "apps/tauri/package.json.bak"
      2. Edit version: (Get-Content "apps/tauri/package.json") -replace '"0.1.0"', '"9.9.9"' | Set-Content "apps/tauri/package.json"
      3. Run: `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 -DryRun`
      4. Check output contains "version mismatch" or "MISMATCH"
      5. Restore: Move-Item "apps/tauri/package.json.bak" "apps/tauri/package.json" -Force
    Expected Result: Script detects and reports version mismatch, non-zero exit or clear error message
    Evidence: .sisyphus/evidence/task-3-version-mismatch.txt

  Scenario: Help/usage output
    Tool: Bash (pwsh)
    Preconditions: None
    Steps:
      1. Run: `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 -?`
    Expected Result: Usage instructions printed, exit code 0
    Evidence: .sisyphus/evidence/task-3-help.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-3-dry-run.txt`
  - [ ] `.sisyphus/evidence/task-3-version-mismatch.txt`
  - [ ] `.sisyphus/evidence/task-3-help.txt`

  **Commit**: YES
  - Message: `feat: add interactive release pipeline script (scripts/release.ps1)`
  - Files: `scripts/release.ps1`
  - Pre-commit: Verify script loads without syntax errors: `pwsh -NoProfile -Command "& { . .\scripts\release.ps1; Write-Host 'Syntax OK' }"`

---

- [x] 4. Write Pester tests for scripts/release.ps1

  **What to do**:
  - Create `scripts/__tests__/release.Tests.ps1` with Pester tests.
  - Since Pester may not be installed, the tests should:
    1. Check if Pester is available; if not, skip with message
    2. Use `Set-PSRepository -InstallationPolicy Trusted` and `Install-Module Pester -Force -Scope CurrentUser -SkipPublisherCheck` or use the built-in Pester
  - Alternatively, write the tests as standalone PowerShell assertions (without Pester) that output PASS/FAIL for each test case.
  - **Key test cases**:
    1. **Script loads without errors**: `& { . .\scripts\release.ps1; Write-Host "OK" }` — should not throw
    2. **Version parsing from Cargo.toml**: Extract version via regex `version\s*=\s*"(.+)"` and verify it matches `\d+\.\d+\.\d+`
    3. **Version parsing from pyproject.toml**: Same pattern
    4. **Dry-run flag passthrough**: Script should accept `-DryRun` without error
    5. **Help flag**: Script should accept `-?` and print usage
    6. **Changelog fragment detection**: Script detects `.md` files in unreleased dirs
    7. **SHA256 generation**: Script produces correct format checksum file
  - Use `.\scripts\release.ps1 -DryRun -SkipTests -SkipBuild` for fast validation tests that don't require full build

  **Must NOT do**:
  - Do NOT modify any existing production code or tests
  - Do NOT require external CI services to run

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Script testing, well-scoped
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Task 6
  - **Blocked By**: Task 3

  **References**:
  **Pattern References**:
  - `apps/frontend/src/components/Workspace/Workspace.test.tsx:1-5` — Example test structure in the project (describe/it pattern)
  - `scripts/bundle_sidecar.ps1:1-27` — PowerShell patterns used in the project's existing scripts

  **Acceptance Criteria**:
  - [ ] `scripts/__tests__/release.Tests.ps1` exists
  - [ ] Running the test script produces clear PASS/FAIL for each case
  - [ ] All core logic paths are covered (version parse, fragment compile, dry-run, help)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Tests run and pass
    Tool: Bash (pwsh)
    Preconditions: release.ps1 exists (Task 3)
    Steps:
      1. Run: `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/__tests__/release.Tests.ps1`
      2. Check exit code is 0
      3. Check output contains "PASS" for all test cases
    Expected Result: All tests pass with PASS output
    Evidence: .sisyphus/evidence/task-4-tests-pass.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-4-tests-pass.txt`

  **Commit**: YES (groups with Task 3)
  - Message: `test: add Pester tests for release pipeline script`
  - Files: `scripts/__tests__/release.Tests.ps1`
  - Pre-commit: `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/__tests__/release.Tests.ps1`

---

- [x] 5. Populate retrospective v0.1.0-beta changelog entries

  **What to do**:
  - Examine git log to extract notable changes from the existing commit history.
  - Based on git history:
    ```
    chore: finalizing commits prior to first batch of release
    feat: implement single-click Windows installer with prerequisite automation
    feat: complete GroundTruth Local MVP implementation
    feat(ingestion): add SQLite schema and project folder service
    Initial scaffold: research.md + mvp-implementation.md
    ```
  - Write retrospective changelog entries in the `changelog/unreleased/user/` and `changelog/unreleased/dev/` directories as `.md` fragments.
  - Each fragment file name: `{NNN}-{short-description}.md` (e.g., `001-windows-installer.md`)
  - Fragment content: Single-line Markdown description beginning with `- Added`, `- Fixed`, `- Changed`, etc.
  
  **Suggested fragments**:

  **User-Facing** (`changelog/unreleased/user/`):
  - `001-windows-installer.md`: `- Added single-click Windows installer with prerequisite automation`
  - `002-mvp-takeoff.md`: `- Added manual quantity takeoff with PDF viewer and drawing tools`
  - `003-plan-copilot.md`: `- Added AI-powered Plan Copilot with retrieval-augmented chat`
  - `004-visual-search.md`: `- Added visual search for finding similar symbols on drawings`
  - `005-export-excel-pdf.md`: `- Added Excel quantity export and annotated PDF export`

  **Developer-Facing** (`changelog/unreleased/dev/`):
  - `001-project-scaffold.md`: `- Initial project scaffold with pnpm workspaces and Tauri 2 shell`
  - `002-sqlite-schema.md`: `- Added SQLite database schema and project folder service`
  - `003-sidecar-fastapi.md`: `- Added Python FastAPI sidecar with PyInstaller bundling`
  - `004-test-infra.md`: `- Set up Vitest, React Testing Library, and pytest test infrastructure`

  **Must NOT do**:
  - Do NOT modify `CHANGELOG.md` directly — fragments go into `changelog/unreleased/`
  - Do NOT make up changes — only extract from actual git history
  - Do NOT include work that hasn't been committed

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Curating historical changelog entries from git history
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References**:
  - Git log (provided above)
  - Task 1 fragment directory structure (where to place files)

  **Acceptance Criteria**:
  - [ ] 5+ user-facing fragment files in `changelog/unreleased/user/`
  - [ ] 4+ dev-facing fragment files in `changelog/unreleased/dev/`
  - [ ] Each fragment is a valid `.md` file with a `- ` prefixed description
  - [ ] Fragments are sorted by filename order (001, 002, ...)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: User-facing fragments exist and are well-formed
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: `Get-ChildItem "changelog/unreleased/user/*.md"`
      2. For each file, verify content starts with "- "
      3. Count should be >= 5
    Expected Result: 5+ user-facing fragment files, each with valid content
    Evidence: .sisyphus/evidence/task-5-user-fragments.txt

  Scenario: Dev-facing fragments exist and are well-formed
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: `Get-ChildItem "changelog/unreleased/dev/*.md"`
      2. For each file, verify content starts with "- "
      3. Count should be >= 4
    Expected Result: 4+ dev-facing fragment files, each with valid content
    Evidence: .sisyphus/evidence/task-5-dev-fragments.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-5-user-fragments.txt`
  - [ ] `.sisyphus/evidence/task-5-dev-fragments.txt`

  **Commit**: YES (groups with Tasks 1, 2)
  - Message: `docs: add v0.1.0-beta retrospective changelog fragments`
  - Files: All files under `changelog/unreleased/`

---

- [x] 6. Dry-run release pipeline and verify complete flow

  **What to do**:
  - Execute `scripts/release.ps1 -DryRun` and capture full output.
  - Verify every gate executes successfully in order.
  - Then execute `scripts/release.ps1 -DryRun -SkipTests -SkipBuild` for fast validation.
  - Verify the script correctly detects all version locations.
  - Verify the script correctly compiles changelog fragments without modifying the file (dry-run).
  - Check that existing tests still pass across the project.
  - If any gate fails, fix the script (Task 3) until all pass.

  **Must NOT do**:
  - Do NOT run the actual (non-dry-run) release — this is pre-release verification
  - Do NOT modify `CHANGELOG.md` or any tracked files

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Integration testing of the script against real project state
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (final verification)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 3, 4, 5

  **References**:
  - All previous tasks

  **Acceptance Criteria**:
  - [ ] `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 -DryRun` exits with code 0
  - [ ] All gates report PASS (preflight, version check, fragment compilation, tests, build)
  - [ ] `pnpm test` passes with all existing + new tests
  - [ ] No files were modified (git diff --stat is empty after dry-run)
  - [ ] Changelog fragments are untouched (not deleted) after dry-run

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full pipeline dry-run passes all gates
    Tool: Bash (pwsh)
    Preconditions: All previous tasks complete, clean git tree
    Steps:
      1. Run: `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 -DryRun -Version "0.1.0-beta"`
      2. Check exit code
      3. Grep output for "PASS" or "OK" patterns from each gate
      4. Run: `git diff --stat` to verify no files changed
      5. Run: `Test-Path "changelog/unreleased/user/001-windows-installer.md"` to verify fragments exist
    Expected Result: Exit code 0, all gates pass, clean git tree, fragments untouched
    Evidence: .sisyphus/evidence/task-6-full-dry-run.txt

  Scenario: Fast dry-run with skipped tests/build
    Tool: Bash (pwsh)
    Preconditions: release.ps1 exists
    Steps:
      1. Run: `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 -DryRun -SkipTests -SkipBuild`
      2. Check exit code
      3. Verify output shows "SKIP" for test and build gates but runs version check, fragment compilation
    Expected Result: Exit code 0, test/build gates skipped with clear messaging
    Evidence: .sisyphus/evidence/task-6-fast-dry-run.txt

  Scenario: Existing project tests still pass
    Tool: Bash
    Preconditions: Clean state
    Steps:
      1. Run: `pnpm test`
      2. Check exit code
    Expected Result: Exit code 0, all existing and new tests pass
    Evidence: .sisyphus/evidence/task-6-tests-pass.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-6-full-dry-run.txt`
  - [ ] `.sisyphus/evidence/task-6-fast-dry-run.txt`
  - [ ] `.sisyphus/evidence/task-6-tests-pass.txt`

  **Commit**: NO (verification only, no code changes)

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`
- [x] F2. **Code Quality Review** — `unspecified-high`
- [x] F3. **Real Manual QA** — `unspecified-high`
- [x] F4. **Scope Fidelity Check** — `deep`
  Verify each task's deliverables match the spec. No scope creep: no GitHub Actions, no CI config files, no modifications to existing build scripts, no automatic deployment. Check that `scripts/release.ps1` does NOT call `git push`. Verify no changes to `apps/` source code beyond release script.
  Output: `Tasks [6/6 compliant] | Contamination [CLEAN] | VERDICT`

---

## Commit Strategy

| Commit | Tasks | Message |
|--------|-------|---------|
| 1 | 1, 2, 5 | `docs: add CHANGELOG skeleton, fragment dirs, and v0.1.0-beta retrospective entries` |
| 2 | 3, 4 | `feat: add interactive release pipeline script with Pester tests` |

---

## Success Criteria

### Verification Commands
```powershell
# Full dry-run (complete pipeline validation)
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 -DryRun -Version "0.1.0-beta"
# Expected: Exit 0, all gates PASS

# Fast validation (no tests/build)
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 -DryRun -SkipTests -SkipBuild
# Expected: Exit 0, non-skipped gates PASS

# All project tests pass
pnpm test
# Expected: Exit 0, all tests pass

# Script syntax check
pwsh -NoProfile -Command "& { . .\scripts\release.ps1; Write-Host 'OK' }"
# Expected: Prints 'OK'

# Changelog structure
Get-ChildItem "changelog/unreleased/user/*.md" | Measure-Object | Select-Object -ExpandProperty Count
# Expected: >= 5

Get-ChildItem "changelog/unreleased/dev/*.md" | Measure-Object | Select-Object -ExpandProperty Count
# Expected: >= 4
```

### Final Checklist
- [ ] `scripts/release.ps1` exists and all 3 QA scenarios pass
- [ ] `scripts/__tests__/release.Tests.ps1` exists and passes
- [ ] `CHANGELOG.md` has correct Keep a Changelog structure
- [ ] `changelog/unreleased/user/` has 5+ fragment files
- [ ] `changelog/unreleased/dev/` has 4+ fragment files
- [ ] Full dry-run exits with code 0 without modifying any files
- [ ] `pnpm test` passes
- [ ] All evidence files captured
- [ ] Git commits created with correct messages

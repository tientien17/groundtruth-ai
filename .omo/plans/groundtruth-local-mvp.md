# GroundTruth Local MVP Implementation Work Plan

## TL;DR

> **Quick Summary**: Build greenfield offline-first desktop app from `mvp-implementation.md` using Tauri 2 shell, React/Vite frontend, and Python FastAPI sidecar, with manual takeoff and exports first, then local AI workflows.
>
> **Deliverables**:
> - Installable Tauri desktop shell with React UI and Python sidecar
> - Local project storage, PDF ingestion, manual takeoff, exports, local RAG/copilot, AI-assisted search/counting
> - Automated test harness, fixtures, and final verification wave
>
> **Estimated Effort**: XL
> **Parallel Execution**: YES - 5 waves + final verification
> **Critical Path**: T1 → T5 → T10 → T16 → T20 → T24 → F1-F4

---

## Context

### Original Request
Plan out implementation of this repo using `mvp-implementation.md`.

### Interview Summary
**Key Discussions**:
- Repo is effectively empty. Only planning docs exist.
- `mvp-implementation.md` is source of truth for MVP architecture, scope, stack, and milestone order.
- Work must remain offline-first and local-first.
- Plan must include test infrastructure because none exists.

**Research Findings**:
- Existing files: `mvp-implementation.md`, `research.md`, `.gitignore`.
- No code, package managers, CI, test config, or scaffolding exist.
- This is greenfield build, not refactor.

### Metis Review
**Identified Gaps** (addressed):
- Sidecar lifecycle, dynamic port, and offline behavior now explicit in tasks and acceptance criteria.
- Scope creep around collaboration, auto-takeoff, cloud-first behavior, and annotation bloat locked down.
- Edge cases added: malformed/password PDFs, missing Ollama, path issues, disk exhaustion, DPI mapping, duplicate import.
- Acceptance criteria strengthened for measurement accuracy, export validity, RAG grounding, and sidecar shutdown.

---

## Work Objectives

### Core Objective
Create first working MVP of GroundTruth Local as desktop-first, offline-first preconstruction intelligence cockpit with useful value before AI perfection: import plans/specs, perform manual takeoff, export results, then add cited local AI workflows.

### Concrete Deliverables
- Tauri 2 desktop shell with React + TypeScript + Vite frontend.
- Python FastAPI sidecar launched and managed by desktop app.
- Transparent local project folder structure and SQLite schema.
- PDF ingestion pipeline with text extraction, OCR fallback, thumbnails, and sheet metadata.
- Manual drawing workspace with scale calibration, area/linear/count tools, classifications, formulas MVP, persistence, undo/redo.
- Excel quantity export and annotated PDF export.
- Local RAG/copilot with citations and audit logs.
- AI-assisted text search/counting and basic visual search candidate workflow.

### Definition of Done
- [x] Desktop app starts sidecar and passes localhost health check.
- [x] User can create project, import PDF, and reopen later with preserved data.
- [x] Manual takeoff quantities persist and export correctly.
- [x] Copilot answers with citations only from indexed local data.
- [x] AI-assisted candidate workflow requires explicit accept/reject before counts land in takeoff.
- [x] App usable offline after local dependencies/models installed.

### Must Have
- Offline-first by default.
- Local transparent project storage.
- Deterministic quantity computation by tools, not LLM freeform answers.
- Audit trail for AI runs, tool calls, and user edits.
- Automated test infrastructure and fixtures.

### Must NOT Have (Guardrails)
- No Electron.
- No browser-only or SaaS-first pivot.
- No login/auth/account system.
- No real-time collaboration or multi-user permissions.
- No one-click full-trade automatic takeoff.
- No custom CV model training.
- No cloud AI default path; cloud remains opt-in settings only.
- No annotation/redline tool sprawl beyond takeoff overlays needed for MVP.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - all verification agent-executed.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: YES (mixed strategy: tests-after for scaffold smoke, TDD for backend geometry/export/citation logic, tests-after for UI shell then add interaction coverage)
- **Framework**:
  - Frontend/unit: `vitest`
  - Frontend/e2e: `playwright`
  - Backend/unit/integration: `pytest`
  - Typecheck/lint: `tsc`, ESLint, Ruff

### QA Policy
Every task includes agent-executed QA scenarios with evidence saved under `.sisyphus/evidence/`.

- **Frontend/UI**: Playwright selectors and screenshots
- **Desktop/sidecar**: Bash + app process checks
- **Backend/API**: `pytest` or `curl` against localhost
- **Library/logic**: unit tests with fixed fixtures

---

## Execution Strategy

### Parallel Execution Waves

```text
Wave 1 (foundation - start immediately):
- [x] 1. Monorepo/app scaffold and conventions
- [x] 2. Test/lint/typecheck infrastructure
- [x] 3. Shared API/data contracts and folder spec
- [x] 4. Tauri shell + sidecar lifecycle skeleton
- [x] 5. Python backend skeleton + health/config bootstrap


Wave 2 (storage + ingestion base):
- [x] 6. SQLite schema + migrations/bootstrap
- [x] 7. Project folder service and file IO
- [x] 8. PDF ingestion and render pipeline
- [x] 9. OCR/text extraction pipeline
- [x] 10. Sheet metadata detection + library UI

Wave 3 (manual takeoff core):
- [x] 11. PDF viewer workspace shell
- [x] 12. Coordinate system + scale calibration engine
- [x] 13. Geometry persistence/API + quantity computation
- [x] 14. Drawing tools + overlay editor
- [x] 15. Classifications, formulas, undo/redo, snapshots
- [x] 16. Quantity table + Excel export
- [x] 17. Annotated PDF export
- [x] 18. Embeddings/indexing + local vector store
- [x] 19. AI router, provider settings, audit trail
- [x] 20. Copilot chat UI + cited retrieval flow

Wave 5 (AI-assisted search/counting):
- [x] 21. Text search bbox candidate workflow
- [x] 22. Count candidate accept/reject + conversion
- [x] 23. Visual region search MVP
- [x] 24. Packaging prep, install/runtime docs, offline readiness audit

Wave FINAL:
- [x] F1: Plan compliance audit
- [x] F2: Code quality review
- [x] F3: Real QA execution
- [x] F4: Scope fidelity check
```

### Dependency Matrix

- **T1**: Blocked By none | Blocks T11, T24
- **T2**: Blocked By none | Blocks all implementation tasks
- **T3**: Blocked By none | Blocks T6, T7, T10, T13, T18, T19, T20, T21, T22
- **T4**: Blocked By none | Blocks T11, T24
- **T5**: Blocked By none | Blocks T6, T7, T8, T9, T13, T17, T18, T19, T23
- **T6**: Blocked By T3, T5 | Blocks T7, T8, T9, T10, T13, T15, T16, T18, T19, T20, T21, T22
- **T7**: Blocked By T3, T5, T6 | Blocks T8, T9, T10, T15, T16, T17, T18, T24
- **T8**: Blocked By T5, T6, T7 | Blocks T10, T11, T17, T21, T23
- **T9**: Blocked By T5, T6, T7 | Blocks T10, T18, T20, T21
- **T10**: Blocked By T3, T6, T7, T8, T9 | Blocks T11, T20, T21
- **T11**: Blocked By T1, T4, T8, T10 | Blocks T14, T20, T21, T23
- **T12**: Blocked By T2 | Blocks T13, T14
- **T13**: Blocked By T3, T5, T6, T12 | Blocks T14, T15, T16, T17, T22
- **T14**: Blocked By T11, T12, T13 | Blocks T15, T17, T22, T23
- **T15**: Blocked By T6, T7, T13, T14 | Blocks T16, T17, T22
- **T16**: Blocked By T6, T7, T13, T15 | Blocks T24
- **T17**: Blocked By T5, T7, T8, T13, T14, T15 | Blocks T24
- **T18**: Blocked By T3, T5, T6, T7, T9 | Blocks T20, T21, T23
- **T19**: Blocked By T3, T5, T6 | Blocks T20, T21, T23, T24
- **T20**: Blocked By T3, T6, T9, T10, T11, T18, T19 | Blocks T24
- **T21**: Blocked By T3, T6, T8, T9, T10, T11, T18, T19 | Blocks T22
- **T22**: Blocked By T3, T6, T13, T14, T15, T21 | Blocks T24
- **T23**: Blocked By T5, T8, T11, T14, T18, T19 | Blocks T24
- **T24**: Blocked By T1, T4, T7, T16, T17, T19, T20, T22, T23 | Blocks F1-F4

### Agent Dispatch Summary

- **Wave 1**: T1 `quick`, T2 `quick`, T3 `deep`, T4 `unspecified-high`, T5 `quick`
- **Wave 2**: T6 `quick`, T7 `unspecified-high`, T8 `deep`, T9 `deep`, T10 `visual-engineering`
- **Wave 3**: T11 `visual-engineering`, T12 `deep`, T13 `deep`, T14 `visual-engineering`, T15 `unspecified-high`
- **Wave 4**: T16 `quick`, T17 `unspecified-high`, T18 `deep`, T19 `deep`, T20 `visual-engineering`
- **Wave 5**: T21 `deep`, T22 `unspecified-high`, T23 `deep`, T24 `quick`
- **Final**: F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

---

## TODOs

- [x] 1. Scaffold app/workspace foundation

  **What to do**:
  - Create repo structure for frontend app, Tauri shell, Python sidecar, shared docs, fixtures, and evidence folders.
  - Add package manager choices, baseline scripts, env examples, and naming conventions aligned with source doc.
  - Ensure directory names reflect final architecture and do not force later moves.

  **Must NOT do**:
  - Add business features.
  - Add cloud-only wiring.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: mostly scaffolding and wiring.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `frontend-skill`: visual polish not core here.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T11, T24
  - **Blocked By**: None

  **References**:
  - `mvp-implementation.md:15-30` - Canonical stack choices to scaffold around.
  - `mvp-implementation.md:76-100` - Architecture tree to mirror in repo layout.
  - `mvp-implementation.md:587-594` - Sprint 1 scaffold expectations.

  **Acceptance Criteria**:
  - [x] Workspace contains clear top-level app folders for frontend, `src-tauri`, and Python sidecar.
  - [x] Root scripts exist for install, dev, lint, typecheck, and test orchestration.

  **QA Scenarios**:
  ```
  Scenario: workspace skeleton exists
    Tool: Bash
    Preconditions: fresh clone
    Steps:
      1. List root directories.
      2. Assert expected folders exist for frontend, Tauri, backend, tests/fixtures.
    Expected Result: folder tree matches architecture intent.
    Failure Indicators: missing app boundary folders or ad-hoc structure.
    Evidence: .sisyphus/evidence/task-1-workspace-tree.txt

  Scenario: root scripts callable
    Tool: Bash
    Preconditions: dependencies installed
    Steps:
      1. Run root help or package scripts listing.
      2. Assert dev/test/lint/typecheck script names exist.
    Expected Result: scripts resolvable from root.
    Evidence: .sisyphus/evidence/task-1-root-scripts.txt
  ```

- [x] 2. Establish test, lint, typecheck, and fixture harness

  **What to do**:
  - Set up Vitest, Playwright, pytest, Ruff, ESLint, and TypeScript checks.
  - Add sample project fixture folder from source doc.
  - Add CI-ready commands even if CI workflow lands later.

  **Must NOT do**:
  - Skip backend tests because app is greenfield.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: all implementation tasks
  - **Blocked By**: None

  **References**:
  - `mvp-implementation.md:540-569` - Testing strategy, unit/integration/golden fixtures.
  - `mvp-implementation.md:553-560` - Fixture file expectations.

  **Acceptance Criteria**:
  - [x] `vitest`, `playwright`, and `pytest` commands run from repo.
  - [x] Fixture placeholder structure exists.

  **QA Scenarios**:
  ```
  Scenario: automated test commands run
    Tool: Bash
    Preconditions: deps installed
    Steps:
      1. Run frontend unit test command.
      2. Run backend test command.
      3. Run lint and typecheck commands.
    Expected Result: commands exit 0 or pass with empty starter suites.
    Evidence: .sisyphus/evidence/task-2-test-harness.txt

  Scenario: fixture structure valid
    Tool: Bash
    Preconditions: repo scaffolded
    Steps:
      1. List `fixtures/sample-project/`.
      2. Assert expected placeholder files exist.
    Expected Result: fixture layout matches source doc.
    Evidence: .sisyphus/evidence/task-2-fixtures.txt
  ```

- [x] 3. Define shared contracts and local project spec

  **What to do**:
  - Define API schemas, DTOs, error shapes, and canonical project folder schema.
  - Specify takeoff item types, sheet metadata, audit log models, provider settings, and export rows.
  - Lock frontend/backend interface before parallel feature work.

  **Must NOT do**:
  - Let frontend invent API shapes independently.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T6, T7, T10, T13, T18, T19, T20, T21, T22
  - **Blocked By**: None

  **References**:
  - `mvp-implementation.md:114-141` - Local project folder format.
  - `mvp-implementation.md:145-184` - Data model MVP.
  - `mvp-implementation.md:185-243` - Tool-calling design and guardrails.

  **Acceptance Criteria**:
  - [x] Shared contract files define entities needed by frontend and backend.
  - [x] Folder/storage spec covers all artifact paths from source doc.

  **QA Scenarios**:
  ```
  Scenario: contract parity check
    Tool: Bash
    Preconditions: contract files created
    Steps:
      1. Run type generation or schema validation command.
      2. Assert no drift between backend schema and frontend types.
    Expected Result: contract validation passes.
    Evidence: .sisyphus/evidence/task-3-contract-parity.txt

  Scenario: project schema covers all required artifacts
    Tool: Bash
    Preconditions: spec created
    Steps:
      1. Compare generated/project bootstrap folders against contract.
      2. Assert required subpaths for documents, takeoff, rag, exports, audit exist.
    Expected Result: full storage schema coverage.
    Evidence: .sisyphus/evidence/task-3-folder-spec.txt
  ```

- [x] 4. Build Tauri shell and sidecar lifecycle skeleton

  **What to do**:
  - Wire Tauri 2 desktop shell.
  - Start/stop Python sidecar, capture dynamic port, expose health/bootstrap path to UI.
  - Add strict local permissions and process cleanup on close.

  **Must NOT do**:
  - Leave orphan sidecar processes.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T11, T24
  - **Blocked By**: None

  **References**:
  - `mvp-implementation.md:86-90` - Tauri responsibilities.
  - `mvp-implementation.md:102-112` - localhost-only service model.
  - `mvp-implementation.md:368-374` - sidecar health acceptance.

  **Acceptance Criteria**:
  - [x] App launches sidecar and stores resolved localhost port.
  - [x] Closing app terminates sidecar process.

  **QA Scenarios**:
  ```
  Scenario: sidecar boot handshake works
    Tool: Bash
    Preconditions: app built in dev mode
    Steps:
      1. Launch desktop app.
      2. Read startup logs or handshake state.
      3. Assert localhost URL available and `/health` responds 200.
    Expected Result: sidecar reachable within 10 seconds.
    Evidence: .sisyphus/evidence/task-4-sidecar-health.txt

  Scenario: sidecar exits with app
    Tool: Bash
    Preconditions: app running with sidecar active
    Steps:
      1. Close app window.
      2. Query process list for Python sidecar signature.
    Expected Result: no orphan sidecar process remains.
    Evidence: .sisyphus/evidence/task-4-process-cleanup.txt
  ```

- [x] 5. Build Python backend bootstrap and config system

  **What to do**:
  - Create FastAPI app skeleton, config loading, health endpoint, provider settings model, and dependency container.
  - Add localhost-only binding and startup validation.

  **Must NOT do**:
  - Bind to non-localhost interface by default.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T6, T7, T8, T9, T13, T17, T18, T19, T23
  - **Blocked By**: None

  **References**:
  - `mvp-implementation.md:91-99` - sidecar service responsibilities.
  - `mvp-implementation.md:298-305` - settings scope.
  - `mvp-implementation.md:576-583` - privacy/security defaults.

  **Acceptance Criteria**:
  - [x] FastAPI app exposes `/health` returning OK JSON.
  - [x] Config model supports storage path, OCR engine, model provider settings.

  **QA Scenarios**:
  ```
  Scenario: health endpoint live
    Tool: Bash (curl)
    Preconditions: backend started
    Steps:
      1. `curl http://127.0.0.1:<port>/health`
      2. Assert status 200 and body contains OK marker.
    Expected Result: backend health available.
    Evidence: .sisyphus/evidence/task-5-health.json

  Scenario: invalid config rejected cleanly
    Tool: Bash
    Preconditions: backend config loader present
    Steps:
      1. Start backend with malformed settings.
      2. Assert structured validation error emitted.
    Expected Result: startup fails clearly, not silent crash.
    Evidence: .sisyphus/evidence/task-5-config-error.txt
  ```
Test Content





- [x] 6. SQLite schema + migrations/bootstrap

  **What to do**:
  - Initialize SQLite database using SQLModel/SQLAlchemy.
  - Implement basic migration system (Alembic or simple script).
  - Define core tables: `projects`, `documents`, `sheets`, `takeoff_items`.

  **Must NOT do**:
  - Use complex NoSQL or external database servers.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T7, T8, T9, T10, T13, T15, T16, T18, T19, T20, T21, T22
  - **Blocked By**: T3, T5

  **References**:
  - `mvp-implementation.md:145-162` - Data model MVP.
  - `mvp-implementation.md:21` - SQLite choice.

  **Acceptance Criteria**:
  - [x] Database file created with all core tables.
  - [x] Basic CRUD operations verified for projects and sheets.

  **QA Scenarios**:
  ```
  Scenario: DB initialization
    Tool: Bash (sqlite3)
    Preconditions: backend run
    Steps:
      1. Inspect project.sqlite.
      2. Verify tables exist.
    Expected Result: Tables projects, documents, sheets exist.
    Evidence: .sisyphus/evidence/task-6-db.txt
  ```

- [x] 7. Project folder service and file IO

  **What to do**:
  - Implement service to manage `.gtl-project` folder structure.
  - Handle file moving, directory creation, and path normalization.
  - Ensure transparent layout as specified in implementation guide.

  **Must NOT do**:
  - Use obscure binary formats for file storage.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T8, T9, T10, T15, T16, T17, T18, T24
  - **Blocked By**: T3, T5, T6

  **References**:
  - `mvp-implementation.md:114-141` - Folder format.

  **Acceptance Criteria**:
  - [x] Service can create full project folder structure.
  - [x] Files saved to correct subdirectories.

  **QA Scenarios**:
  ```
  Scenario: Folder structure creation
    Tool: Bash (ls)
    Preconditions: new project created
    Steps:
      1. Check documents, takeoff, rag, exports folders.
    Expected Result: All subfolders exist.
    Evidence: .sisyphus/evidence/task-7-folders.txt
  ```

- [x] 8. PDF ingestion and render pipeline

  **What to do**:
  - Implement PDF file import and processing.
  - Render page thumbnails and high-res full pages using PyMuPDF.
  - Store renders in project folder.

  **Must NOT do**:
  - Render all pages synchronously for large documents (background task).

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T10, T11, T17, T21, T23
  - **Blocked By**: T5, T6, T7

  **References**:
  - `mvp-implementation.md:317-326` - Ingestion service.

  **Acceptance Criteria**:
  - [x] Imported PDF results in thumbnails and page images.
  - [x] Metadata (page count, size) extracted correctly.

  **QA Scenarios**:
  ```
  Scenario: PDF rendering
    Tool: Bash (ls)
    Preconditions: PDF imported
    Steps:
      1. Check thumbnails and rendered-pages folders.
    Expected Result: Images exist for every page.
    Evidence: .sisyphus/evidence/task-8-renders.txt
  ```

- [x] 9. OCR/text extraction pipeline

  **What to do**:
  - Extract embedded text from PDF using pdfplumber.
  - Implement PaddleOCR/Tesseract fallback for scanned pages.
  - Store text blocks with bounding box coordinates.

  **Must NOT do**:
  - Run OCR on every page if embedded text is high quality.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T10, T18, T20, T21
  - **Blocked By**: T5, T6, T7

  **References**:
  - `mvp-implementation.md:24` - OCR choice.
  - `mvp-implementation.md:323-324` - Extraction logic.

  **Acceptance Criteria**:
  - [x] Text extraction produces JSON with text and bboxes.
  - [x] OCR kicks in for scanned-only pages.

  **QA Scenarios**:
  ```
  Scenario: Text extraction
    Tool: Bash (cat)
    Preconditions: document processed
    Steps:
      1. Read extracted text JSON.
    Expected Result: Text content matches PDF content.
    Evidence: .sisyphus/evidence/task-9-ocr.txt
  ```

- [x] 10. Sheet metadata detection + library UI

  **What to do**:
  - Auto-detect sheet numbers and titles from text blocks.
  - Build frontend library view with thumbnails and search.
  - Allow manual overrides of detected names.

  **Must NOT do**:
  - Require user to manually name every sheet.

  **Acceptance Criteria**:
  - [x] Library shows grid of sheets with thumbnails.
  - [x] Sheet names auto-populated from title block area.

- [x] 11. PDF viewer workspace shell

  **What to do**:
  - Implement PDF.js viewer component.
  - Add zoom, pan, and sheet navigation.
  - Create overlay layer for drawing.

  **Must NOT do**:
  - Re-render PDF on every zoom level (use CSS transforms where possible).

  **Recommended Agent Profile**:
  - **Category**: `frontend-ui-ux`
  - **Skills**: `[frontend-skill]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T12, T14
  - **Blocked By**: T1, T4, T8, T10

  **References**:
  - `mvp-implementation.md:262-272` - Drawing Workspace screen.

  **Acceptance Criteria**:
  - [x] User can pan and zoom into high-res sheets.
  - [x] Smooth navigation between sheets.

  **QA Scenarios**:
  ```
  Scenario: Viewer interaction
    Tool: Playwright
    Preconditions: sheet opened
    Steps:
      1. Zoom in/out.
      2. Drag canvas.
    Expected Result: Responsive viewer behavior.
    Evidence: .sisyphus/evidence/task-11-viewer.png
  ```

- [x] 12. Coordinate system + scale calibration engine

  **What to do**:
  - Map frontend pixels to PDF points and world units.
  - Implement calibration tool (draw line of known length).
  - Store scale per sheet.

  **Must NOT do**:
  - Use hardcoded DPI assumptions.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T13, T14
  - **Blocked By**: T11

  **References**:
  - `mvp-implementation.md:266` - Scale calibration.
  - `mvp-implementation.md:544-548` - Geometry logic.

  **Acceptance Criteria**:
  - [x] Calibrating 10ft line results in correct scale factor.
  - [x] Coordinates consistent across zoom levels.

  **QA Scenarios**:
  ```
  Scenario: Scale calibration
    Tool: Playwright
    Preconditions: calibration mode active
    Steps:
      1. Draw 10ft segment.
      2. Enter "10 ft".
    Expected Result: Subsequent measurements are accurate.
    Evidence: .sisyphus/evidence/task-12-scale.txt
  ```

- [x] 13. Geometry persistence/API + quantity computation

  **What to do**:
  - Backend API for CRUD on takeoff items.
  - Area, length, and count calculations using Shapely.
  - Handle scale multiplication in backend.

  **Must NOT do**:
  - Trust frontend for quantity values.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T15, T16, T17
  - **Blocked By**: T3, T5, T6, T12

  **References**:
  - `mvp-implementation.md:327-335` - Geometry service.

  **Acceptance Criteria**:
  - [x] API returns correct sqft for given polygon and scale.
  - [x] Items persist to SQLite.

  **QA Scenarios**:
  ```
  Scenario: Geometry CRUD
    Tool: Bash (curl)
    Preconditions: backend live
    Steps:
      1. Post polygon.
      2. Get item.
    Expected Result: Quantity field matches expected value.
    Evidence: .sisyphus/evidence/task-13-calc.json
  ```

- [x] 14. Drawing tools + overlay editor

  **What to do**:
  - Implement React-Konva (or similar) drawing layer.
  - Tools: Point (count), Polyline (linear), Polygon (area).
  - Add snapping (to sheet grid/points) and edit handles.

  **Must NOT do**:
  - Block UI thread during complex polygon edits.

  **Recommended Agent Profile**:
  - **Category**: `frontend-ui-ux`
  - **Skills**: `[frontend-skill]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: T15, T22, T23
  - **Blocked By**: T11, T12

  **References**:
  - `mvp-implementation.md:166` - Item types.
  - `mvp-implementation.md:267` - Tools.

  **Acceptance Criteria**:
  - [x] User can click-to-draw closed polygons.
  - [x] Visual feedback during drawing.

  **QA Scenarios**:
  ```
  Scenario: Drawing shapes
    Tool: Playwright
    Preconditions: tool selected
    Steps:
      1. Click vertices.
      2. Close shape.
    Expected Result: Shape appears on overlay.
    Evidence: .sisyphus/evidence/task-14-drawing.png
  ```

- [x] 15. Classifications, formulas, undo/redo, snapshots

  **What to do**:
  - Add classification sidebar to assign types (e.g., "Concrete").
  - Implement basic formula engine (e.g., area * depth).
  - Global undo/redo stack for takeoff actions.

  **Must NOT do**:
  - Complex multi-dependency formula chains in MVP.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T16
  - **Blocked By**: T6, T7, T13, T14

  **References**:
  - `mvp-implementation.md:398-400` - Phase 2 features.

  **Acceptance Criteria**:
  - [x] Assigned classification updates total quantities.
  - [x] Undo reverts last vertex/shape.

  **QA Scenarios**:
  ```
  Scenario: Undo action
    Tool: Playwright
    Preconditions: shape drawn
    Steps:
      1. Press Ctrl+Z.
    Expected Result: Shape disappears.
    Evidence: .sisyphus/evidence/task-15-undo.txt
  ```

- [x] 16. Quantity table + Excel export

  **What to do**:
  - Build summary table view grouping items.
  - Implement Excel export using openpyxl/XlsxWriter.
  - Include classification, unit, quantity, and source.

  **Must NOT do**:
  - Export without sheet references.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[spreadsheet]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: none
  - **Blocked By**: T6, T7, T13, T15

  **References**:
  - `mvp-implementation.md:291-297` - Export Center.

  **Acceptance Criteria**:
  - [x] Exported Excel file opens and contains correct sums.
  - [x] Table view matches export data.

  **QA Scenarios**:
  ```
  Scenario: Excel export
    Tool: Bash
    Preconditions: takeoff exists
    Steps:
      1. Trigger export.
      2. Verify file content.
    Expected Result: Excel rows match takeoff table.
    Evidence: .sisyphus/evidence/task-16-excel.xlsx
  ```

- [x] 17. Annotated PDF export

  **What to do**:
  - Merge takeoff overlays onto original PDF pages.
  - Export as new PDF with layers/annotations.
  - Ensure scale and placement accuracy.

  **Must NOT do**:
  - Low-res "screenshot" PDF export (must be vector-based overlays).

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[pdf]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: none
  - **Blocked By**: T5, T7, T8, T13

  **References**:
  - `mvp-implementation.md:358` - Annotated PDF export.

  **Acceptance Criteria**:
  - [x] Exported PDF contains shapes at correct positions.
  - [x] PDF is readable by external viewers.

  **QA Scenarios**:
  ```
  Scenario: PDF export
    Tool: Bash (ls)
    Preconditions: export triggered
    Steps:
      1. Check exports/annotated-pdf.
    Expected Result: PDF exists and contains annotations.
    Evidence: .sisyphus/evidence/task-17-pdf.pdf
  ```

- [x] 18. Embeddings/indexing + local vector store

  **What to do**:
  - Set up local Qdrant/vector storage.
  - Implement text chunking and local embedding (BGE-M3/Ollama).
  - Index all documents upon ingestion completion.

  **Must NOT do**:
  - Send text to external embedding APIs by default.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: T20
  - **Blocked By**: T3, T5, T6, T7, T9

  **References**:
  - `mvp-implementation.md:22` - Qdrant choice.
  - `mvp-implementation.md:336-344` - RAG service.

  **Acceptance Criteria**:
  - [x] Vectors stored for project text.
  - [x] Similarity search returns relevant chunks.

  **QA Scenarios**:
  ```
  Scenario: Indexing check
    Tool: Bash
    Preconditions: docs indexed
    Steps:
      1. Query vector store.
    Expected Result: Hit count > 0.
    Evidence: .sisyphus/evidence/task-18-vectors.txt
  ```

- [x] 19. AI router, provider settings, audit trail

  **What to do**:
  - Create router to handle Ollama/OpenAI requests.
  - UI for model/API configuration.
  - Implement audit log for all AI interactions.

  **Must NOT do**:
  - Hardcode API keys or URLs.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Parallelize**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: T20, T21, T22, T23
  - **Blocked By**: T3, T5, T6

  **References**:
  - `mvp-implementation.md:345-353` - AI router.

  **Acceptance Criteria**:
  - [x] Router switches between providers based on config.
  - [x] Logs written to project folder.

  **QA Scenarios**:
  ```
  Scenario: Router config
    Tool: Playwright
    Preconditions: settings page
    Steps:
      1. Update Ollama URL.
      2. Test connection.
    Expected Result: Connection success if live.
    Evidence: .sisyphus/evidence/task-19-router.txt
  ```

- [x] 20. Copilot chat UI + cited retrieval flow

  **What to do**:
  - Implement chat interface with markdown and citations.
  - Wire RAG retrieval and tool-calling loop.
  - Show cited sheet/page/bbox on click.

  **Must NOT do**:
  - Hallucinate citations (must be grounded in RAG hits).

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[frontend-skill]`

  **Parallelization**:
  - **Can Parallelize**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: none
  - **Blocked By**: T3, T6, T9, T10, T18, T19

  **References**:
  - `mvp-implementation.md:281-290` - Plan Copilot screen.

  **Acceptance Criteria**:
  - [x] Chat answer includes clickable citations.
  - [x] Clicking citation opens correct sheet/view.

  **QA Scenarios**:
  ```
  Scenario: Chat citation
    Tool: Playwright
    Preconditions: question asked
    Steps:
      1. Click citation tag.
    Expected Result: Viewer navigates to source.
    Evidence: .sisyphus/evidence/task-20-chat.png
  ```

- [x] 21. Text search bbox candidate workflow

  **What to do**:
  - Implement "Find all instances of X" tool.
  - Highlight matches as candidates on the drawing.
  - Sidebar to review and accept results.

  **Must NOT do**:
  - Automatically add candidates to takeoff without review.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Parallelize**: YES
  - **Parallel Group**: Wave 5
  - **Blocks**: T22
  - **Blocked By**: T3, T6, T8, T9, T10, T19

  **References**:
  - `mvp-implementation.md:273-280` - AI Search Workspace.

  **Acceptance Criteria**:
  - [x] Search for "W1" finds all window tags.
  - [x] Results show as transparent overlays until accepted.

  **QA Scenarios**:
  ```
  Scenario: Text candidate search
    Tool: Playwright
    Preconditions: search triggered
    Steps:
      1. Inspect overlays.
    Expected Result: Matches highlighted.
    Evidence: .sisyphus/evidence/task-21-search.png
  ```

- [x] 22. Count candidate accept/reject + conversion

  **What to do**:
  - UI to bulk accept or reject AI candidates.
  - Convert accepted candidates into Count Takeoff items.
  - Sync with quantity table.

  **Must NOT do**:
  - Lose candidate status on rejection (allow "Maybe" or audit).

  **Recommended Agent Profile**:
  - **Category**: `frontend-ui-ux`
  - **Skills**: `[frontend-skill]`

  **Parallelization**:
  - **Can Parallelize**: YES
  - **Parallel Group**: Wave 5
  - **Blocks**: none
  - **Blocked By**: T3, T6, T14, T19, T21

  **References**:
  - `mvp-implementation.md:433-443` - Phase 5 features.

  **Acceptance Criteria**:
  - [x] Accepting 5 candidates adds 5 count points to takeoff.
  - [x] Quantities update immediately.

  **QA Scenarios**:
  ```
  Scenario: Bulk accept
    Tool: Playwright
    Preconditions: candidates present
    Steps:
      1. Select all.
      2. Click Accept.
    Expected Result: Points become active takeoff items.
    Evidence: .sisyphus/evidence/task-22-accept.txt
  ```

- [x] 23. Visual region search MVP

  **What to do**:
  - Implement "Search by Image" (visual embeddings of bboxes).
  - Find visually similar symbols on the sheet.
  - Present as candidates.

  **Must NOT do**:
  - Full-sheet CV object detection in MVP (bbox-to-bbox similarity only).

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Parallelize**: YES
  - **Parallel Group**: Wave 5
  - **Blocks**: none
  - **Blocked By**: T5, T8, T14, T19

  **References**:
  - `mvp-implementation.md:210-212` - visual_search_region tool.

  **Acceptance Criteria**:
  - [x] Selecting electrical symbol finds similar symbols.
  - [x] Respects similarity threshold.

  **QA Scenarios**:
  ```
  Scenario: Visual search
    Tool: Playwright
    Preconditions: region selected
    Steps:
      1. Click Visual Search.
    Expected Result: Similar matches highlighted.
    Evidence: .sisyphus/evidence/task-23-visual.png
  ```

- [x] 24. Packaging prep, install/runtime docs, offline readiness audit

  **What to do**:
  - Configure Tauri bundling for release.
  - Write detailed README for local setup (Python, Node, Ollama).
  - Verify full app function with internet disconnected.

  **Must NOT do**:
  - Ship with dev-only hardcoded paths.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Parallelize**: NO
  - **Parallel Group**: Wave 5
  - **Blocks**: Final Wave
  - **Blocked By**: T1, T4, T7

  **References**:
  - `mvp-implementation.md:30` - Packaging choice.
  - `mvp-implementation.md:112` - Offline behavior.

  **Acceptance Criteria**:
  - [x] App launches and functions (sans cloud models) without internet.
  - [x] Install guide covers all prerequisites.

  **QA Scenarios**:
  ```
  Scenario: Offline audit
    Tool: Bash (network disable)
    Preconditions: app installed
    Steps:
      1. Launch app.
      2. Import PDF.
      3. Draw takeoff.
    Expected Result: All local features work.
    Evidence: .sisyphus/evidence/task-24-offline.txt
  ```

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`
  Verify every must-have and must-not-have against final implementation and evidence files.

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run lint, typecheck, tests, and inspect changed files for slop, dead code, and unsafe shortcuts.

- [x] F3. **Real Manual QA** — `unspecified-high`
  Execute every QA scenario from tasks, including malformed PDF, missing Ollama, export validation, and reopen persistence.

- [x] F4. **Scope Fidelity Check** — `deep`
  Ensure no collaboration/auth/full-auto-takeoff/cloud-default features slipped in.

---

## Commit Strategy

- Wave 1 scaffold: `chore(scaffold): initialize desktop app and backend foundation`
- Wave 2 ingestion: `feat(ingestion): add project storage and pdf import pipeline`
- Wave 3 takeoff: `feat(takeoff): add drawing workspace and quantity engine`
- Wave 4 export/ai core: `feat(ai): add exports indexing and cited copilot`
- Wave 5 ai assist: `feat(search): add candidate search counting and packaging prep`

---

## Success Criteria

### Verification Commands
```bash
# representative final checks
pnpm lint
pnpm typecheck
pnpm test
pnpm playwright test
pytest
```

### Final Checklist
- [x] All must-have deliverables present
- [x] All excluded features absent
- [x] Project opens offline and sidecar remains localhost-only
- [x] Import -> takeoff -> export -> reopen workflow passes
- [x] Copilot answers with citations and audit trail
- [x] AI-assisted workflows require explicit human acceptance before quantity persistence

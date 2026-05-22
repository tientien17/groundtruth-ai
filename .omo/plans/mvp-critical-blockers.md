# MVP Critical Blockers Fix — End-to-End Flow Restoration

## TL;DR

> **Quick Summary**: Fix the 4 critical blockers preventing GroundTruth Local from functioning end-to-end: project creation, sheet image serving, thumbnail URLs, and drawing→takeoff persistence.
> 
> **Deliverables**:
> - Backend `POST /projects` endpoint + frontend wiring with app data directory paths
> - Sheet image serving endpoint (`GET /projects/{project_id}/sheets/{sheet_id}/image`)
> - `thumbnail_url` returns serveable URL instead of filesystem path + frontend prepends base URL
> - Drawing tools wired to POST takeoff-items with type alignment (`linear` ↔ `length`)
> - TakeoffItem interface aligned between frontend and backend
> - Tests for all new endpoints and wiring
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 → Task 4, Task 5 → Task 6 → Task 8 → F1-F4

---

## Context

### Original Request
User noticed the MVP is far from working vs the goal of being a civils AI application. Assessment revealed 4 critical blockers preventing basic end-to-end functionality.

### Interview Summary
**Key Discussions**:
- Focus on critical blockers only, not AI gaps or major issues
- Tests-after strategy (implement first, add tests after)
- Project path: Use Tauri app data directory — in production this is `%APPDATA%/groundtruth/sidecar-storage/`, in code accessed via `Settings.storage_path` which is set by Tauri's `SIDECAR_STORAGE_PATH` env var pointing to `app.path().app_data_dir()/sidecar-storage` (see `main.rs:119`). All tasks should use `settings.storage_path` as the base.
- Drawing→takeoff wiring must include type alignment (`'length'` → `'linear'`)

**Research Findings**:
- `project_service.py` already has `create_project(name, path)` — just needs API endpoint
- Tauri `main.rs:111` already uses `app.path().app_data_dir()` for sidecar-storage — same approach for projects
- Backend `TakeoffItemResponse` has `quantity_raw/quantity_unit`, frontend `TakeoffItem` has `value/unit` — need bridge
- `useDrawing` hook works but is disconnected from takeoff persistence
- All 26 backend endpoints use raw `fetch()` — no API client layer

### Oracle Review
Phase 1 verified: 5/5 PASS. Core objective unambiguous, scope boundaries explicit, type bridge correctly included in scope.

---

## Work Objectives

### Core Objective
Restore end-to-end MVP flow by persisting projects, serving sheet images via URLs, returning usable thumbnail URLs, and saving drawn takeoff items to backend.

### Concrete Deliverables
- `apps/sidecar/api/endpoints/projects.py` — new `POST /projects` + `GET /projects` endpoints
- `apps/sidecar/api/endpoints/sheets.py` — new `GET /{project_id}/sheets/{sheet_id}/image` endpoint
- `apps/sidecar/api/endpoints/sheets.py` — `thumbnail_url` returns URL not filesystem path
- `apps/frontend/src/App.tsx` — wired to call `POST /projects` with app data path
- `apps/frontend/src/components/Workspace/types.ts` — `TakeoffItem` interface aligned with backend
- `apps/frontend/src/components/Workspace/Workspace.tsx` — drawing wired to POST takeoff-items
- `apps/frontend/src/components/Takeoff/QuantityTable.tsx` — uses aligned field names
- Tests for new endpoints and integration points

### Definition of Done
- [ ] `pnpm dev` → Create project → Upload PDF → View sheet image → Draw polygon → See quantity in table
- [ ] `pnpm test` passes
- [ ] All new endpoints return correct responses

### Must Have
- Project creation persists to SQLite AND creates `.gtl` folder structure
- Sheet images render in the viewer (not "No preview available")
- Thumbnails display in sidebar
- Drawing a polygon/line creates a takeoff item in the backend
- Quantity table shows backend-sourced data

### Must NOT Have (Guardrails)
- No React Router addition (stay with conditional rendering)
- No API client library / code generation — keep raw `fetch()` pattern
- No changes to the geometry computation engine
- No AI/Ollama changes
- No refactoring of existing working endpoints
- No Tauri IPC changes (frontend gets project path from API response)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (Vitest for frontend, pytest for backend)
- **Automated tests**: Tests-after
- **Framework**: Vitest (frontend), pytest (backend)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.omo/evidence/task-{N}-{scenario-slug}.{ext}`.

- **API/Backend**: Use Bash (curl) — Send requests, assert status + response fields
- **Frontend**: Use Bash (pnpm typecheck) + visual inspection via test assertions

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — backend endpoints, all parallel):
├── Task 1: POST /projects endpoint + GET /projects [quick]
├── Task 2: GET /sheets/{id}/image endpoint (serve rendered page files) [quick]
├── Task 3: Fix thumbnail_url to return serveable URL [quick]

Wave 2a (Frontend wiring — independent tasks, parallel):
├── Task 4: Wire App.tsx project creation to POST /projects (depends: 1) [quick]
├── Task 5: Align TakeoffItem type/interface with backend (depends: none) [quick]

Wave 2b (Drawing integration — depends on Wave 2a):
├── Task 6: Wire drawing tools to POST takeoff-items + load from backend (depends: 5) [unspecified-high]

Wave 3 (Tests — depends on Wave 2b):
├── Task 7: Backend tests for projects + image endpoints (depends: 1, 2, 3) [quick]
├── Task 8: Frontend tests for project creation + takeoff wiring (depends: 4, 5, 6) [quick]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: Task 1 → Task 4, Task 5 → Task 6 → Task 8 → F1-F4 → user okay
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 3 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 | — | 4, 7 |
| 2 | — | 7 |
| 3 | — | 7 |
| 4 | 1 | 8 |
| 5 | — | 6, 8 |
| 6 | 5 | 8 |
| 7 | 1, 2, 3 | — |
| 8 | 4, 5, 6 | — |

### Agent Dispatch Summary

- **Wave 1**: **3** — T1 → `quick`, T2 → `quick`, T3 → `quick`
- **Wave 2a**: **2** — T4 → `quick`, T5 → `quick`
- **Wave 2b**: **1** — T6 → `unspecified-high`
- **Wave 3**: **2** — T7 → `quick`, T8 → `quick`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Add project CRUD endpoints (POST /projects + GET /projects)

  **What to do**:
  - Create `apps/sidecar/api/endpoints/projects.py` with two endpoints:
    - `POST /projects` — accepts `{ name: string }`, calls `project_service.create_project(name, settings.storage_path)`, creates `Project` DB record, returns `{ id, name, path }`
    - `GET /projects` — lists all projects from `settings.storage_path` by scanning for `.gtl` directories that contain `project.sqlite`
  - The `project_path` returned must be the absolute path to the `.gtl` directory (e.g., `C:\Users\...\AppData\...\sidecar-storage\Project 2024.gtl`)
  - Register the new router in `apps/sidecar/main.py` (add `from api.endpoints.projects import router as projects_router` + `app.include_router(projects_router)`)
  - The `POST` endpoint must: (1) call `create_project()` from `project_service.py`, (2) create a `Project` record in the project's own `project.sqlite`, (3) return the project ID, name, and absolute path
  - Use `app.state.settings.storage_path` (from `config.py`) as the base directory for new projects

  **Must NOT do**:
  - No changes to `project_service.py` itself (it already works correctly)
  - No changes to database schema or models
  - No authentication or authorization

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single new file + one-line router registration. Pattern follows existing endpoints exactly.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 7
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References** (existing code to follow):
  - `apps/sidecar/api/endpoints/sheets.py:39-79` — Follow this exact router pattern: `APIRouter(prefix=..., tags=[...])`, Pydantic request/response models, `init_db(db_path)` + `get_session(db_path)` context manager
  - `apps/sidecar/api/endpoints/takeoff.py:279-283` — `_project_db_path()` helper pattern for resolving project database

  **API/Type References** (contracts to implement against):
  - `apps/sidecar/services/project_service.py:21-31` — `create_project(name, path)` returns `Path` to `.gtl` directory. Call this to scaffold the project folder and initialize SQLite.
  - `apps/sidecar/models.py` — `Project` model with `id` (UUID), `name` (str), `path` (str), `created_at`, `updated_at`
  - `apps/sidecar/config.py` — `Settings.storage_path` is the base directory where projects live

  **External References**:
  - `apps/sidecar/main.py:69-79` — Router registration pattern (add new router here)

  **WHY Each Reference Matters**:
  - `sheets.py` provides the exact code pattern to follow: how to structure the router, Pydantic models, and database access
  - `project_service.py` already does the heavy lifting (folder creation + DB init) — just needs an HTTP wrapper
  - `config.py` provides `storage_path` which is set by Tauri to `app_data_dir/sidecar-storage` (see `main.rs:119`)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Create project via API
    Tool: Bash (curl)
    Preconditions: Sidecar running on port 8765
    Steps:
      1. curl -X POST http://127.0.0.1:8765/projects -H "Content-Type: application/json" -d '{"name": "Test Project"}'
      2. Assert HTTP 200
      3. Assert response contains "id" (UUID format), "name" ("Test Project"), "path" (absolute path ending in ".gtl")
      4. Assert response "path" directory exists on disk
      5. Assert response "path"/project.sqlite exists
    Expected Result: 200 response with valid project data, .gtl directory created with project.sqlite
    Failure Indicators: 4xx/5xx status, missing fields, directory not created
    Evidence: .omo/evidence/task-1-create-project.json

  Scenario: List projects via API
    Tool: Bash (curl)
    Preconditions: At least one project created via POST /projects
    Steps:
      1. curl http://127.0.0.1:8765/projects
      2. Assert HTTP 200
      3. Assert response is array containing the project created above
    Expected Result: 200 response with array of projects
    Failure Indicators: Empty array when project exists, 4xx/5xx
    Evidence: .omo/evidence/task-1-list-projects.json

  Scenario: Create project with empty name
    Tool: Bash (curl)
    Preconditions: Sidecar running
    Steps:
      1. curl -X POST http://127.0.0.1:8765/projects -H "Content-Type: application/json" -d '{"name": ""}'
      2. Assert HTTP 422 (validation error)
    Expected Result: 422 with validation error message
    Evidence: .omo/evidence/task-1-empty-name-error.json
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `fix(sidecar): add project CRUD and sheet image serving endpoints`
  - Files: `apps/sidecar/api/endpoints/projects.py`, `apps/sidecar/main.py`
  - Pre-commit: `cd apps/sidecar && uv run pytest tests/ -v`

- [x] 2. Add sheet image serving endpoint

  **What to do**:
  - Add new endpoint in `apps/sidecar/api/endpoints/sheets.py`:
    - `GET /{project_id}/sheets/{sheet_id}/image` — serves the rendered page PNG as `FileResponse`
  - Implementation: look up `SheetRender` for the sheet, get `render_path`, verify file exists, return `FileResponse(render_path, media_type="image/png")`
  - Import `FileResponse` from `fastapi.responses`
  - **Note**: The existing `SheetViewer.tsx:42` constructs the URL using `sheet.document_id` in the path (`/projects/${sheet.document_id}/sheets/...`). This is WRONG — all endpoints use `project_id`, not `document_id`. Task 6 or the executor should note that `SheetViewer.tsx` needs to use `projectId` (from props) instead of `sheet.document_id`.

  **Must NOT do**:
  - No changes to the render pipeline (ingestion creates PNGs correctly already)
  - No image processing or transformation
  - No caching headers (keep simple)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single endpoint addition to existing file. ~20 lines of code.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 7
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/sidecar/api/endpoints/sheets.py:39-79` — Existing `list_sheets` endpoint in same file. Follow same pattern for db_path resolution, init_db, get_session.
  - `apps/sidecar/api/endpoints/sheets.py:62-66` — How to query `SheetRender` for a sheet (already done in `list_sheets`).

  **API/Type References**:
  - `apps/sidecar/models.py` — `SheetRender` model has `render_path` (str) field containing the absolute filesystem path to the rendered PNG.

  **WHY Each Reference Matters**:
  - `sheets.py:62-66` already queries `SheetRender` — copy this exact pattern for the new endpoint
  - `SheetRender.render_path` is set during ingestion and contains the full path to the PNG file

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Serve sheet image
    Tool: Bash (curl)
    Preconditions: Project exists with at least one ingested PDF (sheets + renders in DB)
    Steps:
      1. Get sheets via curl http://127.0.0.1:8765/projects/{project_id}/sheets?project_path={path}
      2. Extract first sheet's id
      3. curl -o /tmp/test-sheet.png http://127.0.0.1:8765/projects/{project_id}/sheets/{sheet_id}/image?project_path={path}
      4. Assert HTTP 200
      5. Assert Content-Type is image/png
      6. Assert file size > 0
    Expected Result: PNG file downloaded successfully
    Failure Indicators: 404, empty file, wrong content type
    Evidence: .omo/evidence/task-2-serve-image.txt

  Scenario: Request image for non-existent sheet
    Tool: Bash (curl)
    Preconditions: Sidecar running with valid project
    Steps:
      1. curl http://127.0.0.1:8765/projects/{project_id}/sheets/00000000-0000-0000-0000-000000000000/image?project_path={path}
      2. Assert HTTP 404
    Expected Result: 404 with "Sheet not found" or "Render not found" message
    Evidence: .omo/evidence/task-2-missing-sheet-error.json
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `fix(sidecar): add project CRUD and sheet image serving endpoints`
  - Files: `apps/sidecar/api/endpoints/sheets.py`
  - Pre-commit: `cd apps/sidecar && uv run pytest tests/ -v`

- [x] 3. Fix thumbnail_url to return serveable URL

  **What to do**:
  - **Backend** (`apps/sidecar/api/endpoints/sheets.py`): Change `list_sheets` (line 74) to return a relative URL path instead of a filesystem path
    - Change `thumbnail_url=render.render_path if render else None` to `thumbnail_url=f"/projects/{project_id}/sheets/{sheet.id}/image?project_path={project_path}" if render else None`
    - This relative URL matches the endpoint created in Task 2
  - **Frontend** (`apps/frontend/src/components/Workspace/Workspace.tsx`): In `loadSheets()` (around line 33), after receiving sheets data from `fetchSheets()`, transform each sheet's `thumbnail_url` to prepend the sidecar base URL:
    ```typescript
    const data = await fetchSheets(sidecarPort, projectId, projectPath)
    const withUrls = data.map(s => ({
      ...s,
      thumbnail_url: s.thumbnail_url ? `http://127.0.0.1:${sidecarPort}${s.thumbnail_url}` : null
    }))
    setSheets(withUrls)
    ```
  - Also fix `SheetViewer.tsx:42` to use `projectId` (from props) instead of `sheet.document_id` in the image URL path

  **Must NOT do**:
  - No changes to `SheetsSidebar.tsx` or `SheetCard.tsx` (they already use `thumbnail_url` as-is — just needs to be a full URL)
  - No changes to the `SheetSummary` Pydantic model schema
  - No static file mounts

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single line change in one file.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 7
  - **Blocked By**: None (logically depends on Task 2 for the endpoint to exist, but the URL can be constructed independently)

  **References**:

  **Pattern References**:
  - `apps/sidecar/api/endpoints/sheets.py:67-77` — The exact code to modify. Line 74: `thumbnail_url=render.render_path if render else None`

  **WHY Each Reference Matters**:
  - The backend change converts the filesystem path to a relative URL path `/projects/{project_id}/sheets/{sheet_id}/image?project_path=...` matching the endpoint created in Task 2.
  - The frontend change in Workspace.tsx prepends the sidecar base URL so SheetsSidebar and SheetCard receive full URLs.

  **Important**: The frontend uses `thumbnail_url` directly as `<img src={sheet.thumbnail_url}>` in SheetsSidebar (line 50) and SheetCard. The SheetsSidebar does NOT have access to `sidecarPort`. Two approaches:
  - (A) **Recommended**: In `Workspace.tsx:loadSheets()` (line 33), after receiving sheets data, transform each sheet's `thumbnail_url` to prepend `http://127.0.0.1:${sidecarPort}`. This way the relative URL from backend becomes a full URL before being passed to SheetsSidebar.
  - (B) Return full URL from backend — but backend doesn't know its own external port reliably.
  
  Go with (A): Add a map step in `Workspace.tsx` after `fetchSheets()` to prepend the base URL to each `thumbnail_url`.

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: thumbnail_url is a URL not a filesystem path
    Tool: Bash (curl)
    Preconditions: Project with ingested PDF
    Steps:
      1. curl http://127.0.0.1:8765/projects/{project_id}/sheets?project_path={path}
      2. Parse JSON response
      3. Assert first sheet's thumbnail_url starts with "/projects/" (not "C:\" or "/" filesystem)
      4. Assert thumbnail_url contains "/image"
    Expected Result: thumbnail_url is a relative URL path, not a filesystem path
    Failure Indicators: thumbnail_url starts with drive letter or absolute filesystem path
    Evidence: .omo/evidence/task-3-thumbnail-url.json

  Scenario: Thumbnail URL is fetchable
    Tool: Bash (curl)
    Preconditions: Project with ingested PDF, Task 2 endpoint deployed
    Steps:
      1. Get sheets list, extract thumbnail_url from first sheet
      2. curl -o /tmp/thumb.png http://127.0.0.1:8765{thumbnail_url}
      3. Assert HTTP 200
      4. Assert file is valid PNG
    Expected Result: Thumbnail image loads via the URL
    Evidence: .omo/evidence/task-3-thumbnail-fetch.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `fix(sidecar): add project CRUD and sheet image serving endpoints`
  - Files: `apps/sidecar/api/endpoints/sheets.py`, `apps/frontend/src/components/Workspace/Workspace.tsx`, `apps/frontend/src/components/Workspace/SheetViewer.tsx`

- [x] 4. Wire App.tsx project creation to POST /projects

  **What to do**:
  - In `apps/frontend/src/App.tsx`, replace the inline project creation (lines 77-81) with an async function that:
    1. Calls `POST http://127.0.0.1:{sidecarPort}/projects` with `{ name: "Project <date>" }`
    2. On success, sets `currentProject` from the response `{ id, name, path }`
    3. On error, shows an error message (add error state)
  - Remove the hardcoded `crypto.randomUUID()` and `./projects/${projectId}` — the backend now generates the ID and path
  - Add loading state to the button while creating
  - The `projectPath` will now be an absolute path from the backend (pointing to app data dir)

  **Must NOT do**:
  - No routing library
  - No project listing UI (just create for now)
  - No Tauri IPC changes

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small state + fetch changes in one file. ~15 lines changed.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2a (with Task 5)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `apps/frontend/src/App.tsx:77-81` — The exact code to replace. Currently: `const projectId = crypto.randomUUID()` + `setCurrentProject({...})`
  - `apps/frontend/src/components/Workspace/Workspace.tsx:50-72` — Example of `fetch()` POST call pattern used in this codebase (URL construction, JSON body, response handling)

  **API/Type References**:
  - Task 1's `POST /projects` endpoint — Request: `{ name: string }`, Response: `{ id: string, name: string, path: string }`
  - `apps/frontend/src/App.tsx:8-12` — `Project` type already matches: `{ id, path, name }`

  **WHY Each Reference Matters**:
  - `App.tsx:77-81` is the exact broken code. Replace with API call.
  - `Workspace.tsx:50-72` shows how this codebase does fetch calls — follow the same pattern for consistency.

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Create project button calls API
    Tool: Bash (pnpm typecheck)
    Preconditions: Frontend compiles
    Steps:
      1. cd apps/frontend && pnpm typecheck
      2. Assert no type errors in App.tsx
      3. Verify App.tsx no longer contains "crypto.randomUUID()"
      4. Verify App.tsx contains fetch call to "/projects"
    Expected Result: Typecheck passes, App.tsx calls backend API
    Failure Indicators: Type errors, crypto.randomUUID still present
    Evidence: .omo/evidence/task-4-typecheck.txt

  Scenario: Error handling on project creation failure
    Tool: Bash (grep)
    Preconditions: App.tsx modified
    Steps:
      1. Verify App.tsx contains catch block or error handling for the fetch call
      2. Verify error state is displayed to user (not silently swallowed)
    Expected Result: Error handling present, user sees error message on failure
    Evidence: .omo/evidence/task-4-error-handling.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `fix(frontend): wire project creation, takeoff types, and drawing persistence`
  - Files: `apps/frontend/src/App.tsx`

- [x] 5. Align TakeoffItem type and interface with backend

  **What to do**:
  - In `apps/frontend/src/components/Workspace/types.ts`, update `TakeoffItem` interface to match backend `TakeoffItemResponse`:
    ```typescript
    export interface TakeoffItem {
      id: string
      sheet_id: string
      classification_id: string | null
      type: 'linear' | 'area' | 'count'  // was 'length' | 'area' | 'count'
      source: string
      confidence: number | null
      scale_id: string | null
      quantity_raw: number | null
      quantity_unit: string | null
      created_by: string
      geometry: TakeoffGeometry | null
    }
    
    export interface TakeoffGeometry {
      id: string
      kind: 'point' | 'path' | 'polygon'
      points: Array<{ x: number; y: number }>
      holes: Array<Array<{ x: number; y: number }>>
      scale: number
      scale_unit: string
    }
    ```
  - Update `ToolType` mapping: `'measure-length'` tool should map to `type: 'linear'` when creating items
  - In `apps/frontend/src/components/Takeoff/QuantityTable.tsx`, update field references:
    - `item.value` → `item.quantity_raw`
    - `item.unit` → `item.quantity_unit`
    - `item.classification` → look up classification name (or use `item.classification_id` with a fallback label)
    - `item.formula` / `item.finalQuantity` → remove (not in backend response)
    - Update `groupByClassification()` to use `item.classification_id ?? 'Unclassified'`
    - Update `formatFormulaResult()` to just show `quantity_raw` + `quantity_unit`

  **Must NOT do**:
  - No new API endpoints
  - No changes to backend types

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Type definition changes + field name updates in two files.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2a (with Task 4)
  - **Blocks**: Task 6, 8
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/frontend/src/components/Workspace/types.ts:65-76` — Current TakeoffItem to replace
  - `apps/frontend/src/components/Takeoff/QuantityTable.tsx:79-83` — Field accesses to update: `item.value`, `item.unit`, `item.classification`, `item.finalQuantity`

  **API/Type References**:
  - `apps/sidecar/api/endpoints/takeoff.py:70-82` — `TakeoffItemResponse` — the backend source of truth
  - `apps/sidecar/api/endpoints/takeoff.py:21-22` — `QuantityType = Literal["count", "linear", "area"]` and `GeometryType = Literal["point", "path", "polygon"]`

  **WHY Each Reference Matters**:
  - `takeoff.py:70-82` defines exactly what the backend returns. Frontend type MUST match these fields.
  - The `'length'` → `'linear'` rename is critical — backend rejects `'length'` with 400.

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: TakeoffItem type uses 'linear' not 'length'
    Tool: Bash (grep)
    Preconditions: types.ts modified
    Steps:
      1. grep -n "'length'" apps/frontend/src/components/Workspace/types.ts
      2. Assert no matches (should be 'linear')
      3. grep -n "'linear'" apps/frontend/src/components/Workspace/types.ts
      4. Assert match found
    Expected Result: 'length' replaced with 'linear' in TakeoffItem type
    Failure Indicators: 'length' still present in type definition
    Evidence: .omo/evidence/task-5-type-alignment.txt

  Scenario: QuantityTable uses backend field names
    Tool: Bash (grep)
    Preconditions: QuantityTable.tsx modified
    Steps:
      1. grep -n "item\.value" apps/frontend/src/components/Takeoff/QuantityTable.tsx
      2. Assert no matches
      3. grep -n "item\.quantity_raw" apps/frontend/src/components/Takeoff/QuantityTable.tsx
      4. Assert match found
    Expected Result: QuantityTable uses quantity_raw/quantity_unit, not value/unit
    Evidence: .omo/evidence/task-5-field-names.txt

  Scenario: Full typecheck passes
    Tool: Bash (pnpm typecheck)
    Preconditions: All type changes made
    Steps:
      1. cd apps/frontend && pnpm typecheck
      2. Assert exit code 0
    Expected Result: No type errors across entire frontend
    Evidence: .omo/evidence/task-5-typecheck.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `fix(frontend): wire project creation, takeoff types, and drawing persistence`
  - Files: `apps/frontend/src/components/Workspace/types.ts`, `apps/frontend/src/components/Takeoff/QuantityTable.tsx`

- [x] 6. Wire drawing tools to POST takeoff-items + load items from backend

  **What to do**:
  - In `apps/frontend/src/components/Workspace/Workspace.tsx`:
    1. Replace `const [takeoffItems] = useState<TakeoffItem[]>([])` with `const [takeoffItems, setTakeoffItems] = useState<TakeoffItem[]>([])`
    2. Add `loadTakeoffItems()` function that calls `GET /projects/{projectId}/sheets/{sheetId}/takeoff-items?project_path={projectPath}` and sets `takeoffItems` state
    3. Call `loadTakeoffItems()` when `selectedSheetId` changes (in a useEffect)
    4. Add `handleDrawingComplete()` callback that:
       - Takes completed points from drawing tool
       - Maps `activeTool` to `QuantityType`: `'measure-length'` → `'linear'`, `'measure-area'` → `'area'`, `'count'` → `'count'`
       - POSTs to `/{projectId}/sheets/{sheetId}/takeoff-items` with geometry
       - On success, appends returned item to `takeoffItems` state and clears drawing points
    5. Pass `handleDrawingComplete` and drawing state down to `SheetViewer`
  - In `SheetViewer.tsx`, add a completion mechanism:
    - When user double-clicks (polyline/polygon) or single-clicks (count), trigger the callback with the accumulated points
    - Use `activeTool` prop to determine geometry kind
    - The `useDrawing` hook already handles point accumulation — add the completion trigger

  **Must NOT do**:
  - No changes to `useDrawing` hook itself (it works correctly)
  - No changes to backend takeoff endpoints (they work correctly)
  - No classification selection UI (use null classification_id)
  - No scale integration (use scale=1, scale_unit='ft' defaults)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multi-file coordination with state management, event handling, and API integration. Needs careful wiring of drawing → API → state update → UI refresh cycle.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential after Task 5)
  - **Parallel Group**: Wave 2b (solo)
  - **Blocks**: Task 8
  - **Blocked By**: Task 5 (needs aligned TakeoffItem type)

  **References**:

  **Pattern References**:
  - `apps/frontend/src/components/Workspace/Workspace.tsx:50-78` — `handleAcceptCandidate` shows exact pattern for POSTing takeoff items. Copy this pattern for drawing completion.
  - `apps/frontend/src/components/Workspace/Workspace.tsx:29-44` — `loadSheets()` shows the fetch-and-set pattern to copy for `loadTakeoffItems()`
  - `apps/frontend/src/components/Workspace/SheetViewer.tsx:198-228` — Mouse event handlers for drag selection. Similar pattern needed for drawing completion (double-click to finish polygon/line).

  **API/Type References**:
  - `apps/sidecar/api/endpoints/takeoff.py:38-46` — `TakeoffItemCreateRequest` — exact request body shape: `{ type, geometry: { kind, points, holes, scale, scale_unit }, classification_id?, source, confidence }`
  - `apps/sidecar/api/endpoints/takeoff.py:84-102` — `GET /sheets/{sheet_id}/takeoff-items` endpoint to load existing items
  - `apps/frontend/src/hooks/useDrawing.ts:21-62` — `useDrawing` hook API: `points`, `addPoint`, `clearPoints`, `setPoints`, `viewportToPdf`
  - `apps/frontend/src/components/Workspace/types.ts:63` — `ToolType` = `'select' | 'pan' | 'measure-length' | 'measure-area' | 'count'`

  **WHY Each Reference Matters**:
  - `Workspace.tsx:50-78` is the existing pattern for creating takeoff items from search candidates — drawing completion should follow the identical API call pattern
  - `useDrawing` hook provides the points array; this task connects it to the backend
  - Tool-to-type mapping is critical: `measure-length` → `linear` (not `length`!), `measure-area` → `area`, `count` → `count`

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Drawing polygon creates area takeoff item
    Tool: Bash (grep + pnpm typecheck)
    Preconditions: Workspace.tsx modified with drawing→takeoff wiring
    Steps:
      1. Verify Workspace.tsx contains fetch POST to takeoff-items endpoint
      2. Verify tool-to-type mapping: 'measure-length' → 'linear', 'measure-area' → 'area', 'count' → 'count'
      3. Verify takeoffItems state is updated after successful POST
      4. pnpm typecheck — assert no errors
    Expected Result: Drawing completion triggers API call, state updates with new item
    Failure Indicators: Missing fetch call, wrong type mapping, type errors
    Evidence: .omo/evidence/task-6-drawing-wiring.txt

  Scenario: Takeoff items load when sheet changes
    Tool: Bash (grep)
    Preconditions: Workspace.tsx modified
    Steps:
      1. Verify Workspace.tsx has useEffect that calls loadTakeoffItems when selectedSheetId changes
      2. Verify loadTakeoffItems calls GET /sheets/{sheetId}/takeoff-items
      3. Verify setTakeoffItems is called with response data
    Expected Result: Sheet change triggers takeoff items reload
    Failure Indicators: No useEffect for sheet change, missing fetch call
    Evidence: .omo/evidence/task-6-load-items.txt

  Scenario: Drawing tools pass activeTool to SheetViewer
    Tool: Bash (grep)
    Preconditions: SheetViewer modified
    Steps:
      1. Verify SheetViewer receives activeTool prop
      2. Verify double-click handler exists for completing polyline/polygon
      3. Verify single-click handler for count mode
    Expected Result: SheetViewer can trigger drawing completion based on active tool
    Evidence: .omo/evidence/task-6-tool-completion.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `fix(frontend): wire project creation, takeoff types, and drawing persistence`
  - Files: `apps/frontend/src/components/Workspace/Workspace.tsx`, `apps/frontend/src/components/Workspace/SheetViewer.tsx`, `apps/frontend/src/components/Workspace/types.ts`

- [x] 7. Backend tests for project + image endpoints

  **What to do**:
  - Create `apps/sidecar/tests/test_projects_api.py`:
    - Test `POST /projects` — creates project, returns correct shape, .gtl directory exists
    - Test `GET /projects` — lists created projects
    - Test `POST /projects` with empty name — returns 422
  - Add tests to `apps/sidecar/tests/test_sheets_api.py` (or create if doesn't exist):
    - Test `GET /{project_id}/sheets/{sheet_id}/image` — returns PNG for valid sheet with render
    - Test image endpoint with invalid sheet_id — returns 404
    - Test `list_sheets` returns `thumbnail_url` as URL path (not filesystem path)

  **Must NOT do**:
  - No mocking the filesystem — use real temp directories (follow existing test patterns)
  - No changes to the endpoints being tested

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Following established test patterns, 2 test files.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 8)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2, 3

  **References**:

  **Pattern References**:
  - `apps/sidecar/tests/test_takeoff_api.py` — Follow this exact test pattern: `TestClient(create_app())`, temp directory for project path, `init_db()`, direct model insertion for setup, assert response shape
  - `apps/sidecar/tests/test_sheets_api.py` — Existing sheet tests (if any) to extend

  **WHY Each Reference Matters**:
  - `test_takeoff_api.py` is the gold standard for API integration tests in this codebase — same fixtures, same patterns

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All new tests pass
    Tool: Bash
    Preconditions: Test files created
    Steps:
      1. cd apps/sidecar && uv run pytest tests/test_projects_api.py tests/test_sheets_api.py -v
      2. Assert all tests pass
      3. Assert at least 5 test functions total
    Expected Result: All tests PASS, 0 failures
    Evidence: .omo/evidence/task-7-backend-tests.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `test: add endpoint and integration tests for MVP flow`
  - Files: `apps/sidecar/tests/test_projects_api.py`, `apps/sidecar/tests/test_sheets_api.py`
  - Pre-commit: `cd apps/sidecar && uv run pytest tests/ -v`

- [x] 8. Frontend tests for project creation + takeoff wiring

  **What to do**:
  - Update existing test files or create new ones to cover:
    - `apps/frontend/src/components/Workspace/Workspace.test.tsx` — Add test that verifies `takeoffItems` state integrates with `QuantityTable` using the new field names (`quantity_raw`, `quantity_unit`)
    - `apps/frontend/tests/App.test.tsx` (or `src/App.test.tsx`) — Test that "Create New Project" button triggers fetch POST (mock fetch)
    - Verify no regressions in existing tests
  - Follow existing Vitest patterns from `apps/frontend/src/hooks/useScale.test.tsx` and similar

  **Must NOT do**:
  - No E2E/Playwright tests (those are separate)
  - No snapshot tests

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Updating existing test patterns, small scope.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: None
  - **Blocked By**: Tasks 4, 5, 6

  **References**:

  **Pattern References**:
  - `apps/frontend/src/hooks/useScale.test.tsx` — Existing Vitest hook test pattern
  - `apps/frontend/src/components/Workspace/Workspace.test.tsx` — Existing workspace component test (if exists)
  - `apps/frontend/src/components/Takeoff/QuantityTable.test.tsx` — Existing quantity table test (if exists)

  **WHY Each Reference Matters**:
  - Follow the established test setup: `vi.mock`, `render`, `screen.getByTestId` patterns

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All frontend tests pass
    Tool: Bash
    Preconditions: Test files updated
    Steps:
      1. cd apps/frontend && pnpm test -- --run
      2. Assert all tests pass
      3. Assert no regressions in existing tests
    Expected Result: All tests PASS, 0 failures
    Evidence: .omo/evidence/task-8-frontend-tests.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `test: add endpoint and integration tests for MVP flow`
  - Files: test files in `apps/frontend/`
  - Pre-commit: `pnpm test`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .omo/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `pnpm typecheck` + `pnpm lint` + `pnpm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.omo/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `fix(sidecar): add project CRUD and sheet image serving endpoints` — `projects.py`, `sheets.py`, `main.py`
- **Wave 2**: `fix(frontend): wire project creation, takeoff types, and drawing persistence` — `App.tsx`, `types.ts`, `Workspace.tsx`, `QuantityTable.tsx`
- **Wave 3**: `test: add endpoint and integration tests for MVP flow` — test files

---

## Success Criteria

### Verification Commands
```bash
# Backend
cd apps/sidecar && uv run pytest tests/ -v  # Expected: all pass

# Frontend  
pnpm typecheck  # Expected: no errors
pnpm lint       # Expected: no errors
pnpm test       # Expected: all pass

# Integration (manual via curl)
curl -X POST http://127.0.0.1:8765/projects -H "Content-Type: application/json" -d '{"name":"Test"}' # Expected: 200 with project_id and path
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] End-to-end flow: create project → upload PDF → view sheet → draw → see quantity

# GroundTruth Local MVP - Learnings

## T5: Python Backend Bootstrap & Config

### What worked
- `pydantic-settings` `BaseSettings` handles env var loading cleanly with `env_prefix` and `env_file`.
- Creating `apps/sidecar/main.py` as `uvicorn main:app` module (not `__main__.py`) allows Tauri to reference it as a target.
- Hardcoding version string avoids `importlib.metadata` (unavailable in Python 3.14 early build).
- Startup validation (storage dir creation) in lifespan catches permission errors cleanly.

### Gotchas
- Python 3.14 doesn't have `importlib.metadata` attribute yet — used hardcoded "0.1.0" string instead.
- Python 3.14 also doesn't support `from importlib import.metadata` syntax — `metadata.version()` call was broken.
- `SIDECAR_HOST`, `SIDECAR_PORT` env vars override defaults correctly.
- Must bind to `127.0.0.1` (not `0.0.0.0`) for localhost-only model per security defaults.

## T15: Formula service

- Safe formula evaluation uses Python `ast.parse(..., mode="eval")` with a strict node allowlist rather than raw `eval()` or new dependencies.
- `QTY`, `qty`, and `quantity` aliases cover simple takeoff multiplier formulas like `QTY * 1.05`.
- `pytest apps/sidecar/tests/test_formulas.py` passes for formula validation and safety rejections.

## T15: Classifications API

- Classification CRUD follows existing sidecar route style: `/projects/{project_id}/classifications` plus `project_path` query param for locating `project.sqlite`.
- Hex color validation is enforced with a strict `#RRGGBB` regex and normalized to uppercase on create/update.
- `uv run --no-project --with ... pytest ...` can verify sidecar API tests when the global Python environment lacks sidecar dependencies and the local Hatch package metadata is not buildable.

## T15: Undo/redo and snapshots

- Frontend drawing undo/redo uses a generic `useHistory<T>` hook with a default 20-step limit; `SheetViewer` stores point arrays through that hook and exposes simple Undo/Redo controls.
- Snapshot API is intentionally flat CRUD under `/projects/{project_id}/snapshots`; create copies current takeoff items and geometries into `Snapshot.snapshot_json` without branching/version graph behavior.
- `pnpm -C apps/frontend test` passes with `useHistory` coverage; T15 sidecar tests pass via transient `uv run --no-project --with ... pytest ...` dependency invocation.

## T16: Quantity table + Excel export

- Excel export uses `openpyxl` with one workbook sheet per project sheet for whole-project export, or one workbook sheet when `sheet_id` is supplied.
- Export endpoint is `GET /projects/{project_id}/export.xlsx?project_path=...&sheet_id=...` and returns a FastAPI `StreamingResponse` with xlsx content type.
- Empty Excel cells round-trip through `openpyxl` as `None`, so tests should not expect blank-string values after reading a generated workbook.

## T5 (continued): SQLite Schema / SQLAlchemy ORM

### What worked
- SQLAlchemy 2.x `DeclarativeBase` + `Mapped[...] = mapped_column(...)` is the correct modern pattern.
- `ForeignKey("table.col")` as a separate positional arg to `mapped_column()` — NOT `String(36), foreign_key=...`.
- `default=_utcnow` (not `default_factory=_utcnow`) for non-dict column defaults with DeclarativeBase.
- `@contextmanager` from `contextlib` for session management.

### Gotchas
- SQLModel 0.0.38 + SQLAlchemy 2.0.49 + Python 3.14: `Mapped[X] = relationship()` causes `issubclass() arg 1 must be a class` in `get_sqlalchemy_type`. Root cause: `list['Document']` string annotation fed to `issubclass()`. Workaround: use pure SQLAlchemy `DeclarativeBase` instead of SQLModel for table models.
- `dict[str, Any]` as Pydantic annotation + `sa_column=SA_Column(SA_JSON())` causes `ValueError: <class 'dict'> has no matching SQLAlchemy type`. Solution: use `Mapped[dict[str, Any]]` with `mapped_column(JSON, default=dict)`.
- `default_factory=_utcnow` causes `sqlalchemy.exc.ArgumentError: Attribute includes dataclasses argument(s): 'default_factory' but class does not specify SQLAlchemy native dataclass configuration`. Fix: use `default=_utcnow` instead.
- `SQLite_JSON` from `sqlalchemy.dialects.sqlite` needs to be imported separately (not from `sqlalchemy` top-level).
- `@contextmanager[Session]` is invalid Python syntax — plain `@contextmanager` decorator works fine.

## T13: Geometry persistence/API + quantity computation

- Backend geometry math mirrors shared geometry unit conversion: normalize aliases, convert through meters, return canonical `ft`/`sq ft`.
- Takeoff persistence keeps the existing `takeoff_items` shape and adds one-to-one `takeoff_geometries` JSON payloads for points/holes/scale.
- FastAPI sidecar endpoint style remains explicit `project_path` query + `init_db(db_path)` + `get_session(db_path)` context manager.
- `services/__init__.py` should avoid eager service imports; otherwise importing pure math modules can transitively require SQLAlchemy/database setup.

## T17: Annotated PDF export

- Annotated PDF export can open source files with `fitz.open(source_path)` and save to `BytesIO`, leaving original PDF bytes unchanged.
- `TakeoffGeometry.points` are already PDF points, so `fitz.Point(x, y)` maps directly for line, polygon, and point annotations.
- Installed PyMuPDF exposes `Page.draw_polyline`, not `Page.draw_poly`; use `getattr(page, "draw_poly", None)` fallback to keep code compatible while satisfying future/alternate API names.
- Endpoint pattern follows Excel export: `GET /projects/{project_id}/documents/{document_id}/export.pdf?project_path=...` returning `StreamingResponse` with `application/pdf`.

## Wave 1 + T8 Verification

- `apps/sidecar/database.py` `get_session` must return `Iterator[Session]` when decorated with `@contextmanager`; Pyright accepts this shape.
- Wave 1 scaffold present: root `package.json` with pnpm workspaces, frontend Vite/React app, shared contracts, Tauri 2 shell, FastAPI sidecar config/health bootstrap.
- T8 ingestion verified by `apps/sidecar/tests/test_ingestion.py`: `ingest_pdf` copies source PDF, initializes SQLite, creates `documents`, `sheets`, and `sheet_renders` rows, and renders PNG thumbnails via PyMuPDF.
- `lsp_diagnostics apps/sidecar` clean after typing fix.
- `python -m pytest apps/sidecar/tests` passes: 12 tests passed on Python 3.14.2.

## T7: Project Folder Service
- `create_project(name, path)` builds `<path>/<name>.gtl` with transparent folder layout from `mvp-implementation.md:114-141`.
- Service initializes SQLite with `init_db(project_dir / "project.sqlite")` after creating leaf directories.
- Sidecar imports rely on `apps/sidecar` being on `sys.path`; verification used same path setup as existing tests.

## T8: PDF ingestion and render pipeline
- Backend lives in `apps/sidecar`; document ingest router can be mounted from `api.endpoints.documents` in `main.py`.
- PyMuPDF (`fitz`) renders page PNGs cleanly with `page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)` for high-quality thumbnails.
- Ingestion stores PDFs on filesystem under `documents/` and rendered PNGs under `documents/.cache/{doc_id}/`; SQLite stores only document/sheet/render rows.
- `python-multipart` is required for FastAPI `UploadFile` + `Form` ingestion endpoint.

## T9: OCR / Text Extraction Pipeline
- Native-first extraction works well with page.get_text("dict"); span and block bboxes already come back in PDF points.
- OCR fallback can stay lightweight with pytesseract + Pillow, and import can be deferred inside fallback path so native-text tests run even when OCR dependency is not yet installed in environment.
- Running pytest from apps/sidecar root must use tests/... paths, not apps/sidecar/tests/....

## T9: OCR/Text Extraction Pipeline

### What worked
- itz (PyMuPDF) get_text("dict") provides structured text extraction with bounding boxes in PDF points.
- Native text extraction via span-level iteration captures individual text elements with precise coordinates.
- Lazy import of pytesseract inside _extract_ocr_text() prevents import errors when Tesseract isn't installed.
- session.flush() before text extraction ensures Sheet rows have IDs for foreign key relationships.
- OCR fallback only triggers when native extraction returns empty results - clean separation of concerns.

### Patterns
- Text extraction uses xtract_document_text_with_session() pattern - takes existing session, queries sheets by document_id.
- SheetText stores individual words/spans with PDF point coordinates (bbox_x0, bbox_y0, bbox_x1, bbox_y1).
- SheetTextBlock aggregates text into lines/blocks with origin + dimensions (bbox_x, bbox_y, bbox_w, bbox_h).
- OCR renders page at 2x zoom (144 DPI) for better accuracy, then scales coordinates back to PDF points.

### Gotchas
- PyMuPDF get_pixmap() returns width/height as attributes, not a tuple - use (pixmap.width, pixmap.height).
- Tesseract OCR requires external Tesseract binary installation - pytesseract is just the Python wrapper.
- pytesseract.image_to_data() returns dict with lists, not list of dicts - access via data["text"][i].
- OCR confidence threshold of 30 filters noise while keeping legitimate text.
- Type annotations use # pyright: reportMissingImports=false for optional dependencies like pytesseract.

## T10: Sheet metadata detection + Library UI

- SQLAlchemy DeclarativeBase reserves `metadata`; use `sheet_metadata` column/property instead of `metadata` attribute to avoid Pyright/SQLAlchemy conflicts.
- SQLite JSON import should use `from sqlalchemy.dialects.sqlite import JSON` for model JSON columns.
- Current ingestion treats multi-page PDFs as one `Document` with one `Sheet` per page; metadata extraction runs per `Sheet` after text extraction persists `SheetText` rows.
- Frontend component tests can render with `react-dom/client` + Vitest/jsdom without adding React Testing Library.

## T12: Coordinate system + scale calibration engine

- Shared TypeScript utility packages can live under `apps/*`; root workspace glob already includes them.
- Keep PDF coordinates canonical as bottom-left origin in points (72 DPI). Convert viewport top-left CSS pixels into PDF points by scaling X and flipping Y.
- For high-DPI canvases, keep pointer math in CSS pixels by default and explicitly divide device-pixel coordinates by `devicePixelRatio` when needed.
- Scale calibration stores the two picked PDF points, known distance/unit, raw PDF-point distance, and `pointsPerUnit`; derived measurements convert through meters for `ft`, `in`, `m`, `cm`, and `mm`.
- `useScale` persists sheet-specific scales first and falls back to a project default scale in localStorage.
## T11: PDF Viewer Workspace Shell

### What worked
- Custom useViewer hook pattern for managing zoom/pan state with useCallback and refs for pan tracking.
- Using vi.waitFor() for async React component tests with createRoot (React 18 concurrent rendering).
- Tailwind CSS classes for professional, neutral styling (slate colors for construction theme).
- Extracting values from ref before using in setViewport callback to avoid non-null assertions.

### Gotchas
- React 18 createRoot is async - tests need vi.waitFor() for assertions.
- Biome lint rules: noStaticElementInteractions requires biome-ignore comment or proper ARIA attributes.
- The project uses a custom render pattern - follow existing test patterns.

### Files created
- apps/frontend/src/hooks/useViewer.ts - Zoom/pan/viewport state hook
- apps/frontend/src/components/Workspace/types.ts - Type definitions
- apps/frontend/src/components/Workspace/SheetViewer.tsx - PDF viewer with zoom
- apps/frontend/src/components/Workspace/SheetsSidebar.tsx - Sheet list sidebar
- apps/frontend/src/components/Workspace/ToolsSidebar.tsx - Tool selection sidebar
- apps/frontend/src/components/Workspace/TakeoffItemsSidebar.tsx - Takeoff items sidebar
- apps/frontend/src/components/Workspace/Workspace.tsx - Main layout
- apps/frontend/src/components/Workspace/index.ts - Barrel export
- apps/frontend/src/test/setup.ts - Test setup for vitest
- apps/frontend/src/hooks/useViewer.test.ts - Hook tests
- apps/frontend/src/components/Workspace/Workspace.test.tsx - Component tests

### Dependencies added
- @testing-library/react
- @testing-library/jest-dom

## T18: Embeddings/indexing + local vector store

- Offline search uses deterministic 384-dim signed feature hashing (`LocalEmbeddingService`) to avoid cloud calls and heavy model/database dependencies while keeping CPU cost tiny.
- Vector persistence is transparent project storage: `<project>.gtl/vectors/sheet_text.jsonl`; ingestion indexes extracted `SheetText` immediately after metadata extraction.
- Search endpoint is `GET /projects/{project_id}/search?project_path=...&q=...&limit=...` and returns document/sheet/page/text/bbox/score results.
- `pytest apps/sidecar/tests/test_search.py` needs transient sidecar deps when global env lacks SQLAlchemy; verified with `uv run --no-project --with ... pytest apps/sidecar/tests/test_search.py`.

## T19: AI Router, Provider Settings, Audit Trail

### What worked
- AI router uses `httpx.AsyncClient` for async HTTP calls to Ollama/vLLM/OpenAI-compatible APIs - no main thread blocking.
- Provider config resolution: per-project `AISettings` DB row with fallback to global `config.Settings` defaults.
- Ollama uses `/api/generate` endpoint; vLLM and OpenAI-compatible share `/v1/chat/completions` shape.
- Audit trail (`AIAuditLog`) automatically persists every prompt/response with token counts, timing, and status on every `ai_generate()` call.
- Sensitive info masking via `_mask_sensitive()` strips `api_key`, `password`, `token`, etc. from raw response metadata before DB storage.
- `httpx>=0.28.0` moved from dev to main deps in `pyproject.toml` since AI router needs it at runtime.

### Patterns
- `AISettings` is per-project (`unique=True` on `project_id`), upserted via `PUT /projects/{id}/ai/settings`.
- `AIAuditLog` entries are append-only, read via `GET /projects/{id}/ai/audit` with pagination.
- API endpoint style follows existing pattern: `project_path` query param, `init_db(db_path)`, `get_session(db_path)` context manager.
- Test fixtures use `project.sqlite` (not `test_project.sqlite`) to align with API's `_project_db_path()` resolution.

### Gotchas
- Test `TestClient` endpoint tests require correct SQLite filename alignment: API resolves `{project_path}/project.sqlite` so test fixture must use same.
- `asyncio.get_event_loop().run_until_complete()` works for running async `ai_generate()` in sync pytest tests with mocked httpx.
## T20: Copilot cited RAG

- Copilot RAG endpoint uses `POST /projects/{project_id}/copilot/chat?project_path=...` and reuses project-local `LocalVectorStore` plus `ai_generate`; no external search added.
- RAG prompt must include strict context-only language in both system prompt and user prompt, plus exact fallback: `I don't know based on the indexed PDF content.`
- Citations are built from vector results joined to `Sheet`, exposing `Sheet Number` as `sheet_number` and 1-based `Page` as `page` for clickable frontend links.
- Sidecar tests can run with transient deps using `uv run --no-project --with sqlalchemy --with fastapi --with pydantic --with pydantic-settings --with httpx --with pytest pytest apps/sidecar/tests/test_rag.py` when global Python lacks SQLAlchemy.

## T21: Text search bbox candidates

- Literal text candidates use `GET /projects/{project_id}/text-search?project_path=...&q=...&limit=...` and return `document_id`, `sheet_id`, `page_index`, `text`, and PDF-point `bbox`; no DB writes.
- Frontend candidate highlights stay in viewer state and render as yellow SVG rects inside the existing sheet overlay, filtered to the current sheet for multi-page result sets.
- Search endpoint tests require same transient sidecar dependency bundle as ingestion/export routes: add `pymupdf`, `pillow`, `python-multipart`, and `openpyxl` to `uv run --no-project --with ... pytest apps/sidecar/tests/test_search.py`.
## T23: Visual region search MVP

- MVP visual search uses Pillow grayscale template matching against one current sheet render only; no cloud CV APIs or auto-takeoff behavior.
- Region search endpoint is `POST /projects/{project_id}/visual-search?project_path=...` with `sheet_id`, `bbox`, `limit`, and `threshold`; it resolves `SheetRender.render_path` from project SQLite.
- Frontend region selection maps pointer coordinates through rendered image natural size before calling sidecar and paints returned candidate bboxes as green highlights.
- `pytest apps/sidecar/tests/test_visual_search.py` needs transient sidecar deps in bare env: `uv run --no-project --with fastapi --with sqlalchemy --with pydantic-settings --with pillow --with httpx --with pytest --with PyMuPDF --with pytesseract --with python-multipart --with openpyxl --python 3.11 pytest apps/sidecar/tests/test_visual_search.py`.
Learnings: Sidecar bundling requires target triple for Tauri. Added externalBin to tauri.conf.json. Docs cover Ollama and Tesseract setup.

## F4 scope fidelity check - 2026-05-15

- `mvp-implementation.md` and `.sisyphus/plans/groundtruth-local-mvp.md` agree on local-first/offline-first MVP guardrails.
- Implementation evidence shows Tauri + React/Vite shell, FastAPI sidecar, local SQLite/project storage, PDF/takeoff/export/RAG/search endpoints/tests, Ollama default, OpenAI-compatible URL optional.
- No cloud-first pivot found: `Settings` defaults to `127.0.0.1`, `ollama`, and `openai_compatible_url = None`.
- Potential scope blemish: shared `TakeoffItemType` includes `annotation`, but no evidence of broad redline/tool sprawl beyond annotated PDF/takeoff overlay support.

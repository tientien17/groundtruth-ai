# GroundTruth Local MVP Implementation Plan

Date: 2026-05-08
App folder: `civils-local-ai`
Product direction: local-first preconstruction intelligence cockpit

## 1. Decision summary

Build MVP as **offline-first desktop app** with local project storage, local PDF/takeoff tools, and local AI by default. Cloud AI is optional through bring-your-own OpenAI-compatible endpoint.

Chosen stack:

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | **Tauri 2** | Smaller, safer, local-file friendly, better than Electron for local-first desktop. |
| Frontend | **React + TypeScript + Vite** | Fast UI iteration, strong ecosystem, good PDF/canvas tooling. |
| UI components | **shadcn/ui + Tailwind CSS** | Clean internal tool UI, editable, no vendor lock-in. |
| Drawing viewer | **PDF.js + SVG/canvas overlay** | Mature PDF rendering; overlay handles takeoff shapes and annotations. |
| Geometry engine | **Python Shapely/GEOS + optional Turf.js frontend** | Robust polygon operations: area, merge, split, subtract. |
| Local backend | **Python FastAPI sidecar** | Best ecosystem for PDF, OCR, CV, geotech, RAG, and AI tools. |
| Local DB | **SQLite + SQLModel/SQLAlchemy** | Single-file, portable, perfect for local project metadata. |
| Vector DB | **Qdrant local** | Strong local vector search, easy Docker/binary mode, future team-server ready. |
| File store | **Project folder on disk** | Transparent, backupable, portable `.gtl-project` bundle later. |
| OCR | **PaddleOCR first, Tesseract fallback** | PaddleOCR stronger on layouts; Tesseract lightweight fallback. |
| PDF extraction | **PyMuPDF + pdfplumber** | PyMuPDF for rendering/annotations; pdfplumber for text/tables. |
| AI runtime | **Ollama local + OpenAI-compatible provider adapter** | Works offline, supports local model swap, cloud fallback. |
| Local LLM | **Qwen3/Qwen-VL class via Ollama where available** | Best first target for tool calling + vision in local workflows. |
| Embeddings | **BGE-M3 or Nomic Embed via local runtime** | Good retrieval quality, local. |
| Export | **openpyxl/XlsxWriter + PyMuPDF** | Excel and annotated PDF MVP. |
| Packaging | **Tauri bundles + Python sidecar** | Desktop distribution with local services launched by app. |

Do **not** start with Electron, full cloud SaaS, or browser-only app. Local-first file access, offline AI, and desktop plan review are core differentiators.

## 2. MVP product scope

### MVP promise

User can import construction PDF plans/specs, auto-index them locally, ask cited questions, perform manual takeoff, use AI-assisted search/counting, review/edit results, and export Excel + annotated PDF — all offline if Ollama and local models are installed.

### MVP must include

1. Project creation and local storage.
2. PDF upload/import.
3. Auto sheet naming from title-block text where possible.
4. PDF viewer with sheet list and zoom/pan.
5. Scale calibration per sheet.
6. Manual takeoff tools:
   - area polygons,
   - linear polylines,
   - count points/symbol stamps,
   - classifications/folders,
   - units and formulas MVP.
7. Local OCR/text extraction.
8. Local document search and chat with citations.
9. AI-assisted text search to count/classification candidates.
10. Basic bounding-box visual search on current sheet or selected sheets.
11. Excel export of quantities.
12. Annotated PDF export with takeoff overlays.
13. Model-provider settings: Ollama local and OpenAI-compatible cloud URL.
14. Audit trail: every AI answer/quantity links to sheet/page/tool output.

### MVP should not include yet

- Full automatic Togal-level one-click takeoff over all trades.
- Real-time collaboration.
- Autodesk/SharePoint/ServiceTitan integrations.
- Full borehole-to-AGS pipeline.
- 3D subsurface modelling.
- Multi-user permissions.
- Fine-tuned custom CV models.

These become Phase 2/3 after manual editor and local indexing work.

## 3. Architecture

```text
Tauri Desktop App
├─ React UI
│  ├─ Project dashboard
│  ├─ PDF plan viewer (PDF.js)
│  ├─ Takeoff overlay editor (SVG/canvas)
│  ├─ Classification/formula panel
│  ├─ Chat/search panel
│  ├─ Export panel
│  └─ Settings: models/storage
├─ Tauri Rust shell
│  ├─ file permissions
│  ├─ app lifecycle
│  ├─ starts/stops Python sidecar
│  └─ opens local project folders
└─ Python FastAPI sidecar
   ├─ project API
   ├─ PDF parser/renderer
   ├─ OCR worker
   ├─ geometry engine
   ├─ RAG/indexing service
   ├─ AI tool router
   ├─ export service
   └─ local DB/vector DB adapters
```

### Local services

```text
localhost only
├─ FastAPI: http://127.0.0.1:<dynamic-port>
├─ Ollama: http://127.0.0.1:11434
├─ Qdrant: embedded/local process or Docker/binary later
└─ SQLite: project metadata DB inside project folder
```

No internet required after install, unless user enables cloud model provider.

## 4. Local project folder format

Use transparent folder layout:

```text
my-project.gtl/
├─ project.sqlite
├─ documents/
│  ├─ originals/
│  ├─ rendered-pages/
│  ├─ ocr/
│  └─ thumbnails/
├─ takeoff/
│  ├─ layers.jsonl
│  ├─ classifications.json
│  ├─ formulas.json
│  └─ snapshots/
├─ rag/
│  ├─ chunks.jsonl
│  └─ qdrant/ or qdrant_collection_id.txt
├─ exports/
│  ├─ excel/
│  └─ annotated-pdf/
└─ audit/
   ├─ ai-runs.jsonl
   ├─ tool-calls.jsonl
   └─ user-edits.jsonl
```

Reason: user can back up, inspect, zip, move, or archive without app lock-in.

## 5. Data model MVP

Core tables:

- `projects`
- `documents`
- `sheets`
- `sheet_text_blocks`
- `sheet_renders`
- `classifications`
- `takeoff_items`
- `takeoff_vertices`
- `formulas`
- `snapshots`
- `ai_runs`
- `tool_calls`
- `exports`

### Takeoff item types

```ts
type TakeoffItemType = "area" | "linear" | "count" | "annotation";
```

### Takeoff item fields

- `id`
- `sheet_id`
- `classification_id`
- `type`
- `geometry_json`
- `source`: `manual | ai_candidate | ai_accepted | imported`
- `confidence`
- `scale_id`
- `quantity_raw`
- `quantity_unit`
- `created_by`
- `created_at`
- `updated_at`

## 6. AI tool-calling design

LLM is planner, not measurer. Tools measure.

### MVP tools

```json
[
  {
    "name": "search_project_docs",
    "purpose": "Search indexed OCR/text chunks and return cited page/sheet/bbox results"
  },
  {
    "name": "get_sheet_text",
    "purpose": "Return OCR/text blocks for a sheet with coordinates"
  },
  {
    "name": "find_text_on_sheets",
    "purpose": "Find exact/fuzzy text matches and return bboxes"
  },
  {
    "name": "render_sheet_region",
    "purpose": "Return cropped image region for local vision or UI preview"
  },
  {
    "name": "visual_search_region",
    "purpose": "Find visually similar regions to selected bbox"
  },
  {
    "name": "measure_area_geometry",
    "purpose": "Calculate area from polygon geometry and sheet scale"
  },
  {
    "name": "measure_linear_geometry",
    "purpose": "Calculate length from polyline geometry and sheet scale"
  },
  {
    "name": "count_items",
    "purpose": "Count accepted count marks or AI candidates"
  },
  {
    "name": "export_quantities_excel",
    "purpose": "Export current takeoff table to Excel"
  },
  {
    "name": "export_annotated_pdf",
    "purpose": "Export selected sheets with overlay annotations"
  }
]
```

### Guardrails

- LLM cannot invent quantities.
- All quantity answers must include tool output ID.
- All citations must include document, sheet/page, bbox or chunk ID.
- Cloud model calls are disabled by default.
- Prompt and tool-call logs stored locally for audit.

## 7. Frontend MVP screens

### 1. Project Dashboard

- New project.
- Open project folder.
- Recent projects.
- Import PDFs.
- Indexing status.

### 2. Plan Library

- Sheet thumbnails.
- Auto-detected sheet number/title.
- Discipline/revision tags.
- Search by text/title.
- Manual rename/correct.

### 3. Drawing Workspace

- PDF viewer.
- Zoom/pan.
- Scale calibration.
- Area/linear/count tools.
- Classification sidebar.
- Properties panel.
- Layer visibility.
- Undo/redo.

### 4. AI Search Workspace

- Text search across sheets.
- Bounding-box visual search.
- Candidate list with confidence.
- Accept/reject candidate matches.
- Convert accepted candidates to classifications.

### 5. Plan Copilot

- Chat with citations.
- Tool-call trace collapsible.
- Prompt templates:
  - “Find specified flooring material.”
  - “List fire-rated wall requirements.”
  - “Find all notes mentioning stormwater.”
  - “Draft RFI for conflicting detail references.”

### 6. Export Center

- Quantity table preview.
- Group by classification/folder/sheet.
- Export Excel.
- Export annotated PDF.

### 7. Settings

- Model provider:
  - Ollama local URL.
  - OpenAI-compatible URL/key optional.
- Embedding model.
- OCR engine.
- Storage location.

## 8. Backend services

### Project service

Responsibilities:
- Create/open project folder.
- Manage SQLite DB.
- Track documents/sheets.
- Snapshot project state.

### Ingestion service

Responsibilities:
- Copy original PDF into project.
- Extract page count and metadata.
- Render thumbnails and full-page images.
- Extract embedded text.
- Run OCR if embedded text sparse.
- Detect sheet name/title.

### Geometry service

Responsibilities:
- Store/edit geometry.
- Compute scaled quantities.
- Polygon boolean ops.
- Validate self-intersections.
- Convert frontend coordinates to PDF/page coordinates.

### RAG service

Responsibilities:
- Chunk OCR/text.
- Embed chunks.
- Store vectors in Qdrant.
- Retrieve cited chunks.
- Return sheet/page/bbox metadata.

### AI router

Responsibilities:
- Normalize model calls across Ollama/cloud providers.
- Register tool schemas.
- Execute local tools.
- Store audit log.
- Enforce “no quantity without tool output.”

### Export service

Responsibilities:
- Quantity Excel export.
- Annotated PDF export.
- JSON export of takeoff package.

## 9. Implementation phases

### Phase 0 — Repo scaffold and local shell

Deliverables:
- Tauri + React + Vite app.
- Python FastAPI sidecar.
- App starts sidecar and health-checks it.
- Basic settings persisted.

Acceptance:
- Desktop app opens.
- `/health` returns OK.
- UI can call backend.

### Phase 1 — Project and PDF ingestion

Deliverables:
- Create/open local project folder.
- Import PDF.
- Render sheet thumbnails.
- Extract text with PyMuPDF/pdfplumber.
- OCR fallback with PaddleOCR or Tesseract.
- Auto sheet naming MVP.

Acceptance:
- User imports multi-sheet PDF.
- Sheet list appears with thumbnails and names.
- Search can find embedded/OCR text.

### Phase 2 — Manual takeoff editor

Deliverables:
- PDF.js viewer.
- Overlay coordinate system.
- Scale calibration.
- Area polygon, linear polyline, count point tools.
- Classifications/folders.
- Quantity calculations.
- Undo/redo.

Acceptance:
- User draws area/line/count.
- Quantities update live.
- Data persists after app restart.

### Phase 3 — Export MVP

Deliverables:
- Excel export grouped by classification/sheet.
- Annotated PDF export with overlays.
- Export audit metadata.

Acceptance:
- Excel file opens correctly.
- Annotated PDF matches on-screen takeoff.

### Phase 4 — Local RAG and Plan Copilot

Deliverables:
- Qdrant local indexing.
- Embedding model adapter.
- Chat UI.
- `search_project_docs` tool.
- Citations with sheet/page/bbox.
- Ollama + OpenAI-compatible adapters.

Acceptance:
- User asks question about spec/plan text.
- Answer includes cited source.
- Tool-call log is stored.

### Phase 5 — AI-assisted search/counting

Deliverables:
- Text search returns bbox candidates.
- Convert text hits into count marks.
- Bounding-box visual search MVP on current sheet.
- Candidate accept/reject UI.

Acceptance:
- User boxes symbol, finds likely matches, accepts candidates, exports counts.

## 10. Milestone priority

Build order:

1. Project folder + PDF ingestion.
2. Manual takeoff editor.
3. Excel/annotated PDF export.
4. Local RAG with citations.
5. AI-assisted search/counting.
6. Drawing revision diff.
7. Geotech/borehole extraction.
8. Collaboration/self-hosted sync.

Reason: manual editor and exports make app useful even before AI is perfect.

## 11. Recommended dependencies

### Frontend

```json
{
  "core": ["@tauri-apps/api", "react", "typescript", "vite"],
  "ui": ["tailwindcss", "shadcn-ui", "lucide-react"],
  "pdf": ["pdfjs-dist"],
  "canvas": ["konva", "react-konva"],
  "state": ["zustand", "@tanstack/react-query"],
  "forms": ["react-hook-form", "zod"],
  "tables": ["@tanstack/react-table"]
}
```

Decision notes:
- Use `react-konva` first for speed.
- Keep geometry canonical in backend, not Konva state.
- If performance suffers, migrate overlay to custom canvas/WebGL.

### Backend

```txt
fastapi
uvicorn
pydantic
sqlmodel
sqlalchemy
pymupdf
pdfplumber
paddleocr
pytesseract
opencv-python
shapely
numpy
pandas
openpyxl
xlsxwriter
qdrant-client
httpx
python-multipart
pillow
```

Optional later:

```txt
ifcopenshell
ezdxf
geopandas
python-ags4
reportlab
langchain
llama-index
haystack-ai
```

## 12. Model recommendations

### Local default

- Chat/tool calling: Qwen3 class instruct model via Ollama.
- Vision: Qwen-VL/Qwen3-VL class model via Ollama where available.
- Embeddings: BGE-M3, Nomic Embed, or EmbeddingGemma.

### Cloud optional

Support any OpenAI-compatible provider:

- `base_url`
- `api_key`
- `chat_model`
- `vision_model`
- `embedding_model`

Cloud mode use cases:
- Hard scanned plan interpretation.
- Large spec summarization.
- Better vision extraction when local GPU absent.

## 13. Testing strategy

### Unit tests

- Scale conversion.
- Polygon area.
- Polyline length.
- Formula evaluation.
- Coordinate transforms.
- Export formatting.

### Golden fixtures

Create small test project:

```text
fixtures/sample-project/
├─ small-floor-plan.pdf
├─ expected-ocr.json
├─ expected-quantities.json
└─ expected-export.xlsx
```

### Integration tests

- Import PDF → render pages → OCR → search text.
- Draw takeoff item → save → reload → quantity unchanged.
- Export annotated PDF → verify output exists and page count matches.
- Chat query → returns citation.

### Human QA tests

- Compare AI candidate counts vs manually verified counts.
- Track precision/recall per symbol type.
- Track time saved vs manual takeoff.

## 14. Security/privacy defaults

- All project files stay local by default.
- No telemetry by default.
- Cloud AI disabled by default.
- API keys stored in OS keychain via Tauri plugin or encrypted local config.
- Show clear warning before sending cropped plans/spec text to cloud provider.
- Keep audit log of every external AI call.

## 15. First sprint task list

### Sprint 1: scaffold

- Create Tauri React app.
- Create FastAPI sidecar.
- Health-check bridge.
- Project folder create/open.
- SQLite schema init.

### Sprint 2: PDF ingestion

- Import PDFs.
- Render thumbnails/full pages.
- Extract embedded text.
- OCR fallback.
- Sheet naming MVP.

### Sprint 3: viewer + manual geometry

- PDF.js viewer.
- Overlay coordinate mapping.
- Area/linear/count drawing.
- Scale calibration.
- Persist/reload geometry.

### Sprint 4: export

- Quantity table.
- Excel export.
- Annotated PDF export.

### Sprint 5: local RAG

- Chunk/index text.
- Qdrant local.
- Ollama embeddings.
- Chat with citations.

### Sprint 6: AI-assisted search

- Text search to count marks.
- Bounding-box visual search MVP.
- Accept/reject candidate workflow.

## 16. Hard MVP success criteria

MVP succeeds when user can:

1. Install app locally.
2. Create a project with no account.
3. Import a plan/spec PDF.
4. See named sheet thumbnails.
5. Draw manual quantities with scale.
6. Ask local AI a question and get cited answer.
7. Search/count a repeated text or visual item with review.
8. Export Excel and annotated PDF.
9. Reopen project later with all work preserved.
10. Use app without internet after models are installed.

## 17. Biggest risks

| Risk | Mitigation |
|---|---|
| PDF coordinate mismatch | Build coordinate tests early. |
| Manual canvas complexity | Start with minimal area/line/count only. |
| OCR quality varies | Use embedded text first; PaddleOCR fallback; user correction. |
| Local model tool calling unreliable | Keep tools deterministic; support cloud fallback; validate JSON. |
| Visual search false positives | Candidate review UI required. |
| Packaging Python sidecar | Prototype dev first; package later after APIs stabilize. |
| Scope creep | Defer geotech, collaboration, full auto takeoff until MVP core works. |

## 18. Final recommendation

Start with **Tauri + React + FastAPI + SQLite + PyMuPDF/pdfplumber + Shapely + Qdrant + Ollama**.

This stack gives best balance:
- local-first privacy,
- rich desktop plan UX,
- Python AI/CV/PDF ecosystem,
- portable project data,
- cloud AI optional,
- clear path from manual takeoff to AI-assisted takeoff.

Build manual takeoff and exports first. Then add AI. This avoids fragile demo trap and creates useful app even when local models miss.

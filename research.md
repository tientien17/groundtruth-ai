# Civils Local AI: Civils.ai Capability Research + Offline Open-Source Recreation Plan

Date: 2026-05-08
Target app folder: `civils-local-ai`
Source focus: https://civils.ai/ and open-source/offline alternatives

## Executive summary

Civils.ai can be recreated **partially to mostly offline** with open-source components, but not as one drop-in open-source clone. Public Civils.ai value comes from four things combined:

1. Construction-document ingestion: PDF drawings, scanned PDFs, handwritten/historic documents.
2. Civil/AEC workflows: quantity takeoff, CAD data extraction, geotechnical/borehole digitisation, compliance/spec checks.
3. AI orchestration: natural-language agents that call measurement, OCR, RAG, export, and annotation tools.
4. Human QA: Civils.ai advertises 97%+ takeoff accuracy with expert review. This is hardest part to match fully offline.

Best offline recreation path: build modular desktop/web app using local OCR + PDF/CAD parsers + vector/RAG store + tool-calling LLM runtime. Use cloud AI provider optionally for high-accuracy vision/model reasoning, but keep all core parsers and exports local. Use local models where possible: Qwen3/Qwen3-VL class models for tool calling and vision, Gemma 3/vision-capable Gemma-family models where supported by runtime, plus local embeddings/rerankers.

## What Civils.ai publicly offers

### 1. AI quantity takeoffs from PDF drawings

Civils.ai says users upload PDF drawings, select an AI Agent, type scope in plain English, and get measured areas, lengths, volumes, and counts. Outputs are editable and downloadable as Excel and annotated PDF.

Evidence:
- Homepage: `https://civils.ai/`
- Quantity workflow: upload PDFs, select AI Agent, type scope, review/export.
- Claims: 90% less manual effort, 97% accuracy on modern PDFs, human QA review.

Supported scopes publicly listed:
- Groundworks.
- Landscaping and paving areas.
- Utilities: ducts, cables, conduits.
- Drainage: run lengths by pipe diameter.
- Concrete volumes and formwork areas.
- Covers, frames, manholes, gullies.
- Earthworks, drainage, concrete, steelwork, MEP, fit-out.
- 11+ trades claimed on public pages.

Manual side:
- User chooses/upload drawings.
- User prompts scope.
- User reviews and edits results.
- User downloads Excel/annotated PDF.
- Professional plan supports revision requests from comments.

Automated/AI side:
- Extract CAD-like data from PDFs.
- Detect/measure objects.
- Mark up drawings.
- Produce structured takeoff tables.
- Route jobs through QA workflow.

### 2. Earthworks and subsurface/geotechnical workflows

Civils.ai has earthworks/geotech feature page: `https://civils.ai/ai-takeoffs-for-earthworks-landscaping-and-subsurface-data`

Public tools:
- Surface takeoffs from PDF drawings.
- Borehole/geotechnical report extraction.
- AGS 4.1 and Excel export.
- Borehole logs from scanned, handwritten, or digital reports.
- 16+ data groups: geology, in-situ tests, lab data, metadata.
- Geo-referenced boreholes.
- 2D cross-sections.
- 3D ground models.
- Foundation requirement estimation / bearing-capacity issue insight.

Manual side:
- Upload whole geotech report, no need to split pages.
- Review extracted AGS/Excel outputs.
- Edit/inspect visualisations.

Automated/AI side:
- Detect borehole logs inside long reports.
- Extract geology, SPT/CPT, groundwater, lab and coordinate data.
- Structure data into AGS 4.1/Excel.
- Geo-locate points and visualise subsurface model.

### 3. Contract/spec/code review and compliance checks

Source pages:
- `https://civils.ai/ai-for-searching-construction-specifications`
- `https://civils.ai/ai-for-construction-plan-compliance`

Public tools:
- Search construction contracts, specifications, drawings, and codes of practice.
- AI answers with citations to exact pages/sections.
- Reusable workflows/templates for repeatable checks.
- Compliance checking between proposal and project requirements.
- Non-compliance reports/comment sheets.
- Tender/subcontractor scope checking.
- Decision matrices for subcontractor options vs client specs.
- Code-compliance queries against code libraries.
- Project archive search for reusable details.

Manual side:
- User uploads source docs or connects systems.
- User defines checks/questions/risks.
- User saves templates and reruns.
- User reviews cited evidence.

Automated/AI side:
- RAG/search across document library.
- Cross-document requirement matching.
- Flag gaps/conflicts/non-compliances.
- Cite exact sources and open marked-up source document.

### 4. AutoCAD/CAD data extraction API

Source: `https://civils.ai/blog/how-to-extract-cad-data-API`

Public capabilities:
- Extract drawing schedules/tables from CAD PDFs.
- Capture notes and annotations.
- Pull specifications linked to drawing elements.
- Interpret geometric data: dimensions, layouts, visual elements.
- Natural-language query over drawings, e.g. foundation thickness.
- Sync/index drawings automatically.
- Embed Civils features in custom dashboards.
- Customize workflows.

Public export formats:
- Excel.
- AGS 4.1.
- Shapefiles.
- DXF.
- Annotated PDF.

### 5. Integrations and enterprise tools

Source: `https://civils.ai/pricing`

Public integrations/features:
- Autodesk Construction Cloud sync.
- SharePoint sync.
- API access, Enterprise tier.
- MCP integration, Enterprise tier.
- SSO/SAML, Enterprise tier.
- Custom DPA/security review.

### 6. File formats and limits

Inputs publicly claimed:
- Any PDF document/drawing.
- Scanned PDFs.
- Handwritten PDFs/logs.
- Historic drawings/reports.
- Multi-sheet drawings.

Outputs publicly claimed:
- Excel.
- Annotated PDF.
- AGS 4.1.
- DXF.
- Shapefile.
- 2D section PDF/DXF.

Limits/pricing as of research:
- Starter: US$90/month, 10 takeoffs/month, unlimited AI searches/checks, 1 user, 2 GB storage.
- Professional: US$270/month, 30 takeoffs/month, unlimited AI searches/checks, 1 user, 50 GB storage, revision requests, learns standards.
- Enterprise: custom takeoffs/storage, unlimited users, API/MCP, SSO/SAML.
- 1 takeoff = 1 trade on 1 drawing sheet.
- Multi-trade cap: 5 takeoffs per drawing sheet.
- Standard searches/checks unlimited under fair use; multi-step advanced agents may price separately.
- Target workflow completion: within 24 hours.

## Offline recreation feasibility

### Verdict

Fully offline local clone is **technically feasible for MVP and advanced internal workflows**, but matching Civils.ai production reliability and 97%+ accuracy needs dataset-specific training, validation tooling, and human QA loop.

Best framing: recreate capabilities, not proprietary model. Build local toolchain where AI calls deterministic tools.

## Proposed open-source stack

### PDF, CAD, and drawing ingestion

| Need | Open-source options | License / fit | Notes |
|---|---|---|---|
| PDF text/vector extraction | `pdfplumber`, `pdfminer.six`, `PyMuPDF` | MIT / AGPL-commercial mix | Extract text, tables, paths, dimensions, annotations. PyMuPDF good for rendering/annotations. |
| PDF raster rendering | Poppler, PyMuPDF | OSS | Convert sheets to images for vision/OCR. |
| DXF read/write | `ezdxf` | MIT | Mature Python DXF parser/writer. Useful for exports and geometry layers. |
| IFC/BIM quantities | `IfcOpenShell`, `qto_buccaneer`, `ifc-material-qto` | OSS | Better for BIM-native QTO than PDF-only takeoff. |
| Table extraction | `camelot`, `tabula`, `pdfplumber`, `img2table` | OSS | Works best on clean tables; scanned tables need OCR. |

### OCR and vision document understanding

| Need | Open-source options | Notes |
|---|---|---|
| OCR | Tesseract, PaddleOCR, EasyOCR | PaddleOCR strongest broad doc OCR; Tesseract stable and simple. |
| Layout detection | LayoutParser, deepdoctection, DocTR | Detect tables, forms, text blocks, drawing labels. |
| Vision-language model | Qwen2.5-VL/Qwen3-VL class via Ollama/vLLM; InternVL; LLaVA variants | Needed for scanned drawing semantics, legends, labels. |
| Table OCR | PaddleOCR table, img2table | Needed for schedules/rates/borehole logs. |

### RAG, citations, and document QA

| Need | Open-source options | Offline fit |
|---|---|---|
| RAG framework | RAGFlow, R2R, Haystack, LlamaIndex, LangChain | Good. RAGFlow strong for document parsing/citation UX. |
| Vector DB | Qdrant, Chroma, LanceDB, Milvus Lite | Fully local. |
| Embeddings | BGE-M3, Nomic Embed, E5, EmbeddingGemma via Ollama | Fully local. |
| Reranking | BGE reranker, Jina reranker local models | Improves citation quality. |
| Source citations | Custom page/chunk coordinates + viewer deep-linking | Must preserve page, bbox, sheet, layer metadata. |

### Geotechnical and civil engineering libraries

| Need | Open-source options | Notes |
|---|---|---|
| AGS read/write | `python-ags4`, `bedrock-ge` | Core for borehole/geotech export. |
| Borehole extraction | geotech-report-extraction, swissgeol borehole extraction | Useful references; likely need adaptation. |
| GIS/geospatial | GDAL, GeoPandas, Shapely, Rasterio, Fiona, pyproj | For coordinates, shapefiles, map layers. |
| 2D/3D visualisation | PyVista, VTK, Plotly, deck.gl, QGIS integration | Build sections/models from borehole data. |
| Civil/structural calcs | structuralcodes, eurocodepy, sectionproperties, concrete-properties, PyNite | For code checks and engineering computations. |

### Quantity takeoff engine

No mature OSS package exactly equals Civils.ai PDF drawing takeoff. Build custom pipeline:

1. Parse PDF vector primitives where present.
2. Rasterize scanned sheets.
3. OCR legend, notes, callouts, scales, dimensions.
4. Detect title block, sheet scale, coordinate/grid references.
5. Segment drawing features by visual/layer style.
6. Calibrate scale from title block or dimension strings.
7. Convert detected polylines/areas/count symbols to real-world quantities.
8. Let LLM classify scope and call measurement tools.
9. Render annotations back onto PDF.
10. Export structured Excel/CSV/JSON.

Best libraries:
- Geometry: Shapely, GEOS, OpenCV, scikit-image.
- PDF annotation: PyMuPDF.
- Excel: openpyxl, pandas, XlsxWriter.
- DXF export: ezdxf.

### Report and export generation

| Output | Open-source path |
|---|---|
| Excel | pandas + openpyxl/XlsxWriter |
| Annotated PDF | PyMuPDF annotations/drawings |
| AGS 4.1 | python-ags4 / bedrock-ge |
| DXF | ezdxf |
| Shapefile/GeoPackage | GeoPandas/Fiona/GDAL |
| Reports/comment sheets | ReportLab, WeasyPrint, Jinja2 templates |

## AI model strategy

### Option A: own cloud AI provider with tool calling + vision

Best for accuracy and speed. Local app remains data/control plane, but uses provider model for hard vision/reasoning.

Requirements:
- OpenAI-compatible API preferred.
- Vision input support.
- Function/tool calling support.
- JSON/schema-constrained outputs.
- Large context for long specs/contracts.
- Data retention controls.

Good provider categories:
- OpenAI-compatible gateway/provider.
- Anthropic-compatible messages API.
- Gemini-like vision models.
- Private cloud/vLLM server with Qwen-VL.

Architecture:
- Local app stores docs, vectors, metadata, exports.
- AI provider receives cropped page snippets, OCR text, and tool schemas.
- Tool calls execute locally: `measure_area`, `extract_tables`, `query_rag`, `annotate_pdf`, `export_excel`, `write_ags`.
- Sensitive mode can disable cloud and use local-only models.

### Option B: fully local models

Best for privacy/offline. Harder for scanned drawings and complex visual reasoning.

Local runtime options:
- Ollama: easiest local model runtime, OpenAI-compatible API, embeddings, vision, tool calling.
- LM Studio: local model server and UI.
- vLLM: production local/cluster inference, OpenAI-compatible, better throughput.
- llama.cpp: efficient quantized local inference.

Ollama evidence from docs:
- Supports OpenAI-compatible API at `http://localhost:11434/v1/`.
- Supports vision models such as `qwen3-vl:8b` in examples.
- Supports tool/function calling with `tools` schemas.
- Supports embeddings endpoint `/api/embed`, e.g. `embeddinggemma`.

Recommended local model roles:
- Tool-calling planner: Qwen3/Qwen3.5 class instruct model.
- Vision/document model: Qwen-VL/Qwen3-VL or InternVL class model.
- Embeddings: BGE-M3, Nomic Embed, E5, EmbeddingGemma.
- Reranker: BGE reranker local model.
- OCR fallback: PaddleOCR/Tesseract, not LLM-only OCR.

Important note on model names:
- User mentioned `qwen 3.6` and `gemma 4`. Public/common naming shifts fast; design should not hard-code model family. Use model adapter layer. Any model qualifies if it supports: vision, tool calling, structured JSON, enough context, acceptable latency.

## Proposed app: `civils-local-ai`

### Core principle

LLM must not “measure” by guessing. LLM plans and calls tools. Deterministic geometry/OCR/RAG tools produce measurements and evidence.

### High-level architecture

```text
civils-local-ai
├─ desktop/web UI
│  ├─ project library
│  ├─ PDF/drawing viewer
│  ├─ prompt/workflow builder
│  ├─ review/edit takeoff table
│  └─ source citation + annotation viewer
├─ ingestion pipeline
│  ├─ PDF parser/render/OCR
│  ├─ CAD/DXF/IFC parser
│  ├─ table/log extractor
│  └─ metadata/index builder
├─ AI orchestration
│  ├─ local/cloud model adapter
│  ├─ tool schemas
│  ├─ workflow templates
│  └─ validation/QA agent
├─ tools
│  ├─ measure_area / measure_length / count_symbols
│  ├─ query_documents / cite_sources
│  ├─ extract_boreholes / write_ags
│  ├─ annotate_pdf
│  └─ export_excel / export_dxf / export_shp
├─ storage
│  ├─ SQLite/Postgres
│  ├─ local object store/filesystem
│  ├─ Qdrant/Chroma vector DB
│  └─ audit logs
└─ exports
   ├─ Excel
   ├─ Annotated PDF
   ├─ AGS 4.1
   ├─ DXF
   └─ Shapefile/GeoPackage
```

### MVP features

1. Project/document upload: PDFs, DXF, IFC optional.
2. OCR and sheet indexing.
3. Natural-language document Q&A with citations.
4. Spec/code compliance checklist workflow.
5. Basic takeoff: lengths, counts, areas where vector PDF or calibrated raster is clear.
6. Annotated PDF export.
7. Excel export.
8. Local Ollama model adapter + optional OpenAI-compatible cloud adapter.
9. Manual review/edit table.
10. Audit trail: every answer links to page/sheet/bbox/tool output.

### Phase 2 features

1. Borehole/geotech extraction into AGS 4.1.
2. 2D cross-sections and 3D borehole visualisation.
3. Autodesk/SharePoint-like local sync connectors.
4. Reusable workflow templates.
5. Custom standards memory per user/team.
6. Revision comments workflow.
7. DXF/shapefile export.

### Phase 3 features

1. Multi-sheet, multi-trade takeoff workflows.
2. Fine-tuned drawing symbol detector.
3. Human QA queue with diff/review tooling.
4. Benchmark suite vs manually verified projects.
5. Local multi-agent planner/reviewer for large jobs.

## Tool schemas needed for AI agent

Example local tools:

```json
[
  {"name":"search_project_docs","purpose":"RAG search with citations over indexed drawings/specs/contracts"},
  {"name":"render_pdf_region","purpose":"Crop sheet/page region for vision or human review"},
  {"name":"extract_table","purpose":"Extract table from PDF page or image region"},
  {"name":"detect_scale","purpose":"Find drawing scale from title block, dimensions, or calibration line"},
  {"name":"measure_lengths","purpose":"Measure polylines matching class/filter and return real-world length"},
  {"name":"measure_areas","purpose":"Measure closed polygons/regions matching class/filter"},
  {"name":"count_symbols","purpose":"Count repeated symbols/fixtures/manholes/gullies"},
  {"name":"extract_borehole_logs","purpose":"Extract borehole/geotech data into structured rows"},
  {"name":"write_annotated_pdf","purpose":"Draw markups, labels, and source boxes onto PDF"},
  {"name":"export_excel","purpose":"Export takeoff/check results into spreadsheet"},
  {"name":"export_ags","purpose":"Write AGS 4.1 geotech file"}
]
```

## Offline recreation gaps

| Civils.ai feature | Offline clone difficulty | Reason |
|---|---:|---|
| Document Q&A with citations | Medium | RAG frameworks mature; citation bbox needs careful indexing. |
| Contract/spec/code checks | Medium | Good RAG + checklist templates; legal/engineering review still needed. |
| Excel export | Low | Standard libraries. |
| Annotated PDF export | Medium | PyMuPDF works; annotation UX/custom geometry needed. |
| Modern vector PDF takeoff | Medium-high | Geometry extraction + scale calibration + classification. |
| Scanned/historic drawing takeoff | High | Needs robust CV/vision models and QA. |
| Borehole log extraction | Medium-high | Existing OSS helps; formats vary wildly. |
| AGS 4.1 export | Medium | Libraries exist; data mapping/validation matters. |
| 2D/3D ground model | Medium-high | GIS/geotech interpolation and visual UX needed. |
| 97%+ accuracy | High | Requires domain dataset, benchmarks, human QA. |
| Enterprise sync/API/MCP | Medium | Technically standard; product/security work. |

## Recommended open-source-first build choices

### Conservative stack

- Backend: Python FastAPI.
- Frontend: React + PDF.js + canvas/SVG annotation layer.
- Desktop packaging: Tauri or Electron if desktop needed.
- Storage: SQLite for single-user; Postgres for team/server.
- Files: local filesystem project store.
- Vector DB: Qdrant local.
- PDF/CAD: PyMuPDF, pdfplumber, ezdxf, IfcOpenShell.
- OCR: PaddleOCR + Tesseract fallback.
- Geometry: OpenCV, Shapely, scikit-image.
- RAG: Haystack/LlamaIndex or RAGFlow if adopting larger platform.
- Models: Ollama/vLLM adapter with Qwen/Gemma-family models.
- Exports: pandas/openpyxl, PyMuPDF, python-ags4, GeoPandas, ezdxf.

### Why this stack

- Runs offline.
- Avoids vendor lock-in.
- Keeps deterministic calculations outside LLM.
- Supports cloud model swap later through OpenAI-compatible adapter.
- Open-source core mostly MIT/Apache/BSD-style, but verify per package before commercial use.

## Product recommendation

Build `civils-local-ai` as **offline-first civil document intelligence**, not pure “AI drawing measurer.” Start with workflows that have strong OSS support and high value:

1. Search/check specs/contracts/codes with citations.
2. Extract tables/schedules/rates into Excel.
3. Annotate PDFs with cited evidence.
4. Basic vector PDF takeoff.
5. Borehole log extraction to Excel/AGS.

Defer hardest item until dataset exists:
- fully automatic scanned drawing takeoff with Civils.ai-level accuracy.

Best commercial strategy:
- Local-first app for privacy-sensitive AEC firms.
- Bring-your-own-model: Ollama/LM Studio/vLLM for local; OpenAI-compatible URL for cloud.
- Tool calling mandatory.
- Vision mandatory for scanned/historic documents.
- Human review UI mandatory for trust.

## Short answer to user question

Yes, it can be recreated mostly offline on a local machine using open-source pieces. Best version is hybrid:

- Local deterministic tools for PDFs, CAD, OCR, geometry, RAG, exports.
- Local model for normal prompts/tool calling.
- Optional cloud vision model for hard scanned/historic drawings.
- Human QA/review workflow to reach professional accuracy.

Fully local Qwen/Gemma-style setup is viable if models support vision + tool calling + JSON. Expect lower accuracy on messy drawings unless trained/calibrated on real AEC documents.

## Sources checked

Civils.ai:
- https://civils.ai/
- https://civils.ai/pricing
- https://civils.ai/ai-takeoffs-for-earthworks-landscaping-and-subsurface-data
- https://civils.ai/ai-for-searching-construction-specifications
- https://civils.ai/ai-for-construction-plan-compliance
- https://civils.ai/ai-for-construction-consultants
- https://civils.ai/blog/how-to-extract-cad-data-API
- https://civils.ai/ai-for-aec-automation

Open-source/reference stack:
- https://github.com/mozman/ezdxf
- https://github.com/pdfminer/pdfminer.six
- https://github.com/pymupdf/PyMuPDF
- https://github.com/jsvine/pdfplumber
- https://github.com/PaddlePaddle/PaddleOCR
- https://github.com/tesseract-ocr/tesseract
- https://github.com/Layout-Parser/layout-parser
- https://github.com/deepdoctection/deepdoctection
- https://github.com/qdrant/qdrant
- https://github.com/chroma-core/chroma
- https://github.com/infiniflow/ragflow
- https://github.com/SciPhi-AI/R2R
- https://github.com/deepset-ai/haystack
- https://github.com/run-llama/llama_index
- https://github.com/mozman/ezdxf
- https://github.com/IfcOpenShell/IfcOpenShell
- https://github.com/AGS-data-format-wg/ags-python-library or `python-ags4` ecosystem
- https://github.com/pcachim/eurocodepy
- https://github.com/fib-international/structuralcodes
- https://github.com/JWock82/Pynite
- https://github.com/robbievanleeuwen/section-properties
- https://github.com/ollama/ollama
- https://docs.ollama.com/

---

# Addendum: Merging Togal.ai Features into Civils Local AI

Date added: 2026-05-08
Source focus: https://www.togal.ai/features and public Togal help/marketing pages

## Why Togal changes the product direction

Civils.ai is strongest at civil engineering intelligence: geotech extraction, AGS output, specs/code checks, CAD-data extraction, earthworks, and construction-document reasoning.

Togal.ai is strongest at estimator workflow UX: one-click takeoff, AI image/text/pattern search, auto sheet naming, manual polygon tools, drawing comparison, classification libraries, formulas, assemblies, collaboration, and export into estimating systems.

Merged product should not be “Civils.ai clone” or “Togal clone.” Better unique position:

> **Local-first preconstruction intelligence cockpit**: offline plan takeoff + spec/code/geotech reasoning + estimator-grade manual editing + model-agnostic AI agents.

## Togal.ai public feature inventory

### 1. Upload, auto-name, and organize plan sets

Togal workflow begins with uploading documents, organizing files, and using auto-naming to rename plan sheets in seconds.

Evidence:
- `https://www.togal.ai/features`
- Help center references drawing management/uploading.

Local-first feature to add:
- Sheet title-block OCR.
- Sheet number/title detection.
- Discipline grouping: A, S, C, MEP, L, G, etc.
- Revision/date detection.
- Local project folder structure.
- Manual correction UI that trains local rules.

Open-source path:
- PaddleOCR/Tesseract for title block OCR.
- PyMuPDF/pdfplumber for embedded text.
- Regex + local LLM classifier for sheet naming.
- SQLite FTS5 for local sheet search.

### 2. Togal Button / one-click automated takeoff

Togal advertises a green button that automatically handles tedious clicking and counting. Help material describes automated floor-plan takeoff: gross/net areas, wall-line linears, counts, doors, plumbing fixtures, appliances, furniture, architectural floor plans, and reflected ceiling plans.

Evidence:
- `https://www.togal.ai/features`
- `https://help.togal.ai/how-to-use-togal-automated-takeoff`
- Claimed 98% floor-plan accuracy on public pages/FAQ.

Local-first feature to add:
- **Local Takeoff Button**: run selected automated workflows on chosen sheets.
- Choose detection modules before run: rooms/areas, walls/linears, symbols/counts, text labels, fixtures, doors/windows.
- Preserve run as separate takeoff layer.
- Allow “re-run from corrections” without destroying user edits.

Open-source path:
- Vector PDFs: PyMuPDF/pdfplumber path extraction + Shapely.
- Raster/scanned PDFs: OpenCV + segmentation models.
- Floor plan ML: RoomFormer, DeepFloorplan, CubiCasa-style segmentation, FloorPlanAnalyzer references.
- Object detection: YOLOv8/YOLO11 custom models; YOLOplan as reference for MEP/electrical symbols.
- Manual QA/review mandatory.

### 3. AI image search, text search, and pattern search

Togal lets user draw a bounding box around an object, then search whole plan set for visually similar objects. Public page also mentions text and pattern search.

Evidence:
- `https://www.togal.ai/features`
- `https://help.togal.ai/ai-image-search`
- `https://help.togal.ai/pattern-search`
- `https://help.togal.ai/text-search`

Local-first feature to add:
- **Find Similar on Plans**:
  - User boxes a symbol/pattern/room finish.
  - App searches selected sheets locally.
  - Results appear as candidate counts with confidence.
  - User accepts/rejects matches.
  - Accepted matches become count/area/linear classifications.
- **Pattern takeoff** for hatches/colors in flooring, ceiling, landscaping, and elevation plans.
- **Text search to quantities**: find all `FD`, `GFI`, `W1`, pipe diameter labels, finish tags, door/window tags.

Open-source path:
- Image embeddings: CLIP/SigLIP/DINOv2 locally.
- Template matching: OpenCV ORB/SIFT/template matching.
- Object detection: YOLO fine-tuned on symbols.
- Segmentation: Segment Anything/SAM2-like local model where license permits, OpenCV contours for simple hatches.
- Text: OCR + SQLite FTS5/BM25 + bbox highlighting.

### 4. Manual takeoff editor tools

Togal includes manual takeoff tools alongside AI: area classifications, linear classifications, count classifications, split, merge, cut/subtract, arc line/arc area, smart paste, snapping, multi-select, scale setup, line merge, rotate/flip/combine polygons, elevations workflow, repeating groups/multipliers.

Evidence:
- `https://help.togal.ai/classifications`
- `https://help.togal.ai/performing-takeoffs`
- `https://help.togal.ai/drawing-editor`

Local-first feature to add:
- Browser/desktop drawing editor with:
  - Polygon draw/edit.
  - Polyline/arc measurement.
  - Count stamps/symbols.
  - Snap to points/lines/intersections.
  - Split/merge/subtract polygons.
  - Smart copy/paste with snapping.
  - Scale calibration per sheet.
  - Repeating unit multipliers.
  - Elevation takeoff mode.

Open-source path:
- UI canvas: PDF.js + SVG/canvas overlay, Fabric.js/Konva, or custom WebGL.
- Geometry: Shapely/GEOS backend or Turf.js/JSTS frontend.
- CAD/web editor references: OpenWebCAD, DGM.js, mlightcad/cad-viewer, cadview.
- Area math: robust polygon Boolean operations with GEOS/Shapely.

### 5. Classifications, folders, formulas, assemblies, libraries

Togal supports classifications for area/linear/count, folders, breakdowns, custom formulas, assemblies, material management, and reusable libraries.

Evidence:
- `https://help.togal.ai/classifications`
- `https://help.togal.ai/custom-formulas`
- `https://help.togal.ai/assemblies`
- `https://help.togal.ai/libraries`

Local-first feature to add:
- **Estimator library system**:
  - Classification templates.
  - Units: metric, imperial, mixed.
  - Formulas: waste factors, coverage, labor productivity, material conversions.
  - Assemblies: wall type, slab type, pipe trench, landscape build-up, pavement section, MEP fixture packages.
  - Project/team libraries saved as JSON/YAML/SQLite.
- **Civil-specific assemblies** unique vs Togal:
  - Road pavement layer build-ups.
  - Drainage pipe trench assemblies.
  - Manhole/chamber assemblies.
  - Earthworks cut/fill haul factors.
  - Retaining wall/foundation preliminary assemblies.

Open-source path:
- Formula engine: `formula.js`, Python `asteval`/safe expression evaluator, or custom restricted evaluator.
- Storage: SQLite/Postgres + JSON import/export.
- Exports: openpyxl/XlsxWriter.

### 6. Drawing comparison and overlays

Togal has drawing comparison/overlay where two sheets show changes in different colors and common areas in gray.

Evidence:
- `https://help.togal.ai/takeoff-overlays`
- `https://help.togal.ai/how-to-compare-drawings`
- Main site claims drawing-set comparison and change quantification.

Local-first feature to add:
- **Revision Diff**:
  - Align two sheets by title block/grid/reference points.
  - Show added/removed/unchanged geometry.
  - Quantify changed areas/lengths/counts.
  - Generate change report and annotated PDF.
- Use with Civils features:
  - Detect changed drainage routes, road extents, pavement areas, room finishes, door counts, equipment counts.
  - Pair with spec addendum diff.

Open-source path:
- Raster diff: pixelmatch, Resemble.js, diffimg, PixCompare.
- Alignment: OpenCV feature matching ORB/SIFT, homography.
- Vector diff: compare PDF paths/DXF entities when available.
- UI: overlay opacity slider + red/blue/gray layers.

### 7. Togal.CHAT / plan assistant

Togal.CHAT lets users talk to plans, ask questions, double-check quantities, catch errors, draft RFIs, submittal requirements, proposals, RFPs, and scopes. Help docs note it reads docs but does not itself measure areas/lengths/counts.

Evidence:
- `https://www.togal.ai/features`
- `https://help.togal.ai/togal-chat`
- `https://help.togal.ai/togal.chat-prompt-suggestions`

Local-first feature to add:
- **Plan Copilot** with strict tool routing:
  - For Q&A: use local RAG and cite page/sheet/bbox.
  - For measuring: call measurement tools, never answer from language model guess.
  - For RFI/RFP/proposal writing: use cited project context.
  - For error checks: compare quantities, specs, drawings, and revisions.
- Prompt examples:
  - “Find all wall type W3 and estimate gypsum board area.”
  - “Compare civil drainage plan C-104 rev B vs rev C and list changed runs.”
  - “Draft RFI for conflicting pipe invert elevations.”
  - “Which boreholes show soft clay within 2m of formation level?”

Open-source path:
- Local model: Ollama/vLLM + Qwen/Gemma-family tool-calling model.
- RAG: RAGFlow/R2R/Haystack/LlamaIndex + Qdrant.
- Citations: page/sheet/bbox metadata.
- Tool calling: OpenAI-compatible tool schema adapter.

### 8. Collaboration, permissions, snapshots, history

Togal has real-time collaboration, internal/external users, permissions, version history, snapshots, and restore.

Evidence:
- `https://www.togal.ai/features`
- `https://help.togal.ai/collaboration`
- `https://help.togal.ai/version-history`

Local-first feature to add:
- **Local-first collaboration**:
  - Single-user offline by default.
  - Self-hosted team server optional.
  - Project-level permissions.
  - Invite subcontractor package export/import.
  - Change log and snapshots.
  - Git-like history for JSON takeoff layers and project metadata.
- Offline collaboration model:
  - Project bundle is portable `.clai-project` folder/zip.
  - Edits stored as CRDT/event log where possible.
  - Sync when LAN/server available.

Open-source path:
- SQLite WAL for local edits.
- Litestream/rqlite for sync, or Postgres for self-hosted.
- Automerge/Yjs for collaborative canvas state.
- Git-like snapshots using content-addressed JSON.

### 9. Export to estimating systems

Togal exports quantities to Excel/estimating software and has ServiceTitan integration.

Evidence:
- `https://www.togal.ai/features`
- `https://help.togal.ai/exporting`
- `https://help.togal.ai/integration-with-service-titan`

Local-first feature to add:
- Export profiles:
  - Excel workbook.
  - CSV by classification/folder/assembly.
  - JSON API package.
  - PDF markups.
  - DXF overlays.
  - AGS/geotech exports from Civils side.
  - Estimating package connector layer.
- Unique local-first connector:
  - “Bring your own estimate template”: map outputs to user spreadsheet columns.
  - Offline material/labor pricebook in SQLite.
  - Optional ServiceTitan/Procore/Autodesk connector later.

## Updated unique feature set: Civils + Togal + offline-first

### Product name candidate

`Civils Local AI` remains fine, but merged scope may need stronger name:

- `Precon Local AI`
- `GroundTruth Takeoff`
- `SiteProof AI Estimator`
- `CivilsIQ Local`
- `Takeoff Copilot Local`

Recommended working name: **GroundTruth Local** — communicates measurements, citations, offline trust.

### Differentiated modules

| Module | Inspired by | Unique local-first twist |
|---|---|---|
| Plan Library | Togal | Auto-names, groups, and revisions sheets offline. |
| Local Takeoff Button | Togal | One-click AI workflows, but deterministic measurement tools and local model. |
| Find Similar | Togal | Local visual/text/pattern search over full plan set. |
| Manual Takeoff Editor | Togal | Estimator-grade polygon/linear/count tools with audit trail. |
| Drawing Diff | Togal | Revision comparison plus quantified deltas and RFI generator. |
| Plan Copilot | Togal + Civils | Chat that can call takeoff, RAG, geotech, compliance, export tools. |
| Specs/Code Checker | Civils | Local RAG against specs, contracts, standards. |
| Geotech Extractor | Civils | Borehole PDFs to AGS/Excel/3D model offline. |
| Civil Assemblies | New | Road, trench, drainage, earthworks, pavement, foundation assemblies. |
| Local Model Hub | New | Choose Ollama/LM Studio/vLLM/cloud provider per workflow. |
| QA Bench | New | Compare AI results to human-verified benchmark projects. |

## Updated architecture after Togal merge

```text
GroundTruth Local / civils-local-ai
├─ Project Hub
│  ├─ document upload/import
│  ├─ auto sheet naming
│  ├─ revision grouping
│  ├─ discipline folders
│  └─ local project bundle export/import
├─ Drawing Workspace
│  ├─ PDF/DXF/IFC viewer
│  ├─ manual takeoff editor
│  ├─ polygon/linear/count layers
│  ├─ scale calibration
│  ├─ split/merge/cut/fill/arc/snap tools
│  ├─ overlay/drawing comparison
│  └─ annotation/markup tools
├─ AI Search Workspace
│  ├─ image search from bounding box
│  ├─ text search with bbox hits
│  ├─ pattern/hatch search
│  ├─ symbol counting
│  └─ room/area segmentation
├─ Plan Copilot
│  ├─ local/cloud model adapter
│  ├─ tool calling router
│  ├─ project RAG with citations
│  ├─ quantity sanity checks
│  ├─ RFI/RFP/proposal drafts
│  └─ compliance/spec/code checks
├─ Civil Engineering Workspace
│  ├─ geotech/borehole extraction
│  ├─ AGS 4.1 writer
│  ├─ 2D/3D subsurface visualisation
│  ├─ earthworks/drainage assemblies
│  └─ structural/civil calc plugins
├─ Estimating Workspace
│  ├─ classifications/folders
│  ├─ formulas
│  ├─ assemblies
│  ├─ libraries/templates
│  ├─ pricebook
│  └─ Excel/CSV/JSON exports
└─ Local-First Infrastructure
   ├─ SQLite/Postgres
   ├─ local files/object store
   ├─ Qdrant/Chroma vector DB
   ├─ Ollama/LM Studio/vLLM/cloud model providers
   ├─ snapshots/version history
   └─ self-hosted collaboration server optional
```

## Updated MVP roadmap after Togal merge

### MVP 0: local project library and chat with citations

Goal: prove local-first document intelligence.

Features:
- Upload PDFs.
- Auto-name sheets from title blocks.
- OCR/text extraction.
- Local RAG Q&A with page/sheet citations.
- Excel/PDF export basics.
- Ollama/OpenAI-compatible provider switch.

### MVP 1: estimator-grade manual takeoff

Goal: useful without AI, unlike many AI demos.

Features:
- PDF viewer with scale calibration.
- Area/linear/count classifications.
- Polygon edit, snap, split, merge, subtract.
- Classification folders, formulas, assemblies.
- Excel export.
- Snapshots/version history.

### MVP 2: AI search and assisted takeoff

Goal: Togal-like productivity boost offline.

Features:
- Bounding-box image search.
- Text search to count classifications.
- Pattern/hatch search for areas.
- Local Takeoff Button for selected modules.
- Manual accept/reject candidate workflow.
- Annotated PDF export.

### MVP 3: Civils-specific depth

Goal: unique vs Togal and generic takeoff tools.

Features:
- Specs/code compliance workflows.
- Drawing/spec contradiction checks.
- Borehole/geotech extraction to Excel/AGS.
- 2D subsurface section MVP.
- Civil assemblies for road/drainage/earthworks.

### MVP 4: revision intelligence and collaboration

Goal: preconstruction cockpit.

Features:
- Drawing overlay and diff.
- Quantified revision delta report.
- RFI generator from changed/conflicting info.
- Local/self-hosted collaboration.
- Import/export portable project bundles.

## Build vs buy / OSS reuse guidance

### Reuse aggressively

- OCR: PaddleOCR/Tesseract.
- PDF: PyMuPDF/pdfplumber/PDF.js.
- Vector DB/RAG: Qdrant + Haystack/LlamaIndex/RAGFlow/R2R.
- Geometry: Shapely/GEOS, OpenCV.
- BIM/IFC: IfcOpenShell, qto_buccaneer.
- CAD/DXF: ezdxf, cadview/mlightcad references.
- Diff: pixelmatch/PixCompare/OpenCV alignment.
- Exports: openpyxl/XlsxWriter/ReportLab/GeoPandas/python-ags4.

### Build custom

- Estimator takeoff canvas UX.
- Unified classification/formula/assembly system.
- Drawing measurement QA loop.
- Bounding-box visual search workflow.
- Revision diff tuned for plan sheets.
- Tool-calling router that prevents LLM measurement hallucination.
- Local-first project bundle format.

## Important product rule after Togal merge

Do not let LLM directly create quantities from image vibes.

Correct flow:

1. LLM interprets user intent.
2. LLM calls deterministic tool.
3. Tool returns measurement with sheet, scale, geometry, confidence, source bbox.
4. User reviews/edits.
5. Export includes audit trail.

This makes local-first app more trustworthy than generic AI and more private than cloud-only tools.

## Added Togal sources checked

- https://www.togal.ai/features
- https://www.togal.ai/
- https://www.togal.ai/pricing
- https://www.togal.ai/vs/planswift
- https://www.togal.ai/case-study/peer-reviewed-study-togal-ai-vs-on-screen-takeoff
- https://help.togal.ai/how-to-use-togal-automated-takeoff
- https://help.togal.ai/ai-image-search
- https://help.togal.ai/pattern-search
- https://help.togal.ai/text-search
- https://help.togal.ai/togal-chat
- https://help.togal.ai/togal.chat-prompt-suggestions
- https://help.togal.ai/classifications
- https://help.togal.ai/custom-formulas
- https://help.togal.ai/assemblies
- https://help.togal.ai/performing-takeoffs
- https://help.togal.ai/drawing-editor
- https://help.togal.ai/takeoff-overlays
- https://help.togal.ai/how-to-compare-drawings
- https://help.togal.ai/collaboration
- https://help.togal.ai/version-history
- https://help.togal.ai/exporting
- https://help.togal.ai/integration-with-service-titan
- https://help.togal.ai/libraries

## Added OSS/reference candidates for Togal-like features

- OpenConstructionERP: full construction ERP/takeoff/BOQ reference.
- IfcOpenShell / ifc5d / qto_buccaneer / ifc-material-qto: IFC/BIM QTO.
- RoomFormer / DeepFloorplan / CubiCasa-style models / FloorPlanAnalyzer: room/floor-plan segmentation references.
- YOLOplan / YOLOv8 custom symbol detectors: symbol/object counting.
- mlightcad/cad-viewer / cadview / OpenWebCAD / DGM.js: drawing viewer/editor references.
- pixelmatch / Resemble.js / PixCompare / OpenCV: drawing comparison and overlay.
- PaddleOCR / Tesseract / pdfplumber / PyMuPDF: OCR and PDF extraction.

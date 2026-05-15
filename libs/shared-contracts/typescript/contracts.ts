export type TakeoffItemType = "area" | "linear" | "count" | "annotation";
export type TakeoffSource = "manual" | "ai_candidate" | "ai_accepted" | "imported";
export type IsoDateTime = string;
export type Uuid = string;

export const PROJECT_FOLDER_SCHEMA = {
  extension: ".gtl",
  requiredPaths: [
    "project.sqlite",
    "documents/originals/",
    "documents/rendered-pages/",
    "documents/ocr/",
    "documents/thumbnails/",
    "takeoff/layers.jsonl",
    "takeoff/classifications.json",
    "takeoff/formulas.json",
    "takeoff/snapshots/",
    "rag/chunks.jsonl",
    "exports/excel/",
    "exports/annotated-pdf/",
    "audit/ai-runs.jsonl",
    "audit/tool-calls.jsonl",
    "audit/user-edits.jsonl",
  ],
  alternativePaths: ["rag/qdrant/", "rag/qdrant_collection_id.txt"],
} as const;

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}

export type ApiResponse<T> =
  | { ok: true; data: T; error?: never }
  | { ok: false; data?: never; error: ApiError };

export interface Project {
  id: Uuid;
  name: string;
  path: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Document {
  id: Uuid;
  projectId: Uuid;
  filename: string;
  originalPath: string;
  createdAt: IsoDateTime;
}

export interface Sheet {
  id: Uuid;
  documentId: Uuid;
  sheetNumber: string;
  pageIndex: number;
}

export interface Classification {
  id: Uuid;
  name: string;
  color: string;
}

export interface TakeoffItem {
  id: Uuid;
  sheetId: Uuid;
  classificationId: Uuid;
  type: TakeoffItemType;
  geometryJson: Record<string, unknown>;
  source: TakeoffSource;
  confidence: number | null;
  scaleId: string | null;
  quantityRaw: number | null;
  quantityUnit: string | null;
  createdBy: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export const CORE_TABLES = [
  "projects",
  "documents",
  "sheets",
  "sheet_text_blocks",
  "sheet_renders",
  "classifications",
  "takeoff_items",
  "takeoff_vertices",
  "formulas",
  "snapshots",
  "ai_runs",
  "tool_calls",
  "exports",
] as const;

/**
 * Types for the Workspace (PDF viewer) components.
 */

import type { SheetSummary } from '../Library/types'
import type { TextSearchCandidate } from '../Search/TextSearchTool'

export interface WorkspaceProps {
  /** Project ID */
  projectId: string
  /** Project path on disk */
  projectPath: string
  /** Sidecar API port */
  sidecarPort: number
  /** Initial sheet to display (optional) */
  initialSheetId?: string
}

export interface SheetViewerProps {
  /** Project ID */
  projectId: string
  /** Sheet to display */
  sheet: SheetSummary | null
  /** Whether the sheet is loading */
  loading?: boolean
  /** Error message if sheet failed to load */
  error?: string | null
  /** Sidecar API port for loading full-res images */
  sidecarPort: number
  /** Project path for resolving sheet paths */
  projectPath: string
  /** Currently active workspace tool */
  activeTool?: ToolType
  /** Callback when manual drawing is completed */
  onDrawingComplete?: (points: Array<{ x: number; y: number }>, tool: ToolType) => void
  /** Callback when search candidates change */
  onCandidatesChange?: (candidates: TextSearchCandidate[]) => void
}

export interface SheetsSidebarProps {
  /** List of sheets in the project */
  sheets: SheetSummary[]
  /** Currently selected sheet ID */
  selectedSheetId: string | null
  /** Callback when sheet is selected */
  onSelectSheet: (sheetId: string) => void
  /** Whether sheets are loading */
  loading?: boolean
}

export interface ToolsSidebarProps {
  /** Currently active tool */
  activeTool: ToolType
  /** Callback when tool is selected */
  onSelectTool: (tool: ToolType) => void
}

export interface TakeoffItemsSidebarProps {
  /** List of takeoff items */
  items: TakeoffItem[]
  /** Callback when item is selected */
  onSelectItem?: (itemId: string) => void
  /** Selected item ID */
  selectedItemId?: string | null
}

export type ToolType = 'select' | 'pan' | 'measure-length' | 'measure-area' | 'count'

export interface TakeoffGeometry {
  id: string
  kind: 'point' | 'path' | 'polygon'
  points: Array<{ x: number; y: number }>
  holes: Array<Array<{ x: number; y: number }>>
  scale: number
  scale_unit: string
}

export interface TakeoffItem {
  id: string
  sheet_id: string
  classification_id: string | null
  type: 'linear' | 'area' | 'count'
  source: string
  confidence: number | null
  scale_id: string | null
  quantity_raw: number | null
  quantity_unit: string | null
  created_by: string
  geometry: TakeoffGeometry | null
}

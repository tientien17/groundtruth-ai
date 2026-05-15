/** Types for the Library (sheet browser) components. */

export interface SheetSummary {
  id: string
  document_id: string
  sheet_number: string
  sheet_title: string | null
  page_index: number
  thumbnail_url: string | null
  sheet_metadata: Record<string, unknown>
}

export interface SheetUpdateRequest {
  sheet_number?: string
  sheet_title?: string
}

export type ViewMode = 'grid' | 'list'

export interface VisualSearchBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface VisualSearchCandidate {
  bbox: [number, number, number, number]
  score: number
}

export interface VisualSearchResponse {
  sheet_id: string
  candidates: VisualSearchCandidate[]
}

export function normalizeVisualSearchBox(startX: number, startY: number, endX: number, endY: number): VisualSearchBox {
  return {
    x0: Math.min(startX, endX),
    y0: Math.min(startY, endY),
    x1: Math.max(startX, endX),
    y1: Math.max(startY, endY),
  }
}

export async function searchVisualRegion(params: {
  sidecarPort: number
  projectId: string
  projectPath: string
  sheetId: string
  bbox: VisualSearchBox
}): Promise<VisualSearchResponse> {
  const response = await fetch(
    `http://127.0.0.1:${params.sidecarPort}/projects/${params.projectId}/visual-search?project_path=${encodeURIComponent(params.projectPath)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheet_id: params.sheetId,
        bbox: [params.bbox.x0, params.bbox.y0, params.bbox.x1, params.bbox.y1],
      }),
    },
  )
  if (!response.ok) {
    throw new Error(`Visual search failed: ${response.status}`)
  }
  return response.json() as Promise<VisualSearchResponse>
}

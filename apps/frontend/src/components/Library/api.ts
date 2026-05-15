/** API hooks for the sheet library. */

import type { SheetSummary, SheetUpdateRequest } from './types'

const BASE = (port: number) => `http://127.0.0.1:${port}`

export async function fetchSheets(
  port: number,
  projectId: string,
  projectPath: string,
): Promise<SheetSummary[]> {
  const params = new URLSearchParams({ project_path: projectPath })
  const url = `${BASE(port)}/projects/${projectId}/sheets?${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch sheets: ${res.statusText}`)
  return res.json()
}

export async function updateSheet(
  port: number,
  projectId: string,
  sheetId: string,
  projectPath: string,
  body: SheetUpdateRequest,
): Promise<SheetSummary> {
  const params = new URLSearchParams({ project_path: projectPath })
  const url = `${BASE(port)}/projects/${projectId}/sheets/${sheetId}?${params}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Failed to update sheet: ${res.statusText}`)
  return res.json()
}

import { useCallback, useEffect, useState } from 'react'
import type { SheetSummary, ViewMode } from './types'
import { fetchSheets } from './api'
import { SheetCard } from './SheetCard'

type SheetLibraryProps = {
  projectId: string
  projectPath: string
  sidecarPort: number
}

export function SheetLibrary({ projectId, projectPath, sidecarPort }: SheetLibraryProps) {
  const [sheets, setSheets] = useState<SheetSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const loadSheets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSheets(sidecarPort, projectId, projectPath)
      setSheets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sheets')
    } finally {
      setLoading(false)
    }
  }, [sidecarPort, projectId, projectPath])

  useEffect(() => {
    loadSheets()
  }, [loadSheets])

  const handleSheetUpdated = useCallback(
    (updated: SheetSummary) => {
      setSheets((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)))
    },
    [],
  )

  if (loading) {
    return <div className="p-6 text-text-secondary">Loading sheets...</div>
  }

  if (error) {
    return (
      <div className="p-6 text-error">
        <p>{error}</p>
        <button type="button" onClick={loadSheets} className="btn btn-secondary mt-2">Retry</button>
      </div>
    )
  }

  if (sheets.length === 0) {
    return (
      <div className="p-6 text-text-tertiary text-center">
        No sheets found. Upload a PDF to get started.
      </div>
    )
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex justify-between items-center py-2 mb-3">
        <span className="text-sm text-text-secondary">
          {sheets.length} sheet{sheets.length !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`px-2 py-1 text-xs rounded border border-border-strong transition-colors ${
              viewMode === 'grid' 
                ? 'bg-primary-light font-semibold text-primary' 
                : 'bg-transparent font-normal text-text-secondary hover:bg-background'
            }`}
            aria-label="Grid view"
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-2 py-1 text-xs rounded border border-border-strong transition-colors ${
              viewMode === 'list' 
                ? 'bg-primary-light font-semibold text-primary' 
                : 'bg-transparent font-normal text-text-secondary hover:bg-background'
            }`}
            aria-label="List view"
          >
            List
          </button>
        </div>
      </div>

      {/* Sheet display */}
      {viewMode === 'grid' ? (
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
          data-testid="sheet-grid"
        >
          {sheets.map((sheet) => (
            <SheetCard
              key={sheet.id}
              sheet={sheet}
              sidecarPort={sidecarPort}
              projectId={projectId}
              projectPath={projectPath}
              onUpdated={handleSheetUpdated}
            />
          ))}
        </div>
      ) : (
        <table className="w-full border-collapse text-sm" data-testid="sheet-list">
          <thead>
            <tr className="border-b-2 border-border text-left">
              <th className="px-3 py-2">Sheet #</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Page</th>
              <th className="px-3 py-2">Discipline</th>
            </tr>
          </thead>
          <tbody>
            {sheets.map((sheet) => (
              <tr key={sheet.id} className="border-b border-border">
                <td className="px-3 py-2 font-semibold">{sheet.sheet_number}</td>
                <td className="px-3 py-2 text-text-secondary">
                  {sheet.sheet_title ?? 'Untitled'}
                </td>
                <td className="px-3 py-2 text-text-tertiary">{sheet.page_index + 1}</td>
                <td className="px-3 py-2 text-text-tertiary">
                  {(sheet.sheet_metadata?.discipline as string | undefined) ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default SheetLibrary

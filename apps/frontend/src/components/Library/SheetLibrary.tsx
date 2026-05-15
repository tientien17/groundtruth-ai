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
    return <div style={{ padding: 24, color: '#64748b' }}>Loading sheets...</div>
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: '#ef4444' }}>
        <p>{error}</p>
        <button type="button" onClick={loadSheets}>Retry</button>
      </div>
    )
  }

  if (sheets.length === 0) {
    return (
      <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center' }}>
        No sheets found. Upload a PDF to get started.
      </div>
    )
  }

  return (
    <div>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 0',
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 14, color: '#64748b' }}>
          {sheets.length} sheet{sheets.length !== 1 ? 's' : ''}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            style={{
              padding: '4px 8px',
              fontSize: 12,
              fontWeight: viewMode === 'grid' ? 700 : 400,
              background: viewMode === 'grid' ? '#e0f2fe' : 'transparent',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              cursor: 'pointer',
            }}
            aria-label="Grid view"
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            style={{
              padding: '4px 8px',
              fontSize: 12,
              fontWeight: viewMode === 'list' ? 700 : 400,
              background: viewMode === 'list' ? '#e0f2fe' : 'transparent',
              border: '1px solid #cbd5e1',
              borderRadius: 4,
              cursor: 'pointer',
            }}
            aria-label="List view"
          >
            List
          </button>
        </div>
      </div>

      {/* Sheet display */}
      {viewMode === 'grid' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
          }}
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }} data-testid="sheet-list">
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px' }}>Sheet #</th>
              <th style={{ padding: '8px 12px' }}>Title</th>
              <th style={{ padding: '8px 12px' }}>Page</th>
              <th style={{ padding: '8px 12px' }}>Discipline</th>
            </tr>
          </thead>
          <tbody>
            {sheets.map((sheet) => (
              <tr key={sheet.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{sheet.sheet_number}</td>
                <td style={{ padding: '8px 12px', color: '#475569' }}>
                  {sheet.sheet_title ?? 'Untitled'}
                </td>
                <td style={{ padding: '8px 12px' }}>{sheet.page_index + 1}</td>
                <td style={{ padding: '8px 12px', color: '#64748b' }}>
                  {(sheet.sheet_metadata as Record<string, unknown>)?.discipline as string ?? '—'}
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

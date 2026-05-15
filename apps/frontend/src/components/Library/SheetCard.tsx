import { useState, useCallback } from 'react'
import type { SheetSummary, SheetUpdateRequest } from './types'
import { updateSheet } from './api'

type SheetCardProps = {
  sheet: SheetSummary
  sidecarPort: number
  projectId: string
  projectPath: string
  onUpdated: (updated: SheetSummary) => void
}

export function SheetCard({
  sheet,
  sidecarPort,
  projectId,
  projectPath,
  onUpdated,
}: SheetCardProps) {
  const [editing, setEditing] = useState(false)
  const [editNumber, setEditNumber] = useState(sheet.sheet_number)
  const [editTitle, setEditTitle] = useState(sheet.sheet_title ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const body: SheetUpdateRequest = {}
      if (editNumber !== sheet.sheet_number) body.sheet_number = editNumber
      if (editTitle !== (sheet.sheet_title ?? '')) body.sheet_title = editTitle || undefined
      if (Object.keys(body).length > 0) {
        const updated = await updateSheet(sidecarPort, projectId, sheet.id, projectPath, body)
        onUpdated(updated)
      }
      setEditing(false)
    } catch {
      // keep editing state on error
    } finally {
      setSaving(false)
    }
  }, [editNumber, editTitle, sheet, sidecarPort, projectId, projectPath, onUpdated])

  const handleCancel = useCallback(() => {
    setEditNumber(sheet.sheet_number)
    setEditTitle(sheet.sheet_title ?? '')
    setEditing(false)
  }, [sheet])

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }}
      data-testid="sheet-card"
    >
      {/* Thumbnail */}
      <div
        style={{
          width: '100%',
          aspectRatio: '4/3',
          background: '#f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {sheet.thumbnail_url ? (
          <img
            src={sheet.thumbnail_url}
            alt={`Sheet ${sheet.sheet_number}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <span style={{ color: '#94a3b8', fontSize: 14 }}>No preview</span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '8px 12px' }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input
              value={editNumber}
              onChange={(e) => setEditNumber(e.target.value)}
              placeholder="Sheet number"
              aria-label="Sheet number"
              style={{ fontWeight: 600, fontSize: 14, padding: '2px 4px' }}
            />
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Sheet title"
              aria-label="Sheet title"
              style={{ fontSize: 12, padding: '2px 4px', color: '#475569' }}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <button type="button" onClick={handleSave} disabled={saving} style={{ fontSize: 12 }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={handleCancel} disabled={saving} style={{ fontSize: 12 }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{ cursor: 'pointer', border: 0, background: 'transparent', padding: 0, textAlign: 'left' }}
            title="Click to edit"
          >
            <div style={{ fontWeight: 600, fontSize: 14 }}>{sheet.sheet_number}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              {sheet.sheet_title ?? 'Untitled sheet'}
            </div>
          </button>
        )}
      </div>
    </div>
  )
}

export default SheetCard

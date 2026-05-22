/**
 * Main workspace layout for PDF viewing with sidebars.
 */

// biome-ignore assist/source/organizeImports: Existing import order follows project ESLint conventions.
import type { SheetSummary } from '../Library/types'
import type { TakeoffItem, ToolType, WorkspaceProps } from './types'
import { useCallback, useEffect, useState } from 'react'
import { ChatPanel } from '../Copilot/ChatPanel'
import { fetchSheets } from '../Library/api'
import { QuantityTable } from '../Takeoff/QuantityTable'
import { SheetViewer } from './SheetViewer'
import { SheetsSidebar } from './SheetsSidebar'
import { ToolsSidebar } from './ToolsSidebar'
import { CandidateReview } from '../Search/CandidateReview'
import type { TextSearchCandidate } from '../Search/TextSearchTool'

export function Workspace({ projectId, projectPath, sidecarPort, initialSheetId }: WorkspaceProps) {
  const [sheets, setSheets] = useState<SheetSummary[]>([])
  const [sheetsLoading, setSheetsLoading] = useState(true)
  const [sheetsError, setSheetsError] = useState<string | null>(null)
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(initialSheetId ?? null)
  const [activeTool, setActiveTool] = useState<ToolType>('select')
  const [takeoffItems] = useState<TakeoffItem[]>([]) // Will be populated by drawing tools in T14
  const [searchCandidates, setSearchCandidates] = useState<TextSearchCandidate[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)

  // Load sheets
  const loadSheets = useCallback(async () => {
    setSheetsLoading(true)
    setSheetsError(null)
    try {
      const data = await fetchSheets(sidecarPort, projectId, projectPath)
      const withUrls = data.map(s => ({
        ...s,
        thumbnail_url: s.thumbnail_url ? `http://127.0.0.1:${sidecarPort}${s.thumbnail_url}` : null
      }))
      setSheets(withUrls)
      // Select first sheet if none selected
      if (!selectedSheetId && data.length > 0) {
        setSelectedSheetId(data[0].id)
      }
    } catch (err) {
      setSheetsError(err instanceof Error ? err.message : 'Failed to load sheets')
    } finally {
      setSheetsLoading(false)
    }
  }, [sidecarPort, projectId, projectPath, selectedSheetId])

  useEffect(() => {
    loadSheets()
  }, [loadSheets])

  const handleAcceptCandidate = async (candidate: TextSearchCandidate) => {
    if (!selectedSheetId) return
    setReviewLoading(true)
    try {
      // Create a single item (count type) at the center of the bbox
      const cx = candidate.bbox[0] + candidate.bbox[2] / 2
      const cy = candidate.bbox[1] + candidate.bbox[3] / 2
      
      const params = new URLSearchParams({ project_path: projectPath })
      const res = await fetch(`http://127.0.0.1:${sidecarPort}/projects/${projectId}/sheets/${candidate.sheet_id}/takeoff-items?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'count',
          source: 'text_search',
          geometry: {
            kind: 'point',
            points: [{ x: cx, y: cy }],
            scale: 1,
            scale_unit: 'ft'
          }
        })
      })
      if (res.ok) {
        setSearchCandidates(prev => prev.filter(c => c !== candidate))
      }
    } finally {
      setReviewLoading(false)
    }
  }

  const handleRejectCandidate = (candidate: TextSearchCandidate) => {
    setSearchCandidates(prev => prev.filter(c => c !== candidate))
  }

  const handleAcceptAll = async () => {
    if (!selectedSheetId || searchCandidates.length === 0) return
    setReviewLoading(true)
    try {
      const currentSheetCandidates = searchCandidates.filter(c => c.sheet_id === selectedSheetId)
      
      if (currentSheetCandidates.length === 0) return

      const items = currentSheetCandidates.map(c => {
        const cx = c.bbox[0] + c.bbox[2] / 2
        const cy = c.bbox[1] + c.bbox[3] / 2
        return {
          type: 'count',
          source: 'text_search',
          geometry: {
            kind: 'point',
            points: [{ x: cx, y: cy }],
            scale: 1,
            scale_unit: 'ft'
          }
        }
      })

      const params = new URLSearchParams({ project_path: projectPath })
      const res = await fetch(`http://127.0.0.1:${sidecarPort}/projects/${projectId}/sheets/${selectedSheetId}/takeoff-items/bulk?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      })

      if (res.ok) {
        setSearchCandidates(prev => prev.filter(c => c.sheet_id !== selectedSheetId))
      }
    } finally {
      setReviewLoading(false)
    }
  }

  const selectedSheet = sheets.find((s) => s.id === selectedSheetId) ?? null

  return (
    <div
      className="flex h-screen bg-white"
      data-testid="workspace"
    >
      {/* Left: Sheets sidebar */}
      <div className="w-56 flex-shrink-0">
        <SheetsSidebar
          sheets={sheets}
          selectedSheetId={selectedSheetId}
          onSelectSheet={setSelectedSheetId}
          loading={sheetsLoading}
        />
      </div>

      {/* Left: Tools sidebar */}
      <div className="w-40 flex-shrink-0">
        <ToolsSidebar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
        />
      </div>

      {/* Center: Sheet viewer */}
      <div className="flex-1 min-w-0 relative">
        <SheetViewer
          projectId={projectId}
          sheet={selectedSheet}
          loading={sheetsLoading}
          error={sheetsError}
          sidecarPort={sidecarPort}
          projectPath={projectPath}
          onCandidatesChange={setSearchCandidates}
        />
        
        {/* Review Candidates Panel Overlay */}
        {searchCandidates.length > 0 && (
          <div className="absolute top-0 right-0 w-80 h-full z-20 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)]">
            <CandidateReview 
              candidates={searchCandidates}
              onAccept={handleAcceptCandidate}
              onReject={handleRejectCandidate}
              onAcceptAll={handleAcceptAll}
              disabled={reviewLoading}
            />
          </div>
        )}
      </div>

      {/* Right: Copilot, quantity table, and export controls */}
      <div className="flex w-96 flex-shrink-0 flex-col border-l border-slate-200">
        <div className="min-h-0 flex-1">
          <ChatPanel
            projectId={projectId}
            projectPath={projectPath}
            sidecarPort={sidecarPort}
            onSelectSheet={setSelectedSheetId}
          />
        </div>
        <div className="h-1/2 min-h-0">
          <QuantityTable
            items={takeoffItems}
            projectId={projectId}
            projectPath={projectPath}
            sidecarPort={sidecarPort}
            sheetId={selectedSheetId}
          />
        </div>
      </div>
    </div>
  )
}

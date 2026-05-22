/**
 * Main workspace layout for PDF viewing with sidebars.
 */

// biome-ignore assist/source/organizeImports: Existing import order follows project ESLint conventions.
import type { SheetSummary } from '../Library/types'
import type { TakeoffItem, ToolType, WorkspaceProps } from './types'
import { useCallback, useEffect, useState, useRef } from 'react'
import { ChatPanel } from '../Copilot/ChatPanel'
import { fetchSheets } from '../Library/api'
import { QuantityTable } from '../Takeoff/QuantityTable'
import { SheetViewer } from './SheetViewer'
import { SheetsSidebar } from './SheetsSidebar'
import { ToolsSidebar } from './ToolsSidebar'
import { DragDropZone } from './DragDropZone'
import { CandidateReview } from '../Search/CandidateReview'
import type { TextSearchCandidate } from '../Search/TextSearchTool'

export function Workspace({ projectId, projectPath, sidecarPort, initialSheetId }: WorkspaceProps) {
  const [sheets, setSheets] = useState<SheetSummary[]>([])
  const [sheetsLoading, setSheetsLoading] = useState(true)
  const [sheetsError, setSheetsError] = useState<string | null>(null)
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(initialSheetId ?? null)
  const [activeTool, setActiveTool] = useState<ToolType>('select')
  const [takeoffItems, setTakeoffItems] = useState<TakeoffItem[]>([])
  const [searchCandidates, setSearchCandidates] = useState<TextSearchCandidate[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const buildTakeoffItemsUrl = useCallback((sheetId: string) => {
    const params = new URLSearchParams({ project_path: projectPath })
    return `http://127.0.0.1:${sidecarPort}/projects/${projectId}/sheets/${sheetId}/takeoff-items?${params}`
  }, [sidecarPort, projectId, projectPath])

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

  const loadTakeoffItems = useCallback(async (sheetId: string | null) => {
    if (!sheetId) {
      setTakeoffItems([])
      return
    }

    const res = await fetch(buildTakeoffItemsUrl(sheetId))
    if (!res.ok) {
      throw new Error(`Failed to load takeoff items: ${res.status}`)
    }
    setTakeoffItems(await res.json() as TakeoffItem[])
  }, [buildTakeoffItemsUrl])

  useEffect(() => {
    void loadTakeoffItems(selectedSheetId).catch(() => setTakeoffItems([]))
  }, [loadTakeoffItems, selectedSheetId])

  const handleDrawingComplete = useCallback(async (points: Array<{ x: number; y: number }>, tool: ToolType) => {
    if (!selectedSheetId) return

    const typeByTool: Partial<Record<ToolType, TakeoffItem['type']>> = {
      'measure-length': 'linear',
      'measure-area': 'area',
      count: 'count',
    }
    const kindByTool: Partial<Record<ToolType, 'path' | 'polygon' | 'point'>> = {
      'measure-length': 'path',
      'measure-area': 'polygon',
      count: 'point',
    }
    const type = typeByTool[tool]
    const kind = kindByTool[tool]
    if (!type || !kind) return

    const res = await fetch(buildTakeoffItemsUrl(selectedSheetId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        source: 'manual',
        geometry: {
          kind,
          points,
          scale: 1,
          scale_unit: 'ft'
        }
      })
    })
    if (!res.ok) {
      throw new Error(`Failed to create takeoff item: ${res.status}`)
    }
    await loadTakeoffItems(selectedSheetId)
  }, [buildTakeoffItemsUrl, loadTakeoffItems, selectedSheetId])

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
        await loadTakeoffItems(selectedSheetId)
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
        await loadTakeoffItems(selectedSheetId)
      }
    } finally {
      setReviewLoading(false)
    }
  }

  const handleUploadPdf = async (file: File) => {
    setIsUploading(true)
    setSheetsError(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const params = new URLSearchParams({ project_path: projectPath })
      const res = await fetch(`http://127.0.0.1:${sidecarPort}/projects/${projectId}/documents?${params}`, {
        method: 'POST',
        body: formData,
      })
      
      if (!res.ok) {
        throw new Error(`Upload failed: ${res.statusText}`)
      }
      
      await loadSheets()
    } catch (err) {
      setSheetsError(err instanceof Error ? err.message : 'Failed to upload PDF')
    } finally {
      setIsUploading(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
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
          onUploadPdf={handleUploadClick}
        />
        <input
          type="file"
          accept=".pdf"
          className="hidden"
          ref={fileInputRef}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleUploadPdf(file)
            if (e.target) e.target.value = ''
          }}
          disabled={isUploading}
        />
      </div>

      {/* Left: Tools sidebar */}
      <div className="w-40 flex-shrink-0">
        <ToolsSidebar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
        />
      </div>

      {/* Center: Sheet viewer or Drop Zone */}
      <div className="flex-1 min-w-0 relative flex flex-col">
        {!sheetsLoading && sheets.length === 0 ? (
          <DragDropZone onUploadPdf={handleUploadPdf} isUploading={isUploading} />
        ) : (
          <>
            <SheetViewer
              projectId={projectId}
              sheet={selectedSheet}
              loading={sheetsLoading}
              error={sheetsError}
              sidecarPort={sidecarPort}
              projectPath={projectPath}
              activeTool={activeTool}
              onDrawingComplete={handleDrawingComplete}
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
          </>
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

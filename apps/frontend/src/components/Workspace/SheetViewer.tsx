/**
 * Main PDF sheet viewer with zoom/pan support.
 */

// biome-ignore assist/source/organizeImports: Existing import order keeps React first, then hooks, then local components.
import { useRef, useState } from 'react'
import { useHistory } from '../../hooks/useHistory'
import { useViewer } from '../../hooks/useViewer'
import { TextSearchTool, type TextSearchCandidate } from '../Search/TextSearchTool'
import { Overlay } from './Overlay'
import { normalizeVisualSearchBox, searchVisualRegion, type VisualSearchBox, type VisualSearchCandidate } from './VisualSearchTool'
import type { SheetViewerProps } from './types'

interface Point {
  x: number
  y: number
}

export function SheetViewer({ projectId, sheet, loading, error, sidecarPort, projectPath, onCandidatesChange }: SheetViewerProps) {
  const viewer = useViewer({
    minZoom: 0.1,
    maxZoom: 10,
    zoomSensitivity: 0.002,
  })

  const drawingHistory = useHistory<Point[]>([], { limit: 20 })
  const points = drawingHistory.value
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [dragStart, setDragStart] = useState<Point | null>(null)
  const [selection, setSelection] = useState<VisualSearchBox | null>(null)
  const [candidates, setCandidates] = useState<VisualSearchCandidate[]>([])
  const [textCandidates, setTextCandidates] = useState<TextSearchCandidate[]>([])
  
  const handleTextCandidatesChange = (newCandidates: TextSearchCandidate[]) => {
    setTextCandidates(newCandidates)
    onCandidatesChange?.(newCandidates)
  }
  const [visualSearchStatus, setVisualSearchStatus] = useState<string>('Draw search box')

  // Build full-res image URL if available
  const imageUrl = sheet?.thumbnail_url
    ? `http://127.0.0.1:${sidecarPort}/projects/${projectId}/sheets/${sheet.id}/image?project_path=${encodeURIComponent(projectPath)}`
    : null

  const getImagePoint = (clientX: number, clientY: number): Point | null => {
    const image = imageRef.current
    if (!image) {
      return null
    }
    const rect = image.getBoundingClientRect()
    const scaleX = image.naturalWidth / rect.width
    const scaleY = image.naturalHeight / rect.height
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  const runVisualSearch = async (bbox: VisualSearchBox) => {
    if (!sheet) {
      return
    }
    setVisualSearchStatus('Searching...')
    try {
      const result = await searchVisualRegion({
        sidecarPort,
        projectId,
        projectPath,
        sheetId: sheet.id,
        bbox,
      })
      setCandidates(result.candidates)
      setVisualSearchStatus(`${result.candidates.length} candidates`)
    } catch (err) {
      setCandidates([])
      setVisualSearchStatus(err instanceof Error ? err.message : 'Visual search failed')
    }
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-full bg-slate-100"
        data-testid="sheet-viewer-loading"
      >
        <div className="text-slate-500">Loading sheet...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="flex items-center justify-center h-full bg-slate-100"
        data-testid="sheet-viewer-error"
      >
        <div className="text-red-500 text-center p-4">
          <p className="font-medium">Failed to load sheet</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (!sheet) {
    return (
      <div
        className="flex items-center justify-center h-full bg-slate-100"
        data-testid="sheet-viewer-empty"
      >
        <div className="text-slate-400 text-center">
          <p className="text-lg">No sheet selected</p>
          <p className="text-sm mt-1">Select a sheet from the sidebar to view</p>
        </div>
      </div>
    )
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Viewer container needs mouse/wheel events for pan/zoom
    <div
      className="relative h-full overflow-hidden bg-slate-200"
      data-testid="sheet-viewer"
      onWheel={viewer.handleWheel}
      onMouseDown={viewer.handleMouseDown}
      onMouseMove={viewer.handleMouseMove}
      onMouseUp={viewer.handleMouseUp}
      onMouseLeave={viewer.handleMouseLeave}
      style={{ cursor: viewer.isPanning ? 'grabbing' : 'grab' }}
    >
      {/* Zoom controls overlay */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => viewer.setZoom(viewer.viewport.zoom * 1.2)}
          className="px-3 py-1.5 bg-white rounded shadow text-sm hover:bg-slate-50"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => viewer.setZoom(viewer.viewport.zoom / 1.2)}
          className="px-3 py-1.5 bg-white rounded shadow text-sm hover:bg-slate-50"
          title="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={viewer.resetViewport}
          className="px-3 py-1.5 bg-white rounded shadow text-sm hover:bg-slate-50"
          title="Reset view"
        >
          {Math.round(viewer.viewport.zoom * 100)}%
        </button>
      </div>

      {/* Drawing history controls */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          type="button"
          onClick={drawingHistory.undo}
          disabled={!drawingHistory.canUndo}
          className="px-3 py-1.5 bg-white rounded shadow text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Undo drawing point"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={drawingHistory.redo}
          disabled={!drawingHistory.canRedo}
          className="px-3 py-1.5 bg-white rounded shadow text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Redo drawing point"
        >
          Redo
        </button>
      </div>

      <div className="absolute bottom-4 right-4 z-10 rounded bg-white px-3 py-1.5 text-sm shadow">
        Visual search: {visualSearchStatus}
      </div>

      <TextSearchTool
        projectId={projectId}
        projectPath={projectPath}
        sidecarPort={sidecarPort}
        currentSheetId={sheet.id}
        onCandidatesChange={handleTextCandidatesChange}
      />

      {/* Sheet image container */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Image container needs pointer events for region selection */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: viewer.transform, transformOrigin: 'center' }}
        onMouseDown={(e) => {
          const point = getImagePoint(e.clientX, e.clientY)
          if (point) {
            setDragStart(point)
            setSelection(null)
          }
        }}
        onMouseMove={(e) => {
          if (!dragStart) {
            return
          }
          const point = getImagePoint(e.clientX, e.clientY)
          if (point) {
            setSelection(normalizeVisualSearchBox(dragStart.x, dragStart.y, point.x, point.y))
          }
        }}
        onMouseUp={(e) => {
          if (!dragStart) {
            return
          }
          const point = getImagePoint(e.clientX, e.clientY)
          setDragStart(null)
          if (!point) {
            return
          }
          const bbox = normalizeVisualSearchBox(dragStart.x, dragStart.y, point.x, point.y)
          setSelection(bbox)
          if (bbox.x1 - bbox.x0 >= 4 && bbox.y1 - bbox.y0 >= 4) {
            void runVisualSearch(bbox)
          }
        }}
      >
        {imageUrl ? (
          <>
            <img
              ref={imageRef}
              src={imageUrl}
              alt={`Sheet ${sheet.sheet_number}`}
              className="max-w-none shadow-lg"
              draggable={false}
              data-testid="sheet-image"
            />
            <Overlay
              width={2000}
              height={2000}
              zoom={1}
              offsetX={0}
              offsetY={0}
            >
              {points.map((point) => (
                <circle
                  key={`point-${point.x}-${point.y}`}
                  cx={point.x}
                  cy={point.y}
                  r={5}
                  fill="red"
                />
              ))}
              {selection ? (
                <rect
                  x={selection.x0}
                  y={selection.y0}
                  width={selection.x1 - selection.x0}
                  height={selection.y1 - selection.y0}
                  fill="rgba(59, 130, 246, 0.15)"
                  stroke="rgb(37, 99, 235)"
                  strokeWidth={3}
                />
              ) : null}
              {candidates.map((candidate) => (
                <rect
                  key={`${candidate.bbox.join('-')}-${candidate.score}`}
                  x={candidate.bbox[0]}
                  y={candidate.bbox[1]}
                  width={candidate.bbox[2] - candidate.bbox[0]}
                  height={candidate.bbox[3] - candidate.bbox[1]}
                  fill="rgba(34, 197, 94, 0.12)"
                  stroke="rgb(22, 163, 74)"
                  strokeWidth={3}
                />
              ))}
              {textCandidates
                .filter((candidate) => candidate.sheet_id === sheet.id)
                .map((candidate) => (
                  <rect
                    key={`${candidate.sheet_id}-${candidate.page_index}-${candidate.bbox.join('-')}`}
                    x={candidate.bbox[0]}
                    y={candidate.bbox[1]}
                    width={candidate.bbox[2] - candidate.bbox[0]}
                    height={candidate.bbox[3] - candidate.bbox[1]}
                    fill="rgba(250, 204, 21, 0.28)"
                    stroke="rgb(202, 138, 4)"
                    strokeWidth={2}
                    data-testid="text-search-candidate"
                  />
                ))}
            </Overlay>
          </>
        ) : (
          <div className="bg-white p-8 shadow-lg text-center">
            <p className="text-slate-400">No preview available</p>
            <p className="text-sm text-slate-400 mt-1">{sheet.sheet_number}</p>
          </div>
        )}
      </div>
    </div>
  )
}

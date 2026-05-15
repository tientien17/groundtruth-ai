/**
 * Hook for managing PDF viewer zoom/pan/viewport state.
 * Provides transform state and handlers for mouse wheel zoom and drag pan.
 */

import { useCallback, useRef, useState } from 'react'

export interface ViewportState {
  /** Current zoom level (1.0 = 100%) */
  zoom: number
  /** X offset in pixels */
  panX: number
  /** Y offset in pixels */
  panY: number
}

export interface UseViewerOptions {
  /** Minimum zoom level (default: 0.1 = 10%) */
  minZoom?: number
  /** Maximum zoom level (default: 5.0 = 500%) */
  maxZoom?: number
  /** Zoom sensitivity for mouse wheel (default: 0.001) */
  zoomSensitivity?: number
  /** Initial zoom level (default: 1.0) */
  initialZoom?: number
}

export interface UseViewerReturn {
  /** Current viewport state */
  viewport: ViewportState
  /** Set zoom level directly (clamped to min/max) */
  setZoom: (zoom: number) => void
  /** Reset viewport to initial state */
  resetViewport: () => void
  /** Handle mouse wheel for zooming */
  handleWheel: (event: React.WheelEvent) => void
  /** Handle mouse down for panning start */
  handleMouseDown: (event: React.MouseEvent) => void
  /** Handle mouse move for panning */
  handleMouseMove: (event: React.MouseEvent) => void
  /** Handle mouse up for panning end */
  handleMouseUp: () => void
  /** Handle mouse leave for panning end */
  handleMouseLeave: () => void
  /** Whether currently panning */
  isPanning: boolean
  /** CSS transform string for the viewer content */
  transform: string
}

const DEFAULT_OPTIONS: Required<UseViewerOptions> = {
  minZoom: 0.1,
  maxZoom: 5.0,
  zoomSensitivity: 0.001,
  initialZoom: 1.0,
}

export function useViewer(options: UseViewerOptions = {}): UseViewerReturn {
  const {
    minZoom,
    maxZoom,
    zoomSensitivity,
    initialZoom,
  } = { ...DEFAULT_OPTIONS, ...options }

  const [viewport, setViewport] = useState<ViewportState>({
    zoom: initialZoom,
    panX: 0,
    panY: 0,
  })

  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  const setZoom = useCallback((newZoom: number) => {
    const clampedZoom = Math.min(maxZoom, Math.max(minZoom, newZoom))
    setViewport((prev) => ({ ...prev, zoom: clampedZoom }))
  }, [minZoom, maxZoom])

  const resetViewport = useCallback(() => {
    setViewport({ zoom: initialZoom, panX: 0, panY: 0 })
  }, [initialZoom])

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault()
    const delta = -event.deltaY * zoomSensitivity
    setViewport((prev) => {
      const newZoom = Math.min(maxZoom, Math.max(minZoom, prev.zoom + delta))
      // Zoom toward cursor position
      const rect = (event.target as HTMLElement).getBoundingClientRect()
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top
      const zoomRatio = newZoom / prev.zoom
      return {
        zoom: newZoom,
        panX: mouseX - (mouseX - prev.panX) * zoomRatio,
        panY: mouseY - (mouseY - prev.panY) * zoomRatio,
      }
    })
  }, [minZoom, maxZoom, zoomSensitivity])

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return // Only left click
    setIsPanning(true)
    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: viewport.panX,
      panY: viewport.panY,
    }
  }, [viewport.panX, viewport.panY])

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isPanning || !panStartRef.current) return
    const deltaX = event.clientX - panStartRef.current.x
    const deltaY = event.clientY - panStartRef.current.y
    const { panX: startPanX, panY: startPanY } = panStartRef.current
    setViewport((prev) => ({
      ...prev,
      panX: startPanX + deltaX,
      panY: startPanY + deltaY,
    }))
  }, [isPanning])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
    panStartRef.current = null
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false)
    panStartRef.current = null
  }, [])

  const transform = `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`

  return {
    viewport,
    setZoom,
    resetViewport,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    isPanning,
    transform,
  }
}

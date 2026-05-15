/**
 * Tests for useViewer hook.
 */

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useViewer } from './useViewer'

describe('useViewer', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useViewer())

    expect(result.current.viewport.zoom).toBe(1.0)
    expect(result.current.viewport.panX).toBe(0)
    expect(result.current.viewport.panY).toBe(0)
    expect(result.current.isPanning).toBe(false)
    expect(result.current.transform).toBe('translate(0px, 0px) scale(1)')
  })

  it('should initialize with custom values', () => {
    const { result } = renderHook(() =>
      useViewer({ initialZoom: 2.0, minZoom: 0.5, maxZoom: 3.0 })
    )

    expect(result.current.viewport.zoom).toBe(2.0)
  })

  it('should set zoom within bounds', () => {
    const { result } = renderHook(() => useViewer({ minZoom: 0.5, maxZoom: 3.0 }))

    act(() => {
      result.current.setZoom(2.5)
    })
    expect(result.current.viewport.zoom).toBe(2.5)

    act(() => {
      result.current.setZoom(5.0)
    })
    expect(result.current.viewport.zoom).toBe(3.0) // Clamped to max

    act(() => {
      result.current.setZoom(0.1)
    })
    expect(result.current.viewport.zoom).toBe(0.5) // Clamped to min
  })

  it('should reset viewport', () => {
    const { result } = renderHook(() => useViewer())

    act(() => {
      result.current.setZoom(2.5)
    })

    act(() => {
      result.current.resetViewport()
    })

    expect(result.current.viewport.zoom).toBe(1.0)
    expect(result.current.viewport.panX).toBe(0)
    expect(result.current.viewport.panY).toBe(0)
  })

  it('should update transform string', () => {
    const { result } = renderHook(() => useViewer())

    act(() => {
      result.current.setZoom(2.0)
    })

    expect(result.current.transform).toBe('translate(0px, 0px) scale(2)')
  })

  it('should handle wheel events for zooming', () => {
    const { result } = renderHook(() => useViewer())

    const mockEvent = {
      deltaY: -100,
      preventDefault: () => {},
      clientX: 100,
      clientY: 100,
      target: {
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
      },
    } as unknown as React.WheelEvent

    act(() => {
      result.current.handleWheel(mockEvent)
    })

    expect(result.current.viewport.zoom).toBeGreaterThan(1.0)
  })

  it('should handle pan mouse events', () => {
    const { result } = renderHook(() => useViewer())

    const mockMouseDown = {
      button: 0,
      clientX: 100,
      clientY: 100,
    } as React.MouseEvent

    const mockMouseMove = {
      clientX: 150,
      clientY: 120,
    } as React.MouseEvent

    act(() => {
      result.current.handleMouseDown(mockMouseDown)
    })

    expect(result.current.isPanning).toBe(true)

    act(() => {
      result.current.handleMouseMove(mockMouseMove)
    })

    expect(result.current.viewport.panX).toBe(50)
    expect(result.current.viewport.panY).toBe(20)

    act(() => {
      result.current.handleMouseUp()
    })

    expect(result.current.isPanning).toBe(false)
  })

  it('should stop panning on mouse leave', () => {
    const { result } = renderHook(() => useViewer())

    const mockMouseDown = {
      button: 0,
      clientX: 100,
      clientY: 100,
    } as React.MouseEvent

    act(() => {
      result.current.handleMouseDown(mockMouseDown)
    })

    expect(result.current.isPanning).toBe(true)

    act(() => {
      result.current.handleMouseLeave()
    })

    expect(result.current.isPanning).toBe(false)
  })
})

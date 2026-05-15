import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useScale } from './useScale'

type ScaleApi = ReturnType<typeof useScale>

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

function HookProbe({
  projectId,
  sheetId,
  storage,
  onReady,
}: {
  projectId: string
  sheetId?: string
  storage: Storage
  onReady: (api: ScaleApi) => void
}) {
  const api = useScale({ projectId, sheetId, storage, now: () => '2026-05-15T00:00:00.000Z' })

  useEffect(() => {
    onReady(api)
  }, [api, onReady])

  return null
}

function renderHookProbe(projectId: string, sheetId: string | undefined, storage: Storage) {
  let api: ScaleApi | null = null
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  root.render(
    <HookProbe
      projectId={projectId}
      sheetId={sheetId}
      storage={storage}
      onReady={(nextApi) => {
        api = nextApi
      }}
    />,
  )

  return {
    root,
    get api() {
      if (!api) throw new Error('Hook API not ready')
      return api
    },
  }
}

describe('useScale', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('calibrates from PDF points and persists per sheet', async () => {
    const storage = new MemoryStorage()
    const probe = renderHookProbe('project-1', 'sheet-1', storage)

    await vi.waitFor(() => expect(probe.api.isCalibrated).toBe(false))

    const calibration = probe.api.calibrateFromPdfPoints({
      pdfStart: { x: 10, y: 10 },
      pdfEnd: { x: 110, y: 10 },
      knownDistance: '50 ft',
    })

    expect(calibration.sheetId).toBe('sheet-1')
    await vi.waitFor(() => expect(probe.api.isCalibrated).toBe(true))
    expect(probe.api.getPdfDistance({ x: 10, y: 10 }, { x: 60, y: 10 })).toEqual({
      value: 25,
      unit: 'ft',
    })

    probe.root.unmount()

    const secondProbe = renderHookProbe('project-1', 'sheet-1', storage)
    await vi.waitFor(() => expect(secondProbe.api.source).toBe('sheet'))
    expect(secondProbe.api.calibration?.pointsPerUnit).toBe(2)
  })

  it('falls back to project default scale when a sheet scale is absent', async () => {
    const storage = new MemoryStorage()
    const projectProbe = renderHookProbe('project-1', undefined, storage)

    await vi.waitFor(() => expect(projectProbe.api.isCalibrated).toBe(false))
    projectProbe.api.calibrateFromPdfPoints({
      pdfStart: { x: 0, y: 0 },
      pdfEnd: { x: 72, y: 0 },
      knownDistance: { value: 1, unit: 'm' },
      scope: 'project',
    })

    const sheetProbe = renderHookProbe('project-1', 'sheet-2', storage)
    await vi.waitFor(() => expect(sheetProbe.api.source).toBe('project'))
    expect(sheetProbe.api.getPdfDistance({ x: 0, y: 0 }, { x: 72, y: 0 })).toEqual({
      value: 1,
      unit: 'm',
    })
  })

  it('calibrates from high-DPI viewport points', async () => {
    const storage = new MemoryStorage()
    const probe = renderHookProbe('project-1', 'sheet-3', storage)

    await vi.waitFor(() => expect(probe.api.isCalibrated).toBe(false))

    const transform = {
      pdfWidthPoints: 600,
      pdfHeightPoints: 800,
      viewportWidthCssPixels: 1200,
      viewportHeightCssPixels: 1600,
      devicePixelRatio: 2,
    }

    probe.api.calibrateFromViewportPoints({
      viewportStart: { x: 200, y: 200 },
      viewportEnd: { x: 600, y: 200 },
      transform,
      coordinateSpace: 'device-pixels',
      knownDistance: '10 m',
    })

    await vi.waitFor(() => expect(probe.api.isCalibrated).toBe(true))
    expect(probe.api.calibration?.source.pdfStart).toEqual({ x: 50, y: 750 })
    expect(probe.api.calibration?.source.pdfEnd).toEqual({ x: 150, y: 750 })
  })
})

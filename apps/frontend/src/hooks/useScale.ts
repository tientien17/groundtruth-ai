import type {
  KnownDistanceInput,
  LinearUnit,
  PdfPoint,
  ScaleCalibration,
  ScaleDistance,
  ViewportCoordinateSpace,
  ViewportPoint,
  ViewportToPdfTransform,
  WorldPoint,
} from '@groundtruth/shared/geometry'
import {
  createScaleCalibration,
  createScaleCalibrationFromViewportPoints,
  measurePdfDistance,
  measureViewportDistance,
  pdfToWorldPoint,
  viewportToPdfPoint,
  viewportToWorldPoint,
} from '@groundtruth/shared/geometry'
import { useCallback, useEffect, useMemo, useState } from 'react'

type ScaleScope = 'sheet' | 'project'

type UseScaleOptions = {
  projectId: string
  sheetId?: string
  storage?: Storage
  now?: () => string
}

type ScaleState = {
  calibration: ScaleCalibration | null
  source: ScaleScope | null
}

type CalibrateFromPdfInput = {
  pdfStart: PdfPoint
  pdfEnd: PdfPoint
  knownDistance: KnownDistanceInput
  scope?: ScaleScope
}

type CalibrateFromViewportInput = {
  viewportStart: ViewportPoint
  viewportEnd: ViewportPoint
  transform: ViewportToPdfTransform
  knownDistance: KnownDistanceInput
  coordinateSpace?: ViewportCoordinateSpace
  scope?: ScaleScope
}

const STORAGE_PREFIX = 'groundtruth:scale'

export function useScale({ projectId, sheetId, storage, now = defaultNow }: UseScaleOptions) {
  const resolvedStorage = useMemo(() => storage ?? getBrowserStorage(), [storage])

  const [state, setState] = useState<ScaleState>(() => loadScale(projectId, sheetId, resolvedStorage))

  useEffect(() => {
    setState(loadScale(projectId, sheetId, resolvedStorage))
  }, [projectId, sheetId, resolvedStorage])

  const saveCalibration = useCallback(
    (calibration: ScaleCalibration, scope: ScaleScope) => {
      if (!resolvedStorage) return
      resolvedStorage.setItem(storageKey(projectId, scope === 'sheet' ? sheetId : undefined), JSON.stringify(calibration))
    },
    [projectId, resolvedStorage, sheetId],
  )

  const calibrateFromPdfPoints = useCallback(
    ({ pdfStart, pdfEnd, knownDistance, scope = sheetId ? 'sheet' : 'project' }: CalibrateFromPdfInput) => {
      const timestamp = now()
      const calibration = createScaleCalibration({
        projectId,
        sheetId: scope === 'sheet' ? sheetId : undefined,
        pdfStart,
        pdfEnd,
        knownDistance,
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      saveCalibration(calibration, scope)
      setState({ calibration, source: scope })
      return calibration
    },
    [now, projectId, saveCalibration, sheetId],
  )

  const calibrateFromViewportPoints = useCallback(
    ({
      viewportStart,
      viewportEnd,
      transform,
      knownDistance,
      coordinateSpace,
      scope = sheetId ? 'sheet' : 'project',
    }: CalibrateFromViewportInput) => {
      const timestamp = now()
      const calibration = createScaleCalibrationFromViewportPoints({
        projectId,
        sheetId: scope === 'sheet' ? sheetId : undefined,
        viewportStart,
        viewportEnd,
        transform,
        coordinateSpace,
        knownDistance,
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      saveCalibration(calibration, scope)
      setState({ calibration, source: scope })
      return calibration
    },
    [now, projectId, saveCalibration, sheetId],
  )

  const clearScale = useCallback(
    (scope: ScaleScope = sheetId ? 'sheet' : 'project') => {
      if (resolvedStorage) resolvedStorage.removeItem(storageKey(projectId, scope === 'sheet' ? sheetId : undefined))
      setState(loadScale(projectId, sheetId, resolvedStorage))
    },
    [projectId, resolvedStorage, sheetId],
  )

  const requireCalibration = useCallback(() => {
    if (!state.calibration) throw new Error('Scale has not been calibrated')
    return state.calibration
  }, [state.calibration])

  const getPdfDistance = useCallback(
    (start: PdfPoint, end: PdfPoint, outputUnit?: LinearUnit): ScaleDistance => {
      return measurePdfDistance(start, end, requireCalibration(), outputUnit)
    },
    [requireCalibration],
  )

  const getViewportDistance = useCallback(
    (
      start: ViewportPoint,
      end: ViewportPoint,
      transform: ViewportToPdfTransform,
      outputUnit?: LinearUnit,
      coordinateSpace?: ViewportCoordinateSpace,
    ): ScaleDistance => {
      return measureViewportDistance(start, end, transform, requireCalibration(), outputUnit, coordinateSpace)
    },
    [requireCalibration],
  )

  const toPdfPoint = useCallback(
    (
      point: ViewportPoint,
      transform: ViewportToPdfTransform,
      coordinateSpace?: ViewportCoordinateSpace,
    ): PdfPoint => viewportToPdfPoint(point, transform, coordinateSpace),
    [],
  )

  const toWorldPoint = useCallback(
    (point: PdfPoint, outputUnit?: LinearUnit): WorldPoint => {
      return pdfToWorldPoint(point, requireCalibration(), outputUnit)
    },
    [requireCalibration],
  )

  const viewportPointToWorld = useCallback(
    (
      point: ViewportPoint,
      transform: ViewportToPdfTransform,
      outputUnit?: LinearUnit,
      coordinateSpace?: ViewportCoordinateSpace,
    ): WorldPoint => {
      return viewportToWorldPoint(point, transform, requireCalibration(), outputUnit, coordinateSpace)
    },
    [requireCalibration],
  )

  return {
    calibration: state.calibration,
    source: state.source,
    isCalibrated: state.calibration !== null,
    calibrateFromPdfPoints,
    calibrateFromViewportPoints,
    clearScale,
    getPdfDistance,
    getViewportDistance,
    toPdfPoint,
    toWorldPoint,
    viewportPointToWorld,
  }
}

function loadScale(projectId: string, sheetId: string | undefined, storage: Storage | null): ScaleState {
  if (!storage) return { calibration: null, source: null }

  if (sheetId) {
    const sheetScale = readScale(storage, storageKey(projectId, sheetId))
    if (sheetScale) return { calibration: sheetScale, source: 'sheet' }
  }

  const projectScale = readScale(storage, storageKey(projectId))
  if (projectScale) return { calibration: projectScale, source: 'project' }

  return { calibration: null, source: null }
}

function readScale(storage: Storage, key: string): ScaleCalibration | null {
  const raw = storage.getItem(key)
  if (!raw) return null

  try {
    return JSON.parse(raw) as ScaleCalibration
  } catch {
    storage.removeItem(key)
    return null
  }
}

function storageKey(projectId: string, sheetId?: string): string {
  return sheetId
    ? `${STORAGE_PREFIX}:project:${projectId}:sheet:${sheetId}`
    : `${STORAGE_PREFIX}:project:${projectId}:default`
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function defaultNow(): string {
  return new Date().toISOString()
}

export type LinearUnit = 'ft' | 'in' | 'm' | 'cm' | 'mm'

export type Point2D = {
  x: number
  y: number
}

export type ViewportPoint = Point2D
export type PdfPoint = Point2D

export type WorldPoint = Point2D & {
  unit: LinearUnit
}

export type ScaleDistance = {
  value: number
  unit: LinearUnit
}

export type KnownDistanceInput = ScaleDistance | string

export type ViewportCoordinateSpace = 'css-pixels' | 'device-pixels'

export type ViewportToPdfTransform = {
  pdfWidthPoints: number
  pdfHeightPoints: number
  viewportWidthCssPixels: number
  viewportHeightCssPixels: number
  devicePixelRatio?: number
}

export type ScaleCalibrationSource = {
  pdfStart: PdfPoint
  pdfEnd: PdfPoint
}

export type ScaleCalibration = {
  id?: string
  projectId?: string
  sheetId?: string
  source: ScaleCalibrationSource
  knownDistance: ScaleDistance
  pdfDistancePoints: number
  pointsPerUnit: number
  createdAt?: string
  updatedAt?: string
}

export type CreateScaleCalibrationInput = {
  id?: string
  projectId?: string
  sheetId?: string
  pdfStart: PdfPoint
  pdfEnd: PdfPoint
  knownDistance: KnownDistanceInput
  createdAt?: string
  updatedAt?: string
}

export type CreateViewportScaleCalibrationInput = Omit<
  CreateScaleCalibrationInput,
  'pdfStart' | 'pdfEnd'
> & {
  viewportStart: ViewportPoint
  viewportEnd: ViewportPoint
  transform: ViewportToPdfTransform
  coordinateSpace?: ViewportCoordinateSpace
}

const METERS_PER_UNIT: Record<LinearUnit, number> = {
  ft: 0.3048,
  in: 0.0254,
  m: 1,
  cm: 0.01,
  mm: 0.001,
}

const UNIT_ALIASES: Record<string, LinearUnit> = {
  ft: 'ft',
  foot: 'ft',
  feet: 'ft',
  "'": 'ft',
  in: 'in',
  inch: 'in',
  inches: 'in',
  '"': 'in',
  m: 'm',
  meter: 'm',
  meters: 'm',
  metre: 'm',
  metres: 'm',
  cm: 'cm',
  centimeter: 'cm',
  centimeters: 'cm',
  centimetre: 'cm',
  centimetres: 'cm',
  mm: 'mm',
  millimeter: 'mm',
  millimeters: 'mm',
  millimetre: 'mm',
  millimetres: 'mm',
}

export function normalizeUnit(unit: string): LinearUnit {
  const normalized = UNIT_ALIASES[unit.trim().toLowerCase()]
  if (!normalized) throw new Error(`Unsupported unit: ${unit}`)
  return normalized
}

export function parseDistance(input: string): ScaleDistance {
  const match = input.trim().match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*([a-zA-Z"']+)$/)
  if (!match) throw new Error(`Invalid distance: ${input}`)

  const value = Number(match[1])
  assertPositiveNumber(value, 'Distance')

  return {
    value,
    unit: normalizeUnit(match[2]),
  }
}

export function convertDistance(value: number, from: LinearUnit, to: LinearUnit): number {
  assertFiniteNumber(value, 'Distance')
  return (value * METERS_PER_UNIT[from]) / METERS_PER_UNIT[to]
}

export function resolveKnownDistance(input: KnownDistanceInput): ScaleDistance {
  if (typeof input === 'string') return parseDistance(input)

  assertPositiveNumber(input.value, 'Distance')
  return {
    value: input.value,
    unit: input.unit,
  }
}

export function distanceBetween(start: Point2D, end: Point2D): number {
  assertPoint(start, 'start')
  assertPoint(end, 'end')
  return Math.hypot(end.x - start.x, end.y - start.y)
}

export function viewportToPdfPoint(
  point: ViewportPoint,
  transform: ViewportToPdfTransform,
  coordinateSpace: ViewportCoordinateSpace = 'css-pixels',
): PdfPoint {
  assertPoint(point, 'point')
  assertTransform(transform)

  const cssPoint = toCssViewportPoint(point, transform, coordinateSpace)
  const x = (cssPoint.x / transform.viewportWidthCssPixels) * transform.pdfWidthPoints
  const yFromTop = (cssPoint.y / transform.viewportHeightCssPixels) * transform.pdfHeightPoints

  return {
    x,
    y: transform.pdfHeightPoints - yFromTop,
  }
}

export function pdfToViewportPoint(
  point: PdfPoint,
  transform: ViewportToPdfTransform,
  coordinateSpace: ViewportCoordinateSpace = 'css-pixels',
): ViewportPoint {
  assertPoint(point, 'point')
  assertTransform(transform)

  const cssPoint = {
    x: (point.x / transform.pdfWidthPoints) * transform.viewportWidthCssPixels,
    y: ((transform.pdfHeightPoints - point.y) / transform.pdfHeightPoints) * transform.viewportHeightCssPixels,
  }

  if (coordinateSpace === 'css-pixels') return cssPoint

  const devicePixelRatio = transform.devicePixelRatio ?? 1
  return {
    x: cssPoint.x * devicePixelRatio,
    y: cssPoint.y * devicePixelRatio,
  }
}

export function createScaleCalibration(input: CreateScaleCalibrationInput): ScaleCalibration {
  const knownDistance = resolveKnownDistance(input.knownDistance)
  const pdfDistancePoints = distanceBetween(input.pdfStart, input.pdfEnd)
  assertPositiveNumber(pdfDistancePoints, 'PDF calibration distance')

  return {
    id: input.id,
    projectId: input.projectId,
    sheetId: input.sheetId,
    source: {
      pdfStart: { ...input.pdfStart },
      pdfEnd: { ...input.pdfEnd },
    },
    knownDistance,
    pdfDistancePoints,
    pointsPerUnit: pdfDistancePoints / knownDistance.value,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  }
}

export function createScaleCalibrationFromViewportPoints(
  input: CreateViewportScaleCalibrationInput,
): ScaleCalibration {
  return createScaleCalibration({
    id: input.id,
    projectId: input.projectId,
    sheetId: input.sheetId,
    pdfStart: viewportToPdfPoint(input.viewportStart, input.transform, input.coordinateSpace),
    pdfEnd: viewportToPdfPoint(input.viewportEnd, input.transform, input.coordinateSpace),
    knownDistance: input.knownDistance,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  })
}

export function measurePdfDistance(
  start: PdfPoint,
  end: PdfPoint,
  calibration: ScaleCalibration,
  outputUnit: LinearUnit = calibration.knownDistance.unit,
): ScaleDistance {
  const valueInCalibrationUnit = distanceBetween(start, end) / calibration.pointsPerUnit
  return {
    value: convertDistance(valueInCalibrationUnit, calibration.knownDistance.unit, outputUnit),
    unit: outputUnit,
  }
}

export function measureViewportDistance(
  start: ViewportPoint,
  end: ViewportPoint,
  transform: ViewportToPdfTransform,
  calibration: ScaleCalibration,
  outputUnit: LinearUnit = calibration.knownDistance.unit,
  coordinateSpace: ViewportCoordinateSpace = 'css-pixels',
): ScaleDistance {
  return measurePdfDistance(
    viewportToPdfPoint(start, transform, coordinateSpace),
    viewportToPdfPoint(end, transform, coordinateSpace),
    calibration,
    outputUnit,
  )
}

export function pdfToWorldPoint(
  point: PdfPoint,
  calibration: ScaleCalibration,
  outputUnit: LinearUnit = calibration.knownDistance.unit,
): WorldPoint {
  assertPoint(point, 'point')

  const valueFactor = convertDistance(1, calibration.knownDistance.unit, outputUnit)
  return {
    x: ((point.x - calibration.source.pdfStart.x) / calibration.pointsPerUnit) * valueFactor,
    y: ((point.y - calibration.source.pdfStart.y) / calibration.pointsPerUnit) * valueFactor,
    unit: outputUnit,
  }
}

export function viewportToWorldPoint(
  point: ViewportPoint,
  transform: ViewportToPdfTransform,
  calibration: ScaleCalibration,
  outputUnit: LinearUnit = calibration.knownDistance.unit,
  coordinateSpace: ViewportCoordinateSpace = 'css-pixels',
): WorldPoint {
  return pdfToWorldPoint(
    viewportToPdfPoint(point, transform, coordinateSpace),
    calibration,
    outputUnit,
  )
}

function toCssViewportPoint(
  point: ViewportPoint,
  transform: ViewportToPdfTransform,
  coordinateSpace: ViewportCoordinateSpace,
): ViewportPoint {
  if (coordinateSpace === 'css-pixels') return point

  const devicePixelRatio = transform.devicePixelRatio ?? 1
  assertPositiveNumber(devicePixelRatio, 'Device pixel ratio')
  return {
    x: point.x / devicePixelRatio,
    y: point.y / devicePixelRatio,
  }
}

function assertTransform(transform: ViewportToPdfTransform) {
  assertPositiveNumber(transform.pdfWidthPoints, 'PDF width')
  assertPositiveNumber(transform.pdfHeightPoints, 'PDF height')
  assertPositiveNumber(transform.viewportWidthCssPixels, 'Viewport width')
  assertPositiveNumber(transform.viewportHeightCssPixels, 'Viewport height')
  if (transform.devicePixelRatio !== undefined) {
    assertPositiveNumber(transform.devicePixelRatio, 'Device pixel ratio')
  }
}

function assertPoint(point: Point2D, name: string) {
  assertFiniteNumber(point.x, `${name}.x`)
  assertFiniteNumber(point.y, `${name}.y`)
}

function assertPositiveNumber(value: number, name: string) {
  assertFiniteNumber(value, name)
  if (value <= 0) throw new Error(`${name} must be greater than zero`)
}

function assertFiniteNumber(value: number, name: string) {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`)
}

import { describe, expect, it } from 'vitest'
import {
  convertDistance,
  createScaleCalibration,
  createScaleCalibrationFromViewportPoints,
  measurePdfDistance,
  measureViewportDistance,
  parseDistance,
  pdfToViewportPoint,
  pdfToWorldPoint,
  viewportToPdfPoint,
  viewportToWorldPoint,
} from './index'

const pageTransform = {
  pdfWidthPoints: 612,
  pdfHeightPoints: 792,
  viewportWidthCssPixels: 1224,
  viewportHeightCssPixels: 1584,
  devicePixelRatio: 2,
}

describe('geometry units', () => {
  it('parses common imperial and metric units', () => {
    expect(parseDistance('50 ft')).toEqual({ value: 50, unit: 'ft' })
    expect(parseDistance('12 inches')).toEqual({ value: 12, unit: 'in' })
    expect(parseDistance('2.5 m')).toEqual({ value: 2.5, unit: 'm' })
    expect(parseDistance('30cm')).toEqual({ value: 30, unit: 'cm' })
    expect(parseDistance('250 mm')).toEqual({ value: 250, unit: 'mm' })
  })

  it('converts distances through meters', () => {
    expect(convertDistance(1, 'ft', 'in')).toBeCloseTo(12)
    expect(convertDistance(1000, 'mm', 'm')).toBeCloseTo(1)
    expect(convertDistance(2, 'm', 'cm')).toBeCloseTo(200)
  })
})

describe('viewport and PDF coordinates', () => {
  it('maps top-left viewport coordinates into bottom-left PDF points', () => {
    expect(viewportToPdfPoint({ x: 0, y: 0 }, pageTransform)).toEqual({ x: 0, y: 792 })
    expect(viewportToPdfPoint({ x: 1224, y: 1584 }, pageTransform)).toEqual({ x: 612, y: 0 })
  })

  it('normalizes device pixels before converting to PDF points', () => {
    expect(viewportToPdfPoint({ x: 1224, y: 1584 }, pageTransform, 'device-pixels')).toEqual({
      x: 306,
      y: 396,
    })
  })

  it('round trips PDF points through viewport coordinates', () => {
    const pdfPoint = { x: 153, y: 198 }
    const viewportPoint = pdfToViewportPoint(pdfPoint, pageTransform)
    expect(viewportToPdfPoint(viewportPoint, pageTransform)).toEqual(pdfPoint)
  })
})

describe('scale calibration', () => {
  it('calibrates from two PDF points and measures in requested units', () => {
    const calibration = createScaleCalibration({
      sheetId: 'sheet-1',
      pdfStart: { x: 100, y: 100 },
      pdfEnd: { x: 200, y: 100 },
      knownDistance: '50 ft',
    })

    expect(calibration.pdfDistancePoints).toBe(100)
    expect(calibration.pointsPerUnit).toBe(2)
    expect(measurePdfDistance({ x: 100, y: 100 }, { x: 150, y: 100 }, calibration)).toEqual({
      value: 25,
      unit: 'ft',
    })
    expect(measurePdfDistance({ x: 100, y: 100 }, { x: 150, y: 100 }, calibration, 'in')).toEqual({
      value: 300,
      unit: 'in',
    })
  })

  it('calibrates from high-DPI viewport points', () => {
    const calibration = createScaleCalibrationFromViewportPoints({
      viewportStart: { x: 200, y: 400 },
      viewportEnd: { x: 600, y: 400 },
      coordinateSpace: 'device-pixels',
      transform: pageTransform,
      knownDistance: { value: 10, unit: 'm' },
    })

    expect(calibration.source.pdfStart).toEqual({ x: 50, y: 692 })
    expect(calibration.source.pdfEnd).toEqual({ x: 150, y: 692 })
    expect(calibration.pointsPerUnit).toBe(10)
  })

  it('converts PDF and viewport points into world coordinates', () => {
    const calibration = createScaleCalibration({
      pdfStart: { x: 100, y: 200 },
      pdfEnd: { x: 200, y: 200 },
      knownDistance: '50 ft',
    })

    expect(pdfToWorldPoint({ x: 110, y: 230 }, calibration)).toEqual({ x: 5, y: 15, unit: 'ft' })
    expect(viewportToWorldPoint({ x: 220, y: 1124 }, pageTransform, calibration)).toEqual({
      x: 5,
      y: 15,
      unit: 'ft',
    })
  })

  it('measures viewport distances using the calibrated scale', () => {
    const calibration = createScaleCalibration({
      pdfStart: { x: 0, y: 0 },
      pdfEnd: { x: 100, y: 0 },
      knownDistance: '25 ft',
    })

    expect(measureViewportDistance({ x: 0, y: 1584 }, { x: 1224, y: 1584 }, pageTransform, calibration)).toEqual({
      value: 153,
      unit: 'ft',
    })
  })
})

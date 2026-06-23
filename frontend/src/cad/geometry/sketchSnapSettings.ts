import type { Point2 } from '@/cad/model/document'

export interface SketchSnapSettings {
  gridSnap: boolean
  objectSnap: boolean
  angleSnap: boolean
  gridSize: number
  fineGridSize: number
  snapTolerance: number
  angleStep: number
}

export const defaultSketchSnapSettings: SketchSnapSettings = {
  gridSnap: true,
  objectSnap: true,
  angleSnap: true,
  gridSize: 5,
  fineGridSize: 0.1,
  snapTolerance: 10,
  angleStep: 15
}

export const sketchGridSizeOptions = [1, 2, 5, 10, 25]
export const sketchAngleStepOptions = [15, 30, 45, 90]

export function normalizeGridSize(value: number, fallback = defaultSketchSnapSettings.gridSize): number {
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.max(0.1, Math.round(value * 10) / 10)
}

export function resolveSketchGridStep(settings: SketchSnapSettings, fine = false): number {
  return normalizeGridSize(fine ? settings.fineGridSize : settings.gridSize)
}

export function normalizeAngleStep(value: number, fallback = defaultSketchSnapSettings.angleStep): number {
  if (!Number.isFinite(value) || value <= 0 || value > 180) return fallback
  return Math.max(1, Math.round(value))
}

export function roundPointToSketchGrid(point: Point2, step: number): Point2 {
  const safeStep = normalizeGridSize(step)
  return {
    x: Math.round(point.x / safeStep) * safeStep,
    y: Math.round(point.y / safeStep) * safeStep
  }
}

export function snapPointToSketchAngle(origin: Point2, point: Point2, angleStep: number): Point2 {
  const dx = point.x - origin.x
  const dy = point.y - origin.y
  const length = Math.hypot(dx, dy)
  if (length < 0.001) return point

  const safeStep = normalizeAngleStep(angleStep)
  const stepRadians = safeStep * Math.PI / 180
  const snappedAngle = Math.round(Math.atan2(dy, dx) / stepRadians) * stepRadians
  return {
    x: roundNumber(origin.x + Math.cos(snappedAngle) * length),
    y: roundNumber(origin.y + Math.sin(snappedAngle) * length)
  }
}

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000
}

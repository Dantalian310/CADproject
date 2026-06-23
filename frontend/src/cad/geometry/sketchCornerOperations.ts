import type { ArcEntity, LineEntity, Point2 } from '@/cad/model/document'
import { angleFromPoint, arcSweepDegrees } from '@/cad/geometry/sketchArcGeometry'

export interface SketchCornerOperationResult<T extends LineEntity | ArcEntity> {
  lineA: LineEntity
  lineB: LineEntity
  connector: T
  corner: Point2
}

interface CornerAnalysis {
  intersection: Point2
  directionA: Point2
  directionB: Point2
  lengthA: number
  lengthB: number
}

export function createLineFillet(
  lineA: LineEntity,
  lineB: LineEntity,
  radius: number,
  connectorId = 'fillet-preview',
  connectorName = 'Fillet Preview'
): SketchCornerOperationResult<ArcEntity> | null {
  if (!Number.isFinite(radius) || radius <= 0) return null
  const corner = analyzeLineCorner(lineA, lineB)
  if (!corner) return null
  const theta = Math.acos(clamp(dot(corner.directionA, corner.directionB), -1, 1))
  if (theta < 0.01 || Math.abs(Math.PI - theta) < 0.01) return null

  const tangentDistance = radius / Math.tan(theta / 2)
  if (tangentDistance <= 0 || tangentDistance >= corner.lengthA || tangentDistance >= corner.lengthB) return null

  const tangentA = pointAlong(corner.intersection, corner.directionA, tangentDistance)
  const tangentB = pointAlong(corner.intersection, corner.directionB, tangentDistance)
  const bisector = normalize({
    x: corner.directionA.x + corner.directionB.x,
    y: corner.directionA.y + corner.directionB.y
  })
  if (!bisector) return null
  const center = pointAlong(corner.intersection, bisector, radius / Math.sin(theta / 2))
  const angles = minorArcAngles(center, tangentA, tangentB)

  return {
    lineA: trimLineToPoint(lineA, corner.intersection, tangentA),
    lineB: trimLineToPoint(lineB, corner.intersection, tangentB),
    connector: {
      id: connectorId,
      type: 'arc',
      name: connectorName,
      visible: true,
      construction: lineA.construction && lineB.construction ? true : undefined,
      center,
      radius: roundNumber(radius),
      startAngle: angles.startAngle,
      endAngle: angles.endAngle
    },
    corner: corner.intersection
  }
}

export function createLineChamfer(
  lineA: LineEntity,
  lineB: LineEntity,
  distance: number,
  connectorId = 'chamfer-preview',
  connectorName = 'Chamfer Preview'
): SketchCornerOperationResult<LineEntity> | null {
  if (!Number.isFinite(distance) || distance <= 0) return null
  const corner = analyzeLineCorner(lineA, lineB)
  if (!corner) return null
  const theta = Math.acos(clamp(dot(corner.directionA, corner.directionB), -1, 1))
  if (theta < 0.01 || Math.abs(Math.PI - theta) < 0.01) return null
  if (distance >= corner.lengthA || distance >= corner.lengthB) return null

  const chamferA = pointAlong(corner.intersection, corner.directionA, distance)
  const chamferB = pointAlong(corner.intersection, corner.directionB, distance)

  return {
    lineA: trimLineToPoint(lineA, corner.intersection, chamferA),
    lineB: trimLineToPoint(lineB, corner.intersection, chamferB),
    connector: {
      id: connectorId,
      type: 'line',
      name: connectorName,
      visible: true,
      construction: lineA.construction && lineB.construction ? true : undefined,
      start: chamferA,
      end: chamferB
    },
    corner: corner.intersection
  }
}

function analyzeLineCorner(lineA: LineEntity, lineB: LineEntity): CornerAnalysis | null {
  const intersection = intersectInfiniteLines(lineA, lineB)
  if (!intersection) return null
  const endpointA = farEndpointFromCorner(lineA, intersection)
  const endpointB = farEndpointFromCorner(lineB, intersection)
  if (!endpointA || !endpointB) return null
  const directionA = normalize({ x: endpointA.x - intersection.x, y: endpointA.y - intersection.y })
  const directionB = normalize({ x: endpointB.x - intersection.x, y: endpointB.y - intersection.y })
  if (!directionA || !directionB) return null
  return {
    intersection,
    directionA,
    directionB,
    lengthA: distance(intersection, endpointA),
    lengthB: distance(intersection, endpointB)
  }
}

function intersectInfiniteLines(lineA: LineEntity, lineB: LineEntity): Point2 | null {
  const x1 = lineA.start.x
  const y1 = lineA.start.y
  const x2 = lineA.end.x
  const y2 = lineA.end.y
  const x3 = lineB.start.x
  const y3 = lineB.start.y
  const x4 = lineB.end.x
  const y4 = lineB.end.y
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(denominator) < 0.000001) return null
  return {
    x: roundNumber(((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denominator),
    y: roundNumber(((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denominator)
  }
}

function farEndpointFromCorner(line: LineEntity, corner: Point2): Point2 | null {
  const startDistance = distance(line.start, corner)
  const endDistance = distance(line.end, corner)
  const farPoint = startDistance > endDistance ? line.start : line.end
  return distance(farPoint, corner) < 0.001 ? null : farPoint
}

function trimLineToPoint(line: LineEntity, corner: Point2, point: Point2): LineEntity {
  const startDistance = distance(line.start, corner)
  const endDistance = distance(line.end, corner)
  if (startDistance <= endDistance) {
    return { ...cloneLine(line), start: point }
  }
  return { ...cloneLine(line), end: point }
}

function minorArcAngles(center: Point2, a: Point2, b: Point2) {
  const first = angleFromPoint(center, a)
  const second = angleFromPoint(center, b)
  if (arcSweepDegrees(first, second) <= 180) {
    return { startAngle: first, endAngle: second }
  }
  return { startAngle: second, endAngle: first }
}

function pointAlong(origin: Point2, direction: Point2, length: number): Point2 {
  return {
    x: roundNumber(origin.x + direction.x * length),
    y: roundNumber(origin.y + direction.y * length)
  }
}

function normalize(vector: Point2): Point2 | null {
  const length = Math.hypot(vector.x, vector.y)
  if (length < 0.000001) return null
  return {
    x: vector.x / length,
    y: vector.y / length
  }
}

function dot(a: Point2, b: Point2): number {
  return a.x * b.x + a.y * b.y
}

function distance(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000
}

function cloneLine(line: LineEntity): LineEntity {
  return JSON.parse(JSON.stringify(line)) as LineEntity
}

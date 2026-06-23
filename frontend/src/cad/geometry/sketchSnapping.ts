import type { CadDocument, Point2, RectangleEntity, SketchEntity, SketchPlane } from '@/cad/model/document'
import { arcEndPoint, arcMidPoint, arcStartPoint } from './sketchArcGeometry'

export type SketchSnapKind = 'endpoint' | 'midpoint' | 'corner' | 'edge-midpoint' | 'center' | 'quadrant'

export interface SketchSnapCandidate {
  kind: SketchSnapKind
  label: string
  point: Point2
  sketchId: string
  entityId: string
  priority: number
}

export interface SketchSnapResult extends SketchSnapCandidate {
  distance: number
}

export interface SketchSnapOptions {
  excludeEntityKeys?: Set<string>
  plane?: SketchPlane
}

export function sketchEntityKey(sketchId: string, entityId: string): string {
  return `${sketchId}:${entityId}`
}

export function findNearestSketchSnap(
  document: CadDocument,
  point: Point2,
  tolerance: number,
  options: SketchSnapOptions = {}
): SketchSnapResult | null {
  const candidates = buildSketchSnapCandidates(document, options)
  const matches = candidates
    .map((candidate) => ({
      ...candidate,
      distance: distance(point, candidate.point)
    }))
    .filter((candidate) => candidate.distance <= tolerance)
    .sort((a, b) => {
      const distanceDelta = a.distance - b.distance
      if (Math.abs(distanceDelta) > 0.25) return distanceDelta
      return b.priority - a.priority
    })

  return matches[0] ?? null
}

export function buildSketchSnapCandidates(
  document: CadDocument,
  options: SketchSnapOptions = {}
): SketchSnapCandidate[] {
  const candidates: SketchSnapCandidate[] = []
  for (const sketch of document.sketches) {
    if (options.plane && sketch.plane !== options.plane) continue
    for (const entity of sketch.entities) {
      if (!entity.visible) continue
      if (options.excludeEntityKeys?.has(sketchEntityKey(sketch.id, entity.id))) continue
      candidates.push(...entitySnapCandidates(sketch.id, entity))
    }
  }
  return candidates
}

function entitySnapCandidates(sketchId: string, entity: SketchEntity): SketchSnapCandidate[] {
  if (entity.type === 'line') {
    return [
      candidate('endpoint', '端点', entity.start, sketchId, entity.id, 5),
      candidate('endpoint', '端点', entity.end, sketchId, entity.id, 5),
      candidate('midpoint', '中点', midpoint(entity.start, entity.end), sketchId, entity.id, 4)
    ]
  }

  if (entity.type === 'rectangle') {
    const corners = rectangleCorners(entity)
    return [
      candidate('corner', '角点', corners.sw, sketchId, entity.id, 5),
      candidate('corner', '角点', corners.se, sketchId, entity.id, 5),
      candidate('corner', '角点', corners.ne, sketchId, entity.id, 5),
      candidate('corner', '角点', corners.nw, sketchId, entity.id, 5),
      candidate('edge-midpoint', '边中点', midpoint(corners.sw, corners.se), sketchId, entity.id, 4),
      candidate('edge-midpoint', '边中点', midpoint(corners.se, corners.ne), sketchId, entity.id, 4),
      candidate('edge-midpoint', '边中点', midpoint(corners.ne, corners.nw), sketchId, entity.id, 4),
      candidate('edge-midpoint', '边中点', midpoint(corners.nw, corners.sw), sketchId, entity.id, 4),
      candidate('center', '中心', { x: entity.origin.x + entity.width / 2, y: entity.origin.y + entity.height / 2 }, sketchId, entity.id, 3)
    ]
  }

  if (entity.type === 'arc') {
    return [
      candidate('center', '圆弧圆心', entity.center, sketchId, entity.id, 5),
      candidate('endpoint', '圆弧端点', arcStartPoint(entity), sketchId, entity.id, 5),
      candidate('endpoint', '圆弧端点', arcEndPoint(entity), sketchId, entity.id, 5),
      candidate('midpoint', '圆弧中点', arcMidPoint(entity), sketchId, entity.id, 4)
    ]
  }

  return [
    candidate('center', '圆心', entity.center, sketchId, entity.id, 5),
    candidate('quadrant', '象限点', { x: entity.center.x + entity.radius, y: entity.center.y }, sketchId, entity.id, 4),
    candidate('quadrant', '象限点', { x: entity.center.x, y: entity.center.y + entity.radius }, sketchId, entity.id, 4),
    candidate('quadrant', '象限点', { x: entity.center.x - entity.radius, y: entity.center.y }, sketchId, entity.id, 4),
    candidate('quadrant', '象限点', { x: entity.center.x, y: entity.center.y - entity.radius }, sketchId, entity.id, 4)
  ]
}

function candidate(
  kind: SketchSnapKind,
  label: string,
  point: Point2,
  sketchId: string,
  entityId: string,
  priority: number
): SketchSnapCandidate {
  return { kind, label, point, sketchId, entityId, priority }
}

function rectangleCorners(entity: RectangleEntity) {
  return {
    sw: entity.origin,
    se: { x: entity.origin.x + entity.width, y: entity.origin.y },
    ne: { x: entity.origin.x + entity.width, y: entity.origin.y + entity.height },
    nw: { x: entity.origin.x, y: entity.origin.y + entity.height }
  }
}

function midpoint(a: Point2, b: Point2): Point2 {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  }
}

function distance(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

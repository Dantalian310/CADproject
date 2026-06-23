import type { CadDocument, Point2, RectangleEntity, SketchConstraint, SketchEntity, SketchPlane } from '@/cad/model/document'
import { constraintLabel } from './sketchConstraints'
import { arcMidPoint } from './sketchArcGeometry'

export interface DimensionAnnotation {
  constraintId: string
  entityId: string
  sketchPlane: SketchPlane
  dimension: string
  label: string
  labelPoint: Point2
  guidePoints: Point2[]
}

export function buildDimensionAnnotations(document: CadDocument): DimensionAnnotation[] {
  const annotations: DimensionAnnotation[] = []
  for (const sketch of document.sketches) {
    for (const constraint of sketch.constraints) {
      if (constraint.type !== 'dimension') continue
      const entity = sketch.entities.find((item) => item.id === constraint.entityId)
      if (!entity?.visible) continue
      const annotation = createDimensionAnnotation(entity, constraint, sketch.plane)
      if (annotation) annotations.push(annotation)
    }
  }
  return annotations
}

export function createDimensionAnnotation(
  entity: SketchEntity,
  constraint: Extract<SketchConstraint, { type: 'dimension' }>,
  sketchPlane: SketchPlane = 'XY'
): DimensionAnnotation | null {
  if (entity.type === 'line' && constraint.dimension === 'length') {
    const dx = entity.end.x - entity.start.x
    const dy = entity.end.y - entity.start.y
    const normalLength = Math.max(1, Math.hypot(dx, dy))
    const offset = { x: (-dy / normalLength) * 18, y: (dx / normalLength) * 18 }
    const start = addPoint(entity.start, offset)
    const end = addPoint(entity.end, offset)
    return annotation(entity.id, sketchPlane, constraint, midpoint(start, end), [start, end])
  }

  if (entity.type === 'rectangle' && constraint.dimension === 'width') {
    const y = entity.origin.y - 20
    const start = { x: entity.origin.x, y }
    const end = { x: entity.origin.x + entity.width, y }
    return annotation(entity.id, sketchPlane, constraint, midpoint(start, end), [start, end])
  }

  if (entity.type === 'rectangle' && constraint.dimension === 'height') {
    const x = entity.origin.x + entity.width + 24
    const start = { x, y: entity.origin.y }
    const end = { x, y: entity.origin.y + entity.height }
    return annotation(entity.id, sketchPlane, constraint, midpoint(start, end), [start, end])
  }

  if (entity.type === 'circle' && constraint.dimension === 'radius') {
    const start = entity.center
    const end = { x: entity.center.x + entity.radius, y: entity.center.y }
    const labelPoint = { x: entity.center.x + entity.radius * 0.58, y: entity.center.y + 18 }
    return annotation(entity.id, sketchPlane, constraint, labelPoint, [start, end])
  }

  if (entity.type === 'arc' && constraint.dimension === 'radius') {
    const start = entity.center
    const end = arcMidPoint(entity)
    const labelPoint = { x: end.x + 16, y: end.y + 16 }
    return annotation(entity.id, sketchPlane, constraint, labelPoint, [start, end])
  }

  return null
}

function annotation(
  entityId: string,
  sketchPlane: SketchPlane,
  constraint: Extract<SketchConstraint, { type: 'dimension' }>,
  labelPoint: Point2,
  guidePoints: Point2[]
): DimensionAnnotation {
  return {
    constraintId: constraint.id,
    entityId,
    sketchPlane,
    dimension: constraint.dimension,
    label: `${constraintLabel(constraint)} ${formatNumber(constraint.value)} mm`,
    labelPoint,
    guidePoints
  }
}

function addPoint(point: Point2, delta: Point2): Point2 {
  return { x: point.x + delta.x, y: point.y + delta.y }
}

function midpoint(a: Point2, b: Point2): Point2 {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  }
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

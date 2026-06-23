import type { ArcEntity, CircleEntity, LineEntity, RectangleEntity, SketchConstraint, SketchEntity } from '@/cad/model/document'

export type DimensionKind = 'length' | 'width' | 'height' | 'radius'
export type RelationConstraintKind = 'concentric' | 'equalRadius' | 'parallel' | 'perpendicular' | 'tangent'

export function applyConstraintsToEntity(
  entity: SketchEntity,
  constraints: SketchConstraint[],
  previousEntity?: SketchEntity
): SketchEntity {
  const fixed = constraints.some((constraint) => constraint.type === 'fixed')
  let next = fixed && previousEntity ? preserveGeometry(previousEntity, entity) : cloneEntity(entity)
  next.locked = fixed || entity.locked || undefined

  if (fixed) return next

  if (next.type === 'line') {
    next = applyLineConstraints(next, constraints)
  }
  if (next.type === 'rectangle') {
    next = applyRectangleConstraints(next, constraints)
  }
  if (next.type === 'circle') {
    next = applyCircleConstraints(next, constraints)
  }
  if (next.type === 'arc') {
    next = applyArcConstraints(next, constraints)
  }
  return next
}

export function createDimensionConstraintForEntity(
  id: string,
  entity: SketchEntity,
  existingConstraints: SketchConstraint[]
): SketchConstraint | null {
  const dimensions = new Set(
    existingConstraints
      .filter((constraint) => constraint.type === 'dimension')
      .map((constraint) => constraint.dimension)
  )

  if (entity.type === 'line' && !dimensions.has('length')) {
    return { id, type: 'dimension', entityId: entity.id, dimension: 'length', value: getDimensionValue(entity, 'length') }
  }
  if (entity.type === 'rectangle' && !dimensions.has('width')) {
    return { id, type: 'dimension', entityId: entity.id, dimension: 'width', value: getDimensionValue(entity, 'width') }
  }
  if (entity.type === 'rectangle' && !dimensions.has('height')) {
    return { id, type: 'dimension', entityId: entity.id, dimension: 'height', value: getDimensionValue(entity, 'height') }
  }
  if (entity.type === 'circle' && !dimensions.has('radius')) {
    return { id, type: 'dimension', entityId: entity.id, dimension: 'radius', value: getDimensionValue(entity, 'radius') }
  }
  if (entity.type === 'arc' && !dimensions.has('radius')) {
    return { id, type: 'dimension', entityId: entity.id, dimension: 'radius', value: getDimensionValue(entity, 'radius') }
  }
  return null
}

export function getDimensionValue(entity: SketchEntity, dimension: string): number {
  if (entity.type === 'line' && dimension === 'length') {
    return roundNumber(distance(entity.start, entity.end))
  }
  if (entity.type === 'rectangle' && dimension === 'width') {
    return roundNumber(entity.width)
  }
  if (entity.type === 'rectangle' && dimension === 'height') {
    return roundNumber(entity.height)
  }
  if (entity.type === 'circle' && dimension === 'radius') {
    return roundNumber(entity.radius)
  }
  if (entity.type === 'arc' && dimension === 'radius') {
    return roundNumber(entity.radius)
  }
  return 0
}

export function isConstraintApplicable(type: SketchConstraint['type'], entity: SketchEntity): boolean {
  if (type === 'fixed' || type === 'dimension') return true
  return entity.type === 'line'
}

export function isRelationConstraint(constraint: SketchConstraint): constraint is Extract<SketchConstraint, { targetEntityId: string }> {
  return constraint.type === 'concentric'
    || constraint.type === 'equalRadius'
    || constraint.type === 'parallel'
    || constraint.type === 'perpendicular'
    || constraint.type === 'tangent'
}

export function isRelationConstraintApplicable(
  type: RelationConstraintKind,
  source: SketchEntity,
  target: SketchEntity
): boolean {
  if (type === 'concentric' || type === 'equalRadius') {
    return source.type === 'circle' && target.type === 'circle'
  }
  if (type === 'parallel' || type === 'perpendicular') {
    return source.type === 'line' && target.type === 'line'
  }
  return (source.type === 'circle' && (target.type === 'line' || target.type === 'circle'))
    || (source.type === 'line' && target.type === 'circle')
}

export function applyRelationConstraint(
  source: SketchEntity,
  target: SketchEntity,
  constraint: Extract<SketchConstraint, { targetEntityId: string }>
): SketchEntity {
  if (!isRelationConstraintApplicable(constraint.type, source, target)) return cloneEntity(target)
  if (constraint.type === 'concentric' && source.type === 'circle' && target.type === 'circle') {
    return {
      ...cloneEntity(target),
      center: clonePoint(source.center)
    }
  }
  if (constraint.type === 'equalRadius' && source.type === 'circle' && target.type === 'circle') {
    return {
      ...cloneEntity(target),
      radius: source.radius
    }
  }
  if (constraint.type === 'parallel' && source.type === 'line' && target.type === 'line') {
    return makeLineParallel(source, target)
  }
  if (constraint.type === 'perpendicular' && source.type === 'line' && target.type === 'line') {
    return makeLinePerpendicular(source, target)
  }
  if (constraint.type === 'tangent') {
    return makeTangent(source, target)
  }
  return cloneEntity(target)
}

export function constraintLabel(constraint: SketchConstraint): string {
  if (constraint.type === 'fixed') return '固定'
  if (constraint.type === 'horizontal') return '水平'
  if (constraint.type === 'vertical') return '垂直'
  if (constraint.type === 'concentric') return '同心'
  if (constraint.type === 'equalRadius') return '等半径'
  if (constraint.type === 'parallel') return '平行'
  if (constraint.type === 'perpendicular') return '垂直关系'
  if (constraint.type === 'tangent') return '相切'
  if (constraint.dimension === 'length') return '长度'
  if (constraint.dimension === 'width') return '宽度'
  if (constraint.dimension === 'height') return '高度'
  if (constraint.dimension === 'radius') return '半径'
  return '尺寸'
}

function applyLineConstraints(entity: LineEntity, constraints: SketchConstraint[]): LineEntity {
  let next = cloneEntity(entity)
  if (constraints.some((constraint) => constraint.type === 'horizontal')) {
    next.end = { ...next.end, y: next.start.y }
  }
  if (constraints.some((constraint) => constraint.type === 'vertical')) {
    next.end = { ...next.end, x: next.start.x }
  }

  for (const constraint of constraints) {
    if (constraint.type === 'dimension' && constraint.dimension === 'length') {
      next = setLineLength(next, constraint.value)
    }
  }
  return next
}

function applyRectangleConstraints(entity: RectangleEntity, constraints: SketchConstraint[]): RectangleEntity {
  const next = cloneEntity(entity)
  for (const constraint of constraints) {
    if (constraint.type === 'dimension' && constraint.dimension === 'width') {
      next.width = Math.max(5, roundNumber(constraint.value))
    }
    if (constraint.type === 'dimension' && constraint.dimension === 'height') {
      next.height = Math.max(5, roundNumber(constraint.value))
    }
  }
  return next
}

function applyCircleConstraints(entity: CircleEntity, constraints: SketchConstraint[]): CircleEntity {
  const next = cloneEntity(entity)
  for (const constraint of constraints) {
    if (constraint.type === 'dimension' && constraint.dimension === 'radius') {
      next.radius = Math.max(5, roundNumber(constraint.value))
    }
  }
  return next
}

function applyArcConstraints(entity: ArcEntity, constraints: SketchConstraint[]): ArcEntity {
  const next = cloneEntity(entity)
  for (const constraint of constraints) {
    if (constraint.type === 'dimension' && constraint.dimension === 'radius') {
      next.radius = Math.max(5, roundNumber(constraint.value))
    }
  }
  return next
}

function setLineLength(entity: LineEntity, value: number): LineEntity {
  const length = Math.max(1, roundNumber(value))
  const dx = entity.end.x - entity.start.x
  const dy = entity.end.y - entity.start.y
  const currentLength = Math.hypot(dx, dy)
  const unit = currentLength > 0
    ? { x: dx / currentLength, y: dy / currentLength }
    : { x: 1, y: 0 }
  return {
    ...cloneEntity(entity),
    end: {
      x: roundNumber(entity.start.x + unit.x * length),
      y: roundNumber(entity.start.y + unit.y * length)
    }
  }
}

function makeLineParallel(source: LineEntity, target: LineEntity): LineEntity {
  const sourceDx = source.end.x - source.start.x
  const sourceDy = source.end.y - source.start.y
  const sourceLength = Math.hypot(sourceDx, sourceDy)
  const targetLength = Math.max(1, distance(target.start, target.end))
  const unit = sourceLength > 0
    ? { x: sourceDx / sourceLength, y: sourceDy / sourceLength }
    : { x: 1, y: 0 }
  return {
    ...cloneEntity(target),
    end: {
      x: roundNumber(target.start.x + unit.x * targetLength),
      y: roundNumber(target.start.y + unit.y * targetLength)
    }
  }
}

function makeLinePerpendicular(source: LineEntity, target: LineEntity): LineEntity {
  const sourceUnit = lineUnit(source)
  const targetLength = Math.max(1, distance(target.start, target.end))
  const unit = { x: -sourceUnit.y, y: sourceUnit.x }
  return {
    ...cloneEntity(target),
    end: {
      x: roundNumber(target.start.x + unit.x * targetLength),
      y: roundNumber(target.start.y + unit.y * targetLength)
    }
  }
}

function makeTangent(source: SketchEntity, target: SketchEntity): SketchEntity {
  if (source.type === 'circle' && target.type === 'line') {
    return makeLineTangentToCircle(source, target)
  }
  if (source.type === 'line' && target.type === 'circle') {
    return makeCircleTangentToLine(source, target)
  }
  if (source.type === 'circle' && target.type === 'circle') {
    return makeCircleTangentToCircle(source, target)
  }
  return cloneEntity(target)
}

function makeLineTangentToCircle(circle: CircleEntity, line: LineEntity): LineEntity {
  const normal = lineNormal(line)
  const signedDistance = signedDistancePointToLine(circle.center, line, normal)
  const targetDistance = signedDistance >= 0 ? circle.radius : -circle.radius
  const offset = signedDistance - targetDistance
  const delta = { x: normal.x * offset, y: normal.y * offset }
  return {
    ...cloneEntity(line),
    start: addPoint(line.start, delta),
    end: addPoint(line.end, delta)
  }
}

function makeCircleTangentToLine(line: LineEntity, circle: CircleEntity): CircleEntity {
  const normal = lineNormal(line)
  const signedDistance = signedDistancePointToLine(circle.center, line, normal)
  const targetDistance = signedDistance >= 0 ? circle.radius : -circle.radius
  const offset = targetDistance - signedDistance
  return {
    ...cloneEntity(circle),
    center: addPoint(circle.center, { x: normal.x * offset, y: normal.y * offset })
  }
}

function makeCircleTangentToCircle(source: CircleEntity, target: CircleEntity): CircleEntity {
  const dx = target.center.x - source.center.x
  const dy = target.center.y - source.center.y
  const currentDistance = Math.hypot(dx, dy)
  const unit = currentDistance > 0
    ? { x: dx / currentDistance, y: dy / currentDistance }
    : { x: 1, y: 0 }
  const distanceBetweenCenters = source.radius + target.radius
  return {
    ...cloneEntity(target),
    center: {
      x: roundNumber(source.center.x + unit.x * distanceBetweenCenters),
      y: roundNumber(source.center.y + unit.y * distanceBetweenCenters)
    }
  }
}

function lineUnit(line: LineEntity): { x: number; y: number } {
  const dx = line.end.x - line.start.x
  const dy = line.end.y - line.start.y
  const length = Math.hypot(dx, dy)
  return length > 0 ? { x: dx / length, y: dy / length } : { x: 1, y: 0 }
}

function lineNormal(line: LineEntity): { x: number; y: number } {
  const unit = lineUnit(line)
  return { x: -unit.y, y: unit.x }
}

function signedDistancePointToLine(point: { x: number; y: number }, line: LineEntity, normal: { x: number; y: number }): number {
  return (point.x - line.start.x) * normal.x + (point.y - line.start.y) * normal.y
}

function addPoint(point: { x: number; y: number }, delta: { x: number; y: number }) {
  return {
    x: roundNumber(point.x + delta.x),
    y: roundNumber(point.y + delta.y)
  }
}

function preserveGeometry(previousEntity: SketchEntity, nextEntity: SketchEntity): SketchEntity {
  if (previousEntity.type === 'line' && nextEntity.type === 'line') {
    return {
      ...cloneEntity(nextEntity),
      start: clonePoint(previousEntity.start),
      end: clonePoint(previousEntity.end)
    }
  }
  if (previousEntity.type === 'rectangle' && nextEntity.type === 'rectangle') {
    return {
      ...cloneEntity(nextEntity),
      origin: clonePoint(previousEntity.origin),
      width: previousEntity.width,
      height: previousEntity.height
    }
  }
  if (previousEntity.type === 'circle' && nextEntity.type === 'circle') {
    return {
      ...cloneEntity(nextEntity),
      center: clonePoint(previousEntity.center),
      radius: previousEntity.radius
    }
  }
  return cloneEntity(previousEntity)
}

function clonePoint(point: { x: number; y: number }) {
  return { x: point.x, y: point.y }
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000
}

function cloneEntity<T extends SketchEntity>(entity: T): T {
  return JSON.parse(JSON.stringify(entity)) as T
}

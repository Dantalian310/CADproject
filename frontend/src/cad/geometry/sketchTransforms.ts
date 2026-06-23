import type { LineEntity, Point2, RectangleEntity, SketchEntity } from '@/cad/model/document'
import { arcEndPoint, arcStartPoint, angleFromPoint, sampleArcPoints } from './sketchArcGeometry'

export type SketchMirrorAxis = 'horizontal' | 'vertical'

export interface Bounds2 {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function translateSketchEntity(entity: SketchEntity, delta: Point2): SketchEntity {
  if (entity.type === 'line') {
    return {
      ...cloneEntity(entity),
      start: addPoint(entity.start, delta),
      end: addPoint(entity.end, delta)
    }
  }
  if (entity.type === 'rectangle') {
    return {
      ...cloneEntity(entity),
      origin: addPoint(entity.origin, delta)
    }
  }
  if (entity.type === 'arc') {
    return {
      ...cloneEntity(entity),
      center: addPoint(entity.center, delta)
    }
  }
  return {
    ...cloneEntity(entity),
    center: addPoint(entity.center, delta)
  }
}

export function rotateSketchEntity(entity: SketchEntity, center: Point2, degrees: number): SketchEntity {
  if (entity.type === 'line') {
    return {
      ...cloneEntity(entity),
      start: rotatePoint(entity.start, center, degrees),
      end: rotatePoint(entity.end, center, degrees)
    }
  }
  if (entity.type === 'rectangle') {
    return rectangleFromPoints(rectangleCorners(entity).map((point) => rotatePoint(point, center, degrees)), entity)
  }
  if (entity.type === 'arc') {
    const rotatedCenter = rotatePoint(entity.center, center, degrees)
    return {
      ...cloneEntity(entity),
      center: rotatedCenter,
      startAngle: angleFromPoint(rotatedCenter, rotatePoint(arcStartPoint(entity), center, degrees)),
      endAngle: angleFromPoint(rotatedCenter, rotatePoint(arcEndPoint(entity), center, degrees))
    }
  }
  return {
    ...cloneEntity(entity),
    center: rotatePoint(entity.center, center, degrees)
  }
}

export function rotateSketchEntities(entities: SketchEntity[], degrees: number): SketchEntity[] {
  if (entities.length === 0) return []
  const center = getSketchEntitiesCenter(entities)
  return entities.map((entity) => rotateSketchEntity(entity, center, degrees))
}

export function createRectangularArrayPreviewEntities(
  entities: SketchEntity[],
  columns: number,
  rows: number,
  spacing: Point2
): SketchEntity[] {
  const safeColumns = Math.max(1, Math.floor(columns))
  const safeRows = Math.max(1, Math.floor(rows))
  const previewEntities: SketchEntity[] = []

  for (let row = 0; row < safeRows; row += 1) {
    for (let column = 0; column < safeColumns; column += 1) {
      if (row === 0 && column === 0) continue
      for (const entity of entities) {
        previewEntities.push({
          ...translateSketchEntity(entity, {
            x: spacing.x * column,
            y: spacing.y * row
          }),
          id: `${entity.id}-preview-${row}-${column}`,
          name: `${entity.name} Preview`
        } as SketchEntity)
      }
    }
  }

  return previewEntities
}

export function offsetSketchEntity(entity: SketchEntity, distance: number): SketchEntity | null {
  if (!Number.isFinite(distance) || distance === 0) return null
  if (entity.type === 'line') {
    const dx = entity.end.x - entity.start.x
    const dy = entity.end.y - entity.start.y
    const length = Math.hypot(dx, dy)
    if (length < 0.001) return null
    const offset = {
      x: roundNumber((-dy / length) * distance),
      y: roundNumber((dx / length) * distance)
    }
    return translateSketchEntity(entity, offset)
  }
  if (entity.type === 'rectangle') {
    const nextWidth = entity.width + distance * 2
    const nextHeight = entity.height + distance * 2
    if (nextWidth < 1 || nextHeight < 1) return null
    return {
      ...cloneEntity(entity),
      origin: {
        x: roundNumber(entity.origin.x - distance),
        y: roundNumber(entity.origin.y - distance)
      },
      width: roundNumber(nextWidth),
      height: roundNumber(nextHeight)
    }
  }
  if (entity.type === 'arc') {
    const nextRadius = entity.radius + distance
    if (nextRadius < 1) return null
    return {
      ...cloneEntity(entity),
      radius: roundNumber(nextRadius)
    }
  }
  const nextRadius = entity.radius + distance
  if (nextRadius < 1) return null
  return {
    ...cloneEntity(entity),
    radius: roundNumber(nextRadius)
  }
}

export function createOffsetPreviewEntities(entities: SketchEntity[], distance: number): SketchEntity[] {
  return entities.flatMap((entity) => {
    const offsetEntity = offsetSketchEntity(entity, distance)
    if (!offsetEntity) return []
    return [{
      ...offsetEntity,
      id: `${entity.id}-offset-preview`,
      name: `${entity.name} Offset Preview`
    } as SketchEntity]
  })
}

export function mirrorSketchEntity(entity: SketchEntity, center: Point2, axis: SketchMirrorAxis): SketchEntity {
  if (entity.type === 'line') {
    return {
      ...cloneEntity(entity),
      start: mirrorPoint(entity.start, center, axis),
      end: mirrorPoint(entity.end, center, axis)
    }
  }
  if (entity.type === 'rectangle') {
    return rectangleFromPoints(rectangleCorners(entity).map((point) => mirrorPoint(point, center, axis)), entity)
  }
  if (entity.type === 'arc') {
    const mirroredCenter = mirrorPoint(entity.center, center, axis)
    return {
      ...cloneEntity(entity),
      center: mirroredCenter,
      startAngle: angleFromPoint(mirroredCenter, mirrorPoint(arcStartPoint(entity), center, axis)),
      endAngle: angleFromPoint(mirroredCenter, mirrorPoint(arcEndPoint(entity), center, axis))
    }
  }
  return {
    ...cloneEntity(entity),
    center: mirrorPoint(entity.center, center, axis)
  }
}

export function mirrorSketchEntityAcrossLine(entity: SketchEntity, mirrorLine: LineEntity): SketchEntity {
  if (entity.type === 'line') {
    return {
      ...cloneEntity(entity),
      start: mirrorPointAcrossLine(entity.start, mirrorLine),
      end: mirrorPointAcrossLine(entity.end, mirrorLine)
    }
  }
  if (entity.type === 'rectangle') {
    return rectangleFromPoints(rectangleCorners(entity).map((point) => mirrorPointAcrossLine(point, mirrorLine)), entity)
  }
  if (entity.type === 'arc') {
    const mirroredCenter = mirrorPointAcrossLine(entity.center, mirrorLine)
    return {
      ...cloneEntity(entity),
      center: mirroredCenter,
      startAngle: angleFromPoint(mirroredCenter, mirrorPointAcrossLine(arcStartPoint(entity), mirrorLine)),
      endAngle: angleFromPoint(mirroredCenter, mirrorPointAcrossLine(arcEndPoint(entity), mirrorLine))
    }
  }
  return {
    ...cloneEntity(entity),
    center: mirrorPointAcrossLine(entity.center, mirrorLine)
  }
}

export function getSketchEntityBounds(entity: SketchEntity): Bounds2 {
  if (entity.type === 'line') {
    return normalizeBounds({
      minX: entity.start.x,
      maxX: entity.end.x,
      minY: entity.start.y,
      maxY: entity.end.y
    })
  }
  if (entity.type === 'rectangle') {
    return normalizeBounds({
      minX: entity.origin.x,
      maxX: entity.origin.x + entity.width,
      minY: entity.origin.y,
      maxY: entity.origin.y + entity.height
    })
  }
  if (entity.type === 'arc') {
    return boundsFromPoints(sampleArcPoints(entity))
  }
  return {
    minX: entity.center.x - entity.radius,
    maxX: entity.center.x + entity.radius,
    minY: entity.center.y - entity.radius,
    maxY: entity.center.y + entity.radius
  }
}

export function getSketchEntitiesCenter(entities: SketchEntity[]): Point2 {
  const bounds = mergeBounds(entities.map(getSketchEntityBounds))
  return {
    x: roundNumber((bounds.minX + bounds.maxX) / 2),
    y: roundNumber((bounds.minY + bounds.maxY) / 2)
  }
}

function mergeBounds(bounds: Bounds2[]): Bounds2 {
  if (bounds.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  }
  return bounds.reduce((merged, item) => ({
    minX: Math.min(merged.minX, item.minX),
    maxX: Math.max(merged.maxX, item.maxX),
    minY: Math.min(merged.minY, item.minY),
    maxY: Math.max(merged.maxY, item.maxY)
  }))
}

function normalizeBounds(bounds: Bounds2): Bounds2 {
  return {
    minX: Math.min(bounds.minX, bounds.maxX),
    maxX: Math.max(bounds.minX, bounds.maxX),
    minY: Math.min(bounds.minY, bounds.maxY),
    maxY: Math.max(bounds.minY, bounds.maxY)
  }
}

function rectangleCorners(entity: RectangleEntity): Point2[] {
  return [
    entity.origin,
    { x: entity.origin.x + entity.width, y: entity.origin.y },
    { x: entity.origin.x + entity.width, y: entity.origin.y + entity.height },
    { x: entity.origin.x, y: entity.origin.y + entity.height }
  ]
}

function rectangleFromPoints(points: Point2[], entity: RectangleEntity): RectangleEntity {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    ...cloneEntity(entity),
    origin: { x: roundNumber(minX), y: roundNumber(minY) },
    width: Math.max(5, roundNumber(maxX - minX)),
    height: Math.max(5, roundNumber(maxY - minY))
  }
}

function boundsFromPoints(points: Point2[]): Bounds2 {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return normalizeBounds({
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  })
}

function rotatePoint(point: Point2, center: Point2, degrees: number): Point2 {
  const radians = degrees * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: roundNumber(center.x + dx * cos - dy * sin),
    y: roundNumber(center.y + dx * sin + dy * cos)
  }
}

function mirrorPoint(point: Point2, center: Point2, axis: SketchMirrorAxis): Point2 {
  if (axis === 'horizontal') {
    return { x: roundNumber(center.x * 2 - point.x), y: point.y }
  }
  return { x: point.x, y: roundNumber(center.y * 2 - point.y) }
}

function mirrorPointAcrossLine(point: Point2, line: LineEntity): Point2 {
  const dx = line.end.x - line.start.x
  const dy = line.end.y - line.start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return { x: point.x, y: point.y }

  const t = ((point.x - line.start.x) * dx + (point.y - line.start.y) * dy) / lengthSquared
  const projection = {
    x: line.start.x + t * dx,
    y: line.start.y + t * dy
  }
  return {
    x: roundNumber(projection.x * 2 - point.x),
    y: roundNumber(projection.y * 2 - point.y)
  }
}

function addPoint(point: Point2, delta: Point2): Point2 {
  return {
    x: roundNumber(point.x + delta.x),
    y: roundNumber(point.y + delta.y)
  }
}

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000
}

function cloneEntity<T extends SketchEntity>(entity: T): T {
  return JSON.parse(JSON.stringify(entity)) as T
}

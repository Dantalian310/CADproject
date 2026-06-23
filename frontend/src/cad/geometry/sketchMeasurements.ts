import type { ArcEntity, CircleEntity, LineEntity, Point2, RectangleEntity, SketchEntity } from '@/cad/model/document'
import { arcEndPoint, arcStartPoint, arcSweepDegrees } from './sketchArcGeometry'
import { getSketchEntityBounds } from './sketchTransforms'

export interface SketchMeasurementItem {
  id: string
  label: string
  value: string
}

export function buildSketchEntityMeasurements(entity: SketchEntity): SketchMeasurementItem[] {
  if (entity.type === 'line') return lineMeasurements(entity)
  if (entity.type === 'rectangle') return rectangleMeasurements(entity)
  if (entity.type === 'circle') return circleMeasurements(entity)
  return arcMeasurements(entity)
}

export function buildSketchSelectionMeasurements(entities: SketchEntity[]): SketchMeasurementItem[] {
  if (entities.length === 0) return []
  if (entities.length === 1) return buildSketchEntityMeasurements(entities[0])

  const visibleCount = entities.filter((entity) => entity.visible).length
  const lockedCount = entities.filter((entity) => entity.locked).length
  const constructionCount = entities.filter((entity) => entity.construction).length
  const bounds = mergeBounds(entities.map(getSketchEntityBounds))
  const totalCurveLength = entities.reduce((sum, entity) => sum + curveLength(entity), 0)

  return [
    { id: 'selection-count', label: '实体数量', value: String(entities.length) },
    { id: 'selection-visible', label: '可见数量', value: String(visibleCount) },
    { id: 'selection-locked', label: '锁定数量', value: String(lockedCount) },
    { id: 'selection-construction', label: '构造数量', value: String(constructionCount) },
    { id: 'selection-width', label: '范围宽度', value: formatMm(bounds.maxX - bounds.minX) },
    { id: 'selection-height', label: '范围高度', value: formatMm(bounds.maxY - bounds.minY) },
    { id: 'selection-center', label: '范围中心', value: formatPoint({ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }) },
    { id: 'selection-curve-length', label: '曲线总长', value: formatMm(totalCurveLength) }
  ]
}

export function formatMeasurementNumber(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return '-'
  const rounded = Number(value.toFixed(fractionDigits))
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

function lineMeasurements(entity: LineEntity): SketchMeasurementItem[] {
  const dx = entity.end.x - entity.start.x
  const dy = entity.end.y - entity.start.y
  return [
    { id: 'length', label: '长度', value: formatMm(Math.hypot(dx, dy)) },
    { id: 'angle', label: '角度', value: formatDegree(Math.atan2(dy, dx) * 180 / Math.PI) },
    { id: 'delta-x', label: 'X 增量', value: formatMm(dx) },
    { id: 'delta-y', label: 'Y 增量', value: formatMm(dy) },
    { id: 'start', label: '起点', value: formatPoint(entity.start) },
    { id: 'end', label: '终点', value: formatPoint(entity.end) }
  ]
}

function rectangleMeasurements(entity: RectangleEntity): SketchMeasurementItem[] {
  return [
    { id: 'width', label: '宽度', value: formatMm(entity.width) },
    { id: 'height', label: '高度', value: formatMm(entity.height) },
    { id: 'diagonal', label: '对角线', value: formatMm(Math.hypot(entity.width, entity.height)) },
    { id: 'perimeter', label: '周长', value: formatMm(2 * (entity.width + entity.height)) },
    { id: 'area', label: '面积', value: formatSquareMm(Math.abs(entity.width * entity.height)) },
    { id: 'center', label: '中心', value: formatPoint({ x: entity.origin.x + entity.width / 2, y: entity.origin.y + entity.height / 2 }) }
  ]
}

function circleMeasurements(entity: CircleEntity): SketchMeasurementItem[] {
  return [
    { id: 'radius', label: '半径', value: formatMm(entity.radius) },
    { id: 'diameter', label: '直径', value: formatMm(entity.radius * 2) },
    { id: 'circumference', label: '周长', value: formatMm(2 * Math.PI * entity.radius) },
    { id: 'area', label: '面积', value: formatSquareMm(Math.PI * entity.radius * entity.radius) },
    { id: 'center', label: '圆心', value: formatPoint(entity.center) }
  ]
}

function arcMeasurements(entity: ArcEntity): SketchMeasurementItem[] {
  const sweep = arcSweepDegrees(entity)
  const sweepRadians = sweep * Math.PI / 180
  return [
    { id: 'radius', label: '半径', value: formatMm(entity.radius) },
    { id: 'diameter', label: '直径', value: formatMm(entity.radius * 2) },
    { id: 'central-angle', label: '圆心角', value: formatDegree(sweep) },
    { id: 'arc-length', label: '弧长', value: formatMm(Math.abs(entity.radius * sweepRadians)) },
    { id: 'chord-length', label: '弦长', value: formatMm(distance(arcStartPoint(entity), arcEndPoint(entity))) },
    { id: 'center', label: '圆心', value: formatPoint(entity.center) }
  ]
}

function curveLength(entity: SketchEntity): number {
  if (entity.type === 'line') return distance(entity.start, entity.end)
  if (entity.type === 'rectangle') return 2 * (Math.abs(entity.width) + Math.abs(entity.height))
  if (entity.type === 'circle') return 2 * Math.PI * entity.radius
  return Math.abs(entity.radius * arcSweepDegrees(entity) * Math.PI / 180)
}

function mergeBounds(bounds: Array<{ minX: number; minY: number; maxX: number; maxY: number }>) {
  return bounds.reduce((merged, item) => ({
    minX: Math.min(merged.minX, item.minX),
    minY: Math.min(merged.minY, item.minY),
    maxX: Math.max(merged.maxX, item.maxX),
    maxY: Math.max(merged.maxY, item.maxY)
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
}

function distance(a: Point2, b: Point2): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function formatPoint(point: Point2): string {
  return `(${formatMeasurementNumber(point.x)}, ${formatMeasurementNumber(point.y)}) mm`
}

function formatMm(value: number): string {
  return `${formatMeasurementNumber(value)} mm`
}

function formatSquareMm(value: number): string {
  return `${formatMeasurementNumber(value)} mm²`
}

function formatDegree(value: number): string {
  return `${formatMeasurementNumber(value)}°`
}
import type { CadDocument, Point2, SketchEntity } from '@/cad/model/document'
import { sampleArcPoints } from '@/cad/geometry/sketchArcGeometry'
import { getSketchEntityBounds, type Bounds2 } from '@/cad/geometry/sketchTransforms'

interface SketchExportOptions {
  includeConstruction?: boolean
  includeHidden?: boolean
  margin?: number
}

interface ExportEntity {
  sketchName: string
  entity: SketchEntity
}

const defaultExportOptions: Required<SketchExportOptions> = {
  includeConstruction: true,
  includeHidden: false,
  margin: 10
}

export function exportSketchDocumentSvg(document: CadDocument, options: SketchExportOptions = {}): string {
  const resolved = { ...defaultExportOptions, ...options }
  const entities = collectExportEntities(document, resolved)
  const bounds = getExportBounds(entities.map((item) => item.entity))
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  const viewWidth = roundNumber(width + resolved.margin * 2)
  const viewHeight = roundNumber(height + resolved.margin * 2)
  const project = escapeXml(document.name)
  const body = entities.map(({ entity }) => entityToSvg(entity, bounds, resolved.margin)).join('\n  ')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${viewWidth}mm" height="${viewHeight}mm" viewBox="0 0 ${viewWidth} ${viewHeight}">`,
    `  <title>${project}</title>`,
    `  <g id="sketch" fill="none" stroke-linecap="round" stroke-linejoin="round">`,
    body ? `  ${body}` : '    <text x="10" y="20" fill="#64748b" font-size="4">Empty sketch</text>',
    '  </g>',
    '</svg>'
  ].join('\n')
}

export function exportSketchDocumentDxf(document: CadDocument, options: SketchExportOptions = {}): string {
  const resolved = { ...defaultExportOptions, ...options }
  const entities = collectExportEntities(document, resolved)
  const header = [
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$INSUNITS',
    '70', '4',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'TABLES',
    '0', 'TABLE',
    '2', 'LAYER',
    '70', '2',
    ...dxfLayer('SKETCH', 5),
    ...dxfLayer('CONSTRUCTION', 8),
    '0', 'ENDTAB',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'ENTITIES'
  ]
  const body = entities.flatMap(({ entity }) => entityToDxf(entity))
  const footer = ['0', 'ENDSEC', '0', 'EOF']
  return [...header, ...body, ...footer].join('\n')
}

function collectExportEntities(
  document: CadDocument,
  options: Required<SketchExportOptions>
): ExportEntity[] {
  return document.sketches.flatMap((sketch) => sketch.entities
    .filter((entity) => options.includeHidden || entity.visible !== false)
    .filter((entity) => options.includeConstruction || !entity.construction)
    .map((entity) => ({ sketchName: sketch.name, entity })))
}

function getExportBounds(entities: SketchEntity[]): Bounds2 {
  if (entities.length === 0) {
    return { minX: 0, maxX: 100, minY: 0, maxY: 100 }
  }
  return entities.map(getSketchEntityBounds).reduce((merged, item) => ({
    minX: Math.min(merged.minX, item.minX),
    maxX: Math.max(merged.maxX, item.maxX),
    minY: Math.min(merged.minY, item.minY),
    maxY: Math.max(merged.maxY, item.maxY)
  }))
}

function entityToSvg(entity: SketchEntity, bounds: Bounds2, margin: number): string {
  const className = entity.construction ? 'construction' : 'sketch'
  const stroke = entity.construction ? '#64748b' : '#2563eb'
  const dash = entity.construction ? ' stroke-dasharray="4 3"' : ''
  const strokeAttrs = `class="${className}" stroke="${stroke}" stroke-width="0.6"${dash}`

  if (entity.type === 'line') {
    const start = toSvgPoint(entity.start, bounds, margin)
    const end = toSvgPoint(entity.end, bounds, margin)
    return `<line ${strokeAttrs} x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" />`
  }

  if (entity.type === 'rectangle') {
    const minX = Math.min(entity.origin.x, entity.origin.x + entity.width)
    const maxY = Math.max(entity.origin.y, entity.origin.y + entity.height)
    const origin = toSvgPoint({ x: minX, y: maxY }, bounds, margin)
    return `<rect ${strokeAttrs} x="${origin.x}" y="${origin.y}" width="${roundNumber(Math.abs(entity.width))}" height="${roundNumber(Math.abs(entity.height))}" />`
  }

  if (entity.type === 'circle') {
    const center = toSvgPoint(entity.center, bounds, margin)
    return `<circle ${strokeAttrs} cx="${center.x}" cy="${center.y}" r="${roundNumber(entity.radius)}" />`
  }

  const points = sampleArcPoints(entity).map((point) => toSvgPoint(point, bounds, margin))
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  return `<path ${strokeAttrs} d="${path}" />`
}

function entityToDxf(entity: SketchEntity): string[] {
  if (entity.type === 'line') {
    return dxfLine(entity.start, entity.end, entity.construction)
  }
  if (entity.type === 'rectangle') {
    const x1 = entity.origin.x
    const y1 = entity.origin.y
    const x2 = entity.origin.x + entity.width
    const y2 = entity.origin.y + entity.height
    return [
      ...dxfLine({ x: x1, y: y1 }, { x: x2, y: y1 }, entity.construction),
      ...dxfLine({ x: x2, y: y1 }, { x: x2, y: y2 }, entity.construction),
      ...dxfLine({ x: x2, y: y2 }, { x: x1, y: y2 }, entity.construction),
      ...dxfLine({ x: x1, y: y2 }, { x: x1, y: y1 }, entity.construction)
    ]
  }
  if (entity.type === 'circle') {
    return [
      '0', 'CIRCLE',
      '8', dxfLayerName(entity.construction),
      '10', dxfNumber(entity.center.x),
      '20', dxfNumber(entity.center.y),
      '30', '0',
      '40', dxfNumber(entity.radius)
    ]
  }
  return [
    '0', 'ARC',
    '8', dxfLayerName(entity.construction),
    '10', dxfNumber(entity.center.x),
    '20', dxfNumber(entity.center.y),
    '30', '0',
    '40', dxfNumber(entity.radius),
    '50', dxfNumber(entity.startAngle),
    '51', dxfNumber(entity.endAngle)
  ]
}

function dxfLine(start: Point2, end: Point2, construction?: boolean): string[] {
  return [
    '0', 'LINE',
    '8', dxfLayerName(construction),
    '10', dxfNumber(start.x),
    '20', dxfNumber(start.y),
    '30', '0',
    '11', dxfNumber(end.x),
    '21', dxfNumber(end.y),
    '31', '0'
  ]
}

function dxfLayer(name: string, color: number): string[] {
  return [
    '0', 'LAYER',
    '2', name,
    '70', '0',
    '62', String(color),
    '6', 'CONTINUOUS'
  ]
}

function dxfLayerName(construction?: boolean): string {
  return construction ? 'CONSTRUCTION' : 'SKETCH'
}

function toSvgPoint(point: Point2, bounds: Bounds2, margin: number): Point2 {
  return {
    x: roundNumber(point.x - bounds.minX + margin),
    y: roundNumber(bounds.maxY - point.y + margin)
  }
}

function dxfNumber(value: number): string {
  return String(roundNumber(value))
}

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

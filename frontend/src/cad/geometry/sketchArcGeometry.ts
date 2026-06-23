import type { ArcEntity, Point2 } from '@/cad/model/document'

export function makeArcFromCenterPoints(
  id: string,
  name: string,
  center: Point2,
  start: Point2,
  end: Point2
): ArcEntity {
  const radius = Math.max(5, distance(center, start))
  const startAngle = angleFromPoint(center, start)
  let endAngle = angleFromPoint(center, end)
  if (arcSweepDegrees(startAngle, endAngle) < 2) {
    endAngle = normalizeAngle(startAngle + 90)
  }
  return {
    id,
    type: 'arc',
    name,
    visible: true,
    center,
    radius,
    startAngle,
    endAngle
  }
}

export function arcStartPoint(entity: ArcEntity): Point2 {
  return arcPointAtAngle(entity.center, entity.radius, entity.startAngle)
}

export function arcEndPoint(entity: ArcEntity): Point2 {
  return arcPointAtAngle(entity.center, entity.radius, entity.endAngle)
}

export function arcMidPoint(entity: ArcEntity): Point2 {
  return arcPointAtAngle(entity.center, entity.radius, entity.startAngle + arcSweepDegrees(entity) / 2)
}

export function arcPointAtAngle(center: Point2, radius: number, angleDegrees: number): Point2 {
  const radians = angleDegrees * Math.PI / 180
  return {
    x: roundNumber(center.x + Math.cos(radians) * radius),
    y: roundNumber(center.y + Math.sin(radians) * radius)
  }
}

export function sampleArcPoints(entity: ArcEntity, segments = 48): Point2[] {
  const sweep = arcSweepDegrees(entity)
  const steps = Math.max(6, Math.min(96, Math.ceil(segments * (sweep / 360))))
  const points: Point2[] = []
  for (let index = 0; index <= steps; index += 1) {
    points.push(arcPointAtAngle(entity.center, entity.radius, entity.startAngle + (sweep * index) / steps))
  }
  return points
}

export function angleFromPoint(center: Point2, point: Point2): number {
  return normalizeAngle(Math.atan2(point.y - center.y, point.x - center.x) * 180 / Math.PI)
}

export function arcSweepDegrees(entityOrStart: ArcEntity | number, endAngle?: number): number {
  const startAngle = typeof entityOrStart === 'number' ? entityOrStart : entityOrStart.startAngle
  const end = typeof entityOrStart === 'number' ? endAngle ?? startAngle : entityOrStart.endAngle
  const sweep = normalizeAngle(end - startAngle)
  return sweep < 0.001 ? 360 : sweep
}

export function normalizeAngle(angle: number): number {
  const normalized = angle % 360
  return roundNumber(normalized < 0 ? normalized + 360 : normalized)
}

function distance(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000
}

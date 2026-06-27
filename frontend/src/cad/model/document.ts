export interface Point2 {
  x: number
  y: number
}

export interface Point3 extends Point2 {
  z: number
}

export interface CadDocument {
  schemaVersion: '1.0'
  documentId: string
  name: string
  unit: 'mm'
  metadata: {
    currentVersion: number
    createdAt?: string
    updatedAt?: string
  }
  sketches: Sketch[]
  features: Feature[]
  assemblies?: AssemblyConstraint[]
}

export type SketchPlane = 'XY' | 'XZ' | 'YZ'

export interface Sketch {
  id: string
  name: string
  plane: SketchPlane
  entities: SketchEntity[]
  constraints: SketchConstraint[]
}

export type SketchEntity = LineEntity | RectangleEntity | CircleEntity | ArcEntity

export interface BaseSketchEntity {
  id: string
  type: string
  name: string
  visible: boolean
  locked?: boolean
  construction?: boolean
}

export interface LineEntity extends BaseSketchEntity {
  type: 'line'
  start: Point2
  end: Point2
}

export interface RectangleEntity extends BaseSketchEntity {
  type: 'rectangle'
  origin: Point2
  width: number
  height: number
}

export interface CircleEntity extends BaseSketchEntity {
  type: 'circle'
  center: Point2
  radius: number
}

export interface ArcEntity extends BaseSketchEntity {
  type: 'arc'
  center: Point2
  radius: number
  startAngle: number
  endAngle: number
}

export type SketchConstraint =
  | { id: string; type: 'fixed'; entityId: string }
  | { id: string; type: 'horizontal'; entityId: string }
  | { id: string; type: 'vertical'; entityId: string }
  | { id: string; type: 'dimension'; entityId: string; dimension: string; value: number }
  | { id: string; type: 'concentric'; entityId: string; targetEntityId: string }
  | { id: string; type: 'equalRadius'; entityId: string; targetEntityId: string }
  | { id: string; type: 'parallel'; entityId: string; targetEntityId: string }
  | { id: string; type: 'perpendicular'; entityId: string; targetEntityId: string }
  | { id: string; type: 'tangent'; entityId: string; targetEntityId: string }

export type Feature = ExtrudeFeature | CutFeature | BooleanFeature | BoxFeature | SphereFeature | ConeFeature | MeshFeature

export interface BaseFeature {
  id: string
  type: string
  name: string
  suppressed: boolean
  locked?: boolean
  position?: Point3
  rotation?: Point3
}

export interface ExtrudeFeature extends BaseFeature {
  type: 'extrude'
  sourceSketchId: string
  sourceEntityId: string
  depth: number
  operation: 'new'
}

export interface CutFeature extends BaseFeature {
  type: 'cut'
  targetFeatureId: string
  toolSketchId: string
  toolEntityId: string
  depth: number
}

export interface BooleanFeature extends BaseFeature {
  type: 'boolean'
  operation: 'add' | 'subtract' | 'union' | 'difference'
  targetFeatureId: string
  toolFeatureId: string
  resultMesh?: BooleanResultMesh
}

export interface BooleanResultMesh {
  vertices: number[]
  indices?: number[]
  color?: string
}

export interface BoxFeature extends BaseFeature {
  type: 'box'
  position: Point3
  rotation?: Point3
  length: number
  width: number
  height: number
}

export interface SphereFeature extends BaseFeature {
  type: 'sphere'
  position: Point3
  rotation?: Point3
  radius: number
}

export interface ConeFeature extends BaseFeature {
  type: 'cone'
  position: Point3
  rotation?: Point3
  baseRadius: number
  height: number
}

export interface MeshFeature extends BaseFeature {
  type: 'mesh'
  format: 'stl' | 'gltf' | 'glb' | 'imported'
  vertices: number[]
  indices?: number[]
  color?: string
}

export type AssemblyConstraint =
  | { id: string; type: 'fix'; featureId: string }
  | { id: string; type: 'align'; axis: 'x' | 'y' | 'z' | 'all'; sourceFeatureId: string; targetFeatureId: string }
  | { id: string; type: 'mate'; axis: 'z'; baseFeatureId: string; mateFeatureId: string }
  | { id: string; type: 'distance'; axis: 'x' | 'y' | 'z'; sourceFeatureId: string; targetFeatureId: string; distance: number }

export function createEmptyCadDocument(documentId: string, name: string): CadDocument {
  return {
    schemaVersion: '1.0',
    documentId,
    name,
    unit: 'mm',
    metadata: {
      currentVersion: 0
    },
    sketches: [
      {
        id: 'sketch-001',
        name: 'Sketch 1',
        plane: 'XY',
        entities: [],
        constraints: []
      }
    ],
    features: [],
    assemblies: []
  }
}

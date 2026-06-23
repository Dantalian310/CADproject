import type { CadDocument, Feature } from '@/cad/model/document'
import type * as THREE from 'three'

export interface MeshDescriptor {
  id: string
  featureId: string
  geometry: THREE.BufferGeometry
  material: THREE.Material
  kind?: 'mesh' | 'line'
}

export interface GeometryKernel {
  buildDocument(document: CadDocument): MeshDescriptor[]
  buildFeature(feature: Feature, document: CadDocument): MeshDescriptor | null
}

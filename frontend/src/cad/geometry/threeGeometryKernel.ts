import * as THREE from 'three'
import { ADDITION, Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import type { BooleanFeature, BooleanResultMesh, BoxFeature, CadDocument, CircleEntity, ConeFeature, Feature, MeshFeature, Point2, RectangleEntity, SketchEntity, SketchPlane, SphereFeature } from '@/cad/model/document'
import type { GeometryKernel, MeshDescriptor } from './geometryKernel'
import { sampleArcPoints } from './sketchArcGeometry'

type NormalizedBooleanOperation = 'add' | 'subtract'

export class ThreeGeometryKernel implements GeometryKernel {
  private readonly evaluator = new Evaluator()

  buildDocument(document: CadDocument): MeshDescriptor[] {
    const sketchMeshes = document.sketches.flatMap((sketch) =>
      sketch.entities
        .filter((entity) => entity.visible)
        .map((entity) => this.buildSketchEntity(sketch.id, sketch.plane, entity))
    )
    const featureMeshes = this.buildFeatureHistory(document)
    return [...sketchMeshes, ...featureMeshes]
  }

  buildFeature(feature: Feature, document: CadDocument): MeshDescriptor | null {
    if (feature.type === 'extrude') {
      const sketch = document.sketches.find((item) => item.id === feature.sourceSketchId)
      const entity = sketch?.entities.find((item) => item.id === feature.sourceEntityId)

      const descriptor = this.buildEntityExtrude(feature.id, entity, feature.depth, '#7c9cbf', sketch?.plane ?? 'XY')
      return descriptor ? this.applyDescriptorTransform(descriptor, feature) : null
    }
    if (feature.type === 'box') {
      return this.buildBoxFeature(feature)
    }
    if (feature.type === 'sphere') {
      return this.buildSphereFeature(feature)
    }
    if (feature.type === 'cone') {
      return this.buildConeFeature(feature)
    }
    if (feature.type === 'mesh') {
      return this.buildMeshFeature(feature)
    }

    return null
  }

  private buildFeatureHistory(document: CadDocument): MeshDescriptor[] {
    const { descriptors, consumed } = this.buildFeatureDescriptorState(document)
    return [...descriptors.values()].filter((descriptor) => !consumed.has(descriptor.featureId))
  }

  buildBooleanResultMesh(document: CadDocument, feature: BooleanFeature): BooleanResultMesh | null {
    const { descriptors } = this.buildFeatureDescriptorState(document)
    const target = descriptors.get(feature.targetFeatureId)
    const tool = descriptors.get(feature.toolFeatureId)
    if (!target || !tool) return null

    const normalizedOperation = this.normalizeBooleanOperation(feature.operation)
    const operation = normalizedOperation === 'add' ? ADDITION : SUBTRACTION
    const color = normalizedOperation === 'add' ? '#5b9f75' : '#b86b6b'
    const result = this.evaluateCsg(feature.id, target, tool, operation, color)
    return this.serializeGeometry(result.geometry, color)
  }

  private buildFeatureDescriptorState(document: CadDocument): { descriptors: Map<string, MeshDescriptor>; consumed: Set<string> } {
    const descriptors = new Map<string, MeshDescriptor>()
    const consumed = new Set<string>()

    for (const feature of document.features) {
      if (feature.suppressed) continue

      if (feature.type === 'extrude') {
        const descriptor = this.buildFeature(feature, document)
        if (descriptor) descriptors.set(feature.id, descriptor)
      }

      if (feature.type === 'box' || feature.type === 'sphere' || feature.type === 'cone' || feature.type === 'mesh') {
        const descriptor = this.buildFeature(feature, document)
        if (descriptor) descriptors.set(feature.id, descriptor)
      }

      if (feature.type === 'cut') {
        const target = descriptors.get(feature.targetFeatureId)
        const toolSketch = document.sketches.find((sketch) => sketch.id === feature.toolSketchId)
        const toolEntity = toolSketch?.entities.find((entity) => entity.id === feature.toolEntityId)
        const tool = this.buildEntityExtrude(`${feature.id}-tool`, toolEntity, feature.depth, '#ef4444', toolSketch?.plane ?? 'XY')
        if (!target || !tool) continue
        const result = this.applyDescriptorTransform(this.evaluateCsg(feature.id, target, tool, SUBTRACTION, '#c08457'), feature)
        descriptors.set(feature.id, result)
        consumed.add(feature.targetFeatureId)
      }

      if (feature.type === 'boolean') {
        const normalizedOperation = this.normalizeBooleanOperation(feature.operation)
        if (feature.resultMesh?.vertices.length) {
          const result = this.buildStoredBooleanResult(feature, normalizedOperation === 'add' ? '#5b9f75' : '#b86b6b')
          if (!result) continue
          descriptors.set(feature.id, result)
          consumed.add(feature.targetFeatureId)
          if (normalizedOperation === 'add') {
            consumed.add(feature.toolFeatureId)
          }
          continue
        }

        const target = descriptors.get(feature.targetFeatureId)
        const tool = descriptors.get(feature.toolFeatureId)
        if (!target || !tool) continue
        const operation = normalizedOperation === 'add' ? ADDITION : SUBTRACTION
        const color = normalizedOperation === 'add' ? '#5b9f75' : '#b86b6b'
        const result = this.applyDescriptorTransform(this.evaluateCsg(feature.id, target, tool, operation, color), feature)
        descriptors.set(feature.id, result)
        consumed.add(feature.targetFeatureId)
        if (normalizedOperation === 'add') {
          consumed.add(feature.toolFeatureId)
        }
      }
    }

    return { descriptors, consumed }
  }

  private buildSketchEntity(sketchId: string, plane: SketchPlane, entity: SketchEntity): MeshDescriptor {
    if (entity.type === 'line') {
      return this.buildLine(`${sketchId}-${entity.id}`, [
        this.pointToPlaneVector(entity.start, plane, 1),
        this.pointToPlaneVector(entity.end, plane, 1)
      ], entity.construction)
    }
    if (entity.type === 'rectangle') {
      const x = entity.origin.x
      const y = entity.origin.y
      const w = entity.width
      const h = entity.height
      return this.buildLine(`${sketchId}-${entity.id}`, [
        this.pointToPlaneVector({ x, y }, plane, 1),
        this.pointToPlaneVector({ x: x + w, y }, plane, 1),
        this.pointToPlaneVector({ x: x + w, y: y + h }, plane, 1),
        this.pointToPlaneVector({ x, y: y + h }, plane, 1),
        this.pointToPlaneVector({ x, y }, plane, 1)
      ], entity.construction)
    }
    if (entity.type === 'arc') {
      return this.buildLine(
        `${sketchId}-${entity.id}`,
        sampleArcPoints(entity).map((point) => this.pointToPlaneVector(point, plane, 1)),
        entity.construction
      )
    }
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 64; i += 1) {
      const angle = (Math.PI * 2 * i) / 64
      points.push(this.pointToPlaneVector({
        x: entity.center.x + Math.cos(angle) * entity.radius,
        y: entity.center.y + Math.sin(angle) * entity.radius
      }, plane, 1))
    }
    return this.buildLine(`${sketchId}-${entity.id}`, points, entity.construction)
  }

  private buildEntityExtrude(
    featureId: string,
    entity: SketchEntity | undefined,
    depth: number,
    color: string,
    plane: SketchPlane
  ): MeshDescriptor | null {
    if (entity?.construction) return null
    if (entity?.type === 'rectangle') {
      return this.buildRectangleExtrude(featureId, entity, depth, color, plane)
    }
    if (entity?.type === 'circle') {
      return this.buildCircleExtrude(featureId, entity, depth, color, plane)
    }
    return null
  }

  private buildLine(id: string, points: THREE.Vector3[], construction = false): MeshDescriptor {
    return {
      id: `sketch-${id}`,
      featureId: id,
      geometry: new THREE.BufferGeometry().setFromPoints(points),
      material: construction
        ? new THREE.LineDashedMaterial({ color: '#64748b', dashSize: 6, gapSize: 4 })
        : new THREE.LineBasicMaterial({ color: '#1d4ed8' }),
      kind: 'line'
    }
  }

  private buildRectangleExtrude(
    featureId: string,
    entity: RectangleEntity,
    depth: number,
    color = '#7c9cbf',
    plane: SketchPlane = 'XY'
  ): MeshDescriptor {
    const geometry = plane === 'XY'
      ? new THREE.BoxGeometry(entity.width, entity.height, depth)
      : plane === 'XZ'
        ? new THREE.BoxGeometry(entity.width, depth, entity.height)
        : new THREE.BoxGeometry(depth, entity.width, entity.height)
    if (plane === 'XY') {
      geometry.translate(entity.origin.x + entity.width / 2, entity.origin.y + entity.height / 2, depth / 2)
    } else if (plane === 'XZ') {
      geometry.translate(entity.origin.x + entity.width / 2, depth / 2, entity.origin.y + entity.height / 2)
    } else {
      geometry.translate(depth / 2, entity.origin.x + entity.width / 2, entity.origin.y + entity.height / 2)
    }
    return {
      id: `mesh-${featureId}`,
      featureId,
      geometry,
      material: new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
    }
  }

  private buildCircleExtrude(
    featureId: string,
    entity: CircleEntity,
    depth: number,
    color = '#8ab17d',
    plane: SketchPlane = 'XY'
  ): MeshDescriptor {
    const geometry = new THREE.CylinderGeometry(entity.radius, entity.radius, depth, 48)
    if (plane === 'XY') {
      geometry.rotateX(Math.PI / 2)
      geometry.translate(entity.center.x, entity.center.y, depth / 2)
    } else if (plane === 'XZ') {
      geometry.translate(entity.center.x, depth / 2, entity.center.y)
    } else {
      geometry.rotateZ(Math.PI / 2)
      geometry.translate(depth / 2, entity.center.x, entity.center.y)
    }
    return {
      id: `mesh-${featureId}`,
      featureId,
      geometry,
      material: new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
    }
  }

  private buildBoxFeature(feature: BoxFeature): MeshDescriptor {
    const geometry = new THREE.BoxGeometry(feature.length, feature.width, feature.height)
    geometry.translate(feature.position.x, feature.position.y, feature.position.z + feature.height / 2)
    this.applyFeatureRotation(geometry, feature.position, feature.height / 2, feature.rotation)
    return {
      id: `mesh-${feature.id}`,
      featureId: feature.id,
      geometry,
      material: new THREE.MeshStandardMaterial({ color: '#7c9cbf', roughness: 0.55 })
    }
  }

  private buildSphereFeature(feature: SphereFeature): MeshDescriptor {
    const geometry = new THREE.SphereGeometry(feature.radius, 48, 24)
    geometry.translate(feature.position.x, feature.position.y, feature.position.z + feature.radius)
    this.applyFeatureRotation(geometry, feature.position, feature.radius, feature.rotation)
    return {
      id: `mesh-${feature.id}`,
      featureId: feature.id,
      geometry,
      material: new THREE.MeshStandardMaterial({ color: '#8ab17d', roughness: 0.5 })
    }
  }

  private buildConeFeature(feature: ConeFeature): MeshDescriptor {
    const geometry = new THREE.ConeGeometry(feature.baseRadius, feature.height, 48)
    geometry.rotateX(Math.PI / 2)
    geometry.translate(feature.position.x, feature.position.y, feature.position.z + feature.height / 2)
    this.applyFeatureRotation(geometry, feature.position, feature.height / 2, feature.rotation)
    return {
      id: `mesh-${feature.id}`,
      featureId: feature.id,
      geometry,
      material: new THREE.MeshStandardMaterial({ color: '#c08457', roughness: 0.58 })
    }
  }

  private buildMeshFeature(feature: MeshFeature): MeshDescriptor | null {
    if (feature.vertices.length < 9) return null
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(feature.vertices, 3))
    if (feature.indices && feature.indices.length >= 3) {
      geometry.setIndex(feature.indices)
    }
    geometry.computeVertexNormals()
    const descriptor: MeshDescriptor = {
      id: `mesh-${feature.id}`,
      featureId: feature.id,
      geometry,
      material: new THREE.MeshStandardMaterial({ color: feature.color ?? '#94a3b8', roughness: 0.58 })
    }
    return this.applyDescriptorTransform(descriptor, feature)
  }

  private buildStoredBooleanResult(feature: BooleanFeature, fallbackColor: string): MeshDescriptor | null {
    const mesh = feature.resultMesh
    if (!mesh || mesh.vertices.length < 9) return null
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices, 3))
    if (mesh.indices && mesh.indices.length >= 3) {
      geometry.setIndex(mesh.indices)
    }
    geometry.computeVertexNormals()
    const descriptor: MeshDescriptor = {
      id: `mesh-${feature.id}`,
      featureId: feature.id,
      geometry,
      material: new THREE.MeshStandardMaterial({ color: mesh.color ?? fallbackColor, roughness: 0.58 })
    }
    return this.applyDescriptorTransform(descriptor, feature)
  }

  private pointToPlaneVector(point: Point2, plane: SketchPlane, normalOffset = 0): THREE.Vector3 {
    if (plane === 'XZ') {
      return new THREE.Vector3(point.x, normalOffset, point.y)
    }
    if (plane === 'YZ') {
      return new THREE.Vector3(normalOffset, point.x, point.y)
    }
    return new THREE.Vector3(point.x, point.y, normalOffset)
  }

  private applyFeatureRotation(geometry: THREE.BufferGeometry, position: Point2 & { z: number }, centerOffsetZ: number, rotation?: Point2 & { z: number }): void {
    if (!rotation || (!rotation.x && !rotation.y && !rotation.z)) return
    const center = new THREE.Vector3(position.x, position.y, position.z + centerOffsetZ)
    geometry.translate(-center.x, -center.y, -center.z)
    geometry.rotateX(THREE.MathUtils.degToRad(rotation.x || 0))
    geometry.rotateY(THREE.MathUtils.degToRad(rotation.y || 0))
    geometry.rotateZ(THREE.MathUtils.degToRad(rotation.z || 0))
    geometry.translate(center.x, center.y, center.z)
  }

  private applyDescriptorTransform(descriptor: MeshDescriptor, feature: Feature): MeshDescriptor {
    const geometry = descriptor.geometry
    const position = feature.position ?? { x: 0, y: 0, z: 0 }
    if (position.x || position.y || position.z) {
      geometry.translate(position.x, position.y, position.z)
    }

    const rotation = feature.rotation
    if (rotation && (rotation.x || rotation.y || rotation.z)) {
      geometry.computeBoundingBox()
      const center = new THREE.Vector3()
      geometry.boundingBox?.getCenter(center)
      geometry.translate(-center.x, -center.y, -center.z)
      geometry.rotateX(THREE.MathUtils.degToRad(rotation.x || 0))
      geometry.rotateY(THREE.MathUtils.degToRad(rotation.y || 0))
      geometry.rotateZ(THREE.MathUtils.degToRad(rotation.z || 0))
      geometry.translate(center.x, center.y, center.z)
    }

    return descriptor
  }

  private normalizeBooleanOperation(operation: string): NormalizedBooleanOperation {
    return operation === 'union' || operation === 'add' ? 'add' : 'subtract'
  }

  private serializeGeometry(geometry: THREE.BufferGeometry, color: string): BooleanResultMesh {
    const position = geometry.getAttribute('position')
    const index = geometry.getIndex()
    const vertices = Array.from(position.array as ArrayLike<number>)
    const indices = index ? Array.from(index.array as ArrayLike<number>) : undefined
    return {
      vertices,
      ...(indices && indices.length > 0 ? { indices } : {}),
      color
    }
  }

  private evaluateCsg(
    featureId: string,
    target: MeshDescriptor,
    tool: MeshDescriptor,
    operation: typeof ADDITION,
    color: string
  ): MeshDescriptor {
    const brushA = new Brush(target.geometry.clone())
    const brushB = new Brush(tool.geometry.clone())
    brushA.updateMatrixWorld()
    brushB.updateMatrixWorld()
    const result = this.evaluator.evaluate(brushA, brushB, operation)
    return {
      id: `mesh-${featureId}`,
      featureId,
      geometry: result.geometry,
      material: new THREE.MeshStandardMaterial({ color, roughness: 0.58 })
    }
  }
}

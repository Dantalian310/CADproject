import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CadDocument, Point2, Point3, RectangleEntity, SketchConstraint, SketchEntity, SketchPlane } from '@/cad/model/document'
import type { CadSelection } from '@/cad/model/selection'
import { buildDimensionAnnotations, type DimensionAnnotation } from './sketchDimensionAnnotations'
import { constraintLabel } from './sketchConstraints'
import { arcEndPoint, arcMidPoint, arcStartPoint, sampleArcPoints } from './sketchArcGeometry'
import type { GeometryKernel } from './geometryKernel'

export type CadViewPreset = 'top' | 'front' | 'right' | 'isometric'

export interface SketchSnapMarker {
  point: Point2
  label: string
}

export class SceneManager {
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000)
  private raycaster = new THREE.Raycaster()
  private controls: OrbitControls | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private container: HTMLElement | null = null
  private sketchGrids: THREE.GridHelper[] = []
  private currentGridSize = 0
  private currentGridWorldSize = 400
  private activeSketchPlane: SketchPlane = 'XY'
  private objects: THREE.Object3D[] = []
  private animationFrame = 0
  private featureTransformBaselines: Array<{
    object: THREE.Object3D
    position: THREE.Vector3
    quaternion: THREE.Quaternion
    scale: THREE.Vector3
  }> = []

  constructor(private readonly kernel: GeometryKernel) {
    this.scene.background = new THREE.Color('#e7ebf0')
    this.camera.position.set(160, -180, 140)
    this.camera.lookAt(0, 0, 0)
    this.setGridSize(5)
    this.scene.add(new THREE.AxesHelper(120))
    this.addAxisDirectionLabels()
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.8))
    const light = new THREE.DirectionalLight('#ffffff', 1)
    light.position.set(80, -120, 160)
    this.scene.add(light)
  }

  init(container: HTMLElement): void {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(this.renderer.domElement)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.screenSpacePanning = true
    this.controls.minDistance = 30
    this.controls.maxDistance = 2000
    this.controls.mouseButtons = {
      LEFT: undefined,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE
    }
    this.controls.target.set(0, 0, 0)
    this.controls.update()
    this.resize()
    this.startRenderLoop()
  }

  rebuild(
    document: CadDocument,
    selection: CadSelection | null = null,
    draftEntity: SketchEntity | null = null,
    snapMarker: SketchSnapMarker | null = null,
    previewEntities: SketchEntity[] = []
  ): void {
    this.clearObjects()
    const descriptors = this.kernel.buildDocument(document)
    this.updateGridExtentFromDescriptors(descriptors)
    for (const descriptor of descriptors) {
      const mesh = descriptor.kind === 'line'
        ? this.createLineObject(descriptor.geometry, descriptor.material)
        : new THREE.Mesh(descriptor.geometry, descriptor.material)
      mesh.userData.featureId = descriptor.featureId
      mesh.userData.pickableFeature = Boolean(descriptor.featureId && descriptor.kind !== 'line')
      this.objects.push(mesh)
      this.scene.add(mesh)
    }
    this.addConstraintOverlays(document)
    this.addSelectionOverlay(document, selection)
    for (const previewEntity of previewEntities) {
      this.addSketchEntityOverlay(previewEntity, this.activeSketchPlane, '#0ea5e9', true, '#0369a1')
    }
    if (draftEntity) {
      this.addSketchEntityOverlay(draftEntity, this.activeSketchPlane, '#16a34a', true)
    }
    if (snapMarker) {
      this.addSnapMarker(snapMarker)
    }
    this.render()
  }

  setActiveSketchPlane(plane: SketchPlane): void {
    this.activeSketchPlane = plane
    this.updateGridStyles()
    this.render()
  }

  screenToSketchPoint(clientX: number, clientY: number, plane: SketchPlane = this.activeSketchPlane): Point2 | null {
    if (!this.container || !this.renderer) return null
    const rect = this.renderer.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    this.raycaster.setFromCamera(mouse, this.camera)
    const sketchPlane = this.planeForSketch(plane, 1)
    const intersection = new THREE.Vector3()
    const hit = this.raycaster.ray.intersectPlane(sketchPlane, intersection)
    if (!hit) return null
    return this.vectorToPlanePoint(intersection, plane)
  }

  screenToCameraPlanePoint(clientX: number, clientY: number, anchor: Point3): Point3 | null {
    if (!this.renderer) return null
    const rect = this.renderer.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    this.raycaster.setFromCamera(mouse, this.camera)
    const normal = new THREE.Vector3()
    this.camera.getWorldDirection(normal)
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(anchor.x, anchor.y, anchor.z))
    const intersection = new THREE.Vector3()
    const hit = this.raycaster.ray.intersectPlane(plane, intersection)
    if (!hit) return null
    return { x: intersection.x, y: intersection.y, z: intersection.z }
  }

  pickFeature(clientX: number, clientY: number): string | null {
    if (!this.renderer) return null
    const rect = this.renderer.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    this.raycaster.setFromCamera(mouse, this.camera)
    const hits = this.raycaster.intersectObjects(
      this.objects.filter((object) => object.userData.pickableFeature),
      false
    )
    return typeof hits[0]?.object.userData.featureId === 'string' ? hits[0].object.userData.featureId : null
  }

  beginFeatureTransform(featureIds: string[]): void {
    const selected = new Set(featureIds)
    this.featureTransformBaselines = this.objects
      .filter((object) => typeof object.userData.featureId === 'string' && selected.has(object.userData.featureId))
      .map((object) => ({
        object,
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
        scale: object.scale.clone()
      }))
  }

  previewFeatureTranslation(delta: Point3): void {
    for (const baseline of this.featureTransformBaselines) {
      baseline.object.position.set(
        baseline.position.x + delta.x,
        baseline.position.y + delta.y,
        baseline.position.z + delta.z
      )
    }
    this.render()
  }

  endFeatureTransform(reset = false): void {
    if (reset) {
      for (const baseline of this.featureTransformBaselines) {
        baseline.object.position.copy(baseline.position)
        baseline.object.quaternion.copy(baseline.quaternion)
        baseline.object.scale.copy(baseline.scale)
      }
      this.render()
    }
    this.featureTransformBaselines = []
  }

  getFeaturesInScreenBox(start: Point2, end: Point2): string[] {
    if (!this.renderer) return []
    const rect = this.renderer.domElement.getBoundingClientRect()
    const minX = Math.min(start.x, end.x)
    const maxX = Math.max(start.x, end.x)
    const minY = Math.min(start.y, end.y)
    const maxY = Math.max(start.y, end.y)
    const selected = new Set<string>()

    for (const object of this.objects.filter((item) => item.userData.pickableFeature)) {
      const box = new THREE.Box3().setFromObject(object)
      if (box.isEmpty()) continue
      const points = this.boxCorners(box)
      const projected = points
        .map((point) => point.project(this.camera))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.z >= -1 && point.z <= 1)
        .map((point) => ({
          x: ((point.x + 1) / 2) * rect.width,
          y: ((-point.y + 1) / 2) * rect.height
        }))
      if (projected.length === 0) continue
      const bounds = {
        minX: Math.min(...projected.map((point) => point.x)),
        maxX: Math.max(...projected.map((point) => point.x)),
        minY: Math.min(...projected.map((point) => point.y)),
        maxY: Math.max(...projected.map((point) => point.y))
      }
      if (bounds.minX <= maxX && bounds.maxX >= minX && bounds.minY <= maxY && bounds.maxY >= minY) {
        const featureId = object.userData.featureId
        if (typeof featureId === 'string') selected.add(featureId)
      }
    }

    return [...selected]
  }

  getFeatureWorldCenter(featureId: string): Point3 | null {
    const candidates = this.objects.filter((object) =>
      object.userData.pickableFeature && object.userData.featureId === featureId
    )
    if (candidates.length === 0) return null
    const box = new THREE.Box3()
    for (const candidate of candidates) {
      box.expandByObject(candidate)
    }
    if (box.isEmpty()) return null
    const center = new THREE.Vector3()
    box.getCenter(center)
    return { x: center.x, y: center.y, z: center.z }
  }

  sketchPointToScreen(point: Point2, plane: SketchPlane = this.activeSketchPlane, normalOffset = 18): Point2 | null {
    if (!this.renderer) return null
    const rect = this.renderer.domElement.getBoundingClientRect()
    const projected = this.pointToPlaneVector(point, plane, normalOffset).project(this.camera)
    if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y) || projected.z < -1 || projected.z > 1) {
      return null
    }
    return {
      x: ((projected.x + 1) / 2) * rect.width,
      y: ((-projected.y + 1) / 2) * rect.height
    }
  }

  resize(): void {
    if (!this.container || !this.renderer) return
    const width = this.container.clientWidth || 800
    const height = this.container.clientHeight || 600
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.render()
  }

  setGridSize(gridSize: number): void {
    const safeGridSize = Math.max(1, Number.isFinite(gridSize) ? gridSize : 5)
    if (safeGridSize === this.currentGridSize && this.sketchGrids.length > 0) return
    this.currentGridSize = safeGridSize
    this.rebuildGrids(this.currentGridWorldSize)
    this.render()
  }

  setViewPreset(preset: CadViewPreset): void {
    const distance = Math.max(320, this.camera.position.distanceTo(this.controls?.target ?? new THREE.Vector3(0, 0, 0)))
    const target = this.controls?.target ?? new THREE.Vector3(0, 0, 0)
    const position = new THREE.Vector3()

    if (preset === 'top') {
      position.set(target.x, target.y, target.z + distance)
    }
    if (preset === 'front') {
      position.set(target.x, target.y - distance, target.z + 2)
    }
    if (preset === 'right') {
      position.set(target.x + distance, target.y, target.z + 2)
    }
    if (preset === 'isometric') {
      position.set(target.x + distance * 0.65, target.y - distance * 0.8, target.z + distance * 0.55)
    }

    this.camera.position.copy(position)
    this.camera.lookAt(target)
    this.controls?.update()
    this.render()
  }

  fitToDocument(document: CadDocument | null): void {
    const box = new THREE.Box3()
    for (const descriptor of document ? this.kernel.buildDocument(document) : []) {
      descriptor.geometry.computeBoundingBox()
      if (descriptor.geometry.boundingBox) {
        box.union(descriptor.geometry.boundingBox)
      }
    }

    if (box.isEmpty()) {
      box.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(360, 360, 120))
    }

    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxSize = Math.max(size.x, size.y, size.z, 120)
    const distance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.7

    this.controls?.target.copy(center)
    this.camera.position.set(center.x + distance * 0.65, center.y - distance * 0.8, center.z + distance * 0.55)
    this.camera.near = Math.max(0.1, distance / 1000)
    this.camera.far = Math.max(10000, distance * 10)
    this.camera.updateProjectionMatrix()
    this.controls?.update()
    this.render()
  }

  render(): void {
    this.renderer?.render(this.scene, this.camera)
  }

  dispose(): void {
    if (this.animationFrame) {
      window.cancelAnimationFrame(this.animationFrame)
      this.animationFrame = 0
    }
    this.clearObjects()
    this.disposeGrids()
    this.controls?.dispose()
    this.controls = null
    this.renderer?.dispose()
    this.renderer?.domElement.remove()
    this.renderer = null
    this.container = null
  }


  private createLineObject(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Line {
    const line = new THREE.Line(geometry, material)
    if (material instanceof THREE.LineDashedMaterial) {
      line.computeLineDistances()
    }
    return line
  }
  private clearObjects(): void {
    for (const object of this.objects) {
      object.traverse((child) => {
        const renderObject = child as THREE.Object3D & {
          geometry?: THREE.BufferGeometry
          material?: THREE.Material | THREE.Material[]
        }
        renderObject.geometry?.dispose()
        const material = renderObject.material
        if (Array.isArray(material)) {
          material.forEach((item) => this.disposeMaterial(item))
        } else {
          if (material) this.disposeMaterial(material)
        }
      })
      this.scene.remove(object)
    }
    this.objects = []
  }

  private disposeMaterial(material: THREE.Material): void {
    const mappedMaterial = material as THREE.Material & { map?: THREE.Texture }
    mappedMaterial.map?.dispose()
    material.dispose()
  }

  private disposeGrids(): void {
    for (const grid of this.sketchGrids) {
      this.scene.remove(grid)
      grid.geometry.dispose()
      const material = grid.material
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose())
      } else {
        material.dispose()
      }
    }
    this.sketchGrids = []
  }

  private rebuildGrids(worldSize: number): void {
    this.disposeGrids()
    const divisions = Math.max(4, Math.min(600, Math.round(worldSize / Math.max(1, this.currentGridSize))))
    this.currentGridWorldSize = worldSize
    this.sketchGrids = [
      this.createPlaneGrid('XY', worldSize, divisions),
      this.createPlaneGrid('XZ', worldSize, divisions),
      this.createPlaneGrid('YZ', worldSize, divisions)
    ]
    this.updateGridStyles()
    for (const grid of this.sketchGrids) {
      this.scene.add(grid)
    }
  }

  private createPlaneGrid(plane: SketchPlane, worldSize: number, divisions: number): THREE.GridHelper {
    const grid = new THREE.GridHelper(worldSize, divisions, '#94a3b8', '#d1d5db')
    grid.userData.plane = plane
    if (plane === 'XY') {
      grid.rotateX(Math.PI / 2)
    }
    if (plane === 'YZ') {
      grid.rotateZ(Math.PI / 2)
    }
    return grid
  }

  private updateGridExtentFromDescriptors(descriptors: ReturnType<GeometryKernel['buildDocument']>): void {
    const box = new THREE.Box3()
    for (const descriptor of descriptors) {
      descriptor.geometry.computeBoundingBox()
      if (descriptor.geometry.boundingBox) {
        box.union(descriptor.geometry.boundingBox)
      }
    }
    let worldSize = 400
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const halfSpan = Math.max(
        Math.abs(center.x) + size.x / 2,
        Math.abs(center.y) + size.y / 2,
        Math.abs(center.z) + size.z / 2,
        160
      )
      const padded = halfSpan * 2 + Math.max(80, this.currentGridSize * 8)
      worldSize = Math.max(400, Math.ceil(padded / this.currentGridSize) * this.currentGridSize)
    }
    if (Math.abs(worldSize - this.currentGridWorldSize) >= this.currentGridSize * 4 || this.sketchGrids.length === 0) {
      this.rebuildGrids(worldSize)
    }
  }

  private updateGridStyles(): void {
    for (const grid of this.sketchGrids) {
      const material = grid.material
      const materials = Array.isArray(material) ? material : [material]
      const isActive = grid.userData.plane === this.activeSketchPlane
      for (const item of materials) {
        item.transparent = true
        item.opacity = isActive ? 0.5 : 0.18
        item.depthWrite = false
      }
    }
  }

  private boxCorners(box: THREE.Box3): THREE.Vector3[] {
    return [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z)
    ]
  }

  private startRenderLoop(): void {
    const renderFrame = () => {
      this.controls?.update()
      this.render()
      this.animationFrame = window.requestAnimationFrame(renderFrame)
    }
    renderFrame()
  }

  private addSelectionOverlay(document: CadDocument, selection: CadSelection | null): void {
    if (selection?.kind === 'sketch-entity') {
      const entity = document.sketches
        .find((sketch) => sketch.id === selection.sketchId)
        ?.entities.find((item) => item.id === selection.entityId)
      if (entity?.visible) {
        const sketch = document.sketches.find((item) => item.id === selection.sketchId)
        this.addSketchEntityOverlay(entity, sketch?.plane ?? 'XY', '#f59e0b', false)
      }
    }

    if (selection?.kind === 'sketch-entities') {
      for (const selected of selection.entities) {
        const entity = document.sketches
          .find((sketch) => sketch.id === selected.sketchId)
          ?.entities.find((item) => item.id === selected.entityId)
        if (entity?.visible) {
          const sketch = document.sketches.find((item) => item.id === selected.sketchId)
          this.addSketchEntityOverlay(entity, sketch?.plane ?? 'XY', '#f59e0b', false)
        }
      }
    }

    if (selection?.kind === 'feature') {
      const descriptor = this.kernel.buildDocument(document).find((item) => item.featureId === selection.featureId)
      if (!descriptor) return
      this.addFeatureSelectionMesh(descriptor.geometry, descriptor.featureId)
    }

    if (selection?.kind === 'features') {
      const descriptors = this.kernel.buildDocument(document)
      for (const featureId of selection.featureIds) {
        const descriptor = descriptors.find((item) => item.featureId === featureId)
        if (descriptor) this.addFeatureSelectionMesh(descriptor.geometry, descriptor.featureId)
      }
    }
  }

  private addFeatureSelectionMesh(geometry: THREE.BufferGeometry, featureId: string): void {
    const mesh = new THREE.Mesh(
      geometry.clone(),
      new THREE.MeshBasicMaterial({ color: '#f59e0b', wireframe: true, transparent: true, opacity: 0.9 })
    )
    mesh.userData.featureId = featureId
    this.objects.push(mesh)
    this.scene.add(mesh)
  }

  private addConstraintOverlays(document: CadDocument): void {
    for (const annotation of buildDimensionAnnotations(document)) {
      this.addDimensionAnnotation(annotation, annotation.sketchPlane, '#2563eb')
    }

    for (const sketch of document.sketches) {
      for (const constraint of sketch.constraints) {
        if (constraint.type === 'dimension') continue
        const entity = sketch.entities.find((item) => item.id === constraint.entityId)
        if (!entity?.visible) continue
        this.addConstraintBadge(constraint, entity, sketch.plane)
      }
    }
  }

  private addDimensionAnnotation(annotation: DimensionAnnotation, plane: SketchPlane, color: string): void {
    const points = annotation.guidePoints.map((point) => this.pointToPlaneVector(point, plane, 10))
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 })
    )
    this.objects.push(line)
    this.scene.add(line)

    for (const point of annotation.guidePoints) {
      const marker = new THREE.Mesh(
        new THREE.CircleGeometry(2.6, 16),
        new THREE.MeshBasicMaterial({ color, depthTest: false })
      )
      marker.position.copy(this.pointToPlaneVector(point, plane, 11))
      this.objects.push(marker)
      this.scene.add(marker)
    }

    this.addTextLabel(annotation.label, annotation.labelPoint, plane, color)
  }

  private addConstraintBadge(constraint: SketchConstraint, entity: SketchEntity, plane: SketchPlane): void {
    const point = this.entityBadgePoint(entity)
    const color = constraint.type === 'fixed' ? '#dc2626' : '#0f766e'
    this.addTextLabel(constraintLabel(constraint), point, plane, color)
  }

  private addSketchEntityOverlay(
    entity: SketchEntity,
    plane: SketchPlane,
    color: string,
    draft: boolean,
    dimensionColor = draft ? '#15803d' : '#92400e'
  ): void {
    const material = new THREE.LineBasicMaterial({ color, transparent: draft, opacity: draft ? 0.72 : 1 })
    const line = new THREE.Line(this.createSketchGeometry(entity, 3, plane), material)
    this.objects.push(line)
    this.scene.add(line)
    this.addDimensionOverlay(entity, plane, dimensionColor)

    if (!draft) {
      for (const point of this.getHandlePoints(entity)) {
        const handle = new THREE.Mesh(
          new THREE.SphereGeometry(3, 16, 16),
          new THREE.MeshBasicMaterial({ color: '#f59e0b' })
        )
        handle.position.copy(this.pointToPlaneVector(point, plane, 6))
        this.objects.push(handle)
        this.scene.add(handle)
      }
    }
  }

  private createSketchGeometry(entity: SketchEntity, z: number, plane: SketchPlane): THREE.BufferGeometry {
    if (entity.type === 'line') {
      return new THREE.BufferGeometry().setFromPoints([
        this.pointToPlaneVector(entity.start, plane, z),
        this.pointToPlaneVector(entity.end, plane, z)
      ])
    }
    if (entity.type === 'rectangle') {
      const points = this.rectanglePoints(entity, z, plane)
      return new THREE.BufferGeometry().setFromPoints([...points, points[0]])
    }
    if (entity.type === 'arc') {
      return new THREE.BufferGeometry().setFromPoints(
        sampleArcPoints(entity).map((point) => this.pointToPlaneVector(point, plane, z))
      )
    }
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 72; i += 1) {
      const angle = (Math.PI * 2 * i) / 72
      points.push(this.pointToPlaneVector({
        x: entity.center.x + Math.cos(angle) * entity.radius,
        y: entity.center.y + Math.sin(angle) * entity.radius
      }, plane, z))
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }

  private rectanglePoints(entity: RectangleEntity, z: number, plane: SketchPlane): THREE.Vector3[] {
    const x = entity.origin.x
    const y = entity.origin.y
    const w = entity.width
    const h = entity.height
    return [
      this.pointToPlaneVector({ x, y }, plane, z),
      this.pointToPlaneVector({ x: x + w, y }, plane, z),
      this.pointToPlaneVector({ x: x + w, y: y + h }, plane, z),
      this.pointToPlaneVector({ x, y: y + h }, plane, z)
    ]
  }

  private getHandlePoints(entity: SketchEntity): Point2[] {
    if (entity.type === 'line') {
      return [entity.start, entity.end]
    }
    if (entity.type === 'rectangle') {
      return [
        entity.origin,
        { x: entity.origin.x + entity.width, y: entity.origin.y },
        { x: entity.origin.x + entity.width, y: entity.origin.y + entity.height },
        { x: entity.origin.x, y: entity.origin.y + entity.height }
      ]
    }
    if (entity.type === 'arc') {
      return [
        entity.center,
        arcStartPoint(entity),
        arcMidPoint(entity),
        arcEndPoint(entity)
      ]
    }
    return [
      entity.center,
      { x: entity.center.x + entity.radius, y: entity.center.y }
    ]
  }

  private addDimensionOverlay(entity: SketchEntity, plane: SketchPlane, color: string): void {
    if (entity.type === 'line') {
      const length = this.distance(entity.start, entity.end)
      const midpoint = {
        x: (entity.start.x + entity.end.x) / 2,
        y: (entity.start.y + entity.end.y) / 2
      }
      const dx = entity.end.x - entity.start.x
      const dy = entity.end.y - entity.start.y
      const normalLength = Math.max(1, Math.hypot(dx, dy))
      const offset = { x: (-dy / normalLength) * 14, y: (dx / normalLength) * 14 }
      this.addTextLabel(`${this.formatNumber(length)} mm`, { x: midpoint.x + offset.x, y: midpoint.y + offset.y }, plane, color)
      return
    }

    if (entity.type === 'rectangle') {
      this.addTextLabel(
        `W ${this.formatNumber(entity.width)} mm`,
        { x: entity.origin.x + entity.width / 2, y: entity.origin.y - 14 },
        plane,
        color
      )
      this.addTextLabel(
        `H ${this.formatNumber(entity.height)} mm`,
        { x: entity.origin.x + entity.width + 18, y: entity.origin.y + entity.height / 2 },
        plane,
        color
      )
      return
    }

    if (entity.type === 'arc') {
      this.addTextLabel(
        `R ${this.formatNumber(entity.radius)} mm`,
        { x: arcMidPoint(entity).x + 16, y: arcMidPoint(entity).y + 16 },
        plane,
        color
      )
      return
    }

    this.addTextLabel(
      `R ${this.formatNumber(entity.radius)} mm`,
      { x: entity.center.x + entity.radius + 18, y: entity.center.y + entity.radius * 0.35 },
      plane,
      color
    )
  }

  private addTextLabel(text: string, point: Point2, plane: SketchPlane, color: string): void {
    const sprite = this.createTextSprite(text, color)
    sprite.position.copy(this.pointToPlaneVector(point, plane, 18))
    this.objects.push(sprite)
    this.scene.add(sprite)
  }

  private addAxisDirectionLabels(): void {
    if (!globalThis.document) return
    const labels: Array<{ text: string; color: string; position: Point3 }> = [
      { text: '+X', color: '#dc2626', position: { x: 142, y: 0, z: 0 } },
      { text: '+Y', color: '#16a34a', position: { x: 0, y: 142, z: 0 } },
      { text: '+Z', color: '#2563eb', position: { x: 0, y: 0, z: 142 } }
    ]
    for (const label of labels) {
      const sprite = this.createTextSprite(label.text, label.color)
      sprite.position.set(label.position.x, label.position.y, label.position.z)
      this.scene.add(sprite)
    }
  }

  private entityBadgePoint(entity: SketchEntity): Point2 {
    if (entity.type === 'line') {
      return {
        x: (entity.start.x + entity.end.x) / 2 + 16,
        y: (entity.start.y + entity.end.y) / 2 + 16
      }
    }
    if (entity.type === 'rectangle') {
      return {
        x: entity.origin.x + entity.width + 16,
        y: entity.origin.y + entity.height + 16
      }
    }
    if (entity.type === 'arc') {
      const point = arcMidPoint(entity)
      return { x: point.x + 16, y: point.y + 16 }
    }
    return {
      x: entity.center.x + entity.radius + 16,
      y: entity.center.y - entity.radius - 16
    }
  }

  private addSnapMarker(marker: SketchSnapMarker): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.5, 6.5, 32),
      new THREE.MeshBasicMaterial({ color: '#2563eb', transparent: true, opacity: 0.88, depthTest: false })
    )
    ring.position.copy(this.pointToPlaneVector(marker.point, this.activeSketchPlane, 12))
    this.objects.push(ring)
    this.scene.add(ring)

    const cross = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([
        this.pointToPlaneVector({ x: marker.point.x - 9, y: marker.point.y }, this.activeSketchPlane, 13),
        this.pointToPlaneVector({ x: marker.point.x + 9, y: marker.point.y }, this.activeSketchPlane, 13),
        this.pointToPlaneVector({ x: marker.point.x, y: marker.point.y - 9 }, this.activeSketchPlane, 13),
        this.pointToPlaneVector({ x: marker.point.x, y: marker.point.y + 9 }, this.activeSketchPlane, 13)
      ]),
      new THREE.LineBasicMaterial({ color: '#2563eb', depthTest: false })
    )
    this.objects.push(cross)
    this.scene.add(cross)

    this.addTextLabel(marker.label, { x: marker.point.x + 20, y: marker.point.y + 16 }, this.activeSketchPlane, '#2563eb')
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

  private vectorToPlanePoint(vector: THREE.Vector3, plane: SketchPlane): Point2 {
    if (plane === 'XZ') {
      return { x: vector.x, y: vector.z }
    }
    if (plane === 'YZ') {
      return { x: vector.y, y: vector.z }
    }
    return { x: vector.x, y: vector.y }
  }

  private planeForSketch(plane: SketchPlane, normalOffset = 0): THREE.Plane {
    if (plane === 'XZ') {
      return new THREE.Plane(new THREE.Vector3(0, 1, 0), -normalOffset)
    }
    if (plane === 'YZ') {
      return new THREE.Plane(new THREE.Vector3(1, 0, 0), -normalOffset)
    }
    return new THREE.Plane(new THREE.Vector3(0, 0, 1), -normalOffset)
  }

  private createTextSprite(text: string, color: string): THREE.Sprite {
    const canvas = globalThis.document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = 256
    canvas.height = 72

    if (context) {
      context.font = '600 24px Segoe UI, Arial, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillStyle = 'rgba(255, 255, 255, 0.92)'
      this.roundedRect(context, 8, 10, 240, 52, 8)
      context.fill()
      context.strokeStyle = color
      context.lineWidth = 3
      this.roundedRect(context, 8, 10, 240, 52, 8)
      context.stroke()
      context.fillStyle = color
      context.fillText(text, 128, 36)
    }

    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
    const sprite = new THREE.Sprite(material)
    sprite.scale.set(72, 20, 1)
    return sprite
  }

  private roundedRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    context.beginPath()
    context.moveTo(x + radius, y)
    context.lineTo(x + width - radius, y)
    context.quadraticCurveTo(x + width, y, x + width, y + radius)
    context.lineTo(x + width, y + height - radius)
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    context.lineTo(x + radius, y + height)
    context.quadraticCurveTo(x, y + height, x, y + height - radius)
    context.lineTo(x, y + radius)
    context.quadraticCurveTo(x, y, x + radius, y)
    context.closePath()
  }

  private distance(a: Point2, b: Point2): number {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  private formatNumber(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
  }
}

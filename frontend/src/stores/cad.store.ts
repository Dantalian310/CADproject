import { defineStore } from 'pinia'
import { getDocument, saveDocument } from '@/api/document.api'
import type { AssemblyConstraint, BooleanFeature, BooleanResultMesh, CadDocument, Feature, Point2, Point3, Sketch, SketchConstraint, SketchEntity, SketchPlane } from '@/cad/model/document'
import { createEmptyCadDocument } from '@/cad/model/document'
import { createCadId } from '@/cad/model/ids'
import type { CadOperation, CadOperationType } from '@/cad/model/operation'
import type { CadSelection } from '@/cad/model/selection'
import {
  getSketchEntitiesCenter,
  mirrorSketchEntity,
  mirrorSketchEntityAcrossLine,
  offsetSketchEntity,
  rotateSketchEntity,
  translateSketchEntity as transformTranslateSketchEntity,
  type SketchMirrorAxis
} from '@/cad/geometry/sketchTransforms'
import { createLineChamfer, createLineFillet } from '@/cad/geometry/sketchCornerOperations'
import { makeArcFromCenterPoints } from '@/cad/geometry/sketchArcGeometry'
import {
  applyRelationConstraint,
  applyConstraintsToEntity,
  createDimensionConstraintForEntity,
  isConstraintApplicable,
  isRelationConstraint,
  isRelationConstraintApplicable,
  type RelationConstraintKind
} from '@/cad/geometry/sketchConstraints'
import { defaultSketchSnapSettings, type SketchSnapSettings } from '@/cad/geometry/sketchSnapSettings'
import { ThreeGeometryKernel } from '@/cad/geometry/threeGeometryKernel'
import type { CadCommand } from '@/cad/commands/command'
import { HistoryStack } from '@/cad/commands/historyStack'
import { useStatusStore } from './status.store'

export type CadToolType =
  | 'select'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'arc'
  | 'fixed'
  | 'horizontal'
  | 'vertical'
  | 'dimension'
  | 'concentric'
  | 'equalRadius'
  | 'parallel'
  | 'perpendicular'
  | 'tangent'
  | 'extrude'
  | 'cut'
  | 'union'
  | 'difference'
  | 'booleanAdd'
  | 'booleanSubtract'

interface CadState {
  document: CadDocument | null
  selection: CadSelection | null
  transformPreviewEntities: SketchEntity[]
  sketchSnapSettings: SketchSnapSettings
  activeTool: CadToolType
  constructionMode: boolean
  dirty: boolean
  currentVersion: number
  activeSketchPlane: SketchPlane
  history: HistoryStack
  historyRevision: number
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function cloneFeatureForTransform(feature: Feature): Feature {
  return {
    ...feature,
    position: feature.position ? { ...feature.position } : undefined,
    rotation: feature.rotation ? { ...feature.rotation } : undefined
  } as Feature
}

function cloneDocumentWithFeature(document: CadDocument, feature: Feature): CadDocument | null {
  let replaced = false
  const features = document.features.map((item) => {
    if (item.id !== feature.id) return item
    replaced = true
    return cloneFeatureForTransform(feature)
  })
  if (!replaced) return null
  return {
    ...document,
    metadata: { ...document.metadata },
    features
  }
}

function cloneDocumentWithFeatures(document: CadDocument, updates: Array<{ feature: Feature }>): CadDocument | null {
  const updateMap = new Map(updates.map((update) => [update.feature.id, update.feature]))
  if (updateMap.size === 0) return null
  let replaced = false
  const features = document.features.map((item) => {
    const update = updateMap.get(item.id)
    if (!update) return item
    replaced = true
    return cloneFeatureForTransform(update)
  })
  if (!replaced) return null
  return {
    ...document,
    metadata: { ...document.metadata },
    features
  }
}

function slimFeatureForComparison(feature: Feature): unknown {
  if (feature.type === 'boolean') {
    const { resultMesh, ...rest } = feature
    return {
      ...rest,
      hasResultMesh: Boolean(resultMesh?.vertices.length)
    }
  }
  if (feature.type === 'mesh') {
    const { vertices, indices, ...rest } = feature
    return {
      ...rest,
      vertexCount: vertices.length,
      indexCount: indices?.length ?? 0
    }
  }
  return feature
}

function featureChanged(before: Feature, after: Feature): boolean {
  return JSON.stringify(slimFeatureForComparison(before)) !== JSON.stringify(slimFeatureForComparison(after))
}

function createSnapshotCommand(
  before: CadDocument,
  after: CadDocument,
  type: CadOperationType,
  targetId: string,
  payload: Record<string, unknown>
): CadCommand {
  return {
    id: createCadId('cmd'),
    type,
    execute: () => cloneValue(after),
    undo: () => cloneValue(before),
    toOperation(documentId: number, baseVersion: number): CadOperation {
      return {
        operationId: createCadId('op'),
        documentId,
        type,
        targetId,
        baseVersion,
        payload,
        clientTimestamp: new Date().toISOString()
      }
    }
  }
}

function sketchNameForPlane(plane: SketchPlane): string {
  return `${plane} Sketch`
}

function findSketchByPlane(document: CadDocument, plane: SketchPlane): Sketch | null {
  return document.sketches.find((sketch) => sketch.plane === plane) ?? null
}

function resolveSketchForPlane(document: CadDocument, plane: SketchPlane): Pick<Sketch, 'id' | 'name' | 'plane'> & { entityCount: number } {
  const existing = findSketchByPlane(document, plane)
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      plane: existing.plane,
      entityCount: existing.entities.length
    }
  }
  return {
    id: createCadId('sketch'),
    name: sketchNameForPlane(plane),
    plane,
    entityCount: 0
  }
}

function getOrCreateSketch(draft: CadDocument, sketchInfo: Pick<Sketch, 'id' | 'name' | 'plane'>): Sketch {
  const existing = draft.sketches.find((sketch) => sketch.id === sketchInfo.id)
  if (existing) return existing
  const sketch: Sketch = {
    id: sketchInfo.id,
    name: sketchInfo.name,
    plane: sketchInfo.plane,
    entities: [],
    constraints: []
  }
  draft.sketches.push(sketch)
  return sketch
}

function findSketchEntity(document: CadDocument, sketchId: string, entityId: string): SketchEntity | null {
  return document.sketches
    .find((sketch) => sketch.id === sketchId)
    ?.entities.find((entity) => entity.id === entityId) ?? null
}

function findSketchConstraints(document: CadDocument, sketchId: string, entityId: string): SketchConstraint[] {
  return document.sketches
    .find((sketch) => sketch.id === sketchId)
    ?.constraints.filter((constraint) => constraint.entityId === entityId || (isRelationConstraint(constraint) && constraint.targetEntityId === entityId)) ?? []
}

function findConstraintLocation(document: CadDocument, constraintId: string) {
  for (const sketch of document.sketches) {
    const constraintIndex = sketch.constraints.findIndex((constraint) => constraint.id === constraintId)
    if (constraintIndex >= 0) {
      const constraint = sketch.constraints[constraintIndex]
      const entity = sketch.entities.find((item) => item.id === constraint.entityId) ?? null
      return { sketch, constraint, constraintIndex, entity }
    }
  }
  return null
}

interface SelectedSketchEntity {
  sketchId: string
  entity: SketchEntity
}

interface SelectedFeature {
  feature: Feature
}

interface SketchEntityUpdate {
  sketchId: string
  before: SketchEntity
  after: SketchEntity
}

interface FeatureUpdate {
  before: Feature
  after: Feature
}

function findSelectedSketchEntities(document: CadDocument, selection: CadSelection | null): SelectedSketchEntity[] {
  if (!selection) return []
  if (selection.kind === 'sketch-entity') {
    const entity = findSketchEntity(document, selection.sketchId, selection.entityId)
    return entity ? [{ sketchId: selection.sketchId, entity }] : []
  }
  if (selection.kind === 'sketch-entities') {
    return selection.entities.flatMap((item) => {
      const entity = findSketchEntity(document, item.sketchId, item.entityId)
      return entity ? [{ sketchId: item.sketchId, entity }] : []
    })
  }
  return []
}

function findSelectedFeatures(document: CadDocument, selection: CadSelection | null): SelectedFeature[] {
  if (!selection) return []
  if (selection.kind === 'feature') {
    const feature = document.features.find((item) => item.id === selection.featureId)
    return feature ? [{ feature }] : []
  }
  if (selection.kind === 'features') {
    return selection.featureIds.flatMap((featureId) => {
      const feature = document.features.find((item) => item.id === featureId)
      return feature ? [{ feature }] : []
    })
  }
  return []
}

function replaceSketchEntity(document: CadDocument, sketchId: string, entity: SketchEntity): boolean {
  const sketch = document.sketches.find((item) => item.id === sketchId)
  if (!sketch) return false
  const index = sketch.entities.findIndex((item) => item.id === entity.id)
  if (index < 0) return false
  sketch.entities[index] = cloneValue(entity)
  return true
}

function constrainSketchEntity(document: CadDocument, sketchId: string, entity: SketchEntity, previousEntity?: SketchEntity): SketchEntity {
  return applyConstraintsToEntity(entity, findSketchConstraints(document, sketchId, entity.id), previousEntity)
}

function applyRelationConstraintsToDocument(document: CadDocument): void {
  for (const sketch of document.sketches) {
    for (const constraint of sketch.constraints) {
      if (!isRelationConstraint(constraint)) continue
      const source = sketch.entities.find((entity) => entity.id === constraint.entityId)
      const target = sketch.entities.find((entity) => entity.id === constraint.targetEntityId)
      if (!source || !target) continue
      const relatedTarget = applyRelationConstraint(source, target, constraint)
      const constrainedTarget = applyConstraintsToEntity(relatedTarget, findSketchConstraints(document, sketch.id, target.id), target)
      replaceSketchEntity(document, sketch.id, constrainedTarget)
    }
  }
}

function hasEquivalentConstraint(constraints: SketchConstraint[], constraint: SketchConstraint): boolean {
  return constraints.some((item) => {
    if (item.type !== constraint.type) return false
    if (isRelationConstraint(item) && isRelationConstraint(constraint)) {
      const sameDirection = item.entityId === constraint.entityId && item.targetEntityId === constraint.targetEntityId
      const reverseDirection = item.entityId === constraint.targetEntityId && item.targetEntityId === constraint.entityId
      return sameDirection || reverseDirection
    }
    if (item.type === 'dimension' && constraint.type === 'dimension') {
      return item.dimension === constraint.dimension
    }
    return true
  })
}

function duplicateSketchEntity(entity: SketchEntity, entityCount: number): SketchEntity {
  const next = transformTranslateSketchEntity(entity, { x: 20, y: 20 })
  next.id = createCadId(entity.type)
  next.name = `${entity.name} Copy ${entityCount + 1}`
  next.visible = true
  next.locked = undefined
  return next
}

function createDerivedSketchEntity(entity: SketchEntity, nameSuffix: string, entityCount: number): SketchEntity {
  const next = cloneValue(entity)
  next.id = createCadId(entity.type)
  next.name = `${entity.name} ${nameSuffix} ${entityCount + 1}`
  next.visible = true
  next.locked = undefined
  return next
}

function normalizeSketchEntitySelection(items: Array<{ sketchId: string; entityId: string }>): CadSelection | null {
  const unique = new Map<string, { sketchId: string; entityId: string }>()
  for (const item of items) {
    unique.set(`${item.sketchId}:${item.entityId}`, item)
  }
  const entities = [...unique.values()]
  if (entities.length === 0) return null
  if (entities.length === 1) {
    return { kind: 'sketch-entity', sketchId: entities[0].sketchId, entityId: entities[0].entityId }
  }
  return { kind: 'sketch-entities', entities }
}

function normalizeFeatureSelection(featureIds: string[]): CadSelection | null {
  const ids = [...new Set(featureIds)]
  if (ids.length === 0) return null
  if (ids.length === 1) return { kind: 'feature', featureId: ids[0] }
  return { kind: 'features', featureIds: ids }
}

function featureReferencesEntity(feature: Feature, entityId: string): boolean {
  if (feature.type === 'extrude') {
    return feature.sourceEntityId === entityId
  }
  if (feature.type === 'cut') {
    return feature.toolEntityId === entityId
  }
  return false
}

function featureReferencesFeature(feature: Feature, featureId: string): boolean {
  if (feature.type === 'cut') {
    return feature.targetFeatureId === featureId
  }
  if (feature.type === 'boolean') {
    const frozenSubtract = isFrozenBooleanSubtract(feature)
    return feature.targetFeatureId === featureId || (!frozenSubtract && feature.toolFeatureId === featureId)
  }
  return false
}

function isFrozenBooleanSubtract(feature: Feature): boolean {
  if (feature.type !== 'boolean') return false
  const subtractOperation = feature.operation === 'subtract' || feature.operation === 'difference'
  return subtractOperation && Boolean(feature.resultMesh?.vertices.length)
}

function removeDependentFeatures(document: CadDocument, deletedFeatureIds: Set<string>) {
  let changed = true
  while (changed) {
    changed = false
    for (const feature of document.features) {
      if (!deletedFeatureIds.has(feature.id) && [...deletedFeatureIds].some((id) => featureReferencesFeature(feature, id))) {
        deletedFeatureIds.add(feature.id)
        changed = true
      }
    }
  }
  document.features = document.features.filter((feature) => !deletedFeatureIds.has(feature.id))
}

function deleteSketchEntityCascade(document: CadDocument, sketchId: string, entityId: string) {
  const sketch = document.sketches.find((item) => item.id === sketchId)
  if (!sketch) return
  sketch.entities = sketch.entities.filter((entity) => entity.id !== entityId)
  sketch.constraints = sketch.constraints.filter((constraint) => constraint.entityId !== entityId && (!isRelationConstraint(constraint) || constraint.targetEntityId !== entityId))

  const deletedFeatureIds = new Set(
    document.features.filter((feature) => featureReferencesEntity(feature, entityId)).map((feature) => feature.id)
  )
  if (deletedFeatureIds.size > 0) {
    removeDependentFeatures(document, deletedFeatureIds)
  }
}

function deleteFeatureCascade(document: CadDocument, featureId: string) {
  removeDependentFeatures(document, new Set([featureId]))
}

function deleteFeaturesCascade(document: CadDocument, featureIds: string[]) {
  removeDependentFeatures(document, new Set(featureIds))
}

function isPrimitiveFeature(feature: Feature): feature is Extract<Feature, { position: Point3 }> {
  return feature.type === 'box' || feature.type === 'sphere' || feature.type === 'cone'
}

function isTransformableFeature(feature: Feature): boolean {
  return feature.type === 'box'
    || feature.type === 'sphere'
    || feature.type === 'cone'
    || feature.type === 'extrude'
    || feature.type === 'cut'
    || feature.type === 'boolean'
    || feature.type === 'mesh'
}

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000
}

function roundPoint3(point: Point3): Point3 {
  return {
    x: roundNumber(point.x),
    y: roundNumber(point.y),
    z: roundNumber(point.z)
  }
}

function emptyRotation(): Point3 {
  return { x: 0, y: 0, z: 0 }
}

function normalizeRotation(rotation: Point3): Point3 {
  const normalize = (value: number) => {
    const wrapped = ((value % 360) + 360) % 360
    return roundNumber(wrapped > 180 ? wrapped - 360 : wrapped)
  }
  return {
    x: normalize(rotation.x),
    y: normalize(rotation.y),
    z: normalize(rotation.z)
  }
}

function translateFeature(feature: Feature, delta: Point3): Feature {
  if (!isTransformableFeature(feature)) return cloneValue(feature)
  const current = feature.position ?? { x: 0, y: 0, z: 0 }
  return {
    ...cloneFeatureForTransform(feature),
    position: {
      x: roundNumber(current.x + delta.x),
      y: roundNumber(current.y + delta.y),
      z: roundNumber(current.z + delta.z)
    }
  } as Feature
}

function rotateFeature(feature: Feature, delta: Point3): Feature {
  if (!isTransformableFeature(feature)) return cloneValue(feature)
  const current = feature.rotation ?? emptyRotation()
  return {
    ...cloneFeatureForTransform(feature),
    rotation: normalizeRotation({
      x: current.x + delta.x,
      y: current.y + delta.y,
      z: current.z + delta.z
    })
  } as Feature
}

function primitiveCenter(feature: Feature): Point3 | null {
  if (!isPrimitiveFeature(feature)) return null
  if (feature.type === 'box') {
    return { x: feature.position.x, y: feature.position.y, z: feature.position.z + feature.height / 2 }
  }
  if (feature.type === 'sphere') {
    return { x: feature.position.x, y: feature.position.y, z: feature.position.z + feature.radius }
  }
  return { x: feature.position.x, y: feature.position.y, z: feature.position.z + feature.height / 2 }
}

function primitiveBottom(feature: Feature): number | null {
  if (!isPrimitiveFeature(feature)) return null
  return feature.position.z
}

function primitiveTop(feature: Feature): number | null {
  if (feature.type === 'box') return feature.position.z + feature.height
  if (feature.type === 'sphere') return feature.position.z + feature.radius * 2
  if (feature.type === 'cone') return feature.position.z + feature.height
  return null
}

function ensureAssemblies(document: CadDocument): AssemblyConstraint[] {
  if (!document.assemblies) document.assemblies = []
  return document.assemblies
}

function replaceFeature(document: CadDocument, feature: Feature): boolean {
  const index = document.features.findIndex((item) => item.id === feature.id)
  if (index < 0) return false
  document.features[index] = cloneValue(feature)
  return true
}

function findLatestTargetFeature(document: CadDocument): Feature | null {
  for (let index = document.features.length - 1; index >= 0; index -= 1) {
    const feature = document.features[index]
    if (!feature.suppressed) return feature
  }
  return null
}

function createBooleanFeature(
  document: CadDocument,
  operation: 'add' | 'subtract',
  target: Feature,
  tool: Feature,
  namePrefix = operation === 'add' ? '布尔加' : '布尔减',
  resultMesh?: BooleanResultMesh
): BooleanFeature {
  return {
    id: createCadId('boolean'),
    type: 'boolean',
    name: `${namePrefix} ${document.features.length + 1}`,
    suppressed: false,
    operation,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    targetFeatureId: target.id,
    toolFeatureId: tool.id,
    ...(resultMesh ? { resultMesh } : {})
  }
}

function freezeBooleanSubtractFeature(document: CadDocument, feature: BooleanFeature): BooleanFeature {
  if (feature.resultMesh?.vertices.length || (feature.operation !== 'subtract' && feature.operation !== 'difference')) {
    return feature
  }
  const resultMesh = new ThreeGeometryKernel().buildBooleanResultMesh(document, feature)
  return resultMesh ? { ...feature, resultMesh } : feature
}

function freezeBooleanSubtractFeatures(document: CadDocument): CadDocument {
  let changed = false
  const next = cloneValue(document)
  next.features = next.features.map((feature) => {
    if (feature.type !== 'boolean') return feature
    const frozen = freezeBooleanSubtractFeature(next, feature)
    if (frozen !== feature) changed = true
    return frozen
  })
  return changed ? next : document
}

export const useCadStore = defineStore('cad', {
  state: (): CadState => ({
    document: null,
    selection: null,
    transformPreviewEntities: [],
    sketchSnapSettings: { ...defaultSketchSnapSettings },
    activeTool: 'select',
    constructionMode: false,
    dirty: false,
    currentVersion: 0,
    activeSketchPlane: 'XY',
    history: new HistoryStack(),
    historyRevision: 0
  }),
  getters: {
    canUndo(state): boolean {
      void state.historyRevision
      return state.history.canUndo()
    },
    canRedo(state): boolean {
      void state.historyRevision
      return state.history.canRedo()
    },
    selectedSketchEntity(state): SketchEntity | null {
      if (!state.document || state.selection?.kind !== 'sketch-entity') return null
      return findSketchEntity(state.document, state.selection.sketchId, state.selection.entityId)
    },
    selectedSketchEntities(state): SelectedSketchEntity[] {
      if (!state.document) return []
      return findSelectedSketchEntities(state.document, state.selection)
    },
    selectedSketchConstraints(state): SketchConstraint[] {
      if (!state.document || state.selection?.kind !== 'sketch-entity') return []
      return findSketchConstraints(state.document, state.selection.sketchId, state.selection.entityId)
    },
    hasSketchEntitySelection(state): boolean {
      if (!state.document) return false
      return findSelectedSketchEntities(state.document, state.selection).length > 0
    },
    selectionCount(state): number {
      if (!state.document) return state.selection ? 1 : 0
      const selectedEntities = findSelectedSketchEntities(state.document, state.selection)
      if (selectedEntities.length > 0) return selectedEntities.length
      const selectedFeatures = findSelectedFeatures(state.document, state.selection)
      if (selectedFeatures.length > 0) return selectedFeatures.length
      return state.selection ? 1 : 0
    },
    selectedFeature(state): Feature | null {
      if (!state.document || state.selection?.kind !== 'feature') return null
      const selection = state.selection
      return state.document.features.find((feature) => feature.id === selection.featureId) ?? null
    },
    selectedFeatures(state): SelectedFeature[] {
      if (!state.document) return []
      return findSelectedFeatures(state.document, state.selection)
    },
    hasFeatureSelection(state): boolean {
      if (!state.document) return false
      return findSelectedFeatures(state.document, state.selection).length > 0
    }
  },
  actions: {
    async loadDocument(documentId: number) {
      const dto = await getDocument(documentId)
      this.document = freezeBooleanSubtractFeatures(dto.snapshotJson ?? createEmptyCadDocument(String(dto.id), dto.name))
      this.document.assemblies = this.document.assemblies ?? []
      this.currentVersion = dto.currentVersion
      this.dirty = false
      this.selection = null
      this.activeSketchPlane = this.document.sketches[0]?.plane ?? 'XY'
      this.transformPreviewEntities = []
      this.history.clear()
      this.historyRevision += 1
      useStatusStore().setSaveStatus('saved')
    },
    applyRealtimeSnapshot(snapshot: CadDocument) {
      this.document = freezeBooleanSubtractFeatures(cloneValue(snapshot))
      this.document.assemblies = this.document.assemblies ?? []
      this.historyRevision += 1
      this.markDirty()
    },
    setConstructionMode(value: boolean) {
      this.constructionMode = value
    },
    setActiveSketchPlane(plane: SketchPlane) {
      this.activeSketchPlane = plane
      this.selection = null
    },
    setActiveTool(tool: CadToolType) {
      if (tool === 'fixed' || tool === 'horizontal' || tool === 'vertical' || tool === 'dimension') {
        this.addConstraint(tool)
        this.activeTool = 'select'
        return
      }
      if (tool === 'concentric' || tool === 'equalRadius' || tool === 'parallel' || tool === 'perpendicular' || tool === 'tangent') {
        this.addRelationConstraint(tool)
        this.activeTool = 'select'
        return
      }
      if (tool === 'extrude') {
        this.extrudeSelected()
        this.activeTool = 'select'
        return
      }
      if (tool === 'cut') {
        this.cutSelected()
        this.activeTool = 'select'
        return
      }
      if (tool === 'union' || tool === 'booleanAdd') {
        this.booleanSelected('add')
        this.activeTool = 'select'
        return
      }
      if (tool === 'difference' || tool === 'booleanSubtract') {
        this.booleanSelected('subtract')
        this.activeTool = 'select'
        return
      }
      this.activeTool = tool
    },
    setSelection(selection: CadSelection | null) {
      this.selection = selection
    },
    setTransformPreviewEntities(entities: SketchEntity[]) {
      this.transformPreviewEntities = cloneValue(entities)
    },
    clearTransformPreview() {
      if (this.transformPreviewEntities.length === 0) return
      this.transformPreviewEntities = []
    },
    setSketchSnapSettings(settings: Partial<SketchSnapSettings>) {
      this.sketchSnapSettings = {
        ...this.sketchSnapSettings,
        ...settings
      }
    },
    setSketchEntitySelection(items: Array<{ sketchId: string; entityId: string }>) {
      this.selection = normalizeSketchEntitySelection(items)
    },
    toggleSketchEntitySelection(sketchId: string, entityId: string) {
      const current = this.selectedSketchEntities.map((item) => ({ sketchId: item.sketchId, entityId: item.entity.id }))
      const key = `${sketchId}:${entityId}`
      const exists = current.some((item) => `${item.sketchId}:${item.entityId}` === key)
      this.setSketchEntitySelection(
        exists
          ? current.filter((item) => `${item.sketchId}:${item.entityId}` !== key)
          : [...current, { sketchId, entityId }]
      )
    },
    isSketchEntitySelected(sketchId: string, entityId: string): boolean {
      return this.selectedSketchEntities.some((item) => item.sketchId === sketchId && item.entity.id === entityId)
    },
    setFeatureSelection(featureIds: string[]) {
      this.selection = normalizeFeatureSelection(featureIds)
    },
    toggleFeatureSelection(featureId: string) {
      const current = this.selectedFeatures.map((item) => item.feature.id)
      const exists = current.includes(featureId)
      this.setFeatureSelection(exists ? current.filter((id) => id !== featureId) : [...current, featureId])
    },
    isFeatureSelected(featureId: string): boolean {
      return this.selectedFeatures.some((item) => item.feature.id === featureId)
    },
    markDirty() {
      this.dirty = true
      useStatusStore().setSaveStatus('dirty')
    },
    commitDocumentChange(
      type: CadOperationType,
      targetId: string,
      payload: Record<string, unknown>,
      mutate: (draft: CadDocument) => void,
      nextSelection?: CadSelection | null
    ) {
      if (!this.document) return
      const before = cloneValue(this.document)
      const after = cloneValue(this.document)
      mutate(after)
      applyRelationConstraintsToDocument(after)
      this.document = after
      if (nextSelection !== undefined) {
        this.selection = nextSelection
      }
      this.history.push(createSnapshotCommand(before, after, type, targetId, payload))
      this.historyRevision += 1
      this.markDirty()
      this.broadcastOperation(type, targetId, payload)
    },
    addLine(start: Point2, end: Point2) {
      if (!this.document) return
      const sketch = resolveSketchForPlane(this.document, this.activeSketchPlane)
      const entity: SketchEntity = {
        id: createCadId('line'),
        type: 'line',
        name: `Line ${sketch.entityCount + 1}`,
        visible: true,
        construction: this.constructionMode || undefined,
        start,
        end
      }
      this.commitDocumentChange(
        'sketch.entity.created',
        entity.id,
        { sketchId: sketch.id, sketch: { id: sketch.id, name: sketch.name, plane: sketch.plane }, entity },
        (draft) => getOrCreateSketch(draft, sketch).entities.push(cloneValue(entity)),
        { kind: 'sketch-entity', sketchId: sketch.id, entityId: entity.id }
      )
      this.activeTool = 'select'
    },
    addRectangle(start: Point2, end: Point2) {
      if (!this.document) return
      const sketch = resolveSketchForPlane(this.document, this.activeSketchPlane)
      const width = Math.max(5, Math.abs(end.x - start.x))
      const height = Math.max(5, Math.abs(end.y - start.y))
      const entity: SketchEntity = {
        id: createCadId('rect'),
        type: 'rectangle',
        name: `Rectangle ${sketch.entityCount + 1}`,
        visible: true,
        construction: this.constructionMode || undefined,
        origin: { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) },
        width,
        height
      }
      this.commitDocumentChange(
        'sketch.entity.created',
        entity.id,
        { sketchId: sketch.id, sketch: { id: sketch.id, name: sketch.name, plane: sketch.plane }, entity },
        (draft) => getOrCreateSketch(draft, sketch).entities.push(cloneValue(entity)),
        { kind: 'sketch-entity', sketchId: sketch.id, entityId: entity.id }
      )
      this.activeTool = 'select'
    },
    addCircle(center: Point2, edge: Point2) {
      if (!this.document) return
      const sketch = resolveSketchForPlane(this.document, this.activeSketchPlane)
      const radius = Math.max(5, Math.hypot(edge.x - center.x, edge.y - center.y))
      const entity: SketchEntity = {
        id: createCadId('circle'),
        type: 'circle',
        name: `Circle ${sketch.entityCount + 1}`,
        visible: true,
        construction: this.constructionMode || undefined,
        center,
        radius
      }
      this.commitDocumentChange(
        'sketch.entity.created',
        entity.id,
        { sketchId: sketch.id, sketch: { id: sketch.id, name: sketch.name, plane: sketch.plane }, entity },
        (draft) => getOrCreateSketch(draft, sketch).entities.push(cloneValue(entity)),
        { kind: 'sketch-entity', sketchId: sketch.id, entityId: entity.id }
      )
      this.activeTool = 'select'
    },
    addArc(center: Point2, start: Point2, end: Point2) {
      if (!this.document) return
      const sketch = resolveSketchForPlane(this.document, this.activeSketchPlane)
      const entity: SketchEntity = makeArcFromCenterPoints(
        createCadId('arc'),
        `Arc ${sketch.entityCount + 1}`,
        center,
        start,
        end
      )
      entity.construction = this.constructionMode || undefined
      this.commitDocumentChange(
        'sketch.entity.created',
        entity.id,
        { sketchId: sketch.id, sketch: { id: sketch.id, name: sketch.name, plane: sketch.plane }, entity },
        (draft) => getOrCreateSketch(draft, sketch).entities.push(cloneValue(entity)),
        { kind: 'sketch-entity', sketchId: sketch.id, entityId: entity.id }
      )
      this.activeTool = 'select'
    },
    updateSketchEntityTransient(sketchId: string, entity: SketchEntity) {
      if (!this.document) return
      const draft = cloneValue(this.document)
      const previous = findSketchEntity(this.document, sketchId, entity.id)
      const nextEntity = constrainSketchEntity(this.document, sketchId, entity, previous ?? undefined)
      if (!replaceSketchEntity(draft, sketchId, nextEntity)) return
      this.document = draft
      this.markDirty()
    },
    updateSketchEntitiesTransient(updates: Array<{ sketchId: string; entity: SketchEntity }>) {
      if (!this.document || updates.length === 0) return
      const draft = cloneValue(this.document)
      for (const update of updates) {
        const previous = findSketchEntity(this.document, update.sketchId, update.entity.id)
        const nextEntity = constrainSketchEntity(this.document, update.sketchId, update.entity, previous ?? undefined)
        replaceSketchEntity(draft, update.sketchId, nextEntity)
      }
      this.document = draft
      this.markDirty()
    },
    commitSketchEntityUpdate(sketchId: string, beforeEntity: SketchEntity, afterEntity: SketchEntity) {
      if (!this.document) return
      const constrainedAfter = constrainSketchEntity(this.document, sketchId, afterEntity, beforeEntity)
      if (JSON.stringify(beforeEntity) === JSON.stringify(constrainedAfter)) return
      const before = cloneValue(this.document)
      const after = cloneValue(this.document)
      replaceSketchEntity(before, sketchId, beforeEntity)
      replaceSketchEntity(after, sketchId, constrainedAfter)
      applyRelationConstraintsToDocument(after)
      this.document = after
      this.history.push(
        createSnapshotCommand(before, after, 'sketch.entity.updated', constrainedAfter.id, {
          sketchId,
          before: beforeEntity,
          entity: constrainedAfter
        })
      )
      this.historyRevision += 1
      this.markDirty()
      this.broadcastOperation('sketch.entity.updated', constrainedAfter.id, {
        sketchId,
        before: beforeEntity,
        entity: constrainedAfter
      })
    },
    commitSketchEntitiesUpdate(updates: SketchEntityUpdate[]) {
      if (!this.document) return
      const constrainedUpdates = updates.map((update) => ({
        ...update,
        after: constrainSketchEntity(this.document!, update.sketchId, update.after, update.before)
      }))
      const effectiveUpdates = constrainedUpdates.filter((update) => JSON.stringify(update.before) !== JSON.stringify(update.after))
      if (!this.document || effectiveUpdates.length === 0) return
      const before = cloneValue(this.document)
      const after = cloneValue(this.document)
      for (const update of effectiveUpdates) {
        replaceSketchEntity(before, update.sketchId, update.before)
        replaceSketchEntity(after, update.sketchId, update.after)
      }
      applyRelationConstraintsToDocument(after)
      this.document = after
      this.selection = normalizeSketchEntitySelection(
        effectiveUpdates.map((update) => ({ sketchId: update.sketchId, entityId: update.after.id }))
      )
      this.history.push(
        createSnapshotCommand(before, after, 'sketch.entities.updated', 'selection', {
          updates: effectiveUpdates
        })
      )
      this.historyRevision += 1
      this.markDirty()
      this.broadcastOperation('sketch.entities.updated', 'selection', { updates: effectiveUpdates })
    },
    updateSelectedEntity(entity: SketchEntity) {
      if (!this.document || this.selection?.kind !== 'sketch-entity') return
      const selection = this.selection
      const previous = findSketchEntity(this.document, selection.sketchId, selection.entityId)
      if (!previous) return
      const nextEntity = constrainSketchEntity(this.document, selection.sketchId, entity, previous)
      this.commitDocumentChange(
        'sketch.entity.updated',
        nextEntity.id,
        { sketchId: selection.sketchId, before: previous, entity: nextEntity },
        (draft) => replaceSketchEntity(draft, selection.sketchId, nextEntity),
        selection
      )
    },
    updateSelectedFeature(feature: Feature) {
      if (!this.document || this.selection?.kind !== 'feature') return
      const selection = this.selection
      const previous = this.document.features.find((item) => item.id === selection.featureId)
      if (!previous) return
      this.commitDocumentChange(
        'feature.updated',
        feature.id,
        { before: previous, feature },
        (draft) => replaceFeature(draft, feature),
        selection
      )
    },
    deleteSelection() {
      if (!this.document || !this.selection) return
      const selection = this.selection

      if (selection.kind === 'sketch-entities') {
        const selected = this.selectedSketchEntities
        if (selected.length === 0) return
        this.commitDocumentChange(
          'sketch.entities.deleted',
          'selection',
          {
            entities: selected.map((item) => ({
              sketchId: item.sketchId,
              entityId: item.entity.id,
              entity: item.entity
            }))
          },
          (draft) => {
            for (const item of selected) {
              deleteSketchEntityCascade(draft, item.sketchId, item.entity.id)
            }
          },
          null
        )
        return
      }

      if (selection.kind === 'sketch-entity') {
        const entity = findSketchEntity(this.document, selection.sketchId, selection.entityId)
        if (!entity) return
        this.commitDocumentChange(
          'sketch.entity.deleted',
          entity.id,
          { sketchId: selection.sketchId, entityId: entity.id, entity },
          (draft) => deleteSketchEntityCascade(draft, selection.sketchId, entity.id),
          null
        )
        return
      }

      if (selection.kind === 'features') {
        const selected = this.selectedFeatures.map((item) => item.feature)
        if (selected.length === 0) return
        this.commitDocumentChange(
          'feature.deleted',
          'selection',
          {
            featureIds: selected.map((feature) => feature.id),
            features: selected
          },
          (draft) => deleteFeaturesCascade(draft, selected.map((feature) => feature.id)),
          null
        )
        return
      }

      if (selection.kind !== 'feature') return
      const feature = this.document.features.find((item) => item.id === selection.featureId)
      if (!feature) return
      this.commitDocumentChange(
        'feature.deleted',
        feature.id,
        { featureId: feature.id, feature },
        (draft) => deleteFeatureCascade(draft, feature.id),
        null
      )
    },
    toggleSelectionConstruction() {
      if (!this.document || !this.hasSketchEntitySelection) return
      const selected = this.selectedSketchEntities
      if (selected.length === 0) return
      const nextConstruction = !selected.every((item) => item.entity.construction)
      this.commitSketchEntitiesUpdate(selected.map((item) => ({
        sketchId: item.sketchId,
        before: cloneValue(item.entity),
        after: { ...cloneValue(item.entity), construction: nextConstruction || undefined }
      })))
    },
    undo() {
      if (!this.document || !this.history.canUndo()) return
      this.document = this.history.undo(this.document)
      this.selection = null
      this.historyRevision += 1
      this.markDirty()
      this.broadcastOperation('history.undo', 'document', {})
    },
    redo() {
      if (!this.document || !this.history.canRedo()) return
      this.document = this.history.redo(this.document)
      this.selection = null
      this.historyRevision += 1
      this.markDirty()
      this.broadcastOperation('history.redo', 'document', {})
    },
    duplicateSelection() {
      if (!this.document || !this.hasSketchEntitySelection) return
      const selected = this.selectedSketchEntities
      if (selected.length === 0) return
      const sketchEntityCounts = new Map<string, number>()
      for (const sketch of this.document.sketches) {
        sketchEntityCounts.set(sketch.id, sketch.entities.length)
      }
      const duplicatedItems = selected.map((item) => {
        const count = sketchEntityCounts.get(item.sketchId) ?? 0
        sketchEntityCounts.set(item.sketchId, count + 1)
        return {
          sketchId: item.sketchId,
          entity: duplicateSketchEntity(item.entity, count)
        }
      })
      this.commitDocumentChange(
        duplicatedItems.length === 1 ? 'sketch.entity.created' : 'sketch.entities.created',
        duplicatedItems.length === 1 ? duplicatedItems[0].entity.id : 'selection',
        duplicatedItems.length === 1
          ? { sketchId: duplicatedItems[0].sketchId, entity: duplicatedItems[0].entity }
          : { entities: duplicatedItems },
        (draft) => {
          for (const item of duplicatedItems) {
            const draftSketch = draft.sketches.find((sketch) => sketch.id === item.sketchId)
            draftSketch?.entities.push(cloneValue(item.entity))
          }
        },
        normalizeSketchEntitySelection(
          duplicatedItems.map((item) => ({ sketchId: item.sketchId, entityId: item.entity.id }))
        )
      )
    },
    rotateSelection(degrees = 90) {
      if (!this.document || !this.hasSketchEntitySelection) return
      const selected = this.selectedSketchEntities
      if (selected.length === 0) return
      const center = getSketchEntitiesCenter(selected.map((item) => item.entity))
      this.commitSketchEntitiesUpdate(
        selected.map((item) => ({
          sketchId: item.sketchId,
          before: cloneValue(item.entity),
          after: rotateSketchEntity(item.entity, center, degrees)
        }))
      )
    },
    mirrorSelection(axis: SketchMirrorAxis) {
      if (!this.document || !this.hasSketchEntitySelection) return
      const selected = this.selectedSketchEntities
      if (selected.length === 0) return
      const center = getSketchEntitiesCenter(selected.map((item) => item.entity))
      const sketchEntityCounts = new Map<string, number>()
      for (const sketch of this.document.sketches) {
        sketchEntityCounts.set(sketch.id, sketch.entities.length)
      }
      const mirroredItems = selected.map((item) => {
        const count = sketchEntityCounts.get(item.sketchId) ?? 0
        sketchEntityCounts.set(item.sketchId, count + 1)
        const transformed = mirrorSketchEntity(item.entity, center, axis)
        return {
          sketchId: item.sketchId,
          entity: createDerivedSketchEntity(transformed, axis === 'horizontal' ? 'Mirror H' : 'Mirror V', count)
        }
      })
      this.commitDocumentChange(
        mirroredItems.length === 1 ? 'sketch.entity.created' : 'sketch.entities.created',
        mirroredItems.length === 1 ? mirroredItems[0].entity.id : 'selection',
        mirroredItems.length === 1
          ? { sketchId: mirroredItems[0].sketchId, entity: mirroredItems[0].entity }
          : { entities: mirroredItems },
        (draft) => {
          for (const item of mirroredItems) {
            const draftSketch = draft.sketches.find((sketch) => sketch.id === item.sketchId)
            draftSketch?.entities.push(cloneValue(item.entity))
          }
        },
        normalizeSketchEntitySelection(
          mirroredItems.map((item) => ({ sketchId: item.sketchId, entityId: item.entity.id }))
        )
      )
    },
    mirrorSelectionByLine() {
      if (!this.document || this.selectedSketchEntities.length < 2) return
      const selected = this.selectedSketchEntities
      const axis = selected.find((item) => item.entity.type === 'line')
      if (!axis || axis.entity.type !== 'line') return
      const axisEntity = axis.entity
      const mirrorSources = selected.filter((item) => !(item.sketchId === axis.sketchId && item.entity.id === axisEntity.id))
      if (mirrorSources.length === 0) return

      const sketchEntityCounts = new Map<string, number>()
      for (const sketch of this.document.sketches) {
        sketchEntityCounts.set(sketch.id, sketch.entities.length)
      }
      const mirroredItems = mirrorSources.map((item) => {
        const count = sketchEntityCounts.get(item.sketchId) ?? 0
        sketchEntityCounts.set(item.sketchId, count + 1)
        const transformed = mirrorSketchEntityAcrossLine(item.entity, axisEntity)
        return {
          sketchId: item.sketchId,
          entity: createDerivedSketchEntity(transformed, 'Mirror Line', count)
        }
      })

      this.commitDocumentChange(
        mirroredItems.length === 1 ? 'sketch.entity.created' : 'sketch.entities.created',
        mirroredItems.length === 1 ? mirroredItems[0].entity.id : 'selection',
        mirroredItems.length === 1
          ? { sketchId: mirroredItems[0].sketchId, entity: mirroredItems[0].entity }
          : { entities: mirroredItems },
        (draft) => {
          for (const item of mirroredItems) {
            const draftSketch = draft.sketches.find((sketch) => sketch.id === item.sketchId)
            draftSketch?.entities.push(cloneValue(item.entity))
          }
        },
        normalizeSketchEntitySelection(mirroredItems.map((item) => ({ sketchId: item.sketchId, entityId: item.entity.id })))
      )
    },
    arraySelection(columns = 3, rows = 2, spacing: Point2 = { x: 30, y: 30 }) {
      if (!this.document || !this.hasSketchEntitySelection) return
      const selected = this.selectedSketchEntities
      if (selected.length === 0) return
      const safeColumns = Math.max(1, Math.floor(columns))
      const safeRows = Math.max(1, Math.floor(rows))
      if (safeColumns === 1 && safeRows === 1) return

      const sketchEntityCounts = new Map<string, number>()
      for (const sketch of this.document.sketches) {
        sketchEntityCounts.set(sketch.id, sketch.entities.length)
      }

      const arrayItems: Array<{ sketchId: string; entity: SketchEntity }> = []
      for (let row = 0; row < safeRows; row += 1) {
        for (let column = 0; column < safeColumns; column += 1) {
          if (row === 0 && column === 0) continue
          for (const item of selected) {
            const count = sketchEntityCounts.get(item.sketchId) ?? 0
            sketchEntityCounts.set(item.sketchId, count + 1)
            const transformed = transformTranslateSketchEntity(item.entity, {
              x: spacing.x * column,
              y: spacing.y * row
            })
            arrayItems.push({
              sketchId: item.sketchId,
              entity: createDerivedSketchEntity(transformed, 'Array', count)
            })
          }
        }
      }

      if (arrayItems.length === 0) return
      this.commitDocumentChange(
        arrayItems.length === 1 ? 'sketch.entity.created' : 'sketch.entities.created',
        arrayItems.length === 1 ? arrayItems[0].entity.id : 'selection',
        arrayItems.length === 1
          ? { sketchId: arrayItems[0].sketchId, entity: arrayItems[0].entity }
          : { entities: arrayItems },
        (draft) => {
          for (const item of arrayItems) {
            const draftSketch = draft.sketches.find((sketch) => sketch.id === item.sketchId)
            draftSketch?.entities.push(cloneValue(item.entity))
          }
        },
        normalizeSketchEntitySelection(arrayItems.map((item) => ({ sketchId: item.sketchId, entityId: item.entity.id })))
      )
    },
    offsetSelection(distance = 10) {
      if (!this.document || !this.hasSketchEntitySelection || !Number.isFinite(distance) || distance === 0) return
      const selected = this.selectedSketchEntities
      if (selected.length === 0) return

      const sketchEntityCounts = new Map<string, number>()
      for (const sketch of this.document.sketches) {
        sketchEntityCounts.set(sketch.id, sketch.entities.length)
      }

      const offsetItems = selected.flatMap((item) => {
        const transformed = offsetSketchEntity(item.entity, distance)
        if (!transformed) return []
        const count = sketchEntityCounts.get(item.sketchId) ?? 0
        sketchEntityCounts.set(item.sketchId, count + 1)
        return [{
          sketchId: item.sketchId,
          entity: createDerivedSketchEntity(transformed, 'Offset', count)
        }]
      })

      if (offsetItems.length === 0) return
      this.commitDocumentChange(
        offsetItems.length === 1 ? 'sketch.entity.created' : 'sketch.entities.created',
        offsetItems.length === 1 ? offsetItems[0].entity.id : 'selection',
        offsetItems.length === 1
          ? { sketchId: offsetItems[0].sketchId, entity: offsetItems[0].entity }
          : { entities: offsetItems },
        (draft) => {
          for (const item of offsetItems) {
            const draftSketch = draft.sketches.find((sketch) => sketch.id === item.sketchId)
            draftSketch?.entities.push(cloneValue(item.entity))
          }
        },
        normalizeSketchEntitySelection(offsetItems.map((item) => ({ sketchId: item.sketchId, entityId: item.entity.id })))
      )
    },
    filletSelectedLines(radius = 10) {
      if (!this.document || this.selectedSketchEntities.length !== 2 || !Number.isFinite(radius) || radius <= 0) return
      const [first, second] = this.selectedSketchEntities
      if (first.sketchId !== second.sketchId || first.entity.type !== 'line' || second.entity.type !== 'line') return
      if (first.entity.locked || second.entity.locked) return
      const sketch = this.document.sketches.find((item) => item.id === first.sketchId)
      if (!sketch) return
      const result = createLineFillet(
        first.entity,
        second.entity,
        radius,
        createCadId('arc'),
        `Fillet ${sketch.entities.length + 1}`
      )
      if (!result) return
      this.commitDocumentChange(
        'sketch.entities.updated',
        'corner-fillet',
        {
          updates: [
            { sketchId: sketch.id, before: first.entity, after: result.lineA },
            { sketchId: sketch.id, before: second.entity, after: result.lineB }
          ],
          createdEntities: [{ sketchId: sketch.id, entity: result.connector }]
        },
        (draft) => {
          replaceSketchEntity(draft, sketch.id, result.lineA)
          replaceSketchEntity(draft, sketch.id, result.lineB)
          draft.sketches.find((item) => item.id === sketch.id)?.entities.push(cloneValue(result.connector))
        },
        normalizeSketchEntitySelection([
          { sketchId: sketch.id, entityId: result.lineA.id },
          { sketchId: sketch.id, entityId: result.lineB.id },
          { sketchId: sketch.id, entityId: result.connector.id }
        ])
      )
    },
    chamferSelectedLines(distance = 10) {
      if (!this.document || this.selectedSketchEntities.length !== 2 || !Number.isFinite(distance) || distance <= 0) return
      const [first, second] = this.selectedSketchEntities
      if (first.sketchId !== second.sketchId || first.entity.type !== 'line' || second.entity.type !== 'line') return
      if (first.entity.locked || second.entity.locked) return
      const sketch = this.document.sketches.find((item) => item.id === first.sketchId)
      if (!sketch) return
      const result = createLineChamfer(
        first.entity,
        second.entity,
        distance,
        createCadId('line'),
        `Chamfer ${sketch.entities.length + 1}`
      )
      if (!result) return
      this.commitDocumentChange(
        'sketch.entities.updated',
        'corner-chamfer',
        {
          updates: [
            { sketchId: sketch.id, before: first.entity, after: result.lineA },
            { sketchId: sketch.id, before: second.entity, after: result.lineB }
          ],
          createdEntities: [{ sketchId: sketch.id, entity: result.connector }]
        },
        (draft) => {
          replaceSketchEntity(draft, sketch.id, result.lineA)
          replaceSketchEntity(draft, sketch.id, result.lineB)
          draft.sketches.find((item) => item.id === sketch.id)?.entities.push(cloneValue(result.connector))
        },
        normalizeSketchEntitySelection([
          { sketchId: sketch.id, entityId: result.lineA.id },
          { sketchId: sketch.id, entityId: result.lineB.id },
          { sketchId: sketch.id, entityId: result.connector.id }
        ])
      )
    },    addConstraint(type: Extract<CadToolType, 'fixed' | 'horizontal' | 'vertical' | 'dimension'>) {
      if (!this.document || this.selection?.kind !== 'sketch-entity') return
      const selection = this.selection
      const sketch = this.document.sketches.find((item) => item.id === selection.sketchId)
      const entity = sketch?.entities.find((item) => item.id === selection.entityId)
      if (!sketch || !entity) return
      if (!isConstraintApplicable(type, entity)) return
      const existingConstraints = sketch.constraints.filter((constraint) => constraint.entityId === entity.id)
      const constraint: SketchConstraint | null =
        type === 'dimension'
          ? createDimensionConstraintForEntity(createCadId('constraint'), entity, existingConstraints)
          : { id: createCadId('constraint'), type, entityId: entity.id }
      if (!constraint || hasEquivalentConstraint(existingConstraints, constraint)) return
      const nextEntity = applyConstraintsToEntity(
        type === 'fixed' ? { ...cloneValue(entity), locked: true } : entity,
        [...existingConstraints, constraint],
        entity
      )
      this.commitDocumentChange(
        'constraint.added',
        constraint.id,
        { sketchId: sketch.id, constraint, entity: nextEntity },
        (draft) => {
          const draftSketch = draft.sketches.find((item) => item.id === sketch.id)
          draftSketch?.constraints.push(cloneValue(constraint))
          replaceSketchEntity(draft, sketch.id, nextEntity)
        },
        selection
      )
    },
    updateConstraintValue(constraintId: string, value: number | undefined) {
      if (!this.document || typeof value !== 'number' || !Number.isFinite(value)) return
      const location = findConstraintLocation(this.document, constraintId)
      if (!location || !location.entity || location.constraint.type !== 'dimension') return
      const updatedConstraint: SketchConstraint = {
        ...location.constraint,
        value: Math.max(1, value)
      }
      const constraints = location.sketch.constraints
        .filter((constraint) => constraint.entityId === location.entity!.id)
        .map((constraint) => constraint.id === constraintId ? updatedConstraint : constraint)
      const nextEntity = applyConstraintsToEntity(location.entity, constraints, location.entity)
      this.commitDocumentChange(
        'constraint.updated',
        updatedConstraint.id,
        { sketchId: location.sketch.id, constraint: updatedConstraint, entity: nextEntity },
        (draft) => {
          const draftLocation = findConstraintLocation(draft, constraintId)
          if (!draftLocation) return
          draftLocation.sketch.constraints[draftLocation.constraintIndex] = cloneValue(updatedConstraint)
          replaceSketchEntity(draft, draftLocation.sketch.id, nextEntity)
        },
        this.selection
      )
    },
    removeConstraint(constraintId: string) {
      if (!this.document) return
      const location = findConstraintLocation(this.document, constraintId)
      if (!location || !location.entity) return
      const remainingConstraints = location.sketch.constraints.filter((constraint) => constraint.id !== constraintId)
      const entityConstraints = remainingConstraints.filter((constraint) => constraint.entityId === location.entity!.id)
      const unlockedEntity = location.constraint.type === 'fixed'
        ? { ...cloneValue(location.entity), locked: entityConstraints.some((constraint) => constraint.type === 'fixed') || undefined }
        : location.entity
      const nextEntity = applyConstraintsToEntity(unlockedEntity, entityConstraints, location.entity)
      this.commitDocumentChange(
        'constraint.removed',
        constraintId,
        { sketchId: location.sketch.id, constraintId, constraint: location.constraint, entity: nextEntity },
        (draft) => {
          const draftSketch = draft.sketches.find((sketch) => sketch.id === location.sketch.id)
          if (!draftSketch) return
          draftSketch.constraints = draftSketch.constraints.filter((constraint) => constraint.id !== constraintId)
          replaceSketchEntity(draft, draftSketch.id, nextEntity)
        },
        this.selection
      )
    },
    addRelationConstraint(type: RelationConstraintKind) {
      if (!this.document || this.selectedSketchEntities.length !== 2) return
      const [source, target] = this.selectedSketchEntities
      if (source.sketchId !== target.sketchId || source.entity.id === target.entity.id) return
      if (!isRelationConstraintApplicable(type, source.entity, target.entity)) return
      const sketch = this.document.sketches.find((item) => item.id === source.sketchId)
      if (!sketch) return
      const constraint: Extract<SketchConstraint, { targetEntityId: string }> = {
        id: createCadId('constraint'),
        type,
        entityId: source.entity.id,
        targetEntityId: target.entity.id
      }
      if (hasEquivalentConstraint(sketch.constraints, constraint)) return
      const relatedTarget = applyRelationConstraint(source.entity, target.entity, constraint)
      const nextTarget = constrainSketchEntity(this.document, target.sketchId, relatedTarget, target.entity)
      this.commitDocumentChange(
        'constraint.added',
        constraint.id,
        { sketchId: sketch.id, constraint, entity: nextTarget },
        (draft) => {
          const draftSketch = draft.sketches.find((item) => item.id === sketch.id)
          draftSketch?.constraints.push(cloneValue(constraint))
          replaceSketchEntity(draft, target.sketchId, nextTarget)
        },
        this.selection
      )
    },
    addBoxPrimitive(length = 60, width = 40, height = 30) {
      if (!this.document) return
      const feature: Feature = {
        id: createCadId('box'),
        type: 'box',
        name: `Box ${this.document.features.length + 1}`,
        suppressed: false,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        length: Math.max(1, length),
        width: Math.max(1, width),
        height: Math.max(1, height)
      }
      this.commitDocumentChange(
        'feature.created',
        feature.id,
        { feature },
        (draft) => draft.features.push(cloneValue(feature)),
        { kind: 'feature', featureId: feature.id }
      )
      this.activeTool = 'select'
    },
    addSpherePrimitive(radius = 25) {
      if (!this.document) return
      const feature: Feature = {
        id: createCadId('sphere'),
        type: 'sphere',
        name: `Sphere ${this.document.features.length + 1}`,
        suppressed: false,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        radius: Math.max(1, radius)
      }
      this.commitDocumentChange(
        'feature.created',
        feature.id,
        { feature },
        (draft) => draft.features.push(cloneValue(feature)),
        { kind: 'feature', featureId: feature.id }
      )
      this.activeTool = 'select'
    },
    addConePrimitive(baseRadius = 25, height = 50) {
      if (!this.document) return
      const feature: Feature = {
        id: createCadId('cone'),
        type: 'cone',
        name: `Cone ${this.document.features.length + 1}`,
        suppressed: false,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        baseRadius: Math.max(1, baseRadius),
        height: Math.max(1, height)
      }
      this.commitDocumentChange(
        'feature.created',
        feature.id,
        { feature },
        (draft) => draft.features.push(cloneValue(feature)),
        { kind: 'feature', featureId: feature.id }
      )
      this.activeTool = 'select'
    },
    updateFeatureTransient(feature: Feature) {
      if (!this.document) return
      const draft = cloneDocumentWithFeature(this.document, feature)
      if (!draft) return
      this.document = draft
      this.markDirty()
    },
    commitFeatureUpdate(beforeFeature: Feature, afterFeature: Feature) {
      if (!this.document || !featureChanged(beforeFeature, afterFeature)) return
      this.commitDocumentChange(
        'feature.updated',
        afterFeature.id,
        { before: beforeFeature, feature: afterFeature },
        (draft) => replaceFeature(draft, afterFeature),
        { kind: 'feature', featureId: afterFeature.id }
      )
    },
    updateFeaturesTransient(updates: Array<{ feature: Feature }>) {
      if (!this.document || updates.length === 0) return
      const draft = cloneDocumentWithFeatures(this.document, updates)
      if (!draft) return
      this.document = draft
      this.markDirty()
    },
    commitFeaturesUpdate(updates: FeatureUpdate[]) {
      if (!this.document) return
      const effectiveUpdates = updates.filter((update) => featureChanged(update.before, update.after))
      if (effectiveUpdates.length === 0) return
      const before = cloneValue(this.document)
      const after = cloneValue(this.document)
      for (const update of effectiveUpdates) {
        replaceFeature(before, update.before)
        replaceFeature(after, update.after)
      }
      this.document = after
      const featureIds = effectiveUpdates.map((update) => update.after.id)
      this.selection = normalizeFeatureSelection(featureIds)
      this.history.push(
        createSnapshotCommand(before, after, 'feature.updated', 'selection', {
          updates: effectiveUpdates
        })
      )
      this.historyRevision += 1
      this.markDirty()
      this.broadcastOperation('feature.updated', 'selection', { updates: effectiveUpdates })
    },
    translateFeatureTransient(featureId: string, beforeFeature: Feature, delta: Point3) {
      if (!this.document || !isTransformableFeature(beforeFeature)) return
      this.updateFeatureTransient(translateFeature(beforeFeature, delta))
      this.selection = { kind: 'feature', featureId }
    },
    translateFeaturesTransient(beforeFeatures: Feature[], delta: Point3) {
      if (!this.document || beforeFeatures.length === 0 || beforeFeatures.some((feature) => !isTransformableFeature(feature))) return
      const translated = beforeFeatures.map((feature) => ({ feature: translateFeature(feature, delta) }))
      this.updateFeaturesTransient(translated)
      this.selection = normalizeFeatureSelection(beforeFeatures.map((feature) => feature.id))
    },
    rotateFeatureTransient(featureId: string, beforeFeature: Feature, delta: Point3) {
      if (!this.document || !isTransformableFeature(beforeFeature)) return
      this.updateFeatureTransient(rotateFeature(beforeFeature, delta))
      this.selection = { kind: 'feature', featureId }
    },
    rotateFeaturesTransient(beforeFeatures: Feature[], delta: Point3) {
      if (!this.document || beforeFeatures.length === 0 || beforeFeatures.some((feature) => !isTransformableFeature(feature))) return
      const rotated = beforeFeatures.map((feature) => ({ feature: rotateFeature(feature, delta) }))
      this.updateFeaturesTransient(rotated)
      this.selection = normalizeFeatureSelection(beforeFeatures.map((feature) => feature.id))
    },
    rotateSelectedFeatures(delta: Point3) {
      if (!this.document || this.selectedFeatures.length === 0) return
      const selected = this.selectedFeatures.map((item) => item.feature).filter(isTransformableFeature)
      if (selected.length === 0) return
      this.commitFeaturesUpdate(
        selected.map((feature) => ({
          before: cloneValue(feature),
          after: rotateFeature(feature, delta)
        }))
      )
    },
    extrudeSelected(depth = 30) {
      if (!this.document || this.selection?.kind !== 'sketch-entity') return
      const selection = this.selection
      const sketch = this.document.sketches.find((item) => item.id === selection.sketchId)
      const entity = sketch?.entities.find((item) => item.id === selection.entityId)
      if (!sketch || !entity || entity.construction || (entity.type !== 'rectangle' && entity.type !== 'circle')) return
      const feature: Feature = {
        id: createCadId('extrude'),
        type: 'extrude',
        name: `Extrude ${this.document.features.length + 1}`,
        suppressed: false,
        sourceSketchId: sketch.id,
        sourceEntityId: entity.id,
        depth,
        operation: 'new',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
      }
      this.commitDocumentChange(
        'feature.created',
        feature.id,
        { feature },
        (draft) => draft.features.push(cloneValue(feature)),
        { kind: 'feature', featureId: feature.id }
      )
    },
    cutSelected(depth = 12) {
      if (!this.document || this.document.features.length === 0) return
      const selectedFeatures = this.selectedFeatures.map((item) => item.feature)
      if (selectedFeatures.length >= 2) {
        const [target, tool] = selectedFeatures
        const feature = createBooleanFeature(this.document, 'subtract', target, tool, '布尔减')
        this.commitDocumentChange(
          'feature.created',
          feature.id,
          { feature },
          (draft) => draft.features.push(cloneValue(feature)),
          { kind: 'feature', featureId: feature.id }
        )
        return
      }
      if (this.selection?.kind !== 'sketch-entity') return
      const selection = this.selection
      const targetFeature = findLatestTargetFeature(this.document)
      if (!targetFeature) return
      this.createSketchCut(targetFeature.id, selection.sketchId, selection.entityId, depth)
    },
    createSketchCut(targetFeatureId: string, sketchId: string, entityId: string, depth = 30) {
      if (!this.document || this.document.features.length === 0) return
      const targetFeature = this.document.features.find((item) => item.id === targetFeatureId && !item.suppressed)
      if (!targetFeature) return
      const sketch = this.document.sketches.find((item) => item.id === sketchId)
      const entity = sketch?.entities.find((item) => item.id === entityId)
      if (!sketch || !entity || entity.construction || (entity.type !== 'rectangle' && entity.type !== 'circle')) return
      const feature: Feature = {
        id: createCadId('cut'),
        type: 'cut',
        name: `切除 ${this.document.features.length + 1}`,
        suppressed: false,
        targetFeatureId: targetFeature.id,
        toolSketchId: sketch.id,
        toolEntityId: entity.id,
        depth: Math.max(1, depth),
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 }
      }
      this.commitDocumentChange(
        'feature.created',
        feature.id,
        { feature },
        (draft) => draft.features.push(cloneValue(feature)),
        { kind: 'feature', featureId: feature.id }
      )
    },
    booleanSelected(operation: 'add' | 'subtract', targetFeatureId?: string, toolFeatureId?: string) {
      if (!this.document || this.document.features.length < 2) return
      const selectedFeatures = this.selectedFeatures.map((item) => item.feature)
      const target = targetFeatureId
        ? this.document.features.find((feature) => feature.id === targetFeatureId)
        : selectedFeatures[0]
      const tool = toolFeatureId
        ? this.document.features.find((feature) => feature.id === toolFeatureId)
        : selectedFeatures[1]
      if (!target || !tool || target.id === tool.id) return
      const feature = freezeBooleanSubtractFeature(this.document, createBooleanFeature(this.document, operation, target, tool))
      this.commitDocumentChange(
        'feature.created',
        feature.id,
        { feature },
        (draft) => draft.features.push(cloneValue(feature)),
        { kind: 'feature', featureId: feature.id }
      )
    },
    applyAssemblyAlign(axis: 'x' | 'y' | 'z' | 'all') {
      if (!this.document || this.selectedFeatures.length < 2) return
      const [target, source] = this.selectedFeatures.map((item) => item.feature)
      const targetCenter = primitiveCenter(target)
      const sourceCenter = primitiveCenter(source)
      if (!targetCenter || !sourceCenter) return
      const delta: Point3 = {
        x: axis === 'x' || axis === 'all' ? targetCenter.x - sourceCenter.x : 0,
        y: axis === 'y' || axis === 'all' ? targetCenter.y - sourceCenter.y : 0,
        z: axis === 'z' || axis === 'all' ? targetCenter.z - sourceCenter.z : 0
      }
      const afterSource = translateFeature(source, delta)
      const constraint: AssemblyConstraint = {
        id: createCadId('asm'),
        type: 'align',
        axis,
        sourceFeatureId: source.id,
        targetFeatureId: target.id
      }
      this.commitDocumentChange(
        'feature.updated',
        source.id,
        { before: source, feature: afterSource, assemblyConstraint: constraint },
        (draft) => {
          replaceFeature(draft, afterSource)
          ensureAssemblies(draft).push(cloneValue(constraint))
        },
        normalizeFeatureSelection([target.id, source.id])
      )
    },
    applyAssemblyMateZ() {
      if (!this.document || this.selectedFeatures.length < 2) return
      const [base, mate] = this.selectedFeatures.map((item) => item.feature)
      const baseTop = primitiveTop(base)
      const mateBottom = primitiveBottom(mate)
      if (baseTop === null || mateBottom === null) return
      const afterMate = translateFeature(mate, { x: 0, y: 0, z: baseTop - mateBottom })
      const constraint: AssemblyConstraint = {
        id: createCadId('asm'),
        type: 'mate',
        axis: 'z',
        baseFeatureId: base.id,
        mateFeatureId: mate.id
      }
      this.commitDocumentChange(
        'feature.updated',
        mate.id,
        { before: mate, feature: afterMate, assemblyConstraint: constraint },
        (draft) => {
          replaceFeature(draft, afterMate)
          ensureAssemblies(draft).push(cloneValue(constraint))
        },
        normalizeFeatureSelection([base.id, mate.id])
      )
    },
    applyAssemblyDistance(axis: 'x' | 'y' | 'z', distance: number) {
      if (!this.document || this.selectedFeatures.length < 2 || !Number.isFinite(distance)) return
      const [target, source] = this.selectedFeatures.map((item) => item.feature)
      const targetCenter = primitiveCenter(target)
      const sourceCenter = primitiveCenter(source)
      if (!targetCenter || !sourceCenter) return
      const desired = targetCenter[axis] + distance
      const delta: Point3 = { x: 0, y: 0, z: 0 }
      delta[axis] = desired - sourceCenter[axis]
      const afterSource = translateFeature(source, delta)
      const constraint: AssemblyConstraint = {
        id: createCadId('asm'),
        type: 'distance',
        axis,
        sourceFeatureId: source.id,
        targetFeatureId: target.id,
        distance: roundNumber(distance)
      }
      this.commitDocumentChange(
        'feature.updated',
        source.id,
        { before: source, feature: afterSource, assemblyConstraint: constraint },
        (draft) => {
          replaceFeature(draft, afterSource)
          ensureAssemblies(draft).push(cloneValue(constraint))
        },
        normalizeFeatureSelection([target.id, source.id])
      )
    },
    toggleSelectedFeatureFixed() {
      if (!this.document || this.selectedFeatures.length === 0) return
      const selected = this.selectedFeatures.map((item) => item.feature).filter(isTransformableFeature)
      if (selected.length === 0) return
      const shouldLock = selected.some((feature) => !feature.locked)
      const constraints = selected.map<AssemblyConstraint>((feature) => ({
        id: createCadId('asm'),
        type: 'fix',
        featureId: feature.id
      }))
      const before = cloneValue(this.document)
      const after = cloneValue(this.document)
      for (const feature of selected) {
        replaceFeature(after, { ...cloneValue(feature), locked: shouldLock || undefined } as Feature)
      }
      if (shouldLock) {
        ensureAssemblies(after).push(...constraints)
      } else {
        const ids = new Set(selected.map((feature) => feature.id))
        after.assemblies = (after.assemblies ?? []).filter((constraint) => constraint.type !== 'fix' || !ids.has(constraint.featureId))
      }
      this.document = after
      this.selection = normalizeFeatureSelection(selected.map((feature) => feature.id))
      this.history.push(
        createSnapshotCommand(before, after, 'feature.updated', 'assembly-fix', {
          updates: selected.map((feature) => ({
            before: feature,
            after: after.features.find((item) => item.id === feature.id)
          })),
          assemblies: after.assemblies ?? []
        })
      )
      this.historyRevision += 1
      this.markDirty()
      this.broadcastOperation('feature.updated', 'assembly-fix', {
        updates: selected.flatMap((feature) => {
          const updated = after.features.find((item) => item.id === feature.id)
          return updated ? [{ before: feature, after: updated }] : []
        }),
        assemblies: after.assemblies ?? []
      })
    },
    async save(documentId: number, message?: string) {
      if (!this.document) return
      const statusStore = useStatusStore()
      statusStore.setSaveStatus('saving')
      try {
        const dto = await saveDocument(documentId, {
          baseVersion: this.currentVersion,
          snapshotJson: this.document,
          message
        })
        this.currentVersion = dto.currentVersion
        this.document = dto.snapshotJson
        this.dirty = false
        statusStore.setSaveStatus('saved')
      } catch (error) {
        statusStore.setSaveStatus('failed')
        statusStore.reportError(error instanceof Error ? error.message : '保存失败')
        throw error
      }
    },
    broadcastOperation(type: CadOperationType, targetId: string, payload: Record<string, unknown>) {
      if (!this.document) return
      const operation: CadOperation = {
        operationId: createCadId('op'),
        documentId: Number(this.document.documentId),
        type,
        targetId,
        baseVersion: this.currentVersion,
        payload: {
          ...payload,
          documentSnapshot: cloneValue(this.document)
        },
        clientTimestamp: new Date().toISOString()
      }
      void import('./collaboration.store')
        .then(({ useCollaborationStore }) => {
          try {
            useCollaborationStore().sendOperation(operation)
          } catch (error) {
            useStatusStore().setWebsocketStatus('error')
            useStatusStore().reportError(error instanceof Error ? error.message : '协同广播失败，当前变更已保留在本地')
          }
        })
        .catch((error) => {
          useStatusStore().setWebsocketStatus('error')
          useStatusStore().reportError(error instanceof Error ? error.message : '协同模块加载失败，当前变更已保留在本地')
        })
    }
  }
})

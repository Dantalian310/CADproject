import type { AssemblyConstraint, CadDocument, Feature, Sketch, SketchConstraint, SketchEntity } from '@/cad/model/document'
import type { CadOperation } from '@/cad/model/operation'
import { applyConstraintsToEntity, applyRelationConstraint, isRelationConstraint } from '@/cad/geometry/sketchConstraints'

function featureReferencesEntity(feature: Feature, entityId: string): boolean {
  if (feature.type === 'extrude') return feature.sourceEntityId === entityId
  if (feature.type === 'cut') return feature.toolEntityId === entityId
  return false
}

function featureReferencesFeature(feature: Feature, featureId: string): boolean {
  if (feature.type === 'cut') return feature.targetFeatureId === featureId
  if (feature.type === 'boolean') {
    const frozenSubtract = (feature.operation === 'subtract' || feature.operation === 'difference') && Boolean(feature.resultMesh?.vertices.length)
    return feature.targetFeatureId === featureId || (!frozenSubtract && feature.toolFeatureId === featureId)
  }
  return false
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

function findSketchConstraints(document: CadDocument, sketchId: string, entityId: string): SketchConstraint[] {
  return document.sketches
    .find((sketch) => sketch.id === sketchId)
    ?.constraints.filter((constraint) => constraint.entityId === entityId || (isRelationConstraint(constraint) && constraint.targetEntityId === entityId)) ?? []
}

function replaceSketchEntity(document: CadDocument, sketchId: string, entity: SketchEntity): boolean {
  const sketch = document.sketches.find((item) => item.id === sketchId)
  if (!sketch) return false
  const index = sketch.entities.findIndex((item) => item.id === entity.id)
  if (index < 0) return false
  sketch.entities[index] = structuredClone(entity)
  return true
}

function isAssemblyConstraint(value: unknown): value is AssemblyConstraint {
  if (!value || typeof value !== 'object') return false
  const candidate = value as { id?: unknown; type?: unknown }
  return typeof candidate.id === 'string' && typeof candidate.type === 'string'
}

function findOrCreateSketch(document: CadDocument, sketchId: string, sketchPayload: unknown): Sketch | null {
  const existing = document.sketches.find((item) => item.id === sketchId)
  if (existing) return existing
  const sketch = sketchPayload as Partial<Sketch> | undefined
  if (!sketch?.id || !sketch?.name || !sketch?.plane) return null
  const created: Sketch = {
    id: sketch.id,
    name: sketch.name,
    plane: sketch.plane,
    entities: [],
    constraints: []
  }
  document.sketches.push(created)
  return created
}

function applyRelationConstraintsToDocument(document: CadDocument): CadDocument {
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
  return document
}

export function applyRemoteOperation(document: CadDocument, operation: CadOperation): CadDocument {
  const nextDocument = structuredClone(document)
  if (operation.type === 'sketch.entity.created') {
    const sketchId = operation.payload.sketchId
    const sketchPayload = operation.payload.sketch
    const entity = operation.payload.entity as SketchEntity | undefined
    if (typeof sketchId !== 'string' || !entity) return document
    const sketch = findOrCreateSketch(nextDocument, sketchId, sketchPayload)
    if (!sketch || sketch.entities.some((item) => item.id === entity.id)) return document
    sketch.entities.push(entity)
    return applyRelationConstraintsToDocument(nextDocument)
  }
  if (operation.type === 'sketch.entities.created') {
    const entities = operation.payload.entities as Array<{ sketchId: string; entity: SketchEntity }> | undefined
    if (!Array.isArray(entities)) return document
    for (const item of entities) {
      if (typeof item.sketchId !== 'string' || !item.entity) continue
      const sketch = nextDocument.sketches.find((sketchItem) => sketchItem.id === item.sketchId)
      if (!sketch || sketch.entities.some((entity) => entity.id === item.entity.id)) continue
      sketch.entities.push(item.entity)
    }
    return applyRelationConstraintsToDocument(nextDocument)
  }
  if (operation.type === 'constraint.added') {
    const sketchId = operation.payload.sketchId
    const constraint = operation.payload.constraint as SketchConstraint | undefined
    const entity = operation.payload.entity as SketchEntity | undefined
    if (typeof sketchId !== 'string' || !constraint) return document
    const sketch = nextDocument.sketches.find((item) => item.id === sketchId)
    if (!sketch || sketch.constraints.some((item) => item.id === constraint.id)) return document
    sketch.constraints.push(constraint)
    if (entity) {
      const index = sketch.entities.findIndex((item) => item.id === entity.id)
      if (index >= 0) sketch.entities[index] = entity
    }
    return applyRelationConstraintsToDocument(nextDocument)
  }
  if (operation.type === 'constraint.updated') {
    const sketchId = operation.payload.sketchId
    const constraint = operation.payload.constraint as SketchConstraint | undefined
    const entity = operation.payload.entity as SketchEntity | undefined
    if (typeof sketchId !== 'string' || !constraint) return document
    const sketch = nextDocument.sketches.find((item) => item.id === sketchId)
    if (!sketch) return document
    const index = sketch.constraints.findIndex((item) => item.id === constraint.id)
    if (index < 0) return document
    sketch.constraints[index] = constraint
    if (entity) {
      const entityIndex = sketch.entities.findIndex((item) => item.id === entity.id)
      if (entityIndex >= 0) sketch.entities[entityIndex] = entity
    }
    return applyRelationConstraintsToDocument(nextDocument)
  }
  if (operation.type === 'constraint.removed') {
    const sketchId = operation.payload.sketchId
    const constraintId = operation.payload.constraintId
    const entity = operation.payload.entity as SketchEntity | undefined
    if (typeof sketchId !== 'string' || typeof constraintId !== 'string') return document
    const sketch = nextDocument.sketches.find((item) => item.id === sketchId)
    if (!sketch) return document
    sketch.constraints = sketch.constraints.filter((constraint) => constraint.id !== constraintId)
    if (entity) {
      const entityIndex = sketch.entities.findIndex((item) => item.id === entity.id)
      if (entityIndex >= 0) sketch.entities[entityIndex] = entity
    }
    return applyRelationConstraintsToDocument(nextDocument)
  }
  if (operation.type === 'sketch.entity.updated') {
    const sketchId = operation.payload.sketchId
    const entity = operation.payload.entity as SketchEntity | undefined
    if (typeof sketchId !== 'string' || !entity) return document
    const sketch = nextDocument.sketches.find((item) => item.id === sketchId)
    if (!sketch) return document
    const index = sketch.entities.findIndex((item) => item.id === entity.id)
    if (index < 0) return document
    sketch.entities[index] = entity
    return applyRelationConstraintsToDocument(nextDocument)
  }
  if (operation.type === 'sketch.entities.updated') {
    const updates = operation.payload.updates as Array<{ sketchId: string; after: SketchEntity }> | undefined
    const createdEntities = operation.payload.createdEntities as Array<{ sketchId: string; entity: SketchEntity }> | undefined
    if (!Array.isArray(updates) && !Array.isArray(createdEntities)) return document
    if (Array.isArray(updates)) {
      for (const update of updates) {
        if (typeof update.sketchId !== 'string' || !update.after) continue
        const sketch = nextDocument.sketches.find((item) => item.id === update.sketchId)
        if (!sketch) continue
        const index = sketch.entities.findIndex((item) => item.id === update.after.id)
        if (index >= 0) {
          sketch.entities[index] = update.after
        }
      }
    }
    if (Array.isArray(createdEntities)) {
      for (const item of createdEntities) {
        if (typeof item.sketchId !== 'string' || !item.entity) continue
        const sketch = nextDocument.sketches.find((sketchItem) => sketchItem.id === item.sketchId)
        if (!sketch || sketch.entities.some((entity) => entity.id === item.entity.id)) continue
        sketch.entities.push(item.entity)
      }
    }
    return applyRelationConstraintsToDocument(nextDocument)
  }  if (operation.type === 'sketch.entity.deleted') {
    const sketchId = operation.payload.sketchId
    const entityId = operation.payload.entityId
    if (typeof sketchId !== 'string' || typeof entityId !== 'string') return document
    const sketch = nextDocument.sketches.find((item) => item.id === sketchId)
    if (!sketch) return document
    sketch.entities = sketch.entities.filter((entity) => entity.id !== entityId)
    sketch.constraints = sketch.constraints.filter((constraint) => constraint.entityId !== entityId && (!isRelationConstraint(constraint) || constraint.targetEntityId !== entityId))
    const deletedFeatureIds = new Set(
      nextDocument.features.filter((feature) => featureReferencesEntity(feature, entityId)).map((feature) => feature.id)
    )
    removeDependentFeatures(nextDocument, deletedFeatureIds)
    return applyRelationConstraintsToDocument(nextDocument)
  }
  if (operation.type === 'sketch.entities.deleted') {
    const entities = operation.payload.entities as Array<{ sketchId: string; entityId: string }> | undefined
    if (!Array.isArray(entities)) return document
    const deletedFeatureIds = new Set<string>()
    for (const item of entities) {
      if (typeof item.sketchId !== 'string' || typeof item.entityId !== 'string') continue
      const sketch = nextDocument.sketches.find((sketchItem) => sketchItem.id === item.sketchId)
      if (!sketch) continue
      sketch.entities = sketch.entities.filter((entity) => entity.id !== item.entityId)
      sketch.constraints = sketch.constraints.filter((constraint) => constraint.entityId !== item.entityId && (!isRelationConstraint(constraint) || constraint.targetEntityId !== item.entityId))
      nextDocument.features
        .filter((feature) => featureReferencesEntity(feature, item.entityId))
        .forEach((feature) => deletedFeatureIds.add(feature.id))
    }
    removeDependentFeatures(nextDocument, deletedFeatureIds)
    return applyRelationConstraintsToDocument(nextDocument)
  }
  if (operation.type === 'feature.created') {
    const feature = operation.payload.feature as Feature | undefined
    if (!feature || nextDocument.features.some((item) => item.id === feature.id)) return document
    nextDocument.features.push(feature)
    return applyRelationConstraintsToDocument(nextDocument)
  }
  if (operation.type === 'feature.updated') {
    const feature = operation.payload.feature as Feature | undefined
    const updates = operation.payload.updates as Array<{ after: Feature }> | undefined
    const assemblies = operation.payload.assemblies
    if (Array.isArray(updates)) {
      for (const update of updates) {
        if (!update.after) continue
        const index = nextDocument.features.findIndex((item) => item.id === update.after.id)
        if (index >= 0) nextDocument.features[index] = update.after
      }
      if (Array.isArray(assemblies)) {
        nextDocument.assemblies = structuredClone(assemblies)
      }
      return applyRelationConstraintsToDocument(nextDocument)
    }
    if (!feature) return document
    const index = nextDocument.features.findIndex((item) => item.id === feature.id)
    if (index < 0) return document
    nextDocument.features[index] = feature
    const assemblyConstraint = operation.payload.assemblyConstraint
    if (isAssemblyConstraint(assemblyConstraint)) {
      nextDocument.assemblies = [...(nextDocument.assemblies ?? []), structuredClone(assemblyConstraint)]
    }
    if (Array.isArray(assemblies)) {
      nextDocument.assemblies = structuredClone(assemblies)
    }
    return applyRelationConstraintsToDocument(nextDocument)
  }
  if (operation.type === 'feature.deleted') {
    const featureId = operation.payload.featureId
    const featureIds = operation.payload.featureIds as string[] | undefined
    if (Array.isArray(featureIds)) {
      removeDependentFeatures(nextDocument, new Set(featureIds.filter((id) => typeof id === 'string')))
      return applyRelationConstraintsToDocument(nextDocument)
    }
    if (typeof featureId !== 'string') return document
    removeDependentFeatures(nextDocument, new Set([featureId]))
    return applyRelationConstraintsToDocument(nextDocument)
  }
  return document
}

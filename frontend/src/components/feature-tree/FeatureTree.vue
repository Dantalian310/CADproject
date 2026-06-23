<template>
  <section class="tree-panel">
    <div class="tree-header">
      <h2>对象树</h2>
      <div class="tree-actions">
        <el-tooltip content="显示全部草图实体" placement="bottom">
          <el-button :icon="View" size="small" circle :disabled="hiddenEntityCount === 0" @click="showAllEntities" />
        </el-tooltip>
        <el-tooltip content="解锁全部手动锁定实体" placement="bottom">
          <el-button :icon="Unlock" size="small" circle :disabled="lockedEntityCount === 0" @click="unlockAllEntities" />
        </el-tooltip>
      </div>
    </div>
    <el-tree
      :data="treeData"
      node-key="treeKey"
      default-expand-all
      :expand-on-click-node="false"
      @node-click="selectNode"
    >
      <template #default="{ data }">
        <div class="tree-row" :class="rowClass(data)">
          <span class="tree-label" :title="data.label">
            <span class="node-name">{{ data.label }}</span>
            <el-tag v-if="data.kind === 'entity'" size="small" effect="plain">{{ entityTypeLabel(data.entity) }}</el-tag>
            <el-tag v-if="data.kind === 'entity' && data.entity?.construction" size="small" type="info" effect="plain">构造</el-tag>
            <el-tag v-if="data.kind === 'feature' && data.feature?.suppressed" size="small" type="warning" effect="plain">
              抑制
            </el-tag>
          </span>
          <span v-if="data.kind === 'entity'" class="node-actions">
            <el-tooltip :content="data.entity?.visible ? '隐藏实体' : '显示实体'" placement="bottom">
              <el-button
                :icon="data.entity?.visible ? View : Hide"
                size="small"
                text
                @click.stop="toggleEntityVisible(data)"
              />
            </el-tooltip>
            <el-tooltip :content="data.entity?.locked ? '解锁实体' : '锁定实体'" placement="bottom">
              <el-button
                :icon="data.entity?.locked ? Unlock : Lock"
                size="small"
                text
                @click.stop="toggleEntityLocked(data)"
              />
            </el-tooltip>
            <el-tooltip :content="data.entity?.construction ? '转为普通实体' : '转为构造实体'" placement="bottom">
              <el-button size="small" text @click.stop="toggleEntityConstruction(data)">辅</el-button>
            </el-tooltip>
            <el-tooltip content="删除实体" placement="bottom">
              <el-button
                :icon="Delete"
                size="small"
                text
                type="danger"
                :disabled="Boolean(data.entity?.locked)"
                @click.stop="deleteEntity(data)"
              />
            </el-tooltip>
          </span>
        </div>
      </template>
    </el-tree>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Delete, Hide, Lock, Unlock, View } from '@element-plus/icons-vue'
import type { Feature, SketchEntity } from '@/cad/model/document'
import { useCadStore } from '@/stores/cad.store'

interface TreeNode {
  id: string
  treeKey: string
  label: string
  kind: 'document' | 'sketch' | 'entity' | 'feature' | 'group'
  sketchId?: string
  entity?: SketchEntity
  feature?: Feature
  children?: TreeNode[]
}

const cadStore = useCadStore()
const allEntityNodes = computed(() => {
  const document = cadStore.document
  if (!document) return []
  return document.sketches.flatMap((sketch) => sketch.entities.map((entity) => ({ sketchId: sketch.id, entity })))
})
const hiddenEntityCount = computed(() => allEntityNodes.value.filter((item) => !item.entity.visible).length)
const lockedEntityCount = computed(() => allEntityNodes.value.filter((item) => item.entity.locked).length)
const selectedEntityKeys = computed(() => new Set(
  cadStore.selectedSketchEntities.map((item) => entityKey(item.sketchId, item.entity.id))
))
const selectedFeatureKeys = computed(() => new Set(
  cadStore.selectedFeatures.map((item) => item.feature.id)
))
const treeData = computed<TreeNode[]>(() => {
  const document = cadStore.document
  if (!document) return []
  return [
    {
      id: document.documentId,
      treeKey: `document:${document.documentId}`,
      label: document.name,
      kind: 'document',
      children: [
        {
          id: 'sketches',
          treeKey: 'group:sketches',
          label: '草图',
          kind: 'group',
          children: document.sketches.map((sketch) => ({
            id: sketch.id,
            treeKey: `sketch:${sketch.id}`,
            label: `${sketch.name} · ${sketch.plane} (${sketch.entities.length})`,
            kind: 'sketch',
            children: sketch.entities.map((entity) => ({
              id: entity.id,
              treeKey: entityKey(sketch.id, entity.id),
              label: entity.name,
              sketchId: sketch.id,
              entity,
              kind: 'entity'
            }))
          }))
        },
        {
          id: 'features',
          treeKey: 'group:features',
          label: '三维特征',
          kind: 'group',
          children: document.features.map((feature) => ({
            id: feature.id,
            treeKey: `feature:${feature.id}`,
            label: feature.name,
            feature,
            kind: 'feature'
          }))
        }
      ]
    }
  ]
})

function selectNode(node: TreeNode, _treeNode: unknown, _component: unknown, event?: MouseEvent) {
  if (node.kind === 'entity' && node.sketchId && node.entity) {
    if (event?.shiftKey) {
      selectEntityRange(node.sketchId, node.entity.id)
      return
    }
    if (event?.ctrlKey || event?.metaKey) {
      cadStore.toggleSketchEntitySelection(node.sketchId, node.entity.id)
      return
    }
    cadStore.setSelection({ kind: 'sketch-entity', sketchId: node.sketchId, entityId: node.entity.id })
  }
  if (node.kind === 'feature') {
    if (event?.shiftKey) {
      selectFeatureRange(node.id)
      return
    }
    if (event?.ctrlKey || event?.metaKey) {
      cadStore.toggleFeatureSelection(node.id)
      return
    }
    cadStore.setSelection({ kind: 'feature', featureId: node.id })
  }
}

function selectEntityRange(sketchId: string, entityId: string) {
  const sketch = cadStore.document?.sketches.find((item) => item.id === sketchId)
  if (!sketch) return
  const entityIds = sketch.entities.map((entity) => entity.id)
  const targetIndex = entityIds.indexOf(entityId)
  const anchor = cadStore.selectedSketchEntities.find((item) => item.sketchId === sketchId)
  const anchorIndex = anchor ? entityIds.indexOf(anchor.entity.id) : -1
  if (targetIndex < 0 || anchorIndex < 0) {
    cadStore.setSelection({ kind: 'sketch-entity', sketchId, entityId })
    return
  }
  const [start, end] = targetIndex > anchorIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]
  cadStore.setSketchEntitySelection(entityIds.slice(start, end + 1).map((id) => ({ sketchId, entityId: id })))
}

function selectFeatureRange(featureId: string) {
  const features = cadStore.document?.features ?? []
  const featureIds = features.map((feature) => feature.id)
  const targetIndex = featureIds.indexOf(featureId)
  const anchor = cadStore.selectedFeatures[0]?.feature.id
  const anchorIndex = anchor ? featureIds.indexOf(anchor) : -1
  if (targetIndex < 0 || anchorIndex < 0) {
    cadStore.setSelection({ kind: 'feature', featureId })
    return
  }
  const [start, end] = targetIndex > anchorIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]
  cadStore.setFeatureSelection(featureIds.slice(start, end + 1))
}

function toggleEntityVisible(node: TreeNode) {
  if (!node.sketchId || !node.entity) return
  cadStore.commitSketchEntityUpdate(node.sketchId, node.entity, {
    ...cloneEntity(node.entity),
    visible: !node.entity.visible
  })
}

function toggleEntityLocked(node: TreeNode) {
  if (!node.sketchId || !node.entity) return
  cadStore.commitSketchEntityUpdate(node.sketchId, node.entity, {
    ...cloneEntity(node.entity),
    locked: node.entity.locked ? undefined : true
  })
}


function toggleEntityConstruction(node: TreeNode) {
  if (!node.sketchId || !node.entity) return
  cadStore.commitSketchEntityUpdate(node.sketchId, node.entity, {
    ...cloneEntity(node.entity),
    construction: node.entity.construction ? undefined : true
  })
}
function deleteEntity(node: TreeNode) {
  if (!node.sketchId || !node.entity || node.entity.locked) return
  cadStore.setSelection({ kind: 'sketch-entity', sketchId: node.sketchId, entityId: node.entity.id })
  cadStore.deleteSelection()
}

function showAllEntities() {
  const updates = allEntityNodes.value
    .filter((item) => !item.entity.visible)
    .map((item) => ({
      sketchId: item.sketchId,
      before: cloneEntity(item.entity),
      after: { ...cloneEntity(item.entity), visible: true }
    }))
  cadStore.commitSketchEntitiesUpdate(updates)
}

function unlockAllEntities() {
  const updates = allEntityNodes.value
    .filter((item) => item.entity.locked)
    .map((item) => ({
      sketchId: item.sketchId,
      before: cloneEntity(item.entity),
      after: { ...cloneEntity(item.entity), locked: undefined }
    }))
  cadStore.commitSketchEntitiesUpdate(updates)
}

function rowClass(node: TreeNode) {
  return {
    'is-selected': node.kind === 'entity' && node.sketchId
      ? selectedEntityKeys.value.has(entityKey(node.sketchId, node.id))
      : node.kind === 'feature' && selectedFeatureKeys.value.has(node.id),
    'is-hidden': node.kind === 'entity' && node.entity?.visible === false,
    'is-locked': node.kind === 'entity' && Boolean(node.entity?.locked),
    'is-construction': node.kind === 'entity' && Boolean(node.entity?.construction)
  }
}

function entityTypeLabel(entity?: SketchEntity) {
  if (!entity) return ''
  if (entity.type === 'line') return '线'
  if (entity.type === 'rectangle') return '矩形'
  if (entity.type === 'circle') return '圆'
  return '圆弧'
}

function entityKey(sketchId: string, entityId: string) {
  return `entity:${sketchId}:${entityId}`
}

function cloneEntity<T extends SketchEntity>(entity: T): T {
  return JSON.parse(JSON.stringify(entity)) as T
}
</script>

<style scoped>
.tree-panel {
  padding: 12px;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.tree-panel h2 {
  margin: 0;
  font-size: 15px;
}

.tree-actions {
  display: flex;
  gap: 4px;
}

.tree-panel :deep(.el-tree-node__content) {
  height: 30px;
}

.tree-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  padding-right: 4px;
}

.tree-row.is-selected {
  color: #2563eb;
  font-weight: 600;
}

.tree-row.is-hidden .node-name {
  color: #94a3b8;
  text-decoration: line-through;
}

.tree-row.is-locked .node-name::after {
  content: ' 锁';
  color: #64748b;
  font-weight: 500;
}

.tree-label {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.node-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.tree-row:hover .node-actions,
.tree-row.is-selected .node-actions {
  opacity: 1;
}

.node-actions :deep(.el-button) {
  width: 22px;
  height: 22px;
}
</style>

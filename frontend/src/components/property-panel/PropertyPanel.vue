<template>
  <section class="property-panel">
    <h2>属性</h2>
    <template v-if="cadStore.document">
      <el-descriptions :column="1" size="small" border>
        <el-descriptions-item label="文档">{{ cadStore.document.name }}</el-descriptions-item>
        <el-descriptions-item label="版本">v{{ cadStore.currentVersion }}</el-descriptions-item>
        <el-descriptions-item label="单位">{{ cadStore.document.unit }}</el-descriptions-item>
        <el-descriptions-item label="选中">{{ selectionLabel }}</el-descriptions-item>
      </el-descriptions>

      <template v-if="selectedEntity">
        <el-divider content-position="left">草图实体</el-divider>
        <el-form label-position="top" size="small" class="entity-form">
          <el-form-item label="名称">
            <el-input :model-value="selectedEntity.name" @change="updateName" />
          </el-form-item>
          <el-form-item label="显示">
            <el-switch :model-value="selectedEntity.visible" @change="updateVisible" />
          </el-form-item>
          <el-form-item label="锁定">
            <el-switch :model-value="Boolean(selectedEntity.locked)" @change="updateLocked" />
          </el-form-item>
          <el-form-item label="构造">
            <el-switch :model-value="Boolean(selectedEntity.construction)" @change="updateConstruction" />
          </el-form-item>

          <template v-if="selectedEntity.type === 'line'">
            <el-form-item label="起点 X">
              <el-input-number :model-value="selectedEntity.start.x" :step="5" @change="updateLineStartX" />
            </el-form-item>
            <el-form-item label="起点 Y">
              <el-input-number :model-value="selectedEntity.start.y" :step="5" @change="updateLineStartY" />
            </el-form-item>
            <el-form-item label="终点 X">
              <el-input-number :model-value="selectedEntity.end.x" :step="5" @change="updateLineEndX" />
            </el-form-item>
            <el-form-item label="终点 Y">
              <el-input-number :model-value="selectedEntity.end.y" :step="5" @change="updateLineEndY" />
            </el-form-item>
          </template>

          <template v-if="selectedEntity.type === 'rectangle'">
            <el-form-item label="位置 X">
              <el-input-number :model-value="selectedEntity.origin.x" :step="5" @change="updateRectangleOriginX" />
            </el-form-item>
            <el-form-item label="位置 Y">
              <el-input-number :model-value="selectedEntity.origin.y" :step="5" @change="updateRectangleOriginY" />
            </el-form-item>
            <el-form-item label="宽度">
              <el-input-number :model-value="selectedEntity.width" :min="5" :step="5" @change="updateRectangleWidth" />
            </el-form-item>
            <el-form-item label="高度">
              <el-input-number :model-value="selectedEntity.height" :min="5" :step="5" @change="updateRectangleHeight" />
            </el-form-item>
          </template>

          <template v-if="selectedEntity.type === 'circle'">
            <el-form-item label="圆心 X">
              <el-input-number :model-value="selectedEntity.center.x" :step="5" @change="updateCircleCenterX" />
            </el-form-item>
            <el-form-item label="圆心 Y">
              <el-input-number :model-value="selectedEntity.center.y" :step="5" @change="updateCircleCenterY" />
            </el-form-item>
            <el-form-item label="半径">
              <el-input-number :model-value="selectedEntity.radius" :min="5" :step="5" @change="updateCircleRadius" />
            </el-form-item>
          </template>

          <template v-if="selectedEntity.type === 'arc'">
            <el-form-item label="圆心 X">
              <el-input-number :model-value="selectedEntity.center.x" :step="5" @change="updateArcCenterX" />
            </el-form-item>
            <el-form-item label="圆心 Y">
              <el-input-number :model-value="selectedEntity.center.y" :step="5" @change="updateArcCenterY" />
            </el-form-item>
            <el-form-item label="半径">
              <el-input-number :model-value="selectedEntity.radius" :min="5" :step="5" @change="updateArcRadius" />
            </el-form-item>
            <el-form-item label="起始角">
              <el-input-number :model-value="selectedEntity.startAngle" :step="15" @change="updateArcStartAngle" />
            </el-form-item>
            <el-form-item label="终止角">
              <el-input-number :model-value="selectedEntity.endAngle" :step="15" @change="updateArcEndAngle" />
            </el-form-item>
          </template>
        </el-form>
        <el-divider content-position="left">测量</el-divider>
        <div class="measurement-list">
          <div v-for="item in measurementItems" :key="item.id" class="measurement-row">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>

        <el-divider content-position="left">约束</el-divider>
        <div v-if="selectedConstraints.length > 0" class="constraint-list">
          <div v-for="constraint in selectedConstraints" :key="constraint.id" class="constraint-row">
            <el-tag size="small" :type="constraintTagType(constraint)">
              {{ formatConstraintLabel(constraint) }}
            </el-tag>
            <el-input-number
              v-if="constraint.type === 'dimension'"
              :model-value="constraint.value"
              :min="constraint.dimension === 'length' ? 1 : 5"
              :step="5"
              @change="updateDimensionConstraint(constraint.id, $event)"
            />
            <el-button size="small" text type="danger" @click="cadStore.removeConstraint(constraint.id)">
              删除
            </el-button>
          </div>
        </div>
        <el-empty v-else description="暂无约束" :image-size="48" />
      </template>

      <template v-else-if="cadStore.selectionCount > 1">
        <el-divider content-position="left">多选</el-divider>
        <el-descriptions :column="1" size="small" border>
          <template v-if="selectedFeatureItems.length > 1">
            <el-descriptions-item label="三维特征">{{ selectedFeatureItems.length }} 个</el-descriptions-item>
            <el-descriptions-item label="可用操作">移动、布尔加、布尔减、删除</el-descriptions-item>
            <el-descriptions-item label="布尔顺序">第一个选中对象为目标，第二个选中对象为工具实体</el-descriptions-item>
          </template>
          <template v-else>
            <el-descriptions-item label="草图实体">{{ cadStore.selectionCount }} 个</el-descriptions-item>
            <el-descriptions-item label="可用操作">移动、复制、旋转、镜像、阵列、关系约束、删除</el-descriptions-item>
          </template>
        </el-descriptions>
        <el-divider v-if="selectedFeatureItems.length <= 1" content-position="left">测量</el-divider>
        <div v-if="selectedFeatureItems.length <= 1" class="measurement-list">
          <div v-for="item in measurementItems" :key="item.id" class="measurement-row">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </template>

      <template v-else-if="cadStore.selectedFeature">
        <el-divider content-position="left">三维特征</el-divider>
        <el-descriptions :column="1" size="small" border>
          <el-descriptions-item label="名称">{{ cadStore.selectedFeature.name }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ cadStore.selectedFeature.type }}</el-descriptions-item>
        </el-descriptions>
        <el-form label-position="top" size="small" class="entity-form feature-form">
          <el-form-item label="名称">
            <el-input :model-value="cadStore.selectedFeature.name" @change="updateFeatureName" />
          </el-form-item>
          <el-form-item label="抑制">
            <el-switch :model-value="cadStore.selectedFeature.suppressed" @change="updateFeatureSuppressed" />
          </el-form-item>
          <el-form-item v-if="isTransformableFeature(cadStore.selectedFeature)" label="固定">
            <el-switch :model-value="Boolean(cadStore.selectedFeature.locked)" @change="updateFeatureLocked" />
          </el-form-item>
          <template v-if="isTransformableFeature(cadStore.selectedFeature)">
            <el-form-item label="位置 X">
              <el-input-number :model-value="cadStore.selectedFeature.position?.x ?? 0" :step="10" @change="updateFeaturePosition('x', $event)" />
            </el-form-item>
            <el-form-item label="位置 Y">
              <el-input-number :model-value="cadStore.selectedFeature.position?.y ?? 0" :step="10" @change="updateFeaturePosition('y', $event)" />
            </el-form-item>
            <el-form-item label="位置 Z">
              <el-input-number :model-value="cadStore.selectedFeature.position?.z ?? 0" :step="10" @change="updateFeaturePosition('z', $event)" />
            </el-form-item>
            <el-form-item label="旋转 X">
              <el-input-number :model-value="cadStore.selectedFeature.rotation?.x ?? 0" :min="-360" :max="360" :step="15" @change="updateFeatureRotation('x', $event)" />
            </el-form-item>
            <el-form-item label="旋转 Y">
              <el-input-number :model-value="cadStore.selectedFeature.rotation?.y ?? 0" :min="-360" :max="360" :step="15" @change="updateFeatureRotation('y', $event)" />
            </el-form-item>
            <el-form-item label="旋转 Z">
              <el-input-number :model-value="cadStore.selectedFeature.rotation?.z ?? 0" :min="-360" :max="360" :step="15" @change="updateFeatureRotation('z', $event)" />
            </el-form-item>
          </template>
          <template v-if="cadStore.selectedFeature.type === 'box'">
            <el-form-item label="长度 X">
              <el-input-number :model-value="cadStore.selectedFeature.length" :min="1" :step="10" @change="updateBoxDimension('length', $event)" />
            </el-form-item>
            <el-form-item label="宽度 Y">
              <el-input-number :model-value="cadStore.selectedFeature.width" :min="1" :step="10" @change="updateBoxDimension('width', $event)" />
            </el-form-item>
            <el-form-item label="高度 Z">
              <el-input-number :model-value="cadStore.selectedFeature.height" :min="1" :step="10" @change="updateBoxDimension('height', $event)" />
            </el-form-item>
          </template>
          <el-form-item v-if="cadStore.selectedFeature.type === 'sphere'" label="半径">
            <el-input-number :model-value="cadStore.selectedFeature.radius" :min="1" :step="5" @change="updateSphereRadius" />
          </el-form-item>
          <template v-if="cadStore.selectedFeature.type === 'cone'">
            <el-form-item label="底面半径">
              <el-input-number :model-value="cadStore.selectedFeature.baseRadius" :min="1" :step="5" @change="updateConeBaseRadius" />
            </el-form-item>
            <el-form-item label="高度">
              <el-input-number :model-value="cadStore.selectedFeature.height" :min="1" :step="10" @change="updateConeHeight" />
            </el-form-item>
          </template>
          <el-form-item v-if="cadStore.selectedFeature.type === 'extrude' || cadStore.selectedFeature.type === 'cut'" label="深度">
            <el-input-number :model-value="cadStore.selectedFeature.depth" :min="1" :step="5" @change="updateFeatureDepth" />
          </el-form-item>
          <el-form-item v-if="cadStore.selectedFeature.type === 'boolean'" label="布尔方式">
            <el-select
              :model-value="booleanOperationValue(cadStore.selectedFeature.operation)"
              :disabled="Boolean(cadStore.selectedFeature.resultMesh)"
              @change="updateBooleanOperation"
            >
              <el-option label="布尔加" value="add" />
              <el-option label="布尔减" value="subtract" />
            </el-select>
          </el-form-item>
        </el-form>
      </template>
    </template>
    <el-empty v-else description="未加载文档" />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ArcEntity, BooleanFeature, BoxFeature, CircleEntity, ConeFeature, CutFeature, ExtrudeFeature, Feature, LineEntity, RectangleEntity, SketchConstraint, SketchEntity, SphereFeature } from '@/cad/model/document'
import { normalizeAngle } from '@/cad/geometry/sketchArcGeometry'
import { constraintLabel } from '@/cad/geometry/sketchConstraints'
import { buildSketchSelectionMeasurements } from '@/cad/geometry/sketchMeasurements'
import { useCadStore } from '@/stores/cad.store'

const cadStore = useCadStore()
const selectedEntity = computed(() => cadStore.selectedSketchEntity)
const selectedFeatureItems = computed(() => cadStore.selectedFeatures)
const selectedConstraints = computed(() => cadStore.selectedSketchConstraints)
const measurementItems = computed(() => buildSketchSelectionMeasurements(cadStore.selectedSketchEntities.map((item) => item.entity)))
const selectionLabel = computed(() => {
  if (selectedEntity.value) return `${selectedEntity.value.name} (${selectedEntity.value.type})`
  if (selectedFeatureItems.value.length > 1) return `${selectedFeatureItems.value.length} 个三维特征`
  if (cadStore.selectionCount > 1) return `${cadStore.selectionCount} 个草图实体`
  if (cadStore.selectedFeature) return `${cadStore.selectedFeature.name} (${cadStore.selectedFeature.type})`
  return '无'
})

function updateName(value: string | number) {
  const entity = selectedEntity.value
  if (!entity) return
  cadStore.updateSelectedEntity({ ...cloneEntity(entity), name: String(value).trim() || entity.name })
}

function updateVisible(value: string | number | boolean) {
  const entity = selectedEntity.value
  if (!entity) return
  cadStore.updateSelectedEntity({ ...cloneEntity(entity), visible: Boolean(value) })
}

function updateLocked(value: string | number | boolean) {
  const entity = selectedEntity.value
  if (!entity) return
  cadStore.updateSelectedEntity({ ...cloneEntity(entity), locked: Boolean(value) || undefined })
}

function updateConstruction(value: string | number | boolean) {
  const entity = selectedEntity.value
  if (!entity) return
  cadStore.updateSelectedEntity({ ...cloneEntity(entity), construction: Boolean(value) || undefined })
}

function updateLine(pointName: 'start' | 'end', axis: 'x' | 'y', value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || selectedEntity.value?.type !== 'line') return
  const entity = cloneEntity(selectedEntity.value) as LineEntity
  entity[pointName] = { ...entity[pointName], [axis]: value }
  cadStore.updateSelectedEntity(entity)
}

function updateLineStartX(value: number | undefined) {
  updateLine('start', 'x', value)
}

function updateLineStartY(value: number | undefined) {
  updateLine('start', 'y', value)
}

function updateLineEndX(value: number | undefined) {
  updateLine('end', 'x', value)
}

function updateLineEndY(value: number | undefined) {
  updateLine('end', 'y', value)
}

function updateRectangle(field: 'origin.x' | 'origin.y' | 'width' | 'height', value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || selectedEntity.value?.type !== 'rectangle') return
  const entity = cloneEntity(selectedEntity.value) as RectangleEntity
  if (field === 'origin.x') entity.origin = { ...entity.origin, x: value }
  if (field === 'origin.y') entity.origin = { ...entity.origin, y: value }
  if (field === 'width') entity.width = Math.max(5, value)
  if (field === 'height') entity.height = Math.max(5, value)
  cadStore.updateSelectedEntity(entity)
}

function updateRectangleOriginX(value: number | undefined) {
  updateRectangle('origin.x', value)
}

function updateRectangleOriginY(value: number | undefined) {
  updateRectangle('origin.y', value)
}

function updateRectangleWidth(value: number | undefined) {
  updateRectangle('width', value)
}

function updateRectangleHeight(value: number | undefined) {
  updateRectangle('height', value)
}

function updateCircle(field: 'center.x' | 'center.y' | 'radius', value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || selectedEntity.value?.type !== 'circle') return
  const entity = cloneEntity(selectedEntity.value) as CircleEntity
  if (field === 'center.x') entity.center = { ...entity.center, x: value }
  if (field === 'center.y') entity.center = { ...entity.center, y: value }
  if (field === 'radius') entity.radius = Math.max(5, value)
  cadStore.updateSelectedEntity(entity)
}

function updateCircleCenterX(value: number | undefined) {
  updateCircle('center.x', value)
}

function updateCircleCenterY(value: number | undefined) {
  updateCircle('center.y', value)
}

function updateCircleRadius(value: number | undefined) {
  updateCircle('radius', value)
}

function updateArc(field: 'center.x' | 'center.y' | 'radius' | 'startAngle' | 'endAngle', value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || selectedEntity.value?.type !== 'arc') return
  const entity = cloneEntity(selectedEntity.value) as ArcEntity
  if (field === 'center.x') entity.center = { ...entity.center, x: value }
  if (field === 'center.y') entity.center = { ...entity.center, y: value }
  if (field === 'radius') entity.radius = Math.max(5, value)
  if (field === 'startAngle') entity.startAngle = normalizeAngle(value)
  if (field === 'endAngle') entity.endAngle = normalizeAngle(value)
  cadStore.updateSelectedEntity(entity)
}

function updateArcCenterX(value: number | undefined) {
  updateArc('center.x', value)
}

function updateArcCenterY(value: number | undefined) {
  updateArc('center.y', value)
}

function updateArcRadius(value: number | undefined) {
  updateArc('radius', value)
}

function updateArcStartAngle(value: number | undefined) {
  updateArc('startAngle', value)
}

function updateArcEndAngle(value: number | undefined) {
  updateArc('endAngle', value)
}

function updateDimensionConstraint(constraintId: string, value: number | undefined) {
  cadStore.updateConstraintValue(constraintId, value)
}

function formatConstraintLabel(constraint: SketchConstraint): string {
  if (constraint.type === 'dimension') {
    return `${constraintLabel(constraint)} ${constraint.value} mm`
  }
  return constraintLabel(constraint)
}

function constraintTagType(constraint: SketchConstraint) {
  if (constraint.type === 'fixed') return 'danger'
  if (constraint.type === 'dimension') return 'warning'
  return 'success'
}

function updateFeatureName(value: string | number) {
  const feature = cadStore.selectedFeature
  if (!feature) return
  cadStore.updateSelectedFeature({ ...cloneFeature(feature), name: String(value).trim() || feature.name })
}

function updateFeatureSuppressed(value: string | number | boolean) {
  const feature = cadStore.selectedFeature
  if (!feature) return
  cadStore.updateSelectedFeature({ ...cloneFeature(feature), suppressed: Boolean(value) })
}

function updateFeatureLocked(value: string | number | boolean) {
  const feature = cadStore.selectedFeature
  if (!feature || !isTransformableFeature(feature)) return
  cadStore.updateSelectedFeature({ ...cloneFeature(feature), locked: Boolean(value) || undefined })
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

function updateFeaturePosition(axis: 'x' | 'y' | 'z', value: number | undefined) {
  const feature = cadStore.selectedFeature
  if (typeof value !== 'number' || !Number.isFinite(value) || !feature || !isTransformableFeature(feature)) return
  const position = feature.position ?? { x: 0, y: 0, z: 0 }
  cadStore.updateSelectedFeature({
    ...cloneFeature(feature),
    position: {
      ...position,
      [axis]: value
    }
  })
}

function updateFeatureRotation(axis: 'x' | 'y' | 'z', value: number | undefined) {
  const feature = cadStore.selectedFeature
  if (typeof value !== 'number' || !Number.isFinite(value) || !feature || !isTransformableFeature(feature)) return
  cadStore.updateSelectedFeature({
    ...cloneFeature(feature),
    rotation: {
      x: feature.rotation?.x ?? 0,
      y: feature.rotation?.y ?? 0,
      z: feature.rotation?.z ?? 0,
      [axis]: value
    }
  })
}

function updateBoxDimension(field: 'length' | 'width' | 'height', value: number | undefined) {
  const feature = cadStore.selectedFeature
  if (typeof value !== 'number' || !Number.isFinite(value) || !feature || feature.type !== 'box') return
  cadStore.updateSelectedFeature({ ...cloneFeature(feature), [field]: Math.max(1, value) } as BoxFeature)
}

function updateSphereRadius(value: number | undefined) {
  const feature = cadStore.selectedFeature
  if (typeof value !== 'number' || !Number.isFinite(value) || !feature || feature.type !== 'sphere') return
  cadStore.updateSelectedFeature({ ...cloneFeature(feature), radius: Math.max(1, value) } as SphereFeature)
}

function updateConeBaseRadius(value: number | undefined) {
  const feature = cadStore.selectedFeature
  if (typeof value !== 'number' || !Number.isFinite(value) || !feature || feature.type !== 'cone') return
  cadStore.updateSelectedFeature({ ...cloneFeature(feature), baseRadius: Math.max(1, value) } as ConeFeature)
}

function updateConeHeight(value: number | undefined) {
  const feature = cadStore.selectedFeature
  if (typeof value !== 'number' || !Number.isFinite(value) || !feature || feature.type !== 'cone') return
  cadStore.updateSelectedFeature({ ...cloneFeature(feature), height: Math.max(1, value) } as ConeFeature)
}
function updateFeatureDepth(value: number | undefined) {
  const feature = cadStore.selectedFeature
  if (typeof value !== 'number' || !Number.isFinite(value) || !feature) return
  if (feature.type === 'extrude') {
    cadStore.updateSelectedFeature({ ...cloneFeature(feature), depth: Math.max(1, value) } as ExtrudeFeature)
  }
  if (feature.type === 'cut') {
    cadStore.updateSelectedFeature({ ...cloneFeature(feature), depth: Math.max(1, value) } as CutFeature)
  }
}

function booleanOperationValue(value: string): 'add' | 'subtract' {
  return value === 'union' || value === 'add' ? 'add' : 'subtract'
}

function updateBooleanOperation(value: 'add' | 'subtract') {
  const feature = cadStore.selectedFeature
  if (!feature || feature.type !== 'boolean') return
  if (feature.resultMesh?.vertices.length) return
  cadStore.updateSelectedFeature({ ...cloneFeature(feature), operation: value } as BooleanFeature)
}

function cloneEntity<T extends SketchEntity>(entity: T): T {
  return JSON.parse(JSON.stringify(entity)) as T
}

function cloneFeature<T extends Feature>(feature: T): T {
  return JSON.parse(JSON.stringify(feature)) as T
}
</script>

<style scoped>
.property-panel {
  padding: 12px;
}

.property-panel h2 {
  margin: 0 0 12px;
  font-size: 15px;
}

.entity-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 10px;
}

.entity-form :deep(.el-form-item:first-child) {
  grid-column: 1 / -1;
}

.entity-form :deep(.el-input-number) {
  width: 100%;
}

.entity-form :deep(.el-select) {
  width: 100%;
}

.feature-form {
  margin-top: 12px;
}

.constraint-list,
.measurement-list {
  display: grid;
  gap: 8px;
}

.constraint-row {
  display: grid;
  grid-template-columns: minmax(74px, 96px) minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.constraint-row :deep(.el-input-number) {
  width: 100%;
}
.measurement-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 28px;
  padding: 4px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f8fafc;
  font-size: 12px;
}

.measurement-row span {
  color: #64748b;
}

.measurement-row strong {
  min-width: 0;
  overflow: hidden;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

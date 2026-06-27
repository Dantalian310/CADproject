<template>
  <section
    ref="container"
    class="viewport-shell"
    :class="{ 'is-readonly': readonly }"
    @contextmenu.prevent
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerCancel"
  >
    <div class="viewport-overlay">
      <span>工具：{{ cadStore.activeTool }}</span>
      <span v-if="cursorPoint">坐标：{{ cursorPoint.x.toFixed(1) }}, {{ cursorPoint.y.toFixed(1) }} mm</span>
      <span v-if="activeSnap">吸附：{{ activeSnap.label }} {{ activeSnap.point.x.toFixed(1) }}, {{ activeSnap.point.y.toFixed(1) }} mm</span>
      <span>网格：{{ cadStore.sketchSnapSettings.gridSnap ? `${cadStore.sketchSnapSettings.gridSize} mm` : '关' }}</span>
      <span>平面：{{ cadStore.activeSketchPlane }}；右键旋转 / 中键平移 / 滚轮缩放</span>
      <span>对象捕捉：{{ cadStore.sketchSnapSettings.objectSnap ? '开' : '关' }}</span>
      <span>角度捕捉：{{ cadStore.sketchSnapSettings.angleSnap ? `${cadStore.sketchSnapSettings.angleStep}°` : '关' }}</span>
      <span v-if="draftStart">起点：{{ draftStart.x.toFixed(1) }}, {{ draftStart.y.toFixed(1) }} mm</span>
      <span v-if="arcCenter">圆弧圆心：{{ arcCenter.x.toFixed(1) }}, {{ arcCenter.y.toFixed(1) }} mm</span>
      <span v-if="draftMeasurement">{{ draftMeasurement }}</span>
      <span v-if="cadStore.selectedSketchEntity">选中：{{ cadStore.selectedSketchEntity.name }}</span>
      <span v-else-if="cadStore.selectionCount > 1">已选：{{ cadStore.selectionCount }} 个对象</span>
    </div>
    <div
      v-if="quickDimensionKind"
      class="quick-dimension-panel"
      @pointerdown.stop
      @pointerup.stop
      @click.stop
      @wheel.stop
    >
      <div class="quick-dimension-title">{{ quickDimensionTitle }}</div>
      <div v-if="quickDimensionKind === 'line'" class="quick-dimension-grid is-line">
        <label>
          X1
          <el-input-number v-model="quickValues.lineStartX" size="small" :controls="false" @change="applyQuickLinePoints" />
        </label>
        <label>
          Y1
          <el-input-number v-model="quickValues.lineStartY" size="small" :controls="false" @change="applyQuickLinePoints" />
        </label>
        <label>
          X2
          <el-input-number v-model="quickValues.lineEndX" size="small" :controls="false" @change="applyQuickLinePoints" />
        </label>
        <label>
          Y2
          <el-input-number v-model="quickValues.lineEndY" size="small" :controls="false" @change="applyQuickLinePoints" />
        </label>
        <label class="is-wide">
          长度
          <el-input-number v-model="quickValues.lineLength" size="small" :min="1" :controls="false" @change="applyQuickLineLength" />
        </label>
      </div>
      <div v-if="quickDimensionKind === 'rectangle'" class="quick-dimension-grid">
        <label>
          X
          <el-input-number v-model="quickValues.rectX" size="small" :controls="false" @change="applyQuickRectangle" />
        </label>
        <label>
          Y
          <el-input-number v-model="quickValues.rectY" size="small" :controls="false" @change="applyQuickRectangle" />
        </label>
        <label>
          W
          <el-input-number v-model="quickValues.rectWidth" size="small" :min="1" :controls="false" @change="applyQuickRectangle" />
        </label>
        <label>
          H
          <el-input-number v-model="quickValues.rectHeight" size="small" :min="1" :controls="false" @change="applyQuickRectangle" />
        </label>
      </div>
      <div v-if="quickDimensionKind === 'circle'" class="quick-dimension-grid">
        <label>
          X
          <el-input-number v-model="quickValues.circleX" size="small" :controls="false" @change="applyQuickCircle" />
        </label>
        <label>
          Y
          <el-input-number v-model="quickValues.circleY" size="small" :controls="false" @change="applyQuickCircle" />
        </label>
        <label class="is-wide">
          半径
          <el-input-number v-model="quickValues.circleRadius" size="small" :min="1" :controls="false" @change="applyQuickCircle" />
        </label>
      </div>
      <div v-if="quickDimensionKind === 'arc'" class="quick-dimension-grid">
        <label>
          X
          <el-input-number v-model="quickValues.arcX" size="small" :controls="false" @change="applyQuickArc" />
        </label>
        <label>
          Y
          <el-input-number v-model="quickValues.arcY" size="small" :controls="false" @change="applyQuickArc" />
        </label>
        <label>
          半径
          <el-input-number v-model="quickValues.arcRadius" size="small" :min="1" :controls="false" @change="applyQuickArc" />
        </label>
        <label>
          起角
          <el-input-number v-model="quickValues.arcStartAngle" size="small" :controls="false" @change="applyQuickArc" />
        </label>
        <label class="is-wide">
          止角
          <el-input-number v-model="quickValues.arcEndAngle" size="small" :controls="false" @change="applyQuickArc" />
        </label>
      </div>
    </div>
    <div v-if="selectionBox" class="selection-box" :style="selectionBoxStyle" />
    <button
      v-for="hotspot in dimensionHotspots"
      :key="hotspot.constraintId"
      class="dimension-hotspot"
      :style="hotspot.style"
      type="button"
      :aria-label="`编辑${hotspot.label}`"
      :disabled="readonly"
      @pointerdown.stop
      @click.stop="editDimensionValue(hotspot)"
    />
    <RemoteCursorLayer />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import type { ArcEntity, Feature, LineEntity, Point2, Point3, RectangleEntity, SketchEntity } from '@/cad/model/document'
import { useCadStore, type CadToolType } from '@/stores/cad.store'
import { useCollaborationStore } from '@/stores/collaboration.store'
import { SceneManager } from '@/cad/geometry/sceneManager'
import type { CadViewPreset } from '@/cad/geometry/sceneManager'
import { findNearestSketchSnap, sketchEntityKey, type SketchSnapResult } from '@/cad/geometry/sketchSnapping'
import { resolveSketchGridStep, roundPointToSketchGrid, snapPointToSketchAngle } from '@/cad/geometry/sketchSnapSettings'
import { buildDimensionAnnotations, type DimensionAnnotation } from '@/cad/geometry/sketchDimensionAnnotations'
import { ThreeGeometryKernel } from '@/cad/geometry/threeGeometryKernel'
import { angleFromPoint, arcEndPoint, arcMidPoint, arcStartPoint, makeArcFromCenterPoints, normalizeAngle, sampleArcPoints } from '@/cad/geometry/sketchArcGeometry'
import { resolveCadKeyboardAction, type CadKeyboardAction } from '@/cad/commands/keyboardShortcuts'
import RemoteCursorLayer from './RemoteCursorLayer.vue'

const props = defineProps<{ readonly?: boolean }>()

type ResizeHandle =
  | 'line-start'
  | 'line-end'
  | 'rect-sw'
  | 'rect-se'
  | 'rect-ne'
  | 'rect-nw'
  | 'circle-radius'
  | 'arc-start'
  | 'arc-end'
  | 'arc-radius'

type DragMode = 'draw' | 'move' | 'move-many' | 'resize' | 'box-select' | 'feature-move' | 'feature-move-many' | 'feature-rotate' | 'feature-rotate-many'

interface SelectedEntitySnapshot {
  sketchId: string
  entity: SketchEntity
}

interface DragState {
  pointerId: number
  mode: DragMode
  startPoint: Point2
  startPoint3?: Point3
  screenStart?: Point2
  screenCurrent?: Point2
  sketchId?: string
  entityId?: string
  featureId?: string
  originalEntity?: SketchEntity
  originalFeature?: Feature
  originalFeatures?: Feature[]
  originalEntities?: SelectedEntitySnapshot[]
  featureIds?: string[]
  featureDelta?: Point3
  handle?: ResizeHandle
  tool?: Extract<CadToolType, 'line' | 'rectangle' | 'circle' | 'arc'>
  arcCenter?: Point2
  additive?: boolean
}

interface EntityHit {
  sketchId: string
  entity: SketchEntity
  handle?: ResizeHandle
}

interface SketchPointOptions {
  allowEntitySnap?: boolean
  snapToGrid?: boolean
  excludeEntityKeys?: Set<string>
}

interface DimensionHotspot extends DimensionAnnotation {
  style: Record<string, string>
}

const cadStore = useCadStore()
const collaborationStore = useCollaborationStore()
const container = ref<HTMLElement | null>(null)
const cursorPoint = ref<Point2 | null>(null)
const draftStart = ref<Point2 | null>(null)
const arcCenter = ref<Point2 | null>(null)
const draftEntity = ref<SketchEntity | null>(null)
const activeSnap = ref<SketchSnapResult | null>(null)
const dragState = ref<DragState | null>(null)
const selectionBox = ref<{ start: Point2; current: Point2 } | null>(null)
const dimensionHotspots = ref<DimensionHotspot[]>([])
let sceneManager: SceneManager | null = null
let overlayAnimationFrame = 0
let hotspotSignature = ''

const hitTolerance = 8
const draftMeasurement = computed(() => (draftEntity.value ? describeEntitySize(draftEntity.value) : ''))
const quickDimensionKind = computed(() => {
  if (props.readonly || draftEntity.value || cadStore.selection?.kind !== 'sketch-entity') return null
  return cadStore.selectedSketchEntity?.type ?? null
})
const quickDimensionTitle = computed(() => {
  if (quickDimensionKind.value === 'line') return '线段尺寸'
  if (quickDimensionKind.value === 'rectangle') return '矩形尺寸'
  if (quickDimensionKind.value === 'circle') return '圆尺寸'
  if (quickDimensionKind.value === 'arc') return '圆弧尺寸'
  return ''
})
const quickValues = reactive({
  lineStartX: 0,
  lineStartY: 0,
  lineEndX: 0,
  lineEndY: 0,
  lineLength: 0,
  rectX: 0,
  rectY: 0,
  rectWidth: 0,
  rectHeight: 0,
  circleX: 0,
  circleY: 0,
  circleRadius: 0,
  arcX: 0,
  arcY: 0,
  arcRadius: 0,
  arcStartAngle: 0,
  arcEndAngle: 0
})
const selectionBoxStyle = computed(() => {
  if (!selectionBox.value) return {}
  const left = Math.min(selectionBox.value.start.x, selectionBox.value.current.x)
  const top = Math.min(selectionBox.value.start.y, selectionBox.value.current.y)
  const width = Math.abs(selectionBox.value.current.x - selectionBox.value.start.x)
  const height = Math.abs(selectionBox.value.current.y - selectionBox.value.start.y)
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`
  }
})

defineExpose({
  applyViewCommand
})

onMounted(() => {
  if (!container.value) return
  sceneManager = new SceneManager(new ThreeGeometryKernel())
  sceneManager.init(container.value)
  refreshScene()
  startOverlayProjectionLoop()
  window.addEventListener('resize', resize)
  window.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  window.removeEventListener('keydown', handleKeyDown)
  if (overlayAnimationFrame) {
    window.cancelAnimationFrame(overlayAnimationFrame)
    overlayAnimationFrame = 0
  }
  sceneManager?.dispose()
})

watch(
  [
    () => cadStore.document,
    () => cadStore.selection,
    () => cadStore.transformPreviewEntities,
    () => cadStore.sketchSnapSettings.gridSnap,
    () => cadStore.sketchSnapSettings.objectSnap,
    () => cadStore.sketchSnapSettings.angleSnap,
    () => cadStore.sketchSnapSettings.gridSize,
    () => cadStore.sketchSnapSettings.angleStep,
    () => cadStore.activeSketchPlane,
    () => draftEntity.value,
    () => activeSnap.value
  ],
  () => refreshScene()
)

watch(
  () => cadStore.selectedSketchEntity,
  (entity) => syncQuickDimensionValues(entity),
  { immediate: true, deep: true }
)

watch(
  () => cadStore.activeTool,
  (tool) => {
    if (tool !== 'arc') {
      arcCenter.value = null
    }
  }
)

function resize() {
  sceneManager?.resize()
  refreshScene()
  updateDimensionHotspots()
}

function refreshScene() {
  if (isFeatureTranslationDrag(dragState.value)) return
  if (cadStore.document) {
    sceneManager?.setActiveSketchPlane(cadStore.activeSketchPlane)
    sceneManager?.setGridSize(cadStore.sketchSnapSettings.gridSize)
    sceneManager?.rebuild(
      cadStore.document,
      cadStore.selection,
      draftEntity.value,
      activeSnap.value,
      cadStore.transformPreviewEntities
    )
    updateDimensionHotspots()
  }
}

function applyViewCommand(command: CadViewPreset | 'fit') {
  if (command === 'fit') {
    sceneManager?.fitToDocument(cadStore.document)
    updateDimensionHotspots()
    return
  }
  sceneManager?.setViewPreset(command)
  updateDimensionHotspots()
}

function startOverlayProjectionLoop() {
  const updateFrame = () => {
    updateDimensionHotspots()
    overlayAnimationFrame = window.requestAnimationFrame(updateFrame)
  }
  updateFrame()
}

function updateDimensionHotspots() {
  if (!cadStore.document || !sceneManager) {
    dimensionHotspots.value = []
    hotspotSignature = ''
    return
  }

  const hotspots = buildDimensionAnnotations(cadStore.document).flatMap((annotation) => {
    const screen = sceneManager?.sketchPointToScreen(annotation.labelPoint, annotation.sketchPlane)
    if (!screen) return []
    return [{
      ...annotation,
      style: {
        left: `${screen.x}px`,
        top: `${screen.y}px`
      }
    }]
  })
  const nextSignature = hotspots
    .map((hotspot) => `${hotspot.constraintId}:${hotspot.label}:${hotspot.style.left}:${hotspot.style.top}`)
    .join('|')
  if (nextSignature !== hotspotSignature) {
    hotspotSignature = nextSignature
    dimensionHotspots.value = hotspots
  }
}

async function editDimensionValue(hotspot: DimensionHotspot) {
  if (props.readonly) return
  try {
    const result = await ElMessageBox.prompt('请输入新的尺寸值（mm）', hotspot.label, {
      confirmButtonText: '应用',
      cancelButtonText: '取消',
      inputValue: extractDimensionValue(hotspot.label),
      inputPattern: /^\d+(\.\d+)?$/,
      inputErrorMessage: '请输入大于 0 的数字'
    })
    const value = Number(result.value)
    if (Number.isFinite(value) && value > 0) {
      cadStore.updateConstraintValue(hotspot.constraintId, value)
      updateDimensionHotspots()
    }
  } catch {
    // 用户取消输入时不需要提示。
  }
}

function handlePointerDown(event: PointerEvent) {
  if (!container.value || !cadStore.document || event.button !== 0) return
  const activeTool = cadStore.activeTool
  const drawingTool = isDrawingTool(activeTool)
  const screenPoint = toLocalScreenPoint(event)
  const point = toSketchPoint(event, {
    allowEntitySnap: drawingTool,
    snapToGrid: drawingTool
  })
  if (point) cursorPoint.value = point

  if (activeTool === 'arc') {
    if (!point) return
    if (props.readonly) return
    if (!arcCenter.value) {
      arcCenter.value = point
      draftStart.value = point
      draftEntity.value = null
      refreshScene()
      return
    }
    draftStart.value = point
    draftEntity.value = buildDraftEntity(activeTool, point, point, arcCenter.value)
    dragState.value = {
      pointerId: event.pointerId,
      mode: 'draw',
      startPoint: point,
      tool: activeTool,
      arcCenter: arcCenter.value
    }
    container.value.setPointerCapture(event.pointerId)
    refreshScene()
    return
  }

  if (drawingTool) {
    if (!point) return
    if (props.readonly) return
    draftStart.value = point
    draftEntity.value = buildDraftEntity(activeTool, point, point)
    dragState.value = {
      pointerId: event.pointerId,
      mode: 'draw',
      startPoint: point,
      tool: activeTool
    }
    container.value.setPointerCapture(event.pointerId)
    refreshScene()
    return
  }

  const featureId = sceneManager?.pickFeature(event.clientX, event.clientY)
  const feature = featureId ? findFeature(featureId) : null
  if (feature) {
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      cadStore.toggleFeatureSelection(feature.id)
      dragState.value = null
      return
    }

    const moveManyFeatures = cadStore.isFeatureSelected(feature.id)
      && cadStore.selectedFeatures.length > 1
      && cadStore.selectedFeatures.every((item) => isMovableFeature(item.feature))
    const rotateManyFeatures = event.altKey
      && cadStore.isFeatureSelected(feature.id)
      && cadStore.selectedFeatures.length > 1
      && cadStore.selectedFeatures.every((item) => isRotatableFeature(item.feature))

    if (!moveManyFeatures && !rotateManyFeatures) {
      cadStore.setSelection({ kind: 'feature', featureId: feature.id })
    }

    const selectedForDrag = (moveManyFeatures || rotateManyFeatures)
      ? cadStore.selectedFeatures.map((item) => cloneFeature(item.feature))
      : undefined
    if (!props.readonly && (event.altKey ? isRotatableFeature(feature) : isMovableFeature(feature))) {
      const anchor = featureDragAnchor(feature)
      const featureIds = (moveManyFeatures || rotateManyFeatures)
        ? cadStore.selectedFeatures.map((item) => item.feature.id)
        : [feature.id]
      dragState.value = {
        pointerId: event.pointerId,
        mode: event.altKey
          ? (rotateManyFeatures ? 'feature-rotate-many' : 'feature-rotate')
          : (moveManyFeatures ? 'feature-move-many' : 'feature-move'),
        startPoint: point ?? { x: 0, y: 0 },
        startPoint3: sceneManager?.screenToCameraPlanePoint(event.clientX, event.clientY, anchor) ?? anchor,
        screenStart: screenPoint,
        featureId: feature.id,
        originalFeature: cloneFeature(feature),
        originalFeatures: selectedForDrag,
        featureIds,
        featureDelta: { x: 0, y: 0, z: 0 }
      }
      if (!event.altKey) {
        sceneManager?.beginFeatureTransform(featureIds)
      }
      container.value.setPointerCapture(event.pointerId)
    }
    return
  }

  if (!point) {
    selectionBox.value = { start: screenPoint, current: screenPoint }
    dragState.value = {
      pointerId: event.pointerId,
      mode: 'box-select',
      startPoint: { x: 0, y: 0 },
      screenStart: screenPoint,
      screenCurrent: screenPoint,
      additive: event.shiftKey || event.ctrlKey || event.metaKey
    }
    container.value.setPointerCapture(event.pointerId)
    return
  }

  const hit = hitTestEntity(point)
  if (!hit) {
    selectionBox.value = { start: screenPoint, current: screenPoint }
    dragState.value = {
      pointerId: event.pointerId,
      mode: 'box-select',
      startPoint: point,
      screenStart: screenPoint,
      screenCurrent: screenPoint,
      additive: event.shiftKey || event.ctrlKey || event.metaKey
    }
    container.value.setPointerCapture(event.pointerId)
    return
  }

  if (event.shiftKey || event.ctrlKey || event.metaKey) {
    cadStore.toggleSketchEntitySelection(hit.sketchId, hit.entity.id)
    dragState.value = null
    return
  }

  const moveMany = cadStore.isSketchEntitySelected(hit.sketchId, hit.entity.id)
    && cadStore.selectedSketchEntities.length > 1
    && !hit.handle
  if (!moveMany) {
    cadStore.setSelection({ kind: 'sketch-entity', sketchId: hit.sketchId, entityId: hit.entity.id })
  }
  if (props.readonly || hit.entity.locked) return
  dragState.value = {
    pointerId: event.pointerId,
    mode: moveMany ? 'move-many' : hit.handle ? 'resize' : 'move',
    startPoint: point,
    sketchId: hit.sketchId,
    entityId: hit.entity.id,
    originalEntity: cloneEntity(hit.entity),
    originalEntities: moveMany
      ? cadStore.selectedSketchEntities.map((item) => ({
        sketchId: item.sketchId,
        entity: cloneEntity(item.entity)
      }))
      : undefined,
    handle: hit.handle
  }
  container.value.setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent) {
  if (!container.value) return
  const rect = container.value.getBoundingClientRect()
  collaborationStore.sendCursor(event.clientX - rect.left, event.clientY - rect.top)

  const drag = dragState.value

  if (drag?.mode === 'feature-move' && drag.featureId && drag.originalFeature && drag.startPoint3) {
    const point3 = sceneManager?.screenToCameraPlanePoint(event.clientX, event.clientY, drag.startPoint3)
    if (!point3) return
    const delta = subtractPoint3(point3, drag.startPoint3)
    drag.featureDelta = delta
    sceneManager?.previewFeatureTranslation(delta)
    return
  }

  if (drag?.mode === 'feature-move-many' && drag.originalFeatures && drag.startPoint3) {
    const point3 = sceneManager?.screenToCameraPlanePoint(event.clientX, event.clientY, drag.startPoint3)
    if (!point3) return
    const delta = subtractPoint3(point3, drag.startPoint3)
    drag.featureDelta = delta
    sceneManager?.previewFeatureTranslation(delta)
    return
  }

  if (drag?.mode === 'feature-rotate' && drag.featureId && drag.originalFeature && drag.screenStart) {
    cadStore.rotateFeatureTransient(drag.featureId, drag.originalFeature, rotationDeltaFromPointer(event, drag.screenStart))
    return
  }

  if (drag?.mode === 'feature-rotate-many' && drag.originalFeatures && drag.screenStart) {
    cadStore.rotateFeaturesTransient(drag.originalFeatures, rotationDeltaFromPointer(event, drag.screenStart))
    return
  }

  let point = toSketchPoint(event, pointOptionsForDrag(drag))
  if (!point) return
  if (drag) {
    point = applyAngleSnapForDrag(drag, point, event)
  }
  cursorPoint.value = point

  if (!drag) return

  if (drag.mode === 'box-select') {
    const screenPoint = toLocalScreenPoint(event)
    selectionBox.value = {
      start: drag.screenStart ?? screenPoint,
      current: screenPoint
    }
    drag.screenCurrent = screenPoint
    return
  }

  if (drag.mode === 'draw' && drag.tool) {
    draftEntity.value = buildDraftEntity(drag.tool, drag.startPoint, point, drag.arcCenter)
    refreshScene()
    return
  }

  if (!drag.sketchId || !drag.originalEntity) return
  if (drag.mode === 'move-many' && drag.originalEntities) {
    const delta = {
      x: point.x - drag.startPoint.x,
      y: point.y - drag.startPoint.y
    }
    cadStore.updateSketchEntitiesTransient(
      drag.originalEntities.map((item) => ({
        sketchId: item.sketchId,
        entity: translateEntity(item.entity, delta)
      }))
    )
    return
  }

  const nextEntity =
    drag.mode === 'move'
      ? translateEntity(drag.originalEntity, {
        x: point.x - drag.startPoint.x,
        y: point.y - drag.startPoint.y
      })
      : resizeEntity(drag.originalEntity, drag.handle, point)

  cadStore.updateSketchEntityTransient(drag.sketchId, nextEntity)
}

function handlePointerUp(event: PointerEvent) {
  if (!container.value) return
  const drag = dragState.value
  if (!drag || drag.pointerId !== event.pointerId) return

  if (drag.mode === 'draw' && drag.tool && draftStart.value) {
    const rawPoint = toSketchPoint(event, pointOptionsForDrag(drag)) ?? draftStart.value
    const point = applyAngleSnapForDrag(drag, rawPoint, event)
    finishDrawing(drag.tool, draftStart.value, point, drag.arcCenter)
    if (drag.tool === 'arc') {
      arcCenter.value = null
    }
  }

  if (drag.mode === 'box-select') {
    const point = toSketchPoint(event, pointOptionsForDrag(drag)) ?? drag.startPoint
    finishBoxSelect(drag.startPoint, point, drag.screenStart, drag.screenCurrent, drag.additive ?? false)
  }

  if (drag.mode === 'move-many' && drag.originalEntities) {
    const updates = drag.originalEntities.flatMap((item) => {
      const afterEntity = findEntity(item.sketchId, item.entity.id)
      return afterEntity
        ? [{ sketchId: item.sketchId, before: item.entity, after: cloneEntity(afterEntity) }]
        : []
    })
    cadStore.commitSketchEntitiesUpdate(updates)
  }

  if ((drag.mode === 'move' || drag.mode === 'resize') && drag.sketchId && drag.entityId && drag.originalEntity) {
    const afterEntity = findEntity(drag.sketchId, drag.entityId)
    if (afterEntity) {
      cadStore.commitSketchEntityUpdate(drag.sketchId, drag.originalEntity, cloneEntity(afterEntity))
    }
  }

  if (drag.mode === 'feature-move' && drag.featureId && drag.originalFeature) {
    cadStore.commitFeatureUpdate(
      drag.originalFeature,
      translateFeatureForDrag(drag.originalFeature, drag.featureDelta ?? { x: 0, y: 0, z: 0 })
    )
  }

  if (drag.mode === 'feature-move-many' && drag.originalFeatures) {
    const delta = drag.featureDelta ?? { x: 0, y: 0, z: 0 }
    cadStore.commitFeaturesUpdate(
      drag.originalFeatures.map((beforeFeature) => ({
        before: beforeFeature,
        after: translateFeatureForDrag(beforeFeature, delta)
      }))
    )
  }

  if (drag.mode === 'feature-rotate' && drag.featureId && drag.originalFeature) {
    const afterFeature = findFeature(drag.featureId)
    if (afterFeature) {
      cadStore.commitFeatureUpdate(drag.originalFeature, cloneFeature(afterFeature))
    }
  }

  if (drag.mode === 'feature-rotate-many' && drag.originalFeatures) {
    const updates = drag.originalFeatures.flatMap((beforeFeature) => {
      const afterFeature = findFeature(beforeFeature.id)
      return afterFeature
        ? [{ before: beforeFeature, after: cloneFeature(afterFeature) }]
        : []
    })
    cadStore.commitFeaturesUpdate(updates)
  }

  const preserveFeaturePreview = drag.mode === 'feature-move' || drag.mode === 'feature-move-many'
  clearDrag(event.pointerId, !preserveFeaturePreview)
  if (preserveFeaturePreview) refreshScene()
}

function handlePointerCancel(event: PointerEvent) {
  const drag = dragState.value
  if (drag?.mode !== 'draw' && drag?.sketchId && drag.originalEntity) {
    cadStore.updateSketchEntityTransient(drag.sketchId, drag.originalEntity)
  }
  if (drag?.mode === 'move-many' && drag.originalEntities) {
    cadStore.updateSketchEntitiesTransient(drag.originalEntities)
  }
  if (drag?.mode === 'feature-move' || drag?.mode === 'feature-move-many') {
    sceneManager?.endFeatureTransform(true)
  }
  if (drag?.mode === 'feature-rotate' && drag.originalFeature) {
    cadStore.updateFeatureTransient(drag.originalFeature)
  }
  if (drag?.mode === 'feature-rotate-many' && drag.originalFeatures) {
    cadStore.updateFeaturesTransient(drag.originalFeatures.map((feature) => ({ feature })))
  }
  if (drag?.tool === 'arc') {
    arcCenter.value = null
  }
  clearDrag(event.pointerId)
}

function clearDrag(pointerId: number, resetFeaturePreview = true) {
  if (container.value?.hasPointerCapture(pointerId)) {
    container.value.releasePointerCapture(pointerId)
  }
  if (isFeatureTranslationDrag(dragState.value)) {
    sceneManager?.endFeatureTransform(resetFeaturePreview)
  }
  dragState.value = null
  draftStart.value = null
  draftEntity.value = null
  activeSnap.value = null
  selectionBox.value = null
  refreshScene()
}

function finishDrawing(
  tool: Extract<CadToolType, 'line' | 'rectangle' | 'circle' | 'arc'>,
  start: Point2,
  end: Point2,
  center?: Point2
) {
  if (distance(start, end) < 1) return
  if (tool === 'line') {
    cadStore.addLine(start, end)
  }
  if (tool === 'rectangle') {
    cadStore.addRectangle(start, end)
  }
  if (tool === 'circle') {
    cadStore.addCircle(start, end)
  }
  if (tool === 'arc' && center && distance(center, start) >= 1) {
    cadStore.addArc(center, start, end)
  }
}

function applyAngleSnapForDrag(drag: DragState, point: Point2, event: PointerEvent): Point2 {
  const settings = cadStore.sketchSnapSettings
  if (!settings.angleSnap || event.altKey) return point
  const origin = angleSnapOriginForDrag(drag)
  return origin ? snapPointToSketchAngle(origin, point, settings.angleStep) : point
}

function angleSnapOriginForDrag(drag: DragState): Point2 | null {
  if (drag.mode === 'draw' && drag.tool === 'line') {
    return drag.startPoint
  }
  if (drag.mode === 'resize' && drag.originalEntity?.type === 'line') {
    if (drag.handle === 'line-start') return drag.originalEntity.end
    if (drag.handle === 'line-end') return drag.originalEntity.start
  }
  return null
}

function handleKeyDown(event: KeyboardEvent) {
  if (isTypingTarget(event.target)) return
  const action = resolveCadKeyboardAction(event)
  if (!action) return
  applyKeyboardAction(action, event)
}

function applyKeyboardAction(action: CadKeyboardAction, event: KeyboardEvent) {
  if (action.type === 'undo') {
    if (!props.readonly) {
      event.preventDefault()
      cadStore.undo()
    }
    return
  }

  if (action.type === 'redo') {
    if (!props.readonly) {
      event.preventDefault()
      cadStore.redo()
    }
    return
  }

  if (action.type === 'duplicate') {
    if (!props.readonly) {
      event.preventDefault()
      cadStore.duplicateSelection()
    }
    return
  }

  if (action.type === 'delete') {
    if (cadStore.selection && !props.readonly) {
      event.preventDefault()
      cadStore.deleteSelection()
    }
    return
  }

  if (action.type === 'cancel') {
    event.preventDefault()
    cancelCurrentInteraction(true)
    return
  }

  if (action.type === 'deselect') {
    event.preventDefault()
    cancelCurrentInteraction(true)
    return
  }

  if (action.type === 'toggle-construction') {
    if (!props.readonly) {
      event.preventDefault()
      if (cadStore.hasSketchEntitySelection) {
        cadStore.toggleSelectionConstruction()
      } else {
        cadStore.setConstructionMode(!cadStore.constructionMode)
      }
    }
    return
  }

  if (action.type === 'set-tool') {
    if (!props.readonly) {
      event.preventDefault()
      cancelCurrentInteraction(false)
      cadStore.setActiveTool(action.tool)
    }
    return
  }

  if (action.type === 'view') {
    event.preventDefault()
    applyViewCommand(action.command)
  }
}

function cancelCurrentInteraction(clearSelection: boolean) {
  if (clearSelection) {
    cadStore.setSelection(null)
  }
  draftStart.value = null
  arcCenter.value = null
  draftEntity.value = null
  dragState.value = null
  selectionBox.value = null
  activeSnap.value = null
  refreshScene()
}
function syncQuickDimensionValues(entity: SketchEntity | null) {
  if (!entity) return
  if (entity.type === 'line') {
    quickValues.lineStartX = roundNumber(entity.start.x)
    quickValues.lineStartY = roundNumber(entity.start.y)
    quickValues.lineEndX = roundNumber(entity.end.x)
    quickValues.lineEndY = roundNumber(entity.end.y)
    quickValues.lineLength = roundNumber(distance(entity.start, entity.end))
  }
  if (entity.type === 'rectangle') {
    quickValues.rectX = roundNumber(entity.origin.x)
    quickValues.rectY = roundNumber(entity.origin.y)
    quickValues.rectWidth = roundNumber(entity.width)
    quickValues.rectHeight = roundNumber(entity.height)
  }
  if (entity.type === 'circle') {
    quickValues.circleX = roundNumber(entity.center.x)
    quickValues.circleY = roundNumber(entity.center.y)
    quickValues.circleRadius = roundNumber(entity.radius)
  }
  if (entity.type === 'arc') {
    quickValues.arcX = roundNumber(entity.center.x)
    quickValues.arcY = roundNumber(entity.center.y)
    quickValues.arcRadius = roundNumber(entity.radius)
    quickValues.arcStartAngle = roundNumber(entity.startAngle)
    quickValues.arcEndAngle = roundNumber(entity.endAngle)
  }
}

function applyQuickLinePoints() {
  const entity = cadStore.selectedSketchEntity
  if (!entity || entity.type !== 'line') return
  const start = {
    x: toFiniteNumber(quickValues.lineStartX, entity.start.x),
    y: toFiniteNumber(quickValues.lineStartY, entity.start.y)
  }
  const end = {
    x: toFiniteNumber(quickValues.lineEndX, entity.end.x),
    y: toFiniteNumber(quickValues.lineEndY, entity.end.y)
  }
  if (distance(start, end) < 1) return
  cadStore.updateSelectedEntity({ ...cloneEntity(entity), start, end })
}

function applyQuickLineLength() {
  const entity = cadStore.selectedSketchEntity
  if (!entity || entity.type !== 'line') return
  const length = Math.max(1, toFiniteNumber(quickValues.lineLength, distance(entity.start, entity.end)))
  const currentLength = distance(entity.start, entity.end)
  const direction = currentLength < 0.001
    ? { x: 1, y: 0 }
    : {
        x: (entity.end.x - entity.start.x) / currentLength,
        y: (entity.end.y - entity.start.y) / currentLength
      }
  cadStore.updateSelectedEntity({
    ...cloneEntity(entity),
    end: {
      x: roundNumber(entity.start.x + direction.x * length),
      y: roundNumber(entity.start.y + direction.y * length)
    }
  })
}

function applyQuickRectangle() {
  const entity = cadStore.selectedSketchEntity
  if (!entity || entity.type !== 'rectangle') return
  cadStore.updateSelectedEntity({
    ...cloneEntity(entity),
    origin: {
      x: toFiniteNumber(quickValues.rectX, entity.origin.x),
      y: toFiniteNumber(quickValues.rectY, entity.origin.y)
    },
    width: Math.max(1, toFiniteNumber(quickValues.rectWidth, entity.width)),
    height: Math.max(1, toFiniteNumber(quickValues.rectHeight, entity.height))
  })
}

function applyQuickCircle() {
  const entity = cadStore.selectedSketchEntity
  if (!entity || entity.type !== 'circle') return
  cadStore.updateSelectedEntity({
    ...cloneEntity(entity),
    center: {
      x: toFiniteNumber(quickValues.circleX, entity.center.x),
      y: toFiniteNumber(quickValues.circleY, entity.center.y)
    },
    radius: Math.max(1, toFiniteNumber(quickValues.circleRadius, entity.radius))
  })
}

function applyQuickArc() {
  const entity = cadStore.selectedSketchEntity
  if (!entity || entity.type !== 'arc') return
  cadStore.updateSelectedEntity({
    ...cloneEntity(entity),
    center: {
      x: toFiniteNumber(quickValues.arcX, entity.center.x),
      y: toFiniteNumber(quickValues.arcY, entity.center.y)
    },
    radius: Math.max(1, toFiniteNumber(quickValues.arcRadius, entity.radius)),
    startAngle: normalizeAngle(toFiniteNumber(quickValues.arcStartAngle, entity.startAngle)),
    endAngle: normalizeAngle(toFiniteNumber(quickValues.arcEndAngle, entity.endAngle))
  })
}

function finishBoxSelect(start: Point2, end: Point2, screenStart: Point2 | undefined, screenEnd: Point2 | undefined, additive: boolean) {
  const screenDistance = screenStart && screenEnd ? distance(screenStart, screenEnd) : 0
  if (!cadStore.document || (distance(start, end) < 1 && screenDistance < 2)) {
    if (!additive) cadStore.setSelection(null)
    return
  }

  const selectedFeatureIds = screenStart && screenEnd ? sceneManager?.getFeaturesInScreenBox(screenStart, screenEnd) ?? [] : []
  if (selectedFeatureIds.length > 0) {
    const existing = additive ? cadStore.selectedFeatures.map((item) => item.feature.id) : []
    cadStore.setFeatureSelection([...existing, ...selectedFeatureIds])
    return
  }

  const selected = getEntitiesInBox(start, end)
  const existing = additive
    ? cadStore.selectedSketchEntities.map((item) => ({ sketchId: item.sketchId, entityId: item.entity.id }))
    : []
  cadStore.setSketchEntitySelection([
    ...existing,
    ...selected.map((item) => ({ sketchId: item.sketchId, entityId: item.entity.id }))
  ])
}

function toSketchPoint(event: PointerEvent, options: SketchPointOptions = { snapToGrid: true }): Point2 | null {
  const point = sceneManager?.screenToSketchPoint(event.clientX, event.clientY, cadStore.activeSketchPlane)
  if (!point) return null
  const snapSettings = cadStore.sketchSnapSettings
  if (options.allowEntitySnap && snapSettings.objectSnap && !event.altKey && cadStore.document) {
    const snap = findNearestSketchSnap(
      cadStore.document,
      point,
      event.shiftKey ? Math.max(2, snapSettings.snapTolerance * 0.4) : snapSettings.snapTolerance,
      { excludeEntityKeys: options.excludeEntityKeys, plane: cadStore.activeSketchPlane }
    )
    if (snap) {
      activeSnap.value = snap
      return snap.point
    }
  }

  activeSnap.value = null
  if (options.snapToGrid !== false && snapSettings.gridSnap && !event.altKey) {
    return roundPointToSketchGrid(point, resolveSketchGridStep(snapSettings, event.shiftKey))
  }
  return point
}

function pointOptionsForDrag(drag: DragState | null): SketchPointOptions {
  if (!drag) {
    const drawingTool = isDrawingTool(cadStore.activeTool)
    return {
      allowEntitySnap: drawingTool,
      snapToGrid: drawingTool
    }
  }

  if (drag.mode === 'box-select') {
    return { snapToGrid: false }
  }

  if (drag.mode === 'draw') {
    return { allowEntitySnap: true, snapToGrid: true }
  }

  if (drag.mode === 'move-many' && drag.originalEntities) {
    return {
      allowEntitySnap: true,
      snapToGrid: true,
      excludeEntityKeys: new Set(drag.originalEntities.map((item) => sketchEntityKey(item.sketchId, item.entity.id)))
    }
  }

  if (drag.sketchId && drag.entityId) {
    return {
      allowEntitySnap: true,
      snapToGrid: true,
      excludeEntityKeys: new Set([sketchEntityKey(drag.sketchId, drag.entityId)])
    }
  }

  return { snapToGrid: true }
}

function isDrawingTool(tool: CadToolType): tool is Extract<CadToolType, 'line' | 'rectangle' | 'circle' | 'arc'> {
  return tool === 'line' || tool === 'rectangle' || tool === 'circle' || tool === 'arc'
}

function buildDraftEntity(
  tool: Extract<CadToolType, 'line' | 'rectangle' | 'circle' | 'arc'>,
  start: Point2,
  end: Point2,
  center?: Point2
): SketchEntity {
  if (tool === 'line') {
    return {
      id: 'draft-line',
      type: 'line',
      name: 'Draft Line',
      visible: true,
      start,
      end
    }
  }
  if (tool === 'rectangle') {
    return {
      id: 'draft-rectangle',
      type: 'rectangle',
      name: 'Draft Rectangle',
      visible: true,
      origin: { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) },
      width: Math.max(5, Math.abs(end.x - start.x)),
      height: Math.max(5, Math.abs(end.y - start.y))
    }
  }
  if (tool === 'arc' && center) {
    return makeArcFromCenterPoints('draft-arc', 'Draft Arc', center, start, end)
  }
  return {
    id: 'draft-circle',
    type: 'circle',
    name: 'Draft Circle',
    visible: true,
    center: start,
    radius: Math.max(5, distance(start, end))
  }
}

function describeEntitySize(entity: SketchEntity): string {
  if (entity.type === 'line') {
    return `长度：${formatNumber(distance(entity.start, entity.end))} mm`
  }
  if (entity.type === 'rectangle') {
    return `宽×高：${formatNumber(entity.width)} × ${formatNumber(entity.height)} mm`
  }
  if (entity.type === 'arc') {
    return `圆弧半径：${formatNumber(entity.radius)} mm`
  }
  return `半径：${formatNumber(entity.radius)} mm`
}

function hitTestEntity(point: Point2): EntityHit | null {
  if (!cadStore.document) return null
  const selected = cadStore.selection
  if (selected?.kind === 'sketch-entity') {
    const entity = findEntity(selected.sketchId, selected.entityId)
    if (entity) {
      const handle = hitTestHandle(entity, point)
      if (handle) return { sketchId: selected.sketchId, entity, handle }
    }
  }

  for (const sketch of [...cadStore.document.sketches].filter((item) => item.plane === cadStore.activeSketchPlane).reverse()) {
    for (const entity of [...sketch.entities].reverse()) {
      if (!entity.visible) continue
      if (isEntityHit(entity, point)) {
        return { sketchId: sketch.id, entity, handle: hitTestHandle(entity, point) }
      }
    }
  }
  return null
}

function getEntitiesInBox(start: Point2, end: Point2): SelectedEntitySnapshot[] {
  if (!cadStore.document) return []
  const selectionBounds = normalizeBounds({
    minX: Math.min(start.x, end.x),
    maxX: Math.max(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxY: Math.max(start.y, end.y)
  })
  const selected: SelectedEntitySnapshot[] = []
  for (const sketch of cadStore.document.sketches.filter((item) => item.plane === cadStore.activeSketchPlane)) {
    for (const entity of sketch.entities) {
      if (entity.visible && boundsIntersect(selectionBounds, entityBounds(entity))) {
        selected.push({ sketchId: sketch.id, entity })
      }
    }
  }
  return selected
}

function hitTestHandle(entity: SketchEntity, point: Point2): ResizeHandle | undefined {
  if (entity.type === 'line') {
    if (distance(point, entity.start) <= hitTolerance) return 'line-start'
    if (distance(point, entity.end) <= hitTolerance) return 'line-end'
  }
  if (entity.type === 'rectangle') {
    const corners = rectangleCorners(entity)
    if (distance(point, corners.sw) <= hitTolerance) return 'rect-sw'
    if (distance(point, corners.se) <= hitTolerance) return 'rect-se'
    if (distance(point, corners.ne) <= hitTolerance) return 'rect-ne'
    if (distance(point, corners.nw) <= hitTolerance) return 'rect-nw'
  }
  if (entity.type === 'circle') {
    const edge = { x: entity.center.x + entity.radius, y: entity.center.y }
    if (distance(point, edge) <= hitTolerance || Math.abs(distance(point, entity.center) - entity.radius) <= hitTolerance) {
      return 'circle-radius'
    }
  }
  if (entity.type === 'arc') {
    if (distance(point, arcStartPoint(entity)) <= hitTolerance) return 'arc-start'
    if (distance(point, arcEndPoint(entity)) <= hitTolerance) return 'arc-end'
    if (distance(point, arcMidPoint(entity)) <= hitTolerance) return 'arc-radius'
  }
  return undefined
}

function isEntityHit(entity: SketchEntity, point: Point2): boolean {
  if (entity.type === 'line') {
    return distancePointToSegment(point, entity.start, entity.end) <= hitTolerance
  }
  if (entity.type === 'rectangle') {
    const left = entity.origin.x
    const right = entity.origin.x + entity.width
    const bottom = entity.origin.y
    const top = entity.origin.y + entity.height
    const inside = point.x >= left - hitTolerance && point.x <= right + hitTolerance
      && point.y >= bottom - hitTolerance && point.y <= top + hitTolerance
    if (!inside) return false
    const edgeDistance = Math.min(
      Math.abs(point.x - left),
      Math.abs(point.x - right),
      Math.abs(point.y - bottom),
      Math.abs(point.y - top)
    )
    return edgeDistance <= hitTolerance || (point.x >= left && point.x <= right && point.y >= bottom && point.y <= top)
  }
  if (entity.type === 'arc') {
    return sampleArcPoints(entity, 72).some((arcPoint) => distance(point, arcPoint) <= hitTolerance)
  }
  const radiusDistance = distance(point, entity.center)
  return radiusDistance <= entity.radius + hitTolerance
}

interface Bounds2 {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

function normalizeBounds(bounds: Bounds2): Bounds2 {
  return {
    minX: Math.min(bounds.minX, bounds.maxX),
    maxX: Math.max(bounds.minX, bounds.maxX),
    minY: Math.min(bounds.minY, bounds.maxY),
    maxY: Math.max(bounds.minY, bounds.maxY)
  }
}

function boundsIntersect(a: Bounds2, b: Bounds2): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

function entityBounds(entity: SketchEntity): Bounds2 {
  if (entity.type === 'line') {
    return normalizeBounds({
      minX: entity.start.x,
      maxX: entity.end.x,
      minY: entity.start.y,
      maxY: entity.end.y
    })
  }
  if (entity.type === 'rectangle') {
    return normalizeBounds({
      minX: entity.origin.x,
      maxX: entity.origin.x + entity.width,
      minY: entity.origin.y,
      maxY: entity.origin.y + entity.height
    })
  }
  if (entity.type === 'arc') {
    return boundsFromPoints(sampleArcPoints(entity))
  }
  return normalizeBounds({
    minX: entity.center.x - entity.radius,
    maxX: entity.center.x + entity.radius,
    minY: entity.center.y - entity.radius,
    maxY: entity.center.y + entity.radius
  })
}

function translateEntity(entity: SketchEntity, delta: Point2): SketchEntity {
  if (entity.type === 'line') {
    return {
      ...cloneEntity(entity),
      start: addPoint(entity.start, delta),
      end: addPoint(entity.end, delta)
    }
  }
  if (entity.type === 'rectangle') {
    return {
      ...cloneEntity(entity),
      origin: addPoint(entity.origin, delta)
    }
  }
  if (entity.type === 'arc') {
    return {
      ...cloneEntity(entity),
      center: addPoint(entity.center, delta)
    }
  }
  return {
    ...cloneEntity(entity),
    center: addPoint(entity.center, delta)
  }
}

function resizeEntity(entity: SketchEntity, handle: ResizeHandle | undefined, point: Point2): SketchEntity {
  if (!handle) return cloneEntity(entity)
  if (entity.type === 'line') {
    return resizeLine(entity, handle, point)
  }
  if (entity.type === 'rectangle') {
    return resizeRectangle(entity, handle, point)
  }
  if (entity.type === 'circle') {
    return {
      ...cloneEntity(entity),
      radius: Math.max(5, distance(entity.center, point))
    }
  }
  if (entity.type === 'arc') {
    return resizeArc(entity, handle, point)
  }
  return cloneEntity(entity)
}

function resizeLine(entity: LineEntity, handle: ResizeHandle, point: Point2): LineEntity {
  if (handle === 'line-start') {
    return { ...cloneEntity(entity), start: point }
  }
  if (handle === 'line-end') {
    return { ...cloneEntity(entity), end: point }
  }
  return cloneEntity(entity)
}

function resizeRectangle(entity: RectangleEntity, handle: ResizeHandle, point: Point2): RectangleEntity {
  let left = entity.origin.x
  let right = entity.origin.x + entity.width
  let bottom = entity.origin.y
  let top = entity.origin.y + entity.height

  if (handle === 'rect-sw' || handle === 'rect-nw') left = point.x
  if (handle === 'rect-se' || handle === 'rect-ne') right = point.x
  if (handle === 'rect-sw' || handle === 'rect-se') bottom = point.y
  if (handle === 'rect-nw' || handle === 'rect-ne') top = point.y

  const origin = { x: Math.min(left, right), y: Math.min(bottom, top) }
  return {
    ...cloneEntity(entity),
    origin,
    width: Math.max(5, Math.abs(right - left)),
    height: Math.max(5, Math.abs(top - bottom))
  }
}

function resizeArc(entity: ArcEntity, handle: ResizeHandle | undefined, point: Point2): ArcEntity {
  if (handle === 'arc-start') {
    return {
      ...cloneEntity(entity),
      radius: Math.max(5, distance(entity.center, point)),
      startAngle: angleFromPoint(entity.center, point)
    }
  }
  if (handle === 'arc-end') {
    return {
      ...cloneEntity(entity),
      radius: Math.max(5, distance(entity.center, point)),
      endAngle: angleFromPoint(entity.center, point)
    }
  }
  if (handle === 'arc-radius') {
    return {
      ...cloneEntity(entity),
      radius: Math.max(5, distance(entity.center, point))
    }
  }
  return cloneEntity(entity)
}

function boundsFromPoints(points: Point2[]): Bounds2 {
  return normalizeBounds({
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y))
  })
}

function rectangleCorners(entity: RectangleEntity) {
  return {
    sw: entity.origin,
    se: { x: entity.origin.x + entity.width, y: entity.origin.y },
    ne: { x: entity.origin.x + entity.width, y: entity.origin.y + entity.height },
    nw: { x: entity.origin.x, y: entity.origin.y + entity.height }
  }
}

function findEntity(sketchId: string, entityId: string): SketchEntity | null {
  return cadStore.document?.sketches
    .find((sketch) => sketch.id === sketchId)
    ?.entities.find((entity) => entity.id === entityId) ?? null
}

function findFeature(featureId: string): Feature | null {
  return cadStore.document?.features.find((feature) => feature.id === featureId) ?? null
}

function isMovableFeature(feature: Feature): boolean {
  return !feature.locked && !feature.suppressed
}

function isRotatableFeature(feature: Feature): boolean {
  return isMovableFeature(feature)
}

function isFeatureTranslationDrag(drag: DragState | null): boolean {
  return drag?.mode === 'feature-move' || drag?.mode === 'feature-move-many'
}

function translateFeatureForDrag<T extends Feature>(feature: T, delta: Point3): T {
  const current = feature.position ?? { x: 0, y: 0, z: 0 }
  return {
    ...cloneFeature(feature),
    position: {
      x: roundDragValue(current.x + delta.x),
      y: roundDragValue(current.y + delta.y),
      z: roundDragValue(current.z + delta.z)
    }
  } as T
}

function roundDragValue(value: number): number {
  return Math.round(value * 1000) / 1000
}

function featureDragAnchor(feature: Feature): Point3 {
  const sceneCenter = sceneManager?.getFeatureWorldCenter(feature.id)
  if (sceneCenter) return sceneCenter
  if (feature.type === 'box') {
    return { x: feature.position.x, y: feature.position.y, z: feature.position.z + feature.height / 2 }
  }
  if (feature.type === 'sphere') {
    return { x: feature.position.x, y: feature.position.y, z: feature.position.z + feature.radius }
  }
  if (feature.type === 'cone') {
    return { x: feature.position.x, y: feature.position.y, z: feature.position.z + feature.height / 2 }
  }
  return { x: 0, y: 0, z: 0 }
}

function subtractPoint3(point: Point3, origin: Point3): Point3 {
  return {
    x: point.x - origin.x,
    y: point.y - origin.y,
    z: point.z - origin.z
  }
}

function rotationDeltaFromPointer(event: PointerEvent, screenStart: Point2): Point3 {
  const screen = toLocalScreenPoint(event)
  return {
    x: event.shiftKey ? roundNumber((screen.y - screenStart.y) * 0.5) : 0,
    y: event.shiftKey ? 0 : roundNumber((screen.y - screenStart.y) * 0.5),
    z: roundNumber((screen.x - screenStart.x) * 0.5)
  }
}

function cloneEntity<T extends SketchEntity>(entity: T): T {
  return JSON.parse(JSON.stringify(entity)) as T
}

function cloneFeature<T extends Feature>(feature: T): T {
  return {
    ...feature,
    position: feature.position ? { ...feature.position } : undefined,
    rotation: feature.rotation ? { ...feature.rotation } : undefined
  } as T
}

function toLocalScreenPoint(event: PointerEvent): Point2 {
  const rect = container.value!.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}

function addPoint(point: Point2, delta: Point2): Point2 {
  return { x: point.x + delta.x, y: point.y + delta.y }
}

function distance(a: Point2, b: Point2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000
}

function toFiniteNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? roundNumber(value) : fallback
}

function extractDimensionValue(label: string): string {
  return label.match(/\d+(\.\d+)?/)?.[0] ?? ''
}

function distancePointToSegment(point: Point2, start: Point2, end: Point2): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return distance(point, start)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)))
  return distance(point, { x: start.x + t * dx, y: start.y + t * dy })
}

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable
}
</script>

<style scoped>
.viewport-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: min(280px, calc(100% - 20px));
  padding: 6px 8px;
  border: 1px solid #d8dee9;
  border-radius: 4px;
  background: rgb(255 255 255 / 90%);
  color: #1f2937;
  font-size: 12px;
  line-height: 1.35;
  pointer-events: none;
}

.viewport-shell {
  touch-action: none;
  cursor: crosshair;
}

.viewport-shell.is-readonly {
  cursor: default;
}

.quick-dimension-panel {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 5;
  width: min(340px, calc(100% - 24px));
  padding: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: rgb(255 255 255 / 94%);
  box-shadow: 0 10px 24px rgb(15 23 42 / 14%);
  color: #1f2937;
}

.quick-dimension-title {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
}

.quick-dimension-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.quick-dimension-grid.is-line {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.quick-dimension-grid label {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  color: #475569;
  font-size: 11px;
  font-weight: 600;
}

.quick-dimension-grid .is-wide {
  grid-column: 1 / -1;
}

.quick-dimension-grid :deep(.el-input-number) {
  width: 100%;
}

.quick-dimension-grid :deep(.el-input__wrapper) {
  padding-inline: 8px;
}

.quick-dimension-grid :deep(.el-input__inner) {
  text-align: left;
}

.selection-box {
  position: absolute;
  z-index: 3;
  border: 1px solid #2563eb;
  background: rgb(37 99 235 / 12%);
  pointer-events: none;
}

.dimension-hotspot {
  position: absolute;
  z-index: 4;
  width: 86px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  cursor: text;
  transform: translate(-50%, -50%);
}

.dimension-hotspot:hover,
.dimension-hotspot:focus-visible {
  border-color: #2563eb;
  background: rgb(37 99 235 / 10%);
  outline: none;
}

.dimension-hotspot:disabled {
  cursor: default;
  pointer-events: none;
}
</style>

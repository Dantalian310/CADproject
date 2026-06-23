<template>
  <header class="toolbar-shell">
    <div class="toolbar-group">
      <el-button size="small" :type="active('select')" @click="setTool('select')">选择</el-button>
    </div>
    <div class="toolbar-group">
      <el-select v-model="activeSketchPlaneModel" size="small" class="plane-select">
        <el-option label="XY 平面" value="XY" />
        <el-option label="XZ 平面" value="XZ" />
        <el-option label="YZ 平面" value="YZ" />
      </el-select>
    </div>
    <div class="toolbar-group">
      <el-dropdown trigger="click">
        <el-button size="small">视图</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="$emit('view', 'top')">俯视</el-dropdown-item>
            <el-dropdown-item @click="$emit('view', 'front')">正视</el-dropdown-item>
            <el-dropdown-item @click="$emit('view', 'right')">右视</el-dropdown-item>
            <el-dropdown-item @click="$emit('view', 'isometric')">等轴</el-dropdown-item>
            <el-dropdown-item @click="$emit('view', 'fit')">全图</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <div class="toolbar-group snap-toolbar-control">
      <el-checkbox v-model="gridSnapModel" size="small">网格</el-checkbox>
      <el-checkbox v-model="objectSnapModel" size="small">对象</el-checkbox>
      <el-checkbox v-model="angleSnapModel" size="small">角度</el-checkbox>
      <el-select v-model="gridSizeModel" size="small" class="snap-grid-select" :disabled="!gridSnapModel">
        <el-option
          v-for="size in sketchGridSizeOptions"
          :key="size"
          :label="`${size} mm`"
          :value="size"
        />
      </el-select>
      <el-select v-model="angleStepModel" size="small" class="snap-angle-select" :disabled="!angleSnapModel">
        <el-option
          v-for="angle in sketchAngleStepOptions"
          :key="angle"
          :label="`${angle}°`"
          :value="angle"
        />
      </el-select>
    </div>
    <div class="toolbar-group">
      <el-checkbox v-model="constructionModeModel" size="small" :disabled="readonly">构造</el-checkbox>
      <el-dropdown trigger="click" :disabled="readonly">
        <el-button size="small" :disabled="readonly">草图</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="setTool('line')">线段</el-dropdown-item>
            <el-dropdown-item @click="setTool('rectangle')">矩形</el-dropdown-item>
            <el-dropdown-item @click="setTool('circle')">圆</el-dropdown-item>
            <el-dropdown-item @click="setTool('arc')">圆弧</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-dropdown trigger="click" :disabled="readonly">
        <el-button size="small" :disabled="readonly">约束</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="setTool('fixed')">固定</el-dropdown-item>
            <el-dropdown-item @click="setTool('horizontal')">水平</el-dropdown-item>
            <el-dropdown-item @click="setTool('vertical')">垂直</el-dropdown-item>
            <el-dropdown-item @click="setTool('dimension')">尺寸</el-dropdown-item>
            <el-dropdown-item divided @click="setTool('concentric')">同心</el-dropdown-item>
            <el-dropdown-item @click="setTool('equalRadius')">等半径</el-dropdown-item>
            <el-dropdown-item @click="setTool('parallel')">平行</el-dropdown-item>
            <el-dropdown-item @click="setTool('perpendicular')">垂直关系</el-dropdown-item>
            <el-dropdown-item @click="setTool('tangent')">相切</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-dropdown trigger="click" :disabled="readonly">
        <el-button size="small" :disabled="readonly">实体</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="openBoxDialog">立方体</el-dropdown-item>
            <el-dropdown-item @click="openSphereDialog">球体</el-dropdown-item>
            <el-dropdown-item @click="openConeDialog">锥体</el-dropdown-item>
            <el-dropdown-item divided @click="setTool('extrude')">拉伸</el-dropdown-item>
            <el-dropdown-item :disabled="!canRunCut" @click="setTool('cut')">Cut</el-dropdown-item>
            <el-dropdown-item :disabled="!canRunBoolean" @click="setTool('union')">Union</el-dropdown-item>
            <el-dropdown-item :disabled="!canRunBoolean" @click="setTool('difference')">Difference</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-dropdown trigger="click" :disabled="readonly">
        <el-button size="small" :disabled="readonly">编辑</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item :disabled="!cadStore.hasSketchEntitySelection" @click="cadStore.duplicateSelection()">复制</el-dropdown-item>
            <el-dropdown-item :disabled="!cadStore.hasSketchEntitySelection" @click="cadStore.toggleSelectionConstruction()">构造切换</el-dropdown-item>
            <el-dropdown-item :disabled="!cadStore.hasSketchEntitySelection" @click="openRotateDialog">旋转</el-dropdown-item>
            <el-dropdown-item :disabled="!cadStore.hasSketchEntitySelection" @click="cadStore.mirrorSelection('horizontal')">水平镜像</el-dropdown-item>
            <el-dropdown-item :disabled="!cadStore.hasSketchEntitySelection" @click="cadStore.mirrorSelection('vertical')">垂直镜像</el-dropdown-item>
            <el-dropdown-item :disabled="cadStore.selectedSketchEntities.length < 2" @click="cadStore.mirrorSelectionByLine()">按线镜像</el-dropdown-item>
            <el-dropdown-item :disabled="!cadStore.hasSketchEntitySelection" @click="openArrayDialog">阵列</el-dropdown-item>
            <el-dropdown-item :disabled="!cadStore.hasSketchEntitySelection" @click="openOffsetDialog">偏移</el-dropdown-item>
            <el-dropdown-item :disabled="!canModifyLineCorner" @click="openFilletDialog">圆角</el-dropdown-item>
            <el-dropdown-item :disabled="!canModifyLineCorner" @click="openChamferDialog">倒角</el-dropdown-item>
            <el-dropdown-item divided :disabled="!cadStore.selection" @click="cadStore.deleteSelection()">删除</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button size="small" :disabled="readonly || !cadStore.canUndo" @click="cadStore.undo()">撤销</el-button>
      <el-button size="small" :disabled="readonly || !cadStore.canRedo" @click="cadStore.redo()">重做</el-button>
    </div>
    <div class="toolbar-group">
      <el-button size="small" type="primary" :disabled="readonly" @click="$emit('save')">保存</el-button>
      <el-button size="small" @click="$emit('versions')">版本</el-button>
      <el-button size="small" @click="$emit('export-svg')">SVG</el-button>
      <el-button size="small" @click="$emit('export-dxf')">DXF</el-button>
      <el-button size="small" @click="helpDialogVisible = true">帮助</el-button>
    </div>

    <el-dialog v-model="boxDialogVisible" title="参数化立方体/长方体" width="340px" append-to-body>
      <el-form label-position="top" size="small" class="transform-form">
        <el-form-item label="长度 X">
          <el-input-number v-model="boxLength" :min="1" :max="1000" :step="10" />
        </el-form-item>
        <el-form-item label="宽度 Y">
          <el-input-number v-model="boxWidth" :min="1" :max="1000" :step="10" />
        </el-form-item>
        <el-form-item label="高度 Z">
          <el-input-number v-model="boxHeight" :min="1" :max="1000" :step="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="boxDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="applyBox">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="sphereDialogVisible" title="参数化球体" width="320px" append-to-body>
      <el-form label-position="top" size="small">
        <el-form-item label="半径">
          <el-input-number v-model="sphereRadius" :min="1" :max="1000" :step="5" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="sphereDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="applySphere">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="coneDialogVisible" title="参数化锥体" width="320px" append-to-body>
      <el-form label-position="top" size="small">
        <el-form-item label="底面半径">
          <el-input-number v-model="coneBaseRadius" :min="1" :max="1000" :step="5" />
        </el-form-item>
        <el-form-item label="高度">
          <el-input-number v-model="coneHeight" :min="1" :max="1000" :step="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="coneDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="applyCone">创建</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="rotateDialogVisible" title="旋转" width="320px" append-to-body @closed="clearTransformPreview">
      <el-form label-position="top" size="small">
        <el-form-item label="角度">
          <el-input-number v-model="rotateDegrees" :min="-360" :max="360" :step="15" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="closeRotateDialog">取消</el-button>
        <el-button size="small" type="primary" @click="applyRotate">应用</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="arrayDialogVisible" title="矩形阵列" width="360px" append-to-body @closed="clearTransformPreview">
      <el-form label-position="top" size="small" class="transform-form">
        <el-form-item label="列数">
          <el-input-number v-model="arrayColumns" :min="1" :max="20" :step="1" step-strictly />
        </el-form-item>
        <el-form-item label="行数">
          <el-input-number v-model="arrayRows" :min="1" :max="20" :step="1" step-strictly />
        </el-form-item>
        <el-form-item label="X 间距">
          <el-input-number v-model="arraySpacingX" :min="-500" :max="500" :step="5" />
        </el-form-item>
        <el-form-item label="Y 间距">
          <el-input-number v-model="arraySpacingY" :min="-500" :max="500" :step="5" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="closeArrayDialog">取消</el-button>
        <el-button size="small" type="primary" @click="applyArray">应用</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="offsetDialogVisible" title="偏移" width="320px" append-to-body @closed="clearTransformPreview">
      <el-form label-position="top" size="small">
        <el-form-item label="偏移距离">
          <el-input-number v-model="offsetDistance" :min="-500" :max="500" :step="5" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="closeOffsetDialog">取消</el-button>
        <el-button size="small" type="primary" @click="applyOffset">应用</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="filletDialogVisible" title="线段圆角" width="320px" append-to-body @closed="clearTransformPreview">
      <el-form label-position="top" size="small">
        <el-form-item label="圆角半径">
          <el-input-number v-model="filletRadius" :min="1" :max="500" :step="5" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="closeFilletDialog">取消</el-button>
        <el-button size="small" type="primary" :disabled="!canModifyLineCorner" @click="applyFillet">应用</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="chamferDialogVisible" title="线段倒角" width="320px" append-to-body @closed="clearTransformPreview">
      <el-form label-position="top" size="small">
        <el-form-item label="倒角距离">
          <el-input-number v-model="chamferDistance" :min="1" :max="500" :step="5" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="closeChamferDialog">取消</el-button>
        <el-button size="small" type="primary" :disabled="!canModifyLineCorner" @click="applyChamfer">应用</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="helpDialogVisible" title="工作台使用说明" width="640px" append-to-body>
      <div class="help-content">
        <h3>基础操作</h3>
        <p>选择工具用于点选、拖动和调整实体。创建线段、矩形、圆、圆弧或三维实体后，系统会自动回到选择工具。</p>
        <p>右键拖动画布旋转视角，中键拖动画布平移视角，滚轮缩放，视图菜单可快速切换俯视、正视、右视、等轴和全图。</p>
        <h3>草图与实体</h3>
        <p>在工具栏选择 XY、XZ 或 YZ 平面后，新建草图会落在对应平面；矩形和圆可以在当前平面上执行拉伸。</p>
        <p>草图菜单用于创建二维几何，实体菜单用于创建立方体、球体、锥体以及拉伸、布尔等三维操作。</p>
        <h3>约束与协作</h3>
        <p>先选择一个或两个草图对象，再从约束菜单应用尺寸、平行、垂直、相切、同心等关系。成员需要通过项目列表中的邀请确认后才能加入项目。</p>
      </div>
    </el-dialog>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useCadStore, type CadToolType } from '@/stores/cad.store'
import { sketchAngleStepOptions, sketchGridSizeOptions } from '@/cad/geometry/sketchSnapSettings'
import { createLineChamfer, createLineFillet } from '@/cad/geometry/sketchCornerOperations'
import type { LineEntity, SketchPlane } from '@/cad/model/document'
import {
  createOffsetPreviewEntities,
  createRectangularArrayPreviewEntities,
  rotateSketchEntities
} from '@/cad/geometry/sketchTransforms'
import type { ProjectRole } from '@/api/types'

const props = defineProps<{ role?: ProjectRole }>()
defineEmits<{
  save: []
  versions: []
  'export-svg': []
  'export-dxf': []
  view: [command: 'top' | 'front' | 'right' | 'isometric' | 'fit']
}>()
const cadStore = useCadStore()
const readonly = computed(() => props.role === 'VIEWER')
const boxDialogVisible = ref(false)
const sphereDialogVisible = ref(false)
const coneDialogVisible = ref(false)
const rotateDialogVisible = ref(false)
const arrayDialogVisible = ref(false)
const offsetDialogVisible = ref(false)
const filletDialogVisible = ref(false)
const chamferDialogVisible = ref(false)
const helpDialogVisible = ref(false)
const boxLength = ref(60)
const boxWidth = ref(40)
const boxHeight = ref(30)
const sphereRadius = ref(25)
const coneBaseRadius = ref(25)
const coneHeight = ref(50)
const rotateDegrees = ref(90)
const arrayColumns = ref(3)
const arrayRows = ref(2)
const arraySpacingX = ref(30)
const arraySpacingY = ref(30)
const offsetDistance = ref(10)
const filletRadius = ref(10)
const chamferDistance = ref(10)
const gridSnapModel = computed({
  get: () => cadStore.sketchSnapSettings.gridSnap,
  set: (value: boolean) => cadStore.setSketchSnapSettings({ gridSnap: value })
})
const objectSnapModel = computed({
  get: () => cadStore.sketchSnapSettings.objectSnap,
  set: (value: boolean) => cadStore.setSketchSnapSettings({ objectSnap: value })
})
const angleSnapModel = computed({
  get: () => cadStore.sketchSnapSettings.angleSnap,
  set: (value: boolean) => cadStore.setSketchSnapSettings({ angleSnap: value })
})
const gridSizeModel = computed({
  get: () => cadStore.sketchSnapSettings.gridSize,
  set: (value: number) => cadStore.setSketchSnapSettings({ gridSize: value })
})
const angleStepModel = computed({
  get: () => cadStore.sketchSnapSettings.angleStep,
  set: (value: number) => cadStore.setSketchSnapSettings({ angleStep: value })
})
const activeSketchPlaneModel = computed({
  get: () => cadStore.activeSketchPlane,
  set: (value: SketchPlane) => cadStore.setActiveSketchPlane(value)
})

const constructionModeModel = computed({
  get: () => cadStore.constructionMode,
  set: (value: boolean) => cadStore.setConstructionMode(value)
})
const canModifyLineCorner = computed(() => selectedLinePair() !== null)
const canRunBoolean = computed(() => cadStore.selectedFeatures.length >= 2 || (cadStore.document?.features.length ?? 0) >= 2)
const canRunCut = computed(() => {
  if (cadStore.selectedFeatures.length >= 2) return true
  const selected = cadStore.selectedSketchEntity
  return Boolean(
    selected
    && !selected.construction
    && (selected.type === 'rectangle' || selected.type === 'circle')
    && (cadStore.document?.features.length ?? 0) > 0
  )
})

function selectedLinePair(): [LineEntity, LineEntity] | null {
  if (cadStore.selectedSketchEntities.length !== 2) return null
  const [first, second] = cadStore.selectedSketchEntities
  if (first.sketchId !== second.sketchId || first.entity.type !== 'line' || second.entity.type !== 'line') return null
  if (first.entity.locked || second.entity.locked) return null
  return [first.entity, second.entity]
}

function setTool(tool: CadToolType) {
  cadStore.setActiveTool(tool)
}

function active(tool: CadToolType) {
  return cadStore.activeTool === tool ? 'primary' : ''
}

function openBoxDialog() {
  boxDialogVisible.value = true
}

function applyBox() {
  cadStore.addBoxPrimitive(boxLength.value, boxWidth.value, boxHeight.value)
  boxDialogVisible.value = false
}

function openSphereDialog() {
  sphereDialogVisible.value = true
}

function applySphere() {
  cadStore.addSpherePrimitive(sphereRadius.value)
  sphereDialogVisible.value = false
}

function openConeDialog() {
  coneDialogVisible.value = true
}

function applyCone() {
  cadStore.addConePrimitive(coneBaseRadius.value, coneHeight.value)
  coneDialogVisible.value = false
}
function openRotateDialog() {
  rotateDialogVisible.value = true
  updateRotatePreview()
}

function closeRotateDialog() {
  rotateDialogVisible.value = false
  clearTransformPreview()
}

function applyRotate() {
  cadStore.rotateSelection(rotateDegrees.value)
  closeRotateDialog()
}

function openArrayDialog() {
  arrayDialogVisible.value = true
  updateArrayPreview()
}

function closeArrayDialog() {
  arrayDialogVisible.value = false
  clearTransformPreview()
}

function applyArray() {
  cadStore.arraySelection(arrayColumns.value, arrayRows.value, {
    x: arraySpacingX.value,
    y: arraySpacingY.value
  })
  closeArrayDialog()
}

function openOffsetDialog() {
  offsetDialogVisible.value = true
  updateOffsetPreview()
}

function closeOffsetDialog() {
  offsetDialogVisible.value = false
  clearTransformPreview()
}

function applyOffset() {
  cadStore.offsetSelection(offsetDistance.value)
  closeOffsetDialog()
}

function openFilletDialog() {
  filletDialogVisible.value = true
  updateFilletPreview()
}

function closeFilletDialog() {
  filletDialogVisible.value = false
  clearTransformPreview()
}

function applyFillet() {
  cadStore.filletSelectedLines(filletRadius.value)
  closeFilletDialog()
}

function openChamferDialog() {
  chamferDialogVisible.value = true
  updateChamferPreview()
}

function closeChamferDialog() {
  chamferDialogVisible.value = false
  clearTransformPreview()
}

function applyChamfer() {
  cadStore.chamferSelectedLines(chamferDistance.value)
  closeChamferDialog()
}

function updateRotatePreview() {
  if (!rotateDialogVisible.value || readonly.value) return
  const entities = cadStore.selectedSketchEntities.map((item) => item.entity)
  cadStore.setTransformPreviewEntities(rotateSketchEntities(entities, rotateDegrees.value))
}

function updateArrayPreview() {
  if (!arrayDialogVisible.value || readonly.value) return
  const entities = cadStore.selectedSketchEntities.map((item) => item.entity)
  cadStore.setTransformPreviewEntities(
    createRectangularArrayPreviewEntities(entities, arrayColumns.value, arrayRows.value, {
      x: arraySpacingX.value,
      y: arraySpacingY.value
    })
  )
}

function updateOffsetPreview() {
  if (!offsetDialogVisible.value || readonly.value) return
  const entities = cadStore.selectedSketchEntities.map((item) => item.entity)
  cadStore.setTransformPreviewEntities(createOffsetPreviewEntities(entities, offsetDistance.value))
}

function updateFilletPreview() {
  if (!filletDialogVisible.value || readonly.value) return
  const pair = selectedLinePair()
  const result = pair ? createLineFillet(pair[0], pair[1], filletRadius.value) : null
  cadStore.setTransformPreviewEntities(result ? [result.lineA, result.lineB, result.connector] : [])
}

function updateChamferPreview() {
  if (!chamferDialogVisible.value || readonly.value) return
  const pair = selectedLinePair()
  const result = pair ? createLineChamfer(pair[0], pair[1], chamferDistance.value) : null
  cadStore.setTransformPreviewEntities(result ? [result.lineA, result.lineB, result.connector] : [])
}

function clearTransformPreview() {
  cadStore.clearTransformPreview()
}

watch(
  [
    rotateDialogVisible,
    rotateDegrees,
    () => cadStore.selectedSketchEntities.map((item) => item.entity)
  ],
  updateRotatePreview,
  { deep: true }
)

watch(
  [
    arrayDialogVisible,
    arrayColumns,
    arrayRows,
    arraySpacingX,
    arraySpacingY,
    () => cadStore.selectedSketchEntities.map((item) => item.entity)
  ],
  updateArrayPreview,
  { deep: true }
)

watch(
  [
    offsetDialogVisible,
    offsetDistance,
    () => cadStore.selectedSketchEntities.map((item) => item.entity)
  ],
  updateOffsetPreview,
  { deep: true }
)

watch(
  [
    filletDialogVisible,
    filletRadius,
    () => cadStore.selectedSketchEntities.map((item) => item.entity)
  ],
  updateFilletPreview,
  { deep: true }
)

watch(
  [
    chamferDialogVisible,
    chamferDistance,
    () => cadStore.selectedSketchEntities.map((item) => item.entity)
  ],
  updateChamferPreview,
  { deep: true }
)
</script>

<style scoped>
.transform-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
}

.transform-form :deep(.el-input-number) {
  width: 100%;
}

.snap-toolbar-control {
  align-items: center;
  gap: 8px;
}

.snap-grid-select {
  width: 88px;
}

.snap-angle-select {
  width: 76px;
}

.plane-select {
  width: 104px;
}

.help-content {
  display: grid;
  gap: 8px;
  color: #374151;
  line-height: 1.7;
}

.help-content h3,
.help-content p {
  margin: 0;
}

.help-content h3 {
  margin-top: 4px;
  color: #111827;
  font-size: 14px;
}
</style>

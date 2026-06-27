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
      <el-dropdown trigger="click" @command="handleViewCommand">
        <el-button size="small">视图</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="top">俯视</el-dropdown-item>
            <el-dropdown-item command="front">正视</el-dropdown-item>
            <el-dropdown-item command="right">右视</el-dropdown-item>
            <el-dropdown-item command="isometric">等轴</el-dropdown-item>
            <el-dropdown-item command="fit">全图</el-dropdown-item>
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
      <el-checkbox v-model="constructionModeModel" size="small" :disabled="!canEdit">构造</el-checkbox>
      <el-dropdown trigger="click" :disabled="!canEdit" @command="handleToolCommand">
        <el-button size="small" :disabled="!canEdit">草图</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="line">线段</el-dropdown-item>
            <el-dropdown-item command="rectangle">矩形</el-dropdown-item>
            <el-dropdown-item command="circle">圆</el-dropdown-item>
            <el-dropdown-item command="arc">圆弧</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-dropdown trigger="click" :disabled="!canEdit" @command="handleToolCommand">
        <el-button size="small" :disabled="!canEdit">约束</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="fixed">固定</el-dropdown-item>
            <el-dropdown-item command="horizontal">水平</el-dropdown-item>
            <el-dropdown-item command="vertical">垂直</el-dropdown-item>
            <el-dropdown-item command="dimension">尺寸</el-dropdown-item>
            <el-dropdown-item divided command="concentric">同心</el-dropdown-item>
            <el-dropdown-item command="equalRadius">等半径</el-dropdown-item>
            <el-dropdown-item command="parallel">平行</el-dropdown-item>
            <el-dropdown-item command="perpendicular">垂直关系</el-dropdown-item>
            <el-dropdown-item command="tangent">相切</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-dropdown trigger="click" :disabled="!canEdit" @command="handleSolidCommand">
        <el-button size="small" :disabled="!canEdit">实体</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="box">立方体</el-dropdown-item>
            <el-dropdown-item command="sphere">球体</el-dropdown-item>
            <el-dropdown-item command="cone">锥体</el-dropdown-item>
            <el-dropdown-item divided command="extrude">拉伸</el-dropdown-item>
            <el-dropdown-item command="cutDialog" :disabled="!canOpenCutDialog">切除</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-dropdown trigger="click" :disabled="!canEdit" @command="handleBooleanCommand">
        <el-button size="small" :disabled="!canEdit">布尔</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="booleanAdd" :disabled="!canRunBoolean">布尔加</el-dropdown-item>
            <el-dropdown-item command="booleanSubtractDialog" :disabled="!canOpenBooleanSubtractDialog">布尔减</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-dropdown trigger="click" :disabled="!canEdit" @command="handleAssemblyCommand">
        <el-button size="small" :disabled="!canEdit">装配</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="align-all" :disabled="!canRunAssembly">中心重合</el-dropdown-item>
            <el-dropdown-item command="align-x" :disabled="!canRunAssembly">X 中心对齐</el-dropdown-item>
            <el-dropdown-item command="align-y" :disabled="!canRunAssembly">Y 中心对齐</el-dropdown-item>
            <el-dropdown-item command="align-z" :disabled="!canRunAssembly">Z 中心对齐</el-dropdown-item>
            <el-dropdown-item divided command="mate-z" :disabled="!canRunAssembly">Z 面贴合</el-dropdown-item>
            <el-dropdown-item command="assembly-distance" :disabled="!canRunAssembly">轴向距离</el-dropdown-item>
            <el-dropdown-item divided command="toggle-fixed" :disabled="!cadStore.hasFeatureSelection">固定/解除固定</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-dropdown trigger="click" :disabled="!canEdit" @command="handleEditCommand">
        <el-button size="small" :disabled="!canEdit">编辑</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="duplicate" :disabled="!cadStore.hasSketchEntitySelection">复制</el-dropdown-item>
            <el-dropdown-item command="construction" :disabled="!cadStore.hasSketchEntitySelection">构造切换</el-dropdown-item>
            <el-dropdown-item command="rotate-sketch" :disabled="!cadStore.hasSketchEntitySelection">旋转</el-dropdown-item>
            <el-dropdown-item command="rotate-feature" :disabled="!canRotateFeatures">三维旋转</el-dropdown-item>
            <el-dropdown-item command="mirror-horizontal" :disabled="!cadStore.hasSketchEntitySelection">水平镜像</el-dropdown-item>
            <el-dropdown-item command="mirror-vertical" :disabled="!cadStore.hasSketchEntitySelection">垂直镜像</el-dropdown-item>
            <el-dropdown-item command="mirror-line" :disabled="cadStore.selectedSketchEntities.length < 2">按线镜像</el-dropdown-item>
            <el-dropdown-item command="array" :disabled="!cadStore.hasSketchEntitySelection">阵列</el-dropdown-item>
            <el-dropdown-item command="offset" :disabled="!cadStore.hasSketchEntitySelection">偏移</el-dropdown-item>
            <el-dropdown-item command="fillet" :disabled="!canModifyLineCorner">圆角</el-dropdown-item>
            <el-dropdown-item command="chamfer" :disabled="!canModifyLineCorner">倒角</el-dropdown-item>
            <el-dropdown-item divided command="delete" :disabled="!cadStore.selection">删除</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button size="small" :disabled="!canEdit || !cadStore.canUndo" @click="cadStore.undo()">撤销</el-button>
      <el-button size="small" :disabled="!canEdit || !cadStore.canRedo" @click="cadStore.redo()">重做</el-button>
    </div>
    <div class="toolbar-group">
      <el-button size="small" type="primary" :disabled="!canEdit" @click="$emit('save')">保存</el-button>
      <el-button size="small" @click="$emit('versions')">版本</el-button>
      <el-button size="small" @click="$emit('export-svg')">SVG</el-button>
      <el-button size="small" @click="$emit('export-dxf')">DXF</el-button>
      <el-button size="small" @click="$emit('export-stl')">STL</el-button>
      <el-button size="small" @click="$emit('export-glb')">GLB</el-button>
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
    <el-dialog v-model="cutDialogVisible" title="草图切除" width="360px" append-to-body>
      <el-form label-position="top" size="small" class="transform-form">
        <el-form-item label="主体实体">
          <el-select v-model="cutTargetFeatureId" class="full-width" placeholder="选择被切除的实体">
            <el-option
              v-for="feature in cutTargetOptions"
              :key="feature.id"
              :label="feature.name"
              :value="feature.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="切除草图">
          <el-select v-model="cutProfileKey" class="full-width" placeholder="选择矩形或圆草图">
            <el-option
              v-for="profile in cutProfileOptions"
              :key="profile.key"
              :label="profile.label"
              :value="profile.key"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="切除深度">
          <el-input-number v-model="cutDepth" :min="1" :max="2000" :step="5" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="cutDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" :disabled="!cutTargetFeatureId || !cutProfileKey" @click="applyCut">
          应用
        </el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="booleanSubtractDialogVisible" title="布尔减" width="360px" append-to-body>
      <el-form label-position="top" size="small" class="transform-form">
        <el-form-item label="主体 A">
          <el-select v-model="booleanSubtractTargetId" class="full-width" placeholder="选择被减的主体">
            <el-option
              v-for="feature in booleanFeatureOptions"
              :key="feature.id"
              :label="feature.name"
              :value="feature.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="客体 B">
          <el-select v-model="booleanSubtractToolId" class="full-width" placeholder="选择用于相减的客体">
            <el-option
              v-for="feature in booleanFeatureOptions"
              :key="feature.id"
              :label="feature.name"
              :value="feature.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="booleanSubtractDialogVisible = false">取消</el-button>
        <el-button
          size="small"
          type="primary"
          :disabled="!booleanSubtractTargetId || !booleanSubtractToolId || booleanSubtractTargetId === booleanSubtractToolId"
          @click="applyBooleanSubtract"
        >
          应用
        </el-button>
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

    <el-dialog v-model="featureRotateDialogVisible" title="三维旋转" width="340px" append-to-body>
      <el-form label-position="top" size="small" class="transform-form">
        <el-form-item label="绕 X 轴">
          <el-input-number v-model="featureRotateX" :min="-360" :max="360" :step="15" />
        </el-form-item>
        <el-form-item label="绕 Y 轴">
          <el-input-number v-model="featureRotateY" :min="-360" :max="360" :step="15" />
        </el-form-item>
        <el-form-item label="绕 Z 轴">
          <el-input-number v-model="featureRotateZ" :min="-360" :max="360" :step="15" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="featureRotateDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="applyFeatureRotate">应用</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="assemblyDistanceDialogVisible" title="轴向距离约束" width="340px" append-to-body>
      <el-form label-position="top" size="small" class="transform-form">
        <el-form-item label="轴向">
          <el-select v-model="assemblyDistanceAxis">
            <el-option label="X" value="x" />
            <el-option label="Y" value="y" />
            <el-option label="Z" value="z" />
          </el-select>
        </el-form-item>
        <el-form-item label="距离">
          <el-input-number v-model="assemblyDistance" :min="-1000" :max="1000" :step="5" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="assemblyDistanceDialogVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="applyAssemblyDistance">应用</el-button>
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
import { ElMessage } from 'element-plus'
import { useCadStore, type CadToolType } from '@/stores/cad.store'
import { sketchAngleStepOptions, sketchGridSizeOptions } from '@/cad/geometry/sketchSnapSettings'
import { createLineChamfer, createLineFillet } from '@/cad/geometry/sketchCornerOperations'
import type { LineEntity, SketchEntity, SketchPlane } from '@/cad/model/document'
import {
  createOffsetPreviewEntities,
  createRectangularArrayPreviewEntities,
  rotateSketchEntities
} from '@/cad/geometry/sketchTransforms'
import type { ProjectRole } from '@/api/types'

const props = defineProps<{ role?: ProjectRole }>()
const emit = defineEmits<{
  save: []
  versions: []
  'export-svg': []
  'export-dxf': []
  'export-stl': []
  'export-glb': []
  view: [command: 'top' | 'front' | 'right' | 'isometric' | 'fit']
}>()
const cadStore = useCadStore()
const readonly = computed(() => props.role === 'VIEWER')
const canEdit = computed(() => !readonly.value && Boolean(cadStore.document))
const boxDialogVisible = ref(false)
const sphereDialogVisible = ref(false)
const coneDialogVisible = ref(false)
const cutDialogVisible = ref(false)
const booleanSubtractDialogVisible = ref(false)
const rotateDialogVisible = ref(false)
const featureRotateDialogVisible = ref(false)
const assemblyDistanceDialogVisible = ref(false)
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
const cutDepth = ref(40)
const cutTargetFeatureId = ref('')
const cutProfileKey = ref('')
const booleanSubtractTargetId = ref('')
const booleanSubtractToolId = ref('')
const rotateDegrees = ref(90)
const featureRotateX = ref(0)
const featureRotateY = ref(0)
const featureRotateZ = ref(90)
const assemblyDistanceAxis = ref<'x' | 'y' | 'z'>('x')
const assemblyDistance = ref(20)
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
const canRunBoolean = computed(() => cadStore.selectedFeatures.length >= 2)
const booleanFeatureOptions = computed(() => (cadStore.document?.features ?? []).filter((feature) => !feature.suppressed))
const cutTargetOptions = computed(() => (cadStore.document?.features ?? []).filter((feature) => !feature.suppressed))
const cutProfileOptions = computed(() => {
  const document = cadStore.document
  if (!document) return []
  return document.sketches.flatMap((sketch) =>
    sketch.entities
      .filter(isCutProfile)
      .map((entity) => ({
        key: `${sketch.id}:${entity.id}`,
        sketchId: sketch.id,
        entityId: entity.id,
        label: `${sketch.name} / ${entity.name}`
      }))
  )
})
const canOpenCutDialog = computed(() => cutTargetOptions.value.length > 0 && cutProfileOptions.value.length > 0)
const canOpenBooleanSubtractDialog = computed(() => booleanFeatureOptions.value.length >= 2)
const canRunAssembly = computed(() => cadStore.selectedFeatures.length >= 2)
const canRotateFeatures = computed(() => cadStore.selectedFeatures.some((item) => !item.feature.locked && !item.feature.suppressed))

type ViewCommand = 'top' | 'front' | 'right' | 'isometric' | 'fit'
type SolidCommand = 'box' | 'sphere' | 'cone' | 'extrude' | 'cutDialog'
type BooleanCommand = 'booleanAdd' | 'booleanSubtractDialog'
type AssemblyCommand = 'align-all' | 'align-x' | 'align-y' | 'align-z' | 'mate-z' | 'assembly-distance' | 'toggle-fixed'
type EditCommand =
  | 'duplicate'
  | 'construction'
  | 'rotate-sketch'
  | 'rotate-feature'
  | 'mirror-horizontal'
  | 'mirror-vertical'
  | 'mirror-line'
  | 'array'
  | 'offset'
  | 'fillet'
  | 'chamfer'
  | 'delete'

function isStringCommand(command: string | number | object): command is string {
  return typeof command === 'string'
}

function ensureCanEdit(): boolean {
  if (readonly.value) {
    ElMessage.warning('当前项目是只读权限，不能编辑模型')
    return false
  }
  if (!cadStore.document) {
    ElMessage.warning('模型文档尚未加载完成，请稍后再试')
    return false
  }
  return true
}

function selectedLinePair(): [LineEntity, LineEntity] | null {
  if (cadStore.selectedSketchEntities.length !== 2) return null
  const [first, second] = cadStore.selectedSketchEntities
  if (first.sketchId !== second.sketchId || first.entity.type !== 'line' || second.entity.type !== 'line') return null
  if (first.entity.locked || second.entity.locked) return null
  return [first.entity, second.entity]
}

function setTool(tool: CadToolType) {
  if (tool !== 'select' && !ensureCanEdit()) return
  cadStore.setActiveTool(tool)
}

function handleViewCommand(command: string | number | object) {
  if (!isStringCommand(command)) return
  if (command === 'top' || command === 'front' || command === 'right' || command === 'isometric' || command === 'fit') {
    emit('view', command as ViewCommand)
  }
}

function handleToolCommand(command: string | number | object) {
  if (!isStringCommand(command)) return
  setTool(command as CadToolType)
}

function handleSolidCommand(command: string | number | object) {
  if (!isStringCommand(command) || !ensureCanEdit()) return
  const solidCommand = command as SolidCommand
  if (solidCommand === 'box') openBoxDialog()
  if (solidCommand === 'sphere') openSphereDialog()
  if (solidCommand === 'cone') openConeDialog()
  if (solidCommand === 'extrude') setTool('extrude')
  if (solidCommand === 'cutDialog') openCutDialog()
}

function handleBooleanCommand(command: string | number | object) {
  if (!isStringCommand(command) || !ensureCanEdit()) return
  const booleanCommand = command as BooleanCommand
  if (booleanCommand === 'booleanAdd') setTool('booleanAdd')
  if (booleanCommand === 'booleanSubtractDialog') openBooleanSubtractDialog()
}

function handleAssemblyCommand(command: string | number | object) {
  if (!isStringCommand(command) || !ensureCanEdit()) return
  const assemblyCommand = command as AssemblyCommand
  if (assemblyCommand === 'align-all') cadStore.applyAssemblyAlign('all')
  if (assemblyCommand === 'align-x') cadStore.applyAssemblyAlign('x')
  if (assemblyCommand === 'align-y') cadStore.applyAssemblyAlign('y')
  if (assemblyCommand === 'align-z') cadStore.applyAssemblyAlign('z')
  if (assemblyCommand === 'mate-z') cadStore.applyAssemblyMateZ()
  if (assemblyCommand === 'assembly-distance') openAssemblyDistanceDialog()
  if (assemblyCommand === 'toggle-fixed') cadStore.toggleSelectedFeatureFixed()
}

function handleEditCommand(command: string | number | object) {
  if (!isStringCommand(command) || !ensureCanEdit()) return
  const editCommand = command as EditCommand
  if (editCommand === 'duplicate') cadStore.duplicateSelection()
  if (editCommand === 'construction') cadStore.toggleSelectionConstruction()
  if (editCommand === 'rotate-sketch') openRotateDialog()
  if (editCommand === 'rotate-feature') openFeatureRotateDialog()
  if (editCommand === 'mirror-horizontal') cadStore.mirrorSelection('horizontal')
  if (editCommand === 'mirror-vertical') cadStore.mirrorSelection('vertical')
  if (editCommand === 'mirror-line') cadStore.mirrorSelectionByLine()
  if (editCommand === 'array') openArrayDialog()
  if (editCommand === 'offset') openOffsetDialog()
  if (editCommand === 'fillet') openFilletDialog()
  if (editCommand === 'chamfer') openChamferDialog()
  if (editCommand === 'delete') cadStore.deleteSelection()
}

function active(tool: CadToolType) {
  return cadStore.activeTool === tool ? 'primary' : ''
}

function openBoxDialog() {
  if (!ensureCanEdit()) return
  boxDialogVisible.value = true
}

function applyBox() {
  if (!ensureCanEdit()) return
  cadStore.addBoxPrimitive(boxLength.value, boxWidth.value, boxHeight.value)
  boxDialogVisible.value = false
}

function openSphereDialog() {
  if (!ensureCanEdit()) return
  sphereDialogVisible.value = true
}

function applySphere() {
  if (!ensureCanEdit()) return
  cadStore.addSpherePrimitive(sphereRadius.value)
  sphereDialogVisible.value = false
}

function openConeDialog() {
  if (!ensureCanEdit()) return
  coneDialogVisible.value = true
}

function applyCone() {
  if (!ensureCanEdit()) return
  cadStore.addConePrimitive(coneBaseRadius.value, coneHeight.value)
  coneDialogVisible.value = false
}

function isCutProfile(entity: SketchEntity): boolean {
  return !entity.construction && (entity.type === 'rectangle' || entity.type === 'circle')
}

function openCutDialog() {
  const selectedTarget = cadStore.selectedFeatures[0]?.feature
  const fallbackTarget = [...cutTargetOptions.value].reverse()[0]
  cutTargetFeatureId.value = selectedTarget && !selectedTarget.suppressed
    ? selectedTarget.id
    : fallbackTarget?.id ?? ''
  const selectedEntity = cadStore.selectedSketchEntity
  const selectedProfile = selectedEntity && isCutProfile(selectedEntity)
    ? cutProfileOptions.value.find((profile) => profile.entityId === selectedEntity.id)
    : null
  cutProfileKey.value = selectedProfile?.key ?? cutProfileOptions.value[0]?.key ?? ''
  cutDialogVisible.value = true
}

function applyCut() {
  const profile = cutProfileOptions.value.find((item) => item.key === cutProfileKey.value)
  if (!profile || !cutTargetFeatureId.value) return
  cadStore.createSketchCut(cutTargetFeatureId.value, profile.sketchId, profile.entityId, cutDepth.value)
  cutDialogVisible.value = false
}

function openBooleanSubtractDialog() {
  const selected = cadStore.selectedFeatures.map((item) => item.feature).filter((feature) => !feature.suppressed)
  booleanSubtractTargetId.value = selected[0]?.id ?? booleanFeatureOptions.value[0]?.id ?? ''
  booleanSubtractToolId.value = selected.find((feature) => feature.id !== booleanSubtractTargetId.value)?.id
    ?? booleanFeatureOptions.value.find((feature) => feature.id !== booleanSubtractTargetId.value)?.id
    ?? ''
  booleanSubtractDialogVisible.value = true
}

function applyBooleanSubtract() {
  if (!booleanSubtractTargetId.value || !booleanSubtractToolId.value || booleanSubtractTargetId.value === booleanSubtractToolId.value) return
  cadStore.booleanSelected('subtract', booleanSubtractTargetId.value, booleanSubtractToolId.value)
  booleanSubtractDialogVisible.value = false
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

function openFeatureRotateDialog() {
  featureRotateDialogVisible.value = true
}

function applyFeatureRotate() {
  cadStore.rotateSelectedFeatures({
    x: featureRotateX.value,
    y: featureRotateY.value,
    z: featureRotateZ.value
  })
  featureRotateDialogVisible.value = false
}

function openAssemblyDistanceDialog() {
  assemblyDistanceDialogVisible.value = true
}

function applyAssemblyDistance() {
  cadStore.applyAssemblyDistance(assemblyDistanceAxis.value, assemblyDistance.value)
  assemblyDistanceDialogVisible.value = false
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

.full-width {
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

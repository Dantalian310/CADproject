<template>
  <main class="workspace">
    <header class="workspace-header">
      <div class="workspace-title">
        <strong>{{ projectStore.currentProject?.name || 'CAD 工作台' }}</strong>
        <el-tag v-if="projectStore.currentProject?.myRole" size="small">
          {{ projectStore.currentProject?.myRole }}
        </el-tag>
      </div>
      <div class="workspace-actions">
        <span class="muted">{{ authStore.currentUser?.username }}</span>
        <el-button size="small" @click="leaveWorkspace">项目列表</el-button>
        <el-button size="small" text @click="logout">退出登录</el-button>
      </div>
    </header>
    <CadToolbar
      :role="projectStore.currentProject?.myRole"
      @save="save"
      @versions="versionVisible = true"
      @export-svg="exportSvg"
      @export-dxf="exportDxf"
      @view="handleViewCommand"
    />
    <section class="workspace-body">
      <aside class="workspace-panel">
        <FeatureTree />
      </aside>
      <CadViewport ref="viewport" :readonly="projectStore.currentProject?.myRole === 'VIEWER'" />
      <aside class="workspace-panel right">
        <PropertyPanel />
        <OnlineUsers />
      </aside>
    </section>
    <StatusBar />
    <VersionHistoryDialog v-model="versionVisible" :document-id="documentId" />
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import CadToolbar from '@/components/toolbar/CadToolbar.vue'
import FeatureTree from '@/components/feature-tree/FeatureTree.vue'
import CadViewport from '@/components/viewport/CadViewport.vue'
import PropertyPanel from '@/components/property-panel/PropertyPanel.vue'
import OnlineUsers from '@/components/collaboration/OnlineUsers.vue'
import StatusBar from '@/components/status-bar/StatusBar.vue'
import VersionHistoryDialog from '@/components/dialogs/VersionHistoryDialog.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useCadStore } from '@/stores/cad.store'
import { useCollaborationStore } from '@/stores/collaboration.store'
import { useProjectStore } from '@/stores/project.store'
import { exportSketchDocumentDxf, exportSketchDocumentSvg } from '@/cad/io/sketchExport'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const cadStore = useCadStore()
const projectStore = useProjectStore()
const collaborationStore = useCollaborationStore()
const versionVisible = ref(false)
const viewport = ref<InstanceType<typeof CadViewport> | null>(null)
const projectId = computed(() => Number(route.params.projectId))
const documentId = computed(() => Number(route.params.documentId))

onMounted(async () => {
  window.addEventListener('beforeunload', disconnectCollaboration)
  await projectStore.loadProject(projectId.value)
  await cadStore.loadDocument(documentId.value)
  if (authStore.token) {
    await collaborationStore.connect(documentId.value, authStore.token)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', disconnectCollaboration)
  disconnectCollaboration()
})

function disconnectCollaboration() {
  collaborationStore.disconnect()
}

function save() {
  void cadStore.save(documentId.value, 'manual save')
}

function exportSvg() {
  exportSketch('svg')
}

function exportDxf() {
  exportSketch('dxf')
}

function exportSketch(format: 'svg' | 'dxf') {
  if (!cadStore.document) {
    ElMessage.warning('当前没有可导出的 CAD 文档')
    return
  }
  const content = format === 'svg'
    ? exportSketchDocumentSvg(cadStore.document)
    : exportSketchDocumentDxf(cadStore.document)
  const mimeType = format === 'svg' ? 'image/svg+xml;charset=utf-8' : 'application/dxf;charset=utf-8'
  downloadTextFile(content, `${safeFileName(cadStore.document.name)}.${format}`, mimeType)
  ElMessage.success(`已导出 ${format.toUpperCase()} 草图文件`)
}

function downloadTextFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function safeFileName(name: string) {
  return name.trim().replace(/[\\/:*?"<>|]+/g, '_') || 'cad-sketch'
}
function handleViewCommand(command: 'top' | 'front' | 'right' | 'isometric' | 'fit') {
  viewport.value?.applyViewCommand(command)
}

async function leaveWorkspace() {
  disconnectCollaboration()
  await router.push('/projects')
}

async function logout() {
  disconnectCollaboration()
  authStore.logout()
  await router.push('/login')
}
</script>

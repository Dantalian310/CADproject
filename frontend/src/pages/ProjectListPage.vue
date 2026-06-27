<template>
  <main class="page-shell projects-page">
    <header class="projects-header">
      <strong>Cloud CAD</strong>
      <div>
        <span class="muted">{{ authStore.currentUser?.username }}</span>
        <el-button link @click="logout">退出</el-button>
      </div>
    </header>

    <section class="projects-content">
      <section v-if="projectStore.pendingInvitations.length > 0" class="invitation-panel">
        <div class="invitation-title">
          <h2>收到的项目邀请</h2>
          <el-tag size="small" type="warning">{{ projectStore.pendingInvitations.length }}</el-tag>
        </div>
        <div class="invitation-list">
          <article v-for="invitation in projectStore.pendingInvitations" :key="invitation.id" class="invitation-card">
            <div>
              <strong>{{ invitation.projectName }}</strong>
              <p class="muted">
                {{ invitation.inviter.displayName || invitation.inviter.username }} 邀请你以
                {{ invitation.role }} 身份加入
              </p>
            </div>
            <div class="invitation-actions">
              <el-button size="small" type="primary" @click="acceptInvitation(invitation.id)">接受</el-button>
              <el-button size="small" @click="rejectInvitation(invitation.id)">拒绝</el-button>
            </div>
          </article>
        </div>
      </section>

      <div class="section-title">
        <h1>模型文件</h1>
        <div class="section-actions">
          <el-button :loading="projectStore.loading" @click="openImportDialog">上传模型文件</el-button>
          <el-button @click="loadDocuments">刷新</el-button>
        </div>
      </div>

      <el-table
        v-if="documents.length > 0"
        v-loading="documentsLoading"
        :data="documents"
        class="document-table"
        size="small"
      >
        <el-table-column prop="name" label="文件名" min-width="160" />
        <el-table-column label="所属项目" min-width="140">
          <template #default="{ row }">
            {{ projectNameById.get(row.projectId) || `Project ${row.projectId}` }}
          </template>
        </el-table-column>
        <el-table-column prop="description" label="介绍" min-width="220" show-overflow-tooltip />
        <el-table-column label="版本" width="90">
          <template #default="{ row }">v{{ row.currentVersion }}</template>
        </el-table-column>
        <el-table-column label="更新时间" min-width="160">
          <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button size="small" type="primary" @click="openDocument(row)">打开</el-button>
              <el-button size="small" @click="openDocumentEdit(row)">编辑</el-button>
              <el-button size="small" @click="downloadDocument(row)">下载</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else-if="!documentsLoading" description="暂无模型文件" :image-size="64" />

      <div class="section-title project-section-title">
        <h1>项目</h1>
        <el-button type="primary" @click="createVisible = true">新建项目</el-button>
      </div>

      <el-empty v-if="!projectStore.loading && projectStore.projects.length === 0" description="暂无项目">
        <el-button type="primary" @click="createVisible = true">新建项目</el-button>
      </el-empty>

      <div v-else class="project-grid">
        <article v-for="project in projectStore.projects" :key="project.id" class="project-card">
          <h2>{{ project.name }}</h2>
          <p class="muted">{{ project.description || '无描述' }}</p>
          <el-tag size="small">{{ project.myRole }}</el-tag>
          <div class="project-actions">
            <el-button type="primary" @click="openWorkspace(project)">进入工作台</el-button>
            <el-button v-if="project.myRole === 'OWNER'" @click="openEdit(project)">编辑</el-button>
            <el-button v-if="project.myRole === 'OWNER'" @click="openMembers(project)">成员</el-button>
            <el-button v-if="project.myRole === 'OWNER'" type="danger" plain @click="confirmDelete(project)">
              删除
            </el-button>
          </div>
        </article>
      </div>
    </section>

    <CreateProjectDialog v-model="createVisible" @created="handleCreated" />
    <EditProjectDialog v-model="editVisible" :project="editingProject" @updated="handleUpdated" />
    <ProjectMemberDialog
      v-model="memberVisible"
      :project-id="memberProjectId"
      :can-manage="memberCanManage"
    />
    <el-dialog v-model="documentEditVisible" title="编辑模型文件" width="420px" append-to-body>
      <el-form label-position="top" size="small">
        <el-form-item label="文件名">
          <el-input v-model="documentForm.name" maxlength="128" />
        </el-form-item>
        <el-form-item label="内容介绍">
          <el-input v-model="documentForm.description" type="textarea" :rows="4" maxlength="1000" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="documentEditVisible = false">取消</el-button>
        <el-button size="small" type="primary" @click="saveDocumentMetadata">保存</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="documentImportVisible" title="上传模型文件" width="460px" append-to-body>
      <el-form label-position="top" size="small">
        <el-form-item label="模型项目">
          <p class="form-tip">
            上传后会自动创建一个独立项目；每个模型文件对应一个项目，删除项目只会删除该项目内的模型。
          </p>
        </el-form-item>
        <el-form-item label="本地模型文件">
          <input
            ref="documentImportInput"
            type="file"
            accept=".cloudcad,.json,.stl,.gltf,.glb,.step,.stp,.dwg,application/json,model/stl,model/gltf+json,model/gltf-binary"
            @change="handleImportFileChange"
          />
          <p class="form-tip">支持 .cloudcad、旧版 .json、STL、glTF/GLB；STEP/DWG 当前会提示转换方案。</p>
        </el-form-item>
        <el-form-item label="导入后文件名">
          <el-input v-model="documentImportForm.name" maxlength="128" placeholder="默认使用文件内名称或本地文件名" />
        </el-form-item>
        <el-form-item label="内容介绍">
          <el-input v-model="documentImportForm.description" type="textarea" :rows="3" maxlength="1000" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="small" @click="documentImportVisible = false">取消</el-button>
        <el-button size="small" type="primary" :loading="documentImporting" @click="importDocumentFile">
          上传并打开
        </el-button>
      </template>
    </el-dialog>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useProjectStore } from '@/stores/project.store'
import type { DocumentDTO, ProjectDTO } from '@/api/types'
import type { CadDocument } from '@/cad/model/document'
import { createDocument, exportDocumentJson, listDocuments, saveDocument, updateDocument } from '@/api/document.api'
import { createCloudCadPackage, loadCadDocumentFromFile } from '@/cad/io/cadFileExchange'
import CreateProjectDialog from '@/components/dialogs/CreateProjectDialog.vue'
import EditProjectDialog from '@/components/dialogs/EditProjectDialog.vue'
import ProjectMemberDialog from '@/components/dialogs/ProjectMemberDialog.vue'

const router = useRouter()
const authStore = useAuthStore()
const projectStore = useProjectStore()
const createVisible = ref(false)
const editVisible = ref(false)
const editingProject = ref<ProjectDTO | null>(null)
const memberVisible = ref(false)
const memberProjectId = ref<number | null>(null)
const memberCanManage = ref(false)
const documents = ref<DocumentDTO[]>([])
const documentsLoading = ref(false)
const documentEditVisible = ref(false)
const editingDocument = ref<DocumentDTO | null>(null)
const documentForm = reactive({
  name: '',
  description: ''
})
const documentImportVisible = ref(false)
const documentImportInput = ref<HTMLInputElement | null>(null)
const documentImporting = ref(false)
const documentImportForm = reactive({
  name: '',
  description: '',
  file: null as File | null
})
const projectNameById = computed(() => new Map(projectStore.projects.map((project) => [project.id, project.name])))

onMounted(() => {
  void loadDashboard()
  void projectStore.loadPendingInvitations()
})

async function loadDashboard() {
  await projectStore.loadProjects()
  await loadDocuments()
}

async function loadDocuments() {
  documentsLoading.value = true
  try {
    const results = await Promise.all(projectStore.projects.map((project) => listDocuments(project.id)))
    documents.value = results.flat().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  } finally {
    documentsLoading.value = false
  }
}

async function openWorkspace(project: ProjectDTO) {
  if (!project.defaultDocumentId) return
  await router.push(`/workspace/${project.id}/${project.defaultDocumentId}`)
}

async function openDocument(document: DocumentDTO) {
  await router.push(`/workspace/${document.projectId}/${document.id}`)
}

function openMembers(project: ProjectDTO) {
  memberProjectId.value = project.id
  memberCanManage.value = project.myRole === 'OWNER'
  memberVisible.value = true
}

function openEdit(project: ProjectDTO) {
  editingProject.value = project
  editVisible.value = true
}

function handleCreated() {
  void loadDashboard()
}

function handleUpdated() {
  editingProject.value = null
}

async function confirmDelete(project: ProjectDTO) {
  try {
    await ElMessageBox.confirm(
      `删除项目「${project.name}」后，它会从项目列表中移除。此操作只允许项目 OWNER 执行。`,
      '删除项目',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    await projectStore.deleteProject(project.id)
    documents.value = documents.value.filter((document) => document.projectId !== project.id)
    ElMessage.success('项目已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '删除项目失败')
    }
  }
}

async function logout() {
  authStore.logout()
  await router.push('/login')
}

function openDocumentEdit(document: DocumentDTO) {
  editingDocument.value = document
  documentForm.name = document.name
  documentForm.description = document.description || ''
  documentEditVisible.value = true
}

async function saveDocumentMetadata() {
  const document = editingDocument.value
  if (!document) return
  const updated = await updateDocument(document.id, {
    name: documentForm.name.trim() || document.name,
    description: documentForm.description.trim() || undefined
  })
  documents.value = documents.value.map((item) => (item.id === updated.id ? updated : item))
  documentEditVisible.value = false
  ElMessage.success('模型文件已更新')
}

async function downloadDocument(document: DocumentDTO) {
  const blob = await exportDocumentJson(document.id)
  const snapshot = JSON.parse(await blob.text()) as CadDocument
  const cloudCadBlob = new Blob([JSON.stringify(createCloudCadPackage(snapshot), null, 2)], {
    type: 'application/vnd.cloudcad+json;charset=utf-8'
  })
  const url = URL.createObjectURL(cloudCadBlob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = `${document.name || 'cad-document'}.cloudcad`
  link.click()
  URL.revokeObjectURL(url)
}

function openImportDialog() {
  documentImportForm.name = ''
  documentImportForm.description = ''
  documentImportForm.file = null
  if (documentImportInput.value) documentImportInput.value.value = ''
  documentImportVisible.value = true
}

function handleImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  documentImportForm.file = file
  if (file && !documentImportForm.name.trim()) {
    documentImportForm.name = file.name.replace(/\.[^.]+$/i, '')
  }
}

async function importDocumentFile() {
  if (!documentImportForm.file) {
    ElMessage.warning('请先选择本地模型文件')
    return
  }
  documentImporting.value = true
  try {
    const imported = await loadCadDocumentFromFile(documentImportForm.file)
    const snapshot = normalizeImportedSnapshot(imported.document)
    const name = documentImportForm.name.trim() || imported.suggestedName || snapshot.name
    const description = documentImportForm.description.trim() || undefined
    const project = await createImportProject(name, description)
    const targetDocument = await prepareImportDocument(project.id, name, description)
    const importedSnapshot: CadDocument = {
      ...snapshot,
      documentId: String(targetDocument.id),
      name,
      metadata: {
        ...snapshot.metadata,
        currentVersion: targetDocument.currentVersion
      }
    }
    const saved = await saveDocument(targetDocument.id, {
      baseVersion: targetDocument.currentVersion,
      snapshotJson: importedSnapshot,
      message: `import ${imported.sourceFormat} model file`
    })
    documents.value = [saved, ...documents.value.filter((item) => item.id !== saved.id)]
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    documentImportVisible.value = false
    ElMessage.success('已创建独立模型项目并上传文件')
    await router.push(`/workspace/${saved.projectId}/${saved.id}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '上传模型文件失败')
  } finally {
    documentImporting.value = false
  }
}

async function prepareImportDocument(projectId: number, name: string, description?: string): Promise<DocumentDTO> {
  const reusable = await findReusableImportDocument(projectId)
  if (reusable) {
    return updateDocument(reusable.id, { name, description })
  }
  return createDocument(projectId, { name, description })
}

async function createImportProject(name: string, description?: string): Promise<ProjectDTO> {
  const projectName = makeUniqueProjectName(name || '导入模型')
  return projectStore.createProject({
    name: projectName,
    description: description || '由上传模型文件自动创建的独立项目'
  })
}

async function findReusableImportDocument(projectId: number): Promise<DocumentDTO | null> {
  const projectDocuments = await listDocuments(projectId)
  return projectDocuments.find((document) => isReusableEmptyDocument(document)) ?? null
}

function isReusableEmptyDocument(document: DocumentDTO): boolean {
  const snapshot = document.snapshotJson
  const hasNoFeatures = Array.isArray(snapshot.features) && snapshot.features.length === 0
  const hasNoSketchGeometry = Array.isArray(snapshot.sketches)
    && snapshot.sketches.every((sketch) => !Array.isArray(sketch.entities) || sketch.entities.length === 0)
  return document.name === 'Demo Part'
    && document.currentVersion <= 1
    && hasNoFeatures
    && hasNoSketchGeometry
}

function makeUniqueProjectName(baseName: string): string {
  const normalizedBase = baseName.trim() || '导入模型'
  const existingNames = new Set(projectStore.projects.map((project) => project.name))
  if (!existingNames.has(normalizedBase)) return normalizedBase
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${normalizedBase} (${index})`
    if (!existingNames.has(candidate)) return candidate
  }
  return `${normalizedBase} (${Date.now()})`
}

function normalizeImportedSnapshot(value: unknown): CadDocument {
  if (!value || typeof value !== 'object') {
    throw new Error('文件内容不是有效的 CAD JSON')
  }
  const snapshot = value as Partial<CadDocument>
  if (!Array.isArray(snapshot.sketches) || !Array.isArray(snapshot.features)) {
    throw new Error('文件缺少 sketches 或 features，无法作为 CAD 模型导入')
  }
  return {
    schemaVersion: snapshot.schemaVersion || '1.0',
    documentId: snapshot.documentId || 'imported',
    name: snapshot.name || '导入模型',
    unit: snapshot.unit || 'mm',
    metadata: snapshot.metadata || { currentVersion: 0 },
    sketches: snapshot.sketches,
    features: snapshot.features,
    assemblies: snapshot.assemblies ?? []
  }
}

function formatTime(value?: string): string {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

async function acceptInvitation(invitationId: number) {
  await projectStore.acceptInvitation(invitationId)
  ElMessage.success('已加入项目')
}

async function rejectInvitation(invitationId: number) {
  await projectStore.rejectInvitation(invitationId)
  ElMessage.success('已拒绝邀请')
}
</script>

<style scoped>
.projects-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 24px;
  border-bottom: 1px solid #d8dee9;
  background: #fff;
}

.projects-content {
  max-width: 1120px;
  margin: 0 auto;
  padding: 28px 24px;
}

.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.project-section-title {
  margin-top: 28px;
}

.section-title h1 {
  margin: 0;
  font-size: 22px;
}

.section-actions {
  display: flex;
  gap: 8px;
}

.form-tip {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}

.invitation-panel {
  margin-bottom: 20px;
  padding: 14px;
  border: 1px solid #f3d19e;
  border-radius: 8px;
  background: #fffaf0;
}

.invitation-title,
.invitation-card,
.invitation-actions {
  display: flex;
  align-items: center;
}

.invitation-title {
  gap: 8px;
  margin-bottom: 12px;
}

.invitation-title h2 {
  margin: 0;
  font-size: 16px;
}

.invitation-list {
  display: grid;
  gap: 10px;
}

.invitation-card {
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #fdecc8;
  border-radius: 6px;
  background: #fff;
}

.invitation-card p {
  margin: 4px 0 0;
}

.invitation-actions {
  flex: 0 0 auto;
  gap: 8px;
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.project-card {
  padding: 16px;
  border: 1px solid #d8dee9;
  border-radius: 8px;
  background: #fff;
}

.project-card h2 {
  margin: 0 0 8px;
  font-size: 16px;
}

.project-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.document-table {
  margin-bottom: 8px;
  border: 1px solid #d8dee9;
  border-radius: 8px;
}

.table-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.table-actions :deep(.el-button) {
  margin-left: 0;
}

.project-actions :deep(.el-button) {
  min-width: 0;
  margin-left: 0;
  flex: 1 1 calc(50% - 8px);
}

@media (width <= 560px) {
  .invitation-card {
    align-items: flex-start;
    flex-direction: column;
  }

  .invitation-actions,
  .project-actions :deep(.el-button) {
    width: 100%;
  }
}
</style>

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
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useProjectStore } from '@/stores/project.store'
import type { ProjectDTO } from '@/api/types'
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

onMounted(() => {
  void projectStore.loadProjects()
  void projectStore.loadPendingInvitations()
})

async function openWorkspace(project: ProjectDTO) {
  if (!project.defaultDocumentId) return
  await router.push(`/workspace/${project.id}/${project.defaultDocumentId}`)
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
  void projectStore.loadProjects()
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

.section-title h1 {
  margin: 0;
  font-size: 22px;
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

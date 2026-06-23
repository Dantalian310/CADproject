<template>
  <el-dialog v-model="visible" title="项目成员" width="760px" @open="load">
    <div class="member-add">
      <el-input v-model="account" placeholder="用户名或邮箱" :disabled="!canManage" clearable />
      <el-select v-model="role" :disabled="!canManage">
        <el-option label="EDITOR" value="EDITOR" />
        <el-option label="VIEWER" value="VIEWER" />
      </el-select>
      <el-button type="primary" :disabled="!canManage || !projectId || !account.trim()" @click="invite">
        发送邀请
      </el-button>
    </div>

    <el-alert
      v-if="canManage"
      class="member-tip"
      title="被邀请用户接受后才会成为项目成员。"
      type="info"
      :closable="false"
      show-icon
    />

    <el-table :data="projectStore.members">
      <el-table-column prop="user.username" label="用户" />
      <el-table-column prop="user.email" label="邮箱" />
      <el-table-column prop="role" label="角色" width="120" />
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button link type="danger" :disabled="!canManage || row.role === 'OWNER'" @click="remove(row.id)">
            移除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <template v-if="canManage">
      <h3 class="member-section-title">待处理邀请</h3>
      <el-table :data="pendingInvitations" empty-text="暂无待处理邀请">
        <el-table-column prop="invitee.username" label="被邀请用户" />
        <el-table-column prop="invitee.email" label="邮箱" />
        <el-table-column prop="role" label="角色" width="120" />
        <el-table-column prop="createdAt" label="发送时间" width="180" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="danger" @click="cancel(row.id)">取消邀请</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/project.store'

const props = defineProps<{
  modelValue: boolean
  projectId: number | null
  canManage: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const projectStore = useProjectStore()
const account = ref('')
const role = ref<'EDITOR' | 'VIEWER'>('EDITOR')
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
const pendingInvitations = computed(() => projectStore.invitations.filter((item) => item.status === 'PENDING'))

function load() {
  if (props.projectId) {
    void projectStore.loadMembers(props.projectId)
    if (props.canManage) {
      void projectStore.loadProjectInvitations(props.projectId)
    }
  }
}

async function invite() {
  if (!props.projectId || !account.value.trim()) return
  await projectStore.inviteMember(props.projectId, { account: account.value.trim(), role: role.value })
  account.value = ''
  ElMessage.success('邀请已发送，等待对方同意')
}

async function remove(memberId: number) {
  if (!props.projectId) return
  await projectStore.removeMember(props.projectId, memberId)
}

async function cancel(invitationId: number) {
  if (!props.projectId) return
  await projectStore.cancelInvitation(props.projectId, invitationId)
  ElMessage.success('邀请已取消')
}
</script>

<style scoped>
.member-add {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px 104px;
  gap: 8px;
  margin-bottom: 16px;
}

.member-tip {
  margin-bottom: 12px;
}

.member-section-title {
  margin: 20px 0 10px;
  font-size: 14px;
}
</style>

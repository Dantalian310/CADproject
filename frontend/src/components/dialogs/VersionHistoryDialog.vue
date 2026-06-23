<template>
  <el-dialog v-model="visible" title="版本历史" width="760px" @open="load">
    <el-table :data="versions" v-loading="loading">
      <el-table-column prop="versionNumber" label="版本" width="90" />
      <el-table-column prop="createdBy.username" label="保存人" width="140" />
      <el-table-column prop="createdAt" label="保存时间" />
      <el-table-column prop="message" label="备注" />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button link type="primary" @click="restore(row.id)">恢复</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { listVersions, restoreVersion } from '@/api/version.api'
import type { VersionDTO } from '@/api/types'
import { useCadStore } from '@/stores/cad.store'

const props = defineProps<{ modelValue: boolean; documentId: number }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const cadStore = useCadStore()
const versions = ref<VersionDTO[]>([])
const loading = ref(false)
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

async function load() {
  if (!props.documentId) return
  loading.value = true
  try {
    versions.value = await listVersions(props.documentId)
  } finally {
    loading.value = false
  }
}

async function restore(versionId: number) {
  await ElMessageBox.confirm('恢复历史版本会创建一个新版本，是否继续？', '恢复版本')
  const document = await restoreVersion(props.documentId, versionId, { message: `restore ${versionId}` })
  cadStore.document = document.snapshotJson
  cadStore.currentVersion = document.currentVersion
  visible.value = false
}
</script>

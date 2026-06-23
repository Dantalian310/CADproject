<template>
  <el-dialog v-model="visible" title="编辑项目" width="420px">
    <el-form label-position="top" @submit.prevent>
      <el-form-item label="项目名称">
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="项目描述">
        <el-input v-model="form.description" type="textarea" :rows="3" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="loading" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { ProjectDTO } from '@/api/types'
import { useProjectStore } from '@/stores/project.store'

const props = defineProps<{ modelValue: boolean; project: ProjectDTO | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; updated: [] }>()
const projectStore = useProjectStore()
const loading = ref(false)
const form = reactive({ name: '', description: '' })
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

watch(
  () => props.project,
  (project) => {
    form.name = project?.name ?? ''
    form.description = project?.description ?? ''
  },
  { immediate: true }
)

async function submit() {
  if (!props.project) return
  if (!form.name.trim()) {
    ElMessage.warning('请输入项目名称')
    return
  }
  loading.value = true
  try {
    await projectStore.updateProject(props.project.id, {
      name: form.name.trim(),
      description: form.description.trim()
    })
    visible.value = false
    emit('updated')
    ElMessage.success('项目已更新')
  } finally {
    loading.value = false
  }
}
</script>

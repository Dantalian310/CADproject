<template>
  <el-dialog v-model="visible" title="新建项目" width="420px">
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
      <el-button type="primary" :loading="loading" @click="submit">创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/project.store'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; created: [] }>()
const projectStore = useProjectStore()
const loading = ref(false)
const form = reactive({ name: '', description: '' })
const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

async function submit() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入项目名称')
    return
  }
  loading.value = true
  try {
    await projectStore.createProject({ name: form.name, description: form.description })
    visible.value = false
    form.name = ''
    form.description = ''
    emit('created')
  } finally {
    loading.value = false
  }
}
</script>

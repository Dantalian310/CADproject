<template>
  <main class="auth-page">
    <section class="auth-panel">
      <h1>Cloud CAD 协同机械设计</h1>
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="用户名">
          <el-input v-model="form.username" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" autocomplete="current-password" />
        </el-form-item>
        <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
        <el-button class="auth-submit" type="primary" :loading="authStore.loading" @click="submit">
          登录
        </el-button>
        <el-button link @click="router.push('/register')">没有账号？注册</el-button>
      </el-form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const router = useRouter()
const authStore = useAuthStore()
const error = ref('')
const form = reactive({
  username: '',
  password: ''
})

async function submit() {
  error.value = ''
  try {
    await authStore.login(form)
    await router.push('/projects')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '登录失败'
  }
}
</script>

<style scoped>
.auth-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  background: #eef2f7;
}

.auth-panel {
  width: 360px;
  padding: 28px;
  border: 1px solid #d8dee9;
  border-radius: 8px;
  background: #fff;
}

.auth-panel h1 {
  margin: 0 0 24px;
  font-size: 22px;
}

.auth-submit {
  width: 100%;
  margin: 16px 0 8px;
}
</style>

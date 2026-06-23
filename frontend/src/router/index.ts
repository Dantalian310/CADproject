import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '@/pages/LoginPage.vue'
import RegisterPage from '@/pages/RegisterPage.vue'
import ProjectListPage from '@/pages/ProjectListPage.vue'
import WorkspacePage from '@/pages/WorkspacePage.vue'
import { setupRouterGuards } from './guards'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/projects' },
    { path: '/login', component: LoginPage },
    { path: '/register', component: RegisterPage },
    { path: '/projects', component: ProjectListPage, meta: { requiresAuth: true } },
    {
      path: '/workspace/:projectId/:documentId',
      component: WorkspacePage,
      meta: { requiresAuth: true }
    }
  ]
})

setupRouterGuards(router)

export default router

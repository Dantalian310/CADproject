import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

export function setupRouterGuards(router: Router) {
  router.beforeEach(async (to) => {
    if (!to.meta.requiresAuth) {
      return true
    }

    const authStore = useAuthStore()
    if (!authStore.token) {
      return '/login'
    }

    if (!authStore.currentUser) {
      try {
        await authStore.loadCurrentUser()
      } catch {
        authStore.logout()
        return '/login'
      }
    }

    return true
  })
}

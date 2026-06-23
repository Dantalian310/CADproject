import { defineStore } from 'pinia'
import { getCurrentUser, login as loginApi, register as registerApi } from '@/api/auth.api'
import type { UserDTO } from '@/api/types'
import type { LoginRequest, RegisterRequest } from '@/api/auth.api'

interface AuthState {
  token: string | null
  currentUser: UserDTO | null
  loading: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: localStorage.getItem('cloudcad.token'),
    currentUser: null,
    loading: false
  }),
  actions: {
    async login(request: LoginRequest) {
      this.loading = true
      try {
        const response = await loginApi(request)
        this.token = response.token
        this.currentUser = response.user
        localStorage.setItem('cloudcad.token', response.token)
      } finally {
        this.loading = false
      }
    },
    async register(request: RegisterRequest) {
      this.loading = true
      try {
        const response = await registerApi(request)
        this.token = response.token
        this.currentUser = response.user
        localStorage.setItem('cloudcad.token', response.token)
      } finally {
        this.loading = false
      }
    },
    async loadCurrentUser() {
      this.currentUser = await getCurrentUser()
    },
    logout() {
      this.token = null
      this.currentUser = null
      localStorage.removeItem('cloudcad.token')
    }
  }
})

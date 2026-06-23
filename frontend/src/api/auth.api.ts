import { http, unwrap } from './http'
import type { AuthResponse, UserDTO } from './types'

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface LoginRequest {
  username: string
  password: string
}

export function register(request: RegisterRequest): Promise<AuthResponse> {
  return unwrap(http.post('/api/auth/register', request))
}

export function login(request: LoginRequest): Promise<AuthResponse> {
  return unwrap(http.post('/api/auth/login', request))
}

export function getCurrentUser(): Promise<UserDTO> {
  return unwrap(http.get('/api/auth/me'))
}

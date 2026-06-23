import type { CadOperation } from '@/cad/model/operation'

export interface OnlineUser {
  id: number
  username: string
  displayName?: string
  role: 'OWNER' | 'EDITOR' | 'VIEWER'
  color: string
}

export interface RemoteCursor {
  userId: string
  username: string
  x: number
  y: number
  color: string
  updatedAt: string
}

export interface SystemMessage {
  type: string
  payload?: Record<string, string | number | boolean>
}

export interface DocumentMessageHandlers {
  onPresence(users: OnlineUser[]): void
  onCursor(cursor: RemoteCursor): void
  onOperation(operation: CadOperation): void
  onSystem(message: SystemMessage): void
}

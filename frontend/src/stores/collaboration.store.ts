import { defineStore } from 'pinia'
import type { CadOperation } from '@/cad/model/operation'
import { applyRemoteOperation } from '@/collaboration/applyRemoteOperation'
import { CadStompClient } from '@/collaboration/stompClient'
import type { OnlineUser, RemoteCursor } from '@/collaboration/messageTypes'
import { useCadStore } from './cad.store'
import { useStatusStore } from './status.store'

interface CollaborationState {
  connected: boolean
  documentId: number | null
  onlineUsers: OnlineUser[]
  remoteCursors: Record<string, RemoteCursor>
  lastConflict: string | null
  client: CadStompClient | null
}

export const useCollaborationStore = defineStore('collaboration', {
  state: (): CollaborationState => ({
    connected: false,
    documentId: null,
    onlineUsers: [],
    remoteCursors: {},
    lastConflict: null,
    client: null
  }),
  actions: {
    async connect(documentId: number, token: string) {
      const statusStore = useStatusStore()
      statusStore.setWebsocketStatus('connecting')
      this.client = new CadStompClient()
      await this.client.connect(token)
      this.connected = true
      this.documentId = documentId
      statusStore.setWebsocketStatus('connected')
      this.client.subscribeDocument(documentId, {
        onPresence: (users) => {
          this.onlineUsers = dedupeOnlineUsers(users)
        },
        onCursor: (cursor) => {
          this.remoteCursors[cursor.userId] = cursor
        },
        onOperation: (operation) => {
          const cadStore = useCadStore()
          if (cadStore.document) {
            cadStore.document = applyRemoteOperation(cadStore.document, operation)
            cadStore.markDirty()
          }
          statusStore.clearError()
        },
        onSystem: (message) => {
          if (message.type === 'conflict.warning') {
            const reason = message.payload?.reason
            this.lastConflict = typeof reason === 'string' ? reason : '检测到协同冲突'
            statusStore.reportError(this.lastConflict)
          }
        }
      })
      this.client.joinDocument(documentId)
    },
    disconnect() {
      if (this.documentId) {
        this.client?.leaveDocument(this.documentId)
      }
      this.client?.disconnect()
      this.connected = false
      this.documentId = null
      this.onlineUsers = []
      this.remoteCursors = {}
      this.client = null
      useStatusStore().setWebsocketStatus('disconnected')
    },
    sendOperation(operation: CadOperation) {
      if (!this.documentId) return
      this.client?.sendOperation(this.documentId, operation)
    },
    sendCursor(x: number, y: number) {
      if (!this.documentId) return
      this.client?.sendCursor(this.documentId, { x, y })
    }
  }
})

function dedupeOnlineUsers(users: OnlineUser[]): OnlineUser[] {
  const unique = new Map<string | number, OnlineUser>()
  for (const user of users) {
    unique.set(user.id, user)
  }
  return [...unique.values()]
}

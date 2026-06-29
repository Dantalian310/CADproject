import { defineStore } from 'pinia'
import type { CadDocument } from '@/cad/model/document'
import type { CadOperation } from '@/cad/model/operation'
import type { CadSelection } from '@/cad/model/selection'
import { applyRemoteOperation } from '@/collaboration/applyRemoteOperation'
import { CadStompClient } from '@/collaboration/stompClient'
import type { OnlineUser, RemoteCursor } from '@/collaboration/messageTypes'
import { useCadStore } from './cad.store'
import { useStatusStore } from './status.store'

interface CollaborationState {
  connected: boolean
  documentId: number | null
  clientId: string
  collaborationRevision: number
  sentOperationIds: Record<string, true>
  onlineUsers: OnlineUser[]
  remoteCursors: Record<string, RemoteCursor>
  lastConflict: string | null
  client: CadStompClient | null
}

export const useCollaborationStore = defineStore('collaboration', {
  state: (): CollaborationState => ({
    connected: false,
    documentId: null,
    clientId: createClientId(),
    collaborationRevision: 0,
    sentOperationIds: {},
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
      this.collaborationRevision = 0
      this.sentOperationIds = {}
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
          this.applyServerRevision(operation)
          if (this.isOwnOperation(operation)) {
            delete this.sentOperationIds[operation.operationId]
            return
          }
          if (!cadStore.document) return
          const realtimeSnapshot = operation.payload?.documentSnapshot
          const impactsSelection = isSelectionImpacted(cadStore.selection, operation.targetId)
          if (isCadDocument(realtimeSnapshot)) {
            cadStore.applyRealtimeSnapshot(realtimeSnapshot)
          } else {
            cadStore.document = applyRemoteOperation(cadStore.document, operation)
            cadStore.markDirty()
          }
          if (impactsSelection) {
            this.lastConflict = '其他成员刚刚修改了你当前选中的对象，系统已同步最新模型'
            statusStore.reportWarning(this.lastConflict, 7000)
          }
        },
        onSystem: (message) => {
          if (message.type === 'conflict.warning') {
            const clientId = message.payload?.clientId
            if (typeof clientId === 'string' && clientId && clientId !== this.clientId) return
            const reason = message.payload?.reason
            this.lastConflict = typeof reason === 'string' ? reason : '检测到协同冲突'
            const serverRevision = message.payload?.serverRevision
            if (typeof serverRevision === 'number') {
              this.collaborationRevision = Math.max(this.collaborationRevision, serverRevision)
            }
            statusStore.reportWarning(this.lastConflict, 7000)
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
      this.collaborationRevision = 0
      this.sentOperationIds = {}
      this.onlineUsers = []
      this.remoteCursors = {}
      this.client = null
      useStatusStore().setWebsocketStatus('disconnected')
    },
    sendOperation(operation: CadOperation) {
      if (!this.documentId) return
      if (!this.client || !this.connected) return
      const enrichedOperation: CadOperation = {
        ...operation,
        clientId: this.clientId,
        clientRevision: this.collaborationRevision
      }
      this.sentOperationIds[enrichedOperation.operationId] = true
      try {
        this.client.sendOperation(this.documentId, enrichedOperation)
      } catch (error) {
        delete this.sentOperationIds[enrichedOperation.operationId]
        throw error
      }
    },
    sendCursor(x: number, y: number) {
      if (!this.documentId) return
      this.client?.sendCursor(this.documentId, { x, y })
    },
    applyServerRevision(operation: CadOperation) {
      if (typeof operation.serverRevision === 'number') {
        this.collaborationRevision = Math.max(this.collaborationRevision, operation.serverRevision)
      }
    },
    isOwnOperation(operation: CadOperation): boolean {
      return operation.clientId === this.clientId || Boolean(this.sentOperationIds[operation.operationId])
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

function createClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isCadDocument(value: unknown): value is CadDocument {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CadDocument>
  return candidate.schemaVersion === '1.0' && Array.isArray(candidate.sketches) && Array.isArray(candidate.features)
}

function isSelectionImpacted(selection: CadSelection | null, targetId: string): boolean {
  if (!selection || !targetId || targetId === 'document') return false
  if (selection.kind === 'sketch-entity') return selection.entityId === targetId || selection.sketchId === targetId
  if (selection.kind === 'sketch-entities') {
    return selection.entities.some((item) => item.entityId === targetId || item.sketchId === targetId)
  }
  if (selection.kind === 'feature') return selection.featureId === targetId
  if (selection.kind === 'features') return selection.featureIds.includes(targetId)
  if (selection.kind === 'sketch') return selection.sketchId === targetId
  return selection.documentId === targetId
}

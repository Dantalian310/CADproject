import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import type { CadOperation } from '@/cad/model/operation'
import type { DocumentMessageHandlers, OnlineUser, RemoteCursor, SystemMessage } from './messageTypes'

interface WireMessage {
  type?: string
  payload?: Record<string, unknown>
  [key: string]: unknown
}

export class CadStompClient {
  private client: Client | null = null
  private subscriptions: StompSubscription[] = []

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client = new Client({
        brokerURL: resolveWebSocketUrl(),
        connectHeaders: {
          Authorization: `Bearer ${token}`
        },
        reconnectDelay: 5000,
        onConnect: () => resolve(),
        onStompError: (frame) => reject(new Error(frame.headers.message ?? 'WebSocket 连接失败')),
        onWebSocketError: () => reject(new Error('WebSocket 连接失败'))
      })
      this.client.activate()
    })
  }

  disconnect(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe())
    this.subscriptions = []
    void this.client?.deactivate()
  }

  subscribeDocument(documentId: number, handlers: DocumentMessageHandlers): void {
    this.ensureClient()
    this.subscriptions.push(
      this.client!.subscribe(`/topic/documents/${documentId}/presence`, (message) => {
        const body = this.parse(message)
        handlers.onPresence((body.payload?.onlineUsers ?? []) as OnlineUser[])
      }),
      this.client!.subscribe(`/topic/documents/${documentId}/cursor`, (message) => {
        const body = this.parse(message)
        handlers.onCursor(body.payload as unknown as RemoteCursor)
      }),
      this.client!.subscribe(`/topic/documents/${documentId}/operations`, (message) => {
        const body = this.parse(message)
        handlers.onOperation(body.payload as unknown as CadOperation)
      }),
      this.client!.subscribe(`/topic/documents/${documentId}/system`, (message) => {
        handlers.onSystem(this.parse(message) as SystemMessage)
      })
    )
  }

  joinDocument(documentId: number): void {
    this.send(`/app/documents/${documentId}/join`, {})
  }

  leaveDocument(documentId: number): void {
    this.send(`/app/documents/${documentId}/leave`, {})
  }

  sendCursor(documentId: number, cursor: { x: number; y: number }): void {
    this.send(`/app/documents/${documentId}/cursor`, cursor)
  }

  sendOperation(documentId: number, operation: CadOperation): void {
    this.send(`/app/documents/${documentId}/operations`, operation)
  }

  private send(destination: string, body: unknown): void {
    this.ensureClient()
    this.client!.publish({ destination, body: JSON.stringify(body) })
  }

  private parse(message: IMessage): WireMessage {
    return JSON.parse(message.body || '{}')
  }

  private ensureClient(): void {
    if (!this.client) {
      throw new Error('STOMP client has not been connected')
    }
  }
}

function resolveWebSocketUrl(): string {
  const configuredUrl = import.meta.env.VITE_WS_URL
  if (configuredUrl) return configuredUrl
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}

import { defineStore } from 'pinia'

export type ApiStatus = 'unknown' | 'ok' | 'error'
export type WebsocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'failed'

export const useStatusStore = defineStore('status', {
  state: () => ({
    apiStatus: 'unknown' as ApiStatus,
    websocketStatus: 'disconnected' as WebsocketStatus,
    saveStatus: 'saved' as SaveStatus,
    lastError: null as string | null
  }),
  actions: {
    setApiStatus(status: ApiStatus) {
      this.apiStatus = status
    },
    setWebsocketStatus(status: WebsocketStatus) {
      this.websocketStatus = status
    },
    setSaveStatus(status: SaveStatus) {
      this.saveStatus = status
    },
    reportError(message: string) {
      this.lastError = message
    },
    clearError() {
      this.lastError = null
    }
  }
})

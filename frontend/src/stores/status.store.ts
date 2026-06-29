import { defineStore } from 'pinia'

export type ApiStatus = 'unknown' | 'ok' | 'error'
export type WebsocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'failed'
export type StatusMessageKind = 'error' | 'warning' | 'info'

export const useStatusStore = defineStore('status', {
  state: () => ({
    apiStatus: 'unknown' as ApiStatus,
    websocketStatus: 'disconnected' as WebsocketStatus,
    saveStatus: 'saved' as SaveStatus,
    lastError: null as string | null,
    lastErrorKind: 'error' as StatusMessageKind,
    clearTimer: null as number | null
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
    reportError(message: string, autoClearMs?: number) {
      this.setMessage(message, 'error', autoClearMs)
    },
    reportWarning(message: string, autoClearMs = 7000) {
      this.setMessage(message, 'warning', autoClearMs)
    },
    reportInfo(message: string, autoClearMs = 5000) {
      this.setMessage(message, 'info', autoClearMs)
    },
    setMessage(message: string, kind: StatusMessageKind, autoClearMs?: number) {
      this.cancelClearTimer()
      this.lastError = message
      this.lastErrorKind = kind
      if (autoClearMs && autoClearMs > 0) {
        this.clearTimer = window.setTimeout(() => {
          this.clearError()
        }, autoClearMs)
      }
    },
    clearError() {
      this.cancelClearTimer()
      this.lastError = null
      this.lastErrorKind = 'error'
    },
    cancelClearTimer() {
      if (this.clearTimer !== null) {
        window.clearTimeout(this.clearTimer)
        this.clearTimer = null
      }
    }
  }
})

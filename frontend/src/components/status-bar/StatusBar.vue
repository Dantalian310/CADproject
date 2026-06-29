<template>
  <footer class="status-bar">
    <span>API: {{ statusStore.apiStatus }}</span>
    <span>WebSocket: {{ statusStore.websocketStatus }}</span>
    <span>保存: {{ statusStore.saveStatus }}</span>
    <span>在线: {{ collaborationStore.onlineUsers.length }}</span>
    <span>工具: {{ cadStore.activeTool }}</span>
    <span>版本: v{{ cadStore.currentVersion }}</span>
    <span
      v-if="statusStore.lastError"
      class="status-message"
      :class="`status-${statusStore.lastErrorKind}`"
    >
      {{ statusStore.lastError }}
      <button class="status-dismiss" type="button" title="关闭提示" @click="statusStore.clearError()">关闭</button>
    </span>
  </footer>
</template>

<script setup lang="ts">
import { useCadStore } from '@/stores/cad.store'
import { useCollaborationStore } from '@/stores/collaboration.store'
import { useStatusStore } from '@/stores/status.store'

const cadStore = useCadStore()
const collaborationStore = useCollaborationStore()
const statusStore = useStatusStore()
</script>

<style scoped>
.status-message {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: min(520px, 42vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-error {
  color: #dc2626;
}

.status-warning {
  color: #b45309;
}

.status-info {
  color: #2563eb;
}

.status-dismiss {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 0 2px;
  text-decoration: underline;
}
</style>

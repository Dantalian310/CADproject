<template>
  <footer class="status-bar">
    <span>API: {{ statusStore.apiStatus }}</span>
    <span>WebSocket: {{ statusStore.websocketStatus }}</span>
    <span>保存: {{ statusStore.saveStatus }}</span>
    <span>在线: {{ collaborationStore.onlineUsers.length }}</span>
    <span>工具: {{ cadStore.activeTool }}</span>
    <span>版本: v{{ cadStore.currentVersion }}</span>
    <span v-if="statusStore.lastError" class="status-error">{{ statusStore.lastError }}</span>
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
.status-error {
  color: #dc2626;
}
</style>

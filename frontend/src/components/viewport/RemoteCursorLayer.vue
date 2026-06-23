<template>
  <div class="remote-cursor-layer">
    <span
      v-for="cursor in cursors"
      :key="cursor.userId"
      class="remote-cursor"
      :style="{ left: `${cursor.x}px`, top: `${cursor.y}px`, borderColor: cursor.color }"
    >
      {{ cursor.username }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCollaborationStore } from '@/stores/collaboration.store'

const collaborationStore = useCollaborationStore()
const cursors = computed(() => Object.values(collaborationStore.remoteCursors))
</script>

<style scoped>
.remote-cursor-layer {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 3;
}

.remote-cursor {
  position: absolute;
  padding: 2px 6px;
  border-left: 3px solid;
  background: rgb(255 255 255 / 90%);
  color: #1f2937;
  font-size: 12px;
}
</style>

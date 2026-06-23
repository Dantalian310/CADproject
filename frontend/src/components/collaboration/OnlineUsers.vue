<template>
  <section class="online-users">
    <h2>在线用户</h2>
    <el-empty v-if="collaborationStore.onlineUsers.length === 0" description="暂无在线用户" />
    <div v-else class="user-list">
      <el-tag v-for="user in collaborationStore.onlineUsers" :key="user.id" effect="plain">
        {{ user.displayName || user.username }} · {{ user.role }}
      </el-tag>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useCollaborationStore } from '@/stores/collaboration.store'

const collaborationStore = useCollaborationStore()
</script>

<style scoped>
.online-users {
  padding: 12px;
  border-top: 1px solid #e5e7eb;
}

.online-users h2 {
  margin: 0 0 12px;
  font-size: 15px;
}

.user-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>

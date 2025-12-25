<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import Tag from 'primevue/tag'
import websocketService from '../services/websocketService'

// Props
defineProps<{
  showLabel?: boolean
}>()

// State
const connectionStatus = ref<'connected' | 'disconnected' | 'reconnecting'>('disconnected')
const isConnected = ref(false)

// Unsubscribe function
let unsubscribe: (() => void) | null = null

onMounted(() => {
  // Subscribe to connection changes
  unsubscribe = websocketService.onConnectionChange((status) => {
    connectionStatus.value = status
    isConnected.value = status === 'connected'
  })

  // Check current status
  isConnected.value = websocketService.isConnected()
  connectionStatus.value = isConnected.value ? 'connected' : 'disconnected'
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})

// Computed severity for Tag
const getSeverity = () => {
  switch (connectionStatus.value) {
    case 'connected':
      return 'success'
    case 'reconnecting':
      return 'warn'
    case 'disconnected':
    default:
      return 'danger'
  }
}

const getLabel = () => {
  switch (connectionStatus.value) {
    case 'connected':
      return 'Live'
    case 'reconnecting':
      return 'Reconnecting...'
    case 'disconnected':
    default:
      return 'No Live Feed'
  }
}

const getIcon = () => {
  switch (connectionStatus.value) {
    case 'connected':
      return 'pi pi-wifi'
    case 'reconnecting':
      return 'pi pi-spin pi-spinner'
    case 'disconnected':
    default:
      return 'pi pi-times-circle'
  }
}
</script>

<template>
  <div class="realtime-status-indicator">
    <Tag
      :severity="getSeverity()"
      :value="showLabel !== false ? getLabel() : ''"
      :icon="getIcon()"
      class="realtime-tag"
    />
    <span v-if="connectionStatus === 'connected'" class="pulse-dot"></span>
  </div>
</template>

<style scoped>
.realtime-status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.realtime-tag {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background-color: #22c55e;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
}
</style>

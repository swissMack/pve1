<script setup lang="ts">
defineProps<{
  message: string
  code?: string
}>()

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div class="error-retry surface-card p-4 border-round border-1 border-red-300">
    <div class="flex align-items-center gap-3">
      <i class="pi pi-exclamation-circle text-red-500 text-2xl"></i>
      <div class="flex-1">
        <div class="font-semibold text-red-700">Error</div>
        <div class="text-sm text-600">{{ message }}</div>
        <div v-if="code" class="text-xs text-400 mt-1">Code: {{ code }}</div>
      </div>
      <Button
        label="Retry"
        icon="pi pi-refresh"
        severity="secondary"
        size="small"
        @click="emit('retry')"
      />
    </div>
  </div>
</template>

<script lang="ts">
import Button from 'primevue/button'

export default {
  components: { Button }
}
</script>

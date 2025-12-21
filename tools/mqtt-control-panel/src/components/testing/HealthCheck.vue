<script setup>
import { ref } from 'vue'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import { testingService } from '../../services/testingService.js'

const loading = ref(false)
const result = ref(null)
const error = ref(null)

const checkHealth = async () => {
  loading.value = true
  error.value = null
  result.value = null

  try {
    result.value = await testingService.healthCheck()
  } catch (err) {
    error.value = err.displayMessage || 'Health check failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Card class="health-check">
    <template #title>
      <div class="flex align-items-center gap-2">
        <i class="pi pi-heart-fill text-primary"></i>
        Health Check
      </div>
    </template>
    <template #content>
      <p class="text-600 mb-4">
        Test the API server connectivity and health status.
      </p>

      <Button
        label="Run Health Check"
        icon="pi pi-play"
        @click="checkHealth"
        :loading="loading"
      />

      <div v-if="result" class="mt-4 p-3 surface-100 border-round">
        <div class="flex align-items-center gap-2 mb-2">
          <Tag :value="result.status" :severity="result.status === 'healthy' ? 'success' : 'danger'" />
          <span class="text-600 text-sm">{{ result.timestamp }}</span>
        </div>
        <pre class="m-0 text-sm font-mono surface-card p-2 border-round">{{ JSON.stringify(result, null, 2) }}</pre>
      </div>

      <div v-if="error" class="mt-4 p-3 border-1 border-red-300 border-round bg-red-50">
        <div class="flex align-items-center gap-2">
          <i class="pi pi-times-circle text-red-500"></i>
          <span class="text-red-700">{{ error }}</span>
        </div>
      </div>
    </template>
  </Card>
</template>

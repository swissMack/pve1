<script setup>
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Dropdown from 'primevue/dropdown'
import Tag from 'primevue/tag'
import { testingService } from '../../services/testingService.js'

const testOptions = [
  { label: 'SIM Lookup by ICCID', value: 'sim-lookup' }
]

const selectedTest = ref('sim-lookup')
const iccidInput = ref('')
const loading = ref(false)
const result = ref(null)
const error = ref(null)

const canRun = computed(() => {
  if (selectedTest.value === 'sim-lookup') {
    return iccidInput.value.length >= 10
  }
  return true
})

const runTest = async () => {
  loading.value = true
  error.value = null
  result.value = null

  try {
    if (selectedTest.value === 'sim-lookup') {
      const sim = await testingService.lookupSim(iccidInput.value)
      if (sim) {
        result.value = sim
      } else {
        error.value = {
          message: 'No SIM found with the specified ICCID',
          code: 'NOT_FOUND'
        }
      }
    }
  } catch (err) {
    error.value = {
      message: err.displayMessage || 'API request failed',
      code: err.errorCode
    }
  } finally {
    loading.value = false
  }
}

const clearResults = () => {
  result.value = null
  error.value = null
}
</script>

<template>
  <Card class="api-console">
    <template #title>
      <div class="flex align-items-center gap-2">
        <i class="pi pi-code text-primary"></i>
        API Test Console
      </div>
    </template>
    <template #content>
      <p class="text-600 mb-4">
        Test API endpoints with sample data.
      </p>

      <div class="flex gap-3 mb-4 align-items-end">
        <div class="field flex-1">
          <label for="test-type" class="block text-900 font-medium mb-2">Test Type</label>
          <Dropdown
            v-model="selectedTest"
            :options="testOptions"
            optionLabel="label"
            optionValue="value"
            class="w-full"
            id="test-type"
            @change="clearResults"
          />
        </div>

        <div v-if="selectedTest === 'sim-lookup'" class="field flex-1">
          <label for="iccid" class="block text-900 font-medium mb-2">ICCID</label>
          <InputText
            v-model="iccidInput"
            id="iccid"
            placeholder="Enter ICCID..."
            class="w-full font-mono"
          />
        </div>

        <Button
          label="Run Test"
          icon="pi pi-play"
          @click="runTest"
          :loading="loading"
          :disabled="!canRun"
        />
      </div>

      <div v-if="result" class="mt-4">
        <div class="flex align-items-center gap-2 mb-2">
          <Tag value="Success" severity="success" />
          <span class="text-600 text-sm">Response received</span>
        </div>
        <pre class="m-0 text-sm font-mono surface-card p-3 border-round border-1 surface-border overflow-auto" style="max-height: 400px">{{ JSON.stringify(result, null, 2) }}</pre>
      </div>

      <div v-if="error" class="mt-4">
        <div class="flex align-items-center gap-2 mb-2">
          <Tag value="Error" severity="danger" />
          <span v-if="error.code" class="text-600 text-sm font-mono">{{ error.code }}</span>
        </div>
        <div class="p-3 border-1 border-red-300 border-round bg-red-50">
          <div class="text-red-700 mb-2">{{ error.message }}</div>
          <div class="text-sm text-600">
            <strong>Troubleshooting:</strong>
            <ul class="mt-2 pl-4">
              <li v-if="error.code === 'NOT_FOUND'">Verify the ICCID exists in the system</li>
              <li v-else>Check that the API server is running at http://192.168.1.59:3001</li>
              <li>Verify your API key is valid</li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

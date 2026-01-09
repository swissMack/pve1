<script setup>
import { ref, computed, watch } from 'vue'
import Card from 'primevue/card'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import Chips from 'primevue/chips'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { ANALYTICS_ENDPOINTS } from '../../services/analyticsService.js'

const props = defineProps({
  config: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  response: { type: Object, default: null }
})

const emit = defineEmits(['execute-query', 'clear-response'])

// Local state
const selectedEndpoint = ref(null)
const queryParams = ref({
  tenant: '',
  customer: '',
  imsi: [],
  mccmnc: [],
  period: '',
  periodEnd: ''
})

// Initialize params from config
watch(() => props.config, (newConfig) => {
  queryParams.value.tenant = newConfig.tenant || ''
  queryParams.value.customer = newConfig.customer || ''
}, { immediate: true })

// Get current endpoint definition
const currentEndpoint = computed(() => {
  return ANALYTICS_ENDPOINTS.find(e => e.key === selectedEndpoint.value)
})

// Check if param is required for current endpoint
const isRequired = (param) => {
  return currentEndpoint.value?.requiredParams?.includes(param) || false
}

// Check if param is available for current endpoint
const isAvailable = (param) => {
  if (!currentEndpoint.value) return false
  return currentEndpoint.value.requiredParams.includes(param) ||
         currentEndpoint.value.optionalParams?.includes(param)
}

// Check if form is valid
const canExecute = computed(() => {
  if (!currentEndpoint.value) return false

  // Check all required params are filled
  for (const param of currentEndpoint.value.requiredParams) {
    const value = queryParams.value[param]
    if (Array.isArray(value)) {
      if (value.length === 0) return false
    } else {
      if (!value) return false
    }
  }

  return true
})

const executeQuery = () => {
  if (!canExecute.value) return

  // Build params object with only available fields
  const params = {}
  const allParams = [...currentEndpoint.value.requiredParams, ...(currentEndpoint.value.optionalParams || [])]

  for (const param of allParams) {
    const value = queryParams.value[param]
    if (Array.isArray(value)) {
      if (value.length > 0) params[param] = value
    } else {
      if (value) params[param] = value
    }
  }

  emit('execute-query', selectedEndpoint.value, params)
}
</script>

<template>
  <Card class="analytics-query">
    <template #title>
      <div class="flex align-items-center gap-2">
        <i class="pi pi-search"></i>
        <span>Analytics Query</span>
        <span class="text-500 text-sm font-normal">(verify submitted data)</span>
      </div>
    </template>
    <template #content>
      <!-- Endpoint selector -->
      <div class="field mb-3">
        <label class="block text-500 mb-2">Endpoint</label>
        <Dropdown
          v-model="selectedEndpoint"
          :options="ANALYTICS_ENDPOINTS"
          optionLabel="label"
          optionValue="key"
          placeholder="Select an endpoint"
          class="w-full"
          @change="emit('clear-response')"
        />
      </div>

      <!-- Dynamic form based on endpoint -->
      <template v-if="currentEndpoint">
        <div class="grid">
          <!-- Tenant -->
          <div v-if="isAvailable('tenant')" class="col-12 md:col-6">
            <label class="block text-500 mb-2">
              Tenant <span v-if="isRequired('tenant')" class="text-red-500">*</span>
            </label>
            <InputText
              v-model="queryParams.tenant"
              placeholder="test-tenant"
              class="w-full"
            />
          </div>

          <!-- Customer -->
          <div v-if="isAvailable('customer')" class="col-12 md:col-6">
            <label class="block text-500 mb-2">
              Customer <span v-if="isRequired('customer')" class="text-red-500">*</span>
            </label>
            <InputText
              v-model="queryParams.customer"
              placeholder="test-customer"
              class="w-full"
            />
          </div>

          <!-- IMSI (multi-value) -->
          <div v-if="isAvailable('imsi')" class="col-12">
            <label class="block text-500 mb-2">
              IMSI <span v-if="isRequired('imsi')" class="text-red-500">*</span>
              <span class="text-400 text-sm ml-2">(press Enter to add)</span>
            </label>
            <Chips
              v-model="queryParams.imsi"
              placeholder="Enter IMSI values"
              class="w-full"
            />
          </div>

          <!-- MCCMNC (multi-value) -->
          <div v-if="isAvailable('mccmnc')" class="col-12">
            <label class="block text-500 mb-2">
              MCCMNC <span class="text-400 text-sm">(optional)</span>
            </label>
            <Chips
              v-model="queryParams.mccmnc"
              placeholder="Enter MCCMNC values"
              class="w-full"
            />
          </div>

          <!-- Period -->
          <div v-if="isAvailable('period')" class="col-12 md:col-6">
            <label class="block text-500 mb-2">
              Period <span v-if="isRequired('period')" class="text-red-500">*</span>
              <span class="text-400 text-sm ml-2">(yyyy, yyyy-MM, or yyyy-MM-dd)</span>
            </label>
            <InputText
              v-model="queryParams.period"
              placeholder="2025-01-09"
              class="w-full"
            />
          </div>

          <!-- Period End -->
          <div v-if="isAvailable('periodEnd')" class="col-12 md:col-6">
            <label class="block text-500 mb-2">
              Period End <span class="text-400 text-sm">(optional)</span>
            </label>
            <InputText
              v-model="queryParams.periodEnd"
              placeholder="2025-01-15"
              class="w-full"
            />
          </div>
        </div>

        <!-- Execute button -->
        <Button
          icon="pi pi-search"
          label="Execute Query"
          @click="executeQuery"
          :loading="loading"
          :disabled="!canExecute"
          class="w-full mt-3"
        />
      </template>

      <!-- Error message -->
      <Message v-if="error" severity="error" :closable="false" class="mt-3">
        {{ error }}
      </Message>

      <!-- Response display -->
      <div v-if="response" class="mt-3">
        <div class="flex align-items-center justify-content-between mb-2">
          <div class="flex align-items-center gap-2">
            <Tag value="200 OK" severity="success" />
            <span class="text-500 text-sm">{{ response.duration }}ms</span>
          </div>
          <Button
            icon="pi pi-copy"
            label="Copy"
            @click="navigator.clipboard.writeText(JSON.stringify(response.data, null, 2))"
            text
            size="small"
          />
        </div>
        <pre class="response-json p-3 border-round bg-surface-100 overflow-auto text-sm font-mono m-0">{{ JSON.stringify(response.data, null, 2) }}</pre>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.analytics-query :deep(.p-card-content) {
  padding-top: 0;
}

.response-json {
  max-height: 300px;
}
</style>

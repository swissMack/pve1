<script setup>
import { ref, computed, watch } from 'vue'
import Card from 'primevue/card'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Calendar from 'primevue/calendar'
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
  startDate: null,
  endDate: null,
  iccid: '',
  granularity: 'daily',
  limit: 100,
  offset: 0
})

// Granularity options for trends endpoint
const granularityOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' }
]

// Get current endpoint definition
const currentEndpoint = computed(() => {
  return ANALYTICS_ENDPOINTS.find(e => e.key === selectedEndpoint.value)
})

// Check if param is available for current endpoint
const isAvailable = (param) => {
  if (!currentEndpoint.value) return false
  return currentEndpoint.value.requiredParams?.includes(param) ||
         currentEndpoint.value.optionalParams?.includes(param)
}

// Format date to ISO string for API
const formatDateForApi = (date) => {
  if (!date) return null
  return date.toISOString().split('T')[0]
}

// Check if form is valid (all endpoints have optional params so always valid)
const canExecute = computed(() => {
  return currentEndpoint.value !== null
})

const executeQuery = () => {
  if (!canExecute.value) return

  // Build params object with only available fields
  const params = {}
  const allParams = [...(currentEndpoint.value.requiredParams || []), ...(currentEndpoint.value.optionalParams || [])]

  for (const param of allParams) {
    if (param === 'startDate' && queryParams.value.startDate) {
      params.startDate = formatDateForApi(queryParams.value.startDate)
    } else if (param === 'endDate' && queryParams.value.endDate) {
      params.endDate = formatDateForApi(queryParams.value.endDate)
    } else if (param === 'iccid' && queryParams.value.iccid) {
      params.iccid = queryParams.value.iccid
    } else if (param === 'granularity' && queryParams.value.granularity) {
      params.granularity = queryParams.value.granularity
    } else if (param === 'limit' && queryParams.value.limit) {
      params.limit = queryParams.value.limit
    } else if (param === 'offset' && queryParams.value.offset) {
      params.offset = queryParams.value.offset
    }
  }

  emit('execute-query', selectedEndpoint.value, params)
}

// Set default date range (last 7 days)
const setDefaultDateRange = () => {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)
  queryParams.value.startDate = start
  queryParams.value.endDate = end
}

// Initialize with default dates
setDefaultDateRange()
</script>

<template>
  <Card class="analytics-query">
    <template #title>
      <div class="flex align-items-center gap-2">
        <i class="pi pi-search"></i>
        <span>Consumption Analytics Query</span>
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
        >
          <template #option="{ option }">
            <div>
              <div class="font-medium">{{ option.label }}</div>
              <div class="text-sm text-500">{{ option.description }}</div>
            </div>
          </template>
        </Dropdown>
      </div>

      <!-- Endpoint info -->
      <Message v-if="currentEndpoint" severity="info" :closable="false" class="mb-3">
        <div class="text-sm">
          <strong>Path:</strong> {{ currentEndpoint.path }}
        </div>
      </Message>

      <!-- Dynamic form based on endpoint -->
      <template v-if="currentEndpoint">
        <div class="grid">
          <!-- Start Date -->
          <div v-if="isAvailable('startDate')" class="col-12 md:col-6">
            <label class="block text-500 mb-2">Start Date</label>
            <Calendar
              v-model="queryParams.startDate"
              dateFormat="yy-mm-dd"
              placeholder="Select start date"
              class="w-full"
              showIcon
            />
          </div>

          <!-- End Date -->
          <div v-if="isAvailable('endDate')" class="col-12 md:col-6">
            <label class="block text-500 mb-2">End Date</label>
            <Calendar
              v-model="queryParams.endDate"
              dateFormat="yy-mm-dd"
              placeholder="Select end date"
              class="w-full"
              showIcon
            />
          </div>

          <!-- ICCID filter -->
          <div v-if="isAvailable('iccid')" class="col-12">
            <label class="block text-500 mb-2">
              ICCID <span class="text-400 text-sm">(optional filter)</span>
            </label>
            <InputText
              v-model="queryParams.iccid"
              placeholder="Enter ICCID to filter"
              class="w-full"
            />
          </div>

          <!-- Granularity (for trends) -->
          <div v-if="isAvailable('granularity')" class="col-12 md:col-6">
            <label class="block text-500 mb-2">Granularity</label>
            <Dropdown
              v-model="queryParams.granularity"
              :options="granularityOptions"
              optionLabel="label"
              optionValue="value"
              class="w-full"
            />
          </div>

          <!-- Limit -->
          <div v-if="isAvailable('limit')" class="col-12 md:col-6">
            <label class="block text-500 mb-2">Limit</label>
            <InputNumber
              v-model="queryParams.limit"
              :min="1"
              :max="1000"
              class="w-full"
            />
          </div>

          <!-- Offset -->
          <div v-if="isAvailable('offset')" class="col-12 md:col-6">
            <label class="block text-500 mb-2">Offset</label>
            <InputNumber
              v-model="queryParams.offset"
              :min="0"
              class="w-full"
            />
          </div>
        </div>

        <!-- Execute button -->
        <div class="flex gap-2 mt-3">
          <Button
            icon="pi pi-search"
            label="Execute Query"
            @click="executeQuery"
            :loading="loading"
            :disabled="!canExecute"
            class="flex-1"
          />
          <Button
            icon="pi pi-calendar"
            label="Last 7 Days"
            @click="setDefaultDateRange"
            severity="secondary"
            outlined
          />
        </div>
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
            <span v-if="Array.isArray(response.data)" class="text-500 text-sm">
              ({{ response.data.length }} records)
            </span>
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
  max-height: 400px;
}
</style>

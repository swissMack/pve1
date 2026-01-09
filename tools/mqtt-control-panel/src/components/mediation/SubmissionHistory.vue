<script setup>
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

const props = defineProps({
  history: { type: Array, required: true }
})

const emit = defineEmits(['clear-history'])

const getStatusSeverity = (status) => {
  const map = {
    'ACCEPTED': 'success',
    'DUPLICATE': 'info',
    'PARTIAL': 'warning',
    'ERROR': 'danger'
  }
  return map[status] || 'secondary'
}

const formatTime = (date) => {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const expandedRows = defineModel('expandedRows', { default: () => [] })
</script>

<template>
  <Card class="submission-history">
    <template #title>
      <div class="flex align-items-center justify-content-between">
        <div class="flex align-items-center gap-2">
          <i class="pi pi-history"></i>
          <span>Submission History</span>
        </div>
        <Button
          v-if="history.length > 0"
          icon="pi pi-trash"
          label="Clear"
          @click="emit('clear-history')"
          text
          size="small"
        />
      </div>
    </template>
    <template #content>
      <DataTable
        v-model:expandedRows="expandedRows"
        :value="history"
        :paginator="history.length > 5"
        :rows="5"
        size="small"
        stripedRows
        dataKey="timestamp"
      >
        <template #empty>
          <div class="text-center text-500 p-3">
            No submissions yet. Generate records and send them to the portal.
          </div>
        </template>

        <Column expander style="width: 3rem" />

        <Column field="timestamp" header="Time" style="width: 15%">
          <template #body="{ data }">
            <span class="font-mono text-sm">{{ formatTime(data.timestamp) }}</span>
          </template>
        </Column>

        <Column field="type" header="Type" style="width: 15%">
          <template #body="{ data }">
            <Tag
              :value="data.type === 'single' ? 'Single' : 'Batch'"
              :severity="data.type === 'single' ? 'secondary' : 'info'"
            />
          </template>
        </Column>

        <Column field="recordCount" header="Records" style="width: 15%">
          <template #body="{ data }">
            <span class="font-bold">{{ data.recordCount }}</span>
            <span v-if="data.recordsProcessed !== undefined" class="text-500 text-sm">
              ({{ data.recordsProcessed }} ok)
            </span>
          </template>
        </Column>

        <Column field="status" header="Status" style="width: 20%">
          <template #body="{ data }">
            <Tag :value="data.status" :severity="getStatusSeverity(data.status)" />
            <span v-if="data.recordsFailed > 0" class="text-red-500 text-sm ml-2">
              {{ data.recordsFailed }} failed
            </span>
          </template>
        </Column>

        <Column header="Details" style="width: 32%">
          <template #body="{ data }">
            <span v-if="data.error" class="text-red-500 text-sm">{{ data.error }}</span>
            <span v-else-if="data.batchId" class="text-500 text-sm font-mono">{{ data.batchId }}</span>
            <span v-else class="text-500 text-sm">-</span>
          </template>
        </Column>

        <!-- Expanded row content -->
        <template #expansion="{ data }">
          <div class="p-3 bg-surface-100 border-round">
            <pre class="text-sm font-mono m-0 overflow-auto" style="max-height: 200px;">{{ JSON.stringify(data.response || data.error, null, 2) }}</pre>
          </div>
        </template>
      </DataTable>
    </template>
  </Card>
</template>

<style scoped>
.submission-history :deep(.p-card-content) {
  padding-top: 0;
}
</style>

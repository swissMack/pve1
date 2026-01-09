<script setup>
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Message from 'primevue/message'

const props = defineProps({
  records: { type: Array, required: true },
  submitting: { type: Boolean, default: false },
  error: { type: String, default: null }
})

const emit = defineEmits(['submit-single', 'submit-batch', 'clear-records'])

const truncateIccid = (iccid) => {
  if (!iccid) return ''
  if (iccid.length > 12) {
    return iccid.slice(0, 6) + '...' + iccid.slice(-4)
  }
  return iccid
}
</script>

<template>
  <Card class="submission-panel">
    <template #title>
      <div class="flex align-items-center justify-content-between">
        <div class="flex align-items-center gap-2">
          <i class="pi pi-list"></i>
          <span>Generated Records</span>
          <Tag v-if="records.length > 0" :value="records.length" severity="info" />
        </div>
        <Button
          v-if="records.length > 0"
          icon="pi pi-trash"
          label="Clear"
          @click="emit('clear-records')"
          text
          size="small"
        />
      </div>
    </template>
    <template #content>
      <!-- Error message -->
      <Message v-if="error" severity="error" :closable="false" class="mb-3">
        {{ error }}
      </Message>

      <!-- Records table -->
      <DataTable
        :value="records"
        :paginator="records.length > 5"
        :rows="5"
        :rowsPerPageOptions="[5, 10, 20]"
        class="mb-3"
        size="small"
        stripedRows
      >
        <template #empty>
          <div class="text-center text-500 p-4">
            No records generated yet. Configure settings and click "Generate Records".
          </div>
        </template>

        <Column field="iccid" header="ICCID" style="width: 20%">
          <template #body="{ data }">
            <span v-tooltip="data.iccid" class="font-mono text-sm">
              {{ truncateIccid(data.iccid) }}
            </span>
          </template>
        </Column>

        <Column field="usage.totalBytes" header="Total Bytes" style="width: 15%">
          <template #body="{ data }">
            <span class="font-mono">{{ data._formattedBytes }}</span>
          </template>
        </Column>

        <Column field="usage.dataUploadBytes" header="Upload" style="width: 15%">
          <template #body="{ data }">
            <span class="text-blue-500 font-mono text-sm">
              <i class="pi pi-arrow-up text-xs mr-1"></i>
              {{ Math.round(data.usage.dataUploadBytes / 1024 / 1024) }} MB
            </span>
          </template>
        </Column>

        <Column field="usage.dataDownloadBytes" header="Download" style="width: 15%">
          <template #body="{ data }">
            <span class="text-green-500 font-mono text-sm">
              <i class="pi pi-arrow-down text-xs mr-1"></i>
              {{ Math.round(data.usage.dataDownloadBytes / 1024 / 1024) }} MB
            </span>
          </template>
        </Column>

        <Column field="usage.smsCount" header="SMS" style="width: 10%">
          <template #body="{ data }">
            <Tag :value="data.usage.smsCount" severity="secondary" />
          </template>
        </Column>

        <Column field="periodStart" header="Period" style="width: 15%">
          <template #body="{ data }">
            <span class="text-sm">{{ data._periodDate }}</span>
          </template>
        </Column>

        <Column header="Actions" style="width: 10%">
          <template #body="{ data }">
            <Button
              icon="pi pi-send"
              @click="emit('submit-single', data)"
              :loading="submitting"
              text
              rounded
              size="small"
              v-tooltip="'Send single record'"
            />
          </template>
        </Column>
      </DataTable>

      <!-- Submit buttons -->
      <div class="flex gap-2">
        <Button
          icon="pi pi-send"
          label="Send Batch"
          @click="emit('submit-batch')"
          :loading="submitting"
          :disabled="records.length === 0"
          class="flex-1"
        />
      </div>
      <small v-if="records.length > 0" class="block text-500 mt-2 text-center">
        Batch will send {{ records.length }} record(s) to the portal
      </small>
    </template>
  </Card>
</template>

<style scoped>
.submission-panel :deep(.p-card-content) {
  padding-top: 0;
}

.submission-panel :deep(.p-datatable-tbody > tr > td) {
  padding: 0.5rem;
}
</style>

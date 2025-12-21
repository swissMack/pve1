<script setup>
import { computed } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'

const props = defineProps({
  invoices: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  statusFilter: { type: String, default: null },
  carrierFilter: { type: String, default: null },
  carriers: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:statusFilter', 'update:carrierFilter', 'reset-filters'])

const statusOptions = [
  { label: 'All Statuses', value: null },
  { label: 'Pending', value: 'pending' },
  { label: 'Paid', value: 'paid' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Disputed', value: 'disputed' }
]

const carrierOptions = computed(() => [
  { label: 'All Carriers', value: null },
  ...props.carriers.map(c => ({ label: c.name, value: c.id }))
])

const getStatusSeverity = (status) => {
  const severityMap = {
    pending: 'warning',
    paid: 'success',
    overdue: 'danger',
    disputed: 'info'
  }
  return severityMap[status] || 'secondary'
}

const formatCurrency = (amount, currency) => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: currency || 'CHF'
  }).format(amount)
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('de-CH')
}

const openPdf = (url) => {
  window.open(url, '_blank')
}
</script>

<template>
  <div class="invoice-list">
    <div class="flex gap-3 mb-4 align-items-center">
      <Dropdown
        :modelValue="statusFilter"
        @update:modelValue="emit('update:statusFilter', $event)"
        :options="statusOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="All Statuses"
        class="w-12rem"
        data-testid="status-filter"
      />
      <Dropdown
        :modelValue="carrierFilter"
        @update:modelValue="emit('update:carrierFilter', $event)"
        :options="carrierOptions"
        optionLabel="label"
        optionValue="value"
        placeholder="All Carriers"
        class="w-12rem"
        data-testid="carrier-filter"
      />
      <Button
        label="Reset"
        icon="pi pi-filter-slash"
        severity="secondary"
        size="small"
        @click="emit('reset-filters')"
        data-testid="reset-filters"
      />
    </div>

    <DataTable
      :value="invoices"
      :loading="loading"
      paginator
      :rows="10"
      :rowsPerPageOptions="[5, 10, 20]"
      tableStyle="min-width: 60rem"
      stripedRows
    >
      <Column field="invoiceNumber" header="Invoice #" sortable />
      <Column field="carrierName" header="Carrier" sortable />
      <Column header="Period">
        <template #body="{ data }">
          {{ formatDate(data.periodStart) }} - {{ formatDate(data.periodEnd) }}
        </template>
      </Column>
      <Column header="Amount" sortable sortField="totalAmount">
        <template #body="{ data }">
          <span class="invoice-amount font-semibold">
            {{ formatCurrency(data.totalAmount, data.currency) }}
          </span>
        </template>
      </Column>
      <Column header="Due Date" field="dueDate" sortable>
        <template #body="{ data }">
          {{ formatDate(data.dueDate) }}
        </template>
      </Column>
      <Column header="Status" field="status" sortable>
        <template #body="{ data }">
          <Tag :value="data.status" :severity="getStatusSeverity(data.status)" class="status-tag" />
        </template>
      </Column>
      <Column header="Actions" style="width: 8rem">
        <template #body="{ data }">
          <Button
            v-if="data.pdfUrl"
            icon="pi pi-file-pdf"
            severity="secondary"
            text
            rounded
            class="pdf-download-btn"
            @click="openPdf(data.pdfUrl)"
            v-tooltip="'Download PDF'"
          />
        </template>
      </Column>
    </DataTable>
  </div>
</template>

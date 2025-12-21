<script setup lang="ts">
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import type { Sim, SimStatus } from '@/types/sim'

const props = defineProps<{
  sims: Sim[]
  loading: boolean
  statusFilter: SimStatus | null
  iccidSearch: string
}>()

const emit = defineEmits<{
  'update:statusFilter': [value: SimStatus | null]
  'update:iccidSearch': [value: string]
  'select': [sim: Sim]
  'reset-filters': []
}>()

const statusOptions = [
  { label: 'All Statuses', value: null },
  { label: 'Provisioned', value: 'PROVISIONED' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
  { label: 'Blocked', value: 'BLOCKED' }
]

const getStatusSeverity = (status: SimStatus): 'success' | 'info' | 'warning' | 'danger' | 'secondary' => {
  const severityMap: Record<SimStatus, 'success' | 'info' | 'warning' | 'danger'> = {
    PROVISIONED: 'info',
    ACTIVE: 'success',
    INACTIVE: 'warning',
    BLOCKED: 'danger'
  }
  return severityMap[status] || 'secondary'
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString('de-CH')
}

const onRowSelect = (event: { data: Sim }) => {
  emit('select', event.data)
}
</script>

<template>
  <div class="sim-list">
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
      <InputText
        :modelValue="iccidSearch"
        @update:modelValue="emit('update:iccidSearch', $event as string)"
        placeholder="Search ICCID/MSISDN..."
        class="w-15rem"
        data-testid="iccid-search"
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
      :value="sims"
      :loading="loading"
      paginator
      :rows="10"
      :rowsPerPageOptions="[5, 10, 20]"
      tableStyle="min-width: 60rem"
      stripedRows
      selectionMode="single"
      @rowSelect="onRowSelect"
      dataKey="simId"
    >
      <Column field="iccid" header="ICCID" sortable style="width: 15rem">
        <template #body="{ data }">
          <span class="font-mono text-sm">{{ data.iccid }}</span>
        </template>
      </Column>
      <Column field="msisdn" header="MSISDN" sortable>
        <template #body="{ data }">
          <span class="font-mono">{{ data.msisdn }}</span>
        </template>
      </Column>
      <Column header="Status" field="status" sortable style="width: 10rem">
        <template #body="{ data }">
          <Tag :value="data.status" :severity="getStatusSeverity(data.status)" class="status-tag" />
        </template>
      </Column>
      <Column header="Customer" style="width: 10rem">
        <template #body="{ data }">
          {{ data.profile?.customerId || '-' }}
        </template>
      </Column>
      <Column header="Rate Plan" style="width: 10rem">
        <template #body="{ data }">
          {{ data.profile?.ratePlanId || '-' }}
        </template>
      </Column>
      <Column header="Updated" field="updatedAt" sortable style="width: 12rem">
        <template #body="{ data }">
          {{ formatDate(data.updatedAt) }}
        </template>
      </Column>
      <Column header="Actions" style="width: 6rem">
        <template #body="{ data }">
          <Button
            icon="pi pi-eye"
            severity="secondary"
            text
            rounded
            @click="emit('select', data)"
            v-tooltip="'View Details'"
          />
        </template>
      </Column>
    </DataTable>
  </div>
</template>

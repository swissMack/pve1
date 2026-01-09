<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import type { FilterCriteria, UsageTableRow, TimeGranularity } from '@/types/analytics'
import { formatMccmncLabel, lookupMccmnc } from '@/services/mccmncService'
import { formatBytes } from '@/services/analyticsService'
import { logExportCsv } from '@/services/auditLogger'

interface DateRange {
  start: string
  end: string
}

interface UsageApiRow {
  imsi?: string
  mccmnc?: string
  bytes: number
  day?: string
  month?: string
  year?: string
  latestEventAt: string
}

const props = withDefaults(defineProps<{
  dateRange: DateRange
  granularity?: TimeGranularity
  filters?: Partial<FilterCriteria>
}>(), {
  granularity: 'monthly',
  filters: undefined
})

const emit = defineEmits<{
  loading: [isLoading: boolean]
}>()

// State
const usageData = ref<UsageTableRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const globalFilter = ref('')

// Pagination
const first = ref(0)
const rows = ref(10)

// Emit loading state changes
watch(loading, (isLoading) => {
  emit('loading', isLoading)
})

// Fetch usage data
const fetchUsageData = async () => {
  loading.value = true
  error.value = null

  try {
    const params = new URLSearchParams({
      start_date: props.dateRange.start,
      end_date: props.dateRange.end,
      granularity: props.granularity
    })

    // Add filter parameters if provided
    if (props.filters?.networks?.length) {
      props.filters.networks.forEach((mccmnc: string) => params.append('mccmnc', mccmnc))
    }
    if (props.filters?.imsis?.length) {
      props.filters.imsis.forEach((imsi: string) => params.append('imsi', imsi))
    }

    const response = await fetch(`/api/consumption/usage-details?${params}`)
    const result = await response.json()

    if (result.success && result.data) {
      // Preload carrier names for all MCCMNCs
      const mccmncs = [...new Set(result.data.map((row: UsageApiRow) => row.mccmnc).filter(Boolean))] as string[]
      await lookupMccmnc(mccmncs)

      // Transform API data to table rows
      usageData.value = result.data.map((row: UsageApiRow, index: number) => {
        const period = row.day || row.month || row.year || 'Unknown'
        return {
          id: `${row.imsi || 'unknown'}:${row.mccmnc || 'unknown'}:${period}:${index}`,
          imsi: row.imsi || 'N/A',
          mccmnc: row.mccmnc || 'N/A',
          carrierName: row.mccmnc ? formatMccmncLabel(row.mccmnc) : 'Unknown',
          bytes: row.bytes || 0,
          bytesFormatted: formatBytes(row.bytes || 0),
          period,
          latestEventAt: new Date(row.latestEventAt)
        }
      })
    } else {
      error.value = result.error || 'Failed to load usage data'
      usageData.value = []
    }
  } catch (err) {
    console.error('Error fetching usage data:', err)
    error.value = 'Network error'
    usageData.value = []
  } finally {
    loading.value = false
  }
}

// Filtered data based on global search
const filteredData = computed(() => {
  if (!globalFilter.value) return usageData.value

  const search = globalFilter.value.toLowerCase()
  return usageData.value.filter(row =>
    row.imsi.toLowerCase().includes(search) ||
    row.mccmnc.toLowerCase().includes(search) ||
    row.carrierName.toLowerCase().includes(search) ||
    row.period.toLowerCase().includes(search)
  )
})

// Export to CSV
const exportCSV = () => {
  const headers = ['ICCID', 'MCCMNC', 'Carrier', 'Data Usage', 'Bytes', 'Period', 'Last Event']
  const csvRows = [headers.join(',')]

  filteredData.value.forEach(row => {
    csvRows.push([
      row.imsi,
      row.mccmnc,
      `"${row.carrierName}"`,
      `"${row.bytesFormatted}"`,
      row.bytes,
      row.period,
      row.latestEventAt.toISOString()
    ].join(','))
  })

  const csvContent = csvRows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `usage-data-${props.dateRange.start}-to-${props.dateRange.end}.csv`
  link.click()
  URL.revokeObjectURL(url)

  // Log CSV export
  logExportCsv('UsageResultsTable', filteredData.value.length, props.filters)
}

// Format date for display
const formatDate = (date: Date): string => {
  return date.toLocaleString('en-CH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Watch for prop changes
onMounted(fetchUsageData)
watch(() => props.dateRange, fetchUsageData, { deep: true })
watch(() => props.granularity, fetchUsageData)
watch(() => props.filters, fetchUsageData, { deep: true })
</script>

<template>
  <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
    <!-- Header -->
    <div class="px-5 py-4 border-b border-border-dark flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-cyan-400">table_chart</span>
        <h3 class="text-white font-semibold">Usage Details</h3>
        <span class="text-text-secondary text-sm">({{ filteredData.length }} records)</span>
      </div>

      <div class="flex items-center gap-3">
        <!-- Global Search -->
        <div class="relative">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg">search</span>
          <InputText
            v-model="globalFilter"
            placeholder="Search..."
            class="pl-10 bg-background-dark border-border-dark text-white text-sm"
            :pt="{
              root: { class: 'bg-background-dark border-border-dark text-white' }
            }"
          />
        </div>

        <!-- Export Button -->
        <Button
          label="Export CSV"
          icon="pi pi-download"
          severity="secondary"
          outlined
          size="small"
          :disabled="loading || filteredData.length === 0"
          @click="exportCSV"
          :pt="{
            root: { class: 'border-border-dark text-text-secondary hover:text-white' }
          }"
        />
      </div>
    </div>

    <!-- Table Content -->
    <div class="p-5">
      <div v-if="loading" class="h-[300px] flex items-center justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>

      <div v-else-if="error" class="h-[300px] flex items-center justify-center">
        <div class="text-center">
          <span class="material-symbols-outlined text-red-400 text-3xl mb-2">error</span>
          <p class="text-red-400 text-sm">{{ error }}</p>
        </div>
      </div>

      <div v-else-if="usageData.length === 0" class="h-[300px] flex items-center justify-center">
        <div class="text-center">
          <span class="material-symbols-outlined text-text-secondary text-3xl mb-2">inbox</span>
          <p class="text-text-secondary text-sm">No usage data available</p>
          <p class="text-text-secondary text-xs mt-1">Try adjusting your date range or filters</p>
        </div>
      </div>

      <DataTable
        v-else
        :value="filteredData"
        :paginator="true"
        :rows="rows"
        :rowsPerPageOptions="[10, 25, 50]"
        v-model:first="first"
        sortMode="single"
        removableSort
        :globalFilterFields="['imsi', 'mccmnc', 'carrierName', 'period']"
        tableStyle="min-width: 50rem"
        :pt="{
          root: { class: 'bg-surface-dark' },
          header: { class: 'bg-surface-dark border-border-dark' },
          thead: { class: 'bg-background-dark' },
          headerRow: { class: 'bg-background-dark' },
          headerCell: { class: 'bg-background-dark text-text-secondary border-border-dark' },
          bodyRow: { class: 'bg-surface-dark hover:bg-surface-dark-highlight border-border-dark' },
          bodyCell: { class: 'text-white border-border-dark' },
          paginator: { class: 'bg-surface-dark border-border-dark' }
        }"
      >
        <Column field="imsi" header="ICCID" sortable>
          <template #body="{ data }">
            <span class="font-mono text-sm">{{ data.imsi }}</span>
          </template>
        </Column>

        <Column field="mccmnc" header="MCCMNC" sortable>
          <template #body="{ data }">
            <span class="font-mono text-sm text-text-secondary">{{ data.mccmnc }}</span>
          </template>
        </Column>

        <Column field="carrierName" header="Carrier" sortable>
          <template #body="{ data }">
            <span class="text-sm">{{ data.carrierName }}</span>
          </template>
        </Column>

        <Column field="bytes" header="Data Usage" sortable>
          <template #body="{ data }">
            <span class="text-sm font-medium text-primary">{{ data.bytesFormatted }}</span>
          </template>
        </Column>

        <Column field="period" header="Period" sortable>
          <template #body="{ data }">
            <span class="text-sm text-text-secondary">{{ data.period }}</span>
          </template>
        </Column>

        <Column field="latestEventAt" header="Last Event" sortable>
          <template #body="{ data }">
            <span class="text-xs text-text-secondary">{{ formatDate(data.latestEventAt) }}</span>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<style>
/* PrimeVue DataTable dark theme overrides */
.p-datatable .p-datatable-thead > tr > th {
  background-color: var(--color-background-dark, #1a1f25) !important;
  color: var(--color-text-secondary, #9ca3af) !important;
  border-color: var(--color-border-dark, #3b4754) !important;
}

.p-datatable .p-datatable-tbody > tr {
  background-color: var(--color-surface-dark, #232a33) !important;
  color: var(--color-text-primary, #f3f4f6) !important;
}

.p-datatable .p-datatable-tbody > tr:hover {
  background-color: var(--color-surface-dark-highlight, #283039) !important;
}

.p-datatable .p-datatable-tbody > tr > td {
  border-color: var(--color-border-dark, #3b4754) !important;
}

.p-paginator {
  background-color: var(--color-surface-dark, #232a33) !important;
  border-color: var(--color-border-dark, #3b4754) !important;
}

.p-paginator .p-paginator-pages .p-paginator-page {
  color: var(--color-text-secondary, #9ca3af) !important;
}

.p-paginator .p-paginator-pages .p-paginator-page.p-highlight {
  background-color: var(--color-primary, #137fec) !important;
  color: white !important;
}

.p-paginator .p-dropdown {
  background-color: var(--color-background-dark, #1a1f25) !important;
  border-color: var(--color-border-dark, #3b4754) !important;
}

.p-inputtext {
  background-color: var(--color-background-dark, #1a1f25) !important;
  border-color: var(--color-border-dark, #3b4754) !important;
  color: var(--color-text-primary, #f3f4f6) !important;
}

.p-sortable-column-icon {
  color: var(--color-text-secondary, #9ca3af) !important;
}
</style>

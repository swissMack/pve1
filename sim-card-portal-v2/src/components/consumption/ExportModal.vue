<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppSettings } from '../../composables/useAppSettings'
import DatePicker from 'primevue/datepicker'
import * as XLSX from 'xlsx'

const { currency } = useAppSettings()

interface DateRange {
  start: string
  end: string
}

const props = defineProps<{
  dateRange: DateRange
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'export', data: ExportData): void
}>()

interface ExportData {
  sections: string[]
  dateRange: DateRange
  granularity: string
  format: string
}

// Export options state
const selectedSections = ref<string[]>(['kpis', 'trends', 'carriers', 'invoices'])
const granularity = ref<'daily' | 'weekly' | 'monthly'>('monthly')
const exportFormat = ref<'csv' | 'xlsx'>('csv')
const isExporting = ref(false)
const exportProgress = ref('')

// Editable date range (initialized from props) - use Date objects for PrimeVue DatePicker
const exportStartDate = ref<Date>(new Date(props.dateRange.start))
const exportEndDate = ref<Date>(new Date(props.dateRange.end))

// Quick date range presets
const datePresets = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 3 Months', days: 90 },
  { label: 'Last 6 Months', days: 180 },
  { label: 'Last Year', days: 365 }
]

const applyPreset = (days: number) => {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  exportStartDate.value = start
  exportEndDate.value = end
}

// Helper to format Date to ISO string (YYYY-MM-DD)
const formatDateToISO = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

// Computed export date range (converts Date objects to strings for API)
const exportDateRange = computed(() => ({
  start: formatDateToISO(exportStartDate.value),
  end: formatDateToISO(exportEndDate.value)
}))

// Available sections for export
const sections = [
  { id: 'kpis', label: 'KPI Summary', icon: 'analytics', description: 'Total spend, data usage, active SIMs, averages' },
  { id: 'trends', label: 'Usage Trends', icon: 'trending_up', description: 'Historical data usage and cost trends' },
  { id: 'carriers', label: 'Carrier Breakdown', icon: 'cell_tower', description: 'Usage and cost by carrier' },
  { id: 'regional', label: 'Regional Data', icon: 'location_on', description: 'Geographic usage distribution' },
  { id: 'invoices', label: 'Invoice History', icon: 'receipt_long', description: 'Billing records and payment status' }
]

const toggleSection = (sectionId: string) => {
  const index = selectedSections.value.indexOf(sectionId)
  if (index === -1) {
    selectedSections.value.push(sectionId)
  } else {
    selectedSections.value.splice(index, 1)
  }
}

const selectAll = () => {
  selectedSections.value = sections.map(s => s.id)
}

const clearAll = () => {
  selectedSections.value = []
}

const canExport = computed(() => selectedSections.value.length > 0)

// Fetch and export data
const handleExport = async () => {
  if (!canExport.value) return

  isExporting.value = true
  const allData: string[] = []

  try {
    // Add report header
    allData.push('IoTo Portal - Consumption Analytics Report')
    allData.push(`Generated: ${new Date().toLocaleString()}`)
    allData.push(`Date Range: ${exportDateRange.value.start} to ${exportDateRange.value.end}`)
    allData.push(`Currency: ${currency.value}`)
    allData.push('')

    // Export KPIs
    if (selectedSections.value.includes('kpis')) {
      exportProgress.value = 'Fetching KPI data...'
      const kpiData = await fetchKPIs()
      allData.push('=== KPI SUMMARY ===')
      allData.push(`"Metric","Value","Trend"`)
      if (kpiData) {
        allData.push(`"Total Spend","${currency.value} ${kpiData.totalSpend?.value?.toFixed(2) || 0}","${kpiData.totalSpend?.trend?.toFixed(1) || 0}%"`)
        allData.push(`"Data Usage (GB)","${kpiData.dataUsage?.valueGB?.toFixed(2) || 0}","${kpiData.dataUsage?.trend?.toFixed(1) || 0}%"`)
        allData.push(`"Active SIMs","${kpiData.activeSims?.value || 0}","-"`)
        allData.push(`"Avg Data/SIM (GB)","${kpiData.avgDataPerSim?.valueGB?.toFixed(2) || 0}","-"`)
        allData.push(`"Estimated Cost","${currency.value} ${kpiData.estimatedCost?.value?.toFixed(0) || 0}","-"`)
      }
      allData.push('')
    }

    // Export Trends
    if (selectedSections.value.includes('trends')) {
      exportProgress.value = 'Fetching trends data...'
      const trendsData = await fetchTrends()
      allData.push(`=== USAGE TRENDS (${granularity.value.toUpperCase()}) ===`)
      allData.push(`"Period","Data Usage (GB)","Cost (${currency.value})","SIM Count"`)
      if (trendsData && trendsData.length > 0) {
        trendsData.forEach((t: any) => {
          allData.push(`"${t.period}","${t.dataUsageGB?.toFixed(2) || 0}","${t.cost?.toFixed(2) || 0}","${t.simCount || 0}"`)
        })
      }
      allData.push('')
    }

    // Export Carriers
    if (selectedSections.value.includes('carriers')) {
      exportProgress.value = 'Fetching carrier data...'
      const carriersData = await fetchCarriers()
      allData.push('=== CARRIER BREAKDOWN ===')
      allData.push(`"Carrier","Data Usage (GB)","Cost (${currency.value})","SIM Count","Percentage"`)
      if (carriersData && carriersData.length > 0) {
        carriersData.forEach((c: any) => {
          allData.push(`"${c.name}","${c.dataUsageGB?.toFixed(2) || 0}","${c.cost?.toFixed(2) || 0}","${c.simCount || 0}","${c.percentage?.toFixed(1) || 0}%"`)
        })
      }
      allData.push('')
    }

    // Export Regional
    if (selectedSections.value.includes('regional')) {
      exportProgress.value = 'Fetching regional data...'
      const regionalData = await fetchRegional()
      allData.push('=== REGIONAL USAGE ===')
      allData.push(`"Location","Latitude","Longitude","Data Usage (GB)","Device Count"`)
      if (regionalData && regionalData.length > 0) {
        regionalData.forEach((r: any) => {
          allData.push(`"${r.name}","${r.latitude}","${r.longitude}","${r.dataUsageGB?.toFixed(2) || 0}","${r.deviceCount || 0}"`)
        })
      }
      allData.push('')
    }

    // Export Invoices
    if (selectedSections.value.includes('invoices')) {
      exportProgress.value = 'Fetching invoice data...'
      const invoicesData = await fetchInvoices()
      allData.push('=== INVOICE HISTORY ===')
      allData.push(`"Invoice #","Carrier","Period Start","Period End","Amount","Currency","Status","Due Date","Paid Date"`)
      if (invoicesData && invoicesData.length > 0) {
        invoicesData.forEach((i: any) => {
          allData.push(`"${i.invoiceNumber}","${i.carrierName || i.carrierId}","${i.periodStart}","${i.periodEnd}","${i.totalAmount?.toFixed(2) || 0}","${i.currency}","${i.status}","${i.dueDate || ''}","${i.paidDate || ''}"`)
        })
      }
      allData.push('')
    }

    // Generate and download file
    exportProgress.value = 'Generating file...'
    const csvContent = allData.join('\n')

    if (exportFormat.value === 'xlsx') {
      downloadExcel(csvContent)
    } else {
      downloadCSV(csvContent)
    }

    exportProgress.value = 'Export complete!'
    setTimeout(() => {
      emit('close')
    }, 1000)

  } catch (error) {
    console.error('Export error:', error)
    exportProgress.value = 'Export failed. Please try again.'
  } finally {
    setTimeout(() => {
      isExporting.value = false
      exportProgress.value = ''
    }, 1500)
  }
}

// API fetch functions - use exportDateRange for editable dates
const fetchKPIs = async () => {
  const params = new URLSearchParams({
    start_date: exportDateRange.value.start,
    end_date: exportDateRange.value.end
  })
  const response = await fetch(`/api/consumption/kpis?${params}`)
  const result = await response.json()
  return result.success ? result.data : null
}

const fetchTrends = async () => {
  const params = new URLSearchParams({
    start_date: exportDateRange.value.start,
    end_date: exportDateRange.value.end,
    granularity: granularity.value
  })
  const response = await fetch(`/api/consumption/trends?${params}`)
  const result = await response.json()
  return result.success ? result.data : []
}

const fetchCarriers = async () => {
  const params = new URLSearchParams({
    start_date: exportDateRange.value.start,
    end_date: exportDateRange.value.end
  })
  const response = await fetch(`/api/consumption/carriers?${params}`)
  const result = await response.json()
  return result.success ? result.data : []
}

const fetchRegional = async () => {
  const response = await fetch('/api/consumption/regional')
  const result = await response.json()
  return result.success ? result.data : []
}

const fetchInvoices = async () => {
  const params = new URLSearchParams({
    start_date: exportDateRange.value.start,
    end_date: exportDateRange.value.end
  })
  const response = await fetch(`/api/consumption/invoices?${params}`)
  const result = await response.json()
  return result.success ? result.data : []
}

const downloadCSV = (content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  const filename = `ioto_consumption_report_${exportDateRange.value.start}_to_${exportDateRange.value.end}.csv`

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Excel export using xlsx library for proper .xlsx format
const downloadExcel = (content: string) => {
  // Parse the CSV-like content back to structured data
  const lines = content.split('\n')
  const workbook = XLSX.utils.book_new()

  // Parse data into worksheet rows
  const wsData: (string | number)[][] = []

  lines.forEach((line) => {
    if (!line.trim()) {
      wsData.push([]) // Empty row
      return
    }

    // Check if this is a section header (starts with ===)
    if (line.startsWith('===')) {
      wsData.push([line.replace(/=/g, '').trim()])
      return
    }

    // Regular row - parse CSV format
    const cells = parseCSVLine(line)
    const rowData: (string | number)[] = cells.map(cell => {
      const cleanCell = cell.replace(/^"|"$/g, '')
      // Try to detect numbers (but not percentages or currency)
      const numMatch = cleanCell.match(/^[\d.]+$/)
      if (numMatch) {
        return parseFloat(cleanCell)
      }
      return cleanCell
    })
    wsData.push(rowData)
  })

  // Create worksheet from data
  const worksheet = XLSX.utils.aoa_to_sheet(wsData)

  // Set column widths
  const colWidths = [
    { wch: 25 }, // Column A
    { wch: 18 }, // Column B
    { wch: 18 }, // Column C
    { wch: 18 }, // Column D
    { wch: 15 }, // Column E
    { wch: 15 }, // Column F
    { wch: 15 }, // Column G
    { wch: 15 }, // Column H
    { wch: 15 }  // Column I
  ]
  worksheet['!cols'] = colWidths

  // Add the worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Consumption Report')

  // Generate buffer and download
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  const filename = `ioto_consumption_report_${exportDateRange.value.start}_to_${exportDateRange.value.end}.xlsx`

  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Helper to parse CSV line respecting quoted values
const parseCSVLine = (line: string): string[] => {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
      current += char
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}
</script>

<template>
  <div class="fixed inset-0 z-[9999] flex items-center justify-center">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')"></div>

    <!-- Modal -->
    <div class="relative bg-surface-dark border border-border-dark rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-border-dark flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-primary/10">
            <span class="material-symbols-outlined text-primary">download</span>
          </div>
          <div>
            <h2 class="text-lg font-bold text-white">Export Consumption Data</h2>
            <p class="text-xs text-text-secondary">Select data sections to include in your report</p>
          </div>
        </div>
        <button
          @click="emit('close')"
          class="p-2 text-text-secondary hover:text-white transition-colors"
        >
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
        <!-- Date Range Selection -->
        <div class="bg-background-dark rounded-xl p-4 border border-border-dark">
          <div class="flex items-center gap-2 mb-3">
            <span class="material-symbols-outlined text-primary text-[18px]">date_range</span>
            <span class="text-sm font-medium text-white">Export Period</span>
          </div>

          <!-- Date Input Fields -->
          <div class="flex flex-wrap items-center gap-4 mb-3">
            <div class="flex-1 min-w-[140px]">
              <label class="block text-xs text-text-secondary mb-1.5">From</label>
              <DatePicker
                v-model="exportStartDate"
                dateFormat="dd M yy"
                showIcon
                iconDisplay="input"
                :showOnFocus="false"
                :pt="{
                  root: { class: 'w-full' },
                  pcInput: { root: { class: 'w-full !bg-surface-dark !border-border-dark !text-white !rounded-lg !py-2.5 !text-sm focus:!border-primary' } },
                  dropdown: { class: '!bg-surface-dark !border-border-dark !text-white hover:!bg-surface-dark-highlight !rounded-r-lg' },
                  panel: { class: '!bg-surface-dark !border-border-dark !rounded-xl !shadow-xl' },
                  header: { class: '!bg-surface-dark !border-border-dark' },
                  title: { class: '!text-white' },
                  selectMonth: { class: '!text-white hover:!bg-primary/20' },
                  selectYear: { class: '!text-white hover:!bg-primary/20' },
                  decade: { class: '!text-white' },
                  dayLabel: { class: '!text-text-secondary' },
                  day: { class: '!text-white hover:!bg-primary/20' },
                  today: { class: '!text-primary' },
                  previousButton: { class: '!text-white hover:!bg-surface-dark-highlight' },
                  nextButton: { class: '!text-white hover:!bg-surface-dark-highlight' }
                }"
              />
            </div>
            <div class="flex-1 min-w-[140px]">
              <label class="block text-xs text-text-secondary mb-1.5">To</label>
              <DatePicker
                v-model="exportEndDate"
                dateFormat="dd M yy"
                showIcon
                iconDisplay="input"
                :showOnFocus="false"
                :pt="{
                  root: { class: 'w-full' },
                  pcInput: { root: { class: 'w-full !bg-surface-dark !border-border-dark !text-white !rounded-lg !py-2.5 !text-sm focus:!border-primary' } },
                  dropdown: { class: '!bg-surface-dark !border-border-dark !text-white hover:!bg-surface-dark-highlight !rounded-r-lg' },
                  panel: { class: '!bg-surface-dark !border-border-dark !rounded-xl !shadow-xl' },
                  header: { class: '!bg-surface-dark !border-border-dark' },
                  title: { class: '!text-white' },
                  selectMonth: { class: '!text-white hover:!bg-primary/20' },
                  selectYear: { class: '!text-white hover:!bg-primary/20' },
                  decade: { class: '!text-white' },
                  dayLabel: { class: '!text-text-secondary' },
                  day: { class: '!text-white hover:!bg-primary/20' },
                  today: { class: '!text-primary' },
                  previousButton: { class: '!text-white hover:!bg-surface-dark-highlight' },
                  nextButton: { class: '!text-white hover:!bg-surface-dark-highlight' }
                }"
              />
            </div>
          </div>

          <!-- Quick Presets -->
          <div class="flex flex-wrap gap-2">
            <button
              v-for="preset in datePresets"
              :key="preset.days"
              @click="applyPreset(preset.days)"
              class="px-3 py-1.5 text-xs rounded-lg bg-surface-dark-highlight text-text-secondary hover:text-white hover:border-primary/50 border border-border-dark transition-colors"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <!-- Data Sections Selection -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium text-white">Data Sections</span>
            <div class="flex gap-2">
              <button
                @click="selectAll"
                class="text-xs text-primary hover:underline"
              >
                Select All
              </button>
              <span class="text-text-secondary">|</span>
              <button
                @click="clearAll"
                class="text-xs text-text-secondary hover:text-white"
              >
                Clear
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              v-for="section in sections"
              :key="section.id"
              @click="toggleSection(section.id)"
              :class="[
                'flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
                selectedSections.includes(section.id)
                  ? 'bg-primary/10 border-primary/50'
                  : 'bg-background-dark border-border-dark hover:border-primary/30'
              ]"
            >
              <div
                :class="[
                  'p-2 rounded-lg shrink-0',
                  selectedSections.includes(section.id) ? 'bg-primary/20 text-primary' : 'bg-surface-dark-highlight text-text-secondary'
                ]"
              >
                <span class="material-symbols-outlined text-[20px]">{{ section.icon }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span
                    :class="[
                      'font-medium text-sm',
                      selectedSections.includes(section.id) ? 'text-white' : 'text-text-secondary'
                    ]"
                  >
                    {{ section.label }}
                  </span>
                  <span
                    v-if="selectedSections.includes(section.id)"
                    class="material-symbols-outlined text-primary text-[16px]"
                  >
                    check_circle
                  </span>
                </div>
                <p class="text-xs text-text-secondary mt-0.5">{{ section.description }}</p>
              </div>
            </button>
          </div>
        </div>

        <!-- Trends Granularity (only shown if trends selected) -->
        <div v-if="selectedSections.includes('trends')" class="bg-background-dark rounded-xl p-4 border border-border-dark">
          <div class="flex items-center gap-2 mb-3">
            <span class="material-symbols-outlined text-primary text-[18px]">schedule</span>
            <span class="text-sm font-medium text-white">Trends Granularity</span>
          </div>
          <div class="flex gap-2">
            <button
              v-for="g in ['daily', 'weekly', 'monthly'] as const"
              :key="g"
              @click="granularity = g"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
                granularity === g
                  ? 'bg-primary text-white'
                  : 'bg-surface-dark-highlight text-text-secondary hover:text-white'
              ]"
            >
              {{ g }}
            </button>
          </div>
        </div>

        <!-- Export Format -->
        <div class="bg-background-dark rounded-xl p-4 border border-border-dark">
          <div class="flex items-center gap-2 mb-3">
            <span class="material-symbols-outlined text-primary text-[18px]">description</span>
            <span class="text-sm font-medium text-white">Export Format</span>
          </div>
          <div class="flex gap-2">
            <button
              @click="exportFormat = 'csv'"
              :class="[
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                exportFormat === 'csv'
                  ? 'bg-primary text-white'
                  : 'bg-surface-dark-highlight text-text-secondary hover:text-white'
              ]"
            >
              <span class="material-symbols-outlined text-[18px]">table_view</span>
              CSV
            </button>
            <button
              @click="exportFormat = 'xlsx'"
              :class="[
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                exportFormat === 'xlsx'
                  ? 'bg-primary text-white'
                  : 'bg-surface-dark-highlight text-text-secondary hover:text-white'
              ]"
            >
              <span class="material-symbols-outlined text-[18px]">grid_on</span>
              Excel
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-border-dark bg-background-dark flex items-center justify-between">
        <div class="flex items-center gap-2 text-sm">
          <span
            v-if="isExporting"
            class="material-symbols-outlined text-primary animate-spin text-[18px]"
          >
            progress_activity
          </span>
          <span
            v-if="exportProgress"
            :class="exportProgress.includes('complete') ? 'text-green-400' : exportProgress.includes('failed') ? 'text-red-400' : 'text-text-secondary'"
          >
            {{ exportProgress }}
          </span>
          <span v-else class="text-text-secondary">
            {{ selectedSections.length }} section{{ selectedSections.length !== 1 ? 's' : '' }} selected
          </span>
        </div>

        <div class="flex gap-3">
          <button
            @click="emit('close')"
            class="px-4 py-2 text-text-secondary hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            @click="handleExport"
            :disabled="!canExport || isExporting"
            :class="[
              'flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors',
              canExport && !isExporting
                ? 'bg-primary text-white hover:bg-blue-600'
                : 'bg-border-dark text-text-secondary cursor-not-allowed'
            ]"
          >
            <span class="material-symbols-outlined text-[18px]">download</span>
            {{ isExporting ? 'Exporting...' : 'Export Report' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* PrimeVue DatePicker dark theme overrides */
.p-datepicker {
  background: #283039 !important;
  border-color: #3b4754 !important;
  border-radius: 0.75rem !important;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
}

.p-datepicker .p-datepicker-header {
  background: #283039 !important;
  border-color: #3b4754 !important;
  color: #f3f4f6 !important;
}

.p-datepicker .p-datepicker-header .p-datepicker-title .p-datepicker-select-month,
.p-datepicker .p-datepicker-header .p-datepicker-title .p-datepicker-select-year {
  color: #f3f4f6 !important;
}

.p-datepicker .p-datepicker-header .p-datepicker-title .p-datepicker-select-month:hover,
.p-datepicker .p-datepicker-header .p-datepicker-title .p-datepicker-select-year:hover {
  background: rgba(19, 127, 236, 0.2) !important;
}

.p-datepicker .p-datepicker-prev-button,
.p-datepicker .p-datepicker-next-button {
  color: #f3f4f6 !important;
}

.p-datepicker .p-datepicker-prev-button:hover,
.p-datepicker .p-datepicker-next-button:hover {
  background: #3b4754 !important;
}

.p-datepicker table th {
  color: #9ca3af !important;
}

.p-datepicker table td > span {
  color: #f3f4f6 !important;
}

.p-datepicker table td > span:hover {
  background: rgba(19, 127, 236, 0.2) !important;
}

.p-datepicker table td.p-datepicker-today > span {
  background: rgba(19, 127, 236, 0.3) !important;
  color: #137fec !important;
}

.p-datepicker table td > span.p-datepicker-day-selected {
  background: #137fec !important;
  color: white !important;
}

.p-datepicker .p-monthpicker .p-monthpicker-month,
.p-datepicker .p-yearpicker .p-yearpicker-year {
  color: #f3f4f6 !important;
}

.p-datepicker .p-monthpicker .p-monthpicker-month:hover,
.p-datepicker .p-yearpicker .p-yearpicker-year:hover {
  background: rgba(19, 127, 236, 0.2) !important;
}

.p-datepicker .p-monthpicker .p-monthpicker-month.p-monthpicker-month-selected,
.p-datepicker .p-yearpicker .p-yearpicker-year.p-yearpicker-year-selected {
  background: #137fec !important;
  color: white !important;
}

/* Input field styling */
.p-datepicker-input {
  background: #283039 !important;
  border-color: #3b4754 !important;
  color: #f3f4f6 !important;
}

.p-datepicker-input:focus {
  border-color: #137fec !important;
  box-shadow: none !important;
}

/* Dropdown button */
.p-datepicker-dropdown {
  background: #283039 !important;
  border-color: #3b4754 !important;
  color: #f3f4f6 !important;
}

.p-datepicker-dropdown:hover {
  background: #3b4754 !important;
}
</style>

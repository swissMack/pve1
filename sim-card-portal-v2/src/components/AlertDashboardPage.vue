<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import Chart from 'chart.js/auto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Alert {
  id: string
  title: string
  description: string
  severity: string
  status: string
  alertType: string
  assetName: string
  geozoneName: string
  assignedToName: string
  latitude: number
  longitude: number
  slaDeadline: string
  createdAt: string
  ruleName: string
}

interface AlertStats {
  total: number
  byStatus: Record<string, number>
  bySeverity: Record<string, number>
  unresolved: number
  avgResolutionMinutes: number
  trend: { date: string; count: number }[]
}

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------

interface Props {
  refreshKey?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  selectAlert: [alertId: string]
  navigateToRules: []
  navigateToNotifications: []
}>()

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE_URL = window.location.origin

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#3b82f6',
  info: '#6b7280'
}

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info'
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  acknowledged: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  assigned: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  in_progress: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  resolved: 'bg-green-500/10 text-green-400 border-green-500/20',
  snoozed: 'bg-gray-500/10 text-gray-400 border-gray-500/20'
}

const STATUS_DOT_CLASSES: Record<string, string> = {
  new: 'bg-blue-400',
  acknowledged: 'bg-amber-400',
  assigned: 'bg-purple-400',
  in_progress: 'bg-cyan-400',
  resolved: 'bg-green-400',
  snoozed: 'bg-gray-400'
}

const STATUS_CHART_COLORS: Record<string, string> = {
  new: '#3b82f6',
  acknowledged: '#f59e0b',
  assigned: '#a855f7',
  in_progress: '#06b6d4',
  resolved: '#22c55e',
  snoozed: '#6b7280'
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  acknowledged: 'Acknowledged',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  snoozed: 'Snoozed'
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  geofence_entry: 'Geofence Entry',
  geofence_exit: 'Geofence Exit',
  speed_violation: 'Speed Violation',
  idle_timeout: 'Idle Timeout',
  temperature: 'Temperature',
  battery_low: 'Battery Low',
  connectivity_lost: 'Connectivity Lost',
  custom: 'Custom'
}

const statusFilterOptions = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Acknowledged', value: 'acknowledged' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' }
]

const severityOptions = [
  { label: 'All Severities', value: '' },
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
  { label: 'Info', value: 'info' }
]

const typeOptions = [
  { label: 'All Types', value: '' },
  { label: 'Geofence Entry', value: 'geofence_entry' },
  { label: 'Geofence Exit', value: 'geofence_exit' },
  { label: 'Speed Violation', value: 'speed_violation' },
  { label: 'Idle Timeout', value: 'idle_timeout' },
  { label: 'Temperature', value: 'temperature' },
  { label: 'Battery Low', value: 'battery_low' },
  { label: 'Connectivity Lost', value: 'connectivity_lost' },
  { label: 'Custom', value: 'custom' }
]

// ---------------------------------------------------------------------------
// Reactive State
// ---------------------------------------------------------------------------

const alerts = ref<Alert[]>([])
const stats = ref<AlertStats | null>(null)
const loading = ref(true)
const loadingStats = ref(true)
const error = ref('')
const errorStats = ref('')

// Filters
const searchTerm = ref('')
const selectedStatus = ref('all')
const selectedSeverity = ref('')
const selectedType = ref('')
const dateFrom = ref('')
const dateTo = ref('')

// Selection
const selectedIds = ref<Set<string>>(new Set())
const selectAll = ref(false)

// Bulk action
const bulkLoading = ref(false)
const bulkError = ref('')

// Chart refs
const statusChartRef = ref<HTMLCanvasElement | null>(null)
const severityChartRef = ref<HTMLCanvasElement | null>(null)
const trendChartRef = ref<HTMLCanvasElement | null>(null)

let statusChartInstance: Chart | null = null
let severityChartInstance: Chart | null = null
let trendChartInstance: Chart | null = null

// ---------------------------------------------------------------------------
// Computed
// ---------------------------------------------------------------------------

const hasSelection = computed(() => selectedIds.value.size > 0)

const selectedCount = computed(() => selectedIds.value.size)

const criticalCount = computed(() => stats.value?.bySeverity?.critical ?? 0)

const avgResolutionDisplay = computed(() => {
  const mins = stats.value?.avgResolutionMinutes ?? 0
  if (mins < 60) return `${Math.round(mins)}m`
  if (mins < 1440) return `${Math.round(mins / 60)}h`
  return `${Math.round(mins / 1440)}d`
})

// ---------------------------------------------------------------------------
// Data Fetching
// ---------------------------------------------------------------------------

async function loadAlerts() {
  loading.value = true
  error.value = ''
  try {
    const url = new URL('/api/alerts', API_BASE_URL)
    if (selectedStatus.value && selectedStatus.value !== 'all') url.searchParams.set('status', selectedStatus.value)
    if (selectedSeverity.value) url.searchParams.set('severity', selectedSeverity.value)
    if (selectedType.value) url.searchParams.set('type', selectedType.value)
    if (dateFrom.value) url.searchParams.set('from', dateFrom.value)
    if (dateTo.value) url.searchParams.set('to', dateTo.value)
    if (searchTerm.value) url.searchParams.set('search', searchTerm.value)

    const response = await fetch(url.toString())
    const result = await response.json()
    if (result.success) {
      alerts.value = result.data
    } else {
      error.value = result.error || 'Failed to load alerts'
    }
  } catch (err) {
    console.error('Error loading alerts:', err)
    error.value = 'Failed to load alerts'
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  loadingStats.value = true
  errorStats.value = ''
  try {
    const response = await fetch(`${API_BASE_URL}/api/alerts/stats`)
    const result = await response.json()
    if (result.success) {
      stats.value = result.data
    } else {
      errorStats.value = result.error || 'Failed to load alert statistics'
    }
  } catch (err) {
    console.error('Error loading alert stats:', err)
    errorStats.value = 'Failed to load alert statistics'
  } finally {
    loadingStats.value = false
  }
}

async function loadAllData() {
  await Promise.all([loadAlerts(), loadStats()])
  await nextTick()
  renderCharts()
}

// ---------------------------------------------------------------------------
// Bulk Actions
// ---------------------------------------------------------------------------

async function bulkTransition(newStatus: string) {
  if (selectedIds.value.size === 0) return
  bulkLoading.value = true
  bulkError.value = ''
  try {
    const response = await fetch(`${API_BASE_URL}/api/alerts/bulk-transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: Array.from(selectedIds.value),
        status: newStatus,
        comment: `Bulk ${newStatus} from Alert Dashboard`
      })
    })
    const result = await response.json()
    if (result.success) {
      selectedIds.value.clear()
      selectAll.value = false
      await loadAllData()
    } else {
      bulkError.value = result.error || 'Bulk action failed'
    }
  } catch (err) {
    console.error('Error in bulk transition:', err)
    bulkError.value = 'Bulk action failed'
  } finally {
    bulkLoading.value = false
  }
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

function toggleSelectAll() {
  if (selectAll.value) {
    selectedIds.value = new Set(alerts.value.map(a => a.id))
  } else {
    selectedIds.value.clear()
  }
}

function toggleSelectRow(id: string) {
  const newSet = new Set(selectedIds.value)
  if (newSet.has(id)) {
    newSet.delete(id)
  } else {
    newSet.add(id)
  }
  selectedIds.value = newSet
  selectAll.value = newSet.size === alerts.value.length && alerts.value.length > 0
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

function renderCharts() {
  renderStatusChart()
  renderSeverityChart()
  renderTrendChart()
}

function destroyCharts() {
  if (statusChartInstance) { statusChartInstance.destroy(); statusChartInstance = null }
  if (severityChartInstance) { severityChartInstance.destroy(); severityChartInstance = null }
  if (trendChartInstance) { trendChartInstance.destroy(); trendChartInstance = null }
}

function renderStatusChart() {
  if (!statusChartRef.value || !stats.value) return
  if (statusChartInstance) statusChartInstance.destroy()

  const byStatus = stats.value.byStatus || {}
  const labels: string[] = []
  const data: number[] = []
  const colors: string[] = []

  for (const [status, count] of Object.entries(byStatus)) {
    if (count > 0) {
      labels.push(STATUS_LABELS[status] || status)
      data.push(count)
      colors.push(STATUS_CHART_COLORS[status] || '#6b7280')
    }
  }

  if (data.length === 0) {
    labels.push('No Data')
    data.push(1)
    colors.push('#283039')
  }

  statusChartInstance = new Chart(statusChartRef.value, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: '#0f1923',
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#9faab6',
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 8,
            font: { size: 11 }
          }
        },
        tooltip: {
          backgroundColor: '#18222c',
          borderColor: '#283039',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#9faab6',
          padding: 10,
          cornerRadius: 8
        }
      }
    }
  })
}

function renderSeverityChart() {
  if (!severityChartRef.value || !stats.value) return
  if (severityChartInstance) severityChartInstance.destroy()

  const bySeverity = stats.value.bySeverity || {}
  const order = ['critical', 'high', 'medium', 'low', 'info']
  const labels: string[] = []
  const data: number[] = []
  const colors: string[] = []

  for (const sev of order) {
    labels.push(SEVERITY_LABELS[sev] || sev)
    data.push(bySeverity[sev] || 0)
    colors.push(SEVERITY_COLORS[sev] || '#6b7280')
  }

  severityChartInstance = new Chart(severityChartRef.value, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Alerts',
        data,
        backgroundColor: colors,
        borderColor: colors.map(c => c + '80'),
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9faab6', font: { size: 11 } },
          border: { color: '#283039' }
        },
        y: {
          beginAtZero: true,
          grid: { color: '#283039' },
          ticks: {
            color: '#9faab6',
            font: { size: 11 },
            stepSize: 1,
            callback: (value: string | number) => Number.isInteger(value) ? value : ''
          },
          border: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#18222c',
          borderColor: '#283039',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#9faab6',
          padding: 10,
          cornerRadius: 8
        }
      }
    }
  })
}

function renderTrendChart() {
  if (!trendChartRef.value || !stats.value) return
  if (trendChartInstance) trendChartInstance.destroy()

  const trend = stats.value.trend || []
  const labels = trend.map(t => {
    const d = new Date(t.date)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })
  const data = trend.map(t => t.count)

  trendChartInstance = new Chart(trendChartRef.value, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Alerts',
        data,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#0f1923',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9faab6', font: { size: 11 } },
          border: { color: '#283039' }
        },
        y: {
          beginAtZero: true,
          grid: { color: '#283039' },
          ticks: {
            color: '#9faab6',
            font: { size: 11 },
            stepSize: 1,
            callback: (value: string | number) => Number.isInteger(value) ? value : ''
          },
          border: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#18222c',
          borderColor: '#283039',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#9faab6',
          padding: 10,
          cornerRadius: 8
        }
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSeverityDotColor(severity: string): string {
  return SEVERITY_COLORS[severity] || '#6b7280'
}

function getSeverityBadgeClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/20'
    case 'high': return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
    case 'medium': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    case 'low': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    case 'info': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }
}

function getStatusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASSES[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'
}

function getStatusDotClass(status: string): string {
  return STATUS_DOT_CLASSES[status] || 'bg-gray-400'
}

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status
}

function getAlertTypeLabel(type: string): string {
  return ALERT_TYPE_LABELS[type] || type
}

function getAlertTypeBadgeClass(type: string): string {
  switch (type) {
    case 'geofence_entry':
    case 'geofence_exit': return 'bg-indigo-500/10 text-indigo-400'
    case 'speed_violation': return 'bg-orange-500/10 text-orange-400'
    case 'idle_timeout': return 'bg-yellow-500/10 text-yellow-400'
    case 'temperature': return 'bg-red-500/10 text-red-400'
    case 'battery_low': return 'bg-amber-500/10 text-amber-400'
    case 'connectivity_lost': return 'bg-gray-500/10 text-gray-400'
    default: return 'bg-slate-500/10 text-slate-400'
  }
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '\u2014'
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffWeek = Math.floor(diffDay / 7)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  if (diffWeek < 4) return `${diffWeek}w ago`
  return new Date(dateStr).toLocaleDateString()
}

function isSlaOverdue(slaDeadline: string): boolean {
  if (!slaDeadline) return false
  return new Date(slaDeadline).getTime() < Date.now()
}

function formatSlaDeadline(slaDeadline: string): string {
  if (!slaDeadline) return '\u2014'
  const deadline = new Date(slaDeadline)
  const now = Date.now()
  const diffMs = deadline.getTime() - now

  if (diffMs < 0) {
    // Overdue
    const overdue = Math.abs(diffMs)
    const mins = Math.floor(overdue / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d overdue`
    if (hours > 0) return `${hours}h overdue`
    return `${mins}m overdue`
  } else {
    // Remaining
    const mins = Math.floor(diffMs / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d left`
    if (hours > 0) return `${hours}h left`
    return `${mins}m left`
  }
}

function handleRowClick(alertId: string) {
  emit('selectAlert', alertId)
}

// ---------------------------------------------------------------------------
// Watchers
// ---------------------------------------------------------------------------

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(searchTerm, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadAlerts()
  }, 300)
})

watch([selectedStatus, selectedSeverity, selectedType, dateFrom, dateTo], () => {
  loadAlerts()
})

watch(() => props.refreshKey, () => {
  loadAllData()
})

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(() => {
  loadAllData()
})

onUnmounted(() => {
  destroyCharts()
  if (searchTimeout) clearTimeout(searchTimeout)
})
</script>

<template>
  <div class="p-6 lg:p-8 bg-background-dark min-h-full">
    <div class="max-w-[1600px] mx-auto flex flex-col gap-6">

      <!-- ================================================================ -->
      <!-- Page Header                                                       -->
      <!-- ================================================================ -->

      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">Alert Dashboard</h1>
          <p class="text-text-secondary text-sm mt-1">Monitor, triage, and resolve alerts across your fleet</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="emit('navigateToNotifications')"
            class="flex items-center gap-2 px-3 py-2 text-text-secondary hover:text-white bg-surface-dark border border-border-dark rounded-lg hover:border-primary/50 transition-colors text-sm"
          >
            <span class="material-symbols-outlined text-[18px]">notifications</span>
            <span class="hidden sm:inline">Notifications</span>
          </button>
          <button
            @click="emit('navigateToRules')"
            class="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20"
          >
            <span class="material-symbols-outlined text-[20px]">add</span>
            New Rule
          </button>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- Stats Row (4 KPI Cards)                                           -->
      <!-- ================================================================ -->

      <div v-if="loadingStats" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="n in 4"
          :key="n"
          class="bg-surface-dark rounded-xl border border-border-dark p-4 animate-pulse"
        >
          <div class="flex items-center gap-4">
            <div class="size-10 rounded-lg bg-border-dark"></div>
            <div class="flex flex-col gap-2">
              <div class="h-6 w-10 rounded bg-border-dark"></div>
              <div class="h-3 w-16 rounded bg-border-dark"></div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="errorStats" class="bg-surface-dark rounded-xl border border-red-500/30 p-6">
        <div class="flex items-center gap-3 text-red-400">
          <span class="material-symbols-outlined">error</span>
          <span class="text-sm">{{ errorStats }}</span>
          <button
            @click="loadStats"
            class="ml-auto px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>

      <div v-else class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Total Alerts -->
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-primary/10 text-primary">
            <span class="material-symbols-outlined text-[24px]">notifications_active</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ stats?.total ?? 0 }}</p>
            <p class="text-text-secondary text-xs">Total Alerts</p>
          </div>
        </div>

        <!-- Critical Alerts -->
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-red-500/10 text-red-400">
            <span class="material-symbols-outlined text-[24px]">error</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ criticalCount }}</p>
            <p class="text-text-secondary text-xs">Critical Alerts</p>
          </div>
        </div>

        <!-- Avg Resolution Time -->
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
            <span class="material-symbols-outlined text-[24px]">timer</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ avgResolutionDisplay }}</p>
            <p class="text-text-secondary text-xs">Avg Resolution Time</p>
          </div>
        </div>

        <!-- Unresolved -->
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-orange-500/10 text-orange-400">
            <span class="material-symbols-outlined text-[24px]">pending_actions</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ stats?.unresolved ?? 0 }}</p>
            <p class="text-text-secondary text-xs">Unresolved</p>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- Charts Row                                                        -->
      <!-- ================================================================ -->

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Status Donut Chart -->
        <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
          <div class="px-5 py-4 border-b border-border-dark flex items-center gap-3">
            <div class="p-2 rounded-lg bg-primary/10 text-primary">
              <span class="material-symbols-outlined text-[20px]">donut_large</span>
            </div>
            <div>
              <h3 class="text-white font-semibold text-sm">By Status</h3>
              <p class="text-text-secondary text-xs mt-0.5">Alert status distribution</p>
            </div>
          </div>
          <div class="p-4">
            <div class="h-[220px] flex items-center justify-center">
              <div v-if="loadingStats" class="flex flex-col items-center gap-2">
                <div class="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                <p class="text-text-secondary text-xs">Loading...</p>
              </div>
              <canvas v-else ref="statusChartRef"></canvas>
            </div>
          </div>
        </div>

        <!-- Severity Bar Chart -->
        <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
          <div class="px-5 py-4 border-b border-border-dark flex items-center gap-3">
            <div class="p-2 rounded-lg bg-orange-500/10 text-orange-400">
              <span class="material-symbols-outlined text-[20px]">bar_chart</span>
            </div>
            <div>
              <h3 class="text-white font-semibold text-sm">By Severity</h3>
              <p class="text-text-secondary text-xs mt-0.5">Alert severity breakdown</p>
            </div>
          </div>
          <div class="p-4">
            <div class="h-[220px] flex items-center justify-center">
              <div v-if="loadingStats" class="flex flex-col items-center gap-2">
                <div class="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                <p class="text-text-secondary text-xs">Loading...</p>
              </div>
              <canvas v-else ref="severityChartRef"></canvas>
            </div>
          </div>
        </div>

        <!-- Trend Line Chart -->
        <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
          <div class="px-5 py-4 border-b border-border-dark flex items-center gap-3">
            <div class="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <span class="material-symbols-outlined text-[20px]">trending_up</span>
            </div>
            <div>
              <h3 class="text-white font-semibold text-sm">7-Day Trend</h3>
              <p class="text-text-secondary text-xs mt-0.5">Alert volume over the past week</p>
            </div>
          </div>
          <div class="p-4">
            <div class="h-[220px] flex items-center justify-center">
              <div v-if="loadingStats" class="flex flex-col items-center gap-2">
                <div class="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                <p class="text-text-secondary text-xs">Loading...</p>
              </div>
              <canvas v-else ref="trendChartRef"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- Filter Bar                                                        -->
      <!-- ================================================================ -->

      <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex flex-col gap-4">
        <!-- Row 1: Search + Status Pills -->
        <div class="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <!-- Search -->
          <div class="relative flex-shrink-0">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[20px]">search</span>
            <input
              v-model="searchTerm"
              type="text"
              placeholder="Search alerts..."
              class="w-full md:w-72 bg-background-dark border border-border-dark rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-text-secondary transition-all"
            />
          </div>

          <!-- Status Pills -->
          <div class="flex bg-background-dark p-1 rounded-lg border border-border-dark overflow-x-auto">
            <button
              v-for="opt in statusFilterOptions"
              :key="opt.value"
              @click="selectedStatus = opt.value"
              class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
              :class="selectedStatus === opt.value ? 'bg-surface-dark text-white shadow-sm' : 'text-text-secondary hover:text-white hover:bg-surface-dark'"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Row 2: Severity + Type + Date Range -->
        <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <!-- Severity Dropdown -->
          <select
            v-model="selectedSeverity"
            class="bg-background-dark border border-border-dark rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer min-w-[150px]"
          >
            <option v-for="opt in severityOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>

          <!-- Type Dropdown -->
          <select
            v-model="selectedType"
            class="bg-background-dark border border-border-dark rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer min-w-[160px]"
          >
            <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>

          <!-- Date From -->
          <div class="flex items-center gap-2">
            <span class="text-text-secondary text-xs whitespace-nowrap">From</span>
            <input
              v-model="dateFrom"
              type="date"
              class="bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <!-- Date To -->
          <div class="flex items-center gap-2">
            <span class="text-text-secondary text-xs whitespace-nowrap">To</span>
            <input
              v-model="dateTo"
              type="date"
              class="bg-background-dark border border-border-dark rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <!-- Spacer -->
          <div class="flex-1"></div>

          <!-- Count -->
          <div class="text-text-secondary text-sm whitespace-nowrap">
            Showing <span class="text-white font-medium">{{ alerts.length }}</span> alerts
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- Bulk Action Bar (shown when items selected)                       -->
      <!-- ================================================================ -->

      <Transition name="slide-up">
        <div
          v-if="hasSelection"
          class="bg-surface-dark rounded-xl border border-primary/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
        >
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-primary/10 text-primary">
              <span class="material-symbols-outlined text-[20px]">checklist</span>
            </div>
            <span class="text-white text-sm font-medium">
              {{ selectedCount }} alert{{ selectedCount !== 1 ? 's' : '' }} selected
            </span>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button
              @click="bulkTransition('acknowledged')"
              :disabled="bulkLoading"
              class="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50"
            >
              <span class="material-symbols-outlined text-[16px]">visibility</span>
              Acknowledge
            </button>
            <button
              @click="bulkTransition('assigned')"
              :disabled="bulkLoading"
              class="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-lg hover:bg-purple-500/20 transition-colors disabled:opacity-50"
            >
              <span class="material-symbols-outlined text-[16px]">person_add</span>
              Assign
            </button>
            <button
              @click="bulkTransition('resolved')"
              :disabled="bulkLoading"
              class="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50"
            >
              <span class="material-symbols-outlined text-[16px]">check_circle</span>
              Resolve
            </button>
            <button
              @click="selectedIds.clear(); selectAll = false"
              class="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-text-secondary hover:text-white bg-background-dark border border-border-dark rounded-lg hover:border-border-dark transition-colors"
            >
              <span class="material-symbols-outlined text-[16px]">close</span>
              Clear
            </button>
          </div>

          <!-- Bulk error -->
          <p v-if="bulkError" class="text-red-400 text-xs w-full sm:w-auto">{{ bulkError }}</p>
        </div>
      </Transition>

      <!-- ================================================================ -->
      <!-- Alerts Table                                                      -->
      <!-- ================================================================ -->

      <!-- Loading State -->
      <div v-if="loading" class="bg-surface-dark rounded-xl border border-border-dark p-12">
        <div class="flex flex-col items-center justify-center gap-3">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
          <p class="text-text-secondary text-sm">Loading alerts...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-surface-dark rounded-xl border border-border-dark p-12">
        <div class="flex flex-col items-center justify-center gap-3 text-text-secondary">
          <span class="material-symbols-outlined text-4xl text-red-400">error</span>
          <p class="text-sm">{{ error }}</p>
          <button
            @click="loadAlerts"
            class="mt-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>

      <!-- Table -->
      <div v-else class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-background-dark border-b border-border-dark">
                <th class="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    v-model="selectAll"
                    @change="toggleSelectAll"
                    class="size-4 rounded border-border-dark bg-background-dark text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer accent-blue-500"
                  />
                </th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Severity</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Title</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Asset</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Geozone</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Type</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Status</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Assigned To</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Created</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">SLA Deadline</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-dark text-sm">
              <tr
                v-for="alert in alerts"
                :key="alert.id"
                class="hover:bg-surface-dark-highlight transition-colors group cursor-pointer"
                @click="handleRowClick(alert.id)"
              >
                <!-- Checkbox -->
                <td class="py-3 px-4" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selectedIds.has(alert.id)"
                    @change="toggleSelectRow(alert.id)"
                    class="size-4 rounded border-border-dark bg-background-dark text-primary focus:ring-primary focus:ring-offset-0 cursor-pointer accent-blue-500"
                  />
                </td>

                <!-- Severity Dot -->
                <td class="py-3 px-4">
                  <div class="flex items-center gap-2">
                    <span
                      class="size-2.5 rounded-full shrink-0"
                      :style="{ backgroundColor: getSeverityDotColor(alert.severity) }"
                    ></span>
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border"
                      :class="getSeverityBadgeClass(alert.severity)"
                    >
                      {{ SEVERITY_LABELS[alert.severity] || alert.severity }}
                    </span>
                  </div>
                </td>

                <!-- Title -->
                <td class="py-3 px-4">
                  <div>
                    <p class="text-white font-medium truncate max-w-[200px]">{{ alert.title }}</p>
                    <p v-if="alert.ruleName" class="text-text-secondary text-xs truncate max-w-[200px]">Rule: {{ alert.ruleName }}</p>
                  </div>
                </td>

                <!-- Asset Name -->
                <td class="py-3 px-4">
                  <span v-if="alert.assetName" class="text-white">{{ alert.assetName }}</span>
                  <span v-else class="text-text-secondary">&mdash;</span>
                </td>

                <!-- Geozone -->
                <td class="py-3 px-4">
                  <span v-if="alert.geozoneName" class="text-text-secondary">{{ alert.geozoneName }}</span>
                  <span v-else class="text-text-secondary">&mdash;</span>
                </td>

                <!-- Type Badge -->
                <td class="py-3 px-4">
                  <span
                    class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                    :class="getAlertTypeBadgeClass(alert.alertType)"
                  >
                    {{ getAlertTypeLabel(alert.alertType) }}
                  </span>
                </td>

                <!-- Status Badge -->
                <td class="py-3 px-4">
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                    :class="getStatusBadgeClass(alert.status)"
                  >
                    <span class="size-1.5 rounded-full" :class="getStatusDotClass(alert.status)"></span>
                    {{ getStatusLabel(alert.status) }}
                  </span>
                </td>

                <!-- Assigned To -->
                <td class="py-3 px-4">
                  <span v-if="alert.assignedToName" class="text-white text-xs">{{ alert.assignedToName }}</span>
                  <span v-else class="text-text-secondary text-xs">Unassigned</span>
                </td>

                <!-- Created (Relative Time) -->
                <td class="py-3 px-4">
                  <span class="text-text-secondary text-xs" :title="new Date(alert.createdAt).toLocaleString()">
                    {{ formatRelativeTime(alert.createdAt) }}
                  </span>
                </td>

                <!-- SLA Deadline -->
                <td class="py-3 px-4">
                  <span
                    v-if="alert.slaDeadline"
                    class="text-xs font-medium"
                    :class="isSlaOverdue(alert.slaDeadline) ? 'text-red-400' : 'text-text-secondary'"
                    :title="new Date(alert.slaDeadline).toLocaleString()"
                  >
                    <span v-if="isSlaOverdue(alert.slaDeadline)" class="inline-flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px]">warning</span>
                      {{ formatSlaDeadline(alert.slaDeadline) }}
                    </span>
                    <span v-else>{{ formatSlaDeadline(alert.slaDeadline) }}</span>
                  </span>
                  <span v-else class="text-text-secondary text-xs">&mdash;</span>
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-if="alerts.length === 0">
                <td colspan="10" class="py-12 text-center">
                  <div class="flex flex-col items-center gap-2 text-text-secondary">
                    <span class="material-symbols-outlined text-4xl">notifications_off</span>
                    <p class="text-sm">No alerts found matching your criteria</p>
                    <p class="text-xs">Try adjusting your filters or date range</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Table Footer -->
        <div class="px-4 py-3 border-t border-border-dark flex items-center justify-between text-xs text-text-secondary">
          <span>Showing {{ alerts.length }} alert{{ alerts.length !== 1 ? 's' : '' }}</span>
          <div v-if="hasSelection" class="text-primary font-medium">
            {{ selectedCount }} selected
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Bulk action bar slide animation */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* Date input styling for dark theme */
input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(0.6);
  cursor: pointer;
}

/* Select dropdown arrow for dark theme */
select {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239faab6' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  padding-right: 2.5rem;
}

/* Checkbox dark theme override */
input[type="checkbox"] {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border: 1.5px solid #283039;
  border-radius: 4px;
  background-color: #0f1923;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
}

input[type="checkbox"]:checked {
  background-color: #3b82f6;
  border-color: #3b82f6;
}

input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

input[type="checkbox"]:hover {
  border-color: #3b82f6;
}

input[type="checkbox"]:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}
</style>

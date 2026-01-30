<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// PrimeVue components
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'

// ============================================================================
// Props & Emits
// ============================================================================

const props = defineProps<{
  alertId: string | null
}>()

const emit = defineEmits<{
  close: []
  selectAsset: [assetId: string]
  selectGeozone: [geozoneId: string]
}>()

// ============================================================================
// Types
// ============================================================================

interface AlertDetail {
  id: string
  ruleName: string
  ruleId: string | null
  alertType: string
  severity: string
  status: string
  ruleScope: 'device' | 'asset' | null
  deviceId: string | null
  title: string
  description: string | null
  assetId: string | null
  assetName: string | null
  geozoneId: string | null
  geozoneName: string | null
  geozoneGeometry: string | null
  geozoneCenterLat: number | null
  geozoneCenterLng: number | null
  geozoneColor: string | null
  latitude: number | null
  longitude: number | null
  slaDeadline: string | null
  assignedTo: string | null
  snoozedUntil: string | null
  createdAt: string
  updatedAt: string
}

interface HistoryEntry {
  id: string
  fromStatus: string | null
  toStatus: string
  changedBy: string | null
  changedByName: string | null
  comment: string | null
  createdAt: string
}

// ============================================================================
// Constants
// ============================================================================

const API_BASE_URL = window.location.origin

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#3b82f6',
  info: '#6b7280'
}

const STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6',
  acknowledged: '#f59e0b',
  assigned: '#a855f7',
  in_progress: '#06b6d4',
  resolved: '#22c55e',
  snoozed: '#6b7280',
  pending: '#f97316'
}

const STATUS_FLOW: string[] = ['new', 'acknowledged', 'assigned', 'in_progress', 'resolved']

const TRANSITIONS: Record<string, string[]> = {
  new: ['acknowledged'],
  acknowledged: ['assigned', 'in_progress', 'resolved'],
  assigned: ['in_progress', 'resolved'],
  in_progress: ['resolved', 'pending'],
  pending: ['in_progress', 'resolved']
}

const SNOOZE_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '4 hours', hours: 4 },
  { label: '8 hours', hours: 8 },
  { label: '24 hours', hours: 24 }
]

// ============================================================================
// Reactive State
// ============================================================================

const visible = ref(true)
const loading = ref(true)
const error = ref('')
const alert = ref<AlertDetail | null>(null)
const history = ref<HistoryEntry[]>([])
const historyLoading = ref(false)

// Workflow
const transitionComment = ref('')
const transitioning = ref(false)
const showSnoozeOptions = ref(false)
const customSnoozeHours = ref<number | null>(null)

// Map
const mapElement = ref<HTMLElement | null>(null)
let mapInstance: L.Map | null = null
let resizeObserver: ResizeObserver | null = null

// ============================================================================
// Computed
// ============================================================================

const availableTransitions = computed((): string[] => {
  if (!alert.value) return []
  const status = alert.value.status
  if (status === 'resolved') return []
  return TRANSITIONS[status] || []
})

const canSnooze = computed((): boolean => {
  if (!alert.value) return false
  return alert.value.status !== 'resolved' && alert.value.status !== 'snoozed'
})

const isOverdue = computed((): boolean => {
  if (!alert.value?.slaDeadline) return false
  return new Date(alert.value.slaDeadline) < new Date()
})

const currentStepIndex = computed((): number => {
  if (!alert.value) return -1
  return STATUS_FLOW.indexOf(alert.value.status)
})

// ============================================================================
// Helpers
// ============================================================================

const getSeverityColor = (severity: string): string => {
  return SEVERITY_COLORS[severity?.toLowerCase()] || '#6b7280'
}

const getStatusColor = (status: string): string => {
  return STATUS_COLORS[status?.toLowerCase()] || '#6b7280'
}

const formatStatus = (status: string | null | undefined): string => {
  if (!status) return 'Unknown'
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const formatAlertType = (alertType: string | null | undefined): string => {
  if (!alertType) return 'Unknown'
  return alertType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const formatDateTime = (dateString?: string | null): string => {
  if (!dateString) return 'N/A'
  try {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateString
  }
}

const formatRelativeTime = (dateString: string): string => {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

const getTransitionLabel = (status: string): string => {
  switch (status) {
    case 'acknowledged': return 'Acknowledge'
    case 'assigned': return 'Assign'
    case 'in_progress': return 'Start Work'
    case 'resolved': return 'Resolve'
    case 'pending': return 'Set Pending'
    default: return formatStatus(status)
  }
}

const getTransitionIcon = (status: string): string => {
  switch (status) {
    case 'acknowledged': return 'visibility'
    case 'assigned': return 'person_add'
    case 'in_progress': return 'play_arrow'
    case 'resolved': return 'check_circle'
    case 'pending': return 'pause_circle'
    default: return 'arrow_forward'
  }
}

// ============================================================================
// Map
// ============================================================================

const initializeMap = async () => {
  await nextTick()
  if (!mapElement.value || !alert.value) return

  const hasPosition = alert.value.latitude != null && alert.value.longitude != null
  const hasGeozoneCenter = alert.value.geozoneCenterLat != null && alert.value.geozoneCenterLng != null

  if (!hasPosition && !hasGeozoneCenter) return

  // Clean up existing map
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }

  const centerLat = alert.value.latitude ?? alert.value.geozoneCenterLat ?? 0
  const centerLng = alert.value.longitude ?? alert.value.geozoneCenterLng ?? 0

  mapInstance = L.map(mapElement.value, {
    center: [centerLat, centerLng],
    zoom: 14,
    zoomControl: true,
    attributionControl: true
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(mapInstance)

  // Add alert position marker
  if (hasPosition) {
    const sevColor = getSeverityColor(alert.value.severity)
    L.circleMarker(
      [alert.value.latitude!, alert.value.longitude!],
      {
        radius: 10,
        fillColor: sevColor,
        color: '#fff',
        weight: 2,
        fillOpacity: 0.9
      }
    ).addTo(mapInstance).bindPopup(
      `<strong>${alert.value.ruleName}</strong><br/>Severity: ${alert.value.severity}`
    )
  }

  // Add geozone polygon overlay
  if (alert.value.geozoneGeometry) {
    try {
      const geojson = typeof alert.value.geozoneGeometry === 'string'
        ? JSON.parse(alert.value.geozoneGeometry)
        : alert.value.geozoneGeometry
      const geoColor = alert.value.geozoneColor || '#137fec'

      const geoLayer = L.geoJSON(geojson, {
        style: {
          color: geoColor,
          weight: 2,
          fillOpacity: 0.15,
          fillColor: geoColor
        }
      }).addTo(mapInstance)

      // Fit bounds to include both marker and polygon
      if (hasPosition) {
        const bounds = geoLayer.getBounds()
        bounds.extend([alert.value.latitude!, alert.value.longitude!])
        mapInstance.fitBounds(bounds, { padding: [40, 40] })
      } else {
        mapInstance.fitBounds(geoLayer.getBounds(), { padding: [40, 40] })
      }
    } catch (err) {
      console.error('Error rendering geozone polygon:', err)
    }
  }

  // Handle resize
  setTimeout(() => {
    mapInstance?.invalidateSize()
  }, 200)

  // Set up ResizeObserver
  if (mapElement.value) {
    resizeObserver = new ResizeObserver(() => {
      mapInstance?.invalidateSize()
    })
    resizeObserver.observe(mapElement.value)
  }
}

// ============================================================================
// Data Fetching
// ============================================================================

const fetchAlert = async () => {
  if (!props.alertId) {
    error.value = 'No alert ID provided'
    loading.value = false
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`${API_BASE_URL}/api/alerts/${props.alertId}`)
    if (!response.ok) throw new Error('Failed to fetch alert')

    const result = await response.json()
    if (result.success && result.data) {
      alert.value = result.data
    } else {
      throw new Error(result.error || 'Alert not found')
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load alert details'
    console.error('Error loading alert:', err)
  } finally {
    loading.value = false
  }
}

const fetchHistory = async () => {
  if (!props.alertId) return
  historyLoading.value = true

  try {
    const response = await fetch(`${API_BASE_URL}/api/alerts/${props.alertId}/history`)
    if (!response.ok) throw new Error('Failed to fetch history')

    const result = await response.json()
    if (result.success && result.data) {
      history.value = result.data
    } else if (Array.isArray(result)) {
      history.value = result
    }
  } catch (err) {
    console.error('Error loading alert history:', err)
    history.value = []
  } finally {
    historyLoading.value = false
  }
}

// ============================================================================
// Workflow Actions
// ============================================================================

const performTransition = async (targetStatus: string) => {
  if (!props.alertId || transitioning.value) return
  transitioning.value = true

  try {
    const body: Record<string, unknown> = {
      status: targetStatus,
      comment: transitionComment.value.trim() || undefined
    }

    const response = await fetch(`${API_BASE_URL}/api/alerts/${props.alertId}/transition`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errResult = await response.json().catch(() => ({}))
      throw new Error(errResult.error || 'Failed to transition alert')
    }

    // Refresh data
    transitionComment.value = ''
    await fetchAlert()
    await fetchHistory()
  } catch (err) {
    console.error('Error transitioning alert:', err)
    error.value = err instanceof Error ? err.message : 'Failed to update alert status'
  } finally {
    transitioning.value = false
  }
}

const performSnooze = async (hours: number) => {
  if (!props.alertId || transitioning.value) return
  transitioning.value = true

  try {
    const snoozedUntil = new Date(Date.now() + hours * 3600000).toISOString()

    const body: Record<string, unknown> = {
      status: 'snoozed',
      comment: transitionComment.value.trim() || `Snoozed for ${hours} hour${hours > 1 ? 's' : ''}`,
      snoozedUntil
    }

    const response = await fetch(`${API_BASE_URL}/api/alerts/${props.alertId}/transition`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errResult = await response.json().catch(() => ({}))
      throw new Error(errResult.error || 'Failed to snooze alert')
    }

    transitionComment.value = ''
    showSnoozeOptions.value = false
    customSnoozeHours.value = null
    await fetchAlert()
    await fetchHistory()
  } catch (err) {
    console.error('Error snoozing alert:', err)
    error.value = err instanceof Error ? err.message : 'Failed to snooze alert'
  } finally {
    transitioning.value = false
  }
}

const performCustomSnooze = () => {
  if (customSnoozeHours.value && customSnoozeHours.value > 0) {
    performSnooze(customSnoozeHours.value)
  }
}

// ============================================================================
// Navigation
// ============================================================================

const navigateToAsset = () => {
  if (alert.value?.assetId) {
    emit('selectAsset', alert.value.assetId)
  }
}

const navigateToGeozone = () => {
  if (alert.value?.geozoneId) {
    emit('selectGeozone', alert.value.geozoneId)
  }
}

// ============================================================================
// Close Handler
// ============================================================================

const handleClose = () => {
  visible.value = false
  emit('close')
}

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(async () => {
  await fetchAlert()
  if (alert.value) {
    fetchHistory()
    await nextTick()
    const hasMapData = (alert.value.latitude != null && alert.value.longitude != null)
      || (alert.value.geozoneCenterLat != null && alert.value.geozoneCenterLng != null)
      || alert.value.geozoneGeometry != null
    if (hasMapData) {
      setTimeout(() => initializeMap(), 150)
    }
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
})

watch(
  () => props.alertId,
  async (newId) => {
    if (newId) {
      await fetchAlert()
      if (alert.value) {
        fetchHistory()
        await nextTick()
        setTimeout(() => initializeMap(), 150)
      }
    }
  }
)
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="alert ? `Alert - ${alert.ruleName}` : 'Alert Details'"
    :modal="true"
    :maximizable="true"
    :closable="true"
    :draggable="false"
    class="alert-detail-dialog"
    :style="{ width: '95vw', maxWidth: '1200px' }"
    @hide="handleClose"
  >
    <!-- ================================================================ -->
    <!-- Header -->
    <!-- ================================================================ -->
    <template #header>
      <div class="flex justify-between items-center w-full pr-8">
        <div class="flex flex-col gap-1.5">
          <h3 class="m-0 text-xl font-semibold text-white">
            {{ alert?.ruleName || 'Loading...' }}
          </h3>
          <div v-if="alert" class="flex items-center gap-2 flex-wrap">
            <!-- Severity badge -->
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border"
              :style="{
                backgroundColor: getSeverityColor(alert.severity) + '1a',
                color: getSeverityColor(alert.severity),
                borderColor: getSeverityColor(alert.severity) + '4d'
              }"
            >
              <span class="material-symbols-outlined text-[14px] mr-1">warning</span>
              {{ alert.severity }}
            </span>
            <!-- Status badge -->
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider"
              :style="{
                backgroundColor: getStatusColor(alert.status) + '1a',
                color: getStatusColor(alert.status)
              }"
            >
              <span
                class="w-1.5 h-1.5 rounded-full mr-1.5"
                :style="{ backgroundColor: getStatusColor(alert.status) }"
              ></span>
              {{ formatStatus(alert.status) }}
            </span>
            <!-- Scope badge -->
            <span
              v-if="alert.ruleScope"
              class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider"
              :class="alert.ruleScope === 'device' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'bg-teal-500/10 text-teal-400 border border-teal-500/30'"
            >
              <span class="material-symbols-outlined text-[12px]">{{ alert.ruleScope === 'device' ? 'router' : 'inventory_2' }}</span>
              {{ alert.ruleScope }}
            </span>
            <!-- Snoozed until indicator -->
            <span
              v-if="alert.status === 'snoozed' && alert.snoozedUntil"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs text-gray-400 bg-gray-500/10"
            >
              <span class="material-symbols-outlined text-[14px] mr-1">snooze</span>
              Until {{ formatDateTime(alert.snoozedUntil) }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- ================================================================ -->
    <!-- Loading State -->
    <!-- ================================================================ -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-16 gap-4">
      <div class="w-10 h-10 border-4 border-border-dark border-t-primary rounded-full animate-spin"></div>
      <p class="text-text-secondary text-sm">Loading alert details...</p>
    </div>

    <!-- ================================================================ -->
    <!-- Error State -->
    <!-- ================================================================ -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <span class="material-symbols-outlined text-4xl text-red-400">error</span>
      <h3 class="text-white text-lg font-semibold m-0">Error Loading Alert</h3>
      <p class="text-text-secondary m-0">{{ error }}</p>
      <button
        class="mt-2 px-4 py-2 rounded-lg bg-surface-dark-highlight border border-border-dark text-white text-sm hover:border-primary transition-colors cursor-pointer"
        @click="fetchAlert"
      >
        Retry
      </button>
    </div>

    <!-- ================================================================ -->
    <!-- Content -->
    <!-- ================================================================ -->
    <div v-else-if="alert" class="flex flex-col gap-5">

      <!-- ============================================================ -->
      <!-- Map Panel -->
      <!-- ============================================================ -->
      <div class="bg-surface-dark-highlight rounded-xl border border-border-dark overflow-hidden">
        <div class="px-4 py-3 border-b border-border-dark flex items-center gap-2.5">
          <div class="p-1.5 rounded-lg bg-primary/10 text-primary">
            <span class="material-symbols-outlined text-[18px]">map</span>
          </div>
          <h4 class="text-white font-semibold text-sm m-0">Alert Location</h4>
        </div>
        <div class="relative" style="height: 300px">
          <!-- No location data -->
          <div
            v-if="!alert.latitude && !alert.longitude && !alert.geozoneCenterLat && !alert.geozoneCenterLng"
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background-dark"
          >
            <span class="material-symbols-outlined text-4xl text-text-secondary">location_off</span>
            <p class="text-text-secondary text-sm m-0">No location data available for this alert</p>
          </div>
          <!-- Map container -->
          <div
            v-show="alert.latitude || alert.longitude || alert.geozoneCenterLat || alert.geozoneCenterLng"
            ref="mapElement"
            class="absolute inset-0 w-full h-full"
          ></div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Info Panel (2-column grid) -->
      <!-- ============================================================ -->
      <div class="bg-surface-dark-highlight rounded-xl border border-border-dark overflow-hidden">
        <div class="px-4 py-3 border-b border-border-dark flex items-center gap-2.5">
          <div class="p-1.5 rounded-lg bg-primary/10 text-primary">
            <span class="material-symbols-outlined text-[18px]">info</span>
          </div>
          <h4 class="text-white font-semibold text-sm m-0">Alert Information</h4>
        </div>
        <div class="p-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <!-- Rule Name -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">rule</span>
                Rule Name
              </span>
              <span class="text-white text-sm">{{ alert.ruleName }}</span>
            </div>

            <!-- Alert Type -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">category</span>
                Alert Type
              </span>
              <div>
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-primary/10 text-primary border-primary/30"
                >
                  {{ formatAlertType(alert.alertType) }}
                </span>
              </div>
            </div>

            <!-- Asset (clickable) -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">inventory_2</span>
                Asset
              </span>
              <span
                v-if="alert.assetId && alert.assetName"
                class="text-primary text-sm cursor-pointer hover:underline inline-flex items-center gap-1"
                @click="navigateToAsset"
              >
                {{ alert.assetName }}
                <span class="material-symbols-outlined text-[14px]">open_in_new</span>
              </span>
              <span v-else class="text-text-secondary text-sm italic">Not linked</span>
            </div>

            <!-- Geozone (clickable) -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">fence</span>
                Geozone
              </span>
              <span
                v-if="alert.geozoneId && alert.geozoneName"
                class="text-primary text-sm cursor-pointer hover:underline inline-flex items-center gap-1"
                @click="navigateToGeozone"
              >
                {{ alert.geozoneName }}
                <span class="material-symbols-outlined text-[14px]">open_in_new</span>
              </span>
              <span v-else class="text-text-secondary text-sm italic">Not linked</span>
            </div>

            <!-- SLA Deadline -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">timer</span>
                SLA Deadline
              </span>
              <span v-if="alert.slaDeadline" :class="['text-sm font-medium', isOverdue ? 'text-red-400' : 'text-white']">
                {{ formatDateTime(alert.slaDeadline) }}
                <span v-if="isOverdue" class="inline-flex items-center ml-2 px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/30">
                  <span class="material-symbols-outlined text-[12px] mr-0.5">warning</span>
                  OVERDUE
                </span>
              </span>
              <span v-else class="text-text-secondary text-sm italic">No deadline set</span>
            </div>

            <!-- Assigned To -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">person</span>
                Assigned To
              </span>
              <span :class="alert.assignedTo ? 'text-white text-sm' : 'text-text-secondary text-sm italic'">
                {{ alert.assignedTo || 'Unassigned' }}
              </span>
            </div>

            <!-- Created -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">schedule</span>
                Created
              </span>
              <span class="text-white text-sm">{{ formatDateTime(alert.createdAt) }}</span>
            </div>

            <!-- Updated -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">update</span>
                Updated
              </span>
              <span class="text-white text-sm">{{ formatDateTime(alert.updatedAt) }}</span>
            </div>

            <!-- Message (full width) -->
            <div v-if="alert.description" class="flex flex-col gap-1.5 sm:col-span-2">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">description</span>
                Message
              </span>
              <span class="text-white text-sm leading-relaxed">{{ alert.description }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Workflow Panel -->
      <!-- ============================================================ -->
      <div class="bg-surface-dark-highlight rounded-xl border border-border-dark overflow-hidden">
        <div class="px-4 py-3 border-b border-border-dark flex items-center gap-2.5">
          <div class="p-1.5 rounded-lg bg-primary/10 text-primary">
            <span class="material-symbols-outlined text-[18px]">account_tree</span>
          </div>
          <h4 class="text-white font-semibold text-sm m-0">Workflow</h4>
        </div>
        <div class="p-5 flex flex-col gap-6">

          <!-- Status Flow Visualization -->
          <div class="flex items-center justify-between gap-1 overflow-x-auto pb-2">
            <template v-for="(step, index) in STATUS_FLOW" :key="step">
              <!-- Step indicator -->
              <div class="flex flex-col items-center gap-2 min-w-[80px]">
                <div
                  class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all"
                  :style="{
                    backgroundColor:
                      index < currentStepIndex ? '#22c55e1a'
                      : index === currentStepIndex ? getStatusColor(alert.status) + '1a'
                      : '#6b72801a',
                    borderColor:
                      index < currentStepIndex ? '#22c55e'
                      : index === currentStepIndex ? getStatusColor(alert.status)
                      : '#374151',
                    color:
                      index < currentStepIndex ? '#22c55e'
                      : index === currentStepIndex ? getStatusColor(alert.status)
                      : '#6b7280'
                  }"
                >
                  <span v-if="index < currentStepIndex" class="material-symbols-outlined text-[18px]">check</span>
                  <span v-else>{{ index + 1 }}</span>
                </div>
                <span
                  class="text-xs font-medium text-center whitespace-nowrap"
                  :style="{
                    color:
                      index < currentStepIndex ? '#22c55e'
                      : index === currentStepIndex ? getStatusColor(alert.status)
                      : '#6b7280'
                  }"
                >
                  {{ formatStatus(step) }}
                </span>
              </div>
              <!-- Connector line -->
              <div
                v-if="index < STATUS_FLOW.length - 1"
                class="flex-1 h-0.5 min-w-[20px] rounded-full -mt-6"
                :style="{
                  backgroundColor: index < currentStepIndex ? '#22c55e' : '#374151'
                }"
              ></div>
            </template>
          </div>

          <!-- Snoozed/non-standard status note -->
          <div
            v-if="alert.status === 'snoozed' || alert.status === 'pending'"
            class="flex items-center gap-2 px-4 py-3 rounded-lg border"
            :style="{
              backgroundColor: getStatusColor(alert.status) + '0d',
              borderColor: getStatusColor(alert.status) + '33'
            }"
          >
            <span class="material-symbols-outlined text-[18px]" :style="{ color: getStatusColor(alert.status) }">
              {{ alert.status === 'snoozed' ? 'snooze' : 'pause_circle' }}
            </span>
            <span class="text-sm" :style="{ color: getStatusColor(alert.status) }">
              Currently <strong>{{ formatStatus(alert.status) }}</strong>
              <template v-if="alert.status === 'snoozed' && alert.snoozedUntil">
                until {{ formatDateTime(alert.snoozedUntil) }}
              </template>
            </span>
          </div>

          <!-- Comment input -->
          <div class="flex flex-col gap-2">
            <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">
              Transition Comment (optional)
            </label>
            <textarea
              v-model="transitionComment"
              rows="2"
              class="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-text-secondary/50 focus:border-primary focus:outline-none resize-none transition-colors"
              placeholder="Add a comment about this status change..."
              :disabled="transitioning"
            ></textarea>
          </div>

          <!-- Transition Buttons -->
          <div v-if="availableTransitions.length > 0 || canSnooze" class="flex flex-wrap items-center gap-3">
            <button
              v-for="targetStatus in availableTransitions"
              :key="targetStatus"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              :style="{
                backgroundColor: getStatusColor(targetStatus) + '1a',
                borderColor: getStatusColor(targetStatus) + '4d',
                color: getStatusColor(targetStatus)
              }"
              :disabled="transitioning"
              @click="performTransition(targetStatus)"
            >
              <span class="material-symbols-outlined text-[18px]">{{ getTransitionIcon(targetStatus) }}</span>
              {{ getTransitionLabel(targetStatus) }}
            </button>

            <!-- Snooze button + dropdown -->
            <div v-if="canSnooze" class="relative">
              <button
                class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-500/30 bg-gray-500/10 text-gray-400 transition-all cursor-pointer hover:border-gray-400 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="transitioning"
                @click="showSnoozeOptions = !showSnoozeOptions"
              >
                <span class="material-symbols-outlined text-[18px]">snooze</span>
                Snooze
                <span class="material-symbols-outlined text-[14px]">
                  {{ showSnoozeOptions ? 'expand_less' : 'expand_more' }}
                </span>
              </button>

              <!-- Snooze dropdown -->
              <div
                v-if="showSnoozeOptions"
                class="absolute top-full left-0 mt-2 w-64 bg-surface-dark border border-border-dark rounded-xl shadow-xl z-50 overflow-hidden"
              >
                <div class="p-2 flex flex-col gap-1">
                  <button
                    v-for="option in SNOOZE_OPTIONS"
                    :key="option.hours"
                    class="w-full text-left px-3 py-2 rounded-lg text-sm text-white hover:bg-surface-dark-highlight transition-colors cursor-pointer"
                    :disabled="transitioning"
                    @click="performSnooze(option.hours)"
                  >
                    {{ option.label }}
                  </button>
                  <div class="border-t border-border-dark my-1"></div>
                  <div class="flex items-center gap-2 px-3 py-2">
                    <input
                      v-model.number="customSnoozeHours"
                      type="number"
                      min="1"
                      max="720"
                      class="flex-1 bg-background-dark border border-border-dark rounded-lg px-3 py-1.5 text-white text-sm focus:border-primary focus:outline-none"
                      placeholder="Custom hours"
                      @keydown.enter="performCustomSnooze"
                    />
                    <button
                      class="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary border border-primary/30 cursor-pointer hover:bg-primary/20 transition-colors disabled:opacity-50"
                      :disabled="!customSnoozeHours || customSnoozeHours <= 0 || transitioning"
                      @click="performCustomSnooze"
                    >
                      Set
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Loading indicator -->
            <div v-if="transitioning" class="flex items-center gap-2 text-text-secondary text-sm">
              <div class="w-4 h-4 border-2 border-border-dark border-t-primary rounded-full animate-spin"></div>
              Updating...
            </div>
          </div>

          <!-- Resolved indicator -->
          <div
            v-if="alert.status === 'resolved'"
            class="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30"
          >
            <span class="material-symbols-outlined text-green-400 text-[20px]">check_circle</span>
            <span class="text-green-400 text-sm font-medium">This alert has been resolved.</span>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- History Panel (Timeline) -->
      <!-- ============================================================ -->
      <div class="bg-surface-dark-highlight rounded-xl border border-border-dark overflow-hidden">
        <div class="px-4 py-3 border-b border-border-dark flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="p-1.5 rounded-lg bg-primary/10 text-primary">
              <span class="material-symbols-outlined text-[18px]">history</span>
            </div>
            <h4 class="text-white font-semibold text-sm m-0">History</h4>
          </div>
          <span class="text-text-secondary text-xs">
            {{ history.length }} event{{ history.length !== 1 ? 's' : '' }}
          </span>
        </div>
        <div class="p-5">
          <!-- Loading -->
          <div v-if="historyLoading" class="flex items-center justify-center py-8 gap-3">
            <div class="w-6 h-6 border-2 border-border-dark border-t-primary rounded-full animate-spin"></div>
            <span class="text-text-secondary text-sm">Loading history...</span>
          </div>

          <!-- Empty -->
          <div v-else-if="history.length === 0" class="flex flex-col items-center justify-center py-8 gap-2">
            <span class="material-symbols-outlined text-3xl text-text-secondary">history_toggle_off</span>
            <p class="text-text-secondary text-sm m-0">No history entries yet</p>
          </div>

          <!-- Timeline -->
          <div v-else class="flex flex-col">
            <div
              v-for="(entry, index) in history"
              :key="entry.id"
              class="flex gap-4 relative"
            >
              <!-- Timeline connector -->
              <div class="flex flex-col items-center">
                <!-- Dot -->
                <div
                  class="w-3 h-3 rounded-full border-2 z-10 flex-shrink-0"
                  :style="{
                    borderColor: getStatusColor(entry.toStatus),
                    backgroundColor: index === 0 ? getStatusColor(entry.toStatus) : 'transparent'
                  }"
                ></div>
                <!-- Line -->
                <div
                  v-if="index < history.length - 1"
                  class="w-0.5 flex-1 min-h-[40px] bg-border-dark"
                ></div>
              </div>

              <!-- Content -->
              <div class="flex-1 pb-5 -mt-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <!-- From status -->
                  <span
                    v-if="entry.fromStatus"
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    :style="{
                      backgroundColor: getStatusColor(entry.fromStatus) + '1a',
                      color: getStatusColor(entry.fromStatus)
                    }"
                  >
                    {{ formatStatus(entry.fromStatus) }}
                  </span>
                  <span v-if="entry.fromStatus" class="material-symbols-outlined text-text-secondary text-[14px]">arrow_forward</span>
                  <!-- To status -->
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    :style="{
                      backgroundColor: getStatusColor(entry.toStatus) + '1a',
                      color: getStatusColor(entry.toStatus)
                    }"
                  >
                    {{ formatStatus(entry.toStatus) }}
                  </span>
                </div>

                <!-- Meta info -->
                <div class="flex items-center gap-3 mt-1.5 text-xs text-text-secondary">
                  <span v-if="entry.changedBy" class="inline-flex items-center gap-1">
                    <span class="material-symbols-outlined text-[12px]">person</span>
                    {{ entry.changedBy }}
                  </span>
                  <span class="inline-flex items-center gap-1">
                    <span class="material-symbols-outlined text-[12px]">schedule</span>
                    {{ formatDateTime(entry.createdAt) }}
                  </span>
                  <span class="text-text-secondary/50">{{ formatRelativeTime(entry.createdAt) }}</span>
                </div>

                <!-- Comment -->
                <div
                  v-if="entry.comment"
                  class="mt-2 px-3 py-2 rounded-lg bg-background-dark border border-border-dark text-sm text-white/80 leading-relaxed"
                >
                  {{ entry.comment }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ================================================================ -->
    <!-- Footer -->
    <!-- ================================================================ -->
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button label="Close" @click="handleClose" severity="secondary" outlined>
          <template #icon>
            <span class="material-symbols-outlined text-[18px] mr-1.5">close</span>
          </template>
        </Button>
      </div>
    </template>
  </Dialog>
</template>

<style>
/* ================================================================ */
/* Global PrimeVue Dialog Dark Theme - Alert Detail                 */
/* ================================================================ */

.alert-detail-dialog .p-dialog {
  background: var(--surface-dark, #18222c) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  border-radius: 1rem !important;
}

.alert-detail-dialog .p-dialog-header {
  background: var(--surface-dark, #18222c) !important;
  border-bottom: 1px solid var(--border-dark, #283039) !important;
  padding: 1.25rem 1.5rem !important;
  border-radius: 1rem 1rem 0 0 !important;
}

.alert-detail-dialog .p-dialog-header .p-dialog-title {
  display: none;
}

.alert-detail-dialog .p-dialog-header-icons {
  position: absolute;
  right: 1rem;
  top: 1rem;
}

.alert-detail-dialog .p-dialog-header-icon {
  color: var(--text-secondary, #9faab6) !important;
}

.alert-detail-dialog .p-dialog-header-icon:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
  color: white !important;
}

.alert-detail-dialog .p-dialog-content {
  background: var(--surface-dark, #18222c) !important;
  padding: 1.5rem !important;
  color: white !important;
}

.alert-detail-dialog .p-dialog-footer {
  background: var(--surface-dark, #18222c) !important;
  border-top: 1px solid var(--border-dark, #283039) !important;
  padding: 1rem 1.5rem !important;
  border-radius: 0 0 1rem 1rem !important;
}

/* Tag styling */
.alert-detail-dialog .p-tag {
  font-size: 0.75rem !important;
  font-weight: 600 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
}

/* Button styling for dark theme */
.alert-detail-dialog .p-button.p-button-outlined {
  border-color: var(--border-dark, #283039) !important;
  color: white !important;
}

.alert-detail-dialog .p-button.p-button-outlined:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
  border-color: var(--primary, #137fec) !important;
}

/* Leaflet controls dark theme */
.alert-detail-dialog .leaflet-control-zoom a {
  background: #18222c !important;
  color: #fff !important;
  border-color: #283039 !important;
}

.alert-detail-dialog .leaflet-control-zoom a:hover {
  background: #202b36 !important;
}

.alert-detail-dialog .leaflet-control-attribution {
  background: rgba(24, 34, 44, 0.8) !important;
  color: #9faab6 !important;
}

.alert-detail-dialog .leaflet-control-attribution a {
  color: #137fec !important;
}
</style>

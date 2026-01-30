<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// PrimeVue components
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Panel from 'primevue/panel'
import ProgressBar from 'primevue/progressbar'

// Props
const props = defineProps<{
  assetId: string | null
  onClose: () => void
}>()

// Emit
const emit = defineEmits<{
  close: []
}>()

// ---------- Types ----------
interface Asset {
  id: string
  name: string
  assetType: string
  barcode: string | null
  birthDate: string | null
  currentStatus: string
  deviceId: string | null
  deviceName: string | null
  deviceLatitude: number | null
  deviceLongitude: number | null
  deviceStatus: string | null
  deviceBattery: number | null
  tripCount: number | null
  lastTripDate: string | null
  recycledContent: number | null
  composition: Record<string, unknown> | null
  certificationStatus: string | null
  complianceExpiry: string | null
  labels: string[] | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

interface AssetTrip {
  id: string
  origin: string
  destination: string
  departedAt: string | null
  arrivedAt: string | null
  status: string
  distanceKm: number | null
}

interface GeozoneEvent {
  id: string
  eventType: string
  geozoneName: string
  occurredAt: string
}

// Sprint 4: Status History & Custody Chain types
interface StatusHistoryEntry {
  id: string
  previousStatus: string | null
  newStatus: string
  source: string
  geozoneName: string | null
  changedByName: string | null
  createdAt: string
}

interface ResponsibilityTransfer {
  id: string
  fromEntityType: string | null
  fromEntityName: string | null
  fromGeozoneName: string | null
  toEntityType: string | null
  toEntityName: string | null
  toGeozoneName: string | null
  custodyDurationSeconds: number | null
  transferredAt: string
}

// ---------- Reactive state ----------
const visible = ref(true)
const loading = ref(true)
const error = ref('')
const asset = ref<Asset | null>(null)
const trips = ref<AssetTrip[]>([])
const geozoneEvents = ref<GeozoneEvent[]>([])
const tripsLoading = ref(false)
const eventsLoading = ref(false)
// Sprint 4
const statusHistory = ref<StatusHistoryEntry[]>([])
const custodyChain = ref<ResponsibilityTransfer[]>([])
const statusHistoryLoading = ref(false)
const custodyLoading = ref(false)

// Leaflet map refs
const mapRef = ref<HTMLElement | null>(null)
let mapInstance: L.Map | null = null

const API_BASE_URL = window.location.origin

// ---------- Status helpers ----------
const statusColorMap: Record<string, string> = {
  at_facility: 'success',
  in_transit: 'info',
  at_customer: 'help',
  at_supplier: 'warn',
  stored: 'secondary',
  unknown: 'secondary'
}

const getStatusSeverity = (status: string): string => {
  return statusColorMap[status] || 'secondary'
}

const getStatusLabel = (status: string): string => {
  return status.replace(/_/g, ' ')
}

const getEventTypeSeverity = (eventType: string): string => {
  switch (eventType.toLowerCase()) {
    case 'enter': return 'success'
    case 'exit': return 'danger'
    case 'dwell': return 'info'
    default: return 'secondary'
  }
}

const getTripStatusSeverity = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'completed': return 'success'
    case 'in_progress':
    case 'in_transit': return 'info'
    case 'cancelled': return 'danger'
    case 'planned': return 'warn'
    default: return 'secondary'
  }
}

// ---------- Date formatting ----------
const formatDate = (dateString?: string | null): string => {
  if (!dateString) return 'N/A'
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return dateString
  }
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

// ---------- Map ----------
const initMap = () => {
  if (!mapRef.value || !asset.value?.deviceLatitude || !asset.value?.deviceLongitude) return
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }

  mapInstance = L.map(mapRef.value).setView(
    [asset.value.deviceLatitude, asset.value.deviceLongitude],
    14
  )

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(mapInstance)

  L.circleMarker(
    [asset.value.deviceLatitude, asset.value.deviceLongitude],
    {
      radius: 8,
      fillColor: '#137fec',
      color: '#fff',
      weight: 2,
      fillOpacity: 0.8
    }
  ).addTo(mapInstance)

  // Fix tiles not loading due to container size
  setTimeout(() => {
    mapInstance?.invalidateSize()
  }, 200)
}

// ---------- Data fetching ----------
const fetchAsset = async () => {
  if (!props.assetId) {
    error.value = 'No asset ID provided'
    loading.value = false
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`${API_BASE_URL}/api/assets/${props.assetId}`)
    if (!response.ok) throw new Error('Failed to fetch asset')

    const result = await response.json()
    if (result.success && result.data) {
      asset.value = result.data
    } else {
      throw new Error(result.error || 'Asset not found')
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load asset details'
    console.error('Error loading asset:', err)
  } finally {
    loading.value = false
  }
}

const fetchTrips = async () => {
  if (!props.assetId) return
  tripsLoading.value = true

  try {
    const response = await fetch(`${API_BASE_URL}/api/asset-trips?asset_id=${props.assetId}`)
    if (!response.ok) throw new Error('Failed to fetch trips')

    const result = await response.json()
    if (result.success && result.data) {
      trips.value = result.data
    }
  } catch (err) {
    console.error('Error loading trips:', err)
  } finally {
    tripsLoading.value = false
  }
}

const fetchGeozoneEvents = async () => {
  if (!props.assetId) return
  eventsLoading.value = true

  try {
    const response = await fetch(`${API_BASE_URL}/api/geozone-events?asset_id=${props.assetId}`)
    if (!response.ok) throw new Error('Failed to fetch geozone events')

    const result = await response.json()
    if (result.success && result.data) {
      geozoneEvents.value = result.data
    }
  } catch (err) {
    console.error('Error loading geozone events:', err)
  } finally {
    eventsLoading.value = false
  }
}

// Sprint 4: Fetch status history
const fetchStatusHistory = async () => {
  if (!props.assetId) return
  statusHistoryLoading.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/status-inference/assets/${props.assetId}/status-history`)
    if (!response.ok) throw new Error('Failed to fetch status history')
    const result = await response.json()
    if (result.success && result.data) {
      statusHistory.value = result.data
    }
  } catch (err) {
    console.error('Error loading status history:', err)
  } finally {
    statusHistoryLoading.value = false
  }
}

// Sprint 4: Fetch custody chain
const fetchCustodyChain = async () => {
  if (!props.assetId) return
  custodyLoading.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/responsibility-transfers/assets/${props.assetId}`)
    if (!response.ok) throw new Error('Failed to fetch custody chain')
    const result = await response.json()
    if (result.success && result.data) {
      custodyChain.value = result.data
    }
  } catch (err) {
    console.error('Error loading custody chain:', err)
  } finally {
    custodyLoading.value = false
  }
}

const formatDuration = (seconds: number | null): string => {
  if (!seconds) return 'N/A'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

// ---------- Close handler ----------
const handleClose = () => {
  visible.value = false
  emit('close')
  props.onClose()
}

// ---------- Lifecycle ----------
onMounted(async () => {
  await fetchAsset()

  // Fetch trips, events, status history, and custody chain in parallel
  if (asset.value) {
    fetchTrips()
    fetchGeozoneEvents()
    fetchStatusHistory()
    fetchCustodyChain()

    // Init map after DOM updates
    await nextTick()
    if (asset.value.deviceLatitude && asset.value.deviceLongitude) {
      setTimeout(() => initMap(), 100)
    }
  }
})

onBeforeUnmount(() => {
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
})

// Watch for assetId changes
watch(
  () => props.assetId,
  async (newId) => {
    if (newId) {
      await fetchAsset()
      if (asset.value) {
        fetchTrips()
        fetchGeozoneEvents()
        fetchStatusHistory()
        fetchCustodyChain()
        await nextTick()
        if (asset.value.deviceLatitude && asset.value.deviceLongitude) {
          setTimeout(() => initMap(), 100)
        }
      }
    }
  }
)
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="asset ? `Asset - ${asset.name}` : 'Asset Details'"
    :modal="true"
    :closable="true"
    :draggable="false"
    :maximizable="true"
    position="top"
    class="asset-detail-dialog"
    style="width: 95vw; max-width: 1200px"
    @hide="handleClose"
  >
    <template #header>
      <div class="dialog-header">
        <div class="header-info">
          <h3 class="asset-name">{{ asset?.name || 'Loading...' }}</h3>
          <div class="header-tags">
            <Tag v-if="asset" :value="asset.id" severity="secondary" class="id-tag" />
            <Tag
              v-if="asset?.currentStatus"
              :value="getStatusLabel(asset.currentStatus)"
              :severity="getStatusSeverity(asset.currentStatus) as any"
              class="status-tag"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="state-container">
      <i class="pi pi-spinner pi-spin" style="font-size: 2.5rem; color: var(--primary)"></i>
      <h3>Loading Asset Details</h3>
      <p>Please wait while we fetch the information...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="state-container">
      <i class="pi pi-exclamation-triangle" style="font-size: 2.5rem; color: #ef4444"></i>
      <h3>Error Loading Asset</h3>
      <p>{{ error }}</p>
    </div>

    <!-- Asset Details Content -->
    <div v-else-if="asset" class="asset-content">
      <!-- Row 1: Asset Info + Sustainability -->
      <div class="panels-row">
        <!-- Panel 1: Asset Info -->
        <Panel header="Asset Information" :toggleable="true" class="detail-panel">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">
                <span class="material-symbols-outlined info-icon">inventory_2</span>
                Name
              </span>
              <span class="info-value">{{ asset.name }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">
                <span class="material-symbols-outlined info-icon">category</span>
                Type
              </span>
              <span class="info-value">{{ asset.assetType || 'N/A' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">
                <span class="material-symbols-outlined info-icon">qr_code</span>
                Barcode
              </span>
              <span class="info-value monospace">{{ asset.barcode || 'N/A' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">
                <span class="material-symbols-outlined info-icon">flag</span>
                Status
              </span>
              <Tag
                :value="getStatusLabel(asset.currentStatus)"
                :severity="getStatusSeverity(asset.currentStatus) as any"
              />
            </div>
            <div class="info-item">
              <span class="info-label">
                <span class="material-symbols-outlined info-icon">cake</span>
                Birth Date
              </span>
              <span class="info-value">{{ formatDate(asset.birthDate) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">
                <span class="material-symbols-outlined info-icon">schedule</span>
                Created
              </span>
              <span class="info-value">{{ formatDateTime(asset.createdAt) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">
                <span class="material-symbols-outlined info-icon">update</span>
                Updated
              </span>
              <span class="info-value">{{ formatDateTime(asset.updatedAt) }}</span>
            </div>
          </div>
        </Panel>

        <!-- Panel 2: Sustainability (FR-408) -->
        <Panel header="Sustainability" :toggleable="true" class="detail-panel">
          <div class="sustainability-content">
            <!-- Recycled Content -->
            <div class="sustainability-item">
              <div class="sustainability-header">
                <span class="info-label">
                  <span class="material-symbols-outlined info-icon">recycling</span>
                  Recycled Content
                </span>
                <span class="recycled-percentage">
                  {{ asset.recycledContent !== null && asset.recycledContent !== undefined
                       ? `${asset.recycledContent}%` : 'N/A' }}
                </span>
              </div>
              <ProgressBar
                v-if="asset.recycledContent !== null && asset.recycledContent !== undefined"
                :value="asset.recycledContent"
                :showValue="false"
                class="recycled-bar"
              />
            </div>

            <!-- Composition -->
            <div class="sustainability-item">
              <span class="info-label">
                <span class="material-symbols-outlined info-icon">science</span>
                Composition
              </span>
              <div v-if="asset.composition && Object.keys(asset.composition).length > 0" class="composition-list">
                <div
                  v-for="(value, key) in asset.composition"
                  :key="String(key)"
                  class="composition-item"
                >
                  <span class="composition-key">{{ String(key) }}</span>
                  <span class="composition-value">{{ value }}</span>
                </div>
              </div>
              <span v-else class="info-value muted">No composition data</span>
            </div>

            <!-- Certification Status -->
            <div class="sustainability-item">
              <span class="info-label">
                <span class="material-symbols-outlined info-icon">verified</span>
                Certification
              </span>
              <Tag
                v-if="asset.certificationStatus"
                :value="asset.certificationStatus"
                :severity="asset.certificationStatus.toLowerCase() === 'certified' ? 'success' : 'warn'"
              />
              <span v-else class="info-value muted">Not certified</span>
            </div>

            <!-- Compliance Expiry -->
            <div class="sustainability-item">
              <span class="info-label">
                <span class="material-symbols-outlined info-icon">event_busy</span>
                Compliance Expiry
              </span>
              <span class="info-value">{{ formatDate(asset.complianceExpiry) }}</span>
            </div>
          </div>
        </Panel>
      </div>

      <!-- Row 2: Location + Associated Device -->
      <div class="panels-row">
        <!-- Panel 3: Location Map -->
        <Panel header="Location" :toggleable="true" class="detail-panel">
          <div v-if="asset.deviceLatitude && asset.deviceLongitude" class="location-content">
            <div class="location-coords">
              <span class="info-label">
                <span class="material-symbols-outlined info-icon">location_on</span>
                Coordinates
              </span>
              <span class="info-value monospace">
                {{ asset.deviceLatitude.toFixed(6) }}, {{ asset.deviceLongitude.toFixed(6) }}
              </span>
            </div>
            <div ref="mapRef" class="leaflet-map"></div>
          </div>
          <div v-else class="empty-state">
            <span class="material-symbols-outlined empty-icon">location_off</span>
            <p>No location data available</p>
            <p class="empty-hint">Device location will appear here when the associated device reports coordinates</p>
          </div>
        </Panel>

        <!-- Panel 5: Associated Device -->
        <Panel header="Associated Device" :toggleable="true" class="detail-panel">
          <div v-if="asset.deviceId" class="device-content">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">
                  <span class="material-symbols-outlined info-icon">devices</span>
                  Device Name
                </span>
                <span class="info-value">{{ asset.deviceName || 'N/A' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">
                  <span class="material-symbols-outlined info-icon">wifi</span>
                  Status
                </span>
                <Tag
                  v-if="asset.deviceStatus"
                  :value="asset.deviceStatus"
                  :severity="asset.deviceStatus.toLowerCase() === 'active' ? 'success' : 'secondary'"
                />
                <span v-else class="info-value muted">Unknown</span>
              </div>
              <div class="info-item">
                <span class="info-label">
                  <span class="material-symbols-outlined info-icon">battery_std</span>
                  Battery
                </span>
                <div v-if="asset.deviceBattery !== null && asset.deviceBattery !== undefined" class="battery-display">
                  <span class="battery-value">{{ asset.deviceBattery }}%</span>
                  <ProgressBar
                    :value="asset.deviceBattery"
                    :showValue="false"
                    class="battery-bar"
                  />
                </div>
                <span v-else class="info-value muted">N/A</span>
              </div>
              <div class="info-item">
                <span class="info-label">
                  <span class="material-symbols-outlined info-icon">my_location</span>
                  Latitude
                </span>
                <span class="info-value monospace">
                  {{ asset.deviceLatitude !== null ? asset.deviceLatitude.toFixed(6) : 'N/A' }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">
                  <span class="material-symbols-outlined info-icon">my_location</span>
                  Longitude
                </span>
                <span class="info-value monospace">
                  {{ asset.deviceLongitude !== null ? asset.deviceLongitude.toFixed(6) : 'N/A' }}
                </span>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">
            <span class="material-symbols-outlined empty-icon">devices_off</span>
            <p>No device associated</p>
            <p class="empty-hint">Link a tracking device to this asset to see device information</p>
          </div>
        </Panel>
      </div>

      <!-- Row 3: Trip History (FR-407) -->
      <Panel header="Trip History" :toggleable="true" class="detail-panel">
        <div v-if="tripsLoading" class="panel-loading">
          <i class="pi pi-spinner pi-spin"></i>
          <span>Loading trips...</span>
        </div>
        <div v-else-if="trips.length > 0" class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Origin</th>
                <th>Destination</th>
                <th>Departed</th>
                <th>Arrived</th>
                <th>Status</th>
                <th>Distance</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="trip in trips" :key="trip.id">
                <td>{{ trip.origin || 'N/A' }}</td>
                <td>{{ trip.destination || 'N/A' }}</td>
                <td>{{ formatDateTime(trip.departedAt) }}</td>
                <td>{{ formatDateTime(trip.arrivedAt) }}</td>
                <td>
                  <Tag
                    :value="trip.status.replace(/_/g, ' ')"
                    :severity="getTripStatusSeverity(trip.status) as any"
                  />
                </td>
                <td>{{ trip.distanceKm !== null ? `${trip.distanceKm} km` : 'N/A' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty-state">
          <span class="material-symbols-outlined empty-icon">route</span>
          <p>No trip history available</p>
        </div>
      </Panel>

      <!-- Row 4: Labels & Metadata (FR-406) + Recent Events -->
      <div class="panels-row">
        <!-- Panel 6: Labels & Metadata -->
        <Panel header="Labels &amp; Metadata" :toggleable="true" class="detail-panel">
          <div class="labels-metadata-content">
            <!-- Labels -->
            <div class="section-block">
              <span class="info-label">
                <span class="material-symbols-outlined info-icon">label</span>
                Labels
              </span>
              <div v-if="asset.labels && asset.labels.length > 0" class="labels-container">
                <Tag
                  v-for="label in asset.labels"
                  :key="label"
                  :value="label"
                  severity="info"
                  class="label-chip"
                />
              </div>
              <span v-else class="info-value muted">No labels assigned</span>
            </div>

            <!-- Metadata -->
            <div class="section-block">
              <span class="info-label">
                <span class="material-symbols-outlined info-icon">data_object</span>
                Metadata
              </span>
              <div v-if="asset.metadata && Object.keys(asset.metadata).length > 0" class="metadata-list">
                <div
                  v-for="(value, key) in asset.metadata"
                  :key="String(key)"
                  class="metadata-item"
                >
                  <span class="metadata-key">{{ String(key) }}</span>
                  <span class="metadata-value">{{ typeof value === 'object' ? JSON.stringify(value) : String(value) }}</span>
                </div>
              </div>
              <span v-else class="info-value muted">No metadata</span>
            </div>
          </div>
        </Panel>

        <!-- Panel 7: Recent Geozone Events -->
        <Panel header="Recent Events" :toggleable="true" class="detail-panel">
          <div v-if="eventsLoading" class="panel-loading">
            <i class="pi pi-spinner pi-spin"></i>
            <span>Loading events...</span>
          </div>
          <div v-else-if="geozoneEvents.length > 0" class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Event Type</th>
                  <th>Geozone Name</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="event in geozoneEvents" :key="event.id">
                  <td>
                    <Tag
                      :value="event.eventType"
                      :severity="getEventTypeSeverity(event.eventType) as any"
                    />
                  </td>
                  <td>{{ event.geozoneName }}</td>
                  <td>{{ formatDateTime(event.occurredAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty-state">
            <span class="material-symbols-outlined empty-icon">notifications_off</span>
            <p>No recent geozone events</p>
          </div>
        </Panel>
      </div>

      <!-- Sprint 4: Row 5 - Status History & Custody Chain -->
      <div class="panels-row">
        <!-- Panel 8: Status History -->
        <Panel header="Status History" :toggleable="true" class="detail-panel">
          <div v-if="statusHistoryLoading" class="panel-loading">
            <i class="pi pi-spinner pi-spin"></i>
            <span>Loading status history...</span>
          </div>
          <div v-else-if="statusHistory.length > 0" class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Source</th>
                  <th>Geozone</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in statusHistory" :key="entry.id">
                  <td>
                    <Tag v-if="entry.previousStatus"
                      :value="getStatusLabel(entry.previousStatus)"
                      :severity="(getStatusSeverity(entry.previousStatus)) as any"
                    />
                    <span v-else class="info-value muted">--</span>
                  </td>
                  <td>
                    <Tag
                      :value="getStatusLabel(entry.newStatus)"
                      :severity="(getStatusSeverity(entry.newStatus)) as any"
                    />
                  </td>
                  <td>
                    <span :class="entry.source === 'auto' ? 'text-blue-400' : 'text-amber-400'" class="text-xs font-medium px-1.5 py-0.5 rounded" :style="{ background: entry.source === 'auto' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)' }">
                      {{ entry.source }}
                    </span>
                  </td>
                  <td>{{ entry.geozoneName || '--' }}</td>
                  <td>{{ formatDateTime(entry.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty-state">
            <span class="material-symbols-outlined empty-icon">history</span>
            <p>No status changes recorded</p>
          </div>
        </Panel>

        <!-- Panel 9: Custody Chain -->
        <Panel header="Custody Chain" :toggleable="true" class="detail-panel">
          <div v-if="custodyLoading" class="panel-loading">
            <i class="pi pi-spinner pi-spin"></i>
            <span>Loading custody chain...</span>
          </div>
          <div v-else-if="custodyChain.length > 0" class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Duration</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="transfer in custodyChain" :key="transfer.id">
                  <td>
                    <div class="flex flex-col">
                      <span class="text-white text-xs font-medium">{{ transfer.fromEntityName || '--' }}</span>
                      <span v-if="transfer.fromEntityType" class="text-text-secondary text-[11px]">{{ transfer.fromEntityType }}</span>
                    </div>
                  </td>
                  <td>
                    <div class="flex flex-col">
                      <span class="text-white text-xs font-medium">{{ transfer.toEntityName || '--' }}</span>
                      <span v-if="transfer.toEntityType" class="text-text-secondary text-[11px]">{{ transfer.toEntityType }}</span>
                    </div>
                  </td>
                  <td>
                    <span class="text-primary font-medium text-xs">{{ formatDuration(transfer.custodyDurationSeconds) }}</span>
                  </td>
                  <td>{{ formatDateTime(transfer.transferredAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty-state">
            <span class="material-symbols-outlined empty-icon">swap_horiz</span>
            <p>No custody transfers recorded</p>
          </div>
        </Panel>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <button class="close-btn" @click="handleClose">
          <span class="material-symbols-outlined">close</span>
          Close
        </button>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
/* ----- Layout ----- */
.asset-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.panels-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

/* ----- Dialog Header ----- */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.asset-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: white;
}

.header-tags {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.id-tag {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.75rem;
}

.status-tag {
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
}

/* ----- State containers ----- */
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  gap: 1rem;
}

.state-container h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: white;
}

.state-container p {
  margin: 0;
  color: var(--text-secondary, #9faab6);
}

/* ----- Info Grid ----- */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.25rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.info-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-weight: 600;
  font-size: 0.8rem;
  color: var(--text-secondary, #9faab6);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.info-icon {
  font-size: 1rem;
  color: var(--text-secondary, #9faab6);
}

.info-value {
  font-size: 0.9375rem;
  color: white;
}

.info-value.monospace {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875rem;
  letter-spacing: 0.02em;
}

.info-value.muted {
  color: var(--text-secondary, #9faab6);
  font-style: italic;
}

/* ----- Sustainability Panel ----- */
.sustainability-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sustainability-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sustainability-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.recycled-percentage {
  font-size: 1.125rem;
  font-weight: 700;
  color: #10b981;
}

.recycled-bar {
  height: 8px;
  border-radius: 4px;
}

/* Composition list */
.composition-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.composition-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: var(--background-dark, #101922);
  border: 1px solid var(--border-dark, #283039);
  border-radius: 0.5rem;
}

.composition-key {
  font-size: 0.875rem;
  font-weight: 500;
  color: white;
  text-transform: capitalize;
}

.composition-value {
  font-size: 0.875rem;
  color: var(--text-secondary, #9faab6);
  font-family: 'Monaco', 'Menlo', monospace;
}

/* ----- Location Panel ----- */
.location-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.location-coords {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.leaflet-map {
  width: 100%;
  height: 250px;
  border-radius: 0.5rem;
  border: 1px solid var(--border-dark, #283039);
  z-index: 0;
}

/* ----- Device Panel ----- */
.device-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.battery-display {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.battery-value {
  font-size: 0.9375rem;
  font-weight: 500;
  color: white;
}

.battery-bar {
  height: 6px;
  border-radius: 3px;
  max-width: 120px;
}

/* ----- Trip History Table ----- */
.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.data-table thead tr {
  border-bottom: 1px solid var(--border-dark, #283039);
}

.data-table th {
  text-align: left;
  padding: 0.625rem 0.75rem;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary, #9faab6);
  white-space: nowrap;
}

.data-table td {
  padding: 0.625rem 0.75rem;
  color: white;
  border-bottom: 1px solid var(--border-dark, #283039);
  white-space: nowrap;
}

.data-table tbody tr:hover {
  background: rgba(19, 127, 236, 0.05);
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

/* ----- Labels & Metadata ----- */
.labels-metadata-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.labels-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.label-chip {
  font-size: 0.8rem !important;
}

.metadata-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.metadata-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: var(--background-dark, #101922);
  border: 1px solid var(--border-dark, #283039);
  border-radius: 0.5rem;
}

.metadata-key {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary, #9faab6);
}

.metadata-value {
  font-size: 0.875rem;
  color: white;
  font-family: 'Monaco', 'Menlo', monospace;
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ----- Empty states ----- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
  gap: 0.5rem;
}

.empty-icon {
  font-size: 2.5rem;
  color: var(--text-secondary, #9faab6);
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  color: var(--text-secondary, #9faab6);
  font-size: 0.875rem;
}

.empty-hint {
  font-size: 0.75rem !important;
  opacity: 0.7;
}

/* ----- Panel loading ----- */
.panel-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  color: var(--text-secondary, #9faab6);
  font-size: 0.875rem;
}

/* ----- Footer ----- */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

.close-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1.25rem;
  background: var(--surface-dark-highlight, #202b36);
  color: white;
  border: 1px solid var(--border-dark, #283039);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: var(--background-dark, #101922);
  border-color: var(--primary, #137fec);
}

.close-btn .material-symbols-outlined {
  font-size: 1.125rem;
}

/* ----- Responsive ----- */
@media (max-width: 768px) {
  .panels-row {
    grid-template-columns: 1fr;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .dialog-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
}
</style>

<style>
/* Global styles for PrimeVue Dialog dark theme - Asset Detail */
.asset-detail-dialog .p-dialog {
  background: var(--surface-dark, #18222c) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  border-radius: 1rem !important;
}

.asset-detail-dialog .p-dialog-header {
  background: var(--surface-dark, #18222c) !important;
  border-bottom: 1px solid var(--border-dark, #283039) !important;
  padding: 1.25rem 1.5rem !important;
  border-radius: 1rem 1rem 0 0 !important;
}

.asset-detail-dialog .p-dialog-header .p-dialog-title {
  display: none;
}

.asset-detail-dialog .p-dialog-header-icons {
  position: absolute;
  right: 1rem;
  top: 1rem;
}

.asset-detail-dialog .p-dialog-header-icon {
  color: var(--text-secondary, #9faab6) !important;
}

.asset-detail-dialog .p-dialog-header-icon:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
  color: white !important;
}

.asset-detail-dialog .p-dialog-content {
  background: var(--surface-dark, #18222c) !important;
  padding: 1.5rem !important;
  color: white !important;
}

.asset-detail-dialog .p-dialog-footer {
  background: var(--surface-dark, #18222c) !important;
  border-top: 1px solid var(--border-dark, #283039) !important;
  padding: 1rem 1.5rem !important;
  border-radius: 0 0 1rem 1rem !important;
}

/* Panel styling for dark theme */
.asset-detail-dialog .p-panel {
  background: var(--surface-dark-highlight, #202b36) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  border-radius: 0.75rem !important;
  overflow: hidden;
}

.asset-detail-dialog .p-panel-header {
  background: transparent !important;
  border-bottom: 1px solid var(--border-dark, #283039) !important;
  padding: 1rem 1.25rem !important;
}

.asset-detail-dialog .p-panel-title {
  color: white !important;
  font-weight: 600 !important;
  font-size: 0.9375rem !important;
}

.asset-detail-dialog .p-panel-icons {
  color: var(--text-secondary, #9faab6) !important;
}

.asset-detail-dialog .p-panel-content {
  background: transparent !important;
  padding: 1.25rem !important;
}

/* Progress bar styling */
.asset-detail-dialog .p-progressbar {
  background: var(--border-dark, #283039) !important;
  border-radius: 4px !important;
}

.asset-detail-dialog .p-progressbar-value {
  border-radius: 4px !important;
}

/* Tag styling */
.asset-detail-dialog .p-tag {
  font-size: 0.75rem !important;
  font-weight: 600 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
}
</style>

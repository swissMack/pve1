<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// PrimeVue components
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

// Types
interface Geozone {
  id: string
  name: string
  zoneType: string
  address: string | null
  contactName: string | null
  contactEmail: string | null
  owner: string | null
  active: boolean
  color: string | null
  hysteresis: number | null
  geometryGeojson: any | null
}

interface GeozoneAsset {
  id: string
  name: string
  status: string
  type: string
  device: string | null
}

interface GeozoneEvent {
  id: string
  eventType: string
  assetName: string
  createdAt: string
}

// Props
const props = defineProps<{
  geozoneId: string | null
  onClose: () => void
}>()

// Emits
const emit = defineEmits<{
  editGeozone: [geozone: Geozone]
}>()

// Reactive state
const visible = ref(true)
const loading = ref(true)
const error = ref('')
const geozone = ref<Geozone | null>(null)
const assets = ref<GeozoneAsset[]>([])
const events = ref<GeozoneEvent[]>([])
const loadingAssets = ref(false)
const loadingEvents = ref(false)

// Map state
const mapElement = ref<HTMLElement | null>(null)
let mapInstance: L.Map | null = null
let resizeObserver: ResizeObserver | null = null

const API_BASE_URL = ''

// Zone type badge styling
const getZoneTypeSeverity = (zoneType: string): string => {
  switch (zoneType) {
    case 'warehouse': return 'success'
    case 'supplier': return 'warn'
    case 'customer': return 'secondary'
    case 'transit_hub': return 'info'
    case 'restricted': return 'danger'
    default: return 'info'
  }
}

const getZoneTypeColor = (zoneType: string): string => {
  switch (zoneType) {
    case 'warehouse': return 'bg-green-500/10 text-green-400 border-green-500/30'
    case 'supplier': return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    case 'customer': return 'bg-purple-500/10 text-purple-400 border-purple-500/30'
    case 'transit_hub': return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    case 'restricted': return 'bg-red-500/10 text-red-400 border-red-500/30'
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/30'
  }
}


const getEventTypeSeverity = (eventType: string): string => {
  switch (eventType) {
    case 'zone_enter': return 'success'
    case 'zone_exit': return 'danger'
    case 'zone_dwell': return 'info'
    default: return 'secondary'
  }
}

const formatEventType = (eventType: string): string => {
  return eventType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const formatZoneType = (zoneType: string): string => {
  return zoneType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const formatDate = (dateString: string): string => {
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

// Fetch geozone details
const fetchGeozone = async () => {
  if (!props.geozoneId) {
    error.value = 'No geozone ID provided'
    loading.value = false
    return
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/geozones/${props.geozoneId}`)
    if (!response.ok) throw new Error('Failed to fetch geozone')

    const result = await response.json()
    if (result.success && result.data) {
      geozone.value = result.data
    } else {
      geozone.value = result
    }
  } catch (err) {
    console.error('Error fetching geozone:', err)
    error.value = 'Failed to load geozone details'
  } finally {
    loading.value = false
  }
}

// Fetch assets inside geozone
const fetchAssets = async () => {
  if (!props.geozoneId) return
  loadingAssets.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/geozones/${props.geozoneId}/assets`)
    if (!response.ok) throw new Error('Failed to fetch assets')

    const result = await response.json()
    assets.value = result.success && result.data ? result.data : (Array.isArray(result) ? result : [])
  } catch (err) {
    console.error('Error fetching geozone assets:', err)
    assets.value = []
  } finally {
    loadingAssets.value = false
  }
}

// Fetch recent events
const fetchEvents = async () => {
  if (!props.geozoneId) return
  loadingEvents.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/geozone-events?geozone_id=${props.geozoneId}`)
    if (!response.ok) throw new Error('Failed to fetch events')

    const result = await response.json()
    events.value = result.success && result.data ? result.data : (Array.isArray(result) ? result : [])
  } catch (err) {
    console.error('Error fetching geozone events:', err)
    events.value = []
  } finally {
    loadingEvents.value = false
  }
}

// Initialize Leaflet map
const initializeMap = async () => {
  await nextTick()

  if (!mapElement.value) return

  // Clean up existing map
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }

  // Create map with dark theme tiles
  mapInstance = L.map(mapElement.value, {
    center: [46.8182, 8.2275],
    zoom: 8,
    zoomControl: true,
    attributionControl: true
  })

  // Add dark theme CartoDB tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(mapInstance)

  // Render geozone polygon
  renderGeozonePolygon()

  // Handle resize
  setTimeout(() => {
    mapInstance?.invalidateSize()
  }, 100)

  // Set up ResizeObserver
  if (mapElement.value) {
    resizeObserver = new ResizeObserver(() => {
      mapInstance?.invalidateSize()
    })
    resizeObserver.observe(mapElement.value)
  }
}

// Render geozone polygon on the map
const renderGeozonePolygon = () => {
  if (!mapInstance || !geozone.value?.geometryGeojson) return

  try {
    const geoLayer = L.geoJSON(geozone.value.geometryGeojson, {
      style: {
        color: geozone.value.color || '#137fec',
        weight: 3,
        fillOpacity: 0.2,
        fillColor: geozone.value.color || '#137fec'
      }
    }).addTo(mapInstance)

    mapInstance.fitBounds(geoLayer.getBounds(), { padding: [30, 30] })
  } catch (err) {
    console.error('Error rendering geozone polygon:', err)
  }
}

// Delete geozone
const handleDelete = async () => {
  if (!props.geozoneId) return

  const confirmed = window.confirm(
    `Are you sure you want to delete the geozone "${geozone.value?.name || props.geozoneId}"? This action cannot be undone.`
  )
  if (!confirmed) return

  try {
    const response = await fetch(`${API_BASE_URL}/api/geozones/${props.geozoneId}`, {
      method: 'DELETE'
    })

    if (!response.ok) throw new Error('Failed to delete geozone')

    props.onClose()
  } catch (err) {
    console.error('Error deleting geozone:', err)
    error.value = 'Failed to delete geozone'
  }
}

// Edit geozone
const handleEdit = () => {
  if (geozone.value) {
    emit('editGeozone', geozone.value)
  }
}

// Close dialog
const handleClose = () => {
  visible.value = false
  props.onClose()
}

// Lifecycle
onMounted(async () => {
  await fetchGeozone()
  // Fetch assets and events in parallel
  fetchAssets()
  fetchEvents()
  // Initialize map after geozone data is loaded
  if (geozone.value) {
    await initializeMap()
  }
})

// Watch for geozone data to render polygon after map is ready
watch(geozone, async (newVal) => {
  if (newVal && !mapInstance) {
    await initializeMap()
  } else if (newVal && mapInstance) {
    renderGeozonePolygon()
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
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="geozone ? `Geozone - ${geozone.name}` : 'Geozone Details'"
    :modal="true"
    :maximizable="true"
    :closable="true"
    :draggable="false"
    class="geozone-detail-dialog"
    :style="{ width: '95vw', maxWidth: '1200px' }"
    @hide="handleClose"
  >
    <template #header>
      <div class="flex justify-between items-center w-full pr-8">
        <div class="flex flex-col gap-1.5">
          <h3 class="m-0 text-xl font-semibold text-white">
            {{ geozone?.name || 'Loading...' }}
          </h3>
          <div class="flex items-center gap-2" v-if="geozone">
            <span
              :class="[
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                getZoneTypeColor(geozone.zoneType)
              ]"
            >
              {{ formatZoneType(geozone.zoneType) }}
            </span>
            <span
              :class="[
                'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                geozone.active
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-gray-500/10 text-gray-400'
              ]"
            >
              <span
                :class="[
                  'w-1.5 h-1.5 rounded-full mr-1.5',
                  geozone.active ? 'bg-green-400' : 'bg-gray-400'
                ]"
              ></span>
              {{ geozone.active ? 'Active' : 'Inactive' }}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="geozone"
            @click="handleEdit"
            size="small"
            outlined
            class="!border-border-dark !text-white hover:!border-primary hover:!bg-surface-dark-highlight"
          >
            <span class="material-symbols-outlined text-[18px] mr-1.5">edit</span>
            Edit
          </Button>
          <Button
            v-if="geozone"
            @click="handleDelete"
            size="small"
            severity="danger"
            outlined
            class="!border-red-500/30 !text-red-400 hover:!border-red-500 hover:!bg-red-500/10"
          >
            <span class="material-symbols-outlined text-[18px] mr-1.5">delete</span>
            Delete
          </Button>
        </div>
      </div>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-16 gap-4">
      <div class="w-10 h-10 border-4 border-border-dark border-t-primary rounded-full animate-spin"></div>
      <p class="text-text-secondary text-sm">Loading geozone details...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <span class="material-symbols-outlined text-4xl text-red-400">error</span>
      <h3 class="text-white text-lg font-semibold m-0">Error Loading Geozone</h3>
      <p class="text-text-secondary m-0">{{ error }}</p>
    </div>

    <!-- Content -->
    <div v-else-if="geozone" class="flex flex-col gap-5">

      <!-- Map Panel -->
      <div class="bg-surface-dark-highlight rounded-xl border border-border-dark overflow-hidden">
        <div class="px-4 py-3 border-b border-border-dark flex items-center gap-2.5">
          <div class="p-1.5 rounded-lg bg-primary/10 text-primary">
            <span class="material-symbols-outlined text-[18px]">map</span>
          </div>
          <h4 class="text-white font-semibold text-sm m-0">Geozone Boundary</h4>
        </div>
        <div class="relative h-[400px]">
          <!-- No Geometry State -->
          <div
            v-if="!geozone.geometryGeojson"
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background-dark"
          >
            <span class="material-symbols-outlined text-4xl text-text-secondary">location_off</span>
            <p class="text-text-secondary text-sm">No geometry data available for this geozone</p>
          </div>
          <!-- Map Element -->
          <div
            v-show="geozone.geometryGeojson"
            ref="mapElement"
            class="absolute inset-0 w-full h-full"
          ></div>
        </div>
      </div>

      <!-- Info Panel -->
      <div class="bg-surface-dark-highlight rounded-xl border border-border-dark overflow-hidden">
        <div class="px-4 py-3 border-b border-border-dark flex items-center gap-2.5">
          <div class="p-1.5 rounded-lg bg-primary/10 text-primary">
            <span class="material-symbols-outlined text-[18px]">info</span>
          </div>
          <h4 class="text-white font-semibold text-sm m-0">Geozone Information</h4>
        </div>
        <div class="p-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <!-- Name -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Name</span>
              <span class="text-white text-sm">{{ geozone.name }}</span>
            </div>

            <!-- Zone Type -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Zone Type</span>
              <div>
                <Tag
                  :value="formatZoneType(geozone.zoneType)"
                  :severity="getZoneTypeSeverity(geozone.zoneType)"
                />
              </div>
            </div>

            <!-- Active Status -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Status</span>
              <div class="flex items-center gap-2">
                <span
                  :class="[
                    'w-2 h-2 rounded-full',
                    geozone.active ? 'bg-green-400' : 'bg-gray-400'
                  ]"
                ></span>
                <span class="text-white text-sm">{{ geozone.active ? 'Active' : 'Inactive' }}</span>
              </div>
            </div>

            <!-- Address -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Address</span>
              <span class="text-white text-sm">{{ geozone.address || 'Not specified' }}</span>
            </div>

            <!-- Contact Name -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Contact Name</span>
              <span class="text-white text-sm">{{ geozone.contactName || 'Not specified' }}</span>
            </div>

            <!-- Contact Email -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Contact Email</span>
              <span v-if="geozone.contactEmail" class="text-primary text-sm hover:underline">
                <a :href="`mailto:${geozone.contactEmail}`">{{ geozone.contactEmail }}</a>
              </span>
              <span v-else class="text-white text-sm">Not specified</span>
            </div>

            <!-- Owner -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Owner</span>
              <span class="text-white text-sm">{{ geozone.owner || 'Not specified' }}</span>
            </div>

            <!-- Color -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Color</span>
              <div class="flex items-center gap-2">
                <span
                  class="w-5 h-5 rounded border border-border-dark"
                  :style="{ backgroundColor: geozone.color || '#137fec' }"
                ></span>
                <span class="text-white text-sm font-mono">{{ geozone.color || '#137fec' }}</span>
              </div>
            </div>

            <!-- Hysteresis -->
            <div class="flex flex-col gap-1.5">
              <span class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Hysteresis</span>
              <span class="text-white text-sm">
                {{ geozone.hysteresis !== null && geozone.hysteresis !== undefined ? `${geozone.hysteresis} m` : 'Not set' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Assets Inside Panel -->
      <div class="bg-surface-dark-highlight rounded-xl border border-border-dark overflow-hidden">
        <div class="px-4 py-3 border-b border-border-dark flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="p-1.5 rounded-lg bg-primary/10 text-primary">
              <span class="material-symbols-outlined text-[18px]">inventory_2</span>
            </div>
            <h4 class="text-white font-semibold text-sm m-0">Assets Inside</h4>
          </div>
          <span class="text-text-secondary text-xs">{{ assets.length }} asset{{ assets.length !== 1 ? 's' : '' }}</span>
        </div>
        <div class="p-0">
          <!-- Loading -->
          <div v-if="loadingAssets" class="flex items-center justify-center py-8 gap-3">
            <div class="w-6 h-6 border-2 border-border-dark border-t-primary rounded-full animate-spin"></div>
            <span class="text-text-secondary text-sm">Loading assets...</span>
          </div>

          <!-- Empty State -->
          <div v-else-if="assets.length === 0" class="flex flex-col items-center justify-center py-8 gap-2">
            <span class="material-symbols-outlined text-3xl text-text-secondary">inventory_2</span>
            <p class="text-text-secondary text-sm m-0">No assets currently inside this geozone</p>
          </div>

          <!-- Assets Table -->
          <div v-else class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-border-dark">
                  <th class="text-left px-4 py-3 text-text-secondary text-xs font-semibold uppercase tracking-wider">Name</th>
                  <th class="text-left px-4 py-3 text-text-secondary text-xs font-semibold uppercase tracking-wider">Status</th>
                  <th class="text-left px-4 py-3 text-text-secondary text-xs font-semibold uppercase tracking-wider">Type</th>
                  <th class="text-left px-4 py-3 text-text-secondary text-xs font-semibold uppercase tracking-wider">Device</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="asset in assets"
                  :key="asset.id"
                  class="border-b border-border-dark/50 hover:bg-background-dark/50 transition-colors"
                >
                  <td class="px-4 py-3 text-white text-sm font-medium">{{ asset.name }}</td>
                  <td class="px-4 py-3">
                    <Tag
                      :value="asset.status"
                      :severity="asset.status?.toLowerCase() === 'active' ? 'success' : 'secondary'"
                      class="text-xs"
                    />
                  </td>
                  <td class="px-4 py-3 text-text-secondary text-sm">{{ asset.type || 'N/A' }}</td>
                  <td class="px-4 py-3 text-text-secondary text-sm font-mono">{{ asset.device || 'N/A' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Recent Events Panel -->
      <div class="bg-surface-dark-highlight rounded-xl border border-border-dark overflow-hidden">
        <div class="px-4 py-3 border-b border-border-dark flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="p-1.5 rounded-lg bg-primary/10 text-primary">
              <span class="material-symbols-outlined text-[18px]">history</span>
            </div>
            <h4 class="text-white font-semibold text-sm m-0">Recent Events</h4>
          </div>
          <span class="text-text-secondary text-xs">{{ events.length }} event{{ events.length !== 1 ? 's' : '' }}</span>
        </div>
        <div class="p-0">
          <!-- Loading -->
          <div v-if="loadingEvents" class="flex items-center justify-center py-8 gap-3">
            <div class="w-6 h-6 border-2 border-border-dark border-t-primary rounded-full animate-spin"></div>
            <span class="text-text-secondary text-sm">Loading events...</span>
          </div>

          <!-- Empty State -->
          <div v-else-if="events.length === 0" class="flex flex-col items-center justify-center py-8 gap-2">
            <span class="material-symbols-outlined text-3xl text-text-secondary">event_busy</span>
            <p class="text-text-secondary text-sm m-0">No recent events for this geozone</p>
          </div>

          <!-- Events Table -->
          <div v-else class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-border-dark">
                  <th class="text-left px-4 py-3 text-text-secondary text-xs font-semibold uppercase tracking-wider">Event Type</th>
                  <th class="text-left px-4 py-3 text-text-secondary text-xs font-semibold uppercase tracking-wider">Asset Name</th>
                  <th class="text-left px-4 py-3 text-text-secondary text-xs font-semibold uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="event in events"
                  :key="event.id"
                  class="border-b border-border-dark/50 hover:bg-background-dark/50 transition-colors"
                >
                  <td class="px-4 py-3">
                    <Tag
                      :value="formatEventType(event.eventType)"
                      :severity="getEventTypeSeverity(event.eventType)"
                      class="text-xs"
                    />
                  </td>
                  <td class="px-4 py-3 text-white text-sm">{{ event.assetName }}</td>
                  <td class="px-4 py-3 text-text-secondary text-sm">{{ formatDate(event.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

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
/* Global styles for PrimeVue Dialog dark theme */
.geozone-detail-dialog .p-dialog {
  background: var(--surface-dark, #18222c) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  border-radius: 1rem !important;
}

.geozone-detail-dialog .p-dialog-header {
  background: var(--surface-dark, #18222c) !important;
  border-bottom: 1px solid var(--border-dark, #283039) !important;
  padding: 1.25rem 1.5rem !important;
  border-radius: 1rem 1rem 0 0 !important;
}

.geozone-detail-dialog .p-dialog-header .p-dialog-title {
  display: none;
}

.geozone-detail-dialog .p-dialog-header-icons {
  position: absolute;
  right: 1rem;
  top: 1rem;
}

.geozone-detail-dialog .p-dialog-header-icon {
  color: var(--text-secondary, #9faab6) !important;
}

.geozone-detail-dialog .p-dialog-header-icon:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
  color: white !important;
}

.geozone-detail-dialog .p-dialog-content {
  background: var(--surface-dark, #18222c) !important;
  padding: 1.5rem !important;
  color: white !important;
}

.geozone-detail-dialog .p-dialog-footer {
  background: var(--surface-dark, #18222c) !important;
  border-top: 1px solid var(--border-dark, #283039) !important;
  padding: 1rem 1.5rem !important;
  border-radius: 0 0 1rem 1rem !important;
}

/* Tag styling */
.geozone-detail-dialog .p-tag {
  font-size: 0.75rem !important;
  font-weight: 600 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
}

/* Button styling for dark theme */
.geozone-detail-dialog .p-button.p-button-outlined {
  border-color: var(--border-dark, #283039) !important;
  color: white !important;
}

.geozone-detail-dialog .p-button.p-button-outlined:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
  border-color: var(--primary, #137fec) !important;
}

.geozone-detail-dialog .p-button.p-button-text {
  color: var(--text-secondary, #9faab6) !important;
}

.geozone-detail-dialog .p-button.p-button-text:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
  color: white !important;
}

/* Leaflet controls dark theme */
.geozone-detail-dialog .leaflet-control-zoom a {
  background: #18222c !important;
  color: #fff !important;
  border-color: #283039 !important;
}

.geozone-detail-dialog .leaflet-control-zoom a:hover {
  background: #202b36 !important;
}

.geozone-detail-dialog .leaflet-control-attribution {
  background: rgba(24, 34, 44, 0.8) !important;
  color: #9faab6 !important;
}

.geozone-detail-dialog .leaflet-control-attribution a {
  color: #137fec !important;
}
</style>

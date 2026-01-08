<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { TimeGranularity, FilterCriteria } from '@/types/analytics'

interface RegionalData {
  id: string
  name: string
  latitude: number
  longitude: number
  dataUsageMB: number
  locationName?: string
}

const props = withDefaults(defineProps<{
  granularity?: TimeGranularity
  filters?: Partial<FilterCriteria>
}>(), {
  granularity: 'monthly',
  filters: undefined
})

const emit = defineEmits<{
  loading: [isLoading: boolean]
}>()

const mapContainer = ref<HTMLDivElement | null>(null)
const mapInstance = ref<L.Map | null>(null)
const regionalData = ref<RegionalData[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

// Emit loading state changes to parent
watch(loading, (isLoading) => {
  emit('loading', isLoading)
})

const fetchRegionalData = async () => {
  loading.value = true
  error.value = null

  try {
    const params = new URLSearchParams()

    // Add filter parameters if provided
    if (props.filters?.networks?.length) {
      props.filters.networks.forEach((mccmnc: string) => params.append('mccmnc', mccmnc))
    }
    if (props.filters?.imsis?.length) {
      props.filters.imsis.forEach((imsi: string) => params.append('imsi', imsi))
    }

    const queryString = params.toString()
    const response = await fetch(`/api/consumption/regional${queryString ? `?${queryString}` : ''}`)
    const result = await response.json()

    if (result.success) {
      regionalData.value = result.data
      initMap()
    } else {
      error.value = result.error || 'Failed to load regional data'
    }
  } catch (err) {
    console.error('Error fetching regional data:', err)
    error.value = 'Network error'
  } finally {
    loading.value = false
  }
}

const initMap = () => {
  if (!mapContainer.value || mapInstance.value) return

  // Default to Switzerland center
  const defaultCenter: L.LatLngExpression = [46.8182, 8.2275]
  const defaultZoom = 7

  mapInstance.value = L.map(mapContainer.value, {
    center: defaultCenter,
    zoom: defaultZoom,
    zoomControl: true,
    attributionControl: true
  })

  // Add dark-themed tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(mapInstance.value as unknown as L.Map)

  // Add markers for each location
  addMarkers()
}

const addMarkers = () => {
  if (!mapInstance.value) return

  const maxUsage = Math.max(...regionalData.value.map(d => d.dataUsageMB), 1)

  regionalData.value.forEach(location => {
    if (!location.latitude || !location.longitude) return

    // Calculate marker size based on usage
    const usageRatio = location.dataUsageMB / maxUsage
    const radius = 10 + (usageRatio * 30) // 10-40px radius

    // Create circle marker
    const marker = L.circleMarker([location.latitude, location.longitude], {
      radius,
      fillColor: '#137fec',
      fillOpacity: 0.6,
      color: '#137fec',
      weight: 2,
      opacity: 0.8
    })

    // Add popup
    const popupContent = `
      <div class="text-sm">
        <div class="font-semibold text-white mb-1">${location.name}</div>
        ${location.locationName ? `<div class="text-gray-400 text-xs mb-1">${location.locationName}</div>` : ''}
        <div class="text-primary">
          Data Usage: ${(location.dataUsageMB / 1024).toFixed(2)} GB
        </div>
      </div>
    `

    marker.bindPopup(popupContent, {
      className: 'dark-popup'
    })

    marker.addTo(mapInstance.value as unknown as L.Map)
  })

  // Fit bounds if we have data
  if (regionalData.value.length > 0) {
    const validLocations = regionalData.value.filter(d => d.latitude && d.longitude)
    if (validLocations.length > 0) {
      const bounds = L.latLngBounds(
        validLocations.map(d => [d.latitude, d.longitude] as L.LatLngTuple)
      )
      mapInstance.value.fitBounds(bounds, { padding: [50, 50] })
    }
  }
}

onMounted(fetchRegionalData)

// Watch for granularity changes from parent
watch(() => props.granularity, () => {
  // Destroy existing map before refetching
  if (mapInstance.value) {
    mapInstance.value.remove()
    mapInstance.value = null
  }
  fetchRegionalData()
})

// Watch for filter changes
watch(() => props.filters, () => {
  // Destroy existing map before refetching
  if (mapInstance.value) {
    mapInstance.value.remove()
    mapInstance.value = null
  }
  fetchRegionalData()
}, { deep: true })

onUnmounted(() => {
  if (mapInstance.value) {
    mapInstance.value.remove()
    mapInstance.value = null
  }
})
</script>

<template>
  <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden relative z-0">
    <!-- Header -->
    <div class="px-5 py-4 border-b border-border-dark flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-green-400">map</span>
        <h3 class="text-white font-semibold">Regional Usage</h3>
      </div>
      <span class="text-text-secondary text-sm">{{ regionalData.length }} locations</span>
    </div>

    <!-- Map Container -->
    <div class="h-[300px] relative z-0 isolate">
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-background-dark">
        <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>

      <div v-else-if="error" class="absolute inset-0 flex items-center justify-center bg-background-dark">
        <div class="text-center">
          <span class="material-symbols-outlined text-red-400 text-3xl mb-2">error</span>
          <p class="text-red-400 text-sm">{{ error }}</p>
        </div>
      </div>

      <div ref="mapContainer" class="h-full w-full"></div>
    </div>

    <!-- Legend -->
    <div class="px-5 py-3 border-t border-border-dark flex items-center gap-4 text-xs text-text-secondary">
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded-full bg-primary opacity-60"></div>
        <span>Bubble size = Data usage</span>
      </div>
    </div>
  </div>
</template>

<style>
/* Dark popup styling */
.dark-popup .leaflet-popup-content-wrapper {
  background-color: #283039;
  color: #f3f4f6;
  border-radius: 8px;
  border: 1px solid #3b4754;
}

.dark-popup .leaflet-popup-tip {
  background-color: #283039;
}

.dark-popup .leaflet-popup-close-button {
  color: #9ca3af;
}

.dark-popup .leaflet-popup-close-button:hover {
  color: #f3f4f6;
}

/* Ensure Leaflet stays within its container */
.leaflet-container {
  z-index: 0 !important;
}

.leaflet-pane {
  z-index: 0 !important;
}

.leaflet-top,
.leaflet-bottom {
  z-index: 1 !important;
}
</style>

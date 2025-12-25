<template>
  <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
    <!-- Map Header -->
    <div class="px-5 py-4 border-b border-border-dark flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-lg bg-primary/10 text-primary">
          <span class="material-symbols-outlined text-[20px]">map</span>
        </div>
        <h3 class="text-white font-semibold">Device Locations</h3>
      </div>
      <div class="flex items-center gap-3">
        <button
          v-if="visibleDevices.length > 0"
          @click="fitAllDevices"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-white bg-background-dark border border-border-dark rounded-lg hover:border-primary/50 transition-colors"
          title="Fit all devices in view"
        >
          <span class="material-symbols-outlined text-[16px]">fit_screen</span>
          Fit All
        </button>
        <span class="text-text-secondary text-sm">{{ visibleDevices.length }} devices shown</span>
      </div>
    </div>

    <!-- Map Container -->
    <div class="relative h-[400px]">
      <!-- Loading State -->
      <div v-if="isMapLoading" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background-dark">
        <div class="w-10 h-10 border-4 border-border-dark border-t-primary rounded-full animate-spin"></div>
        <p class="text-text-secondary text-sm">Loading map...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="mapError" class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background-dark p-6 text-center">
        <span class="material-symbols-outlined text-4xl text-red-400">error</span>
        <p class="text-red-400 font-medium">{{ mapError }}</p>
        <button @click="initializeMap" class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors">
          Retry
        </button>
      </div>

      <!-- Map Element -->
      <div
        v-show="!isMapLoading && !mapError"
        ref="mapElement"
        class="absolute inset-0 w-full h-full"
      ></div>

      <!-- Empty State -->
      <div v-if="!isMapLoading && !mapError && visibleDevices.length === 0" class="absolute inset-0 flex items-center justify-center bg-background-dark/80">
        <div class="flex flex-col items-center gap-2 text-text-secondary">
          <span class="material-symbols-outlined text-4xl">location_off</span>
          <p class="text-sm">No devices with location data available</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { type Device } from '../data/mockData'

// Props
const props = defineProps<{
  devices: Device[]
  onDeviceSelect?: (deviceId: string) => void
}>()

// Reactive state
const mapElement = ref<HTMLElement | null>(null)
const mapInstance = ref<L.Map | null>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const markerClusterGroup = ref<any>(null)
const isMapLoading = ref(true)
const mapError = ref<string | null>(null)
const resizeObserver = ref<ResizeObserver | null>(null)

// Computed properties
const visibleDevices = computed(() => {
  return props.devices.filter(device =>
    device.latitude !== null &&
    device.latitude !== undefined &&
    device.longitude !== null &&
    device.longitude !== undefined
  )
})

// Helper functions
const getDeviceColor = (device: Device): string => {
  switch (device.status.toLowerCase()) {
    case 'active': return '#10b981' // Green
    case 'inactive': return '#6b7280' // Gray
    case 'maintenance': return '#f59e0b' // Amber
    case 'offline': return '#ef4444' // Red
    default: return '#6b7280'
  }
}

const createCustomIcon = (device: Device): L.DivIcon => {
  const color = getDeviceColor(device)
  const isActive = device.status.toLowerCase() === 'active'

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div class="marker-pin" style="background-color: ${color}; ${isActive ? 'animation: pulse 2s infinite;' : ''}">
        <div class="marker-inner"></div>
      </div>
      ${isActive ? '<div class="marker-pulse" style="background-color: ' + color + ';"></div>' : ''}
    `,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -42]
  })
}

const createPopupContent = (device: Device): string => {
  const statusColors: Record<string, { bg: string; text: string }> = {
    active: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981' },
    inactive: { bg: 'rgba(107, 114, 128, 0.1)', text: '#9ca3af' },
    maintenance: { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b' },
    offline: { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' }
  }
  const statusStyle = statusColors[device.status.toLowerCase()] || statusColors.inactive

  return `
    <div style="min-width: 220px; font-family: 'Inter', sans-serif;">
      <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #fff;">${device.name}</h4>
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #9faab6;">Device ID</span>
          <span style="color: #fff; font-family: monospace;">${device.id}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #9faab6;">Status</span>
          <span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;
                       background: ${statusStyle.bg}; color: ${statusStyle.text};">
            ${device.status}
          </span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #9faab6;">Type</span>
          <span style="color: #fff;">${device.deviceType}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #9faab6;">Location</span>
          <span style="color: #fff;">${device.location}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #9faab6;">Signal</span>
          <span style="color: #fff;">${device.signalStrength}%</span>
        </div>
        ${device.batteryLevel !== null && device.batteryLevel !== undefined ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #9faab6;">Battery</span>
            <span style="color: ${device.batteryLevel >= 50 ? '#10b981' : device.batteryLevel >= 20 ? '#f59e0b' : '#ef4444'};">
              ${device.batteryLevel}%
            </span>
          </div>
        ` : ''}
        ${device.temperature !== null && device.temperature !== undefined ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #9faab6;">Temperature</span>
            <span style="color: #fff;">${device.temperature}°C</span>
          </div>
        ` : ''}
      </div>
      <button
        onclick="window.deviceMapViewDetails('${device.id}')"
        style="width: 100%; margin-top: 12px; padding: 8px; background: #137fec; color: white;
               border: none; border-radius: 6px; font-size: 13px; font-weight: 500;
               cursor: pointer; transition: background 0.15s ease;"
        onmouseover="this.style.background='#1a90ff'"
        onmouseout="this.style.background='#137fec'">
        View Details
      </button>
    </div>
  `
}

const addDeviceMarkers = () => {
  if (!mapInstance.value) return

  // Clear existing markers
  if (markerClusterGroup.value) {
    markerClusterGroup.value.clearLayers()
  } else {
    markerClusterGroup.value = L.markerClusterGroup({
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount()
        return L.divIcon({
          html: `<div class="cluster-marker">${count}</div>`,
          className: 'custom-cluster',
          iconSize: [40, 40]
        })
      }
    })
    ;(mapInstance.value as L.Map).addLayer(markerClusterGroup.value)
  }

  const bounds = L.latLngBounds([])

  visibleDevices.value.forEach(device => {
    const marker = L.marker(
      [device.latitude!, device.longitude!],
      { icon: createCustomIcon(device) }
    )

    marker.bindPopup(createPopupContent(device), {
      className: 'dark-popup',
      maxWidth: 280
    })

    markerClusterGroup.value!.addLayer(marker)
    bounds.extend([device.latitude!, device.longitude!])
  })

  // Fit map to show all markers with appropriate zoom
  if (visibleDevices.value.length > 0 && bounds.isValid()) {
    // Fit bounds to show all devices, with padding for better visibility
    mapInstance.value.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 14,  // Don't zoom in too close even for single device
      animate: false  // Instant fit on initial load
    })

    // For single device, ensure reasonable zoom level
    if (visibleDevices.value.length === 1) {
      mapInstance.value.setZoom(12)
    }
  }
}

const initializeMap = async () => {
  isMapLoading.value = true
  mapError.value = null

  await nextTick()

  if (!mapElement.value) {
    mapError.value = 'Map container not found'
    isMapLoading.value = false
    return
  }

  try {
    // Clean up existing map
    if (mapInstance.value) {
      mapInstance.value.remove()
      mapInstance.value = null
    }

    // Calculate initial center from devices if available, otherwise default to Switzerland
    let initialCenter: [number, number] = [46.8182, 8.2275] // Switzerland center
    let initialZoom = 8

    if (visibleDevices.value.length > 0) {
      // Use first device as initial center
      initialCenter = [visibleDevices.value[0].latitude!, visibleDevices.value[0].longitude!]
      initialZoom = 10
    }

    // Create map with dark theme tiles
    mapInstance.value = L.map(mapElement.value, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: true,
      attributionControl: true
    })

    // Add dark theme OpenStreetMap tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(mapInstance.value as L.Map)

    // Add markers and fit bounds after map is ready
    addDeviceMarkers()

    // Force map to recalculate its size after render, then fit bounds
    setTimeout(() => {
      mapInstance.value?.invalidateSize()
      // Fit bounds after size is calculated
      setTimeout(() => {
        fitAllDevices()
      }, 50)
    }, 100)

    // Set up ResizeObserver to handle container size changes
    if (mapElement.value) {
      resizeObserver.value = new ResizeObserver(() => {
        mapInstance.value?.invalidateSize()
      })
      resizeObserver.value.observe(mapElement.value)
    }

    isMapLoading.value = false
  } catch (err) {
    console.error('Error initializing map:', err)
    mapError.value = 'Failed to initialize map'
    isMapLoading.value = false
  }
}

const showDeviceDetails = (deviceId: string) => {
  if (props.onDeviceSelect) {
    props.onDeviceSelect(deviceId)
  }
}

const fitAllDevices = () => {
  if (!mapInstance.value || visibleDevices.value.length === 0) return

  const bounds = L.latLngBounds([])
  visibleDevices.value.forEach(device => {
    bounds.extend([device.latitude!, device.longitude!])
  })

  if (bounds.isValid()) {
    mapInstance.value.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 14,
      animate: true
    })

    if (visibleDevices.value.length === 1) {
      mapInstance.value.setZoom(12)
    }
  }
}

// Expose function to window for popup button click
if (typeof window !== 'undefined') {
  (window as any).deviceMapViewDetails = showDeviceDetails
}

// Lifecycle hooks
onMounted(() => {
  initializeMap()
})

onUnmounted(() => {
  if (resizeObserver.value) {
    resizeObserver.value.disconnect()
    resizeObserver.value = null
  }
  if (mapInstance.value) {
    mapInstance.value.remove()
    mapInstance.value = null
  }
})

// Watch for device changes - re-add markers and fit bounds
watch(() => props.devices, (newDevices, oldDevices) => {
  if (mapInstance.value) {
    addDeviceMarkers()
    // Fit bounds when devices are first loaded or changed significantly
    if ((!oldDevices || oldDevices.length === 0) && newDevices && newDevices.length > 0) {
      setTimeout(() => {
        fitAllDevices()
      }, 100)
    }
  }
}, { deep: true })
</script>

<style>
/* Custom marker styles */
.custom-marker {
  background: transparent;
  border: none;
}

.marker-pin {
  width: 30px;
  height: 30px;
  border-radius: 50% 50% 50% 0;
  position: absolute;
  transform: rotate(-45deg);
  left: 50%;
  top: 50%;
  margin: -20px 0 0 -15px;
  border: 3px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.marker-inner {
  width: 10px;
  height: 10px;
  background: #fff;
  border-radius: 50%;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.marker-pulse {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  position: absolute;
  left: 50%;
  top: 50%;
  margin: -7px 0 0 -7px;
  animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
  opacity: 0.5;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.5);
    opacity: 0.8;
  }
  80%, 100% {
    transform: scale(2.5);
    opacity: 0;
  }
}

/* Cluster marker styles */
.custom-cluster {
  background: transparent;
}

.cluster-marker {
  width: 40px;
  height: 40px;
  background: #137fec;
  border: 3px solid #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* Dark popup styles */
.dark-popup .leaflet-popup-content-wrapper {
  background: #18222c;
  border: 1px solid #283039;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.dark-popup .leaflet-popup-content {
  margin: 12px;
}

.dark-popup .leaflet-popup-tip {
  background: #18222c;
  border: 1px solid #283039;
  box-shadow: none;
}

.dark-popup .leaflet-popup-close-button {
  color: #9faab6;
  font-size: 20px;
  padding: 8px;
}

.dark-popup .leaflet-popup-close-button:hover {
  color: #fff;
}

/* Override Leaflet default cluster styles */
.marker-cluster-small,
.marker-cluster-medium,
.marker-cluster-large {
  background: rgba(19, 127, 236, 0.3);
}

.marker-cluster-small div,
.marker-cluster-medium div,
.marker-cluster-large div {
  background: #137fec;
  color: #fff;
  font-weight: 600;
}

/* Leaflet controls dark theme */
.leaflet-control-zoom a {
  background: #18222c !important;
  color: #fff !important;
  border-color: #283039 !important;
}

.leaflet-control-zoom a:hover {
  background: #202b36 !important;
}

.leaflet-control-attribution {
  background: rgba(24, 34, 44, 0.8) !important;
  color: #9faab6 !important;
}

.leaflet-control-attribution a {
  color: #137fec !important;
}
</style>

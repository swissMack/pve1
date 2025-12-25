<template>
  <div class="device-route-map">
    <!-- Controls Section -->
    <div class="map-controls">
      <div class="controls-header">
        <h4>Route History</h4>
        <div class="date-range-controls">
          <select v-model="selectedDateRange" @change="loadRouteData" class="date-range-select">
            <option value="1">Last 24 Hours</option>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
        </div>
      </div>

      <!-- Last Known Position Notice -->
      <div v-if="showingLastKnownPosition" class="last-known-notice">
        <span class="notice-icon">ℹ️</span>
        <span class="notice-text">
          No movement detected in the selected time range. Showing last known position from
          <strong>{{ formatDate(new Date(locationHistory[0].recordedAt)) }}</strong>
        </span>
      </div>

      <!-- Statistics Panel -->
      <div v-if="routeStats && !showingLastKnownPosition" class="route-stats">
        <div class="stat-item">
          <span class="stat-label">Total Distance</span>
          <span class="stat-value">{{ routeStats.totalDistance }} km</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Average Speed</span>
          <span class="stat-value">{{ routeStats.avgSpeed }} km/h</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Max Speed</span>
          <span class="stat-value">{{ routeStats.maxSpeed }} km/h</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Data Points</span>
          <span class="stat-value">{{ routeStats.pointCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Time Range</span>
          <span class="stat-value">{{ routeStats.timeRange }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Battery Drop</span>
          <span class="stat-value">{{ routeStats.batteryDrop }}%</span>
        </div>
      </div>
    </div>

    <!-- Map Container -->
    <div class="map-container">
      <div v-if="loadingError" class="map-error">
        <div class="error-icon">⚠️</div>
        <p class="error-message">{{ loadingError }}</p>
        <button @click="retryLoad" class="retry-btn">Retry</button>
      </div>

      <div v-else-if="isLoading" class="map-loading">
        <div class="loading-spinner"></div>
        <p>Loading route data...</p>
      </div>

      <div v-else-if="locationHistory.length === 0" class="map-empty">
        <div class="empty-icon">📍</div>
        <p>No route history available for this device</p>
        <p class="empty-hint">Location data will appear here once the device starts tracking</p>
      </div>

      <div
        v-show="!isLoading && !loadingError && locationHistory.length > 0"
        ref="mapElement"
        class="leaflet-map"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Props
const props = defineProps<{
  deviceId: string
}>()

// Interface for location history
interface LocationPoint {
  id: string
  deviceId: string
  latitude: number
  longitude: number
  altitude?: number | null
  accuracy?: number | null
  speed?: number | null
  heading?: number | null
  recordedAt: string
  locationSource?: string | null
  batteryLevel?: number | null
  signalStrength?: number | null
  notes?: string | null
  metadata?: Record<string, unknown> | null
}

// Reactive state
const mapElement = ref<HTMLElement | null>(null)
const mapInstance = ref<L.Map | null>(null)
const locationHistory = ref<LocationPoint[]>([])
const isLoading = ref(true)
const loadingError = ref('')
const selectedDateRange = ref('30')
const routeLayer = ref<L.LayerGroup | null>(null)
const showingLastKnownPosition = ref(false)

// Computed route statistics
const routeStats = computed(() => {
  if (locationHistory.value.length === 0) return null

  const points = locationHistory.value
  let totalDistance = 0
  let totalSpeed = 0
  let speedCount = 0
  let maxSpeed = 0

  // Calculate distance and speed stats
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]

    // Calculate distance using Haversine formula
    const distance = calculateDistance(
      Number(prev.latitude),
      Number(prev.longitude),
      Number(curr.latitude),
      Number(curr.longitude)
    )
    totalDistance += distance

    // Check for recorded speed values (convert to number, handle strings)
    const speed = curr.speed !== null && curr.speed !== undefined ? Number(curr.speed) : 0
    if (speed > 0 && !isNaN(speed)) {
      totalSpeed += speed
      speedCount++
      if (speed > maxSpeed) maxSpeed = speed
    }
  }

  // Calculate average speed from distance and time if no recorded speed data
  let avgSpeed = 0
  if (speedCount > 0) {
    avgSpeed = totalSpeed / speedCount
  } else if (points.length >= 2 && totalDistance > 0) {
    // Fall back to distance/time calculation
    const firstTime = new Date(points[0].recordedAt).getTime()
    const lastTime = new Date(points[points.length - 1].recordedAt).getTime()
    const hours = (lastTime - firstTime) / (1000 * 60 * 60)
    if (hours > 0) {
      avgSpeed = totalDistance / hours
    }
  }

  // Battery drop calculation - ensure values are numbers
  const batteryLevels = points.filter(p => p.batteryLevel !== null && p.batteryLevel !== undefined)
  let batteryDrop = 0
  if (batteryLevels.length >= 2) {
    const firstBattery = Number(batteryLevels[0].batteryLevel) || 0
    const lastBattery = Number(batteryLevels[batteryLevels.length - 1].batteryLevel) || 0
    batteryDrop = Math.abs(firstBattery - lastBattery)
  }

  // Time range
  const firstTime = new Date(points[0].recordedAt)
  const lastTime = new Date(points[points.length - 1].recordedAt)
  const timeRangeStr = `${formatDate(firstTime)} - ${formatDate(lastTime)}`

  return {
    totalDistance: isNaN(totalDistance) ? '0.00' : Number(totalDistance).toFixed(2),
    avgSpeed: isNaN(avgSpeed) ? '0.0' : Number(avgSpeed).toFixed(1),
    maxSpeed: isNaN(maxSpeed) ? '0.0' : Number(maxSpeed).toFixed(1),
    pointCount: points.length,
    timeRange: timeRangeStr,
    batteryDrop: isNaN(batteryDrop) ? '0' : Number(batteryDrop).toFixed(0)
  }
})

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Helper function to format date
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Load route data from API
async function loadRouteData() {
  isLoading.value = true
  loadingError.value = ''
  showingLastKnownPosition.value = false

  // Clear existing route
  clearRoute()

  try {
    const daysAgo = parseInt(selectedDateRange.value)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysAgo)

    const response = await fetch(
      `/api/device-location-history?device_id=${props.deviceId}&start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}&_t=${Date.now()}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch location history')
    }

    const result = await response.json()

    console.log(`📍 Loaded ${result.data?.length || 0} points for ${props.deviceId} (${daysAgo} days)`)

    if (result.success) {
      locationHistory.value = result.data || []

      // If no data in selected range, try to fetch last known position
      if (locationHistory.value.length === 0) {
        await loadLastKnownPosition()
      }

      // Render route on map if we have data
      if (locationHistory.value.length > 0 && mapInstance.value) {
        await nextTick()
        // Invalidate size before rendering to ensure proper dimensions
        mapInstance.value.invalidateSize()
        // Small delay to ensure map is ready before rendering and fitting bounds
        setTimeout(() => {
          if (mapInstance.value) {
            renderRoute()
            // Force another invalidateSize after render to ensure fitBounds works correctly
            mapInstance.value.invalidateSize()
          }
        }, 50)
      }
    } else {
      throw new Error(result.error || 'Failed to load route data')
    }
  } catch (error) {
    console.error('Error loading route data:', error)
    loadingError.value = error instanceof Error ? error.message : 'Failed to load route data'
    locationHistory.value = []
  } finally {
    isLoading.value = false
  }
}

// Fetch last known position when selected date range is empty
async function loadLastKnownPosition() {
  try {
    const response = await fetch(
      `/api/device-location-history?device_id=${props.deviceId}&limit=1`
    )

    if (!response.ok) return

    const result = await response.json()

    if (result.success && result.data && result.data.length > 0) {
      locationHistory.value = result.data
      showingLastKnownPosition.value = true
    }
  } catch (error) {
    console.error('Error loading last known position:', error)
  }
}

// Initialize Leaflet map
function initializeMap() {
  if (!mapElement.value || mapInstance.value) return

  // Ensure container has dimensions before initializing
  const rect = mapElement.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    // Container not visible yet, retry after a short delay
    setTimeout(() => initializeMap(), 100)
    return
  }

  // Create map centered on Switzerland
  const map = L.map(mapElement.value, {
    center: [46.8182, 8.2275],
    zoom: 8,
    zoomControl: true
  })

  // Add OpenStreetMap tiles with dark theme
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map)

  // Create layer group for route elements
  routeLayer.value = L.layerGroup().addTo(map)
  mapInstance.value = map

  // Fix for map tiles not loading properly - invalidate size multiple times
  // to handle various container visibility scenarios
  const invalidateTimes = [50, 100, 200, 500]
  invalidateTimes.forEach(delay => {
    setTimeout(() => {
      if (map && mapElement.value) {
        map.invalidateSize()
      }
    }, delay)
  })

  // Render route if data is already loaded
  if (locationHistory.value.length > 0) {
    renderRoute()
  }
}

// Render route on map
function renderRoute() {
  if (!mapInstance.value || !routeLayer.value || locationHistory.value.length === 0) return

  // Clear existing route elements
  clearRoute()

  const points = locationHistory.value

  console.log(`🗺️ Rendering route with ${points.length} points`)

  // Single point scenario
  if (points.length === 1) {
    const point = points[0]
    const markerLabel = showingLastKnownPosition.value ? 'Last Known Position' : 'Current Position'

    const marker = L.circleMarker([point.latitude, point.longitude], {
      radius: 12,
      fillColor: '#3b82f6',
      color: '#ffffff',
      weight: 3,
      opacity: 1,
      fillOpacity: 1
    })
    routeLayer.value!.addLayer(marker)

    marker.bindPopup(createPopupContent(point, markerLabel))

    mapInstance.value.setView([point.latitude, point.longitude], 14)
    return
  }

  // Multiple points - create polyline
  const latLngs: L.LatLngExpression[] = points.map(p => [p.latitude, p.longitude])

  // Draw route line in amber/gold (between orange and yellow)
  const routeLine = L.polyline(latLngs, {
    color: '#f0a500',
    weight: 1.25,
    opacity: 1,
    lineJoin: 'round'
  })
  routeLayer.value!.addLayer(routeLine)

  // Add start marker (green) with label
  const startPoint = points[0]
  const startMarker = L.circleMarker([startPoint.latitude, startPoint.longitude], {
    radius: 12,
    fillColor: '#10b981',
    color: '#ffffff',
    weight: 3,
    opacity: 1,
    fillOpacity: 1
  })
  routeLayer.value!.addLayer(startMarker)
  startMarker.bindPopup(createPopupContent(startPoint, 'Start'))

  // Add start label
  const startLabel = L.divIcon({
    className: 'route-marker-label',
    html: '<div style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">START</div>',
    iconSize: [50, 20],
    iconAnchor: [25, -8]
  })
  const startLabelMarker = L.marker([startPoint.latitude, startPoint.longitude], { icon: startLabel, interactive: false })
  routeLayer.value!.addLayer(startLabelMarker)

  // Add end marker (red) with label
  const endPoint = points[points.length - 1]
  const endMarker = L.circleMarker([endPoint.latitude, endPoint.longitude], {
    radius: 12,
    fillColor: '#ef4444',
    color: '#ffffff',
    weight: 3,
    opacity: 1,
    fillOpacity: 1
  })
  routeLayer.value!.addLayer(endMarker)
  endMarker.bindPopup(createPopupContent(endPoint, 'End'))

  // Add end label
  const endLabel = L.divIcon({
    className: 'route-marker-label',
    html: '<div style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">END</div>',
    iconSize: [40, 20],
    iconAnchor: [20, -8]
  })
  const endLabelMarker = L.marker([endPoint.latitude, endPoint.longitude], { icon: endLabel, interactive: false })
  routeLayer.value!.addLayer(endLabelMarker)

  // Fit bounds to show entire route with animation
  const bounds = routeLine.getBounds()
  if (bounds.isValid()) {
    mapInstance.value.fitBounds(bounds, {
      padding: [50, 50],
      animate: true,
      duration: 0.3
    })
  }
}

// Create popup content for markers
function createPopupContent(point: LocationPoint, label: string): string {
  const recordedDate = new Date(point.recordedAt)
  return `
    <div style="min-width: 180px; font-family: system-ui, -apple-system, sans-serif;">
      <h4 style="margin: 0 0 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${label}</h4>
      <div style="display: grid; gap: 4px; font-size: 12px;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #6b7280;">Time:</span>
          <span style="color: #1f2937; font-weight: 500;">${recordedDate.toLocaleString()}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #6b7280;">Location:</span>
          <span style="color: #1f2937; font-weight: 500;">${Number(point.latitude).toFixed(6)}, ${Number(point.longitude).toFixed(6)}</span>
        </div>
        ${point.speed !== null && point.speed !== undefined ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Speed:</span>
            <span style="color: #1f2937; font-weight: 500;">${Number(point.speed).toFixed(1)} km/h</span>
          </div>
        ` : ''}
        ${point.batteryLevel !== null && point.batteryLevel !== undefined ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Battery:</span>
            <span style="color: ${point.batteryLevel >= 50 ? '#10b981' : '#ef4444'}; font-weight: 500;">${point.batteryLevel}%</span>
          </div>
        ` : ''}
        ${point.altitude !== null && point.altitude !== undefined ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #6b7280;">Altitude:</span>
            <span style="color: #1f2937; font-weight: 500;">${Number(point.altitude).toFixed(0)} m</span>
          </div>
        ` : ''}
      </div>
    </div>
  `
}

// Clear route elements from map
function clearRoute() {
  if (routeLayer.value) {
    routeLayer.value.clearLayers()
  }
}

// Retry loading
function retryLoad() {
  loadingError.value = ''
  if (!mapInstance.value) {
    initializeMap()
  } else {
    loadRouteData()
  }
}

// Resize observer for map container
let resizeObserver: ResizeObserver | null = null
let initCheckInterval: ReturnType<typeof setInterval> | null = null

// Lifecycle hooks
onMounted(() => {
  // Use nextTick to ensure DOM is fully rendered
  nextTick(() => {
    // Load data first - this will make the map container visible once data is loaded
    loadRouteData()

    // Set up interval to initialize map once container becomes visible
    initCheckInterval = setInterval(() => {
      if (mapElement.value && !mapInstance.value) {
        const rect = mapElement.value.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          initializeMap()
          if (initCheckInterval) {
            clearInterval(initCheckInterval)
            initCheckInterval = null
          }
        }
      } else if (mapInstance.value && initCheckInterval) {
        clearInterval(initCheckInterval)
        initCheckInterval = null
      }
    }, 100)

    // Set up resize observer to handle container size changes
    if (mapElement.value) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            if (!mapInstance.value) {
              // Container just became visible, initialize map
              initializeMap()
            } else {
              mapInstance.value.invalidateSize()
            }
          }
        }
      })
      resizeObserver.observe(mapElement.value)
    }
  })
})

onUnmounted(() => {
  if (initCheckInterval) {
    clearInterval(initCheckInterval)
    initCheckInterval = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (mapInstance.value) {
    mapInstance.value.remove()
    mapInstance.value = null
  }
})

// Watch for device changes
watch(() => props.deviceId, () => {
  loadRouteData()
})
</script>

<style scoped>
.device-route-map {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
}

.map-controls {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 1rem;
}

.controls-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.controls-header h4 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #e2e8f0;
}

.date-range-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.date-range-select {
  padding: 0.5rem 1rem;
  border: 1px solid #475569;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #e2e8f0;
  background: #0f172a;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.date-range-select:hover {
  border-color: #60a5fa;
}

.date-range-select:focus {
  outline: none;
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.2);
}

.last-known-notice {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  background: #1e3a5f;
  border: 1px solid #3b82f6;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.notice-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.notice-text {
  font-size: 0.875rem;
  color: #93c5fd;
  line-height: 1.5;
}

.notice-text strong {
  font-weight: 600;
  color: #bfdbfe;
}

.route-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #334155;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.7rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 1rem;
  font-weight: 600;
  color: #e2e8f0;
}

.map-container {
  flex: 1;
  min-height: 400px;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #334155;
  background: #0f172a;
}

.leaflet-map {
  width: 100%;
  height: 100%;
  min-height: 400px;
}

.map-loading,
.map-error,
.map-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: 1rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #334155;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.map-loading p,
.map-error p,
.map-empty p {
  color: #94a3b8;
  font-size: 0.875rem;
}

.empty-hint {
  color: #64748b;
  font-size: 0.75rem;
}

.error-icon,
.empty-icon {
  font-size: 3rem;
}

.error-message {
  color: #f87171;
  font-weight: 500;
}

.retry-btn {
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.retry-btn:hover {
  background: #2563eb;
}

/* Leaflet popup styling */
:deep(.leaflet-popup-content-wrapper) {
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

:deep(.leaflet-popup-tip) {
  background: white;
}

@media (max-width: 768px) {
  .route-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .controls-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>

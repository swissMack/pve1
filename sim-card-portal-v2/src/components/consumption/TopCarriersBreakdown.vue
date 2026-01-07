<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { TimeGranularity, FilterCriteria } from '@/types/analytics'

Chart.register(...registerables)

interface DateRange {
  start: string
  end: string
}

interface CarrierData {
  id: string
  name: string
  simCount: number
  simPercentage: number
  dataUsageGB: number
  cost: number
  costPercentage: number
  dataPercentage: number
}

interface CarrierLocation {
  id: string
  name: string
  latitude: number
  longitude: number
  carrier: string
  iccid: string
  simStatus: string
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

const chartCanvas = ref<HTMLCanvasElement | null>(null)
const chartInstance = ref<Chart | null>(null)
const mapContainer = ref<HTMLDivElement | null>(null)
const mapInstance = ref<L.Map | null>(null)
const carriers = ref<CarrierData[]>([])
const carrierLocations = ref<CarrierLocation[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const COLORS = ['#137fec', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

// Build carrier to color mapping
const getCarrierColor = (carrierName: string): string => {
  const carrierIndex = carriers.value.findIndex(c => c.name === carrierName)
  return carrierIndex >= 0 ? COLORS[carrierIndex % COLORS.length] : '#6b7280'
}

const fetchCarriers = async () => {
  loading.value = true
  error.value = null

  // Destroy existing map if re-fetching
  if (mapInstance.value) {
    mapInstance.value.remove()
    mapInstance.value = null
  }

  try {
    const params = new URLSearchParams({
      start_date: props.dateRange.start,
      end_date: props.dateRange.end
    })

    // Add filter parameters if provided
    if (props.filters?.networks?.length) {
      props.filters.networks.forEach((mccmnc: string) => params.append('mccmnc', mccmnc))
    }
    if (props.filters?.imsis?.length) {
      props.filters.imsis.forEach((imsi: string) => params.append('imsi', imsi))
    }

    // Fetch carriers and locations in parallel
    const [carriersResponse, locationsResponse] = await Promise.all([
      fetch(`/api/consumption/carriers?${params}`),
      fetch(`/api/consumption/carrier-locations?${params}`)
    ])

    const carriersResult = await carriersResponse.json()
    const locationsResult = await locationsResponse.json()

    if (carriersResult.success) {
      // Sort carriers by SIM count (highest first)
      carriers.value = carriersResult.data.sort((a: CarrierData, b: CarrierData) =>
        (b.simCount || 0) - (a.simCount || 0)
      )
    } else {
      error.value = carriersResult.error || 'Failed to load carriers'
    }

    if (locationsResult.success) {
      carrierLocations.value = locationsResult.data
    }
  } catch (err) {
    console.error('Error fetching carriers:', err)
    error.value = 'Network error'
  } finally {
    loading.value = false
    // Wait for DOM to update after loading is false, then render chart and map
    await nextTick()
    if (carriers.value.length > 0) {
      renderChart()
      initMap()
    }
  }
}

const initMap = () => {
  if (!mapContainer.value || mapInstance.value) return

  // EMEA region view (Europe, Middle East, Africa)
  const defaultCenter: L.LatLngExpression = [35, 20]
  const defaultZoom = 2

  mapInstance.value = L.map(mapContainer.value, {
    center: defaultCenter,
    zoom: defaultZoom,
    zoomControl: false,
    attributionControl: false,
    doubleClickZoom: false
  })

  // Add dark tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(mapInstance.value as unknown as L.Map)

  // Add markers for each location
  addMapMarkers()

  // Double-click to reset view to EMEA
  mapInstance.value.on('dblclick', () => {
    mapInstance.value?.setView(defaultCenter, defaultZoom)
  })

  // Invalidate size after a short delay to ensure proper rendering
  setTimeout(() => {
    if (mapInstance.value) {
      mapInstance.value.invalidateSize()
    }
  }, 100)
}

const addMapMarkers = () => {
  if (!mapInstance.value) return

  carrierLocations.value.forEach(location => {
    if (!location.latitude || !location.longitude) return

    const color = getCarrierColor(location.carrier)

    // Create small circle marker
    const marker = L.circleMarker([location.latitude, location.longitude], {
      radius: 7,
      fillColor: color,
      fillOpacity: 0.9,
      color: '#ffffff',
      weight: 2,
      opacity: 0.8
    })

    // Add popup
    const popupContent = `
      <div class="text-xs">
        <div class="font-semibold text-white">${location.name}</div>
        <div class="text-gray-300">${location.carrier}</div>
      </div>
    `

    marker.bindPopup(popupContent, {
      className: 'dark-popup'
    })

    marker.addTo(mapInstance.value as unknown as L.Map)
  })

  // Keep EMEA view - don't auto-fit to data points
}

const renderChart = () => {
  if (!chartCanvas.value || carriers.value.length === 0) return

  if (chartInstance.value) {
    chartInstance.value.destroy()
  }

  // Use top 6 carriers (already sorted by SIM count)
  const topCarriers = carriers.value.slice(0, 6)

  const labels = topCarriers.map(c => c.name)
  const data = topCarriers.map(c => c.simCount || 1)

  chartInstance.value = new Chart(chartCanvas.value, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: COLORS,
        borderColor: '#1f2937',
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: {
            color: '#f3f4f6',
            font: { size: 10 },
            padding: 8,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        tooltip: {
          backgroundColor: '#283039',
          titleColor: '#f3f4f6',
          bodyColor: '#9ca3af',
          borderColor: '#3b4754',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (context) => {
              const carrier = topCarriers[context.dataIndex]
              return [
                `SIMs: ${carrier.simCount || 0}`,
                `Share: ${(carrier.simPercentage || 0).toFixed(1)}%`
              ]
            }
          }
        }
      }
    }
  })
}

// Emit loading state changes to parent
watch(loading, (isLoading) => {
  emit('loading', isLoading)
})

onMounted(fetchCarriers)
watch(() => props.dateRange, fetchCarriers, { deep: true })
// Watch for granularity changes from parent
watch(() => props.granularity, fetchCarriers)
// Watch for filter changes
watch(() => props.filters, fetchCarriers, { deep: true })

onUnmounted(() => {
  if (mapInstance.value) {
    mapInstance.value.remove()
    mapInstance.value = null
  }
})
</script>

<template>
  <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden h-full">
    <!-- Header -->
    <div class="px-5 py-4 border-b border-border-dark flex items-center gap-2">
      <span class="material-symbols-outlined text-amber-400">cell_tower</span>
      <h3 class="text-white font-semibold">Top Carriers</h3>
    </div>

    <!-- Content -->
    <div class="p-5">
      <div v-if="loading" class="h-[200px] flex items-center justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>

      <div v-else-if="error" class="h-[200px] flex items-center justify-center">
        <div class="text-center">
          <span class="material-symbols-outlined text-red-400 text-3xl mb-2">error</span>
          <p class="text-red-400 text-sm">{{ error }}</p>
        </div>
      </div>

      <div v-else-if="carriers.length === 0" class="h-[200px] flex items-center justify-center">
        <div class="text-center">
          <span class="material-symbols-outlined text-text-secondary text-3xl mb-2">pie_chart</span>
          <p class="text-text-secondary text-sm">No carrier data available</p>
        </div>
      </div>

      <template v-else>
        <!-- World Map with Carrier Pins -->
        <div class="h-[280px] mb-4 rounded-lg overflow-hidden border border-border-dark relative z-0">
          <div ref="mapContainer" class="h-full w-full map-lighter"></div>
        </div>

        <!-- Chart -->
        <div class="h-[120px] mb-4">
          <canvas ref="chartCanvas"></canvas>
        </div>

        <!-- Legend - shows ~20 carriers before scrolling -->
        <div class="space-y-1 max-h-[600px] overflow-y-auto pr-2">
          <div
            v-for="(carrier, index) in carriers"
            :key="carrier.id"
            class="flex items-center justify-between py-1.5 border-b border-border-dark last:border-0"
          >
            <div class="flex items-center gap-2">
              <div
                class="w-3 h-3 rounded-full flex-shrink-0"
                :style="{ backgroundColor: COLORS[index % COLORS.length] }"
              ></div>
              <span class="text-white text-sm truncate">{{ carrier.name }}</span>
            </div>
            <div class="text-right flex-shrink-0">
              <div class="text-white text-sm font-medium">{{ carrier.simCount || 0 }} SIMs</div>
              <div class="text-text-secondary text-xs">{{ (carrier.simPercentage || 0).toFixed(1) }}%</div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style>
/* Contain map z-index to prevent overlapping header */
.map-lighter {
  isolation: isolate;
}

/* Make map tiles 10% lighter */
.map-lighter .leaflet-tile-pane {
  filter: brightness(1.1);
}

/* Dark popup styling for carrier map */
.dark-popup .leaflet-popup-content-wrapper {
  background-color: #283039;
  color: #f3f4f6;
  border-radius: 8px;
  border: 1px solid #3b4754;
  padding: 4px;
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
</style>

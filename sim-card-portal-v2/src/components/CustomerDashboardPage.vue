<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssetLocation {
  id: string
  name: string
  currentStatus: string
  assetType: string
  barcode: string
  latitude: number | null
  longitude: number | null
}

interface DashboardStats {
  totalAssets: number
  assetsByStatus: Record<string, number>
  totalGeozones: number
  geozonesByType: Record<string, number>
  recentEventsCount: number
  activeTripsCount: number
  assetsWithLocation: AssetLocation[]
}

interface Asset {
  id: string
  name: string
  currentStatus: string
  assetType: string
  barcode: string
  lastTripDate: string | null
}

interface Geozone {
  id: string
  name: string
  type: string
  zoneType?: string
  active: boolean
  color: string | null
  geometryGeojson: unknown | null
  assetCount: number
  address?: string | null
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  refreshKey?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  selectAsset: [assetId: string]
}>()

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE_URL = window.location.origin

const STATUS_COLORS: Record<string, string> = {
  at_facility: '#10b981',
  in_transit: '#3b82f6',
  at_customer: '#8b5cf6',
  at_supplier: '#f59e0b',
  stored: '#6b7280',
  unknown: '#9ca3af'
}

const STATUS_LABELS: Record<string, string> = {
  at_facility: 'At Facility',
  in_transit: 'In Transit',
  at_customer: 'At Customer',
  at_supplier: 'At Supplier',
  stored: 'Stored',
  unknown: 'Unknown'
}

const GEOZONE_TYPE_LABELS: Record<string, string> = {
  warehouse: 'Warehouse',
  supplier: 'Supplier',
  customer: 'Customer',
  transit_hub: 'Transit Hub',
  restricted: 'Restricted'
}

// ---------------------------------------------------------------------------
// Stat card definitions (FR-402)
// ---------------------------------------------------------------------------

const statCards = computed(() => [
  {
    label: 'Total Assets',
    value: stats.value?.totalAssets ?? 0,
    icon: 'inventory_2',
    colorClass: 'bg-primary/10 text-primary'
  },
  {
    label: 'At Facility',
    value: stats.value?.assetsByStatus?.at_facility ?? 0,
    icon: 'warehouse',
    colorClass: 'bg-green-500/10 text-green-400'
  },
  {
    label: 'In Transit',
    value: stats.value?.assetsByStatus?.in_transit ?? 0,
    icon: 'local_shipping',
    colorClass: 'bg-blue-500/10 text-blue-400'
  },
  {
    label: 'At Customer',
    value: stats.value?.assetsByStatus?.at_customer ?? 0,
    icon: 'storefront',
    colorClass: 'bg-purple-500/10 text-purple-400'
  },
  {
    label: 'At Supplier',
    value: stats.value?.assetsByStatus?.at_supplier ?? 0,
    icon: 'factory',
    colorClass: 'bg-amber-500/10 text-amber-400'
  },
  {
    label: 'Stored',
    value: stats.value?.assetsByStatus?.stored ?? 0,
    icon: 'archive',
    colorClass: 'bg-gray-500/10 text-gray-400'
  }
])

// ---------------------------------------------------------------------------
// Reactive state
// ---------------------------------------------------------------------------

const stats = ref<DashboardStats | null>(null)
const assets = ref<Asset[]>([])
const geozones = ref<Geozone[]>([])
const loadingStats = ref(true)
const loadingAssets = ref(true)
const loadingGeozones = ref(true)
const errorStats = ref('')
const errorAssets = ref('')
const errorGeozones = ref('')

// Map
const mapRef = ref<HTMLElement | null>(null)
let mapInstance: L.Map | null = null
let markerLayerGroup: L.LayerGroup | null = null
let geozoneLayerGroup: L.LayerGroup | null = null
let resizeObserver: ResizeObserver | null = null
const isMapReady = ref(false)
const mapError = ref('')

// ---------------------------------------------------------------------------
// Computed
// ---------------------------------------------------------------------------

const assetsWithLocation = computed(() => {
  return stats.value?.assetsWithLocation?.filter(
    a => a.latitude !== null && a.longitude !== null
  ) ?? []
})

const geozonesByType = computed(() => {
  if (!stats.value?.geozonesByType) return []
  return Object.entries(stats.value.geozonesByType).map(([type, count]) => ({
    type,
    label: GEOZONE_TYPE_LABELS[type] || type,
    count
  }))
})

const activeGeozones = computed(() => geozones.value.filter(g => g.active))

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function loadDashboardStats() {
  loadingStats.value = true
  errorStats.value = ''
  try {
    const response = await fetch(`${API_BASE_URL}/api/customer-dashboard/stats`)
    const result = await response.json()
    if (result.success) {
      stats.value = result.data
    } else {
      errorStats.value = result.error || 'Failed to load dashboard statistics'
    }
  } catch (err) {
    console.error('Error loading dashboard stats:', err)
    errorStats.value = 'Failed to load dashboard statistics'
  } finally {
    loadingStats.value = false
  }
}

async function loadAssets() {
  loadingAssets.value = true
  errorAssets.value = ''
  try {
    const response = await fetch(`${API_BASE_URL}/api/assets`)
    const result = await response.json()
    if (result.success) {
      assets.value = result.data
    } else {
      errorAssets.value = result.error || 'Failed to load assets'
    }
  } catch (err) {
    console.error('Error loading assets:', err)
    errorAssets.value = 'Failed to load assets'
  } finally {
    loadingAssets.value = false
  }
}

async function loadGeozones() {
  loadingGeozones.value = true
  errorGeozones.value = ''
  try {
    const response = await fetch(`${API_BASE_URL}/api/geozones`)
    const result = await response.json()
    if (result.success) {
      geozones.value = result.data
    } else {
      errorGeozones.value = result.error || 'Failed to load geozones'
    }
  } catch (err) {
    console.error('Error loading geozones:', err)
    errorGeozones.value = 'Failed to load geozones'
  } finally {
    loadingGeozones.value = false
  }
}

async function loadAllData() {
  await Promise.all([
    loadDashboardStats(),
    loadAssets(),
    loadGeozones()
  ])
  // Render map layers once all data is available
  await nextTick()
  renderMapLayers()
}

// ---------------------------------------------------------------------------
// Map (FR-403 / FR-404)
// ---------------------------------------------------------------------------

function initMap() {
  if (!mapRef.value || mapInstance) return

  mapError.value = ''

  try {
    mapInstance = L.map(mapRef.value, {
      center: [48.5, 8.0],
      zoom: 5,
      zoomControl: true,
      attributionControl: true
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(mapInstance)

    markerLayerGroup = L.layerGroup().addTo(mapInstance)
    geozoneLayerGroup = L.layerGroup().addTo(mapInstance)

    // Add legend
    addMapLegend()

    // Handle resize
    if (mapRef.value) {
      resizeObserver = new ResizeObserver(() => {
        mapInstance?.invalidateSize()
      })
      resizeObserver.observe(mapRef.value)
    }

    // Ensure tiles render correctly
    setTimeout(() => {
      mapInstance?.invalidateSize()
    }, 100)

    isMapReady.value = true

    // Render data if already loaded
    renderMapLayers()
  } catch (err) {
    console.error('Error initializing map:', err)
    mapError.value = 'Failed to initialize map'
  }
}

function addMapLegend() {
  if (!mapInstance) return

  const LegendControl = L.Control.extend({
    options: { position: 'bottomright' as L.ControlPosition },
    onAdd() {
      const container = L.DomUtil.create('div', 'leaflet-legend')
      container.style.cssText =
        'background: #18222c; border: 1px solid #283039; border-radius: 8px; padding: 10px 14px; font-family: Inter, sans-serif; font-size: 11px; line-height: 1.6; color: #9faab6;'

      const title = document.createElement('div')
      title.textContent = 'Asset Status'
      title.style.cssText = 'font-weight: 600; color: #fff; margin-bottom: 6px; font-size: 12px;'
      container.appendChild(title)

      for (const [status, color] of Object.entries(STATUS_COLORS)) {
        const row = document.createElement('div')
        row.style.cssText = 'display: flex; align-items: center; gap: 8px;'

        const dot = document.createElement('span')
        dot.style.cssText = `display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${color}; flex-shrink: 0;`

        const label = document.createElement('span')
        label.textContent = STATUS_LABELS[status] || status

        row.appendChild(dot)
        row.appendChild(label)
        container.appendChild(row)
      }

      return container
    }
  })

  new LegendControl().addTo(mapInstance)
}

function renderMapLayers() {
  if (!mapInstance || !isMapReady.value) return

  renderAssetMarkers()
  renderGeozonePolygons()
  fitMapBounds()
}

function renderAssetMarkers() {
  if (!markerLayerGroup) return
  markerLayerGroup.clearLayers()

  for (const asset of assetsWithLocation.value) {
    const color = STATUS_COLORS[asset.currentStatus] || STATUS_COLORS.unknown
    const statusLabel = STATUS_LABELS[asset.currentStatus] || asset.currentStatus

    const marker = L.circleMarker([asset.latitude!, asset.longitude!], {
      radius: 8,
      fillColor: color,
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    })

    const popupHtml = `
      <div style="min-width: 200px; font-family: 'Inter', sans-serif;">
        <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #fff;">${escapeHtml(asset.name)}</h4>
        <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #9faab6;">Status</span>
            <span style="padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;
                         background: ${color}20; color: ${color};">
              ${escapeHtml(statusLabel)}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #9faab6;">Type</span>
            <span style="color: #fff;">${escapeHtml(asset.assetType || 'N/A')}</span>
          </div>
          ${asset.barcode ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #9faab6;">Barcode</span>
            <span style="color: #fff; font-family: monospace; font-size: 11px;">${escapeHtml(asset.barcode)}</span>
          </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #9faab6;">Location</span>
            <span style="color: #fff; font-size: 11px;">${asset.latitude!.toFixed(4)}, ${asset.longitude!.toFixed(4)}</span>
          </div>
        </div>
      </div>
    `

    marker.bindPopup(popupHtml, {
      className: 'customer-dashboard-popup',
      maxWidth: 280
    })

    markerLayerGroup.addLayer(marker)
  }
}

function renderGeozonePolygons() {
  if (!geozoneLayerGroup) return
  geozoneLayerGroup.clearLayers()

  for (const zone of geozones.value) {
    if (!zone.geometryGeojson) continue

    const zoneColor = zone.color || '#3b82f6'

    try {
      const geoJsonLayer = L.geoJSON(zone.geometryGeojson as GeoJSON.GeoJsonObject, {
        style: {
          color: zoneColor,
          weight: 2,
          opacity: 0.8,
          fillColor: zoneColor,
          fillOpacity: 0.15
        }
      })

      const zoneType = zone.type || zone.zoneType || 'unknown'
      const typeLabel = GEOZONE_TYPE_LABELS[zoneType] || zoneType

      geoJsonLayer.bindPopup(`
        <div style="min-width: 180px; font-family: 'Inter', sans-serif;">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #fff;">${escapeHtml(zone.name)}</h4>
          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #9faab6;">Type</span>
              <span style="color: #fff;">${escapeHtml(typeLabel)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #9faab6;">Assets</span>
              <span style="color: #fff; font-weight: 500;">${zone.assetCount ?? 0}</span>
            </div>
            ${zone.address ? `
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #9faab6;">Address</span>
              <span style="color: #fff; max-width: 140px; text-align: right;">${escapeHtml(zone.address)}</span>
            </div>
            ` : ''}
          </div>
        </div>
      `, {
        className: 'customer-dashboard-popup',
        maxWidth: 280
      })

      geozoneLayerGroup.addLayer(geoJsonLayer)
    } catch (err) {
      console.warn(`Failed to render geozone "${zone.name}":`, err)
    }
  }
}

function fitMapBounds() {
  if (!mapInstance) return

  const bounds = L.latLngBounds([])

  // Include asset markers
  for (const asset of assetsWithLocation.value) {
    bounds.extend([asset.latitude!, asset.longitude!])
  }

  // Include geozone polygons
  if (geozoneLayerGroup) {
    geozoneLayerGroup.eachLayer((layer) => {
      if ('getBounds' in layer && typeof (layer as L.GeoJSON).getBounds === 'function') {
        try {
          const layerBounds = (layer as L.GeoJSON).getBounds()
          if (layerBounds.isValid()) {
            bounds.extend(layerBounds)
          }
        } catch {
          // Silently skip layers without valid bounds
        }
      }
    })
  }

  if (bounds.isValid()) {
    mapInstance.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 14,
      animate: false
    })
  }
}

function handleFitAll() {
  fitMapBounds()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'at_facility': return 'bg-green-500/10 text-green-400 border-green-500/20'
    case 'in_transit': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    case 'at_customer': return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    case 'at_supplier': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    case 'stored': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    case 'unknown': return 'bg-gray-500/10 text-gray-300 border-gray-500/20'
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }
}

function getStatusDotClass(status: string): string {
  switch (status) {
    case 'at_facility': return 'bg-green-400'
    case 'in_transit': return 'bg-blue-400'
    case 'at_customer': return 'bg-purple-400'
    case 'at_supplier': return 'bg-amber-400'
    case 'stored': return 'bg-gray-400'
    case 'unknown': return 'bg-gray-300'
    default: return 'bg-gray-400'
  }
}

function getGeozoneTypeIcon(type: string): string {
  switch (type) {
    case 'warehouse': return 'warehouse'
    case 'supplier': return 'factory'
    case 'customer': return 'storefront'
    case 'transit_hub': return 'hub'
    case 'restricted': return 'block'
    default: return 'pin_drop'
  }
}

function getGeozoneTypeColorClass(type: string): string {
  switch (type) {
    case 'warehouse': return 'bg-green-500/10 text-green-400'
    case 'supplier': return 'bg-amber-500/10 text-amber-400'
    case 'customer': return 'bg-purple-500/10 text-purple-400'
    case 'transit_hub': return 'bg-blue-500/10 text-blue-400'
    case 'restricted': return 'bg-red-500/10 text-red-400'
    default: return 'bg-gray-500/10 text-gray-400'
  }
}

function formatAssetType(type: string | null | undefined): string {
  if (!type) return '\u2014'
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function handleRowClick(assetId: string) {
  emit('selectAsset', assetId)
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(async () => {
  await loadAllData()
  await nextTick()
  initMap()
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
  markerLayerGroup = null
  geozoneLayerGroup = null
})

// Watch for refresh trigger from parent
watch(() => props.refreshKey, () => {
  loadAllData()
})
</script>

<template>
  <div class="p-6 lg:p-8 bg-background-dark min-h-full">
    <div class="max-w-[1600px] mx-auto flex flex-col gap-6">

      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">Customer Dashboard</h1>
          <p class="text-text-secondary text-sm mt-1">
            Asset tracking overview and location intelligence
          </p>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 text-text-secondary text-sm">
            <span class="material-symbols-outlined text-[18px]">schedule</span>
            Last updated: {{ new Date().toLocaleTimeString() }}
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- FR-402: Stat Cards                                               -->
      <!-- ================================================================ -->

      <div v-if="loadingStats" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div
          v-for="n in 6"
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
            @click="loadDashboardStats"
            class="ml-auto px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div
          v-for="card in statCards"
          :key="card.label"
          class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4 hover:border-border-dark/80 transition-colors"
        >
          <div class="p-2.5 rounded-lg shrink-0" :class="card.colorClass">
            <span class="material-symbols-outlined text-[24px]">{{ card.icon }}</span>
          </div>
          <div class="min-w-0">
            <p class="text-2xl font-bold text-white">{{ card.value }}</p>
            <p class="text-text-secondary text-xs truncate">{{ card.label }}</p>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- FR-403 / FR-404: Asset Location Map                              -->
      <!-- ================================================================ -->

      <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
        <!-- Map Header -->
        <div class="px-5 py-4 border-b border-border-dark flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-primary/10 text-primary">
              <span class="material-symbols-outlined text-[20px]">map</span>
            </div>
            <div>
              <h3 class="text-white font-semibold">Asset Locations</h3>
              <p class="text-text-secondary text-xs mt-0.5">
                {{ assetsWithLocation.length }} asset{{ assetsWithLocation.length !== 1 ? 's' : '' }} with location
                &middot;
                {{ activeGeozones.length }} active geozone{{ activeGeozones.length !== 1 ? 's' : '' }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button
              v-if="assetsWithLocation.length > 0 || geozones.length > 0"
              @click="handleFitAll"
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-white bg-background-dark border border-border-dark rounded-lg hover:border-primary/50 transition-colors"
              title="Fit all markers and geozones in view"
            >
              <span class="material-symbols-outlined text-[16px]">fit_screen</span>
              Fit All
            </button>
          </div>
        </div>

        <!-- Map Container -->
        <div class="relative h-[450px]">
          <!-- Loading State -->
          <div
            v-if="loadingStats"
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background-dark z-10"
          >
            <div class="w-10 h-10 border-4 border-border-dark border-t-primary rounded-full animate-spin"></div>
            <p class="text-text-secondary text-sm">Loading map data...</p>
          </div>

          <!-- Error State -->
          <div
            v-else-if="mapError"
            class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background-dark z-10"
          >
            <span class="material-symbols-outlined text-4xl text-red-400">error</span>
            <p class="text-red-400 text-sm font-medium">{{ mapError }}</p>
            <button
              @click="initMap"
              class="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
            >
              Retry
            </button>
          </div>

          <!-- Map Element -->
          <div
            ref="mapRef"
            class="absolute inset-0 w-full h-full"
            :class="{ 'opacity-0': loadingStats }"
          ></div>

          <!-- Empty Overlay -->
          <div
            v-if="!loadingStats && !mapError && assetsWithLocation.length === 0 && geozones.length === 0"
            class="absolute inset-0 flex items-center justify-center bg-background-dark/80 z-10 pointer-events-none"
          >
            <div class="flex flex-col items-center gap-2 text-text-secondary">
              <span class="material-symbols-outlined text-4xl">location_off</span>
              <p class="text-sm">No asset location data available</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- FR-405: Geozone Summary Boxes                                    -->
      <!-- ================================================================ -->

      <div>
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2 rounded-lg bg-primary/10 text-primary">
            <span class="material-symbols-outlined text-[20px]">pin_drop</span>
          </div>
          <div>
            <h3 class="text-white font-semibold">Geozone Summary</h3>
            <p class="text-text-secondary text-xs mt-0.5">Active geozones grouped by type</p>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loadingGeozones || loadingStats" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div
            v-for="n in 5"
            :key="n"
            class="bg-surface-dark rounded-xl border border-border-dark p-5 animate-pulse"
          >
            <div class="flex flex-col gap-3">
              <div class="size-10 rounded-lg bg-border-dark"></div>
              <div class="h-4 w-20 rounded bg-border-dark"></div>
              <div class="h-6 w-8 rounded bg-border-dark"></div>
            </div>
          </div>
        </div>

        <!-- Error -->
        <div
          v-else-if="errorGeozones"
          class="bg-surface-dark rounded-xl border border-red-500/30 p-6"
        >
          <div class="flex items-center gap-3 text-red-400">
            <span class="material-symbols-outlined">error</span>
            <span class="text-sm">{{ errorGeozones }}</span>
            <button
              @click="loadGeozones"
              class="ml-auto px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>

        <!-- Summary Cards -->
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div
            v-for="item in geozonesByType"
            :key="item.type"
            class="bg-surface-dark rounded-xl border border-border-dark p-5 flex flex-col gap-3 hover:border-border-dark/80 transition-colors"
          >
            <div class="p-2.5 rounded-lg w-fit" :class="getGeozoneTypeColorClass(item.type)">
              <span class="material-symbols-outlined text-[24px]">{{ getGeozoneTypeIcon(item.type) }}</span>
            </div>
            <div>
              <p class="text-text-secondary text-xs font-medium uppercase tracking-wider">{{ item.label }}</p>
              <p class="text-2xl font-bold text-white mt-1">{{ item.count }}</p>
            </div>
          </div>

          <!-- Empty state -->
          <div
            v-if="geozonesByType.length === 0"
            class="col-span-full bg-surface-dark rounded-xl border border-border-dark p-8 flex flex-col items-center gap-2"
          >
            <span class="material-symbols-outlined text-4xl text-text-secondary">location_off</span>
            <p class="text-text-secondary text-sm">No geozones configured</p>
          </div>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- Asset List Table                                                 -->
      <!-- ================================================================ -->

      <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
        <!-- Table Header -->
        <div class="px-5 py-4 border-b border-border-dark flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-primary/10 text-primary">
              <span class="material-symbols-outlined text-[20px]">inventory_2</span>
            </div>
            <div>
              <h3 class="text-white font-semibold">Asset List</h3>
              <p class="text-text-secondary text-xs mt-0.5">
                {{ assets.length }} asset{{ assets.length !== 1 ? 's' : '' }} total
              </p>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loadingAssets" class="p-12">
          <div class="flex flex-col items-center justify-center gap-3">
            <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            <p class="text-text-secondary text-sm">Loading assets...</p>
          </div>
        </div>

        <!-- Error -->
        <div v-else-if="errorAssets" class="p-12">
          <div class="flex flex-col items-center justify-center gap-3 text-text-secondary">
            <span class="material-symbols-outlined text-4xl text-red-400">error</span>
            <p class="text-sm">{{ errorAssets }}</p>
            <button
              @click="loadAssets"
              class="mt-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>

        <!-- Table -->
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-background-dark border-b border-border-dark">
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">
                  Name
                </th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">
                  Status
                </th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">
                  Type
                </th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">
                  Last Trip Date
                </th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-dark text-sm">
              <tr
                v-for="asset in assets"
                :key="asset.id"
                class="hover:bg-surface-dark-highlight transition-colors group cursor-pointer"
                @click="handleRowClick(asset.id)"
              >
                <!-- Name -->
                <td class="py-3 px-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="size-10 rounded-lg flex items-center justify-center shrink-0"
                      :class="getStatusBadgeClass(asset.currentStatus)"
                    >
                      <span class="material-symbols-outlined text-[20px]">package_2</span>
                    </div>
                    <div>
                      <p class="text-white font-medium">{{ asset.name }}</p>
                      <p class="text-text-secondary text-xs">ID: {{ asset.id.substring(0, 8) }}...</p>
                    </div>
                  </div>
                </td>

                <!-- Status -->
                <td class="py-3 px-4">
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                    :class="getStatusBadgeClass(asset.currentStatus)"
                  >
                    <span class="size-1.5 rounded-full" :class="getStatusDotClass(asset.currentStatus)"></span>
                    {{ getStatusLabel(asset.currentStatus) }}
                  </span>
                </td>

                <!-- Type -->
                <td class="py-3 px-4 text-text-secondary">
                  {{ formatAssetType(asset.assetType) }}
                </td>

                <!-- Last Trip Date -->
                <td class="py-3 px-4 text-text-secondary text-xs">
                  {{ formatDate(asset.lastTripDate) }}
                </td>

                <!-- Actions -->
                <td class="py-3 px-4 text-right">
                  <button
                    @click.stop="handleRowClick(asset.id)"
                    class="text-text-secondary hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </button>
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-if="assets.length === 0">
                <td colspan="5" class="py-12 text-center">
                  <div class="flex flex-col items-center gap-2 text-text-secondary">
                    <span class="material-symbols-outlined text-4xl">search_off</span>
                    <p class="text-sm">No assets found</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div
          v-if="!loadingAssets && !errorAssets"
          class="px-4 py-3 border-t border-border-dark flex items-center justify-between text-xs text-text-secondary"
        >
          <span>Showing {{ assets.length }} asset{{ assets.length !== 1 ? 's' : '' }}</span>
        </div>
      </div>

    </div>
  </div>
</template>

<style>
/* Dark popup styles for customer dashboard map */
.customer-dashboard-popup .leaflet-popup-content-wrapper {
  background: #18222c;
  border: 1px solid #283039;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.customer-dashboard-popup .leaflet-popup-content {
  margin: 12px;
}

.customer-dashboard-popup .leaflet-popup-tip {
  background: #18222c;
  border: 1px solid #283039;
  box-shadow: none;
}

.customer-dashboard-popup .leaflet-popup-close-button {
  color: #9faab6;
  font-size: 20px;
  padding: 8px;
}

.customer-dashboard-popup .leaflet-popup-close-button:hover {
  color: #fff;
}

/* Leaflet control overrides for dark theme */
.leaflet-legend {
  pointer-events: auto;
}
</style>

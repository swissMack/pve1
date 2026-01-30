<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// PrimeVue components
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import InputNumber from 'primevue/inputnumber'

// ============================================================================
// Types
// ============================================================================

interface GeozoneForm {
  name: string
  zoneType: string
  color: string
  address: string
  contactName: string
  contactEmail: string
  ownerName: string
  hysteresisMeters: number
  centerLat: number | null
  centerLng: number | null
  radiusMeters: number | null
  geometry: GeoJSONPolygon | null
  isActive: boolean
}

interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

interface GeozoneApiData {
  id: string
  name: string
  zoneType: string
  color: string | null
  address: string | null
  contactName: string | null
  contactEmail: string | null
  ownerName: string | null
  owner: string | null
  hysteresisMeters: number | null
  hysteresis: number | null
  centerLat: number | null
  centerLng: number | null
  radiusMeters: number | null
  geometryGeojson: GeoJSONPolygon | null
  isActive: boolean
  active: boolean
}

type DrawMode = 'polygon' | 'circle' | 'import' | null

// ============================================================================
// Props
// ============================================================================

const props = defineProps<{
  geozoneId?: string | null  // null = create mode, string = edit mode
  onClose: () => void
  onSaved: () => void
}>()

// ============================================================================
// Constants
// ============================================================================

const API_BASE_URL = window.location.origin

const ZONE_TYPE_OPTIONS = [
  { label: 'Warehouse', value: 'warehouse' },
  { label: 'Supplier', value: 'supplier' },
  { label: 'Customer', value: 'customer' },
  { label: 'Transit Hub', value: 'transit_hub' },
  { label: 'Restricted', value: 'restricted' }
]

// ============================================================================
// Reactive State
// ============================================================================

const visible = ref(true)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const geocoding = ref(false)

const isEditMode = computed(() => !!props.geozoneId)
const dialogTitle = computed(() => isEditMode.value ? 'Edit Geozone' : 'Create Geozone')

// Form state
const form = ref<GeozoneForm>({
  name: '',
  zoneType: 'warehouse',
  color: '#10b981',
  address: '',
  contactName: '',
  contactEmail: '',
  ownerName: '',
  hysteresisMeters: 50,
  centerLat: null,
  centerLng: null,
  radiusMeters: null,
  geometry: null,
  isActive: true
})

// Map state
const mapElement = ref<HTMLElement | null>(null)
let mapInstance: L.Map | null = null
let resizeObserver: ResizeObserver | null = null

// Drawing state
const drawMode = ref<DrawMode>(null)
const polygonPoints = ref<[number, number][]>([])
const drawnLayer = ref<L.Layer | null>(null)
const markers = ref<L.Marker[]>([])
const previewPolyline = ref<L.Polyline | null>(null)

// Circle drawing state
const circleCenter = ref<[number, number] | null>(null)
const circleRadius = ref<number>(500)
const circlePreviewLayer = ref<L.Layer | null>(null)
const circleCenterMarker = ref<L.Marker | null>(null)

// GeoJSON import state
const geojsonText = ref('')
const geojsonError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

// ============================================================================
// Computed
// ============================================================================

const canCompletePolygon = computed(() => polygonPoints.value.length >= 3)

const hasGeometry = computed(() => form.value.geometry !== null)

const formValid = computed(() => {
  return form.value.name.trim().length > 0
})

// ============================================================================
// Map Initialization
// ============================================================================

const initializeMap = async () => {
  await nextTick()

  if (!mapElement.value) return

  // Clean up existing map
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }

  // Default center: Europe
  const center: [number, number] = [46.8182, 8.2275]
  const zoom = 5

  mapInstance = L.map(mapElement.value, {
    center,
    zoom,
    zoomControl: true,
    attributionControl: true
  })

  // Dark theme CartoDB tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(mapInstance)

  // Register click handler
  mapInstance.on('click', handleMapClick)

  // Fix rendering
  setTimeout(() => {
    mapInstance?.invalidateSize()
  }, 100)

  // Resize observer
  if (mapElement.value) {
    resizeObserver = new ResizeObserver(() => {
      mapInstance?.invalidateSize()
    })
    resizeObserver.observe(mapElement.value)
  }

  // If in edit mode and there's existing geometry, render it
  if (form.value.geometry) {
    renderExistingGeometry()
  }
}

// ============================================================================
// Map Click Handling
// ============================================================================

const handleMapClick = (e: L.LeafletMouseEvent) => {
  if (drawMode.value === 'polygon') {
    handlePolygonClick(e)
  } else if (drawMode.value === 'circle') {
    handleCircleClick(e)
  }
}

// ============================================================================
// Polygon Drawing
// ============================================================================

const handlePolygonClick = (e: L.LeafletMouseEvent) => {
  if (!mapInstance) return

  const point: [number, number] = [e.latlng.lat, e.latlng.lng]
  polygonPoints.value.push(point)

  // Add a small circle marker at the clicked point
  const marker = L.circleMarker(e.latlng, {
    radius: 6,
    fillColor: '#137fec',
    color: '#ffffff',
    weight: 2,
    fillOpacity: 1,
    opacity: 1
  })
  marker.addTo(mapInstance)
  markers.value.push(marker as unknown as L.Marker)

  updatePreviewPolygon()
}

const updatePreviewPolygon = () => {
  if (!mapInstance) return

  // Remove old preview polyline
  if (previewPolyline.value) {
    mapInstance.removeLayer(previewPolyline.value as any)
    previewPolyline.value = null
  }

  if (polygonPoints.value.length < 2) return

  // Draw a polyline connecting all points (dashed preview)
  const latlngs = polygonPoints.value.map(p => L.latLng(p[0], p[1]))
  previewPolyline.value = L.polyline(latlngs, {
    color: form.value.color || '#137fec',
    weight: 2,
    dashArray: '6, 8',
    opacity: 0.8
  }).addTo(mapInstance)
}

const completePolygon = () => {
  if (polygonPoints.value.length < 3 || !mapInstance) return

  // Convert to GeoJSON coordinates [lng, lat]
  const coords = polygonPoints.value.map(p => [p[1], p[0]])
  coords.push(coords[0]) // Close the ring

  form.value.geometry = {
    type: 'Polygon',
    coordinates: [coords]
  }

  // Compute center from average of points
  const avgLat = polygonPoints.value.reduce((s, p) => s + p[0], 0) / polygonPoints.value.length
  const avgLng = polygonPoints.value.reduce((s, p) => s + p[1], 0) / polygonPoints.value.length
  form.value.centerLat = parseFloat(avgLat.toFixed(6))
  form.value.centerLng = parseFloat(avgLng.toFixed(6))

  // Clear preview elements
  clearDrawingArtifacts()

  // Render the final polygon
  renderFinalPolygon()

  // Exit draw mode
  drawMode.value = null
}

const undoLastPoint = () => {
  if (polygonPoints.value.length === 0 || !mapInstance) return

  polygonPoints.value.pop()

  // Remove last marker
  const lastMarker = markers.value.pop()
  if (lastMarker && mapInstance) {
    mapInstance.removeLayer(lastMarker as any)
  }

  updatePreviewPolygon()
}

// ============================================================================
// Circle Drawing
// ============================================================================

const handleCircleClick = (e: L.LeafletMouseEvent) => {
  if (!mapInstance) return

  circleCenter.value = [e.latlng.lat, e.latlng.lng]
  form.value.centerLat = parseFloat(e.latlng.lat.toFixed(6))
  form.value.centerLng = parseFloat(e.latlng.lng.toFixed(6))

  updateCirclePreview()
}

const updateCirclePreview = () => {
  if (!mapInstance || !circleCenter.value) return

  // Clear previous preview
  if (circlePreviewLayer.value) {
    mapInstance.removeLayer(circlePreviewLayer.value as any)
    circlePreviewLayer.value = null
  }
  if (circleCenterMarker.value) {
    mapInstance.removeLayer(circleCenterMarker.value as any)
    circleCenterMarker.value = null
  }

  const [lat, lng] = circleCenter.value
  const radius = circleRadius.value || 500

  // Draw a Leaflet circle for preview
  circlePreviewLayer.value = L.circle([lat, lng], {
    radius: radius,
    color: form.value.color || '#137fec',
    fillColor: form.value.color || '#137fec',
    fillOpacity: 0.15,
    weight: 2,
    dashArray: '6, 8'
  }).addTo(mapInstance)

  // Add center marker
  circleCenterMarker.value = L.circleMarker([lat, lng], {
    radius: 6,
    fillColor: '#137fec',
    color: '#ffffff',
    weight: 2,
    fillOpacity: 1,
    opacity: 1
  }).addTo(mapInstance) as unknown as L.Marker
}

const completeCircle = () => {
  if (!circleCenter.value || !mapInstance) return

  const [lat, lng] = circleCenter.value
  const radius = circleRadius.value || 500

  // Generate polygon approximation of the circle
  form.value.geometry = circleToPolygon(lat, lng, radius)
  form.value.centerLat = parseFloat(lat.toFixed(6))
  form.value.centerLng = parseFloat(lng.toFixed(6))
  form.value.radiusMeters = radius

  // Clear preview
  if (circlePreviewLayer.value && mapInstance) {
    mapInstance.removeLayer(circlePreviewLayer.value as any)
    circlePreviewLayer.value = null
  }
  if (circleCenterMarker.value && mapInstance) {
    mapInstance.removeLayer(circleCenterMarker.value as any)
    circleCenterMarker.value = null
  }

  // Render final polygon
  renderFinalPolygon()

  // Exit draw mode
  drawMode.value = null
}

const circleToPolygon = (lat: number, lng: number, radiusMeters: number, numPoints = 32): GeoJSONPolygon => {
  const coords: number[][] = []
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI
    const dx = radiusMeters * Math.cos(angle)
    const dy = radiusMeters * Math.sin(angle)
    const newLat = lat + (dy / 111320)
    const newLng = lng + (dx / (111320 * Math.cos(lat * Math.PI / 180)))
    coords.push([newLng, newLat])
  }
  coords.push(coords[0]) // close the ring
  return { type: 'Polygon', coordinates: [coords] }
}

// ============================================================================
// GeoJSON Import
// ============================================================================

const handleGeoJSONImport = () => {
  geojsonError.value = ''

  const text = geojsonText.value.trim()
  if (!text) {
    geojsonError.value = 'Please paste GeoJSON data'
    return
  }

  try {
    const parsed = JSON.parse(text)
    applyGeoJSON(parsed)
  } catch (e) {
    geojsonError.value = 'Invalid JSON format'
  }
}

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const text = e.target?.result as string
      const parsed = JSON.parse(text)
      geojsonText.value = text
      applyGeoJSON(parsed)
    } catch (err) {
      geojsonError.value = 'Failed to parse file as GeoJSON'
    }
  }
  reader.readAsText(file)
}

const applyGeoJSON = (data: any) => {
  geojsonError.value = ''

  let geometry: GeoJSONPolygon | null = null

  // Handle different GeoJSON structures
  if (data.type === 'Polygon') {
    geometry = data as GeoJSONPolygon
  } else if (data.type === 'Feature' && data.geometry?.type === 'Polygon') {
    geometry = data.geometry as GeoJSONPolygon
  } else if (data.type === 'FeatureCollection' && data.features?.length > 0) {
    const firstFeature = data.features[0]
    if (firstFeature.geometry?.type === 'Polygon') {
      geometry = firstFeature.geometry as GeoJSONPolygon
    }
  }

  if (!geometry) {
    geojsonError.value = 'No valid Polygon geometry found in GeoJSON. Supported types: Polygon, Feature with Polygon geometry, FeatureCollection with Polygon features.'
    return
  }

  form.value.geometry = geometry

  // Compute center from coordinates
  if (geometry.coordinates?.[0]) {
    const ring = geometry.coordinates[0]
    const avgLng = ring.reduce((s, c) => s + c[0], 0) / ring.length
    const avgLat = ring.reduce((s, c) => s + c[1], 0) / ring.length
    form.value.centerLat = parseFloat(avgLat.toFixed(6))
    form.value.centerLng = parseFloat(avgLng.toFixed(6))
  }

  // Render on map
  clearDrawingArtifacts()
  renderFinalPolygon()

  drawMode.value = null
}

const triggerFileUpload = () => {
  fileInput.value?.click()
}

// ============================================================================
// Rendering Helpers
// ============================================================================

const renderFinalPolygon = () => {
  if (!mapInstance || !form.value.geometry) return

  // Remove existing drawn layer
  if (drawnLayer.value) {
    mapInstance.removeLayer(drawnLayer.value as any)
    drawnLayer.value = null
  }

  try {
    const geoLayer = L.geoJSON(form.value.geometry as any, {
      style: {
        color: form.value.color || '#137fec',
        weight: 3,
        fillOpacity: 0.2,
        fillColor: form.value.color || '#137fec'
      }
    })

    geoLayer.addTo(mapInstance)
    drawnLayer.value = geoLayer

    // Fit bounds
    mapInstance.fitBounds(geoLayer.getBounds(), { padding: [40, 40] })
  } catch (err) {
    console.error('Error rendering polygon:', err)
  }
}

const renderExistingGeometry = () => {
  if (!mapInstance || !form.value.geometry) return
  renderFinalPolygon()
}

const clearDrawingArtifacts = () => {
  if (!mapInstance) return

  // Remove polygon preview markers
  markers.value.forEach(m => {
    if (mapInstance) mapInstance.removeLayer(m as any)
  })
  markers.value = []

  // Remove preview polyline
  if (previewPolyline.value) {
    mapInstance.removeLayer(previewPolyline.value as any)
    previewPolyline.value = null
  }

  // Remove circle preview
  if (circlePreviewLayer.value) {
    mapInstance.removeLayer(circlePreviewLayer.value as any)
    circlePreviewLayer.value = null
  }
  if (circleCenterMarker.value) {
    mapInstance.removeLayer(circleCenterMarker.value as any)
    circleCenterMarker.value = null
  }

  // Reset polygon points
  polygonPoints.value = []
  circleCenter.value = null
}

const clearGeometry = () => {
  if (!mapInstance) return

  // Remove final drawn layer
  if (drawnLayer.value) {
    mapInstance.removeLayer(drawnLayer.value as any)
    drawnLayer.value = null
  }

  clearDrawingArtifacts()

  form.value.geometry = null
  form.value.centerLat = null
  form.value.centerLng = null
  form.value.radiusMeters = null
  drawMode.value = null
}

// ============================================================================
// Draw Mode Management
// ============================================================================

const setDrawMode = (mode: DrawMode) => {
  // If switching modes, clean up current drawing state
  clearDrawingArtifacts()

  if (drawMode.value === mode) {
    // Toggle off
    drawMode.value = null
  } else {
    drawMode.value = mode
  }
}

// ============================================================================
// Geocoding
// ============================================================================

const geocodeAddress = async () => {
  const address = form.value.address.trim()
  if (!address) return

  geocoding.value = true
  try {
    const response = await fetch(
      'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(address)
    )
    const results = await response.json()

    if (results && results.length > 0) {
      const result = results[0]
      const lat = parseFloat(result.lat)
      const lng = parseFloat(result.lon)

      form.value.centerLat = lat
      form.value.centerLng = lng

      // Pan map to location
      if (mapInstance) {
        mapInstance.setView([lat, lng], 14, { animate: true })
      }
    } else {
      error.value = 'Address not found. Try a more specific address.'
      setTimeout(() => { error.value = '' }, 3000)
    }
  } catch (err) {
    console.error('Geocoding error:', err)
    error.value = 'Failed to geocode address.'
    setTimeout(() => { error.value = '' }, 3000)
  } finally {
    geocoding.value = false
  }
}

// ============================================================================
// Data Loading (Edit Mode)
// ============================================================================

const loadGeozone = async () => {
  if (!props.geozoneId) return

  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`${API_BASE_URL}/api/geozones/${props.geozoneId}`)
    if (!response.ok) throw new Error('Failed to fetch geozone')

    const result = await response.json()
    const data: GeozoneApiData = result.success && result.data ? result.data : result

    // Populate form
    form.value.name = data.name || ''
    form.value.zoneType = data.zoneType || 'warehouse'
    form.value.color = data.color || '#10b981'
    form.value.address = data.address || ''
    form.value.contactName = data.contactName || ''
    form.value.contactEmail = data.contactEmail || ''
    form.value.ownerName = data.ownerName || data.owner || ''
    form.value.hysteresisMeters = data.hysteresisMeters ?? data.hysteresis ?? 50
    form.value.centerLat = data.centerLat ?? null
    form.value.centerLng = data.centerLng ?? null
    form.value.radiusMeters = data.radiusMeters ?? null
    form.value.geometry = data.geometryGeojson ?? null
    form.value.isActive = data.isActive ?? data.active ?? true
  } catch (err) {
    console.error('Error loading geozone:', err)
    error.value = 'Failed to load geozone details'
  } finally {
    loading.value = false
  }
}

// ============================================================================
// Save
// ============================================================================

const handleSave = async () => {
  if (!formValid.value) return

  saving.value = true
  error.value = ''

  try {
    const body: Record<string, any> = {
      name: form.value.name.trim(),
      zoneType: form.value.zoneType,
      color: form.value.color,
      address: form.value.address || null,
      contactName: form.value.contactName || null,
      contactEmail: form.value.contactEmail || null,
      ownerName: form.value.ownerName || null,
      hysteresisMeters: form.value.hysteresisMeters,
      centerLat: form.value.centerLat,
      centerLng: form.value.centerLng,
      radiusMeters: form.value.radiusMeters,
      isActive: form.value.isActive
    }

    if (form.value.geometry) {
      body.geometry = form.value.geometry
    }

    const url = isEditMode.value
      ? `${API_BASE_URL}/api/geozones/${props.geozoneId}`
      : `${API_BASE_URL}/api/geozones`

    const method = isEditMode.value ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    const result = await response.json()

    if (result.success) {
      props.onSaved()
    } else {
      error.value = result.error || 'Failed to save geozone'
    }
  } catch (err) {
    console.error('Error saving geozone:', err)
    error.value = 'Failed to save geozone. Please try again.'
  } finally {
    saving.value = false
  }
}

// ============================================================================
// Dialog Close
// ============================================================================

const handleClose = () => {
  visible.value = false
  props.onClose()
}

// ============================================================================
// Watchers
// ============================================================================

// When color changes, re-render the polygon with new color
watch(() => form.value.color, () => {
  if (form.value.geometry && mapInstance) {
    renderFinalPolygon()
  }
  // Update preview if in polygon draw mode
  if (drawMode.value === 'polygon') {
    updatePreviewPolygon()
  }
  // Update circle preview
  if (drawMode.value === 'circle') {
    updateCirclePreview()
  }
})

// When circle radius changes, update preview
watch(circleRadius, () => {
  if (drawMode.value === 'circle' && circleCenter.value) {
    updateCirclePreview()
  }
})

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(async () => {
  if (isEditMode.value) {
    await loadGeozone()
  }
  await initializeMap()
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (mapInstance) {
    mapInstance.off('click', handleMapClick)
    mapInstance.remove()
    mapInstance = null
  }
})
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="dialogTitle"
    :modal="true"
    :maximizable="true"
    :closable="true"
    :draggable="false"
    class="geozone-editor-dialog"
    :style="{ width: '95vw', maxWidth: '1400px' }"
    @hide="handleClose"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-lg bg-primary/10 text-primary">
          <span class="material-symbols-outlined text-[22px]">
            {{ isEditMode ? 'edit_location_alt' : 'add_location_alt' }}
          </span>
        </div>
        <div>
          <h3 class="m-0 text-lg font-semibold text-white">{{ dialogTitle }}</h3>
          <p class="m-0 text-text-secondary text-xs mt-0.5">
            {{ isEditMode ? 'Update the geozone boundary and details' : 'Define a new geographic zone for asset tracking' }}
          </p>
        </div>
      </div>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-16 gap-4">
      <div class="w-10 h-10 border-4 border-border-dark border-t-primary rounded-full animate-spin"></div>
      <p class="text-text-secondary text-sm">Loading geozone...</p>
    </div>

    <!-- Main Content: Split Layout -->
    <div v-else class="flex gap-5 min-h-[600px]">
      <!-- ================================================================ -->
      <!-- Left Panel: Form (~350px) -->
      <!-- ================================================================ -->
      <div class="w-[350px] shrink-0 flex flex-col gap-4 overflow-y-auto pr-2 max-h-[calc(80vh-120px)]">

        <!-- Error Banner -->
        <div
          v-if="error"
          class="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
        >
          <span class="material-symbols-outlined text-[18px]">error</span>
          {{ error }}
        </div>

        <!-- Name -->
        <div class="flex flex-col gap-1.5">
          <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">
            Name <span class="text-red-400">*</span>
          </label>
          <InputText
            v-model="form.name"
            placeholder="e.g. Amsterdam Warehouse"
            class="w-full !bg-background-dark !border-border-dark !text-white placeholder:!text-text-secondary/50"
          />
        </div>

        <!-- Zone Type -->
        <div class="flex flex-col gap-1.5">
          <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Zone Type</label>
          <Select
            v-model="form.zoneType"
            :options="ZONE_TYPE_OPTIONS"
            optionLabel="label"
            optionValue="value"
            placeholder="Select zone type"
            class="w-full !bg-background-dark !border-border-dark"
          />
        </div>

        <!-- Color -->
        <div class="flex flex-col gap-1.5">
          <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Color</label>
          <div class="flex items-center gap-2">
            <span
              class="w-8 h-8 rounded-lg border border-border-dark shrink-0 cursor-pointer"
              :style="{ backgroundColor: form.color }"
              :title="form.color"
            ></span>
            <InputText
              v-model="form.color"
              placeholder="#10b981"
              class="w-full !bg-background-dark !border-border-dark !text-white font-mono text-sm placeholder:!text-text-secondary/50"
            />
          </div>
          <div class="flex gap-1.5 mt-1">
            <button
              v-for="c in ['#10b981', '#137fec', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']"
              :key="c"
              @click="form.color = c"
              class="w-6 h-6 rounded border transition-all"
              :class="form.color === c ? 'border-white scale-110' : 'border-border-dark hover:border-white/50'"
              :style="{ backgroundColor: c }"
              :title="c"
            ></button>
          </div>
        </div>

        <!-- Address + Geocode -->
        <div class="flex flex-col gap-1.5">
          <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Address</label>
          <div class="flex gap-2">
            <InputText
              v-model="form.address"
              placeholder="e.g. Keizersgracht 100, Amsterdam"
              class="flex-1 !bg-background-dark !border-border-dark !text-white placeholder:!text-text-secondary/50"
              @keyup.enter="geocodeAddress"
            />
            <button
              @click="geocodeAddress"
              :disabled="geocoding || !form.address.trim()"
              class="flex items-center gap-1 px-3 py-2 bg-primary/10 text-primary text-xs font-semibold rounded-lg border border-primary/30 hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <span v-if="geocoding" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              <span v-else class="material-symbols-outlined text-[16px]">search</span>
              Geocode
            </button>
          </div>
          <p v-if="form.centerLat && form.centerLng" class="text-text-secondary text-xs font-mono">
            {{ form.centerLat }}, {{ form.centerLng }}
          </p>
        </div>

        <!-- Divider -->
        <div class="border-t border-border-dark my-1"></div>

        <!-- Contact Name -->
        <div class="flex flex-col gap-1.5">
          <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Contact Name</label>
          <InputText
            v-model="form.contactName"
            placeholder="e.g. John Doe"
            class="w-full !bg-background-dark !border-border-dark !text-white placeholder:!text-text-secondary/50"
          />
        </div>

        <!-- Contact Email -->
        <div class="flex flex-col gap-1.5">
          <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Contact Email</label>
          <InputText
            v-model="form.contactEmail"
            placeholder="e.g. john@example.com"
            class="w-full !bg-background-dark !border-border-dark !text-white placeholder:!text-text-secondary/50"
          />
        </div>

        <!-- Owner Name -->
        <div class="flex flex-col gap-1.5">
          <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Owner Name</label>
          <InputText
            v-model="form.ownerName"
            placeholder="e.g. Acme Corp"
            class="w-full !bg-background-dark !border-border-dark !text-white placeholder:!text-text-secondary/50"
          />
        </div>

        <!-- Hysteresis -->
        <div class="flex flex-col gap-1.5">
          <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Hysteresis (meters)</label>
          <InputNumber
            v-model="form.hysteresisMeters"
            :min="0"
            :max="10000"
            placeholder="50"
            class="w-full"
            inputClass="!bg-background-dark !border-border-dark !text-white"
          />
          <p class="text-text-secondary text-xs">Buffer distance to prevent event flickering at zone boundaries</p>
        </div>

        <!-- Geometry Status -->
        <div class="flex flex-col gap-1.5">
          <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Geometry</label>
          <div
            class="flex items-center gap-2 p-3 rounded-lg border text-sm"
            :class="hasGeometry
              ? 'bg-green-500/5 border-green-500/30 text-green-400'
              : 'bg-background-dark border-border-dark text-text-secondary'"
          >
            <span class="material-symbols-outlined text-[18px]">
              {{ hasGeometry ? 'check_circle' : 'info' }}
            </span>
            {{ hasGeometry ? 'Polygon defined' : 'No geometry set. Use the map tools to draw a zone.' }}
          </div>
          <button
            v-if="hasGeometry"
            @click="clearGeometry"
            class="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors self-start mt-1"
          >
            <span class="material-symbols-outlined text-[16px]">delete</span>
            Clear geometry
          </button>
        </div>
      </div>

      <!-- ================================================================ -->
      <!-- Right Panel: Map (flex-1) -->
      <!-- ================================================================ -->
      <div class="flex-1 flex flex-col gap-3 min-w-0">
        <!-- Drawing Tools Bar -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Polygon Draw Button -->
          <button
            @click="setDrawMode('polygon')"
            class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-all"
            :class="drawMode === 'polygon'
              ? 'bg-primary/20 border-primary text-primary'
              : 'bg-background-dark border-border-dark text-text-secondary hover:border-primary/50 hover:text-white'"
          >
            <span class="material-symbols-outlined text-[18px]">polyline</span>
            Draw Polygon
          </button>

          <!-- Circle Draw Button -->
          <button
            @click="setDrawMode('circle')"
            class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-all"
            :class="drawMode === 'circle'
              ? 'bg-primary/20 border-primary text-primary'
              : 'bg-background-dark border-border-dark text-text-secondary hover:border-primary/50 hover:text-white'"
          >
            <span class="material-symbols-outlined text-[18px]">circle</span>
            Draw Circle
          </button>

          <!-- GeoJSON Import Button -->
          <button
            @click="setDrawMode('import')"
            class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-all"
            :class="drawMode === 'import'
              ? 'bg-primary/20 border-primary text-primary'
              : 'bg-background-dark border-border-dark text-text-secondary hover:border-primary/50 hover:text-white'"
          >
            <span class="material-symbols-outlined text-[18px]">upload_file</span>
            Import GeoJSON
          </button>

          <!-- Spacer -->
          <div class="flex-1"></div>

          <!-- Clear Geometry -->
          <button
            v-if="hasGeometry"
            @click="clearGeometry"
            class="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
          >
            <span class="material-symbols-outlined text-[18px]">delete</span>
            Clear
          </button>
        </div>

        <!-- Polygon Drawing Controls -->
        <div
          v-if="drawMode === 'polygon'"
          class="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20"
        >
          <span class="material-symbols-outlined text-[18px] text-primary">info</span>
          <span class="text-sm text-text-secondary flex-1">
            Click on the map to place polygon vertices. {{ polygonPoints.length }} point{{ polygonPoints.length !== 1 ? 's' : '' }} placed.
          </span>
          <button
            v-if="polygonPoints.length > 0"
            @click="undoLastPoint"
            class="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-background-dark border border-border-dark text-text-secondary hover:text-white transition-colors"
          >
            <span class="material-symbols-outlined text-[16px]">undo</span>
            Undo
          </button>
          <button
            v-if="canCompletePolygon"
            @click="completePolygon"
            class="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-white hover:bg-blue-600 transition-colors"
          >
            <span class="material-symbols-outlined text-[16px]">check</span>
            Complete Polygon
          </button>
        </div>

        <!-- Circle Drawing Controls -->
        <div
          v-if="drawMode === 'circle'"
          class="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20"
        >
          <span class="material-symbols-outlined text-[18px] text-primary">info</span>
          <span class="text-sm text-text-secondary">
            {{ circleCenter ? 'Center set. Adjust radius:' : 'Click on the map to set circle center.' }}
          </span>
          <div v-if="circleCenter" class="flex items-center gap-2">
            <InputNumber
              v-model="circleRadius"
              :min="10"
              :max="100000"
              suffix=" m"
              class="w-[140px]"
              inputClass="!bg-background-dark !border-border-dark !text-white !py-1.5 !text-sm"
            />
            <button
              @click="completeCircle"
              class="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-white hover:bg-blue-600 transition-colors"
            >
              <span class="material-symbols-outlined text-[16px]">check</span>
              Confirm
            </button>
          </div>
        </div>

        <!-- GeoJSON Import Panel -->
        <div
          v-if="drawMode === 'import'"
          class="flex flex-col gap-3 p-4 rounded-lg bg-surface-dark-highlight border border-border-dark"
        >
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-primary">data_object</span>
            <span class="text-sm font-medium text-white">Import GeoJSON</span>
          </div>
          <textarea
            v-model="geojsonText"
            placeholder='Paste GeoJSON here, e.g.&#10;{&#10;  "type": "Polygon",&#10;  "coordinates": [[[lng, lat], ...]]&#10;}'
            class="w-full h-[120px] p-3 rounded-lg bg-background-dark border border-border-dark text-white text-sm font-mono placeholder:text-text-secondary/50 resize-none focus:outline-none focus:border-primary"
          ></textarea>
          <div v-if="geojsonError" class="flex items-center gap-2 text-red-400 text-xs">
            <span class="material-symbols-outlined text-[16px]">error</span>
            {{ geojsonError }}
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="handleGeoJSONImport"
              :disabled="!geojsonText.trim()"
              class="flex items-center gap-1 px-3 py-2 text-sm font-semibold rounded-lg bg-primary text-white hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span class="material-symbols-outlined text-[18px]">check</span>
              Apply
            </button>
            <span class="text-text-secondary text-xs">or</span>
            <button
              @click="triggerFileUpload"
              class="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-border-dark text-text-secondary hover:text-white hover:border-primary/50 transition-colors"
            >
              <span class="material-symbols-outlined text-[18px]">folder_open</span>
              Upload .geojson
            </button>
            <input
              ref="fileInput"
              type="file"
              accept=".geojson,.json"
              class="hidden"
              @change="handleFileUpload"
            />
          </div>
        </div>

        <!-- Map Container -->
        <div class="flex-1 rounded-xl border border-border-dark overflow-hidden relative min-h-[400px]">
          <div
            ref="mapElement"
            class="absolute inset-0 w-full h-full"
          ></div>

          <!-- Draw mode cursor hint overlay -->
          <div
            v-if="drawMode === 'polygon' || drawMode === 'circle'"
            class="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none"
          >
            <div class="px-3 py-1.5 rounded-full bg-surface-dark/90 border border-border-dark text-text-secondary text-xs font-medium backdrop-blur-sm">
              {{ drawMode === 'polygon' ? 'Click to add points' : 'Click to set center' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <div class="flex items-center justify-between w-full">
        <div class="text-text-secondary text-xs">
          <span v-if="hasGeometry" class="flex items-center gap-1 text-green-400">
            <span class="material-symbols-outlined text-[16px]">check_circle</span>
            Geometry defined
          </span>
        </div>
        <div class="flex items-center gap-2">
          <Button
            label="Cancel"
            @click="handleClose"
            severity="secondary"
            outlined
            class="!border-border-dark !text-text-secondary hover:!text-white hover:!border-primary"
          />
          <Button
            :label="saving ? 'Saving...' : (isEditMode ? 'Update Geozone' : 'Create Geozone')"
            @click="handleSave"
            :disabled="!formValid || saving"
            class="!bg-primary !border-primary hover:!bg-blue-600"
          >
            <template #icon>
              <span v-if="saving" class="material-symbols-outlined text-[18px] mr-1.5 animate-spin">progress_activity</span>
              <span v-else class="material-symbols-outlined text-[18px] mr-1.5">save</span>
            </template>
          </Button>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<style>
/* ============================================================================
   PrimeVue Dialog - Dark Theme Overrides
   ============================================================================ */

.geozone-editor-dialog .p-dialog {
  background: var(--surface-dark, #18222c) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  border-radius: 1rem !important;
}

.geozone-editor-dialog .p-dialog-header {
  background: var(--surface-dark, #18222c) !important;
  border-bottom: 1px solid var(--border-dark, #283039) !important;
  padding: 1.25rem 1.5rem !important;
  border-radius: 1rem 1rem 0 0 !important;
}

.geozone-editor-dialog .p-dialog-header .p-dialog-title {
  display: none;
}

.geozone-editor-dialog .p-dialog-header-icons {
  position: absolute;
  right: 1rem;
  top: 1rem;
}

.geozone-editor-dialog .p-dialog-header-icon {
  color: var(--text-secondary, #9faab6) !important;
}

.geozone-editor-dialog .p-dialog-header-icon:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
  color: white !important;
}

.geozone-editor-dialog .p-dialog-content {
  background: var(--surface-dark, #18222c) !important;
  padding: 1.5rem !important;
  color: white !important;
}

.geozone-editor-dialog .p-dialog-footer {
  background: var(--surface-dark, #18222c) !important;
  border-top: 1px solid var(--border-dark, #283039) !important;
  padding: 1rem 1.5rem !important;
  border-radius: 0 0 1rem 1rem !important;
}

/* ============================================================================
   PrimeVue Input Components - Dark Theme
   ============================================================================ */

.geozone-editor-dialog .p-inputtext {
  background: var(--background-dark, #0f1923) !important;
  border-color: var(--border-dark, #283039) !important;
  color: white !important;
  font-size: 0.875rem;
}

.geozone-editor-dialog .p-inputtext:focus {
  border-color: var(--primary, #137fec) !important;
  box-shadow: 0 0 0 2px rgba(19, 127, 236, 0.15) !important;
}

.geozone-editor-dialog .p-inputtext::placeholder {
  color: rgba(159, 170, 182, 0.5) !important;
}

.geozone-editor-dialog .p-inputnumber-input {
  background: var(--background-dark, #0f1923) !important;
  border-color: var(--border-dark, #283039) !important;
  color: white !important;
}

.geozone-editor-dialog .p-inputnumber-input:focus {
  border-color: var(--primary, #137fec) !important;
  box-shadow: 0 0 0 2px rgba(19, 127, 236, 0.15) !important;
}

/* ============================================================================
   PrimeVue Select / Dropdown - Dark Theme
   ============================================================================ */

.geozone-editor-dialog .p-select {
  background: var(--background-dark, #0f1923) !important;
  border-color: var(--border-dark, #283039) !important;
  color: white !important;
}

.geozone-editor-dialog .p-select:hover {
  border-color: var(--primary, #137fec) !important;
}

.geozone-editor-dialog .p-select .p-select-label {
  color: white !important;
  font-size: 0.875rem;
}

.geozone-editor-dialog .p-select-overlay {
  background: var(--surface-dark, #18222c) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  border-radius: 0.5rem !important;
}

.geozone-editor-dialog .p-select-option {
  color: white !important;
  font-size: 0.875rem;
}

.geozone-editor-dialog .p-select-option:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
}

.geozone-editor-dialog .p-select-option.p-select-option-selected {
  background: var(--primary, #137fec) !important;
  color: white !important;
}

/* ============================================================================
   PrimeVue Button - Dark Theme
   ============================================================================ */

.geozone-editor-dialog .p-button.p-button-outlined {
  border-color: var(--border-dark, #283039) !important;
  color: var(--text-secondary, #9faab6) !important;
}

.geozone-editor-dialog .p-button.p-button-outlined:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
  border-color: var(--primary, #137fec) !important;
  color: white !important;
}

/* ============================================================================
   Leaflet Controls - Dark Theme
   ============================================================================ */

.geozone-editor-dialog .leaflet-control-zoom a {
  background: #18222c !important;
  color: #fff !important;
  border-color: #283039 !important;
}

.geozone-editor-dialog .leaflet-control-zoom a:hover {
  background: #202b36 !important;
}

.geozone-editor-dialog .leaflet-control-attribution {
  background: rgba(24, 34, 44, 0.8) !important;
  color: #9faab6 !important;
}

.geozone-editor-dialog .leaflet-control-attribution a {
  color: #137fec !important;
}

/* Crosshair cursor when in drawing mode */
.geozone-editor-dialog .leaflet-container {
  cursor: default;
}

/* ============================================================================
   Custom Scrollbar for Left Panel
   ============================================================================ */

.geozone-editor-dialog ::-webkit-scrollbar {
  width: 6px;
}

.geozone-editor-dialog ::-webkit-scrollbar-track {
  background: transparent;
}

.geozone-editor-dialog ::-webkit-scrollbar-thumb {
  background: #283039;
  border-radius: 3px;
}

.geozone-editor-dialog ::-webkit-scrollbar-thumb:hover {
  background: #3a4750;
}
</style>

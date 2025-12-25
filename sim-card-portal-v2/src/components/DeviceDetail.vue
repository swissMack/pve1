<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { type Device } from '../data/mockData'
import { dataService } from '../data/dataService'

// PrimeVue components
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Tag from 'primevue/tag'
import ProgressBar from 'primevue/progressbar'
import Panel from 'primevue/panel'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import FileUpload from 'primevue/fileupload'

// Custom components
import DeviceRouteMap from './DeviceRouteMap.vue'
import SensorHistoryChart from './SensorHistoryChart.vue'
import RealtimeStatusIndicator from './RealtimeStatusIndicator.vue'

// WebSocket for real-time updates
import websocketService, { type SensorData, type LocationData } from '../services/websocketService'

// MQTT for bidirectional control
import { useMqttConfig } from '../composables/useMqttConfig'

// Props
const props = defineProps<{
  deviceId: string | null
  onClose: () => void
  createMode?: boolean
}>()

// Emit
const emit = defineEmits<{
  close: []
  deviceCreated: []
}>()

// Reactive state
const device = ref<Device | null>(null)
const editedDevice = ref<Device | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const isEditing = ref(false)
const visible = ref(true)
const specificationFile = ref<File | null>(null)
const specificationFileName = ref<string>('')
const specificationFileType = ref<string>('application/pdf')
const specificationPreviewUrl = ref<string>('')

// Database-driven dropdowns
const deviceTypes = ref<Array<{ label: string; value: string }>>([])
const locations = ref<Array<{ label: string; value: string }>>([])
const simCards = ref<Array<{ label: string; value: string; data: any }>>([])
const loadingDeviceTypes = ref(false)
const loadingLocations = ref(false)
const loadingSimCards = ref(false)

// Real-time WebSocket state
const isRealtimeConnected = ref(false)
const lastRealtimeUpdate = ref<string | null>(null)
let unsubscribeSensor: (() => void) | null = null
let unsubscribeLocation: (() => void) | null = null
let unsubscribeConnection: (() => void) | null = null

// MQTT bidirectional control
const {
  connected: mqttConnected,
  connect: connectMqtt,
  setDeviceSensorInterval
} = useMqttConfig()

// Handle real-time sensor updates
const handleSensorUpdate = (deviceId: string, data: SensorData, timestamp: string) => {
  if (device.value && device.value.id === deviceId) {
    // Update device with real-time sensor data
    if (data.temperature !== null) device.value.temperature = data.temperature
    if (data.humidity !== null) device.value.humidity = data.humidity
    if (data.light !== null) device.value.light = data.light
    if (data.batteryLevel !== null) device.value.batteryLevel = data.batteryLevel
    if (data.signalStrength !== null) device.value.signalStrength = data.signalStrength
    device.value.lastSeen = timestamp
    lastRealtimeUpdate.value = timestamp
    console.log(`Real-time sensor update for ${deviceId}:`, data)
  }
}

// Handle real-time location updates
const handleLocationUpdate = (deviceId: string, data: LocationData, timestamp: string) => {
  if (device.value && device.value.id === deviceId) {
    // Update device with real-time location data
    device.value.latitude = data.latitude
    device.value.longitude = data.longitude
    device.value.lastSeen = timestamp
    lastRealtimeUpdate.value = timestamp
    console.log(`Real-time location update for ${deviceId}:`, data)
  }
}

// Handle WebSocket connection status changes
const handleConnectionChange = (status: 'connected' | 'disconnected' | 'reconnecting') => {
  isRealtimeConnected.value = status === 'connected'
}

// Setup real-time subscriptions
const setupRealtimeSubscriptions = () => {
  if (!props.deviceId) return

  // Subscribe to updates
  unsubscribeSensor = websocketService.onSensorUpdate(handleSensorUpdate)
  unsubscribeLocation = websocketService.onLocationUpdate(handleLocationUpdate)
  unsubscribeConnection = websocketService.onConnectionChange(handleConnectionChange)

  // Subscribe to this device's updates
  websocketService.subscribe([props.deviceId])
  isRealtimeConnected.value = websocketService.isConnected()
}

// Cleanup real-time subscriptions
const cleanupRealtimeSubscriptions = () => {
  if (props.deviceId) {
    websocketService.unsubscribe([props.deviceId])
  }
  if (unsubscribeSensor) unsubscribeSensor()
  if (unsubscribeLocation) unsubscribeLocation()
  if (unsubscribeConnection) unsubscribeConnection()
}

// Constants
const MAX_FILE_SIZE_MB = 10
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const API_BASE_URL = ''

// Dropdown options
const statusOptions = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
  { label: 'Maintenance', value: 'Maintenance' },
  { label: 'Offline', value: 'Offline' }
]

const connectionTypeOptions = [
  { label: '3G', value: '3G' },
  { label: '4G', value: '4G' },
  { label: '5G', value: '5G' },
  { label: 'WiFi', value: 'WiFi' }
]

const healthStatusOptions = [
  { label: 'Healthy', value: 'healthy' },
  { label: 'Warning', value: 'warning' },
  { label: 'Critical', value: 'critical' },
  { label: 'Unknown', value: 'unknown' }
]

const securityStatusOptions = [
  { label: 'Secure', value: 'secure' },
  { label: 'Vulnerable', value: 'vulnerable' },
  { label: 'Compromised', value: 'compromised' },
  { label: 'Unknown', value: 'unknown' }
]

const samplingIntervalOptions = [
  { label: '1 minute', value: 1 },
  { label: '5 minutes', value: 5 },
  { label: '10 minutes', value: 10 },
  { label: '15 minutes', value: 15 },
  { label: '20 minutes', value: 20 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: '6 hours', value: 360 },
  { label: '12 hours', value: 720 },
  { label: '24 hours', value: 1440 }
]

// Fetch device types from database
const fetchDeviceTypes = async () => {
  loadingDeviceTypes.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/device-types`)
    if (!response.ok) throw new Error('Failed to fetch device types')

    const result = await response.json()
    if (result.success && result.data) {
      deviceTypes.value = result.data.map((type: any) => ({
        label: type.name,
        value: type.name
      }))
    }
  } catch (err) {
    console.error('Error fetching device types:', err)
    // Fallback to mock data if API fails
    deviceTypes.value = [
      { label: 'GPS Tracker', value: 'GPS Tracker' },
      { label: 'Sensor', value: 'Sensor' },
      { label: 'Gateway', value: 'Gateway' },
      { label: 'Router', value: 'Router' }
    ]
  } finally {
    loadingDeviceTypes.value = false
  }
}

// Fetch locations from database
const fetchLocations = async () => {
  loadingLocations.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/locations`)
    if (!response.ok) throw new Error('Failed to fetch locations')

    const result = await response.json()
    if (result.success && result.data) {
      locations.value = result.data.map((loc: any) => ({
        label: loc.city ? `${loc.name} - ${loc.city}, ${loc.country}` : loc.name,
        value: loc.name
      }))
    }
  } catch (err) {
    console.error('Error fetching locations:', err)
    // Fallback to mock data if API fails
    locations.value = [
      { label: 'Zurich', value: 'Zurich' },
      { label: 'Bern', value: 'Bern' },
      { label: 'Geneva', value: 'Geneva' },
      { label: 'Basel', value: 'Basel' }
    ]
  } finally {
    loadingLocations.value = false
  }
}

// Fetch available SIM cards from database
const fetchSimCards = async () => {
  loadingSimCards.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/sim-cards?available=true`)
    if (!response.ok) throw new Error('Failed to fetch SIM cards')

    const result = await response.json()
    if (result.success && result.data) {
      // Add empty option at the beginning for deselection
      simCards.value = [
        { label: 'No SIM Card', value: '', data: null },
        ...result.data.map((sim: any) => ({
          label: `${sim.id} (${sim.carrier} - ${sim.plan})`,
          value: sim.id,
          data: sim
        }))
      ]
    }
  } catch (err) {
    console.error('Error fetching SIM cards:', err)
    // Fallback with empty option
    simCards.value = [{ label: 'No SIM Card', value: '', data: null }]
  } finally {
    loadingSimCards.value = false
  }
}

// Load device data
onMounted(async () => {
  // Connect to MQTT for bidirectional control
  connectMqtt()

  // Fetch dropdown data first
  await Promise.all([fetchDeviceTypes(), fetchLocations(), fetchSimCards()])

  if (props.createMode) {
    // Initialize with empty device for create mode
    const newDevice: Partial<Device> = {
      id: `DEV${Date.now()}`,
      name: '',
      status: 'Inactive',
      simCard: '',
      deviceType: '',
      location: '',
      lastSeen: new Date().toISOString(),
      signalStrength: 0,
      dataUsage: '0 MB',
      connectionType: '4G',
      description: '',
      latitude: null,
      longitude: null,
      temperature: null,
      humidity: null,
      light: null,
      sensorSamplingInterval: 15,
      healthStatus: 'unknown',
      batteryLevel: 0,
      securityStatus: 'unknown',
      assetManagementUrl: null,
      supplierDeviceUrl: null,
      userManualUrl: null,
      specificationBase64: null
    }
    device.value = newDevice as Device
    editedDevice.value = { ...newDevice } as Device
    isEditing.value = true
    loading.value = false
    return
  }

  if (!props.deviceId) {
    error.value = 'No device ID provided'
    loading.value = false
    return
  }

  try {
    // For now, get device from the list
    const devices = await dataService.getDevices()
    const foundDevice = devices.find(d => d.id === props.deviceId)

    if (foundDevice) {
      device.value = foundDevice
      editedDevice.value = { ...foundDevice }
      // Load specification filename if available
      if (foundDevice.specificationBase64) {
        // Try to detect file type from base64 header or default to PDF
        specificationFileName.value = 'device-specification.pdf'
        specificationFileType.value = 'application/pdf'
        // Generate preview URL for iframe
        generatePreviewUrl()
      }
      // Setup real-time WebSocket subscriptions for this device
      setupRealtimeSubscriptions()
    } else {
      error.value = 'Device not found'
    }
  } catch (err) {
    error.value = 'Failed to load device details'
    console.error('Error loading device:', err)
  } finally {
    loading.value = false
  }
})

// Computed properties
const hasUnsavedChanges = computed(() => {
  if (!device.value || !editedDevice.value) return false
  // Check if a specification file has been selected
  if (specificationFile.value) return true
  // Check if other fields have changed
  return JSON.stringify(device.value) !== JSON.stringify(editedDevice.value)
})

// Generate Blob URL for PDF preview
const generatePreviewUrl = () => {
  if (!device.value?.specificationBase64) return

  try {
    // Clean up previous URL if it exists
    if (specificationPreviewUrl.value) {
      URL.revokeObjectURL(specificationPreviewUrl.value)
    }

    // Convert base64 to blob
    const byteCharacters = atob(device.value.specificationBase64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: specificationFileType.value })

    // Create object URL
    specificationPreviewUrl.value = URL.createObjectURL(blob)
  } catch (err) {
    console.error('Error generating preview URL:', err)
  }
}

// Methods
const startEditing = () => {
  isEditing.value = true
}

const cancelEditing = () => {
  if (device.value) {
    editedDevice.value = { ...device.value }
  }
  isEditing.value = false
}

const saveChanges = async () => {
  if (!editedDevice.value) return
  
  saving.value = true
  try {
    // Handle file upload if present
    if (specificationFile.value) {
      await handleFileUpload()
    }

    if (props.createMode) {
      // Create new device
      const newDevice = await dataService.createDevice(editedDevice.value)
      if (newDevice) {
        device.value = newDevice
        emit('deviceCreated')
        handleClose()
      } else {
        error.value = 'Failed to create device'
      }
    } else {
      // Update existing device
      if (!props.deviceId) return
      const success = await dataService.updateDevice(props.deviceId, editedDevice.value)
      if (success) {
        device.value = { ...editedDevice.value }
        isEditing.value = false

        // Publish sensor sampling interval to MQTT if connected
        if (mqttConnected.value && editedDevice.value.sensorSamplingInterval) {
          const published = setDeviceSensorInterval(
            props.deviceId,
            editedDevice.value.sensorSamplingInterval
          )
          if (published) {
            console.log(`[MQTT] Published sensor interval ${editedDevice.value.sensorSamplingInterval}min for ${props.deviceId}`)
          }
        }
      } else {
        error.value = 'Failed to save changes'
      }
    }
  } catch (err) {
    error.value = props.createMode ? 'Error creating device' : 'Error saving device'
    console.error('Save error:', err)
  } finally {
    saving.value = false
  }
}

const handleFileUpload = async () => {
  if (!specificationFile.value || !editedDevice.value) return
  
  try {
    const reader = new FileReader()
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
    })
    
    reader.readAsDataURL(specificationFile.value)
    const base64 = await base64Promise
    editedDevice.value.specificationBase64 = base64
    specificationFileName.value = specificationFile.value.name
    specificationFileType.value = specificationFile.value.type || 'application/octet-stream'
  } catch (err) {
    console.error('Error converting file to base64:', err)
    throw new Error('Failed to process specification file')
  }
}

const onFileSelect = (event: any) => {
  const files = event.files
  if (files && files.length > 0) {
    specificationFile.value = files[0]
    specificationFileName.value = files[0].name
  }
}

const downloadSpecification = () => {
  if (!device.value?.specificationBase64) return
  
  try {
    // Convert base64 to blob
    const byteCharacters = atob(device.value.specificationBase64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: specificationFileType.value })
    
    // Create download link
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = specificationFileName.value || 'device-specification'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  } catch (err) {
    console.error('Error downloading specification:', err)
    error.value = 'Failed to download specification'
  }
}

const removeSpecification = () => {
  if (editedDevice.value) {
    editedDevice.value.specificationBase64 = null
    specificationFile.value = null
    specificationFileName.value = ''
  }
}

const generateIMEI = (deviceId: string) => {
  const hash = deviceId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  const imei = Math.abs(hash).toString().padStart(15, '0').substring(0, 15)
  return imei.replace(/(\d{3})(\d{3})(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4 $5')
}

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Not available'
  try {
    return new Date(dateString).toLocaleString()
  } catch {
    return dateString
  }
}

const getStatusSeverity = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active': return 'success'
    case 'inactive': return 'secondary'
    case 'maintenance': return 'warning'
    case 'offline': return 'danger'
    default: return 'info'
  }
}

const getBatterySeverity = (level: number) => {
  if (level >= 80) return 'success'
  if (level >= 50) return 'info'
  if (level >= 20) return 'warning'
  return 'danger'
}

const getHealthSeverity = (health: string) => {
  switch (health.toLowerCase()) {
    case 'healthy': return 'success'
    case 'warning': return 'warning'
    case 'critical': return 'danger'
    case 'unknown': return 'secondary'
    default: return 'secondary'
  }
}

const getSecuritySeverity = (security: string) => {
  switch (security.toLowerCase()) {
    case 'secure': return 'success'
    case 'vulnerable': return 'warning'
    case 'compromised': return 'danger'
    case 'unknown': return 'secondary'
    default: return 'secondary'
  }
}

const handleClose = () => {
  // Clean up blob URL to prevent memory leaks
  if (specificationPreviewUrl.value) {
    URL.revokeObjectURL(specificationPreviewUrl.value)
    specificationPreviewUrl.value = ''
  }
  visible.value = false
  emit('close')
}

// Cleanup on component unmount
onBeforeUnmount(() => {
  // Cleanup specification preview URL
  if (specificationPreviewUrl.value) {
    URL.revokeObjectURL(specificationPreviewUrl.value)
  }
  // Cleanup real-time WebSocket subscriptions
  cleanupRealtimeSubscriptions()
})
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="createMode ? 'Create New Device' : `Device Details - ${device?.name || 'Loading...'}`"
    :modal="true"
    :closable="true"
    :draggable="false"
    class="device-detail-dialog"
    style="width: 90vw; max-width: 1200px"
    @hide="handleClose"
  >
    <template #header>
      <div class="dialog-header">
        <div class="header-info">
          <h3 class="device-name">{{ createMode ? 'Create New Device' : (device?.name || 'Loading...') }}</h3>
          <Tag v-if="device && !createMode" :value="device.id" severity="secondary" class="device-id-tag" />
          <RealtimeStatusIndicator v-if="device && !createMode" :showLabel="true" />
        </div>
        <div class="header-actions">
          <Button
            v-if="!isEditing && device"
            @click="startEditing"
            icon="pi pi-pencil"
            label="Edit"
            size="small"
            outlined
            :disabled="loading"
          />
        </div>
      </div>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <i class="pi pi-spinner pi-spin" style="font-size: 2rem"></i>
      <p>Loading device details...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-container">
      <i class="pi pi-exclamation-triangle" style="font-size: 2rem; color: #ef4444"></i>
      <h3>Error Loading Device</h3>
      <p>{{ error }}</p>
    </div>

    <!-- Device Details Content -->
    <div v-else-if="device && editedDevice" class="device-content">
      <!-- Tabs for different sections -->
      <Tabs value="0">
        <TabList>
          <Tab value="0">Device Info</Tab>
          <Tab value="1">Device Specification</Tab>
          <Tab value="2">Route History</Tab>
        </TabList>

        <TabPanels>
          <!-- Tab 0: Device Information -->
          <TabPanel value="0">
      <!-- Basic Information Panel -->
      <Panel header="Basic Information" :toggleable="true" class="detail-panel">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Device Name</label>
            <InputText
              v-if="isEditing"
              v-model="editedDevice.name"
              placeholder="Enter device name"
              class="form-input"
            />
            <span v-else class="form-value">{{ device.name }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">Status</label>
            <Select
              v-if="isEditing"
              v-model="editedDevice.status"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select status"
              class="form-input"
            />
            <Tag v-else :value="device.status" :severity="getStatusSeverity(device.status)" />
          </div>

          <div class="form-group">
            <label class="form-label">IMEI</label>
            <code class="imei-display">{{ generateIMEI(device.id) }}</code>
          </div>

          <div class="form-group">
            <label class="form-label">SIM Card</label>
            <Select
              v-if="isEditing"
              v-model="editedDevice.simCard"
              :options="simCards"
              optionLabel="label"
              optionValue="value"
              placeholder="Select SIM card"
              :loading="loadingSimCards"
              class="form-input"
              filter
            />
            <span v-else class="form-value">{{ device.simCard || 'No SIM card assigned' }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">Device Type</label>
            <Select
              v-if="isEditing"
              v-model="editedDevice.deviceType"
              :options="deviceTypes"
              optionLabel="label"
              optionValue="value"
              placeholder="Select device type"
              :loading="loadingDeviceTypes"
              class="form-input"
              showClear
              filter
            />
            <span v-else class="form-value">{{ device.deviceType || 'Unknown' }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">Location</label>
            <Select
              v-if="isEditing"
              v-model="editedDevice.location"
              :options="locations"
              optionLabel="label"
              optionValue="value"
              placeholder="Select location"
              :loading="loadingLocations"
              class="form-input"
              showClear
              filter
            />
            <span v-else class="form-value">{{ device.location || 'Unknown' }}</span>
          </div>
        </div>
      </Panel>

      <!-- Location Coordinates Panel -->
      <Panel header="Location Coordinates" :toggleable="true" class="detail-panel">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Latitude</label>
            <InputNumber
              v-if="isEditing"
              v-model="editedDevice.latitude"
              placeholder="Enter latitude"
              :minFractionDigits="6"
              :maxFractionDigits="6"
              class="form-input"
            />
            <span v-else class="form-value">{{ device.latitude || 'Not set' }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">Longitude</label>
            <InputNumber
              v-if="isEditing"
              v-model="editedDevice.longitude"
              placeholder="Enter longitude"
              :minFractionDigits="6"
              :maxFractionDigits="6"
              class="form-input"
            />
            <span v-else class="form-value">{{ device.longitude || 'Not set' }}</span>
          </div>
        </div>
      </Panel>

      <!-- Signal and Battery Panel -->
      <Panel header="Signal and Battery" :toggleable="true" class="detail-panel">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Signal Strength</label>
            <div class="signal-display">
              <span class="signal-value">{{ device.signalStrength }}%</span>
              <ProgressBar :value="device.signalStrength" :showValue="false" style="width: 100px; height: 8px" />
            </div>
            <small v-if="isEditing" class="sensor-readonly-hint">Value reported by device</small>
          </div>

          <div class="form-group">
            <label class="form-label">Battery Level</label>
            <div v-if="device.batteryLevel !== null && device.batteryLevel !== undefined" class="battery-display">
              <span class="battery-value">{{ device.batteryLevel }}%</span>
              <ProgressBar
                :value="device.batteryLevel"
                :showValue="false"
                :severity="getBatterySeverity(device.batteryLevel)"
                style="width: 100px; height: 8px"
              />
            </div>
            <span v-else class="form-value">Not available</span>
            <small v-if="isEditing" class="sensor-readonly-hint">Value reported by device</small>
          </div>

          <div class="form-group">
            <label class="form-label">Health Status</label>
            <Select
              v-if="isEditing"
              v-model="editedDevice.healthStatus"
              :options="healthStatusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select health status"
              class="form-input"
            />
            <Tag v-else-if="device.healthStatus"
                 :value="device.healthStatus"
                 :severity="getHealthSeverity(device.healthStatus)"
            />
            <span v-else class="form-value">Unknown</span>
          </div>

          <div class="form-group">
            <label class="form-label">Security Status</label>
            <Select
              v-if="isEditing"
              v-model="editedDevice.securityStatus"
              :options="securityStatusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select security status"
              class="form-input"
            />
            <Tag v-else-if="device.securityStatus"
                 :value="device.securityStatus"
                 :severity="getSecuritySeverity(device.securityStatus)"
            />
            <span v-else class="form-value">Unknown</span>
          </div>
        </div>
      </Panel>

      <!-- Environmental Sensors Panel -->
      <Panel header="Environmental Sensors" :toggleable="true" class="detail-panel">
        <div class="sensor-container">
          <div class="form-group full-width">
            <label class="form-label">Temperature (°C)</label>
            <div class="sensor-value-display">
              <span class="form-value sensor-reading">
                {{ device.temperature !== null && device.temperature !== undefined
                     ? `${device.temperature}°C` : 'Not available' }}
              </span>
              <small v-if="isEditing" class="sensor-readonly-hint">Value reported by sensor</small>
            </div>
            <!-- Temperature History Chart -->
            <SensorHistoryChart
              v-if="!isEditing && device.id"
              :deviceId="device.id"
              sensorType="temperature"
              sensorUnit="°C"
              :currentValue="device.temperature"
            />
          </div>

          <div class="form-group full-width">
            <label class="form-label">Humidity (%)</label>
            <div class="sensor-value-display">
              <span class="form-value sensor-reading">
                {{ device.humidity !== null && device.humidity !== undefined
                     ? `${device.humidity}%` : 'Not available' }}
              </span>
              <small v-if="isEditing" class="sensor-readonly-hint">Value reported by sensor</small>
            </div>
            <!-- Humidity History Chart -->
            <SensorHistoryChart
              v-if="!isEditing && device.id"
              :deviceId="device.id"
              sensorType="humidity"
              sensorUnit="%"
              :currentValue="device.humidity"
            />
          </div>

          <div class="form-group full-width">
            <label class="form-label">Light Level (lux)</label>
            <div class="sensor-value-display">
              <span class="form-value sensor-reading">
                {{ device.light !== null && device.light !== undefined
                     ? `${device.light} lux` : 'Not available' }}
              </span>
              <small v-if="isEditing" class="sensor-readonly-hint">Value reported by sensor</small>
            </div>
            <!-- Light History Chart -->
            <SensorHistoryChart
              v-if="!isEditing && device.id"
              :deviceId="device.id"
              sensorType="light"
              sensorUnit="lux"
              :currentValue="device.light"
            />
          </div>

          <div class="form-group full-width sampling-interval-group">
            <label class="form-label">Sensor Sampling Interval</label>
            <Select
              v-if="isEditing"
              v-model="editedDevice.sensorSamplingInterval"
              :options="samplingIntervalOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select sampling interval"
              class="form-input sampling-select"
            />
            <div v-else class="sampling-display">
              <i class="pi pi-clock"></i>
              <span class="form-value">
                {{ device.sensorSamplingInterval !== null && device.sensorSamplingInterval !== undefined
                     ? (device.sensorSamplingInterval >= 60
                         ? `${device.sensorSamplingInterval / 60} hour${device.sensorSamplingInterval >= 120 ? 's' : ''}`
                         : `${device.sensorSamplingInterval} minute${device.sensorSamplingInterval !== 1 ? 's' : ''}`)
                     : '15 minutes (default)' }}
              </span>
            </div>
            <small class="sampling-hint">How often the device sends environmental sensor readings</small>
          </div>
        </div>
      </Panel>

      <!-- Technical Information Panel -->
      <Panel header="Technical Information" :toggleable="true" class="detail-panel">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Data Usage</label>
            <InputText
              v-if="isEditing"
              v-model="editedDevice.dataUsage"
              placeholder="e.g., 15.7 MB"
              class="form-input"
            />
            <span v-else class="form-value">{{ device.dataUsage || '0 MB' }}</span>
          </div>

          <div class="form-group">
            <label class="form-label">Connection Type</label>
            <Select
              v-if="isEditing"
              v-model="editedDevice.connectionType"
              :options="connectionTypeOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Select connection type"
              class="form-input"
            />
            <Tag v-else :value="device.connectionType" severity="info" />
          </div>

          <div class="form-group">
            <label class="form-label">Last Seen</label>
            <span class="form-value">{{ formatDate(device.lastSeen) }}</span>
          </div>
        </div>
      </Panel>

      <!-- Additional Information Panel -->
      <Panel header="Additional Information" :toggleable="true" class="detail-panel">
        <div class="form-group full-width">
          <label class="form-label">Description</label>
          <Textarea
            v-if="isEditing"
            v-model="editedDevice.description"
            rows="4"
            placeholder="Enter detailed description of this device..."
            class="form-textarea"
          />
          <p v-else class="form-value description">{{ device.description || 'No description available' }}</p>
        </div>
      </Panel>
          </TabPanel>

          <!-- Tab 1: Device Specification -->
          <TabPanel value="1">
            <!-- Technical Metadata Panel -->
            <Panel header="Technical Metadata" :toggleable="true" class="detail-panel">
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Asset Management System</label>
                  <InputText
                    v-if="isEditing"
                    v-model="editedDevice.assetManagementUrl"
                    placeholder="https://example.com/assets/device-id"
                    class="form-input"
                  />
                  <a v-else-if="device.assetManagementUrl"
                     :href="device.assetManagementUrl"
                     target="_blank"
                     class="external-link"
                  >
                    {{ device.assetManagementUrl }}
                    <i class="pi pi-external-link"></i>
                  </a>
                  <span v-else class="form-value">Not configured</span>
                </div>

                <div class="form-group">
                  <label class="form-label">Supplier Device Information</label>
                  <InputText
                    v-if="isEditing"
                    v-model="editedDevice.supplierDeviceUrl"
                    placeholder="https://supplier.com/devices/device-model"
                    class="form-input"
                  />
                  <a v-else-if="device.supplierDeviceUrl"
                     :href="device.supplierDeviceUrl"
                     target="_blank"
                     class="external-link"
                  >
                    {{ device.supplierDeviceUrl }}
                    <i class="pi pi-external-link"></i>
                  </a>
                  <span v-else class="form-value">Not configured</span>
                </div>

                <div class="form-group">
                  <label class="form-label">User Manual / Spec Sheet</label>
                  <InputText
                    v-if="isEditing"
                    v-model="editedDevice.userManualUrl"
                    placeholder="https://docs.example.com/manuals/device-manual.pdf"
                    class="form-input"
                  />
                  <a v-else-if="device.userManualUrl"
                     :href="device.userManualUrl"
                     target="_blank"
                     class="external-link"
                  >
                    {{ device.userManualUrl }}
                    <i class="pi pi-external-link"></i>
                  </a>
                  <span v-else class="form-value">Not configured</span>
                </div>

                <div class="form-group" style="grid-column: 1 / -1">
                  <label class="form-label">Device Specification Document</label>
                  <div v-if="isEditing" class="specification-upload">
                    <FileUpload
                      mode="basic"
                      accept="application/pdf,.pdf,.doc,.docx"
                      :maxFileSize="MAX_FILE_SIZE_BYTES"
                      :auto="false"
                      chooseLabel="Choose File"
                      @select="onFileSelect"
                      class="specification-file-upload"
                    />
                    <small class="file-hint">Upload device specification (PDF, DOC, DOCX - Max {{ MAX_FILE_SIZE_MB }}MB)</small>
                    <div v-if="specificationFileName" class="current-file">
                      <i class="pi pi-file"></i>
                      <span>{{ specificationFileName }}</span>
                      <Button
                        icon="pi pi-times"
                        severity="danger"
                        text
                        rounded
                        @click="removeSpecification"
                        size="small"
                      />
                    </div>
                  </div>
                  <div v-else-if="device.specificationBase64" class="specification-display">
                    <Button
                      label="Download Specification"
                      icon="pi pi-download"
                      severity="secondary"
                      @click="downloadSpecification"
                      size="small"
                    />
                    <span class="file-name">{{ specificationFileName }}</span>
                  </div>
                  <span v-else class="form-value">No specification uploaded</span>
                </div>
              </div>
            </Panel>

            <!-- Specification Preview Panel -->
            <Panel
              v-if="device.specificationBase64 && !isEditing"
              header="Specification Preview"
              :toggleable="true"
              :collapsed="true"
              class="detail-panel specification-preview-panel"
            >
              <div class="preview-container">
                <iframe
                  v-if="specificationFileType.includes('pdf') && specificationPreviewUrl"
                  :src="specificationPreviewUrl"
                  class="specification-iframe"
                  title="Device Specification Preview"
                />
                <div v-else class="preview-message">
                  <i class="pi pi-file" style="font-size: 3rem; color: #cbd5e1;"></i>
                  <p>Preview not available for this file type.</p>
                  <p class="hint">Please download the file to view it.</p>
                  <Button
                    label="Download Specification"
                    icon="pi pi-download"
                    severity="secondary"
                    @click="downloadSpecification"
                    class="download-btn"
                  />
                </div>
              </div>
            </Panel>
          </TabPanel>

          <!-- Tab 2: Route History -->
          <TabPanel value="2">
            <div class="route-history-container">
              <DeviceRouteMap v-if="device.id" :deviceId="device.id" />
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <Button v-if="isEditing" label="Cancel" icon="pi pi-times" text @click="cancelEditing" />
        <Button v-if="isEditing" 
                label="Save Changes" 
                icon="pi pi-check" 
                @click="saveChanges"
                :loading="saving"
                :disabled="!hasUnsavedChanges" 
        />
        <Button v-if="!isEditing" label="Close" icon="pi pi-times" @click="handleClose" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
/* Dialog styling for dark theme */
.device-detail-dialog {
  min-height: 80vh;
  --dialog-background: var(--surface-dark, #18222c);
  --dialog-border: var(--border-dark, #283039);
}

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

.device-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: white;
}

.device-id-tag {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.75rem;
}

.loading-container, .error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  gap: 1rem;
}

.loading-container h3,
.loading-container p,
.error-container h3 {
  color: white;
  margin: 0;
}

.error-container p {
  color: var(--text-secondary, #9faab6);
  margin: 0;
}

.device-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.detail-panel {
  margin-bottom: 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.sensor-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-label {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-secondary, #9faab6);
}

.form-value {
  font-size: 0.9375rem;
  color: white;
}

.form-value.description {
  line-height: 1.6;
  white-space: pre-wrap;
}

.imei-display {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.875rem;
  background: var(--background-dark, #101922);
  padding: 0.625rem 0.75rem;
  border-radius: 0.5rem;
  color: white;
  border: 1px solid var(--border-dark, #283039);
}

.signal-display, .battery-display {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sampling-interval-group {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-dark, #283039);
}

.sampling-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: white;
}

.sampling-display i {
  color: var(--primary, #137fec);
  font-size: 1rem;
}

.sampling-hint {
  display: block;
  margin-top: 0.5rem;
  color: var(--text-secondary, #9faab6);
  font-size: 0.75rem;
}

.sensor-readonly-hint {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-secondary, #9faab6);
  font-size: 0.7rem;
  font-style: italic;
}

.sensor-value-display {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sensor-reading {
  font-size: 1.1rem;
  font-weight: 500;
}

.sampling-select {
  max-width: 200px;
}

.signal-value, .battery-value {
  font-size: 0.9375rem;
  font-weight: 500;
  color: white;
}

.external-link {
  color: var(--primary, #137fec);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  transition: color 0.15s ease;
}

.external-link:hover {
  color: var(--jt-secondary-blue, #1a90ff);
  text-decoration: underline;
}

.specification-upload {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.specification-file-upload {
  width: fit-content;
}

.file-hint {
  color: var(--text-secondary, #9faab6);
  font-size: 0.875rem;
}

.current-file {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: var(--background-dark, #101922);
  border: 1px solid var(--border-dark, #283039);
  border-radius: 0.5rem;
  margin-top: 0.5rem;
}

.current-file i {
  color: var(--primary, #137fec);
}

.current-file span {
  flex: 1;
  font-size: 0.875rem;
  color: white;
}

.specification-display {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.specification-display .file-name {
  color: var(--text-secondary, #9faab6);
  font-size: 0.875rem;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* Route History Container */
.route-history-container {
  min-height: 500px;
  display: flex;
  flex-direction: column;
}

/* Specification Preview Panel */
.specification-preview-panel {
  margin-top: 1rem;
}

.preview-container {
  width: 100%;
  min-height: 600px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.specification-iframe {
  width: 100%;
  height: 600px;
  border: 1px solid var(--border-dark, #283039);
  border-radius: 0.5rem;
  background: white;
}

.preview-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem;
  text-align: center;
  color: var(--text-secondary, #9faab6);
}

.preview-message p {
  margin: 0;
  font-size: 1rem;
}

.preview-message .hint {
  font-size: 0.875rem;
  color: var(--text-secondary, #9faab6);
}

.preview-message .download-btn {
  margin-top: 1rem;
}

/* Responsive design */
@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .dialog-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .header-actions {
    align-self: flex-end;
  }

  .specification-iframe {
    height: 400px;
  }

  .preview-container {
    min-height: 400px;
  }
}
</style>

<style>
/* Global styles for PrimeVue Dialog dark theme */
.device-detail-dialog .p-dialog {
  background: var(--surface-dark, #18222c) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  border-radius: 1rem !important;
}

.device-detail-dialog .p-dialog-header {
  background: var(--surface-dark, #18222c) !important;
  border-bottom: 1px solid var(--border-dark, #283039) !important;
  padding: 1.25rem 1.5rem !important;
  border-radius: 1rem 1rem 0 0 !important;
}

.device-detail-dialog .p-dialog-header .p-dialog-title {
  display: none;
}

.device-detail-dialog .p-dialog-header-icons {
  position: absolute;
  right: 1rem;
  top: 1rem;
}

.device-detail-dialog .p-dialog-header-icon {
  color: var(--text-secondary, #9faab6) !important;
}

.device-detail-dialog .p-dialog-header-icon:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
  color: white !important;
}

.device-detail-dialog .p-dialog-content {
  background: var(--surface-dark, #18222c) !important;
  padding: 1.5rem !important;
  color: white !important;
}

.device-detail-dialog .p-dialog-footer {
  background: var(--surface-dark, #18222c) !important;
  border-top: 1px solid var(--border-dark, #283039) !important;
  padding: 1rem 1.5rem !important;
  border-radius: 0 0 1rem 1rem !important;
}

/* Tabs styling for dark theme */
.device-detail-dialog .p-tabs {
  background: transparent !important;
}

.device-detail-dialog .p-tablist {
  background: transparent !important;
  border-bottom: 1px solid var(--border-dark, #283039) !important;
}

.device-detail-dialog .p-tab {
  background: transparent !important;
  color: var(--text-secondary, #9faab6) !important;
  border: none !important;
  padding: 0.75rem 1.25rem !important;
}

.device-detail-dialog .p-tab:hover {
  color: white !important;
  background: var(--surface-dark-highlight, #202b36) !important;
}

.device-detail-dialog .p-tab[data-p-active="true"],
.device-detail-dialog .p-tab.p-tab-active {
  color: var(--primary, #137fec) !important;
  border-bottom: 2px solid var(--primary, #137fec) !important;
}

.device-detail-dialog .p-tabpanels {
  background: transparent !important;
  padding: 1.5rem 0 0 0 !important;
}

.device-detail-dialog .p-tabpanel {
  padding: 0 !important;
}

/* Panel styling for dark theme */
.device-detail-dialog .p-panel {
  background: var(--surface-dark-highlight, #202b36) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  border-radius: 0.75rem !important;
  overflow: hidden;
}

.device-detail-dialog .p-panel-header {
  background: transparent !important;
  border-bottom: 1px solid var(--border-dark, #283039) !important;
  padding: 1rem 1.25rem !important;
}

.device-detail-dialog .p-panel-title {
  color: white !important;
  font-weight: 600 !important;
  font-size: 0.9375rem !important;
}

.device-detail-dialog .p-panel-icons {
  color: var(--text-secondary, #9faab6) !important;
}

.device-detail-dialog .p-panel-content {
  background: transparent !important;
  padding: 1.25rem !important;
}

/* Input styling for dark theme */
.device-detail-dialog .p-inputtext,
.device-detail-dialog .p-inputnumber-input,
.device-detail-dialog .p-textarea {
  background: var(--background-dark, #101922) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  color: white !important;
  border-radius: 0.5rem !important;
}

.device-detail-dialog .p-inputtext:enabled:hover,
.device-detail-dialog .p-inputnumber-input:enabled:hover,
.device-detail-dialog .p-textarea:enabled:hover {
  border-color: var(--primary, #137fec) !important;
}

.device-detail-dialog .p-inputtext:enabled:focus,
.device-detail-dialog .p-inputnumber-input:enabled:focus,
.device-detail-dialog .p-textarea:enabled:focus {
  border-color: var(--primary, #137fec) !important;
  box-shadow: 0 0 0 2px rgba(19, 127, 236, 0.2) !important;
}

.device-detail-dialog .p-inputtext::placeholder,
.device-detail-dialog .p-inputnumber-input::placeholder,
.device-detail-dialog .p-textarea::placeholder {
  color: var(--text-secondary, #9faab6) !important;
}

.device-detail-dialog .p-inputtext:disabled,
.device-detail-dialog .p-inputnumber-input:disabled {
  opacity: 0.6;
  background: var(--surface-dark-highlight, #202b36) !important;
}

/* Select/Dropdown styling for dark theme */
.device-detail-dialog .p-select {
  background: var(--background-dark, #101922) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  border-radius: 0.5rem !important;
}

.device-detail-dialog .p-select .p-select-label {
  color: white !important;
}

.device-detail-dialog .p-select:not(.p-disabled):hover {
  border-color: var(--primary, #137fec) !important;
}

.device-detail-dialog .p-select:not(.p-disabled).p-focus {
  border-color: var(--primary, #137fec) !important;
  box-shadow: 0 0 0 2px rgba(19, 127, 236, 0.2) !important;
}

.device-detail-dialog .p-select-dropdown {
  color: var(--text-secondary, #9faab6) !important;
}

/* Progress bar styling */
.device-detail-dialog .p-progressbar {
  background: var(--border-dark, #283039) !important;
  border-radius: 4px !important;
}

.device-detail-dialog .p-progressbar-value {
  border-radius: 4px !important;
}

/* Button styling for dark theme */
.device-detail-dialog .p-button.p-button-outlined {
  border-color: var(--border-dark, #283039) !important;
  color: white !important;
}

.device-detail-dialog .p-button.p-button-outlined:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
  border-color: var(--primary, #137fec) !important;
}

.device-detail-dialog .p-button.p-button-text {
  color: var(--text-secondary, #9faab6) !important;
}

.device-detail-dialog .p-button.p-button-text:hover {
  background: var(--surface-dark-highlight, #202b36) !important;
  color: white !important;
}

/* Tag styling */
.device-detail-dialog .p-tag {
  font-size: 0.75rem !important;
  font-weight: 600 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
}

/* FileUpload styling */
.device-detail-dialog .p-fileupload {
  background: transparent !important;
}

.device-detail-dialog .p-fileupload .p-button {
  background: var(--surface-dark-highlight, #202b36) !important;
  border: 1px solid var(--border-dark, #283039) !important;
  color: white !important;
}

.device-detail-dialog .p-fileupload .p-button:hover {
  background: var(--background-dark, #101922) !important;
  border-color: var(--primary, #137fec) !important;
}
</style>
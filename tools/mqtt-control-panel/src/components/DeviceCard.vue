<script setup>
import { ref, computed, watch } from 'vue'
import Card from 'primevue/card'
import Slider from 'primevue/slider'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Knob from 'primevue/knob'
import Divider from 'primevue/divider'

const props = defineProps({
  device: Object,
  connected: Boolean,
  isMobile: Boolean
})

const emit = defineEmits([
  'set-sensor',
  'set-location',
  'set-heading',
  'set-speed',
  'set-sensor-interval',
  'pause',
  'resume',
  'reset'
])

// Local control values
const temperature = ref(props.device?.sensors?.temperature || 22)
const humidity = ref(props.device?.sensors?.humidity || 50)
const battery = ref(props.device?.sensors?.batteryLevel || 85)
const light = ref(props.device?.sensors?.light || 500)
const latitude = ref(props.device?.location?.latitude || 47.38)
const longitude = ref(props.device?.location?.longitude || 8.54)
const speed = ref(props.device?.location?.speed || 0)
const heading = ref(props.device?.location?.heading || 0)
const sensorIntervalSeconds = ref(props.device?.sensorInterval || 10)
const sensorIntervalMinutes = computed({
  get: () => Math.round(sensorIntervalSeconds.value / 60) || 1,
  set: (val) => { sensorIntervalSeconds.value = val * 60 }
})

// Device type labels
const deviceTypes = {
  DEV001: 'IoT Sensor',
  DEV002: 'Gateway',
  DEV003: 'Vehicle Tracker',
  DEV004: 'Camera',
  DEV005: 'Environmental',
  DEV006: 'Smart Meter',
  DEV007: 'Asset Tracker',
  DEV008: 'Industrial'
}

const deviceType = computed(() => deviceTypes[props.device.id] || 'Device')

// Watch for external updates
watch(() => props.device?.sensors, (newVal) => {
  if (newVal) {
    temperature.value = newVal.temperature || temperature.value
    humidity.value = newVal.humidity || humidity.value
    battery.value = newVal.batteryLevel || battery.value
    light.value = newVal.light || light.value
  }
}, { deep: true })

watch(() => props.device?.location, (newVal) => {
  if (newVal) {
    latitude.value = newVal.latitude || latitude.value
    longitude.value = newVal.longitude || longitude.value
    speed.value = newVal.speed || speed.value
    heading.value = newVal.heading || heading.value
  }
}, { deep: true })

watch(() => props.device?.sensorInterval, (newVal) => {
  if (newVal !== undefined) {
    sensorIntervalSeconds.value = newVal
  }
})

// Command handlers
function sendTemperature() {
  emit('set-sensor', props.device.id, 'temperature', temperature.value)
}

function sendHumidity() {
  emit('set-sensor', props.device.id, 'humidity', humidity.value)
}

function sendBattery() {
  emit('set-sensor', props.device.id, 'battery', battery.value)
}

function sendLight() {
  emit('set-sensor', props.device.id, 'light', light.value)
}

function sendLocation() {
  emit('set-location', props.device.id, latitude.value, longitude.value)
}

function sendHeading() {
  emit('set-heading', props.device.id, heading.value)
}

function sendSpeed() {
  emit('set-speed', props.device.id, speed.value)
}

function sendSensorInterval() {
  emit('set-sensor-interval', props.device.id, sensorIntervalSeconds.value)
}

function togglePause() {
  if (props.device.paused) {
    emit('resume', props.device.id)
  } else {
    emit('pause', props.device.id)
  }
}

function resetDevice() {
  emit('reset', props.device.id)
}

const isPaused = computed(() => props.device?.paused || false)
const signalStrength = computed(() => props.device?.metadata?.signalStrength || 0)

function formatTime(timestamp) {
  if (!timestamp) return 'Never'
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

// Format interval in human-readable form
function formatInterval(seconds) {
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  } else if (seconds >= 60) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }
  return `${seconds}s`
}
</script>

<template>
  <Card class="device-card" :class="{ paused: isPaused }">
    <template #header>
      <div class="card-header">
        <div class="device-info">
          <span class="device-id">{{ device.id }}</span>
          <Tag :value="deviceType" severity="info" />
        </div>
        <div class="status-indicators">
          <Tag v-if="isPaused" value="Paused" severity="warn" />
          <Tag v-else value="Active" severity="success" />
        </div>
      </div>
    </template>

    <template #content>
      <div class="sensor-controls">
        <!-- Temperature -->
        <div class="control-row">
          <div class="control-label">
            <i class="pi pi-sun"></i>
            <span>Temperature</span>
            <span class="current-value">{{ device.sensors?.temperature?.toFixed(1) || 0 }}°C</span>
          </div>
          <div class="control-input">
            <Slider v-model="temperature" :min="-20" :max="60" :step="0.5" class="flex-grow" />
            <InputNumber v-model="temperature" :min="-20" :max="60" :minFractionDigits="1" suffix="°C" class="value-input" />
            <Button icon="pi pi-send" size="small" @click="sendTemperature" :disabled="!connected" text />
          </div>
        </div>

        <!-- Humidity -->
        <div class="control-row">
          <div class="control-label">
            <i class="pi pi-cloud"></i>
            <span>Humidity</span>
            <span class="current-value">{{ device.sensors?.humidity?.toFixed(1) || 0 }}%</span>
          </div>
          <div class="control-input">
            <Slider v-model="humidity" :min="0" :max="100" :step="1" class="flex-grow" />
            <InputNumber v-model="humidity" :min="0" :max="100" suffix="%" class="value-input" />
            <Button icon="pi pi-send" size="small" @click="sendHumidity" :disabled="!connected" text />
          </div>
        </div>

        <!-- Battery -->
        <div class="control-row">
          <div class="control-label">
            <i class="pi pi-bolt"></i>
            <span>Battery</span>
            <span class="current-value">{{ device.sensors?.batteryLevel || 0 }}%</span>
          </div>
          <div class="control-input">
            <Slider v-model="battery" :min="0" :max="100" :step="1" class="flex-grow" />
            <InputNumber v-model="battery" :min="0" :max="100" suffix="%" class="value-input" />
            <Button icon="pi pi-send" size="small" @click="sendBattery" :disabled="!connected" text />
          </div>
        </div>

        <!-- Light -->
        <div class="control-row">
          <div class="control-label">
            <i class="pi pi-star"></i>
            <span>Light</span>
            <span class="current-value">{{ device.sensors?.light || 0 }} lux</span>
          </div>
          <div class="control-input">
            <Slider v-model="light" :min="0" :max="100000" :step="100" class="flex-grow" />
            <InputNumber v-model="light" :min="0" :max="100000" class="value-input" />
            <Button icon="pi pi-send" size="small" @click="sendLight" :disabled="!connected" text />
          </div>
        </div>

        <Divider />

        <!-- Sensor Interval -->
        <div class="control-row">
          <div class="control-label">
            <i class="pi pi-clock"></i>
            <span>Sensor Interval</span>
            <span class="current-value interval-value">{{ formatInterval(device.sensorInterval || 10) }}</span>
          </div>
          <div class="control-input">
            <Slider v-model="sensorIntervalMinutes" :min="1" :max="60" :step="1" class="flex-grow" />
            <InputNumber v-model="sensorIntervalMinutes" :min="1" :max="1440" suffix=" min" class="value-input" />
            <Button icon="pi pi-send" size="small" @click="sendSensorInterval" :disabled="!connected" text />
          </div>
        </div>

        <!-- Mobile device controls -->
        <template v-if="isMobile">
          <Divider />

          <!-- Location -->
          <div class="control-row location-row">
            <div class="control-label">
              <i class="pi pi-map-marker"></i>
              <span>Location</span>
            </div>
            <div class="location-inputs">
              <InputNumber v-model="latitude" :min="-90" :max="90" :minFractionDigits="4" placeholder="Lat" class="coord-input" />
              <InputNumber v-model="longitude" :min="-180" :max="180" :minFractionDigits="4" placeholder="Lon" class="coord-input" />
              <Button icon="pi pi-send" size="small" @click="sendLocation" :disabled="!connected" text />
            </div>
          </div>

          <!-- Speed -->
          <div class="control-row">
            <div class="control-label">
              <i class="pi pi-car"></i>
              <span>Speed</span>
              <span class="current-value">{{ device.location?.speed?.toFixed(1) || 0 }} km/h</span>
            </div>
            <div class="control-input">
              <Slider v-model="speed" :min="0" :max="200" :step="1" class="flex-grow" />
              <InputNumber v-model="speed" :min="0" :max="200" suffix=" km/h" class="value-input" />
              <Button icon="pi pi-send" size="small" @click="sendSpeed" :disabled="!connected" text />
            </div>
          </div>

          <!-- Heading -->
          <div class="control-row">
            <div class="control-label">
              <i class="pi pi-compass"></i>
              <span>Heading</span>
              <span class="current-value">{{ device.location?.heading || 0 }}°</span>
            </div>
            <div class="control-input">
              <Slider v-model="heading" :min="0" :max="359" :step="1" class="flex-grow" />
              <InputNumber v-model="heading" :min="0" :max="359" suffix="°" class="value-input" />
              <Button icon="pi pi-send" size="small" @click="sendHeading" :disabled="!connected" text />
            </div>
          </div>
        </template>
      </div>

      <!-- Signal and Last Seen -->
      <div class="status-row">
        <div class="signal">
          <i class="pi pi-wifi"></i>
          <span>{{ signalStrength }}%</span>
        </div>
        <div class="last-seen">
          Last: {{ formatTime(device.lastSeen) }}
        </div>
      </div>
    </template>

    <template #footer>
      <div class="card-actions">
        <Button
          :label="isPaused ? 'Resume' : 'Pause'"
          :icon="isPaused ? 'pi pi-play' : 'pi pi-pause'"
          :severity="isPaused ? 'success' : 'warn'"
          size="small"
          @click="togglePause"
          :disabled="!connected"
        />
        <Button
          label="Reset"
          icon="pi pi-refresh"
          severity="secondary"
          size="small"
          @click="resetDevice"
          :disabled="!connected"
        />
      </div>
    </template>
  </Card>
</template>

<style scoped>
.device-card {
  height: 100%;
  transition: opacity 0.3s;
}

.device-card.paused {
  opacity: 0.7;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #2a2a3e;
  border-bottom: 1px solid #3a3a50;
}

.device-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.device-id {
  font-weight: 700;
  font-size: 1.1rem;
  color: #fff;
}

.sensor-controls {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.control-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.control-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.control-label i {
  width: 1rem;
}

.current-value {
  margin-left: auto;
  font-weight: 600;
  color: var(--p-primary-color);
}

.interval-value {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
}

.control-input {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.flex-grow {
  flex: 1;
}

.value-input {
  width: 100px;
}

.value-input :deep(.p-inputnumber-input) {
  width: 100%;
  text-align: right;
  padding: 0.25rem 0.5rem;
}

.location-inputs {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.coord-input {
  width: 110px;
}

.coord-input :deep(.p-inputnumber-input) {
  width: 100%;
  padding: 0.25rem 0.5rem;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--p-surface-200);
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.signal {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

:deep(.p-card-body) {
  padding: 1rem;
}

:deep(.p-card-footer) {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--p-surface-200);
}
</style>

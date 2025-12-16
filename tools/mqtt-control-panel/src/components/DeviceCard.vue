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

// Logarithmic scale for interval slider (10 seconds to 7 days)
const INTERVAL_MIN = 10        // 10 seconds
const INTERVAL_MAX = 604800    // 7 days in seconds
const SLIDER_MAX = 100         // Slider range 0-100

// Convert seconds to logarithmic slider position (0-100)
function secondsToSlider(seconds) {
  const clamped = Math.max(INTERVAL_MIN, Math.min(INTERVAL_MAX, seconds))
  return SLIDER_MAX * Math.log(clamped / INTERVAL_MIN) / Math.log(INTERVAL_MAX / INTERVAL_MIN)
}

// Convert logarithmic slider position to seconds
// Rounds to nearest whole day/hour/minute based on magnitude
function sliderToSeconds(position) {
  const seconds = INTERVAL_MIN * Math.pow(INTERVAL_MAX / INTERVAL_MIN, position / SLIDER_MAX)
  if (seconds >= 86400) {
    // Round to nearest whole day
    const days = Math.round(seconds / 86400)
    return days * 86400
  } else if (seconds >= 3600) {
    // Round to nearest whole hour
    const hours = Math.round(seconds / 3600)
    return hours * 3600
  } else if (seconds >= 60) {
    // Round to nearest whole minute
    const minutes = Math.round(seconds / 60)
    return minutes * 60
  }
  return Math.round(seconds)
}

// Computed for logarithmic slider binding
const intervalSliderValue = computed({
  get: () => secondsToSlider(sensorIntervalSeconds.value),
  set: (val) => { sensorIntervalSeconds.value = sliderToSeconds(val) }
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
// - Seconds up to 1 minute
// - Whole minutes from 1 minute to 1 hour
// - Whole hours from 1 hour to 24 hours
// - Whole days after 24 hours
function formatInterval(seconds) {
  if (seconds >= 86400) {
    // 24+ hours: show in days
    const days = Math.round(seconds / 86400)
    return `${days}d`
  } else if (seconds >= 3600) {
    // 1 hour to 24 hours: show in whole hours
    const hours = Math.round(seconds / 3600)
    return `${hours}h`
  } else if (seconds >= 60) {
    // 1 minute to 1 hour: show in whole minutes
    const minutes = Math.round(seconds / 60)
    return `${minutes}m`
  }
  // Under 1 minute: show in seconds
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
          </div>
          <div class="control-input">
            <Slider v-model="intervalSliderValue" :min="0" :max="100" :step="0.5" class="flex-grow" />
            <span class="interval-display">{{ formatInterval(sensorIntervalSeconds) }}</span>
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
  padding: 0.5rem 0.75rem;
  background: #2a2a3e;
  border-bottom: 1px solid #3a3a50;
}

.device-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.device-id {
  font-weight: 700;
  font-size: 0.95rem;
  color: #fff;
}

.sensor-controls {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.control-row {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.control-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.control-label i {
  width: 0.85rem;
  font-size: 0.85rem;
}

.current-value {
  margin-left: auto;
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--p-primary-color);
}

.interval-display {
  width: 75px;
  text-align: right;
  padding: 0.2rem 0.35rem;
  font-size: 0.75rem;
  background: var(--p-form-field-background);
  border: 1px solid var(--p-form-field-border-color);
  border-radius: var(--p-form-field-border-radius);
  color: var(--p-form-field-color);
}

.control-input {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.flex-grow {
  flex: 1;
}

.value-input {
  width: 75px;
}

.value-input :deep(.p-inputnumber-input) {
  width: 100%;
  text-align: right;
  padding: 0.2rem 0.35rem;
  font-size: 0.75rem;
}

.location-inputs {
  display: flex;
  gap: 0.35rem;
  align-items: center;
}

.coord-input {
  width: 90px;
}

.coord-input :deep(.p-inputnumber-input) {
  width: 100%;
  padding: 0.2rem 0.35rem;
  font-size: 0.75rem;
}

.status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
  padding-top: 0.4rem;
  border-top: 1px solid var(--p-surface-200);
  font-size: 0.7rem;
  color: var(--p-text-muted-color);
}

.signal {
  display: flex;
  align-items: center;
  gap: 0.2rem;
}

.card-actions {
  display: flex;
  gap: 0.35rem;
  justify-content: flex-end;
}

:deep(.p-card-body) {
  padding: 0.6rem 0.75rem;
}

:deep(.p-card-footer) {
  padding: 0.4rem 0.75rem;
  border-top: 1px solid var(--p-surface-200);
}

:deep(.p-slider) {
  height: 0.35rem;
}

:deep(.p-slider .p-slider-handle) {
  width: 0.85rem;
  height: 0.85rem;
}

:deep(.p-tag) {
  font-size: 0.65rem;
  padding: 0.15rem 0.35rem;
}

:deep(.p-button.p-button-sm) {
  padding: 0.3rem 0.5rem;
  font-size: 0.75rem;
}

:deep(.p-divider) {
  margin: 0.4rem 0;
}
</style>

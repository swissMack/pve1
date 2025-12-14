<script setup>
import { onMounted, computed } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import GlobalSettings from './components/GlobalSettings.vue'
import DeviceCard from './components/DeviceCard.vue'
import { useMqtt } from './composables/useMqtt'

const {
  connected,
  connecting,
  error,
  devices,
  connect,
  disconnect,
  setSensorValue,
  setLocation,
  setHeading,
  setSpeed,
  pauseDevice,
  resumeDevice,
  resetDevice,
  setDeviceSensorInterval,
  setLocationInterval
} = useMqtt()

// Mobile devices (have location tracking)
const mobileDeviceIds = ['DEV003', 'DEV007']

function isMobileDevice(deviceId) {
  return mobileDeviceIds.includes(deviceId)
}

const deviceList = computed(() => {
  return Object.values(devices)
})

// Event handlers
function handleSetSensor(deviceId, field, value) {
  setSensorValue(deviceId, field, value)
}

function handleSetLocation(deviceId, lat, lon) {
  setLocation(deviceId, lat, lon)
}

function handleSetHeading(deviceId, value) {
  setHeading(deviceId, value)
}

function handleSetSpeed(deviceId, value) {
  setSpeed(deviceId, value)
}

function handlePause(deviceId) {
  pauseDevice(deviceId)
}

function handleResume(deviceId) {
  resumeDevice(deviceId)
}

function handleReset(deviceId) {
  resetDevice(deviceId)
}

function handleSetSensorInterval(deviceId, intervalSeconds) {
  setDeviceSensorInterval(deviceId, intervalSeconds)
}

function handleUpdateLocationInterval(locationInterval) {
  setLocationInterval(locationInterval)
}

onMounted(() => {
  connect()
})
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="header-left">
        <h1>
          <i class="pi pi-server"></i>
          MQTT Control Panel
        </h1>
      </div>
      <div class="header-right">
        <Tag v-if="error" :value="error" severity="danger" />
        <Tag
          v-else-if="connecting"
          value="Connecting..."
          severity="warn"
          icon="pi pi-spin pi-spinner"
        />
        <Tag
          v-else-if="connected"
          value="Connected"
          severity="success"
          icon="pi pi-check-circle"
        />
        <Tag
          v-else
          value="Disconnected"
          severity="danger"
          icon="pi pi-times-circle"
        />
        <Button
          v-if="connected"
          label="Disconnect"
          icon="pi pi-power-off"
          severity="danger"
          size="small"
          @click="disconnect"
        />
        <Button
          v-else
          label="Connect"
          icon="pi pi-link"
          severity="success"
          size="small"
          @click="connect"
          :loading="connecting"
        />
      </div>
    </header>

    <!-- Main Content -->
    <main class="app-main">
      <!-- Global Settings -->
      <GlobalSettings
        :connected="connected"
        @update-location-interval="handleUpdateLocationInterval"
      />

      <!-- Device Grid -->
      <div class="device-grid">
        <DeviceCard
          v-for="device in deviceList"
          :key="device.id"
          :device="device"
          :connected="connected"
          :isMobile="isMobileDevice(device.id)"
          @set-sensor="handleSetSensor"
          @set-location="handleSetLocation"
          @set-heading="handleSetHeading"
          @set-speed="handleSetSpeed"
          @set-sensor-interval="handleSetSensorInterval"
          @pause="handlePause"
          @resume="handleResume"
          @reset="handleReset"
        />
      </div>
    </main>

    <!-- Footer -->
    <footer class="app-footer">
      <span>MQTT Control Panel v1.0</span>
      <span>Connected to: ws://192.168.1.199:8083/mqtt</span>
    </footer>
  </div>
</template>

<style>
/* Global styles */
:root {
  color-scheme: dark;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background-color: #1a1a2e;
  color: #eee;
  min-height: 100vh;
}

.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #16213e 0%, #1a1a2e 100%);
  border-bottom: 1px solid #333;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left h1 {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.5rem;
  font-weight: 600;
  color: #fff;
}

.header-left h1 i {
  color: #4fc3f7;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.app-main {
  flex: 1;
  padding: 1.5rem 2rem;
  max-width: 1800px;
  margin: 0 auto;
  width: 100%;
}

.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 1.5rem;
}

.app-footer {
  display: flex;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: #16213e;
  border-top: 1px solid #333;
  font-size: 0.85rem;
  color: #888;
}

/* PrimeVue Dark Theme Overrides */
.dark-mode {
  --p-surface-0: #1a1a2e;
  --p-surface-50: #1e1e36;
  --p-surface-100: #252540;
  --p-surface-200: #333355;
  --p-surface-ground: #1a1a2e;
  --p-text-color: #eee;
  --p-text-muted-color: #aaa;
  --p-primary-color: #4fc3f7;
}

/* Card styling */
:deep(.p-card) {
  background: #252540;
  border: 1px solid #333;
  border-radius: 8px;
}

:deep(.p-card:hover) {
  border-color: #4fc3f7;
}

/* Slider styling */
:deep(.p-slider) {
  background: #333;
}

:deep(.p-slider .p-slider-range) {
  background: #4fc3f7;
}

:deep(.p-slider .p-slider-handle) {
  background: #4fc3f7;
  border-color: #4fc3f7;
}

/* Input styling */
:deep(.p-inputtext),
:deep(.p-inputnumber-input) {
  background: #1a1a2e;
  border-color: #444;
  color: #eee;
}

:deep(.p-inputtext:focus),
:deep(.p-inputnumber-input:focus) {
  border-color: #4fc3f7;
  box-shadow: 0 0 0 2px rgba(79, 195, 247, 0.2);
}

/* Panel styling */
:deep(.p-panel) {
  background: #252540;
  border: 1px solid #333;
  border-radius: 8px;
}

:deep(.p-panel-header) {
  background: #1e1e36;
  border-bottom: 1px solid #333;
  padding: 0.75rem 1rem;
}

:deep(.p-panel-content) {
  padding: 1rem;
}

/* Button styling */
:deep(.p-button.p-button-text) {
  color: #4fc3f7;
}

:deep(.p-button.p-button-text:hover) {
  background: rgba(79, 195, 247, 0.1);
}

/* Tag styling */
:deep(.p-tag) {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

/* Divider */
:deep(.p-divider) {
  border-color: #444;
}
</style>

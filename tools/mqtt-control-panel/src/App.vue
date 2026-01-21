<script setup>
import { ref, onMounted, computed } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import Dialog from 'primevue/dialog'
import GlobalSettings from './components/GlobalSettings.vue'
import DeviceCard from './components/DeviceCard.vue'
import InfluxDashboard from './components/InfluxDashboard.vue'
import SystemStatus from './components/SystemStatus.vue'
import BillingView from './components/BillingView.vue'
import ProvisioningView from './components/ProvisioningView.vue'
import TestingView from './components/TestingView.vue'
import SimulatorView from './components/SimulatorView.vue'
import MediationView from './components/MediationView.vue'
import { useMqtt } from './composables/useMqtt'

const showInfoDialog = ref(false)
const activeView = ref('devices') // 'devices' or 'dashboard'

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

// Dynamic hostname for display
const currentHostname = computed(() => {
  return typeof window !== 'undefined' ? window.location.hostname : 'localhost'
})

// Service URLs from environment variables
const serviceUrls = {
  grafana: import.meta.env.VITE_GRAFANA_URL || 'http://localhost:3000',
  grafanaDashboard: (import.meta.env.VITE_GRAFANA_URL || 'http://localhost:3000') + '/d/b730b349-e24f-4a53-a7c3-19012b906123/sim-portal-sensors?orgId=1',
  influxdb: import.meta.env.VITE_INFLUXDB_URL || 'http://localhost:8086',
  emqxDashboard: (import.meta.env.VITE_EMQX_DASHBOARD_URL || 'http://localhost:18083') + '/#/clients',
  portalApi: import.meta.env.VITE_PORTAL_API_URL || 'http://localhost:3001',
  mqttBroker: import.meta.env.VITE_MQTT_BROKER_URL || 'ws://localhost:8083/mqtt'
}

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
        <nav class="view-tabs">
          <button
            class="view-tab"
            :class="{ active: activeView === 'devices' }"
            @click="activeView = 'devices'"
          >
            <i class="pi pi-th-large"></i>
            <span>Devices</span>
          </button>
          <button
            class="view-tab"
            :class="{ active: activeView === 'dashboard' }"
            @click="activeView = 'dashboard'"
          >
            <i class="pi pi-chart-bar"></i>
            <span>Dashboard</span>
          </button>
          <button
            class="view-tab"
            :class="{ active: activeView === 'system' }"
            @click="activeView = 'system'"
          >
            <i class="pi pi-cog"></i>
            <span>System</span>
          </button>
          <button
            class="view-tab"
            :class="{ active: activeView === 'billing' }"
            @click="activeView = 'billing'"
          >
            <i class="pi pi-wallet"></i>
            <span>Billing</span>
          </button>
          <button
            class="view-tab"
            :class="{ active: activeView === 'provisioning' }"
            @click="activeView = 'provisioning'"
          >
            <i class="pi pi-mobile"></i>
            <span>Provisioning</span>
          </button>
          <button
            class="view-tab"
            :class="{ active: activeView === 'testing' }"
            @click="activeView = 'testing'"
          >
            <i class="pi pi-wrench"></i>
            <span>Testing</span>
          </button>
          <button
            class="view-tab"
            :class="{ active: activeView === 'simulator' }"
            @click="activeView = 'simulator'"
          >
            <i class="pi pi-bolt"></i>
            <span>Simulator</span>
          </button>
          <button
            class="view-tab"
            :class="{ active: activeView === 'mediation' }"
            @click="activeView = 'mediation'"
          >
            <i class="pi pi-send"></i>
            <span>Mediation</span>
          </button>
        </nav>
        <nav class="service-tabs">
          <button class="service-tab info-tab" @click="showInfoDialog = true" title="Architecture & Testing Info">
            <i class="pi pi-info-circle"></i>
            <span>Info</span>
          </button>
          <a :href="serviceUrls.grafanaDashboard" target="_blank" class="service-tab auto-login" title="SIM Portal Sensors Dashboard (no login required)">
            <i class="pi pi-chart-line"></i>
            <span>Grafana</span>
          </a>
          <a :href="serviceUrls.influxdb" target="_blank" class="service-tab" title="InfluxDB (admin/adminpassword)">
            <i class="pi pi-database"></i>
            <span>InfluxDB</span>
          </a>
          <a :href="serviceUrls.emqxDashboard" target="_blank" class="service-tab" title="EMQX Dashboard (admin/public)">
            <i class="pi pi-sitemap"></i>
            <span>EMQX</span>
          </a>
        </nav>
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
      <!-- Device Control View -->
      <template v-if="activeView === 'devices'">
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
      </template>

      <!-- InfluxDB Dashboard View -->
      <template v-else-if="activeView === 'dashboard'">
        <InfluxDashboard :devices="devices" />
      </template>

      <!-- System Status View -->
      <template v-else-if="activeView === 'system'">
        <SystemStatus />
      </template>

      <!-- Billing View -->
      <template v-else-if="activeView === 'billing'">
        <BillingView />
      </template>

      <!-- Provisioning View -->
      <template v-else-if="activeView === 'provisioning'">
        <ProvisioningView />
      </template>

      <!-- Testing View -->
      <template v-else-if="activeView === 'testing'">
        <TestingView />
      </template>

      <!-- Simulator View -->
      <template v-else-if="activeView === 'simulator'">
        <SimulatorView />
      </template>

      <!-- Mediation View -->
      <template v-else-if="activeView === 'mediation'">
        <MediationView />
      </template>
    </main>

    <!-- Footer -->
    <footer class="app-footer">
      <span>MQTT Control Panel v1.0</span>
      <span>Connected to: ws://{{ currentHostname }}:8083/mqtt</span>
    </footer>

    <!-- Info Dialog -->
    <Dialog
      v-model:visible="showInfoDialog"
      header="MQTT Ecosystem Architecture"
      :modal="true"
      :style="{ width: '800px', maxWidth: '95vw' }"
      :draggable="false"
    >
      <div class="info-content">
        <section class="info-section">
          <h3><i class="pi pi-sitemap"></i> Architecture Overview</h3>
          <pre class="architecture-diagram">
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MQTT IoT Ecosystem                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   SIM Portal     │         │   MQTT Control   │         │  Data Generator  │
│   (Vue App)      │         │     Panel        │         │   (Node.js)      │
│   Port 5173      │         │   Port 5174      │         │                  │
└────────┬─────────┘         └────────┬─────────┘         └────────┬─────────┘
         │                            │                            │
         │ WebSocket                  │ WebSocket                  │ TCP
         │ (8083)                     │ (8083)                     │ (1883)
         │                            │                            │
         └────────────────────────────┼────────────────────────────┘
                                      │
                          ┌───────────▼───────────┐
                          │      EMQX Broker      │
                          │    (MQTT + WebSocket) │
                          │      Port 18083       │
                          │    (Dashboard UI)     │
                          └───────────┬───────────┘
                                      │
                          ┌───────────▼───────────┐
                          │   Telegraf Agent      │
                          │  (MQTT → InfluxDB)    │
                          └───────────┬───────────┘
                                      │
                          ┌───────────▼───────────┐
                          │      InfluxDB         │
                          │  (Time Series DB)     │
                          │      Port 8086        │
                          └───────────┬───────────┘
                                      │
                          ┌───────────▼───────────┐
                          │       Grafana         │
                          │   (Visualization)     │
                          │      Port 3000        │
                          └───────────────────────┘
          </pre>
        </section>

        <section class="info-section">
          <h3><i class="pi pi-list"></i> MQTT Topics</h3>
          <div class="topic-list">
            <div class="topic-item">
              <code>simportal/devices/{id}/sensors</code>
              <span>Sensor data (temperature, humidity, light, battery)</span>
            </div>
            <div class="topic-item">
              <code>simportal/devices/{id}/location</code>
              <span>GPS location data (lat, lon, speed, heading)</span>
            </div>
            <div class="topic-item">
              <code>simportal/devices/{id}/commands</code>
              <span>Control commands (set values, pause, resume)</span>
            </div>
            <div class="topic-item">
              <code>simportal/devices/{id}/status</code>
              <span>Device status updates (paused, interval)</span>
            </div>
            <div class="topic-item">
              <code>simportal/config/interval</code>
              <span>Global configuration (location interval)</span>
            </div>
          </div>
        </section>

        <section class="info-section">
          <h3><i class="pi pi-bolt"></i> Data Generator</h3>
          <p class="section-intro">Node.js service that simulates 8 IoT devices publishing telemetry data.</p>

          <div class="generator-info">
            <div class="generator-card">
              <h4>Connection</h4>
              <code>mqtt://localhost:1883</code>
              <span>TCP connection to EMQX</span>
            </div>
            <div class="generator-card">
              <h4>Sensors</h4>
              <code>Every 10s (configurable)</code>
              <span>Temp, humidity, light, battery</span>
            </div>
            <div class="generator-card">
              <h4>Location</h4>
              <code>Every 5s (configurable)</code>
              <span>GPS for mobile devices only</span>
            </div>
          </div>

          <h4 class="subsection-title">Sensor Payload Example</h4>
          <pre class="payload-example">{
  "timestamp": "2025-12-14T10:30:00Z",
  "deviceId": "DEV001",
  "sensors": {
    "temperature": 22.5,
    "humidity": 55.2,
    "light": 850,
    "batteryLevel": 85
  },
  "metadata": { "signalStrength": 78 }
}</pre>

          <h4 class="subsection-title">Supported Commands</h4>
          <div class="commands-grid">
            <div class="command-item">
              <code>set_sensor</code>
              <span>Override sensor values</span>
            </div>
            <div class="command-item">
              <code>set_location</code>
              <span>Set GPS coordinates</span>
            </div>
            <div class="command-item">
              <code>set_sensor_interval</code>
              <span>Per-device sampling rate</span>
            </div>
            <div class="command-item">
              <code>pause / resume</code>
              <span>Stop/start device publishing</span>
            </div>
            <div class="command-item">
              <code>reset</code>
              <span>Reset to initial values</span>
            </div>
            <div class="command-item">
              <code>set_heading / set_speed</code>
              <span>Control mobile movement</span>
            </div>
          </div>

          <h4 class="subsection-title">Running the Generator</h4>
          <pre class="code-block">cd /MQTTServer/scripts/simportal-generator
npm install
node index.js</pre>
        </section>

        <section class="info-section">
          <h3><i class="pi pi-check-circle"></i> Testing Guide</h3>
          <ol class="test-steps">
            <li>
              <strong>Verify Data Flow</strong>
              <p>Watch the device cards update with live sensor data from the Data Generator</p>
            </li>
            <li>
              <strong>Test Bidirectional Control</strong>
              <p>Change sensor interval in SIM Portal → See it update here in Control Panel</p>
            </li>
            <li>
              <strong>Test Local Control</strong>
              <p>Adjust sliders and click send buttons to push values to the Data Generator</p>
            </li>
            <li>
              <strong>Check Grafana</strong>
              <p>Open Grafana to see historical data visualization and dashboards</p>
            </li>
            <li>
              <strong>Verify InfluxDB</strong>
              <p>Open InfluxDB to query raw time-series data and verify storage</p>
            </li>
            <li>
              <strong>Monitor EMQX</strong>
              <p>Open EMQX Dashboard to see connected clients, topics, and message rates</p>
            </li>
          </ol>
        </section>

        <section class="info-section">
          <h3><i class="pi pi-cog"></i> Services & Credentials</h3>
          <div class="services-grid">
            <div class="service-card">
              <h4><i class="pi pi-chart-line"></i> Grafana</h4>
              <Tag value="No Login Required" severity="success" class="auto-tag" />
              <p>Visualization and alerting platform</p>
              <code>{{ serviceUrls.grafana }}</code>
              <a :href="serviceUrls.grafanaDashboard" target="_blank" class="service-link auto">
                <i class="pi pi-external-link"></i> Open Sensors Dashboard
              </a>
            </div>
            <div class="service-card">
              <h4><i class="pi pi-database"></i> InfluxDB</h4>
              <p>Time-series database storing all telemetry</p>
              <div class="credentials">
                <span class="cred-label">Login:</span>
                <span class="cred-value">admin / adminpassword</span>
              </div>
              <div class="credentials">
                <span class="cred-label">Org:</span>
                <span class="cred-value">mqtt-org</span>
              </div>
              <div class="credentials">
                <span class="cred-label">Bucket:</span>
                <span class="cred-value">mqtt_messages</span>
              </div>
              <code>{{ serviceUrls.influxdb }}</code>
              <a :href="serviceUrls.influxdb" target="_blank" class="service-link">
                <i class="pi pi-external-link"></i> Open Data Explorer
              </a>
            </div>
            <div class="service-card">
              <h4><i class="pi pi-sitemap"></i> EMQX Broker</h4>
              <p>MQTT 5.0 broker handling all pub/sub messaging</p>
              <div class="credentials">
                <span class="cred-label">Login:</span>
                <span class="cred-value">admin / public</span>
              </div>
              <code>{{ serviceUrls.mqttBroker.replace('ws://', 'mqtt://').replace(':8083/mqtt', ':1883') }}</code>
              <code>{{ serviceUrls.mqttBroker }}</code>
              <a :href="serviceUrls.emqxDashboard" target="_blank" class="service-link">
                <i class="pi pi-external-link"></i> Open Dashboard
              </a>
            </div>
          </div>
        </section>
      </div>
    </Dialog>
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

.header-left {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.header-left h1 {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
}

.header-left h1 i {
  color: #4fc3f7;
}

.view-tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
  overflow-x: auto;
  max-width: 100%;
  scrollbar-width: thin;
}

.view-tab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #888;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.view-tab:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

.view-tab.active {
  background: linear-gradient(135deg, #4fc3f7 0%, #29b6f6 100%);
  color: #fff;
  box-shadow: 0 2px 8px rgba(79, 195, 247, 0.3);
}

.view-tab i {
  font-size: 0.9rem;
}

.service-tabs {
  display: flex;
  gap: 0.5rem;
}

.service-tab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  background: rgba(79, 195, 247, 0.1);
  border: 1px solid rgba(79, 195, 247, 0.3);
  border-radius: 6px;
  color: #4fc3f7;
  text-decoration: none;
  font-size: 0.8rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.service-tab:hover {
  background: rgba(79, 195, 247, 0.2);
  border-color: #4fc3f7;
  transform: translateY(-1px);
}

.service-tab i {
  font-size: 0.9rem;
}

.info-tab {
  background: rgba(168, 85, 247, 0.1);
  border-color: rgba(168, 85, 247, 0.3);
  color: #a855f7;
  cursor: pointer;
}

.info-tab:hover {
  background: rgba(168, 85, 247, 0.2);
  border-color: #a855f7;
}

/* Info Dialog Styles */
.info-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.info-section h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  color: #4fc3f7;
}

.architecture-diagram {
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 1rem;
  overflow-x: auto;
  font-size: 0.7rem;
  line-height: 1.3;
  color: #4fc3f7;
  margin: 0;
}

.topic-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.topic-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0.75rem;
  background: #1a1a2e;
  border-radius: 6px;
}

.topic-item code {
  background: rgba(79, 195, 247, 0.1);
  color: #4fc3f7;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  white-space: nowrap;
}

.topic-item span {
  color: #aaa;
  font-size: 0.8rem;
}

.test-steps {
  margin: 0;
  padding-left: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.test-steps li {
  color: #eee;
}

.test-steps strong {
  color: #4fc3f7;
}

.test-steps p {
  margin: 0.25rem 0 0 0;
  color: #aaa;
  font-size: 0.85rem;
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.service-card {
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 1rem;
}

.service-card h4 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.5rem 0;
  color: #4fc3f7;
  font-size: 0.9rem;
}

.service-card h4 i {
  font-size: 1rem;
}

.service-card p {
  margin: 0 0 0.5rem 0;
  color: #aaa;
  font-size: 0.8rem;
}

.service-card code {
  display: block;
  background: rgba(79, 195, 247, 0.1);
  color: #4fc3f7;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  margin-top: 0.25rem;
}

.credentials {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.35rem 0;
  font-size: 0.8rem;
}

.cred-label {
  color: #888;
}

.cred-value {
  color: #10b981;
  font-family: monospace;
  background: rgba(16, 185, 129, 0.1);
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
}

.service-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.75rem;
  padding: 0.4rem 0.75rem;
  background: rgba(79, 195, 247, 0.15);
  border: 1px solid rgba(79, 195, 247, 0.4);
  border-radius: 6px;
  color: #4fc3f7;
  text-decoration: none;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.service-link:hover {
  background: rgba(79, 195, 247, 0.25);
  border-color: #4fc3f7;
  transform: translateY(-1px);
}

.service-link.auto {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.4);
  color: #10b981;
}

.service-link.auto:hover {
  background: rgba(16, 185, 129, 0.25);
  border-color: #10b981;
}

.auto-tag {
  margin-bottom: 0.5rem;
}

/* Data Generator Section */
.section-intro {
  color: #aaa;
  font-size: 0.85rem;
  margin: 0 0 1rem 0;
}

.generator-info {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.generator-card {
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 0.75rem;
  text-align: center;
}

.generator-card h4 {
  margin: 0 0 0.5rem 0;
  color: #4fc3f7;
  font-size: 0.8rem;
}

.generator-card code {
  display: block;
  background: rgba(79, 195, 247, 0.1);
  color: #4fc3f7;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  margin-bottom: 0.35rem;
}

.generator-card span {
  color: #888;
  font-size: 0.7rem;
}

.subsection-title {
  color: #888;
  font-size: 0.8rem;
  margin: 1rem 0 0.5rem 0;
  font-weight: 500;
}

.payload-example {
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 0.75rem;
  font-size: 0.7rem;
  color: #10b981;
  overflow-x: auto;
  margin: 0;
}

.commands-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.command-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  background: #1a1a2e;
  border-radius: 4px;
}

.command-item code {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  font-size: 0.7rem;
  white-space: nowrap;
}

.command-item span {
  color: #888;
  font-size: 0.7rem;
}

.code-block {
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 0.75rem;
  font-size: 0.75rem;
  color: #f59e0b;
  margin: 0;
  overflow-x: auto;
}

.service-tab.auto-login {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.4);
  color: #10b981;
}

.service-tab.auto-login:hover {
  background: rgba(16, 185, 129, 0.25);
  border-color: #10b981;
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
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
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

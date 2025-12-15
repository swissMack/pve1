<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
import Divider from 'primevue/divider'

const API_BASE = 'http://localhost:3003/api'

// State
const generatorStatus = ref('unknown')
const generatorLogs = ref([])
const emqxStats = ref(null)
const mqttMessages = ref([])
const mqttMsgStats = ref({ total: 0, perMinute: 0 })
const servicesStatus = ref({})
const loading = ref({
  generator: false,
  start: false,
  stop: false,
  restart: false
})
const error = ref(null)

let pollInterval = null

// Fetch generator status
async function fetchGeneratorStatus() {
  try {
    const res = await fetch(`${API_BASE}/generator/status`)
    if (res.ok) {
      const data = await res.json()
      generatorStatus.value = data.status
      generatorLogs.value = data.logs || []
    }
  } catch (err) {
    console.error('Failed to fetch generator status:', err)
  }
}

// Fetch EMQX stats
async function fetchEmqxStats() {
  try {
    const res = await fetch(`${API_BASE}/emqx/stats`)
    if (res.ok) {
      const data = await res.json()
      // EMQX returns array of node stats, get first node
      emqxStats.value = Array.isArray(data) ? data[0] : data
    }
  } catch (err) {
    console.error('Failed to fetch EMQX stats:', err)
  }
}

// Fetch all services status
async function fetchServicesStatus() {
  try {
    const res = await fetch(`${API_BASE}/services/status`)
    if (res.ok) {
      servicesStatus.value = await res.json()
    }
  } catch (err) {
    console.error('Failed to fetch services status:', err)
  }
}

// Fetch MQTT message flow
async function fetchMqttMessages() {
  try {
    const res = await fetch(`${API_BASE}/mqtt/messages`)
    if (res.ok) {
      const data = await res.json()
      mqttMessages.value = data.messages || []
      mqttMsgStats.value = data.stats || { total: 0, perMinute: 0 }
    }
  } catch (err) {
    console.error('Failed to fetch MQTT messages:', err)
  }
}

// Control generator
async function controlGenerator(action) {
  loading.value[action] = true
  error.value = null
  try {
    const res = await fetch(`${API_BASE}/generator/${action}`, {
      method: 'POST'
    })
    const data = await res.json()
    if (res.ok) {
      generatorStatus.value = data.status
      await fetchGeneratorStatus()
    } else {
      error.value = data.error
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value[action] = false
  }
}

// Refresh all data
async function refreshAll() {
  loading.value.generator = true
  await Promise.all([
    fetchGeneratorStatus(),
    fetchEmqxStats(),
    fetchServicesStatus(),
    fetchMqttMessages()
  ])
  loading.value.generator = false
}

// Status tag severity
function getStatusSeverity(status) {
  switch (status) {
    case 'running': return 'success'
    case 'exited':
    case 'stopped': return 'danger'
    case 'restarting': return 'warn'
    default: return 'secondary'
  }
}

// Format number with K/M suffix
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num?.toString() || '0'
}

onMounted(() => {
  refreshAll()
  // Poll every 5 seconds
  pollInterval = setInterval(refreshAll, 5000)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})
</script>

<template>
  <div class="system-status">
    <div class="status-row">
      <!-- Data Generator Control -->
      <Card class="control-card">
        <template #header>
          <div class="card-header">
            <div class="header-title">
              <i class="pi pi-cog"></i>
              <span>Data Generator</span>
            </div>
            <Tag :value="generatorStatus" :severity="getStatusSeverity(generatorStatus)" />
          </div>
        </template>

        <template #content>
          <div class="control-buttons">
            <Button
              label="Start"
              icon="pi pi-play"
              severity="success"
              size="small"
              :loading="loading.start"
              :disabled="generatorStatus === 'running'"
              @click="controlGenerator('start')"
            />
            <Button
              label="Stop"
              icon="pi pi-stop"
              severity="danger"
              size="small"
              :loading="loading.stop"
              :disabled="generatorStatus !== 'running'"
              @click="controlGenerator('stop')"
            />
            <Button
              label="Restart"
              icon="pi pi-refresh"
              severity="warn"
              size="small"
              :loading="loading.restart"
              @click="controlGenerator('restart')"
            />
          </div>

          <div v-if="error" class="error-message">
            <i class="pi pi-exclamation-triangle"></i>
            {{ error }}
          </div>

          <!-- Recent Logs -->
          <div class="logs-section" v-if="generatorLogs.length">
            <div class="logs-header">Recent Logs</div>
            <div class="logs-content">
              <div v-for="(log, i) in generatorLogs" :key="i" class="log-line">
                {{ log }}
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- EMQX Broker Status -->
      <Card class="status-card">
        <template #header>
          <div class="card-header">
            <div class="header-title">
              <i class="pi pi-server"></i>
              <span>MQTT Broker</span>
            </div>
            <Tag :value="servicesStatus['mqtt-emqx'] || 'unknown'" :severity="getStatusSeverity(servicesStatus['mqtt-emqx'])" />
          </div>
        </template>

        <template #content>
          <div v-if="emqxStats" class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{{ formatNumber(emqxStats['connections.count'] || 0) }}</div>
              <div class="stat-label">Connections</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ formatNumber(emqxStats['subscriptions.count'] || 0) }}</div>
              <div class="stat-label">Subscriptions</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ formatNumber(emqxStats['topics.count'] || 0) }}</div>
              <div class="stat-label">Topics</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ formatNumber(emqxStats['sessions.count'] || 0) }}</div>
              <div class="stat-label">Sessions</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ formatNumber(emqxStats['retained.count'] || 0) }}</div>
              <div class="stat-label">Retained</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ formatNumber(emqxStats['subscribers.count'] || 0) }}</div>
              <div class="stat-label">Subscribers</div>
            </div>
          </div>
          <div v-else class="loading-stats">
            <ProgressSpinner style="width: 24px; height: 24px" />
            <span>Loading...</span>
          </div>
        </template>
      </Card>

      <!-- All Services Status -->
      <Card class="services-card">
        <template #header>
          <div class="card-header">
            <div class="header-title">
              <i class="pi pi-th-large"></i>
              <span>Services</span>
            </div>
            <Button
              icon="pi pi-refresh"
              size="small"
              text
              :loading="loading.generator"
              @click="refreshAll"
            />
          </div>
        </template>

        <template #content>
          <div class="services-list">
            <div v-for="(status, name) in servicesStatus" :key="name" class="service-item">
              <span class="service-name">{{ name.replace('mqtt-', '') }}</span>
              <Tag :value="status" :severity="getStatusSeverity(status)" />
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Message Flow Section -->
    <Card class="message-flow-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <i class="pi pi-bolt"></i>
            <span>MQTT Message Flow</span>
          </div>
          <div class="msg-stats">
            <Tag :value="`${mqttMsgStats.perMinute}/min`" severity="info" />
            <Tag :value="`${formatNumber(mqttMsgStats.total)} total`" severity="secondary" />
          </div>
        </div>
      </template>

      <template #content>
        <div class="message-flow-content">
          <div v-if="mqttMessages.length" class="message-list">
            <div v-for="(msg, i) in mqttMessages" :key="i" class="message-item" :class="msg.type">
              <span class="msg-time">{{ msg.time }}</span>
              <span class="msg-topic">{{ msg.topic }}</span>
              <span class="msg-content">{{ msg.message }}</span>
            </div>
          </div>
          <div v-else class="no-messages">
            <i class="pi pi-inbox"></i>
            <span>Waiting for messages...</span>
          </div>
        </div>
        <div class="message-legend">
          <span class="legend-item sensor"><i class="pi pi-circle-fill"></i> Sensor</span>
          <span class="legend-item location"><i class="pi pi-circle-fill"></i> Location</span>
          <span class="legend-item command"><i class="pi pi-circle-fill"></i> Command</span>
          <span class="legend-item status"><i class="pi pi-circle-fill"></i> Status</span>
          <span class="legend-item config"><i class="pi pi-circle-fill"></i> Config</span>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.system-status {
  width: 100%;
}

.status-row {
  display: grid;
  grid-template-columns: 1fr 1fr 250px;
  gap: 1rem;
  align-items: start;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0.6rem;
  background: #2a2a3e;
  border-bottom: 1px solid #3a3a50;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  font-size: 0.85rem;
  color: #fff;
}

.header-title i {
  font-size: 0.9rem;
}

.control-buttons {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 4px;
  color: #ef4444;
  font-size: 0.75rem;
  margin-bottom: 0.5rem;
}

.logs-section {
  margin-top: 0.5rem;
}

.logs-header {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  margin-bottom: 0.25rem;
}

.logs-content {
  background: #1a1a2e;
  border-radius: 4px;
  padding: 0.4rem;
  height: 100px;
  overflow-y: auto;
  overflow-x: hidden;
  font-family: monospace;
  font-size: 0.65rem;
  line-height: 1.4;
}

.log-line {
  color: #a0a0a0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.stat-item {
  text-align: center;
  padding: 0.4rem;
  background: #1a1a2e;
  border-radius: 4px;
}

.stat-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.stat-label {
  font-size: 0.65rem;
  color: var(--p-text-muted-color);
  margin-top: 0.1rem;
}

.loading-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.75rem;
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

.services-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.service-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0.4rem;
  background: #1a1a2e;
  border-radius: 4px;
}

.service-name {
  font-size: 0.75rem;
  text-transform: capitalize;
}

:deep(.p-card-body) {
  padding: 0.6rem;
}

:deep(.p-tag) {
  font-size: 0.65rem;
  padding: 0.15rem 0.35rem;
}

:deep(.p-button.p-button-sm) {
  padding: 0.35rem 0.6rem;
  font-size: 0.75rem;
}

@media (max-width: 1200px) {
  .status-row {
    grid-template-columns: 1fr 1fr;
  }
  .services-card {
    grid-column: span 2;
  }
}

@media (max-width: 768px) {
  .status-row {
    grid-template-columns: 1fr;
  }
  .services-card {
    grid-column: span 1;
  }
}

/* Message Flow Styles */
.message-flow-card {
  margin-top: 1rem;
}

.msg-stats {
  display: flex;
  gap: 0.4rem;
}

.message-flow-content {
  height: 150px;
  overflow-y: auto;
  overflow-x: hidden;
  background: #1a1a2e;
  border-radius: 4px;
  padding: 0.4rem;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.message-item {
  display: grid;
  grid-template-columns: 70px 140px 1fr;
  gap: 0.5rem;
  padding: 0.25rem 0.4rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.7rem;
  align-items: center;
}

.message-item:hover {
  background: rgba(79, 195, 247, 0.1);
}

.msg-time {
  color: #888;
}

.msg-topic {
  color: #4fc3f7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.msg-content {
  color: #10b981;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Message type colors */
.message-item.sensor .msg-content {
  color: #10b981;
}

.message-item.location .msg-content {
  color: #3b82f6;
}

.message-item.connect {
  background: rgba(16, 185, 129, 0.15);
}
.message-item.connect .msg-content {
  color: #10b981;
}

.message-item.disconnect {
  background: rgba(239, 68, 68, 0.15);
}
.message-item.disconnect .msg-content {
  color: #ef4444;
}

.message-item.subscribe {
  background: rgba(168, 85, 247, 0.15);
}
.message-item.subscribe .msg-content {
  color: #a855f7;
}

.message-item.unsubscribe {
  background: rgba(245, 158, 11, 0.15);
}
.message-item.unsubscribe .msg-content {
  color: #f59e0b;
}

.message-item.command {
  background: rgba(79, 195, 247, 0.15);
}
.message-item.command .msg-content {
  color: #4fc3f7;
}

.message-item.status {
  background: rgba(245, 158, 11, 0.15);
}
.message-item.status .msg-content {
  color: #f59e0b;
}

.message-item.config {
  background: rgba(168, 85, 247, 0.15);
}
.message-item.config .msg-content {
  color: #a855f7;
}

.no-messages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  gap: 0.5rem;
}

.no-messages i {
  font-size: 1.5rem;
}

/* Message Legend */
.message-legend {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #333;
  justify-content: center;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.65rem;
  color: #888;
}

.legend-item i {
  font-size: 0.5rem;
}

.legend-item.sensor i { color: #10b981; }
.legend-item.location i { color: #3b82f6; }
.legend-item.command i { color: #4fc3f7; }
.legend-item.status i { color: #f59e0b; }
.legend-item.config i { color: #a855f7; }
</style>

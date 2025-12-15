<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { Line, Doughnut, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { useInfluxDB } from '../composables/useInfluxDB'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const props = defineProps({
  devices: {
    type: Object,
    required: true
  }
})

const {
  loading,
  error,
  deviceStats,
  timeSeriesData,
  latestReadings,
  startAutoRefresh,
  stopAutoRefresh,
  refreshAllData
} = useInfluxDB()

const selectedTimeRange = ref('-30m')
const isRefreshing = ref(false)

// Chart configurations
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 750,
    easing: 'easeInOutQuart'
  },
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: 'rgba(22, 33, 62, 0.95)',
      titleColor: '#4fc3f7',
      bodyColor: '#fff',
      borderColor: '#4fc3f7',
      borderWidth: 1,
      cornerRadius: 8,
      padding: 12
    }
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(255, 255, 255, 0.05)',
        drawBorder: false
      },
      ticks: {
        color: '#888',
        maxRotation: 0,
        maxTicksLimit: 8
      }
    },
    y: {
      grid: {
        color: 'rgba(255, 255, 255, 0.05)',
        drawBorder: false
      },
      ticks: {
        color: '#888'
      }
    }
  },
  interaction: {
    intersect: false,
    mode: 'index'
  }
}

// Temperature chart data
const temperatureChartData = computed(() => ({
  labels: timeSeriesData.labels,
  datasets: [{
    label: 'Temperature',
    data: timeSeriesData.datasets.temperature || [],
    borderColor: '#f97316',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    fill: true,
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 6,
    pointHoverBackgroundColor: '#f97316',
    pointHoverBorderColor: '#fff',
    pointHoverBorderWidth: 2
  }]
}))

// Humidity chart data
const humidityChartData = computed(() => ({
  labels: timeSeriesData.labels,
  datasets: [{
    label: 'Humidity',
    data: timeSeriesData.datasets.humidity || [],
    borderColor: '#06b6d4',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    fill: true,
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 6,
    pointHoverBackgroundColor: '#06b6d4',
    pointHoverBorderColor: '#fff',
    pointHoverBorderWidth: 2
  }]
}))

// Battery chart data
const batteryChartData = computed(() => ({
  labels: timeSeriesData.labels,
  datasets: [{
    label: 'Battery',
    data: timeSeriesData.datasets.battery || [],
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    fill: true,
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 6,
    pointHoverBackgroundColor: '#10b981',
    pointHoverBorderColor: '#fff',
    pointHoverBorderWidth: 2
  }]
}))

// Light chart data
const lightChartData = computed(() => ({
  labels: timeSeriesData.labels,
  datasets: [{
    label: 'Light',
    data: timeSeriesData.datasets.light || [],
    borderColor: '#eab308',
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    fill: true,
    tension: 0.4,
    pointRadius: 0,
    pointHoverRadius: 6,
    pointHoverBackgroundColor: '#eab308',
    pointHoverBorderColor: '#fff',
    pointHoverBorderWidth: 2
  }]
}))

// Device health doughnut chart
const deviceHealthData = computed(() => {
  const deviceValues = Object.values(props.devices)
  const healthy = deviceValues.filter(d => d.sensors?.batteryLevel > 20).length
  const warning = deviceValues.filter(d => d.sensors?.batteryLevel <= 20 && d.sensors?.batteryLevel > 10).length
  const critical = deviceValues.filter(d => d.sensors?.batteryLevel <= 10).length

  return {
    labels: ['Healthy', 'Warning', 'Critical'],
    datasets: [{
      data: [healthy, warning, critical],
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
      borderColor: ['#059669', '#d97706', '#dc2626'],
      borderWidth: 2,
      hoverOffset: 8
    }]
  }
})

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '70%',
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: 'rgba(22, 33, 62, 0.95)',
      titleColor: '#4fc3f7',
      bodyColor: '#fff',
      borderColor: '#4fc3f7',
      borderWidth: 1,
      cornerRadius: 8,
      padding: 12
    }
  }
}

// Computed device metrics
const deviceMetrics = computed(() => {
  const deviceValues = Object.values(props.devices)
  const activeDevices = deviceValues.filter(d => d.lastSeen).length

  const temps = deviceValues.map(d => d.sensors?.temperature).filter(v => v != null)
  const humidities = deviceValues.map(d => d.sensors?.humidity).filter(v => v != null)
  const batteries = deviceValues.map(d => d.sensors?.batteryLevel).filter(v => v != null)
  const signals = deviceValues.map(d => d.metadata?.signalStrength).filter(v => v != null)

  return {
    activeDevices,
    totalDevices: deviceValues.length,
    avgTemp: temps.length ? (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : '—',
    avgHumidity: humidities.length ? (humidities.reduce((a, b) => a + b, 0) / humidities.length).toFixed(1) : '—',
    avgBattery: batteries.length ? (batteries.reduce((a, b) => a + b, 0) / batteries.length).toFixed(0) : '—',
    avgSignal: signals.length ? (signals.reduce((a, b) => a + b, 0) / signals.length).toFixed(0) : '—',
    minBattery: batteries.length ? Math.min(...batteries).toFixed(0) : '—',
    maxTemp: temps.length ? Math.max(...temps).toFixed(1) : '—'
  }
})

// Per-device metrics for the grid
const deviceReadings = computed(() => {
  return Object.values(props.devices).map(device => ({
    id: device.id,
    temperature: device.sensors?.temperature?.toFixed(1) ?? '—',
    humidity: device.sensors?.humidity?.toFixed(1) ?? '—',
    battery: device.sensors?.batteryLevel?.toFixed(0) ?? '—',
    signal: device.metadata?.signalStrength?.toFixed(0) ?? '—',
    status: device.paused ? 'paused' : (device.lastSeen ? 'active' : 'inactive'),
    batteryClass: getBatteryClass(device.sensors?.batteryLevel)
  }))
})

function getBatteryClass(level) {
  if (level == null) return 'unknown'
  if (level > 50) return 'good'
  if (level > 20) return 'warning'
  return 'critical'
}

async function handleRefresh() {
  isRefreshing.value = true
  await refreshAllData()
  setTimeout(() => {
    isRefreshing.value = false
  }, 500)
}

onMounted(() => {
  startAutoRefresh(10000)
})
</script>

<template>
  <div class="dashboard-container">
    <!-- Header Stats -->
    <div class="stats-grid">
      <div class="stat-card stat-primary">
        <div class="stat-icon">
          <i class="pi pi-microchip"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ deviceMetrics.activeDevices }}</span>
          <span class="stat-label">Active Devices</span>
        </div>
        <div class="stat-indicator">
          <span class="indicator-dot active"></span>
          <span>of {{ deviceMetrics.totalDevices }}</span>
        </div>
      </div>

      <div class="stat-card stat-orange">
        <div class="stat-icon">
          <i class="pi pi-sun"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ deviceMetrics.avgTemp }}<span class="stat-unit">°C</span></span>
          <span class="stat-label">Avg Temperature</span>
        </div>
        <div class="stat-indicator">
          <i class="pi pi-arrow-up"></i>
          <span>max {{ deviceMetrics.maxTemp }}°C</span>
        </div>
      </div>

      <div class="stat-card stat-cyan">
        <div class="stat-icon">
          <i class="pi pi-cloud"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ deviceMetrics.avgHumidity }}<span class="stat-unit">%</span></span>
          <span class="stat-label">Avg Humidity</span>
        </div>
        <div class="stat-indicator">
          <i class="pi pi-chart-line"></i>
          <span>real-time</span>
        </div>
      </div>

      <div class="stat-card stat-green">
        <div class="stat-icon">
          <i class="pi pi-bolt"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ deviceMetrics.avgBattery }}<span class="stat-unit">%</span></span>
          <span class="stat-label">Avg Battery</span>
        </div>
        <div class="stat-indicator">
          <i class="pi pi-arrow-down"></i>
          <span>min {{ deviceMetrics.minBattery }}%</span>
        </div>
      </div>

      <div class="stat-card stat-purple">
        <div class="stat-icon">
          <i class="pi pi-wifi"></i>
        </div>
        <div class="stat-content">
          <span class="stat-value">{{ deviceMetrics.avgSignal }}<span class="stat-unit">dBm</span></span>
          <span class="stat-label">Avg Signal</span>
        </div>
        <div class="stat-indicator">
          <i class="pi pi-signal"></i>
          <span>strength</span>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div class="charts-section">
      <div class="section-header">
        <h2><i class="pi pi-chart-line"></i> Real-time Sensor Telemetry</h2>
        <div class="header-actions">
          <select v-model="selectedTimeRange" class="time-select">
            <option value="-15m">Last 15 min</option>
            <option value="-30m">Last 30 min</option>
            <option value="-1h">Last 1 hour</option>
            <option value="-6h">Last 6 hours</option>
          </select>
          <button class="refresh-btn" @click="handleRefresh" :class="{ refreshing: isRefreshing }">
            <i class="pi pi-refresh" :class="{ 'pi-spin': isRefreshing }"></i>
          </button>
        </div>
      </div>

      <div class="charts-grid">
        <!-- Temperature Chart -->
        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title">
              <span class="chart-icon temp-icon"><i class="pi pi-sun"></i></span>
              <span>Temperature</span>
            </div>
            <span class="chart-value temp-value">{{ deviceMetrics.avgTemp }}°C</span>
          </div>
          <div class="chart-wrapper">
            <Line :data="temperatureChartData" :options="chartOptions" />
          </div>
        </div>

        <!-- Humidity Chart -->
        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title">
              <span class="chart-icon humidity-icon"><i class="pi pi-cloud"></i></span>
              <span>Humidity</span>
            </div>
            <span class="chart-value humidity-value">{{ deviceMetrics.avgHumidity }}%</span>
          </div>
          <div class="chart-wrapper">
            <Line :data="humidityChartData" :options="chartOptions" />
          </div>
        </div>

        <!-- Battery Chart -->
        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title">
              <span class="chart-icon battery-icon"><i class="pi pi-bolt"></i></span>
              <span>Battery Level</span>
            </div>
            <span class="chart-value battery-value">{{ deviceMetrics.avgBattery }}%</span>
          </div>
          <div class="chart-wrapper">
            <Line :data="batteryChartData" :options="chartOptions" />
          </div>
        </div>

        <!-- Light Chart -->
        <div class="chart-card">
          <div class="chart-header">
            <div class="chart-title">
              <span class="chart-icon light-icon"><i class="pi pi-sun"></i></span>
              <span>Ambient Light</span>
            </div>
            <span class="chart-value light-value">—</span>
          </div>
          <div class="chart-wrapper">
            <Line :data="lightChartData" :options="chartOptions" />
          </div>
        </div>
      </div>
    </div>

    <!-- Device Grid & Health -->
    <div class="bottom-section">
      <!-- Device Health Ring -->
      <div class="health-card">
        <h3><i class="pi pi-heart"></i> Fleet Health</h3>
        <div class="health-chart-wrapper">
          <Doughnut :data="deviceHealthData" :options="doughnutOptions" />
          <div class="health-center">
            <span class="health-percent">{{ Math.round((deviceMetrics.activeDevices / deviceMetrics.totalDevices) * 100) }}%</span>
            <span class="health-label">Online</span>
          </div>
        </div>
        <div class="health-legend">
          <div class="legend-item">
            <span class="legend-dot good"></span>
            <span>Healthy (&gt;20%)</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot warning"></span>
            <span>Warning (10-20%)</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot critical"></span>
            <span>Critical (&lt;10%)</span>
          </div>
        </div>
      </div>

      <!-- Device Table -->
      <div class="devices-table-card">
        <h3><i class="pi pi-list"></i> Device Telemetry Grid</h3>
        <div class="devices-table-wrapper">
          <table class="devices-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Status</th>
                <th><i class="pi pi-sun"></i> Temp</th>
                <th><i class="pi pi-cloud"></i> Humid</th>
                <th><i class="pi pi-bolt"></i> Battery</th>
                <th><i class="pi pi-wifi"></i> Signal</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="device in deviceReadings" :key="device.id" :class="device.status">
                <td class="device-id">{{ device.id }}</td>
                <td>
                  <span class="status-badge" :class="device.status">
                    {{ device.status }}
                  </span>
                </td>
                <td class="temp-cell">{{ device.temperature }}°C</td>
                <td class="humidity-cell">{{ device.humidity }}%</td>
                <td>
                  <div class="battery-cell" :class="device.batteryClass">
                    <div class="battery-bar">
                      <div class="battery-fill" :style="{ width: `${device.battery}%` }"></div>
                    </div>
                    <span>{{ device.battery }}%</span>
                  </div>
                </td>
                <td class="signal-cell">{{ device.signal }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner">
        <i class="pi pi-spin pi-spinner"></i>
        <span>Loading telemetry...</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-container {
  position: relative;
  padding: 1rem 0;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: linear-gradient(135deg, #1e1e36 0%, #252540 100%);
  border: 1px solid #333;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--stat-color), transparent);
}

.stat-primary { --stat-color: #4fc3f7; }
.stat-orange { --stat-color: #f97316; }
.stat-cyan { --stat-color: #06b6d4; }
.stat-green { --stat-color: #10b981; }
.stat-purple { --stat-color: #a855f7; }

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(79, 195, 247, 0.1);
  color: var(--stat-color);
  font-size: 1.2rem;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.stat-unit {
  font-size: 0.9rem;
  font-weight: 400;
  color: #888;
  margin-left: 2px;
}

.stat-label {
  font-size: 0.8rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-indicator {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: #666;
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #333;
}

.indicator-dot.active {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Charts Section */
.charts-section {
  margin-bottom: 1.5rem;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.section-header h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.section-header h2 i {
  color: #4fc3f7;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.time-select {
  background: #1e1e36;
  border: 1px solid #333;
  border-radius: 6px;
  color: #fff;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  cursor: pointer;
  outline: none;
}

.time-select:focus {
  border-color: #4fc3f7;
}

.refresh-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(79, 195, 247, 0.1);
  border: 1px solid rgba(79, 195, 247, 0.3);
  color: #4fc3f7;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.refresh-btn:hover {
  background: rgba(79, 195, 247, 0.2);
  border-color: #4fc3f7;
}

.refresh-btn.refreshing {
  background: rgba(79, 195, 247, 0.2);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.chart-card {
  background: linear-gradient(135deg, #1e1e36 0%, #252540 100%);
  border: 1px solid #333;
  border-radius: 12px;
  padding: 1rem;
  transition: all 0.3s ease;
}

.chart-card:hover {
  border-color: #444;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.chart-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: #fff;
  font-weight: 500;
}

.chart-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
}

.temp-icon { background: rgba(249, 115, 22, 0.15); color: #f97316; }
.humidity-icon { background: rgba(6, 182, 212, 0.15); color: #06b6d4; }
.battery-icon { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.light-icon { background: rgba(234, 179, 8, 0.15); color: #eab308; }

.chart-value {
  font-size: 1.25rem;
  font-weight: 700;
}

.temp-value { color: #f97316; }
.humidity-value { color: #06b6d4; }
.battery-value { color: #10b981; }
.light-value { color: #eab308; }

.chart-wrapper {
  height: 180px;
}

/* Bottom Section */
.bottom-section {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1rem;
}

.health-card {
  background: linear-gradient(135deg, #1e1e36 0%, #252540 100%);
  border: 1px solid #333;
  border-radius: 12px;
  padding: 1.25rem;
}

.health-card h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  margin: 0 0 1rem 0;
}

.health-card h3 i {
  color: #ef4444;
}

.health-chart-wrapper {
  position: relative;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.health-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.health-percent {
  display: block;
  font-size: 2rem;
  font-weight: 700;
  color: #10b981;
  line-height: 1;
}

.health-label {
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.health-legend {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #888;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-dot.good { background: #10b981; }
.legend-dot.warning { background: #f59e0b; }
.legend-dot.critical { background: #ef4444; }

/* Devices Table */
.devices-table-card {
  background: linear-gradient(135deg, #1e1e36 0%, #252540 100%);
  border: 1px solid #333;
  border-radius: 12px;
  padding: 1.25rem;
  overflow: hidden;
}

.devices-table-card h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  margin: 0 0 1rem 0;
}

.devices-table-card h3 i {
  color: #4fc3f7;
}

.devices-table-wrapper {
  overflow-x: auto;
}

.devices-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.devices-table th {
  text-align: left;
  padding: 0.75rem;
  color: #888;
  font-weight: 500;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #333;
  white-space: nowrap;
}

.devices-table th i {
  margin-right: 0.25rem;
}

.devices-table td {
  padding: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: #ddd;
}

.devices-table tr:last-child td {
  border-bottom: none;
}

.devices-table tr:hover {
  background: rgba(79, 195, 247, 0.05);
}

.devices-table tr.paused {
  opacity: 0.5;
}

.device-id {
  font-weight: 600;
  color: #4fc3f7;
  font-family: monospace;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.active {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.status-badge.paused {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.status-badge.inactive {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.temp-cell { color: #f97316; }
.humidity-cell { color: #06b6d4; }
.signal-cell { color: #a855f7; }

.battery-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.battery-bar {
  width: 50px;
  height: 8px;
  background: #333;
  border-radius: 4px;
  overflow: hidden;
}

.battery-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.battery-cell.good .battery-fill { background: #10b981; }
.battery-cell.warning .battery-fill { background: #f59e0b; }
.battery-cell.critical .battery-fill { background: #ef4444; }

/* Loading Overlay */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(26, 26, 46, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  backdrop-filter: blur(4px);
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  color: #4fc3f7;
}

.loading-spinner i {
  font-size: 2rem;
}

.loading-spinner span {
  font-size: 0.85rem;
  color: #888;
}

/* Responsive */
@media (max-width: 1400px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 1100px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }

  .bottom-section {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>

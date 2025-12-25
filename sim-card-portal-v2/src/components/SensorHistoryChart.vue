<template>
  <div class="sensor-history-chart">
    <!-- Time Range Selector -->
    <div class="chart-controls">
      <Select
        v-model="selectedTimeRange"
        :options="timeRangeOptions"
        optionLabel="label"
        optionValue="value"
        @change="loadSensorData"
        placeholder="Select time range"
        class="time-range-select"
      />
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="loading-state">
      <i class="pi pi-spin pi-spinner"></i>
      <span>Loading sensor history...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="loadingError" class="error-state">
      <i class="pi pi-exclamation-triangle"></i>
      <span>{{ loadingError }}</span>
    </div>

    <!-- No Data State -->
    <div v-else-if="!hasData" class="no-data-state">
      <i class="pi pi-info-circle"></i>
      <span>No historical data available for selected time range</span>
    </div>

    <!-- Chart Display using PrimeVue Chart -->
    <div v-else class="chart-container">
      <Chart type="line" :data="chartData" :options="chartOptions" />
    </div>

    <!-- Data Summary -->
    <div v-if="hasData && statistics" class="chart-statistics">
      <div class="stat-item">
        <span class="stat-label">Min:</span>
        <span class="stat-value">{{ formatValue(statistics.min) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Max:</span>
        <span class="stat-value">{{ formatValue(statistics.max) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Avg:</span>
        <span class="stat-value">{{ formatValue(statistics.avg) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Points:</span>
        <span class="stat-value">{{ statistics.count }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import Chart from 'primevue/chart'
import Select from 'primevue/select'

// Props
const props = defineProps<{
  deviceId: string
  sensorType: 'temperature' | 'humidity' | 'light'
  sensorUnit: string
  currentValue: number | null | undefined
}>()

// Interface for sensor history
interface SensorHistoryPoint {
  id: string
  deviceId: string
  temperature: number | null
  humidity: number | null
  light: number | null
  recordedAt: string
  batteryLevel?: number | null
  signalStrength?: number | null
}

// Time range options
const timeRangeOptions = [
  { label: 'Last 1 Minute', value: '1' },
  { label: 'Last 1 Hour', value: '60' },
  { label: 'Last 24 Hours', value: '1440' },
  { label: 'Last 7 Days', value: '10080' },
  { label: 'Last 30 Days', value: '43200' },
  { label: 'Last 1 Year', value: '525600' },
  { label: 'Last 5 Years', value: '2628000' }
]

// Reactive state
const sensorHistory = ref<SensorHistoryPoint[]>([])
const isLoading = ref(true)
const loadingError = ref('')
const selectedTimeRange = ref('10080') // Default: Last 7 days (in minutes)

// Computed properties
const hasData = computed(() => {
  return sensorHistory.value.length > 0 && sensorHistory.value.some(point => {
    const value = point[props.sensorType]
    return value !== null && value !== undefined
  })
})

const statistics = computed(() => {
  if (!hasData.value) return null

  const values = sensorHistory.value
    .map(point => point[props.sensorType])
    .filter(val => val !== null && val !== undefined) as number[]

  if (values.length === 0) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const sum = values.reduce((acc, val) => acc + val, 0)
  const avg = sum / values.length

  return {
    min,
    max,
    avg,
    count: values.length
  }
})

// Chart data configuration
const chartData = computed(() => {
  if (!hasData.value) {
    return {
      labels: [],
      datasets: []
    }
  }

  const labels = sensorHistory.value.map(point => {
    const date = new Date(point.recordedAt)
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  })

  const dataPoints = sensorHistory.value.map(point => point[props.sensorType])

  // Determine color based on sensor type
  let lineColor = '#3b82f6' // blue for default
  let backgroundColor = 'rgba(59, 130, 246, 0.1)'

  switch (props.sensorType) {
    case 'temperature':
      lineColor = '#ef4444' // red
      backgroundColor = 'rgba(239, 68, 68, 0.1)'
      break
    case 'humidity':
      lineColor = '#3b82f6' // blue
      backgroundColor = 'rgba(59, 130, 246, 0.1)'
      break
    case 'light':
      lineColor = '#f59e0b' // amber
      backgroundColor = 'rgba(245, 158, 11, 0.1)'
      break
  }

  return {
    labels,
    datasets: [{
      label: `${props.sensorType.charAt(0).toUpperCase() + props.sensorType.slice(1)} (${props.sensorUnit})`,
      data: dataPoints,
      borderColor: lineColor,
      backgroundColor: backgroundColor,
      borderWidth: 2,
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5
    }]
  }
})

// Chart options configuration with dark theme
const chartOptions = computed(() => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#1e293b',
        titleColor: '#e2e8f0',
        bodyColor: '#94a3b8',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y
            return formatValue(value)
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          autoSkip: true,
          maxTicksLimit: 8,
          color: '#64748b',
          font: {
            size: 10
          }
        },
        grid: {
          display: false
        },
        border: {
          color: '#334155'
        }
      },
      y: {
        display: true,
        beginAtZero: false,
        ticks: {
          color: '#64748b',
          font: {
            size: 10
          }
        },
        grid: {
          color: 'rgba(51, 65, 85, 0.5)'
        },
        border: {
          color: '#334155'
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  }
})

// Format value based on sensor type
const formatValue = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A'

  switch (props.sensorType) {
    case 'temperature':
      return `${value.toFixed(1)}°C`
    case 'humidity':
      return `${value.toFixed(1)}%`
    case 'light':
      return `${value.toFixed(0)} lux`
    default:
      return value.toString()
  }
}

// Load sensor data from API
const loadSensorData = async () => {
  isLoading.value = true
  loadingError.value = ''

  try {
    // Calculate start date based on selected time range (in minutes)
    const minutesAgo = parseInt(selectedTimeRange.value)
    const startDate = new Date()
    startDate.setMinutes(startDate.getMinutes() - minutesAgo)

    const startDateISO = startDate.toISOString()
    const endDateISO = new Date().toISOString()

    // Use local API server or production API
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001'
    const apiUrl = `${apiBase}/api/device-sensor-history?device_id=${props.deviceId}&start_date=${startDateISO}&end_date=${endDateISO}&limit=1000`

    const response = await fetch(apiUrl)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    if (result.success && result.data) {
      sensorHistory.value = result.data

      // Wait for next tick to ensure chart is rendered
      await nextTick()
    } else {
      loadingError.value = result.error || 'Failed to load sensor history'
    }
  } catch (error) {
    console.error('Error loading sensor history:', error)
    loadingError.value = 'Failed to load sensor history. Please try again later.'
  } finally {
    isLoading.value = false
  }
}

// Watch for device ID changes
watch(() => props.deviceId, () => {
  loadSensorData()
})

// Lifecycle hooks
onMounted(() => {
  loadSensorData()
})
</script>

<style scoped>
.sensor-history-chart {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #1e293b;
  border-radius: 8px;
  margin-top: 0.5rem;
  border: 1px solid #334155;
}

.chart-controls {
  display: flex;
  justify-content: flex-end;
}

.time-range-select {
  width: 160px;
  font-size: 0.75rem;
}

:deep(.p-select) {
  background: #0f172a;
  border-color: #334155;
  color: #e2e8f0;
}

:deep(.p-select:hover) {
  border-color: #60a5fa;
}

:deep(.p-select-label) {
  color: #e2e8f0;
}

.loading-state,
.error-state,
.no-data-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  font-size: 0.875rem;
  color: #94a3b8;
}

.error-state {
  color: #f87171;
}

.error-state i {
  color: #f87171;
}

.loading-state i {
  color: #60a5fa;
}

.no-data-state i {
  color: #64748b;
}

.chart-container {
  width: 100%;
  height: 180px;
  position: relative;
  background: #0f172a;
  border-radius: 6px;
  padding: 0.5rem;
}

.chart-statistics {
  display: flex;
  justify-content: space-around;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #0f172a;
  border-radius: 6px;
  font-size: 0.75rem;
  border: 1px solid #334155;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-label {
  color: #64748b;
  font-weight: 500;
  text-transform: uppercase;
  font-size: 0.625rem;
  letter-spacing: 0.05em;
}

.stat-value {
  color: #e2e8f0;
  font-weight: 600;
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .sensor-history-chart {
    padding: 0.5rem;
  }

  .chart-container {
    height: 150px;
  }

  .chart-statistics {
    flex-wrap: wrap;
  }
}
</style>

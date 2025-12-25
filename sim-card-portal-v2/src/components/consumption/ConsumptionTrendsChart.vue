<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useAppSettings } from '../../composables/useAppSettings'

Chart.register(...registerables)

const { currency } = useAppSettings()

interface DateRange {
  start: string
  end: string
}

interface TrendData {
  period: string
  dataUsageGB: number
  cost: number
  simCount: number
}

const props = defineProps<{
  dateRange: DateRange
}>()

const chartCanvas = ref<HTMLCanvasElement | null>(null)
const chartInstance = ref<Chart | null>(null)
const trends = ref<TrendData[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const viewMode = ref<'hourly' | 'daily' | 'weekly' | 'monthly'>('monthly')
// Track when chart is transitioning to disable buttons
const isTransitioning = ref(false)

// Track pending animation frame to cancel on rapid clicks
let pendingAnimationFrame: number | null = null
// Version counter to ensure only the latest update executes
let updateVersion = 0

// View mode options with labels and descriptions
const viewModes = [
  { id: 'hourly', label: '24h', description: 'Last 24 hours' },
  { id: 'daily', label: 'Daily', description: 'Last 7 days' },
  { id: 'weekly', label: 'Weekly', description: 'Last 5 weeks' },
  { id: 'monthly', label: 'Monthly', description: 'Last 6 months' }
] as const

// Get current view description
const currentViewDescription = computed(() => {
  const mode = viewModes.find(m => m.id === viewMode.value)
  return mode?.description || ''
})

const fetchTrends = async (isInitial = false) => {
  // Only show loading spinner on initial load, not on view mode changes
  if (isInitial) {
    loading.value = true
  }
  error.value = null

  try {
    const params = new URLSearchParams({
      granularity: viewMode.value
    })

    const response = await fetch(`/api/consumption/trends?${params}`)
    const result = await response.json()

    if (result.success) {
      trends.value = result.data
    } else {
      error.value = result.error || 'Failed to load trends'
    }
  } catch (err) {
    console.error('Error fetching trends:', err)
    error.value = 'Network error'
  } finally {
    loading.value = false
    await nextTick()
    if (trends.value.length > 0 && !error.value) {
      updateChart()
    }
  }
}

const formatPeriod = (period: string, mode: string) => {
  if (mode === 'hourly') {
    return period
  }

  if (mode === 'weekly') {
    return period
  }

  const date = new Date(period)
  if (mode === 'daily') {
    return date.toLocaleDateString('en-CH', { weekday: 'short', day: 'numeric' })
  } else {
    return date.toLocaleDateString('en-CH', { month: 'short', year: '2-digit' })
  }
}

const createChart = () => {
  if (!chartCanvas.value) return

  const labels = trends.value.map(t => formatPeriod(t.period, viewMode.value))
  const dataUsage = trends.value.map(t => t.dataUsageGB)
  const costs = trends.value.map(t => t.cost)
  const maxTicks = viewMode.value === 'hourly' ? 8 : viewMode.value === 'daily' ? 7 : viewMode.value === 'weekly' ? 5 : 6

  chartInstance.value = new Chart(chartCanvas.value, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Data Usage (GB)',
          data: dataUsage,
          backgroundColor: 'rgba(19, 127, 236, 0.7)',
          borderColor: '#137fec',
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: `Cost (${currency.value})`,
          data: costs,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animations: {
        y: {
          from: (ctx) => {
            if (ctx.type === 'data') {
              // Bars grow from the bottom
              return ctx.chart.scales.y?.getPixelForValue(0) || ctx.chart.height
            }
            return undefined
          },
          duration: 1000,
          easing: 'easeOutQuart'
        },
        x: {
          duration: 0
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#9ca3af',
            usePointStyle: true,
            padding: 20
          }
        },
        tooltip: {
          backgroundColor: '#283039',
          titleColor: '#f3f4f6',
          bodyColor: '#9ca3af',
          borderColor: '#3b4754',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || ''
              const value = context.parsed.y ?? 0
              if (label.includes('Cost')) {
                return `${label}: ${currency.value} ${value.toFixed(2)}`
              }
              return `${label}: ${value.toFixed(2)} GB`
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(59, 71, 84, 0.3)'
          },
          ticks: {
            color: '#9ca3af',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: maxTicks
          }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: {
            color: 'rgba(59, 71, 84, 0.3)'
          },
          ticks: {
            color: '#9ca3af',
            callback: (value) => Number(value).toFixed(1)
          },
          title: {
            display: true,
            text: 'Data Usage (GB)',
            color: '#9ca3af'
          }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            color: '#10b981',
            callback: (value) => {
              const decimals = (viewMode.value === 'weekly' || viewMode.value === 'monthly') ? 0 : 2
              return Number(value).toFixed(decimals)
            }
          },
          title: {
            display: true,
            text: `Cost (${currency.value})`,
            color: '#10b981'
          }
        }
      }
    }
  })
}

const destroyChart = () => {
  // Cancel any pending animation frame
  if (pendingAnimationFrame !== null) {
    cancelAnimationFrame(pendingAnimationFrame)
    pendingAnimationFrame = null
  }

  // Stop animations and destroy existing chart instance
  if (chartInstance.value) {
    // Stop all running animations first
    chartInstance.value.stop()
    chartInstance.value.destroy()
    chartInstance.value = null
  }

  // Clear the canvas context to prevent ghost renders
  if (chartCanvas.value) {
    const ctx = chartCanvas.value.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, chartCanvas.value.width, chartCanvas.value.height)
    }
  }
}

const updateChart = async () => {
  // Mark as transitioning to disable buttons
  isTransitioning.value = true

  // Increment version to invalidate any pending updates
  const currentVersion = ++updateVersion

  // Cancel any pending animation and destroy existing chart
  destroyChart()

  // Wait for DOM to update
  await nextTick()

  // Check if this update is still the latest (user might have clicked again)
  if (currentVersion !== updateVersion) {
    return
  }

  // Check if canvas is available and component is still mounted
  if (!chartCanvas.value) {
    isTransitioning.value = false
    return
  }

  // Use requestAnimationFrame for smooth animation, but track it
  pendingAnimationFrame = requestAnimationFrame(() => {
    pendingAnimationFrame = null
    // Verify this is still the latest version and canvas is available
    if (currentVersion === updateVersion && chartCanvas.value && trends.value.length > 0) {
      createChart()
      // Clear transitioning after animation starts (animation duration is 1000ms)
      setTimeout(() => {
        if (currentVersion === updateVersion) {
          isTransitioning.value = false
        }
      }, 1100)
    } else {
      isTransitioning.value = false
    }
  })
}

// Cleanup on component unmount
onBeforeUnmount(() => {
  destroyChart()
})

onMounted(() => fetchTrends(true))
watch(() => props.dateRange, () => fetchTrends(true), { deep: true })
watch(viewMode, () => fetchTrends(false))
</script>

<template>
  <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
    <!-- Header -->
    <div class="px-5 py-4 border-b border-border-dark flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-primary">trending_up</span>
        <div>
          <h3 class="text-white font-semibold">Consumption Trends</h3>
          <p class="text-xs text-text-secondary">{{ currentViewDescription }}</p>
        </div>
      </div>

      <!-- View Mode Toggle - 4 options -->
      <div class="flex items-center gap-1 bg-background-dark rounded-lg p-1">
        <button
          v-for="mode in viewModes"
          :key="mode.id"
          @click="!isTransitioning && viewMode !== mode.id && (viewMode = mode.id)"
          :disabled="isTransitioning"
          :class="[
            'px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap',
            viewMode === mode.id
              ? 'bg-primary text-white'
              : isTransitioning
                ? 'text-text-secondary/50 cursor-not-allowed'
                : 'text-text-secondary hover:text-white cursor-pointer'
          ]"
          :title="mode.description"
        >
          {{ mode.label }}
        </button>
      </div>
    </div>

    <!-- Chart Area -->
    <div class="p-5">
      <div v-if="loading" class="h-[280px] flex items-center justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>

      <div v-else-if="error" class="h-[280px] flex items-center justify-center">
        <div class="text-center">
          <span class="material-symbols-outlined text-red-400 text-3xl mb-2">error</span>
          <p class="text-red-400">{{ error }}</p>
        </div>
      </div>

      <div v-else-if="trends.length === 0" class="h-[280px] flex items-center justify-center">
        <div class="text-center">
          <span class="material-symbols-outlined text-text-secondary text-3xl mb-2">bar_chart</span>
          <p class="text-text-secondary">No data available for this period</p>
        </div>
      </div>

      <div v-else class="h-[280px] relative">
        <canvas ref="chartCanvas"></canvas>
      </div>
    </div>
  </div>
</template>

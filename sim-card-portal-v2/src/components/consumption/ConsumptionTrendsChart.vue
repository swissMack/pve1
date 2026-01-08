<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useAppSettings } from '../../composables/useAppSettings'
import type { TimeGranularity, FilterCriteria } from '@/types/analytics'

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

const props = withDefaults(defineProps<{
  dateRange: DateRange
  granularity?: TimeGranularity
  filters?: Partial<FilterCriteria>
}>(), {
  granularity: undefined,
  filters: undefined
})

const emit = defineEmits<{
  loading: [isLoading: boolean]
}>()

const chartCanvas = ref<HTMLCanvasElement | null>(null)
const chartInstance = ref<Chart | null>(null)
const trends = ref<TrendData[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
// Internal view mode (used when granularity prop not provided)
const internalViewMode = ref<'hourly' | 'daily' | 'weekly' | 'monthly'>('monthly')

// Use external granularity if provided, otherwise use internal state
const viewMode = computed(() => {
  if (props.granularity) {
    // Map TimeGranularity to internal format
    const mapping: Record<TimeGranularity, 'hourly' | 'daily' | 'weekly' | 'monthly'> = {
      '24h': 'hourly',
      'daily': 'daily',
      'weekly': 'weekly',
      'monthly': 'monthly'
    }
    return mapping[props.granularity]
  }
  return internalViewMode.value
})

// Determine if external control is active (hide internal toggle)
const hasExternalGranularity = computed(() => props.granularity !== undefined)

// Handler for view mode button clicks (only used when not externally controlled)
const handleViewModeClick = (modeId: 'hourly' | 'daily' | 'weekly' | 'monthly') => {
  internalViewMode.value = modeId
}

// Emit loading state changes to parent
watch(loading, (isLoading) => {
  emit('loading', isLoading)
})

// Track pending animation frame to cancel on rapid clicks
let pendingAnimationFrame: number | null = null

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

// Request counter to handle race conditions from rapid clicks
let fetchRequestId = 0

const fetchTrends = async (isInitial = false) => {
  // Increment request ID - this fetch will only update chart if it's still the latest
  const currentRequestId = ++fetchRequestId

  // DON'T destroy the chart here - keep it visible while fetching new data
  // This prevents blank pane when clicking during animation
  // Chart will be destroyed only when new data arrives in updateChart()

  // Only show loading spinner on initial load, not on view mode changes
  if (isInitial) {
    loading.value = true
  }
  error.value = null

  try {
    const params = new URLSearchParams({
      granularity: viewMode.value
    })

    // Add filter parameters if provided
    if (props.filters?.networks?.length) {
      props.filters.networks.forEach((mccmnc: string) => params.append('mccmnc', mccmnc))
    }
    if (props.filters?.imsis?.length) {
      props.filters.imsis.forEach((imsi: string) => params.append('imsi', imsi))
    }

    const response = await fetch(`/api/consumption/trends?${params}`)

    // Check if this request is still the latest before processing
    if (currentRequestId !== fetchRequestId) {
      return // A newer request was started, discard this result
    }

    const result = await response.json()

    if (result.success) {
      trends.value = result.data
    } else {
      error.value = result.error || 'Failed to load trends'
    }
  } catch (err) {
    // Only set error if this is still the latest request
    if (currentRequestId === fetchRequestId) {
      console.error('Error fetching trends:', err)
      error.value = 'Network error'
    }
  } finally {
    // Only update UI if this is still the latest request
    if (currentRequestId === fetchRequestId) {
      loading.value = false
      await nextTick()
      if (trends.value.length > 0 && !error.value) {
        updateChart()
      }
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
}

const updateChart = () => {
  // Check if canvas is available and we have data
  if (!chartCanvas.value || trends.value.length === 0) {
    return
  }

  // Simple approach: destroy existing chart and create new one
  if (chartInstance.value) {
    destroyChart()
  }
  createChart()
}

// Cleanup on component unmount
onBeforeUnmount(() => {
  destroyChart()
})

onMounted(() => fetchTrends(true))
watch(() => props.dateRange, () => fetchTrends(true), { deep: true })
// Watch for external granularity changes
watch(() => props.granularity, () => {
  if (props.granularity) {
    fetchTrends(false)
  }
})
// Watch internal view mode changes (when not externally controlled)
watch(internalViewMode, () => {
  if (!props.granularity) {
    fetchTrends(false)
  }
})
// Watch for filter changes
watch(() => props.filters, () => {
  fetchTrends(false)
}, { deep: true })
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

      <!-- View Mode Toggle - only show when not externally controlled -->
      <div v-if="!hasExternalGranularity" class="flex items-center gap-1 bg-background-dark rounded-lg p-1">
        <button
          v-for="mode in viewModes"
          :key="mode.id"
          type="button"
          @click="handleViewModeClick(mode.id)"
          :class="[
            'px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap',
            internalViewMode === mode.id
              ? 'bg-primary text-white'
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

      <!-- Small print disclaimer -->
      <p class="text-[10px] text-text-secondary/60 mt-3 text-right italic">
        Costs do not include Access Charges
      </p>
    </div>
  </div>
</template>

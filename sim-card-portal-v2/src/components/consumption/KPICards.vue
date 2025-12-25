<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useAppSettings } from '../../composables/useAppSettings'

const { formatCurrency } = useAppSettings()

interface DateRange {
  start: string
  end: string
}

interface KPI {
  value: number
  trend: number
  currency?: string
  valueGB?: number
}

interface KPIData {
  totalSpend: KPI
  dataUsage: KPI
  activeSims: KPI
  avgDataPerSim: KPI
  estimatedCost: KPI
}

const props = defineProps<{
  dateRange: DateRange
}>()

const kpis = ref<KPIData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const fetchKPIs = async () => {
  loading.value = true
  error.value = null

  try {
    const params = new URLSearchParams({
      start_date: props.dateRange.start,
      end_date: props.dateRange.end
    })

    const response = await fetch(`/api/consumption/kpis?${params}`)
    const result = await response.json()

    if (result.success) {
      kpis.value = result.data
    } else {
      error.value = result.error || 'Failed to load KPIs'
    }
  } catch (err) {
    console.error('Error fetching KPIs:', err)
    error.value = 'Network error'
  } finally {
    loading.value = false
  }
}

const formatNumber = (value: number, decimals = 0) => {
  return new Intl.NumberFormat('en-CH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}

const formatTrend = (trend: number) => {
  const prefix = trend > 0 ? '+' : ''
  return `${prefix}${trend.toFixed(1)}%`
}

onMounted(fetchKPIs)
watch(() => props.dateRange, fetchKPIs, { deep: true })
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
    <!-- Loading State -->
    <template v-if="loading">
      <div v-for="i in 5" :key="i" class="bg-surface-dark rounded-xl border border-border-dark p-5 animate-pulse">
        <div class="h-4 bg-border-dark rounded w-24 mb-4"></div>
        <div class="h-8 bg-border-dark rounded w-20 mb-2"></div>
        <div class="h-3 bg-border-dark rounded w-16"></div>
      </div>
    </template>

    <!-- Error State -->
    <template v-else-if="error">
      <div class="col-span-full bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
        <span class="material-symbols-outlined text-red-400 text-2xl mb-2">error</span>
        <p class="text-red-400">{{ error }}</p>
      </div>
    </template>

    <!-- Data Display -->
    <template v-else-if="kpis">
      <!-- Total Spend -->
      <div class="bg-surface-dark rounded-xl border border-border-dark p-5 relative overflow-hidden group hover:border-primary/50 transition-colors">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <span class="material-symbols-outlined text-primary text-[60px]">payments</span>
        </div>
        <div class="flex items-center gap-2 mb-3">
          <div class="p-2 rounded-lg bg-primary/10 text-primary">
            <span class="material-symbols-outlined text-[20px]">payments</span>
          </div>
          <p class="text-text-secondary text-sm font-medium">Total Spend</p>
        </div>
        <h3 class="text-2xl font-bold text-white mb-1">
          {{ formatCurrency(kpis.totalSpend.value) }}
        </h3>
        <div class="flex items-center gap-1 text-xs">
          <span :class="kpis.totalSpend.trend >= 0 ? 'text-red-400' : 'text-green-400'" class="flex items-center">
            <span class="material-symbols-outlined text-[14px]">
              {{ kpis.totalSpend.trend >= 0 ? 'trending_up' : 'trending_down' }}
            </span>
            {{ formatTrend(kpis.totalSpend.trend) }}
          </span>
          <span class="text-text-secondary">vs prev period</span>
        </div>
      </div>

      <!-- Data Usage -->
      <div class="bg-surface-dark rounded-xl border border-border-dark p-5 relative overflow-hidden group hover:border-teal-500/50 transition-colors">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <span class="material-symbols-outlined text-teal-400 text-[60px]">data_usage</span>
        </div>
        <div class="flex items-center gap-2 mb-3">
          <div class="p-2 rounded-lg bg-teal-500/10 text-teal-400">
            <span class="material-symbols-outlined text-[20px]">data_usage</span>
          </div>
          <p class="text-text-secondary text-sm font-medium">Data Usage</p>
        </div>
        <h3 class="text-2xl font-bold text-white mb-1">
          {{ formatNumber(kpis.dataUsage.valueGB || 0, 1) }} GB
        </h3>
        <div class="flex items-center gap-1 text-xs">
          <span :class="kpis.dataUsage.trend >= 0 ? 'text-amber-400' : 'text-green-400'" class="flex items-center">
            <span class="material-symbols-outlined text-[14px]">
              {{ kpis.dataUsage.trend >= 0 ? 'trending_up' : 'trending_down' }}
            </span>
            {{ formatTrend(kpis.dataUsage.trend) }}
          </span>
          <span class="text-text-secondary">vs prev period</span>
        </div>
      </div>

      <!-- Active SIMs -->
      <div class="bg-surface-dark rounded-xl border border-border-dark p-5 relative overflow-hidden group hover:border-purple-500/50 transition-colors">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <span class="material-symbols-outlined text-purple-400 text-[60px]">sim_card</span>
        </div>
        <div class="flex items-center gap-2 mb-3">
          <div class="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <span class="material-symbols-outlined text-[20px]">sim_card</span>
          </div>
          <p class="text-text-secondary text-sm font-medium">Active SIMs</p>
        </div>
        <h3 class="text-2xl font-bold text-white mb-1">
          {{ formatNumber(kpis.activeSims.value) }}
        </h3>
        <div class="flex items-center gap-1 text-xs">
          <span class="text-text-secondary">Currently active</span>
        </div>
      </div>

      <!-- Avg Data per SIM -->
      <div class="bg-surface-dark rounded-xl border border-border-dark p-5 relative overflow-hidden group hover:border-amber-500/50 transition-colors">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <span class="material-symbols-outlined text-amber-400 text-[60px]">equalizer</span>
        </div>
        <div class="flex items-center gap-2 mb-3">
          <div class="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <span class="material-symbols-outlined text-[20px]">equalizer</span>
          </div>
          <p class="text-text-secondary text-sm font-medium">Avg Data/SIM</p>
        </div>
        <h3 class="text-2xl font-bold text-white mb-1">
          {{ formatNumber(kpis.avgDataPerSim.valueGB || 0, 2) }} GB
        </h3>
        <div class="flex items-center gap-1 text-xs">
          <span class="text-text-secondary">Per active SIM</span>
        </div>
      </div>

      <!-- Estimated Cost -->
      <div class="bg-surface-dark rounded-xl border border-border-dark p-5 relative overflow-hidden group hover:border-green-500/50 transition-colors">
        <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <span class="material-symbols-outlined text-green-400 text-[60px]">calculate</span>
        </div>
        <div class="flex items-center gap-2 mb-3">
          <div class="p-2 rounded-lg bg-green-500/10 text-green-400">
            <span class="material-symbols-outlined text-[20px]">calculate</span>
          </div>
          <p class="text-text-secondary text-sm font-medium">Est. Cost</p>
        </div>
        <h3 class="text-2xl font-bold text-white mb-1">
          {{ formatCurrency(kpis.estimatedCost.value, undefined, 0) }}
        </h3>
        <div class="flex items-center gap-1 text-xs">
          <span class="text-text-secondary">Projected total</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Card from 'primevue/card'
import Chart from 'primevue/chart'
import Dropdown from 'primevue/dropdown'
import type { ConsumptionTrend, TrendGranularity } from '@/types/kpi'

const props = defineProps<{
  trends: ConsumptionTrend[]
  granularity: TrendGranularity
  loading: boolean
}>()

const emit = defineEmits<{
  'update:granularity': [value: TrendGranularity]
}>()

const granularityOptions = [
  { label: 'Hourly', value: 'hourly' as TrendGranularity },
  { label: 'Daily', value: 'daily' as TrendGranularity },
  { label: 'Weekly', value: 'weekly' as TrendGranularity },
  { label: 'Monthly', value: 'monthly' as TrendGranularity }
]

const chartData = computed(() => ({
  labels: props.trends.map(t => t.period),
  datasets: [
    {
      label: 'Data Usage (GB)',
      data: props.trends.map(t => t.dataUsageGB),
      fill: false,
      borderColor: '#3B82F6',
      tension: 0.4
    },
    {
      label: 'Cost (CHF)',
      data: props.trends.map(t => t.cost),
      fill: false,
      borderColor: '#10B981',
      tension: 0.4,
      yAxisID: 'y1'
    }
  ]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const
    }
  },
  scales: {
    y: {
      type: 'linear' as const,
      display: true,
      position: 'left' as const,
      title: {
        display: true,
        text: 'Data (GB)'
      }
    },
    y1: {
      type: 'linear' as const,
      display: true,
      position: 'right' as const,
      title: {
        display: true,
        text: 'Cost (CHF)'
      },
      grid: {
        drawOnChartArea: false
      }
    }
  }
}
</script>

<template>
  <Card class="trend-chart">
    <template #title>
      <div class="flex justify-content-between align-items-center">
        <span>Consumption Trends</span>
        <Dropdown
          :modelValue="granularity"
          @update:modelValue="emit('update:granularity', $event)"
          :options="granularityOptions"
          optionLabel="label"
          optionValue="value"
          class="w-8rem"
        />
      </div>
    </template>
    <template #content>
      <div v-if="loading" class="flex justify-content-center p-5">
        <i class="pi pi-spin pi-spinner text-4xl text-primary"></i>
      </div>
      <div v-else-if="trends.length > 0" style="height: 300px">
        <Chart type="line" :data="chartData" :options="chartOptions" />
      </div>
      <div v-else class="text-center p-5 text-600">
        No trend data available
      </div>
    </template>
  </Card>
</template>

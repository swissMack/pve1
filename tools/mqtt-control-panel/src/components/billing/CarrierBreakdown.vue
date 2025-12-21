<script setup lang="ts">
import { computed } from 'vue'
import Card from 'primevue/card'
import Chart from 'primevue/chart'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import type { CarrierBreakdown } from '@/types/kpi'

const props = defineProps<{
  carriers: CarrierBreakdown[]
  loading: boolean
}>()

const chartData = computed(() => ({
  labels: props.carriers.map(c => c.name),
  datasets: [
    {
      data: props.carriers.map(c => c.costPercentage),
      backgroundColor: [
        '#3B82F6',
        '#10B981',
        '#F59E0B',
        '#EF4444',
        '#8B5CF6',
        '#EC4899'
      ]
    }
  ]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const
    }
  }
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF'
  }).format(amount)
}
</script>

<template>
  <Card class="carrier-breakdown">
    <template #title>Carrier Breakdown</template>
    <template #content>
      <div v-if="loading" class="flex justify-content-center p-5">
        <i class="pi pi-spin pi-spinner text-4xl text-primary"></i>
      </div>
      <template v-else-if="carriers.length > 0">
        <div class="grid">
          <div class="col-12 lg:col-5">
            <div style="height: 250px">
              <Chart type="pie" :data="chartData" :options="chartOptions" />
            </div>
          </div>
          <div class="col-12 lg:col-7">
            <DataTable :value="carriers" size="small" stripedRows>
              <Column field="name" header="Carrier" />
              <Column header="Data Usage">
                <template #body="{ data }">
                  {{ data.dataUsageGB.toFixed(1) }} GB ({{ data.dataPercentage.toFixed(1) }}%)
                </template>
              </Column>
              <Column header="Cost">
                <template #body="{ data }">
                  {{ formatCurrency(data.cost) }} ({{ data.costPercentage.toFixed(1) }}%)
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
      <div v-else class="text-center p-5 text-600">
        No carrier data available
      </div>
    </template>
  </Card>
</template>

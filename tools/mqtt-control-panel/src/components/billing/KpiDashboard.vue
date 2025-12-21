<script setup>
import Card from 'primevue/card'

const props = defineProps({
  kpis: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF'
  }).format(amount || 0)
}

const formatTrend = (trend) => {
  const sign = trend >= 0 ? '+' : ''
  return `${sign}${(trend || 0).toFixed(1)}%`
}

const getTrendClass = (trend) => {
  if (trend > 0) return 'text-green-500'
  if (trend < 0) return 'text-red-500'
  return 'text-500'
}
</script>

<template>
  <div class="kpi-dashboard">
    <div class="grid">
      <div class="col-12 md:col-6 lg:col-3">
        <Card class="h-full">
          <template #content>
            <div class="text-center">
              <i class="pi pi-dollar text-4xl text-primary mb-3"></i>
              <div class="text-500 mb-2">Total Spend</div>
              <div v-if="loading" class="text-2xl font-bold">
                <i class="pi pi-spin pi-spinner"></i>
              </div>
              <template v-else-if="kpis">
                <div class="text-2xl font-bold text-900">{{ formatCurrency(kpis.totalSpend) }}</div>
                <div :class="getTrendClass(kpis.totalSpendTrend)" class="text-sm mt-1">
                  {{ formatTrend(kpis.totalSpendTrend) }} vs last period
                </div>
              </template>
              <div v-else class="text-600">-</div>
            </div>
          </template>
        </Card>
      </div>

      <div class="col-12 md:col-6 lg:col-3">
        <Card class="h-full">
          <template #content>
            <div class="text-center">
              <i class="pi pi-cloud-download text-4xl text-blue-500 mb-3"></i>
              <div class="text-500 mb-2">Data Usage</div>
              <div v-if="loading" class="text-2xl font-bold">
                <i class="pi pi-spin pi-spinner"></i>
              </div>
              <template v-else-if="kpis">
                <div class="text-2xl font-bold text-900">{{ (kpis.dataUsageGB || 0).toFixed(1) }} GB</div>
                <div :class="getTrendClass(kpis.dataUsageTrend)" class="text-sm mt-1">
                  {{ formatTrend(kpis.dataUsageTrend) }} vs last period
                </div>
              </template>
              <div v-else class="text-600">-</div>
            </div>
          </template>
        </Card>
      </div>

      <div class="col-12 md:col-6 lg:col-3">
        <Card class="h-full">
          <template #content>
            <div class="text-center">
              <i class="pi pi-mobile text-4xl text-green-500 mb-3"></i>
              <div class="text-500 mb-2">Active SIMs</div>
              <div v-if="loading" class="text-2xl font-bold">
                <i class="pi pi-spin pi-spinner"></i>
              </div>
              <template v-else-if="kpis">
                <div class="text-2xl font-bold text-900">{{ (kpis.activeSims || 0).toLocaleString() }}</div>
                <div :class="getTrendClass(kpis.activeSimsTrend)" class="text-sm mt-1">
                  {{ formatTrend(kpis.activeSimsTrend) }} vs last period
                </div>
              </template>
              <div v-else class="text-600">-</div>
            </div>
          </template>
        </Card>
      </div>

      <div class="col-12 md:col-6 lg:col-3">
        <Card class="h-full">
          <template #content>
            <div class="text-center">
              <i class="pi pi-calculator text-4xl text-orange-500 mb-3"></i>
              <div class="text-500 mb-2">Avg Cost/SIM</div>
              <div v-if="loading" class="text-2xl font-bold">
                <i class="pi pi-spin pi-spinner"></i>
              </div>
              <template v-else-if="kpis">
                <div class="text-2xl font-bold text-900">{{ formatCurrency(kpis.avgCostPerSim) }}</div>
              </template>
              <div v-else class="text-600">-</div>
            </div>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>

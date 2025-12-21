<script setup>
import { onMounted } from 'vue'
import InvoiceList from './billing/InvoiceList.vue'
import KpiDashboard from './billing/KpiDashboard.vue'
import TrendChart from './billing/TrendChart.vue'
import CarrierBreakdown from './billing/CarrierBreakdown.vue'
import { useInvoices } from '../composables/useInvoices.js'
import { useKpis } from '../composables/useKpis.js'
import { useAutoRefresh } from '../composables/useAutoRefresh.js'

const {
  invoices,
  filteredInvoices,
  loading: invoicesLoading,
  error: invoicesError,
  statusFilter,
  carrierFilter,
  carriers,
  fetchInvoices,
  clearFilters
} = useInvoices()

const {
  kpis,
  trends,
  carriers: kpiCarriers,
  granularity,
  loading: kpisLoading,
  fetchAll,
  setGranularity
} = useKpis()

// Auto-refresh every 30 seconds
useAutoRefresh(async () => {
  await Promise.all([fetchInvoices(), fetchAll()])
}, 30000)

onMounted(async () => {
  await Promise.all([fetchInvoices(), fetchAll()])
})
</script>

<template>
  <div class="billing-view">
    <h2 class="view-title mb-4">
      <i class="pi pi-wallet mr-2"></i>
      Billing & Consumption
    </h2>

    <!-- KPI Dashboard -->
    <div class="mb-4">
      <KpiDashboard :kpis="kpis" :loading="kpisLoading" />
    </div>

    <!-- Charts Row -->
    <div class="grid mb-4">
      <div class="col-12 lg:col-7">
        <TrendChart
          :trends="trends"
          :granularity="granularity"
          :loading="kpisLoading"
          @update:granularity="setGranularity"
        />
      </div>
      <div class="col-12 lg:col-5">
        <CarrierBreakdown :carriers="kpiCarriers" :loading="kpisLoading" />
      </div>
    </div>

    <!-- Invoice List -->
    <div class="invoice-section">
      <h3 class="section-title mb-3">
        <i class="pi pi-file mr-2"></i>
        Invoices
      </h3>
      <InvoiceList
        :invoices="filteredInvoices"
        :loading="invoicesLoading"
        :statusFilter="statusFilter"
        :carrierFilter="carrierFilter"
        :carriers="carriers"
        @update:statusFilter="statusFilter = $event"
        @update:carrierFilter="carrierFilter = $event"
        @reset-filters="clearFilters"
      />
    </div>
  </div>
</template>

<style scoped>
.view-title {
  display: flex;
  align-items: center;
  color: #4fc3f7;
  font-size: 1.5rem;
  font-weight: 600;
}

.section-title {
  display: flex;
  align-items: center;
  color: #aaa;
  font-size: 1.1rem;
  font-weight: 500;
}
</style>

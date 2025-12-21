<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import { useInvoices } from '@/composables/useInvoices'
import { useKpis } from '@/composables/useKpis'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import InvoiceList from '@/components/billing/InvoiceList.vue'
import KpiDashboard from '@/components/billing/KpiDashboard.vue'
import TrendChart from '@/components/billing/TrendChart.vue'
import CarrierBreakdown from '@/components/billing/CarrierBreakdown.vue'
import ErrorRetry from '@/components/common/ErrorRetry.vue'

const {
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
  carriers: carrierData,
  granularity,
  loading: kpisLoading,
  error: kpisError,
  fetchAll: fetchKpis,
  setGranularity
} = useKpis()

const activeTab = ref(0)

const fetchAll = async () => {
  await Promise.all([fetchInvoices(), fetchKpis()])
}

const { isRefreshing } = useAutoRefresh(fetchAll, 30000)

onMounted(() => {
  fetchKpis()
})
</script>

<template>
  <div class="billing-page">
    <div class="flex justify-content-between align-items-center mb-4">
      <h2 class="text-xl font-semibold m-0">Billing</h2>
      <div class="flex align-items-center gap-2">
        <i
          v-if="isRefreshing"
          class="pi pi-spin pi-spinner text-primary"
          data-testid="auto-refresh-indicator"
        />
        <span class="text-sm text-500">Auto-refresh: 30s</span>
      </div>
    </div>

    <TabView v-model:activeIndex="activeTab">
      <TabPanel value="0" header="Invoices">
        <ErrorRetry
          v-if="invoicesError"
          :message="invoicesError"
          @retry="fetchInvoices"
        />

        <InvoiceList
          v-else
          :invoices="filteredInvoices"
          :loading="invoicesLoading"
          :statusFilter="statusFilter"
          :carrierFilter="carrierFilter"
          :carriers="carriers"
          @update:statusFilter="statusFilter = $event"
          @update:carrierFilter="carrierFilter = $event"
          @reset-filters="clearFilters"
        />
      </TabPanel>

      <TabPanel value="1" header="Analytics">
        <ErrorRetry
          v-if="kpisError"
          :message="kpisError"
          @retry="fetchKpis"
        />

        <template v-else>
          <KpiDashboard
            :kpis="kpis"
            :loading="kpisLoading"
            class="mb-4"
          />

          <div class="grid">
            <div class="col-12 lg:col-8">
              <TrendChart
                :trends="trends"
                :granularity="granularity"
                :loading="kpisLoading"
                @update:granularity="setGranularity"
              />
            </div>
            <div class="col-12 lg:col-4">
              <CarrierBreakdown
                :carriers="carrierData"
                :loading="kpisLoading"
              />
            </div>
          </div>
        </template>
      </TabPanel>
    </TabView>
  </div>
</template>

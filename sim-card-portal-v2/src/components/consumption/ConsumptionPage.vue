<script setup lang="ts">
import { ref, watch } from 'vue'
import KPICards from './KPICards.vue'
import DateRangeSelector from './DateRangeSelector.vue'
import ConsumptionTrendsChart from './ConsumptionTrendsChart.vue'
import TopCarriersBreakdown from './TopCarriersBreakdown.vue'
import RegionalUsageMap from './RegionalUsageMap.vue'
import InvoiceHistoryTable from './InvoiceHistoryTable.vue'
import AskBobPane from './AskBobPane.vue'
import ExportModal from './ExportModal.vue'

// Types
interface DateRange {
  start: string
  end: string
}

interface Props {
  refreshKey?: number
}

const props = defineProps<Props>()

// State - Default to last 6 months for better chart visualization
const dateRange = ref<DateRange>({
  start: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString().split('T')[0],
  end: new Date().toISOString().split('T')[0]
})
const showAskBob = ref(false)
const showExportModal = ref(false)
const refreshKey = ref(0)

// Methods
const handleDateRangeChange = (newRange: DateRange) => {
  dateRange.value = newRange
  refreshKey.value++
}

const toggleAskBob = () => {
  showAskBob.value = !showAskBob.value
}

const openExportModal = () => {
  showExportModal.value = true
}

const closeExportModal = () => {
  showExportModal.value = false
}

// Watch for refresh trigger from parent
watch(() => props.refreshKey, () => {
  refreshKey.value++
})
</script>

<template>
  <div class="min-h-full bg-background-dark">
    <!-- Header with Date Range and Actions -->
    <div class="px-6 py-4 border-b border-border-dark bg-surface-dark sticky top-0 z-10">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold text-white flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">analytics</span>
            SIM Usage & Cost Analytics
          </h1>
          <p class="text-sm text-text-secondary mt-1">Monitor consumption trends, costs, and performance metrics</p>
        </div>

        <div class="flex items-center gap-3">
          <DateRangeSelector
            :initialRange="dateRange"
            @change="handleDateRangeChange"
          />

          <button
            @click="openExportModal"
            class="flex items-center gap-2 px-4 py-2 bg-surface-dark-highlight border border-border-dark rounded-lg text-white hover:border-primary/50 transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">download</span>
            <span class="hidden sm:inline">Export</span>
          </button>

          <button
            @click="toggleAskBob"
            :class="[
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              showAskBob
                ? 'bg-primary text-white'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            ]"
          >
            <span class="material-symbols-outlined text-[18px]">smart_toy</span>
            <span class="hidden sm:inline">Ask Bob</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex">
      <!-- Left Content Area -->
      <div :class="['flex-1 p-6 space-y-6 transition-all', showAskBob ? 'lg:mr-[400px]' : '']">
        <!-- KPI Cards Row -->
        <KPICards :key="`kpi-${refreshKey}`" :dateRange="dateRange" />

        <!-- Charts, Map, and Invoices Grid -->
        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <!-- Left Column: Trends Chart + Regional Map + Invoice History stacked -->
          <div class="xl:col-span-2 flex flex-col gap-6">
            <ConsumptionTrendsChart :key="`trends-${refreshKey}`" :dateRange="dateRange" />
            <RegionalUsageMap :key="`map-${refreshKey}`" />
            <InvoiceHistoryTable :key="`invoices-${refreshKey}`" :dateRange="dateRange" />
          </div>

          <!-- Right Column: Carrier Breakdown -->
          <div>
            <TopCarriersBreakdown :key="`carriers-${refreshKey}`" :dateRange="dateRange" />
          </div>
        </div>
      </div>

      <!-- Ask Bob Side Panel -->
      <Transition name="slide">
        <div
          v-if="showAskBob"
          class="fixed right-0 top-[64px] bottom-0 w-full lg:w-[400px] bg-surface-dark border-l border-border-dark z-20 flex flex-col"
        >
          <AskBobPane :dateRange="dateRange" @close="showAskBob = false" />
        </div>
      </Transition>
    </div>

    <!-- Export Modal -->
    <Teleport to="body">
      <ExportModal
        v-if="showExportModal"
        :dateRange="dateRange"
        @close="closeExportModal"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>

<script setup lang="ts">
import { ref, watch, reactive, computed, onMounted, onUnmounted } from 'vue'
import KPICards from './KPICards.vue'
import DateRangeSelector from './DateRangeSelector.vue'
import ConsumptionTrendsChart from './ConsumptionTrendsChart.vue'
import TopCarriersBreakdown from './TopCarriersBreakdown.vue'
import RegionalUsageMap from './RegionalUsageMap.vue'
import InvoiceHistoryTable from './InvoiceHistoryTable.vue'
import AskBobPane from './AskBobPane.vue'
import ExportModal from './ExportModal.vue'
import TimeGranularityToggle from './TimeGranularityToggle.vue'
import FilterPanel from './FilterPanel.vue'
import UsageResultsTable from './UsageResultsTable.vue'
import type { TimeGranularity, FilterCriteria, LoadingState } from '@/types/analytics'
import { logGranularityChange } from '@/services/auditLogger'
import { debounce } from '@/utils/debounce'

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

// Unified filter state for all panes
const granularity = ref<TimeGranularity>('monthly')

// Filter criteria combining granularity and other filters (for US2)
const filterCriteria = reactive<FilterCriteria>({
  granularity: 'monthly',
  networks: [],
  imsis: []
})

// Loading state per pane
const loading = reactive<LoadingState>({
  trends: false,
  carriers: false,
  regional: false,
  results: false
})

// Track if any pane is loading (disables toggle during refresh)
const isAnyLoading = computed(() =>
  loading.trends || loading.carriers || loading.regional || loading.results
)

// Available filter options (populated from API/child components)
const availableMccmncs = ref<string[]>([])
const availableImsis = ref<string[]>([])

// Fetch available filter options
const fetchFilterOptions = async () => {
  try {
    // Fetch available MCCMNCs from carriers endpoint
    const carriersResponse = await fetch('/api/consumption/carriers')
    const carriersResult = await carriersResponse.json()
    if (carriersResult.success && carriersResult.data) {
      // Extract unique MCCMNCs from carriers
      const mccmncs = carriersResult.data
        .map((c: { mccmnc?: string }) => c.mccmnc)
        .filter((m: string | undefined): m is string => !!m)
      availableMccmncs.value = [...new Set(mccmncs)] as string[]
    }

    // Fetch available IMSIs from unique IMSI count endpoint
    const imsiResponse = await fetch('/api/consumption/unique-imsis')
    const imsiResult = await imsiResponse.json()
    if (imsiResult.success && imsiResult.data) {
      availableImsis.value = imsiResult.data
        .map((i: { imsi?: string }) => i.imsi)
        .filter((i: string | undefined): i is string => !!i)
    }
  } catch (error) {
    console.warn('Failed to fetch filter options:', error)
  }
}

// Check if any advanced filters are active
const hasActiveFilters = computed(() =>
  filterCriteria.networks.length > 0 || filterCriteria.imsis.length > 0
)

// Handle loading state updates from child components
const handleLoadingChange = (pane: keyof LoadingState, isLoading: boolean) => {
  loading[pane] = isLoading
}

// Methods

// Debounced refresh to prevent rapid successive API calls
const triggerRefresh = () => {
  refreshKey.value++
}
const debouncedRefresh = debounce(triggerRefresh, 150)

const handleDateRangeChange = (newRange: DateRange) => {
  dateRange.value = newRange
  debouncedRefresh()
}

// Handle granularity change - sync with filter criteria and refresh all panes
const handleGranularityChange = (newGranularity: TimeGranularity) => {
  const previousGranularity = granularity.value
  granularity.value = newGranularity
  filterCriteria.granularity = newGranularity

  // Log granularity change
  logGranularityChange('ConsumptionPage', newGranularity, previousGranularity)

  debouncedRefresh() // Debounced refresh to prevent rapid clicks
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

// Handle filter changes from FilterPanel
const handleFilterUpdate = (newFilters: Partial<FilterCriteria>) => {
  if (newFilters.networks !== undefined) {
    filterCriteria.networks = newFilters.networks
  }
  if (newFilters.imsis !== undefined) {
    filterCriteria.imsis = newFilters.imsis
  }
}

// Handle filter apply - refresh all panes (debounced)
const handleFilterApply = () => {
  debouncedRefresh()
}

// Handle filter clear
const handleFilterClear = () => {
  filterCriteria.networks = []
  filterCriteria.imsis = []
  debouncedRefresh()
}

// Cleanup debounced function on unmount
onUnmounted(() => {
  debouncedRefresh.cancel()
})

// Watch for refresh trigger from parent
watch(() => props.refreshKey, () => {
  refreshKey.value++
})

// Fetch filter options on mount
onMounted(fetchFilterOptions)
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
          <!-- Unified Time Granularity Toggle -->
          <TimeGranularityToggle
            :modelValue="granularity"
            :disabled="isAnyLoading"
            @update:modelValue="handleGranularityChange"
          />

          <div class="h-6 w-px bg-border-dark hidden lg:block"></div>

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

        <!-- Advanced Filters Panel -->
        <FilterPanel
          :key="`filters-${refreshKey}`"
          :modelValue="filterCriteria"
          :disabled="isAnyLoading"
          :availableMccmncs="availableMccmncs"
          :availableImsis="availableImsis"
          @update:modelValue="handleFilterUpdate"
          @apply="handleFilterApply"
          @clear="handleFilterClear"
        />

        <!-- No Data Message when filters active but no results -->
        <div
          v-if="hasActiveFilters && !isAnyLoading"
          class="bg-surface-dark rounded-xl border border-border-dark p-6 text-center"
        >
          <div class="flex flex-col items-center gap-3">
            <span class="material-symbols-outlined text-4xl text-text-secondary">filter_alt_off</span>
            <p class="text-text-secondary">
              Filters are active. If no data appears, try adjusting your filter criteria.
            </p>
          </div>
        </div>

        <!-- Charts, Map, and Invoices Grid -->
        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <!-- Left Column: Trends Chart + Regional Map + Invoice History stacked -->
          <div class="xl:col-span-2 flex flex-col gap-6">
            <ConsumptionTrendsChart
              :key="`trends-${refreshKey}`"
              :dateRange="dateRange"
              :granularity="granularity"
              :filters="filterCriteria"
              @loading="(isLoading: boolean) => handleLoadingChange('trends', isLoading)"
            />
            <RegionalUsageMap
              :key="`map-${refreshKey}`"
              :granularity="granularity"
              :filters="filterCriteria"
              @loading="(isLoading: boolean) => handleLoadingChange('regional', isLoading)"
            />
            <UsageResultsTable
              :key="`usage-${refreshKey}`"
              :dateRange="dateRange"
              :granularity="granularity"
              :filters="filterCriteria"
              @loading="(isLoading: boolean) => handleLoadingChange('results', isLoading)"
            />
            <InvoiceHistoryTable :key="`invoices-${refreshKey}`" :dateRange="dateRange" />
          </div>

          <!-- Right Column: Carrier Breakdown -->
          <div>
            <TopCarriersBreakdown
              :key="`carriers-${refreshKey}`"
              :dateRange="dateRange"
              :granularity="granularity"
              :filters="filterCriteria"
              @loading="(isLoading: boolean) => handleLoadingChange('carriers', isLoading)"
            />
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

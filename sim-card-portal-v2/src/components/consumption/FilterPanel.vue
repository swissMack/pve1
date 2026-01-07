<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import MultiSelect from 'primevue/multiselect'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import type { FilterCriteria, NetworkMapping, ImsiFilterMode, ImsiRange } from '@/types/analytics'
import { formatMccmncLabel, getAllCachedMappings, lookupMccmnc } from '@/services/mccmncService'

interface Props {
  modelValue: Partial<FilterCriteria>
  disabled?: boolean
  availableMccmncs?: string[]
  availableImsis?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  availableMccmncs: () => [],
  availableImsis: () => []
})

const emit = defineEmits<{
  'update:modelValue': [value: Partial<FilterCriteria>]
  'apply': []
  'clear': []
}>()

// Local state for filter values (not applied until user clicks Apply)
const selectedNetworks = ref<string[]>([])
const startDate = ref<Date | null>(null)
const endDate = ref<Date | null>(null)

// IMSI filter mode and values
const imsiMode = ref<ImsiFilterMode>('single')
const singleImsi = ref('')
const multipleImsis = ref<string[]>([''])
const imsiRangeFrom = ref('')
const imsiRangeTo = ref('')

// Network options with carrier labels
const networkOptions = ref<Array<{ value: string; label: string }>>([])

// Panel collapsed state
const isCollapsed = ref(false)

// IMSI mode options
const imsiModeOptions = [
  { label: 'Single', value: 'single' },
  { label: 'Multiple', value: 'multiple' },
  { label: 'Range', value: 'range' }
]

// Get current IMSI values based on mode
const currentImsis = computed(() => {
  switch (imsiMode.value) {
    case 'single':
      return singleImsi.value.trim() ? [singleImsi.value.trim()] : []
    case 'multiple':
      return multipleImsis.value.filter(imsi => imsi.trim())
    case 'range':
      return [] // Range is handled separately
    default:
      return []
  }
})

// Get current IMSI range
const currentImsiRange = computed<ImsiRange | undefined>(() => {
  if (imsiMode.value === 'range' && imsiRangeFrom.value.trim() && imsiRangeTo.value.trim()) {
    return {
      from: imsiRangeFrom.value.trim(),
      to: imsiRangeTo.value.trim()
    }
  }
  return undefined
})

// Track if filters have been modified
const hasChanges = computed(() => {
  const currentNetworks = props.modelValue.networks || []
  const currentDateRange = props.modelValue.dateRange
  const currentImsiMode = props.modelValue.imsiMode || 'single'
  const currentImsiList = props.modelValue.imsis || []
  const currentRange = props.modelValue.imsiRange

  const networksChanged = JSON.stringify([...selectedNetworks.value].sort()) !==
                          JSON.stringify([...currentNetworks].sort())

  const dateChanged = (startDate.value?.getTime() !== currentDateRange?.start?.getTime()) ||
                      (endDate.value?.getTime() !== currentDateRange?.end?.getTime())

  const modeChanged = imsiMode.value !== currentImsiMode

  const imsisChanged = JSON.stringify([...currentImsis.value].sort()) !==
                       JSON.stringify([...currentImsiList].sort())

  const rangeChanged = currentImsiRange.value?.from !== currentRange?.from ||
                       currentImsiRange.value?.to !== currentRange?.to

  return networksChanged || dateChanged || modeChanged || imsisChanged || rangeChanged
})

// Active filter count for badge
const activeFilterCount = computed(() => {
  let count = 0
  count += props.modelValue.networks?.length || 0
  count += props.modelValue.dateRange ? 1 : 0
  if (props.modelValue.imsiMode === 'range' && props.modelValue.imsiRange) {
    count += 1
  } else {
    count += props.modelValue.imsis?.length || 0
  }
  return count
})

// Load network options from available MCCMNCs
const loadNetworkOptions = async () => {
  if (props.availableMccmncs.length > 0) {
    await lookupMccmnc(props.availableMccmncs)
    networkOptions.value = props.availableMccmncs.map(mccmnc => ({
      value: mccmnc,
      label: formatMccmncLabel(mccmnc)
    }))
  } else {
    const cached = getAllCachedMappings()
    networkOptions.value = cached.map((mapping: NetworkMapping) => ({
      value: mapping.mccmnc,
      label: `${mapping.carrierName} (${mapping.mccmnc})`
    }))
  }
}

// Add new IMSI row for multiple mode
const addImsiRow = () => {
  multipleImsis.value.push('')
}

// Remove IMSI row
const removeImsiRow = (index: number) => {
  if (multipleImsis.value.length > 1) {
    multipleImsis.value.splice(index, 1)
  } else {
    multipleImsis.value = ['']
  }
}

// Validate IMSI format (15 digits)
const isValidImsi = (imsi: string): boolean => {
  return /^\d{15}$/.test(imsi.trim())
}

// Check if range is valid (from <= to)
const isValidRange = computed(() => {
  if (imsiMode.value !== 'range') return true
  if (!imsiRangeFrom.value.trim() || !imsiRangeTo.value.trim()) return true
  return imsiRangeFrom.value.trim() <= imsiRangeTo.value.trim()
})

// Apply filters
const applyFilters = () => {
  const updatedFilters: Partial<FilterCriteria> = {
    ...props.modelValue,
    networks: [...selectedNetworks.value],
    imsiMode: imsiMode.value,
    imsis: currentImsis.value,
    imsiRange: currentImsiRange.value
  }

  // Add date range if both dates are set
  if (startDate.value && endDate.value) {
    updatedFilters.dateRange = {
      start: startDate.value,
      end: endDate.value
    }
  } else {
    updatedFilters.dateRange = undefined
  }

  emit('update:modelValue', updatedFilters)
  emit('apply')
}

// Clear filters
const clearFilters = () => {
  selectedNetworks.value = []
  startDate.value = null
  endDate.value = null
  imsiMode.value = 'single'
  singleImsi.value = ''
  multipleImsis.value = ['']
  imsiRangeFrom.value = ''
  imsiRangeTo.value = ''

  emit('update:modelValue', {
    ...props.modelValue,
    networks: [],
    dateRange: undefined,
    imsiMode: 'single',
    imsis: [],
    imsiRange: undefined
  })
  emit('clear')
}

// Sync local state with prop value
watch(() => props.modelValue, (newValue) => {
  selectedNetworks.value = [...(newValue.networks || [])]

  if (newValue.dateRange) {
    startDate.value = new Date(newValue.dateRange.start)
    endDate.value = new Date(newValue.dateRange.end)
  }

  imsiMode.value = newValue.imsiMode || 'single'

  if (newValue.imsiMode === 'single') {
    singleImsi.value = newValue.imsis?.[0] || ''
  } else if (newValue.imsiMode === 'multiple') {
    multipleImsis.value = newValue.imsis?.length ? [...newValue.imsis] : ['']
  } else if (newValue.imsiMode === 'range' && newValue.imsiRange) {
    imsiRangeFrom.value = newValue.imsiRange.from
    imsiRangeTo.value = newValue.imsiRange.to
  }
}, { immediate: true, deep: true })

// Watch for available MCCMNCs changes
watch(() => props.availableMccmncs, loadNetworkOptions, { immediate: true })

onMounted(loadNetworkOptions)
</script>

<template>
  <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
    <!-- Header (always visible) -->
    <button
      @click="isCollapsed = !isCollapsed"
      :aria-expanded="!isCollapsed"
      aria-controls="filter-panel-content"
      class="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-dark-highlight transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
    >
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-purple-400">filter_list</span>
        <h3 class="text-white font-semibold">Advanced Filters</h3>
        <span
          v-if="activeFilterCount > 0"
          class="px-2 py-0.5 text-xs rounded-full bg-primary text-white"
        >
          {{ activeFilterCount }}
        </span>
      </div>
      <span
        class="material-symbols-outlined text-text-secondary transition-transform"
        :class="{ 'rotate-180': !isCollapsed }"
      >
        expand_more
      </span>
    </button>

    <!-- Collapsible Content -->
    <Transition name="collapse">
      <div v-if="!isCollapsed" id="filter-panel-content" class="px-5 pb-5 space-y-4">

        <!-- Date Range Section -->
        <div class="space-y-3">
          <label class="block text-sm text-text-secondary font-medium">
            <span class="material-symbols-outlined text-sm align-middle mr-1">calendar_month</span>
            Date Range
          </label>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-text-secondary mb-1">Start Date</label>
              <DatePicker
                v-model="startDate"
                :disabled="disabled"
                placeholder="Select start date"
                dateFormat="yy-mm-dd"
                showIcon
                class="w-full"
                :pt="{
                  root: { class: 'w-full' },
                  input: { class: 'bg-background-dark text-white border-border-dark w-full text-sm' },
                  panel: { class: 'bg-surface-dark border-border-dark' },
                  header: { class: 'bg-surface-dark text-white' },
                  title: { class: 'text-white' },
                  dayLabel: { class: 'text-white hover:bg-primary' },
                  monthTitle: { class: 'text-white' },
                  yearTitle: { class: 'text-white' }
                }"
              />
            </div>
            <div>
              <label class="block text-xs text-text-secondary mb-1">End Date</label>
              <DatePicker
                v-model="endDate"
                :disabled="disabled"
                :minDate="startDate || undefined"
                placeholder="Select end date"
                dateFormat="yy-mm-dd"
                showIcon
                class="w-full"
                :pt="{
                  root: { class: 'w-full' },
                  input: { class: 'bg-background-dark text-white border-border-dark w-full text-sm' },
                  panel: { class: 'bg-surface-dark border-border-dark' },
                  header: { class: 'bg-surface-dark text-white' },
                  title: { class: 'text-white' },
                  dayLabel: { class: 'text-white hover:bg-primary' },
                  monthTitle: { class: 'text-white' },
                  yearTitle: { class: 'text-white' }
                }"
              />
            </div>
          </div>
        </div>

        <!-- Network (MCCMNC) Filter -->
        <div>
          <label class="block text-sm text-text-secondary mb-2 font-medium">
            <span class="material-symbols-outlined text-sm align-middle mr-1">cell_tower</span>
            Network (MCCMNC)
          </label>
          <MultiSelect
            v-model="selectedNetworks"
            :options="networkOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select networks..."
            :disabled="disabled"
            :maxSelectedLabels="3"
            :showToggleAll="true"
            filter
            filterPlaceholder="Search networks..."
            class="w-full dark-multiselect"
          >
            <template #chip="{ value }">
              <span class="text-xs">{{ formatMccmncLabel(value) }}</span>
            </template>
          </MultiSelect>
        </div>

        <!-- IMSI Filter Section -->
        <div class="space-y-3">
          <label class="block text-sm text-text-secondary font-medium">
            <span class="material-symbols-outlined text-sm align-middle mr-1">sim_card</span>
            IMSI Filter
          </label>

          <!-- IMSI Mode Selector -->
          <div class="flex gap-1">
            <button
              v-for="option in imsiModeOptions"
              :key="option.value"
              @click="imsiMode = option.value as ImsiFilterMode"
              :disabled="disabled"
              :class="[
                'px-3 py-1.5 text-xs rounded-md transition-colors',
                imsiMode === option.value
                  ? 'bg-primary text-white'
                  : 'bg-background-dark text-text-secondary hover:text-white border border-border-dark'
              ]"
            >
              {{ option.label }}
            </button>
          </div>

          <!-- Single IMSI Mode -->
          <div v-if="imsiMode === 'single'">
            <InputText
              v-model="singleImsi"
              :disabled="disabled"
              placeholder="Enter IMSI (15 digits)"
              class="w-full"
              :pt="{
                root: { class: 'bg-background-dark text-white border-border-dark w-full' }
              }"
            />
            <p v-if="singleImsi && !isValidImsi(singleImsi)" class="text-xs text-red-400 mt-1">
              IMSI must be 15 digits
            </p>
          </div>

          <!-- Multiple IMSI Mode -->
          <div v-else-if="imsiMode === 'multiple'" class="space-y-2">
            <div
              v-for="(_imsi, index) in multipleImsis"
              :key="index"
              class="flex items-center gap-2"
            >
              <InputText
                v-model="multipleImsis[index]"
                :disabled="disabled"
                :placeholder="`IMSI ${index + 1} (15 digits)`"
                class="flex-1"
                :pt="{
                  root: { class: 'bg-background-dark text-white border-border-dark w-full' }
                }"
              />
              <button
                @click="removeImsiRow(index)"
                :disabled="disabled"
                class="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
                title="Remove IMSI"
              >
                <span class="material-symbols-outlined text-sm">remove_circle</span>
              </button>
            </div>
            <button
              @click="addImsiRow"
              :disabled="disabled"
              class="flex items-center gap-1 text-primary hover:text-primary-light text-sm transition-colors"
            >
              <span class="material-symbols-outlined text-sm">add_circle</span>
              Add another IMSI
            </button>
          </div>

          <!-- Range IMSI Mode -->
          <div v-else-if="imsiMode === 'range'" class="space-y-2">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-text-secondary mb-1">From IMSI</label>
                <InputText
                  v-model="imsiRangeFrom"
                  :disabled="disabled"
                  placeholder="Start IMSI"
                  class="w-full"
                  :pt="{
                    root: { class: 'bg-background-dark text-white border-border-dark w-full' }
                  }"
                />
              </div>
              <div>
                <label class="block text-xs text-text-secondary mb-1">To IMSI</label>
                <InputText
                  v-model="imsiRangeTo"
                  :disabled="disabled"
                  placeholder="End IMSI"
                  class="w-full"
                  :pt="{
                    root: { class: 'bg-background-dark text-white border-border-dark w-full' }
                  }"
                />
              </div>
            </div>
            <p v-if="!isValidRange" class="text-xs text-red-400">
              "From" IMSI must be less than or equal to "To" IMSI
            </p>
            <p class="text-xs text-text-secondary">
              All IMSIs in this range will be included in the filter
            </p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-end gap-3 pt-3 border-t border-border-dark">
          <Button
            label="Clear All"
            severity="secondary"
            outlined
            size="small"
            :disabled="disabled || activeFilterCount === 0"
            @click="clearFilters"
            :pt="{
              root: { class: 'border-border-dark text-text-secondary hover:text-white' }
            }"
          />
          <Button
            label="Apply Filters"
            severity="primary"
            size="small"
            :disabled="disabled || !hasChanges || !isValidRange"
            @click="applyFilters"
            :pt="{
              root: { class: 'bg-primary hover:bg-primary-dark' }
            }"
          >
            <template #icon>
              <span class="material-symbols-outlined text-sm mr-1">check</span>
            </template>
          </Button>
        </div>

        <!-- Validation message -->
        <p
          v-if="hasChanges"
          class="text-xs text-amber-400 flex items-center gap-1"
        >
          <span class="material-symbols-outlined text-sm">info</span>
          Click "Apply Filters" to update results
        </p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Collapse transition */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  max-height: 800px;
}

/* PrimeVue dark theme overrides - MultiSelect */
:deep(.dark-multiselect) {
  background-color: #1a1f25 !important;
  border-color: #3b4754 !important;
  color: #f3f4f6 !important;
}

:deep(.dark-multiselect .p-multiselect-label) {
  color: #f3f4f6 !important;
  padding: 0.5rem 0.75rem;
}

:deep(.dark-multiselect .p-multiselect-label.p-placeholder) {
  color: #9ca3af !important;
}

:deep(.dark-multiselect .p-multiselect-trigger) {
  background-color: transparent !important;
  color: #9ca3af !important;
}

:deep(.dark-multiselect .p-multiselect-clear-icon) {
  color: #9ca3af !important;
}

:deep(.dark-multiselect:not(.p-disabled):hover) {
  border-color: #137fec !important;
}

:deep(.dark-multiselect:not(.p-disabled).p-focus) {
  border-color: #137fec !important;
  box-shadow: 0 0 0 2px rgba(19, 127, 236, 0.2) !important;
}

:deep(.dark-multiselect .p-multiselect-chip) {
  background-color: #137fec !important;
  color: white !important;
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
  margin: 0.125rem;
}

/* MultiSelect Panel/Dropdown */
:deep(.p-multiselect-panel) {
  background-color: #232a33 !important;
  border: 1px solid #3b4754 !important;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
}

:deep(.p-multiselect-header) {
  background-color: #232a33 !important;
  border-bottom: 1px solid #3b4754 !important;
  padding: 0.75rem;
}

:deep(.p-multiselect-filter-container .p-multiselect-filter) {
  background-color: #1a1f25 !important;
  border-color: #3b4754 !important;
  color: #f3f4f6 !important;
}

:deep(.p-multiselect-filter-container .p-multiselect-filter::placeholder) {
  color: #9ca3af !important;
}

:deep(.p-multiselect-items-wrapper) {
  background-color: #232a33 !important;
}

:deep(.p-multiselect-items) {
  padding: 0.5rem 0 !important;
}

:deep(.p-multiselect-item) {
  color: #f3f4f6 !important;
  background-color: transparent !important;
  padding: 0.5rem 1rem !important;
  margin: 0 !important;
}

:deep(.p-multiselect-item:hover) {
  background-color: #283039 !important;
}

:deep(.p-multiselect-item.p-highlight) {
  background-color: rgba(19, 127, 236, 0.2) !important;
  color: #137fec !important;
}

:deep(.p-multiselect-item .p-checkbox) {
  margin-right: 0.5rem;
}

:deep(.p-multiselect-item .p-checkbox .p-checkbox-box) {
  background-color: #1a1f25 !important;
  border-color: #3b4754 !important;
}

:deep(.p-multiselect-item .p-checkbox .p-checkbox-box.p-highlight) {
  background-color: #137fec !important;
  border-color: #137fec !important;
}

:deep(.p-multiselect-close) {
  color: #9ca3af !important;
}

:deep(.p-multiselect-close:hover) {
  background-color: #283039 !important;
  color: #f3f4f6 !important;
}

/* Toggle All checkbox */
:deep(.p-multiselect-header .p-checkbox .p-checkbox-box) {
  background-color: #1a1f25 !important;
  border-color: #3b4754 !important;
}

:deep(.p-multiselect-header .p-checkbox .p-checkbox-box.p-highlight) {
  background-color: #137fec !important;
  border-color: #137fec !important;
}

:deep(.p-inputtext) {
  background-color: var(--color-background-dark, #1a1f25);
  border-color: var(--color-border-dark, #3b4754);
  color: var(--color-text-primary, #f3f4f6);
}

:deep(.p-datepicker) {
  background-color: var(--color-surface-dark, #232a33);
  border-color: var(--color-border-dark, #3b4754);
}

:deep(.p-datepicker-header) {
  background-color: var(--color-surface-dark, #232a33);
  color: var(--color-text-primary, #f3f4f6);
}

:deep(.p-datepicker-title) {
  color: var(--color-text-primary, #f3f4f6);
}

:deep(.p-datepicker table td > span) {
  color: var(--color-text-primary, #f3f4f6);
}

:deep(.p-datepicker table td > span:hover) {
  background-color: var(--color-primary, #137fec);
}

:deep(.p-datepicker table td.p-datepicker-today > span) {
  background-color: var(--color-surface-dark-highlight, #283039);
}

:deep(.p-datepicker-trigger) {
  color: var(--color-text-secondary, #9ca3af);
}
</style>

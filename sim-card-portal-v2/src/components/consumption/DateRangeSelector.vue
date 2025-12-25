<script setup lang="ts">
import { ref, computed } from 'vue'

interface DateRange {
  start: string
  end: string
}

const props = defineProps<{
  initialRange: DateRange
}>()

const emit = defineEmits<{
  (e: 'change', range: DateRange): void
}>()

const selectedPreset = ref('thisMonth')
const customStart = ref(props.initialRange.start)
const customEnd = ref(props.initialRange.end)
const showCustom = ref(false)

const presets = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'last30', label: 'Last 30 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'last3Months', label: 'Last 3 Months' },
  { id: 'last6Months', label: 'Last 6 Months' },
  { id: 'thisYear', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' }
]

const getPresetRange = (presetId: string): DateRange => {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  switch (presetId) {
    case 'today':
      return { start: today, end: today }
    case 'yesterday': {
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      const yest = yesterday.toISOString().split('T')[0]
      return { start: yest, end: yest }
    }
    case 'last7': {
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      return { start: start.toISOString().split('T')[0], end: today }
    }
    case 'last30': {
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      return { start: start.toISOString().split('T')[0], end: today }
    }
    case 'thisMonth':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
        end: today
      }
    case 'lastMonth': {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      return {
        start: lastMonth.toISOString().split('T')[0],
        end: lastMonthEnd.toISOString().split('T')[0]
      }
    }
    case 'last3Months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      return { start: start.toISOString().split('T')[0], end: today }
    }
    case 'last6Months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 6, 1)
      return { start: start.toISOString().split('T')[0], end: today }
    }
    case 'thisYear':
      return {
        start: new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0],
        end: today
      }
    default:
      return { start: customStart.value, end: customEnd.value }
  }
}

const displayLabel = computed(() => {
  if (selectedPreset.value === 'custom') {
    return `${customStart.value} - ${customEnd.value}`
  }
  return presets.find(p => p.id === selectedPreset.value)?.label || 'Select Range'
})

const handlePresetSelect = (presetId: string) => {
  selectedPreset.value = presetId
  if (presetId === 'custom') {
    showCustom.value = true
  } else {
    showCustom.value = false
    const range = getPresetRange(presetId)
    emit('change', range)
  }
}

const applyCustomRange = () => {
  showCustom.value = false
  emit('change', { start: customStart.value, end: customEnd.value })
}

const dropdownOpen = ref(false)
</script>

<template>
  <div class="relative">
    <button
      @click="dropdownOpen = !dropdownOpen"
      class="flex items-center gap-2 px-4 py-2 bg-surface-dark-highlight border border-border-dark rounded-lg text-white hover:border-primary/50 transition-colors min-w-[180px]"
    >
      <span class="material-symbols-outlined text-[18px] text-primary">calendar_month</span>
      <span class="text-sm truncate">{{ displayLabel }}</span>
      <span class="material-symbols-outlined text-[18px] ml-auto">expand_more</span>
    </button>

    <!-- Dropdown -->
    <Transition name="fade">
      <div
        v-if="dropdownOpen"
        class="absolute right-0 top-full mt-2 w-64 bg-surface-dark border border-border-dark rounded-xl shadow-xl z-50 overflow-hidden"
      >
        <!-- Preset Options -->
        <div class="p-2">
          <button
            v-for="preset in presets"
            :key="preset.id"
            @click="handlePresetSelect(preset.id)"
            :class="[
              'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
              selectedPreset === preset.id
                ? 'bg-primary/20 text-primary'
                : 'text-white hover:bg-surface-dark-highlight'
            ]"
          >
            {{ preset.label }}
          </button>
        </div>

        <!-- Custom Range Inputs -->
        <div v-if="showCustom || selectedPreset === 'custom'" class="border-t border-border-dark p-4 space-y-3">
          <div>
            <label class="block text-xs text-text-secondary mb-1">Start Date</label>
            <input
              type="date"
              v-model="customStart"
              class="w-full px-3 py-2 bg-background-dark border border-border-dark rounded-lg text-white text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-xs text-text-secondary mb-1">End Date</label>
            <input
              type="date"
              v-model="customEnd"
              class="w-full px-3 py-2 bg-background-dark border border-border-dark rounded-lg text-white text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <button
            @click="applyCustomRange"
            class="w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            Apply Range
          </button>
        </div>
      </div>
    </Transition>

    <!-- Backdrop -->
    <div
      v-if="dropdownOpen"
      @click="dropdownOpen = false"
      class="fixed inset-0 z-40"
    ></div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

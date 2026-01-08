<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TimeGranularity } from '@/types/analytics'

interface Props {
  modelValue: TimeGranularity
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: TimeGranularity]
}>()

// View mode options with labels and descriptions
const viewModes: Array<{ id: TimeGranularity; label: string; description: string }> = [
  { id: '24h', label: '24h', description: 'Last 24 hours' },
  { id: 'daily', label: 'Daily', description: 'Last 7 days' },
  { id: 'weekly', label: 'Weekly', description: 'Last 5 weeks' },
  { id: 'monthly', label: 'Monthly', description: 'Last 6 months' }
]

// Get current view description
const currentViewDescription = computed(() => {
  const mode = viewModes.find(m => m.id === props.modelValue)
  return mode?.description || ''
})

// Debounce flag to prevent rapid clicks
const isProcessing = ref(false)

const selectMode = (mode: TimeGranularity) => {
  if (!props.disabled && props.modelValue !== mode && !isProcessing.value) {
    isProcessing.value = true
    emit('update:modelValue', mode)
    // Allow next click after 500ms - balances responsiveness with preventing excessive API calls
    setTimeout(() => {
      isProcessing.value = false
    }, 500)
  }
}
</script>

<template>
  <div class="flex items-center gap-3">
    <!-- Toggle Buttons -->
    <div
      role="group"
      aria-label="Time granularity selection"
      class="flex items-center gap-1 bg-background-dark rounded-lg p-1"
    >
      <button
        v-for="mode in viewModes"
        :key="mode.id"
        type="button"
        @click="selectMode(mode.id)"
        :disabled="disabled"
        :aria-pressed="modelValue === mode.id"
        :aria-label="`${mode.label}: ${mode.description}`"
        :class="[
          'px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-background-dark',
          modelValue === mode.id
            ? 'bg-primary text-white'
            : disabled
              ? 'text-text-secondary/50 cursor-not-allowed'
              : 'text-text-secondary hover:text-white cursor-pointer'
        ]"
        :title="mode.description"
      >
        {{ mode.label }}
      </button>
    </div>

    <!-- Description text (optional, shown on larger screens) -->
    <span class="hidden lg:inline text-xs text-text-secondary">
      {{ currentViewDescription }}
    </span>
  </div>
</template>

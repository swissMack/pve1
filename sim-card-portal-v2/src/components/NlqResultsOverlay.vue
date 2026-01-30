<script setup lang="ts">
import { computed } from 'vue'
import type { NlqQueryResponse } from '../types/nlq'

interface Props {
  response: NlqQueryResponse
  query: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

// Extract column names from results
const columns = computed(() => {
  if (!props.response.results || props.response.results.length === 0) return []
  return Object.keys(props.response.results[0])
})

// Format cell value for display
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
    return new Date(value).toLocaleString()
  }
  return String(value)
}

// Friendly column header
function formatHeader(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .replace(/Id$/, 'ID')
}

// Entity badge color
const entityColor = computed(() => {
  const map: Record<string, string> = {
    devices: 'bg-blue-500/20 text-blue-400',
    sim_cards: 'bg-teal-500/20 text-teal-400',
    assets: 'bg-purple-500/20 text-purple-400',
    geozones: 'bg-green-500/20 text-green-400',
    alerts: 'bg-red-500/20 text-red-400',
    alert_rules: 'bg-amber-500/20 text-amber-400',
    notifications: 'bg-indigo-500/20 text-indigo-400'
  }
  return map[props.response.intent?.entity] || 'bg-gray-500/20 text-gray-400'
})
</script>

<template>
  <div class="bg-surface-dark border border-border-dark rounded-xl overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-border-dark">
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-primary">search_insights</span>
        <div>
          <h3 class="text-sm font-semibold text-white">Query Results</h3>
          <p class="text-xs text-text-secondary truncate max-w-[300px]">"{{ query }}"</p>
        </div>
      </div>
      <button @click="emit('close')" class="p-1 text-text-secondary hover:text-white transition-colors">
        <span class="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>

    <!-- Intent Summary -->
    <div class="px-4 py-3 border-b border-border-dark bg-surface-dark-highlight/50">
      <div class="flex flex-wrap items-center gap-2 mb-2">
        <span :class="['text-xs px-2 py-0.5 rounded-full font-medium', entityColor]">
          {{ response.intent?.entity?.replace('_', ' ') }}
        </span>
        <span v-if="response.intent?.filters?.length" class="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">
          {{ response.intent.filters.length }} filter{{ response.intent.filters.length > 1 ? 's' : '' }}
        </span>
        <span class="text-xs text-text-secondary ml-auto">
          {{ response.totalCount }} result{{ response.totalCount !== 1 ? 's' : '' }} · {{ response.executionTimeMs }}ms
        </span>
      </div>
      <p class="text-xs text-text-secondary">{{ response.explanation }}</p>
    </div>

    <!-- Results Table -->
    <div v-if="response.results && response.results.length > 0" class="overflow-x-auto max-h-[400px] overflow-y-auto">
      <table class="w-full text-sm">
        <thead class="sticky top-0 bg-surface-dark z-10">
          <tr>
            <th
              v-for="col in columns"
              :key="col"
              class="text-left px-3 py-2 text-xs font-medium text-text-secondary border-b border-border-dark whitespace-nowrap"
            >
              {{ formatHeader(col) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in response.results"
            :key="idx"
            class="border-b border-border-dark/50 hover:bg-surface-dark-highlight/30 transition-colors"
          >
            <td
              v-for="col in columns"
              :key="col"
              class="px-3 py-2 text-text-primary whitespace-nowrap max-w-[200px] truncate"
              :title="formatCell(row[col])"
            >
              {{ formatCell(row[col]) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- No Results -->
    <div v-else class="px-4 py-8 text-center">
      <span class="material-symbols-outlined text-4xl text-text-secondary mb-2">search_off</span>
      <p class="text-sm text-text-secondary">No results found for this query.</p>
    </div>
  </div>
</template>

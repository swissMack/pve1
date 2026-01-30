<script setup lang="ts">
import { ref } from 'vue'
import { queryNlq } from '../services/nlqService'
import type { NlqQueryResponse } from '../types/nlq'
import NlqResultsOverlay from './NlqResultsOverlay.vue'

const query = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const nlqResponse = ref<NlqQueryResponse | null>(null)
const lastQuery = ref('')

const suggestions = [
  'Show offline devices',
  'List active SIM cards',
  'Critical alerts this week',
  'Assets in maintenance',
  'Low battery devices',
  'Expired SIM cards'
]

async function handleSubmit() {
  const q = query.value.trim()
  if (!q || loading.value) return

  loading.value = true
  error.value = null
  nlqResponse.value = null
  lastQuery.value = q

  try {
    const result = await queryNlq(q)
    if (result.success && result.data) {
      nlqResponse.value = result.data
    } else {
      error.value = result.error || 'Failed to process query'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'An unexpected error occurred'
  } finally {
    loading.value = false
  }
}

function handleSuggestion(suggestion: string) {
  query.value = suggestion
  handleSubmit()
}

function handleClear() {
  nlqResponse.value = null
  error.value = null
  query.value = ''
  lastQuery.value = ''
}
</script>

<template>
  <div class="w-full">
    <!-- Search Bar -->
    <div class="relative">
      <div class="flex items-center gap-2 bg-surface-dark border border-border-dark rounded-xl px-4 py-2.5 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
        <span class="material-symbols-outlined text-primary text-[20px]">smart_toy</span>
        <input
          v-model="query"
          type="text"
          placeholder="Ask Bob... e.g. &quot;Show offline devices&quot;"
          class="flex-1 bg-transparent text-white text-sm placeholder-text-secondary outline-none"
          maxlength="500"
          @keydown.enter="handleSubmit"
        />
        <button
          v-if="query || nlqResponse"
          @click="handleClear"
          class="p-1 text-text-secondary hover:text-white transition-colors"
        >
          <span class="material-symbols-outlined text-[18px]">close</span>
        </button>
        <button
          @click="handleSubmit"
          :disabled="!query.trim() || loading"
          class="px-3 py-1 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <span v-if="loading" class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
          <span v-else>Ask</span>
        </button>
      </div>
    </div>

    <!-- Suggestion Chips -->
    <div v-if="!nlqResponse && !loading && !error" class="flex flex-wrap gap-2 mt-3">
      <button
        v-for="s in suggestions"
        :key="s"
        @click="handleSuggestion(s)"
        class="text-xs px-3 py-1.5 rounded-full bg-surface-dark-highlight text-text-secondary hover:text-primary hover:bg-primary/10 border border-border-dark hover:border-primary/30 transition-colors"
      >
        {{ s }}
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="mt-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
      <span class="material-symbols-outlined text-[18px]">error</span>
      {{ error }}
      <button @click="error = null" class="ml-auto text-red-400/60 hover:text-red-400">
        <span class="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="mt-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10 text-primary text-sm flex items-center gap-2">
      <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
      Bob is analyzing your query...
    </div>

    <!-- Results Overlay -->
    <div v-if="nlqResponse" class="mt-3">
      <NlqResultsOverlay
        :response="nlqResponse"
        :query="lastQuery"
        @close="handleClear"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage } from '../types/nlq'

interface Props {
  message: ChatMessage
}

defineProps<Props>()

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div
    class="flex gap-3 mb-4"
    :class="message.role === 'user' ? 'flex-row-reverse' : 'flex-row'"
  >
    <!-- Avatar -->
    <div
      class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
      :class="message.role === 'user' ? 'bg-primary text-white' : 'bg-teal-500/20 text-teal-400'"
    >
      <span v-if="message.role === 'user'" class="material-symbols-outlined text-[16px]">person</span>
      <span v-else class="material-symbols-outlined text-[16px]">smart_toy</span>
    </div>

    <!-- Message Bubble -->
    <div
      class="max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed"
      :class="message.role === 'user'
        ? 'bg-primary text-white rounded-tr-sm'
        : 'bg-surface-dark-highlight text-text-primary border border-border-dark rounded-tl-sm'"
    >
      <div class="whitespace-pre-wrap break-words">{{ message.content }}</div>
      <div
        class="text-[10px] mt-1 opacity-60"
        :class="message.role === 'user' ? 'text-right text-white/70' : 'text-right text-text-secondary'"
      >
        {{ formatTime(message.createdAt) }}
      </div>
    </div>
  </div>
</template>

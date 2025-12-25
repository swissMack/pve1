<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'

interface UserContext {
  username: string
  role: string
  email: string
}

interface Action {
  id: string
  type: 'update' | 'create' | 'delete'
  resource: 'device' | 'simcard' | 'user'
  resourceId?: string
  changes: Record<string, unknown>
  description: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: Action[]
  timestamp: Date
}

const props = defineProps<{
  userContext: UserContext | null
}>()

const emit = defineEmits<{
  (e: 'actionExecuted', result: unknown): void
}>()

const isLoading = ref(false)
const showResponse = ref(false)
const inputMessage = ref('')
const messages = ref<Message[]>([])
const messagesContainer = ref<HTMLElement | null>(null)
const copiedMessageId = ref<string | null>(null)

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Scroll to bottom of messages
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Watch messages and scroll
watch(messages, scrollToBottom, { deep: true })

// Get the last assistant message for footer actions
const lastAssistantMessage = computed(() => {
  const assistantMessages = messages.value.filter(m => m.role === 'assistant')
  return assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1] : null
})

// Send message to LLM
const sendMessage = async () => {
  if (!inputMessage.value.trim() || !props.userContext || isLoading.value) return

  const userMessage: Message = {
    id: crypto.randomUUID(),
    role: 'user',
    content: inputMessage.value.trim(),
    timestamp: new Date()
  }

  messages.value.push(userMessage)
  const messageText = inputMessage.value.trim()
  inputMessage.value = ''
  isLoading.value = true
  showResponse.value = true

  try {
    const response = await fetch(`${API_BASE}/api/llm/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: messageText,
        userContext: props.userContext
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to send message')
    }

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: data.message,
      actions: data.actions,
      timestamp: new Date()
    }

    messages.value.push(assistantMessage)
  } catch (error) {
    const errorMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `Error: ${error instanceof Error ? error.message : 'Failed to process message'}`,
      timestamp: new Date()
    }
    messages.value.push(errorMessage)
  } finally {
    isLoading.value = false
  }
}

// Execute or reject an action
const handleAction = async (action: Action, approved: boolean, messageId: string) => {
  if (!props.userContext) return

  isLoading.value = true

  try {
    const response = await fetch(`${API_BASE}/api/llm/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionId: action.id,
        approved,
        userContext: props.userContext
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to execute action')
    }

    // Update the message to remove the action (it's been processed)
    const messageIndex = messages.value.findIndex(m => m.id === messageId)
    if (messageIndex !== -1) {
      const msg = messages.value[messageIndex]
      if (msg.actions) {
        msg.actions = msg.actions.filter(a => a.id !== action.id)
      }
    }

    // Add result message
    const resultMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: approved
        ? `Action executed: ${action.description}`
        : `Action rejected: ${action.description}`,
      timestamp: new Date()
    }
    messages.value.push(resultMessage)

    if (approved && data.result) {
      emit('actionExecuted', data.result)
    }
  } catch (error) {
    const errorMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `Error: ${error instanceof Error ? error.message : 'Failed to process action'}`,
      timestamp: new Date()
    }
    messages.value.push(errorMessage)
  } finally {
    isLoading.value = false
  }
}

// Handle Enter key
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
  if (event.key === 'Escape') {
    showResponse.value = false
  }
}

// Clear chat history
const clearChat = () => {
  messages.value = []
  showResponse.value = false
}

// Format change for display
const formatChange = (changes: Record<string, unknown>): string => {
  return Object.entries(changes)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ')
}

// Copy message content to clipboard
const copyToClipboard = async (content: string, messageId: string) => {
  try {
    await navigator.clipboard.writeText(content)
    copiedMessageId.value = messageId
    setTimeout(() => {
      copiedMessageId.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// Convert message content to CSV format
const convertToCSV = (content: string): string => {
  const lines = content.split('\n').filter(line => line.trim())
  const csvLines: string[] = []

  for (const line of lines) {
    // Handle bullet points: "- **SIM001** - Zurich (IoT Sensor Alpha)"
    const bulletMatch = line.match(/^[-•*]\s*\*?\*?([^*]+)\*?\*?\s*[-–]\s*(.+)$/)
    if (bulletMatch) {
      const id = bulletMatch[1].trim().replace(/\*\*/g, '')
      const rest = bulletMatch[2].trim()
      // Try to extract location and device from rest
      const locationMatch = rest.match(/^([^(]+)\s*\(([^)]+)\)/)
      if (locationMatch) {
        csvLines.push(`"${id}","${locationMatch[1].trim()}","${locationMatch[2].trim()}"`)
      } else {
        csvLines.push(`"${id}","${rest}"`)
      }
      continue
    }

    // Handle simple bullet points: "- Item: Value"
    const simpleMatch = line.match(/^[-•*]\s*(.+)$/)
    if (simpleMatch) {
      const parts = simpleMatch[1].split(/:\s*|,\s*/).map(p => p.trim().replace(/\*\*/g, ''))
      csvLines.push(parts.map(p => `"${p}"`).join(','))
      continue
    }

    // Handle lines with colons (key: value pairs)
    if (line.includes(':')) {
      const parts = line.split(/:\s*/).map(p => p.trim().replace(/\*\*/g, ''))
      csvLines.push(parts.map(p => `"${p}"`).join(','))
    }
  }

  return csvLines.join('\n')
}

// Export as CSV file
const exportAsCSV = (content: string, filename: string = 'export') => {
  const csv = convertToCSV(content)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0,10)}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Check if latest response contains consultant referral
const hasConsultantReferral = computed(() => {
  if (!lastAssistantMessage.value) return false
  return lastAssistantMessage.value.content.includes('IoTo consultants can help')
})

// Get the last user message (the question)
const lastUserMessage = computed(() => {
  const userMessages = messages.value.filter(m => m.role === 'user')
  return userMessages.length > 0 ? userMessages[userMessages.length - 1] : null
})

// Send email to IoTo consultants
const contactIoTo = () => {
  if (!lastUserMessage.value || !lastAssistantMessage.value) return

  const subject = encodeURIComponent('IoTo Portal - Consultant Request')
  const question = lastUserMessage.value.content
  const answer = lastAssistantMessage.value.content
  const userName = props.userContext?.username || 'Unknown'
  const userEmail = props.userContext?.email || 'Not provided'

  const body = encodeURIComponent(
`IoTo Portal Consultant Request

User: ${userName}
Email: ${userEmail}

--- Question Asked ---
${question}

--- Ask Bob Response ---
${answer}

---
This request was initiated from the IoTo Portal Ask Bob assistant.
`)

  window.location.href = `mailto:info@ioto-communications.com?subject=${subject}&body=${body}`
}
</script>

<template>
  <div class="relative flex-1 max-w-xl">
    <!-- Search Input Bar -->
    <div class="relative flex items-center">
      <span class="material-symbols-outlined absolute left-3 text-text-secondary text-[20px]">smart_toy</span>
      <input
        v-model="inputMessage"
        type="text"
        :placeholder="userContext ? 'Ask Bob about devices, SIMs, or request changes...' : 'Log in to use Ask Bob'"
        class="w-full h-9 pl-10 pr-20 bg-background-dark border border-border-dark rounded-lg text-sm text-white placeholder-text-secondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-colors"
        :disabled="isLoading || !userContext"
        @keydown="handleKeydown"
        @focus="messages.length > 0 && (showResponse = true)"
      />
      <div class="absolute right-2 flex items-center gap-1">
        <button
          v-if="messages.length > 0"
          @click="clearChat"
          class="p-1 text-text-secondary hover:text-white transition-colors"
          title="Clear history"
        >
          <span class="material-symbols-outlined text-[16px]">delete</span>
        </button>
        <button
          @click="sendMessage"
          :disabled="!inputMessage.trim() || isLoading || !userContext"
          class="p-1.5 rounded bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-dark transition-colors"
          title="Send"
        >
          <span v-if="!isLoading" class="material-symbols-outlined text-[16px]">send</span>
          <ProgressSpinner v-else style="width: 16px; height: 16px" strokeWidth="4" />
        </button>
      </div>
    </div>

    <!-- Response Panel (slides down) -->
    <div
      v-if="showResponse && messages.length > 0"
      class="absolute top-full left-0 right-0 mt-2 bg-surface-dark border border-border-dark rounded-xl shadow-2xl z-[9999] flex flex-col"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-2 border-b border-border-dark bg-background-dark shrink-0">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[18px]">smart_toy</span>
          <span class="text-sm font-medium text-white">Ask Bob</span>
          <span class="text-xs text-text-secondary">({{ userContext?.role }})</span>
        </div>
        <button
          @click="showResponse = false"
          class="p-1 text-text-secondary hover:text-white transition-colors"
          title="Minimize"
        >
          <span class="material-symbols-outlined text-[18px]">expand_less</span>
        </button>
      </div>

      <!-- Messages Area -->
      <div
        ref="messagesContainer"
        class="max-h-80 overflow-y-auto p-3 space-y-3 flex-1"
      >
        <div
          v-for="message in messages"
          :key="message.id"
          :class="[
            'flex',
            message.role === 'user' ? 'justify-end' : 'justify-start'
          ]"
        >
          <div
            :class="[
              'max-w-[90%] rounded-lg px-3 py-2 group relative',
              message.role === 'user'
                ? 'bg-primary text-white'
                : 'bg-surface-dark-highlight text-text-primary border border-border-dark'
            ]"
          >
            <p class="text-sm whitespace-pre-wrap">{{ message.content }}</p>

            <!-- Action Cards -->
            <div v-if="message.actions && message.actions.length > 0" class="mt-2 space-y-2">
              <div
                v-for="action in message.actions"
                :key="action.id"
                class="bg-background-dark rounded-lg p-2 border border-border-dark"
              >
                <div class="flex items-center gap-2 mb-1">
                  <span
                    class="material-symbols-outlined text-sm"
                    :class="{
                      'text-blue-400': action.type === 'update',
                      'text-green-400': action.type === 'create',
                      'text-red-400': action.type === 'delete'
                    }"
                  >
                    {{ action.type === 'update' ? 'edit' : action.type === 'create' ? 'add' : 'delete' }}
                  </span>
                  <span class="text-xs font-medium text-white capitalize">
                    {{ action.type }} {{ action.resource }}
                  </span>
                </div>

                <p class="text-xs text-text-secondary mb-1">{{ action.description }}</p>

                <div class="text-xs text-text-secondary bg-surface-dark rounded px-2 py-1 mb-2 font-mono">
                  {{ formatChange(action.changes) }}
                </div>

                <div class="flex gap-2">
                  <Button
                    label="Approve"
                    size="small"
                    severity="success"
                    outlined
                    @click="handleAction(action, true, message.id)"
                    :disabled="isLoading"
                    class="flex-1 !py-1 !text-xs"
                  />
                  <Button
                    label="Reject"
                    size="small"
                    severity="danger"
                    outlined
                    @click="handleAction(action, false, message.id)"
                    :disabled="isLoading"
                    class="flex-1 !py-1 !text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading indicator -->
        <div v-if="isLoading" class="flex justify-start">
          <div class="bg-surface-dark-highlight rounded-lg px-3 py-2 border border-border-dark">
            <ProgressSpinner style="width: 18px; height: 18px" strokeWidth="4" />
          </div>
        </div>
      </div>

      <!-- Footer with Copy/Export/Contact buttons for latest response -->
      <div
        v-if="lastAssistantMessage"
        class="flex items-center gap-2 px-4 py-2 border-t border-border-dark bg-background-dark shrink-0"
      >
        <span class="text-xs text-text-secondary">Actions:</span>
        <button
          @click="copyToClipboard(lastAssistantMessage.content, lastAssistantMessage.id)"
          class="flex items-center gap-1.5 px-2 py-1 bg-surface-dark border border-border-dark rounded transition-colors"
          :class="copiedMessageId === lastAssistantMessage.id ? 'text-green-400 border-green-400/50' : 'text-text-secondary hover:text-white hover:bg-primary/20 hover:border-primary/50'"
          :title="copiedMessageId === lastAssistantMessage.id ? 'Copied!' : 'Copy to clipboard'"
        >
          <span class="material-symbols-outlined text-[14px]">{{ copiedMessageId === lastAssistantMessage.id ? 'check' : 'content_copy' }}</span>
          <span class="text-xs">{{ copiedMessageId === lastAssistantMessage.id ? 'Copied' : 'Copy' }}</span>
        </button>
        <button
          v-if="lastAssistantMessage.content"
          @click="exportAsCSV(lastAssistantMessage.content, 'askbob_data')"
          class="flex items-center gap-1.5 px-2 py-1 bg-surface-dark border border-border-dark rounded text-text-secondary hover:text-white hover:bg-green-500/20 hover:border-green-500/50 transition-colors"
          title="Export as CSV"
        >
          <span class="material-symbols-outlined text-[14px]">download</span>
          <span class="text-xs">Export CSV</span>
        </button>
        <!-- Contact IoTo button (shown when consultant referral is in response) -->
        <button
          v-if="hasConsultantReferral"
          @click="contactIoTo"
          class="flex items-center gap-1.5 px-3 py-1.5 ml-auto bg-primary border border-primary rounded text-white hover:bg-primary-dark transition-colors"
          title="Email IoTo consultants with your question"
        >
          <span class="material-symbols-outlined text-[14px]">mail</span>
          <span class="text-xs font-medium">Contact IoTo</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom scrollbar for messages */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: var(--border-dark);
  border-radius: 3px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
</style>

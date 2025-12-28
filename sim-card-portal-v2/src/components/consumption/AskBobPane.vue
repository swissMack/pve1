<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useAppSettings } from '../../composables/useAppSettings'

Chart.register(...registerables)

const { currency } = useAppSettings()

// For action buttons
const copiedMessageId = ref<string | null>(null)

interface DateRange {
  start: string
  end: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  chartConfig?: ChartConfig
}

interface ChartConfig {
  type: 'chart' | 'table' | 'text'
  chartType?: 'bar' | 'line' | 'pie' | 'doughnut'
  title?: string
  data?: {
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
      backgroundColor?: string | string[]
      borderColor?: string
    }>
  }
  columns?: string[]
  rows?: string[][]
  content?: string
}

const props = defineProps<{
  dateRange: DateRange
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const messages = ref<Message[]>([])
const inputMessage = ref('')
const loading = ref(false)
const messagesContainer = ref<HTMLDivElement | null>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chartInstances = ref<Map<string, any>>(new Map())

const examplePrompts = [
  'Show data usage by carrier last month',
  'What is the trend in monthly costs?',
  'Which carrier has the highest usage?',
  'Compare costs across all carriers'
]

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const sendMessage = async () => {
  if (!inputMessage.value.trim() || loading.value) return

  const userMessage: Message = {
    id: `msg-${Date.now()}`,
    role: 'user',
    content: inputMessage.value.trim(),
    timestamp: new Date()
  }

  messages.value.push(userMessage)
  const query = inputMessage.value
  inputMessage.value = ''
  loading.value = true

  await scrollToBottom()

  try {
    const response = await fetch('/api/llm/chart', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        dateRange: props.dateRange,
        currency: currency.value
      })
    })

    const result = await response.json()

    if (result.success && result.data) {
      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: result.data.content || '',
        timestamp: new Date(),
        chartConfig: result.data.type !== 'text' ? result.data : undefined
      }

      messages.value.push(assistantMessage)

      await scrollToBottom()

      // Render chart if applicable
      if (result.data.type === 'chart') {
        await nextTick()
        renderChart(assistantMessage.id, result.data)
      }
    } else {
      messages.value.push({
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: result.error || 'Sorry, I could not process your request.',
        timestamp: new Date()
      })
    }
  } catch (err) {
    console.error('Error sending message:', err)
    messages.value.push({
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: 'Sorry, there was an error processing your request.',
      timestamp: new Date()
    })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

const renderChart = async (messageId: string, config: ChartConfig) => {
  await nextTick()

  const canvas = document.getElementById(`chart-${messageId}`) as HTMLCanvasElement
  if (!canvas || !config.data) return

  // Destroy existing chart if any
  const existingChart = chartInstances.value.get(messageId)
  if (existingChart) {
    existingChart.destroy()
  }

  const chart = new Chart(canvas, {
    type: config.chartType || 'bar',
    data: config.data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#9ca3af',
            usePointStyle: true
          }
        },
        title: {
          display: !!config.title,
          text: config.title || '',
          color: '#f3f4f6',
          font: {
            size: 14
          }
        }
      },
      scales: config.chartType === 'pie' || config.chartType === 'doughnut' ? {} : {
        x: {
          grid: {
            color: 'rgba(59, 71, 84, 0.5)'
          },
          ticks: {
            color: '#9ca3af'
          }
        },
        y: {
          grid: {
            color: 'rgba(59, 71, 84, 0.5)'
          },
          ticks: {
            color: '#9ca3af'
          }
        }
      }
    }
  })

  chartInstances.value.set(messageId, chart)
}

const handleExampleClick = (prompt: string) => {
  inputMessage.value = prompt
  sendMessage()
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

// Get the last assistant message for footer actions
const lastAssistantMessage = computed(() => {
  const assistantMessages = messages.value.filter(m => m.role === 'assistant')
  return assistantMessages.length > 0 ? assistantMessages[assistantMessages.length - 1] : null
})

// Format message content for copying (including chart/table data)
const getMessageContentForCopy = (message: Message): string => {
  let copyText = ''

  // Add text content if present
  if (message.content) {
    copyText += message.content
  }

  // Add chart data if present
  if (message.chartConfig?.type === 'chart' && message.chartConfig.data) {
    if (copyText) copyText += '\n\n'
    if (message.chartConfig.title) {
      copyText += `${message.chartConfig.title}\n`
      copyText += '─'.repeat(message.chartConfig.title.length) + '\n'
    }

    const labels = message.chartConfig.data.labels || []
    const datasets = message.chartConfig.data.datasets || []

    datasets.forEach(dataset => {
      if (dataset.label) copyText += `\n${dataset.label}:\n`
      labels.forEach((label, i) => {
        const value = dataset.data[i]
        copyText += `  ${label}: ${typeof value === 'number' ? value.toFixed(2) : value}\n`
      })
    })
  }

  // Add table data if present
  if (message.chartConfig?.type === 'table') {
    if (copyText) copyText += '\n\n'
    if (message.chartConfig.title) {
      copyText += `${message.chartConfig.title}\n`
      copyText += '─'.repeat(message.chartConfig.title.length) + '\n\n'
    }

    const columns = message.chartConfig.columns || []
    const rows = message.chartConfig.rows || []

    if (columns.length > 0) {
      copyText += columns.join('\t') + '\n'
      copyText += columns.map(() => '────').join('\t') + '\n'
    }

    rows.forEach(row => {
      copyText += row.join('\t') + '\n'
    })
  }

  return copyText.trim()
}

// Copy message content to clipboard
const copyToClipboard = async (message: Message) => {
  try {
    const content = getMessageContentForCopy(message)
    if (!content) {
      console.warn('No content to copy')
      return
    }
    await navigator.clipboard.writeText(content)
    copiedMessageId.value = message.id
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
    const bulletMatch = line.match(/^[-•*]\s*\*?\*?([^*]+)\*?\*?\s*[-–]\s*(.+)$/)
    if (bulletMatch) {
      const id = bulletMatch[1].trim().replace(/\*\*/g, '')
      const rest = bulletMatch[2].trim()
      const locationMatch = rest.match(/^([^(]+)\s*\(([^)]+)\)/)
      if (locationMatch) {
        csvLines.push(`"${id}","${locationMatch[1].trim()}","${locationMatch[2].trim()}"`)
      } else {
        csvLines.push(`"${id}","${rest}"`)
      }
      continue
    }

    const simpleMatch = line.match(/^[-•*]\s*(.+)$/)
    if (simpleMatch) {
      const parts = simpleMatch[1].split(/:\s*|,\s*/).map(p => p.trim().replace(/\*\*/g, ''))
      csvLines.push(parts.map(p => `"${p}"`).join(','))
      continue
    }

    if (line.includes(':')) {
      const parts = line.split(/:\s*/).map(p => p.trim().replace(/\*\*/g, ''))
      csvLines.push(parts.map(p => `"${p}"`).join(','))
    }
  }

  return csvLines.join('\n')
}

// Export message as CSV file
const exportAsCSV = (message: Message, filename: string = 'consumption_data') => {
  let csvContent = ''

  // Handle chart data
  if (message.chartConfig?.type === 'chart' && message.chartConfig.data) {
    const labels = message.chartConfig.data.labels || []
    const datasets = message.chartConfig.data.datasets || []

    // Header row: Label, then each dataset label
    const headers = ['Label', ...datasets.map(d => d.label || 'Value')]
    csvContent = headers.map(h => `"${h}"`).join(',') + '\n'

    // Data rows
    labels.forEach((label, i) => {
      const row = [label, ...datasets.map(d => d.data[i])]
      csvContent += row.map(v => typeof v === 'string' ? `"${v}"` : v).join(',') + '\n'
    })
  }
  // Handle table data
  else if (message.chartConfig?.type === 'table') {
    const columns = message.chartConfig.columns || []
    const rows = message.chartConfig.rows || []

    if (columns.length > 0) {
      csvContent = columns.map(c => `"${c}"`).join(',') + '\n'
    }
    rows.forEach(row => {
      csvContent += row.map(cell => `"${cell}"`).join(',') + '\n'
    })
  }
  // Handle text content
  else if (message.content) {
    csvContent = convertToCSV(message.content)
  }

  if (!csvContent) {
    console.warn('No data to export')
    return
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
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
  const content = lastAssistantMessage.value.content || ''
  return content.includes('IoTo consultants can help') ||
         content.includes('Contact IoTo') ||
         content.includes('contact our team') ||
         content.includes('speak with a consultant') ||
         content.includes('IoTo representative') ||
         content.includes('expert guidance')
})

// Format the full session data for email
const formatSessionData = (): string => {
  let sessionText = ''

  messages.value.forEach((msg, index) => {
    const role = msg.role === 'user' ? 'Question' : 'Bob'
    const timestamp = msg.timestamp.toLocaleString()

    sessionText += `\n[${role}] (${timestamp})\n`
    sessionText += msg.content || ''

    // Include chart/table info if present
    if (msg.chartConfig) {
      if (msg.chartConfig.type === 'chart' && msg.chartConfig.title) {
        sessionText += `\n[Chart Generated: ${msg.chartConfig.title}]`
      } else if (msg.chartConfig.type === 'table' && msg.chartConfig.title) {
        sessionText += `\n[Table Generated: ${msg.chartConfig.title}]`
        if (msg.chartConfig.columns && msg.chartConfig.rows) {
          sessionText += `\nColumns: ${msg.chartConfig.columns.join(', ')}`
          msg.chartConfig.rows.forEach(row => {
            sessionText += `\n  - ${row.join(' | ')}`
          })
        }
      }
    }

    sessionText += '\n'
    if (index < messages.value.length - 1) {
      sessionText += '---\n'
    }
  })

  return sessionText
}

// Send email to IoTo consultants
const contactIoTo = () => {
  if (messages.value.length === 0) return

  const subject = encodeURIComponent('IoTo Portal - Consumption Data Inquiry')
  const sessionData = formatSessionData()
  const dateRangeInfo = `${props.dateRange.start} to ${props.dateRange.end}`

  const body = encodeURIComponent(
`IoTo Portal Consumption Data Inquiry
=====================================

Date Range Analyzed: ${dateRangeInfo}
Session Date: ${new Date().toLocaleString()}
Total Messages: ${messages.value.length}

=====================================
FULL CONVERSATION SESSION
=====================================
${sessionData}
=====================================

This request was initiated from the IoTo Portal Consumption Dashboard.
A consultant will review this data and reach out to discuss optimization opportunities.
`)

  window.location.href = `mailto:info@ioto-communications.com?subject=${subject}&body=${body}`
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-border-dark flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-primary">smart_toy</span>
        <span class="text-white font-semibold">Ask Bob</span>
      </div>
      <button
        @click="emit('close')"
        class="p-1.5 text-text-secondary hover:text-white transition-colors"
      >
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- Welcome message if no messages -->
      <div v-if="messages.length === 0" class="text-center py-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <span class="material-symbols-outlined text-primary text-3xl">smart_toy</span>
        </div>
        <h3 class="text-white font-semibold mb-2">Hi, I'm Bob!</h3>
        <p class="text-text-secondary text-sm mb-6">
          Ask me anything about your SIM usage data. I can create charts and tables to visualize your data.
        </p>

        <!-- Example prompts -->
        <div class="space-y-2">
          <p class="text-xs text-text-secondary mb-2">Try asking:</p>
          <button
            v-for="prompt in examplePrompts"
            :key="prompt"
            @click="handleExampleClick(prompt)"
            class="block w-full text-left px-4 py-2 bg-background-dark border border-border-dark rounded-lg text-sm text-white hover:border-primary/50 transition-colors"
          >
            "{{ prompt }}"
          </button>
        </div>
      </div>

      <!-- Message list -->
      <template v-for="message in messages" :key="message.id">
        <!-- User message -->
        <div v-if="message.role === 'user'" class="flex justify-end">
          <div class="max-w-[80%] px-4 py-2 bg-primary rounded-2xl rounded-tr-sm">
            <p class="text-white text-sm">{{ message.content }}</p>
          </div>
        </div>

        <!-- Assistant message -->
        <div v-else class="flex justify-start">
          <div class="max-w-[90%]">
            <div class="flex items-center gap-2 mb-2">
              <span class="material-symbols-outlined text-primary text-lg">smart_toy</span>
              <span class="text-text-secondary text-xs">Bob</span>
            </div>

            <!-- Text response -->
            <div v-if="message.content" class="px-4 py-3 bg-surface-dark-highlight border border-border-dark rounded-2xl rounded-tl-sm mb-2">
              <p class="text-white text-sm whitespace-pre-wrap">{{ message.content }}</p>
            </div>

            <!-- Chart response -->
            <div v-if="message.chartConfig?.type === 'chart'" class="bg-surface-dark-highlight border border-border-dark rounded-xl p-4">
              <div class="h-[200px]">
                <canvas :id="`chart-${message.id}`"></canvas>
              </div>
            </div>

            <!-- Table response -->
            <div v-if="message.chartConfig?.type === 'table'" class="bg-surface-dark-highlight border border-border-dark rounded-xl overflow-hidden">
              <div v-if="message.chartConfig.title" class="px-4 py-2 border-b border-border-dark">
                <span class="text-white font-medium text-sm">{{ message.chartConfig.title }}</span>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="bg-background-dark">
                      <th
                        v-for="col in message.chartConfig.columns"
                        :key="col"
                        class="px-4 py-2 text-left text-text-secondary font-medium"
                      >
                        {{ col }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(row, i) in message.chartConfig.rows"
                      :key="i"
                      class="border-t border-border-dark"
                    >
                      <td
                        v-for="(cell, j) in row"
                        :key="j"
                        class="px-4 py-2 text-white"
                      >
                        {{ cell }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Loading indicator -->
      <div v-if="loading" class="flex justify-start">
        <div class="flex items-center gap-2 px-4 py-3 bg-surface-dark-highlight border border-border-dark rounded-2xl">
          <div class="flex gap-1">
            <span class="w-2 h-2 bg-primary rounded-full animate-bounce" style="animation-delay: 0ms"></span>
            <span class="w-2 h-2 bg-primary rounded-full animate-bounce" style="animation-delay: 150ms"></span>
            <span class="w-2 h-2 bg-primary rounded-full animate-bounce" style="animation-delay: 300ms"></span>
          </div>
          <span class="text-text-secondary text-sm">Bob is thinking...</span>
        </div>
      </div>
    </div>

    <!-- Action Buttons Footer -->
    <div
      v-if="lastAssistantMessage"
      class="flex items-center gap-2 px-4 py-2 border-t border-border-dark bg-background-dark shrink-0"
    >
      <span class="text-xs text-text-secondary">Actions:</span>
      <button
        @click="copyToClipboard(lastAssistantMessage)"
        class="flex items-center gap-1.5 px-2 py-1 bg-surface-dark border border-border-dark rounded transition-colors"
        :class="copiedMessageId === lastAssistantMessage.id ? 'text-green-400 border-green-400/50' : 'text-text-secondary hover:text-white hover:bg-primary/20 hover:border-primary/50'"
        :title="copiedMessageId === lastAssistantMessage.id ? 'Copied!' : 'Copy to clipboard'"
      >
        <span class="material-symbols-outlined text-[14px]">{{ copiedMessageId === lastAssistantMessage.id ? 'check' : 'content_copy' }}</span>
        <span class="text-xs">{{ copiedMessageId === lastAssistantMessage.id ? 'Copied' : 'Copy' }}</span>
      </button>
      <button
        v-if="lastAssistantMessage.content || lastAssistantMessage.chartConfig"
        @click="exportAsCSV(lastAssistantMessage, 'consumption_data')"
        class="flex items-center gap-1.5 px-2 py-1 bg-surface-dark border border-border-dark rounded text-text-secondary hover:text-white hover:bg-green-500/20 hover:border-green-500/50 transition-colors"
        title="Export as CSV"
      >
        <span class="material-symbols-outlined text-[14px]">download</span>
        <span class="text-xs">Export CSV</span>
      </button>
      <button
        v-if="hasConsultantReferral"
        @click="contactIoTo"
        class="flex items-center gap-1.5 px-3 py-1.5 ml-auto bg-primary border border-primary rounded text-white hover:bg-blue-600 transition-colors"
        title="Email IoTo consultants with your question"
      >
        <span class="material-symbols-outlined text-[14px]">mail</span>
        <span class="text-xs font-medium">Contact IoTo</span>
      </button>
    </div>

    <!-- Input -->
    <div class="p-4 border-t border-border-dark shrink-0">
      <div class="flex items-center gap-2">
        <input
          v-model="inputMessage"
          @keydown="handleKeyDown"
          type="text"
          placeholder="Ask Bob about your data..."
          class="flex-1 px-4 py-2.5 bg-background-dark border border-border-dark rounded-xl text-white text-sm placeholder-text-secondary focus:border-primary focus:outline-none"
          :disabled="loading"
        />
        <button
          @click="sendMessage"
          :disabled="loading || !inputMessage.trim()"
          :class="[
            'p-2.5 rounded-xl transition-colors',
            loading || !inputMessage.trim()
              ? 'bg-border-dark text-text-secondary cursor-not-allowed'
              : 'bg-primary text-white hover:bg-blue-600'
          ]"
        >
          <span class="material-symbols-outlined text-[20px]">send</span>
        </button>
      </div>
    </div>
  </div>
</template>

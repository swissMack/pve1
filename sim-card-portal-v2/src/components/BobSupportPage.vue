<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import ChatMessage from './ChatMessage.vue'
import {
  listConversations,
  createConversation,
  getMessages,
  sendMessage,
  deleteConversation
} from '../services/chatService'
import type { ChatConversation, ChatMessage as ChatMessageType } from '../types/nlq'

// State
const conversations = ref<ChatConversation[]>([])
const activeConversationId = ref<string | null>(null)
const messages = ref<ChatMessageType[]>([])
const inputText = ref('')
const sending = ref(false)
const loadingConversations = ref(false)
const loadingMessages = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
const showSidebar = ref(true)

// Load conversations on mount
onMounted(async () => {
  await loadConversations()
})

async function loadConversations() {
  loadingConversations.value = true
  try {
    conversations.value = await listConversations()
    // Auto-select first conversation if none selected
    if (conversations.value.length > 0 && !activeConversationId.value) {
      await selectConversation(conversations.value[0].id)
    }
  } catch (e) {
    console.error('Failed to load conversations:', e)
  } finally {
    loadingConversations.value = false
  }
}

async function selectConversation(id: string) {
  activeConversationId.value = id
  loadingMessages.value = true
  try {
    messages.value = await getMessages(id)
    await nextTick()
    scrollToBottom()
  } catch (e) {
    console.error('Failed to load messages:', e)
  } finally {
    loadingMessages.value = false
  }
}

async function handleNewConversation() {
  try {
    const conv = await createConversation()
    if (conv) {
      conversations.value.unshift(conv)
      await selectConversation(conv.id)
    }
  } catch (e) {
    console.error('Failed to create conversation:', e)
  }
}

async function handleDeleteConversation(id: string) {
  try {
    const success = await deleteConversation(id)
    if (success) {
      conversations.value = conversations.value.filter(c => c.id !== id)
      if (activeConversationId.value === id) {
        activeConversationId.value = null
        messages.value = []
        // Select next conversation
        if (conversations.value.length > 0) {
          await selectConversation(conversations.value[0].id)
        }
      }
    }
  } catch (e) {
    console.error('Failed to delete conversation:', e)
  }
}

async function handleSend() {
  const content = inputText.value.trim()
  if (!content || sending.value) return

  // Create a conversation if none exists
  if (!activeConversationId.value) {
    const conv = await createConversation(content.substring(0, 60))
    if (!conv) return
    conversations.value.unshift(conv)
    activeConversationId.value = conv.id
  }

  const convId = activeConversationId.value!

  // Optimistic: add user message immediately
  const tempUserMsg: ChatMessageType = {
    id: 'temp-user-' + Date.now(),
    conversationId: convId,
    role: 'user',
    content,
    metadata: {},
    createdAt: new Date().toISOString()
  }
  messages.value.push(tempUserMsg)
  inputText.value = ''
  sending.value = true
  await nextTick()
  scrollToBottom()

  try {
    const assistantMsg = await sendMessage(convId, content)
    if (assistantMsg) {
      messages.value.push(assistantMsg)
      // Update conversation title in sidebar if it changed
      const conv = conversations.value.find(c => c.id === convId)
      if (conv && messages.value.length <= 3) {
        conv.title = content.substring(0, 60) + (content.length > 60 ? '...' : '')
      }
    }
  } catch (e) {
    // Add error message
    messages.value.push({
      id: 'error-' + Date.now(),
      conversationId: convId,
      role: 'assistant',
      content: 'Sorry, I encountered an error. Please try again.',
      metadata: {},
      createdAt: new Date().toISOString()
    })
  } finally {
    sending.value = false
    await nextTick()
    scrollToBottom()
  }
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString()
}

// Auto-scroll when messages change
watch(messages, () => {
  nextTick(() => scrollToBottom())
}, { deep: true })
</script>

<template>
  <div class="flex h-full">
    <!-- Sidebar -->
    <div
      class="border-r border-border-dark bg-background-dark flex flex-col transition-all duration-300"
      :class="showSidebar ? 'w-72' : 'w-0 overflow-hidden'"
    >
      <!-- Sidebar Header -->
      <div class="p-4 border-b border-border-dark">
        <button
          @click="handleNewConversation"
          class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors"
        >
          <span class="material-symbols-outlined text-[18px]">add</span>
          New Chat
        </button>
      </div>

      <!-- Conversations List -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="loadingConversations" class="p-4 text-center">
          <span class="material-symbols-outlined text-text-secondary animate-spin">progress_activity</span>
        </div>
        <div v-else-if="conversations.length === 0" class="p-4 text-center text-text-secondary text-sm">
          <span class="material-symbols-outlined text-3xl mb-2">chat_bubble</span>
          <p>No conversations yet</p>
          <p class="text-xs mt-1">Start a new chat with Bob</p>
        </div>
        <div v-else>
          <div
            v-for="conv in conversations"
            :key="conv.id"
            @click="selectConversation(conv.id)"
            class="group flex items-center gap-2 px-4 py-3 cursor-pointer border-b border-border-dark/50 transition-colors"
            :class="activeConversationId === conv.id ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-surface-dark-highlight'"
          >
            <span class="material-symbols-outlined text-[18px] text-text-secondary">chat</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-white truncate">{{ conv.title }}</p>
              <p class="text-xs text-text-secondary">{{ formatDate(conv.updatedAt) }}</p>
            </div>
            <button
              @click.stop="handleDeleteConversation(conv.id)"
              class="opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:text-red-400 transition-all"
            >
              <span class="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Links -->
      <div class="p-4 border-t border-border-dark">
        <p class="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Quick Links</p>
        <div class="space-y-1">
          <a href="mailto:support@ioto.com" class="flex items-center gap-2 text-xs text-text-secondary hover:text-primary transition-colors py-1">
            <span class="material-symbols-outlined text-[16px]">mail</span>
            Contact Support
          </a>
          <a href="#" class="flex items-center gap-2 text-xs text-text-secondary hover:text-primary transition-colors py-1">
            <span class="material-symbols-outlined text-[16px]">description</span>
            API Docs
          </a>
          <a href="#" class="flex items-center gap-2 text-xs text-text-secondary hover:text-primary transition-colors py-1">
            <span class="material-symbols-outlined text-[16px]">bug_report</span>
            Report Bug
          </a>
        </div>
      </div>
    </div>

    <!-- Chat Area -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Chat Header -->
      <div class="h-14 px-4 flex items-center gap-3 border-b border-border-dark bg-surface-dark shrink-0">
        <button @click="showSidebar = !showSidebar" class="p-1 text-text-secondary hover:text-white transition-colors lg:hidden">
          <span class="material-symbols-outlined">menu</span>
        </button>
        <button @click="showSidebar = !showSidebar" class="p-1 text-text-secondary hover:text-white transition-colors hidden lg:block">
          <span class="material-symbols-outlined">{{ showSidebar ? 'left_panel_close' : 'left_panel_open' }}</span>
        </button>
        <div class="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center">
          <span class="material-symbols-outlined text-teal-400 text-[18px]">smart_toy</span>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-white">Bob</h3>
          <p class="text-xs text-teal-400">IoTo Support Assistant</p>
        </div>
      </div>

      <!-- Messages -->
      <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4">
        <!-- Welcome Message (when no messages) -->
        <div v-if="messages.length === 0 && !loadingMessages" class="flex flex-col items-center justify-center h-full text-center">
          <div class="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mb-4">
            <span class="material-symbols-outlined text-teal-400 text-[32px]">smart_toy</span>
          </div>
          <h3 class="text-lg font-semibold text-white mb-2">Hi, I'm Bob!</h3>
          <p class="text-sm text-text-secondary max-w-md mb-6">
            Your IoTo platform assistant. I can help with device management, SIM card questions, alert configuration, and more.
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg">
            <button
              v-for="prompt in [
                'How do I set up alert rules?',
                'What devices are offline?',
                'Help me understand geozones',
                'How do bulk operations work?'
              ]"
              :key="prompt"
              @click="inputText = prompt; handleSend()"
              class="text-left text-xs px-4 py-3 rounded-lg bg-surface-dark-highlight text-text-secondary hover:text-primary hover:bg-primary/10 border border-border-dark hover:border-primary/30 transition-colors"
            >
              {{ prompt }}
            </button>
          </div>
        </div>

        <!-- Loading messages -->
        <div v-else-if="loadingMessages" class="flex items-center justify-center h-full">
          <span class="material-symbols-outlined text-text-secondary animate-spin text-2xl">progress_activity</span>
        </div>

        <!-- Message List -->
        <template v-else>
          <ChatMessage
            v-for="msg in messages"
            :key="msg.id"
            :message="msg"
          />
          <!-- Typing indicator -->
          <div v-if="sending" class="flex gap-3 mb-4">
            <div class="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
              <span class="material-symbols-outlined text-teal-400 text-[16px]">smart_toy</span>
            </div>
            <div class="bg-surface-dark-highlight border border-border-dark rounded-xl rounded-tl-sm px-4 py-3">
              <div class="flex gap-1">
                <span class="w-2 h-2 rounded-full bg-text-secondary animate-bounce" style="animation-delay: 0ms"></span>
                <span class="w-2 h-2 rounded-full bg-text-secondary animate-bounce" style="animation-delay: 150ms"></span>
                <span class="w-2 h-2 rounded-full bg-text-secondary animate-bounce" style="animation-delay: 300ms"></span>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Input Bar -->
      <div class="px-4 py-3 border-t border-border-dark bg-surface-dark shrink-0">
        <div class="flex items-end gap-2">
          <div class="flex-1 relative">
            <textarea
              v-model="inputText"
              placeholder="Type a message to Bob..."
              class="w-full bg-surface-dark-highlight border border-border-dark rounded-xl px-4 py-2.5 text-sm text-white placeholder-text-secondary outline-none resize-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
              rows="1"
              maxlength="2000"
              @keydown.enter.exact.prevent="handleSend"
              @input="($event.target as HTMLTextAreaElement).style.height = 'auto'; ($event.target as HTMLTextAreaElement).style.height = Math.min(($event.target as HTMLTextAreaElement).scrollHeight, 120) + 'px'"
            ></textarea>
          </div>
          <button
            @click="handleSend"
            :disabled="!inputText.trim() || sending"
            class="p-2.5 bg-primary text-white rounded-xl hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <span class="material-symbols-outlined text-[20px]">send</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Notification {
  id: string
  title: string
  body: string
  isRead: boolean
  notificationType: string
  channel: string
  alertId: string | null
  alertTitle: string | null
  alertSeverity: string | null
  createdAt: string
}

interface NotificationPreference {
  alertType: string
  email: boolean
  inApp: boolean
}

interface Props {
  refreshKey?: number
}

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------

const props = defineProps<Props>()

const emit = defineEmits<{
  selectAlert: [alertId: string]
}>()

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE_URL = window.location.origin

const ALERT_TYPE_LABELS: Record<string, string> = {
  zone_enter: 'Zone Enter',
  zone_exit: 'Zone Exit',
  arrival_overdue: 'Arrival Overdue',
  low_battery: 'Low Battery',
  no_report: 'No Report'
}

const ALERT_TYPES = ['zone_enter', 'zone_exit', 'arrival_overdue', 'low_battery', 'no_report']

// ---------------------------------------------------------------------------
// Reactive State
// ---------------------------------------------------------------------------

const notifications = ref<Notification[]>([])
const loading = ref(true)
const error = ref('')
const activeFilter = ref<'all' | 'unread'>('all')
const unreadCount = ref(0)

// Preferences dialog
const showPreferencesDialog = ref(false)
const preferences = ref<NotificationPreference[]>([])
const preferencesLoading = ref(false)
const preferencesSaving = ref(false)

// ---------------------------------------------------------------------------
// API Calls
// ---------------------------------------------------------------------------

const loadNotifications = async () => {
  loading.value = true
  error.value = ''
  try {
    const url = activeFilter.value === 'unread'
      ? `${API_BASE_URL}/api/notifications?is_read=false`
      : `${API_BASE_URL}/api/notifications`
    const response = await fetch(url)
    const result = await response.json()
    if (result.success) {
      notifications.value = result.data
    } else {
      error.value = result.error || 'Failed to load notifications'
    }
  } catch (err) {
    error.value = 'Failed to load notifications'
    console.error('Error loading notifications:', err)
  } finally {
    loading.value = false
  }
}

const loadUnreadCount = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications/unread-count`)
    const result = await response.json()
    if (result.success) {
      unreadCount.value = result.data.count ?? result.data
    }
  } catch (err) {
    console.error('Error loading unread count:', err)
  }
}

const markAsRead = async (notification: Notification) => {
  if (notification.isRead) return
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications/${notification.id}/read`, {
      method: 'PUT'
    })
    const result = await response.json()
    if (result.success) {
      notification.isRead = true
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
  } catch (err) {
    console.error('Error marking notification as read:', err)
  }
}

const markAllRead = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications/read-all`, {
      method: 'PUT'
    })
    const result = await response.json()
    if (result.success) {
      notifications.value.forEach(n => { n.isRead = true })
      unreadCount.value = 0
    }
  } catch (err) {
    console.error('Error marking all notifications as read:', err)
  }
}

const loadPreferences = async () => {
  preferencesLoading.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications/preferences`)
    const result = await response.json()
    if (result.success && result.data) {
      // Map API response to our local structure
      const prefsMap: Record<string, NotificationPreference> = {}
      for (const pref of result.data) {
        if (!prefsMap[pref.alertType]) {
          prefsMap[pref.alertType] = { alertType: pref.alertType, email: false, inApp: false }
        }
        if (pref.channel === 'email') prefsMap[pref.alertType].email = pref.isEnabled
        if (pref.channel === 'in_app') prefsMap[pref.alertType].inApp = pref.isEnabled
      }
      // Ensure all alert types are present
      preferences.value = ALERT_TYPES.map(type => prefsMap[type] || { alertType: type, email: true, inApp: true })
    } else {
      // Default all on
      preferences.value = ALERT_TYPES.map(type => ({ alertType: type, email: true, inApp: true }))
    }
  } catch (err) {
    console.error('Error loading preferences:', err)
    preferences.value = ALERT_TYPES.map(type => ({ alertType: type, email: true, inApp: true }))
  } finally {
    preferencesLoading.value = false
  }
}

const savePreference = async (alertType: string, channel: 'email' | 'in_app', isEnabled: boolean) => {
  preferencesSaving.value = true
  try {
    await fetch(`${API_BASE_URL}/api/notifications/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertType, channel, isEnabled })
    })
  } catch (err) {
    console.error('Error saving preference:', err)
  } finally {
    preferencesSaving.value = false
  }
}

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

const handleCardClick = (notification: Notification) => {
  markAsRead(notification)
  if (notification.alertId) {
    emit('selectAlert', notification.alertId)
  }
}

const handleFilterChange = (filter: 'all' | 'unread') => {
  activeFilter.value = filter
}

const openPreferences = () => {
  loadPreferences()
  showPreferencesDialog.value = true
}

const closePreferences = () => {
  showPreferencesDialog.value = false
}

const handleToggle = (pref: NotificationPreference, channel: 'email' | 'inApp') => {
  if (channel === 'email') {
    pref.email = !pref.email
    savePreference(pref.alertType, 'email', pref.email)
  } else {
    pref.inApp = !pref.inApp
    savePreference(pref.alertType, 'in_app', pref.inApp)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getNotificationIcon = (type: string): string => {
  switch (type) {
    case 'zone_enter':
    case 'zone_exit':
      return 'pin_drop'
    case 'arrival_overdue':
      return 'schedule'
    case 'low_battery':
      return 'battery_alert'
    case 'no_report':
      return 'signal_disconnected'
    case 'email':
      return 'email'
    default:
      return 'notifications'
  }
}

const getIconBgClass = (type: string): string => {
  switch (type) {
    case 'zone_enter': return 'bg-green-500/10 text-green-400'
    case 'zone_exit': return 'bg-amber-500/10 text-amber-400'
    case 'arrival_overdue': return 'bg-red-500/10 text-red-400'
    case 'low_battery': return 'bg-orange-500/10 text-orange-400'
    case 'no_report': return 'bg-gray-500/10 text-gray-400'
    default: return 'bg-primary/10 text-primary'
  }
}

const getSeverityClass = (severity: string | null): string => {
  switch (severity) {
    case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/20'
    case 'warning': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    case 'info': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }
}

const formatRelativeTime = (dateStr: string): string => {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diffMs = now - date

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (weeks < 4) return `${weeks}w ago`
  return new Date(dateStr).toLocaleDateString()
}

// ---------------------------------------------------------------------------
// Computed
// ---------------------------------------------------------------------------

const hasUnread = computed(() => unreadCount.value > 0)

// ---------------------------------------------------------------------------
// Watchers
// ---------------------------------------------------------------------------

watch(activeFilter, () => {
  loadNotifications()
})

watch(() => props.refreshKey, () => {
  loadNotifications()
  loadUnreadCount()
})

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

onMounted(() => {
  loadNotifications()
  loadUnreadCount()
})
</script>

<template>
  <div class="p-6 lg:p-8 bg-background-dark min-h-full">
    <div class="max-w-[1600px] mx-auto flex flex-col gap-6">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white flex items-center gap-3">
            Notifications
            <span
              v-if="hasUnread"
              class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary text-white"
            >
              {{ unreadCount }}
            </span>
          </h1>
          <p class="text-text-secondary text-sm mt-1">Stay updated on alerts and system events</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="markAllRead"
            :disabled="!hasUnread"
            class="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors border border-border-dark"
            :class="hasUnread
              ? 'bg-surface-dark text-white hover:bg-surface-dark-highlight'
              : 'bg-surface-dark/50 text-text-secondary cursor-not-allowed'"
          >
            <span class="material-symbols-outlined text-[20px]">done_all</span>
            Mark All Read
          </button>
          <button
            @click="openPreferences"
            class="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20"
          >
            <span class="material-symbols-outlined text-[20px]">settings</span>
            Preferences
          </button>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="flex bg-surface-dark p-1 rounded-lg border border-border-dark w-fit">
        <button
          @click="handleFilterChange('all')"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
          :class="activeFilter === 'all'
            ? 'bg-background-dark text-white shadow-sm'
            : 'text-text-secondary hover:text-white'"
        >
          All
        </button>
        <button
          @click="handleFilterChange('unread')"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
          :class="activeFilter === 'unread'
            ? 'bg-background-dark text-white shadow-sm'
            : 'text-text-secondary hover:text-white'"
        >
          Unread
          <span
            v-if="unreadCount > 0"
            class="inline-flex items-center justify-center size-5 rounded-full text-[10px] font-bold bg-primary text-white"
          >
            {{ unreadCount > 99 ? '99+' : unreadCount }}
          </span>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-surface-dark rounded-xl border border-border-dark p-12">
        <div class="flex flex-col items-center justify-center gap-3">
          <span class="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
          <p class="text-text-secondary text-sm">Loading notifications...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-surface-dark rounded-xl border border-red-500/30 p-8 flex flex-col items-center gap-3">
        <span class="material-symbols-outlined text-4xl text-red-400">error</span>
        <p class="text-red-400 text-sm">{{ error }}</p>
        <button
          @click="loadNotifications"
          class="mt-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="notifications.length === 0"
        class="bg-surface-dark rounded-xl border border-border-dark p-12 flex flex-col items-center gap-3"
      >
        <span class="material-symbols-outlined text-5xl text-text-secondary">notifications_off</span>
        <p class="text-text-secondary text-sm">
          {{ activeFilter === 'unread' ? 'No unread notifications' : 'No notifications' }}
        </p>
        <p class="text-text-secondary text-xs">
          {{ activeFilter === 'unread' ? 'You\'re all caught up!' : 'Notifications will appear here when alerts are triggered.' }}
        </p>
      </div>

      <!-- Notification List -->
      <div v-else class="flex flex-col gap-3">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          @click="handleCardClick(notification)"
          class="rounded-xl border transition-all group"
          :class="[
            notification.isRead
              ? 'bg-surface-dark/50 border-border-dark hover:bg-surface-dark'
              : 'bg-surface-dark border-border-dark hover:border-primary/30',
            notification.alertId ? 'cursor-pointer' : 'cursor-default'
          ]"
        >
          <div class="p-4 flex items-start gap-4">
            <!-- Icon -->
            <div
              class="p-2.5 rounded-lg shrink-0"
              :class="getIconBgClass(notification.notificationType)"
            >
              <span class="material-symbols-outlined text-[24px]">
                {{ getNotificationIcon(notification.notificationType) }}
              </span>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <h3
                      class="text-sm font-semibold truncate"
                      :class="notification.isRead ? 'text-text-secondary' : 'text-white'"
                    >
                      {{ notification.title }}
                    </h3>
                    <span
                      v-if="notification.alertSeverity"
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border shrink-0"
                      :class="getSeverityClass(notification.alertSeverity)"
                    >
                      {{ notification.alertSeverity }}
                    </span>
                  </div>
                  <p
                    class="text-sm mt-1 line-clamp-2"
                    :class="notification.isRead ? 'text-text-secondary/70' : 'text-text-secondary'"
                  >
                    {{ notification.body }}
                  </p>
                  <div class="flex items-center gap-3 mt-2">
                    <span class="text-xs text-text-secondary">
                      {{ formatRelativeTime(notification.createdAt) }}
                    </span>
                    <span
                      v-if="notification.alertTitle"
                      class="text-xs text-primary"
                    >
                      {{ notification.alertTitle }}
                    </span>
                  </div>
                </div>

                <!-- Unread Indicator -->
                <div class="flex items-center gap-2 shrink-0 pt-1">
                  <span
                    v-if="!notification.isRead"
                    class="size-2.5 rounded-full bg-primary shrink-0"
                    title="Unread"
                  ></span>
                  <span
                    v-if="notification.alertId"
                    class="material-symbols-outlined text-[18px] text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    arrow_forward
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="text-center py-2">
          <p class="text-text-secondary text-xs">
            Showing {{ notifications.length }} notification{{ notifications.length !== 1 ? 's' : '' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Preferences Dialog (Modal Overlay) -->
    <Teleport to="body">
      <div
        v-if="showPreferencesDialog"
        class="fixed inset-0 z-50 flex items-center justify-center"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="closePreferences"
        ></div>

        <!-- Dialog -->
        <div class="relative bg-surface-dark border border-border-dark rounded-2xl shadow-2xl w-full max-w-lg mx-4">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-border-dark">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-primary/10 text-primary">
                <span class="material-symbols-outlined text-[20px]">tune</span>
              </div>
              <h2 class="text-lg font-bold text-white">Notification Preferences</h2>
            </div>
            <button
              @click="closePreferences"
              class="text-text-secondary hover:text-white transition-colors p-1 rounded-lg hover:bg-background-dark"
            >
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-4">
            <!-- Loading -->
            <div v-if="preferencesLoading" class="flex items-center justify-center py-8">
              <span class="material-symbols-outlined text-3xl text-primary animate-spin">progress_activity</span>
            </div>

            <!-- Preferences Table -->
            <div v-else>
              <p class="text-text-secondary text-sm mb-4">
                Choose how you want to be notified for each alert type.
              </p>

              <!-- Table Header -->
              <div class="grid grid-cols-[1fr,80px,80px] gap-2 px-3 py-2 text-xs font-semibold uppercase text-text-secondary tracking-wider">
                <span>Alert Type</span>
                <span class="text-center">Email</span>
                <span class="text-center">In-App</span>
              </div>

              <!-- Preference Rows -->
              <div class="divide-y divide-border-dark">
                <div
                  v-for="pref in preferences"
                  :key="pref.alertType"
                  class="grid grid-cols-[1fr,80px,80px] gap-2 items-center px-3 py-3"
                >
                  <!-- Alert Type Label -->
                  <div class="flex items-center gap-2">
                    <span
                      class="material-symbols-outlined text-[18px]"
                      :class="getIconBgClass(pref.alertType).split(' ').filter(c => c.startsWith('text-')).join(' ')"
                    >
                      {{ getNotificationIcon(pref.alertType) }}
                    </span>
                    <span class="text-white text-sm font-medium">
                      {{ ALERT_TYPE_LABELS[pref.alertType] || pref.alertType }}
                    </span>
                  </div>

                  <!-- Email Toggle -->
                  <div class="flex justify-center">
                    <button
                      @click="handleToggle(pref, 'email')"
                      :disabled="preferencesSaving"
                      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
                      :class="pref.email ? 'bg-primary' : 'bg-background-dark border border-border-dark'"
                    >
                      <span
                        class="inline-block size-4 rounded-full bg-white transition-transform"
                        :class="pref.email ? 'translate-x-6' : 'translate-x-1'"
                      ></span>
                    </button>
                  </div>

                  <!-- In-App Toggle -->
                  <div class="flex justify-center">
                    <button
                      @click="handleToggle(pref, 'inApp')"
                      :disabled="preferencesSaving"
                      class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
                      :class="pref.inApp ? 'bg-primary' : 'bg-background-dark border border-border-dark'"
                    >
                      <span
                        class="inline-block size-4 rounded-full bg-white transition-transform"
                        :class="pref.inApp ? 'translate-x-6' : 'translate-x-1'"
                      ></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-dark">
            <button
              @click="closePreferences"
              class="px-4 py-2.5 text-sm font-semibold text-text-secondary hover:text-white rounded-lg transition-colors border border-border-dark hover:bg-background-dark"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Clamp notification body to 2 lines */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

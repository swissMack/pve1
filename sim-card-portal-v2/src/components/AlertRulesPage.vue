<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

// ============================================================================
// Types
// ============================================================================

interface AlertRule {
  id: string
  name: string
  description: string | null
  triggerType: 'zone_enter' | 'zone_exit' | 'arrival_overdue' | 'low_battery' | 'no_report' | 'signal_strength' | 'firmware_update' | 'trip_complete' | 'idle_too_long' | 'geozone_breach'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  ruleScope: 'device' | 'asset' | null
  conditions: Record<string, unknown>
  actions: Record<string, unknown>
  recipients: { type: string; value: string }[]
  isEnabled: boolean
  cooldownMinutes: number | null
  createdAt: string
  updatedAt: string
}

interface Props {
  refreshKey?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  editRule: [ruleId: string]
  createRule: []
  close: []
}>()

// ============================================================================
// Constants
// ============================================================================

const API_BASE_URL = window.location.origin

const TRIGGER_TYPE_OPTIONS = [
  { label: 'All Triggers', value: '' },
  { label: 'Zone Enter', value: 'zone_enter' },
  { label: 'Zone Exit', value: 'zone_exit' },
  { label: 'Arrival Overdue', value: 'arrival_overdue' },
  { label: 'Low Battery', value: 'low_battery' },
  { label: 'No Report', value: 'no_report' },
  { label: 'Signal Strength', value: 'signal_strength' },
  { label: 'Firmware Update', value: 'firmware_update' },
  { label: 'Trip Complete', value: 'trip_complete' },
  { label: 'Idle Too Long', value: 'idle_too_long' },
  { label: 'Geozone Breach', value: 'geozone_breach' }
]

// ============================================================================
// Reactive State
// ============================================================================

const rules = ref<AlertRule[]>([])
const loading = ref(true)
const error = ref('')
const searchTerm = ref('')
const selectedTriggerType = ref('')
const enabledFilter = ref<'' | 'true' | 'false'>('')
const selectedScope = ref<'' | 'device' | 'asset'>('')

// File input for import
const importFileInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)

// ============================================================================
// Data Loading
// ============================================================================

const loadRules = async () => {
  loading.value = true
  error.value = ''
  try {
    const url = new URL('/api/alert-rules', API_BASE_URL)
    if (selectedTriggerType.value) url.searchParams.set('trigger_type', selectedTriggerType.value)
    if (enabledFilter.value) url.searchParams.set('is_enabled', enabledFilter.value)
    if (searchTerm.value) url.searchParams.set('search', searchTerm.value)
    if (selectedScope.value) url.searchParams.set('rule_scope', selectedScope.value)

    const response = await fetch(url.toString())
    const result = await response.json()
    if (result.success) {
      rules.value = result.data
    } else {
      error.value = result.error || 'Failed to load alert rules'
    }
  } catch (err) {
    error.value = 'Failed to load alert rules'
    console.error('Error loading alert rules:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadRules()
})

// Watch for refresh trigger from parent
watch(() => props.refreshKey, () => {
  loadRules()
})

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(searchTerm, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadRules()
  }, 300)
})

watch(selectedTriggerType, () => {
  loadRules()
})

watch(enabledFilter, () => {
  loadRules()
})

watch(selectedScope, () => {
  loadRules()
})

// ============================================================================
// Stats
// ============================================================================

const totalCount = computed(() => rules.value.length)
const enabledCount = computed(() => rules.value.filter(r => r.isEnabled).length)
const criticalCount = computed(() => rules.value.filter(r => r.severity === 'critical').length)
const highCount = computed(() => rules.value.filter(r => r.severity === 'high').length)

// ============================================================================
// Display Helpers
// ============================================================================

const getTriggerTypeLabel = (type: string): string => {
  switch (type) {
    case 'zone_enter': return 'Zone Enter'
    case 'zone_exit': return 'Zone Exit'
    case 'arrival_overdue': return 'Arrival Overdue'
    case 'low_battery': return 'Low Battery'
    case 'no_report': return 'No Report'
    case 'signal_strength': return 'Signal Strength'
    case 'firmware_update': return 'Firmware Update'
    case 'trip_complete': return 'Trip Complete'
    case 'idle_too_long': return 'Idle Too Long'
    case 'geozone_breach': return 'Geozone Breach'
    default: return type
  }
}

const getTriggerTypeBadgeClass = (type: string): string => {
  switch (type) {
    case 'zone_enter': return 'bg-green-500/10 text-green-400'
    case 'zone_exit': return 'bg-amber-500/10 text-amber-400'
    case 'arrival_overdue': return 'bg-purple-500/10 text-purple-400'
    case 'low_battery': return 'bg-red-500/10 text-red-400'
    case 'no_report': return 'bg-gray-500/10 text-gray-400'
    case 'signal_strength': return 'bg-cyan-500/10 text-cyan-400'
    case 'firmware_update': return 'bg-indigo-500/10 text-indigo-400'
    case 'trip_complete': return 'bg-teal-500/10 text-teal-400'
    case 'idle_too_long': return 'bg-orange-500/10 text-orange-400'
    case 'geozone_breach': return 'bg-rose-500/10 text-rose-400'
    default: return 'bg-gray-500/10 text-gray-400'
  }
}

const getTriggerTypeIcon = (type: string): string => {
  switch (type) {
    case 'zone_enter': return 'login'
    case 'zone_exit': return 'logout'
    case 'arrival_overdue': return 'schedule'
    case 'low_battery': return 'battery_alert'
    case 'no_report': return 'signal_wifi_off'
    case 'signal_strength': return 'signal_cellular_alt'
    case 'firmware_update': return 'system_update'
    case 'trip_complete': return 'flag'
    case 'idle_too_long': return 'hourglass_empty'
    case 'geozone_breach': return 'shield'
    default: return 'notifications'
  }
}

const getScopeBadgeClass = (scope: string | null): string => {
  return scope === 'device' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-teal-500/10 text-teal-400'
}

const getScopeIcon = (scope: string | null): string => {
  return scope === 'device' ? 'router' : 'inventory_2'
}

const getScopeLabel = (scope: string | null): string => {
  return scope === 'device' ? 'Device' : 'Asset'
}

const getSeverityLabel = (severity: string): string => {
  return severity.charAt(0).toUpperCase() + severity.slice(1)
}

const getSeverityBadgeClass = (severity: string): string => {
  switch (severity) {
    case 'critical': return 'bg-[#ef4444]/10 text-[#ef4444]'
    case 'high': return 'bg-[#f97316]/10 text-[#f97316]'
    case 'medium': return 'bg-[#f59e0b]/10 text-[#f59e0b]'
    case 'low': return 'bg-[#3b82f6]/10 text-[#3b82f6]'
    case 'info': return 'bg-[#6b7280]/10 text-[#6b7280]'
    default: return 'bg-gray-500/10 text-gray-400'
  }
}

const getSeverityDotColor = (severity: string): string => {
  switch (severity) {
    case 'critical': return 'bg-[#ef4444]'
    case 'high': return 'bg-[#f97316]'
    case 'medium': return 'bg-[#f59e0b]'
    case 'low': return 'bg-[#3b82f6]'
    case 'info': return 'bg-[#6b7280]'
    default: return 'bg-gray-400'
  }
}

const getConditionsSummary = (rule: AlertRule): string => {
  const parts: string[] = []
  const cond = rule.conditions || {}

  if (Array.isArray(cond.geozoneIds) && cond.geozoneIds.length > 0) {
    parts.push(`${cond.geozoneIds.length} geozone${cond.geozoneIds.length !== 1 ? 's' : ''}`)
  }
  if (Array.isArray(cond.assetIds) && cond.assetIds.length > 0) {
    parts.push(`${cond.assetIds.length} asset${cond.assetIds.length !== 1 ? 's' : ''}`)
  }
  if (Array.isArray(cond.zoneTypes) && cond.zoneTypes.length > 0) {
    parts.push(`${cond.zoneTypes.length} zone type${cond.zoneTypes.length !== 1 ? 's' : ''}`)
  }
  if (cond.gracePeriodMinutes) {
    parts.push(`${cond.gracePeriodMinutes}m grace`)
  }
  if (cond.thresholdPercent != null) {
    parts.push(`${cond.thresholdPercent}% threshold`)
  }
  if (cond.windowMinutes) {
    parts.push(`${cond.windowMinutes}m window`)
  }

  return parts.length > 0 ? parts.join(', ') : 'No conditions'
}

const getRecipientsCount = (rule: AlertRule): number => {
  return Array.isArray(rule.recipients) ? rule.recipients.length : 0
}

// ============================================================================
// Actions
// ============================================================================

const handleCreate = () => {
  emit('createRule')
}

const handleEdit = (ruleId: string) => {
  emit('editRule', ruleId)
}

const handleToggle = async (rule: AlertRule) => {
  const newValue = !rule.isEnabled
  try {
    const response = await fetch(`${API_BASE_URL}/api/alert-rules/${rule.id}/toggle`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isEnabled: newValue })
    })
    const result = await response.json()
    if (result.success) {
      rule.isEnabled = newValue
    } else {
      console.error('Failed to toggle rule:', result.error)
      alert('Failed to toggle rule: ' + (result.error || 'Unknown error'))
    }
  } catch (err) {
    console.error('Error toggling rule:', err)
    alert('Failed to toggle rule. Please try again.')
  }
}

const handleClone = async (rule: AlertRule) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/alert-rules/${rule.id}/clone`, {
      method: 'POST'
    })
    const result = await response.json()
    if (result.success) {
      loadRules()
    } else {
      console.error('Failed to clone rule:', result.error)
      alert('Failed to clone rule: ' + (result.error || 'Unknown error'))
    }
  } catch (err) {
    console.error('Error cloning rule:', err)
    alert('Failed to clone rule. Please try again.')
  }
}

const handleExport = async (rule: AlertRule) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/alert-rules/${rule.id}/export`)
    if (!response.ok) throw new Error('Export failed')

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `alert-rule-${rule.name.toLowerCase().replace(/\s+/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Error exporting rule:', err)
    alert('Failed to export rule. Please try again.')
  }
}

const handleDelete = async (rule: AlertRule) => {
  if (!confirm(`Are you sure you want to delete the alert rule "${rule.name}"? This action cannot be undone.`)) {
    return
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/alert-rules/${rule.id}`, {
      method: 'DELETE'
    })
    const result = await response.json()
    if (result.success) {
      rules.value = rules.value.filter(r => r.id !== rule.id)
    } else {
      console.error('Failed to delete rule:', result.error)
      alert('Failed to delete rule: ' + (result.error || 'Unknown error'))
    }
  } catch (err) {
    console.error('Error deleting rule:', err)
    alert('Failed to delete rule. Please try again.')
  }
}

// ============================================================================
// Import
// ============================================================================

const triggerImport = () => {
  importFileInput.value?.click()
}

const handleImportFile = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  importing.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/api/alert-rules/import`, {
      method: 'POST',
      body: formData
    })
    const result = await response.json()
    if (result.success) {
      loadRules()
    } else {
      console.error('Failed to import rule:', result.error)
      alert('Failed to import rule: ' + (result.error || 'Unknown error'))
    }
  } catch (err) {
    console.error('Error importing rule:', err)
    alert('Failed to import rule. Please try again.')
  } finally {
    importing.value = false
    // Reset file input so the same file can be re-selected
    if (target) target.value = ''
  }
}
</script>

<template>
  <div class="p-6 lg:p-8 bg-background-dark min-h-full">
    <div class="max-w-[1600px] mx-auto flex flex-col gap-6">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">Alert Rules</h1>
          <p class="text-text-secondary text-sm mt-1">Configure automated alerts for asset tracking events</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="triggerImport"
            :disabled="importing"
            class="flex items-center gap-2 px-4 py-2.5 bg-surface-dark border border-border-dark text-text-secondary text-sm font-semibold rounded-lg hover:text-white hover:border-primary/50 transition-colors"
          >
            <span v-if="importing" class="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
            <span v-else class="material-symbols-outlined text-[20px]">upload_file</span>
            Import
          </button>
          <input
            ref="importFileInput"
            type="file"
            accept=".json"
            class="hidden"
            @change="handleImportFile"
          />
          <button
            @click="handleCreate"
            class="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20"
          >
            <span class="material-symbols-outlined text-[20px]">add</span>
            New Rule
          </button>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-primary/10 text-primary">
            <span class="material-symbols-outlined text-[24px]">notifications_active</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ totalCount }}</p>
            <p class="text-text-secondary text-xs">Total Rules</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-green-500/10 text-green-400">
            <span class="material-symbols-outlined text-[24px]">toggle_on</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ enabledCount }}</p>
            <p class="text-text-secondary text-xs">Enabled</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-[#ef4444]/10 text-[#ef4444]">
            <span class="material-symbols-outlined text-[24px]">error</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ criticalCount }}</p>
            <p class="text-text-secondary text-xs">Critical</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-[#f97316]/10 text-[#f97316]">
            <span class="material-symbols-outlined text-[24px]">warning</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ highCount }}</p>
            <p class="text-text-secondary text-xs">High Priority</p>
          </div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div class="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <!-- Search Input -->
          <div class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[20px]">search</span>
            <input
              v-model="searchTerm"
              type="text"
              placeholder="Search rules by name..."
              class="w-full md:w-72 bg-background-dark border border-border-dark rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-text-secondary transition-all"
            />
          </div>

          <!-- Trigger Type Dropdown -->
          <select
            v-model="selectedTriggerType"
            class="bg-background-dark border border-border-dark rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer min-w-[160px]"
          >
            <option v-for="opt in TRIGGER_TYPE_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>

          <!-- Scope Filter -->
          <div class="flex bg-background-dark p-1 rounded-lg border border-border-dark">
            <button
              @click="selectedScope = ''"
              class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
              :class="selectedScope === '' ? 'bg-surface-dark text-white shadow-sm' : 'text-text-secondary hover:text-white'"
            >
              All
            </button>
            <button
              @click="selectedScope = 'device'"
              class="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
              :class="selectedScope === 'device' ? 'bg-surface-dark text-cyan-400 shadow-sm' : 'text-text-secondary hover:text-white'"
            >
              <span class="material-symbols-outlined text-[14px]">router</span>
              Device
            </button>
            <button
              @click="selectedScope = 'asset'"
              class="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
              :class="selectedScope === 'asset' ? 'bg-surface-dark text-teal-400 shadow-sm' : 'text-text-secondary hover:text-white'"
            >
              <span class="material-symbols-outlined text-[14px]">inventory_2</span>
              Asset
            </button>
          </div>

          <!-- Enabled Toggle Filter -->
          <div class="flex bg-background-dark p-1 rounded-lg border border-border-dark">
            <button
              @click="enabledFilter = ''"
              class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
              :class="enabledFilter === '' ? 'bg-surface-dark text-white shadow-sm' : 'text-text-secondary hover:text-white'"
            >
              All
            </button>
            <button
              @click="enabledFilter = 'true'"
              class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
              :class="enabledFilter === 'true' ? 'bg-surface-dark text-white shadow-sm' : 'text-text-secondary hover:text-white'"
            >
              Enabled
            </button>
            <button
              @click="enabledFilter = 'false'"
              class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
              :class="enabledFilter === 'false' ? 'bg-surface-dark text-white shadow-sm' : 'text-text-secondary hover:text-white'"
            >
              Disabled
            </button>
          </div>
        </div>
        <div class="text-text-secondary text-sm">
          Showing <span class="text-white font-medium">{{ rules.length }}</span> rule{{ rules.length !== 1 ? 's' : '' }}
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-surface-dark rounded-xl border border-border-dark p-12 flex flex-col items-center gap-3">
        <span class="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
        <p class="text-text-secondary text-sm">Loading alert rules...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-surface-dark rounded-xl border border-red-500/30 p-8 flex flex-col items-center gap-3">
        <span class="material-symbols-outlined text-4xl text-red-400">error</span>
        <p class="text-red-400 text-sm">{{ error }}</p>
        <button
          @click="loadRules"
          class="mt-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>

      <!-- Rules Table -->
      <div v-else class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-background-dark border-b border-border-dark">
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Name</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Scope</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Trigger Type</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Severity</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Conditions</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Recipients</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Enabled</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-dark text-sm">
              <tr
                v-for="rule in rules"
                :key="rule.id"
                class="hover:bg-surface-dark-highlight transition-colors group"
              >
                <!-- Name -->
                <td class="py-3 px-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="size-10 rounded-lg flex items-center justify-center shrink-0"
                      :class="getTriggerTypeBadgeClass(rule.triggerType)"
                    >
                      <span class="material-symbols-outlined text-[20px]">{{ getTriggerTypeIcon(rule.triggerType) }}</span>
                    </div>
                    <div>
                      <p class="text-white font-medium">{{ rule.name }}</p>
                      <p class="text-text-secondary text-xs truncate max-w-[200px]">{{ rule.description || 'No description' }}</p>
                    </div>
                  </div>
                </td>

                <!-- Scope Badge -->
                <td class="py-3 px-4">
                  <span
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                    :class="getScopeBadgeClass(rule.ruleScope)"
                  >
                    <span class="material-symbols-outlined text-[14px]">{{ getScopeIcon(rule.ruleScope) }}</span>
                    {{ getScopeLabel(rule.ruleScope) }}
                  </span>
                </td>

                <!-- Trigger Type Badge -->
                <td class="py-3 px-4">
                  <span
                    class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                    :class="getTriggerTypeBadgeClass(rule.triggerType)"
                  >
                    {{ getTriggerTypeLabel(rule.triggerType) }}
                  </span>
                </td>

                <!-- Severity Badge -->
                <td class="py-3 px-4">
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    :class="getSeverityBadgeClass(rule.severity)"
                  >
                    <span class="size-1.5 rounded-full" :class="getSeverityDotColor(rule.severity)"></span>
                    {{ getSeverityLabel(rule.severity) }}
                  </span>
                </td>

                <!-- Conditions Summary -->
                <td class="py-3 px-4">
                  <span class="text-text-secondary text-xs">{{ getConditionsSummary(rule) }}</span>
                </td>

                <!-- Recipients Count -->
                <td class="py-3 px-4">
                  <div class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[16px] text-text-secondary">group</span>
                    <span class="text-white font-medium">{{ getRecipientsCount(rule) }}</span>
                  </div>
                </td>

                <!-- Enabled Toggle -->
                <td class="py-3 px-4">
                  <button
                    @click.stop="handleToggle(rule)"
                    class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                    :class="rule.isEnabled ? 'bg-primary' : 'bg-border-dark'"
                  >
                    <span
                      class="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                      :class="rule.isEnabled ? 'translate-x-6' : 'translate-x-1'"
                    ></span>
                  </button>
                </td>

                <!-- Actions -->
                <td class="py-3 px-4 text-right">
                  <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      @click.stop="handleEdit(rule.id)"
                      class="p-1.5 text-text-secondary hover:text-primary transition-colors rounded-md hover:bg-primary/10"
                      title="Edit rule"
                    >
                      <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      @click.stop="handleClone(rule)"
                      class="p-1.5 text-text-secondary hover:text-blue-400 transition-colors rounded-md hover:bg-blue-500/10"
                      title="Clone rule"
                    >
                      <span class="material-symbols-outlined text-[18px]">content_copy</span>
                    </button>
                    <button
                      @click.stop="handleExport(rule)"
                      class="p-1.5 text-text-secondary hover:text-green-400 transition-colors rounded-md hover:bg-green-500/10"
                      title="Export rule"
                    >
                      <span class="material-symbols-outlined text-[18px]">download</span>
                    </button>
                    <button
                      @click.stop="handleDelete(rule)"
                      class="p-1.5 text-text-secondary hover:text-red-400 transition-colors rounded-md hover:bg-red-500/10"
                      title="Delete rule"
                    >
                      <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-if="rules.length === 0">
                <td colspan="8" class="py-12 text-center">
                  <div class="flex flex-col items-center gap-2 text-text-secondary">
                    <span class="material-symbols-outlined text-4xl">notifications_off</span>
                    <p class="text-sm">No alert rules found</p>
                    <button
                      @click="handleCreate"
                      class="mt-2 text-primary hover:underline text-sm"
                    >
                      Create your first alert rule
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Footer -->
        <div class="px-4 py-3 border-t border-border-dark flex items-center justify-between text-xs text-text-secondary">
          <span>Showing {{ rules.length }} rule{{ rules.length !== 1 ? 's' : '' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Dark theme select dropdown styling */
select option {
  background: #0f1923;
  color: white;
}
</style>

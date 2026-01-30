<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// ============================================================================
// Types
// ============================================================================

type TriggerType = 'zone_enter' | 'zone_exit' | 'arrival_overdue' | 'low_battery' | 'no_report'
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
type RecipientType = 'role' | 'email'

interface Recipient {
  type: RecipientType
  value: string
}

interface AlertRuleForm {
  name: string
  description: string
  triggerType: TriggerType
  severity: Severity
  conditions: {
    geozoneIds: string[]
    assetIds: string[]
    zoneTypes: string[]
    gracePeriodMinutes: number | null
    thresholdPercent: number | null
    windowMinutes: number | null
  }
  actions: {
    email: boolean
    inApp: boolean
    escalateAfterMinutes: number | null
  }
  recipients: Recipient[]
  cooldownMinutes: number | null
  isEnabled: boolean
}

interface GeozoneOption {
  id: string
  name: string
  type: string
}

interface AssetOption {
  id: string
  name: string
  assetType: string
}

// ============================================================================
// Props & Emits
// ============================================================================

const props = defineProps<{
  ruleId: string | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

// ============================================================================
// Constants
// ============================================================================

const API_BASE_URL = window.location.origin

const TRIGGER_TYPE_OPTIONS: { label: string; value: TriggerType; icon: string }[] = [
  { label: 'Zone Enter', value: 'zone_enter', icon: 'login' },
  { label: 'Zone Exit', value: 'zone_exit', icon: 'logout' },
  { label: 'Arrival Overdue', value: 'arrival_overdue', icon: 'schedule' },
  { label: 'Low Battery', value: 'low_battery', icon: 'battery_alert' },
  { label: 'No Report', value: 'no_report', icon: 'signal_wifi_off' }
]

const SEVERITY_OPTIONS: { label: string; value: Severity; color: string }[] = [
  { label: 'Critical', value: 'critical', color: '#ef4444' },
  { label: 'High', value: 'high', color: '#f97316' },
  { label: 'Medium', value: 'medium', color: '#f59e0b' },
  { label: 'Low', value: 'low', color: '#3b82f6' },
  { label: 'Info', value: 'info', color: '#6b7280' }
]

const ZONE_TYPE_OPTIONS = [
  { label: 'Warehouse', value: 'warehouse' },
  { label: 'Supplier', value: 'supplier' },
  { label: 'Customer', value: 'customer' },
  { label: 'Transit Hub', value: 'transit_hub' },
  { label: 'Restricted', value: 'restricted' }
]

const RECIPIENT_TYPE_OPTIONS: { label: string; value: RecipientType }[] = [
  { label: 'Role', value: 'role' },
  { label: 'Email', value: 'email' }
]

// ============================================================================
// Reactive State
// ============================================================================

const loading = ref(false)
const saving = ref(false)
const error = ref('')

const isEditMode = computed(() => !!props.ruleId)
const pageTitle = computed(() => isEditMode.value ? 'Edit Alert Rule' : 'New Alert Rule')

// Form state
const form = ref<AlertRuleForm>({
  name: '',
  description: '',
  triggerType: 'zone_enter',
  severity: 'medium',
  conditions: {
    geozoneIds: [],
    assetIds: [],
    zoneTypes: [],
    gracePeriodMinutes: null,
    thresholdPercent: null,
    windowMinutes: null
  },
  actions: {
    email: true,
    inApp: true,
    escalateAfterMinutes: null
  },
  recipients: [],
  cooldownMinutes: 15,
  isEnabled: true
})

// Lookup data for multi-selects
const geozoneOptions = ref<GeozoneOption[]>([])
const assetOptions = ref<AssetOption[]>([])
const geozonesLoading = ref(false)
const assetsLoading = ref(false)

// Geozone search/filter
const geozoneSearch = ref('')
const filteredGeozones = computed(() => {
  if (!geozoneSearch.value) return geozoneOptions.value
  const term = geozoneSearch.value.toLowerCase()
  return geozoneOptions.value.filter(g =>
    g.name.toLowerCase().includes(term) || g.type.toLowerCase().includes(term)
  )
})

// Asset search/filter
const assetSearch = ref('')
const filteredAssets = computed(() => {
  if (!assetSearch.value) return assetOptions.value
  const term = assetSearch.value.toLowerCase()
  return assetOptions.value.filter(a =>
    a.name.toLowerCase().includes(term) || (a.assetType && a.assetType.toLowerCase().includes(term))
  )
})

// ============================================================================
// Computed
// ============================================================================

const isZoneTrigger = computed(() =>
  form.value.triggerType === 'zone_enter' || form.value.triggerType === 'zone_exit'
)

const isArrivalOverdue = computed(() => form.value.triggerType === 'arrival_overdue')
const isLowBattery = computed(() => form.value.triggerType === 'low_battery')
const isNoReport = computed(() => form.value.triggerType === 'no_report')

const formValid = computed(() => {
  return form.value.name.trim().length > 0
})

// ============================================================================
// Data Loading
// ============================================================================

const loadRule = async () => {
  if (!props.ruleId) return

  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`${API_BASE_URL}/api/alert-rules/${props.ruleId}`)
    const result = await response.json()
    if (result.success && result.data) {
      const data = result.data
      form.value.name = data.name || ''
      form.value.description = data.description || ''
      form.value.triggerType = data.triggerType || 'zone_enter'
      form.value.severity = data.severity || 'medium'
      form.value.conditions = {
        geozoneIds: data.conditions?.geozoneIds || [],
        assetIds: data.conditions?.assetIds || [],
        zoneTypes: data.conditions?.zoneTypes || [],
        gracePeriodMinutes: data.conditions?.gracePeriodMinutes ?? null,
        thresholdPercent: data.conditions?.thresholdPercent ?? null,
        windowMinutes: data.conditions?.windowMinutes ?? null
      }
      form.value.actions = {
        email: data.actions?.email ?? true,
        inApp: data.actions?.inApp ?? true,
        escalateAfterMinutes: data.actions?.escalateAfterMinutes ?? null
      }
      form.value.recipients = Array.isArray(data.recipients) ? data.recipients : []
      form.value.cooldownMinutes = data.cooldownMinutes ?? 15
      form.value.isEnabled = data.isEnabled ?? true
    } else {
      error.value = result.error || 'Failed to load alert rule'
    }
  } catch (err) {
    error.value = 'Failed to load alert rule'
    console.error('Error loading alert rule:', err)
  } finally {
    loading.value = false
  }
}

const loadGeozones = async () => {
  geozonesLoading.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/geozones`)
    const result = await response.json()
    if (result.success && result.data) {
      geozoneOptions.value = result.data.map((g: any) => ({
        id: g.id,
        name: g.name,
        type: g.type || g.zoneType || 'unknown'
      }))
    }
  } catch (err) {
    console.error('Error loading geozones:', err)
  } finally {
    geozonesLoading.value = false
  }
}

const loadAssets = async () => {
  assetsLoading.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/assets`)
    const result = await response.json()
    if (result.success && result.data) {
      assetOptions.value = result.data.map((a: any) => ({
        id: a.id,
        name: a.name,
        assetType: a.assetType || ''
      }))
    }
  } catch (err) {
    console.error('Error loading assets:', err)
  } finally {
    assetsLoading.value = false
  }
}

// ============================================================================
// Save
// ============================================================================

const handleSave = async () => {
  if (!formValid.value) return

  saving.value = true
  error.value = ''

  try {
    const body: Record<string, any> = {
      name: form.value.name.trim(),
      description: form.value.description.trim() || null,
      triggerType: form.value.triggerType,
      severity: form.value.severity,
      conditions: {},
      actions: {
        email: form.value.actions.email,
        inApp: form.value.actions.inApp,
        escalateAfterMinutes: form.value.actions.escalateAfterMinutes
      },
      recipients: form.value.recipients,
      cooldownMinutes: form.value.cooldownMinutes,
      isEnabled: form.value.isEnabled
    }

    // Build conditions based on trigger type
    if (isZoneTrigger.value) {
      body.conditions = {
        geozoneIds: form.value.conditions.geozoneIds,
        assetIds: form.value.conditions.assetIds,
        zoneTypes: form.value.conditions.zoneTypes
      }
    } else if (isArrivalOverdue.value) {
      body.conditions = {
        gracePeriodMinutes: form.value.conditions.gracePeriodMinutes,
        assetIds: form.value.conditions.assetIds
      }
    } else if (isLowBattery.value) {
      body.conditions = {
        thresholdPercent: form.value.conditions.thresholdPercent,
        assetIds: form.value.conditions.assetIds
      }
    } else if (isNoReport.value) {
      body.conditions = {
        windowMinutes: form.value.conditions.windowMinutes,
        assetIds: form.value.conditions.assetIds
      }
    }

    const url = isEditMode.value
      ? `${API_BASE_URL}/api/alert-rules/${props.ruleId}`
      : `${API_BASE_URL}/api/alert-rules`

    const method = isEditMode.value ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    const result = await response.json()
    if (result.success) {
      emit('saved')
    } else {
      error.value = result.error || 'Failed to save alert rule'
    }
  } catch (err) {
    error.value = 'Failed to save alert rule. Please try again.'
    console.error('Error saving alert rule:', err)
  } finally {
    saving.value = false
  }
}

const handleCancel = () => {
  emit('close')
}

// ============================================================================
// Recipient Management
// ============================================================================

const addRecipient = () => {
  form.value.recipients.push({ type: 'email', value: '' })
}

const removeRecipient = (index: number) => {
  form.value.recipients.splice(index, 1)
}

// ============================================================================
// Multi-select helpers (checkbox-based)
// ============================================================================

const toggleGeozoneSelection = (geozoneId: string) => {
  const idx = form.value.conditions.geozoneIds.indexOf(geozoneId)
  if (idx >= 0) {
    form.value.conditions.geozoneIds.splice(idx, 1)
  } else {
    form.value.conditions.geozoneIds.push(geozoneId)
  }
}

const isGeozoneSelected = (geozoneId: string): boolean => {
  return form.value.conditions.geozoneIds.includes(geozoneId)
}

const toggleAssetSelection = (assetId: string) => {
  const idx = form.value.conditions.assetIds.indexOf(assetId)
  if (idx >= 0) {
    form.value.conditions.assetIds.splice(idx, 1)
  } else {
    form.value.conditions.assetIds.push(assetId)
  }
}

const isAssetSelected = (assetId: string): boolean => {
  return form.value.conditions.assetIds.includes(assetId)
}

const toggleZoneType = (zoneType: string) => {
  const idx = form.value.conditions.zoneTypes.indexOf(zoneType)
  if (idx >= 0) {
    form.value.conditions.zoneTypes.splice(idx, 1)
  } else {
    form.value.conditions.zoneTypes.push(zoneType)
  }
}

const isZoneTypeSelected = (zoneType: string): boolean => {
  return form.value.conditions.zoneTypes.includes(zoneType)
}

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(async () => {
  if (isEditMode.value) {
    await loadRule()
  }
  // Load lookup data in parallel
  loadGeozones()
  loadAssets()
})
</script>

<template>
  <div class="p-6 lg:p-8 bg-background-dark min-h-full">
    <div class="max-w-[960px] mx-auto flex flex-col gap-6">

      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div class="flex items-center gap-3">
          <button
            @click="handleCancel"
            class="p-2 rounded-lg bg-surface-dark border border-border-dark text-text-secondary hover:text-white hover:border-primary/50 transition-colors"
            title="Back to rules"
          >
            <span class="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <h1 class="text-2xl font-bold text-white">{{ pageTitle }}</h1>
            <p class="text-text-secondary text-sm mt-1">
              {{ isEditMode ? 'Modify the alert rule configuration' : 'Define a new automated alert rule' }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="handleCancel"
            class="px-4 py-2.5 bg-surface-dark border border-border-dark text-text-secondary text-sm font-semibold rounded-lg hover:text-white hover:border-primary/50 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="handleSave"
            :disabled="!formValid || saving"
            class="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span v-if="saving" class="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
            <span v-else class="material-symbols-outlined text-[20px]">save</span>
            {{ saving ? 'Saving...' : 'Save Rule' }}
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-surface-dark rounded-xl border border-border-dark p-12 flex flex-col items-center gap-3">
        <span class="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
        <p class="text-text-secondary text-sm">Loading alert rule...</p>
      </div>

      <!-- Form Content -->
      <template v-else>
        <!-- Error Banner -->
        <div
          v-if="error"
          class="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
        >
          <span class="material-symbols-outlined text-[18px]">error</span>
          {{ error }}
        </div>

        <!-- ================================================================ -->
        <!-- Section 1: Basic Info -->
        <!-- ================================================================ -->
        <div class="bg-surface-dark rounded-xl border border-border-dark p-6 flex flex-col gap-5">
          <div class="flex items-center gap-2 mb-1">
            <span class="material-symbols-outlined text-[20px] text-primary">info</span>
            <h2 class="text-white text-base font-semibold">Basic Information</h2>
          </div>

          <!-- Name -->
          <div class="flex flex-col gap-1.5">
            <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">
              Name <span class="text-red-400">*</span>
            </label>
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g. Zone Entry Alert - Warehouse"
              class="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-text-secondary transition-all"
            />
          </div>

          <!-- Description -->
          <div class="flex flex-col gap-1.5">
            <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Description</label>
            <textarea
              v-model="form.description"
              placeholder="Describe the purpose of this alert rule..."
              rows="3"
              class="w-full bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-text-secondary transition-all resize-none"
            ></textarea>
          </div>
        </div>

        <!-- ================================================================ -->
        <!-- Section 2: Trigger -->
        <!-- ================================================================ -->
        <div class="bg-surface-dark rounded-xl border border-border-dark p-6 flex flex-col gap-5">
          <div class="flex items-center gap-2 mb-1">
            <span class="material-symbols-outlined text-[20px] text-primary">bolt</span>
            <h2 class="text-white text-base font-semibold">Trigger</h2>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Trigger Type</label>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <button
                v-for="opt in TRIGGER_TYPE_OPTIONS"
                :key="opt.value"
                @click="form.triggerType = opt.value"
                class="flex flex-col items-center gap-2 p-3 rounded-lg border transition-all text-center"
                :class="form.triggerType === opt.value
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-background-dark border-border-dark text-text-secondary hover:border-primary/50 hover:text-white'"
              >
                <span class="material-symbols-outlined text-[22px]">{{ opt.icon }}</span>
                <span class="text-xs font-medium">{{ opt.label }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- ================================================================ -->
        <!-- Section 3: Conditions (dynamic based on trigger type) -->
        <!-- ================================================================ -->
        <div class="bg-surface-dark rounded-xl border border-border-dark p-6 flex flex-col gap-5">
          <div class="flex items-center gap-2 mb-1">
            <span class="material-symbols-outlined text-[20px] text-primary">tune</span>
            <h2 class="text-white text-base font-semibold">Conditions</h2>
          </div>

          <!-- Zone-based conditions (zone_enter / zone_exit) -->
          <template v-if="isZoneTrigger">
            <!-- Geozone Multi-Select -->
            <div class="flex flex-col gap-2">
              <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">
                Geozones
                <span class="text-text-secondary font-normal normal-case">({{ form.conditions.geozoneIds.length }} selected)</span>
              </label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px]">search</span>
                <input
                  v-model="geozoneSearch"
                  type="text"
                  placeholder="Search geozones..."
                  class="w-full bg-background-dark border border-border-dark rounded-lg pl-9 pr-4 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-text-secondary transition-all"
                />
              </div>
              <div class="max-h-[180px] overflow-y-auto rounded-lg border border-border-dark bg-background-dark divide-y divide-border-dark">
                <div v-if="geozonesLoading" class="p-3 text-center text-text-secondary text-xs">Loading geozones...</div>
                <div v-else-if="filteredGeozones.length === 0" class="p-3 text-center text-text-secondary text-xs">No geozones found</div>
                <label
                  v-for="gz in filteredGeozones"
                  :key="gz.id"
                  class="flex items-center gap-3 px-3 py-2 hover:bg-surface-dark-highlight cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    :checked="isGeozoneSelected(gz.id)"
                    @change="toggleGeozoneSelection(gz.id)"
                    class="w-4 h-4 rounded border-border-dark bg-background-dark text-primary focus:ring-primary/30 accent-primary"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-white text-sm truncate">{{ gz.name }}</p>
                    <p class="text-text-secondary text-xs">{{ gz.type }}</p>
                  </div>
                </label>
              </div>
            </div>

            <!-- Zone Types Multi-Select -->
            <div class="flex flex-col gap-2">
              <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">
                Zone Types
                <span class="text-text-secondary font-normal normal-case">({{ form.conditions.zoneTypes.length }} selected)</span>
              </label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="zt in ZONE_TYPE_OPTIONS"
                  :key="zt.value"
                  @click="toggleZoneType(zt.value)"
                  class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                  :class="isZoneTypeSelected(zt.value)
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-background-dark border-border-dark text-text-secondary hover:border-primary/50 hover:text-white'"
                >
                  {{ zt.label }}
                </button>
              </div>
            </div>

            <!-- Asset Multi-Select -->
            <div class="flex flex-col gap-2">
              <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">
                Assets
                <span class="text-text-secondary font-normal normal-case">({{ form.conditions.assetIds.length }} selected)</span>
              </label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px]">search</span>
                <input
                  v-model="assetSearch"
                  type="text"
                  placeholder="Search assets..."
                  class="w-full bg-background-dark border border-border-dark rounded-lg pl-9 pr-4 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-text-secondary transition-all"
                />
              </div>
              <div class="max-h-[180px] overflow-y-auto rounded-lg border border-border-dark bg-background-dark divide-y divide-border-dark">
                <div v-if="assetsLoading" class="p-3 text-center text-text-secondary text-xs">Loading assets...</div>
                <div v-else-if="filteredAssets.length === 0" class="p-3 text-center text-text-secondary text-xs">No assets found</div>
                <label
                  v-for="asset in filteredAssets"
                  :key="asset.id"
                  class="flex items-center gap-3 px-3 py-2 hover:bg-surface-dark-highlight cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    :checked="isAssetSelected(asset.id)"
                    @change="toggleAssetSelection(asset.id)"
                    class="w-4 h-4 rounded border-border-dark bg-background-dark text-primary focus:ring-primary/30 accent-primary"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-white text-sm truncate">{{ asset.name }}</p>
                    <p v-if="asset.assetType" class="text-text-secondary text-xs">{{ asset.assetType }}</p>
                  </div>
                </label>
              </div>
            </div>
          </template>

          <!-- Arrival Overdue conditions -->
          <template v-else-if="isArrivalOverdue">
            <div class="flex flex-col gap-1.5">
              <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Grace Period (minutes)</label>
              <input
                v-model.number="form.conditions.gracePeriodMinutes"
                type="number"
                min="1"
                placeholder="e.g. 30"
                class="w-full max-w-[240px] bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-text-secondary transition-all"
              />
              <p class="text-text-secondary text-xs">Minutes after expected arrival before triggering the alert</p>
            </div>

            <!-- Asset filter for arrival overdue -->
            <div class="flex flex-col gap-2">
              <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">
                Assets
                <span class="text-text-secondary font-normal normal-case">({{ form.conditions.assetIds.length }} selected)</span>
              </label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px]">search</span>
                <input
                  v-model="assetSearch"
                  type="text"
                  placeholder="Search assets..."
                  class="w-full bg-background-dark border border-border-dark rounded-lg pl-9 pr-4 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-text-secondary transition-all"
                />
              </div>
              <div class="max-h-[180px] overflow-y-auto rounded-lg border border-border-dark bg-background-dark divide-y divide-border-dark">
                <div v-if="assetsLoading" class="p-3 text-center text-text-secondary text-xs">Loading assets...</div>
                <div v-else-if="filteredAssets.length === 0" class="p-3 text-center text-text-secondary text-xs">No assets found</div>
                <label
                  v-for="asset in filteredAssets"
                  :key="asset.id"
                  class="flex items-center gap-3 px-3 py-2 hover:bg-surface-dark-highlight cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    :checked="isAssetSelected(asset.id)"
                    @change="toggleAssetSelection(asset.id)"
                    class="w-4 h-4 rounded border-border-dark bg-background-dark text-primary focus:ring-primary/30 accent-primary"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-white text-sm truncate">{{ asset.name }}</p>
                    <p v-if="asset.assetType" class="text-text-secondary text-xs">{{ asset.assetType }}</p>
                  </div>
                </label>
              </div>
            </div>
          </template>

          <!-- Low Battery conditions -->
          <template v-else-if="isLowBattery">
            <div class="flex flex-col gap-1.5">
              <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Threshold (%)</label>
              <div class="flex items-center gap-3 max-w-[320px]">
                <input
                  v-model.number="form.conditions.thresholdPercent"
                  type="range"
                  min="1"
                  max="100"
                  class="flex-1 h-2 rounded-full appearance-none bg-border-dark accent-primary"
                />
                <div class="flex items-center gap-1 min-w-[60px]">
                  <input
                    v-model.number="form.conditions.thresholdPercent"
                    type="number"
                    min="1"
                    max="100"
                    class="w-[56px] bg-background-dark border border-border-dark rounded-lg px-2 py-1.5 text-white text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                  <span class="text-text-secondary text-sm">%</span>
                </div>
              </div>
              <p class="text-text-secondary text-xs">Alert when battery drops below this percentage</p>
            </div>

            <!-- Asset filter for low battery -->
            <div class="flex flex-col gap-2">
              <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">
                Assets
                <span class="text-text-secondary font-normal normal-case">({{ form.conditions.assetIds.length }} selected)</span>
              </label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px]">search</span>
                <input
                  v-model="assetSearch"
                  type="text"
                  placeholder="Search assets..."
                  class="w-full bg-background-dark border border-border-dark rounded-lg pl-9 pr-4 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-text-secondary transition-all"
                />
              </div>
              <div class="max-h-[180px] overflow-y-auto rounded-lg border border-border-dark bg-background-dark divide-y divide-border-dark">
                <div v-if="assetsLoading" class="p-3 text-center text-text-secondary text-xs">Loading assets...</div>
                <div v-else-if="filteredAssets.length === 0" class="p-3 text-center text-text-secondary text-xs">No assets found</div>
                <label
                  v-for="asset in filteredAssets"
                  :key="asset.id"
                  class="flex items-center gap-3 px-3 py-2 hover:bg-surface-dark-highlight cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    :checked="isAssetSelected(asset.id)"
                    @change="toggleAssetSelection(asset.id)"
                    class="w-4 h-4 rounded border-border-dark bg-background-dark text-primary focus:ring-primary/30 accent-primary"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-white text-sm truncate">{{ asset.name }}</p>
                    <p v-if="asset.assetType" class="text-text-secondary text-xs">{{ asset.assetType }}</p>
                  </div>
                </label>
              </div>
            </div>
          </template>

          <!-- No Report conditions -->
          <template v-else-if="isNoReport">
            <div class="flex flex-col gap-1.5">
              <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Window (minutes)</label>
              <input
                v-model.number="form.conditions.windowMinutes"
                type="number"
                min="1"
                placeholder="e.g. 60"
                class="w-full max-w-[240px] bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-text-secondary transition-all"
              />
              <p class="text-text-secondary text-xs">Minutes of silence before triggering the alert</p>
            </div>

            <!-- Asset filter for no report -->
            <div class="flex flex-col gap-2">
              <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">
                Assets
                <span class="text-text-secondary font-normal normal-case">({{ form.conditions.assetIds.length }} selected)</span>
              </label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px]">search</span>
                <input
                  v-model="assetSearch"
                  type="text"
                  placeholder="Search assets..."
                  class="w-full bg-background-dark border border-border-dark rounded-lg pl-9 pr-4 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-text-secondary transition-all"
                />
              </div>
              <div class="max-h-[180px] overflow-y-auto rounded-lg border border-border-dark bg-background-dark divide-y divide-border-dark">
                <div v-if="assetsLoading" class="p-3 text-center text-text-secondary text-xs">Loading assets...</div>
                <div v-else-if="filteredAssets.length === 0" class="p-3 text-center text-text-secondary text-xs">No assets found</div>
                <label
                  v-for="asset in filteredAssets"
                  :key="asset.id"
                  class="flex items-center gap-3 px-3 py-2 hover:bg-surface-dark-highlight cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    :checked="isAssetSelected(asset.id)"
                    @change="toggleAssetSelection(asset.id)"
                    class="w-4 h-4 rounded border-border-dark bg-background-dark text-primary focus:ring-primary/30 accent-primary"
                  />
                  <div class="flex-1 min-w-0">
                    <p class="text-white text-sm truncate">{{ asset.name }}</p>
                    <p v-if="asset.assetType" class="text-text-secondary text-xs">{{ asset.assetType }}</p>
                  </div>
                </label>
              </div>
            </div>
          </template>
        </div>

        <!-- ================================================================ -->
        <!-- Section 4: Actions -->
        <!-- ================================================================ -->
        <div class="bg-surface-dark rounded-xl border border-border-dark p-6 flex flex-col gap-5">
          <div class="flex items-center gap-2 mb-1">
            <span class="material-symbols-outlined text-[20px] text-primary">send</span>
            <h2 class="text-white text-base font-semibold">Actions</h2>
          </div>

          <div class="flex flex-col gap-4">
            <!-- Email -->
            <label class="flex items-center gap-3 cursor-pointer">
              <div
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                :class="form.actions.email ? 'bg-primary' : 'bg-border-dark'"
                @click="form.actions.email = !form.actions.email"
              >
                <span
                  class="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                  :class="form.actions.email ? 'translate-x-6' : 'translate-x-1'"
                ></span>
              </div>
              <div>
                <p class="text-white text-sm font-medium">Email Notification</p>
                <p class="text-text-secondary text-xs">Send alert via email to recipients</p>
              </div>
            </label>

            <!-- In-App -->
            <label class="flex items-center gap-3 cursor-pointer">
              <div
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                :class="form.actions.inApp ? 'bg-primary' : 'bg-border-dark'"
                @click="form.actions.inApp = !form.actions.inApp"
              >
                <span
                  class="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                  :class="form.actions.inApp ? 'translate-x-6' : 'translate-x-1'"
                ></span>
              </div>
              <div>
                <p class="text-white text-sm font-medium">In-App Notification</p>
                <p class="text-text-secondary text-xs">Show alert in the portal notification center</p>
              </div>
            </label>

            <!-- Escalate After -->
            <div class="flex flex-col gap-1.5">
              <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Escalate After (minutes)</label>
              <input
                v-model.number="form.actions.escalateAfterMinutes"
                type="number"
                min="0"
                placeholder="Leave empty to disable escalation"
                class="w-full max-w-[320px] bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-text-secondary transition-all"
              />
              <p class="text-text-secondary text-xs">Escalate if the alert is not acknowledged within this period</p>
            </div>
          </div>
        </div>

        <!-- ================================================================ -->
        <!-- Section 5: Recipients -->
        <!-- ================================================================ -->
        <div class="bg-surface-dark rounded-xl border border-border-dark p-6 flex flex-col gap-5">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[20px] text-primary">group</span>
              <h2 class="text-white text-base font-semibold">Recipients</h2>
              <span class="text-text-secondary text-xs">({{ form.recipients.length }})</span>
            </div>
            <button
              @click="addRecipient"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-lg border border-primary/30 hover:bg-primary/20 transition-colors"
            >
              <span class="material-symbols-outlined text-[16px]">add</span>
              Add Recipient
            </button>
          </div>

          <!-- Recipients List -->
          <div v-if="form.recipients.length === 0" class="flex items-center gap-2 p-4 rounded-lg bg-background-dark border border-border-dark text-text-secondary text-sm">
            <span class="material-symbols-outlined text-[18px]">info</span>
            No recipients configured. Add at least one recipient to receive alerts.
          </div>

          <div v-else class="flex flex-col gap-3">
            <div
              v-for="(recipient, index) in form.recipients"
              :key="index"
              class="flex items-center gap-3 p-3 rounded-lg bg-background-dark border border-border-dark"
            >
              <!-- Type -->
              <select
                v-model="recipient.type"
                class="bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer min-w-[100px]"
              >
                <option v-for="opt in RECIPIENT_TYPE_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>

              <!-- Value -->
              <input
                v-model="recipient.value"
                type="text"
                :placeholder="recipient.type === 'email' ? 'user@example.com' : 'e.g. admin, manager'"
                class="flex-1 bg-surface-dark border border-border-dark rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-text-secondary transition-all"
              />

              <!-- Remove -->
              <button
                @click="removeRecipient(index)"
                class="p-1.5 text-text-secondary hover:text-red-400 transition-colors rounded-md hover:bg-red-500/10"
                title="Remove recipient"
              >
                <span class="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        </div>

        <!-- ================================================================ -->
        <!-- Section 6: Settings -->
        <!-- ================================================================ -->
        <div class="bg-surface-dark rounded-xl border border-border-dark p-6 flex flex-col gap-5">
          <div class="flex items-center gap-2 mb-1">
            <span class="material-symbols-outlined text-[20px] text-primary">settings</span>
            <h2 class="text-white text-base font-semibold">Settings</h2>
          </div>

          <!-- Severity -->
          <div class="flex flex-col gap-2">
            <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Severity</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="sev in SEVERITY_OPTIONS"
                :key="sev.value"
                @click="form.severity = sev.value"
                class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all"
                :class="form.severity === sev.value
                  ? 'border-current'
                  : 'bg-background-dark border-border-dark text-text-secondary hover:border-white/30 hover:text-white'"
                :style="form.severity === sev.value ? { color: sev.color, backgroundColor: sev.color + '15', borderColor: sev.color + '50' } : {}"
              >
                <span
                  class="size-2.5 rounded-full"
                  :style="{ backgroundColor: sev.color }"
                ></span>
                {{ sev.label }}
              </button>
            </div>
          </div>

          <!-- Cooldown -->
          <div class="flex flex-col gap-1.5">
            <label class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Cooldown (minutes)</label>
            <input
              v-model.number="form.cooldownMinutes"
              type="number"
              min="0"
              placeholder="e.g. 15"
              class="w-full max-w-[240px] bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-text-secondary transition-all"
            />
            <p class="text-text-secondary text-xs">Minimum time between consecutive alerts for this rule</p>
          </div>

          <!-- Enabled Toggle -->
          <label class="flex items-center gap-3 cursor-pointer">
            <div
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              :class="form.isEnabled ? 'bg-primary' : 'bg-border-dark'"
              @click="form.isEnabled = !form.isEnabled"
            >
              <span
                class="inline-block h-4 w-4 rounded-full bg-white transition-transform"
                :class="form.isEnabled ? 'translate-x-6' : 'translate-x-1'"
              ></span>
            </div>
            <div>
              <p class="text-white text-sm font-medium">Rule Enabled</p>
              <p class="text-text-secondary text-xs">Disable to pause this rule without deleting it</p>
            </div>
          </label>
        </div>

        <!-- ================================================================ -->
        <!-- Bottom Save Bar -->
        <!-- ================================================================ -->
        <div class="flex items-center justify-end gap-3 pb-4">
          <button
            @click="handleCancel"
            class="px-6 py-2.5 bg-surface-dark border border-border-dark text-text-secondary text-sm font-semibold rounded-lg hover:text-white hover:border-primary/50 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="handleSave"
            :disabled="!formValid || saving"
            class="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span v-if="saving" class="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
            <span v-else class="material-symbols-outlined text-[20px]">save</span>
            {{ saving ? 'Saving...' : (isEditMode ? 'Update Rule' : 'Create Rule') }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* Dark theme select dropdown styling */
select option {
  background: #0f1923;
  color: white;
}

/* Custom scrollbar for picker lists */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}
.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}
.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #283039;
  border-radius: 3px;
}
.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #3a4750;
}
</style>

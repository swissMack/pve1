<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

// ============================================================================
// Types
// ============================================================================

interface BulkOperation {
  id: string
  entityType: string
  status: string
  totalItems: number
  processedItems: number
  successCount: number
  errorCount: number
  skippedCount: number
  createdBy: string | null
  undoDeadline: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

interface BulkOperationItem {
  id: string
  bulkOperationId: string
  rowNumber: number
  deviceId: string | null
  assetId: string | null
  previousDeviceId: string | null
  previousAssetId: string | null
  status: string
  errorMessage: string | null
  createdAt: string
}

interface ValidationResult {
  batchId: string
  totalItems: number
  validCount: number
  invalidCount: number
  skippedCount: number
  items: {
    rowNumber: number
    deviceId: string
    assetId: string
    status: string
    errors: string[]
  }[]
}

interface CsvRow {
  deviceId: string
  assetId: string
}

interface DeviceOption {
  id: string
  name: string
}

interface AssetOption {
  id: string
  name: string
}

// ============================================================================
// Constants
// ============================================================================

const API_BASE_URL = window.location.origin

// ============================================================================
// Reactive State
// ============================================================================

// Tab state
const activeTab = ref<'csv' | 'batch'>('csv')

// CSV Upload
const csvContent = ref('')
const csvFileName = ref('')
const csvFileInput = ref<HTMLInputElement | null>(null)

// Batch UI
const batchRows = ref<CsvRow[]>([{ deviceId: '', assetId: '' }])
const deviceOptions = ref<DeviceOption[]>([])
const assetOptions = ref<AssetOption[]>([])

// Validation
const validating = ref(false)
const validationResult = ref<ValidationResult | null>(null)
const showValidationDialog = ref(false)

// Processing
const processing = ref(false)
const currentBatch = ref<BulkOperation | null>(null)
let pollInterval: ReturnType<typeof setInterval> | null = null

// History
const batches = ref<BulkOperation[]>([])
const batchesLoading = ref(true)

// Item details
const showItemsDialog = ref(false)
const selectedBatchItems = ref<BulkOperationItem[]>([])
const itemsLoading = ref(false)

// Error
const error = ref('')

// ============================================================================
// Computed Stats
// ============================================================================

const totalBatches = computed(() => batches.value.length)
const completedBatches = computed(() => batches.value.filter(b => b.status === 'completed').length)
const processingBatches = computed(() => batches.value.filter(b => b.status === 'processing').length)
const failedBatches = computed(() => batches.value.filter(b => b.status === 'failed').length)

// ============================================================================
// CSV Parsing
// ============================================================================

const triggerCsvUpload = () => {
  csvFileInput.value?.click()
}

const handleCsvFile = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  csvFileName.value = file.name
  const reader = new FileReader()
  reader.onload = (e) => {
    csvContent.value = (e.target?.result as string) || ''
  }
  reader.readAsText(file)
  // Reset input so same file can be re-selected
  target.value = ''
}

const parseCsvRows = (): CsvRow[] => {
  if (!csvContent.value.trim()) return []

  const lines = csvContent.value.trim().split('\n')
  const rows: CsvRow[] = []

  // Skip header if present
  const startIdx = lines[0].toLowerCase().includes('deviceid') || lines[0].toLowerCase().includes('device_id') ? 1 : 0

  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim().replace(/^["']|["']$/g, ''))
    if (parts.length >= 2 && parts[0] && parts[1]) {
      rows.push({ deviceId: parts[0], assetId: parts[1] })
    }
  }
  return rows
}

// ============================================================================
// Batch UI
// ============================================================================

const addBatchRow = () => {
  batchRows.value.push({ deviceId: '', assetId: '' })
}

const removeBatchRow = (index: number) => {
  if (batchRows.value.length > 1) {
    batchRows.value.splice(index, 1)
  }
}

const loadDevicesAndAssets = async () => {
  try {
    const [devRes, assetRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/devices`),
      fetch(`${API_BASE_URL}/api/assets`)
    ])
    const devResult = await devRes.json()
    const assetResult = await assetRes.json()
    if (devResult.success) deviceOptions.value = devResult.data.map((d: any) => ({ id: d.id, name: d.name || d.id }))
    if (assetResult.success) assetOptions.value = assetResult.data.map((a: any) => ({ id: a.id, name: a.name || a.id }))
  } catch (err) {
    console.error('Error loading devices/assets:', err)
  }
}

// ============================================================================
// Validation
// ============================================================================

const handleValidate = async () => {
  error.value = ''
  const rows = activeTab.value === 'csv' ? parseCsvRows() : batchRows.value.filter(r => r.deviceId && r.assetId)

  if (rows.length === 0) {
    error.value = activeTab.value === 'csv' ? 'No valid rows found in CSV. Expected format: deviceId,assetId' : 'Add at least one device-asset pair'
    return
  }

  validating.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/bulk/device-asset-association`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, createdBy: 'admin' })
    })
    const result = await response.json()
    if (result.success) {
      validationResult.value = result.data
      showValidationDialog.value = true
    } else {
      error.value = result.error || 'Validation failed'
    }
  } catch (err) {
    error.value = 'Failed to validate. Please try again.'
    console.error('Error validating:', err)
  } finally {
    validating.value = false
  }
}

// ============================================================================
// Confirm / Cancel / Undo
// ============================================================================

const handleConfirm = async () => {
  if (!validationResult.value) return

  processing.value = true
  showValidationDialog.value = false
  error.value = ''

  try {
    const response = await fetch(`${API_BASE_URL}/api/bulk/${validationResult.value.batchId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ performedBy: 'admin' })
    })
    const result = await response.json()
    if (result.success) {
      currentBatch.value = result.data
      // Clear inputs
      csvContent.value = ''
      csvFileName.value = ''
      batchRows.value = [{ deviceId: '', assetId: '' }]
      validationResult.value = null
      await loadBatches()
    } else {
      error.value = result.error || 'Failed to confirm batch'
    }
  } catch (err) {
    error.value = 'Failed to confirm batch'
    console.error('Error confirming:', err)
  } finally {
    processing.value = false
  }
}

const handleCancel = async () => {
  if (!validationResult.value) return

  try {
    await fetch(`${API_BASE_URL}/api/bulk/${validationResult.value.batchId}/cancel`, { method: 'POST' })
  } catch (err) {
    console.error('Error cancelling:', err)
  }
  validationResult.value = null
  showValidationDialog.value = false
}

const handleUndo = async (batchId: string) => {
  if (!confirm('Are you sure you want to undo this batch? All associations from this batch will be reverted.')) return

  try {
    const response = await fetch(`${API_BASE_URL}/api/bulk/${batchId}/undo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ performedBy: 'admin' })
    })
    const result = await response.json()
    if (result.success) {
      await loadBatches()
    } else {
      alert('Undo failed: ' + (result.error || 'Unknown error'))
    }
  } catch (err) {
    console.error('Error undoing batch:', err)
    alert('Failed to undo batch')
  }
}

// ============================================================================
// Batch History
// ============================================================================

const loadBatches = async () => {
  batchesLoading.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/bulk?limit=50`)
    const result = await response.json()
    if (result.success) {
      batches.value = result.data
    }
  } catch (err) {
    console.error('Error loading batches:', err)
  } finally {
    batchesLoading.value = false
  }
}

const viewBatchItems = async (batchId: string) => {
  showItemsDialog.value = true
  itemsLoading.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/bulk/${batchId}/items`)
    const result = await response.json()
    if (result.success) {
      selectedBatchItems.value = result.data
    }
  } catch (err) {
    console.error('Error loading items:', err)
  } finally {
    itemsLoading.value = false
  }
}

// ============================================================================
// Helpers
// ============================================================================

const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case 'completed': return 'bg-green-500/10 text-green-400'
    case 'processing': return 'bg-blue-500/10 text-blue-400'
    case 'validated': return 'bg-amber-500/10 text-amber-400'
    case 'failed': return 'bg-red-500/10 text-red-400'
    case 'cancelled': return 'bg-gray-500/10 text-gray-400'
    case 'undone': return 'bg-purple-500/10 text-purple-400'
    default: return 'bg-gray-500/10 text-gray-400'
  }
}

const getStatusIcon = (status: string): string => {
  switch (status) {
    case 'completed': return 'check_circle'
    case 'processing': return 'progress_activity'
    case 'validated': return 'pending'
    case 'failed': return 'error'
    case 'cancelled': return 'cancel'
    case 'undone': return 'undo'
    default: return 'help'
  }
}

const getItemStatusBadgeClass = (status: string): string => {
  switch (status) {
    case 'success': return 'bg-green-500/10 text-green-400'
    case 'error': return 'bg-red-500/10 text-red-400'
    case 'pending': return 'bg-amber-500/10 text-amber-400'
    case 'skipped': return 'bg-gray-500/10 text-gray-400'
    case 'undone': return 'bg-purple-500/10 text-purple-400'
    default: return 'bg-gray-500/10 text-gray-400'
  }
}

const canUndo = (batch: BulkOperation): boolean => {
  if (batch.status !== 'completed') return false
  if (!batch.undoDeadline) return false
  return new Date(batch.undoDeadline) > new Date()
}

const formatDateTime = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  } catch {
    return dateString
  }
}

const progressPercent = (batch: BulkOperation): number => {
  if (batch.totalItems === 0) return 0
  return Math.round((batch.processedItems / batch.totalItems) * 100)
}

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  loadBatches()
  loadDevicesAndAssets()
  // Poll for processing batches
  pollInterval = setInterval(async () => {
    const hasProcessing = batches.value.some(b => b.status === 'processing')
    if (hasProcessing) {
      await loadBatches()
    }
  }, 2000)
})

onBeforeUnmount(() => {
  if (pollInterval) clearInterval(pollInterval)
})
</script>

<template>
  <div class="p-6 lg:p-8 bg-background-dark min-h-full">
    <div class="max-w-[1600px] mx-auto flex flex-col gap-6">

      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">Bulk Operations</h1>
          <p class="text-text-secondary text-sm mt-1">Manage batch device-asset associations with CSV upload or manual selection</p>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-primary/10 text-primary">
            <span class="material-symbols-outlined text-[24px]">inventory</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ totalBatches }}</p>
            <p class="text-text-secondary text-xs">Total Batches</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-green-500/10 text-green-400">
            <span class="material-symbols-outlined text-[24px]">check_circle</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ completedBatches }}</p>
            <p class="text-text-secondary text-xs">Completed</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
            <span class="material-symbols-outlined text-[24px]">progress_activity</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ processingBatches }}</p>
            <p class="text-text-secondary text-xs">Processing</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-red-500/10 text-red-400">
            <span class="material-symbols-outlined text-[24px]">error</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ failedBatches }}</p>
            <p class="text-text-secondary text-xs">Failed</p>
          </div>
        </div>
      </div>

      <!-- Error Banner -->
      <div v-if="error" class="flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
        <span class="material-symbols-outlined text-[18px]">error</span>
        {{ error }}
        <button @click="error = ''" class="ml-auto text-red-400 hover:text-red-300">
          <span class="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>

      <!-- Upload Area -->
      <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
        <!-- Tab Header -->
        <div class="flex border-b border-border-dark">
          <button
            @click="activeTab = 'csv'"
            class="flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2"
            :class="activeTab === 'csv' ? 'text-primary border-primary' : 'text-text-secondary border-transparent hover:text-white'"
          >
            <span class="material-symbols-outlined text-[18px]">upload_file</span>
            CSV Upload
          </button>
          <button
            @click="activeTab = 'batch'"
            class="flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2"
            :class="activeTab === 'batch' ? 'text-primary border-primary' : 'text-text-secondary border-transparent hover:text-white'"
          >
            <span class="material-symbols-outlined text-[18px]">list_alt</span>
            Manual Batch
          </button>
        </div>

        <!-- CSV Upload Tab -->
        <div v-if="activeTab === 'csv'" class="p-6 flex flex-col gap-4">
          <div
            class="border-2 border-dashed border-border-dark rounded-xl p-8 flex flex-col items-center gap-4 cursor-pointer hover:border-primary/50 transition-colors"
            @click="triggerCsvUpload"
          >
            <input ref="csvFileInput" type="file" accept=".csv,.txt" class="hidden" @change="handleCsvFile" />
            <span class="material-symbols-outlined text-4xl text-text-secondary">cloud_upload</span>
            <div class="text-center">
              <p class="text-white font-medium">
                {{ csvFileName || 'Click to upload CSV file' }}
              </p>
              <p class="text-text-secondary text-xs mt-1">Format: deviceId,assetId (one pair per line)</p>
            </div>
          </div>

          <!-- CSV Preview -->
          <div v-if="csvContent" class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <p class="text-text-secondary text-xs font-semibold uppercase tracking-wider">Preview ({{ parseCsvRows().length }} rows)</p>
              <button @click="csvContent = ''; csvFileName = ''" class="text-text-secondary hover:text-red-400 text-xs">Clear</button>
            </div>
            <div class="bg-background-dark rounded-lg border border-border-dark p-3 max-h-[200px] overflow-y-auto">
              <pre class="text-white text-xs font-mono leading-relaxed">{{ csvContent.split('\n').slice(0, 10).join('\n') }}{{ csvContent.split('\n').length > 10 ? '\n...' : '' }}</pre>
            </div>
          </div>

          <button
            @click="handleValidate"
            :disabled="!csvContent || validating"
            class="self-end flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span v-if="validating" class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            <span v-else class="material-symbols-outlined text-[18px]">verified</span>
            {{ validating ? 'Validating...' : 'Validate' }}
          </button>
        </div>

        <!-- Manual Batch Tab -->
        <div v-if="activeTab === 'batch'" class="p-6 flex flex-col gap-4">
          <div class="flex flex-col gap-3">
            <div
              v-for="(row, index) in batchRows"
              :key="index"
              class="flex items-center gap-3"
            >
              <span class="text-text-secondary text-xs font-mono w-8 text-center">{{ index + 1 }}</span>
              <select
                v-model="row.deviceId"
                class="flex-1 bg-background-dark border border-border-dark rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
              >
                <option value="">Select Device...</option>
                <option v-for="dev in deviceOptions" :key="dev.id" :value="dev.id">{{ dev.name }}</option>
              </select>
              <span class="material-symbols-outlined text-text-secondary text-[18px]">arrow_forward</span>
              <select
                v-model="row.assetId"
                class="flex-1 bg-background-dark border border-border-dark rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
              >
                <option value="">Select Asset...</option>
                <option v-for="asset in assetOptions" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
              </select>
              <button
                @click="removeBatchRow(index)"
                :disabled="batchRows.length <= 1"
                class="p-1.5 text-text-secondary hover:text-red-400 transition-colors rounded-md hover:bg-red-500/10 disabled:opacity-30"
              >
                <span class="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <button
              @click="addBatchRow"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-lg border border-primary/30 hover:bg-primary/20 transition-colors"
            >
              <span class="material-symbols-outlined text-[16px]">add</span>
              Add Row
            </button>
            <button
              @click="handleValidate"
              :disabled="!batchRows.some(r => r.deviceId && r.assetId) || validating"
              class="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span v-if="validating" class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              <span v-else class="material-symbols-outlined text-[18px]">verified</span>
              {{ validating ? 'Validating...' : 'Validate' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Validation Report Dialog -->
      <div v-if="showValidationDialog && validationResult" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div class="bg-surface-dark rounded-xl border border-border-dark w-full max-w-[700px] max-h-[80vh] flex flex-col shadow-2xl">
          <!-- Dialog Header -->
          <div class="px-6 py-4 border-b border-border-dark flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-primary/10 text-primary">
                <span class="material-symbols-outlined text-[20px]">fact_check</span>
              </div>
              <h3 class="text-white font-semibold text-lg">Validation Report</h3>
            </div>
            <button @click="handleCancel" class="p-1.5 text-text-secondary hover:text-white transition-colors">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <!-- Summary -->
          <div class="px-6 py-4 grid grid-cols-3 gap-4 border-b border-border-dark">
            <div class="flex items-center gap-3">
              <span class="text-green-400 material-symbols-outlined text-[20px]">check_circle</span>
              <div>
                <p class="text-white font-bold text-lg">{{ validationResult.validCount }}</p>
                <p class="text-text-secondary text-xs">Valid</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-red-400 material-symbols-outlined text-[20px]">error</span>
              <div>
                <p class="text-white font-bold text-lg">{{ validationResult.invalidCount }}</p>
                <p class="text-text-secondary text-xs">Invalid</p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-gray-400 material-symbols-outlined text-[20px]">block</span>
              <div>
                <p class="text-white font-bold text-lg">{{ validationResult.skippedCount }}</p>
                <p class="text-text-secondary text-xs">Skipped</p>
              </div>
            </div>
          </div>

          <!-- Items List -->
          <div class="flex-1 overflow-y-auto px-6 py-4">
            <table class="w-full text-left border-collapse text-sm">
              <thead>
                <tr class="border-b border-border-dark">
                  <th class="py-2 px-2 text-xs font-semibold uppercase text-text-secondary">#</th>
                  <th class="py-2 px-2 text-xs font-semibold uppercase text-text-secondary">Device ID</th>
                  <th class="py-2 px-2 text-xs font-semibold uppercase text-text-secondary">Asset ID</th>
                  <th class="py-2 px-2 text-xs font-semibold uppercase text-text-secondary">Status</th>
                  <th class="py-2 px-2 text-xs font-semibold uppercase text-text-secondary">Errors</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-dark">
                <tr v-for="item in validationResult.items" :key="item.rowNumber" class="hover:bg-surface-dark-highlight">
                  <td class="py-2 px-2 text-text-secondary font-mono">{{ item.rowNumber }}</td>
                  <td class="py-2 px-2 text-white font-mono text-xs">{{ (item.deviceId || '-').substring(0, 12) }}...</td>
                  <td class="py-2 px-2 text-white font-mono text-xs">{{ (item.assetId || '-').substring(0, 12) }}...</td>
                  <td class="py-2 px-2">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      :class="item.status === 'valid' ? 'bg-green-500/10 text-green-400' : item.status === 'skipped' ? 'bg-gray-500/10 text-gray-400' : 'bg-red-500/10 text-red-400'"
                    >
                      {{ item.status }}
                    </span>
                  </td>
                  <td class="py-2 px-2 text-red-400 text-xs">{{ item.errors.join('; ') || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-border-dark flex items-center justify-end gap-3">
            <button
              @click="handleCancel"
              class="px-4 py-2.5 bg-surface-dark border border-border-dark text-text-secondary text-sm font-semibold rounded-lg hover:text-white hover:border-primary/50 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="handleConfirm"
              :disabled="validationResult.validCount === 0 || processing"
              class="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span v-if="processing" class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              <span v-else class="material-symbols-outlined text-[18px]">play_arrow</span>
              {{ processing ? 'Processing...' : `Confirm (${validationResult.validCount} items)` }}
            </button>
          </div>
        </div>
      </div>

      <!-- Batch History Table -->
      <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
        <div class="px-4 py-3 border-b border-border-dark flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="p-1.5 rounded-lg bg-primary/10 text-primary">
              <span class="material-symbols-outlined text-[18px]">history</span>
            </div>
            <h3 class="text-white font-semibold text-sm">Batch History</h3>
          </div>
          <button @click="loadBatches" class="text-text-secondary hover:text-primary transition-colors">
            <span class="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        </div>

        <!-- Loading -->
        <div v-if="batchesLoading" class="p-12 flex flex-col items-center gap-3">
          <span class="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
          <p class="text-text-secondary text-sm">Loading batches...</p>
        </div>

        <!-- Table -->
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-background-dark border-b border-border-dark">
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Batch ID</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Type</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Status</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Progress</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Items</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Created</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-dark text-sm">
              <tr
                v-for="batch in batches"
                :key="batch.id"
                class="hover:bg-surface-dark-highlight transition-colors group"
              >
                <td class="py-3 px-4">
                  <span class="text-white font-mono text-xs">{{ batch.id.substring(0, 8) }}...</span>
                </td>
                <td class="py-3 px-4">
                  <span class="text-text-secondary text-xs">{{ batch.entityType.replace(/_/g, ' ') }}</span>
                </td>
                <td class="py-3 px-4">
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    :class="getStatusBadgeClass(batch.status)"
                  >
                    <span class="material-symbols-outlined text-[14px]" :class="batch.status === 'processing' ? 'animate-spin' : ''">{{ getStatusIcon(batch.status) }}</span>
                    {{ batch.status }}
                  </span>
                </td>
                <td class="py-3 px-4">
                  <div v-if="batch.status === 'processing'" class="flex items-center gap-2 min-w-[120px]">
                    <div class="flex-1 h-1.5 bg-border-dark rounded-full overflow-hidden">
                      <div class="h-full bg-primary rounded-full transition-all" :style="{ width: progressPercent(batch) + '%' }"></div>
                    </div>
                    <span class="text-white text-xs font-medium">{{ progressPercent(batch) }}%</span>
                  </div>
                  <div v-else class="text-text-secondary text-xs">
                    <span class="text-green-400">{{ batch.successCount }}</span> /
                    <span class="text-red-400">{{ batch.errorCount }}</span> /
                    <span class="text-gray-400">{{ batch.skippedCount }}</span>
                  </div>
                </td>
                <td class="py-3 px-4">
                  <span class="text-white font-medium">{{ batch.totalItems }}</span>
                </td>
                <td class="py-3 px-4">
                  <span class="text-text-secondary text-xs">{{ formatDateTime(batch.createdAt) }}</span>
                </td>
                <td class="py-3 px-4 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      @click="viewBatchItems(batch.id)"
                      class="p-1.5 text-text-secondary hover:text-primary transition-colors rounded-md hover:bg-primary/10"
                      title="View items"
                    >
                      <span class="material-symbols-outlined text-[18px]">visibility</span>
                    </button>
                    <button
                      v-if="canUndo(batch)"
                      @click="handleUndo(batch.id)"
                      class="p-1.5 text-text-secondary hover:text-amber-400 transition-colors rounded-md hover:bg-amber-500/10"
                      title="Undo batch"
                    >
                      <span class="material-symbols-outlined text-[18px]">undo</span>
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-if="batches.length === 0">
                <td colspan="7" class="py-12 text-center">
                  <div class="flex flex-col items-center gap-2 text-text-secondary">
                    <span class="material-symbols-outlined text-4xl">inbox</span>
                    <p class="text-sm">No bulk operations yet</p>
                    <p class="text-xs">Upload a CSV or create a manual batch above</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Items Dialog -->
      <div v-if="showItemsDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div class="bg-surface-dark rounded-xl border border-border-dark w-full max-w-[800px] max-h-[80vh] flex flex-col shadow-2xl">
          <div class="px-6 py-4 border-b border-border-dark flex items-center justify-between">
            <h3 class="text-white font-semibold text-lg">Batch Items</h3>
            <button @click="showItemsDialog = false" class="p-1.5 text-text-secondary hover:text-white transition-colors">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto px-6 py-4">
            <div v-if="itemsLoading" class="flex items-center justify-center py-8 gap-3">
              <span class="material-symbols-outlined text-2xl text-primary animate-spin">progress_activity</span>
              <span class="text-text-secondary text-sm">Loading items...</span>
            </div>
            <table v-else class="w-full text-left border-collapse text-sm">
              <thead>
                <tr class="border-b border-border-dark">
                  <th class="py-2 px-2 text-xs font-semibold uppercase text-text-secondary">#</th>
                  <th class="py-2 px-2 text-xs font-semibold uppercase text-text-secondary">Device</th>
                  <th class="py-2 px-2 text-xs font-semibold uppercase text-text-secondary">Asset</th>
                  <th class="py-2 px-2 text-xs font-semibold uppercase text-text-secondary">Status</th>
                  <th class="py-2 px-2 text-xs font-semibold uppercase text-text-secondary">Error</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-dark">
                <tr v-for="item in selectedBatchItems" :key="item.id" class="hover:bg-surface-dark-highlight">
                  <td class="py-2 px-2 text-text-secondary font-mono">{{ item.rowNumber }}</td>
                  <td class="py-2 px-2 text-white font-mono text-xs">{{ (item.deviceId || '-').substring(0, 12) }}...</td>
                  <td class="py-2 px-2 text-white font-mono text-xs">{{ (item.assetId || '-').substring(0, 12) }}...</td>
                  <td class="py-2 px-2">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" :class="getItemStatusBadgeClass(item.status)">
                      {{ item.status }}
                    </span>
                  </td>
                  <td class="py-2 px-2 text-red-400 text-xs">{{ item.errorMessage || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="px-6 py-3 border-t border-border-dark flex justify-end">
            <button
              @click="showItemsDialog = false"
              class="px-4 py-2 bg-surface-dark border border-border-dark text-text-secondary text-sm font-semibold rounded-lg hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
select option {
  background: #0f1923;
  color: white;
}
</style>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'

// Asset type definition
interface Asset {
  id: string
  name: string
  assetType: string
  barcode: string
  currentStatus: string
  deviceId: string | null
  deviceName: string | null
  tripCount: number
  lastTripDate: string | null
  recycledContent: number | null
  composition: string | null
  labels: string[] | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

interface Props {
  refreshKey?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  selectAsset: [assetId: string]
}>()

const API_BASE_URL = window.location.origin

// Reactive state
const assets = ref<Asset[]>([])
const loading = ref(true)
const error = ref('')
const searchTerm = ref('')
const selectedStatus = ref('all')
const showCreateDialog = ref(false)
const saving = ref(false)

// Create form
const newAsset = ref({
  name: '',
  asset_type: '',
  barcode: '',
  current_status: 'at_facility',
  recycled_content: null as number | null
})

const statusOptions = [
  { label: 'All', value: 'all' },
  { label: 'At Facility', value: 'at_facility' },
  { label: 'In Transit', value: 'in_transit' },
  { label: 'At Customer', value: 'at_customer' },
  { label: 'At Supplier', value: 'at_supplier' },
  { label: 'Stored', value: 'stored' },
  { label: 'Unknown', value: 'unknown' }
]

const createStatusOptions = [
  { label: 'At Facility', value: 'at_facility' },
  { label: 'In Transit', value: 'in_transit' },
  { label: 'At Customer', value: 'at_customer' },
  { label: 'At Supplier', value: 'at_supplier' },
  { label: 'Stored', value: 'stored' },
  { label: 'Unknown', value: 'unknown' }
]

// Load assets from API
const loadAssets = async () => {
  loading.value = true
  error.value = ''
  try {
    const url = new URL('/api/assets', API_BASE_URL)
    if (selectedStatus.value && selectedStatus.value !== 'all') url.searchParams.set('status', selectedStatus.value)
    if (searchTerm.value) url.searchParams.set('search', searchTerm.value)
    const response = await fetch(url.toString())
    const result = await response.json()
    if (result.success) {
      assets.value = result.data
    } else {
      error.value = 'Failed to load assets'
    }
  } catch (err) {
    error.value = 'Failed to load assets'
    console.error('Error loading assets:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAssets()
})

// Watch for refresh trigger from parent
watch(() => props.refreshKey, () => {
  loadAssets()
})

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(searchTerm, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadAssets()
  }, 300)
})

watch(selectedStatus, () => {
  loadAssets()
})

// Stats computed
const totalCount = computed(() => assets.value.length)
const atFacilityCount = computed(() => assets.value.filter(a => a.currentStatus === 'at_facility').length)
const inTransitCount = computed(() => assets.value.filter(a => a.currentStatus === 'in_transit').length)
const atCustomerCount = computed(() => assets.value.filter(a => a.currentStatus === 'at_customer').length)

// Status display helpers
const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'at_facility': return 'At Facility'
    case 'in_transit': return 'In Transit'
    case 'at_customer': return 'At Customer'
    case 'at_supplier': return 'At Supplier'
    case 'stored': return 'Stored'
    case 'unknown': return 'Unknown'
    default: return status
  }
}

const getStatusClass = (status: string): string => {
  switch (status) {
    case 'at_facility': return 'bg-green-500/10 text-green-400 border-green-500/20'
    case 'in_transit': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    case 'at_customer': return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    case 'at_supplier': return 'bg-teal-500/10 text-teal-400 border-teal-500/20'
    case 'stored': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    case 'unknown': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }
}

const getStatusDotClass = (status: string): string => {
  switch (status) {
    case 'at_facility': return 'bg-green-400'
    case 'in_transit': return 'bg-blue-400'
    case 'at_customer': return 'bg-purple-400'
    case 'at_supplier': return 'bg-teal-400'
    case 'stored': return 'bg-gray-400'
    case 'unknown': return 'bg-amber-400'
    default: return 'bg-gray-400'
  }
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '\u2014'
  return new Date(dateStr).toLocaleDateString()
}

// Row click handler
const handleRowClick = (assetId: string) => {
  emit('selectAsset', assetId)
}

// Create dialog
const openCreateDialog = () => {
  newAsset.value = {
    name: '',
    asset_type: '',
    barcode: '',
    current_status: 'at_facility',
    recycled_content: null
  }
  showCreateDialog.value = true
}

const closeCreateDialog = () => {
  showCreateDialog.value = false
}

const saveNewAsset = async () => {
  if (!newAsset.value.name.trim()) return
  saving.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAsset.value)
    })
    const result = await response.json()
    if (result.success) {
      showCreateDialog.value = false
      loadAssets()
    } else {
      console.error('Failed to create asset:', result.error)
    }
  } catch (err) {
    console.error('Error creating asset:', err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="p-6 lg:p-8 bg-background-dark min-h-full">
    <div class="max-w-[1600px] mx-auto flex flex-col gap-6">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">Asset Management</h1>
          <p class="text-text-secondary text-sm mt-1">Track and manage your reusable packaging assets</p>
        </div>
        <button
          @click="openCreateDialog"
          class="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20"
        >
          <span class="material-symbols-outlined text-[20px]">add</span>
          Add Asset
        </button>
      </div>

      <!-- Stats Row -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-primary/10 text-primary">
            <span class="material-symbols-outlined text-[24px]">inventory_2</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ totalCount }}</p>
            <p class="text-text-secondary text-xs">Total Assets</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-green-500/10 text-green-400">
            <span class="material-symbols-outlined text-[24px]">warehouse</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ atFacilityCount }}</p>
            <p class="text-text-secondary text-xs">At Facility</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
            <span class="material-symbols-outlined text-[24px]">local_shipping</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ inTransitCount }}</p>
            <p class="text-text-secondary text-xs">In Transit</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-purple-500/10 text-purple-400">
            <span class="material-symbols-outlined text-[24px]">storefront</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ atCustomerCount }}</p>
            <p class="text-text-secondary text-xs">At Customer</p>
          </div>
        </div>
      </div>

      <!-- Filters and Search -->
      <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div class="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <!-- Search Input -->
          <div class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[20px]">search</span>
            <input
              v-model="searchTerm"
              type="text"
              placeholder="Search by name, barcode, or type..."
              class="w-full md:w-80 bg-background-dark border border-border-dark rounded-lg pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-text-secondary transition-all"
            />
          </div>
          <!-- Status Filter -->
          <div class="flex bg-background-dark p-1 rounded-lg border border-border-dark overflow-x-auto">
            <button
              v-for="opt in statusOptions"
              :key="opt.value"
              @click="selectedStatus = opt.value"
              class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
              :class="selectedStatus === opt.value ? 'bg-surface-dark text-white shadow-sm' : 'text-text-secondary hover:text-white hover:bg-surface-dark'"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
        <div class="text-text-secondary text-sm">
          Showing <span class="text-white font-medium">{{ assets.length }}</span> assets
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-surface-dark rounded-xl border border-border-dark p-12">
        <div class="flex flex-col items-center justify-center gap-3">
          <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
          <p class="text-text-secondary text-sm">Loading assets...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-surface-dark rounded-xl border border-border-dark p-12">
        <div class="flex flex-col items-center justify-center gap-3 text-text-secondary">
          <span class="material-symbols-outlined text-4xl text-red-400">error</span>
          <p class="text-sm">{{ error }}</p>
          <button
            @click="loadAssets"
            class="mt-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>

      <!-- Asset Table -->
      <div v-else class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-background-dark border-b border-border-dark">
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Name</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Status</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Type</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Barcode</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Device</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Trip Count</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Last Trip</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-dark text-sm">
              <tr
                v-for="asset in assets"
                :key="asset.id"
                class="hover:bg-surface-dark-highlight transition-colors group cursor-pointer"
                @click="handleRowClick(asset.id)"
              >
                <td class="py-3 px-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="size-10 rounded-lg flex items-center justify-center shrink-0"
                      :class="getStatusClass(asset.currentStatus)"
                    >
                      <span class="material-symbols-outlined text-[20px]">package_2</span>
                    </div>
                    <div>
                      <p class="text-white font-medium">{{ asset.name }}</p>
                      <p class="text-text-secondary text-xs">ID: {{ asset.id.substring(0, 8) }}...</p>
                    </div>
                  </div>
                </td>
                <td class="py-3 px-4">
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                    :class="getStatusClass(asset.currentStatus)"
                  >
                    <span class="size-1.5 rounded-full" :class="getStatusDotClass(asset.currentStatus)"></span>
                    {{ getStatusLabel(asset.currentStatus) }}
                  </span>
                </td>
                <td class="py-3 px-4 text-text-secondary">{{ asset.assetType || '\u2014' }}</td>
                <td class="py-3 px-4">
                  <code v-if="asset.barcode" class="text-xs font-mono text-text-secondary bg-background-dark px-2 py-1 rounded">{{ asset.barcode }}</code>
                  <span v-else class="text-text-secondary">&mdash;</span>
                </td>
                <td class="py-3 px-4">
                  <span v-if="asset.deviceName" class="text-primary font-medium">{{ asset.deviceName }}</span>
                  <span v-else class="text-text-secondary">&mdash;</span>
                </td>
                <td class="py-3 px-4">
                  <span class="text-white font-medium">{{ asset.tripCount ?? 0 }}</span>
                </td>
                <td class="py-3 px-4 text-text-secondary text-xs">
                  {{ formatDate(asset.lastTripDate) }}
                </td>
                <td class="py-3 px-4 text-right">
                  <button
                    @click.stop="handleRowClick(asset.id)"
                    class="text-text-secondary hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </button>
                </td>
              </tr>
              <tr v-if="assets.length === 0">
                <td colspan="8" class="py-12 text-center">
                  <div class="flex flex-col items-center gap-2 text-text-secondary">
                    <span class="material-symbols-outlined text-4xl">search_off</span>
                    <p class="text-sm">No assets found matching your criteria</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Pagination -->
        <div class="px-4 py-3 border-t border-border-dark flex items-center justify-between text-xs text-text-secondary">
          <span>Showing {{ assets.length }} assets</span>
          <div class="flex gap-2">
            <button class="hover:text-white disabled:opacity-50 px-2 py-1" disabled>Previous</button>
            <button class="hover:text-white px-2 py-1">Next</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Asset Dialog -->
    <Dialog
      v-model:visible="showCreateDialog"
      modal
      header="Create New Asset"
      :style="{ width: '28rem' }"
      :draggable="false"
    >
      <div class="flex flex-col gap-4 pt-4">
        <div class="flex flex-col gap-2">
          <label for="asset-name" class="text-sm font-medium text-white">Name <span class="text-red-400">*</span></label>
          <InputText
            id="asset-name"
            v-model="newAsset.name"
            placeholder="Enter asset name"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="asset-type" class="text-sm font-medium text-white">Asset Type</label>
          <InputText
            id="asset-type"
            v-model="newAsset.asset_type"
            placeholder="e.g., Pallet, Container, Crate"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="asset-barcode" class="text-sm font-medium text-white">Barcode</label>
          <InputText
            id="asset-barcode"
            v-model="newAsset.barcode"
            placeholder="Enter barcode"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="asset-status" class="text-sm font-medium text-white">Status</label>
          <Select
            id="asset-status"
            v-model="newAsset.current_status"
            :options="createStatusOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select status"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label for="asset-recycled" class="text-sm font-medium text-white">Recycled Content (%)</label>
          <InputNumber
            id="asset-recycled"
            v-model="newAsset.recycled_content"
            :min="0"
            :max="100"
            suffix="%"
            placeholder="0-100"
            class="w-full"
          />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="closeCreateDialog" :disabled="saving" />
        <Button
          label="Create Asset"
          @click="saveNewAsset"
          :loading="saving"
          :disabled="!newAsset.name.trim()"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
/* Additional dark theme styles */
</style>

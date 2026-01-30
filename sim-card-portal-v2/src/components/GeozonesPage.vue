<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Geozone {
  id: string
  name: string
  type: 'warehouse' | 'supplier' | 'customer' | 'transit_hub' | 'restricted'
  active: boolean
  address: string
  color: string
  assetCount: number
}

const emit = defineEmits<{
  selectGeozone: [geozoneId: string]
  createGeozone: []
}>()

const API_BASE_URL = window.location.origin

const geozones = ref<Geozone[]>([])
const loading = ref(true)
const error = ref('')

const loadGeozones = async () => {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`${API_BASE_URL}/api/geozones`)
    const result = await response.json()
    if (result.success && result.data) {
      geozones.value = result.data
    } else {
      error.value = result.error || 'Failed to load geozones'
    }
  } catch (err) {
    error.value = 'Failed to load geozones'
    console.error('Error loading geozones:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadGeozones()
})

// Stats
const totalCount = computed(() => geozones.value.length)
const activeCount = computed(() => geozones.value.filter(g => g.active).length)
const warehouseCount = computed(() => geozones.value.filter(g => g.type === 'warehouse').length)
const supplierCount = computed(() => geozones.value.filter(g => g.type === 'supplier').length)
const customerCount = computed(() => geozones.value.filter(g => g.type === 'customer').length)
const transitHubCount = computed(() => geozones.value.filter(g => g.type === 'transit_hub').length)

// Type badge styling
const getTypeBadgeClass = (type: string) => {
  switch (type) {
    case 'warehouse': return 'bg-green-500/10 text-green-400'
    case 'supplier': return 'bg-amber-500/10 text-amber-400'
    case 'customer': return 'bg-purple-500/10 text-purple-400'
    case 'transit_hub': return 'bg-blue-500/10 text-blue-400'
    case 'restricted': return 'bg-red-500/10 text-red-400'
    default: return 'bg-gray-500/10 text-gray-400'
  }
}

const formatTypeName = (type: string) => {
  switch (type) {
    case 'warehouse': return 'Warehouse'
    case 'supplier': return 'Supplier'
    case 'customer': return 'Customer'
    case 'transit_hub': return 'Transit Hub'
    case 'restricted': return 'Restricted'
    default: return type
  }
}

const handleRowClick = (geozoneId: string) => {
  emit('selectGeozone', geozoneId)
}

const handleCreate = () => {
  emit('createGeozone')
}

const handleDelete = async (geozone: Geozone) => {
  if (!confirm(`Are you sure you want to delete geozone "${geozone.name}"? This action cannot be undone.`)) {
    return
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/geozones/${geozone.id}`, {
      method: 'DELETE'
    })
    const result = await response.json()
    if (result.success) {
      geozones.value = geozones.value.filter(g => g.id !== geozone.id)
    } else {
      console.error('Failed to delete geozone:', result.error)
      alert('Failed to delete geozone: ' + (result.error || 'Unknown error'))
    }
  } catch (err) {
    console.error('Error deleting geozone:', err)
    alert('Failed to delete geozone. Please try again.')
  }
}
</script>

<template>
  <div class="p-6 lg:p-8 bg-background-dark min-h-full">
    <div class="max-w-[1600px] mx-auto flex flex-col gap-6">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">Geozones</h1>
          <p class="text-text-secondary text-sm mt-1">Manage geographic zones for asset tracking and alerts</p>
        </div>
        <button
          @click="handleCreate"
          class="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20"
        >
          <span class="material-symbols-outlined text-[20px]">add</span>
          New Geozone
        </button>
      </div>

      <!-- Stats Row -->
      <div class="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-primary/10 text-primary">
            <span class="material-symbols-outlined text-[24px]">pin_drop</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ totalCount }}</p>
            <p class="text-text-secondary text-xs">Total Geozones</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-green-500/10 text-green-400">
            <span class="material-symbols-outlined text-[24px]">check_circle</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ activeCount }}</p>
            <p class="text-text-secondary text-xs">Active</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-green-500/10 text-green-400">
            <span class="material-symbols-outlined text-[24px]">warehouse</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ warehouseCount }}</p>
            <p class="text-text-secondary text-xs">Warehouse</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
            <span class="material-symbols-outlined text-[24px]">local_shipping</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ supplierCount }}</p>
            <p class="text-text-secondary text-xs">Supplier</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-purple-500/10 text-purple-400">
            <span class="material-symbols-outlined text-[24px]">person</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ customerCount }}</p>
            <p class="text-text-secondary text-xs">Customer</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
            <span class="material-symbols-outlined text-[24px]">hub</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ transitHubCount }}</p>
            <p class="text-text-secondary text-xs">Transit Hub</p>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="bg-surface-dark rounded-xl border border-border-dark p-12 flex flex-col items-center gap-3">
        <span class="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
        <p class="text-text-secondary text-sm">Loading geozones...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-surface-dark rounded-xl border border-red-500/30 p-8 flex flex-col items-center gap-3">
        <span class="material-symbols-outlined text-4xl text-red-400">error</span>
        <p class="text-red-400 text-sm">{{ error }}</p>
        <button
          @click="loadGeozones"
          class="mt-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>

      <!-- Geozone Table -->
      <div v-else class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-background-dark border-b border-border-dark">
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Name</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Type</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Active</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Address</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Color</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Asset Count</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-dark text-sm">
              <tr
                v-for="geozone in geozones"
                :key="geozone.id"
                class="hover:bg-surface-dark-highlight transition-colors group cursor-pointer"
                @click="handleRowClick(geozone.id)"
              >
                <!-- Name -->
                <td class="py-3 px-4">
                  <div class="flex items-center gap-3">
                    <div class="size-10 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                      <span class="material-symbols-outlined text-[20px]">pin_drop</span>
                    </div>
                    <div>
                      <p class="text-white font-medium">{{ geozone.name }}</p>
                      <p class="text-text-secondary text-xs">ID: {{ geozone.id }}</p>
                    </div>
                  </div>
                </td>

                <!-- Type Badge -->
                <td class="py-3 px-4">
                  <span
                    class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                    :class="getTypeBadgeClass(geozone.type)"
                  >
                    {{ formatTypeName(geozone.type) }}
                  </span>
                </td>

                <!-- Active Toggle Icon -->
                <td class="py-3 px-4">
                  <span
                    class="material-symbols-outlined text-[20px]"
                    :class="geozone.active ? 'text-green-400' : 'text-text-secondary'"
                  >
                    {{ geozone.active ? 'toggle_on' : 'toggle_off' }}
                  </span>
                </td>

                <!-- Address -->
                <td class="py-3 px-4 text-text-secondary max-w-[250px] truncate">
                  {{ geozone.address || '-' }}
                </td>

                <!-- Color Swatch -->
                <td class="py-3 px-4">
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-block size-5 rounded-full border border-border-dark"
                      :style="{ backgroundColor: geozone.color }"
                    ></span>
                    <span class="text-text-secondary text-xs font-mono">{{ geozone.color }}</span>
                  </div>
                </td>

                <!-- Asset Count -->
                <td class="py-3 px-4">
                  <span class="text-white font-medium">{{ geozone.assetCount }}</span>
                </td>

                <!-- Actions -->
                <td class="py-3 px-4 text-right">
                  <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      @click.stop="handleDelete(geozone)"
                      class="text-text-secondary hover:text-red-400 transition-colors"
                      title="Delete geozone"
                    >
                      <span class="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                    <button
                      @click.stop="handleRowClick(geozone.id)"
                      class="text-text-secondary hover:text-primary transition-colors"
                    >
                      <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="geozones.length === 0">
                <td colspan="7" class="py-12 text-center">
                  <div class="flex flex-col items-center gap-2 text-text-secondary">
                    <span class="material-symbols-outlined text-4xl">location_off</span>
                    <p class="text-sm">No geozones found</p>
                    <button
                      @click="handleCreate"
                      class="mt-2 text-primary hover:underline text-sm"
                    >
                      Create your first geozone
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Footer -->
        <div class="px-4 py-3 border-t border-border-dark flex items-center justify-between text-xs text-text-secondary">
          <span>Showing {{ geozones.length }} geozone{{ geozones.length !== 1 ? 's' : '' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Additional dark theme styles */
</style>

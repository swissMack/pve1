<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { type SIMCard } from '../data/mockData'
import { dataService } from '../data/dataService'
import SIMCardDetail from './SIMCardDetail.vue'

interface Props {
  refreshKey?: number
}

const props = defineProps<Props>()

const searchTerm = ref('')
const selectedStatus = ref('All')
const selectedCarrier = ref('All')
const sortBy = ref('id')
const sortOrder = ref<'asc' | 'desc'>('asc')
const simCards = ref<SIMCard[]>([])
const loading = ref(true)
const error = ref('')
const selectedSIMCardId = ref<string | null>(null)

const statusOptions = [
  { label: 'All SIMs', value: 'All' },
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
  { label: 'Suspended', value: 'Suspended' }
]

// Load SIM cards from data service
const loadSIMCards = async () => {
  loading.value = true
  error.value = ''
  try {
    simCards.value = await dataService.getSIMCards()
  } catch (err) {
    error.value = 'Failed to load SIM cards'
    console.error('Error loading SIM cards:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadSIMCards()
})

// Watch for refresh trigger from parent
watch(() => props.refreshKey, () => {
  loadSIMCards()
})

const filteredSIMCards = computed(() => {
  let filtered = simCards.value.filter(sim => {
    const matchesSearch = sim.id.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
                         sim.iccid.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
                         sim.msisdn.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
                         sim.carrier.toLowerCase().includes(searchTerm.value.toLowerCase())
    const matchesStatus = selectedStatus.value === 'All' || sim.status.toLowerCase() === selectedStatus.value.toLowerCase()
    const matchesCarrier = selectedCarrier.value === 'All' || sim.carrier === selectedCarrier.value
    return matchesSearch && matchesStatus && matchesCarrier
  })

  return filtered.sort((a, b) => {
    const aValue = a[sortBy.value as keyof SIMCard]
    const bValue = b[sortBy.value as keyof SIMCard]

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue)
      return sortOrder.value === 'asc' ? comparison : -comparison
    }

    return 0
  })
})

const getStatusClass = (status: string) => {
  switch (status.toLowerCase()) {
    case 'active': return 'bg-green-500/10 text-green-400 border-green-500/20'
    case 'available': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    case 'inactive': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    case 'suspended': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    case 'terminated': return 'bg-red-500/10 text-red-400 border-red-500/20'
    default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }
}

const getDataUsagePercentage = (used: string, limit: string) => {
  const usedMB = parseFloat(used.replace(/[^\d.]/g, ''))
  const limitMB = parseFloat(limit.replace(/[^\d.]/g, ''))
  return limitMB > 0 ? Math.round((usedMB / limitMB) * 100) : 0
}

const getUsageBarClass = (percentage: number) => {
  if (percentage >= 90) return 'bg-red-400'
  if (percentage >= 75) return 'bg-orange-400'
  if (percentage >= 50) return 'bg-amber-400'
  return 'bg-teal-400'
}

const sort = (column: string) => {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = column
    sortOrder.value = 'asc'
  }
}

const isExpiringSoon = (expiryDate: string) => {
  const expiry = new Date(expiryDate)
  const today = new Date()
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return daysUntilExpiry <= 30
}

const showSIMCardDetail = (simCardId: string) => {
  selectedSIMCardId.value = simCardId
}

const closeSIMCardDetail = () => {
  selectedSIMCardId.value = null
}

// Handle SIM card update from detail popup
const handleSIMCardUpdated = (updatedSIMCard: SIMCard) => {
  // Update the SIM card in the local array
  const index = simCards.value.findIndex(s => s.id === updatedSIMCard.id)
  if (index !== -1) {
    simCards.value[index] = { ...updatedSIMCard }
  }
}

// Stats computed
const activeCount = computed(() => simCards.value.filter(s => s.status.toLowerCase() === 'active').length)
const inactiveCount = computed(() => simCards.value.filter(s => s.status.toLowerCase() === 'inactive').length)
const expiringCount = computed(() => simCards.value.filter(s => isExpiringSoon(s.expiryDate)).length)
</script>

<template>
  <div class="p-6 lg:p-8 bg-background-dark min-h-full">
    <div class="max-w-[1600px] mx-auto flex flex-col gap-6">
      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white">SIM Card Management</h1>
          <p class="text-text-secondary text-sm mt-1">Monitor and manage your SIM card inventory</p>
        </div>
      </div>

      <!-- Stats Row -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-teal-500/10 text-teal-400">
            <span class="material-symbols-outlined text-[24px]">sim_card</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ simCards.length }}</p>
            <p class="text-text-secondary text-xs">Total SIMs</p>
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
          <div class="p-2.5 rounded-lg bg-gray-500/10 text-gray-400">
            <span class="material-symbols-outlined text-[24px]">pause_circle</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ inactiveCount }}</p>
            <p class="text-text-secondary text-xs">Inactive</p>
          </div>
        </div>
        <div class="bg-surface-dark rounded-xl border border-border-dark p-4 flex items-center gap-4">
          <div class="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
            <span class="material-symbols-outlined text-[24px]">schedule</span>
          </div>
          <div>
            <p class="text-2xl font-bold text-white">{{ expiringCount }}</p>
            <p class="text-text-secondary text-xs">Expiring Soon</p>
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
              placeholder="Search by ID, ICCID, MSISDN..."
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
          Showing <span class="text-white font-medium">{{ filteredSIMCards.length }}</span> of {{ simCards.length }} SIMs
        </div>
      </div>

      <!-- SIM Card Table -->
      <div class="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-background-dark border-b border-border-dark">
                <th @click="sort('id')" class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider cursor-pointer hover:text-white transition-colors">
                  <div class="flex items-center gap-1">
                    SIM ID
                    <span v-if="sortBy === 'id'" class="material-symbols-outlined text-[16px]">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                  </div>
                </th>
                <th @click="sort('status')" class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider cursor-pointer hover:text-white transition-colors">
                  <div class="flex items-center gap-1">
                    Status
                    <span v-if="sortBy === 'status'" class="material-symbols-outlined text-[16px]">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                  </div>
                </th>
                <th @click="sort('iccid')" class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider cursor-pointer hover:text-white transition-colors">
                  <div class="flex items-center gap-1">
                    ICCID
                    <span v-if="sortBy === 'iccid'" class="material-symbols-outlined text-[16px]">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                  </div>
                </th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">MSISDN</th>
                <th @click="sort('carrier')" class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider cursor-pointer hover:text-white transition-colors">
                  <div class="flex items-center gap-1">
                    Carrier
                    <span v-if="sortBy === 'carrier'" class="material-symbols-outlined text-[16px]">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                  </div>
                </th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Data Usage</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider">Expiry</th>
                <th class="py-3 px-4 text-xs font-semibold uppercase text-text-secondary tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-dark text-sm">
              <tr
                v-for="sim in filteredSIMCards"
                :key="sim.id"
                class="hover:bg-surface-dark-highlight transition-colors group cursor-pointer"
                @click="showSIMCardDetail(sim.id)"
              >
                <td class="py-3 px-4">
                  <div class="flex items-center gap-3">
                    <div class="size-10 rounded-lg flex items-center justify-center shrink-0"
                      :class="sim.status.toLowerCase() === 'active' ? 'bg-teal-500/10 text-teal-400' : 'bg-gray-500/10 text-gray-400'">
                      <span class="material-symbols-outlined text-[20px]">sim_card</span>
                    </div>
                    <div>
                      <p class="text-white font-medium">{{ sim.id }}</p>
                      <p class="text-text-secondary text-xs">{{ sim.plan }}</p>
                    </div>
                  </div>
                </td>
                <td class="py-3 px-4">
                  <span
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                    :class="getStatusClass(sim.status)"
                  >
                    <span class="size-1.5 rounded-full"
                      :class="sim.status.toLowerCase() === 'active' ? 'bg-green-400' : sim.status.toLowerCase() === 'suspended' ? 'bg-amber-400' : 'bg-gray-400'"></span>
                    {{ sim.status }}
                  </span>
                </td>
                <td class="py-3 px-4">
                  <code class="text-xs font-mono text-text-secondary bg-background-dark px-2 py-1 rounded">{{ sim.iccid }}</code>
                </td>
                <td class="py-3 px-4 text-white font-mono text-xs">{{ sim.msisdn }}</td>
                <td class="py-3 px-4 text-white">{{ sim.carrier }}</td>
                <td class="py-3 px-4">
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-text-secondary">{{ sim.dataUsed }} / {{ sim.dataLimit }}</span>
                      <span class="text-white font-medium">{{ getDataUsagePercentage(sim.dataUsed, sim.dataLimit) }}%</span>
                    </div>
                    <div class="w-24 h-1.5 bg-border-dark rounded-full overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all"
                        :style="{ width: `${getDataUsagePercentage(sim.dataUsed, sim.dataLimit)}%` }"
                        :class="getUsageBarClass(getDataUsagePercentage(sim.dataUsed, sim.dataLimit))"
                      ></div>
                    </div>
                  </div>
                </td>
                <td class="py-3 px-4">
                  <span
                    class="text-xs"
                    :class="isExpiringSoon(sim.expiryDate) ? 'text-amber-400' : 'text-text-secondary'"
                  >
                    {{ new Date(sim.expiryDate).toLocaleDateString() }}
                    <span v-if="isExpiringSoon(sim.expiryDate)" class="ml-1 text-amber-400">(Soon)</span>
                  </span>
                </td>
                <td class="py-3 px-4 text-right">
                  <button
                    @click.stop="showSIMCardDetail(sim.id)"
                    class="text-text-secondary hover:text-primary opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </button>
                </td>
              </tr>
              <tr v-if="filteredSIMCards.length === 0">
                <td colspan="8" class="py-12 text-center">
                  <div class="flex flex-col items-center gap-2 text-text-secondary">
                    <span class="material-symbols-outlined text-4xl">search_off</span>
                    <p class="text-sm">No SIM cards found matching your criteria</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Pagination -->
        <div class="px-4 py-3 border-t border-border-dark flex items-center justify-between text-xs text-text-secondary">
          <span>Showing {{ filteredSIMCards.length }} of {{ simCards.length }} SIM cards</span>
          <div class="flex gap-2">
            <button class="hover:text-white disabled:opacity-50 px-2 py-1" disabled>Previous</button>
            <button class="hover:text-white px-2 py-1">Next</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- SIM Card Detail Modal -->
  <SIMCardDetail
    v-if="selectedSIMCardId"
    :sim-card-id="selectedSIMCardId"
    :on-close="closeSIMCardDetail"
    @updated="handleSIMCardUpdated"
  />
</template>

<style scoped>
/* Additional dark theme styles */
</style>

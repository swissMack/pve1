<script setup>
import { ref, onMounted } from 'vue'
import SimList from './provisioning/SimList.vue'
import SimDetails from './provisioning/SimDetails.vue'
import BlockDialog from './provisioning/BlockDialog.vue'
import UnblockDialog from './provisioning/UnblockDialog.vue'
import { useSims } from '../composables/useSims.js'
import { useAutoRefresh } from '../composables/useAutoRefresh.js'

const {
  sims,
  filteredSims,
  selectedSim,
  loading,
  error,
  statusFilter,
  iccidSearch,
  fetchSims,
  selectSim,
  clearSelection,
  blockSim,
  unblockSim,
  clearFilters
} = useSims()

// Dialog visibility
const showDetails = ref(false)
const showBlockDialog = ref(false)
const showUnblockDialog = ref(false)
const actionLoading = ref(false)

// Auto-refresh every 30 seconds
useAutoRefresh(fetchSims, 30000)

const handleSelect = (sim) => {
  selectSim(sim)
  showDetails.value = true
}

const handleBlock = (sim) => {
  selectSim(sim)
  showDetails.value = false
  showBlockDialog.value = true
}

const handleUnblock = (sim) => {
  selectSim(sim)
  showDetails.value = false
  showUnblockDialog.value = true
}

const confirmBlock = async (reason, notes) => {
  if (!selectedSim.value) return
  actionLoading.value = true
  try {
    await blockSim(selectedSim.value.simId, { reason, notes })
    showBlockDialog.value = false
    clearSelection()
  } catch (err) {
    console.error('Block failed:', err)
  } finally {
    actionLoading.value = false
  }
}

const confirmUnblock = async (notes) => {
  if (!selectedSim.value) return
  actionLoading.value = true
  try {
    await unblockSim(selectedSim.value.simId, { notes })
    showUnblockDialog.value = false
    clearSelection()
  } catch (err) {
    console.error('Unblock failed:', err)
  } finally {
    actionLoading.value = false
  }
}

onMounted(() => {
  fetchSims()
})
</script>

<template>
  <div class="provisioning-view">
    <h2 class="view-title mb-4">
      <i class="pi pi-mobile mr-2"></i>
      SIM Provisioning
    </h2>

    <!-- Error Message -->
    <div v-if="error" class="mb-4 p-3 border-1 border-red-300 border-round bg-red-50">
      <div class="flex align-items-center gap-2">
        <i class="pi pi-exclamation-triangle text-red-500"></i>
        <span class="text-red-700">{{ error }}</span>
      </div>
    </div>

    <!-- SIM List -->
    <SimList
      :sims="filteredSims"
      :loading="loading"
      :statusFilter="statusFilter"
      :iccidSearch="iccidSearch"
      @update:statusFilter="statusFilter = $event"
      @update:iccidSearch="iccidSearch = $event"
      @select="handleSelect"
      @reset-filters="clearFilters"
    />

    <!-- SIM Details Dialog -->
    <SimDetails
      :sim="selectedSim"
      :visible="showDetails"
      @update:visible="showDetails = $event"
      @block="handleBlock"
      @unblock="handleUnblock"
    />

    <!-- Block Dialog -->
    <BlockDialog
      :sim="selectedSim"
      :visible="showBlockDialog"
      :loading="actionLoading"
      @update:visible="showBlockDialog = $event"
      @confirm="confirmBlock"
    />

    <!-- Unblock Dialog -->
    <UnblockDialog
      :sim="selectedSim"
      :visible="showUnblockDialog"
      :loading="actionLoading"
      @update:visible="showUnblockDialog = $event"
      @confirm="confirmUnblock"
    />
  </div>
</template>

<style scoped>
.view-title {
  display: flex;
  align-items: center;
  color: #4fc3f7;
  font-size: 1.5rem;
  font-weight: 600;
}
</style>

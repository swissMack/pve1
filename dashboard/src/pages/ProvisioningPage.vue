<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useSims } from '@/composables/useSims'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import SimList from '@/components/provisioning/SimList.vue'
import SimDetails from '@/components/provisioning/SimDetails.vue'
import BlockDialog from '@/components/provisioning/BlockDialog.vue'
import UnblockDialog from '@/components/provisioning/UnblockDialog.vue'
import ErrorRetry from '@/components/common/ErrorRetry.vue'
import type { Sim, BlockReason } from '@/types/sim'

const toast = useToast()

const {
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

const { isRefreshing } = useAutoRefresh(fetchSims, 30000)

const showDetails = ref(false)
const showBlockDialog = ref(false)
const showUnblockDialog = ref(false)
const actionLoading = ref(false)

const handleSelect = (sim: Sim) => {
  selectSim(sim)
  showDetails.value = true
}

const handleBlock = (sim: Sim) => {
  selectSim(sim)
  showDetails.value = false
  showBlockDialog.value = true
}

const handleUnblock = (sim: Sim) => {
  selectSim(sim)
  showDetails.value = false
  showUnblockDialog.value = true
}

const confirmBlock = async (reason: BlockReason, notes: string) => {
  if (!selectedSim.value) return

  actionLoading.value = true
  try {
    await blockSim(selectedSim.value.simId, { reason, notes })
    toast.add({
      severity: 'success',
      summary: 'SIM Blocked',
      detail: `SIM ${selectedSim.value.iccid} has been blocked`,
      life: 3000
    })
    showBlockDialog.value = false
  } catch (err: unknown) {
    const apiError = err as { errorCode?: string; displayMessage?: string }
    if (apiError.errorCode === 'INVALID_STATE_TRANSITION') {
      toast.add({
        severity: 'info',
        summary: 'Already Blocked',
        detail: 'This SIM is already blocked',
        life: 3000
      })
    } else {
      toast.add({
        severity: 'error',
        summary: 'Block Failed',
        detail: apiError.displayMessage || 'Failed to block SIM',
        life: 5000
      })
    }
  } finally {
    actionLoading.value = false
  }
}

const confirmUnblock = async (notes: string) => {
  if (!selectedSim.value) return

  actionLoading.value = true
  try {
    await unblockSim(selectedSim.value.simId, { notes })
    toast.add({
      severity: 'success',
      summary: 'SIM Unblocked',
      detail: `SIM ${selectedSim.value.iccid} has been unblocked`,
      life: 3000
    })
    showUnblockDialog.value = false
  } catch (err: unknown) {
    const apiError = err as { displayMessage?: string }
    toast.add({
      severity: 'error',
      summary: 'Unblock Failed',
      detail: apiError.displayMessage || 'Failed to unblock SIM',
      life: 5000
    })
  } finally {
    actionLoading.value = false
  }
}

const closeDetails = () => {
  showDetails.value = false
  clearSelection()
}
</script>

<template>
  <div class="provisioning-page">
    <div class="flex justify-content-between align-items-center mb-4">
      <h2 class="text-xl font-semibold m-0">Provisioning</h2>
      <div class="flex align-items-center gap-2">
        <i
          v-if="isRefreshing"
          class="pi pi-spin pi-spinner text-primary"
          data-testid="auto-refresh-indicator"
        />
        <span class="text-sm text-500">Auto-refresh: 30s</span>
      </div>
    </div>

    <ErrorRetry
      v-if="error"
      :message="error"
      @retry="fetchSims"
    />

    <SimList
      v-else
      :sims="filteredSims"
      :loading="loading"
      :statusFilter="statusFilter"
      :iccidSearch="iccidSearch"
      @update:statusFilter="statusFilter = $event"
      @update:iccidSearch="iccidSearch = $event"
      @select="handleSelect"
      @reset-filters="clearFilters"
    />

    <SimDetails
      :sim="selectedSim"
      :visible="showDetails"
      @update:visible="showDetails = $event; if (!$event) closeDetails()"
      @block="handleBlock"
      @unblock="handleUnblock"
    />

    <BlockDialog
      :sim="selectedSim"
      :visible="showBlockDialog"
      :loading="actionLoading"
      @update:visible="showBlockDialog = $event"
      @confirm="confirmBlock"
    />

    <UnblockDialog
      :sim="selectedSim"
      :visible="showUnblockDialog"
      :loading="actionLoading"
      @update:visible="showUnblockDialog = $event"
      @confirm="confirmUnblock"
    />
  </div>
</template>

import { ref, computed } from 'vue'
import { provisioningService } from '@/services/provisioningService'
import type { Sim, SimStatus, BlockRequest, UnblockRequest } from '@/types/sim'

export function useSims() {
  const sims = ref<Sim[]>([])
  const selectedSim = ref<Sim | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const statusFilter = ref<SimStatus | null>(null)
  const iccidSearch = ref('')

  const filteredSims = computed(() => {
    let result = sims.value

    if (statusFilter.value) {
      result = result.filter(sim => sim.status === statusFilter.value)
    }

    if (iccidSearch.value) {
      result = result.filter(sim =>
        sim.iccid.includes(iccidSearch.value) ||
        sim.msisdn.includes(iccidSearch.value)
      )
    }

    return result
  })

  const fetchSims = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await provisioningService.listSims()
      sims.value = response.data
    } catch (err: unknown) {
      const apiError = err as { displayMessage?: string }
      error.value = apiError.displayMessage || 'Failed to fetch SIMs'
    } finally {
      loading.value = false
    }
  }

  const selectSim = (sim: Sim) => {
    selectedSim.value = sim
  }

  const clearSelection = () => {
    selectedSim.value = null
  }

  const blockSim = async (simId: string, request: BlockRequest) => {
    loading.value = true
    error.value = null

    try {
      const updatedSim = await provisioningService.blockSim(simId, request)
      const index = sims.value.findIndex(s => s.simId === simId)
      if (index !== -1) {
        sims.value[index] = updatedSim
      }
      if (selectedSim.value?.simId === simId) {
        selectedSim.value = updatedSim
      }
      return updatedSim
    } catch (err: unknown) {
      const apiError = err as { displayMessage?: string; errorCode?: string }
      error.value = apiError.displayMessage || 'Failed to block SIM'
      throw err
    } finally {
      loading.value = false
    }
  }

  const unblockSim = async (simId: string, request: UnblockRequest) => {
    loading.value = true
    error.value = null

    try {
      const updatedSim = await provisioningService.unblockSim(simId, request)
      const index = sims.value.findIndex(s => s.simId === simId)
      if (index !== -1) {
        sims.value[index] = updatedSim
      }
      if (selectedSim.value?.simId === simId) {
        selectedSim.value = updatedSim
      }
      return updatedSim
    } catch (err: unknown) {
      const apiError = err as { displayMessage?: string }
      error.value = apiError.displayMessage || 'Failed to unblock SIM'
      throw err
    } finally {
      loading.value = false
    }
  }

  const clearFilters = () => {
    statusFilter.value = null
    iccidSearch.value = ''
  }

  return {
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
  }
}

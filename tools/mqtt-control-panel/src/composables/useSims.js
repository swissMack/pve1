import { ref, computed } from 'vue'
import { provisioningService } from '../services/provisioningService.js'

export function useSims() {
  const sims = ref([])
  const selectedSim = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const statusFilter = ref(null)
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
    } catch (err) {
      error.value = err.displayMessage || 'Failed to fetch SIMs'
    } finally {
      loading.value = false
    }
  }

  const selectSim = (sim) => {
    selectedSim.value = sim
  }

  const clearSelection = () => {
    selectedSim.value = null
  }

  const blockSim = async (simId, request) => {
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
    } catch (err) {
      error.value = err.displayMessage || 'Failed to block SIM'
      throw err
    } finally {
      loading.value = false
    }
  }

  const unblockSim = async (simId, request) => {
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
    } catch (err) {
      error.value = err.displayMessage || 'Failed to unblock SIM'
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

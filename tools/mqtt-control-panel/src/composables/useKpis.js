import { ref } from 'vue'
import { billingService } from '../services/billingService.js'

export function useKpis() {
  const kpis = ref(null)
  const trends = ref([])
  const carriers = ref([])
  const granularity = ref('daily')
  const loading = ref(false)
  const error = ref(null)

  const fetchKpis = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await billingService.getKpis()
      kpis.value = response.data
    } catch (err) {
      error.value = err.displayMessage || 'Failed to fetch KPIs'
    } finally {
      loading.value = false
    }
  }

  const fetchTrends = async () => {
    try {
      const response = await billingService.getTrends(granularity.value)
      trends.value = response.data
    } catch (err) {
      error.value = err.displayMessage || 'Failed to fetch trends'
    }
  }

  const fetchCarriers = async () => {
    try {
      const response = await billingService.getCarriers()
      carriers.value = response.data
    } catch (err) {
      error.value = err.displayMessage || 'Failed to fetch carrier data'
    }
  }

  const fetchAll = async () => {
    loading.value = true
    error.value = null
    try {
      await Promise.all([fetchKpis(), fetchTrends(), fetchCarriers()])
    } finally {
      loading.value = false
    }
  }

  const setGranularity = async (newGranularity) => {
    granularity.value = newGranularity
    await fetchTrends()
  }

  return {
    kpis,
    trends,
    carriers,
    granularity,
    loading,
    error,
    fetchKpis,
    fetchTrends,
    fetchCarriers,
    fetchAll,
    setGranularity
  }
}

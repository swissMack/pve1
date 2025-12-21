import { ref, computed } from 'vue'
import { billingService } from '../services/billingService.js'

export function useInvoices() {
  const invoices = ref([])
  const loading = ref(false)
  const error = ref(null)
  const statusFilter = ref(null)
  const carrierFilter = ref(null)

  const filteredInvoices = computed(() => {
    let result = invoices.value

    if (statusFilter.value) {
      result = result.filter(inv => inv.status === statusFilter.value)
    }

    if (carrierFilter.value) {
      result = result.filter(inv => inv.carrierId === carrierFilter.value)
    }

    return result
  })

  const carriers = computed(() => {
    const uniqueCarriers = new Map()
    invoices.value.forEach(inv => {
      if (!uniqueCarriers.has(inv.carrierId)) {
        uniqueCarriers.set(inv.carrierId, { id: inv.carrierId, name: inv.carrierName })
      }
    })
    return Array.from(uniqueCarriers.values())
  })

  const fetchInvoices = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await billingService.listInvoices()
      invoices.value = response.data
    } catch (err) {
      error.value = err.displayMessage || 'Failed to fetch invoices'
    } finally {
      loading.value = false
    }
  }

  const clearFilters = () => {
    statusFilter.value = null
    carrierFilter.value = null
  }

  return {
    invoices,
    filteredInvoices,
    loading,
    error,
    statusFilter,
    carrierFilter,
    carriers,
    fetchInvoices,
    clearFilters
  }
}

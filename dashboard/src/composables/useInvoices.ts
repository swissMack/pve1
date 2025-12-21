import { ref, computed } from 'vue'
import { billingService } from '@/services/billingService'
import type { Invoice, InvoiceStatus } from '@/types/invoice'

export function useInvoices() {
  const invoices = ref<Invoice[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const statusFilter = ref<InvoiceStatus | null>(null)
  const carrierFilter = ref<string | null>(null)

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
    const uniqueCarriers = new Map<string, { id: string; name: string }>()
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
    } catch (err: unknown) {
      const apiError = err as { displayMessage?: string }
      error.value = apiError.displayMessage || 'Failed to fetch invoices'
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

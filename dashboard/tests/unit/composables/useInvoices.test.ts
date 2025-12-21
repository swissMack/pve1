import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useInvoices } from '@/composables/useInvoices'
import { flushPromises } from '@vue/test-utils'
import type { Invoice } from '@/types/invoice'

vi.mock('@/services/billingService', () => ({
  billingService: {
    listInvoices: vi.fn()
  }
}))

import { billingService } from '@/services/billingService'

const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-001',
    carrierId: 'carrier1',
    carrierName: 'Carrier One',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    totalAmount: 1500.00,
    currency: 'CHF',
    status: 'pending',
    dueDate: '2024-02-15',
    paidDate: null,
    pdfUrl: 'https://example.com/invoice1.pdf',
    erpnextReference: 'ERP-001'
  },
  {
    id: '2',
    invoiceNumber: 'INV-2024-002',
    carrierId: 'carrier2',
    carrierName: 'Carrier Two',
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    totalAmount: 2500.00,
    currency: 'CHF',
    status: 'paid',
    dueDate: '2024-02-15',
    paidDate: '2024-02-10',
    pdfUrl: null,
    erpnextReference: 'ERP-002'
  }
]

describe('useInvoices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize with empty invoices and loading false', () => {
    const { invoices, loading, error } = useInvoices()

    expect(invoices.value).toEqual([])
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('should fetch invoices on fetchInvoices call', async () => {
    vi.mocked(billingService.listInvoices).mockResolvedValueOnce({
      success: true,
      data: mockInvoices,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 }
    })

    const { invoices, loading, fetchInvoices } = useInvoices()

    const fetchPromise = fetchInvoices()
    expect(loading.value).toBe(true)

    await fetchPromise

    expect(loading.value).toBe(false)
    expect(invoices.value).toHaveLength(2)
    expect(invoices.value[0].invoiceNumber).toBe('INV-2024-001')
  })

  it('should set error on fetch failure', async () => {
    vi.mocked(billingService.listInvoices).mockRejectedValueOnce({
      displayMessage: 'Network error'
    })

    const { error, fetchInvoices } = useInvoices()

    await fetchInvoices()

    expect(error.value).toBe('Network error')
  })

  it('should filter invoices by status', async () => {
    vi.mocked(billingService.listInvoices).mockResolvedValue({
      success: true,
      data: mockInvoices,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 }
    })

    const { filteredInvoices, statusFilter, fetchInvoices } = useInvoices()

    await fetchInvoices()

    statusFilter.value = 'paid'
    await flushPromises()

    expect(filteredInvoices.value).toHaveLength(1)
    expect(filteredInvoices.value[0].status).toBe('paid')
  })

  it('should filter invoices by carrier', async () => {
    vi.mocked(billingService.listInvoices).mockResolvedValue({
      success: true,
      data: mockInvoices,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 }
    })

    const { filteredInvoices, carrierFilter, fetchInvoices } = useInvoices()

    await fetchInvoices()

    carrierFilter.value = 'carrier1'
    await flushPromises()

    expect(filteredInvoices.value).toHaveLength(1)
    expect(filteredInvoices.value[0].carrierId).toBe('carrier1')
  })

  it('should return all invoices when no filter applied', async () => {
    vi.mocked(billingService.listInvoices).mockResolvedValue({
      success: true,
      data: mockInvoices,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 }
    })

    const { filteredInvoices, statusFilter, carrierFilter, fetchInvoices } = useInvoices()

    await fetchInvoices()

    statusFilter.value = null
    carrierFilter.value = null

    expect(filteredInvoices.value).toHaveLength(2)
  })

  it('should extract unique carriers from invoices', async () => {
    vi.mocked(billingService.listInvoices).mockResolvedValue({
      success: true,
      data: mockInvoices,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 }
    })

    const { carriers, fetchInvoices } = useInvoices()

    await fetchInvoices()

    expect(carriers.value).toHaveLength(2)
    expect(carriers.value).toContainEqual({ id: 'carrier1', name: 'Carrier One' })
    expect(carriers.value).toContainEqual({ id: 'carrier2', name: 'Carrier Two' })
  })
})

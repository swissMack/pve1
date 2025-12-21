export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'disputed'

export interface Invoice {
  id: string
  invoiceNumber: string
  carrierId: string
  carrierName: string
  periodStart: string
  periodEnd: string
  totalAmount: number
  currency: string
  status: InvoiceStatus
  dueDate: string
  paidDate: string | null
  pdfUrl: string | null
  erpnextReference: string | null
}

export interface InvoiceListResponse {
  success: boolean
  data: Invoice[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

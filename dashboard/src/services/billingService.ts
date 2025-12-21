import { api } from './api'
import type { InvoiceListResponse, InvoiceStatus } from '@/types/invoice'
import type { KpiResponse, TrendResponse, CarrierResponse, TrendGranularity } from '@/types/kpi'

export interface ListInvoicesParams {
  status?: InvoiceStatus
  carrier_id?: string
  page?: number
  limit?: number
}

export const billingService = {
  async listInvoices(params?: ListInvoicesParams): Promise<InvoiceListResponse> {
    const response = await api.get<InvoiceListResponse>('/api/consumption/invoices', { params })
    return response.data
  },

  async getKpis(): Promise<KpiResponse> {
    const response = await api.get<KpiResponse>('/api/consumption/kpis')
    return response.data
  },

  async getTrends(granularity: TrendGranularity): Promise<TrendResponse> {
    const response = await api.get<TrendResponse>('/api/consumption/trends', {
      params: { granularity }
    })
    return response.data
  },

  async getCarriers(): Promise<CarrierResponse> {
    const response = await api.get<CarrierResponse>('/api/consumption/carriers')
    return response.data
  }
}

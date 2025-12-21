import { api } from './api.js'

export const billingService = {
  async listInvoices(params) {
    const response = await api.get('/api/consumption/invoices', { params })
    return response.data
  },

  async getKpis() {
    const response = await api.get('/api/consumption/kpis')
    return response.data
  },

  async getTrends(granularity) {
    const response = await api.get('/api/consumption/trends', {
      params: { granularity }
    })
    return response.data
  },

  async getCarriers() {
    const response = await api.get('/api/consumption/carriers')
    return response.data
  }
}

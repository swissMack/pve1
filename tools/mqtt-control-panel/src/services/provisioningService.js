import { api } from './api.js'

export const provisioningService = {
  async listSims(params) {
    const response = await api.get('/api/v1/sims', { params })
    return response.data
  },

  async getSim(simId) {
    const response = await api.get(`/api/v1/sims/${simId}`)
    return response.data
  },

  async blockSim(simId, request) {
    const response = await api.post(`/api/v1/sims/${simId}/block`, request)
    return response.data
  },

  async unblockSim(simId, request) {
    const response = await api.post(`/api/v1/sims/${simId}/unblock`, request)
    return response.data
  }
}

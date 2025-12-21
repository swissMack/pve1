import { api } from './api.js'

export const testingService = {
  async healthCheck() {
    const response = await api.get('/api/v1/health')
    return response.data
  },

  async lookupSim(iccid) {
    try {
      const response = await api.get('/api/v1/sims', {
        params: { iccid }
      })
      return response.data.data[0] || null
    } catch {
      return null
    }
  }
}

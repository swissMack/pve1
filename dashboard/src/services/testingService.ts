import { api } from './api'
import type { Sim } from '@/types/sim'

export interface HealthResponse {
  status: string
  timestamp: string
}

export const testingService = {
  async healthCheck(): Promise<HealthResponse> {
    const response = await api.get<HealthResponse>('/api/v1/health')
    return response.data
  },

  async lookupSim(iccid: string): Promise<Sim | null> {
    try {
      const response = await api.get<{ data: Sim[] }>('/api/v1/sims', {
        params: { iccid }
      })
      return response.data.data[0] || null
    } catch {
      return null
    }
  }
}

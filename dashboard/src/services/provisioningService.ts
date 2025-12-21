import { api } from './api'
import type { Sim, SimListResponse, SimStatus, BlockRequest, UnblockRequest } from '@/types/sim'

export interface ListSimsParams {
  status?: SimStatus
  iccid?: string
  customerId?: string
  limit?: number
  offset?: number
}

export const provisioningService = {
  async listSims(params?: ListSimsParams): Promise<SimListResponse> {
    const response = await api.get<SimListResponse>('/api/v1/sims', { params })
    return response.data
  },

  async getSim(simId: string): Promise<Sim> {
    const response = await api.get<Sim>(`/api/v1/sims/${simId}`)
    return response.data
  },

  async blockSim(simId: string, request: BlockRequest): Promise<Sim> {
    const response = await api.post<Sim>(`/api/v1/sims/${simId}/block`, request)
    return response.data
  },

  async unblockSim(simId: string, request: UnblockRequest): Promise<Sim> {
    const response = await api.post<Sim>(`/api/v1/sims/${simId}/unblock`, request)
    return response.data
  }
}

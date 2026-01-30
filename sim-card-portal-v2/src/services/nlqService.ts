/**
 * Sprint 6: NLQ Service
 * Frontend service for NLQ query API
 */

import type { NlqQueryResponse } from '../types/nlq'

const API_BASE_URL = window.location.origin

export interface NlqQueryResult {
  success: boolean
  data?: NlqQueryResponse
  error?: string
}

export async function queryNlq(query: string): Promise<NlqQueryResult> {
  const response = await fetch(`${API_BASE_URL}/api/nlq/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': localStorage.getItem('sim-portal-user')
        ? JSON.parse(localStorage.getItem('sim-portal-user')!).username
        : 'anonymous',
      'X-Tenant-Id': 'default'
    },
    body: JSON.stringify({ query })
  })

  const result = await response.json()
  return result
}

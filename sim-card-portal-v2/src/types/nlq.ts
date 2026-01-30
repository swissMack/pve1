/**
 * Sprint 6: NLQ + Chat Types
 * Types for Ask Bob NLQ Dashboard and Bob Support Chat
 */

// ============================================================================
// NLQ Types
// ============================================================================

export type NlqFilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'between'

export type NlqEntity = 'devices' | 'sim_cards' | 'assets' | 'geozones' | 'alerts' | 'alert_rules' | 'notifications'

export type NlqQueryStatus = 'pending' | 'success' | 'error' | 'rejected'

export interface NlqFilter {
  field: string
  operator: NlqFilterOperator
  value: string | number | boolean | string[] | number[]
}

export interface NlqAggregation {
  function: 'count' | 'sum' | 'avg' | 'min' | 'max'
  field?: string
  alias?: string
}

export interface NlqSort {
  field: string
  direction: 'asc' | 'desc'
}

export interface NlqTimeRange {
  field: string
  start?: string
  end?: string
  relative?: string // e.g. "last 7 days", "this month"
}

export interface NlqIntent {
  entity: NlqEntity
  filters: NlqFilter[]
  sort: NlqSort[]
  aggregations: NlqAggregation[]
  timeRange?: NlqTimeRange
  limit?: number
  explanation: string
}

export interface NlqQueryRequest {
  query: string
}

export interface NlqQueryResponse {
  intent: NlqIntent
  results: Record<string, unknown>[]
  totalCount: number
  executionTimeMs: number
  explanation: string
  generatedSql?: string
}

export interface NlqQueryLog {
  id: string
  tenantId: string
  userId: string
  queryText: string
  parsedIntent: NlqIntent | null
  generatedSql: string | null
  resultCount: number | null
  status: NlqQueryStatus
  errorMessage: string | null
  executionTimeMs: number | null
  modelUsed: string | null
  createdAt: string
}

// ============================================================================
// Chat Types
// ============================================================================

export type ChatMessageRole = 'user' | 'assistant' | 'system'

export interface ChatConversation {
  id: string
  tenantId: string
  userId: string
  title: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  conversationId: string
  role: ChatMessageRole
  content: string
  metadata: Record<string, unknown>
  createdAt: string
}

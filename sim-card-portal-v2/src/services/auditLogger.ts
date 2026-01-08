/**
 * Audit Logger Service
 * Structured logging for filter changes, API calls, and user actions
 * Provides audit trail for debugging and compliance
 * @see specs/003-consumption-filters-llm/tasks.md T051
 */

import type { FilterCriteria, TimeGranularity } from '@/types/analytics'

// ============================================================================
// Types
// ============================================================================

/** Log levels for audit entries */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Action types for categorizing audit entries */
export type AuditAction =
  | 'FILTER_APPLY'
  | 'FILTER_CLEAR'
  | 'GRANULARITY_CHANGE'
  | 'DATE_RANGE_CHANGE'
  | 'API_REQUEST'
  | 'API_SUCCESS'
  | 'API_ERROR'
  | 'API_CACHE_HIT'
  | 'EXPORT_CSV'
  | 'ASKBOB_QUERY'

/** Structured audit log entry */
export interface AuditLogEntry {
  timestamp: string
  level: LogLevel
  action: AuditAction
  component: string
  details: Record<string, unknown>
  duration?: number
  sessionId: string
}

/** API call context for timing */
export interface ApiCallContext {
  endpoint: string
  params: Record<string, unknown>
  startTime: number
}

// ============================================================================
// Configuration
// ============================================================================

const LOG_PREFIX = '[Audit]'
const SESSION_KEY = 'audit:sessionId'
const LOG_HISTORY_KEY = 'audit:history'
const MAX_LOG_HISTORY = 100

// Enable/disable console logging (can be toggled for production)
let consoleLoggingEnabled = import.meta.env.DEV || import.meta.env.VITE_AUDIT_LOG === 'true'

// ============================================================================
// Session Management
// ============================================================================

/**
 * Get or create a session ID for grouping related audit entries
 */
function getSessionId(): string {
  let sessionId = sessionStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    sessionStorage.setItem(SESSION_KEY, sessionId)
  }
  return sessionId
}

// ============================================================================
// Log Storage
// ============================================================================

/**
 * Store log entry in session storage for later retrieval
 */
function storeLogEntry(entry: AuditLogEntry): void {
  try {
    const historyJson = sessionStorage.getItem(LOG_HISTORY_KEY)
    const history: AuditLogEntry[] = historyJson ? JSON.parse(historyJson) : []

    history.push(entry)

    // Keep only the last N entries
    while (history.length > MAX_LOG_HISTORY) {
      history.shift()
    }

    sessionStorage.setItem(LOG_HISTORY_KEY, JSON.stringify(history))
  } catch (error) {
    // Silently fail if storage is full
    console.warn('Audit log storage error:', error)
  }
}

/**
 * Get all stored log entries
 */
export function getLogHistory(): AuditLogEntry[] {
  try {
    const historyJson = sessionStorage.getItem(LOG_HISTORY_KEY)
    return historyJson ? JSON.parse(historyJson) : []
  } catch {
    return []
  }
}

/**
 * Clear log history
 */
export function clearLogHistory(): void {
  sessionStorage.removeItem(LOG_HISTORY_KEY)
}

// ============================================================================
// Core Logging Function
// ============================================================================

/**
 * Create and log an audit entry
 */
function log(
  level: LogLevel,
  action: AuditAction,
  component: string,
  details: Record<string, unknown>,
  duration?: number
): AuditLogEntry {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    action,
    component,
    details,
    duration,
    sessionId: getSessionId()
  }

  // Store in session
  storeLogEntry(entry)

  // Console output if enabled
  if (consoleLoggingEnabled) {
    const durationStr = duration !== undefined ? ` (${duration}ms)` : ''
    const detailsStr = Object.keys(details).length > 0
      ? ` ${JSON.stringify(details)}`
      : ''

    const message = `${LOG_PREFIX} [${action}] ${component}${durationStr}${detailsStr}`

    switch (level) {
      case 'debug':
        console.debug(message)
        break
      case 'info':
        console.info(message)
        break
      case 'warn':
        console.warn(message)
        break
      case 'error':
        console.error(message)
        break
    }
  }

  return entry
}

// ============================================================================
// Filter Logging
// ============================================================================

/**
 * Log when filters are applied
 */
export function logFilterApply(
  component: string,
  filters: Partial<FilterCriteria>,
  previousFilters?: Partial<FilterCriteria>
): AuditLogEntry {
  const changes: Record<string, unknown> = {}

  if (filters.networks?.length) {
    changes.networks = filters.networks
  }
  if (filters.imsis?.length) {
    changes.imsis = filters.imsis
  }
  if (filters.imsiMode) {
    changes.imsiMode = filters.imsiMode
  }
  if (filters.imsiRange) {
    changes.imsiRange = filters.imsiRange
  }
  if (filters.dateRange) {
    changes.dateRange = {
      start: filters.dateRange.start.toISOString(),
      end: filters.dateRange.end.toISOString()
    }
  }

  return log('info', 'FILTER_APPLY', component, {
    filters: changes,
    ...(previousFilters && { previous: summarizeFilters(previousFilters) })
  })
}

/**
 * Log when filters are cleared
 */
export function logFilterClear(
  component: string,
  previousFilters?: Partial<FilterCriteria>
): AuditLogEntry {
  return log('info', 'FILTER_CLEAR', component, {
    ...(previousFilters && { cleared: summarizeFilters(previousFilters) })
  })
}

/**
 * Log granularity changes
 */
export function logGranularityChange(
  component: string,
  newGranularity: TimeGranularity,
  previousGranularity?: TimeGranularity
): AuditLogEntry {
  return log('info', 'GRANULARITY_CHANGE', component, {
    granularity: newGranularity,
    ...(previousGranularity && { previous: previousGranularity })
  })
}

/**
 * Log date range changes
 */
export function logDateRangeChange(
  component: string,
  start: Date | null,
  end: Date | null
): AuditLogEntry {
  return log('info', 'DATE_RANGE_CHANGE', component, {
    start: start?.toISOString() || null,
    end: end?.toISOString() || null
  })
}

// ============================================================================
// API Call Logging
// ============================================================================

/**
 * Start tracking an API call
 */
export function startApiCall(endpoint: string, params: Record<string, unknown>): ApiCallContext {
  log('debug', 'API_REQUEST', 'analyticsService', {
    endpoint,
    params: sanitizeParams(params)
  })

  return {
    endpoint,
    params,
    startTime: performance.now()
  }
}

/**
 * Log successful API response
 */
export function logApiSuccess(
  context: ApiCallContext,
  recordCount: number,
  cached: boolean
): AuditLogEntry {
  const duration = Math.round(performance.now() - context.startTime)

  return log(
    'info',
    cached ? 'API_CACHE_HIT' : 'API_SUCCESS',
    'analyticsService',
    {
      endpoint: context.endpoint,
      params: sanitizeParams(context.params),
      recordCount,
      cached
    },
    duration
  )
}

/**
 * Log API error
 */
export function logApiError(
  context: ApiCallContext,
  error: Error | string
): AuditLogEntry {
  const duration = Math.round(performance.now() - context.startTime)

  return log(
    'error',
    'API_ERROR',
    'analyticsService',
    {
      endpoint: context.endpoint,
      params: sanitizeParams(context.params),
      error: error instanceof Error ? error.message : error
    },
    duration
  )
}

// ============================================================================
// Export Logging
// ============================================================================

/**
 * Log CSV export action
 */
export function logExportCsv(
  component: string,
  recordCount: number,
  filters?: Partial<FilterCriteria>
): AuditLogEntry {
  return log('info', 'EXPORT_CSV', component, {
    recordCount,
    ...(filters && { filters: summarizeFilters(filters) })
  })
}

// ============================================================================
// AskBob Logging
// ============================================================================

/**
 * Log AskBob query
 */
export function logAskBobQuery(
  query: string,
  responseType?: string
): AuditLogEntry {
  return log('info', 'ASKBOB_QUERY', 'AskBobPane', {
    queryLength: query.length,
    queryPreview: query.substring(0, 50) + (query.length > 50 ? '...' : ''),
    ...(responseType && { responseType })
  })
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Summarize filter criteria for logging (avoid logging full IMSI lists)
 */
function summarizeFilters(filters: Partial<FilterCriteria>): Record<string, unknown> {
  return {
    networkCount: filters.networks?.length || 0,
    imsiCount: filters.imsis?.length || 0,
    imsiMode: filters.imsiMode,
    hasDateRange: !!filters.dateRange,
    granularity: filters.granularity
  }
}

/**
 * Sanitize params to avoid logging sensitive data
 */
function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(params)) {
    if (key === 'imsi' && Array.isArray(value)) {
      // Don't log full IMSI values, just count
      sanitized.imsiCount = value.length
    } else if (Array.isArray(value)) {
      sanitized[key] = value.length > 5 ? `[${value.length} items]` : value
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Enable or disable console logging
 */
export function setConsoleLogging(enabled: boolean): void {
  consoleLoggingEnabled = enabled
}

/**
 * Check if console logging is enabled
 */
export function isConsoleLoggingEnabled(): boolean {
  return consoleLoggingEnabled
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Filter logging
  logFilterApply,
  logFilterClear,
  logGranularityChange,
  logDateRangeChange,

  // API logging
  startApiCall,
  logApiSuccess,
  logApiError,

  // Action logging
  logExportCsv,
  logAskBobQuery,

  // Log management
  getLogHistory,
  clearLogHistory,
  setConsoleLogging,
  isConsoleLoggingEnabled
}

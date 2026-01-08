/**
 * Analytics Service
 * Client for Analytics Service API with session-level caching
 * @see specs/003-consumption-filters-llm/research.md
 */

import type {
  Usage,
  UniqueImsi,
  UsageResponse,
  UniqueImsiResponse,
  TenantNetworkRequest,
  CustomerNetworkRequest,
  ImsiRequest,
  ImsiNetworkRequest,
  PeriodParams,
  TimeGranularity,
  FilterCriteria
} from '@/types/analytics'
import { startApiCall, logApiSuccess, logApiError } from '@/services/auditLogger'

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_ANALYTICS_API_URL || '/api/analytics'
const CACHE_PREFIX = 'analytics:'

// ============================================================================
// Session Cache Utilities
// ============================================================================

/**
 * Build a cache key from endpoint and parameters
 */
function buildCacheKey(endpoint: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      const value = params[key]
      if (value !== undefined && value !== null) {
        acc[key] = Array.isArray(value) ? value.sort().join(',') : String(value)
      }
      return acc
    }, {} as Record<string, string>)

  return `${CACHE_PREFIX}${endpoint}:${JSON.stringify(sortedParams)}`
}

/**
 * Get cached data from sessionStorage
 */
function getFromCache<T>(cacheKey: string): T | null {
  try {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      return JSON.parse(cached) as T
    }
  } catch (error) {
    console.warn('Cache read error:', error)
  }
  return null
}

/**
 * Store data in sessionStorage cache
 */
function setCache<T>(cacheKey: string, data: T): void {
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(data))
  } catch (error) {
    console.warn('Cache write error:', error)
    // If storage is full, clear analytics cache and retry
    clearAnalyticsCache()
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(data))
    } catch {
      // Silently fail if still can't write
    }
  }
}

/**
 * Clear all analytics cache entries from sessionStorage
 * Called on logout or when cache needs invalidation
 */
export function clearAnalyticsCache(): void {
  Object.keys(sessionStorage)
    .filter(key => key.startsWith(CACHE_PREFIX))
    .forEach(key => sessionStorage.removeItem(key))
}

// ============================================================================
// Period Translation Utilities
// ============================================================================

/**
 * Format date to API period format
 */
function formatDate(date: Date, format: 'yyyy' | 'yyyy-MM' | 'yyyy-MM-dd'): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  switch (format) {
    case 'yyyy':
      return `${year}`
    case 'yyyy-MM':
      return `${year}-${month}`
    case 'yyyy-MM-dd':
      return `${year}-${month}-${day}`
  }
}

/**
 * Get start of week (Monday)
 */
function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d
}

/**
 * Get end of week (Sunday)
 */
function endOfWeek(date: Date): Date {
  const d = startOfWeek(date)
  d.setDate(d.getDate() + 6)
  return d
}

/**
 * Translate UI time granularity to Analytics API period format
 */
export function translatePeriod(
  granularity: TimeGranularity,
  dateRange?: { start: Date; end: Date }
): PeriodParams {
  const now = new Date()
  const startDate = dateRange?.start || now

  switch (granularity) {
    case '24h':
      return { period: formatDate(now, 'yyyy-MM-dd') }
    case 'daily':
      return { period: formatDate(startDate, 'yyyy-MM-dd') }
    case 'weekly':
      return {
        period: formatDate(startOfWeek(startDate), 'yyyy-MM-dd'),
        periodEnd: formatDate(endOfWeek(startDate), 'yyyy-MM-dd')
      }
    case 'monthly':
      return { period: formatDate(startDate, 'yyyy-MM') }
  }
}

/**
 * Build API query parameters from FilterCriteria
 */
export function buildQueryParams(filters: FilterCriteria): Record<string, unknown> {
  const periodParams = translatePeriod(filters.granularity, filters.dateRange)

  return {
    ...periodParams,
    ...(filters.networks.length > 0 && { mccmnc: filters.networks }),
    ...(filters.imsis.length > 0 && { imsi: filters.imsis })
  }
}

// ============================================================================
// API Fetch with Caching and Fallback
// ============================================================================

/**
 * Fetch data from API with session cache and fallback
 */
async function fetchWithFallback<T>(
  endpoint: string,
  params: Record<string, unknown> = {}
): Promise<{ data: T; cached: boolean }> {
  const cacheKey = buildCacheKey(endpoint, params)
  const apiContext = startApiCall(endpoint, params)

  // Build query string
  const queryParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => queryParams.append(key, String(v)))
      } else {
        queryParams.append(key, String(value))
      }
    }
  })

  const url = `${API_BASE_URL}/${endpoint}${queryParams.toString() ? `?${queryParams}` : ''}`

  try {
    // Tier 1: Fresh data from API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include' // Include session cookies
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    if (result.success && result.data) {
      // Cache successful response
      setCache(cacheKey, result.data)
      const dataArray = Array.isArray(result.data) ? result.data : [result.data]
      logApiSuccess(apiContext, dataArray.length, false)
      return { data: result.data, cached: false }
    }

    throw new Error(result.error || 'Unknown API error')
  } catch (error) {
    // Tier 2: Try cached data
    const cached = getFromCache<T>(cacheKey)
    if (cached) {
      console.warn('Using cached data due to API error:', error)
      const cachedArray = Array.isArray(cached) ? cached : [cached]
      logApiSuccess(apiContext, cachedArray.length, true)
      return { data: cached, cached: true }
    }

    // Tier 3: Propagate error
    logApiError(apiContext, error instanceof Error ? error : new Error(String(error)))
    throw new AnalyticsAPIError(
      'Data temporarily unavailable',
      error instanceof Error ? error : new Error(String(error))
    )
  }
}

// ============================================================================
// Custom Error Class
// ============================================================================

export class AnalyticsAPIError extends Error {
  public readonly cause: Error

  constructor(message: string, cause: Error) {
    super(message)
    this.name = 'AnalyticsAPIError'
    this.cause = cause
  }
}

// ============================================================================
// Public API Methods (to be implemented in T010)
// ============================================================================

/**
 * Get usage data per network for tenant
 * Endpoint: /api/analytics/tenant-network
 */
export async function getTenantNetworkUsage(
  params: TenantNetworkRequest
): Promise<UsageResponse> {
  const { data, cached } = await fetchWithFallback<Usage[]>('tenant-network', { ...params })
  return { success: true, data, cached }
}

/**
 * Get usage data per network for customer
 * Endpoint: /api/analytics/customer-network
 */
export async function getCustomerNetworkUsage(
  params: CustomerNetworkRequest
): Promise<UsageResponse> {
  const { data, cached } = await fetchWithFallback<Usage[]>('customer-network', { ...params })
  return { success: true, data, cached }
}

/**
 * Get usage data per IMSI
 * Endpoint: /api/analytics/imsi
 */
export async function getImsiUsage(
  params: ImsiRequest
): Promise<UsageResponse> {
  const { data, cached } = await fetchWithFallback<Usage[]>('imsi', { ...params })
  return { success: true, data, cached }
}

/**
 * Get usage data per IMSI per network
 * Endpoint: /api/analytics/imsi-network
 */
export async function getImsiNetworkUsage(
  params: ImsiNetworkRequest
): Promise<UsageResponse> {
  const { data, cached } = await fetchWithFallback<Usage[]>('imsi-network', { ...params })
  return { success: true, data, cached }
}

/**
 * Get unique IMSI counts per network
 * Endpoint: /api/analytics/unique-imsi-count
 */
export async function getUniqueImsiCount(
  params: TenantNetworkRequest
): Promise<UniqueImsiResponse> {
  const { data, cached } = await fetchWithFallback<UniqueImsi[]>('unique-imsi-count', { ...params })
  return { success: true, data, cached }
}

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * Fetch usage data based on current filter criteria
 * Automatically builds query params from FilterCriteria
 */
export async function fetchUsageByFilters(
  filters: FilterCriteria
): Promise<UsageResponse> {
  const params = buildQueryParams(filters) as unknown as TenantNetworkRequest
  return getTenantNetworkUsage(params)
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)

  return `${value.toFixed(i > 0 ? 2 : 0)} ${units[i]}`
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  getTenantNetworkUsage,
  getCustomerNetworkUsage,
  getImsiUsage,
  getImsiNetworkUsage,
  getUniqueImsiCount,
  fetchUsageByFilters,
  translatePeriod,
  buildQueryParams,
  clearAnalyticsCache,
  formatBytes
}

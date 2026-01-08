/**
 * Analytics API Types
 * TypeScript interfaces for Analytics Service API integration
 * @see specs/003-consumption-filters-llm/data-model.md
 */

// ============================================================================
// External API Response Types (from Analytics Service)
// ============================================================================

/**
 * Analytics record with usage data per IMSI/network/period
 * Source: /analytics/* endpoints
 */
export interface Usage {
  /** Year bucket (yyyy format) */
  year?: string
  /** Month bucket (yyyy-MM format) */
  month?: string
  /** Day bucket (yyyy-MM-dd format) */
  day?: string
  /** Mobile Country Code + Mobile Network Code */
  mccmnc?: string
  /** International Mobile Subscriber Identity */
  imsi?: string
  /** Total bytes (deduplicated) for the bucket */
  bytes: number
  /** Timestamp of latest contributing event (UTC) */
  latestEventAt: string
}

/**
 * Unique IMSI count record per network/period
 * Source: /analytics/unique/imsi/count/* endpoints
 */
export interface UniqueImsi {
  year?: string
  month?: string
  day?: string
  mccmnc: string
  /** Count of unique IMSIs for the bucket */
  uniqueImsiCount: number
  latestEventAt: string
}

/**
 * Standard error payload from Analytics API
 */
export interface AnalyticsErrorResponse {
  status: number
  error: string
  message: string
  path: string
  timestamp: string
}

// ============================================================================
// Frontend State Types
// ============================================================================

/** Time granularity options for unified filtering */
export type TimeGranularity = '24h' | 'daily' | 'weekly' | 'monthly'

/** IMSI filter mode */
export type ImsiFilterMode = 'single' | 'multiple' | 'range'

/**
 * IMSI range definition for range mode
 */
export interface ImsiRange {
  from: string
  to: string
}

/**
 * User-selected filter parameters for consumption queries
 */
export interface FilterCriteria {
  /** Time granularity selection (optional when passed separately as prop) */
  granularity?: TimeGranularity
  /** Custom date range (optional, defaults to current period) */
  dateRange?: {
    start: Date
    end: Date
  }
  /** Selected network codes (MCCMNC) */
  networks: string[]
  /** Selected IMSI values (for single/multiple mode) */
  imsis: string[]
  /** IMSI filter mode */
  imsiMode?: ImsiFilterMode
  /** IMSI range (for range mode) */
  imsiRange?: ImsiRange
}

/**
 * MCCMNC to carrier name mapping for UI display
 */
export interface NetworkMapping {
  /** MCCMNC code (e.g., "22288") */
  mccmnc: string
  /** Human-readable carrier name (e.g., "TIM Italy") */
  carrierName: string
  /** ISO country code (e.g., "IT") */
  countryCode: string
  /** Network type (e.g., "GSM", "LTE") */
  networkType?: string
}

/**
 * Flattened row for Usage Results table display
 */
export interface UsageTableRow {
  /** Composite key: `${imsi}:${mccmnc}:${period}` */
  id: string
  imsi: string
  mccmnc: string
  /** Resolved from NetworkMapping */
  carrierName: string
  bytes: number
  /** Formatted display (e.g., "1.5 GB") */
  bytesFormatted: string
  /** Formatted period display */
  period: string
  latestEventAt: Date
}

/**
 * Loading state per pane for UI feedback
 */
export interface LoadingState {
  trends: boolean
  carriers: boolean
  regional: boolean
  results: boolean
}

/**
 * Reactive state for consumption page
 */
export interface AnalyticsState {
  /** Current filter criteria */
  filters: FilterCriteria
  /** Loading state per pane */
  loading: LoadingState
  /** Error state */
  error: string | null
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Period parameters for Analytics API
 */
export interface PeriodParams {
  /** Period format: yyyy (year), yyyy-MM (month), or yyyy-MM-dd (day) */
  period: string
  /** Optional end period for ranges (inclusive) */
  periodEnd?: string
}

/**
 * Request parameters for tenant network usage
 */
export interface TenantNetworkRequest extends PeriodParams {
  /** Network codes filter (optional) */
  mccmnc?: string[]
}

/**
 * Request parameters for customer network usage
 */
export interface CustomerNetworkRequest extends PeriodParams {
  /** Customer identifier */
  customer: string
  /** Network codes filter (optional) */
  mccmnc?: string[]
}

/**
 * Request parameters for IMSI usage
 */
export interface ImsiRequest extends PeriodParams {
  /** Customer identifier */
  customer: string
  /** IMSI values to query */
  imsi: string[]
}

/**
 * Request parameters for IMSI network usage
 */
export interface ImsiNetworkRequest extends PeriodParams {
  /** Customer identifier */
  customer: string
  /** IMSI values to query */
  imsi: string[]
  /** Network codes filter (optional) */
  mccmnc?: string[]
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  /** Whether response came from session cache */
  cached?: boolean
}

/** Usage data response */
export type UsageResponse = ApiResponse<Usage[]>

/** Unique IMSI count response */
export type UniqueImsiResponse = ApiResponse<UniqueImsi[]>

/** Network mapping response */
export type MccmncMappingResponse = ApiResponse<NetworkMapping[]>

// ============================================================================
// LLM Tool Types (for AskBob integration)
// ============================================================================

/**
 * Parameters for LLM analytics query tools
 */
export interface AnalyticsToolParams {
  /** Period in API format (yyyy, yyyy-MM, or yyyy-MM-dd) */
  period: string
  /** Optional end period for ranges */
  periodEnd?: string
  /** Optional network code filters */
  mccmnc?: string[]
  /** Optional IMSI filters */
  imsi?: string[]
}

/** Chart dataset for visualization */
export interface ChartDataset {
  label: string
  data: number[]
}

/** Chart configuration */
export interface ChartConfig {
  type: 'bar' | 'line' | 'pie'
  labels: string[]
  datasets: ChartDataset[]
}

/** Table configuration */
export interface TableConfig {
  columns: string[]
  rows: Record<string, unknown>[]
}

/**
 * Response format for LLM analytics tools
 */
export interface AnalyticsToolResponse {
  /** Response type determines how AskBob renders the result */
  type: 'chart' | 'table' | 'text'
  /** Chart configuration (if type === 'chart') */
  chart?: ChartConfig
  /** Table data (if type === 'table') */
  table?: TableConfig
  /** Text response (if type === 'text') */
  text?: string
  /** Raw data for export */
  rawData?: Usage[] | UniqueImsi[]
}

// ============================================================================
// Utility Types
// ============================================================================

/** Cache entry with timestamp for TTL management */
export interface CacheEntry<T> {
  data: T
  timestamp: number
}

/** Session cache key builder parameters */
export interface CacheKeyParams {
  endpoint: string
  params: Record<string, unknown>
}

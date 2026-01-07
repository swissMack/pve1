# Data Model: Consumption Filters with LLM Integration

**Feature Branch**: `003-consumption-filters-llm`
**Date**: 2025-01-07

## Overview

This feature primarily consumes data from the external Analytics Service API. The data model defines TypeScript interfaces for API responses and frontend state management.

---

## External API Response Types

### Usage (from Analytics API)

```typescript
/**
 * Analytics record with usage data per IMSI/network/period
 * Source: /analytics/* endpoints
 */
interface Usage {
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
```

### UniqueImsi (from Analytics API)

```typescript
/**
 * Unique IMSI count record per network/period
 * Source: /analytics/unique/imsi/count/* endpoints
 */
interface UniqueImsi {
  year?: string
  month?: string
  day?: string
  mccmnc: string
  /** Count of unique IMSIs for the bucket */
  uniqueImsiCount: number
  latestEventAt: string
}
```

### ErrorResponse (from Analytics API)

```typescript
/**
 * Standard error payload from Analytics API
 */
interface AnalyticsErrorResponse {
  status: number
  error: string
  message: string
  path: string
  timestamp: string
}
```

---

## Frontend State Types

### FilterCriteria

```typescript
/**
 * User-selected filter parameters for consumption queries
 */
interface FilterCriteria {
  /** Time granularity selection */
  granularity: '24h' | 'daily' | 'weekly' | 'monthly'
  /** Custom date range (optional, defaults to current period) */
  dateRange?: {
    start: Date
    end: Date
  }
  /** Selected network codes (MCCMNC) */
  networks: string[]
  /** Selected IMSI values */
  imsis: string[]
}
```

### NetworkMapping

```typescript
/**
 * MCCMNC to carrier name mapping for UI display
 */
interface NetworkMapping {
  /** MCCMNC code (e.g., "22288") */
  mccmnc: string
  /** Human-readable carrier name (e.g., "TIM Italy") */
  carrierName: string
  /** ISO country code (e.g., "IT") */
  countryCode: string
  /** Network type (e.g., "GSM", "LTE") */
  networkType?: string
}
```

### UsageTableRow

```typescript
/**
 * Flattened row for Usage Results table display
 */
interface UsageTableRow {
  id: string  // Composite: `${imsi}:${mccmnc}:${period}`
  imsi: string
  mccmnc: string
  carrierName: string  // Resolved from NetworkMapping
  bytes: number
  bytesFormatted: string  // e.g., "1.5 GB"
  period: string  // Formatted period display
  latestEventAt: Date
}
```

### AnalyticsState

```typescript
/**
 * Vuex/Pinia-like state for consumption page
 */
interface AnalyticsState {
  /** Current filter criteria */
  filters: FilterCriteria
  /** Loading state per pane */
  loading: {
    trends: boolean
    carriers: boolean
    regional: boolean
    results: boolean
  }
  /** Cached API responses */
  cache: Map<string, {
    data: unknown
    timestamp: number
  }>
  /** Error state */
  error: string | null
}
```

---

## API Proxy Request/Response Types

### TenantNetworkRequest

```typescript
/**
 * Request to /api/analytics/tenant-network proxy
 */
interface TenantNetworkRequest {
  tenant: string
  period: string
  periodEnd?: string
  mccmnc?: string[]
}
```

### TenantNetworkResponse

```typescript
/**
 * Response from /api/analytics/tenant-network proxy
 */
interface TenantNetworkResponse {
  success: boolean
  data?: Usage[]
  error?: string
  cached?: boolean  // Indicates if response came from cache
}
```

### ImsiNetworkRequest

```typescript
/**
 * Request to /api/analytics/imsi-network proxy
 */
interface ImsiNetworkRequest {
  tenant: string
  customer: string
  imsi: string[]
  period: string
  periodEnd?: string
  mccmnc?: string[]
}
```

---

## LLM Tool Types

### AnalyticsToolParams

```typescript
/**
 * Parameters for LLM analytics query tools
 */
interface AnalyticsToolParams {
  /** Period in API format (yyyy, yyyy-MM, or yyyy-MM-dd) */
  period: string
  /** Optional end period for ranges */
  periodEnd?: string
  /** Optional network code filters */
  mccmnc?: string[]
  /** Optional IMSI filters */
  imsi?: string[]
}
```

### AnalyticsToolResponse

```typescript
/**
 * Response format for LLM analytics tools
 */
interface AnalyticsToolResponse {
  /** Response type determines how AskBob renders the result */
  type: 'chart' | 'table' | 'text'
  /** Chart configuration (if type === 'chart') */
  chart?: {
    type: 'bar' | 'line' | 'pie'
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
    }>
  }
  /** Table data (if type === 'table') */
  table?: {
    columns: string[]
    rows: Array<Record<string, unknown>>
  }
  /** Text response (if type === 'text') */
  text?: string
  /** Raw data for export */
  rawData?: Usage[] | UniqueImsi[]
}
```

---

## Entity Relationships

```
┌─────────────────┐
│ FilterCriteria  │
│                 │
│ - granularity   │──────────┐
│ - dateRange     │          │
│ - networks[]    │          │
│ - imsis[]       │          │
└─────────────────┘          │
         │                   │
         │ triggers          │ translates to
         ▼                   ▼
┌─────────────────┐    ┌─────────────────┐
│ AnalyticsState  │    │ API Parameters  │
│                 │    │                 │
│ - filters       │    │ - tenant        │
│ - loading{}     │    │ - period        │
│ - cache         │    │ - periodEnd     │
│ - error         │    │ - mccmnc[]      │
└─────────────────┘    │ - imsi[]        │
         │             └─────────────────┘
         │                     │
         │ updates             │ calls
         ▼                     ▼
┌─────────────────┐    ┌─────────────────┐
│ Vue Components  │    │ Analytics API   │
│                 │    │                 │
│ - TrendsChart   │◄───│ - Usage[]       │
│ - CarriersPane  │    │ - UniqueImsi[]  │
│ - RegionalMap   │    └─────────────────┘
│ - ResultsTable  │            │
└─────────────────┘            │
         │                     │
         │ enriches with       │
         ▼                     │
┌─────────────────┐            │
│ NetworkMapping  │◄───────────┘
│                 │    resolves mccmnc
│ - mccmnc        │    to carrier name
│ - carrierName   │
│ - countryCode   │
└─────────────────┘
```

---

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| period | Must match yyyy, yyyy-MM, or yyyy-MM-dd | "Invalid period format" |
| periodEnd | Must be >= period when provided | "End period must not be earlier than start" |
| mccmnc | Each value must be 5-6 digit string | "Invalid network code format" |
| imsi | Each value must be 15 digit string | "Invalid IMSI format" |
| bytes | Must be non-negative integer | "Invalid byte count" |

---

## No Database Changes Required

This feature consumes external Analytics API data and uses sessionStorage for caching. No Supabase schema changes needed.

---

**Next**: [API Contracts](./contracts/)

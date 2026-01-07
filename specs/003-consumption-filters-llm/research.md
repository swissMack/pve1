# Research: Consumption Filters with LLM Integration

**Feature Branch**: `003-consumption-filters-llm`
**Date**: 2025-01-07

## Research Summary

This document captures decisions and findings for technical unknowns identified during planning.

---

## 1. Analytics Service API Integration

**Question**: How to integrate with the external Analytics Service API (localhost:9010)?

**Decision**: Create Vercel serverless proxy endpoints that forward requests to the Analytics API with OAuth2 authentication.

**Rationale**:
- Portal frontend cannot directly call localhost:9010 (different origin, CORS issues)
- Backend proxy can handle OAuth2 token management with Keycloak
- Proxy provides abstraction layer for error handling and caching
- Follows existing API patterns in `api/` directory

**Alternatives Considered**:
- Direct frontend calls: Rejected due to CORS and authentication complexity
- GraphQL gateway: Overkill for simple passthrough queries
- Supabase Edge Functions: Not needed when Vercel functions already available

---

## 2. MCC-MNC Reference API Selection

**Question**: Which external API to use for MCCMNC-to-carrier-name mapping?

**Decision**: Use mcc-mnc.com API or similar open MCC-MNC database.

**Rationale**:
- Free tier available for reasonable request volumes
- Returns carrier names, country codes, and network types
- Can cache responses for 24 hours (carriers don't change frequently)
- Fallback to hardcoded common carriers if API unavailable

**Alternatives Considered**:
- Build own database: Maintenance burden, data freshness issues
- Wikipedia scraping: Unreliable, no API
- Commercial APIs (Twilio Lookup): Cost per request, overkill for display names

**Implementation Notes**:
- Create `mccmncService.ts` with 24-hour cache in localStorage
- Store mapping as `{ [mccmnc: string]: { carrier: string, country: string } }`
- Provide fallback for common carriers (e.g., "22288" → "TIM Italy")

---

## 3. Session-Level Caching Strategy

**Question**: How to implement session-level caching for Analytics API responses?

**Decision**: Use sessionStorage for API response caching with cache keys based on query parameters.

**Rationale**:
- sessionStorage automatically clears on tab close (natural session boundary)
- Simple key-value storage without external dependencies
- Cache key: `analytics:${endpoint}:${JSON.stringify(params)}`
- TTL: No explicit TTL within session (data stays until logout or tab close)

**Alternatives Considered**:
- localStorage: Persists across sessions, would need manual invalidation
- IndexedDB: More complex, overkill for temporary cache
- In-memory Map: Lost on page refresh
- Redis/external cache: Adds infrastructure complexity

**Implementation Notes**:
```typescript
// Cache key pattern
const cacheKey = `analytics:tenant-network:${tenant}:${period}:${mccmnc.join(',')}`

// On logout, clear all analytics cache
Object.keys(sessionStorage)
  .filter(key => key.startsWith('analytics:'))
  .forEach(key => sessionStorage.removeItem(key))
```

---

## 4. Period Format Translation

**Question**: How to translate UI time granularity (24h, Daily, Weekly, Monthly) to Analytics API period format?

**Decision**: Implement translation function in analyticsService.ts.

**Translation Rules**:

| UI Granularity | API Period Format | periodEnd |
|----------------|-------------------|-----------|
| 24h | `yyyy-MM-dd` (today) | Not used |
| Daily | `yyyy-MM-dd` (selected date) | Not used |
| Weekly | `yyyy-MM-dd` (week start) | `yyyy-MM-dd` (week end) |
| Monthly | `yyyy-MM` | Not used |

**Implementation Notes**:
```typescript
function translatePeriod(granularity: TimeGranularity, dateRange: DateRange): PeriodParams {
  const now = new Date()
  switch (granularity) {
    case '24h':
      return { period: formatDate(now, 'yyyy-MM-dd') }
    case 'daily':
      return { period: formatDate(dateRange.start, 'yyyy-MM-dd') }
    case 'weekly':
      return {
        period: formatDate(startOfWeek(dateRange.start), 'yyyy-MM-dd'),
        periodEnd: formatDate(endOfWeek(dateRange.start), 'yyyy-MM-dd')
      }
    case 'monthly':
      return { period: formatDate(dateRange.start, 'yyyy-MM') }
  }
}
```

---

## 5. AskBob Analytics Integration

**Question**: How to enable AskBob LLM to query the Analytics API?

**Decision**: Extend existing LLM tool system with new Analytics API tools.

**Rationale**:
- Existing AskBob uses `/api/llm/chart` endpoint with tool-based responses
- Add new tools: `query_analytics_usage`, `query_analytics_unique_imsi`
- LLM interprets natural language, extracts period/mccmnc/imsi parameters
- Tools call Analytics API and format response as chart/table data

**Tool Definitions**:
```typescript
const analyticsTools = [
  {
    name: 'query_analytics_usage',
    description: 'Query data usage from Analytics API by period and network',
    parameters: {
      period: 'string (yyyy, yyyy-MM, or yyyy-MM-dd)',
      periodEnd: 'string (optional)',
      mccmnc: 'string[] (optional network codes)',
      imsi: 'string[] (optional IMSI values)'
    }
  },
  {
    name: 'query_analytics_unique_imsi',
    description: 'Query unique IMSI counts from Analytics API',
    parameters: {
      period: 'string',
      mccmnc: 'string[] (optional)'
    }
  }
]
```

---

## 6. PrimeVue Component Selection

**Question**: Which PrimeVue components to use for filter panel and results table?

**Decision**: Use existing PrimeVue patterns from the portal.

**Component Mapping**:

| UI Element | PrimeVue Component | Notes |
|------------|-------------------|-------|
| Time granularity toggle | SelectButton | Already used in ConsumptionTrendsChart |
| Network filter | MultiSelect | With filter/search capability |
| IMSI filter | AutoComplete | Multiple mode with async search |
| Results table | DataTable | With pagination, sorting, export |
| Filter panel | Panel | Collapsible, with header actions |
| Loading states | Skeleton | During data fetch |
| Empty state | Message | "No data matches your filters" |

---

## 7. Error Handling Strategy

**Question**: How to handle API failures gracefully?

**Decision**: Implement three-tier fallback strategy.

**Fallback Tiers**:
1. **Primary**: Fresh data from Analytics API
2. **Secondary**: Cached data from sessionStorage (if available)
3. **Tertiary**: Error message with retry option

**Implementation**:
```typescript
async function fetchWithFallback<T>(endpoint: string, params: object): Promise<T> {
  const cacheKey = buildCacheKey(endpoint, params)

  try {
    // Tier 1: Fresh data
    const data = await fetchFromAPI(endpoint, params)
    sessionStorage.setItem(cacheKey, JSON.stringify(data))
    return data
  } catch (error) {
    // Tier 2: Cached data
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      console.warn('Using cached data due to API error:', error)
      return JSON.parse(cached)
    }
    // Tier 3: Propagate error for UI handling
    throw new AnalyticsAPIError('Data temporarily unavailable', error)
  }
}
```

---

## Resolved Unknowns

All technical unknowns from the plan have been addressed:

| Unknown | Resolution |
|---------|------------|
| Analytics API integration | Vercel proxy endpoints with OAuth2 |
| MCC-MNC mapping source | External reference API with 24h cache |
| Session caching | sessionStorage with parameter-based keys |
| Period translation | Mapping function for each granularity |
| AskBob integration | New LLM tools for analytics queries |
| UI components | PrimeVue components per mapping table |
| Error handling | Three-tier fallback strategy |

---

**Next Phase**: [Phase 1 - Design & Contracts](./data-model.md)

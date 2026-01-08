# Quickstart: Consumption Filters with LLM Integration

**Feature Branch**: `003-consumption-filters-llm`
**Date**: 2025-01-08 (Updated)

## Overview

This feature adds unified time-based filtering, advanced filter fields (MCCMNC/IMSI), a detailed Usage Results table, and Analytics API integration to AskBob LLM for the SIM Card Portal consumption pages.

## Prerequisites

- Node.js 18+
- Access to Analytics Service API (localhost:9010)
- Portal running with authentication enabled
- PrimeVue 4.x components available

## Environment Setup

Add the following to your `.env` file:

```bash
# Analytics Service API
VITE_ANALYTICS_API_URL=http://localhost:9010
ANALYTICS_API_URL=http://localhost:9010

# MCC-MNC Reference API (for carrier name lookup)
MCCMNC_API_URL=https://mcc-mnc.net/api

# OAuth2 / Keycloak (if using external Analytics API auth)
ANALYTICS_OAUTH_CLIENT_ID=sim-portal
ANALYTICS_OAUTH_CLIENT_SECRET=<your-secret>
KEYCLOAK_URL=http://keycloak:8080/realms/Demo-Realm

# Optional: Enable audit logging in production (auto-enabled in dev)
VITE_AUDIT_LOG=false
```

## Quick Test

### 1. Start the Portal

```bash
cd sim-card-portal-v2
npm run dev
```

### 2. Navigate to Consumption Page

Open http://localhost:5173 and navigate to the Consumption page from the sidebar.

### 3. Test Unified Time Filtering

1. Click the time granularity toggle (24h / Daily / Weekly / Monthly)
2. Verify all three panes update simultaneously:
   - Consumption Trends chart
   - Top Carriers breakdown
   - Regional Usage map

### 4. Test Advanced Filters

1. Click "Filters" to open the filter panel
2. Select one or more networks from the MCCMNC dropdown
3. Set custom date range using Start/End date pickers (optional)
4. Test IMSI filter modes:
   - **Single**: Enter one IMSI value
   - **Multiple**: Add/remove multiple IMSI rows using +/- buttons
   - **Range**: Enter from/to IMSI values for a range query
5. Click "Apply" and verify all panes filter to selected criteria
6. Click "Clear Filters" to reset

### 5. Test Usage Results Table

1. With filters applied, scroll to the Usage Results pane
2. Verify table shows: IMSI, Network (with carrier name), Data Volume, Period, Last Event
3. Test pagination controls
4. Test column sorting (click headers)
5. Test "Export CSV" button

### 6. Test AskBob Analytics Integration

1. Open the AskBob panel (chat icon)
2. Try these queries:
   - "Show me top 5 networks by data usage this month"
   - "What's the total data usage for network 22288 last week?"
   - "How many unique IMSIs were active in December?"
3. Verify Bob returns charts/tables with real data

## Key Files

### Frontend Components

| File | Description |
|------|-------------|
| `src/components/consumption/ConsumptionPage.vue` | Main page with unified filter state |
| `src/components/consumption/FilterPanel.vue` | MCCMNC/IMSI filter controls |
| `src/components/consumption/UsageResultsTable.vue` | Detailed usage data table |
| `src/components/consumption/AskBobPane.vue` | LLM panel with Analytics tools |

### Services

| File | Description |
|------|-------------|
| `src/services/analyticsService.ts` | Analytics API client with session caching and optimized cache keys |
| `src/services/mccmncService.ts` | MCC-MNC reference API client |
| `src/services/auditLogger.ts` | Structured audit logging for filter changes, API calls, exports |

### Utilities

| File | Description |
|------|-------------|
| `src/utils/debounce.ts` | Debounce, throttle, and useDebouncedRef utilities for performance |

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/analytics/tenant-network` | Usage per network |
| `GET /api/analytics/customer-network` | Usage per customer per network |
| `GET /api/analytics/imsi` | Usage per IMSI |
| `GET /api/analytics/imsi-network` | Usage per IMSI per network |
| `GET /api/analytics/unique-imsi-count` | Unique IMSI counts |
| `GET /api/mccmnc/lookup` | MCCMNC to carrier name mapping |

## Common Issues

### Analytics API Connection Failed

**Symptom**: "Data temporarily unavailable" message

**Solution**:
1. Verify Analytics Service is running: `curl http://localhost:9010/ping`
2. Check `ANALYTICS_API_URL` in `.env`
3. Verify OAuth2 credentials if authentication is enabled

### MCCMNC Names Not Showing

**Symptom**: Network codes display as raw numbers (e.g., "22288" instead of "TIM Italy")

**Solution**:
1. Check `MCCMNC_API_URL` in `.env`
2. Verify external MCC-MNC API is accessible
3. Clear localStorage cache: `localStorage.removeItem('mccmnc-cache')`

### Filters Not Persisting

**Symptom**: Filters reset unexpectedly

**Solution**:
- Filters are stored in sessionStorage and intentionally reset on page reload
- Check browser devtools > Application > Session Storage

### AskBob Not Using Analytics Data

**Symptom**: Bob responds with generic text instead of charts/data

**Solution**:
1. Ensure Analytics API endpoints are accessible
2. Check `/api/llm/chart` endpoint logs for tool errors
3. Try simpler queries first: "Show me data usage this month"

## Performance Notes

- Session caching reduces redundant API calls
- First load may be slower; subsequent requests use cache
- Large datasets (>10,000 records) display pagination warning
- CSV export may take up to 10 seconds for large datasets
- Filter changes are debounced (150ms) to prevent excessive API calls
- Cache key generation uses djb2 hashing with memoization for speed

## Audit Logging

All filter changes, API calls, and exports are logged for debugging and compliance:

```typescript
// Enable verbose console logging (auto-enabled in dev)
import { setConsoleLogging } from '@/services/auditLogger'
setConsoleLogging(true)

// View log history
import { getLogHistory, clearLogHistory } from '@/services/auditLogger'
console.log(getLogHistory())  // Get all logged events
clearLogHistory()             // Clear session logs
```

**Log Actions Tracked**:
- `FILTER_APPLY` / `FILTER_CLEAR` - Filter panel interactions
- `GRANULARITY_CHANGE` - Time toggle changes
- `API_REQUEST` / `API_SUCCESS` / `API_ERROR` - Analytics API calls
- `API_CACHE_HIT` - Cached response used
- `EXPORT_CSV` - CSV downloads
- `ASKBOB_QUERY` - LLM queries

**Environment Variable**: Set `VITE_AUDIT_LOG=true` to enable console logging in production.

## Next Steps

See [tasks.md](./tasks.md) for implementation tasks (generated by `/speckit.tasks`).

# Implementation Plan: Consumption Filters with LLM Integration

**Branch**: `003-consumption-filters-llm` | **Date**: 2025-01-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-consumption-filters-llm/spec.md`

## Summary

Reengineer the Consumption page to provide unified time-based filtering (24h/Daily/Weekly/Monthly) that affects all panes simultaneously, add MCCMNC/IMSI filter fields, create a detailed Usage Results table, and enhance AskBob LLM to query the Analytics Service API. Key technical approach: integrate with external Analytics API (localhost:9010), fetch MCCMNC-to-carrier mappings from external reference API, implement session-level caching with fallback.

## Technical Context

**Language/Version**: TypeScript 5.8, Vue 3.5
**Primary Dependencies**: PrimeVue 4.x, Chart.js 4.5, Supabase, Vite 7
**Storage**: Session storage for filter state and API response caching; Supabase for persistent data
**Testing**: Manual acceptance testing (contract tests for new API endpoints)
**Target Platform**: Web browser (modern browsers), Vercel serverless deployment
**Project Type**: Web application (Vue frontend + Vercel API backend)
**Performance Goals**: 3s for filter changes, 5s for 50k record queries, 10s CSV export
**Constraints**: Session-level caching invalidated on logout, OAuth2 via Keycloak for Analytics API
**Scale/Scope**: ~6 new/modified Vue components, ~3 new API proxy endpoints, 1 new service class

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence/Notes |
|-----------|--------|----------------|
| I. API-First Design | PASS | Analytics API OpenAPI spec exists; new proxy endpoints will be documented in contracts/ |
| II. Data Separation | PASS | No sensitive data involved; analytics data is read-only aggregates |
| III. Security by Default | PASS | OAuth2/Keycloak authentication for Analytics API; API proxy inherits existing auth |
| IV. State Machine Integrity | N/A | No state transitions in this feature (read-only analytics) |
| V. Observability | PASS | Will use existing structured logging; filter changes logged for audit |
| VI. Configuration Isolation | PASS | Analytics API URL via VITE_ANALYTICS_API_URL env var; MCC-MNC API URL configurable |
| VII. Contract Testing | PASS | Contract tests defined in Phase 1 for new proxy endpoints |

**Constitution Check Result**: PASS - No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/003-consumption-filters-llm/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
sim-card-portal-v2/
├── src/
│   ├── components/
│   │   └── consumption/
│   │       ├── ConsumptionPage.vue      # MODIFY: Add unified filter state
│   │       ├── ConsumptionTrendsChart.vue # MODIFY: Accept external granularity
│   │       ├── TopCarriersBreakdown.vue # MODIFY: Accept external granularity
│   │       ├── RegionalUsageMap.vue     # MODIFY: Accept external granularity
│   │       ├── FilterPanel.vue          # NEW: MCCMNC/IMSI filter controls
│   │       ├── UsageResultsTable.vue    # NEW: Detailed IMSI usage table
│   │       └── AskBobPane.vue           # MODIFY: Analytics API integration
│   ├── services/
│   │   ├── analyticsService.ts          # NEW: Analytics API client with caching
│   │   └── mccmncService.ts             # NEW: MCC-MNC reference API client
│   └── types/
│       └── analytics.ts                 # NEW: TypeScript interfaces for API responses
├── api/
│   ├── analytics/
│   │   ├── tenant-network.ts            # NEW: Proxy to Analytics API
│   │   ├── customer-network.ts          # NEW: Proxy to Analytics API
│   │   └── imsi.ts                      # NEW: Proxy to Analytics API
│   └── llm/
│       └── chart.ts                     # MODIFY: Add Analytics API tool support
└── tests/
    └── contract/
        └── analytics-proxy.test.ts      # NEW: Contract tests for proxy endpoints
```

**Structure Decision**: Web application structure with frontend components in `src/` and Vercel serverless API functions in `api/`. New analytics service layer added for API client logic with session caching.

## Complexity Tracking

> No Constitution Check violations. No complexity justifications required.

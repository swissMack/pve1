# Tasks: Consumption Filters with LLM Integration

**Input**: Design documents from `/specs/003-consumption-filters-llm/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in spec - test tasks excluded.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md structure:
- Frontend: `sim-card-portal-v2/src/`
- API Routes: `sim-card-portal-v2/api/`
- Types: `sim-card-portal-v2/src/types/`
- Services: `sim-card-portal-v2/src/services/`
- Components: `sim-card-portal-v2/src/components/consumption/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create TypeScript types and core service infrastructure

- [x] T001 [P] Create TypeScript interfaces for Analytics API types in `sim-card-portal-v2/src/types/analytics.ts` (Usage, UniqueImsi, FilterCriteria, NetworkMapping, UsageTableRow, AnalyticsState)
- [x] T002 [P] Add Analytics API environment variables to `.env.example` (VITE_ANALYTICS_API_URL, ANALYTICS_API_URL, MCCMNC_API_URL)
- [x] T003 [P] Create base analyticsService.ts skeleton in `sim-card-portal-v2/src/services/analyticsService.ts` with session caching infrastructure

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API proxy endpoints and core services that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create `/api/analytics/tenant-network.ts` proxy endpoint to forward to Analytics API with OAuth2 auth
- [x] T005 [P] Create `/api/analytics/customer-network.ts` proxy endpoint in `sim-card-portal-v2/api/analytics/customer-network.ts`
- [x] T006 [P] Create `/api/analytics/imsi.ts` proxy endpoint in `sim-card-portal-v2/api/analytics/imsi.ts`
- [x] T007 [P] Create `/api/analytics/imsi-network.ts` proxy endpoint in `sim-card-portal-v2/api/analytics/imsi-network.ts`
- [x] T008 [P] Create `/api/analytics/unique-imsi-count.ts` proxy endpoint in `sim-card-portal-v2/api/analytics/unique-imsi-count.ts`
- [x] T009 [P] Create `/api/mccmnc/lookup.ts` proxy endpoint for MCCMNC-to-carrier-name resolution in `sim-card-portal-v2/api/mccmnc/lookup.ts`
- [x] T010 Implement analyticsService.ts methods (getTenantNetworkUsage, getCustomerNetworkUsage, getImsiUsage, getImsiNetworkUsage, getUniqueImsiCount) with session caching
- [x] T011 [P] Create mccmncService.ts in `sim-card-portal-v2/src/services/mccmncService.ts` with lookup and local caching
- [x] T012 Add period format translation utility (granularity → API period format: 24h/Daily → yyyy-MM-dd, Weekly → range, Monthly → yyyy-MM)

**Checkpoint**: Foundation ready - API proxies and services functional, user story implementation can now begin

---

## Phase 3: User Story 1 - Unified Time-Based Filtering (Priority: P1) MVP

**Goal**: Provide unified time granularity controls (24h/Daily/Weekly/Monthly) that affect all consumption panes simultaneously

**Independent Test**: Click each time toggle option and verify Consumption Trends, Top Carriers, and Regional Usage all display data for the selected time period

### Implementation for User Story 1

- [x] T013 [US1] Add unified filter state (FilterCriteria reactive ref) to ConsumptionPage.vue with granularity prop
- [x] T014 [US1] Create TimeGranularityToggle component in `sim-card-portal-v2/src/components/consumption/TimeGranularityToggle.vue` (PrimeVue SelectButton with 24h/Daily/Weekly/Monthly options)
- [x] T015 [US1] Modify ConsumptionTrendsChart.vue to accept external granularity prop and fetch data via analyticsService
- [x] T016 [US1] Modify TopCarriersBreakdown.vue to accept external granularity prop and fetch data via analyticsService
- [x] T017 [US1] Modify RegionalUsageMap.vue to accept external granularity prop and fetch data via analyticsService
- [x] T018 [US1] Wire TimeGranularityToggle to ConsumptionPage.vue filter state with loading indicators on all panes
- [x] T019 [US1] Implement simultaneous data refresh for all panes when granularity changes
- [x] T020 [US1] Add custom date range picker integration - Start/End date pickers added to FilterPanel with filter criteria integration

**Checkpoint**: Unified time filtering works - all three panes update simultaneously when granularity changes

---

## Phase 4: User Story 2 - Advanced Filter Fields (Priority: P2)

**Goal**: Enable filtering by MCCMNC network and IMSI for detailed data analysis

**Independent Test**: Apply various filter combinations and verify data in all panes reflects only records matching the filter criteria

### Implementation for User Story 2

- [x] T021 [US2] Create FilterPanel.vue component in `sim-card-portal-v2/src/components/consumption/FilterPanel.vue` with collapsible panel UI, including Start/End date pickers for IMSI-specific date ranges
- [x] T022 [US2] Add MCCMNC MultiSelect field to FilterPanel with carrier name labels fetched via mccmncService
- [x] T023 [US2] Add IMSI filter with three input modes: Single (one IMSI input), Multiple (add/remove rows), and Range (from/to IMSI inputs)
- [x] T024 [US2] Integrate FilterPanel with ConsumptionPage.vue filter state (networks[], imsis[])
- [x] T025 [US2] Update analyticsService calls to include mccmnc[] and imsi[] filter parameters
- [x] T026 [US2] Add "Apply Filters" and "Clear Filters" buttons to FilterPanel
- [x] T027 [US2] Ensure filters persist when time granularity changes
- [x] T028 [US2] Add "No data matches your filters" empty state with clear filters option
- [x] T029 [US2] Add filter validation (e.g., MCCMNC format 5-6 digits, IMSI format 15 digits)

**Checkpoint**: Advanced filtering works - MCCMNC and IMSI filters affect all panes; filters persist across granularity changes

---

## Phase 5: User Story 3 - Detailed Usage Results Pane (Priority: P2)

**Goal**: Display a detailed data table showing individual IMSI usage records matching current filters

**Independent Test**: Apply filters and verify data table shows matching records with all required columns

### Implementation for User Story 3

- [x] T030 [US3] Create UsageResultsTable.vue component in `sim-card-portal-v2/src/components/consumption/UsageResultsTable.vue` using PrimeVue DataTable
- [x] T031 [US3] Add columns: IMSI, Network (MCCMNC + carrier name), Data Volume (bytes formatted), Period, Last Event Time
- [x] T032 [US3] Implement pagination controls (default 10 rows per page, options 10/25/50) using PrimeVue Paginator
- [x] T033 [US3] Implement column sorting (ascending/descending toggle on header click)
- [x] T034 [US3] Integrate UsageResultsTable with ConsumptionPage.vue filter state
- [x] T035 [US3] Add CSV export functionality for filtered results
- [x] T036 [US3] Add large dataset warning (>10,000 records) suggesting more specific filters
- [x] T037 [US3] Format data volume display (bytes → KB/MB/GB based on size)

**Checkpoint**: Usage Results table works - displays filtered records with pagination, sorting, and CSV export

---

## Phase 6: User Story 4 - AskBob LLM Analytics Integration (Priority: P3)

**Goal**: Enable AskBob to answer natural language queries about consumption data using the Analytics API

**Independent Test**: Type natural language queries into AskBob and verify responses contain accurate data from the API

### Implementation for User Story 4

- [x] T038 [US4] Extend `/api/llm/chart.ts` to recognize Analytics API query intents (network usage, IMSI counts, period comparisons)
- [x] T039 [US4] Add Analytics API tool definitions to LLM system prompt with parameter schemas
- [x] T040 [US4] Implement query translation: natural language → Analytics API parameters (period, periodEnd, mccmnc, imsi)
- [x] T041 [US4] Create AnalyticsToolResponse formatting for chart/table/text output types
- [x] T042 [US4] Update AskBobPane.vue to render Analytics API chart responses (bar, line, pie, doughnut)
- [x] T043 [US4] Update AskBobPane.vue to render Analytics API table responses
- [x] T044 [US4] Add clarifying question flow when Bob receives ambiguous queries
- [x] T045 [US4] Preserve existing CSV export functionality for AskBob responses with Analytics data

**Checkpoint**: AskBob Analytics integration works - natural language queries return accurate data charts/tables

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T046 [P] Verify all components build without TypeScript errors
- [x] T047 [P] Verify error handling and loading states across all panes
- [x] T048 [P] Verify filter state behavior across page interactions
- [x] T049 [P] Add accessibility attributes to new filter controls (aria-labels, aria-expanded, keyboard navigation)
- [x] T050 Final build verification and type checking
- [x] T053 [P] Add global dark theme CSS for PrimeVue MultiSelect overlay panel in `sim-card-portal-v2/src/style.css` (portal-rendered dropdowns require global styles)
- [x] T054 [P] Add cost disclaimer footer to ConsumptionTrendsChart: "Costs do not include Access Charges"
- [x] T051 Add structured logging for filter changes and API calls (audit trail) via auditLogger service
- [ ] T052 [DEFERRED] Performance optimization: debounce filter changes, optimize cache key generation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (P1) should be completed first as MVP
  - US2, US3 (both P2) can proceed in parallel after US1
  - US4 (P3) can proceed after foundational, ideally after US2 for filter context
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **US2 (P2)**: Can start after Foundational - Integrates with US1 filter state
- **US3 (P2)**: Can start after Foundational - Uses same filter state as US1/US2
- **US4 (P3)**: Can start after Foundational - Benefits from US2 filter implementation

### Within Each User Story

- Services/utilities before component integration
- Core component before integration with page
- UI interactions before polish/validation

### Parallel Opportunities

- T001, T002, T003 (Setup) can run in parallel
- T004-T012 (Foundational) can mostly run in parallel (T004 first, then rest in parallel)
- After Foundational: US1 first, then US2 and US3 can run in parallel
- All tasks marked [P] within a phase can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T012)
3. Complete Phase 3: User Story 1 (T013-T020)
4. **STOP and VALIDATE**: Test unified time filtering independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → Deploy/Demo (MVP!)
3. Add US2 + US3 → Test independently → Deploy/Demo (filter + table features)
4. Add US4 → Test independently → Deploy/Demo (LLM integration)
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All panes must use analyticsService for data fetching (not direct API calls)
- Session caching is critical for performance - implement in T010
- MCCMNC carrier names enhance UX but are non-blocking (fallback to raw code)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently

## Completion Summary (2025-01-08)

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Setup | ✅ Complete | T001-T003 |
| Phase 2: Foundational | ✅ Complete | T004-T012 |
| Phase 3: US1 Time Filtering | ✅ Complete | T013-T020 |
| Phase 4: US2 Filter Fields | ✅ Complete | T021-T029, enhanced with date pickers & IMSI modes |
| Phase 5: US3 Usage Table | ✅ Complete | T030-T037 |
| Phase 6: US4 AskBob LLM | ✅ Complete | T038-T045 |
| Phase 7: Polish | ✅ Complete | T046-T054 (T052 deferred) |

**Post-Implementation Enhancements (2025-01-08)**:
- T020 completed: Date range picker integration via FilterPanel (was originally deferred)
- T021 expanded: Added Start/End date pickers to FilterPanel for IMSI-specific date ranges
- T023 expanded: IMSI filter now supports three modes (Single, Multiple with add/remove rows, Range)
- T051 completed: Structured audit logging via auditLogger service (filter changes, API calls, exports, AskBob queries)
- T053 added: Global dark theme CSS for PrimeVue MultiSelect overlay (fixes portal rendering)
- T054 added: Cost disclaimer footer in ConsumptionTrendsChart

**Deferred Items**:
- T052: Performance optimization (debounce, cache optimization)

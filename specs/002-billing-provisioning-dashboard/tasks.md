# Tasks: Billing & Provisioning Dashboard

**Input**: Design documents from `/specs/002-billing-provisioning-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/billing-api.yaml, quickstart.md

**Tests**: TDD is REQUIRED by the project constitution. Tests are written before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

All paths are relative to `dashboard/` directory at repository root:
- Source: `src/`
- Tests: `tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Initialize Vue 3 + TypeScript project with Vite in dashboard/ directory
- [ ] T002 Install dependencies: primevue, primeicons, primeflex, axios, vue-router
- [ ] T003 Install dev dependencies: vitest, @vue/test-utils, jsdom, playwright
- [ ] T004 [P] Configure PrimeVue with Aura theme in dashboard/src/main.ts
- [ ] T005 [P] Configure Vitest with jsdom environment in dashboard/vite.config.ts
- [ ] T006 [P] Configure Playwright for E2E tests in dashboard/playwright.config.ts
- [ ] T007 Create directory structure per plan.md (components/, composables/, pages/, services/, types/, router/)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Create TypeScript types for Invoice in dashboard/src/types/invoice.ts
- [ ] T009 [P] Create TypeScript types for SIM in dashboard/src/types/sim.ts
- [ ] T010 [P] Create TypeScript types for MediationEvent in dashboard/src/types/mediation.ts
- [ ] T011 [P] Create TypeScript types for KPI, Trend, CarrierBreakdown in dashboard/src/types/kpi.ts
- [ ] T012 Implement base API client with Axios and Bearer auth in dashboard/src/services/api.ts
- [ ] T013 [P] Implement useAutoRefresh composable (30-second interval) in dashboard/src/composables/useAutoRefresh.ts
- [ ] T014 [P] Create ErrorRetry component with retry button in dashboard/src/components/common/ErrorRetry.vue
- [ ] T015 Configure Vue Router with /billing, /provisioning, /testing routes in dashboard/src/router/index.ts
- [ ] T016 Create Navigation component with TabMenu in dashboard/src/components/common/Navigation.vue
- [ ] T017 Update App.vue with Navigation and RouterView in dashboard/src/App.vue
- [ ] T018 Create placeholder page components (BillingPage, ProvisioningPage, TestingPage) in dashboard/src/pages/

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View and Manage Invoices (Priority: P1) 🎯 MVP

**Goal**: Display invoices from ERP system with filtering and PDF download

**Independent Test**: Navigate to Billing page, view invoice list, filter by status, download PDF

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T019 [P] [US1] Unit test for useInvoices composable in dashboard/tests/unit/composables/useInvoices.test.ts
- [ ] T020 [P] [US1] Unit test for InvoiceList component in dashboard/tests/unit/components/InvoiceList.test.ts
- [ ] T021 [P] [US1] E2E test for invoice list and filtering in dashboard/tests/e2e/billing-invoices.spec.ts

### Implementation for User Story 1

- [ ] T022 [US1] Implement billingService with listInvoices API call in dashboard/src/services/billingService.ts
- [ ] T023 [US1] Implement useInvoices composable with state and filtering in dashboard/src/composables/useInvoices.ts
- [ ] T024 [US1] Create InvoiceList component with DataTable in dashboard/src/components/billing/InvoiceList.vue
- [ ] T025 [US1] Add status filter dropdown (pending, paid, overdue, disputed) to InvoiceList
- [ ] T026 [US1] Add carrier filter dropdown to InvoiceList
- [ ] T027 [US1] Implement PDF download/view button with pdfUrl link in InvoiceList
- [ ] T028 [US1] Integrate InvoiceList into BillingPage with auto-refresh in dashboard/src/pages/BillingPage.vue

**Checkpoint**: Invoice viewing and filtering fully functional

---

## Phase 4: User Story 2 - Monitor Provisioning Tasks and SIM Status (Priority: P1)

**Goal**: Display SIM provisioning tasks with status filtering and detail view

**Independent Test**: Navigate to Provisioning page, view SIM list, filter by status, view SIM details

### Tests for User Story 2 ⚠️

- [ ] T029 [P] [US2] Unit test for useSims composable in dashboard/tests/unit/composables/useSims.test.ts
- [ ] T030 [P] [US2] Unit test for SimList component in dashboard/tests/unit/components/SimList.test.ts
- [ ] T031 [P] [US2] E2E test for SIM list and details in dashboard/tests/e2e/provisioning-sims.spec.ts

### Implementation for User Story 2

- [ ] T032 [US2] Implement provisioningService with listSims, getSim API calls in dashboard/src/services/provisioningService.ts
- [ ] T033 [US2] Implement useSims composable with state, filtering, selection in dashboard/src/composables/useSims.ts
- [ ] T034 [US2] Create SimList component with DataTable in dashboard/src/components/provisioning/SimList.vue
- [ ] T035 [US2] Add status filter dropdown (PROVISIONED, ACTIVE, INACTIVE, BLOCKED) to SimList
- [ ] T036 [US2] Create SimDetails dialog component in dashboard/src/components/provisioning/SimDetails.vue
- [ ] T037 [US2] Add row selection to SimList that opens SimDetails dialog
- [ ] T038 [US2] Integrate SimList into ProvisioningPage with auto-refresh in dashboard/src/pages/ProvisioningPage.vue

**Checkpoint**: SIM monitoring fully functional

---

## Phase 5: User Story 3 - Block and Unblock SIMs (Priority: P2)

**Goal**: Allow users to block/unblock SIMs with reason selection and error handling

**Independent Test**: Select a SIM, click Block, select reason, verify status changes to BLOCKED; repeat for Unblock

### Tests for User Story 3 ⚠️

- [ ] T039 [P] [US3] Unit test for block/unblock in provisioningService in dashboard/tests/unit/services/provisioningService.test.ts
- [ ] T040 [P] [US3] Unit test for BlockDialog component in dashboard/tests/unit/components/BlockDialog.test.ts
- [ ] T041 [P] [US3] E2E test for block/unblock flow in dashboard/tests/e2e/provisioning-block.spec.ts

### Implementation for User Story 3

- [ ] T042 [US3] Add blockSim and unblockSim methods to provisioningService in dashboard/src/services/provisioningService.ts
- [ ] T043 [US3] Create BlockDialog component with reason dropdown in dashboard/src/components/provisioning/BlockDialog.vue
- [ ] T044 [US3] Create UnblockDialog component with notes field in dashboard/src/components/provisioning/UnblockDialog.vue
- [ ] T045 [US3] Add Block button to SimList/SimDetails (visible when status is ACTIVE/INACTIVE)
- [ ] T046 [US3] Add Unblock button to SimList/SimDetails (visible when status is BLOCKED)
- [ ] T047 [US3] Handle error responses with retry button using ErrorRetry component
- [ ] T048 [US3] Show "SIM is already blocked" info message when blocking already-blocked SIM
- [ ] T049 [US3] Display block reason, timestamp, initiator in SimDetails for blocked SIMs

**Checkpoint**: Block/unblock operations fully functional with error handling

---

## Phase 6: User Story 4 - View Mediation Events and Usage Data (Priority: P2)

**Goal**: Display mediation events with filtering by date range and ICCID

**Independent Test**: Navigate to Mediation Events section, view usage records, filter by date and ICCID

### Tests for User Story 4 ⚠️

- [ ] T050 [P] [US4] Unit test for useMediationEvents composable in dashboard/tests/unit/composables/useMediationEvents.test.ts
- [ ] T051 [P] [US4] Unit test for MediationEvents component in dashboard/tests/unit/components/MediationEvents.test.ts
- [ ] T052 [P] [US4] E2E test for mediation events in dashboard/tests/e2e/billing-mediation.spec.ts

### Implementation for User Story 4

- [ ] T053 [US4] Add getMediationEvents method to billingService (query existing usage data) in dashboard/src/services/billingService.ts
- [ ] T054 [US4] Implement useMediationEvents composable with state and filtering in dashboard/src/composables/useMediationEvents.ts
- [ ] T055 [US4] Create MediationEvents component with DataTable in dashboard/src/components/billing/MediationEvents.vue
- [ ] T056 [US4] Add date range filter using Calendar component to MediationEvents
- [ ] T057 [US4] Add ICCID text filter to MediationEvents
- [ ] T058 [US4] Display DUPLICATE status badge for duplicate records
- [ ] T059 [US4] Create expandable row with full usage details (upload, download, SMS, voice)
- [ ] T060 [US4] Add MediationEvents tab/section to BillingPage

**Checkpoint**: Mediation events viewing fully functional

---

## Phase 7: User Story 5 - API Testing Console (Priority: P3)

**Goal**: Provide testing page with health check and API test console

**Independent Test**: Navigate to Testing page, click Health Check, verify response displayed

### Tests for User Story 5 ⚠️

- [ ] T061 [P] [US5] Unit test for testingService in dashboard/tests/unit/services/testingService.test.ts
- [ ] T062 [P] [US5] Unit test for HealthCheck component in dashboard/tests/unit/components/HealthCheck.test.ts
- [ ] T063 [P] [US5] E2E test for testing page in dashboard/tests/e2e/testing.spec.ts

### Implementation for User Story 5

- [ ] T064 [US5] Implement testingService with healthCheck, lookupSim methods in dashboard/src/services/testingService.ts
- [ ] T065 [US5] Create HealthCheck component with status display in dashboard/src/components/testing/HealthCheck.vue
- [ ] T066 [US5] Create ApiConsole component with endpoint selector and input in dashboard/src/components/testing/ApiConsole.vue
- [ ] T067 [US5] Add SIM lookup by ICCID test in ApiConsole
- [ ] T068 [US5] Display formatted API response with syntax highlighting
- [ ] T069 [US5] Show error code, message, and troubleshooting guidance on errors
- [ ] T070 [US5] Integrate HealthCheck and ApiConsole into TestingPage in dashboard/src/pages/TestingPage.vue

**Checkpoint**: Testing console fully functional

---

## Phase 8: User Story 6 - View Consumption Analytics and KPIs (Priority: P3)

**Goal**: Display consumption KPIs, trends, and carrier breakdown

**Independent Test**: View KPI cards, change trend granularity, view carrier breakdown chart

### Tests for User Story 6 ⚠️

- [ ] T071 [P] [US6] Unit test for useKpis composable in dashboard/tests/unit/composables/useKpis.test.ts
- [ ] T072 [P] [US6] Unit test for KpiDashboard component in dashboard/tests/unit/components/KpiDashboard.test.ts
- [ ] T073 [P] [US6] E2E test for analytics in dashboard/tests/e2e/billing-analytics.spec.ts

### Implementation for User Story 6

- [ ] T074 [US6] Add getKpis, getTrends, getCarriers methods to billingService in dashboard/src/services/billingService.ts
- [ ] T075 [US6] Implement useKpis composable with state and granularity selection in dashboard/src/composables/useKpis.ts
- [ ] T076 [US6] Create KpiDashboard component with stat cards in dashboard/src/components/billing/KpiDashboard.vue
- [ ] T077 [US6] Display totalSpend, dataUsageGB, activeSims, avgCostPerSim with trends
- [ ] T078 [US6] Create TrendChart component with Chart.js or PrimeVue Chart in dashboard/src/components/billing/TrendChart.vue
- [ ] T079 [US6] Add granularity selector (hourly, daily, weekly, monthly) to TrendChart
- [ ] T080 [US6] Create CarrierBreakdown component with pie chart in dashboard/src/components/billing/CarrierBreakdown.vue
- [ ] T081 [US6] Add KpiDashboard, TrendChart, CarrierBreakdown to BillingPage

**Checkpoint**: Analytics dashboard fully functional

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T082 [P] Add loading spinners to all data-fetching components
- [ ] T083 [P] Add empty state messages when no data available
- [ ] T084 Verify 30-second auto-refresh works on all list views
- [ ] T085 [P] Add Toast notifications for success/error feedback
- [ ] T086 Style consistency check across all pages with PrimeFlex
- [ ] T087 Responsive design verification for smaller screens
- [ ] T088 Run all unit tests and fix any failures
- [ ] T089 Run all E2E tests and fix any failures
- [ ] T090 Run quickstart.md verification checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - US1 and US2 can run in parallel (both P1, independent)
  - US3 depends on US2 (needs SimList/SimDetails)
  - US4 can run in parallel with US3 (independent)
  - US5 can run in parallel (independent)
  - US6 can run in parallel (independent)
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

| Story | Depends On | Can Start After |
|-------|------------|-----------------|
| US1 (Invoices) | Foundational | Phase 2 complete |
| US2 (SIM Status) | Foundational | Phase 2 complete |
| US3 (Block/Unblock) | US2 | US2 complete |
| US4 (Mediation) | Foundational | Phase 2 complete |
| US5 (Testing) | Foundational | Phase 2 complete |
| US6 (Analytics) | Foundational | Phase 2 complete |

### Within Each User Story

1. Tests MUST be written and FAIL before implementation (TDD required)
2. Service layer before composables
3. Composables before components
4. Components before page integration
5. Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel
- All tests within a user story marked [P] can run in parallel
- US1, US2, US4, US5, US6 can all start in parallel after Foundational
- Only US3 must wait for US2

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (TDD - write first, ensure fail):
Task: "Unit test for useInvoices composable in dashboard/tests/unit/composables/useInvoices.test.ts"
Task: "Unit test for InvoiceList component in dashboard/tests/unit/components/InvoiceList.test.ts"
Task: "E2E test for invoice list in dashboard/tests/e2e/billing-invoices.spec.ts"

# Then implement sequentially:
Task: "Implement billingService with listInvoices API call"
Task: "Implement useInvoices composable"
Task: "Create InvoiceList component"
# ...
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Invoices)
4. **STOP and VALIDATE**: Test invoice viewing independently
5. Deploy/demo if ready - invoice visibility delivers immediate value

### Recommended Order (After MVP)

1. Setup + Foundational → Foundation ready
2. US1 (Invoices) + US2 (SIM Status) in parallel → Two core views ready
3. US3 (Block/Unblock) → Adds operational control
4. US4 (Mediation) + US5 (Testing) in parallel → Complete feature set
5. US6 (Analytics) → Strategic insights
6. Polish → Production-ready

### Parallel Team Strategy

With 2-3 developers after Foundational complete:
- Developer A: US1 (Invoices) → US4 (Mediation)
- Developer B: US2 (SIM Status) → US3 (Block/Unblock)
- Developer C: US5 (Testing) → US6 (Analytics)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- TDD required: Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Auto-refresh (30s) must be verified for all list views

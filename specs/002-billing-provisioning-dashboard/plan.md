# Implementation Plan: Billing & Provisioning Dashboard

**Branch**: `002-billing-provisioning-dashboard` | **Date**: 2025-12-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-billing-provisioning-dashboard/spec.md`

## Summary

Create a Vue.js test suite dashboard with three dedicated pages (Billing, Provisioning, Testing) to validate billing and provisioning API integrations. The dashboard consumes the existing billing API at `localhost:3001`, displaying invoices, SIM provisioning tasks, mediation events, and consumption analytics. Key features include 30-second auto-refresh, block/unblock operations with retry on failure, and an API testing console.

## Technical Context

**Language/Version**: TypeScript 5.3, Vue 3.4
**Primary Dependencies**: Vue 3, PrimeVue 4, Axios, Vue Router
**Storage**: N/A (consumes external API, no local persistence)
**Testing**: Vitest (unit), Playwright (E2E), @vue/test-utils
**Target Platform**: Web browser (Chrome, Firefox, Safari)
**Project Type**: Web application (frontend only - consumes existing API)
**Performance Goals**: Page load <5s, API responses displayed within 3s
**Constraints**: Must work with existing billing API at localhost:3001
**Scale/Scope**: Test suite for developers/testers, ~3 pages, ~15 components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Protocol Compliance | N/A | This feature is a UI dashboard, not MQTT broker functionality |
| II. Reliability First | PASS | Error handling with retry buttons ensures reliable test experience |
| III. Test-First Development | REQUIRED | All components must have tests written before implementation |
| IV. Security by Design | PASS | Uses existing API authentication (Bearer token) |
| V. Observability | PASS | Console logging for debugging, structured error display |

**Gate Status**: PASS - No violations. TDD is mandatory for all implementation.

## Project Structure

### Documentation (this feature)

```text
specs/002-billing-provisioning-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output - technology decisions
├── data-model.md        # Phase 1 output - entity definitions
├── quickstart.md        # Phase 1 output - setup guide
├── contracts/           # Phase 1 output - API specifications
│   └── billing-api.yaml # OpenAPI spec for consumed API
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
dashboard/
├── src/
│   ├── components/
│   │   ├── billing/         # Invoice, Mediation, KPI, Carrier components
│   │   ├── provisioning/    # SIM list, details, block dialog
│   │   ├── testing/         # Health check, API console
│   │   └── common/          # Navigation, error handling, auto-refresh
│   ├── composables/         # Reusable state logic
│   │   ├── useAutoRefresh.ts
│   │   ├── useInvoices.ts
│   │   ├── useSims.ts
│   │   ├── useMediationEvents.ts
│   │   └── useKpis.ts
│   ├── pages/              # Route-level page components
│   │   ├── BillingPage.vue
│   │   ├── ProvisioningPage.vue
│   │   └── TestingPage.vue
│   ├── services/           # API client layer
│   │   ├── api.ts
│   │   ├── billingService.ts
│   │   ├── provisioningService.ts
│   │   └── testingService.ts
│   ├── types/              # TypeScript type definitions
│   ├── router/             # Vue Router configuration
│   ├── App.vue
│   └── main.ts
├── tests/
│   ├── unit/              # Vitest unit tests
│   └── e2e/               # Playwright E2E tests
├── package.json
├── vite.config.ts
├── tsconfig.json
└── playwright.config.ts
```

**Structure Decision**: Frontend-only web application. The dashboard directory is created as a standalone Vue.js project that consumes the existing billing API. No backend is created since the API already exists.

## Phase Artifacts

### Phase 0: Research
- [research.md](research.md) - Technology decisions and rationale

### Phase 1: Design & Contracts
- [data-model.md](data-model.md) - Entity definitions with TypeScript types
- [contracts/billing-api.yaml](contracts/billing-api.yaml) - OpenAPI specification
- [quickstart.md](quickstart.md) - Development setup guide

### Phase 2: Tasks (Next Step)
- Run `/speckit.tasks` to generate implementation tasks

## Key Design Decisions

1. **Frontend Framework**: Vue 3 + PrimeVue for rapid UI development with pre-built components
2. **State Management**: Vue composables (no Vuex/Pinia) - simple page-scoped state
3. **Auto-Refresh**: 30-second interval using `setInterval` with lifecycle cleanup
4. **Error Handling**: Axios interceptors + PrimeVue Toast with retry button
5. **Testing Strategy**: TDD with Vitest (unit) + Playwright (E2E)

## Complexity Tracking

> No Constitution violations to justify.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

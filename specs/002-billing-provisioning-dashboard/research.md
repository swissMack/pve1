# Research: Billing & Provisioning Dashboard

**Feature**: 002-billing-provisioning-dashboard
**Date**: 2025-12-21

## Technical Context Decisions

### 1. Frontend Framework

**Decision**: Vue.js 3 with PrimeVue component library

**Rationale**:
- PrimeVue provides pre-built DataTable, Dialog, and Form components needed for the dashboard
- Vue 3 Composition API enables clean, testable component logic
- Existing project has Node.js tooling (simportal-generator uses Node.js)
- PrimeVue includes built-in support for filtering, pagination, and auto-refresh patterns

**Alternatives Considered**:
- React with Material-UI: More complex setup, no existing project familiarity
- Vanilla JS: Would require building all UI components from scratch
- Angular: Heavier framework than needed for a test suite

### 2. API Integration

**Decision**: Use existing billing API at `http://localhost:3001` (no new backend required)

**Rationale**:
- The billing API already exists at `/Users/mackmood/CMP/sim-card-portal-v2`
- All required endpoints documented in `billing_api.md`
- This dashboard is a test suite/consumer of the existing API
- No duplication of backend logic needed

**Alternatives Considered**:
- Create new backend: Unnecessary since API exists
- Mock API only: Would defeat the purpose of testing real API integration

### 3. State Management

**Decision**: Vue 3 reactive state with composables (no external state library)

**Rationale**:
- Dashboard has simple, page-scoped state (invoice list, SIM list, events)
- No cross-page state sharing required beyond user session
- Composables provide testable, reusable state logic
- Avoids Vuex/Pinia complexity for a test suite

**Alternatives Considered**:
- Pinia: Overkill for page-local state
- Global reactive objects: Less structured than composables

### 4. Auto-Refresh Implementation

**Decision**: `setInterval` with Vue lifecycle management (30-second interval)

**Rationale**:
- Simple, browser-native approach
- Clear cleanup in `onUnmounted` lifecycle hook
- Matches clarified requirement (30-second auto-refresh)
- No WebSocket complexity needed for this test suite

**Alternatives Considered**:
- WebSocket/SSE: Adds server-side complexity not needed
- Polling library: Over-engineered for fixed interval

### 5. Testing Strategy

**Decision**: Vitest for unit tests + Playwright for E2E

**Rationale**:
- Vitest integrates natively with Vue 3 and Vite
- Playwright handles browser-based E2E testing
- Constitution requires TDD - tests before implementation
- Component testing via `@vue/test-utils`

**Alternatives Considered**:
- Jest: Requires more configuration for Vue 3
- Cypress: Heavier than Playwright for E2E

### 6. Build Tooling

**Decision**: Vite for development and build

**Rationale**:
- Fast HMR for development
- Native Vue 3 support
- Modern ESM-based build
- Simple configuration

**Alternatives Considered**:
- Webpack: Slower, more complex configuration

## Integration Patterns

### API Error Handling Pattern

```text
Request → Response
   ↓         ↓
 Error?   Success
   ↓         ↓
Show error  Update state
with retry    ↓
button     Re-render
```

**Implementation**:
- Use axios interceptors for centralized error handling
- Display error in PrimeVue Toast with retry button
- Error includes API response details (status, message)

### Auto-Refresh Pattern

```text
Component mounted
       ↓
Start interval (30s)
       ↓
   Fetch data
       ↓
 Update state → Re-render
       ↓
Component unmounted
       ↓
Clear interval
```

**Implementation**:
- `useAutoRefresh(fetchFn, interval)` composable
- Clears on unmount to prevent memory leaks
- Pauses during user interaction (optional enhancement)

## Constitution Compliance Notes

| Principle | Compliance Status | Notes |
|-----------|------------------|-------|
| Protocol Compliance | N/A | This is a UI test suite, not MQTT functionality |
| Reliability First | COMPLIANT | Error handling with retry ensures reliable UX |
| Test-First (TDD) | REQUIRED | All components must have tests written first |
| Security by Design | COMPLIANT | Uses existing API auth (Bearer token) |
| Observability | COMPLIANT | Console logging for debug, structured errors |

## Dependencies

### Runtime
- vue: ^3.4
- primevue: ^4.0
- primeicons: ^7.0
- primeflex: ^3.3
- axios: ^1.6

### Development
- vite: ^5.0
- vitest: ^1.0
- @vue/test-utils: ^2.4
- playwright: ^1.40
- typescript: ^5.3

## Open Questions (None)

All clarifications resolved in spec. No blocking unknowns.

<!--
================================================================================
SYNC IMPACT REPORT
================================================================================
Version change: 0.0.0 → 1.0.0 (MAJOR - initial constitution ratification)

Modified principles: N/A (initial creation)

Added sections:
  - Core Principles (7 principles)
  - Technology Stack Constraints
  - Development Workflow
  - Governance

Removed sections: None

Templates requiring updates:
  - .specify/templates/plan-template.md ✅ (no changes needed - Constitution Check section exists)
  - .specify/templates/spec-template.md ✅ (no changes needed - compatible structure)
  - .specify/templates/tasks-template.md ✅ (no changes needed - compatible structure)

Follow-up TODOs: None
================================================================================
-->

# PVE1 Ecosystem Constitution

## Core Principles

### I. API-First Design

Every feature MUST begin with API contract definition before implementation.

- All external-facing functionality MUST be exposed through versioned REST APIs
- API contracts MUST be documented with request/response schemas before coding begins
- Breaking changes MUST increment the API major version (v1 → v2)
- Internal services SHOULD communicate via well-defined interfaces, not direct database access
- HATEOAS links MUST be included in API responses for discoverability

**Rationale**: Contract-first development prevents integration issues, enables parallel frontend/backend work, and ensures external systems can rely on stable interfaces.

### II. Data Separation

Sensitive data MUST be isolated from display/UI data through separate storage layers.

- Authentication credentials (ki, opc, PIN/PUK codes) MUST reside in provisioning tables only
- UI-facing tables MUST NOT contain sensitive telecom keys or authentication secrets
- Database triggers MUST sync state changes between provisioning and display tables
- Status mapping between domains MUST be explicit and documented
- API responses MUST never expose sensitive keys to frontend clients

**Rationale**: Separation of concerns reduces attack surface, simplifies UI development, and ensures sensitive telecom data remains isolated from general application access.

### III. Security by Default

All endpoints MUST implement authentication and authorization unless explicitly public.

- API endpoints MUST require API key or JWT authentication (except /health endpoints)
- Passwords MUST be hashed using bcrypt or equivalent
- JWTs MUST have expiration times and MUST be validated on every request
- Input MUST be validated and sanitized before database operations
- SQL queries MUST use parameterized statements, never string concatenation
- CORS MUST be configured to allow only known origins in production

**Rationale**: Security vulnerabilities are expensive to fix post-deployment. Secure-by-default ensures protection is built-in rather than bolted-on.

### IV. State Machine Integrity

Entity state transitions MUST be validated against allowed transition rules.

- State changes MUST follow documented state machine diagrams
- Invalid state transitions MUST be rejected with clear error messages
- All state transitions MUST be logged to audit tables with timestamp and actor
- Webhooks MUST be triggered on state change events for external system notification
- Previous state MUST be preserved when blocking/suspending to enable restoration

**Rationale**: SIM lifecycle management requires strict state control. Invalid transitions can cause billing errors, service disruptions, and compliance violations.

### V. Observability

All services MUST expose health, metrics, and structured logging.

- Health endpoints MUST return service status and dependency health
- Prometheus metrics MUST be exposed for key operations (request count, latency, errors)
- Logs MUST be structured JSON with correlation IDs for request tracing
- Audit logs MUST capture who, what, when for all data modifications
- Dashboard visualizations MUST be available for key system metrics (Grafana)

**Rationale**: Production systems require visibility into behavior. Observability enables rapid diagnosis, capacity planning, and SLA compliance verification.

### VI. Configuration Isolation

Secrets and environment-specific configuration MUST be externalized from code.

- Database credentials MUST come from environment variables, never hardcoded
- API URLs MUST be configurable via environment (VITE_API_URL, MQTT_BROKER_URL)
- Docker services MUST use .env files for configuration injection
- Production secrets MUST NOT be committed to version control
- Default configurations MUST be safe (fail-closed, minimal permissions)

**Rationale**: Configuration isolation enables secure deployments across environments and prevents accidental secret exposure in repositories.

### VII. Contract Testing

API contracts MUST be validated through automated tests before deployment.

- Each API endpoint MUST have at least one contract test verifying schema compliance
- State transition endpoints MUST have tests for valid and invalid transitions
- Integration tests MUST verify database triggers sync data correctly
- Test API keys MUST be provisioned via migrations for consistent test environments
- CI/CD pipelines MUST run contract tests before allowing merge to main

**Rationale**: Contract tests catch breaking changes early, ensure API stability for external integrators, and provide confidence during refactoring.

## Technology Stack Constraints

### Required Technologies

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Frontend | Vue 3 + TypeScript | 3.4+ / 5.3+ | Composition API required |
| UI Components | PrimeVue | 4.x | Standard component library |
| Build Tool | Vite | Latest | Fast HMR and builds |
| Database | Supabase (PostgreSQL) | Latest | Primary data store |
| Messaging | EMQX (MQTT) | 5.x | Real-time device communication |
| API Server | Node.js + Express | 18+ | Local development and serverless |
| Deployment | Vercel | - | Serverless functions + static hosting |
| Containerization | Docker Compose | - | Local development environment |

### Prohibited Patterns

- Direct DOM manipulation (use Vue reactivity)
- Inline SQL strings (use parameterized queries)
- Storing secrets in frontend code
- Synchronous database calls in request handlers
- Hardcoded URLs or credentials

## Development Workflow

### Code Review Requirements

- All changes MUST be submitted via pull request
- PRs MUST pass automated tests before review
- Security-sensitive changes MUST be reviewed by a second developer
- API contract changes MUST include updated documentation

### Testing Gates

| Gate | Requirement |
|------|-------------|
| Pre-commit | Linting passes (ESLint, TypeScript) |
| PR Creation | Unit tests pass |
| PR Merge | Contract tests pass, integration tests pass |
| Deployment | Health checks pass in staging |

### Deployment Process

1. Changes merged to main trigger automatic Vercel deployment
2. Preview deployments created for all pull requests
3. Database migrations MUST be applied before code deployment
4. Rollback plan MUST exist for breaking changes

## Governance

This constitution supersedes all other development practices for the PVE1 ecosystem.

### Amendment Procedure

1. Propose amendment via pull request to constitution.md
2. Document rationale for change
3. Obtain approval from project maintainers
4. Update dependent templates if principles change
5. Increment version according to semantic versioning

### Versioning Policy

- **MAJOR**: Principle removal, redefinition, or backward-incompatible governance change
- **MINOR**: New principle added, section expanded, or material guidance added
- **PATCH**: Clarification, typo fix, or non-semantic refinement

### Compliance Review

- PRs SHOULD reference applicable principles when relevant
- Violations MUST be documented and justified if approved
- Periodic audits SHOULD verify codebase compliance with principles

**Version**: 1.0.0 | **Ratified**: 2025-01-07 | **Last Amended**: 2025-01-07

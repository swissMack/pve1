# Implementation Plan: Containerized MQTT Test Ecosystem

**Branch**: `001-mqtt-test-ecosystem` | **Date**: 2025-12-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-mqtt-test-ecosystem/spec.md`

## Summary

Build a containerized MQTT broker ecosystem for IoT device stack testing, featuring full MQTT 3.1.1/5.0 protocol support, multi-transport connectivity (TCP, TLS, WebSocket), device twin/shadow functionality, message persistence with replay, rules engine integration, and comprehensive observability. The system deploys via Docker Compose with a single command.

## Technical Context

**Broker**: EMQX 5.x (open-source, full MQTT 5.0, built-in rules engine, dashboard)
**Time-Series Storage**: InfluxDB 2.x (message history, replay capability)
**Metrics Stack**: Prometheus + Grafana (observability dashboards)
**Container Runtime**: Docker Compose (primary), Kubernetes (optional)
**Configuration**: YAML files + environment variables
**Testing**: MQTT conformance tests, integration tests with mosquitto_pub/sub, k6 load testing
**Target Platform**: Linux containers (amd64/arm64), macOS/Windows via Docker Desktop

**Project Type**: Multi-container infrastructure (Docker Compose orchestration)

**Performance Goals** (from spec):
- 10,000+ concurrent connections
- 100,000 msg/sec (QoS 0), 50,000 msg/sec (QoS 1)
- p99 latency < 50ms
- Connection establishment < 100ms with TLS

**Constraints**:
- Startup time < 10 seconds to accepting connections
- Memory: < 500MB idle, < 10KB per idle connection overhead
- Container image size: < 200MB compressed per service

**Scale/Scope**: Development/test environment, single-node deployment, 24-hour message retention default

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Protocol Compliance | ✅ PASS | FR-001, FR-002: Full MQTT 3.1.1 and 5.0 implementation required |
| II. Reliability First | ✅ PASS | FR-003: QoS 0/1/2 support; FR-015-017: Session persistence |
| III. Test-First Development | ✅ PASS | Conformance tests, integration tests planned; TDD enforced |
| IV. Security by Design | ✅ PASS | FR-019-024: TLS, auth, ACLs from day one |
| V. Observability | ✅ PASS | FR-025-029: Metrics, logging, tracing, health checks |

**Performance Alignment**:
- Constitution: 10K connections, 100K msg/sec → Spec matches ✅
- Constitution: p99 < 10ms (QoS 0) → Spec: p99 < 50ms (more conservative) ✅
- Constitution: < 5s startup → Spec: < 10s startup ✅

**No violations requiring justification.**

## Project Structure

### Documentation (this feature)

```text
specs/001-mqtt-test-ecosystem/
├── plan.md              # This file
├── research.md          # Phase 0: Technology decisions
├── data-model.md        # Phase 1: Entity schemas
├── quickstart.md        # Phase 1: Developer onboarding
├── contracts/           # Phase 1: API specifications
│   ├── management-api.yaml
│   ├── device-api.yaml
│   └── rules-api.yaml
└── tasks.md             # Phase 2: Implementation tasks
```

### Source Code (repository root)

```text
docker/
├── docker-compose.yml        # Main orchestration file
├── docker-compose.dev.yml    # Development overrides
├── .env.example              # Environment template
└── services/
    ├── emqx/
    │   ├── Dockerfile           # Custom EMQX image (if needed)
    │   ├── emqx.conf            # Broker configuration
    │   ├── acl.conf             # Access control rules
    │   └── plugins/             # Custom plugins
    ├── influxdb/
    │   └── init-scripts/        # Database initialization
    └── grafana/
        ├── provisioning/        # Auto-provisioned dashboards
        └── dashboards/          # JSON dashboard definitions

scripts/
├── generate-certs.sh         # TLS certificate generation
├── seed-devices.sh           # Device registry seeding
└── replay-messages.sh        # Message replay utility

config/
├── users.json                # User credentials
├── devices.json              # Device registry seed data
└── rules/                    # Rules engine configurations

tests/
├── conformance/              # MQTT protocol conformance tests
├── integration/              # End-to-end integration tests
├── load/                     # k6 load test scripts
└── fixtures/                 # Test data and certificates
```

**Structure Decision**: Multi-container infrastructure project. No application source code—this is a configuration and orchestration project. All logic lives in containerized services (EMQX, InfluxDB, Grafana) with custom configuration files.

## Complexity Tracking

> No Constitution Check violations requiring justification.

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| EMQX over Mosquitto | Built-in rules engine, dashboard, clustering support | Mosquitto lighter but lacks rules engine |
| InfluxDB over PostgreSQL | Purpose-built for time-series, efficient retention policies | PostgreSQL works but less efficient for time-series queries |
| Separate Grafana service | Pre-built dashboards, widely adopted | EMQX dashboard sufficient for basic metrics, but Grafana more flexible |

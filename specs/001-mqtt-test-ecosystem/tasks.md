# Tasks: Containerized MQTT Test Ecosystem

**Input**: Design documents from `/specs/001-mqtt-test-ecosystem/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Integration tests included per Constitution Principle III (Test-First Development).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This is a **multi-container infrastructure project**. Paths:
- `docker/` - Docker Compose and service configurations
- `scripts/` - Utility scripts
- `config/` - Configuration files
- `tests/` - Test suites

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and Docker Compose skeleton

- [x] T001 Create project directory structure per plan.md in repository root
- [x] T002 [P] Create docker/docker-compose.yml with service definitions (emqx, influxdb, grafana, prometheus)
- [x] T003 [P] Create docker/.env.example with all environment variables from quickstart.md
- [x] T004 [P] Create docker/docker-compose.dev.yml with development overrides (debug ports, volume mounts)
- [x] T005 Create .gitignore with docker volumes, certs, and env files

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core EMQX broker configuration that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create docker/services/emqx/emqx.conf with base listener configuration (ports 1883, 8883, 8083, 8084)
- [x] T007 Configure EMQX session persistence in docker/services/emqx/emqx.conf (RocksDB backend)
- [x] T008 [P] Create docker/services/influxdb/init-scripts/init.sh for bucket and retention policy setup
- [x] T009 [P] Create docker/services/prometheus/prometheus.yml with EMQX scrape target
- [x] T010 [P] Create docker/services/grafana/provisioning/datasources/datasources.yml for Prometheus and InfluxDB
- [x] T011 Add health check configurations to all services in docker/docker-compose.yml
- [x] T012 Create scripts/wait-for-services.sh to verify all services are ready before tests

**Checkpoint**: Foundation ready - `docker compose up` starts all services, EMQX accepts connections on port 1883

---

## Phase 3: User Story 1 - Basic MQTT Messaging (Priority: P1) 🎯 MVP

**Goal**: Working MQTT broker with full protocol support (MQTT 3.1.1/5.0, all QoS levels)

**Independent Test**: Start ecosystem, connect with mosquitto_pub/sub, verify pub/sub across all QoS levels

### Tests for User Story 1

- [x] T013 [P] [US1] Create tests/integration/test_basic_connectivity.sh (connect, pub, sub on port 1883)
- [x] T014 [P] [US1] Create tests/integration/test_qos_levels.sh (verify QoS 0, 1, 2 delivery semantics)
- [x] T015 [P] [US1] Create tests/integration/test_session_persistence.sh (clean session false, reconnect, message delivery)
- [x] T016 [P] [US1] Create tests/integration/test_mqtt5_features.sh (shared subscriptions, message expiry, topic aliases)
- [x] T017 [P] [US1] Create tests/integration/test_retained_messages.sh (retain flag, new subscriber delivery)

### Implementation for User Story 1

- [x] T018 [US1] Configure MQTT 3.1.1 and 5.0 protocol support in docker/services/emqx/emqx.conf
- [x] T019 [US1] Configure QoS 0/1/2 settings in docker/services/emqx/emqx.conf (max_inflight, retry_interval)
- [x] T020 [US1] Configure shared subscriptions ($share group) in docker/services/emqx/emqx.conf
- [x] T021 [US1] Configure message expiry and session expiry defaults in docker/services/emqx/emqx.conf
- [x] T022 [US1] Configure rate limiting (100 conn/sec per IP) in docker/services/emqx/emqx.conf
- [x] T023 [US1] Configure max message payload size (256KB) in docker/services/emqx/emqx.conf
- [x] T024 [US1] Configure client takeover policy in docker/services/emqx/emqx.conf
- [x] T025 [US1] Create tests/fixtures/mqtt-client-config.json with test client configurations
- [ ] T026 [US1] Run and verify all US1 tests pass

**Checkpoint**: User Story 1 complete - basic MQTT messaging works with all protocol features

---

## Phase 4: User Story 2 - Secure Connections (Priority: P2)

**Goal**: TLS encryption and authentication/authorization

**Independent Test**: Connect with TLS cert, verify auth rejects bad credentials, verify ACL blocks unauthorized topics

### Tests for User Story 2

- [x] T027 [P] [US2] Create tests/integration/test_tls_connection.sh (port 8883, cert validation)
- [x] T028 [P] [US2] Create tests/integration/test_username_auth.sh (valid/invalid credentials)
- [x] T029 [P] [US2] Create tests/integration/test_mutual_tls.sh (client certificate authentication)
- [x] T030 [P] [US2] Create tests/integration/test_acl_enforcement.sh (publish/subscribe permissions)

### Implementation for User Story 2

- [x] T031 [US2] Create scripts/generate-certs.sh for CA, server, and client certificate generation
- [x] T032 [US2] Configure TLS listener (port 8883) in docker/services/emqx/emqx.conf with cert paths
- [x] T033 [US2] Configure WebSocket TLS listener (port 8084) in docker/services/emqx/emqx.conf
- [x] T034 [US2] Create config/users.json with test user credentials (testuser/testpass, admin/admin)
- [x] T035 [US2] Configure EMQX authentication backend (file-based) in docker/services/emqx/emqx.conf
- [x] T036 [US2] Create docker/services/emqx/acl.conf with topic permission rules
- [x] T037 [US2] Configure ACL authorization in docker/services/emqx/emqx.conf (hot-reload enabled)
- [x] T038 [US2] Create tests/fixtures/certs/ directory structure for test certificates
- [ ] T039 [US2] Run and verify all US2 tests pass

**Checkpoint**: User Story 2 complete - TLS, auth, and ACLs working

---

## Phase 5: User Story 3 - Observability and Debugging (Priority: P3)

**Goal**: Metrics dashboards, structured logging, health checks

**Independent Test**: Generate traffic, verify metrics in Grafana, verify logs contain connection events

### Tests for User Story 3

- [x] T040 [P] [US3] Create tests/integration/test_prometheus_metrics.sh (scrape /metrics endpoint)
- [x] T041 [P] [US3] Create tests/integration/test_health_endpoints.sh (liveness, readiness probes)
- [x] T042 [P] [US3] Create tests/integration/test_grafana_dashboards.sh (dashboard loads, data present)

### Implementation for User Story 3

- [x] T043 [US3] Configure Prometheus metrics endpoint in docker/services/emqx/emqx.conf
- [x] T044 [US3] Create docker/services/grafana/dashboards/mqtt-overview.json with connection/message metrics
- [x] T045 [US3] Create docker/services/grafana/dashboards/mqtt-clients.json with per-client metrics
- [x] T046 [US3] Create docker/services/grafana/provisioning/dashboards/dashboards.yml for auto-provisioning
- [x] T047 [US3] Configure structured JSON logging in docker/services/emqx/emqx.conf
- [x] T048 [US3] Configure trace logging for selected topics in docker/services/emqx/emqx.conf
- [ ] T049 [US3] Run and verify all US3 tests pass

**Checkpoint**: User Story 3 complete - observability stack operational

---

## Phase 6: User Story 4 - Message Persistence and Replay (Priority: P4)

**Goal**: Message history storage in InfluxDB, query and replay APIs

**Independent Test**: Publish messages, query history API, replay to verify message sequence

### Tests for User Story 4

- [ ] T050 [P] [US4] Create tests/integration/test_message_storage.sh (publish, verify in InfluxDB)
- [ ] T051 [P] [US4] Create tests/integration/test_message_history_query.sh (query by time range, topic)
- [ ] T052 [P] [US4] Create tests/integration/test_message_replay.sh (replay historical messages)
- [ ] T053 [P] [US4] Create tests/integration/test_message_ttl.sh (expiry enforcement)

### Implementation for User Story 4

- [ ] T054 [US4] Create EMQX rule for message storage in config/rules/message-to-influxdb.json
- [ ] T055 [US4] Configure InfluxDB data bridge in docker/services/emqx/emqx.conf
- [ ] T056 [US4] Create docker/services/influxdb/init-scripts/create-buckets.sh for mqtt_messages bucket
- [ ] T057 [US4] Configure retention policies (12h, 24h, 48h, 7d) in InfluxDB init script
- [ ] T058 [US4] Create scripts/replay-messages.sh for message replay functionality
- [ ] T059 [US4] Create config/rules/dead-letter-queue.json for undeliverable messages
- [ ] T060 [US4] Run and verify all US4 tests pass

**Checkpoint**: User Story 4 complete - message persistence and replay working

---

## Phase 7: User Story 5 - Device State Management (Priority: P5)

**Goal**: Device twin/shadow functionality with desired/reported state synchronization

**Independent Test**: Register device, update desired state, verify delta notification, report state back

### Tests for User Story 5

- [ ] T061 [P] [US5] Create tests/integration/test_device_registry.sh (CRUD operations via API)
- [ ] T062 [P] [US5] Create tests/integration/test_device_twin_desired.sh (update desired, receive delta)
- [ ] T063 [P] [US5] Create tests/integration/test_device_twin_reported.sh (report state, query twin)
- [ ] T064 [P] [US5] Create tests/integration/test_device_twin_offline.sh (delta delivery on reconnect)

### Implementation for User Story 5

- [ ] T065 [US5] Create config/rules/device-twin-get.json (handle $devices/+/twin/get requests)
- [ ] T066 [US5] Create config/rules/device-twin-update.json (handle $devices/+/twin/update reports)
- [ ] T067 [US5] Create config/rules/device-twin-delta.json (publish delta on desired changes)
- [ ] T068 [US5] Create config/devices.json with seed device registry data
- [ ] T069 [US5] Create scripts/seed-devices.sh to initialize device registry
- [ ] T070 [US5] Configure device status tracking (online/offline/last_seen) in EMQX rules
- [ ] T071 [US5] Run and verify all US5 tests pass

**Checkpoint**: User Story 5 complete - device twin functionality operational

---

## Phase 8: User Story 6 - Integration and Rules (Priority: P6)

**Goal**: Rules engine for message routing, transformation, and external system integration

**Independent Test**: Configure rule with webhook, publish message, verify webhook receives transformed payload

### Tests for User Story 6

- [ ] T072 [P] [US6] Create tests/integration/test_rules_topic_match.sh (rule triggers on topic pattern)
- [ ] T073 [P] [US6] Create tests/integration/test_rules_webhook.sh (HTTP webhook delivery)
- [ ] T074 [P] [US6] Create tests/integration/test_rules_republish.sh (message transformation and republish)
- [ ] T075 [P] [US6] Create tests/integration/test_rules_filter.sh (SQL-like WHERE conditions)

### Implementation for User Story 6

- [ ] T076 [US6] Create config/rules/webhook-example.json (HTTP POST action configuration)
- [ ] T077 [US6] Create config/rules/republish-example.json (topic transformation rule)
- [ ] T078 [US6] Create config/rules/influxdb-telemetry.json (write telemetry to InfluxDB)
- [ ] T079 [US6] Configure webhook retry policy in EMQX rules (3 retries, 1s interval)
- [ ] T080 [US6] Create tests/fixtures/webhook-server.py (mock webhook for testing)
- [ ] T081 [US6] Run and verify all US6 tests pass

**Checkpoint**: User Story 6 complete - rules engine operational

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation, and cleanup

- [ ] T082 [P] Create README.md with project overview and quickstart link
- [ ] T083 [P] Validate quickstart.md steps work end-to-end
- [ ] T084 [P] Create tests/load/k6-connection-test.js for 10K connection test (SC-002)
- [ ] T085 [P] Create tests/load/k6-throughput-test.js for message throughput test (SC-003, SC-004)
- [ ] T086 Run full integration test suite (all tests/integration/*.sh)
- [ ] T087 Verify startup time < 10 seconds (SC-011)
- [ ] T088 Document all environment variables in docker/.env.example
- [ ] T089 Final cleanup: remove debug configs, verify production defaults

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational (Phase 2)
  - US1 (P1): No dependencies on other stories
  - US2 (P2): Can start after Phase 2
  - US3 (P3): Can start after Phase 2
  - US4 (P4): Can start after Phase 2
  - US5 (P5): Can start after Phase 2
  - US6 (P6): Can start after Phase 2
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Independence

All user stories can be implemented in parallel after Foundational phase:
- **US1**: Core MQTT - required for meaningful testing but other stories use same broker
- **US2**: Security - adds TLS/auth layer, doesn't block other stories
- **US3**: Observability - adds dashboards, doesn't block other stories
- **US4**: Persistence - adds InfluxDB integration, independent
- **US5**: Device Twins - adds rules for twin topics, independent
- **US6**: Rules - adds custom rules, independent

### Parallel Opportunities

```bash
# Phase 1: All setup tasks can run in parallel
Task: T002, T003, T004 (different files)

# Phase 2: Infrastructure setup in parallel
Task: T008, T009, T010 (different services)

# Phase 3-8: All test tasks within a story can run in parallel
# Example for US1:
Task: T013, T014, T015, T016, T017 (different test files)

# After Foundational: All user stories can run in parallel
Task: "US1 implementation" | "US2 implementation" | "US3 implementation" | ...
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run `docker compose up`, verify pub/sub works
5. Demo/deploy basic MQTT broker

### Incremental Delivery

1. Setup + Foundational → Working Docker Compose
2. + US1 (Basic MQTT) → **MVP: Working broker**
3. + US2 (Security) → TLS and auth
4. + US3 (Observability) → Dashboards and metrics
5. + US4 (Persistence) → Message history
6. + US5 (Device Twins) → IoT platform features
7. + US6 (Rules) → Full integration capabilities

### Parallel Team Strategy

With multiple developers:
1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (Basic MQTT)
   - Developer B: US2 (Security)
   - Developer C: US3 (Observability)
   - Developer D: US4+US5+US6 (Advanced features)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps to specific user story for traceability
- Each user story independently completable and testable
- Run tests for each story before moving to next
- Commit after each phase completion
- All paths relative to repository root

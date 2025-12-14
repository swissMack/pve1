# Research: Containerized MQTT Test Ecosystem

**Date**: 2025-12-14
**Feature**: 001-mqtt-test-ecosystem

## Technology Decisions

### 1. MQTT Broker Selection

**Decision**: EMQX 5.x (Open Source Edition)

**Rationale**:
- Full MQTT 3.1.1 and 5.0 protocol compliance (certified)
- Built-in rules engine for message routing and transformation (FR-040 to FR-043)
- Native WebSocket support on configurable ports
- Built-in dashboard for monitoring and configuration GUI
- Prometheus metrics endpoint included
- Hot-reloadable ACL configuration (FR-024)
- Handles 10K+ concurrent connections easily
- Active development, Docker-native, excellent documentation

**Alternatives Considered**:

| Broker | Pros | Cons | Verdict |
|--------|------|------|---------|
| Mosquitto | Lightweight, mature, MQTT 5.0 since v2.0 | No built-in rules engine, requires external components for device management | Good for minimal setups, lacks advanced features |
| HiveMQ CE | Java-based, excellent extension system | Community edition has connection limits (25 connections) | Not suitable for 10K connection target |
| VerneMQ | Erlang-based, clustering support | Less active development, smaller community | EMQX has similar architecture with better ecosystem |
| NanoMQ | Ultra-lightweight, edge-focused | Missing rules engine, limited dashboard | Better suited for constrained devices |

### 2. Time-Series Storage

**Decision**: InfluxDB 2.x

**Rationale**:
- Purpose-built for time-series data (message history)
- Built-in retention policies (12h, 24h, 48h, 7d options per FR-030)
- Flux query language for complex message queries (FR-031)
- Native integration with EMQX rules engine
- Grafana data source support out-of-box
- Efficient storage compression for high message volumes

**Alternatives Considered**:

| Storage | Pros | Cons | Verdict |
|---------|------|------|---------|
| TimescaleDB | PostgreSQL-compatible, SQL queries | Heavier resource usage, more complex setup | Overkill for dev/test environment |
| QuestDB | Very fast ingestion | Younger project, less tooling integration | Not mature enough |
| PostgreSQL | Familiar, versatile | Not optimized for time-series, retention policies require custom logic | Works but inefficient |

### 3. Observability Stack

**Decision**: Prometheus + Grafana

**Rationale**:
- Industry standard for container metrics
- EMQX exposes native Prometheus endpoint
- Grafana provides pre-built MQTT dashboards
- AlertManager integration for notifications (future)
- Both have official Docker images, minimal configuration

**Metrics Exposed** (per FR-025):
- `emqx_connections_count` - Active connections
- `emqx_messages_received` - Messages per second (received)
- `emqx_messages_sent` - Messages per second (sent)
- `emqx_subscriptions_count` - Active subscriptions
- `emqx_retained_count` - Retained message count
- `emqx_session_count` - Persistent sessions

### 4. Device Twin Implementation

**Decision**: Custom service using EMQX rules + InfluxDB

**Rationale**:
- EMQX doesn't have built-in device twin (unlike AWS IoT/Azure IoT Hub)
- Implement using reserved topics: `$devices/{deviceId}/twin/get|update|delta`
- Store twin state in InfluxDB with version tracking
- Rules engine triggers delta notifications on desired state changes
- HTTP API for backend queries (FR-038)

**Topic Structure** (from requirements doc):
```
$devices/{deviceId}/twin/get      # Request current twin state
$devices/{deviceId}/twin/update   # Report device state
$devices/{deviceId}/twin/delta    # Desired state changes (broker → device)
```

### 5. Authentication & Authorization

**Decision**: EMQX built-in auth + file-based ACL

**Rationale**:
- EMQX supports multiple auth backends (file, HTTP, JWT, PostgreSQL)
- File-based is simplest for dev/test (FR-019)
- ACL supports pattern matching with `%c` (client ID) and `%u` (username) variables
- Hot-reload without restart (FR-024)
- Certificate auth via TLS listener configuration (FR-020)

**Auth Backends Available**:
1. `password_based:built_in_database` - Simple user/pass (default)
2. `password_based:http` - External auth service
3. `jwt` - JWT token validation
4. `x509` - Client certificate CN extraction

### 6. Container Orchestration

**Decision**: Docker Compose (primary), Helm charts (optional)

**Rationale**:
- Single `docker-compose up` meets FR-044
- Environment variable support meets FR-045
- Volume mounts for configuration files meets FR-046
- Health checks for liveness/readiness (FR-027)
- Kubernetes/Helm as optional for CI/CD pipelines

**Service Composition**:

| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| emqx | emqx/emqx:5.x | 1883, 8883, 8083, 8084, 18083 | MQTT broker |
| influxdb | influxdb:2.x | 8086 | Message history |
| grafana | grafana/grafana:latest | 3000 | Dashboards |
| prometheus | prom/prometheus:latest | 9090 | Metrics collection |

### 7. TLS Certificate Management

**Decision**: Self-signed CA with generation script

**Rationale**:
- Self-signed acceptable for dev/test (per assumptions)
- Script generates CA, server cert, and client certs
- Supports bring-your-own-CA for enterprise testing
- OpenSSL-based, works on all platforms

**Certificate Files**:
```
certs/
├── ca.crt              # Certificate Authority
├── ca.key              # CA private key
├── server.crt          # Broker certificate
├── server.key          # Broker private key
└── clients/
    ├── client1.crt     # Client certificate
    └── client1.key     # Client private key
```

### 8. Testing Strategy

**Decision**: Multi-layer testing approach

**Layers**:
1. **Conformance Tests**: MQTT protocol compliance using Eclipse Paho conformance suite
2. **Integration Tests**: End-to-end with mosquitto_pub/sub CLI tools
3. **Load Tests**: k6 with xk6-mqtt extension for performance validation

**Test Tools**:
- `mosquitto_pub` / `mosquitto_sub` - CLI testing
- `MQTTX` - GUI client for interactive debugging
- `k6 + xk6-mqtt` - Load testing (SC-002, SC-003, SC-004)
- `mqtt-stresser` - Alternative stress testing

## Unresolved Items

None. All technical decisions resolved.

## References

- [EMQX Documentation](https://docs.emqx.com/en/emqx/latest/)
- [EMQX Rules Engine](https://docs.emqx.com/en/emqx/latest/data-integration/rules.html)
- [InfluxDB 2.x Documentation](https://docs.influxdata.com/influxdb/v2/)
- [MQTT 5.0 Specification](https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html)
- [k6 MQTT Extension](https://github.com/pmalhaire/xk6-mqtt)

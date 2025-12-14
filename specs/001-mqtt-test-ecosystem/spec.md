# Feature Specification: Containerized MQTT Test Ecosystem

**Feature Branch**: `001-mqtt-test-ecosystem`
**Created**: 2025-12-14
**Status**: Draft
**Input**: Technical Requirements Document v1.0 — December 2024

## Clarifications

### Session 2025-12-14

- Q: When a second client connects with the same Client ID, what should the default behavior be? → A: Disconnect previous client, accept new connection (takeover)
- Q: What should be the default maximum message payload size? → A: 256KB (MQTT spec suggestion, AWS IoT Core default)
- Q: What should be the default message history retention period? → A: 24 hours (default), configurable via environment variable and GUI settings (options: 12h, 24h, 48h, 7d)
- Q: When external storage is unavailable, how should the system behave? → A: Graceful degradation (continue MQTT operations, skip storage writes, log warnings)
- Q: What should be the default connection rate limiting behavior? → A: 100 connections/sec per IP with backoff queuing (configurable via environment variable and GUI)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic MQTT Messaging (Priority: P1)

As an IoT developer, I need to quickly spin up an MQTT broker that supports both MQTT 3.1.1 and 5.0 protocols so that I can test device communication without cloud dependencies.

**Why this priority**: This is the foundational capability. Without a working MQTT broker, no other features are possible. Every IoT device testing scenario requires basic publish/subscribe functionality.

**Independent Test**: Can be fully tested by starting the ecosystem with a single command and successfully connecting an MQTT client to publish and receive messages across all QoS levels.

**Acceptance Scenarios**:

1. **Given** the ecosystem is not running, **When** developer runs the startup command, **Then** the MQTT broker is accessible within 10 seconds on standard ports (1883, 8883, 8083, 8084)
2. **Given** a connected MQTT client, **When** it publishes a message with QoS 0, **Then** subscribers receive the message with best-effort delivery
3. **Given** a connected MQTT client, **When** it publishes a message with QoS 1, **Then** the broker acknowledges receipt and guarantees delivery to subscribers
4. **Given** a connected MQTT client, **When** it publishes a message with QoS 2, **Then** the broker performs the complete 4-way handshake ensuring exactly-once delivery
5. **Given** a client with Clean Session=false disconnects, **When** it reconnects, **Then** its subscriptions are restored and queued messages are delivered
6. **Given** an MQTT 5.0 client, **When** it uses shared subscriptions, **Then** messages are distributed among group members
7. **Given** a publisher sets a retained message, **When** a new subscriber joins, **Then** it immediately receives the retained message

---

### User Story 2 - Secure Connections (Priority: P2)

As a security-conscious developer, I need to test my devices with encrypted connections and proper authentication so that I can validate my security implementation before deploying to production.

**Why this priority**: Security is critical for IoT deployments. Testing authentication and encryption flows is essential before production, but basic messaging must work first.

**Independent Test**: Can be fully tested by connecting clients with TLS certificates and verifying authentication rejects invalid credentials.

**Acceptance Scenarios**:

1. **Given** the broker is configured with TLS, **When** a client connects on port 8883, **Then** the connection is encrypted with TLS 1.2 or higher
2. **Given** a user database is configured, **When** a client provides valid credentials, **Then** the connection is accepted
3. **Given** a user database is configured, **When** a client provides invalid credentials, **Then** the connection is rejected with appropriate error
4. **Given** mutual TLS is configured, **When** a client presents a valid certificate, **Then** the client is authenticated
5. **Given** topic ACLs are configured, **When** a client attempts to publish to a restricted topic, **Then** the publish is denied
6. **Given** topic ACLs are configured, **When** a client attempts to subscribe to an allowed topic, **Then** the subscription succeeds

---

### User Story 3 - Observability and Debugging (Priority: P3)

As a developer debugging IoT issues, I need visibility into broker operations, connection states, and message flows so that I can diagnose problems quickly during development.

**Why this priority**: Observability enables efficient debugging and performance tuning. It builds on the messaging foundation and enhances the development experience.

**Independent Test**: Can be fully tested by generating message traffic and verifying metrics appear in dashboards and logs contain expected events.

**Acceptance Scenarios**:

1. **Given** the ecosystem is running, **When** I access the metrics endpoint, **Then** I see connection counts, message rates, and subscription statistics
2. **Given** clients are connecting and disconnecting, **When** I view the logs, **Then** I see structured entries for each connection lifecycle event
3. **Given** message traffic is flowing, **When** I enable trace mode for a topic, **Then** I see detailed packet-level information
4. **Given** the monitoring dashboard is open, **When** message throughput changes, **Then** the graphs update within 15 seconds
5. **Given** a health check endpoint exists, **When** I query liveness and readiness probes, **Then** I receive accurate status responses

---

### User Story 4 - Message Persistence and Replay (Priority: P4)

As a test engineer, I need to capture message history and replay specific scenarios so that I can reproduce issues and validate device behavior under specific conditions.

**Why this priority**: Replay capability significantly accelerates debugging and enables regression testing, but requires core messaging and observability first.

**Independent Test**: Can be fully tested by publishing messages, querying history, and replaying them to verify identical behavior.

**Acceptance Scenarios**:

1. **Given** message history is enabled for a topic, **When** messages are published, **Then** they are stored with timestamps and metadata
2. **Given** historical messages exist, **When** I query the history API with a time range, **Then** I receive matching messages in order
3. **Given** historical messages exist, **When** I trigger a replay, **Then** messages are republished in sequence
4. **Given** a message cannot be delivered, **When** retries are exhausted, **Then** it moves to a dead-letter queue for inspection
5. **Given** messages have expiry intervals set, **When** the TTL expires, **Then** the messages are automatically removed

---

### User Story 5 - Device State Management (Priority: P5)

As an IoT solution developer, I need device shadow/twin functionality so that I can test state synchronization patterns between cloud backends and devices.

**Why this priority**: Device twins are an advanced feature that simulates cloud IoT platform capabilities. This requires all foundational features to be working.

**Independent Test**: Can be fully tested by updating desired state and verifying device receives delta, then device reports state and backend sees update.

**Acceptance Scenarios**:

1. **Given** a device is registered, **When** the backend updates desired state, **Then** the device receives a delta notification
2. **Given** a device is connected, **When** it reports its current state, **Then** the twin's reported section is updated
3. **Given** a twin document exists, **When** I query via the API, **Then** I receive both desired and reported sections with version info
4. **Given** concurrent updates occur, **When** version conflicts arise, **Then** the system handles them with optimistic concurrency
5. **Given** a device is offline, **When** desired state changes, **Then** the delta is delivered when the device reconnects

---

### User Story 6 - Integration and Rules (Priority: P6)

As a backend developer, I need to route messages to external systems and transform data so that I can test end-to-end IoT data pipelines.

**Why this priority**: Rules engine integration enables testing complete IoT architectures but depends on all other features functioning correctly.

**Independent Test**: Can be fully tested by configuring a rule to forward messages to a webhook and verifying the webhook receives transformed data.

**Acceptance Scenarios**:

1. **Given** a rule matches a topic pattern, **When** a matching message arrives, **Then** the configured action executes
2. **Given** a webhook action is configured, **When** triggered, **Then** the HTTP request is sent with message payload
3. **Given** a republish action is configured, **When** triggered, **Then** the message appears on the target topic with transformations applied
4. **Given** a database write action is configured, **When** triggered, **Then** the message data is persisted to the external database
5. **Given** a rule with a filter condition, **When** messages arrive, **Then** only matching messages trigger actions

---

### Edge Cases

- What happens when the broker receives 10,000+ simultaneous connection attempts? → Rate limited at 100/sec per IP, excess queued with backoff
- How does the system handle a client that connects with a duplicate Client ID? → Default: takeover (disconnect previous, accept new)
- What happens when message payload exceeds configured maximum size? → Reject with error (default limit: 256KB)
- How does session recovery work when the broker restarts unexpectedly?
- What happens when a shared subscription group has no active members?
- How does the system behave when external storage (time-series database) is unavailable? → Graceful degradation (continue MQTT, skip writes, log warnings)
- What happens when ACL rules are updated while clients are connected?

## Requirements *(mandatory)*

### Functional Requirements

**Protocol Support**

- **FR-001**: System MUST implement complete MQTT 3.1.1 protocol specification
- **FR-002**: System MUST implement MQTT 5.0 protocol features including shared subscriptions, message expiry, session expiry, topic aliases, user properties, and reason codes
- **FR-003**: System MUST support QoS 0 (at most once), QoS 1 (at least once), and QoS 2 (exactly once) delivery guarantees
- **FR-004**: System MUST support retained messages that persist across broker restarts
- **FR-005**: System MUST support Last Will and Testament (LWT) messages
- **FR-006**: System MUST support topic wildcards: single-level (+) and multi-level (#)

**Transport and Connectivity**

- **FR-007**: System MUST support MQTT over TCP on configurable port (default 1883)
- **FR-008**: System MUST support MQTT over TLS on configurable port (default 8883)
- **FR-009**: System MUST support MQTT over WebSocket on configurable port (default 8083)
- **FR-010**: System MUST support MQTT over secure WebSocket on configurable port (default 8084)
- **FR-011**: System MUST provide an HTTP endpoint for message publishing (default port 8080)
- **FR-012**: System MUST support minimum 10,000 concurrent client connections
- **FR-013**: System MUST detect client disconnection via keep-alive timeout
- **FR-014**: System MUST handle duplicate Client ID connections with configurable policy (default: disconnect previous client, accept new connection)
- **FR-014a**: System MUST enforce configurable maximum message payload size (default: 256KB) and reject oversized messages with appropriate error
- **FR-014b**: System MUST enforce connection rate limiting per IP (default: 100 connections/sec, excess queued with backoff; configurable via environment variable and GUI)

**Session Management**

- **FR-015**: System MUST persist session state across broker restarts for non-clean sessions
- **FR-016**: System MUST restore subscriptions when clients with persistent sessions reconnect
- **FR-017**: System MUST queue QoS 1 and QoS 2 messages for offline clients with persistent sessions
- **FR-018**: System MUST support configurable session expiry intervals (0 to 7 days)

**Security**

- **FR-019**: System MUST support username/password authentication
- **FR-020**: System MUST support X.509 client certificate authentication (mutual TLS)
- **FR-021**: System MUST support topic-level access control lists (publish/subscribe permissions)
- **FR-022**: System MUST enforce TLS 1.2 as minimum version, with TLS 1.3 preferred
- **FR-023**: System MUST provide scripts for self-signed certificate generation
- **FR-024**: System MUST support hot-reloading of ACL configuration without restart

**Observability**

- **FR-025**: System MUST expose metrics in a standard format (connection counts, message rates, subscription counts)
- **FR-026**: System MUST produce structured logs for all connection lifecycle events
- **FR-027**: System MUST provide health check endpoints for liveness and readiness probes
- **FR-028**: System MUST support debug mode with packet-level message tracing for selected topics
- **FR-029**: System MUST support distributed tracing with correlation ID propagation

**Message Persistence**

- **FR-030**: System MUST store message history for configured topics with configurable retention (default: 24 hours; options: 12h, 24h, 48h, 7d; configurable via environment variable and GUI settings)
- **FR-031**: System MUST provide an API to query historical messages by time range
- **FR-032**: System MUST support replaying historical messages to topics
- **FR-033**: System MUST provide a dead-letter queue for undeliverable messages
- **FR-034**: System MUST enforce message TTL based on Message Expiry Interval

**Device Management**

- **FR-035**: System MUST implement device shadow/twin functionality with desired and reported state sections
- **FR-036**: System MUST notify devices of desired state changes via delta topics
- **FR-037**: System MUST track device connection status (online/offline, last seen)
- **FR-038**: System MUST provide an API for device registry operations (create, read, update, delete)
- **FR-039**: System MUST support direct method invocation with request/response pattern

**Integration**

- **FR-040**: System MUST support rules that match topic patterns and trigger actions
- **FR-041**: System MUST support webhook actions with configurable retry policy
- **FR-042**: System MUST support message transformation and republishing to different topics
- **FR-043**: System MUST support writing messages to external time-series storage
- **FR-043a**: System MUST gracefully degrade when external storage is unavailable (continue MQTT operations, skip storage writes, log warnings)

**Deployment**

- **FR-044**: System MUST deploy with a single command using container orchestration
- **FR-045**: System MUST support configuration via environment variables
- **FR-046**: System MUST support configuration files for complex setups
- **FR-047**: System MUST validate configuration on startup with clear error messages
- **FR-048**: System MUST support graceful shutdown with configurable drain period

### Key Entities

- **Client**: Represents an MQTT client connection with identity, session state, subscriptions, and credentials
- **Session**: Persistent client state including subscriptions and queued messages, survives disconnection
- **Topic**: Hierarchical message destination using `/` delimiter, supports wildcard patterns
- **Subscription**: Association between a client and topic pattern with QoS level
- **Message**: Unit of data with topic, payload, QoS, retain flag, and optional properties (expiry, user properties)
- **Device Twin**: Synchronized state document with desired (backend-set) and reported (device-set) sections
- **Rule**: Conditional action triggered by messages matching topic patterns
- **ACL Entry**: Access control rule specifying client/group permissions for topic patterns

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developer can start the complete ecosystem and connect a client within 60 seconds of first use
- **SC-002**: System supports 10,000 concurrent client connections without degradation
- **SC-003**: QoS 0 message throughput reaches 100,000 messages per second
- **SC-004**: QoS 1 message throughput reaches 50,000 messages per second
- **SC-005**: End-to-end message latency is under 50ms at the 99th percentile under normal load
- **SC-006**: New client connections complete within 100ms including TLS handshake
- **SC-007**: All MQTT 5.0 features (shared subscriptions, message expiry, topic aliases) pass conformance tests
- **SC-008**: Device shadow state synchronization completes within 500ms of update
- **SC-009**: Message replay accurately reproduces original message sequence with correct timestamps
- **SC-010**: Rules engine processes 10,000 rule evaluations per second without backpressure
- **SC-011**: System starts accepting connections within 10 seconds of startup command
- **SC-012**: Graceful shutdown completes client notification within configured drain period

## Assumptions

- Target environment is local development or CI/CD pipelines, not production workloads
- Users have container runtime available (container orchestration tools installed)
- Self-signed certificates are acceptable for development/testing purposes
- Single-node deployment is sufficient; clustering is optional for advanced scenarios
- Message history retention defaults to 24 hours, with user-configurable options up to 7 days
- External integrations (webhooks, databases) are available when rules are configured

# Data Model: Containerized MQTT Test Ecosystem

**Date**: 2025-12-14
**Feature**: 001-mqtt-test-ecosystem

## Entity Overview

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Client    │──────│   Session   │──────│Subscription │
└─────────────┘      └─────────────┘      └─────────────┘
       │                    │                    │
       │                    │                    ▼
       ▼                    │              ┌─────────────┐
┌─────────────┐             │              │    Topic    │
│  Credential │             │              └─────────────┘
└─────────────┘             │                    │
       │                    ▼                    ▼
       │              ┌─────────────┐      ┌─────────────┐
       │              │   Message   │──────│  Message    │
       │              │   Queue     │      │  (stored)   │
       │              └─────────────┘      └─────────────┘
       ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  ACL Entry  │      │ Device Twin │      │    Rule     │
└─────────────┘      └─────────────┘      └─────────────┘
```

## Entities

### Client

Represents an MQTT client connection.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| client_id | string | required, unique, max 256 chars | MQTT Client Identifier |
| username | string | optional, max 256 chars | Authentication username |
| connected | boolean | required | Current connection state |
| connected_at | timestamp | nullable | Last connection time |
| disconnected_at | timestamp | nullable | Last disconnection time |
| ip_address | string | required when connected | Client IP address |
| port | integer | required when connected | Client source port |
| protocol | enum | MQTT_3_1_1, MQTT_5_0 | Protocol version |
| transport | enum | TCP, TLS, WS, WSS | Transport layer |
| keepalive | integer | 0-65535, default 60 | Keep-alive interval (seconds) |
| clean_session | boolean | required | Clean session flag |

**State Transitions**:
```
[Disconnected] ──CONNECT──▶ [Connected]
[Connected] ──DISCONNECT──▶ [Disconnected]
[Connected] ──TIMEOUT──▶ [Disconnected]
[Connected] ──TAKEOVER──▶ [Disconnected] (duplicate Client ID)
```

### Session

Persistent client state that survives disconnection.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| client_id | string | required, FK to Client | Session owner |
| created_at | timestamp | required | Session creation time |
| expires_at | timestamp | nullable | Session expiry time (MQTT 5.0) |
| subscriptions | Subscription[] | 0..* | Active subscriptions |
| queued_messages | Message[] | 0..* | QoS 1/2 messages awaiting delivery |
| inflight_messages | Message[] | 0..* | Messages awaiting acknowledgment |

**Lifecycle**:
- Created on first CONNECT with clean_session=false
- Preserved across disconnections until expires_at
- Destroyed on CONNECT with clean_session=true or expiry

### Subscription

Association between a session and a topic pattern.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | required, unique | Subscription identifier |
| session_id | string | required, FK to Session | Owning session |
| topic_filter | string | required, max 65535 chars | Topic pattern (may include wildcards) |
| qos | integer | 0, 1, or 2 | Maximum QoS level |
| no_local | boolean | default false | MQTT 5.0: Don't receive own messages |
| retain_as_published | boolean | default false | MQTT 5.0: Preserve retain flag |
| retain_handling | integer | 0, 1, or 2 | MQTT 5.0: Retained message behavior |
| subscription_id | integer | optional | MQTT 5.0: Client-assigned ID |

### Topic

Hierarchical message destination.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| name | string | required, max 65535 chars | Full topic path |
| retained_message | Message | nullable | Current retained message |
| subscriber_count | integer | 0..* | Active subscription count |

**Validation Rules**:
- Cannot start with `$` (reserved) unless explicitly allowed
- Levels separated by `/`
- Wildcards: `+` (single level), `#` (multi-level, must be last)

### Message

Unit of data published to a topic.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | required, unique | Message identifier |
| topic | string | required | Destination topic |
| payload | bytes | max 256KB (configurable) | Message content |
| qos | integer | 0, 1, or 2 | Quality of Service |
| retain | boolean | default false | Retain flag |
| timestamp | timestamp | required | Publish time |
| expiry_interval | integer | optional, seconds | MQTT 5.0: Message TTL |
| content_type | string | optional | MQTT 5.0: Payload format |
| response_topic | string | optional | MQTT 5.0: Request/response |
| correlation_data | bytes | optional | MQTT 5.0: Request correlation |
| user_properties | map<string,string> | optional | MQTT 5.0: Custom metadata |
| publisher_client_id | string | required | Source client |

**Storage** (InfluxDB):
```
measurement: mqtt_messages
tags:
  - topic
  - qos
  - client_id
fields:
  - payload (string, base64 encoded)
  - retain (boolean)
  - content_type (string)
  - correlation_id (string)
timestamp: publish time
```

### Device Twin

Synchronized state document for IoT devices.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| device_id | string | required, unique | Device identifier |
| desired | json | max 8KB | Backend-set target state |
| reported | json | max 8KB | Device-reported current state |
| metadata | json | auto-generated | Timestamps per field |
| version | integer | auto-increment | Optimistic concurrency control |
| last_updated | timestamp | required | Last modification time |
| connection_status | enum | ONLINE, OFFLINE | Current connection state |
| last_seen | timestamp | nullable | Last activity time |

**State Document Structure**:
```json
{
  "device_id": "sensor-001",
  "desired": {
    "reportingInterval": 30,
    "firmwareVersion": "2.1.0"
  },
  "reported": {
    "reportingInterval": 60,
    "firmwareVersion": "2.0.5",
    "batteryLevel": 87
  },
  "metadata": {
    "desired": {
      "reportingInterval": { "timestamp": "2025-12-14T10:30:00Z" }
    },
    "reported": {
      "batteryLevel": { "timestamp": "2025-12-14T10:35:00Z" }
    }
  },
  "version": 42
}
```

### Rule

Conditional action triggered by message patterns.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | string | required, unique | Rule identifier |
| name | string | required, max 256 chars | Human-readable name |
| enabled | boolean | default true | Rule active state |
| topic_filter | string | required | Topic pattern to match |
| condition | string | optional | SQL-like filter expression |
| actions | Action[] | 1..* | Actions to execute |
| created_at | timestamp | required | Creation time |

**Action Types**:

| Type | Configuration | Description |
|------|---------------|-------------|
| webhook | url, method, headers, retry_policy | HTTP request |
| republish | topic, payload_template, qos | Publish to different topic |
| influxdb | bucket, measurement, tags, fields | Write to time-series |
| console | format | Log to stdout (debugging) |

### ACL Entry

Access control rule for topic operations.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | required, unique | Entry identifier |
| principal_type | enum | USER, CLIENT, GROUP | What the rule applies to |
| principal | string | required | Username, client ID, or group name |
| topic_pattern | string | required | Topic pattern with variables |
| permission | enum | ALLOW, DENY | Access decision |
| action | enum | PUBLISH, SUBSCRIBE, ALL | Operation type |
| priority | integer | default 0 | Rule precedence (higher wins) |

**Pattern Variables**:
- `%u` - Current username
- `%c` - Current client ID
- `${clientid}` - Same as `%c`
- `${username}` - Same as `%u`

**Example ACL Rules**:
```
# Allow clients to publish to their own topics
allow publish devices/%c/#

# Allow all to subscribe to public topics
allow subscribe public/#

# Deny access to system topics
deny all $SYS/#
```

### Credential

Authentication credential for clients.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| username | string | required, unique | Login username |
| password_hash | string | required | Bcrypt/PBKDF2 hash |
| is_superuser | boolean | default false | Bypass ACL checks |
| created_at | timestamp | required | Creation time |
| expires_at | timestamp | nullable | Credential expiry |

## Relationships

| Relationship | Cardinality | Description |
|--------------|-------------|-------------|
| Client → Session | 1:0..1 | Client may have persistent session |
| Session → Subscription | 1:* | Session owns subscriptions |
| Subscription → Topic | *:1 | Subscriptions target topics |
| Topic → Message | 1:0..1 | Topic may have retained message |
| Session → Message (queue) | 1:* | Offline message queue |
| Rule → Action | 1:* | Rule triggers actions |
| Credential → ACL Entry | 1:* | User has ACL rules |

## Storage Mapping

| Entity | Storage | Rationale |
|--------|---------|-----------|
| Client | EMQX internal | Managed by broker |
| Session | EMQX internal + RocksDB | Built-in persistence |
| Subscription | EMQX internal | Managed by broker |
| Message (history) | InfluxDB | Time-series queries, retention |
| Device Twin | InfluxDB | Versioned state, history |
| Rule | EMQX rules engine | Native integration |
| ACL Entry | File (acl.conf) | Hot-reloadable |
| Credential | File (users.json) | Simple for dev/test |

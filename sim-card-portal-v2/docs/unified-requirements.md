# Ioto FMP — Unified Requirements Document

| Field | Value |
|-------|-------|
| **Document** | `unified-requirements.md` |
| **Version** | v1.0 — January 2026 |
| **Product** | Ioto Fleet Management Platform (FMP) |
| **Repository** | `ioto-fmp` (GitHub) |
| **Status** | Approved for Development |
| **Supersedes** | `Alpal Bianca Requirements 21012026.md`, `Alpal Bianca code Requirements 21012026.md`, `ioto-cmp-requirements.md` |
| **Source Documents** | Alpal/Bianca meeting transcript analysis (Jan 2026), Alpal development task specifications, CMP/FMP technical planning meeting transcript |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context & Strategic Observations](#2-business-context--strategic-observations)
3. [Current State Assessment](#3-current-state-assessment)
4. [Platform Architecture](#4-platform-architecture)
5. [State Machine Architecture](#5-state-machine-architecture)
6. [SIM Card Management](#6-sim-card-management)
7. [Device Management](#7-device-management)
8. [Asset Tracking & Customer Dashboard](#8-asset-tracking--customer-dashboard)
9. [Geozone & Geofencing](#9-geozone--geofencing)
10. [Alert & Notification System](#10-alert--notification-system)
11. [Natural Language Query — Ask Bob Dashboard](#11-natural-language-query--ask-bob-dashboard)
12. [AI Support Assistant — Bob Support](#12-ai-support-assistant--bob-support)
13. [Bulk Operations](#13-bulk-operations)
14. [API Design](#14-api-design)
15. [Analytics & Reporting](#15-analytics--reporting)
16. [Support & Documentation](#16-support--documentation)
17. [Simulation & Demo Tools](#17-simulation--demo-tools)
18. [Device Compatibility](#18-device-compatibility)
19. [Data Models](#19-data-models)
20. [Design System & UI Principles](#20-design-system--ui-principles)
21. [Security Requirements & Remediation](#21-security-requirements--remediation)
22. [Compliance](#22-compliance)
23. [Non-Functional Requirements](#23-non-functional-requirements)
24. [Implementation Roadmap](#24-implementation-roadmap)
25. [Risks & Mitigations](#25-risks--mitigations)
26. [Open Questions](#26-open-questions)
27. [Action Items](#27-action-items)
28. [Glossary](#28-glossary)

---

## 1. Executive Summary

Ioto Communications is building the **Fleet Management Platform (FMP)** — a unified, multi-tenant platform that combines Connectivity Management (CMP) and Device/Asset Management into a single product. The first tenant is **Alpal**, an IoT-based packaging asset tracking company that needs a two-tier view system: an internal device management dashboard for Alpal operations, and a simplified asset tracking dashboard for end customers.

### Platform Model

Ioto builds and operates the FMP. Alpal is the first tenant. The platform follows a **galvanic separation** model — each tenant gets a dedicated instance for complete data isolation.

### Key Strategic Decisions

- **Authentication**: Keycloak mandatory, SSO required in Phase 1
- **Tech stack**: Kafka for event streaming, Clickhouse for analytics/time-series data, PostgreSQL for relational data
- **Frontend**: Single unified Vue 3 app (merge all existing frontends), Pinia for state management
- **Backend**: Single consolidated TypeScript API
- **Maps**: Leaflet/OpenStreetMap (replace Google Maps)
- **Mobile**: Responsive web only (no native apps)
- **Billing**: Export only — no invoicing, no rate cards in platform
- **AI**: Two separate AI features — Ask Bob Dashboard (NLQ) + Bob Support Chat
- **Development**: Docker Desktop local dev, GitHub repo `ioto-fmp`, deploy to UpCloud when stable

### Scope

| Phase | Scope |
|-------|-------|
| **Phase 1** | Platform architecture, SIM/Device/Asset management, geofencing, alerts, NLQ, bulk operations, API, analytics, support, security remediation |
| **Phase 2** | Trip planning, temperature/humidity monitoring, BLE beacon sensors, predictive maintenance, revenue optimization |

---

## 2. Business Context & Strategic Observations

### 2.1 Alpal Business Model

- Provides **reusable packaging assets** (pallets, crates) to enterprise customers
- Needs to track packaging asset location and lifecycle across supply chain
- Must report on **recycled content** and **trip counts** (regulatory requirement)
- Challenge: Justifying IoT cost on lower-value packaging assets
- Customers include large enterprises (e.g., Nestle, IKEA)

### 2.2 Current Status

| Aspect | Status |
|--------|--------|
| **Hardware** | Two devices shortlisted, undergoing battery life testing |
| **Connectivity** | Using Onomondo for SIM card management and testing |
| **Platform** | Strategic decision resolved — Ioto FMP as hybrid PaaS/SaaS |
| **Customers** | Waiting for trial deployment |

### 2.3 Strategic Observations

1. **Industry-Specific Complexity**: Logistics/packaging tracking has unique requirements that generic IoT platforms don't address. Ioto's consultancy offering is a key differentiator.

2. **Customer Communication Gap**: Alpal colleagues don't fully understand the complexity of the work. Documentation and visible progress milestones are needed.

3. **Value Proposition Challenge**: Product tracking (temperature, humidity) in Phase 2 may be necessary to justify IoT investment economics — Phase 1 asset location alone may not suffice.

4. **Platform Positioning**: Ioto occupies a valuable middle ground — not pure PaaS (which requires the tenant to build everything) and not pure SaaS (industry-specific and bundled). The hybrid consultancy + platform model addresses Alpal's core dilemma.

5. **Face-to-Face Value**: The Copenhagen in-person session was described as invaluable. Future Netherlands meeting should be prioritized for deeper requirements definition.

### 2.4 Two-Tier User Model

| Aspect | Alpal Internal View | Customer View |
|--------|---------------------|---------------|
| **Primary Purpose** | Device & SIM management | Asset tracking only |
| **Device Info** | Full visibility (battery, IMEI, signal) | Hidden — no device data shown |
| **SIM/Network Data** | Carrier, ICCID, network logs, usage | Hidden completely |
| **Asset Location** | Full map with device attribution | Asset locations on map |
| **Geozones** | Device management zones | Asset movement notifications |

---

## 3. Current State Assessment

### 3.1 What Exists Today

The existing codebase in `pve1/sim-card-portal-v2` contains significant work that will inform the new `ioto-fmp` platform:

| Layer | Technology | Components |
|-------|-----------|------------|
| **Frontend** | Vue 3.5 + TypeScript + PrimeVue 4.3 | 28 components: Login, Dashboard, Device List/Detail, SIM Management, Consumption Analytics, User Settings, Ask Bob (Claude LLM), WebSocket real-time, Google Maps + Leaflet maps, Session caching, Chart.js charts, Excel export |
| **Backend** | Express 5 TypeScript API (api/v1/) | Full SIM provisioning (CRUD + state transitions), Usage/mediation tracking, Webhook system, API client management, Rate limiting, Audit logging, RBAC permissions |
| **Database** | PostgreSQL (Supabase) | 24 migrations |
| **Infrastructure** | EMQX MQTT, InfluxDB, Prometheus, Grafana, Docker Compose | MQTT bridge (WebSocket relay), Data generator/simulator, UpCloud production deployment with Traefik HTTPS |
| **Separate Apps** | MQTT Control Panel (Vue 3.4), Dashboard project, SIM Portal | Multiple frontends that must be merged |

### 3.2 Critical Code Issues — Remediation Required

The following issues **must** be resolved in the new `ioto-fmp` platform:

| # | Issue | Severity | Remediation |
|---|-------|----------|-------------|
| 1 | **Hardcoded auth credentials** (admin/1234567, FMP/fmp123) | Critical | Migrate to Keycloak — see §4.3 |
| 2 | **Exposed API keys in .env** (Anthropic key committed to repo) | Critical | Use secrets manager, never commit keys, add to `.gitignore` |
| 3 | **Base64-only encryption** for sensitive SIM data (PIN/PUK/KI/OPC) | Critical | Implement AES-256-GCM encryption at rest |
| 4 | **Missing timing-safe comparison** in auth middleware | High | Use `crypto.timingSafeEqual()` for all credential comparisons |
| 5 | **Placeholder webhook signatures** | High | Implement HMAC-SHA256 webhook signatures |
| 6 | **No centralized state management** | High | Mandate Pinia from day one — see §4.6 |
| 7 | **Silent mock data fallback** masking API errors | High | Remove mock fallback in production — real data only |
| 8 | **No automated migration runner** | Medium | Mandate automated migration runner in CI/CD |
| 9 | **Two map libraries** (Google Maps + Leaflet) | Medium | Standardize on Leaflet/OpenStreetMap — see §20 |
| 10 | **Multiple separate frontend apps** | Medium | Merge all into single FMP app — see §4.5 |

### 3.3 Migration Path

The new `ioto-fmp` repository starts fresh. Relevant code from `pve1` will be migrated module-by-module:

1. **Migrate**: SIM provisioning logic, API patterns, database schemas, component library
2. **Replace**: Auth system (→ Keycloak), InfluxDB (→ Clickhouse), Google Maps (→ Leaflet), Express 5 patterns
3. **Consolidate**: All frontends into single Vue 3 app with Pinia state management
4. **Drop**: Mock data fallbacks, hardcoded credentials, exposed keys

---

## 4. Platform Architecture

### 4.1 Multi-Tenancy — Galvanic Separation

**Decision**: Dedicated instances per tenant (galvanic separation), not shared-database multi-tenancy.

Each tenant receives:
- Dedicated PostgreSQL database
- Dedicated Clickhouse instance (or schema)
- Dedicated Kafka topic namespace
- Dedicated Keycloak realm
- Isolated API context

**FR-101**: System shall support multi-tenant architecture with complete customer data isolation.

**Acceptance Criteria**:
- [ ] Each tenant has a unique tenant identifier
- [ ] All database queries are scoped by tenant context
- [ ] API endpoints validate tenant context before returning data
- [ ] Natural language queries (Ask Bob) are restricted to tenant-specific data
- [ ] Admin users cannot accidentally expose cross-tenant data
- [ ] Audit logs track all data access by tenant
- [ ] Performance testing confirms no data leakage under load

### 4.2 Tenant Hierarchy

```
Tenant (e.g., Alpal)
  └── Customer (e.g., Nestle, IKEA, Breslin)
       └── Project (e.g., "Nestle - Q1 Pilot", "Nestle - Europe Rollout")
```

Three levels: **Tenant → Customer → Project**

**FR-104**: System shall support grouping of devices and assets by customer/project.

**Acceptance Criteria**:
- [ ] Customers can be created, edited, and archived
- [ ] Projects can be created under customers
- [ ] Devices can be assigned to exactly one customer/project
- [ ] SIM cards can be assigned to exactly one customer/project
- [ ] Assets inherit grouping from associated device
- [ ] Filter dropdowns appear on all relevant list views
- [ ] Bulk assignment of devices to groups is supported
- [ ] Group membership is visible in device/SIM detail views

### 4.3 Authentication — Keycloak

**Decision**: Keycloak is mandatory. SSO is required in Phase 1.

**Migration from hardcoded credentials**:
1. Deploy Keycloak instance in Docker Compose stack
2. Create realms per tenant
3. Migrate users from hardcoded credentials to Keycloak user store
4. Implement OAuth 2.0 / OIDC flows in frontend and API
5. Remove all hardcoded passwords from codebase
6. Implement token refresh and session management

**FR-103**: System shall support separate login modes for internal users and external users.

**Acceptance Criteria**:
- [ ] Login page shows mode selection when user has multiple roles
- [ ] Single-role users are redirected directly to their dashboard
- [ ] Session maintains current mode throughout navigation
- [ ] Mode switching available for Combined users without re-authentication
- [ ] Failed login attempts are rate-limited (max 5 per 15 minutes)
- [ ] Password reset flow works for all user types
- [ ] SSO integration supported for enterprise customers

### 4.4 RBAC — Module-Based Roles

**Decision**: Redesign roles around modules.

| Role | Scope | Access |
|------|-------|--------|
| **Super Admin** | Platform | All modules, all tenants, system configuration |
| **Tenant Admin** | Tenant | All modules within tenant, user management |
| **CMP User** | Tenant | SIM management, connectivity, sessions |
| **DMP User** | Tenant | Device management, telemetry, maps |
| **FMP User** | Tenant | Full CMP + DMP + Asset management |
| **Customer User** | Customer | Asset tracking only — no device/SIM data |
| **Viewer** | Configurable | Read-only access to assigned segments |

**FR-102**: System shall implement role-based access control with configurable roles.

**Acceptance Criteria**:
- [ ] Default roles available per the table above
- [ ] Roles can be assigned to individual user accounts
- [ ] Permission checks occur on every API call and UI render
- [ ] Unauthorized access attempts are logged and blocked
- [ ] Role changes take effect immediately
- [ ] Custom roles can be created with granular permissions
- [ ] Role hierarchy supports inheritance

### 4.5 Customer Visibility Configuration

**Decision**: Configurable per tenant — the tenant admin controls what customers can see.

**FR-105**: System shall enforce data filtering to prevent customers from viewing device-level information.

**FR-106**: Customer view shall never display: battery level, IMEI, signal strength, SIM data, network logs, device manufacturer, firmware version, data consumption, roaming status, carrier name, session history.

**Acceptance Criteria**:
- [ ] Customer API responses contain zero device-level fields
- [ ] Customer exports (CSV, PDF, Excel) contain no device data
- [ ] Natural language queries cannot retrieve device information for customers
- [ ] UI components for device data are not rendered (not just hidden)
- [ ] Filter is applied server-side, not client-side
- [ ] Error messages do not reveal filtered field names
- [ ] Terminology uses "asset" not "device" in customer views

### 4.6 State Management — Pinia

**Decision**: Mandate Pinia from day one in the new FMP app.

All shared state must flow through Pinia stores:
- Auth store (user, tokens, role, mode)
- Filter store (global filters, active query)
- Notification store (alerts, toasts)
- Module stores (SIM, Device, Asset, etc.)

### 4.7 Data Pipeline — MQTT → Kafka → Clickhouse

**Decision**: Kafka is the event backbone. MQTT feeds into Kafka, not directly into the frontend.

```
Device → MQTT (EMQX) → Kafka → Clickhouse (analytics)
                             → PostgreSQL (state)
                             → WebSocket (real-time UI)
```

**Data flow**:
1. **MQTT**: Devices publish telemetry to EMQX broker
2. **Kafka Bridge**: EMQX forwards to Kafka topics
3. **Stream Processors**: Kafka consumers process events
4. **Clickhouse**: Time-series data ingested for analytics
5. **PostgreSQL**: State changes persisted (device status, SIM state)
6. **WebSocket**: Real-time UI updates pushed via Kafka consumer

**Real-time strategy**:
- **Internal users**: Real-time updates via WebSocket
- **Customer users**: Near-real-time (15-30 minute refresh)

### 4.8 Kafka Topic Design

| Topic | Purpose | Partitioning |
|-------|---------|-------------|
| `fmp.telemetry.raw` | Raw device telemetry from MQTT | By device_id |
| `fmp.telemetry.enriched` | Enriched telemetry with device/asset context | By device_id |
| `fmp.sessions.rollup` | Session rollup events from mediation | By ICCID |
| `fmp.state.sim` | SIM state change events | By ICCID |
| `fmp.state.device` | Device state change events | By device_id |
| `fmp.state.asset` | Asset state/status changes | By asset_id |
| `fmp.geozone.events` | Geozone entry/exit events | By asset_id |
| `fmp.alerts.generated` | New alert events | By tenant_id |
| `fmp.alerts.updates` | Alert status changes | By alert_id |
| `fmp.bulk.progress` | Bulk operation progress updates | By batch_id |
| `fmp.audit.log` | Audit trail events | By tenant_id |
| `fmp.notifications` | User notification events | By user_id |

### 4.9 Clickhouse Schema Patterns

**Replacing Merge Tree** — Live session state (latest rollup):
```sql
CREATE TABLE sessions_live (
    session_id String,
    iccid String,
    event_timestamp DateTime,
    network_name String,
    radio_access_type String,
    ip_address String,
    total_bytes_in UInt64,
    total_bytes_out UInt64,
    request_type Enum8('UPDATE' = 1, 'TERMINATE' = 2),
    cell_id String,
    tenant_id String
) ENGINE = ReplacingMergeTree(event_timestamp)
ORDER BY (tenant_id, iccid, session_id)
TTL event_timestamp + INTERVAL 7 DAY;
```

**Aggregating Tables** — Rollups for analytics:
```sql
-- Daily aggregation
CREATE MATERIALIZED VIEW sessions_daily_mv
TO sessions_daily AS
SELECT
    toDate(event_timestamp) AS day,
    iccid,
    tenant_id,
    sumState(total_bytes_in) AS bytes_in,
    sumState(total_bytes_out) AS bytes_out,
    countState() AS session_count
FROM sessions_live
GROUP BY day, iccid, tenant_id;

-- Monthly aggregation
CREATE MATERIALIZED VIEW sessions_monthly_mv
TO sessions_monthly AS
SELECT
    toStartOfMonth(event_timestamp) AS month,
    iccid,
    tenant_id,
    sumState(total_bytes_in) AS bytes_in,
    sumState(total_bytes_out) AS bytes_out,
    countState() AS session_count
FROM sessions_live
GROUP BY month, iccid, tenant_id;
```

### 4.10 Application Consolidation

**Decision**: Merge all existing frontends into a single FMP app.

| Current App | Disposition |
|-------------|------------|
| SIM Card Portal v2 | → FMP SIM Module |
| MQTT Control Panel | → FMP Device Module |
| Dashboard project | → FMP Dashboard Module |
| Separate API servers | → Single consolidated API |

**Single API**: One Express/TypeScript API server with modular route files:
```
api/v1/sims/       → SIM management
api/v1/devices/     → Device management
api/v1/assets/      → Asset management
api/v1/alerts/      → Alert management
api/v1/geozones/    → Geozone management
api/v1/analytics/   → Analytics endpoints
api/v1/bulk/        → Bulk operations
api/v1/users/       → User management (Keycloak proxy)
api/v1/tenants/     → Tenant configuration
```

---

## 5. State Machine Architecture

### 5.1 SIM Card State Machine

Independent of device state. Simple and predictable.

```
┌──────────┐    activate     ┌──────────┐
│ Inactive │ ──────────────→ │  Active  │
└──────────┘                 └──────────┘
                                │    ↑
                     suspend    │    │  reactivate
                                ↓    │
                             ┌──────────┐
                             │ Suspended│
                             └──────────┘
                                │
                     terminate  │
                                ↓
                          ┌────────────┐
                          │ Terminated │
                          └────────────┘
```

| State | Description |
|-------|-------------|
| **Inactive** | SIM provisioned but not yet activated |
| **Active** | SIM enabled for connectivity |
| **Suspended** | Temporarily disabled (testing, policy, billing) |
| **Terminated** | End of lifecycle — irreversible |

**Design Principles**:
- Keep transitions simple and predictable
- State machine must not break regardless of what is sold (device-only, SIM-only, bundled)
- Avoid mixing operational states (warehouse/field) with commercial states — use labels instead

### 5.2 Device State Machine

Independent of SIM state. Reflects device lifecycle, not connectivity status.

| State | Description |
|-------|-------------|
| **Provisioned** | Device registered but not deployed |
| **Active** | Device deployed and reporting |
| **Warning** | Reporting but needs attention (low battery, weak signal) |
| **Offline** | Not reporting (> 72 hours) |
| **Maintenance** | Manually flagged for service |
| **Decommissioned** | End of lifecycle |

**Key Principle**: Device "active" state is independent of SIM "active" state. A device may still be active via WiFi even if its SIM is suspended.

### 5.3 Coordination Layer (FMP Mode)

When both SIM and device management are sold together (FMP), a **third coordination layer** manages relationships:

- If SIM is offline/inactive, device may still be active (via WiFi or other connectivity)
- Coordination layer handles billing links between device and SIM
- Implemented as "Lego bricks" — modular components that operate independently or together

### 5.4 Labeling System

**Decision**: Flexible labeling/tagging mechanism separate from state machines.

Labels allow customers to categorize SIMs/devices for operational purposes without polluting state machine logic.

**Implementation** (in order of preference):
1. **Customer-defined labels** — Free text fields that customers populate
2. **Predefined dropdowns** — Common labels populated into selection menus
3. **AI-searchable tags** — Enable natural language queries across labels

**Use Cases**:
- Warehouse vs. Field location tracking
- Customer segmentation (e.g., "Bosch", "Customer A")
- Device categories (refurbishing, standby, deployed)

---

## 6. SIM Card Management

### FR-301: SIM Card List with Carrier Identification
**Phase**: 1 | **Priority**: Critical

System shall display SIM card list with carrier identification.

**Required Columns**: ICCID, MSISDN, Carrier/MNO name, Status, Associated device (link), Customer/Project, Data plan, Data used (current period), Last activity timestamp, Labels/Tags.

**Acceptance Criteria**:
- [ ] List displays all SIMs for tenant
- [ ] Sorting available on all columns
- [ ] Search by ICCID, MSISDN, or device ID
- [ ] Filter by carrier, status, customer
- [ ] Pagination for large inventories (25, 50, 100 rows)
- [ ] Bulk actions (suspend, activate, assign)
- [ ] Export to CSV and Excel
- [ ] Click-through to SIM detail view

### FR-302: SIM Identifiers Display
**Phase**: 1 | **Priority**: High

System shall display MSISDN, ICCID, IMSI, IMEI (from associated device), and EID (eSIM) in SIM detail view.

**Acceptance Criteria**:
- [ ] All identifiers visible in SIM detail view
- [ ] Copy-to-clipboard button for each identifier
- [ ] ICCID barcode renders correctly (Code128)
- [ ] Invalid identifier formats are flagged
- [ ] Identifiers are searchable from SIM list

### FR-303: Network Session History
**Phase**: 1 | **Priority**: High

System shall maintain and display network session history logs.

**Session Record Fields**: Session start/end timestamp, Duration, Network/Carrier, Cell ID/Location, APN, IP address, Data uploaded/downloaded, Termination reason.

**Acceptance Criteria**:
- [ ] Session history loads for last 90 days
- [ ] Pagination for 1000+ sessions
- [ ] Filter by date range, carrier, APN
- [ ] Export to CSV
- [ ] Timeline view shows sessions on horizontal axis
- [ ] Aggregate statistics panel (total sessions, avg duration, total data by carrier)
- [ ] Compare to previous period option

### FR-304: Data Consumption Tracking
**Phase**: 1 | **Priority**: High

System shall track and display data consumption per SIM.

**Acceptance Criteria**:
- [ ] Current usage displays on SIM detail page with visual gauge
- [ ] Historical chart shows last 12 months
- [ ] Drill-down from month → day → hour
- [ ] Alert thresholds configurable per SIM or globally (80%, 100%, unusual spike)
- [ ] Export consumption report
- [ ] Fleet-wide consumption dashboard

### FR-305: Roaming Network Visibility
**Phase**: 1 | **Priority**: High

System shall display roaming network information on map/table.

**Acceptance Criteria**:
- [ ] Roaming status visible in SIM list and detail (Home vs. Roaming indicator)
- [ ] Roaming history available for last 90 days
- [ ] Map shows roaming path with carrier colors
- [ ] Filter devices currently roaming
- [ ] Aggregate roaming statistics per carrier
- [ ] Export roaming report

### FR-306: SIM-to-Device Association
**Phase**: 1 | **Priority**: High

System shall display SIM-to-device associations with bidirectional navigation.

**Acceptance Criteria**:
- [ ] SIM detail shows associated device with link
- [ ] Device detail shows associated SIM with link
- [ ] Orphan reports available (SIMs without devices, devices without SIMs)
- [ ] Association changes logged with audit trail
- [ ] Bulk operations support (CSV import)
- [ ] Association validation (one SIM per device)

### FR-307: SIM Grouping by Customer/Project
**Phase**: 1 | **Priority**: Medium

System shall allow grouping of SIMs by customer/project.

**Acceptance Criteria**:
- [ ] Customer/project assignment field on SIM record
- [ ] Auto-inherit from device when associated
- [ ] Filter dropdowns on SIM list
- [ ] Consumption roll-up by customer/project
- [ ] Export grouped reports

### SIM Card Detail Popup (CMP)

Components:
1. **Basic Info**: ICCID, MSISDN, State, Customer assignment
2. **Live Session Box**: Online/Offline indicator, Current network, Current IP, Current byte counters
3. **Session History**: Pre-filtered view of recent sessions for this SIM
4. **Location Update Button**: Trigger network location refresh

---

## 7. Device Management

### FR-201: Device List with Status Indicators
**Phase**: 1 | **Priority**: Critical

System shall display device list with real-time status indicators.

**Required Columns**: Device ID/Name, Customer/Project, Status (color-coded), Battery level (% + icon), Signal strength (bars or dBm), Last seen timestamp, Location.

**Status Definitions**:
| Status | Color | Criteria |
|--------|-------|----------|
| Active | Green | Reported within 24 hours, battery > 20% |
| Warning | Yellow | Reported within 24-72 hours OR battery 10-20% |
| Offline | Red | No report for > 72 hours |
| Maintenance | Orange | Manually flagged for service |

**Acceptance Criteria**:
- [ ] List loads within 2 seconds for up to 10,000 devices
- [ ] Status colors are colorblind-friendly
- [ ] Sorting available on all columns
- [ ] Pagination with configurable page size (25, 50, 100)
- [ ] Quick search/filter by device ID or name
- [ ] Bulk selection for group actions
- [ ] Export to CSV
- [ ] Click-through to device detail view

### FR-202: Device Grouping and Filtering
**Phase**: 1 | **Priority**: High

System shall allow filtering and grouping of devices by customer/project.

**Filter Options**: Customer (multi-select), Project (cascading from customer), Status (checkbox), Battery level (range slider), Signal strength (range), Last seen (date range), Location (geozone or map selection).

**Acceptance Criteria**:
- [ ] All filter options available in collapsible panel
- [ ] Filters can be combined (AND logic)
- [ ] Active filters displayed as removable chips/tags
- [ ] "Clear all filters" resets to default view
- [ ] Filter state persists in URL (shareable links)
- [ ] Grouping shows collapsible sections with counts
- [ ] Filter results update in < 500ms

### FR-203: Signal Strength Monitoring
**Phase**: 1 | **Priority**: High

System shall display signal strength for each device.

**Signal Quality Thresholds**:
| Quality | dBm Range | Bars |
|---------|-----------|------|
| Excellent | > -70 | 5 |
| Good | -70 to -85 | 4 |
| Fair | -85 to -100 | 3 |
| Poor | -100 to -110 | 2 |
| Very Poor | < -110 | 1 |
| No Signal | No data | 0 |

**Acceptance Criteria**:
- [ ] Signal strength visible in device list and detail views
- [ ] Historical chart available (7/30/90 days)
- [ ] Alert threshold configurable (e.g., notify if < -100 dBm for 24h)
- [ ] Signal map overlay available (heatmap)
- [ ] Export signal history

### FR-204: Battery Level Tracking
**Phase**: 1 | **Priority**: High

System shall display battery level percentage for each device.

**Acceptance Criteria**:
- [ ] Battery level visible in device list and detail views
- [ ] Battery icon reflects current level with appropriate color (green > 50%, yellow 20-50%, red < 20%)
- [ ] "Days remaining" estimate displayed when battery < 50%
- [ ] Battery history chart available (30/90/180 days)
- [ ] Low battery devices highlighted in list view
- [ ] Bulk export of battery report for fleet planning
- [ ] Battery alerts integrated with alert management system

### FR-205: Last Report Timestamp
**Phase**: 1 | **Priority**: Medium

System shall display last report timestamp for each device.

**Visual Indicators**:
- Recent (< 1 hour): Normal text
- Stale (1-24 hours): Yellow highlight
- Old (24-72 hours): Orange highlight
- Silent (> 72 hours): Red highlight with warning icon

**Acceptance Criteria**:
- [ ] Last seen timestamp visible in device list
- [ ] Hover shows exact timestamp with timezone
- [ ] Sort by "last seen" supported
- [ ] Filter by "not seen since" date range

### FR-206: Network Attachment/Detachment Logs
**Phase**: 1 | **Priority**: High

System shall maintain and display network event logs for each device.

**Event Types**: ATTACH, DETACH, HANDOVER, ROAMING_START, ROAMING_END, PDP_ACTIVATE, PDP_DEACTIVATE.

**Acceptance Criteria**:
- [ ] Log view available in device detail page
- [ ] Sortable by timestamp (default: newest first)
- [ ] Filter by event type and date range
- [ ] Export to CSV
- [ ] Pagination for 1000+ events
- [ ] Visual timeline view option
- [ ] Aggregate statistics (total attach time, session count)

### FR-207: Device Detail View
**Phase**: 1 | **Priority**: High

System shall provide comprehensive device detail view.

**Panels**: Header (ID, name, status, quick actions), Health (battery, signal, last seen, uptime), Location (map, address, movement trail), Connectivity (SIM link, carrier, roaming, data usage), Telemetry (raw sensor readings), Activity Log (recent events).

**Acceptance Criteria**:
- [ ] All panels load within 3 seconds
- [ ] Data refreshes every 60 seconds (or manual refresh)
- [ ] Each panel is collapsible
- [ ] Deep links work (shareable URLs)
- [ ] Mobile-responsive layout
- [ ] Edit mode for device name and assignment

### FR-208: Device Map View
**Phase**: 1 | **Priority**: High

System shall display devices on interactive map with status-based markers.

**Map Features**: Zoom/pan, status color-coded markers, clustering at 50+ devices, heatmap overlay option, geozone boundaries overlay.

**Acceptance Criteria**:
- [ ] Map loads within 3 seconds for 10,000 devices
- [ ] Clustering activates automatically
- [ ] Filter changes reflect on map immediately
- [ ] Full-screen mode available
- [ ] Export map as PNG
- [ ] Map state persists in session

---

## 8. Asset Tracking & Customer Dashboard

### FR-401: Customer Dashboard Layout
**Phase**: 1 | **Priority**: Critical

System shall provide customer-facing dashboard with zero device-level data visible.

**Shows**: Total asset count, Asset location map, Status summary, Geozone summaries, Alert notifications, Asset list/grid.

**Never Shows**: Device identifiers, battery, signal, SIM data, network logs, carrier info, technical telemetry.

**Acceptance Criteria**:
- [ ] Dashboard loads in < 3 seconds
- [ ] Zero device/SIM fields visible anywhere
- [ ] Responsive design for tablet/mobile
- [ ] Language/locale configurable per user
- [ ] Help/documentation accessible

### FR-402: Asset Count Summary
**Phase**: 1 | **Priority**: Critical

System shall display total asset count summary with breakdown by status.

**Acceptance Criteria**:
- [ ] Total count prominently displayed
- [ ] Breakdown matches geozone configuration (At Facility, In Transit, At Supplier, Unknown)
- [ ] Numbers update in near-real-time
- [ ] Click on category filters map and list
- [ ] Trend arrows show week-over-week change

### FR-403: Asset Location Map with Drill-Down
**Phase**: 1 | **Priority**: Critical

System shall display asset locations on interactive map with drill-down capability.

**Acceptance Criteria**:
- [ ] Map renders within 3 seconds for 10,000 assets
- [ ] Clusters expand smoothly on zoom
- [ ] Asset popup shows relevant info only (no device data)
- [ ] Geozone boundaries display correctly
- [ ] Filter changes reflect immediately
- [ ] Full-screen mode available
- [ ] Historical path view for selected asset

### FR-404: Asset Status Indicators
**Phase**: 1 | **Priority**: High

System shall display asset status derived from geozone location.

| Status | Icon | Color | Definition |
|--------|------|-------|------------|
| At Facility | Factory | Blue | In customer's own warehouse |
| In Transit | Truck | Orange | Moving between geozones |
| At Supplier | Package | Green | At supplier's location |
| At Customer Site | Building | Purple | At end customer's location |
| Unknown | Question | Gray | Outside geozones |
| Stored | Archive | Teal | No movement > 30 days |

**Acceptance Criteria**:
- [ ] Status automatically derived from geozone location
- [ ] Manual override available (admin only)
- [ ] Status history maintained
- [ ] Status change triggers notification (configurable)
- [ ] Custom statuses configurable per tenant

### FR-405: Geozone Summary Boxes
**Phase**: 1 | **Priority**: High

System shall display summary boxes for each geozone category at top of dashboard.

**Acceptance Criteria**:
- [ ] Summary boxes display at top of dashboard
- [ ] Counts accurate and update in near-real-time
- [ ] Click filters entire dashboard
- [ ] Hover shows percentage and trend
- [ ] Responsive layout (stack on mobile)

### FR-406: Asset Metadata Display
**Phase**: 1 | **Priority**: High

System shall display asset metadata: birth date, composition, trip count, age.

**Core Metadata**: Asset ID (barcode/QR), Asset Name, Asset Type (pallet, crate, container), Birth Date, Age, Composition, Recycled Content %, Trip Count, Last Trip Date, Current Location/Status, Assigned Customer.

**Acceptance Criteria**:
- [ ] All metadata fields visible in asset detail
- [ ] QR/barcode displayed for scanning
- [ ] Age calculated dynamically from birth date
- [ ] Composition stored as JSON for flexibility
- [ ] Export individual asset data

### FR-407: Trip Count Tracking
**Phase**: 1 | **Priority**: High

System shall track and display trip count per asset.

**Trip Definition**: Complete cycle — asset leaves origin geozone, arrives at destination, returns to origin (or another origin).

**Acceptance Criteria**:
- [ ] Trip count displayed on asset detail
- [ ] Trip history log available (dates, origin, destination, duration, distance)
- [ ] Automatic trip detection from geozone events
- [ ] Manual trip entry/correction available
- [ ] Fleet-wide trip statistics
- [ ] Export trip reports

### FR-408: Recycled Content Tracking (Regulatory)
**Phase**: 1 | **Priority**: High

System shall track and display recycled content percentage.

**Acceptance Criteria**:
- [ ] Recycled content % field on every asset
- [ ] Editable with audit trail
- [ ] Fleet average calculated and displayed
- [ ] Filter assets by recycled content range
- [ ] Compliance report exportable
- [ ] Alert when compliance deadline approaching

### FR-801: Device-Asset Mapping Model
**Phase**: 1 | **Priority**: Critical

System shall maintain device-to-asset mapping data model. One device → One asset (1:1).

**Acceptance Criteria**:
- [ ] Foreign key constraint enforces 1:1
- [ ] Unassigned devices queryable
- [ ] Unassigned assets queryable
- [ ] Association history maintained
- [ ] API endpoints for CRUD operations
- [ ] Validation prevents duplicate associations

### FR-802: Bulk Device-Asset Association
**Phase**: 1 | **Priority**: High

System shall support bulk device-asset association at scale.

**Input Methods**: CSV Upload, Scan & Match (barcode), Batch UI (select + auto-assign).

**Acceptance Criteria**:
- [ ] CSV upload accepts 1000+ rows
- [ ] Validation report before commit
- [ ] Failed rows clearly identified
- [ ] Progress bar for large batches
- [ ] Undo batch within 24 hours

### FR-803: Device vs. Asset Rules Engine
**Phase**: 1 | **Priority**: High

System shall implement rules engine separating device-level and asset-level behaviors.

**Device-Level Rules**: Low Battery, No Report, Signal Strength, Firmware Update.
**Asset-Level Rules**: Geozone Breach, Arrival Overdue, Trip Complete, Idle Too Long.

**Acceptance Criteria**:
- [ ] Rules clearly labeled as device or asset scope
- [ ] Device rules don't create asset alerts
- [ ] Asset rules evaluate device data correctly
- [ ] Scope visible in alert detail

### FR-804: One-to-One Attribution Enforcement
**Phase**: 1 | **Priority**: High

System shall enforce that each device can only be linked to one asset and vice versa.

**Acceptance Criteria**:
- [ ] Database unique constraint enforced
- [ ] API validation before association
- [ ] Clear error message on duplicate attempt
- [ ] Association swap supported (reassign in one operation)

### FR-805: Asset Location Inheritance
**Phase**: 1 | **Priority**: High

System shall derive asset location from associated device.

**Acceptance Criteria**:
- [ ] Asset location updates when device reports new position
- [ ] Unassociated assets show "No location data"
- [ ] Location latency < 1 minute from device report
- [ ] Historical trail reflects device movement

---

## 9. Geozone & Geofencing

### FR-501: Geozone Creation and Management
**Phase**: 1 | **Priority**: High

System shall allow creation and management of geozones.

**Zone Creation Methods**: Draw polygon on map, Draw circle (center + radius), Import GeoJSON/KML, Geocode address.

**Zone Properties**: Name, Type (Warehouse, Supplier, Customer, Transit Hub), Address, Owner, Contact, Operating Hours, Status (Active/Inactive).

**Acceptance Criteria**:
- [ ] Polygon drawing tool works smoothly
- [ ] Circle drawing with radius input
- [ ] Import GeoJSON files up to 10MB
- [ ] Address search finds and geocodes locations
- [ ] Zone properties editable after creation
- [ ] Zone changes logged with audit trail
- [ ] Overlapping zones handled correctly
- [ ] Bulk import via CSV

### FR-502: Geozone Visualization
**Phase**: 1 | **Priority**: High

System shall display geozones on map with color-coding.

**Color Coding**: Warehouse (Blue), Supplier (Green), Customer (Purple), Transit Hub (Orange), Restricted (Red).

**Acceptance Criteria**:
- [ ] Zones render correctly on map with semi-transparent fill
- [ ] Colors are distinct and configurable
- [ ] Labels readable at appropriate zoom levels
- [ ] Zone toggle controls in map legend
- [ ] Hover tooltip shows zone name and type

### FR-503: Geozone Entry/Exit Detection
**Phase**: 1 | **Priority**: Critical

System shall detect and log geozone entry/exit events in real-time.

**Event Types**: ZONE_ENTER, ZONE_EXIT, ZONE_DWELL (inside zone > threshold duration).

**Processing Requirements**:
- Near-real-time detection (< 1 minute latency)
- Handle location jitter (configurable hysteresis threshold)
- Support simultaneous zone membership (overlapping zones)
- Queue events for downstream processing via Kafka

**Acceptance Criteria**:
- [ ] Entry detected within 1 minute of location update
- [ ] Exit detected within 1 minute of location update
- [ ] Boundary jitter filtered (configurable threshold, default 50m)
- [ ] Events logged with full context
- [ ] Events trigger status updates and alerts
- [ ] High-volume processing (1000+ events/minute)

### FR-504: Geozone-Based Status Inference
**Phase**: 1 | **Priority**: High

System shall infer asset status based on geozone location.

**Inference Rules**:
| Zone Type | Inferred Status |
|-----------|----------------|
| Warehouse (Own) | At Facility |
| Supplier | At Supplier |
| Customer Site | At Customer |
| Transit Hub | In Transit |
| No Zone | Unknown |

**Additional Rules**: Moving between zones → In Transit; Stationary outside zone > X hours → Unknown; At owned facility idle > Y days → Stored.

**Acceptance Criteria**:
- [ ] Status updates automatically on zone change
- [ ] Configurable mapping rules per tenant
- [ ] "In Transit" detected during movement
- [ ] Status change history maintained
- [ ] Manual override option for edge cases

### FR-505: Responsibility Transfer Logic
**Phase**: 1 | **Priority**: Medium

System shall support responsibility transfer rules based on geozone.

**Transfer Events**: Asset enters customer zone → responsibility to customer; Asset exits → responsibility returns to tenant; Asset enters supplier zone → responsibility to supplier.

**Acceptance Criteria**:
- [ ] Transfer automatically logged on zone change
- [ ] Transfer history viewable per asset
- [ ] Custody duration report per party
- [ ] Dispute evidence: timestamped location proof
- [ ] Manual transfer correction available

---

## 10. Alert & Notification System

### FR-601: Alert Rules Configuration
**Phase**: 1 | **Priority**: High

System shall support configurable alert rules and storage.

**Rule Components**: Trigger (what event), Condition (additional criteria), Action (what happens), Recipients (who receives).

**Trigger Types**: Geozone Exit, Geozone Enter, Arrival Overdue, Low Battery, No Report, Condition Breach (Phase 2), Trip Complete.

**Acceptance Criteria**:
- [ ] Rule builder UI for non-technical users
- [ ] Preview rule matches before saving
- [ ] Enable/disable rules without deleting
- [ ] Test rule with simulated event
- [ ] Clone existing rules
- [ ] Import/export rules as JSON

### FR-602: Geofence Breach Alerts
**Phase**: 1 | **Priority**: High

System shall generate alerts on geofence breach.

**Acceptance Criteria**:
- [ ] Breach detected within 5 minutes
- [ ] Alert created in dashboard
- [ ] Email sent to configured recipients
- [ ] Alert shows breach location on map
- [ ] Configurable per zone and asset
- [ ] No duplicate alerts for same breach

### FR-603: Expected Arrival Alerts
**Phase**: 1 | **Priority**: High

System shall generate alerts on expected arrival date violations.

**Escalation**: Initial alert at grace period expiry → Escalation at 2x → Critical at 4x.

**Acceptance Criteria**:
- [ ] Arrival time can be set manually or auto-calculated
- [ ] Alert triggers when arrival overdue
- [ ] Grace period configurable (default: 2 hours)
- [ ] Current location shown in alert
- [ ] Alert clears automatically on arrival

### FR-604: Alert Management Dashboard
**Phase**: 1 | **Priority**: Critical

System shall provide alert management dashboard (not email-only).

**Features**: Alert list with severity indicators, Sortable/filterable, Summary widgets (severity pie, trend line, avg resolution time), Bulk actions (acknowledge, assign, resolve).

**Acceptance Criteria**:
- [ ] Dashboard loads all alerts within 2 seconds
- [ ] Severity color coding visible
- [ ] Filter combinations work correctly
- [ ] Bulk actions apply to selected alerts
- [ ] Resolution actions logged with user/timestamp
- [ ] Notifications clear when alert resolved

### FR-605: Alert Status Workflow
**Phase**: 1 | **Priority**: High

System shall support alert status workflow: New → Acknowledged → Assigned → In Progress → Pending → Resolved / Snoozed.

**Overdue Logic**: Alert becomes "Overdue" if not resolved within SLA. Auto-escalation option available.

**Acceptance Criteria**:
- [ ] All status transitions work correctly
- [ ] Transition logged with user and timestamp
- [ ] Only valid transitions allowed
- [ ] SLA timer visible on alert
- [ ] Overdue highlighting applied
- [ ] Snooze with duration option

### FR-606: Alert Summary Widgets
**Phase**: 1 | **Priority**: High

System shall display alert summary widgets: Status Donut Chart, Severity Bar Chart, Trend Line Chart, Average Resolution Time.

**Acceptance Criteria**:
- [ ] Widgets display accurately
- [ ] Click-through filtering works
- [ ] Responsive layout
- [ ] Date range selector for trend charts
- [ ] Export chart as image

### FR-607: Email Notifications
**Phase**: 1 | **Priority**: Medium

System shall send email notifications for alerts.

**Configuration**: Per-user preferences, Alert types to receive, Frequency (immediate/daily digest/weekly digest), Quiet hours.

**Acceptance Criteria**:
- [ ] Emails sent within 5 minutes of critical alerts
- [ ] Email renders correctly in major clients
- [ ] Deep links work
- [ ] Unsubscribe/manage preferences link
- [ ] Quiet hours respected

### FR-608: Alert Filtering and Search
**Phase**: 1 | **Priority**: Medium

System shall support alert filtering and search.

**Acceptance Criteria**:
- [ ] Filter by status, severity, type, date range, assignee, asset, customer
- [ ] Full-text search on alert content
- [ ] Saved filter presets
- [ ] Filter state in URL (shareable)
- [ ] Search returns results within 1 second

---

## 11. Natural Language Query — Ask Bob Dashboard

Two separate AI features: **Ask Bob Dashboard** (this section) handles NLQ that updates the dashboard view. **Bob Support** (§12) handles conversational AI for troubleshooting.

### FR-701: Natural Language Query Input
**Phase**: 1 | **Priority**: High

System shall provide natural language query input field on all dashboard pages.

**Example Queries**: "Show me devices in Germany", "Which SIMs are active in Europe?", "Assets that haven't moved in 7 days", "Low battery devices for Nestle", "Alerts created this week".

**Acceptance Criteria**:
- [ ] Input field visible on all main pages
- [ ] Query processes within 2 seconds
- [ ] Autocomplete shows recent queries
- [ ] Example queries provided as suggestions
- [ ] Error handling for unparseable queries
- [ ] Query history accessible

### FR-702: Dashboard Filter Update (Not Chat)
**Phase**: 1 | **Priority**: Critical

System shall update dashboard view based on natural language query — NOT provide a chat response.

**Correct Behavior**:
```
User types: "Which SIMs are active in Europe?"
→ Dashboard filters to: Region = Europe, Status = Active
→ SIM list shows 523 filtered results
→ Filter chips show: "Region: Europe" "Status: Active"
```

**Fallback**: If query cannot be translated to filters, show inline result cards with explanation and alternative suggestions.

**Acceptance Criteria**:
- [ ] Query updates dashboard filters, not chat
- [ ] Filter chips appear showing applied filters
- [ ] Results count updates immediately
- [ ] Clearing filters returns to default view
- [ ] Complex queries translate to multiple filters
- [ ] Ambiguous queries prompt for clarification
- [ ] Chart/graph views also update to filtered data

### FR-703: Saved Query Presets
**Phase**: 1 | **Priority**: High

System shall allow saving queries as presets.

**Acceptance Criteria**:
- [ ] Save button available after query execution
- [ ] Preset name required, description optional
- [ ] Presets appear in quick-access dropdown
- [ ] Team sharing with permissions
- [ ] Import/export presets

### FR-704: Tabbed View System
**Phase**: 1 | **Priority**: High

System shall display saved queries as tabs.

**Acceptance Criteria**:
- [ ] Tab bar displays saved presets
- [ ] Clicking tab applies filters instantly
- [ ] Active tab visually distinct
- [ ] Tab reordering works via drag
- [ ] Tab state persists in local storage
- [ ] Maximum 10 tabs

### FR-705: Custom View Tab CRUD
**Phase**: 1 | **Priority**: High

System shall allow create/save/delete of custom view tabs.

**Acceptance Criteria**:
- [ ] Create new tab via "+" button
- [ ] Inline rename on double-click
- [ ] Delete with confirmation
- [ ] Duplicate creates exact copy
- [ ] Undo delete within 30 seconds

### FR-706: CSV/Excel/PDF Export
**Phase**: 1 | **Priority**: Medium

System shall support CSV, Excel, and PDF export from query results.

**Acceptance Criteria**:
- [ ] Export button on all list views
- [ ] Column selection dialog
- [ ] Download starts within 5 seconds for < 1,000 rows
- [ ] Large exports queued with email notification
- [ ] Special characters handled properly
- [ ] Export logged for audit

### FR-707: Email Generation for Support
**Phase**: 1 | **Priority**: Medium

System shall support email generation for support escalation.

**Acceptance Criteria**:
- [ ] Email button available in relevant views
- [ ] Pre-filled subject and body with context
- [ ] User can edit before sending
- [ ] Deep link to dashboard included

### FR-708: LLM Data Restriction
**Phase**: 1 | **Priority**: Critical

System shall restrict LLM to internal data only — no external data, no hallucination.

**Guardrails**:
- LLM can ONLY query tenant's own database
- No internet access during query processing
- If data doesn't exist, report "No data found"
- Never fabricate statistics or counts
- Audit all LLM queries
- No specific LLM mandated — implement with guardrails

**Acceptance Criteria**:
- [ ] LLM cannot access external internet
- [ ] Queries only execute against tenant database
- [ ] "No data found" response for unavailable data
- [ ] No cross-tenant data leakage
- [ ] Audit log of all LLM queries
- [ ] Hallucination detection implemented
- [ ] Security review passed

---

## 12. AI Support Assistant — Bob Support

Separate from Ask Bob Dashboard (§11). This is a **conversational AI assistant** for troubleshooting and help.

### Requirements

**Layout on Support Page**:
1. Large AI Chat Box (top, prominent — like Claude/ChatGPT interface)
2. Service Manager Link (prominent)
3. Report Bug / Ask for Help buttons
4. Documentation table of contents
5. API Documentation Link (Swagger)

**Capabilities**:
- Natural language search of documentation
- Query system status
- Help with troubleshooting
- Answer "how do I..." questions
- Context-aware responses based on user's current view

**Guardrails**: Same LLM restrictions as Ask Bob Dashboard (§FR-708) — no external data, no hallucination, tenant-scoped data access only.

---

## 13. Bulk Operations

### Bulk Provisioning Interface (CMP)

**Decision**: All entity types support bulk operations — SIMs, devices, assets, associations.

**Workflow**:
1. User uploads CSV/Excel file with ICCID/device list and target action
2. System validates file format and readability
3. System cross-references against inventory
4. System reports pre-validation results (already provisioned, invalid IDs, etc.)
5. User confirms or cancels
6. System executes bulk operation asynchronously via Kafka
7. System provides real-time progress feedback

**File Validation**:
```json
{
  "valid_records": 950,
  "invalid_records": 30,
  "already_in_state": 20,
  "errors": [
    { "row": 15, "iccid": "89...", "reason": "Invalid ICCID format" }
  ]
}
```

**Progress Tracking** (via Kafka):
- Total items in batch
- Items processed (X of Y)
- Current status (Validating, Processing, Complete, Failed)
- Success/failure breakdown

**Priority/Ordering**: Respect row order in uploaded file for processing priority.

**Access Control**: Super Admin / Tenant Admin only. Audit logging for all bulk actions.

**Notification**: In-app notification, Email summary with results, Browser notification (if enabled).

### Bulk Operations by Entity

| Entity | Bulk Actions |
|--------|-------------|
| SIMs | Activate, Suspend, Terminate, Assign to customer/project |
| Devices | Assign, Update status, Assign to customer/project |
| Assets | Create, Update metadata, Assign to customer |
| Associations | Device-to-Asset mapping (CSV: device_id, asset_id) |

---

## 14. API Design

### REST API Design

**Decision**: Single TypeScript API with consistent patterns. Single endpoint accepts one or more items — always bulk-capable internally.

**Base URL**: `https://{tenant}.fmp.ioto.io/api/v1/`

**Endpoint Examples**:
```
POST   /api/v1/sims/provision
       { "iccids": ["89...001", "89...002"], "action": "ACTIVATE" }

GET    /api/v1/sims
GET    /api/v1/sims/:iccid
PUT    /api/v1/sims/:iccid
DELETE /api/v1/sims/:iccid

GET    /api/v1/devices
GET    /api/v1/devices/:id
POST   /api/v1/devices
PUT    /api/v1/devices/:id

GET    /api/v1/assets
GET    /api/v1/assets/:id
POST   /api/v1/assets
PUT    /api/v1/assets/:id

GET    /api/v1/alerts
PUT    /api/v1/alerts/:id/acknowledge
PUT    /api/v1/alerts/:id/resolve

POST   /api/v1/bulk/:entity
GET    /api/v1/bulk/:batchId/status

GET    /api/v1/analytics/consumption
GET    /api/v1/analytics/sessions
```

### API Abuse Prevention

**Misuse Patterns to Detect**:
- Calling single-provision endpoint in rapid loops (instead of bulk)
- Excessive requests from single tenant
- Seasonal spikes blocking other tenants

**Mitigation Strategy**:
1. **Sample and Hold**: Queue incoming requests before processing
2. **Batch Detection**: Identify rapid single requests and auto-batch
3. **Tenant Isolation**: Dedicated executor threads per tenant
4. **AI Monitoring**: Detect abnormal patterns and alert
5. **Feedback**: Return warning in API response suggesting bulk endpoint

### Rate Limiting

Per-tenant request limits. Queue-based processing to smooth spikes. Graceful degradation with estimated wait times.

**Known Bottleneck**: Ericsson HLR API will be slowest in chain — implement queue-based processing.

### FR-901: MQTT Broker Integration
**Phase**: 1 | **Priority**: Critical

System shall integrate with MQTT broker for device telemetry ingestion.

**Acceptance Criteria**:
- [ ] EMQX 5.x broker deployed and configured in Docker stack
- [ ] Devices can publish telemetry to MQTT topics
- [ ] MQTT bridge forwards messages to Kafka topics
- [ ] WebSocket relay supports real-time UI updates
- [ ] TLS encryption for all MQTT connections
- [ ] Per-tenant topic isolation
- [ ] Broker health monitoring via Prometheus

### FR-902: Mediation Layer
**Phase**: 1 | **Priority**: High

System shall implement mediation layer for charging data ingestion.

**Acceptance Criteria**:
- [ ] CDR records ingested from connectivity provider
- [ ] Session rollup events emitted to Kafka
- [ ] MCC/MNC translated to human-readable network names
- [ ] Radio access type translated to readable format
- [ ] Internal fields filtered from exposed API
- [ ] Data flows into Clickhouse for analytics
- [ ] Near-real-time processing (< 5 minute latency)

### FR-903: API Endpoints for Data Export
**Phase**: 1 | **Priority**: High

System shall provide API endpoints for data export (CSV, Excel, JSON).

**Acceptance Criteria**:
- [ ] Export endpoints available for SIMs, devices, assets, alerts, sessions
- [ ] Column selection supported
- [ ] Filter parameters applied to exports
- [ ] Large exports processed asynchronously with download link
- [ ] Export logged for audit

### FR-904: Connectivity Backend Integration
**Phase**: 1 | **Priority**: Critical

System shall integrate with Jersey Telecom/Ioto connectivity backend.

**Acceptance Criteria**:
- [ ] SIM provisioning commands forwarded to JT backend
- [ ] State change confirmations received and processed
- [ ] Network attach/detach events ingested
- [ ] Coverage data available for diagnostics
- [ ] Error handling for backend unavailability

### FR-905: Onomondo Compatibility
**Phase**: 1 | **Priority**: High

System shall maintain compatibility with Onomondo platform.

**Acceptance Criteria**:
- [ ] SIM data importable from Onomondo exports
- [ ] API adapter layer for Onomondo-provisioned SIMs
- [ ] Transition path documented for SIM migration

### FR-906: Device Pre-Integration
**Phase**: 1 | **Priority**: High

System shall support pre-integration of customer-specified devices.

**Acceptance Criteria**:
- [ ] Device profiles configurable per device model
- [ ] Telemetry parsing rules defined per device type
- [ ] Alpal's shortlisted devices pre-integrated
- [ ] Device onboarding documentation available

---

## 15. Analytics & Reporting

### Dashboard Components (CMP)

| Component | Description | Data Source |
|-----------|-------------|-------------|
| Total SIMs | Count by state (Active, Inactive, Suspended) | SIM inventory |
| Live Sessions | Currently active data sessions | Clickhouse real-time |
| Average Consumption | Per-SIM average data usage | Mediation rollup |
| Estimated Cost | Projected next bill | Rating engine |
| Top Carriers | Network distribution by traffic or cost | CDR aggregation |
| Device Traffic | Data consumption by device | Device telemetry |

### Consumption Analytics Page

**Features**:
- Filter by time period (24hr, 7 days, 30 days, monthly, yearly)
- Filter by customer (sub-customer segmentation)
- Drill-down from aggregate to individual SIM/device
- Export capability for customer billing

### Financial & Usage Analytics (FR-1000 Series)

### FR-1001: Consumption Trend Visualization
**Phase**: 1 | **Priority**: Medium

System shall display consumption trend visualizations.

### FR-1002: Traffic Heatmap
**Phase**: 1 | **Priority**: Medium

System shall display traffic heatmap by geo-location.

### FR-1003: CDR Display
**Phase**: 1 | **Priority**: Medium

System shall display CDR (Call Detail Record) information.

| View | Purpose | Use Case |
|------|---------|----------|
| CDR View | Billing/Financial | "How much will I pay?" |
| Session View | Troubleshooting/Operational | "What is this SIM doing?" |

### FR-1004: Monthly Cost Trend
**Phase**: 1 | **Priority**: Medium

System shall display monthly cost trend graphs.

### Carrier Cost Breakdown

Click on "Top Carriers" widget → display all networks with associated costs → calculated from tenant's rate card.

### Billing & Data Export

**Decision**: Export only — no invoicing, no rate cards managed in platform.

- Roll up usage data by **Customer ID** (sub-customer dimension)
- Export as CSV/Excel
- Optionally expose via API
- Tenant is responsible for invoicing in their own ERP

---

## 16. Support & Documentation

### Support Page Layout

1. **Large AI Chat Box** — Bob Support (prominent, like Claude/ChatGPT)
2. **Service Manager Link** (prominent)
3. **Report Bug / Ask for Help** buttons
4. **Documentation** (table of contents)
5. **API Documentation Link** (Swagger/OpenAPI)

### Documentation Content

| Section | Format |
|---------|--------|
| User guide | Living document, versioned |
| State machine diagrams | Interactive SVG |
| API reference | OpenAPI/Swagger |
| Glossary of terms | Searchable page |
| Getting started | Step-by-step tutorial |

---

## 17. Simulation & Demo Tools

**Decision**: Include demo/simulation tools in the platform.

### CDR Simulation Tool

Generate simulated usage records for demos and testing:
- Specify number of ICCIDs to generate
- Set date range for records
- Configure byte range (min/max)
- Batch generation and submission
- Records appear in dashboard analytics

### Device Simulation Tool

Generate simulated device telemetry:
- Temperature, humidity, battery, light readings
- GPS location data for vehicle trackers
- Push to MQTT
- Reflect in device dashboard

### Test Device Fleet

Create larger test device set covering multiple countries:
- Denmark, Norway, Sweden, Netherlands, Germany (Pan-European)
- Roaming on various carriers (DT, Vodafone, etc.)
- All using JT SIM cards
- Physical low-cost GPS/temp monitors for real testing

---

## 18. Device Compatibility

### Supported Protocols

| Protocol | Use Case |
|----------|----------|
| **MQTT** | Primary telemetry ingestion |
| **HTTP/REST** | Device reporting via API |
| **CoAP** | Low-power device communication (Phase 2) |
| **LwM2M** | Device management protocol (Phase 2) |

### Device Types

| Category | Examples | Connectivity |
|----------|----------|-------------|
| **GPS Trackers** | Vehicle/asset trackers | Cellular (4G/LTE) |
| **Environmental Sensors** | Temperature, humidity | Cellular or WiFi |
| **Pallet Trackers** | Low-power, embedded in packaging | Cellular (NB-IoT, LTE-M) |
| **BLE Gateways** | Pallet-mounted, relaying BLE sensor data | Cellular (Phase 2) |
| **Generic IoT** | Any MQTT-capable device | Any |

### Alpal Device Shortlist

Two devices currently under evaluation:
- Battery life testing in progress (claimed vs. actual performance)
- Signal strength testing (devices embedded in pallets)
- Pre-integration into FMP upon specification confirmation

---

## 19. Data Models

### 19.1 SIM Card

```
sim_cards
├── id                  UUID (PK)
├── iccid               VARCHAR(20) UNIQUE NOT NULL
├── msisdn              VARCHAR(20)
├── imsi                VARCHAR(15)
├── eid                 VARCHAR(32)    -- eSIM identifier
├── state               ENUM('inactive','active','suspended','terminated')
├── carrier_name        VARCHAR(100)
├── carrier_mcc_mnc     VARCHAR(10)
├── device_id           UUID (FK → devices.id, UNIQUE, NULLABLE)
├── tenant_id           UUID (FK → tenants.id) NOT NULL
├── customer_id         UUID (FK → customers.id)
├── project_id          UUID (FK → projects.id)
├── data_plan           VARCHAR(100)
├── labels              JSONB
├── last_activity_at    TIMESTAMPTZ
├── pin_encrypted       BYTEA          -- AES-256-GCM encrypted
├── puk_encrypted       BYTEA          -- AES-256-GCM encrypted
├── created_at          TIMESTAMPTZ DEFAULT NOW()
├── updated_at          TIMESTAMPTZ DEFAULT NOW()
└── deleted_at          TIMESTAMPTZ    -- soft delete
```

### 19.2 Device

```
devices
├── id                  UUID (PK)
├── name                VARCHAR(255)
├── imei                VARCHAR(15) UNIQUE
├── serial_number       VARCHAR(100)
├── device_type         VARCHAR(100)
├── manufacturer        VARCHAR(100)
├── firmware_version    VARCHAR(50)
├── state               ENUM('provisioned','active','warning','offline','maintenance','decommissioned')
├── battery_level       INTEGER        -- 0-100 percent
├── signal_strength_dbm INTEGER
├── latitude            DECIMAL(10,7)
├── longitude           DECIMAL(10,7)
├── last_location_at    TIMESTAMPTZ
├── last_seen_at        TIMESTAMPTZ
├── tenant_id           UUID (FK → tenants.id) NOT NULL
├── customer_id         UUID (FK → customers.id)
├── project_id          UUID (FK → projects.id)
├── labels              JSONB
├── metadata            JSONB
├── created_at          TIMESTAMPTZ DEFAULT NOW()
├── updated_at          TIMESTAMPTZ DEFAULT NOW()
└── deleted_at          TIMESTAMPTZ
```

### 19.3 Asset

```
assets
├── id                  UUID (PK)
├── name                VARCHAR(255) NOT NULL
├── asset_type          VARCHAR(100)   -- pallet, crate, container
├── barcode             VARCHAR(100) UNIQUE
├── birth_date          DATE
├── composition         JSONB          -- {"plastic":60,"recycled_plastic":30,"metal":10}
├── recycled_content    DECIMAL(5,4)   -- 0.0000 to 1.0000
├── trip_count          INTEGER DEFAULT 0
├── last_trip_date      DATE
├── current_status      ENUM('at_facility','in_transit','at_supplier','at_customer','unknown','stored')
├── device_id           UUID (FK → devices.id, UNIQUE, NULLABLE)
├── tenant_id           UUID (FK → tenants.id) NOT NULL
├── customer_id         UUID (FK → customers.id)
├── project_id          UUID (FK → projects.id)
├── certification_status VARCHAR(50)
├── compliance_expiry   DATE
├── labels              JSONB
├── metadata            JSONB
├── created_at          TIMESTAMPTZ DEFAULT NOW()
├── updated_at          TIMESTAMPTZ DEFAULT NOW()
└── deleted_at          TIMESTAMPTZ
```

### 19.4 Geozone

```
geozones
├── id                  UUID (PK)
├── name                VARCHAR(255) NOT NULL
├── zone_type           ENUM('warehouse','supplier','customer','transit_hub','restricted')
├── geometry            GEOMETRY(POLYGON, 4326)  -- PostGIS
├── center_lat          DECIMAL(10,7)
├── center_lng          DECIMAL(10,7)
├── radius_meters       INTEGER        -- for circle zones
├── address             TEXT
├── owner_name          VARCHAR(255)
├── contact_name        VARCHAR(255)
├── contact_email       VARCHAR(255)
├── operating_hours     JSONB
├── is_active           BOOLEAN DEFAULT true
├── tenant_id           UUID (FK → tenants.id) NOT NULL
├── customer_id         UUID (FK → customers.id)
├── hysteresis_meters   INTEGER DEFAULT 50
├── color               VARCHAR(7)     -- hex color
├── created_at          TIMESTAMPTZ DEFAULT NOW()
├── updated_at          TIMESTAMPTZ DEFAULT NOW()
└── deleted_at          TIMESTAMPTZ
```

### 19.5 Alert

```
alerts
├── id                  UUID (PK)
├── alert_type          ENUM('geozone_breach','arrival_overdue','low_battery','no_report','condition_breach','trip_complete','custom')
├── severity            ENUM('critical','high','medium','low')
├── status              ENUM('new','acknowledged','assigned','in_progress','pending','resolved','snoozed')
├── title               VARCHAR(500) NOT NULL
├── description         TEXT
├── asset_id            UUID (FK → assets.id)
├── device_id           UUID (FK → devices.id)
├── sim_id              UUID (FK → sim_cards.id)
├── geozone_id          UUID (FK → geozones.id)
├── rule_id             UUID (FK → alert_rules.id)
├── assigned_to         UUID (FK → users.id)
├── sla_deadline_at     TIMESTAMPTZ
├── snoozed_until       TIMESTAMPTZ
├── resolved_at         TIMESTAMPTZ
├── resolved_by         UUID (FK → users.id)
├── resolution_notes    TEXT
├── tenant_id           UUID (FK → tenants.id) NOT NULL
├── location_snapshot   JSONB          -- lat, lng, address at time of alert
├── metadata            JSONB
├── created_at          TIMESTAMPTZ DEFAULT NOW()
├── updated_at          TIMESTAMPTZ DEFAULT NOW()
└── deleted_at          TIMESTAMPTZ
```

### 19.6 Session (Clickhouse)

```sql
CREATE TABLE sessions (
    session_id          String,
    iccid               String,
    tenant_id           String,
    event_timestamp     DateTime,
    network_name        String,
    mcc_mnc             String,
    radio_access_type   String,
    ip_address          String,
    total_bytes_in      UInt64,
    total_bytes_out     UInt64,
    request_type        Enum8('UPDATE' = 1, 'TERMINATE' = 2),
    cell_id             String,
    apn                 String,
    session_start       DateTime,
    session_end         Nullable(DateTime),
    termination_reason  Nullable(String)
) ENGINE = ReplacingMergeTree(event_timestamp)
ORDER BY (tenant_id, iccid, session_id)
TTL event_timestamp + INTERVAL 7 DAY;
```

### 19.7 Audit Log

```
audit_logs
├── id                  UUID (PK)
├── action              VARCHAR(50)    -- CREATE, UPDATE, DELETE, LOGIN, EXPORT, etc.
├── entity_type         VARCHAR(50)    -- sim, device, asset, alert, geozone, user
├── entity_id           UUID
├── user_id             UUID (FK → users.id)
├── tenant_id           UUID (FK → tenants.id)
├── changes             JSONB          -- before/after snapshot
├── ip_address          INET
├── user_agent          TEXT
├── created_at          TIMESTAMPTZ DEFAULT NOW()
```

---

## 20. Design System & UI Principles

### Technology Stack

| Component | Technology |
|-----------|-----------|
| **Framework** | Vue 3.5 + TypeScript 5.8 |
| **UI Library** | PrimeVue 4.x |
| **State** | Pinia |
| **Build** | Vite 7 |
| **Charts** | Chart.js 4.5 |
| **Maps** | Leaflet + OpenStreetMap |
| **Icons** | PrimeIcons |
| **Styling** | PrimeFlex + CSS custom properties |

### Maps — Leaflet/OpenStreetMap

**Decision**: Replace Google Maps with Leaflet entirely.

| Feature | Implementation |
|---------|---------------|
| Base map | OpenStreetMap tiles |
| Device markers | Leaflet markers with custom icons, status colors |
| Asset markers | Distinct asset icons (package/box, not antenna) |
| Clustering | leaflet.markercluster |
| Geozone polygons | Leaflet polygon layers |
| Drawing tools | leaflet-draw for geozone creation |
| Heatmaps | leaflet-heat |
| Routing/trails | Leaflet polylines for movement trails |

### Design Principles

1. **Accessibility**: WCAG 2.1 AA compliance, colorblind-friendly palettes, keyboard navigation
2. **Responsive**: Desktop-first, responsive down to tablet (no native mobile)
3. **Performance**: Virtual scrolling for large lists, lazy-loaded panels, < 3 second page loads
4. **Consistency**: PrimeVue components only — no custom UI that duplicates PrimeVue capabilities
5. **Data density**: Maximize useful data per screen, collapsible panels for detail
6. **Real-time**: WebSocket updates for internal users, visual indicators for live data

### Dashboard Cosmetic Items (from CMP review)

- Remove ghost icons in top-right of metric boxes (or make them functional)
- Align figures within boxes (currently left-aligned, should be balanced)
- Implement hover intensity increase on icons

---

## 21. Security Requirements & Remediation

### Security Remediation Checklist

All items from §3.2 must be resolved before production deployment:

| # | Issue | Status | Owner | Sprint |
|---|-------|--------|-------|--------|
| SEC-01 | Migrate from hardcoded credentials to Keycloak | Pending | Backend | Sprint 1 |
| SEC-02 | Remove exposed API keys from repo, implement secrets management | Pending | DevOps | Sprint 1 |
| SEC-03 | Implement AES-256-GCM encryption for sensitive SIM data | Pending | Backend | Sprint 1 |
| SEC-04 | Add timing-safe comparison (`crypto.timingSafeEqual`) | Pending | Backend | Sprint 1 |
| SEC-05 | Implement HMAC-SHA256 webhook signatures | Pending | Backend | Sprint 2 |
| SEC-06 | Remove mock data fallback from production builds | Pending | Frontend | Sprint 1 |
| SEC-07 | Implement automated migration runner | Pending | DevOps | Sprint 1 |
| SEC-08 | Audit all API endpoints for authorization checks | Pending | Backend | Sprint 2 |
| SEC-09 | Implement CSRF protection | Pending | Backend | Sprint 1 |
| SEC-10 | Add Content-Security-Policy headers | Pending | DevOps | Sprint 1 |

### Authentication Security

- Keycloak with OAuth 2.0 / OIDC
- Token rotation with short-lived access tokens (15 min) and refresh tokens (7 days)
- Multi-factor authentication support (Phase 2)
- Failed login rate limiting (max 5 attempts per 15 minutes)
- Session invalidation on role change

### Data Security

- All data encrypted at rest (PostgreSQL, Clickhouse)
- TLS 1.3 for all data in transit
- Sensitive fields (PIN, PUK, KI, OPC) encrypted with AES-256-GCM
- API keys stored in secrets manager (never in repo, never in .env committed to git)
- Tenant data isolation enforced at database level

### Audit Logging

**Decision**: Comprehensive logging — all create/update/delete operations.

Every auditable action logged with:
- Timestamp
- User ID
- Tenant ID
- Action type (CREATE, UPDATE, DELETE, LOGIN, EXPORT, BULK_ACTION)
- Entity type and ID
- Before/after snapshot (for updates)
- IP address and user agent

### API Security

- OAuth 2.0 bearer tokens for all API requests
- Per-tenant rate limiting
- Request validation and sanitization
- SQL injection prevention (parameterized queries only)
- XSS prevention (output encoding, CSP headers)
- CORS configuration per tenant

---

## 22. Compliance

### GDPR

- Right to erasure (delete user data on request)
- Data portability (export all user data)
- Consent management
- Data processing agreements with tenants
- Privacy-by-design architecture

### Data Residency

- Tenant data stored in region specified at provisioning
- UpCloud Amsterdam (nl-ams1) for EU tenants
- No cross-region data transfer without explicit consent

### Packaging Regulations

- Recycled content percentage tracking (FR-408)
- Material composition records
- Compliance reporting exports
- Certification document storage
- Deadline alerting for upcoming regulations

---

## 23. Non-Functional Requirements

### Performance

| Metric | Target |
|--------|--------|
| Page load time | < 3 seconds |
| API response time (p95) | < 500ms |
| Filter application | < 500ms |
| Map rendering (10,000 markers) | < 3 seconds |
| NLQ query processing | < 2 seconds |
| Alert detection latency | < 1 minute |
| Bulk operation throughput | 1,000+ items/minute |
| Concurrent users per tenant | 100+ |

### Data Retention

**Decision**: Tiered retention.

| Tier | Duration | Data |
|------|----------|------|
| **Live** | 7 days | Raw sessions, live telemetry |
| **Detailed** | 90 days | Session history, event logs, network logs |
| **Aggregated** | 1 year | Daily/monthly rollups, analytics |
| **Audit** | 7 years | Audit logs, compliance records |

### Scalability

| Dimension | Phase 1 Target | Future Target |
|-----------|---------------|---------------|
| Devices per tenant | 10,000 | 100,000 |
| SIMs per tenant | 10,000 | 100,000 |
| Assets per tenant | 10,000 | 100,000 |
| Events/minute | 1,000 | 10,000 |
| Tenants | 5 | 50 |

### Availability

- 99.5% uptime SLA (Phase 1)
- 99.9% uptime SLA (Phase 2)
- Automated health checks
- Graceful degradation under load
- Data backup: Daily PostgreSQL backups, Clickhouse replication

---

## 24. Implementation Roadmap

### Development Environment

**GitHub Repository**: `ioto-fmp`
**Local Development**: Docker Desktop — single `docker-compose up`

**Docker Compose Services**:
| Service | Image | Purpose |
|---------|-------|---------|
| frontend | node:20-alpine + Vite | Vue 3 app with HMR (volume mount) |
| api | node:20-alpine | Express TypeScript with hot reload (volume mount) |
| postgres | postgres:15 | Relational data (persistent volume) |
| kafka + zookeeper | confluentinc/cp-kafka | Event streaming |
| clickhouse | clickhouse/clickhouse-server | Analytics/time-series |
| emqx | emqx/emqx:5 | MQTT broker |
| keycloak | quay.io/keycloak/keycloak | Authentication |

**Deployment Path**:
1. **Phase 1**: Local Docker Desktop development (localhost)
2. **Phase 2**: Deploy to UpCloud test ecosystem (94.237.6.75) once stable

### Phase 1 Roadmap

**Sprint 1 — Foundation** (Weeks 1-3):
- ARCH-001: Multi-tenant data architecture
- ARCH-002: RBAC system (Keycloak integration)
- ARCH-003: Two-tier login system
- ARCH-004: Customer/project grouping
- ARCH-005: Data filtering layer
- SEC-01 through SEC-04, SEC-06, SEC-07, SEC-09, SEC-10
- Docker Compose development stack
- Database migrations infrastructure
- **FR Coverage**: FR-101 to FR-106

**Sprint 2 — Core Device & SIM Management** (Weeks 4-6):
- DEV-001 through DEV-008: Device management module
- SIM-001 through SIM-007: SIM management module
- INT-004, INT-005: Connectivity backend integration
- SEC-05, SEC-08
- **FR Coverage**: FR-201 to FR-208, FR-301 to FR-307, FR-904, FR-905

**Sprint 3 — Customer Dashboard & Maps** (Weeks 7-9):
- CUST-001 through CUST-008: Customer dashboard
- GEO-001, GEO-002, GEO-003: Geozone core
- ASSOC-001: Device-asset mapping model
- Leaflet map integration
- **FR Coverage**: FR-401 to FR-408, FR-501 to FR-503, FR-801

**Sprint 4 — Geofencing & Alerts** (Weeks 10-12):
- GEO-004, GEO-005: Status inference, responsibility transfer
- ALERT-001 through ALERT-008: Alert management system
- **FR Coverage**: FR-504, FR-505, FR-601 to FR-608

**Sprint 5 — Device-Asset & Bulk Operations** (Weeks 13-14):
- ASSOC-002 through ASSOC-005: Bulk association, rules engine
- Bulk provisioning implementation
- **FR Coverage**: FR-802 to FR-805

**Sprint 6 — Natural Language Query** (Weeks 15-17):
- NLQ-001 through NLQ-009: Ask Bob Dashboard
- Bob Support integration
- **FR Coverage**: FR-701 to FR-708

**Sprint 7 — Analytics & Polish** (Weeks 18-19):
- FIN-001 through FIN-004: Analytics dashboards
- INT-003, INT-006: API export, device pre-integration
- Demo/simulation tools
- **FR Coverage**: FR-1001 to FR-1004, FR-902, FR-903, FR-906

### Critical Path

1. **Multi-tenant architecture** (ARCH-001) — blocks everything
2. **RBAC system / Keycloak** (ARCH-002) — blocks user-specific views
3. **MQTT → Kafka pipeline** (INT-001) — blocks all live device data
4. **Data filtering layer** (ARCH-005) — blocks customer dashboard
5. **NLQ dashboard filter mode** (NLQ-003) — key differentiator feature

### Phase 2 (Future Backlog)

| Feature | Priority | Notes |
|---------|----------|-------|
| Trip planning | High | Route optimization, ETA calculation |
| Temperature monitoring | Medium | BLE beacon sensors, pallet gateway |
| Humidity tracking | Medium | Requires BLE gateway work |
| BLE beacon gateway | High | New hardware integration |
| Quality certification | Medium | Regulatory compliance |
| Historical trend analysis | Medium | Data warehouse queries |
| Predictive maintenance | Medium | ML model required |
| Revenue optimization | Medium | Business intelligence |
| CoAP/LwM2M support | Medium | Low-power protocols |
| Mobile app | Low | Responsive web serves for now |

---

## 25. Risks & Mitigations

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | Customers waiting — pressure to deploy before platform ready | High | Use interim platform for customer demos; prioritize customer-visible features |
| R2 | Device battery life claims vs. actual performance unknown | High | Extended testing before deployment; battery monitoring in platform |
| R3 | Signal strength issues with devices embedded in pallets | Medium | Field testing in real conditions; signal monitoring alerts |
| R4 | Scope creep into ERP functionality | High | Strict boundary: no sub-customer invoicing, export only |
| R5 | Ericsson HLR API bottleneck | High | Queue-based processing, tenant isolation, rate limiting |
| R6 | Complex state machine coupling (SIM + Device) | Medium | Keep state machines simple and independent; coordination layer separate |
| R7 | Bulk provisioning abuse | Medium | Rate limiting, monitoring, access control |
| R8 | Customer data segregation failures | High | Galvanic tenant separation, role-based access, penetration testing |
| R9 | LLM hallucination in NLQ | High | Guardrails, no external data, output validation, audit logging |
| R10 | Multiple frontend consolidation complexity | Medium | Incremental migration, shared component library |
| R11 | Kafka/Clickhouse operational complexity | Medium | Docker Desktop for dev, managed services for production |
| R12 | Keycloak migration from hardcoded auth | Medium | Document migration path, parallel running period |
| R13 | Lack of internal logistics software expertise | Medium | Ioto consultancy offering, Alpal-specific onboarding |
| R14 | Justifying IoT cost on low-value packaging assets | Medium | Phase 2 product tracking (temperature, humidity) for added value |

---

## 26. Open Questions

| # | Question | Context | Decision Needed By |
|---|----------|---------|-------------------|
| OQ-1 | Session history depth beyond 7 days live? | CMP architecture — 90 days detailed currently specified | Sprint 1 |
| OQ-2 | Specific TPS rate limits per tenant? | API abuse prevention — depends on Ericsson API capacity | Sprint 2 |
| OQ-3 | Ericsson API concurrent request limits? | Unknown — requires testing | Sprint 2 |
| OQ-4 | Exact customer portal feature set per tenant? | Configurable visibility — need default template | Sprint 3 |
| OQ-5 | Natural language filtering UX for ambiguous queries? | Fallback: inline result cards or clarification prompt? | Sprint 6 |
| OQ-6 | Rate card storage — still needed if no invoicing in platform? | Export-only billing model may not need rate cards | Sprint 7 |
| OQ-7 | eSIM (EID) support scope for Phase 1? | Depends on Alpal's device shortlist | Sprint 2 |
| OQ-8 | Multi-language support priority? | Alpal operates in Scandinavia + Netherlands | Sprint 3 |
| OQ-9 | BLE gateway integration timeline? | Phase 2 — but may need architecture consideration in Phase 1 | Sprint 1 |
| OQ-10 | Specific packaging regulation deadlines? | Affects compliance feature priority | Sprint 4 |

---

## 27. Action Items

| # | Owner | Action | Priority | Sprint |
|---|-------|--------|----------|--------|
| A-01 | Tarik | Create `ioto-fmp` GitHub repository | Critical | Pre-Sprint |
| A-02 | Tarik | Set up Docker Compose development stack | Critical | Sprint 1 |
| A-03 | Tarik | Deploy Keycloak instance and configure realms | Critical | Sprint 1 |
| A-04 | Tarik | Identify relevant session fields to expose in API | High | Sprint 1 |
| A-05 | Tarik | Build Pan-European test device fleet | Medium | Sprint 2 |
| A-06 | Tarik | Deploy Clickhouse implementation | High | Sprint 1 |
| A-07 | Dev Team | Add customer ID column to SIM/device tables | High | Sprint 1 |
| A-08 | Dev Team | Implement customer filtering across views | High | Sprint 2 |
| A-09 | Dev Team | Create "Live Session" box for SIM detail | Medium | Sprint 2 |
| A-10 | Dev Team | Implement bulk provisioning with Kafka progress | High | Sprint 5 |
| A-11 | Dev Team | Fix dashboard cosmetic issues | Low | Sprint 2 |
| A-12 | Dev Team | Add rate card storage schema | Medium | Sprint 7 |
| A-13 | Product | Define AI-based anomaly detection for API abuse | Low | Sprint 6 |
| A-14 | Bianca | Confirm shortlisted device specifications | High | ASAP |
| A-15 | Bianca | Notify when connectivity testing complete | High | Post-testing |
| A-16 | Both | Schedule Netherlands meeting for deeper collaboration | Medium | Q1 2026 |

---

## 28. Glossary

| Term | Definition |
|------|------------|
| **APN** | Access Point Name — gateway between mobile network and internet |
| **BLE** | Bluetooth Low Energy — short-range wireless protocol for sensors |
| **CCR** | Credit Control Request — Diameter protocol message for session control |
| **CDR** | Call Detail Record — billing record for a data session |
| **Clickhouse** | Column-oriented OLAP database for real-time analytics |
| **CMP** | Connectivity Management Platform — SIM/connectivity management |
| **CoAP** | Constrained Application Protocol — lightweight IoT protocol |
| **DMP** | Device Management Platform — device lifecycle management |
| **EMQX** | Open-source MQTT broker for IoT |
| **EID** | Embedded SIM Identifier — unique ID for eSIM profiles |
| **eSIM** | Embedded SIM — programmable SIM built into device |
| **FMP** | Fleet Management Platform — CMP + DMP + Asset Management combined |
| **FR** | Functional Requirement |
| **Galvanic Separation** | Complete data/infrastructure isolation between tenants |
| **Geozone** | A defined geographic area used for asset status inference |
| **GeoJSON** | JSON format for encoding geographic data structures |
| **HLR** | Home Location Register — telecom database of subscriber info |
| **ICCID** | Integrated Circuit Card Identifier — SIM card unique ID (19-20 digits) |
| **IMEI** | International Mobile Equipment Identity — device unique ID (15 digits) |
| **IMSI** | International Mobile Subscriber Identity — subscriber ID (15 digits) |
| **IoT** | Internet of Things |
| **JT** | Jersey Telecom — Ioto's connectivity partner |
| **Kafka** | Apache Kafka — distributed event streaming platform |
| **Keycloak** | Open-source identity and access management |
| **KML** | Keyhole Markup Language — XML format for geographic data |
| **KI** | Authentication key for SIM card security |
| **Leaflet** | Open-source JavaScript library for interactive maps |
| **LTE-M** | Long-Term Evolution for Machines — low-power cellular IoT |
| **LwM2M** | Lightweight Machine-to-Machine — device management protocol |
| **MCC** | Mobile Country Code — 3-digit country identifier in PLMN |
| **MNO** | Mobile Network Operator (e.g., Vodafone, Deutsche Telekom) |
| **MNC** | Mobile Network Code — 2-3 digit network identifier in PLMN |
| **MQTT** | Message Queuing Telemetry Transport — lightweight IoT messaging protocol |
| **MSISDN** | Mobile Station International Subscriber Directory Number — phone number |
| **NB-IoT** | Narrowband IoT — low-power wide-area cellular technology |
| **NFR** | Non-Functional Requirement |
| **NLQ** | Natural Language Query |
| **OIDC** | OpenID Connect — authentication layer on top of OAuth 2.0 |
| **OPC** | Operator key for SIM card authentication |
| **PDP** | Packet Data Protocol — data session context in mobile networks |
| **Pinia** | State management library for Vue 3 |
| **PLMN** | Public Land Mobile Network — identified by MCC + MNC |
| **PostGIS** | PostgreSQL extension for geographic objects |
| **PUK** | PIN Unlock Key — used to unlock a blocked SIM |
| **RBAC** | Role-Based Access Control |
| **SIM** | Subscriber Identity Module |
| **SLA** | Service Level Agreement |
| **SSO** | Single Sign-On |
| **Tenant** | Primary Ioto customer (e.g., Alpal) — uses FMP platform |
| **Sub-Customer** | Tenant's end customer (e.g., Nestle, IKEA, Bosch) |
| **Telemetry** | Automated measurement and wireless transmission of data |
| **TPS** | Transactions Per Second |
| **TTL** | Time To Live — expiration duration for cached data |
| **WebSocket** | Protocol for full-duplex communication over TCP |

---

## FR Traceability Summary

| Category | FR Range | Count | Critical | High | Medium |
|----------|----------|-------|----------|------|--------|
| Platform Architecture & Security | FR-100 | 6 | 5 | 1 | 0 |
| Device Management | FR-200 | 8 | 1 | 6 | 1 |
| SIM Card Management | FR-300 | 7 | 1 | 5 | 1 |
| Customer Dashboard | FR-400 | 8 | 3 | 5 | 0 |
| Geozone & Geofencing | FR-500 | 5 | 1 | 3 | 1 |
| Alert Management | FR-600 | 8 | 1 | 5 | 2 |
| Natural Language Query | FR-700 | 8 | 2 | 4 | 2 |
| Device-Asset Association | FR-800 | 5 | 1 | 4 | 0 |
| Integration & Connectivity | FR-900 | 6 | 2 | 4 | 0 |
| Financial Analytics | FR-1000 | 4 | 0 | 0 | 4 |
| **TOTAL** | | **65** | **17** | **37** | **11** |

---

*Document generated from Alpal business requirements, Alpal code requirements, and Ioto CMP technical planning documents. All 47 interview decisions incorporated. All 65 functional requirements from source documents included with acceptance criteria. Review and validate with all stakeholders before development.*

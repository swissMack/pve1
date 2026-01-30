# Ioto CMP/FMP Platform - Development Requirements Document

**Generated From**: Technical Planning Meeting Transcript  
**Date**: January 2025  
**Version**: 1.0  
**Status**: Draft for Development Team Review

---

## Executive Summary

This document captures technical requirements for the Ioto Communications Connectivity Management Platform (CMP) and Fleet Management Platform (FMP). The meeting established architecture decisions around state machine design, multi-tenancy, usage analytics, bulk provisioning, and API design. Key decisions include separating SIM and device state machines, implementing flexible labeling over rigid states, using Kafka for asynchronous communication, and Clickhouse for time-series usage data.

### Key Decisions Made
- SIM state machine and device state machine to remain **independent and simple**
- Implement **flexible labeling mechanism** for operational/commercial categorization
- Use **Kafka** for bidirectional tenant communication and event streaming
- Use **Clickhouse** for usage analytics and session tracking
- **No invoice generation** for tenant sub-customers (export data only)

---

## 1. State Machine Architecture

### 1.1 SIM Card State Machine

**Requirement**: Implement a dedicated SIM card lifecycle state machine independent of device state.

| State | Description |
|-------|-------------|
| Inactive | SIM provisioned but not active |
| Active | SIM enabled for connectivity |
| Suspended | Temporarily disabled |
| Terminated | End of lifecycle |

**Design Principles**:
- Keep state transitions simple and predictable
- State machine must not be "broken" regardless of what is sold (device-only, SIM-only, or bundled)
- Avoid mixing operational states (warehouse/field) with commercial states (active/suspended)

### 1.2 Device State Machine

**Requirement**: Implement a dedicated device lifecycle state machine independent of SIM state.

**Design Principles**:
- Device state should reflect device lifecycle, not connectivity status
- Device can communicate via multiple connectivity methods (cellular, WiFi, LoRa)
- Device "active" state is independent of SIM "active" state

### 1.3 State Machine Coupling (FMP Mode)

**Requirement**: When both SIM and device management are sold together (FMP vision), implement a **third coordination layer** that manages relationships between the two state machines.

**Rules**:
- If SIM is offline/inactive, device may still be active (via WiFi or other connectivity)
- Coordination layer handles billing links between device and SIM
- Implement as "Lego bricks" - modular components that can operate independently or together

### 1.4 Labeling System

**Requirement**: Implement a flexible labeling/tagging mechanism separate from state machines.

**Purpose**: Allow customers to categorize SIMs/devices for operational purposes without polluting state machine logic.

**Implementation Options** (in order of preference):
1. **Customer-defined labels** - Free text fields that customers populate
2. **Predefined dropdowns** - Common labels populated into selection menus
3. **AI-searchable tags** - Enable natural language queries across labels

**Use Cases**:
- Warehouse vs. Field location tracking
- Customer segmentation (e.g., "Bosch", "Customer A")
- Device categories (refurbishing, standby, deployed)

**Governance**: Consider consultancy/onboarding process to help customers set up labeling correctly.

---

## 2. Multi-Tenancy & Customer Segmentation

### 2.1 Tenant Architecture

**Requirement**: Implement galvanic separation between tenants via dedicated tenant instances.

| Level | Description | Example |
|-------|-------------|---------|
| Tenant | Primary customer of Ioto | Alpha (LPL) |
| Sub-Customer | Customer's end customer | Bosch, Dyer, 3M |

**Critical Constraint**: We are **NOT** building an ERP system for tenant sub-customers.

### 2.2 Customer Segmentation Features

**Requirement**: Enable tenants to segment their SIM/device fleet by their own customers.

**Implementation**:
1. Add **customer ID column** to SIM card and device tables
2. Enable filtering by customer across all views
3. Customer assignment during SIM provisioning

**User Roles**:
| Role | Access |
|------|--------|
| Super Admin (Tenant) | Access to all customer segments, can switch views |
| Customer User | Limited view to assigned SIMs/devices only |
| Viewer | Read-only access to assigned segments |

### 2.3 Customer Login Portal

**Requirement**: Allow tenant's customers to log into CMP with limited visibility.

**Specific Case (Alpha/LPL)**: 
- Customer sees **devices only** (no SIM data visibility)
- Customer cannot see usage/billing data
- Tenant (Bianca) controls what customers can access

**Settings Implementation**:
- Extend user role system under Settings
- Add "Customer" role type
- Assign specific SIM/device pools to customer role

---

## 3. Dashboard & Analytics

### 3.1 Main Dashboard Components

**Requirement**: Implement tenant-level dashboard with aggregated metrics.

| Component | Description | Data Source |
|-----------|-------------|-------------|
| Total SIMs | Count by state (Active, Inactive, Suspended) | SIM inventory |
| Live Sessions | Currently active data sessions | Clickhouse real-time |
| Average Consumption | Per-SIM average data usage | Mediation rollup |
| Estimated Cost | Projected next bill (data only, excl. access charges) | Rating engine |
| Top Carriers | Network distribution by traffic or cost | CDR aggregation |
| Device Traffic | Data consumption by device | Device telemetry |

### 3.2 Consumption Analytics Page

**Requirement**: Build detailed consumption analytics view.

**Features**:
- Filter by time period (24hr, 7 days, 30 days, monthly, yearly)
- Filter by customer (sub-customer segmentation)
- Drill-down from aggregate to individual SIM/device
- Export capability for customer billing

### 3.3 Carrier Cost Breakdown

**Requirement**: Add cost-per-network breakdown feature.

**Implementation**:
- Click on "Top Carriers" widget
- Display list of all networks with associated costs
- Cost calculated based on tenant's rate card
- Rate card stored per period (quarterly/monthly/annually)

### 3.4 Dashboard Cosmetic Items

**Tasks**:
- Remove ghost icons in top-right of metric boxes (or make them functional)
- Align figures within boxes (currently left-aligned, should be balanced)
- Implement hover intensity increase on icons

---

## 4. Session & Usage Tracking

### 4.1 Data Architecture

**Technology Stack**:
- **Kafka**: Event streaming for session updates
- **Clickhouse**: Time-series database for usage analytics

### 4.2 Session Data Model

**Requirement**: Implement session tracking separate from CDR billing records.

**Session Rollup Event** (emitted on each update):
```
{
  session_id: string,
  iccid: string,
  event_timestamp: datetime,
  mcc_mnc: string → translate to network_name,
  radio_access_type: string → translate to readable format,
  ip_address: string,
  total_bytes_in: number,
  total_bytes_out: number,
  request_type: "UPDATE" | "TERMINATE",
  cell_id: string
}
```

**Fields to Expose** (filter internal fields):
- Session ID
- Timestamp
- Network Name (not raw MCC/MNC)
- Radio Access Type (translated)
- IP Address
- Bytes In/Out

**Fields to Hide**:
- Command codes
- Internal identifiers
- Rating groups

### 4.3 Clickhouse Table Structure

**Table Types**:
1. **Replacing Merge Tree**: Live session state (latest rollup)
2. **Aggregating Tables**: 
   - MC Network Day
   - MC Network Month  
   - MC Network Year (rolling aggregation)

**TTL**: 7 days on live session data

### 4.4 Live Session View

**Requirement**: Display real-time session information.

**Implementation**:
- New widget/box showing current live session for selected SIM
- Indicates online/offline status
- Shows current network, IP, byte counters
- Updates based on mediation push frequency (e.g., every 5 minutes)

### 4.5 Session History

**Requirement**: Provide searchable session history.

**Features**:
- Last 7 days of session data
- Searchable by ICCID
- Filterable by MCC/MNC
- List format (not graph) for troubleshooting

**Location**: 
- SIM Card detail popup (summary view)
- Separate "Session History" page (detailed view)

### 4.6 CDR vs Session View Distinction

| View | Purpose | Use Case |
|------|---------|----------|
| CDR View | Billing/Financial | "How much will I pay?" |
| Session View | Troubleshooting/Operational | "What is this SIM doing?" |

**Decision**: Move "Usage Details" table from Consumption Analytics page to SIM Card popup as "Session Log".

---

## 5. SIM Card Management

### 5.1 SIM Card List View

**Requirement**: Enhance SIM card table with additional columns.

**Required Columns**:
- ICCID
- MSISDN
- State (from state machine)
- Customer (sub-customer assignment)
- Labels/Tags
- Last Activity
- Network (current)

### 5.2 SIM Card Detail Popup

**Requirement**: Expand SIM card detail view with session information.

**Components**:
1. **Basic Info**: ICCID, MSISDN, State, Customer assignment
2. **Live Session Box**: 
   - Online/Offline indicator
   - Current network
   - Current IP
   - Current byte counters
3. **Session History**: Pre-filtered view of recent sessions for this SIM
4. **Location Update Button**: Trigger network location refresh

---

## 6. Bulk Provisioning

### 6.1 Bulk Operations Interface

**Requirement**: Enable bulk state changes via file upload.

**Workflow**:
1. User uploads CSV/Excel file with ICCID list and target action
2. System validates file format and readability
3. System cross-references against inventory
4. System reports pre-validation results (already provisioned, invalid IDs, etc.)
5. User confirms or cancels
6. System executes bulk operation asynchronously
7. System provides progress feedback

### 6.2 File Validation

**Pre-execution Checks**:
- File format validation (CSV/Excel)
- Column mapping verification
- ICCID format validation
- Cross-reference with inventory
- State transition validity check

**Validation Response**:
```
{
  valid_records: number,
  invalid_records: number,
  already_in_state: number,
  errors: [
    { row: number, iccid: string, reason: string }
  ]
}
```

### 6.3 Progress Tracking

**Requirement**: Implement real-time progress feedback for bulk operations.

**Display Elements**:
- Total items in batch
- Items processed (X of Y)
- Estimated time remaining
- Current status (Validating, Processing, Complete, Failed)
- Success/failure breakdown

**Technical Implementation**:
- Use Kafka for asynchronous status updates
- AI reads Kafka queue and reports status in natural language
- Provide "heartbeat" indication that system is working

### 6.4 User Notification

**Requirement**: Notify users of bulk operation completion.

**Options**:
- In-app notification
- Email summary with results
- Desktop browser notification (if enabled)

### 6.5 Priority/Ordering

**Requirement**: Respect row order in uploaded file for processing priority.

**Rationale**: Users expect first rows in CSV to be processed first for urgent items.

### 6.6 Access Control

**Requirement**: Bulk provisioning must be restricted to authorized users.

**Implementation**:
- Super user / Admin role only
- Prevent junior employees from bulk operations
- Audit logging for all bulk actions

---

## 7. API Design

### 7.1 Remote Provisioning API

**Requirement**: Expose REST API for programmatic SIM management.

**Endpoint Design**:
- Single endpoint accepts one or more ICCIDs
- Always use bulk-capable interface internally
- No separate single-item endpoint

```
POST /api/v1/sims/provision
{
  "iccids": ["89...001", "89...002", ...],
  "action": "ACTIVATE" | "SUSPEND" | "TERMINATE",
  "options": {}
}
```

### 7.2 API Abuse Prevention

**Requirement**: Detect and prevent API misuse patterns.

**Misuse Patterns**:
- Calling single-provision endpoint in rapid loops (instead of bulk)
- Excessive requests from single tenant
- Seasonal spikes blocking other tenants

**Mitigation Strategy**:
1. **Sample and Hold**: Queue incoming requests before processing
2. **Batch Detection**: Identify rapid single requests and auto-batch
3. **Tenant Isolation**: Dedicated executor threads per tenant (prevents blocking)
4. **AI Monitoring**: Detect abnormal patterns and alert
5. **Feedback**: Return warning in API response suggesting bulk endpoint

### 7.3 Rate Limiting

**Requirement**: Implement rate limiting to protect backend systems.

**Known Bottleneck**: Ericsson HLR API will be slowest in chain.

**Implementation**:
- Per-tenant request limits
- Queue-based processing to smooth spikes
- Graceful degradation with estimated wait times

---

## 8. Billing & Invoicing

### 8.1 Tenant Invoicing

**Requirement**: Generate invoices for tenants (our direct customers).

**Data Flow**:
- Roll up usage data by tenant
- Push to ERP Next
- Invoice itemized with: data consumption, professional services, etc.

**Dimension**: Tenant level only (not sub-customer level)

### 8.2 Customer Data Export

**Requirement**: Enable tenants to bill their own customers.

**Implementation**:
- Roll up usage data by **Customer ID** (sub-customer dimension)
- Export as CSV/Excel
- Optionally expose via API

**Scope**: 
- Raw data export only
- We do NOT generate invoices on behalf of tenant's customers
- This is tenant's responsibility in their own ERP

### 8.3 Rate Card Management

**Requirement**: Store and manage rate cards per tenant.

**Storage**:
- Rate card stored in FMP per billing period
- Period can be: monthly, quarterly, annually
- Schema must support rate card updates

**Note**: Rate card for JT (our supplier) is separate from tenant rate cards.

---

## 9. Support & Documentation

### 9.1 Support Page Redesign

**Requirement**: Restructure support page with AI assistant prominently featured.

**Layout**:
1. **Large AI Chat Box** (top, prominent like Claude/ChatGPT interface)
2. **Service Manager Link** (prominent)
3. **Report Bug / Ask for Help** buttons
4. **Documentation** (table of contents below)
5. **API Documentation Link** (Swagger)

### 9.2 Documentation Content

**Required Sections**:
- User guide (living document)
- State machine diagrams
- API reference
- Glossary of terms

### 9.3 AI Assistant (Bob) Integration

**Capabilities**:
- Natural language search of documentation
- Query system status
- Help with troubleshooting
- Answer "how do I..." questions

---

## 10. Demo & Testing Tools

### 10.1 CDR Simulation Tool

**Requirement**: Enable simulation of usage records for demos/testing.

**Features**:
- Specify number of ICCIDs to generate
- Set date range for records
- Configure byte range (min/max)
- Batch generation and submission
- Records appear in dashboard analytics

**Implementation**: Already built as Open API JSON tool on upcloud server.

### 10.2 Device Simulation Tool

**Requirement**: Simulate device telemetry for demos.

**Features**:
- Generate temperature, humidity, battery, light readings
- GPS location data for vehicle trackers
- Push to MQTT
- Reflect in device dashboard

### 10.3 Test Device Fleet

**Action Required**: Create larger test device set covering multiple countries.

**Coverage Needed**:
- Denmark, Norway, Sweden, Netherlands, Germany (Pan-European)
- Roaming on various carriers (DT, Vodafone, etc.)
- All using JT SIM cards

**Physical Devices**: Purchase low-cost GPS/temp monitors from AliExpress (~20 CHF) for real device testing.

---

## 11. Technical Infrastructure

### 11.1 Event Architecture

**Technology**: Apache Kafka

**Topics**:
- Session rollups
- State change events
- Bulk operation progress
- Tenant notifications

**Benefits**:
- Fully asynchronous communication
- Bidirectional tenant communication
- Decoupled services
- Built-in event replay

### 11.2 Time-Series Database

**Technology**: Clickhouse

**Use Cases**:
- Live session tracking
- Usage analytics
- Historical reporting

**Table Engines**:
- Replacing Merge Tree (live state)
- Aggregating Merge Tree (rollups)
- Materialized Views (automatic aggregation)

### 11.3 Authentication

**Technology**: Keycloak

**Integration**: Already configured on upcloud server.

---

## 12. Action Items

| Owner | Action | Priority | Dependencies |
|-------|--------|----------|--------------|
| Tarik | Identify relevant session fields to expose in API | High | - |
| Tarik | Build larger Pan-European test device fleet | Medium | JT SIMs |
| Tarik | Deploy Clickhouse implementation to upcloud | High | - |
| Dev Team | Add customer ID column to SIM/device tables | High | Schema design |
| Dev Team | Implement customer filtering across views | High | Customer ID column |
| Dev Team | Create "Live Session" box for SIM detail popup | Medium | Clickhouse API |
| Dev Team | Move Usage Details to Session History page | Low | UX decision |
| Dev Team | Implement bulk provisioning progress tracking | High | Kafka setup |
| Dev Team | Remove/fix ghost icons on dashboard boxes | Low | - |
| Dev Team | Add rate card storage schema | Medium | ERP integration |
| Product | Define AI-based anomaly detection for API abuse | Low | AI integration |

---

## 13. Open Questions

1. **Session History Depth**: How much history to retain beyond 7 days?
2. **Rate Limiting Values**: What specific TPS limits per tenant?
3. **Ericsson API Capacity**: Concurrent request limits unknown - requires testing
4. **Customer Portal Scope**: Exact feature set for customer-facing login?
5. **Natural Language Filtering**: Integrate AI search into main data views?

---

## 14. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Scope creep into ERP functionality | High | Strict boundary: no sub-customer invoicing |
| Ericsson API bottleneck | High | Queue-based processing, tenant isolation |
| Complex state machine coupling | Medium | Keep SIM/device state machines simple and independent |
| Bulk provisioning abuse | Medium | Rate limiting, monitoring, user education |
| Customer data segregation failures | High | Galvanic tenant separation, role-based access |

---

## Appendix: Glossary

| Term | Definition |
|------|------------|
| CMP | Connectivity Management Platform |
| FMP | Fleet Management Platform (CMP + Device Management) |
| Tenant | Primary Ioto customer (e.g., Alpha/LPL) |
| Sub-Customer | Tenant's end customer (e.g., Bosch) |
| CDR | Call Detail Record (billing record) |
| CCR | Credit Control Request (diameter message) |
| Session | Active data connection for a SIM |
| Rate Card | Pricing structure per network/service |
| MCC/MNC | Mobile Country Code / Mobile Network Code |

---

*Document generated from technical planning session transcript. Review and validate requirements with all stakeholders before development.*

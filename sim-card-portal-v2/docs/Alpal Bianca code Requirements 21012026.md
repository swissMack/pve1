

---

## 11. Development Tasks Breakdown

### 11.1 Platform Architecture & Infrastructure

| Task ID  | Task                                                              | Priority    | Estimate | Dependencies       |
| -------- | ----------------------------------------------------------------- | ----------- | -------- | ------------------ |
| ARCH-001 | Design multi-tenant data architecture for customer isolation      | 🔴 Critical | 3 days   | None               |
| ARCH-002 | Implement role-based access control (RBAC) system                 | 🔴 Critical | 5 days   | ARCH-001           |
| ARCH-003 | Create two-tier login system (Super User / Customer / Both modes) | 🔴 Critical | 3 days   | ARCH-002           |
| ARCH-004 | Set up customer/project grouping data model                       | 🟠 High     | 2 days   | ARCH-001           |
| ARCH-005 | Implement data filtering layer to restrict customer view          | 🔴 Critical | 3 days   | ARCH-002, ARCH-003 |

### 11.2 Device Management Module (Alpal Internal View)

| Task ID | Task | Priority | Estimate | Dependencies |
|---------|------|----------|----------|--------------|
| DEV-001 | Create device list view with status indicators (active/offline/maintenance) | 🔴 Critical | 3 days | ARCH-001 |
| DEV-002 | Implement device grouping by customer/project with filter UI | 🟠 High | 2 days | ARCH-004, DEV-001 |
| DEV-003 | Build signal strength monitoring widget | 🟠 High | 2 days | DEV-001 |
| DEV-004 | Build battery level tracking widget | 🟠 High | 2 days | DEV-001 |
| DEV-005 | Display last report timestamp on device cards | 🟡 Medium | 1 day | DEV-001 |
| DEV-006 | Create network attachment/detachment log view | 🟠 High | 3 days | DEV-001 |
| DEV-007 | Implement device detail popup/modal with full telemetry | 🟠 High | 2 days | DEV-001 |
| DEV-008 | Add device map view with status-based markers | 🟠 High | 3 days | DEV-001 |

### 11.3 SIM Card Management Module (Alpal Internal View)

| Task ID | Task | Priority | Estimate | Dependencies |
|---------|------|----------|----------|--------------|
| SIM-001 | Create SIM card list view with carrier identification | 🔴 Critical | 2 days | ARCH-001 |
| SIM-002 | Display MSISDN, ICCID, IMSI in SIM detail view | 🟠 High | 1 day | SIM-001 |
| SIM-003 | Build network session history log view | 🟠 High | 3 days | SIM-001 |
| SIM-004 | Implement data consumption tracking dashboard | 🟠 High | 3 days | SIM-001 |
| SIM-005 | Create roaming network visibility map/table | 🟠 High | 2 days | SIM-001 |
| SIM-006 | Build SIM-to-device association view | 🟠 High | 2 days | SIM-001, DEV-001 |
| SIM-007 | Add SIM grouping by customer/project | 🟡 Medium | 2 days | ARCH-004, SIM-001 |

### 11.4 Customer Dashboard (Asset Tracking View)

| Task ID | Task | Priority | Estimate | Dependencies |
|---------|------|----------|----------|--------------|
| CUST-001 | Create customer-facing dashboard layout (device data hidden) | 🔴 Critical | 3 days | ARCH-005 |
| CUST-002 | Build total asset count summary widget | 🔴 Critical | 1 day | CUST-001 |
| CUST-003 | Implement asset location map with drill-down capability | 🔴 Critical | 5 days | CUST-001 |
| CUST-004 | Create status indicators (at facility / at supplier / in transit) | 🟠 High | 2 days | CUST-001 |
| CUST-005 | Build geozone summary boxes (warehouse count, transit count, etc.) | 🟠 High | 3 days | CUST-001, GEO-001 |
| CUST-006 | Create asset detail view with metadata (birth date, composition, trips, age) | 🟠 High | 3 days | CUST-001 |
| CUST-007 | Implement trip count tracking and display | 🟠 High | 2 days | CUST-006 |
| CUST-008 | Add recycled content percentage field (regulatory compliance) | 🟠 High | 1 day | CUST-006 |

### 11.5 Geozone & Geofencing

| Task ID | Task | Priority | Estimate | Dependencies |
|---------|------|----------|----------|--------------|
| GEO-001 | Implement geozone creation and management UI | 🟠 High | 4 days | ARCH-001 |
| GEO-002 | Build geozone visualization on map (color-coded) | 🟠 High | 2 days | GEO-001, CUST-003 |
| GEO-003 | Create geozone entry/exit event detection engine | 🔴 Critical | 4 days | GEO-001 |
| GEO-004 | Implement geozone-based asset status inference | 🟠 High | 3 days | GEO-003 |
| GEO-005 | Add responsibility transfer logic based on geozone | 🟡 Medium | 2 days | GEO-003 |

### 11.6 Alert Management System

| Task ID | Task | Priority | Estimate | Dependencies |
|---------|------|----------|----------|--------------|
| ALERT-001 | Design alert data model and storage | 🟠 High | 2 days | ARCH-001 |
| ALERT-002 | Implement geofence breach alert generation | 🟠 High | 2 days | GEO-003, ALERT-001 |
| ALERT-003 | Create expected arrival date violation alerts | 🟠 High | 3 days | ALERT-001 |
| ALERT-004 | Build alert management dashboard (not just email) | 🔴 Critical | 4 days | ALERT-001 |
| ALERT-005 | Implement alert status workflow (pending → resolved / overdue) | 🟠 High | 2 days | ALERT-004 |
| ALERT-006 | Create alert summary widgets (pie chart: resolved/pending/overdue) | 🟠 High | 2 days | ALERT-004 |
| ALERT-007 | Add email notification integration for alerts | 🟡 Medium | 2 days | ALERT-001 |
| ALERT-008 | Implement alert filtering and search | 🟡 Medium | 2 days | ALERT-004 |

### 11.7 Natural Language Query System

| Task ID | Task | Priority | Estimate | Dependencies |
|---------|------|----------|----------|--------------|
| NLQ-001 | Design NLQ-to-filter translation architecture | 🟠 High | 3 days | None |
| NLQ-002 | Implement "Ask Bob" input field across all dashboard pages | 🟠 High | 2 days | NLQ-001 |
| NLQ-003 | Build query parser to update dashboard filters (not chat response) | 🔴 Critical | 5 days | NLQ-001, NLQ-002 |
| NLQ-004 | Create preset/saved queries functionality | 🟠 High | 3 days | NLQ-003 |
| NLQ-005 | Implement tabbed view system for saved queries | 🟠 High | 2 days | NLQ-004 |
| NLQ-006 | Add create/save/delete custom view tabs UI | 🟠 High | 2 days | NLQ-005 |
| NLQ-007 | Implement CSV export from query results | 🟡 Medium | 2 days | NLQ-003 |
| NLQ-008 | Build email generation for support escalation | 🟡 Medium | 2 days | NLQ-003 |
| NLQ-009 | Restrict LLM to internal data only (no hallucination/external data) | 🔴 Critical | 2 days | NLQ-001 |

### 11.8 Device-Asset Association

| Task ID | Task | Priority | Estimate | Dependencies |
|---------|------|----------|----------|--------------|
| ASSOC-001 | Design device-to-asset mapping data model | 🔴 Critical | 2 days | ARCH-001 |
| ASSOC-002 | Build bulk device-asset association UI (at scale) | 🟠 High | 4 days | ASSOC-001 |
| ASSOC-003 | Create rules engine for device vs. asset behavior separation | 🟠 High | 5 days | ASSOC-001 |
| ASSOC-004 | Implement one-to-one device-asset attribution logic | 🟠 High | 2 days | ASSOC-001 |
| ASSOC-005 | Build asset view that inherits location from associated device | 🟠 High | 2 days | ASSOC-004 |

### 11.9 Integration & Connectivity

| Task ID | Task | Priority | Estimate | Dependencies |
|---------|------|----------|----------|--------------|
| INT-001 | Implement MQTT broker integration for device telemetry | 🔴 Critical | 4 days | None |
| INT-002 | Build mediation layer for charging data ingestion | 🟠 High | 4 days | INT-001 |
| INT-003 | Create API endpoints for data export | 🟠 High | 3 days | ARCH-001 |
| INT-004 | Integrate with Jersey Telecom/Ioto connectivity backend | 🔴 Critical | 3 days | INT-001 |
| INT-005 | Ensure compatibility with Onomondo platform | 🟠 High | 2 days | INT-001 |
| INT-006 | Pre-integrate Alpal's shortlisted devices | 🟠 High | 3 days | INT-001 |

### 11.10 Financial & Usage Analytics (Alpal Internal)

| Task ID | Task | Priority | Estimate | Dependencies |
|---------|------|----------|----------|--------------|
| FIN-001 | Build consumption trend visualization | 🟡 Medium | 3 days | SIM-004 |
| FIN-002 | Create traffic heatmap by geo-location | 🟡 Medium | 3 days | SIM-005 |
| FIN-003 | Implement CDR (Call Detail Record) view | 🟡 Medium | 2 days | INT-002 |
| FIN-004 | Build monthly cost trend graph | 🟡 Medium | 2 days | INT-002 |

---

## 12. Development Task Summary

### By Priority

| Priority | Count | Total Estimate |
|----------|-------|----------------|
| 🔴 Critical | 18 | ~58 days |
| 🟠 High | 38 | ~98 days |
| 🟡 Medium | 12 | ~22 days |
| **Total** | **68** | **~178 days** |

### Recommended Sprint Groupings

#### Sprint 1: Foundation (Weeks 1-3)
- ARCH-001, ARCH-002, ARCH-003, ARCH-004, ARCH-005
- DEV-001, SIM-001
- ASSOC-001
- INT-001

#### Sprint 2: Core Device & SIM Management (Weeks 4-6)
- DEV-002 through DEV-008
- SIM-002 through SIM-007
- INT-004, INT-005

#### Sprint 3: Customer Dashboard & Maps (Weeks 7-9)
- CUST-001 through CUST-008
- GEO-001, GEO-002, GEO-003

#### Sprint 4: Geofencing & Alerts (Weeks 10-12)
- GEO-004, GEO-005
- ALERT-001 through ALERT-008

#### Sprint 5: Device-Asset Association & Rules (Weeks 13-14)
- ASSOC-002 through ASSOC-005

#### Sprint 6: Natural Language Query (Weeks 15-17)
- NLQ-001 through NLQ-009

#### Sprint 7: Analytics & Polish (Weeks 18-19)
- FIN-001 through FIN-004
- INT-003, INT-006

### Critical Path Items
1. Multi-tenant architecture (ARCH-001) blocks everything
2. RBAC system (ARCH-002) blocks user-specific views
3. MQTT integration (INT-001) blocks all live device data
4. Data filtering layer (ARCH-005) blocks customer dashboard
5. NLQ dashboard filter mode (NLQ-003) is key differentiator feature

---

## 13. Phase 2 Development Tasks (Future Backlog)

| Task ID | Task | Priority | Estimate | Notes |
|---------|------|----------|----------|-------|
| P2-001 | Temperature monitoring sensor integration | 🟡 Medium | 5 days | Requires BLE gateway work |
| P2-002 | Humidity tracking sensor integration | 🟡 Medium | 3 days | Requires BLE gateway work |
| P2-003 | BLE beacon to pallet gateway communication | 🟠 High | 8 days | New hardware integration |
| P2-004 | Quality certification tracking module | 🟡 Medium | 4 days | Regulatory compliance |
| P2-005 | Historical tracking and trend analysis | 🟡 Medium | 5 days | Data warehouse needed |
| P2-006 | Predictive maintenance for devices | 🟡 Medium | 8 days | ML model required |
| P2-007 | Revenue optimization insights dashboard | 🟡 Medium | 5 days | Business intelligence |

---

#development #tasks #sprint-planning #backlog


---

## 14. Functional Requirements (FR) Traceability Matrix

### FR-100: Platform Architecture & Security

| FR ID | Requirement | Priority | Related Tasks |
|-------|-------------|----------|---------------|
| FR-101 | System shall support multi-tenant architecture with complete customer data isolation | 🔴 Critical | ARCH-001 |
| FR-102 | System shall implement role-based access control (RBAC) with minimum three roles: Super User, Customer, Combined | 🔴 Critical | ARCH-002 |
| FR-103 | System shall provide separate login modes for internal users (Alpal) and external users (customers) | 🔴 Critical | ARCH-003 |
| FR-104 | System shall support grouping of devices and assets by customer/project | 🟠 High | ARCH-004 |
| FR-105 | System shall enforce data filtering to prevent customers from viewing device-level information | 🔴 Critical | ARCH-005 |
| FR-106 | Customer view shall never display: battery level, IMEI, signal strength, SIM data, network logs | 🔴 Critical | ARCH-005, CUST-001 |

### FR-200: Device Management (Internal View)

| FR ID | Requirement | Priority | Related Tasks |
|-------|-------------|----------|---------------|
| FR-201 | System shall display device list with real-time status indicators (active, offline, maintenance) | 🔴 Critical | DEV-001 |
| FR-202 | System shall allow filtering and grouping of devices by customer/project | 🟠 High | DEV-002 |
| FR-203 | System shall display signal strength for each device | 🟠 High | DEV-003 |
| FR-204 | System shall display battery level percentage for each device | 🟠 High | DEV-004 |
| FR-205 | System shall display last report timestamp for each device | 🟡 Medium | DEV-005 |
| FR-206 | System shall maintain and display network attachment/detachment logs | 🟠 High | DEV-006 |
| FR-207 | System shall provide device detail view with complete telemetry data | 🟠 High | DEV-007 |
| FR-208 | System shall display devices on interactive map with status-based markers | 🟠 High | DEV-008 |

### FR-300: SIM Card Management (Internal View)

| FR ID | Requirement | Priority | Related Tasks |
|-------|-------------|----------|---------------|
| FR-301 | System shall display SIM card list with carrier identification | 🔴 Critical | SIM-001 |
| FR-302 | System shall display MSISDN, ICCID, and IMSI for each SIM | 🟠 High | SIM-002 |
| FR-303 | System shall maintain and display network session history logs | 🟠 High | SIM-003 |
| FR-304 | System shall track and display data consumption per SIM | 🟠 High | SIM-004 |
| FR-305 | System shall display roaming network information on map/table | 🟠 High | SIM-005 |
| FR-306 | System shall display SIM-to-device associations | 🟠 High | SIM-006 |
| FR-307 | System shall allow grouping of SIMs by customer/project | 🟡 Medium | SIM-007 |

### FR-400: Customer Dashboard (Asset Tracking)

| FR ID | Requirement | Priority | Related Tasks |
|-------|-------------|----------|---------------|
| FR-401 | System shall provide customer-facing dashboard with no device-level data visible | 🔴 Critical | CUST-001 |
| FR-402 | System shall display total asset count summary | 🔴 Critical | CUST-002 |
| FR-403 | System shall display asset locations on interactive map with drill-down capability | 🔴 Critical | CUST-003 |
| FR-404 | System shall display asset status: at facility, at supplier, in transit | 🟠 High | CUST-004 |
| FR-405 | System shall display summary boxes by geozone (warehouse count, transit count, etc.) | 🟠 High | CUST-005 |
| FR-406 | System shall display asset metadata: birth date, composition, trip count, age | 🟠 High | CUST-006 |
| FR-407 | System shall track and display trip count per asset | 🟠 High | CUST-007 |
| FR-408 | System shall track and display recycled content percentage (regulatory compliance) | 🟠 High | CUST-008 |

### FR-500: Geozone & Geofencing

| FR ID | Requirement | Priority | Related Tasks |
|-------|-------------|----------|---------------|
| FR-501 | System shall allow creation and management of geozones | 🟠 High | GEO-001 |
| FR-502 | System shall display geozones on map with color-coding | 🟠 High | GEO-002 |
| FR-503 | System shall detect and log geozone entry/exit events in real-time | 🔴 Critical | GEO-003 |
| FR-504 | System shall infer asset status based on geozone location | 🟠 High | GEO-004 |
| FR-505 | System shall support responsibility transfer rules based on geozone | 🟡 Medium | GEO-005 |

### FR-600: Alert Management

| FR ID | Requirement | Priority | Related Tasks |
|-------|-------------|----------|---------------|
| FR-601 | System shall support configurable alert rules and storage | 🟠 High | ALERT-001 |
| FR-602 | System shall generate alerts on geofence breach | 🟠 High | ALERT-002 |
| FR-603 | System shall generate alerts on expected arrival date violations | 🟠 High | ALERT-003 |
| FR-604 | System shall provide alert management dashboard (not email-only) | 🔴 Critical | ALERT-004 |
| FR-605 | System shall support alert status workflow: pending → resolved / overdue | 🟠 High | ALERT-005 |
| FR-606 | System shall display alert summary widgets (resolved/pending/overdue counts) | 🟠 High | ALERT-006 |
| FR-607 | System shall send email notifications for alerts | 🟡 Medium | ALERT-007 |
| FR-608 | System shall support alert filtering and search | 🟡 Medium | ALERT-008 |

### FR-700: Natural Language Query (Ask Bob)

| FR ID | Requirement | Priority | Related Tasks |
|-------|-------------|----------|---------------|
| FR-701 | System shall provide natural language query input field on all dashboard pages | 🟠 High | NLQ-001, NLQ-002 |
| FR-702 | System shall update dashboard view based on natural language query (not chat response) | 🔴 Critical | NLQ-003 |
| FR-703 | System shall allow saving queries as presets | 🟠 High | NLQ-004 |
| FR-704 | System shall display saved queries as tabs | 🟠 High | NLQ-005 |
| FR-705 | System shall allow create/save/delete of custom view tabs | 🟠 High | NLQ-006 |
| FR-706 | System shall support CSV export from query results | 🟡 Medium | NLQ-007 |
| FR-707 | System shall support email generation for support escalation | 🟡 Medium | NLQ-008 |
| FR-708 | System shall restrict LLM to internal data only (no external data/hallucination) | 🔴 Critical | NLQ-009 |

### FR-800: Device-Asset Association

| FR ID | Requirement | Priority | Related Tasks |
|-------|-------------|----------|---------------|
| FR-801 | System shall maintain device-to-asset mapping data model | 🔴 Critical | ASSOC-001 |
| FR-802 | System shall support bulk device-asset association at scale | 🟠 High | ASSOC-002 |
| FR-803 | System shall implement rules engine for device vs. asset behavior | 🟠 High | ASSOC-003 |
| FR-804 | System shall enforce one-to-one device-asset attribution | 🟠 High | ASSOC-004 |
| FR-805 | System shall derive asset location from associated device | 🟠 High | ASSOC-005 |

### FR-900: Integration & Connectivity

| FR ID | Requirement | Priority | Related Tasks |
|-------|-------------|----------|---------------|
| FR-901 | System shall integrate with MQTT broker for device telemetry ingestion | 🔴 Critical | INT-001 |
| FR-902 | System shall implement mediation layer for charging data ingestion | 🟠 High | INT-002 |
| FR-903 | System shall provide API endpoints for data export | 🟠 High | INT-003 |
| FR-904 | System shall integrate with Jersey Telecom/Ioto connectivity backend | 🔴 Critical | INT-004 |
| FR-905 | System shall maintain compatibility with Onomondo platform | 🟠 High | INT-005 |
| FR-906 | System shall support pre-integration of customer-specified devices | 🟠 High | INT-006 |

### FR-1000: Financial & Usage Analytics

| FR ID | Requirement | Priority | Related Tasks |
|-------|-------------|----------|---------------|
| FR-1001 | System shall display consumption trend visualizations | 🟡 Medium | FIN-001 |
| FR-1002 | System shall display traffic heatmap by geo-location | 🟡 Medium | FIN-002 |
| FR-1003 | System shall display CDR (Call Detail Record) information | 🟡 Medium | FIN-003 |
| FR-1004 | System shall display monthly cost trend graphs | 🟡 Medium | FIN-004 |

---

## 15. FR Summary by Category

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

## 16. FR Priority Summary

### 🔴 Critical Requirements (17)

| FR ID | Requirement Summary |
|-------|---------------------|
| FR-101 | Multi-tenant data isolation |
| FR-102 | Role-based access control (RBAC) |
| FR-103 | Two-tier login system |
| FR-105 | Customer data filtering layer |
| FR-106 | Hide device data from customer view |
| FR-201 | Device list with status indicators |
| FR-301 | SIM card list with carrier ID |
| FR-401 | Customer dashboard (no device data) |
| FR-402 | Total asset count display |
| FR-403 | Asset location map with drill-down |
| FR-503 | Geozone entry/exit detection |
| FR-604 | Alert management dashboard |
| FR-702 | NLQ updates dashboard (not chat) |
| FR-708 | LLM restricted to internal data |
| FR-801 | Device-asset mapping model |
| FR-901 | MQTT integration |
| FR-904 | Jersey Telecom/Ioto integration |

### 🟠 High Priority Requirements (37)

Key groupings:
- **Device visibility**: FR-202 through FR-208 (grouping, signal, battery, logs, maps)
- **SIM visibility**: FR-302 through FR-306 (identifiers, sessions, consumption, roaming)
- **Asset tracking**: FR-404 through FR-408 (status, geozones, metadata, compliance)
- **Geofencing**: FR-501, FR-502, FR-504 (zone management, visualization, status inference)
- **Alerts**: FR-601 through FR-606 (rules, breach alerts, workflow, summaries)
- **NLQ features**: FR-701, FR-703 through FR-706 (input, presets, tabs, CRUD)
- **Associations**: FR-802 through FR-805 (bulk association, rules, attribution)
- **Integration**: FR-902, FR-903, FR-905, FR-906 (mediation, API, compatibility)

### 🟡 Medium Priority Requirements (11)

| FR ID | Requirement Summary |
|-------|---------------------|
| FR-205 | Last report timestamp display |
| FR-307 | SIM grouping by customer/project |
| FR-505 | Responsibility transfer by geozone |
| FR-607 | Email notifications for alerts |
| FR-608 | Alert filtering and search |
| FR-706 | CSV export from queries |
| FR-707 | Email generation for escalation |
| FR-1001 | Consumption trend visualization |
| FR-1002 | Traffic heatmap |
| FR-1003 | CDR display |
| FR-1004 | Monthly cost trend graphs |

---

## 17. FR to Sprint Mapping

| Sprint | Weeks | FR Coverage |
|--------|-------|-------------|
| Sprint 1: Foundation | 1-3 | FR-101 to FR-106, FR-201, FR-301, FR-801, FR-901 |
| Sprint 2: Device & SIM | 4-6 | FR-202 to FR-208, FR-302 to FR-307, FR-904, FR-905 |
| Sprint 3: Customer Dashboard | 7-9 | FR-401 to FR-408, FR-501 to FR-503 |
| Sprint 4: Geofencing & Alerts | 10-12 | FR-504, FR-505, FR-601 to FR-608 |
| Sprint 5: Device-Asset | 13-14 | FR-802 to FR-805 |
| Sprint 6: NLQ | 15-17 | FR-701 to FR-708 |
| Sprint 7: Analytics | 18-19 | FR-1001 to FR-1004, FR-902, FR-903, FR-906 |

---

#functional-requirements #FR #traceability


---

## 18. Detailed Functional Requirements Specifications

### FR-100: Platform Architecture & Security (Detailed)

---

#### FR-101: Multi-Tenant Data Architecture

**Priority:** 🔴 Critical | **Related Tasks:** ARCH-001

**User Story:**
> As a platform administrator, I need complete data isolation between customers so that Alpal's data is never visible to other platform customers and vice versa.

**Detailed Description:**
The system must implement a multi-tenant architecture where each customer (e.g., Alpal) has a completely isolated data environment. This includes separate data storage for devices, SIM cards, assets, alerts, and all telemetry data. No customer should ever be able to access, view, or query another customer's data, even through API endpoints or natural language queries.

**Acceptance Criteria:**
- [ ] Each customer has a unique tenant identifier in the database
- [ ] All database queries are scoped by tenant ID
- [ ] API endpoints validate tenant context before returning data
- [ ] Natural language queries (Ask Bob) are restricted to tenant-specific data
- [ ] Admin users cannot accidentally expose cross-tenant data
- [ ] Audit logs track all data access by tenant
- [ ] Performance testing confirms no data leakage under load

**Business Rationale:**
Alpal is entrusting sensitive logistics and asset data to the platform. Any data breach or cross-customer visibility would destroy trust and potentially violate contractual obligations.

**Technical Notes:**
- Consider row-level security in PostgreSQL or tenant-scoped schemas
- Implement tenant context middleware in API layer
- LLM queries must include tenant filter in all database calls

---

#### FR-102: Role-Based Access Control (RBAC)

**Priority:** 🔴 Critical | **Related Tasks:** ARCH-002

**User Story:**
> As an Alpal administrator, I need to assign different access levels to my team members so that device managers see different data than customer service representatives.

**Detailed Description:**
The system must implement a flexible RBAC system with at minimum three predefined roles:
1. **Super User (Alpal Internal):** Full access to devices, SIM cards, connectivity data, network logs, and all customer data
2. **Customer User:** Access only to asset tracking dashboard with no device-level information visible
3. **Combined User:** Access to both device management and asset tracking views

Additional custom roles should be configurable per tenant.

**Acceptance Criteria:**
- [ ] Three default roles are available: Super User, Customer, Combined
- [ ] Roles can be assigned to individual user accounts
- [ ] Permission checks occur on every API call and UI render
- [ ] Unauthorized access attempts are logged and blocked
- [ ] Role changes take effect immediately (no cache issues)
- [ ] Custom roles can be created with granular permissions
- [ ] Role hierarchy supports inheritance (e.g., Super User inherits all permissions)

**Business Rationale:**
Alpal needs internal staff to manage devices and connectivity while their end customers (e.g., Nestle, IKEA) only see asset locations. Mixing these views would confuse customers and expose proprietary operational data.

**Technical Notes:**
- Implement permission middleware checking role against route/resource
- Store permissions as bitmask or JSON for flexibility
- Cache role permissions with short TTL for performance

---

#### FR-103: Two-Tier Login System

**Priority:** 🔴 Critical | **Related Tasks:** ARCH-003

**User Story:**
> As a user, I need to select my login mode (internal vs. customer) so that I see the appropriate dashboard for my role.

**Detailed Description:**
The login system must support three distinct modes:
1. **Super User Login:** Presents device management and SIM card dashboards with full connectivity data
2. **Customer Login:** Presents asset tracking dashboard only, with all device/SIM data hidden
3. **Combined Login:** Presents both views with navigation between them

The login flow should:
- Authenticate user credentials
- Determine available login modes based on assigned roles
- Present mode selection if multiple modes are available
- Redirect to appropriate dashboard based on selection

**Acceptance Criteria:**
- [ ] Login page shows mode selection when user has multiple roles
- [ ] Single-role users are redirected directly to their dashboard
- [ ] Session maintains current mode throughout navigation
- [ ] Mode switching is available for Combined users without re-authentication
- [ ] Failed login attempts are rate-limited (max 5 per 15 minutes)
- [ ] Password reset flow works for all user types
- [ ] SSO integration supported for enterprise customers

**Business Rationale:**
Bianca (Alpal) needs to manage devices internally while her customers log in to track their assets. The same platform must serve both audiences with appropriate views.

**Technical Notes:**
- Store user's current mode in JWT claims or session
- Implement mode-switching endpoint for Combined users
- Consider separate subdomains for internal vs. customer access

---

#### FR-104: Customer/Project Grouping

**Priority:** 🟠 High | **Related Tasks:** ARCH-004

**User Story:**
> As an Alpal operations manager, I need to group devices and SIMs by customer project so that I can manage Nestle's assets separately from IKEA's assets.

**Detailed Description:**
The system must support hierarchical grouping of devices and assets:
- **Level 1 - Customer:** Top-level grouping (e.g., Nestle, IKEA, Breslin)
- **Level 2 - Project:** Sub-grouping within customer (e.g., "Nestle - Q1 Pilot", "Nestle - Europe Rollout")

Groups should be:
- Assignable to devices, SIM cards, and assets
- Filterable in all list views and dashboards
- Usable in natural language queries ("show me Nestle devices")
- Reportable for billing and analytics purposes

**Acceptance Criteria:**
- [ ] Customers can be created, edited, and archived
- [ ] Projects can be created under customers
- [ ] Devices can be assigned to exactly one customer/project
- [ ] SIM cards can be assigned to exactly one customer/project
- [ ] Assets inherit grouping from associated device
- [ ] Filter dropdowns appear on all relevant list views
- [ ] Bulk assignment of devices to groups is supported
- [ ] Group membership is visible in device/SIM detail views

**Business Rationale:**
Alpal will have multiple enterprise customers, each with multiple projects. Service managers need to view and report on specific customer estates without seeing other customers' data.

**Technical Notes:**
- Implement as foreign keys: device → project → customer → tenant
- Index on customer_id and project_id for query performance
- Consider soft-delete for archived groups to preserve historical data

---

#### FR-105: Customer Data Filtering Layer

**Priority:** 🔴 Critical | **Related Tasks:** ARCH-005

**User Story:**
> As the system, I must automatically filter out device-level data when a customer user is viewing the dashboard so that they never see technical information.

**Detailed Description:**
A data filtering layer must sit between the database and the customer-facing UI that automatically removes or masks the following data:
- Device identifiers (IMEI, serial numbers)
- Battery levels
- Signal strength
- SIM card information (ICCID, MSISDN, IMSI)
- Network logs and session history
- Carrier information
- Roaming data
- Technical telemetry

The filter must be applied:
- At the API response level (not just UI)
- Consistently across all endpoints
- Including exports and reports
- In natural language query results

**Acceptance Criteria:**
- [ ] Customer API responses contain zero device-level fields
- [ ] Customer exports (CSV, PDF) contain no device data
- [ ] Natural language queries cannot retrieve device information for customers
- [ ] UI components for device data are not rendered (not just hidden)
- [ ] Penetration testing confirms no data leakage
- [ ] Filter is applied server-side, not client-side
- [ ] Error messages do not reveal filtered field names

**Business Rationale:**
Bianca explicitly stated: "We don't want them to see anything that we see on Onomondo platform or the equivalent here... none of the device, IMEI numbers, battery." This is a core business requirement, not a nice-to-have.

**Technical Notes:**
- Implement as response transformer middleware
- Define whitelist of allowed fields per role, not blacklist
- Log any attempts to access filtered fields for security monitoring

---

#### FR-106: Hidden Device Data Specification

**Priority:** 🔴 Critical | **Related Tasks:** ARCH-005, CUST-001

**User Story:**
> As a customer user, I should only see my assets and their locations, with no indication that IoT devices or SIM cards are involved.

**Detailed Description:**
The customer view must completely abstract away the underlying IoT infrastructure. Customers see "assets" not "devices". The following must never be visible to customer users:

| Hidden Data | Reason |
|-------------|--------|
| Battery level | Exposes device technology |
| IMEI | Device identifier - irrelevant to customer |
| Signal strength | Technical metric - confusing to customer |
| SIM ICCID | SIM identifier - irrelevant to customer |
| SIM MSISDN | Phone number - irrelevant to customer |
| Carrier name | Network operator - irrelevant to customer |
| Network logs | Technical debugging data |
| Session history | Connectivity details |
| Data consumption | Billing metric for Alpal, not customer |
| Roaming status | Network detail |
| Device manufacturer | Hardware detail |
| Firmware version | Technical detail |

**Acceptance Criteria:**
- [ ] None of the listed data types appear in customer UI
- [ ] API endpoints for customers do not include these fields
- [ ] Database views for customer queries exclude these columns
- [ ] Search/filter does not allow queries on hidden fields
- [ ] Tooltips and help text do not reference devices or SIMs
- [ ] Error messages use "asset" terminology, not "device"

**Business Rationale:**
Alpal's value proposition is "asset tracking as a service." Customers pay for asset visibility, not device management. Exposing the underlying technology would commoditize Alpal's offering and create support burden from confused customers.

**Technical Notes:**
- Create separate DTOs for internal vs. customer responses
- Use terminology mapping: "device" → "tracker" → "asset" (internal only sees first two)
- Ensure GraphQL schema (if used) respects role-based field visibility

---

### FR-200: Device Management - Internal View (Detailed)

---

#### FR-201: Device List with Status Indicators

**Priority:** 🔴 Critical | **Related Tasks:** DEV-001

**User Story:**
> As an Alpal device manager, I need to see all my devices in a list with clear status indicators so that I can quickly identify devices that need attention.

**Detailed Description:**
The device list view shall display all devices belonging to the tenant with the following information and status indicators:

**Required Columns:**
- Device ID / Name
- Customer / Project assignment
- Status indicator (color-coded)
- Battery level (percentage + icon)
- Signal strength (bars or dBm)
- Last seen timestamp
- Location (city/region or coordinates)

**Status Definitions:**
| Status | Color | Criteria |
|--------|-------|----------|
| Active | 🟢 Green | Reported within last 24 hours, battery > 20% |
| Warning | 🟡 Yellow | Reported within 24-72 hours OR battery 10-20% |
| Offline | 🔴 Red | No report for > 72 hours |
| Maintenance | 🟠 Orange | Manually flagged for service |

**Acceptance Criteria:**
- [ ] List loads within 2 seconds for up to 10,000 devices
- [ ] Status colors are clearly distinguishable (colorblind-friendly)
- [ ] Sorting available on all columns
- [ ] Pagination with configurable page size (25, 50, 100)
- [ ] Quick search/filter by device ID or name
- [ ] Bulk selection for group actions
- [ ] Export to CSV available
- [ ] Click-through to device detail view

**Business Rationale:**
Device health monitoring is core to Alpal's operations. Dead or failing devices mean lost asset visibility, which directly impacts customer SLAs.

**Technical Notes:**
- Implement virtual scrolling for large lists
- Cache device status calculations (refresh every 5 minutes)
- Use WebSocket for real-time status updates (optional enhancement)

---

#### FR-202: Device Grouping and Filtering

**Priority:** 🟠 High | **Related Tasks:** DEV-002

**User Story:**
> As an Alpal service manager for Nestle, I need to filter the device list to show only Nestle's devices so that I can focus on their account.

**Detailed Description:**
The device list must support comprehensive filtering and grouping:

**Filter Options:**
- Customer (dropdown, multi-select)
- Project (dropdown, multi-select, cascades from customer)
- Status (checkbox: Active, Warning, Offline, Maintenance)
- Battery level (range slider: 0-100%)
- Signal strength (range: Poor/Fair/Good/Excellent)
- Last seen (date range picker)
- Location (geozone or map selection)

**Grouping Options:**
- Group by Customer
- Group by Project
- Group by Status
- Group by Location (region)

**Acceptance Criteria:**
- [ ] All filter options are available in a collapsible panel
- [ ] Filters can be combined (AND logic)
- [ ] Active filters are displayed as removable chips/tags
- [ ] "Clear all filters" button resets to default view
- [ ] Filter state persists in URL (shareable links)
- [ ] Grouping shows collapsible sections with counts
- [ ] Filter results update in < 500ms
- [ ] Saved filter presets can be created (see NLQ features)

**Business Rationale:**
With thousands of devices across multiple customers, Alpal staff need to quickly narrow down to relevant subsets for troubleshooting and reporting.

**Technical Notes:**
- Implement filters as query parameters for bookmarkable URLs
- Use database indexes on all filterable columns
- Consider Elasticsearch for complex filtering at scale

---

#### FR-203: Signal Strength Monitoring

**Priority:** 🟠 High | **Related Tasks:** DEV-003

**User Story:**
> As an Alpal technical support engineer, I need to see signal strength for each device so that I can diagnose connectivity issues, especially for devices embedded in pallets.

**Detailed Description:**
Signal strength must be displayed for each device with the following specifications:

**Display Format:**
- Visual indicator (1-5 bars or signal icon)
- Numeric value in dBm (e.g., -85 dBm)
- Qualitative label (Excellent/Good/Fair/Poor/No Signal)

**Signal Quality Thresholds:**
| Quality | dBm Range | Bars |
|---------|-----------|------|
| Excellent | > -70 | 5 |
| Good | -70 to -85 | 4 |
| Fair | -85 to -100 | 3 |
| Poor | -100 to -110 | 2 |
| Very Poor | < -110 | 1 |
| No Signal | No data | 0 |

**Historical View:**
- Signal strength trend over last 7/30/90 days
- Highlight signal degradation patterns
- Correlate with location changes

**Acceptance Criteria:**
- [ ] Signal strength visible in device list view
- [ ] Signal strength prominent in device detail view
- [ ] Historical chart available in device detail
- [ ] Alert threshold configurable (e.g., notify if < -100 dBm for 24h)
- [ ] Signal map overlay available (heatmap of signal quality by location)
- [ ] Export signal history for analysis

**Business Rationale:**
Bianca mentioned: "It just provides a lot of clarity to see exactly when is it attaching or detaching." Also noted signal issues with devices embedded in pallets at her home. Signal monitoring is critical for diagnosing coverage problems.

**Technical Notes:**
- Store signal readings with timestamps (time-series data)
- Aggregate to hourly/daily averages for historical views
- Consider integration with coverage maps from MNO

---

#### FR-204: Battery Level Tracking

**Priority:** 🟠 High | **Related Tasks:** DEV-004

**User Story:**
> As an Alpal operations manager, I need to monitor battery levels across my device fleet so that I can schedule replacements before devices die in the field.

**Detailed Description:**
Battery level monitoring must provide:

**Real-time Display:**
- Percentage (0-100%)
- Visual icon (full/three-quarter/half/quarter/empty/charging)
- Color coding (green > 50%, yellow 20-50%, red < 20%)

**Predictive Analytics:**
- Estimated days remaining based on consumption pattern
- Battery degradation trend over device lifetime
- Comparison to expected battery life (claimed vs. actual)

**Alerts:**
- Low battery threshold alert (configurable, default 20%)
- Critical battery alert (configurable, default 10%)
- Abnormal drain rate alert

**Acceptance Criteria:**
- [ ] Battery level visible in device list and detail views
- [ ] Battery icon reflects current level with appropriate color
- [ ] "Days remaining" estimate displayed when battery < 50%
- [ ] Battery history chart available (last 30/90/180 days)
- [ ] Low battery devices highlighted in list view
- [ ] Bulk export of battery report for fleet planning
- [ ] Battery alerts integrated with alert management system

**Business Rationale:**
Bianca discussed testing device battery life claims vs. reality: "There's a lot of detail there just around testing the expected specs versus the reality of the device performance." Battery life directly impacts commercial viability and customer SLAs.

**Technical Notes:**
- Battery prediction model: linear regression on recent drain rate
- Account for temperature effects on battery performance
- Store battery readings in time-series database for trend analysis

---

#### FR-205: Last Report Timestamp

**Priority:** 🟡 Medium | **Related Tasks:** DEV-005

**User Story:**
> As an Alpal support agent, I need to see when each device last reported so that I can identify devices that have gone silent.

**Detailed Description:**
Every device must display its last communication timestamp:

**Display Format:**
- Relative time for recent: "5 minutes ago", "2 hours ago", "Yesterday"
- Absolute timestamp for older: "Jan 15, 2026 14:32 UTC"
- Timezone conversion to user's local time

**Visual Indicators:**
- Recent (< 1 hour): Normal text
- Stale (1-24 hours): Yellow highlight
- Old (24-72 hours): Orange highlight
- Silent (> 72 hours): Red highlight with warning icon

**Acceptance Criteria:**
- [ ] Last seen timestamp visible in device list
- [ ] Timestamp updates in real-time (or near-real-time)
- [ ] Hover shows exact timestamp with timezone
- [ ] Sort by "last seen" supported
- [ ] Filter by "not seen since" date range available
- [ ] Click shows communication history log

**Business Rationale:**
Silent devices indicate problems—dead battery, out of coverage, or hardware failure. Quick identification enables proactive customer communication.

**Technical Notes:**
- Update last_seen on every successful message receipt
- Use relative time library (e.g., date-fns, moment.js)
- Consider push notification for devices exceeding silent threshold

---

#### FR-206: Network Attachment/Detachment Logs

**Priority:** 🟠 High | **Related Tasks:** DEV-006

**User Story:**
> As an Alpal network engineer, I need to see when devices attach and detach from the network so that I can diagnose connectivity patterns and coverage issues.

**Detailed Description:**
The system must maintain and display network event logs for each device:

**Event Types:**
| Event | Description |
|-------|-------------|
| ATTACH | Device connected to network |
| DETACH | Device disconnected from network |
| HANDOVER | Device switched between cells/towers |
| ROAMING_START | Device entered roaming network |
| ROAMING_END | Device returned to home network |
| PDP_ACTIVATE | Data session started |
| PDP_DEACTIVATE | Data session ended |

**Log Entry Fields:**
- Timestamp (UTC and local)
- Event type
- Network/Carrier name
- Cell ID (if available)
- Duration (for sessions)
- Data transferred (for PDP sessions)

**Acceptance Criteria:**
- [ ] Log view available in device detail page
- [ ] Logs sortable by timestamp (default: newest first)
- [ ] Filter by event type
- [ ] Filter by date range
- [ ] Export to CSV
- [ ] Pagination for long histories (1000+ events)
- [ ] Visual timeline view option
- [ ] Aggregate statistics (total attach time, session count, etc.)

**Business Rationale:**
Bianca specifically mentioned: "We use network logs a lot... to see exactly when it is attaching or detaching, how long." This is critical diagnostic data for connectivity troubleshooting.

**Technical Notes:**
- Source data from CDRs via mediation layer
- Store in append-only log table with device_id index
- Consider partitioning by month for query performance
- Retention policy: 90 days detailed, 1 year aggregated

---

#### FR-207: Device Detail View

**Priority:** 🟠 High | **Related Tasks:** DEV-007

**User Story:**
> As an Alpal support agent, I need a comprehensive single-page view of all device information so that I can quickly assess device health without navigating multiple screens.

**Detailed Description:**
The device detail view shall be a modal or dedicated page containing:

**Header Section:**
- Device ID / Name (editable)
- Customer / Project assignment
- Current status with color indicator
- Quick action buttons (Edit, Disable, Delete, Assign)

**Health Panel:**
- Battery level with trend sparkline
- Signal strength with trend sparkline
- Last seen timestamp
- Uptime percentage (last 30 days)

**Location Panel:**
- Current location on map
- Address (reverse geocoded)
- Last movement timestamp
- Location history trail (last 7 days)

**Connectivity Panel:**
- Associated SIM card (link to SIM detail)
- Current carrier
- Roaming status
- Data usage (current period)

**Telemetry Panel:**
- Raw sensor readings (temperature, accelerometer, etc.)
- Last 10 data points in table format
- Link to full telemetry history

**Activity Log:**
- Recent events (attach/detach, alerts, config changes)
- Expandable to full history

**Acceptance Criteria:**
- [ ] All panels load within 3 seconds
- [ ] Data refreshes every 60 seconds (or manual refresh button)
- [ ] Each panel is collapsible for customization
- [ ] Deep links to specific device work (shareable URLs)
- [ ] Mobile-responsive layout
- [ ] Print-friendly view available
- [ ] Edit mode for device name and assignment

**Business Rationale:**
Support staff need a single source of truth for device health. Reducing clicks improves resolution time for customer issues.

**Technical Notes:**
- Load panels asynchronously for perceived performance
- Cache device data with 60-second TTL
- Use tabs or accordion for dense information display

---

#### FR-208: Device Map View

**Priority:** 🟠 High | **Related Tasks:** DEV-008

**User Story:**
> As an Alpal operations manager, I need to see all my devices plotted on a map so that I can understand geographic distribution and identify coverage gaps.

**Detailed Description:**
The device map view shall provide:

**Map Features:**
- Interactive map (zoom, pan, satellite/street view toggle)
- Device markers with status color coding
- Clustering for dense areas (shows count, expands on zoom)
- Heatmap overlay option (device density)

**Marker Interaction:**
- Click marker → popup with device summary
- Double-click → navigate to device detail
- Hover → show device name and status

**Filtering:**
- All filters from list view apply to map
- Draw polygon to select devices in area
- Show only devices with signal/battery issues

**Layers:**
- Geozones overlay (FR-502)
- Coverage map overlay (if available from MNO)
- Traffic/activity heatmap

**Acceptance Criteria:**
- [ ] Map loads within 3 seconds for 10,000 devices
- [ ] Clustering activates at 50+ devices in viewport
- [ ] Smooth zoom/pan interactions
- [ ] Filter changes reflect on map immediately
- [ ] Full-screen mode available
- [ ] Export map as image (PNG)
- [ ] Map state persists (center, zoom) in session

**Business Rationale:**
Geographic visualization reveals patterns not visible in list views—coverage gaps, concentration of issues in specific areas, distribution across customer facilities.

**Technical Notes:**
- Use Mapbox or Google Maps API
- Implement marker clustering with Supercluster or similar
- Load device locations via GeoJSON for efficiency
- Consider WebGL rendering for 10,000+ markers

---

### FR-300: SIM Card Management - Internal View (Detailed)

---

#### FR-301: SIM Card List with Carrier Identification

**Priority:** 🔴 Critical | **Related Tasks:** SIM-001

**User Story:**
> As an Alpal connectivity manager, I need to see all my SIM cards with their carrier information so that I can manage our mobile network relationships and costs.

**Detailed Description:**
The SIM card list view shall display:

**Required Columns:**
- ICCID (primary identifier)
- MSISDN (phone number)
- Carrier / MNO name
- Status (Active, Suspended, Inactive)
- Associated device (link)
- Customer / Project
- Data plan / Rate plan
- Data used (current period)
- Last activity timestamp

**Status Definitions:**
| Status | Description |
|--------|-------------|
| Active | SIM is provisioned and communicating |
| Suspended | SIM is temporarily disabled (e.g., for testing) |
| Inactive | SIM has never been activated or is decommissioned |
| Blocked | SIM is blocked due to policy violation |

**Acceptance Criteria:**
- [ ] List displays all SIMs for tenant
- [ ] Sorting available on all columns
- [ ] Search by ICCID, MSISDN, or device ID
- [ ] Filter by carrier, status, customer
- [ ] Pagination for large inventories
- [ ] Bulk actions (suspend, activate, assign)
- [ ] Export to CSV
- [ ] Click-through to SIM detail view

**Business Rationale:**
SIM management is core to Alpal's connectivity operations. Understanding carrier distribution helps optimize roaming agreements and costs.

**Technical Notes:**
- Sync SIM data from connectivity provider API (Jersey Telecom/Ioto)
- Update carrier info from network attach events
- Store rate plan info for cost analytics

---

#### FR-302: SIM Identifiers Display

**Priority:** 🟠 High | **Related Tasks:** SIM-002

**User Story:**
> As an Alpal technical support engineer, I need to see all SIM identifiers (MSISDN, ICCID, IMSI) so that I can troubleshoot network issues with carriers.

**Detailed Description:**
The SIM detail view must display all relevant identifiers:

| Identifier | Description | Format |
|------------|-------------|--------|
| ICCID | Integrated Circuit Card ID | 19-20 digits |
| MSISDN | Phone number | E.164 format (+country code) |
| IMSI | International Mobile Subscriber ID | 15 digits |
| IMEI | Device IMEI (from associated device) | 15 digits |
| EID | eSIM identifier (if applicable) | 32 digits |

**Display Features:**
- Copy-to-clipboard button for each identifier
- Barcode/QR code generation for ICCID
- Link to carrier portal (if available)
- Edit capability for MSISDN (if carrier supports)

**Acceptance Criteria:**
- [ ] All identifiers visible in SIM detail view
- [ ] Copy buttons work reliably
- [ ] ICCID barcode renders correctly
- [ ] Invalid identifier formats are flagged
- [ ] Identifiers are searchable from SIM list

**Business Rationale:**
When troubleshooting with carriers, specific identifiers are required. Easy copy/paste reduces errors in support tickets.

**Technical Notes:**
- Validate identifier formats on input
- Generate Code128 barcode for ICCID
- Store IMSI securely (sensitive data)

---

#### FR-303: Network Session History

**Priority:** 🟠 High | **Related Tasks:** SIM-003

**User Story:**
> As an Alpal network analyst, I need to see the complete session history for a SIM so that I can analyze usage patterns and troubleshoot connectivity issues.

**Detailed Description:**
The network session history shall display:

**Session Record Fields:**
- Session start timestamp
- Session end timestamp
- Duration
- Network / Carrier
- Cell ID / Location
- APN used
- IP address assigned
- Data uploaded (bytes/MB)
- Data downloaded (bytes/MB)
- Session termination reason

**Views:**
- Tabular list (sortable, filterable)
- Timeline visualization
- Calendar heatmap (activity by day)

**Aggregations:**
- Total sessions per day/week/month
- Average session duration
- Total data by carrier
- Peak usage times

**Acceptance Criteria:**
- [ ] Session history loads for last 90 days
- [ ] Pagination for 1000+ sessions
- [ ] Filter by date range, carrier, APN
- [ ] Export to CSV
- [ ] Timeline view shows sessions on horizontal axis
- [ ] Aggregate statistics panel
- [ ] Compare to previous period option

**Business Rationale:**
Session data reveals connectivity patterns—frequent disconnects indicate coverage issues; unusual data spikes may indicate problems or theft.

**Technical Notes:**
- Source from CDRs via mediation layer
- Partition by month for query performance
- Pre-calculate daily/weekly aggregates

---

#### FR-304: Data Consumption Tracking

**Priority:** 🟠 High | **Related Tasks:** SIM-004

**User Story:**
> As an Alpal finance manager, I need to track data consumption per SIM so that I can monitor costs and identify unusual usage patterns.

**Detailed Description:**
Data consumption tracking shall provide:

**Current Period View:**
- Data used (MB/GB)
- Data limit (if applicable)
- Usage percentage with visual gauge
- Days remaining in period
- Projected overage

**Historical View:**
- Usage by day/week/month (bar chart)
- Trend line with moving average
- Year-over-year comparison
- Top consumers ranking

**Alerts:**
- 80% of limit reached
- 100% of limit reached (overage)
- Unusual spike detection (> 2x average)

**Breakdown:**
- Upload vs. download split
- Usage by time of day
- Usage by location/carrier

**Acceptance Criteria:**
- [ ] Current usage displays on SIM detail page
- [ ] Historical chart shows last 12 months
- [ ] Drill-down from month → day → hour available
- [ ] Alert thresholds configurable per SIM or globally
- [ ] Export consumption report
- [ ] Fleet-wide consumption dashboard

**Business Rationale:**
Connectivity costs are a significant component of Alpal's unit economics. Monitoring consumption prevents bill shock and enables optimization.

**Technical Notes:**
- Update usage near-real-time via CDR ingestion
- Calculate projections using linear regression on recent days
- Store hourly aggregates for detailed analysis

---

#### FR-305: Roaming Network Visibility

**Priority:** 🟠 High | **Related Tasks:** SIM-005

**User Story:**
> As an Alpal connectivity manager, I need to see which networks our SIMs are roaming on so that I can validate roaming agreements and identify coverage gaps.

**Detailed Description:**
Roaming visibility shall provide:

**Current Status:**
- Home vs. Roaming indicator
- Current carrier name and country
- Roaming partner network (MCC/MNC)
- Time since last carrier change

**Historical Roaming:**
- List of visited networks with timestamps
- Duration on each network
- Map visualization of roaming path
- Data used per roaming partner

**Coverage Analysis:**
- Countries/regions with roaming coverage
- Networks used per country
- Gap identification (areas with no coverage)

**Acceptance Criteria:**
- [ ] Roaming status visible in SIM list and detail
- [ ] Roaming history available for last 90 days
- [ ] Map shows roaming path with carrier colors
- [ ] Filter devices currently roaming
- [ ] Aggregate roaming statistics per carrier
- [ ] Export roaming report

**Business Rationale:**
Bianca mentioned: "All of the roaming agreements we have today are with Jersey." Understanding roaming patterns validates coverage and helps negotiate agreements.

**Technical Notes:**
- Parse MCC/MNC from network attach events
- Maintain carrier name lookup table (MCC/MNC → carrier name)
- Use map polylines to show roaming journeys

---

#### FR-306: SIM-to-Device Association

**Priority:** 🟠 High | **Related Tasks:** SIM-006

**User Story:**
> As an Alpal inventory manager, I need to see which device each SIM is installed in so that I can track our hardware-connectivity inventory.

**Detailed Description:**
SIM-device association shall provide:

**Association Display:**
- SIM list shows associated device ID (clickable link)
- Device list shows associated SIM ICCID (clickable link)
- Orphan SIMs view (SIMs not associated with any device)
- Orphan devices view (devices without SIM)

**Association Management:**
- Associate SIM to device (manual assignment)
- Disassociate SIM from device
- Swap SIM between devices
- Bulk association via CSV upload

**Association History:**
- Log of all association changes
- Who made the change and when
- Previous device/SIM association

**Acceptance Criteria:**
- [ ] SIM detail shows associated device with link
- [ ] Device detail shows associated SIM with link
- [ ] Orphan reports available in both directions
- [ ] Association changes logged with audit trail
- [ ] Bulk operations support (CSV import)
- [ ] Association validation (one SIM per device)

**Business Rationale:**
Tracking which SIM is in which device is essential for inventory management, troubleshooting, and asset lifecycle tracking.

**Technical Notes:**
- Store association as foreign key: device.sim_id
- Trigger update to both records on association change
- Validate uniqueness constraint (no SIM in multiple devices)

---

#### FR-307: SIM Grouping by Customer/Project

**Priority:** 🟡 Medium | **Related Tasks:** SIM-007

**User Story:**
> As an Alpal service manager, I need to group SIMs by customer project so that I can report on connectivity costs per customer.

**Detailed Description:**
SIMs shall support the same grouping structure as devices:
- Assign SIM to Customer
- Assign SIM to Project (within Customer)
- Group typically inherited from associated device
- Can be overridden for unassociated SIMs

**Grouping Features:**
- Filter SIM list by customer/project
- Group view (collapsible sections by customer)
- Aggregate consumption per customer/project
- Billing reports by customer

**Acceptance Criteria:**
- [ ] Customer/project assignment field on SIM record
- [ ] Auto-inherit from device when associated
- [ ] Filter dropdowns on SIM list
- [ ] Consumption roll-up by customer/project
- [ ] Export grouped reports

**Business Rationale:**
Alpal needs to track connectivity costs per customer for pricing and profitability analysis.

**Technical Notes:**
- Sync grouping from device on association
- Allow manual override for SIM inventory management
- Aggregate queries should use pre-calculated sums

---

### FR-400: Customer Dashboard - Asset Tracking (Detailed)

---

#### FR-401: Customer Dashboard Layout

**Priority:** 🔴 Critical | **Related Tasks:** CUST-001

**User Story:**
> As an Alpal customer (e.g., Nestle logistics manager), I need a clean dashboard showing only my assets and their locations, with no technical device information.

**Detailed Description:**
The customer dashboard shall be a purpose-built interface that:

**Shows:**
- Total asset count
- Asset location map
- Status summary (at facility, in transit, at supplier)
- Geozone summaries
- Alert notifications
- Asset list/grid

**Never Shows:**
- Any device-related information (per FR-106)
- SIM or connectivity data
- Technical metrics (signal, battery)
- Network or carrier information

**Layout:**
- Clean, simple design focused on asset visibility
- Summary widgets at top
- Large map in center
- Filterable asset list below
- Alerts panel (collapsible)

**Acceptance Criteria:**
- [ ] Dashboard loads in < 3 seconds
- [ ] Zero device/SIM fields visible anywhere
- [ ] Responsive design for tablet/mobile
- [ ] User can customize widget arrangement (optional)
- [ ] Language/locale can be configured per user
- [ ] Color scheme matches customer branding (optional)
- [ ] Help/documentation accessible

**Business Rationale:**
Bianca stated: "What we are selling to them is an ability to log in and have all the data on how many assets they have, where those assets are." The customer view must be clean and focused.

**Technical Notes:**
- Build as separate React/Vue app from internal dashboard
- Share component library but different data layer
- Implement strict data filtering at API gateway

---

#### FR-402: Asset Count Summary

**Priority:** 🔴 Critical | **Related Tasks:** CUST-002

**User Story:**
> As an Alpal customer, I need to see at a glance how many assets I have in total and their distribution across locations.

**Detailed Description:**
The asset count summary shall display:

**Primary Metric:**
- Total asset count (large, prominent number)

**Breakdown Metrics:**
- Assets at facility (our warehouses)
- Assets at supplier locations
- Assets in transit
- Assets at customer sites
- Unknown/unlocated assets

**Visual Representation:**
- Numeric values with icons
- Optional donut/pie chart
- Trend indicator (vs. previous period)

**Acceptance Criteria:**
- [ ] Total count prominently displayed
- [ ] Breakdown matches geozone configuration
- [ ] Numbers update in real-time (or near-real-time)
- [ ] Hover shows definition of each category
- [ ] Click on category filters map and list
- [ ] Trend arrows show week-over-week change

**Business Rationale:**
The first question any logistics manager asks: "How many assets do I have and where are they?" This must be immediately visible.

**Technical Notes:**
- Pre-calculate counts by category (update every 5 minutes)
- Use geozone-based status inference
- Cache aggressively with short TTL

---

#### FR-403: Asset Location Map with Drill-Down

**Priority:** 🔴 Critical | **Related Tasks:** CUST-003

**User Story:**
> As an Alpal customer, I need to see all my assets plotted on a map so that I can visually track their distribution and movements.

**Detailed Description:**
The asset location map shall provide:

**Map Features:**
- Interactive map with zoom/pan
- Asset markers (distinct from device markers—use asset icon)
- Clustering for dense areas
- Geozone boundaries overlay
- Auto-fit to show all assets

**Drill-Down Interaction:**
- Click cluster → zoom to show individual assets
- Click asset → popup with asset summary:
  - Asset ID / Name
  - Current location (address)
  - Status
  - Time at current location
  - Last movement timestamp
- Double-click → navigate to asset detail

**Filtering:**
- Filter by status (at facility, in transit, etc.)
- Filter by geozone
- Filter by asset type/category
- Search by asset ID

**Acceptance Criteria:**
- [ ] Map renders within 3 seconds for 10,000 assets
- [ ] Clusters expand smoothly on zoom
- [ ] Asset popup shows relevant info only (no device data)
- [ ] Geozone boundaries display correctly
- [ ] Filter changes reflect immediately
- [ ] Full-screen mode available
- [ ] Historical path view for selected asset

**Business Rationale:**
Bianca described needing: "A map, this is where they are." Visual geographic representation is the primary customer value.

**Technical Notes:**
- Use distinct marker icons (package/box shape, not antenna)
- Ensure marker colors are meaningful to customer (status-based)
- Optimize clustering for large fleets
- Consider WebGL for performance

---

#### FR-404: Asset Status Indicators

**Priority:** 🟠 High | **Related Tasks:** CUST-004

**User Story:**
> As an Alpal customer, I need to see the status of each asset (at facility, in transit, at supplier) so that I know the current state of my packaging fleet.

**Detailed Description:**
Asset status shall be derived from geozone location and displayed clearly:

**Standard Statuses:**
| Status | Icon | Color | Definition |
|--------|------|-------|------------|
| At Facility | 🏭 | Blue | In customer's own warehouse/facility |
| In Transit | 🚚 | Orange | Moving between geozones |
| At Supplier | 📦 | Green | At supplier's location |
| At Customer Site | 🏢 | Purple | At end customer's location |
| Unknown | ❓ | Gray | Location unknown or outside geozones |
| Stored | 📦 | Teal | In long-term storage (no movement > 30 days) |

**Status Display:**
- Color-coded badge/tag on asset list
- Icon on map marker
- Status column in asset table
- Filter option for each status

**Acceptance Criteria:**
- [ ] Status automatically derived from geozone location
- [ ] Manual override available (admin only)
- [ ] Status history maintained
- [ ] Status change triggers notification (configurable)
- [ ] Filter by status available on list and map
- [ ] Custom statuses can be configured per tenant

**Business Rationale:**
Bianca mentioned needing to know: "How many are at the facility, at suppliers, how many are in transit." Status categorization enables this reporting.

**Technical Notes:**
- Implement status inference engine (geozone → status mapping)
- Allow status rules configuration (e.g., "if in geozone X for > 1 hour → At Supplier")
- Store status changes as events for history

---

#### FR-405: Geozone Summary Boxes

**Priority:** 🟠 High | **Related Tasks:** CUST-005

**User Story:**
> As an Alpal customer, I need to see asset counts by location type at the top of my dashboard so that I can quickly assess my fleet distribution.

**Detailed Description:**
The dashboard shall display summary boxes (cards/widgets) for each geozone category:

**Example Layout:**
```
[🏭 Warehouse: 1,234] [🚚 In Transit: 567] [📦 At Supplier: 890] [❓ Unknown: 23]
```

**Features:**
- Count of assets in each category
- Click to filter map and list
- Color coding consistent with status
- Percentage of total shown
- Trend arrow (vs. yesterday/last week)

**Customization:**
- Tenant can configure which categories to show
- Order can be rearranged
- Geozones can be grouped into categories

**Acceptance Criteria:**
- [ ] Summary boxes display at top of dashboard
- [ ] Counts are accurate and update in real-time
- [ ] Click filters entire dashboard
- [ ] Hover shows percentage and trend
- [ ] Boxes are responsive (stack on mobile)
- [ ] Configuration UI for box arrangement

**Business Rationale:**
Bianca suggested: "We might have different color geozones, so we'd be able to look and see... Maybe it could be in one of these boxes at the top."

**Technical Notes:**
- Pre-calculate counts per geozone category
- Refresh every 5 minutes or on demand
- Store configuration in tenant settings

---

#### FR-406: Asset Metadata Display

**Priority:** 🟠 High | **Related Tasks:** CUST-006

**User Story:**
> As an Alpal customer, I need to see detailed information about each asset including its age, composition, and usage history.

**Detailed Description:**
The asset detail view shall display:

**Core Metadata:**
| Field | Description |
|-------|-------------|
| Asset ID | Unique identifier (barcode/QR) |
| Asset Name | Human-readable name |
| Asset Type | Category (pallet, crate, container) |
| Birth Date | Manufacturing/acquisition date |
| Age | Calculated from birth date |
| Composition | Material breakdown |
| Recycled Content % | Regulatory compliance field |
| Trip Count | Total trips completed |
| Last Trip Date | Most recent movement |
| Current Location | Address/geozone |
| Status | Current status |
| Assigned Customer | End customer using the asset |

**Regulatory Fields:**
- Recycled content percentage
- Certification status
- Compliance expiry date

**Acceptance Criteria:**
- [ ] All metadata fields visible in asset detail
- [ ] Editable fields have edit icons
- [ ] QR/barcode displayed for scanning
- [ ] Birth date cannot be in future
- [ ] Age calculated dynamically
- [ ] Composition stored as JSON for flexibility
- [ ] Export individual asset data

**Business Rationale:**
Bianca mentioned: "We have to report on how much recycled content... we would need to be able to track the trips." This metadata is essential for regulatory compliance and lifecycle management.

**Technical Notes:**
- Store composition as JSON: { "plastic": 60, "recycled_plastic": 30, "metal": 10 }
- Calculate age as (today - birth_date).days
- Index trip_count for sorting/filtering

---

#### FR-407: Trip Count Tracking

**Priority:** 🟠 High | **Related Tasks:** CUST-007

**User Story:**
> As an Alpal customer, I need to see how many trips each asset has completed so that I can plan replacements and understand utilization.

**Detailed Description:**
Trip tracking shall provide:

**Trip Definition:**
A "trip" is a complete cycle:
1. Asset leaves a defined origin geozone
2. Asset arrives at a destination geozone
3. Asset returns to origin (or another origin)

**Trip Counter:**
- Running count of completed trips
- Displayed on asset detail
- Sortable in asset list
- Filterable (e.g., assets with > 50 trips)

**Trip History:**
- List of all trips with dates
- Origin and destination for each trip
- Duration of each trip
- Distance traveled (if GPS)

**Analytics:**
- Average trips per month
- Trip frequency trend
- Utilization rate (trips/month vs. target)

**Acceptance Criteria:**
- [ ] Trip count displayed on asset detail
- [ ] Trip history log available
- [ ] Automatic trip detection from geozone events
- [ ] Manual trip entry/correction available
- [ ] Fleet-wide trip statistics
- [ ] Export trip reports

**Business Rationale:**
Bianca stated: "We would need to be able to track the trips. So, do you want to say this asset has done this many trips?" Trip count is critical for lifecycle management and customer billing.

**Technical Notes:**
- Implement trip detection algorithm based on geozone events
- Allow configurable trip definition per tenant
- Consider edge cases (partial trips, cancelled trips)

---

#### FR-408: Recycled Content Tracking (Regulatory)

**Priority:** 🟠 High | **Related Tasks:** CUST-008

**User Story:**
> As an Alpal sustainability manager, I need to track recycled content percentage for each asset so that I can comply with packaging regulations and report to customers.

**Detailed Description:**
Recycled content tracking shall provide:

**Per Asset:**
- Recycled content percentage (0-100%)
- Material breakdown (virgin vs. recycled per material type)
- Certification documentation link

**Reporting:**
- Fleet-wide average recycled content
- Assets below threshold (e.g., < 30% recycled)
- Trend over time (as old assets replaced with greener ones)
- Export for regulatory submission

**Compliance:**
- Configurable threshold alerts
- Upcoming regulation deadlines
- Non-compliant asset flagging

**Acceptance Criteria:**
- [ ] Recycled content % field on every asset
- [ ] Editable with audit trail
- [ ] Fleet average calculated and displayed
- [ ] Filter assets by recycled content range
- [ ] Compliance report exportable
- [ ] Alert when compliance deadline approaching

**Business Rationale:**
Bianca mentioned: "Packaging waste, we have to report on how much recycled content." This is a regulatory requirement in many jurisdictions.

**Technical Notes:**
- Store as decimal (0.00 to 1.00) for precision
- Allow material-level breakdown for detailed compliance
- Pre-calculate fleet average nightly

---

### FR-500: Geozone & Geofencing (Detailed)

---

#### FR-501: Geozone Creation and Management

**Priority:** 🟠 High | **Related Tasks:** GEO-001

**User Story:**
> As an Alpal operations manager, I need to define geographic zones (warehouses, suppliers, customers) so that the system can automatically determine asset locations.

**Detailed Description:**
Geozone management shall allow:

**Zone Creation:**
- Draw polygon on map (click vertices)
- Draw circle (center point + radius)
- Import from GeoJSON/KML
- Geocode address to create zone

**Zone Properties:**
| Field | Description |
|-------|-------------|
| Name | Human-readable name |
| Type | Category (Warehouse, Supplier, Customer, Transit Hub) |
| Address | Physical address |
| Owner | Company/entity that owns the location |
| Contact | Contact person and details |
| Operating Hours | When location is staffed |
| Status | Active / Inactive |

**Zone Actions:**
- Edit boundaries
- Move zone
- Clone zone
- Delete zone (with confirmation)
- Archive zone (soft delete)

**Acceptance Criteria:**
- [ ] Polygon drawing tool works smoothly
- [ ] Circle drawing with radius input
- [ ] Import GeoJSON files up to 10MB
- [ ] Address search finds and geocodes locations
- [ ] Zone properties editable after creation
- [ ] Zone changes logged with audit trail
- [ ] Overlapping zones handled correctly
- [ ] Bulk import via CSV

**Business Rationale:**
Geozones are the foundation for asset status inference, alerts, and reporting. Flexible zone definition accommodates diverse supply chain configurations.

**Technical Notes:**
- Store boundaries as PostGIS geometry or GeoJSON
- Implement point-in-polygon algorithm for containment checks
- Index geospatially for fast queries
- Handle international date line edge cases

---

#### FR-502: Geozone Visualization

**Priority:** 🟠 High | **Related Tasks:** GEO-002

**User Story:**
> As an Alpal customer, I need to see my defined geozones on the map so that I understand the boundaries and can verify asset locations.

**Detailed Description:**
Geozone visualization shall provide:

**Visual Elements:**
- Zone boundaries drawn on map
- Semi-transparent fill with distinct colors per zone type
- Labels showing zone name
- Icons indicating zone type

**Color Coding:**
| Zone Type | Color |
|-----------|-------|
| Warehouse | Blue |
| Supplier | Green |
| Customer | Purple |
| Transit Hub | Orange |
| Restricted | Red |

**Interaction:**
- Hover → highlight zone and show tooltip
- Click → show zone details panel
- Toggle zones on/off
- Filter by zone type

**Acceptance Criteria:**
- [ ] Zones render correctly on map
- [ ] Colors are distinct and configurable
- [ ] Labels readable at appropriate zoom levels
- [ ] Zone toggle controls in map legend
- [ ] Hover tooltip shows zone name and type
- [ ] Click opens zone detail panel
- [ ] Zones update without page refresh when edited

**Business Rationale:**
Bianca mentioned: "We might have different color geozones, so we'd be able to look and see." Visual distinction helps users quickly understand asset distribution.

**Technical Notes:**
- Use Mapbox/Google Maps polygon layers
- Implement z-index handling for overlapping zones
- Consider label collision avoidance at low zoom

---

#### FR-503: Geozone Entry/Exit Detection

**Priority:** 🔴 Critical | **Related Tasks:** GEO-003

**User Story:**
> As the system, I must detect when assets enter or exit geozones in real-time so that I can update status and trigger alerts.

**Detailed Description:**
Geozone detection engine shall:

**Detection Logic:**
1. Receive location update from device
2. Check if new location is inside any geozone
3. Compare to previous known zone(s)
4. Generate entry/exit events as appropriate

**Event Types:**
| Event | Trigger |
|-------|---------|
| ZONE_ENTER | Asset location now inside zone, previously outside |
| ZONE_EXIT | Asset location now outside zone, previously inside |
| ZONE_DWELL | Asset inside zone for > threshold duration |

**Event Data:**
- Timestamp
- Asset ID
- Zone ID and name
- Previous zone (if any)
- Duration in previous zone

**Processing:**
- Near-real-time detection (< 1 minute latency)
- Handle location jitter (don't trigger on boundary noise)
- Support simultaneous zone membership (overlapping zones)
- Queue events for downstream processing

**Acceptance Criteria:**
- [ ] Entry detected within 1 minute of location update
- [ ] Exit detected within 1 minute of location update
- [ ] Boundary jitter filtered (configurable threshold)
- [ ] Events logged with full context
- [ ] Events trigger status updates
- [ ] Events trigger alerts (if configured)
- [ ] High-volume processing (1000+ events/minute)

**Business Rationale:**
Geozone events are the foundation for automatic status inference, alert generation, and responsibility transfer. This is core platform functionality.

**Technical Notes:**
- Implement as event stream processor
- Use PostGIS ST_Contains for point-in-polygon checks
- Apply hysteresis (e.g., ignore changes within 50m of boundary)
- Consider Redis for real-time zone membership cache

---

#### FR-504: Geozone-Based Status Inference

**Priority:** 🟠 High | **Related Tasks:** GEO-004

**User Story:**
> As the system, I must automatically determine asset status based on which geozone it's currently in so that customers see meaningful status without manual updates.

**Detailed Description:**
Status inference shall map geozones to asset statuses:

**Inference Rules:**
| Zone Type | Inferred Status |
|-----------|-----------------|
| Warehouse (Own) | At Facility |
| Supplier | At Supplier |
| Customer Site | At Customer |
| Transit Hub | In Transit |
| No Zone | Unknown |

**Additional Rules:**
- If moving between zones → In Transit
- If stationary outside zone for > X hours → Unknown
- If at owned facility but idle > Y days → Stored

**Configuration:**
- Rules configurable per tenant
- Custom zone types can be added
- Override rules for specific zones

**Acceptance Criteria:**
- [ ] Status updates automatically on zone change
- [ ] Configurable mapping rules
- [ ] "In Transit" detected during movement
- [ ] Unknown status for unrecognized locations
- [ ] Status change history maintained
- [ ] Manual override option for edge cases

**Business Rationale:**
Automatic status removes manual tracking burden. Bianca wants to answer: "How many are at the facility, at suppliers, how many are in transit" without manual data entry.

**Technical Notes:**
- Implement as rule engine triggered by zone events
- Store current status and status history separately
- Consider state machine pattern for status transitions

---

#### FR-505: Responsibility Transfer Logic

**Priority:** 🟡 Medium | **Related Tasks:** GEO-005

**User Story:**
> As an Alpal operations manager, I need the system to automatically record when responsibility for an asset transfers between parties based on location.

**Detailed Description:**
Responsibility transfer shall track custody chain:

**Transfer Events:**
- Asset enters customer zone → Responsibility to customer
- Asset exits customer zone → Responsibility returns to Alpal
- Asset enters supplier zone → Responsibility to supplier

**Transfer Record:**
| Field | Description |
|-------|-------------|
| Timestamp | When transfer occurred |
| Asset ID | Which asset |
| From Party | Previous responsible party |
| To Party | New responsible party |
| Location | Where transfer occurred |
| Duration | Time with previous party |

**Acceptance Criteria:**
- [ ] Transfer automatically logged on zone change
- [ ] Transfer history viewable per asset
- [ ] Report on custody duration per party
- [ ] Dispute evidence: timestamped location proof
- [ ] Manual transfer correction available

**Business Rationale:**
Bianca mentioned: "A lot of the requirement is around who has responsibility for the asset at any time, and when that responsibility transferred." This is critical for liability and SLAs.

**Technical Notes:**
- Store as immutable audit log
- Include location snapshot for evidence
- Consider blockchain integration for tamper-proof records

---

### FR-600: Alert Management (Detailed)

---

#### FR-601: Alert Rules Configuration

**Priority:** 🟠 High | **Related Tasks:** ALERT-001

**User Story:**
> As an Alpal operations manager, I need to configure alert rules so that I'm automatically notified when important events occur.

**Detailed Description:**
Alert rules shall support:

**Rule Components:**
- **Trigger:** What event triggers the alert
- **Condition:** Additional criteria to evaluate
- **Action:** What happens when alert fires
- **Recipients:** Who receives notification

**Trigger Types:**
| Trigger | Description |
|---------|-------------|
| Geozone Exit | Asset leaves specified zone |
| Geozone Enter | Asset enters specified zone |
| Arrival Overdue | Expected arrival time passed |
| Low Battery | Battery below threshold |
| No Report | No data received for X hours |
| Condition Breach | Temperature/humidity out of range |
| Trip Complete | Asset completes a trip cycle |

**Condition Examples:**
- "Only during business hours"
- "Only for high-value assets"
- "Only after 2 hours in transit"

**Actions:**
- Create alert in dashboard
- Send email notification
- Send SMS (future)
- Webhook to external system

**Acceptance Criteria:**
- [ ] Rule builder UI for non-technical users
- [ ] Preview rule matches before saving
- [ ] Enable/disable rules without deleting
- [ ] Test rule with simulated event
- [ ] Clone existing rules
- [ ] Import/export rules as JSON

**Business Rationale:**
Bianca described needing alerts for: "These assets were due to arrive X date. They haven't arrived, an alert." Configurable rules enable customer-specific alerting.

**Technical Notes:**
- Implement as event-driven rule engine
- Store rules as JSON for flexibility
- Evaluate rules asynchronously to not block event processing

---

#### FR-602: Geofence Breach Alerts

**Priority:** 🟠 High | **Related Tasks:** ALERT-002

**User Story:**
> As an Alpal customer, I need to be alerted when assets leave authorized areas so that I can investigate potential theft or misrouting.

**Detailed Description:**
Geofence breach alerts shall:

**Detection:**
- Fire when asset exits defined "authorized" geozones
- Fire when asset enters defined "restricted" geozones
- Support time-based rules (e.g., no exits after 6 PM)

**Alert Content:**
- Asset ID and name
- Zone exited/entered
- Timestamp
- Current location (if known)
- Map link showing breach location

**Configuration:**
- Per-zone: enable/disable breach alerting
- Per-asset: whitelist assets exempt from alerts
- Per-time: active hours for alerting

**Acceptance Criteria:**
- [ ] Breach detected within 5 minutes
- [ ] Alert created in dashboard
- [ ] Email sent to configured recipients
- [ ] Alert shows breach location on map
- [ ] Configurable per zone and asset
- [ ] No duplicate alerts for same breach

**Business Rationale:**
Asset security is a key concern. Unauthorized movement must be flagged immediately.

**Technical Notes:**
- Trigger from geozone exit events (FR-503)
- Implement de-duplication (same breach doesn't re-alert)
- Consider severity levels based on zone type

---

#### FR-603: Expected Arrival Alerts

**Priority:** 🟠 High | **Related Tasks:** ALERT-003

**User Story:**
> As an Alpal customer, I need to be alerted when assets don't arrive at their expected destination on time so that I can follow up.

**Detailed Description:**
Arrival monitoring shall:

**Arrival Expectation:**
- Manual: User sets expected arrival date/time
- Automatic: System calculates based on typical trip duration

**Alert Trigger:**
- Current time > Expected arrival time + Grace period
- Asset not yet in destination geozone

**Alert Content:**
- Asset ID and name
- Expected destination
- Expected arrival time
- Current delay duration
- Last known location
- Recommended action

**Alert Escalation:**
- Initial alert at grace period expiry
- Escalation alert at 2x grace period
- Critical alert at 4x grace period

**Acceptance Criteria:**
- [ ] Arrival time can be set manually
- [ ] Alert triggers when arrival overdue
- [ ] Grace period configurable (default: 2 hours)
- [ ] Current location shown in alert
- [ ] Escalation tiers configurable
- [ ] Alert clears automatically on arrival

**Business Rationale:**
Bianca mentioned: "These assets were due to arrive X date. They haven't arrived, an alert." Proactive arrival monitoring enables customer communication.

**Technical Notes:**
- Store expected_arrival_at on trip/shipment record
- Background job checks pending arrivals every 15 minutes
- Auto-clear alert on zone entry event

---

#### FR-604: Alert Management Dashboard

**Priority:** 🔴 Critical | **Related Tasks:** ALERT-004

**User Story:**
> As an Alpal operations manager, I need a central dashboard to view and manage all alerts so that I can prioritize and resolve issues efficiently.

**Detailed Description:**
The alert dashboard shall provide:

**Alert List:**
- All active alerts with severity indicators
- Sortable by time, severity, type, asset
- Filterable by status, type, date range, assignee
- Search by asset ID or alert content

**Alert Details:**
- Full alert information in expandable row or modal
- Related asset details (link to asset view)
- Timeline of alert lifecycle (created, acknowledged, resolved)
- Action buttons (Acknowledge, Assign, Resolve, Snooze)

**Summary Widgets:**
- Total active alerts by severity
- Alerts by type (pie chart)
- Trend over time (line chart)
- Average resolution time

**Bulk Actions:**
- Multi-select alerts
- Bulk acknowledge
- Bulk assign
- Bulk resolve

**Acceptance Criteria:**
- [ ] Dashboard loads all alerts within 2 seconds
- [ ] Severity color coding visible
- [ ] Filter combinations work correctly
- [ ] Bulk actions apply to selected alerts
- [ ] Alert detail shows full context
- [ ] Resolution actions logged with user/timestamp
- [ ] Notifications clear when alert resolved

**Business Rationale:**
Bianca explicitly stated: "When you've got thousands, that's unhelpful. To get gazillion emails on singular assets. So to have dashboards to manage alerts." This is a must-have.

**Technical Notes:**
- Implement as paginated list with virtual scrolling
- Real-time updates via WebSocket for new alerts
- Archive resolved alerts after 30 days (keep for reporting)

---

#### FR-605: Alert Status Workflow

**Priority:** 🟠 High | **Related Tasks:** ALERT-005

**User Story:**
> As an Alpal support agent, I need to track alert progress through a defined workflow so that we ensure all issues are addressed.

**Detailed Description:**
Alert status workflow shall include:

**Statuses:**
| Status | Description |
|--------|-------------|
| New | Alert just created, not yet viewed |
| Acknowledged | User has seen alert, investigating |
| Assigned | Alert assigned to specific person |
| In Progress | Actively being worked on |
| Pending | Waiting on external input |
| Resolved | Issue addressed, alert closed |
| Snoozed | Temporarily hidden (will resurface) |

**Transitions:**
- New → Acknowledged (view alert)
- Acknowledged → Assigned (assign to user)
- Any → In Progress (start working)
- Any → Pending (waiting)
- Any → Resolved (close alert)
- Any → Snoozed (temporary hide)
- Snoozed → New (snooze expires)

**Overdue Logic:**
- Alert becomes "Overdue" if not resolved within SLA
- Overdue alerts highlighted
- Auto-escalation option

**Acceptance Criteria:**
- [ ] All status transitions work correctly
- [ ] Transition logged with user and timestamp
- [ ] Only valid transitions allowed
- [ ] SLA timer visible on alert
- [ ] Overdue highlighting applied
- [ ] Snooze with duration option
- [ ] Filter by status works

**Business Rationale:**
Bianca mentioned needing to see "50% have been dealt with... 10% are overdue." Workflow enables this tracking.

**Technical Notes:**
- Implement as state machine
- Store transitions in audit log
- Calculate SLA based on severity and type

---

#### FR-606: Alert Summary Widgets

**Priority:** 🟠 High | **Related Tasks:** ALERT-006

**User Story:**
> As an Alpal manager, I need visual summary charts of alert status so that I can quickly understand our operational health.

**Detailed Description:**
Alert summary widgets shall display:

**Widget Types:**

1. **Status Donut Chart:**
   - Segments: New, In Progress, Resolved, Overdue
   - Click segment to filter list
   - Center shows total count

2. **Severity Bar Chart:**
   - Bars: Critical, High, Medium, Low
   - Horizontal or vertical layout
   - Color coded by severity

3. **Trend Line Chart:**
   - Alerts created over time (last 7/30/90 days)
   - Alerts resolved over time
   - Net open alerts line

4. **Average Resolution Time:**
   - Numeric display with trend
   - By severity breakdown
   - Comparison to SLA targets

**Acceptance Criteria:**
- [ ] Widgets display accurately
- [ ] Click-through filtering works
- [ ] Responsive layout on different screens
- [ ] Date range selector for trend charts
- [ ] Export chart as image
- [ ] Widgets refresh automatically

**Business Rationale:**
Bianca described wanting "a circle graph where you then consume into each of the components to say, of these alerts, 50% have been dealt with."

**Technical Notes:**
- Use Chart.js or Recharts for visualization
- Pre-aggregate data for performance
- Refresh widgets every 5 minutes

---

#### FR-607: Email Notifications

**Priority:** 🟡 Medium | **Related Tasks:** ALERT-007

**User Story:**
> As an Alpal user, I need to receive email notifications for important alerts so that I'm informed even when not logged into the dashboard.

**Detailed Description:**
Email notifications shall:

**Email Content:**
- Clear subject line with alert type and asset
- Summary of alert details
- Direct link to alert in dashboard
- Unsubscribe/manage preferences link

**Configuration:**
- Per-user notification preferences
- Alert types to receive
- Frequency (immediate, daily digest, weekly digest)
- Quiet hours (no emails during specified times)

**Delivery:**
- Immediate for critical alerts
- Batched for lower severity
- Retry on delivery failure

**Acceptance Criteria:**
- [ ] Emails sent within 5 minutes of alert
- [ ] Email renders correctly in major clients
- [ ] Links work and deep-link to specific alert
- [ ] Unsubscribe works correctly
- [ ] Digest option groups alerts logically
- [ ] Quiet hours respected

**Business Rationale:**
While the dashboard is primary, email ensures users don't miss critical alerts when away from the system.

**Technical Notes:**
- Use transactional email service (SendGrid, SES)
- Implement email templates with branding
- Track open/click rates for optimization

---

#### FR-608: Alert Filtering and Search

**Priority:** 🟡 Medium | **Related Tasks:** ALERT-008

**User Story:**
> As an Alpal support agent, I need to search and filter alerts so that I can find specific issues quickly.

**Detailed Description:**
Alert filtering shall support:

**Filters:**
- Status (multi-select)
- Severity (multi-select)
- Type/Category (multi-select)
- Date range (created, resolved)
- Assignee
- Asset ID
- Customer/Project

**Search:**
- Full-text search on alert content
- Asset ID search
- Keywords in notes/comments

**Saved Filters:**
- Save current filter as preset
- Quick access to saved filters
- Share filters with team

**Acceptance Criteria:**
- [ ] All filter options available
- [ ] Filters can be combined
- [ ] Search returns results within 1 second
- [ ] Clear all filters button
- [ ] Filter state in URL (shareable)
- [ ] Saved filter presets
- [ ] Result count displayed

**Business Rationale:**
With potentially thousands of alerts, efficient filtering is essential for operational efficiency.

**Technical Notes:**
- Index alert content for full-text search
- Use Elasticsearch for complex queries at scale
- Cache filter result counts

---

*[Document continues with FR-700 through FR-1000 with similar detail level]*

---

#functional-requirements #detailed-specs #acceptance-criteria


---

### FR-700: Natural Language Query - Ask Bob (Detailed)

---

#### FR-701: Natural Language Query Input

**Priority:** 🟠 High | **Related Tasks:** NLQ-001, NLQ-002

**User Story:**
> As an Alpal user, I need to type natural language questions into a search field so that I can query my data without learning complex filter interfaces.

**Detailed Description:**
The "Ask Bob" natural language input shall:

**Input Field:**
- Present on every dashboard page
- Prominent placement (header or floating)
- Placeholder text with example queries
- Autocomplete suggestions based on history
- Voice input option (future)

**Example Queries:**
- "Show me devices in Germany"
- "Which SIMs are active in Europe?"
- "Assets that haven't moved in 7 days"
- "Low battery devices for Nestle"
- "Alerts created this week"

**Query Processing:**
- Parse natural language to identify:
  - Entity type (devices, SIMs, assets, alerts)
  - Filters (location, status, customer, date range)
  - Aggregations (count, sum, average)
  - Sort order

**Acceptance Criteria:**
- [ ] Input field visible on all main pages
- [ ] Query processes within 2 seconds
- [ ] Autocomplete shows recent queries
- [ ] Example queries provided as suggestions
- [ ] Error handling for unparseable queries
- [ ] Query history accessible

**Business Rationale:**
Bianca specifically requested: "Your feedback on wanting to have the ability to use a natural language prompt anywhere in the dashboard." This differentiates Ioto from competitors.

**Technical Notes:**
- Use LLM (Claude/GPT) for query parsing
- Convert natural language to structured query
- Cache common query patterns
- Implement query normalization

---

#### FR-702: Dashboard Filter Update (Not Chat)

**Priority:** 🔴 Critical | **Related Tasks:** NLQ-003

**User Story:**
> As an Alpal user, when I type a query like "show me SIMs active in Europe", the dashboard should filter to show those SIMs, not give me a text answer in a chat bubble.

**Detailed Description:**
Natural language queries must update the dashboard view:

**Behavior:**
1. User types query in "Ask Bob" field
2. System parses query to extract filters
3. Dashboard filters are updated programmatically
4. View refreshes to show matching results
5. Active filters shown as removable chips

**NOT This (Chat Response):**
```
User: "Which SIMs are active in Europe?"
Bot: "There are 523 SIMs active in Europe. Here's a breakdown..."
```

**But This (Dashboard Update):**
```
User: "Which SIMs are active in Europe?"
[Dashboard filters to: Region = Europe, Status = Active]
[SIM list shows 523 filtered results]
[Filter chips show: "Region: Europe" "Status: Active"]
```

**Fallback:**
- If query cannot be translated to filters, show explanation
- Offer alternative query suggestions
- Allow refinement of query

**Acceptance Criteria:**
- [ ] Query updates dashboard filters, not chat
- [ ] Filter chips appear showing applied filters
- [ ] Results count updates immediately
- [ ] Clearing filters returns to default view
- [ ] Complex queries translate to multiple filters
- [ ] Ambiguous queries prompt for clarification
- [ ] Graph/chart views also update to filtered data

**Business Rationale:**
Bianca was explicit: "The language prompt does that... I would type there, show me which Sims are active in Europe. And that would bring up the systems that are active in Europe." This is distinct from typical chatbot behavior.

**Technical Notes:**
- Map NLQ output to filter API parameters
- Store filter state in URL for shareability
- Ensure all dashboard components respect global filter context
- Implement filter middleware that all views subscribe to

---

#### FR-703: Saved Query Presets

**Priority:** 🟠 High | **Related Tasks:** NLQ-004

**User Story:**
> As an Alpal power user, I need to save frequently used queries as presets so that I can quickly apply them without retyping.

**Detailed Description:**
Query presets shall allow:

**Save Query:**
- Button to save current query/filter state
- Name the preset
- Optional description
- Choose visibility (personal or team)

**Manage Presets:**
- List all saved presets
- Edit preset name/description
- Delete presets
- Reorder presets
- Share presets with team

**Apply Preset:**
- Single click to apply
- Keyboard shortcut (Ctrl+1, Ctrl+2, etc.)
- Search presets by name

**Preset Storage:**
- User-specific presets
- Team/organization presets (shared)
- System-provided defaults

**Acceptance Criteria:**
- [ ] Save button available after query execution
- [ ] Preset name required, description optional
- [ ] Presets appear in quick-access dropdown
- [ ] Click preset applies filters instantly
- [ ] Edit/delete options in preset management
- [ ] Team sharing with permissions
- [ ] Import/export presets

**Business Rationale:**
Power users will have standard views they check regularly. Presets reduce friction and ensure consistency.

**Technical Notes:**
- Store presets as JSON: { name, filters: {...}, createdBy, shared }
- Index by user_id and organization_id
- Limit presets per user (e.g., 50 max)

---

#### FR-704: Tabbed View System

**Priority:** 🟠 High | **Related Tasks:** NLQ-005

**User Story:**
> As an Alpal user, I want my saved queries to appear as tabs at the top of the dashboard so that I can switch between views quickly.

**Detailed Description:**
Tabbed views shall provide:

**Tab Bar:**
- Horizontal tab strip above main content
- "All" tab as default (no filters)
- Saved presets appear as additional tabs
- Active tab highlighted
- Overflow handling for many tabs (scroll or dropdown)

**Tab Interaction:**
- Click tab → applies that preset's filters
- Right-click tab → context menu (rename, delete, duplicate)
- Drag tab → reorder
- Close button on tab → removes (with confirmation)

**Tab Persistence:**
- Tab order persists across sessions
- Active tab restored on page load
- Tabs sync across devices (optional)

**Acceptance Criteria:**
- [ ] Tab bar displays saved presets
- [ ] Clicking tab applies filters instantly
- [ ] Active tab visually distinct
- [ ] Tab reordering works via drag
- [ ] Close tab removes preset (with confirmation)
- [ ] Tab state persists in local storage
- [ ] Maximum tabs limit (e.g., 10)

**Business Rationale:**
Bianca mentioned: "You have presets, views that you go to... then you can actually talk about that yourself." Tabs provide visual organization for frequent views.

**Technical Notes:**
- Store tab order in user preferences
- Implement as React tabs component
- Sync with preset management (tab = preset)

---

#### FR-705: Custom View Tab CRUD

**Priority:** 🟠 High | **Related Tasks:** NLQ-006

**User Story:**
> As an Alpal user, I need full control to create, rename, and delete my custom view tabs so that I can organize my dashboard my way.

**Detailed Description:**
Tab management shall support:

**Create Tab:**
- "+" button at end of tab bar
- Opens modal to define:
  - Tab name
  - Starting filters (current or blank)
  - Icon (optional)
  - Color (optional)

**Rename Tab:**
- Double-click tab name to edit inline
- Or right-click → Rename

**Delete Tab:**
- Close button on tab
- Right-click → Delete
- Confirmation dialog
- Undo option (30 seconds)

**Duplicate Tab:**
- Right-click → Duplicate
- Creates copy with "(Copy)" suffix
- Edit new tab immediately

**Acceptance Criteria:**
- [ ] Create new tab via "+" button
- [ ] Inline rename on double-click
- [ ] Delete with confirmation
- [ ] Duplicate creates exact copy
- [ ] Undo delete within 30 seconds
- [ ] Tab customization (name, icon, color)
- [ ] Validation: unique names required

**Business Rationale:**
User empowerment to customize their workspace improves satisfaction and efficiency.

**Technical Notes:**
- Implement inline editing with contenteditable
- Store undo buffer for delete recovery
- Validate tab name uniqueness per user

---

#### FR-706: CSV Export from Queries

**Priority:** 🟡 Medium | **Related Tasks:** NLQ-007

**User Story:**
> As an Alpal analyst, I need to export query results to CSV so that I can perform additional analysis in Excel or other tools.

**Detailed Description:**
Query export shall:

**Export Options:**
- Export current filtered view
- Choose columns to include
- Choose sort order
- Limit rows (or all)

**Export Format:**
- CSV with headers
- UTF-8 encoding
- Configurable delimiter (, or ;)
- Option for Excel-compatible format

**Export Delivery:**
- Immediate download for small datasets (< 10,000 rows)
- Email link for large datasets
- Progress indicator for long exports

**Acceptance Criteria:**
- [ ] Export button on all list views
- [ ] Column selection dialog
- [ ] Download starts within 5 seconds for < 1,000 rows
- [ ] Large exports queued with email notification
- [ ] CSV opens correctly in Excel
- [ ] Special characters handled properly
- [ ] Export logged for audit

**Business Rationale:**
Users need to extract data for reporting, analysis, and sharing with stakeholders who don't have system access.

**Technical Notes:**
- Stream large exports to avoid memory issues
- Use worker process for background exports
- Store exports temporarily (24 hours) for download

---

#### FR-707: Email Generation for Support

**Priority:** 🟡 Medium | **Related Tasks:** NLQ-008

**User Story:**
> As an Alpal user, when I see an issue in the dashboard, I need to quickly generate an email to support with all relevant context automatically included.

**Detailed Description:**
Support email generation shall:

**Trigger:**
- "Email Support" button on alert detail
- "Report Issue" button on device/SIM detail
- Context menu option on any data row

**Email Content (Auto-Generated):**
- Subject: "[Alert Type] - [Asset/Device ID]"
- Body includes:
  - Current view/context
  - Relevant data (device status, location, etc.)
  - User's description (prompted)
  - Timestamp
  - Link back to dashboard view

**Delivery:**
- Opens user's email client with pre-filled content
- Or sends via platform (if configured)
- CC options

**Acceptance Criteria:**
- [ ] Email button available in relevant views
- [ ] Pre-filled subject and body
- [ ] User can edit before sending
- [ ] Deep link to dashboard included
- [ ] Screenshot attachment option
- [ ] Works with mailto: and platform email

**Business Rationale:**
Demo showed: "You can immediately, as your finger is on the pulse, you at that heartbeat moment, you can generate the data, push it to us."

**Technical Notes:**
- Use mailto: protocol for client-side email
- Encode content properly for URL
- Limit body length for mailto compatibility
- Consider platform-native email for longer content

---

#### FR-708: LLM Data Restriction

**Priority:** 🔴 Critical | **Related Tasks:** NLQ-009

**User Story:**
> As a platform administrator, I need the AI to only access our internal data and never retrieve or generate information from external sources so that we maintain data integrity and prevent hallucinations.

**Detailed Description:**
LLM restriction shall ensure:

**Data Boundaries:**
- LLM can ONLY query tenant's own database
- No internet access during query processing
- No retrieval from external APIs
- No generation of fictional data

**Prohibited Actions:**
- Web search
- External API calls
- Making up data that doesn't exist
- Accessing other tenants' data
- Revealing system architecture

**Guardrails:**
- Query must translate to database query
- If data doesn't exist, report "No data found"
- Never fabricate statistics or counts
- Audit all LLM queries

**Response Validation:**
- Verify response data matches database
- Flag potential hallucinations
- Require citation of data source

**Acceptance Criteria:**
- [ ] LLM cannot access external internet
- [ ] Queries only execute against tenant database
- [ ] "I don't know" response for unavailable data
- [ ] No cross-tenant data leakage
- [ ] Audit log of all LLM queries
- [ ] Hallucination detection implemented
- [ ] Security review passed

**Business Rationale:**
Demo mentioned: "We don't allow it to hallucinate and go to the outside world." This is essential for data integrity and customer trust.

**Technical Notes:**
- Run LLM in isolated environment without network
- Use function calling to restrict to defined tools
- Implement output validation layer
- Consider fine-tuned model for domain specificity

---

### FR-800: Device-Asset Association (Detailed)

---

#### FR-801: Device-Asset Mapping Model

**Priority:** 🔴 Critical | **Related Tasks:** ASSOC-001

**User Story:**
> As the system, I must maintain a data model that links each device to exactly one asset so that asset location is derived from device location.

**Detailed Description:**
The device-asset mapping shall:

**Data Model:**
```
Asset
  - id (PK)
  - name
  - type
  - metadata (JSON)
  - device_id (FK, nullable, unique)
  - created_at
  - updated_at

Device
  - id (PK)
  - imei
  - status
  - location
  - battery
  - ...
```

**Relationships:**
- One device → One asset (1:1)
- Device can exist without asset (unassigned inventory)
- Asset can exist without device (manual tracking)

**Association Rules:**
- Device can only be associated with one asset
- Asset can only have one device
- Association change logged with timestamp and user

**Acceptance Criteria:**
- [ ] Foreign key constraint enforces 1:1
- [ ] Unassigned devices queryable
- [ ] Unassigned assets queryable
- [ ] Association history maintained
- [ ] API endpoints for CRUD operations
- [ ] Validation prevents duplicate associations

**Business Rationale:**
Bianca stated: "The device is just attributed to the asset." The mapping model is foundational for the entire asset tracking capability.

**Technical Notes:**
- Use unique constraint on device_id in Asset table
- Consider soft association (separate junction table) for history
- Index device_id for fast lookups

---

#### FR-802: Bulk Device-Asset Association

**Priority:** 🟠 High | **Related Tasks:** ASSOC-002

**User Story:**
> As an Alpal inventory manager, I need to associate devices with assets in bulk (hundreds at a time) so that I can efficiently onboard new deployments.

**Detailed Description:**
Bulk association shall support:

**Input Methods:**
1. **CSV Upload:**
   - Columns: device_id, asset_id
   - Validation before processing
   - Error report for failed rows

2. **Scan & Match:**
   - Scan device barcode
   - Scan asset barcode
   - Auto-associate pair

3. **Batch UI:**
   - Select multiple devices from list
   - Select asset group
   - Auto-assign sequentially

**Validation:**
- Device exists and is unassigned
- Asset exists and is unassigned
- No duplicate associations in batch

**Processing:**
- Transactional (all or nothing option)
- Partial success with error report
- Progress indicator for large batches
- Undo entire batch option

**Acceptance Criteria:**
- [ ] CSV upload accepts 1000+ rows
- [ ] Validation report before commit
- [ ] Failed rows clearly identified
- [ ] Successful associations logged
- [ ] Progress bar for large batches
- [ ] Download error report
- [ ] Undo batch within 24 hours

**Business Rationale:**
Bianca mentioned needing to "associate the device and asset at scale." Manual one-by-one association is not feasible for commercial deployments.

**Technical Notes:**
- Process CSV in chunks (100 rows)
- Use database transaction for atomicity
- Store batch ID for undo capability
- Implement async processing for large batches

---

#### FR-803: Device vs. Asset Rules Engine

**Priority:** 🟠 High | **Related Tasks:** ASSOC-003

**User Story:**
> As an Alpal operations manager, I need to define rules that determine whether certain behaviors apply to the device level or asset level so that alerts and status logic work correctly.

**Detailed Description:**
The rules engine shall distinguish:

**Device-Level Rules:**
| Rule Type | Applies To | Example |
|-----------|------------|---------|
| Low Battery | Device | Alert when battery < 20% |
| No Report | Device | Alert when no data for 48 hours |
| Signal Strength | Device | Alert when signal < -100 dBm |
| Firmware Update | Device | Notify when update available |

**Asset-Level Rules:**
| Rule Type | Applies To | Example |
|-----------|------------|---------|
| Geozone Breach | Asset | Alert when asset leaves zone |
| Arrival Overdue | Asset | Alert when asset late |
| Trip Complete | Asset | Log when trip cycle completes |
| Idle Too Long | Asset | Alert when no movement > 30 days |

**Rule Configuration:**
- Select rule scope (device or asset)
- Define conditions
- Set thresholds
- Configure actions

**Inheritance:**
- Asset inherits location from device
- Asset rules trigger based on device data
- Separation maintained for clarity

**Acceptance Criteria:**
- [ ] Rules clearly labeled as device or asset scope
- [ ] Device rules don't create asset alerts
- [ ] Asset rules evaluate device data correctly
- [ ] Rules can be mixed in same alert profile
- [ ] Scope visible in alert detail
- [ ] Documentation explains difference

**Business Rationale:**
Bianca mentioned the distinction: "From a device management perspective, we would need to see... from an asset checking perspective... it's very industry specific."

**Technical Notes:**
- Tag rules with scope enum: DEVICE | ASSET
- Resolve asset location from device before asset rule evaluation
- Maintain clear separation in rule UI

---

#### FR-804: One-to-One Attribution Enforcement

**Priority:** 🟠 High | **Related Tasks:** ASSOC-004

**User Story:**
> As the system, I must enforce that each device can only be linked to one asset (and vice versa) to maintain data integrity.

**Detailed Description:**
Attribution enforcement shall:

**Constraints:**
- Database unique constraint on device_id in Asset
- API validation before association
- UI prevents invalid associations

**Conflict Handling:**
- If device already associated: prompt to reassign
- If asset already has device: prompt to replace
- Log all reassignments with reason

**Edge Cases:**
- Device swap: remove from old asset, assign to new
- Asset replacement: unassign device, assign to new asset
- Decommission: unassign without new association

**Acceptance Criteria:**
- [ ] Cannot associate device already linked to asset
- [ ] Cannot assign second device to asset
- [ ] Reassignment workflow handles conflicts
- [ ] All changes logged with audit trail
- [ ] API returns clear error for violations
- [ ] Orphan reports show unassigned items

**Business Rationale:**
Data integrity is essential. If a device mapped to multiple assets, location data becomes meaningless.

**Technical Notes:**
- Use database UNIQUE constraint as primary enforcement
- API layer validates before attempting insert
- Handle race conditions with optimistic locking

---

#### FR-805: Asset Location from Device

**Priority:** 🟠 High | **Related Tasks:** ASSOC-005

**User Story:**
> As the system, I must automatically derive asset location from its associated device so that customers see asset locations without needing to understand devices.

**Detailed Description:**
Location derivation shall:

**Real-Time:**
- When device reports location, update asset location
- Asset location = associated device location
- Timestamp reflects device report time

**Historical:**
- Asset location history = device location history
- Query asset path returns device path
- Attribution preserved even if device swapped

**Display:**
- Customer sees "Asset Location" (not device location)
- Terminology uses "asset" not "device"
- Location accuracy reflects device GPS accuracy

**Edge Cases:**
- Unassociated asset: location = "Unknown"
- Device with no GPS fix: use last known location
- Device swap: location continues from new device

**Acceptance Criteria:**
- [ ] Asset location updates with device location
- [ ] Customer API returns asset.location (not device.location)
- [ ] Historical path available for asset
- [ ] Unassociated assets show "Unknown" location
- [ ] Device swap maintains location continuity
- [ ] Terminology consistently uses "asset"

**Business Rationale:**
Abstraction is key. Customers track assets, not devices. The device is an implementation detail.

**Technical Notes:**
- Consider denormalizing location to Asset for query performance
- Trigger location update on device.location change
- Maintain history in separate table: asset_location_history

---

### FR-900: Integration & Connectivity (Detailed)

---

#### FR-901: MQTT Integration

**Priority:** 🔴 Critical | **Related Tasks:** INT-001

**User Story:**
> As the platform, I must receive device telemetry via MQTT so that I can process real-time location and sensor data.

**Detailed Description:**
MQTT integration shall:

**Broker Configuration:**
- Support connection to external MQTT broker
- Support hosted MQTT broker (Ioto's own)
- TLS encryption required
- Username/password or certificate authentication

**Topic Structure:**
```
devices/{device_id}/telemetry
devices/{device_id}/status
devices/{device_id}/location
devices/{device_id}/events
```

**Message Processing:**
- Parse incoming JSON payloads
- Validate message schema
- Extract relevant fields
- Trigger downstream processing (location update, alerts, etc.)

**Reliability:**
- QoS 1 or 2 for guaranteed delivery
- Message persistence during downtime
- Dead letter queue for failed messages
- Retry logic for transient failures

**Acceptance Criteria:**
- [ ] Connect to MQTT broker with TLS
- [ ] Authenticate with credentials or certificate
- [ ] Subscribe to device topics
- [ ] Parse standard telemetry payloads
- [ ] Handle 1000+ messages per second
- [ ] No message loss during processing
- [ ] Monitor connection health
- [ ] Reconnect automatically on disconnect

**Business Rationale:**
Demo mentioned: "Our own MQTT stack. So you have an option of whichever [cloud MQTT or Ioto MQTT]." MQTT is the standard for IoT telemetry.

**Technical Notes:**
- Use MQTT client library (Paho, MQTT.js)
- Implement message queue for burst handling
- Consider MQTT 5.0 for advanced features
- Monitor with Prometheus/Grafana

---

#### FR-902: Mediation Layer for Charging Data

**Priority:** 🟠 High | **Related Tasks:** INT-002

**User Story:**
> As the platform, I must ingest charging data records (CDRs) from the network operator so that I can display usage and billing information.

**Detailed Description:**
Mediation layer shall:

**Data Sources:**
- CDRs from Jersey Telecom / Ioto
- Network events (attach, detach, handover)
- Billing records

**Ingestion Methods:**
- Real-time API push
- Batch file upload (CSV, TAP3)
- Database replication
- Message queue (Kafka, RabbitMQ)

**Processing:**
- Parse CDR format (vendor-specific)
- Normalize to standard schema
- Enrich with device/customer context
- Aggregate for reporting
- Store raw and processed records

**Data Fields:**
| Field | Description |
|-------|-------------|
| ICCID | SIM identifier |
| Timestamp | Event time |
| Event Type | Attach, Session, SMS, etc. |
| Network | MCC/MNC |
| Duration | Session length |
| Data Volume | Bytes transferred |
| Location | Cell ID |

**Acceptance Criteria:**
- [ ] Ingest CDRs from configured sources
- [ ] Normalize to common schema
- [ ] Handle multiple vendor formats
- [ ] Process 100,000+ records per hour
- [ ] Data available within 15 minutes of event
- [ ] Raw records retained for audit
- [ ] Error handling for malformed records

**Business Rationale:**
CDRs are the source of truth for connectivity usage. Without mediation, the platform cannot show consumption or network activity.

**Technical Notes:**
- Implement adapter pattern for vendor formats
- Use ETL pipeline (Apache Airflow, Prefect)
- Store time-series data in InfluxDB or TimescaleDB
- Partition by date for query performance

---

#### FR-903: Data Export API

**Priority:** 🟠 High | **Related Tasks:** INT-003

**User Story:**
> As an Alpal IT administrator, I need API endpoints to export data so that I can integrate with our internal systems.

**Detailed Description:**
Export API shall provide:

**Endpoints:**
| Endpoint | Description |
|----------|-------------|
| GET /api/v1/devices | List devices with filters |
| GET /api/v1/sims | List SIM cards with filters |
| GET /api/v1/assets | List assets with filters |
| GET /api/v1/alerts | List alerts with filters |
| GET /api/v1/telemetry | Time-series telemetry data |
| GET /api/v1/reports | Pre-built report data |

**Features:**
- Pagination (limit, offset, cursor)
- Filtering (query parameters)
- Field selection (sparse fieldsets)
- Sorting
- Format (JSON, CSV)
- Rate limiting

**Authentication:**
- API key authentication
- OAuth 2.0 support
- Scoped permissions per key

**Documentation:**
- OpenAPI/Swagger specification
- Interactive API explorer
- Code examples (Python, JavaScript)

**Acceptance Criteria:**
- [ ] RESTful API design
- [ ] Authentication required on all endpoints
- [ ] Pagination works for large datasets
- [ ] Filters documented and functional
- [ ] Rate limiting enforced (1000 req/hour default)
- [ ] Swagger UI available
- [ ] Versioned endpoints (v1, v2)

**Business Rationale:**
Enterprise customers need to integrate platform data with their own systems (ERP, WMS, BI tools).

**Technical Notes:**
- Follow REST best practices
- Use JSON:API or similar specification
- Implement cursor-based pagination for consistency
- Cache responses where appropriate

---

#### FR-904: Jersey Telecom / Ioto Backend Integration

**Priority:** 🔴 Critical | **Related Tasks:** INT-004

**User Story:**
> As the platform, I must integrate with Jersey Telecom (via Ioto) connectivity backend so that SIM management and network data flows automatically.

**Detailed Description:**
Backend integration shall:

**SIM Management:**
- Provision new SIMs
- Activate/suspend SIMs
- Query SIM status
- Update SIM data plans

**Network Data:**
- Receive attach/detach events
- Receive location updates (cell ID)
- Receive usage data
- Receive roaming information

**Synchronization:**
- Real-time events via webhook or MQTT
- Periodic full sync for reconciliation
- Conflict resolution for discrepancies

**API Calls:**
- Outbound to JT/Ioto for management
- Inbound from JT/Ioto for events

**Acceptance Criteria:**
- [ ] SIM provisioning API works
- [ ] SIM status changes reflect in platform
- [ ] Network events received in real-time
- [ ] Usage data accurate within 15 minutes
- [ ] Error handling for API failures
- [ ] Retry logic for transient errors
- [ ] Health monitoring of integration

**Business Rationale:**
Jersey Telecom is the MNO partner. Integration enables seamless connectivity management without manual intervention.

**Technical Notes:**
- Implement adapter for JT API
- Use webhook for push events
- Queue failed API calls for retry
- Monitor API response times

---

#### FR-905: Onomondo Compatibility

**Priority:** 🟠 High | **Related Tasks:** INT-005

**User Story:**
> As an Alpal user, I need the platform to work with my existing Onomondo SIMs so that I don't have to replace my current connectivity during migration.

**Detailed Description:**
Onomondo compatibility shall:

**Data Import:**
- Import SIM inventory from Onomondo
- Import historical usage data
- Import device associations (if available)

**Ongoing Sync:**
- Receive events from Onomondo (optional)
- Mirror data for hybrid operation
- Support gradual migration

**Feature Parity:**
- Match Onomondo dashboard capabilities
- Ensure no functionality loss during transition

**Acceptance Criteria:**
- [ ] Import SIMs from Onomondo export
- [ ] Historical data preserved
- [ ] Side-by-side operation supported
- [ ] Clear migration path documented
- [ ] No duplicate data issues
- [ ] Onomondo-specific features mapped

**Business Rationale:**
Bianca mentioned: "We've been continuing with Onomondo... their platform's been quite integral in our integration process." Compatibility ensures smooth transition.

**Technical Notes:**
- Document Onomondo export format
- Create import scripts/tools
- Map Onomondo data model to Ioto model
- Plan for eventual deprecation of dual-stack

---

#### FR-906: Device Pre-Integration

**Priority:** 🟠 High | **Related Tasks:** INT-006

**User Story:**
> As an Alpal user, I want my specific device models to be pre-integrated so that I can deploy them without custom development.

**Detailed Description:**
Device pre-integration shall:

**Pre-Integration Work:**
- Document device communication protocol
- Implement payload parser
- Test with physical device
- Create device profile in platform

**Device Profile:**
| Field | Description |
|-------|-------------|
| Manufacturer | Device maker |
| Model | Specific model |
| Protocol | MQTT, HTTP, CoAP, etc. |
| Payload Format | JSON schema |
| Capabilities | GPS, temperature, accelerometer, etc. |
| Battery Type | Rechargeable, replaceable |
| Expected Battery Life | Days/months |

**Device Catalog:**
- List of pre-integrated devices
- Compatibility status
- Setup instructions
- Known limitations

**Acceptance Criteria:**
- [ ] Device catalog available in documentation
- [ ] Alpal's shortlisted devices added
- [ ] Payload parsing works automatically
- [ ] Device capabilities correctly detected
- [ ] Setup guide per device model
- [ ] Test report available

**Business Rationale:**
Demo mentioned: "We've already shortlisted devices that we will pre-integrate." This reduces onboarding friction and ensures reliable operation.

**Technical Notes:**
- Implement payload parser plugins
- Store device profiles as configuration
- Autodetect device type from payload if possible
- Maintain compatibility matrix

---

### FR-1000: Financial & Usage Analytics (Detailed)

---

#### FR-1001: Consumption Trend Visualization

**Priority:** 🟡 Medium | **Related Tasks:** FIN-001

**User Story:**
> As an Alpal finance manager, I need to see data consumption trends over time so that I can forecast costs and identify anomalies.

**Detailed Description:**
Consumption visualization shall display:

**Chart Types:**
- Line chart: daily/weekly/monthly consumption
- Bar chart: consumption by customer/project
- Area chart: cumulative consumption over period
- Sparklines: inline trend indicators

**Time Ranges:**
- Last 7 days
- Last 30 days
- Last 90 days
- Last 12 months
- Custom date range

**Breakdown Options:**
- By customer
- By project
- By device type
- By carrier/network

**Features:**
- Hover for exact values
- Zoom/pan on chart
- Download chart as image
- Export underlying data

**Acceptance Criteria:**
- [ ] Charts render within 3 seconds
- [ ] Time range selector works
- [ ] Breakdown filters apply correctly
- [ ] Trend line shows direction
- [ ] Comparison to previous period available
- [ ] Export to CSV and PNG
- [ ] Mobile-responsive charts

**Business Rationale:**
Understanding consumption patterns enables cost optimization and capacity planning.

**Technical Notes:**
- Pre-aggregate data for common time ranges
- Use Chart.js or Recharts for visualization
- Cache chart data with 1-hour TTL

---

#### FR-1002: Traffic Heatmap

**Priority:** 🟡 Medium | **Related Tasks:** FIN-002

**User Story:**
> As an Alpal network analyst, I need to see a geographic heatmap of data traffic so that I can understand where our devices are most active.

**Detailed Description:**
Traffic heatmap shall:

**Visualization:**
- Map with heat overlay
- Intensity based on data volume
- Color gradient (green → yellow → red)
- Zoom-appropriate aggregation

**Data Options:**
- Data volume (MB/GB)
- Session count
- Device density
- Alert frequency

**Time Filtering:**
- Select time period
- Animate over time (optional)
- Compare periods

**Acceptance Criteria:**
- [ ] Heatmap renders on map
- [ ] Intensity reflects selected metric
- [ ] Legend explains color scale
- [ ] Clicking hotspot shows details
- [ ] Performance acceptable with 10,000+ points
- [ ] Export as image

**Business Rationale:**
Geographic analysis reveals operational patterns—busy routes, underserved areas, coverage gaps.

**Technical Notes:**
- Aggregate to grid cells for performance
- Use Mapbox heatmap layer
- Pre-calculate intensity values

---

#### FR-1003: CDR Display

**Priority:** 🟡 Medium | **Related Tasks:** FIN-003

**User Story:**
> As an Alpal billing analyst, I need to view detailed call data records so that I can verify charges and investigate usage.

**Detailed Description:**
CDR display shall show:

**Record Fields:**
- Timestamp
- ICCID / Device
- Event type
- Network/Carrier
- Cell ID
- Duration
- Data volume
- Cost (if available)

**Features:**
- Sortable columns
- Filterable by all fields
- Date range selection
- Pagination for large datasets
- Export to CSV

**Aggregations:**
- Total data per period
- Total sessions
- Average session duration
- Cost summary

**Acceptance Criteria:**
- [ ] CDR list displays all required fields
- [ ] Sorting works on all columns
- [ ] Filters narrow results correctly
- [ ] Date picker selects range
- [ ] Export includes all filtered records
- [ ] Pagination handles 100,000+ records
- [ ] Load time < 3 seconds

**Business Rationale:**
CDR access enables billing verification, dispute resolution, and detailed usage analysis.

**Technical Notes:**
- Index CDR table on timestamp, iccid
- Use cursor pagination for consistency
- Consider read replica for heavy queries

---

#### FR-1004: Monthly Cost Trend

**Priority:** 🟡 Medium | **Related Tasks:** FIN-004

**User Story:**
> As an Alpal CFO, I need to see monthly connectivity costs over time so that I can budget and track spending.

**Detailed Description:**
Cost trend shall display:

**Metrics:**
- Total monthly cost
- Cost per device
- Cost per MB
- Month-over-month change
- Year-over-year change

**Visualization:**
- Bar chart: monthly costs
- Line chart: cost trend
- Table: monthly breakdown

**Breakdown:**
- By customer
- By project
- By carrier
- By cost category (data, SMS, roaming)

**Forecasting:**
- Projected cost for current month
- Projected cost for next quarter
- Budget vs. actual comparison

**Acceptance Criteria:**
- [ ] Monthly costs displayed accurately
- [ ] Breakdown by category available
- [ ] Trend direction indicated
- [ ] Forecast based on recent trends
- [ ] Budget line overlay (if configured)
- [ ] Export for finance reporting
- [ ] Currency formatting correct

**Business Rationale:**
Demo showed: "This is a trend of how your consumption is over the month." Cost visibility is essential for financial management.

**Technical Notes:**
- Calculate costs from CDRs and rate plans
- Pre-aggregate monthly totals
- Support multiple currencies
- Forecast using linear regression on recent months

---

#functional-requirements #detailed-specs #nlq #integration #analytics

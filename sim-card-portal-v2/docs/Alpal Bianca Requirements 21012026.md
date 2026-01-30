# ALPAL REQUIREMENTS DOCUMENT
## IoT Platform & Asset Tracking Requirements

| Field | Value |
|-------|-------|
| **Customer** | Alpal (Bianca) |
| **Source** | Meeting Transcript Analysis |
| **Meeting Location** | Copenhagen (Ioto team in-person session) |
| **Document Date** | January 2026 |

---

## 1. Executive Summary

Alpal is developing an IoT-based packaging asset tracking solution, currently evaluating hardware devices and platform options. The company requires a two-tier view system: an internal device management dashboard for Alpal operations, and a simplified asset tracking dashboard for end customers. Key strategic decision pending is between Platform-as-a-Service (build custom) versus Software-as-a-Service (pre-built logistics solution). Ioto Communications has demonstrated platform capabilities that align with Alpal's connectivity and device management requirements.

### Key Decisions Made
- SIM cards to be delivered for connectivity testing
- Next step: Validate connectivity with shortlisted devices
- Platform integration testing to follow connectivity validation
- Ioto to add Alpal's shortlisted devices to pre-integration list

---

## 2. Business Context

### 2.1 Alpal Business Model
- Provides reusable packaging assets (pallets, crates) to enterprise customers
- Needs to track packaging asset location and lifecycle across supply chain
- Must report on recycled content and trip counts (regulatory requirement)
- Challenge: Justifying IoT cost on lower-value packaging assets

### 2.2 Current Status
- **Hardware:** Two devices shortlisted, undergoing testing for battery life vs. claimed specs
- **Connectivity:** Using Onomondo for SIM card management and testing
- **Platform:** Strategic decision pending between PaaS and SaaS approaches
- **Customers:** Waiting for trial deployment

---

## 3. Platform Requirements

### 3.1 Platform Strategy Decision

| Platform as a Service (PaaS) | Software as a Service (SaaS) |
|------------------------------|------------------------------|
| Build custom dashboards and widgets | Pre-built logistics-specific solution |
| Requires internal expertise to develop | Domain experts have already solved use cases |
| Ongoing maintenance burden | Vendor handles updates and trends |
| Challenge: Often bundled with hardware/connectivity | Challenge: Industry-specific features needed |

**Alpal Position:** Prefers SaaS for domain expertise but needs unbundled solution (software only, not hardware/connectivity).

---

## 4. Dashboard & User View Requirements

### 4.1 Two-Tier User Model

| Aspect | Alpal Internal View | Customer View |
|--------|---------------------|---------------|
| **Primary Purpose** | Device & SIM management | Asset tracking only |
| **Device Info** | Full visibility (battery, IMEI, signal) | Hidden - no device data shown |
| **SIM/Network Data** | Carrier, ICCID, network logs, usage | Hidden completely |
| **Asset Location** | Full map with device attribution | Asset locations on map |
| **Geozones** | Device management zones | Asset movement notifications |

### 4.2 Alpal Internal Dashboard Requirements

#### Device Management Features
- Group devices by customer/project
- View device status: active, offline, maintenance required
- Signal strength monitoring (critical due to devices embedded in pallets)
- Battery level tracking
- Last report timestamp
- Network attachment/detachment logs

#### SIM Card Management
- Carrier identification
- MSISDN, ICCID visibility
- Network logs with session history
- Data consumption tracking
- Roaming network visibility

### 4.3 Customer Dashboard Requirements

#### Core Asset Tracking
- Total asset count
- Asset location map with drill-down capability
- Status: At facility, at supplier, in transit
- Top-level summary boxes by geozone (e.g., warehouse count, in-transit count)

#### Asset Metadata
- Asset birth date / manufacturing date
- Composition (recycled content percentage - regulatory requirement)
- Trip count / usage history
- Asset age

#### Alert Management
- Geofence breach notifications
- Expected arrival date violations
- Temperature/condition alerts (Phase 2)
- Alert dashboard (not just email - manage at scale)
- Alert status tracking: resolved, pending, overdue

---

## 5. Natural Language Query Requirements

Bianca specifically requested natural language prompt capability that updates the dashboard view dynamically, rather than providing answers in a chat-style interface.

### 5.1 Expected Behavior
- User types query (e.g., "show me which SIMs are active in Europe")
- Dashboard filters/updates to show relevant data
- Results displayed in existing dashboard format, not as chat response

### 5.2 Additional Features Requested
- Preset/saved queries as tabs for frequently used filters
- Ability to create, save, and delete custom view tabs
- Export capability (CSV)
- Email generation for support escalation

---

## 6. Integration & Technical Requirements

### 6.1 Device-Asset Association
- Mechanism to associate devices with assets at scale
- Rules engine for device vs. asset behavior
- One-to-one mapping: device attributed to asset

### 6.2 Connectivity Requirements
- Jersey Telecom (via Ioto) for roaming agreements
- Compatible with Onomondo (current test platform)
- MQTT support for device telemetry

### 6.3 Data Architecture
- Customer data isolation (multi-tenant)
- Role-based access control
- API access for data export

---

## 7. Phase 2 Requirements (Future)

*These requirements are acknowledged but not in initial scope:*

### 7.1 Product Tracking (Beyond Packaging)
- Temperature monitoring for products inside packaging
- Humidity tracking
- BLE beacon sensors on bags communicating via pallet gateway
- Quality certification and compliance tracking

### 7.2 Advanced Analytics
- Historical tracking and trend analysis
- Predictive maintenance for devices
- Revenue optimization insights for customers

---

## 8. Action Items & Next Steps

| Owner | Action | Timeline | Status |
|-------|--------|----------|--------|
| Bianca | Collect SIM cards from delivery | Tomorrow | Pending |
| Bianca | Install SIM cards in test devices | This week | Pending |
| Bianca | Confirm shortlisted device specifications to Ioto | ASAP | Pending |
| Bianca | Notify Espen when connectivity testing complete | Post-testing | Pending |
| Ioto | Add Alpal's devices to pre-integration shortlist | Upon receipt | Pending |
| Ioto | Implement dynamic dashboard update via natural language query | TBD | Backlog |
| Both | Schedule Netherlands meeting for deeper collaboration | TBD | Pending |

---

## 9. Risks & Considerations

| Category | Risk | Severity | Mitigation |
|----------|------|----------|------------|
| Business | Customers waiting - pressure to deploy before platform is ready | 🟠 High | Use interim platform for customer demos |
| Technical | Device battery life claims vs. actual performance unknown | 🟠 High | Extended testing before deployment |
| Technical | Signal strength issues with devices embedded in pallets | 🟡 Medium | Field testing in real conditions |
| Strategic | Platform decision (PaaS vs SaaS) still unresolved | 🟡 Medium | Ioto positioned as hybrid solution |
| Execution | Lack of internal logistics software expertise | 🟡 Medium | Ioto consultancy offering |
| Business | Justifying IoT cost on low-value packaging assets | 🟡 Medium | Add product tracking (Phase 2) for value |

---

## 10. Strategic Observations

1. **Industry-Specific Complexity:** Bianca repeatedly emphasized that logistics/packaging tracking has unique requirements that generic IoT platforms don't address. Ioto's consultancy offering is a key differentiator.

2. **Customer Communication Gap:** Bianca noted her colleagues don't understand the complexity of the work being done. Documentation and visible progress milestones would help internal stakeholder management.

3. **Value Proposition Challenge:** Product tracking (temperature, humidity) in Phase 2 may be necessary to justify IoT investment economics, not just Phase 1 asset location tracking.

4. **Platform Positioning:** Ioto sits in a valuable middle ground - not pure PaaS (which requires Alpal to build everything) and not pure SaaS (which is industry-specific and bundled). The hybrid consultancy + platform model addresses Alpal's core dilemma.

5. **Face-to-Face Value:** The Copenhagen in-person session was described as invaluable for fast-tracking understanding. Future Netherlands meeting should be prioritized for deeper requirements definition.

---

#ioto #alpal #requirements #iot #asset-tracking #customer

# Ioto FMP — Project Status & Context Summary

**Last Updated**: 29 January 2026
**Purpose**: Single source of truth for project state. Read this first in any new session.

---

## What Is This Project?

Ioto Communications is building the **Fleet Management Platform (FMP)** — a multi-tenant IoT platform combining connectivity management (CMP) and device/asset management. First tenant: **Alpal** (packaging asset tracking for enterprise customers like Nestle, IKEA).

---

## What Has Been Completed

### Documents Written
| Document | Path | Status |
|----------|------|--------|
| Unified Requirements | `sim-card-portal-v2/docs/unified-requirements.md` | Done — v1.0 |
| Alpal Business Requirements | `sim-card-portal-v2/docs/Alpal Bianca Requirements 21012026.md` | Source doc (superseded) |
| Alpal Code Requirements | `sim-card-portal-v2/docs/Alpal Bianca code Requirements 21012026.md` | Source doc (superseded) |
| CMP Technical Requirements | `sim-card-portal-v2/docs/ioto-cmp-requirements.md` | Source doc (superseded) |

### Decisions Locked (47 Total — Do Not Re-Discuss)

**Architecture**:
- Keycloak for auth (SSO Phase 1, replace hardcoded creds)
- Kafka + Clickhouse (replace InfluxDB)
- PostgreSQL for relational data
- Galvanic tenant separation (dedicated instances per tenant)
- Tenant → Customer → Project (3-level hierarchy)
- Single consolidated TypeScript API
- Single Vue 3 frontend (merge all existing apps)
- Pinia mandatory for state management
- Leaflet/OpenStreetMap (replace Google Maps)
- Automated migration runner mandatory
- Responsive web only (no native mobile)

**Product**:
- Product name: **Ioto FMP**
- Ioto builds it, Alpal is first tenant
- Two AI features: Ask Bob Dashboard (NLQ → filters) + Bob Support (chat)
- Billing: export only, no invoicing in platform
- SIM + Device state machines independent, coordination layer separate
- 1:1 SIM-to-Device mapping
- Flexible labeling system (not state machine pollution)
- Event-driven rules engine
- Bulk operations for all entity types
- Real-time for internal users, near-real-time (15-30min) for customers
- Data retention: 7d live, 90d detailed, 1y aggregated, 7y audit
- Real data only in production (no mock fallback)
- Phase 1 / Phase 2 strict split

**Roles**: Super Admin, Tenant Admin, CMP User, DMP User, FMP User, Customer User, Viewer

---

## What Has NOT Been Started

### Code — Nothing Built Yet for `ioto-fmp`

The `ioto-fmp` GitHub repo does not exist yet. No code has been written for the new platform. Everything below is pending.

### Existing Code (in `pve1/sim-card-portal-v2`)

There is a working prototype with 28 Vue components, Express 5 API, PostgreSQL (Supabase), EMQX MQTT, Docker Compose, and UpCloud deployment. This code has **10 critical security issues** (documented in unified-requirements.md §3.2) and will be selectively migrated — not forked.

### IoTo Brand Color System ✅ (29 Jan 2026)

The prototype has been updated from the old cool gray/blue palette to the official IoTo brand color system:
- **Light mode**: Warm beige backgrounds, white surfaces, navy text, sage green primary
- **Dark mode**: Navy backgrounds, dark navy surfaces, light text, lighter sage green primary
- **Implementation**: PrimeVue `definePreset` + CSS custom properties + Tailwind `@theme`
- **Design reference**: `docs/ioto-color-concept.md` (v1.1 — includes implementation mapping)
- **Files changed**: `main.ts`, `style.css`, `DeviceMap.vue`, `Dashboard.vue`, `Navigation.vue`

---

## What Needs to Happen Next (In Order)

### Pre-Sprint: Repository & Tooling
1. Create `ioto-fmp` GitHub repository
2. Set up monorepo structure (frontend + api + shared)
3. Write `docker-compose.yml` with all 7 services (frontend, api, postgres, kafka+zookeeper, clickhouse, emqx, keycloak)
4. Write `docs/DEVELOPMENT.md` (local dev guide)
5. Verify `docker-compose up` works end-to-end

### Sprint 1 — Foundation (Weeks 1-3)
- Multi-tenant database schema + migrations infrastructure
- Keycloak deployment + realm configuration + OIDC integration
- RBAC middleware (module-based roles)
- Customer/project grouping data model
- Data filtering layer (server-side, whitelist-based)
- Security items SEC-01 through SEC-04, SEC-06, SEC-07, SEC-09, SEC-10
- **FR Coverage**: FR-101 to FR-106

### Sprint 2 — Device & SIM Management (Weeks 4-6)
- Device list, detail, map, filters, signal/battery monitoring
- SIM list, detail, identifiers, session history, consumption, roaming
- JT/Onomondo connectivity integration
- **FR Coverage**: FR-201 to FR-208, FR-301 to FR-307, FR-901, FR-904, FR-905

### Sprint 3 — Customer Dashboard & Maps (Weeks 7-9)
- Customer-facing dashboard (zero device data)
- Asset location map with Leaflet
- Asset metadata, status, geozone summaries
- Geozone CRUD + visualization + entry/exit detection
- Device-asset mapping model
- **FR Coverage**: FR-401 to FR-408, FR-501 to FR-503, FR-801

### Sprint 4 — Alerts & Geofencing (Weeks 10-12)
- Status inference from geozones
- Responsibility transfer logic
- Alert rules engine, dashboard, workflow, notifications
- **FR Coverage**: FR-504, FR-505, FR-601 to FR-608

### Sprint 5 — Bulk & Associations (Weeks 13-14)
- Bulk device-asset association (CSV, batch UI)
- Device vs. asset rules engine
- Bulk provisioning with Kafka progress tracking
- **FR Coverage**: FR-802 to FR-805

### Sprint 6 — NLQ (Weeks 15-17)
- Ask Bob: NLQ → dashboard filter updates (not chat)
- Saved queries, tabbed views, CRUD
- Bob Support chat on support page
- LLM guardrails
- **FR Coverage**: FR-701 to FR-708

### Sprint 7 — Analytics & Polish (Weeks 18-19)
- Consumption trends, traffic heatmap, CDR view, cost trends
- API export endpoints, device pre-integration
- Demo/simulation tools
- **FR Coverage**: FR-1001 to FR-1004, FR-902, FR-903, FR-906

---

## Critical Path (Blockers)

```
ARCH-001 (multi-tenant schema) → blocks everything
  └→ ARCH-002 (Keycloak RBAC) → blocks user views
      └→ ARCH-005 (data filtering) → blocks customer dashboard
INT-001 (MQTT → Kafka pipeline) → blocks all live data
NLQ-003 (dashboard filter mode) → key differentiator, Sprint 6
```

---

## Key Numbers

| Metric | Value |
|--------|-------|
| Total FRs | 65 |
| Critical FRs | 17 |
| High FRs | 37 |
| Medium FRs | 11 |
| Security remediations | 10 |
| Data models defined | 7 (SIM, Device, Asset, Geozone, Alert, Session, Audit) |
| Kafka topics designed | 12 |
| Docker services | 7 |
| Sprints planned | 7 (19 weeks) |

---

## Servers & Infrastructure

| Server | IP | Purpose | Status |
|--------|-----|---------|--------|
| upcloud | 5.22.211.72 | Legacy hosting | Existing |
| upcloudBSS | 94.237.6.75 | FMP production target (Phase 2 deploy) | Existing |
| pve | 192.168.1.59 | Proxmox — existing prototypes | Existing |
| Local Docker | localhost | FMP development (Phase 1) | Not started |

---

## Files That Matter

| File | What It Is |
|------|------------|
| `sim-card-portal-v2/docs/unified-requirements.md` | Full requirements (65 FRs, data models, schemas, glossary) |
| `sim-card-portal-v2/docs/PROJECT-STATUS.md` | This file — read first |
| `docs/ioto-color-concept.md` | IoTo brand color system — design tokens + implementation mapping |
| `CLAUDE.md` (root) | SSH credentials, server details |
| `sim-card-portal-v2/CLAUDE.md` | Existing prototype details, deployment commands |

---

## What To Avoid

1. **Don't re-discuss locked decisions** — all 47 are final (see above)
2. **Don't build on `pve1`** — the new repo is `ioto-fmp`, start fresh
3. **Don't use Google Maps** — Leaflet only
4. **Don't use InfluxDB** — Clickhouse only
5. **Don't create separate frontend apps** — one unified FMP app
6. **Don't hardcode credentials** — Keycloak from day one
7. **Don't add mock data fallback** — real data only in production
8. **Don't skip acceptance criteria** — every FR has them, use as definition of done
9. **Don't build invoicing** — export only
10. **Don't build native mobile** — responsive web only

# SIM Card Portal v2

A next-generation portal for managing SIM card services, including activation, deactivation, and tracking, with enhanced user experience and security features. Built with Vue 3, TypeScript, and modern web technologies, featuring JT corporate branding and professional UI design.

## ✨ Features

- 🔐 **Secure Authentication**: Admin portal with JWT token-based session management
- 📱 **Device Management**: Monitor and manage IoT devices with real-time status
- 💳 **SIM Card Lifecycle**: Complete SIM card management and usage tracking
- 📊 **Analytics Dashboard**: Professional statistics and monitoring interface
- 🎨 **JT Corporate Branding**: Professional design with JT logo and color scheme
- 📱 **Responsive Design**: Optimized for desktop and mobile devices
- ⚡ **Modern Tech Stack**: Vue 3, TypeScript, and Vite for optimal performance
- 🗄️ **Database Integration**: Vercel serverless API with Supabase connectivity

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/tsavenkov/sim-card-portal-v2.git
   cd sim-card-portal-v2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`

4. **Login to the portal**
   - Username: `admin`
   - Password: `1234567`

5. **Build for production**
   ```bash
   npm run build
   ```

6. **Preview production build**
   ```bash
   npm run preview
   ```

### Full Development Setup (with Real-time MQTT Data)

For full functionality including real-time sensor data synchronization, you need to run multiple services:

#### Prerequisites
- PostgreSQL database running on port 5434 (Docker)
- MQTT broker at `192.168.1.199:1883` (EMQX)

#### Required Services

Start these services in separate terminals:

1. **SIM Portal (Frontend)** - Port 5173
   ```bash
   npm run dev
   ```

2. **Local API Server + MQTT Bridge** - Ports 3001 & 3003
   ```bash
   npm run api:local
   ```
   > The MQTT Bridge (WebSocket server for real-time updates) is automatically started and stopped with the API server.

3. **Data Generator** (Simulated IoT Data)
   ```bash
   cd /path/to/MQTTServer/scripts/simportal-generator
   MQTT_BROKER_URL=mqtt://192.168.1.199:1883 node index.js
   ```

4. **MQTT Control Panel** (Optional - Device Simulator UI) - Port 5174
   ```bash
   cd /path/to/MQTTServer/tools/mqtt-control-panel
   npm run dev
   ```

#### Environment Configuration

Update `.env` for local development:
```env
VITE_USE_API=true
VITE_API_URL=http://localhost:3001
VITE_WEBSOCKET_URL=ws://localhost:3003/ws
MQTT_BROKER_URL=mqtt://192.168.1.199:1883
```

#### Data Flow Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Data Generator │────▶│ MQTT Broker  │◀────│ MQTT Control    │
│  (Simulated)    │     │ (EMQX)       │     │ Panel           │
└─────────────────┘     └──────┬───────┘     └─────────────────┘
                               │
                               ▼
                     ┌──────────────────┐
                     │   MQTT Bridge    │
                     │  (Port 3003)     │
                     └────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
      │  PostgreSQL  │ │  WebSocket   │ │  Local API   │
      │  (Port 5434) │ │  Clients     │ │  (Port 3001) │
      └──────────────┘ └──────────────┘ └──────────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │   SIM Portal     │
                     │  (Port 5173)     │
                     └──────────────────┘
```

## 🔌 Testing the Provisioning API

The Provisioning API v1 provides endpoints for SIM lifecycle management, webhook registration, and usage/mediation data ingestion. This API is designed for integration with external provisioning and mediation systems.

### API Overview

| Category | Endpoints |
|----------|-----------|
| Health | `GET /api/v1/health` |
| SIM Provisioning | `POST /api/v1/sims`, `GET /api/v1/sims`, `GET /api/v1/sims/:simId`, `PATCH /api/v1/sims/:simId` |
| SIM Lifecycle | `POST /api/v1/sims/:simId/activate`, `POST /api/v1/sims/:simId/deactivate`, `POST /api/v1/sims/:simId/block`, `POST /api/v1/sims/:simId/unblock` |
| Usage | `GET /api/v1/sims/:simId/usage`, `POST /api/v1/usage`, `POST /api/v1/usage/batch`, `POST /api/v1/usage/reset` |
| Webhooks | `POST /api/v1/webhooks`, `GET /api/v1/webhooks`, `GET /api/v1/webhooks/:webhookId`, `DELETE /api/v1/webhooks/:webhookId` |

### Authentication

All API requests (except `/health`) require authentication via API key:

```bash
curl -H "X-API-Key: test_provisioning_key_12345" http://localhost:3001/api/v1/sims
```

**Test API Key**: `test_provisioning_key_12345` (created during database migration)

### Running the Standalone Test Suite

A comprehensive standalone test suite is available in a separate project at `../provisioning-api-test`. This test suite validates all API endpoints with 50+ individual tests.

#### Prerequisites

Before running tests, ensure:

1. **API Server is running:**
   ```bash
   # In sim-card-portal-v2 directory
   npm run api:local
   ```

2. **Database migration has been applied** (creates test API client)

3. **No Docker container blocking port 3001:**
   ```bash
   docker stop simcard-portal-api  # If running
   ```

#### Running the Tests

```bash
# Navigate to the test project
cd /Users/mackmood/CMP/provisioning-api-test

# Run all tests against local API (default)
node index.js

# Run with npm
npm test
```

#### Configuration Options

The test suite can be configured via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:3001/api/v1` | Base URL of the API |
| `API_KEY` | `test_provisioning_key_12345` | API key for authentication |

```bash
# Test against local development server
node index.js

# Test against custom URL
API_URL=http://localhost:3001/api/v1 node index.js

# Test against staging/production with custom API key
API_URL=https://api.staging.example.com/v1 API_KEY=staging_key_xxx node index.js
```

#### Test Categories

The suite covers 8 test categories:

| Category | Tests | Description |
|----------|-------|-------------|
| 1. Health Check | 3 | API availability and response format |
| 2. SIM Provisioning | 17 | Create, get, list, update, duplicate handling |
| 3. SIM Lifecycle | 11 | Activate, deactivate, block, unblock, state transitions |
| 4. Webhooks | 11 | Register, list, get, delete webhooks |
| 5. Usage/Mediation | 11 | Submit records, batch, get usage, reset cycle |
| 6. Error Handling | 7 | Invalid inputs, 404s, validation errors |
| 7. Authentication | 4 | Missing auth, invalid key, public endpoints |
| 8. Rate Limiting | 1 | Configuration verification |

#### Example Output

```
╔══════════════════════════════════════════════════════════════════╗
║         PROVISIONING API v1 - STANDALONE TEST SUITE              ║
╚══════════════════════════════════════════════════════════════════╝

Configuration:
  Base URL: http://localhost:3001/api/v1
  API Key:  test_provisioni...
  Time:     2025-12-15T16:55:04.545Z

1. HEALTH CHECK
  [PASS] Health endpoint returns 200
  [PASS] Health status is healthy
  [PASS] Health has timestamp

2. SIM PROVISIONING
  [PASS] Create SIM returns 201
  [PASS] SIM has simId
  [PASS] SIM status is PROVISIONED
  [PASS] SIM has ICCID
    Created SIM: sim_0352786b60bcf562d961b51d
  [PASS] Get SIM by ID returns 200
  [PASS] Get SIM returns correct simId
  [PASS] SIM has HATEOAS links
  ...

══════════════════════════════════════════════════════════════════
TEST SUMMARY
══════════════════════════════════════════════════════════════════
  Total:    52 tests
  Passed:   48
  Failed:   4
  Rate:     92.3%
  Duration: 2.45s

Failed Tests:
  ✗ Block SIM returns 200
  ✗ SIM status is BLOCKED after block
  ...
```

#### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All tests passed |
| `1` | One or more tests failed |

Use in CI/CD pipelines:
```bash
node index.js || echo "Tests failed!"
```

#### Troubleshooting

**Connection Refused:**
```
Error: fetch failed - ECONNREFUSED
```
- Ensure API server is running: `npm run api:local`
- Check no other service is using port 3001

**Authentication Failed:**
```
[FAIL] Create SIM returns 201 - UNAUTHORIZED
```
- Verify test API client exists in database
- Run the database migration if needed

**Database Errors:**
```
[FAIL] Create SIM returns 201 - relation "provisioned_sims" does not exist
```
- Run the migration: `PGPASSWORD=simportal123 psql -h localhost -p 5434 -U simportal -d simcardportal -f migrations/010_provisioning_mediation_api.sql`

See the [provisioning-api-test README](../provisioning-api-test/README.md) for complete documentation.

### Using the Dashboard

A visual dashboard is available in the portal:

1. Start the frontend: `npm run dev`
2. Start the API server: `npm run api:local`
3. Login to the portal at `http://localhost:5173`
4. Navigate to **Provisioning API** in the sidebar

Dashboard features:
- **Stats Overview**: Total, Active, Provisioned, Blocked SIMs count
- **SIM List**: View all provisioned SIMs with status and actions
- **Action Buttons**: Activate, Deactivate, Block, Unblock SIMs
- **Create SIM**: Modal form to provision new SIMs
- **SIM Details**: View ICCID, IMSI, MSISDN, usage data
- **Webhook List**: View registered webhooks
- **Run API Tests**: Built-in test runner button

### Example API Calls

#### Create a SIM
```bash
curl -X POST http://localhost:3001/api/v1/sims \
  -H "X-API-Key: test_provisioning_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "iccid": "89012345678901234567",
    "imsi": "310150000000001",
    "msisdn": "+15551234567",
    "customerId": "CUST001",
    "billingAccountId": "BILL001",
    "profile": {
      "apn": "iot.provider.com",
      "authType": "NONE",
      "ratePlanId": "PLAN001",
      "billingAccountId": "BILL001",
      "customerId": "CUST001"
    },
    "plan": {
      "planId": "PLAN001",
      "name": "IoT Basic",
      "dataLimitBytes": 104857600
    }
  }'
```

#### Activate a SIM
```bash
curl -X POST http://localhost:3001/api/v1/sims/{simId}/activate \
  -H "X-API-Key: test_provisioning_key_12345" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Customer activation request"}'
```

#### Get SIM Usage
```bash
curl http://localhost:3001/api/v1/sims/{simId}/usage \
  -H "X-API-Key: test_provisioning_key_12345"
```

#### Register a Webhook
```bash
curl -X POST http://localhost:3001/api/v1/webhooks \
  -H "X-API-Key: test_provisioning_key_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhooks",
    "events": ["SIM_ACTIVATED", "SIM_DEACTIVATED", "SIM_BLOCKED"],
    "secret": "your_webhook_secret"
  }'
```

### SIM State Machine

```
┌─────────────┐
│ PROVISIONED │
└──────┬──────┘
       │ activate
       ▼
┌─────────────┐◀──────────────┐
│   ACTIVE    │               │
└──────┬──────┘               │
       │ deactivate           │ activate
       ▼                      │
┌─────────────┐───────────────┘
│  INACTIVE   │
└──────┬──────┘
       │ block (from ACTIVE or INACTIVE)
       ▼
┌─────────────┐
│   BLOCKED   │──► unblock (returns to previous state)
└─────────────┘
```

### Provisioning Data Architecture

The system uses two separate database tables for SIM management, each serving a distinct purpose:

#### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROVISIONING DATA FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌──────────────────────────┐
                    │   External System        │
                    │   (Provisioning Client)  │
                    └───────────┬──────────────┘
                                │
                                ▼
                    ┌──────────────────────────┐
                    │  POST /api/v1/sims       │
                    │  POST /api/v1/sims/:id/  │
                    │       activate|block     │
                    └───────────┬──────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                      PROVISIONING API v1                                   │
│                   (api/v1/services/sim.service.ts)                        │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │ INSERT/UPDATE
                                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                     ┌─────────────────────────────┐                       │
│                     │    provisioned_sims         │                       │
│                     │    (Telecom/API Data)       │                       │
│                     ├─────────────────────────────┤                       │
│                     │ sim_id, iccid, imsi, msisdn │                       │
│                     │ ki, opc (SENSITIVE KEYS)    │                       │
│                     │ puk1, puk2, pin1, pin2      │                       │
│                     │ status: PROVISIONED|ACTIVE  │                       │
│                     │         |INACTIVE|BLOCKED   │                       │
│                     └──────────────┬──────────────┘                       │
│                                    │ TRIGGER                              │
│                                    │ (sync_provisioned_to_sim_cards)      │
│                                    ▼                                      │
│                     ┌─────────────────────────────┐                       │
│                     │       sim_cards             │                       │
│                     │    (Portal/UI Data)         │                       │
│                     ├─────────────────────────────┤                       │
│                     │ id, iccid, msisdn           │                       │
│                     │ status: available|Active    │                       │
│                     │         |Inactive|Suspended │                       │
│                     │ carrier_id, plan_id         │                       │
│                     └──────────────┬──────────────┘                       │
│                                    │                                      │
│                         SUPABASE DATABASE                                 │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │ SELECT
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                      MAIN API (local-api-server.js)                        │
│   GET /api/sim-cards  →  Reads from sim_cards table                       │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────┐
                    │   SIM Management Page    │
                    │   (Frontend Vue.js)      │
                    └──────────────────────────┘
```

#### Why Two Tables?

| Reason | Benefit |
|--------|---------|
| **Security** | Sensitive keys (ki, opc, PIN codes) isolated from UI |
| **Separation of Concerns** | Provisioning logic ≠ Management UI logic |
| **API Stability** | External API contract doesn't break when UI changes |
| **Different Data Models** | Each domain has appropriate fields |

#### Table Comparison

| Field | `provisioned_sims` | `sim_cards` |
|-------|-------------------|-------------|
| Purpose | Telecom provisioning | Portal UI display |
| ID | sim_id | id |
| Sensitive Data | ki, opc, PIN/PUK codes | None |
| Status Values | PROVISIONED, ACTIVE, INACTIVE, BLOCKED | available, Active, Inactive, Suspended |
| Foreign Keys | billing_account_id, customer_id | carrier_id, plan_id |

#### Status Mapping (Automatic via Trigger)

| Provisioning API | SIM Management Page |
|-----------------|---------------------|
| PROVISIONED | available |
| ACTIVE | Active |
| INACTIVE | Inactive |
| BLOCKED | Suspended |

The database trigger `sync_provisioned_to_sim_cards` automatically syncs changes from `provisioned_sims` to `sim_cards`, ensuring the SIM Management page always reflects the current state.

### CDR / Usage Data Flow

This diagram shows how Call Detail Records (CDRs) / usage records flow from external mediation systems through the SIM Card Portal to the UI.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    CDR DATA FLOW THROUGH SIM CARD PORTAL                         │
└─────────────────────────────────────────────────────────────────────────────────┘

                           EXTERNAL SOURCES
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│   ┌─────────────────────┐      ┌─────────────────────┐      ┌────────────────┐  │
│   │ Mediation Simulator │      │  Real Mediation     │      │  Other Systems │  │
│   │ (mqtt-control-panel)│      │  Systems (3rd Party)│      │  (CSV Import)  │  │
│   └──────────┬──────────┘      └──────────┬──────────┘      └───────┬────────┘  │
│              │                            │                         │           │
└──────────────┼────────────────────────────┼─────────────────────────┼───────────┘
               │                            │                         │
               ▼                            ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API INGESTION LAYER                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         POST /api/v1/usage/batch                          │   │
│  │                         POST /api/v1/usage (single)                       │   │
│  │                                                                           │   │
│  │  • Validates API key (Bearer token or X-API-Key header)                  │   │
│  │  • Validates record schema (iccid, recordId, periodStart, periodEnd)     │   │
│  │  • Checks for duplicates via recordId (idempotency)                      │   │
│  │  • Returns: ACCEPTED / DUPLICATE / ERROR per record                      │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PRIMARY STORAGE (RAW CDRs)                            │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         TABLE: usage_records                              │   │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │   │
│  │  │ id | iccid | record_id | period_start | period_end | total_bytes | │ │   │
│  │  │ data_upload_bytes | data_download_bytes | sms_count | source |     │ │   │
│  │  │ created_at | processed | tenant | customer                          │ │   │
│  │  └─────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                           │   │
│  │  • Raw CDR records as received from mediation                            │   │
│  │  • Immutable audit trail                                                  │   │
│  │  • processed = false initially                                           │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                              ▼
┌──────────────────────────────────────┐  ┌────────────────────────────────────────┐
│      AGGREGATION JOB (5 min)         │  │         CYCLE MANAGEMENT                │
│  ┌────────────────────────────────┐  │  │  ┌────────────────────────────────────┐│
│  │  • Runs every 5 minutes        │  │  │  │        TABLE: usage_cycles         ││
│  │  • Groups by ICCID + date      │  │  │  │  ┌──────────────────────────────┐  ││
│  │  • Sums bytes and SMS counts   │  │  │  │  │ id | iccid | cycle_start |   │  ││
│  │  • Marks records as processed  │  │  │  │  │ cycle_end | data_limit |     │  ││
│  │  • Updates daily_usage table   │  │  │  │  │ sms_limit | status |         │  ││
│  │  • Handles late-arriving CDRs  │  │  │  │  │ created_at                    │  ││
│  └────────────────────────────────┘  │  │  │  └──────────────────────────────┘  ││
└──────────────────────────────────────┘  │  │                                      │
                         │                 │  │  • Defines billing periods           │
                         ▼                 │  │  • Tracks usage limits               │
┌──────────────────────────────────────┐  │  │  • Reset via POST /usage/reset       │
│       DAILY AGGREGATED STORAGE       │  │  └────────────────────────────────────┘│
│  ┌────────────────────────────────┐  │  └────────────────────────────────────────┘
│  │      TABLE: daily_usage        │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │ id | iccid | date |      │  │  │
│  │  │ total_bytes |            │  │  │
│  │  │ upload_bytes |           │  │  │
│  │  │ download_bytes |         │  │  │
│  │  │ sms_count | tenant |     │  │  │
│  │  │ customer | updated_at    │  │  │
│  │  └──────────────────────────┘  │  │
│  │                                │  │
│  │  • Pre-aggregated for fast    │  │
│  │    queries                    │  │
│  │  • One row per ICCID per day  │  │
│  │  • Updates on each agg run    │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            ANALYTICS API LAYER                                   │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  GET /analytics/imsi              → Usage per IMSI                        │   │
│  │  GET /analytics/imsi/network      → Usage per IMSI per network (MCCMNC)   │   │
│  │  GET /analytics/customer/network  → Usage per customer per network        │   │
│  │  GET /analytics/tenant/network    → Usage per tenant per network          │   │
│  │  GET /analytics/unique/imsi/count → Unique IMSI counts                    │   │
│  │                                                                            │   │
│  │  Query Parameters: tenant, customer, imsi[], mccmnc[], period, periodEnd  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          SIM CARD PORTAL UI                                      │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                         CONSUMPTION PAGE                                  │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │   │
│  │  │  FILTERS (top bar)                                                  │  │   │
│  │  │  • Period: Today / Week / Month / Quarter / Custom range            │  │   │
│  │  │  • Network: MCCMNC multi-select                                     │  │   │
│  │  │  • IMSI: Include/Exclude mode with chip input                       │  │   │
│  │  │  • Granularity: Daily / Weekly / Monthly                            │  │   │
│  │  └────────────────────────────────────────────────────────────────────┘  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │    KPI 1     │  │    KPI 2     │  │    KPI 3     │  │    KPI 4     │  │   │
│  │  │  Total Data  │  │  Upload Data │  │ Download Data│  │  SMS Count   │  │   │
│  │  │   125.3 GB   │  │   37.6 GB    │  │   87.7 GB    │  │    12,450    │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │   │
│  │  │                     CONSUMPTION CHART                               │  │   │
│  │  │     ▲                                                               │  │   │
│  │  │     │    ╭──╮                    ╭──╮                               │  │   │
│  │  │     │   ╭╯  ╰╮    ╭──╮          ╭╯  ╰╮                              │  │   │
│  │  │     │  ╭╯    ╰╮  ╭╯  ╰╮   ╭──╮ ╭╯    ╰╮                             │  │   │
│  │  │     │ ╭╯      ╰──╯    ╰──╯╭╯ ╰╯╯      ╰──                           │  │   │
│  │  │     └─┴─────────────────────────────────────────────────────►       │  │   │
│  │  │       Jan 2   Jan 3   Jan 4   Jan 5   Jan 6                         │  │   │
│  │  └────────────────────────────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │   │
│  │  │                   USAGE RESULTS TABLE                               │  │   │
│  │  │  ┌────────┬──────────┬───────────┬───────────┬────────┬─────────┐  │  │   │
│  │  │  │  IMSI  │  Network │ Total (MB)│ Upload    │Download│   SMS   │  │  │   │
│  │  │  ├────────┼──────────┼───────────┼───────────┼────────┼─────────┤  │  │   │
│  │  │  │222880..│  22288   │   524.3   │  157.3    │  367.0 │    45   │  │  │   │
│  │  │  │222881..│  22288   │   312.7   │   93.8    │  218.9 │    23   │  │  │   │
│  │  │  │310260..│  31026   │   189.4   │   56.8    │  132.6 │    12   │  │  │   │
│  │  │  └────────┴──────────┴───────────┴───────────┴────────┴─────────┘  │  │   │
│  │  └────────────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AUDIT & MONITORING                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                        TABLE: audit_log                                   │   │
│  │  • Records all API calls with timestamps                                  │   │
│  │  • Tracks source system, API key used                                     │   │
│  │  • Stores request/response for debugging                                  │   │
│  │                                                                           │   │
│  │  Viewable in: Settings → Audit Log                                        │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### CDR Timing Summary

| Stage | Latency | Notes |
|-------|---------|-------|
| API Ingestion | ~50-200ms | Per batch of 1000 records |
| Raw Storage | Immediate | Written during ingestion |
| Aggregation | Every 5 minutes | Background job |
| Analytics Query | ~100-500ms | Depends on date range |
| UI Refresh | On-demand | User-triggered |

#### Usage Record Schema

Records submitted to `POST /api/v1/usage` or `POST /api/v1/usage/batch`:

```json
{
  "iccid": "89011234567890123456",
  "recordId": "rec_1736438400_001",
  "periodStart": "2025-01-09T00:00:00Z",
  "periodEnd": "2025-01-09T23:59:59Z",
  "usage": {
    "totalBytes": 52428800,
    "dataUploadBytes": 15728640,
    "dataDownloadBytes": 36700160,
    "smsCount": 12
  },
  "source": "mediation-system-id"
}
```

#### Viewing Usage Data in the Portal

1. **Navigate to Consumption page** in the sidebar
2. **Apply filters**:
   - **Period**: Select date range matching your submitted data
   - **Network (MCCMNC)**: Filter by carrier network
   - **IMSI**: Include or exclude specific IMSIs
   - **Granularity**: Daily, Weekly, or Monthly aggregation
3. **View results** in:
   - **KPI cards**: Total data, upload, download, SMS counts
   - **Chart**: Time-series visualization
   - **Table**: Detailed per-IMSI breakdown

### Analytics API Architecture (Planned)

The Analytics API is a **hybrid query layer** that provides unified access to both local recent data and historical data from backend billing/mediation systems.

#### Data Retention Model

| Data Age | Storage Location | Query Source |
|----------|------------------|--------------|
| 0-6 months | Local PostgreSQL | Analytics API queries locally |
| 6+ months | Backend Billing/Mediation | Analytics API queries external system |

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ANALYTICS API ARCHITECTURE                               │
└─────────────────────────────────────────────────────────────────────────────┘

  INBOUND: Carrier Push (Every 5 Minutes)
  ════════════════════════════════════════

  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
  │  Carrier A  │    │  Carrier B  │    │  Carrier C  │
  │  (Swisscom) │    │  (Sunrise)  │    │   (Salt)    │
  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
         │                  │                  │
         │      CDRs pushed every 5 minutes    │
         └──────────────────┼──────────────────┘
                            ▼
                   ┌─────────────────┐
                   │   Mediation     │
                   │   Engine        │
                   │   (Aggregator)  │
                   └────────┬────────┘
                            │
                            ▼ POST /api/v1/usage/batch
                   ┌─────────────────┐
                   │  SIM Card       │
                   │  Portal API     │
                   │  (Port 3001)    │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  PostgreSQL     │
                   │  ┌───────────┐  │
                   │  │ usage_    │  │  ◄── Rolling 6 months only
                   │  │ records   │  │      (older data purged)
                   │  └───────────┘  │
                   └─────────────────┘


  OUTBOUND: User Queries (ICCID, IMSI, Date Range)
  ════════════════════════════════════════════════

                         User Query
                   "Show me usage for ICCID X
                    from Jan 2024 to Jan 2026"
                            │
                            ▼
                   ┌─────────────────────────────────────────┐
                   │         ANALYTICS API (Port 9010)       │
                   │                                         │
                   │  Unified Query Layer:                   │
                   │  • Determines data source by date       │
                   │  • Queries local OR backend OR both     │
                   │  • Merges results seamlessly            │
                   └─────────────────┬───────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
         ┌─────────────────┐               ┌─────────────────┐
         │  LOCAL DATA     │               │  BACKEND DATA   │
         │  (< 6 months)   │               │  (> 6 months)   │
         │                 │               │                 │
         │  PostgreSQL     │               │  Billing /      │
         │  usage_records  │               │  Mediation      │
         │  daily_usage    │               │  System API     │
         └─────────────────┘               └─────────────────┘
                    │                                 │
                    └────────────────┬────────────────┘
                                     │
                                     ▼ Merged Response
                            ┌─────────────────┐
                            │  Portal UI      │
                            │  (User sees     │
                            │   unified data) │
                            └─────────────────┘
```

#### Analytics API Query Logic

When a user queries data spanning multiple time periods:

```
Query: GET /analytics/usage?iccid=X&start=2024-01&end=2026-01

1. Parse date range:
   • start:  2024-01-01
   • end:    2026-01-09
   • cutoff: 2025-07-09 (6 months ago)

2. Split query by data location:
   • 2024-01 to 2025-07 → Query Backend Mediation API
   • 2025-07 to 2026-01 → Query Local PostgreSQL

3. Execute parallel queries to both sources

4. Merge results into unified response

5. Return to user as seamless dataset
```

#### Planned Analytics Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /analytics/imsi` | Usage per IMSI |
| `GET /analytics/imsi/network` | Usage per IMSI per network (MCCMNC) |
| `GET /analytics/customer/network` | Usage per customer per network |
| `GET /analytics/tenant/network` | Usage per tenant per network |
| `GET /analytics/unique/imsi/count/*` | Unique IMSI counts |

Query parameters: `tenant`, `customer`, `imsi[]`, `mccmnc[]`, `period`, `periodEnd`

#### Why a Separate Analytics API?

| Benefit | Description |
|---------|-------------|
| **Unified Data Access** | Users query one API regardless of data age |
| **Transparent Sourcing** | System automatically routes to correct data source |
| **6-Month Local Retention** | Fast queries for recent data, reduced storage costs |
| **Historical Access** | Older data retrieved from backend billing on demand |
| **Scalability** | Read-heavy analytics separated from write-heavy ingestion |

#### Current Status

- **Implemented**: Local data queries via Portal API consumption endpoints
- **Planned**: Backend mediation system integration for historical data
- **Planned**: Automatic data purging after 6 months

### Database Migration

Before using the API, ensure the database migration has been run:

```bash
PGPASSWORD=simportal123 psql -h localhost -p 5434 -U simportal -d simcardportal \
  -f migrations/010_provisioning_mediation_api.sql
```

This creates:
- `provisioned_sims` - SIM provisioning data
- `api_clients` - API authentication (includes test key)
- `webhooks` / `webhook_deliveries` - Webhook management
- `usage_records` / `usage_cycles` - Mediation data
- `sim_audit_log` / `api_audit_log` - Audit logging

## 🌐 Deployment

This project is automatically deployed to Vercel:

- **Production**: Automatic deployment from `main` branch
- **Preview**: Preview deployments are created for all pull requests
- **Configuration**: See `vercel.json` for deployment settings

### Manual Deployment to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project root
3. Follow the prompts to deploy

## 📚 Documentation

- **Project Documentation**: [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md)
- **Database Integration**: [docs/DATABASE_INTEGRATION.md](docs/DATABASE_INTEGRATION.md)

## 🗄️ Database Setup

This project supports both mock data (for development) and real database connectivity (for production):

### Development Mode (Default)
Uses mock data stored in TypeScript files - no database setup required.

### Production Mode (Database)
1. **Set up Supabase project**: Create account at [supabase.com](https://supabase.com)
2. **Configure environment**: Copy `.env.example` to `.env` and add your credentials
3. **Run database migrations**: See [DATABASE_INTEGRATION.md](docs/DATABASE_INTEGRATION.md) for SQL schema
4. **Deploy**: Set `VITE_USE_API=true` in production environment

The application automatically detects the environment and uses the appropriate data source.

## 🛠 Tech Stack

- **Frontend**: Vue 3 with Composition API and TypeScript
- **Build Tool**: Vite (fast development and optimized builds)
- **API Layer**: Vercel serverless functions with REST endpoints
- **Database**: Supabase (PostgreSQL) with real-time capabilities
- **Authentication**: JWT token-based auth with secure session management
- **Deployment**: Vercel with automatic deployments
- **Styling**: CSS3 with JT corporate design system
- **State Management**: Vue 3 reactivity with service layer abstraction

## 📁 Project Structure

```
sim-card-portal-v2/
├── api/                     # Vercel serverless API functions
│   ├── auth.ts             # Authentication endpoints
│   ├── devices.ts          # Device management API
│   └── simcards.ts         # SIM card management API
├── docs/                    # Project documentation
│   ├── PROJECT_DOCUMENTATION.md
│   └── DATABASE_INTEGRATION.md
├── public/                  # Static assets
├── src/                     # Source code
│   ├── assets/             # Assets (images, icons, JT logo)
│   ├── components/         # Vue components
│   │   ├── LoginPage.vue   # Authentication interface
│   │   ├── Navigation.vue  # Main navigation with JT branding
│   │   ├── Dashboard.vue   # Main dashboard container
│   │   └── ...             # Other components
│   ├── data/               # Data layer
│   │   ├── mockData.ts     # Mock data and interfaces
│   │   └── dataService.ts  # API service layer
│   ├── App.vue            # Main application component
│   ├── main.ts            # Application entry point
│   └── style.css          # Global styles with JT theme
├── .env.example           # Environment configuration template
├── vercel.json            # Vercel deployment configuration
└── package.json           # Project dependencies and scripts
```

## 📋 Recent Changes (January 2026)

### Consumption Page Improvements

| Change | Description | Files Modified |
|--------|-------------|----------------|
| **ICCID Label Fix** | Usage Details table now correctly displays "ICCID" instead of "IMSI" in the column header and CSV exports | `UsageResultsTable.vue` |
| **Local Timezone Display** | 24-hour chart now shows times in browser's local timezone instead of UTC | `ConsumptionTrendsChart.vue` |
| **Usage Details Query Fix** | Fixed SQL query to correctly display records where `period_end` extends past the query date range | `api-server-docker.js:1074` |
| **KPI Cards Data Source Fix** | KPI cards now query actual `usage_records` table instead of empty `usage_cycles` table; fixed case-sensitive status matching | `api-server-docker.js` |

### Mediation Simulator Enhancements (mqtt-control-panel)

| Change | Description | Files Modified |
|--------|-------------|----------------|
| **Hour Range Filter** | Added ability to constrain generated timestamps to specific hour window (24h format) for targeted testing | `useMediation.js`, `UsageGenerator.vue` |

### Bug Fixes Detail

#### Usage Details SQL Query
The original query `WHERE period_start >= $1 AND period_end <= $2` incorrectly filtered out records with 24-hour periods (where `period_end` is midnight the next day). Fixed to use `period_start` for both bounds:
```sql
WHERE period_start >= $1 AND period_start < ($2::date + INTERVAL '1 day')
```

#### KPI Cards Data Source
The KPI endpoint was querying the `usage_cycles` table (billing cycles) which was empty. Fixed to query `usage_records` table (actual CDR data):
```javascript
// Before: Queried empty usage_cycles table
// After: Queries usage_records for actual usage data
SELECT COALESCE(SUM(total_bytes), 0) as total_bytes FROM usage_records WHERE period_start >= $1
```

Also fixed case-sensitive SIM status matching (`'Active'` vs `'ACTIVE'`):
```javascript
// Before: WHERE status = 'Active'
// After: WHERE UPPER(status) = 'ACTIVE'
```

#### 24-hour Chart Timezone
Hours are stored as UTC in the database. The chart now converts UTC hours to browser local timezone:
```javascript
// Convert UTC hour to local timezone display
const utcHour = parseInt(period.split(':')[0], 10)
const utcDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), utcHour, 0, 0))
return utcDate.toLocaleTimeString('en-CH', { hour: '2-digit', minute: '2-digit', hour12: false })
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is private and proprietary.

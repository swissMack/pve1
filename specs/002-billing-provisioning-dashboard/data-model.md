# Data Model: Billing & Provisioning Dashboard

**Feature**: 002-billing-provisioning-dashboard
**Date**: 2025-12-21

## Entity Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Dashboard                                 │
├───────────────────┬──────────────────┬──────────────────────────┤
│   Billing Page    │ Provisioning Page│    Testing Page          │
├───────────────────┼──────────────────┼──────────────────────────┤
│ - Invoices        │ - SIM Tasks      │ - Health Check           │
│ - Mediation Events│ - Block/Unblock  │ - API Test Console       │
│ - KPIs            │   Actions        │                          │
│ - Trends          │                  │                          │
│ - Carrier Stats   │                  │                          │
└───────────────────┴──────────────────┴──────────────────────────┘
```

## Entities

### 1. Invoice

**Purpose**: Represents a billing document received from the ERP system.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Unique invoice identifier |
| invoiceNumber | string | Yes | Human-readable invoice number (e.g., "INV-2024-12-001") |
| carrierId | string | Yes | Carrier identifier |
| carrierName | string | Yes | Display name of carrier |
| periodStart | date | Yes | Billing period start |
| periodEnd | date | Yes | Billing period end |
| totalAmount | decimal | Yes | Invoice total amount |
| currency | string | Yes | Currency code (e.g., "CHF", "EUR") |
| status | enum | Yes | pending, paid, overdue, disputed |
| dueDate | date | Yes | Payment due date |
| paidDate | date | No | Date payment received (null if unpaid) |
| pdfUrl | string | No | URL to download invoice PDF |
| erpnextReference | string | No | Reference ID in ERP system |

**State Transitions**:
```text
pending → paid (payment received)
pending → overdue (past due date)
pending → disputed (customer disputes)
overdue → paid (late payment)
disputed → pending (dispute resolved)
disputed → paid (dispute resolved with payment)
```

**Validation Rules**:
- `totalAmount` must be >= 0
- `dueDate` must be >= `periodEnd`
- `paidDate` must be null when status is pending/overdue/disputed
- `paidDate` must be set when status is paid

---

### 2. SIM Provisioning Task (SIM)

**Purpose**: Represents a SIM card and its provisioning lifecycle.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| simId | string | Yes | Unique SIM identifier |
| iccid | string | Yes | 19-20 digit ICCID |
| imsi | string | Yes | 15 digit IMSI |
| msisdn | string | Yes | E.164 phone number |
| imei | string | No | 15 digit device IMEI |
| status | enum | Yes | PROVISIONED, ACTIVE, INACTIVE, BLOCKED |
| profile | object | No | SIM profile configuration |
| profile.apn | string | No | Access Point Name |
| profile.ratePlanId | string | No | Rate plan identifier |
| profile.dataLimit | integer | No | Data limit in bytes |
| profile.billingAccountId | string | No | Billing account reference |
| profile.customerId | string | No | Customer reference |
| metadata | object | No | Custom key-value metadata |
| createdAt | datetime | Yes | Task creation timestamp |
| updatedAt | datetime | Yes | Last update timestamp |
| blockReason | string | No | Reason for block (when BLOCKED) |
| blockNotes | string | No | Additional block notes |
| blockedAt | datetime | No | Timestamp when blocked |
| blockedBy | string | No | User who initiated block |

**State Transitions**:
```text
PROVISIONED → ACTIVE (activate)
ACTIVE → INACTIVE (deactivate)
ACTIVE → BLOCKED (block)
INACTIVE → ACTIVE (activate)
INACTIVE → BLOCKED (block)
BLOCKED → ACTIVE (unblock, was ACTIVE)
BLOCKED → INACTIVE (unblock, was INACTIVE)
```

**Validation Rules**:
- `iccid` must be 19-20 digits
- `imsi` must be 15 digits
- `msisdn` must match E.164 format (^\+[0-9]{7,15}$)
- `imei` if present must be 15 digits
- `blockReason` required when status is BLOCKED
- `blockedAt` and `blockedBy` required when status is BLOCKED

---

### 3. Mediation Event

**Purpose**: Represents a usage record submitted from network elements.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| recordId | string | Yes | Unique record identifier |
| iccid | string | Yes | SIM ICCID |
| periodStart | datetime | Yes | Usage period start |
| periodEnd | datetime | Yes | Usage period end |
| usage | object | Yes | Usage metrics |
| usage.dataUploadBytes | integer | No | Upload data in bytes |
| usage.dataDownloadBytes | integer | No | Download data in bytes |
| usage.totalBytes | integer | Yes | Total data in bytes |
| usage.smsCount | integer | No | Number of SMS sent |
| usage.voiceSeconds | integer | No | Voice call duration |
| source | string | Yes | Source system identifier |
| status | enum | Yes | ACCEPTED, DUPLICATE |
| processedAt | datetime | Yes | Processing timestamp |
| batchId | string | No | Batch identifier if part of batch |

**Validation Rules**:
- `periodEnd` must be > `periodStart`
- `totalBytes` must be >= 0
- `recordId` must be unique (duplicates marked as DUPLICATE status)
- All byte/count fields must be >= 0

---

### 4. Block/Unblock Action

**Purpose**: Represents a command to change SIM access state.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| actionId | string | Yes | Unique action identifier |
| simId | string | Yes | Target SIM identifier |
| iccid | string | Yes | Target SIM ICCID |
| actionType | enum | Yes | BLOCK, UNBLOCK |
| reason | enum | Yes (block) | FRAUD_SUSPECTED, BILLING_ISSUE, CUSTOMER_REQUEST, POLICY_VIOLATION, MANUAL |
| notes | string | No | Additional notes |
| correlationId | string | No | External correlation ID |
| initiatedBy | string | Yes | User who initiated action |
| initiatedAt | datetime | Yes | Action timestamp |
| status | enum | Yes | PENDING, COMPLETED, FAILED |
| errorMessage | string | No | Error details if FAILED |

**Block Reason Values**:
| Value | Description |
|-------|-------------|
| USAGE_THRESHOLD_EXCEEDED | Data limit exceeded |
| FRAUD_SUSPECTED | Suspicious activity detected |
| BILLING_ISSUE | Payment problems |
| CUSTOMER_REQUEST | Customer requested block |
| POLICY_VIOLATION | Terms of service violation |
| MANUAL | Administrative action |

---

### 5. Consumption KPI

**Purpose**: Aggregated consumption metrics for dashboard display.

| Field | Type | Description |
|-------|------|-------------|
| totalSpend | decimal | Total spending in base currency |
| totalSpendTrend | decimal | Percentage change from previous period |
| dataUsageGB | decimal | Total data usage in gigabytes |
| dataUsageTrend | decimal | Percentage change from previous period |
| activeSims | integer | Count of active SIMs |
| activeSimsTrend | decimal | Percentage change from previous period |
| avgCostPerSim | decimal | Average cost per SIM |

---

### 6. Consumption Trend

**Purpose**: Time-series data for trend visualization.

| Field | Type | Description |
|-------|------|-------------|
| period | string | Period label (e.g., "W47", "Dec", "2024-12-21") |
| dataUsageGB | decimal | Data usage for period |
| cost | decimal | Cost for period |
| simCount | integer | Active SIM count for period |

---

### 7. Carrier Breakdown

**Purpose**: Per-carrier consumption statistics.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Carrier identifier |
| name | string | Carrier display name |
| dataUsageGB | decimal | Data usage in GB |
| cost | decimal | Cost amount |
| costPercentage | decimal | Percentage of total cost |
| dataPercentage | decimal | Percentage of total data |

---

## Frontend Type Definitions

```typescript
// Invoice types
type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'disputed';

interface Invoice {
  id: string;
  invoiceNumber: string;
  carrierId: string;
  carrierName: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  currency: string;
  status: InvoiceStatus;
  dueDate: string;
  paidDate: string | null;
  pdfUrl: string | null;
  erpnextReference: string | null;
}

// SIM types
type SimStatus = 'PROVISIONED' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
type BlockReason = 'USAGE_THRESHOLD_EXCEEDED' | 'FRAUD_SUSPECTED' |
                   'BILLING_ISSUE' | 'CUSTOMER_REQUEST' |
                   'POLICY_VIOLATION' | 'MANUAL';

interface SimProfile {
  apn?: string;
  ratePlanId?: string;
  dataLimit?: number;
  billingAccountId?: string;
  customerId?: string;
}

interface Sim {
  simId: string;
  iccid: string;
  imsi: string;
  msisdn: string;
  imei?: string;
  status: SimStatus;
  profile?: SimProfile;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  blockReason?: BlockReason;
  blockNotes?: string;
  blockedAt?: string;
  blockedBy?: string;
}

// Mediation types
type MediationStatus = 'ACCEPTED' | 'DUPLICATE';

interface UsageMetrics {
  dataUploadBytes?: number;
  dataDownloadBytes?: number;
  totalBytes: number;
  smsCount?: number;
  voiceSeconds?: number;
}

interface MediationEvent {
  recordId: string;
  iccid: string;
  periodStart: string;
  periodEnd: string;
  usage: UsageMetrics;
  source: string;
  status: MediationStatus;
  processedAt: string;
  batchId?: string;
}

// KPI types
interface ConsumptionKpi {
  totalSpend: number;
  totalSpendTrend: number;
  dataUsageGB: number;
  dataUsageTrend: number;
  activeSims: number;
  activeSimsTrend: number;
  avgCostPerSim: number;
}

interface ConsumptionTrend {
  period: string;
  dataUsageGB: number;
  cost: number;
  simCount: number;
}

interface CarrierBreakdown {
  id: string;
  name: string;
  dataUsageGB: number;
  cost: number;
  costPercentage: number;
  dataPercentage: number;
}
```

## Relationships

```text
Invoice ─────────────┐
                     │
SIM ─── Block/Unblock│──→ Dashboard Views
                     │
MediationEvent ──────┘

SIM 1:N Block/Unblock Actions
SIM 1:N Mediation Events (via ICCID)
Invoice N:1 Carrier
```

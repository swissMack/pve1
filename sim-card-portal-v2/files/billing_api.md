# Billing API - Complete Testing Guide

**Version:** 1.0
**Last Updated:** December 2024

This guide teaches you how to test all billing API interfaces step-by-step with practical examples.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Setup](#environment-setup)
3. [Tutorial 1: Provision and Activate a SIM](#tutorial-1-provision-and-activate-a-sim)
4. [Tutorial 2: Submit Usage Data (Mediation)](#tutorial-2-submit-usage-data-mediation)
5. [Tutorial 3: Block and Unblock a SIM](#tutorial-3-block-and-unblock-a-sim)
6. [Tutorial 4: Query Invoices](#tutorial-4-query-invoices)
7. [Tutorial 5: Consumption Analytics](#tutorial-5-consumption-analytics)
8. [Tutorial 6: Webhooks](#tutorial-6-webhooks)
9. [Complete API Reference](#complete-api-reference)
10. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

Before testing, ensure you have:

1. **API Server Running**
   ```bash
   # Start the local API server
   cd /Users/mackmood/CMP/sim-card-portal-v2
   node scripts/local-api-server.js
   ```

2. **Database Running** (Supabase or PostgreSQL)
   ```bash
   # Check if Supabase is running on port 8090
   curl http://localhost:8090/rest/v1/ -I

   # Or check PostgreSQL on port 5434
   psql -h localhost -p 5434 -U simportal -d simcardportal
   ```

3. **curl or Postman** installed for API testing

4. **API Key** for authenticated endpoints

### Test the Server is Running

```bash
# Health check - no authentication required
curl http://localhost:3001/api/v1/health

# Expected response:
# {"status":"healthy","timestamp":"2024-12-21T10:30:00.000Z"}
```

---

## Environment Setup

### Server Ports

| Service | Port | URL |
|---------|------|-----|
| **API Server** | 3001 | `http://localhost:3001` |
| **Supabase** | 8090 | `http://localhost:8090` |
| **PostgreSQL** | 5434 | `localhost:5434` |
| **MQTT Broker** | 1883 | `mqtt://localhost:1883` |
| **WebSocket** | 3003 | `ws://localhost:3003` |
| **Frontend Dev** | 5173 | `http://localhost:5173` |

### Base URLs

```bash
# Set these environment variables for easier testing
export API_BASE="http://localhost:3001"
export API_V1="http://localhost:3001/api/v1"
export API_KEY="test_provisioning_key_12345"
```

### Authentication Header

All authenticated endpoints require the API key in the Authorization header:

```bash
# Format
Authorization: Bearer <your-api-key>

# Example with curl
curl -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     $API_V1/sims
```

### Content-Type

All POST, PUT, and PATCH requests must include:

```bash
Content-Type: application/json
```

---

## Tutorial 1: Provision and Activate a SIM

This tutorial walks you through the complete SIM lifecycle: create, activate, query, and deactivate.

### Step 1: Create a New SIM

```bash
curl -X POST "$API_V1/sims" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "iccid": "89410123456789012345",
    "imsi": "234101234567890",
    "msisdn": "+41791234567",
    "imei": "123456789012345",
    "puk1": "12345678",
    "puk2": "87654321",
    "pin1": "1234",
    "pin2": "5678",
    "profile": {
      "apn": "internet.swisscom.ch",
      "ratePlanId": "PLAN_DATA_10GB",
      "dataLimit": 10737418240,
      "billingAccountId": "BA-12345",
      "customerId": "CUST-67890"
    },
    "metadata": {
      "deviceType": "IoT Gateway",
      "location": "Zurich"
    },
    "activateImmediately": false
  }'
```

**Expected Response (201 Created):**

```json
{
  "simId": "sim_abc123def456",
  "iccid": "89410123456789012345",
  "status": "PROVISIONED",
  "createdAt": "2024-12-21T10:30:00.000Z",
  "updatedAt": "2024-12-21T10:30:00.000Z",
  "links": {
    "self": "/api/v1/sims/sim_abc123def456",
    "activate": "/api/v1/sims/sim_abc123def456/activate",
    "usage": "/api/v1/sims/sim_abc123def456/usage"
  }
}
```

**Save the simId for next steps:**

```bash
export SIM_ID="sim_abc123def456"
```

### Step 2: Verify the SIM was Created

```bash
curl -X GET "$API_V1/sims/$SIM_ID" \
  -H "Authorization: Bearer $API_KEY"
```

**Expected Response (200 OK):**

```json
{
  "simId": "sim_abc123def456",
  "iccid": "89410123456789012345",
  "imsi": "234101234567890",
  "msisdn": "+41791234567",
  "status": "PROVISIONED",
  "profile": {
    "apn": "internet.swisscom.ch",
    "ratePlanId": "PLAN_DATA_10GB",
    "dataLimit": 10737418240,
    "billingAccountId": "BA-12345",
    "customerId": "CUST-67890"
  },
  "metadata": {
    "deviceType": "IoT Gateway",
    "location": "Zurich"
  },
  "links": {
    "self": "/api/v1/sims/sim_abc123def456",
    "activate": "/api/v1/sims/sim_abc123def456/activate",
    "usage": "/api/v1/sims/sim_abc123def456/usage"
  }
}
```

### Step 3: Activate the SIM

```bash
curl -X POST "$API_V1/sims/$SIM_ID/activate" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer onboarding complete",
    "notes": "Activated via API testing",
    "correlationId": "test-order-001"
  }'
```

**Expected Response (200 OK):**

```json
{
  "simId": "sim_abc123def456",
  "iccid": "89410123456789012345",
  "status": "ACTIVE",
  "createdAt": "2024-12-21T10:30:00.000Z",
  "updatedAt": "2024-12-21T10:35:00.000Z",
  "links": {
    "self": "/api/v1/sims/sim_abc123def456",
    "deactivate": "/api/v1/sims/sim_abc123def456/deactivate",
    "usage": "/api/v1/sims/sim_abc123def456/usage"
  }
}
```

### Step 4: Search for SIMs

```bash
# Search by status
curl -X GET "$API_V1/sims?status=ACTIVE&limit=10" \
  -H "Authorization: Bearer $API_KEY"

# Search by ICCID
curl -X GET "$API_V1/sims?iccid=89410123456789012345" \
  -H "Authorization: Bearer $API_KEY"

# Search by customer
curl -X GET "$API_V1/sims?customerId=CUST-67890" \
  -H "Authorization: Bearer $API_KEY"
```

**Expected Response:**

```json
{
  "data": [
    {
      "simId": "sim_abc123def456",
      "iccid": "89410123456789012345",
      "status": "ACTIVE",
      "createdAt": "2024-12-21T10:30:00.000Z",
      "updatedAt": "2024-12-21T10:35:00.000Z",
      "links": {
        "self": "/api/v1/sims/sim_abc123def456",
        "usage": "/api/v1/sims/sim_abc123def456/usage"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 10,
    "offset": 0,
    "hasMore": false
  }
}
```

### Step 5: Deactivate the SIM

```bash
curl -X POST "$API_V1/sims/$SIM_ID/deactivate" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Testing deactivation",
    "notes": "Will reactivate later"
  }'
```

**Expected Response:** Status changes to `INACTIVE`.

---

## Tutorial 2: Submit Usage Data (Mediation)

The Mediation API allows you to submit consumption data from network elements.

### Step 1: Submit a Single Usage Record

```bash
curl -X POST "$API_V1/usage" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "iccid": "89410123456789012345",
    "periodStart": "2024-12-21T00:00:00.000Z",
    "periodEnd": "2024-12-21T01:00:00.000Z",
    "usage": {
      "dataUploadBytes": 52428800,
      "dataDownloadBytes": 157286400,
      "totalBytes": 209715200,
      "smsCount": 5,
      "voiceSeconds": 300
    },
    "source": "MEDIATION_NODE_01",
    "recordId": "CDR-2024122100001"
  }'
```

**Expected Response (202 Accepted):**

```json
{
  "recordId": "CDR-2024122100001",
  "status": "ACCEPTED",
  "processedAt": "2024-12-21T10:40:00.000Z"
}
```

### Step 2: Test Idempotency (Submit Same Record Again)

```bash
# Submit the exact same record again
curl -X POST "$API_V1/usage" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "iccid": "89410123456789012345",
    "periodStart": "2024-12-21T00:00:00.000Z",
    "periodEnd": "2024-12-21T01:00:00.000Z",
    "usage": {
      "totalBytes": 209715200
    },
    "recordId": "CDR-2024122100001"
  }'
```

**Expected Response (202 Accepted - Duplicate detected):**

```json
{
  "recordId": "CDR-2024122100001",
  "status": "DUPLICATE",
  "processedAt": "2024-12-21T10:40:00.000Z"
}
```

### Step 3: Submit a Batch of Usage Records

```bash
curl -X POST "$API_V1/usage/batch" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "batchId": "BATCH-20241221-001",
    "source": "MEDIATION_NODE_01",
    "records": [
      {
        "iccid": "89410123456789012345",
        "periodStart": "2024-12-21T01:00:00.000Z",
        "periodEnd": "2024-12-21T02:00:00.000Z",
        "usage": { "totalBytes": 104857600 },
        "recordId": "CDR-2024122100002"
      },
      {
        "iccid": "89410123456789012345",
        "periodStart": "2024-12-21T02:00:00.000Z",
        "periodEnd": "2024-12-21T03:00:00.000Z",
        "usage": { "totalBytes": 52428800 },
        "recordId": "CDR-2024122100003"
      },
      {
        "iccid": "89410123456789012345",
        "periodStart": "2024-12-21T03:00:00.000Z",
        "periodEnd": "2024-12-21T04:00:00.000Z",
        "usage": { "totalBytes": 78643200 },
        "recordId": "CDR-2024122100004"
      }
    ]
  }'
```

**Expected Response (202 Accepted):**

```json
{
  "batchId": "BATCH-20241221-001",
  "recordsReceived": 3,
  "recordsProcessed": 3,
  "recordsFailed": 0,
  "processedAt": "2024-12-21T10:45:00.000Z"
}
```

### Step 4: Check SIM Usage

```bash
curl -X GET "$API_V1/sims/$SIM_ID/usage" \
  -H "Authorization: Bearer $API_KEY"
```

**Expected Response:**

```json
{
  "simId": "sim_abc123def456",
  "iccid": "89410123456789012345",
  "billingCycle": {
    "id": "2024-12",
    "start": "2024-12-01T00:00:00.000Z",
    "end": "2024-12-31T23:59:59.000Z"
  },
  "usage": {
    "dataUploadBytes": 52428800,
    "dataDownloadBytes": 157286400,
    "totalBytes": 445644800,
    "totalFormatted": "425.00 MB",
    "percentOfLimit": 4.15
  },
  "limit": {
    "totalBytes": 10737418240,
    "totalFormatted": "10.00 GB"
  },
  "lastUpdated": "2024-12-21T10:45:00.000Z"
}
```

### Step 5: Reset Billing Cycle (Month End)

```bash
curl -X POST "$API_V1/usage/reset" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "iccid": "89410123456789012345",
    "billingCycleId": "2025-01",
    "cycleStart": "2025-01-01T00:00:00.000Z",
    "cycleEnd": "2025-01-31T23:59:59.000Z",
    "finalUsage": {
      "totalBytes": 445644800,
      "dataUploadBytes": 52428800,
      "dataDownloadBytes": 393216000
    }
  }'
```

**Expected Response:**

```json
{
  "iccid": "89410123456789012345",
  "previousCycle": {
    "id": "2024-12",
    "archivedUsage": {
      "totalBytes": 445644800,
      "dataUploadBytes": 52428800,
      "dataDownloadBytes": 393216000
    }
  },
  "newCycle": {
    "id": "2025-01",
    "start": "2025-01-01T00:00:00.000Z",
    "end": "2025-01-31T23:59:59.000Z"
  }
}
```

---

## Tutorial 3: Block and Unblock a SIM

### Step 1: Block a SIM (Fraud Suspected)

```bash
curl -X POST "$API_V1/sims/$SIM_ID/block" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "FRAUD_SUSPECTED",
    "notes": "Unusual usage pattern detected - 100x normal traffic",
    "correlationId": "fraud-alert-2024-001"
  }'
```

**Expected Response:**

```json
{
  "simId": "sim_abc123def456",
  "iccid": "89410123456789012345",
  "status": "BLOCKED",
  "createdAt": "2024-12-21T10:30:00.000Z",
  "updatedAt": "2024-12-21T11:00:00.000Z",
  "links": {
    "self": "/api/v1/sims/sim_abc123def456",
    "usage": "/api/v1/sims/sim_abc123def456/usage"
  }
}
```

### Block Reason Options

| Reason | When to Use |
|--------|-------------|
| `USAGE_THRESHOLD_EXCEEDED` | Data limit exceeded |
| `FRAUD_SUSPECTED` | Suspicious activity |
| `BILLING_ISSUE` | Payment problems |
| `CUSTOMER_REQUEST` | Customer asked to block |
| `POLICY_VIOLATION` | Terms of service violation |
| `MANUAL` | Administrative action |

### Step 2: Verify SIM is Blocked

```bash
curl -X GET "$API_V1/sims/$SIM_ID" \
  -H "Authorization: Bearer $API_KEY"
```

**Check these fields in response:**

```json
{
  "status": "BLOCKED",
  "blockReason": "FRAUD_SUSPECTED",
  "blockNotes": "Unusual usage pattern detected - 100x normal traffic",
  "blockedAt": "2024-12-21T11:00:00.000Z"
}
```

### Step 3: Unblock the SIM

```bash
curl -X POST "$API_V1/sims/$SIM_ID/unblock" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "MANUAL",
    "notes": "Investigation complete - false positive",
    "correlationId": "fraud-alert-2024-001-resolved"
  }'
```

**Expected Response:** SIM returns to previous state (ACTIVE or INACTIVE).

---

## Tutorial 4: Query Invoices

### Step 1: List All Invoices

```bash
curl -X GET "$API_BASE/api/consumption/invoices" \
  -H "Authorization: Bearer $API_KEY"
```

**Expected Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "inv_abc123",
      "invoiceNumber": "INV-2024-12-001",
      "carrierId": "swisscom",
      "carrierName": "Swisscom",
      "periodStart": "2024-12-01",
      "periodEnd": "2024-12-31",
      "totalAmount": 15750.50,
      "currency": "CHF",
      "status": "pending",
      "dueDate": "2025-01-15",
      "paidDate": null,
      "pdfUrl": "https://storage.example.com/invoices/INV-2024-12-001.pdf",
      "erpnextReference": "SINV-2024-00123"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 24,
    "totalPages": 3
  }
}
```

### Step 2: Filter by Status

```bash
# Get only pending invoices
curl -X GET "$API_BASE/api/consumption/invoices?status=pending" \
  -H "Authorization: Bearer $API_KEY"

# Get paid invoices
curl -X GET "$API_BASE/api/consumption/invoices?status=paid" \
  -H "Authorization: Bearer $API_KEY"

# Get overdue invoices
curl -X GET "$API_BASE/api/consumption/invoices?status=overdue" \
  -H "Authorization: Bearer $API_KEY"
```

### Step 3: Filter by Carrier

```bash
curl -X GET "$API_BASE/api/consumption/invoices?carrier_id=swisscom" \
  -H "Authorization: Bearer $API_KEY"
```

### Step 4: Pagination

```bash
# Get page 2 with 5 results per page
curl -X GET "$API_BASE/api/consumption/invoices?page=2&limit=5" \
  -H "Authorization: Bearer $API_KEY"
```

### Invoice Status Values

| Status | Description |
|--------|-------------|
| `pending` | Awaiting payment |
| `paid` | Payment received |
| `overdue` | Past due date |
| `disputed` | Under dispute |

---

## Tutorial 5: Consumption Analytics

### Step 1: Get KPI Dashboard Data

```bash
curl -X GET "$API_BASE/api/consumption/kpis" \
  -H "Authorization: Bearer $API_KEY"
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "totalSpend": 45678.90,
    "totalSpendTrend": 5.2,
    "dataUsageGB": 1234.56,
    "dataUsageTrend": 12.3,
    "activeSims": 1250,
    "activeSimsTrend": 2.1,
    "avgCostPerSim": 36.54
  }
}
```

### Step 2: Get Consumption Trends

```bash
# Last 24 hours (hourly data)
curl -X GET "$API_BASE/api/consumption/trends?granularity=hourly"

# Last 7 days (daily data)
curl -X GET "$API_BASE/api/consumption/trends?granularity=daily"

# Last 5 weeks (weekly data)
curl -X GET "$API_BASE/api/consumption/trends?granularity=weekly"

# Last 6 months (monthly data)
curl -X GET "$API_BASE/api/consumption/trends?granularity=monthly"
```

**Expected Response (weekly):**

```json
{
  "success": true,
  "data": [
    { "period": "W47", "dataUsageGB": 245.67, "cost": 4532.10, "simCount": 1200 },
    { "period": "W48", "dataUsageGB": 256.89, "cost": 4678.50, "simCount": 1220 },
    { "period": "W49", "dataUsageGB": 234.12, "cost": 4321.00, "simCount": 1215 },
    { "period": "W50", "dataUsageGB": 267.45, "cost": 4890.25, "simCount": 1230 },
    { "period": "W51", "dataUsageGB": 245.23, "cost": 4512.80, "simCount": 1225 }
  ],
  "granularity": "weekly"
}
```

### Step 3: Get Carrier Breakdown

```bash
curl -X GET "$API_BASE/api/consumption/carriers"
```

**Expected Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "swisscom",
      "name": "Swisscom",
      "dataUsageGB": 567.89,
      "cost": 12345.67,
      "costPercentage": 45.2,
      "dataPercentage": 48.5
    },
    {
      "id": "sunrise",
      "name": "Sunrise",
      "dataUsageGB": 345.12,
      "cost": 8765.43,
      "costPercentage": 32.1,
      "dataPercentage": 29.5
    }
  ]
}
```

### Step 4: Get Regional Usage Data

```bash
curl -X GET "$API_BASE/api/consumption/regional"
```

**Expected Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "DEV001",
      "name": "Gateway Zurich-01",
      "latitude": 47.3769,
      "longitude": 8.5417,
      "dataUsageMB": 1234.56,
      "locationName": "Zurich Office"
    }
  ]
}
```

---

## Tutorial 6: Webhooks

### Step 1: Register a Webhook

```bash
curl -X POST "$API_V1/webhooks" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhooks/sim-events",
    "events": ["SIM_ACTIVATED", "SIM_DEACTIVATED", "SIM_BLOCKED", "SIM_UNBLOCKED"],
    "secret": "your-32-character-minimum-secret-key-here"
  }'
```

**Expected Response (201 Created):**

```json
{
  "webhookId": "wh_abc123def456",
  "url": "https://your-server.com/webhooks/sim-events",
  "events": ["SIM_ACTIVATED", "SIM_DEACTIVATED", "SIM_BLOCKED", "SIM_UNBLOCKED"],
  "createdAt": "2024-12-21T12:00:00.000Z",
  "status": "ACTIVE"
}
```

### Step 2: List Your Webhooks

```bash
curl -X GET "$API_V1/webhooks" \
  -H "Authorization: Bearer $API_KEY"
```

### Step 3: Get Webhook Details

```bash
curl -X GET "$API_V1/webhooks/wh_abc123def456" \
  -H "Authorization: Bearer $API_KEY"
```

### Step 4: Delete a Webhook

```bash
curl -X DELETE "$API_V1/webhooks/wh_abc123def456" \
  -H "Authorization: Bearer $API_KEY"
```

**Expected Response:** 204 No Content

### Webhook Payload Example

When a SIM is activated, your webhook URL receives:

```json
{
  "eventId": "evt_xyz789",
  "eventType": "SIM_ACTIVATED",
  "timestamp": "2024-12-21T12:00:00.000Z",
  "sim": {
    "simId": "sim_abc123def456",
    "iccid": "89410123456789012345",
    "imsi": "234101234567890",
    "msisdn": "+41791234567"
  },
  "previousStatus": "PROVISIONED",
  "newStatus": "ACTIVE",
  "reason": "Customer onboarding complete",
  "initiatedBy": "API",
  "correlationId": "test-order-001"
}
```

### Webhook Headers

```http
Content-Type: application/json
X-Signature: sha256=abc123...
X-Event-Type: SIM_ACTIVATED
X-Event-Id: evt_xyz789
X-Timestamp: 2024-12-21T12:00:00.000Z
```

### Verify Webhook Signature (Node.js Example)

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' +
    crypto.createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usage
app.post('/webhooks/sim-events', (req, res) => {
  const signature = req.headers['x-signature'];
  const isValid = verifyWebhookSignature(req.body, signature, 'your-secret');

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  // Process the webhook
  console.log('Event:', req.body.eventType);
  res.status(200).send('OK');
});
```

---

## Complete API Reference

### Endpoint Summary

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/health` | Health check | No |
| `POST` | `/api/v1/sims` | Create SIM | Yes |
| `GET` | `/api/v1/sims` | Search SIMs | Yes |
| `GET` | `/api/v1/sims/:simId` | Get SIM details | Yes |
| `PATCH` | `/api/v1/sims/:simId` | Update SIM | Yes |
| `POST` | `/api/v1/sims/:simId/activate` | Activate SIM | Yes |
| `POST` | `/api/v1/sims/:simId/deactivate` | Deactivate SIM | Yes |
| `POST` | `/api/v1/sims/:simId/block` | Block SIM | Yes |
| `POST` | `/api/v1/sims/:simId/unblock` | Unblock SIM | Yes |
| `GET` | `/api/v1/sims/:simId/usage` | Get SIM usage | Yes |
| `POST` | `/api/v1/usage` | Submit usage record | Yes |
| `POST` | `/api/v1/usage/batch` | Submit usage batch | Yes |
| `POST` | `/api/v1/usage/reset` | Reset billing cycle | Yes |
| `POST` | `/api/v1/webhooks` | Register webhook | Yes |
| `GET` | `/api/v1/webhooks` | List webhooks | Yes |
| `GET` | `/api/v1/webhooks/:webhookId` | Get webhook | Yes |
| `DELETE` | `/api/v1/webhooks/:webhookId` | Delete webhook | Yes |
| `GET` | `/api/consumption/kpis` | Get KPIs | No |
| `GET` | `/api/consumption/trends` | Get trends | No |
| `GET` | `/api/consumption/carriers` | Get carriers | No |
| `GET` | `/api/consumption/regional` | Get regional data | No |
| `GET` | `/api/consumption/invoices` | Get invoices | No |

### SIM Status State Machine

```
                    ┌─────────────────┐
                    │   PROVISIONED   │
                    └────────┬────────┘
                             │ activate
                             ▼
┌───────────┐      ┌─────────────────┐      ┌───────────┐
│  BLOCKED  │◄─────│     ACTIVE      │─────►│  INACTIVE │
└─────┬─────┘ block└────────┬────────┘deact └─────┬─────┘
      │                     │                      │
      │   unblock           │                      │ activate
      └─────────────────────┴──────────────────────┘
```

### Data Format Reference

#### ICCID Format
- 19-20 digits
- Pattern: `^[0-9]{19,20}$`
- Example: `89410123456789012345`

#### IMSI Format
- 15 digits
- Pattern: `^[0-9]{15}$`
- Example: `234101234567890`

#### MSISDN Format
- E.164 international format
- Pattern: `^\+[0-9]{7,15}$`
- Example: `+41791234567`

#### IMEI Format
- 15 digits
- Pattern: `^[0-9]{15}$`
- Example: `123456789012345`

#### Date/Time Format
- ISO 8601
- Example: `2024-12-21T10:30:00.000Z`

#### Data Size
- Always in bytes
- 1 KB = 1024 bytes
- 1 MB = 1048576 bytes
- 1 GB = 1073741824 bytes
- 10 GB = 10737418240 bytes

---

## Troubleshooting

### Common Errors

#### 401 Unauthorized

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key"
  }
}
```

**Solution:** Check your Authorization header:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" ...
```

#### 404 SIM Not Found

```json
{
  "error": {
    "code": "SIM_NOT_FOUND",
    "message": "SIM sim_abc123 not found"
  }
}
```

**Solution:** Verify the SIM ID exists:
```bash
curl "$API_V1/sims?iccid=YOUR_ICCID" -H "Authorization: Bearer $API_KEY"
```

#### 409 Invalid State Transition

```json
{
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Cannot activate SIM in BLOCKED status"
  }
}
```

**Solution:** Check current status and use appropriate action:
- BLOCKED SIM must be unblocked first
- ACTIVE SIM cannot be activated again

#### 409 Duplicate ICCID

```json
{
  "error": {
    "code": "DUPLICATE_ICCID",
    "message": "SIM with ICCID 89410123456789012345 already exists"
  }
}
```

**Solution:** Use a different ICCID or search for existing SIM.

#### 429 Rate Limit Exceeded

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds."
  }
}
```

**Solution:** Wait and retry. Check headers for limit info:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

### Server Not Running

```bash
# Check if API server is running
curl http://localhost:3001/api/v1/health

# If not running, start it:
cd /Users/mackmood/CMP/sim-card-portal-v2
node scripts/local-api-server.js
```

### Database Connection Issues

```bash
# Check PostgreSQL
psql -h localhost -p 5434 -U simportal -d simcardportal -c "SELECT 1"

# Check Supabase
curl http://localhost:8090/rest/v1/ -I
```

### View API Server Logs

```bash
# Logs are output to the terminal where the server is running
# Or check the log file:
cat /tmp/api-server.log
```

---

## Quick Reference Card

```bash
# Environment Setup
export API_BASE="http://localhost:3001"
export API_V1="http://localhost:3001/api/v1"
export API_KEY="test_provisioning_key_12345"

# Health Check
curl $API_V1/health

# Create SIM
curl -X POST $API_V1/sims -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" -d '{"iccid":"...", ...}'

# Activate SIM
curl -X POST $API_V1/sims/SIM_ID/activate -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" -d '{"reason":"..."}'

# Block SIM
curl -X POST $API_V1/sims/SIM_ID/block -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" -d '{"reason":"FRAUD_SUSPECTED"}'

# Submit Usage
curl -X POST $API_V1/usage -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" -d '{"iccid":"...", "usage":{...}}'

# Get Trends
curl "$API_BASE/api/consumption/trends?granularity=weekly"

# Get Invoices
curl "$API_BASE/api/consumption/invoices?status=pending"
```

---

**End of Guide**

For additional support, contact the API team or refer to the source code in:
- `/Users/mackmood/CMP/sim-card-portal-v2/api/v1/` - API implementation
- `/Users/mackmood/CMP/sim-card-portal-v2/scripts/local-api-server.js` - Server setup

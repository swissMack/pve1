# SIM Card Portal Database Schema Analysis Report

**Generated:** 2025-12-26
**Database:** PostgreSQL 15 (Supabase)
**Total Tables:** 25
**Total Indexes:** 77

---

## 1. Schema Overview

### Table Summary

| Table | Rows | Size | Purpose |
|-------|------|------|---------|
| `daily_usage` | 556 | 240 KB | Aggregated daily usage per carrier |
| `usage_records` | 351 | 200 KB | Raw usage records from mediation |
| `usage_aggregations` | 36 | 64 KB | Period-based usage summaries |
| `invoices` | 9 | 96 KB | Billing invoices |
| `sim_cards` | 7 | 80 KB | SIM card inventory (legacy) |
| `devices` | 7 | 96 KB | IoT devices |
| `provisioned_sims` | 0 | 64 KB | Provisioned SIMs (API-managed) |
| `usage_cycles` | 0 | 40 KB | Billing cycles per SIM |
| `device_location_history` | 0 | 32 KB | GPS tracking history |
| `device_sensor_history` | 0 | 32 KB | Sensor data history |
| `carriers` | 3 | 32 KB | Mobile carriers/MNOs |
| `plans` | 4 | 32 KB | Rate plans |
| `locations` | 5 | 32 KB | Physical locations |
| `device_types` | 5 | 32 KB | Device type definitions |
| `users` | 1 | 48 KB | Application users |
| `user_sessions` | 0 | 16 KB | User sessions |
| `api_clients` | 0 | 32 KB | API client credentials |
| `api_audit_log` | 0 | 40 KB | API request audit trail |
| `sim_audit_log` | 0 | 40 KB | SIM state change audit |
| `webhooks` | 0 | 32 KB | Webhook subscriptions |
| `webhook_deliveries` | 0 | 32 KB | Webhook delivery tracking |
| `rate_limit_buckets` | 0 | 24 KB | API rate limiting |
| `llm_conversations` | 0 | 32 KB | Chat history for Ask Bob |
| `app_settings` | 2 | 32 KB | Application settings |
| `exchange_rates` | 0 | 24 KB | Currency exchange rates |

### Entity Relationship Diagram (Logical)

```
┌─────────────────┐     ┌─────────────┐     ┌──────────┐
│   carriers      │◄────│  sim_cards  │────►│  plans   │
└─────────────────┘     └──────┬──────┘     └──────────┘
        │                      │
        │                      ▼
        │               ┌─────────────┐     ┌──────────────┐
        │               │   devices   │────►│ device_types │
        │               └──────┬──────┘     └──────────────┘
        │                      │
        │                      ▼
        │               ┌─────────────┐
        │               │  locations  │
        │               └─────────────┘
        │
        ▼
┌─────────────────┐     ┌─────────────────┐
│   daily_usage   │     │ usage_records   │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────────┐
                        │  provisioned_sims   │
                        └─────────────────────┘

┌─────────────────┐     ┌──────────────────┐
│   api_clients   │────►│     webhooks     │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌────────────────────┐
│  api_audit_log  │     │ webhook_deliveries │
└─────────────────┘     └────────────────────┘
```

---

## 2. Critical Issues Found

### Issue #1: Duplicate SIM Tables (HIGH PRIORITY)

**Problem:** Two tables manage SIM cards with overlapping purposes:
- `sim_cards` - 7 rows, appears to be legacy/display data
- `provisioned_sims` - 0 rows, designed for API provisioning

**Impact:**
- Data inconsistency risk
- Confusion about source of truth
- Redundant storage
- Complex JOIN queries required

**Recommendation:** Consolidate into a single `sim_cards` table or establish clear separation with documented sync mechanism.

---

### Issue #2: No Row Level Security (CRITICAL)

**Problem:** All 25 tables have RLS disabled:
```
rls_enabled = false for ALL tables
```

**Impact:**
- Any authenticated user can access all data
- No multi-tenant isolation
- Direct Supabase client access exposes all records
- Security compliance failure

**Recommendation:** Enable RLS on all user-facing tables and create appropriate policies.

---

### Issue #3: Inconsistent Data Types

#### ICCID Column Inconsistency
| Table | Max Length |
|-------|------------|
| `sim_cards` | **UNLIMITED** |
| `provisioned_sims` | 20 |
| `usage_records` | 20 |
| `usage_cycles` | 20 |
| `sim_audit_log` | 20 |

**Impact:** Potential data truncation or mismatch when joining tables.

**Recommendation:** Standardize to `VARCHAR(20)` (ICCID is always 19-20 digits).

#### carrier_id Column Inconsistency
| Table | Max Length |
|-------|------------|
| `sim_cards` | UNLIMITED |
| `daily_usage` | UNLIMITED |
| `invoices` | UNLIMITED |
| `usage_aggregations` | UNLIMITED |

**Recommendation:** Add `VARCHAR(50)` constraint for consistency.

---

### Issue #4: Missing Foreign Key Relationships

The following logical relationships lack foreign key constraints:

| Parent Table | Child Table | Missing FK |
|--------------|-------------|------------|
| `sim_cards` | `usage_records` | `usage_records.iccid → sim_cards.iccid` |
| `carriers` | `provisioned_sims` | No carrier reference in provisioned_sims |
| `sim_cards` | `usage_cycles` | No direct FK (uses iccid text match) |

**Impact:** Orphaned records possible, no cascade behavior.

---

### Issue #5: Status Value Inconsistency

**sim_cards.status:**
```sql
CHECK ('Active', 'Inactive', 'Suspended', 'Terminated', 'active', 'available')
-- Mixed case values: 'Active' vs 'active'
```

**provisioned_sims.status:**
```sql
CHECK ('PROVISIONED', 'ACTIVE', 'INACTIVE', 'BLOCKED')
-- All uppercase
```

**Impact:** Case-sensitive comparisons will fail; unclear mapping between tables.

**Recommendation:** Standardize to UPPERCASE across all status fields.

---

### Issue #6: Unused/Test Columns

**devices table contains:**
- `test1` - VARCHAR(20) with CHECK constraint for 'value1', 'value2'

**Impact:** Pollutes schema, confuses developers.

**Recommendation:** Remove test columns from production schema.

---

## 3. Index Analysis

### Well-Indexed Tables

| Table | Indexes | Assessment |
|-------|---------|------------|
| `usage_records` | 5 | Excellent coverage |
| `daily_usage` | 4 | Good coverage |
| `provisioned_sims` | 6 | Comprehensive |
| `devices` | 5 | Good coverage |
| `sim_cards` | 4 | Adequate |

### Missing Recommended Indexes

```sql
-- For time-range queries on usage_records
CREATE INDEX idx_usage_records_processed_at
ON usage_records(processed_at);

-- For carrier lookups in daily_usage aggregation
CREATE INDEX idx_sim_cards_carrier_iccid
ON sim_cards(carrier_id, iccid);

-- For device history queries (composite)
CREATE INDEX idx_device_location_composite
ON device_location_history(device_id, recorded_at DESC);

CREATE INDEX idx_device_sensor_composite
ON device_sensor_history(device_id, recorded_at DESC);

-- For invoice date range queries
CREATE INDEX idx_invoices_due_date
ON invoices(due_date) WHERE status = 'pending';

-- For LLM conversation retrieval
CREATE INDEX idx_llm_conversations_composite
ON llm_conversations(session_id, created_at DESC);
```

### Redundant Indexes

| Index | Reason |
|-------|--------|
| `idx_rate_limit_key` | Redundant with `rate_limit_buckets_bucket_key_key` UNIQUE |

---

## 4. Performance Concerns

### 4.1 No Table Partitioning for Time-Series Data

Tables that will grow indefinitely:
- `usage_records` - Should partition by `period_start`
- `daily_usage` - Should partition by `usage_date`
- `device_location_history` - Should partition by `recorded_at`
- `device_sensor_history` - Should partition by `recorded_at`
- `api_audit_log` - Should partition by `created_at`

**Recommendation:** Implement range partitioning by month for these tables.

### 4.2 No Vacuum/Analyze History

```
last_vacuum = NULL for all tables
last_autovacuum = NULL for all tables
last_analyze = NULL for all tables
```

**Impact:** Query planner using stale statistics.

**Recommendation:**
```sql
ANALYZE;  -- Run immediately
-- Configure autovacuum thresholds appropriately
```

### 4.3 Aggregate Function Performance

The `aggregate_usage_to_daily()` function:
- Joins `usage_records` with `sim_cards` on ICCID (text comparison)
- Runs every 5 minutes
- No index on the JOIN condition

**Recommendation:** Add composite index:
```sql
CREATE INDEX idx_usage_records_agg
ON usage_records(processed_at, status, iccid)
WHERE status = 'PROCESSED';
```

### 4.4 Large Text Fields in devices Table

- `specification_base64` - TEXT (can be very large)
- Should consider moving to external storage or separate table

---

## 5. Normalization Review

### Denormalization Issues

#### 5.1 Duplicated Data in usage_cycles
```
sim_id VARCHAR(50)  -- Redundant
iccid VARCHAR(20)   -- Can be derived from sim_id FK
```

**Recommendation:** Keep only `sim_id` as FK, remove `iccid`.

#### 5.2 devices Table Bloat
The `devices` table has 30+ columns mixing:
- Core device info (id, name, status)
- Location data (latitude, longitude) - duplicates `locations` table
- Sensor data (temperature, humidity) - should be in history tables
- URLs (asset_management_url, supplier_device_url)
- Binary data (specification_base64)

**Recommendation:** Split into:
- `devices` - Core attributes only
- `device_current_readings` - Latest sensor/location data
- `device_documents` - URLs and binary data

---

## 6. Security Review

### 6.1 Sensitive Data Exposure

| Table | Sensitive Columns | Current Protection |
|-------|-------------------|-------------------|
| `provisioned_sims` | `ki`, `opc`, `pin1`, `pin2`, `puk1`, `puk2` | TEXT (plaintext) |
| `api_clients` | `api_key_hash` | Hashed (good) |
| `users` | `password` | Should verify hashing |

**Critical:** `ki` and `opc` are authentication keys for SIM cards - must be encrypted at rest.

**Recommendation:**
```sql
-- Encrypt sensitive SIM data
ALTER TABLE provisioned_sims
ALTER COLUMN ki TYPE bytea USING pgp_sym_encrypt(ki, 'encryption_key');
```

### 6.2 Missing Audit Triggers

Tables with sensitive operations lack audit triggers:
- `sim_cards` - No status change tracking
- `provisioned_sims` - Has `sim_audit_log` but no trigger
- `api_clients` - No creation/deletion audit

### 6.3 No Data Retention Policies

Audit tables will grow indefinitely:
- `api_audit_log`
- `sim_audit_log`
- `webhook_deliveries`

**Recommendation:** Implement automated cleanup:
```sql
-- Delete audit logs older than 90 days
DELETE FROM api_audit_log WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## 7. Prioritized Recommendations

### Priority 1: Critical (Immediate)

1. **Enable RLS on all tables**
   ```sql
   ALTER TABLE sim_cards ENABLE ROW LEVEL SECURITY;
   -- Repeat for all user-facing tables
   ```

2. **Encrypt sensitive SIM credentials**
   - `ki`, `opc`, `pin1`, `pin2`, `puk1`, `puk2` in `provisioned_sims`

3. **Run ANALYZE on all tables**
   ```sql
   ANALYZE;
   ```

### Priority 2: High (This Sprint)

4. **Standardize ICCID data type** to `VARCHAR(20)`

5. **Add missing index for aggregation**
   ```sql
   CREATE INDEX idx_usage_records_agg
   ON usage_records(processed_at, status, iccid)
   WHERE status = 'PROCESSED';
   ```

6. **Standardize status values** to UPPERCASE

7. **Remove test column** from devices table
   ```sql
   ALTER TABLE devices DROP COLUMN test1;
   ```

### Priority 3: Medium (Next Sprint)

8. **Consolidate or document SIM tables** relationship

9. **Add foreign key constraints** for orphan prevention:
   ```sql
   ALTER TABLE usage_records
   ADD CONSTRAINT fk_usage_records_sim_cards
   FOREIGN KEY (iccid) REFERENCES sim_cards(iccid);
   ```

10. **Implement table partitioning** for time-series tables

11. **Add composite indexes** for device history queries

### Priority 4: Low (Backlog)

12. **Split devices table** into normalized structure

13. **Implement data retention policies**

14. **Add audit triggers** for sensitive operations

15. **Move specification_base64** to external storage

---

## 8. Migration Scripts

### 8.1 Critical Fixes Migration

```sql
-- Migration: 20251226_critical_fixes.sql

-- 1. Run analyze
ANALYZE;

-- 2. Standardize iccid in sim_cards
ALTER TABLE sim_cards
ALTER COLUMN iccid TYPE VARCHAR(20);

-- 3. Add missing aggregation index
CREATE INDEX IF NOT EXISTS idx_usage_records_agg
ON usage_records(processed_at, status, iccid)
WHERE status = 'PROCESSED';

-- 4. Remove test column
ALTER TABLE devices DROP COLUMN IF EXISTS test1;

-- 5. Standardize sim_cards status values
UPDATE sim_cards SET status = UPPER(status);

ALTER TABLE sim_cards DROP CONSTRAINT IF EXISTS sim_cards_status_check;
ALTER TABLE sim_cards ADD CONSTRAINT sim_cards_status_check
CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED', 'AVAILABLE'));
```

### 8.2 Security Migration

```sql
-- Migration: 20251226_enable_rls.sql

-- Enable RLS on user-facing tables
ALTER TABLE sim_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;

-- Create basic read policies (customize based on auth model)
CREATE POLICY "Allow authenticated read" ON sim_cards
FOR SELECT USING (auth.role() = 'authenticated');

-- Repeat for other tables...
```

---

## Summary

The database schema shows signs of incremental development with several areas needing attention:

| Category | Score | Notes |
|----------|-------|-------|
| **Data Integrity** | 6/10 | Missing FKs, inconsistent types |
| **Performance** | 7/10 | Good indexes, missing partitioning |
| **Security** | 3/10 | No RLS, plaintext secrets |
| **Normalization** | 5/10 | Some redundancy, bloated tables |
| **Maintainability** | 6/10 | Good triggers, test artifacts |

**Overall Assessment:** The schema is functional but needs security hardening and consistency improvements before production scale.

# Supabase Migration Analysis Report

**Branch:** V3.5Supabase
**Date:** December 2024
**Status:** Pre-Migration Analysis

---

## Executive Summary

This report identifies issues in the current codebase that need to be addressed before migrating to Supabase. The codebase has a **mixed database access pattern** - using both raw `pg` Pool queries and a Supabase client. Several issues around type safety, connection handling, and schema design need attention.

---

## Critical Issues

### 1. Mixed Database Access Patterns

**Severity:** HIGH
**Files Affected:** Multiple

The codebase uses two different database access methods:

1. **Direct `pg` Pool** - Used in most service files
   - `scripts/local-api-server.js:37`
   - `api/v1/services/sim.service.ts`
   - `api/v1/services/usage.service.ts`
   - `api/v1/middleware/auth.ts`

2. **Supabase Client** - Defined but underutilized
   - `api/lib/supabase.ts`

**Current Code:**
```javascript
// local-api-server.js
const pool = new Pool({
  user: 'simportal',
  password: 'simportal123',  // HARDCODED!
  host: 'localhost',
  port: 5434,
  database: 'simcardportal'
})
```

**Recommendation:**
- Migrate ALL database access to use Supabase client
- Remove direct `pg` Pool connections
- Use environment variables for all connection parameters

---

### 2. Type Coercion Issues

**Severity:** HIGH
**Files Affected:** `api/v1/services/usage.service.ts`

PostgreSQL BIGINT columns return strings in JavaScript. The code now handles this (recently fixed), but this pattern needs verification throughout.

**Fixed Pattern (Good):**
```typescript
// usage.service.ts:405-408
const dataLimit = Number(sim.data_limit_bytes) || 0;
const totalBytes = Number(usageCycle.total_bytes) || 0;
const totalUploadBytes = Number(usageCycle.total_upload_bytes) || 0;
const totalDownloadBytes = Number(usageCycle.total_download_bytes) || 0;
```

**Check These Locations:**
| File | Line | Column | Issue |
|------|------|--------|-------|
| `usage.service.ts` | 461 | `cycle.total_bytes` | May need Number() conversion |
| `sim.service.ts` | 231-236 | `usage.total_bytes` | Verify type handling |
| `sim.service.ts` | 319 | `countResult.rows[0].count` | Uses parseInt (OK) |

**Recommendation:**
- Add TypeScript interfaces for all database return types
- Use explicit type conversions for BIGINT columns
- Consider using Supabase's typed client for automatic handling

---

### 3. Hardcoded Credentials

**Severity:** CRITICAL
**Files Affected:** Multiple

```javascript
// local-api-server.js:37-43
const pool = new Pool({
  user: 'simportal',
  password: 'simportal123',
  host: 'localhost',
  port: 5434,
  database: 'simcardportal'
})
```

**Recommendation:**
```typescript
// Use Supabase client which reads from env
import { supabase } from '../lib/supabase'

// Required env vars:
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY
```

---

### 4. Custom Schema Name with Hyphens

**Severity:** MEDIUM
**Files Affected:** All SQL files

The schema `"sim-card-portal-v2"` uses hyphens, requiring quotes everywhere:

```sql
-- Current (problematic for Supabase)
SELECT * FROM "sim-card-portal-v2".devices

-- Supabase default is 'public' schema
SELECT * FROM public.devices
```

**Recommendation:**
- Migrate to Supabase's `public` schema
- Or rename to `sim_card_portal_v2` (underscores)
- Update all query references

---

### 5. No Row Level Security (RLS)

**Severity:** HIGH
**Files Affected:** All tables

Current tables have no RLS policies. Supabase requires RLS for secure client-side access.

**Current State:**
```sql
-- No RLS policies exist
CREATE TABLE devices (...);
```

**Required for Supabase:**
```sql
-- Enable RLS
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- Policy examples
CREATE POLICY "Users can view their own devices"
ON devices FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access"
ON devices FOR ALL
USING (auth.role() = 'service_role');
```

**Recommendations:**
1. Add `user_id` or `tenant_id` columns to tables
2. Create RLS policies for each table
3. Use service role key for backend operations

---

### 6. VARCHAR Primary Keys

**Severity:** MEDIUM
**Files Affected:** `init-local-db.sql`

Using VARCHAR for primary keys (e.g., 'DEV001') is not ideal:

```sql
-- Current
CREATE TABLE devices (
  id VARCHAR PRIMARY KEY,  -- 'DEV001', 'DEV002'
  ...
);
```

**Recommendation:**
```sql
-- Better for Supabase
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id VARCHAR UNIQUE,  -- Keep for reference
  ...
);
```

---

### 7. Missing Connection Pooling Configuration

**Severity:** MEDIUM
**Files Affected:** `local-api-server.js`

No connection pool limits or timeouts configured:

```javascript
// Current - uses defaults
const pool = new Pool({...})

// Should configure
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})
```

**Supabase Solution:**
Supabase handles connection pooling automatically with PgBouncer.

---

### 8. Inconsistent Timestamp Handling

**Severity:** LOW
**Files Affected:** Multiple

Mix of `NOW()` and `new Date().toISOString()`:

```javascript
// local-api-server.js:172
values.push(new Date().toISOString())

// Should use SQL function for consistency
values.push('NOW()')  // Or let DB handle it
```

**Recommendation:**
- Use `DEFAULT NOW()` in table definitions
- Let database handle timestamps
- Use `updated_at` triggers

---

## Schema Issues

### 1. Data Types Requiring Attention

| Table | Column | Current Type | Issue | Recommendation |
|-------|--------|--------------|-------|----------------|
| sim_cards | data_used | VARCHAR | Stores "2.4 MB" | Use BIGINT (bytes) |
| sim_cards | data_limit | VARCHAR | Stores "10 MB" | Use BIGINT (bytes) |
| devices | id | VARCHAR | Non-standard PK | Consider UUID |
| sim_cards | id | VARCHAR | Non-standard PK | Consider UUID |
| all tables | *_id FKs | VARCHAR | Match parent type | - |

### 2. Missing Indexes for Supabase

```sql
-- Add these for common queries
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_sim_card ON devices(sim_card_id);
CREATE INDEX idx_sim_cards_status ON sim_cards(status);
```

### 3. Missing updated_at Triggers

Only `provisioned_sims` has an `updated_at` trigger. Add to all tables:

```sql
-- Already exists in migration 010
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER set_devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Authentication Integration

### Current State

The codebase has two auth systems:
1. **Portal Auth** - Hardcoded credentials (`admin/1234567`)
2. **API Auth** - API key-based (`api/v1/middleware/auth.ts`)

### Supabase Auth Migration

```typescript
// Current API auth (keep for external systems)
const apiKeyHeader = req.headers['x-api-key'];

// Add Supabase auth for portal users
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Verify JWT from Supabase Auth
const { data: { user }, error } = await supabase.auth.getUser(token);
```

---

## Migration Checklist

### Phase 1: Schema Preparation

- [ ] Rename schema from `"sim-card-portal-v2"` to `public`
- [ ] Update all VARCHAR primary keys to UUID where appropriate
- [ ] Convert `data_used`/`data_limit` from VARCHAR to BIGINT
- [ ] Add `updated_at` triggers to all tables
- [ ] Create RLS policies for all tables

### Phase 2: Connection Migration

- [ ] Replace all `pg.Pool` usage with Supabase client
- [ ] Update environment variables for Supabase
- [ ] Remove hardcoded credentials
- [ ] Test connection pooling with Supabase

### Phase 3: Query Migration

- [ ] Convert raw SQL to Supabase query builder where appropriate
- [ ] Update schema references from `"sim-card-portal-v2"` to `public`
- [ ] Add explicit type conversions for BIGINT columns
- [ ] Test all queries against Supabase

### Phase 4: Authentication

- [ ] Integrate Supabase Auth for portal users
- [ ] Keep API key auth for external systems
- [ ] Implement RLS policies based on user roles
- [ ] Test role-based access

### Phase 5: Real-time Features

- [ ] Enable Supabase Realtime for device updates
- [ ] Replace MQTT-based updates with Supabase subscriptions (optional)
- [ ] Implement presence for active users

---

## File-by-File Changes Required

| File | Priority | Changes Needed |
|------|----------|----------------|
| `api/lib/supabase.ts` | HIGH | Add typed database client |
| `scripts/local-api-server.js` | HIGH | Replace pg Pool with Supabase |
| `api/v1/services/sim.service.ts` | HIGH | Update to Supabase client |
| `api/v1/services/usage.service.ts` | HIGH | Update to Supabase client |
| `api/v1/middleware/auth.ts` | MEDIUM | Add Supabase Auth option |
| `services/mqtt-bridge/dbService.js` | MEDIUM | Update connection handling |
| `migrations/*.sql` | LOW | Update schema references |

---

## Supabase-Specific Recommendations

### 1. Use Supabase TypeScript Types

```bash
npx supabase gen types typescript --project-id your-project > database.types.ts
```

### 2. Query Pattern Migration

```typescript
// Current (raw SQL)
const result = await pool.query(
  'SELECT * FROM devices WHERE id = $1',
  [deviceId]
);

// Supabase (typed, RLS-aware)
const { data, error } = await supabase
  .from('devices')
  .select('*')
  .eq('id', deviceId)
  .single();
```

### 3. Edge Functions for Complex Logic

Consider migrating complex stored functions to Supabase Edge Functions:

```typescript
// supabase/functions/accumulate-usage/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'

serve(async (req) => {
  const { simId, usage } = await req.json()
  // Implementation
})
```

---

## Summary

**Total Issues Found:** 15
**Critical:** 2 (Hardcoded credentials, Mixed DB access)
**High:** 4 (Type coercion, No RLS, Schema naming, Auth integration)
**Medium:** 5 (VARCHAR PKs, Connection pooling, Indexes, Triggers, MQTT bridge)
**Low:** 4 (Timestamp handling, Minor schema issues)

**Estimated Migration Effort:** 2-3 weeks

The codebase is generally well-structured but requires significant changes for Supabase compatibility. The main challenges are:

1. Migrating from raw SQL to Supabase client
2. Implementing RLS for security
3. Updating the custom schema name
4. Integrating Supabase Auth

The existing Supabase client in `api/lib/supabase.ts` provides a good starting point.

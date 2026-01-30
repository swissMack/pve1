-- ============================================================================
-- Sprint 5: Bulk Operations, Rule Scope, Association Audit
-- Migration: 07-sprint5-bulk-operations.sql
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. New enums
-- --------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE bulk_operation_status AS ENUM (
    'validated', 'processing', 'completed', 'failed', 'cancelled', 'undone'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bulk_entity_type AS ENUM (
    'device_asset_association'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bulk_item_status AS ENUM (
    'pending', 'success', 'error', 'skipped', 'undone'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend alert_trigger_type with new device-level triggers
DO $$ BEGIN
  ALTER TYPE alert_trigger_type ADD VALUE IF NOT EXISTS 'signal_strength';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE alert_trigger_type ADD VALUE IF NOT EXISTS 'firmware_update';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE alert_trigger_type ADD VALUE IF NOT EXISTS 'trip_complete';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE alert_trigger_type ADD VALUE IF NOT EXISTS 'idle_too_long';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE alert_trigger_type ADD VALUE IF NOT EXISTS 'geozone_breach';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- --------------------------------------------------------------------------
-- 2. bulk_operations — batch tracking
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bulk_operations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     bulk_entity_type NOT NULL,
  status          bulk_operation_status NOT NULL DEFAULT 'validated',
  total_items     INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  success_count   INTEGER NOT NULL DEFAULT 0,
  error_count     INTEGER NOT NULL DEFAULT 0,
  skipped_count   INTEGER NOT NULL DEFAULT 0,
  created_by      VARCHAR(255),
  undo_deadline   TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE bulk_operations IS 'Tracks bulk operation batches with progress counters and undo window';

CREATE INDEX IF NOT EXISTS idx_bulk_operations_status ON bulk_operations(status);
CREATE INDEX IF NOT EXISTS idx_bulk_operations_created_at ON bulk_operations(created_at DESC);

-- --------------------------------------------------------------------------
-- 3. bulk_operation_items — per-row results
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bulk_operation_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulk_operation_id   UUID NOT NULL REFERENCES bulk_operations(id) ON DELETE CASCADE,
  row_number          INTEGER NOT NULL,
  device_id           VARCHAR(50),
  asset_id            UUID,
  previous_device_id  VARCHAR(50),
  previous_asset_id   UUID,
  status              bulk_item_status NOT NULL DEFAULT 'pending',
  error_message       VARCHAR(1000),
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE bulk_operation_items IS 'Per-row results for bulk operations, stores previous state for undo';

CREATE INDEX IF NOT EXISTS idx_bulk_items_operation ON bulk_operation_items(bulk_operation_id);
CREATE INDEX IF NOT EXISTS idx_bulk_items_status ON bulk_operation_items(status);

-- --------------------------------------------------------------------------
-- 4. device_asset_association_log — audit trail
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS device_asset_association_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id       VARCHAR(50),
  asset_id        UUID,
  action          VARCHAR(20) NOT NULL CHECK (action IN ('associate', 'dissociate', 'swap')),
  previous_asset_id UUID,
  previous_device_id VARCHAR(50),
  performed_by    VARCHAR(255),
  bulk_operation_id UUID REFERENCES bulk_operations(id),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE device_asset_association_log IS 'Audit trail for all device-asset association changes (FR-804)';

CREATE INDEX IF NOT EXISTS idx_assoc_log_device ON device_asset_association_log(device_id);
CREATE INDEX IF NOT EXISTS idx_assoc_log_asset ON device_asset_association_log(asset_id);
CREATE INDEX IF NOT EXISTS idx_assoc_log_created ON device_asset_association_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assoc_log_bulk ON device_asset_association_log(bulk_operation_id);

-- --------------------------------------------------------------------------
-- 5. Add rule_scope to alert_rules and alerts
-- --------------------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE alert_rules ADD COLUMN IF NOT EXISTS rule_scope VARCHAR(10);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alerts ADD COLUMN IF NOT EXISTS device_id VARCHAR(50);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alerts ADD COLUMN IF NOT EXISTS rule_scope VARCHAR(10);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add check constraint for rule_scope values
DO $$ BEGIN
  ALTER TABLE alert_rules ADD CONSTRAINT chk_alert_rules_scope
    CHECK (rule_scope IS NULL OR rule_scope IN ('device', 'asset'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE alerts ADD CONSTRAINT chk_alerts_scope
    CHECK (rule_scope IS NULL OR rule_scope IN ('device', 'asset'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- --------------------------------------------------------------------------
-- 6. Backfill rule_scope for existing alert_rules
-- --------------------------------------------------------------------------

UPDATE alert_rules
SET rule_scope = CASE
  WHEN trigger_type::text IN ('low_battery', 'no_report', 'signal_strength', 'firmware_update') THEN 'device'
  ELSE 'asset'
END
WHERE rule_scope IS NULL;

-- --------------------------------------------------------------------------
-- 7. Trigger for updated_at on new tables
-- --------------------------------------------------------------------------

DROP TRIGGER IF EXISTS set_updated_at_bulk_operations ON bulk_operations;
CREATE TRIGGER set_updated_at_bulk_operations
  BEFORE UPDATE ON bulk_operations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

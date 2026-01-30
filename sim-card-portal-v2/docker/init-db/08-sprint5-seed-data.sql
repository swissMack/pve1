-- ============================================================================
-- Sprint 5: Seed Data — Sample bulk operations & scoped alert rules
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Sample completed bulk operation
-- --------------------------------------------------------------------------

INSERT INTO bulk_operations (id, entity_type, status, total_items, processed_items, success_count, error_count, skipped_count, created_by, undo_deadline, metadata)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'device_asset_association', 'completed', 5, 5, 4, 1, 0, 'admin', NOW() + INTERVAL '24 hours', '{"source": "csv_upload", "filename": "device-asset-mapping.csv"}'),
  ('b0000000-0000-0000-0000-000000000002', 'device_asset_association', 'validated', 3, 0, 0, 0, 0, 'admin', NULL, '{"source": "manual_batch"}');

-- --------------------------------------------------------------------------
-- 2. Sample bulk operation items (for the completed batch)
-- --------------------------------------------------------------------------

INSERT INTO bulk_operation_items (bulk_operation_id, row_number, device_id, asset_id, status, error_message)
SELECT
  'b0000000-0000-0000-0000-000000000001',
  paired.rn,
  paired.device_id,
  paired.asset_id,
  CASE WHEN paired.rn = 3 THEN 'error'::bulk_item_status ELSE 'success'::bulk_item_status END,
  CASE WHEN paired.rn = 3 THEN 'Device already associated with another asset' ELSE NULL END
FROM (
  SELECT d.id AS device_id, a.id AS asset_id, d.rn
  FROM (SELECT id, ROW_NUMBER() OVER () AS rn FROM devices LIMIT 4) d
  JOIN (SELECT id, ROW_NUMBER() OVER () AS rn FROM assets LIMIT 4) a ON d.rn = a.rn
) paired;

-- --------------------------------------------------------------------------
-- 3. Sample association audit log entries
-- --------------------------------------------------------------------------

INSERT INTO device_asset_association_log (device_id, asset_id, action, performed_by, metadata)
SELECT
  d.id,
  a.id,
  'associate',
  'admin',
  '{"source": "manual"}'
FROM (SELECT id, ROW_NUMBER() OVER () AS rn FROM devices LIMIT 3) d
JOIN (SELECT id, ROW_NUMBER() OVER () AS rn FROM assets LIMIT 3) a ON d.rn = a.rn;

-- --------------------------------------------------------------------------
-- 4. New scoped alert rules (device-level triggers)
-- --------------------------------------------------------------------------

INSERT INTO alert_rules (name, description, trigger_type, severity, conditions, actions, recipients, is_enabled, cooldown_minutes, rule_scope)
VALUES
  (
    'Low Signal Strength Alert',
    'Alert when device signal drops below threshold',
    'signal_strength',
    'medium',
    '{"thresholdDbm": -90, "windowMinutes": 15}',
    '{"email": true, "inApp": true}',
    '[{"type": "role", "value": "admin"}]',
    true,
    30,
    'device'
  ),
  (
    'Firmware Update Available',
    'Notify when device firmware needs updating',
    'firmware_update',
    'info',
    '{"checkInterval": 24}',
    '{"email": false, "inApp": true}',
    '[{"type": "role", "value": "admin"}]',
    true,
    1440,
    'device'
  ),
  (
    'Trip Completed',
    'Notify when an asset completes a trip',
    'trip_complete',
    'low',
    '{}',
    '{"email": true, "inApp": true}',
    '[{"type": "role", "value": "logistics_manager"}]',
    true,
    5,
    'asset'
  ),
  (
    'Asset Idle Too Long',
    'Alert when asset has been stationary beyond expected time',
    'idle_too_long',
    'medium',
    '{"maxIdleMinutes": 480}',
    '{"email": true, "inApp": true, "escalateAfterMinutes": 60}',
    '[{"type": "role", "value": "operations"}]',
    true,
    120,
    'asset'
  ),
  (
    'Geozone Breach Detected',
    'Critical alert for unauthorized geozone entry',
    'geozone_breach',
    'critical',
    '{"zoneTypes": ["restricted"]}',
    '{"email": true, "inApp": true, "escalateAfterMinutes": 15}',
    '[{"type": "role", "value": "security"}, {"type": "email", "value": "security@ioto.com"}]',
    true,
    5,
    'asset'
  );

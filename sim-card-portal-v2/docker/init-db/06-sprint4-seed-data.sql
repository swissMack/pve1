-- ============================================================================
-- SPRINT 4: SEED DATA FOR ALERTS & GEOFENCING
-- ============================================================================

-- ============================================================================
-- STATUS INFERENCE RULES (4 default mappings for Demo Tenant)
-- ============================================================================

INSERT INTO status_inference_rules (tenant_id, zone_type, inferred_status, no_zone_status) VALUES
  (NULL, 'warehouse', 'at_facility', 'unknown'),
  (NULL, 'supplier', 'at_supplier', 'unknown'),
  (NULL, 'customer', 'at_customer', 'unknown'),
  (NULL, 'transit_hub', 'in_transit', 'unknown')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ALERT RULES (3 sample rules)
-- ============================================================================

INSERT INTO alert_rules (id, tenant_id, name, description, trigger_type, severity, conditions, actions, recipients, is_enabled, cooldown_minutes) VALUES
  (
    'a1000000-0000-0000-0000-000000000001',
    NULL,
    'Restricted Zone Breach',
    'Alert when any asset enters a restricted geozone',
    'zone_enter',
    'critical',
    '{"zoneTypes": ["restricted"]}'::jsonb,
    '{"email": true, "in_app": true, "escalate_after_minutes": 30}'::jsonb,
    '[{"type": "role", "value": "Super Admin"}]'::jsonb,
    true,
    15
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    NULL,
    'Warehouse Exit Alert',
    'Notify when asset leaves a warehouse zone',
    'zone_exit',
    'high',
    '{"zoneTypes": ["warehouse"]}'::jsonb,
    '{"email": false, "in_app": true}'::jsonb,
    '[{"type": "role", "value": "Super Admin"}]'::jsonb,
    true,
    60
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    NULL,
    'Arrival Overdue',
    'Alert when a trip has not arrived at destination within expected time',
    'arrival_overdue',
    'medium',
    '{"gracePeriodMinutes": 120}'::jsonb,
    '{"email": true, "in_app": true}'::jsonb,
    '[{"type": "role", "value": "Super Admin"}]'::jsonb,
    true,
    120
  )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ALERTS (5 sample alerts in various states)
-- ============================================================================

-- Get first asset for linking
DO $$
DECLARE
  v_asset_id UUID;
  v_geozone_id UUID;
  v_alert1_id UUID := 'b1000000-0000-0000-0000-000000000001';
  v_alert2_id UUID := 'b1000000-0000-0000-0000-000000000002';
  v_alert3_id UUID := 'b1000000-0000-0000-0000-000000000003';
  v_alert4_id UUID := 'b1000000-0000-0000-0000-000000000004';
  v_alert5_id UUID := 'b1000000-0000-0000-0000-000000000005';
BEGIN
  SELECT id INTO v_asset_id FROM assets WHERE deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_geozone_id FROM geozones WHERE deleted_at IS NULL LIMIT 1;

  IF v_asset_id IS NOT NULL THEN
    INSERT INTO alerts (id, tenant_id, alert_rule_id, asset_id, geozone_id, alert_type, severity, status, title, description, latitude, longitude, dedup_key, sla_deadline) VALUES
      (v_alert1_id, NULL, 'a1000000-0000-0000-0000-000000000001', v_asset_id, v_geozone_id, 'zone_enter', 'critical', 'new', 'Restricted Zone Breach - Asset entered restricted area', 'Asset has entered a restricted geozone. Immediate investigation required.', 52.3676, 4.9041, 'zone_enter:' || v_asset_id || ':' || COALESCE(v_geozone_id::text, 'none'), NOW() + INTERVAL '4 hours'),
      (v_alert2_id, NULL, 'a1000000-0000-0000-0000-000000000002', v_asset_id, v_geozone_id, 'zone_exit', 'high', 'acknowledged', 'Warehouse Exit - Asset left warehouse', 'Asset has exited the warehouse zone unexpectedly.', 52.3700, 4.9050, 'zone_exit:' || v_asset_id || ':' || COALESCE(v_geozone_id::text, 'none'), NOW() + INTERVAL '8 hours'),
      (v_alert3_id, NULL, 'a1000000-0000-0000-0000-000000000003', v_asset_id, NULL, 'arrival_overdue', 'medium', 'in_progress', 'Arrival Overdue - Expected delivery missed', 'Trip has exceeded the expected arrival time by 45 minutes.', 52.3680, 4.9060, 'arrival_overdue:' || v_asset_id || ':trip1', NOW() + INTERVAL '2 hours'),
      (v_alert4_id, NULL, 'a1000000-0000-0000-0000-000000000001', v_asset_id, v_geozone_id, 'zone_enter', 'critical', 'resolved', 'Restricted Zone Breach - Resolved', 'Previous breach was investigated and resolved.', 52.3670, 4.9035, 'zone_enter:' || v_asset_id || ':resolved1', NOW() - INTERVAL '1 hour'),
      (v_alert5_id, NULL, 'a1000000-0000-0000-0000-000000000002', v_asset_id, v_geozone_id, 'zone_exit', 'low', 'new', 'Scheduled Warehouse Exit', 'Asset left warehouse as part of scheduled delivery.', 52.3710, 4.9070, 'zone_exit:' || v_asset_id || ':sched1', NOW() + INTERVAL '24 hours')
    ON CONFLICT DO NOTHING;

    -- Update resolved alert
    UPDATE alerts SET resolved_at = NOW() - INTERVAL '30 minutes' WHERE id = v_alert4_id;

    -- ============================================================================
    -- ALERT HISTORY (9 entries)
    -- ============================================================================

    INSERT INTO alert_history (alert_id, from_status, to_status, comment) VALUES
      (v_alert1_id, NULL, 'new', 'Alert created by system'),
      (v_alert2_id, NULL, 'new', 'Alert created by system'),
      (v_alert2_id, 'new', 'acknowledged', 'Acknowledged by operator'),
      (v_alert3_id, NULL, 'new', 'Alert created by system'),
      (v_alert3_id, 'new', 'acknowledged', 'Investigating delivery delay'),
      (v_alert3_id, 'acknowledged', 'in_progress', 'Contacted driver, waiting for update'),
      (v_alert4_id, NULL, 'new', 'Alert created by system'),
      (v_alert4_id, 'new', 'acknowledged', 'Investigating breach'),
      (v_alert4_id, 'acknowledged', 'resolved', 'False alarm - authorized maintenance')
    ON CONFLICT DO NOTHING;

    -- ============================================================================
    -- RESPONSIBILITY TRANSFERS (3 samples)
    -- ============================================================================

    INSERT INTO responsibility_transfers (asset_id, tenant_id, from_entity_type, from_entity_name, from_geozone_id, to_entity_type, to_entity_name, to_geozone_id, custody_duration_seconds) VALUES
      (v_asset_id, NULL, 'facility', 'Main Warehouse', v_geozone_id, 'transit_hub', 'Distribution Center', v_geozone_id, 86400),
      (v_asset_id, NULL, 'transit_hub', 'Distribution Center', v_geozone_id, 'customer', 'Acme Corp', v_geozone_id, 14400),
      (v_asset_id, NULL, 'customer', 'Acme Corp', v_geozone_id, 'facility', 'Main Warehouse', v_geozone_id, 172800)
    ON CONFLICT DO NOTHING;

    -- ============================================================================
    -- NOTIFICATIONS (3 samples)
    -- ============================================================================

    INSERT INTO notifications (tenant_id, user_id, alert_id, notification_type, channel, title, body, is_read) VALUES
      (NULL, NULL, v_alert1_id, 'alert_created', 'in_app', 'Critical: Restricted Zone Breach', 'An asset has entered a restricted geozone. Immediate investigation required.', false),
      (NULL, NULL, v_alert2_id, 'alert_created', 'in_app', 'High: Warehouse Exit Alert', 'An asset has exited the warehouse zone unexpectedly.', true),
      (NULL, NULL, v_alert3_id, 'alert_escalated', 'email', 'Medium: Arrival Overdue - Escalated', 'Trip has exceeded the expected arrival time. This alert has been escalated.', false)
    ON CONFLICT DO NOTHING;

  END IF;
END $$;

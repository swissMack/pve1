-- ============================================================================
-- SIM Card Portal - Sample Data
-- Auto-runs after schema creation
-- ============================================================================

-- ============================================================================
-- DEFAULT SETTINGS
-- ============================================================================

INSERT INTO app_settings (key, value) VALUES
  ('display_currency', '"CHF"'),
  ('exchange_rates_last_fetched', 'null')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- CARRIERS
-- ============================================================================

INSERT INTO carriers (id, name, country) VALUES
  ('carrier_001', 'Swisscom', 'Switzerland'),
  ('carrier_002', 'Sunrise', 'Switzerland'),
  ('carrier_003', 'Salt', 'Switzerland')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- PLANS
-- ============================================================================

INSERT INTO plans (id, name, carrier_id, data_limit_gb, price, currency) VALUES
  ('plan_sw_basic', 'Swisscom Basic', 'carrier_001', 5, 29.90, 'CHF'),
  ('plan_sw_pro', 'Swisscom Pro', 'carrier_001', 20, 59.90, 'CHF'),
  ('plan_sr_starter', 'Sunrise Starter', 'carrier_002', 10, 39.90, 'CHF'),
  ('plan_sr_unlimited', 'Sunrise Unlimited', 'carrier_002', NULL, 79.90, 'CHF'),
  ('plan_salt_basic', 'Salt Basic', 'carrier_003', 5, 24.90, 'CHF')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- LOCATIONS
-- ============================================================================

INSERT INTO locations (id, name, city, country, latitude, longitude) VALUES
  ('loc_zurich', 'Zurich HQ', 'Zurich', 'Switzerland', 47.3769, 8.5417),
  ('loc_geneva', 'Geneva Office', 'Geneva', 'Switzerland', 46.2044, 6.1432),
  ('loc_basel', 'Basel Warehouse', 'Basel', 'Switzerland', 47.5596, 7.5886),
  ('loc_bern', 'Bern Branch', 'Bern', 'Switzerland', 46.9480, 7.4474)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- DEVICE TYPES
-- ============================================================================

INSERT INTO device_types (id, name, category, icon) VALUES
  ('type_tracker', 'Asset Tracker', 'Tracking', 'pi-map-marker'),
  ('type_sensor', 'Environmental Sensor', 'Monitoring', 'pi-chart-line'),
  ('type_gateway', 'IoT Gateway', 'Infrastructure', 'pi-server'),
  ('type_vehicle', 'Vehicle Tracker', 'Fleet', 'pi-car')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SIM CARDS
-- ============================================================================

INSERT INTO sim_cards (id, iccid, imsi, msisdn, carrier_id, plan_id, status, activation_date, data_usage_bytes, data_limit_bytes) VALUES
  ('sim_001', '89410112345678901234', '228011234567890', '+41791234567', 'carrier_001', 'plan_sw_pro', 'Active', CURRENT_DATE - 90, 5368709120, 21474836480),
  ('sim_002', '89410112345678901235', '228011234567891', '+41791234568', 'carrier_001', 'plan_sw_basic', 'Active', CURRENT_DATE - 60, 2147483648, 5368709120),
  ('sim_003', '89410112345678901236', '228021234567892', '+41791234569', 'carrier_002', 'plan_sr_starter', 'Active', CURRENT_DATE - 45, 3221225472, 10737418240),
  ('sim_004', '89410112345678901237', '228031234567893', '+41791234570', 'carrier_003', 'plan_salt_basic', 'Inactive', NULL, 0, 5368709120),
  ('sim_005', '89410112345678901238', '228011234567894', '+41791234571', 'carrier_001', 'plan_sw_pro', 'Suspended', CURRENT_DATE - 120, 15032385536, 21474836480)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- DEVICES
-- ============================================================================

INSERT INTO devices (id, name, device_type_id, sim_card_id, location_id, status, last_seen, signal_strength, battery_level) VALUES
  ('dev_001', 'Truck Tracker A1', 'type_vehicle', 'sim_001', 'loc_zurich', 'Online', NOW() - interval '5 minutes', 85, 92),
  ('dev_002', 'Warehouse Sensor B1', 'type_sensor', 'sim_002', 'loc_basel', 'Online', NOW() - interval '2 minutes', 78, 100),
  ('dev_003', 'Asset Tag C1', 'type_tracker', 'sim_003', 'loc_geneva', 'Online', NOW() - interval '15 minutes', 62, 45),
  ('dev_004', 'Gateway GW-01', 'type_gateway', NULL, 'loc_bern', 'Offline', NOW() - interval '2 hours', 0, 100),
  ('dev_005', 'Fleet Vehicle F1', 'type_vehicle', 'sim_005', 'loc_zurich', 'Offline', NOW() - interval '1 day', 0, 23)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- ADMIN USER
-- ============================================================================

INSERT INTO users (email, password_hash, name, role) VALUES
  ('admin@example.com', 'b', 'Admin User', 'admin')
ON CONFLICT (email) DO NOTHING;


-- Update data_used display column
UPDATE sim_cards 
SET data_used = CASE 
    WHEN data_usage_bytes >= 1073741824 THEN ROUND(data_usage_bytes / 1073741824.0, 2) || ' GB'
    WHEN data_usage_bytes >= 1048576 THEN ROUND(data_usage_bytes / 1048576.0, 2) || ' MB'
    ELSE ROUND(data_usage_bytes / 1024.0, 2) || ' KB'
END
WHERE data_usage_bytes IS NOT NULL AND data_usage_bytes > 0;

-- Copy coordinates from locations to devices
UPDATE devices d
SET latitude = l.latitude, longitude = l.longitude
FROM locations l
WHERE d.location_id = l.id AND l.latitude IS NOT NULL;

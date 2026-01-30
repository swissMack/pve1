-- ============================================================================
-- Sprint 3 Seed Data — Assets, Geozones, Events, Trips
-- ============================================================================

-- ============================================================================
-- ASSETS (6 total: 4 linked to existing devices, 2 standalone)
-- ============================================================================

INSERT INTO assets (id, name, asset_type, barcode, birth_date, composition, recycled_content, trip_count, last_trip_date, current_status, device_id, certification_status, compliance_expiry, labels, metadata) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'Pallet Container A1', 'pallet_container', 'PLT-2024-001', '2024-01-15', '{"materials": ["HDPE", "Steel"], "weight_kg": 25}', 0.3200, 12, NOW() - interval '2 days', 'at_facility', 'dev_001', 'ISO 14001', CURRENT_DATE + interval '180 days', '["priority", "food-grade"]', '{"manufacturer": "EcoPack", "model": "EP-500"}'),
  ('a0000002-0000-0000-0000-000000000002', 'Sensor Crate B1', 'sensor_crate', 'SCR-2024-002', '2024-03-20', '{"materials": ["Recycled PP"], "weight_kg": 8}', 0.8500, 5, NOW() - interval '5 days', 'in_transit', 'dev_002', 'EU Green', CURRENT_DATE + interval '365 days', '["fragile"]', '{"manufacturer": "GreenBox", "model": "GB-200"}'),
  ('a0000003-0000-0000-0000-000000000003', 'Tracking Unit C1', 'tracking_unit', 'TRK-2024-003', '2024-02-10', '{"materials": ["ABS", "Lithium"], "weight_kg": 0.5}', 0.1500, 28, NOW() - interval '1 day', 'at_customer', 'dev_003', NULL, NULL, '["electronics"]', '{"manufacturer": "TrackIt", "model": "TI-Mini"}'),
  ('a0000004-0000-0000-0000-000000000004', 'Pallet Container A2', 'pallet_container', 'PLT-2024-004', '2024-06-01', '{"materials": ["HDPE"], "weight_kg": 22}', 0.4500, 0, NULL, 'stored', NULL, 'ISO 14001', CURRENT_DATE + interval '90 days', '["food-grade"]', '{"manufacturer": "EcoPack", "model": "EP-400"}'),
  ('a0000005-0000-0000-0000-000000000005', 'Fleet Vehicle Box F1', 'vehicle_box', 'VBX-2024-005', '2024-04-15', '{"materials": ["Aluminum", "Rubber"], "weight_kg": 45}', 0.2000, 8, NOW() - interval '3 days', 'at_supplier', 'dev_005', 'EN 12642', CURRENT_DATE + interval '270 days', '["heavy-duty"]', '{"manufacturer": "MetalPack", "model": "MP-XL"}'),
  ('a0000006-0000-0000-0000-000000000006', 'Cold Chain Container CC1', 'cold_chain', 'CCC-2024-006', '2024-05-20', '{"materials": ["Insulated PP", "Phase Change Material"], "weight_kg": 15}', 0.5500, 3, NOW() - interval '7 days', 'at_facility', NULL, 'GDP Certified', CURRENT_DATE + interval '200 days', '["temperature-controlled", "pharma"]', '{"manufacturer": "CoolTrans", "model": "CT-300"}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- GEOZONES (4 total with PostGIS polygons)
-- ============================================================================

INSERT INTO geozones (id, name, zone_type, center_lat, center_lng, radius_meters, address, owner_name, contact_name, contact_email, is_active, color, geometry) VALUES
  -- Amsterdam Warehouse (polygon ~500m around center)
  ('e0000001-0000-0000-0000-000000000001', 'Amsterdam Central Warehouse', 'warehouse',
   52.3676, 4.9041, 500,
   'Keizersgracht 100, 1015 Amsterdam, Netherlands',
   'Demo Tenant', 'Jan de Vries', 'jan@demo-tenant.com', true, '#10b981',
   ST_GeomFromText('POLYGON((4.8991 52.3626, 4.9091 52.3626, 4.9091 52.3726, 4.8991 52.3726, 4.8991 52.3626))', 4326)
  ),
  -- London Supplier
  ('e0000002-0000-0000-0000-000000000002', 'London Supplier Hub', 'supplier',
   51.5074, -0.1278, 800,
   '10 Downing Street, London SW1A 2AA, UK',
   'Demo Tenant', 'James Smith', 'james@supplier-uk.com', true, '#f59e0b',
   ST_GeomFromText('POLYGON((-0.1328 51.5024, -0.1228 51.5024, -0.1228 51.5124, -0.1328 51.5124, -0.1328 51.5024))', 4326)
  ),
  -- Paris Customer Site
  ('e0000003-0000-0000-0000-000000000003', 'Paris Customer Site', 'customer',
   48.8566, 2.3522, 600,
   '1 Avenue des Champs-Elysees, 75008 Paris, France',
   'Demo Tenant', 'Marie Dupont', 'marie@customer-fr.com', true, '#8b5cf6',
   ST_GeomFromText('POLYGON((2.3472 48.8516, 2.3572 48.8516, 2.3572 48.8616, 2.3472 48.8616, 2.3472 48.8516))', 4326)
  ),
  -- Zurich Transit Hub (near existing device locations)
  ('e0000004-0000-0000-0000-000000000004', 'Zurich Transit Hub', 'transit_hub',
   47.3769, 8.5417, 1000,
   'Bahnhofstrasse 1, 8001 Zurich, Switzerland',
   'Demo Tenant', 'Hans Mueller', 'hans@transit-ch.com', true, '#ef4444',
   ST_GeomFromText('POLYGON((8.5317 47.3669, 8.5517 47.3669, 8.5517 47.3869, 8.5317 47.3869, 8.5317 47.3669))', 4326)
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- GEOZONE EVENTS (sample enter/exit events)
-- ============================================================================

INSERT INTO geozone_events (asset_id, geozone_id, device_id, event_type, latitude, longitude, occurred_at) VALUES
  -- Asset A1 entered Amsterdam Warehouse 2 days ago
  ('a0000001-0000-0000-0000-000000000001', 'e0000001-0000-0000-0000-000000000001', 'dev_001', 'zone_enter', 52.3676, 4.9041, NOW() - interval '2 days'),
  -- Asset B1 exited Amsterdam, now in transit
  ('a0000002-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000001', 'dev_002', 'zone_exit', 52.3676, 4.9041, NOW() - interval '5 days'),
  -- Asset C1 entered Paris customer site
  ('a0000003-0000-0000-0000-000000000003', 'e0000003-0000-0000-0000-000000000003', 'dev_003', 'zone_enter', 48.8566, 2.3522, NOW() - interval '1 day'),
  -- Asset F1 entered London Supplier
  ('a0000005-0000-0000-0000-000000000005', 'e0000002-0000-0000-0000-000000000002', 'dev_005', 'zone_enter', 51.5074, -0.1278, NOW() - interval '3 days'),
  -- Asset A1 previously exited Zurich Transit Hub
  ('a0000001-0000-0000-0000-000000000001', 'e0000004-0000-0000-0000-000000000004', 'dev_001', 'zone_exit', 47.3769, 8.5417, NOW() - interval '4 days');

-- ============================================================================
-- ASSET TRIPS (1 completed, 1 in-progress)
-- ============================================================================

INSERT INTO asset_trips (asset_id, origin_geozone_id, destination_geozone_id, departed_at, arrived_at, status, distance_km) VALUES
  -- Completed trip: Zurich → Amsterdam
  ('a0000001-0000-0000-0000-000000000001', 'e0000004-0000-0000-0000-000000000004', 'e0000001-0000-0000-0000-000000000001',
   NOW() - interval '4 days', NOW() - interval '2 days', 'completed', 620.5),
  -- In-progress trip: Amsterdam → Paris (Asset B1 in transit)
  ('a0000002-0000-0000-0000-000000000002', 'e0000001-0000-0000-0000-000000000001', 'e0000003-0000-0000-0000-000000000003',
   NOW() - interval '5 days', NULL, 'in_progress', NULL);

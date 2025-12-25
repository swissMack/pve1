-- Migration: Insert 3 months of location history data for asset tracker devices
-- DEV003 (Vehicle Tracker Gamma) - Fleet vehicle making regular deliveries across Switzerland
-- DEV007 (Asset Tracker Eta) - Equipment tracker moving between warehouses and job sites

-- Clear existing data for these devices to avoid duplicates
DELETE FROM "sim-card-portal-v2".device_location_history WHERE device_id IN ('DEV003', 'DEV007');

-- ============================================================================
-- DEV003: Vehicle Tracker Gamma - Fleet Delivery Vehicle
-- Pattern: Regular delivery routes across Swiss cities, 5-6 days/week
-- Routes: Zurich -> Bern -> Geneva -> Lausanne -> Basel -> Zurich (circular)
-- ============================================================================

-- MONTH 1 (90 days ago to 60 days ago) - Week 1-4
-- Week 1: Zurich-Bern-Geneva route
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  -- Day 1: Start in Zurich, drive to Bern
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '90 days', 'gps', 100, 92),
  ('DEV003', 47.3800, 8.5200, 420, 10, 45, 270, NOW() - INTERVAL '90 days' + INTERVAL '15 minutes', 'gps', 100, 90),
  ('DEV003', 47.3900, 8.4800, 450, 12, 85, 265, NOW() - INTERVAL '90 days' + INTERVAL '30 minutes', 'gps', 99, 88),
  ('DEV003', 47.3500, 8.3500, 480, 10, 95, 250, NOW() - INTERVAL '90 days' + INTERVAL '45 minutes', 'gps', 99, 85),
  ('DEV003', 47.2800, 8.2000, 520, 12, 100, 245, NOW() - INTERVAL '90 days' + INTERVAL '1 hour', 'gps', 98, 87),
  ('DEV003', 47.1500, 8.0000, 550, 10, 105, 240, NOW() - INTERVAL '90 days' + INTERVAL '1 hour 15 minutes', 'gps', 98, 89),
  ('DEV003', 47.0500, 7.8000, 540, 12, 95, 245, NOW() - INTERVAL '90 days' + INTERVAL '1 hour 30 minutes', 'gps', 97, 86),
  ('DEV003', 46.9800, 7.6000, 530, 10, 85, 250, NOW() - INTERVAL '90 days' + INTERVAL '1 hour 45 minutes', 'gps', 97, 88),
  ('DEV003', 46.9480, 7.4474, 542, 8, 0, 0, NOW() - INTERVAL '90 days' + INTERVAL '2 hours', 'gps', 96, 92),
  -- Delivery stop in Bern (2 hours)
  ('DEV003', 46.9480, 7.4474, 542, 10, 0, 0, NOW() - INTERVAL '90 days' + INTERVAL '4 hours', 'gps', 95, 90),
  -- Bern to Geneva
  ('DEV003', 46.9200, 7.4000, 550, 10, 50, 220, NOW() - INTERVAL '90 days' + INTERVAL '4 hours 15 minutes', 'gps', 95, 88),
  ('DEV003', 46.8500, 7.2500, 580, 12, 90, 215, NOW() - INTERVAL '90 days' + INTERVAL '4 hours 30 minutes', 'gps', 94, 85),
  ('DEV003', 46.7500, 7.0500, 600, 10, 100, 210, NOW() - INTERVAL '90 days' + INTERVAL '4 hours 45 minutes', 'gps', 94, 87),
  ('DEV003', 46.6000, 6.8500, 550, 12, 105, 205, NOW() - INTERVAL '90 days' + INTERVAL '5 hours', 'gps', 93, 89),
  ('DEV003', 46.4500, 6.6000, 480, 10, 95, 210, NOW() - INTERVAL '90 days' + INTERVAL '5 hours 15 minutes', 'gps', 93, 86),
  ('DEV003', 46.3000, 6.3500, 420, 12, 85, 205, NOW() - INTERVAL '90 days' + INTERVAL '5 hours 30 minutes', 'gps', 92, 88),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '90 days' + INTERVAL '6 hours', 'gps', 92, 93),

  -- Day 2: Geneva local deliveries
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '89 days', 'gps', 100, 92),
  ('DEV003', 46.2100, 6.1600, 380, 10, 35, 45, NOW() - INTERVAL '89 days' + INTERVAL '30 minutes', 'gps', 99, 90),
  ('DEV003', 46.2200, 6.1800, 390, 12, 40, 60, NOW() - INTERVAL '89 days' + INTERVAL '1 hour', 'gps', 99, 88),
  ('DEV003', 46.2150, 6.2000, 385, 10, 30, 90, NOW() - INTERVAL '89 days' + INTERVAL '1 hour 30 minutes', 'gps', 98, 89),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '89 days' + INTERVAL '2 hours', 'gps', 98, 91),
  ('DEV003', 46.1900, 6.1200, 365, 10, 25, 180, NOW() - INTERVAL '89 days' + INTERVAL '3 hours', 'gps', 97, 87),
  ('DEV003', 46.1800, 6.1000, 355, 12, 30, 200, NOW() - INTERVAL '89 days' + INTERVAL '3 hours 30 minutes', 'gps', 97, 85),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '89 days' + INTERVAL '4 hours', 'gps', 96, 92),

  -- Day 3: Geneva to Lausanne
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '88 days', 'gps', 100, 91),
  ('DEV003', 46.2500, 6.2000, 400, 10, 60, 45, NOW() - INTERVAL '88 days' + INTERVAL '15 minutes', 'gps', 99, 89),
  ('DEV003', 46.3200, 6.3500, 450, 12, 85, 50, NOW() - INTERVAL '88 days' + INTERVAL '30 minutes', 'gps', 99, 87),
  ('DEV003', 46.4000, 6.5000, 480, 10, 90, 55, NOW() - INTERVAL '88 days' + INTERVAL '45 minutes', 'gps', 98, 88),
  ('DEV003', 46.5197, 6.6323, 495, 8, 0, 0, NOW() - INTERVAL '88 days' + INTERVAL '1 hour', 'gps', 98, 92),
  -- Lausanne delivery stop
  ('DEV003', 46.5197, 6.6323, 495, 10, 0, 0, NOW() - INTERVAL '88 days' + INTERVAL '3 hours', 'gps', 96, 90),
  -- Return to Geneva
  ('DEV003', 46.4000, 6.5000, 480, 12, 85, 235, NOW() - INTERVAL '88 days' + INTERVAL '3 hours 30 minutes', 'gps', 96, 88),
  ('DEV003', 46.3000, 6.3000, 440, 10, 80, 230, NOW() - INTERVAL '88 days' + INTERVAL '4 hours', 'gps', 95, 89),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '88 days' + INTERVAL '4 hours 30 minutes', 'gps', 95, 91),

  -- Day 4-5: Rest/Weekend in Geneva
  ('DEV003', 46.2044, 6.1432, 375, 10, 0, 0, NOW() - INTERVAL '87 days', 'gps', 100, 92),
  ('DEV003', 46.2044, 6.1432, 375, 12, 0, 0, NOW() - INTERVAL '86 days', 'gps', 100, 90),

  -- Day 6: Geneva to Basel (long haul)
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '85 days', 'gps', 100, 91),
  ('DEV003', 46.3500, 6.4000, 450, 10, 75, 45, NOW() - INTERVAL '85 days' + INTERVAL '30 minutes', 'gps', 99, 88),
  ('DEV003', 46.5500, 6.7500, 520, 12, 95, 50, NOW() - INTERVAL '85 days' + INTERVAL '1 hour', 'gps', 98, 86),
  ('DEV003', 46.8000, 7.1000, 580, 10, 105, 55, NOW() - INTERVAL '85 days' + INTERVAL '1 hour 30 minutes', 'gps', 97, 87),
  ('DEV003', 46.9480, 7.4474, 542, 12, 100, 60, NOW() - INTERVAL '85 days' + INTERVAL '2 hours', 'gps', 96, 89),
  ('DEV003', 47.1500, 7.5000, 480, 10, 95, 15, NOW() - INTERVAL '85 days' + INTERVAL '2 hours 30 minutes', 'gps', 95, 88),
  ('DEV003', 47.3500, 7.5500, 380, 12, 90, 10, NOW() - INTERVAL '85 days' + INTERVAL '3 hours', 'gps', 94, 90),
  ('DEV003', 47.5596, 7.5886, 260, 8, 0, 0, NOW() - INTERVAL '85 days' + INTERVAL '3 hours 30 minutes', 'gps', 94, 93),
  -- Basel delivery
  ('DEV003', 47.5596, 7.5886, 260, 10, 0, 0, NOW() - INTERVAL '85 days' + INTERVAL '5 hours', 'gps', 92, 91),

  -- Day 7: Basel to Zurich
  ('DEV003', 47.5596, 7.5886, 260, 8, 0, 0, NOW() - INTERVAL '84 days', 'gps', 100, 92),
  ('DEV003', 47.5400, 7.7500, 320, 10, 65, 95, NOW() - INTERVAL '84 days' + INTERVAL '15 minutes', 'gps', 99, 90),
  ('DEV003', 47.5000, 7.9500, 380, 12, 90, 100, NOW() - INTERVAL '84 days' + INTERVAL '30 minutes', 'gps', 99, 88),
  ('DEV003', 47.4500, 8.1500, 420, 10, 95, 105, NOW() - INTERVAL '84 days' + INTERVAL '45 minutes', 'gps', 98, 89),
  ('DEV003', 47.4000, 8.3500, 440, 12, 85, 110, NOW() - INTERVAL '84 days' + INTERVAL '1 hour', 'gps', 98, 87),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '84 days' + INTERVAL '1 hour 15 minutes', 'gps', 97, 92);

-- Week 2-4: Repeat pattern with variations
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  -- Week 2: Similar route pattern
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '83 days', 'gps', 100, 91),
  ('DEV003', 47.2000, 8.2000, 480, 12, 95, 250, NOW() - INTERVAL '83 days' + INTERVAL '1 hour', 'gps', 98, 88),
  ('DEV003', 46.9480, 7.4474, 542, 8, 0, 0, NOW() - INTERVAL '83 days' + INTERVAL '2 hours', 'gps', 96, 92),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '83 days' + INTERVAL '5 hours', 'gps', 92, 90),
  ('DEV003', 46.2044, 6.1432, 375, 10, 0, 0, NOW() - INTERVAL '82 days', 'gps', 100, 91),
  ('DEV003', 46.5197, 6.6323, 495, 8, 0, 0, NOW() - INTERVAL '82 days' + INTERVAL '1 hour', 'gps', 98, 89),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '82 days' + INTERVAL '3 hours', 'gps', 96, 90),
  ('DEV003', 46.2044, 6.1432, 375, 10, 0, 0, NOW() - INTERVAL '81 days', 'gps', 100, 92),
  ('DEV003', 47.5596, 7.5886, 260, 8, 0, 0, NOW() - INTERVAL '81 days' + INTERVAL '4 hours', 'gps', 94, 88),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '80 days', 'gps', 100, 91),

  -- Week 3
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '76 days', 'gps', 100, 90),
  ('DEV003', 47.0502, 8.3093, 445, 10, 80, 200, NOW() - INTERVAL '76 days' + INTERVAL '45 minutes', 'gps', 98, 88),
  ('DEV003', 46.9480, 7.4474, 542, 8, 0, 0, NOW() - INTERVAL '76 days' + INTERVAL '2 hours', 'gps', 96, 91),
  ('DEV003', 46.5197, 6.6323, 495, 8, 0, 0, NOW() - INTERVAL '76 days' + INTERVAL '4 hours', 'gps', 94, 89),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '76 days' + INTERVAL '5 hours', 'gps', 92, 92),
  ('DEV003', 46.2044, 6.1432, 375, 10, 0, 0, NOW() - INTERVAL '75 days', 'gps', 100, 91),
  ('DEV003', 46.0037, 8.9511, 270, 8, 0, 0, NOW() - INTERVAL '75 days' + INTERVAL '6 hours', 'gps', 90, 87),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '74 days', 'gps', 100, 92),

  -- Week 4
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '69 days', 'gps', 100, 91),
  ('DEV003', 47.5596, 7.5886, 260, 8, 0, 0, NOW() - INTERVAL '69 days' + INTERVAL '2 hours', 'gps', 97, 89),
  ('DEV003', 46.9480, 7.4474, 542, 8, 0, 0, NOW() - INTERVAL '69 days' + INTERVAL '4 hours', 'gps', 95, 90),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '69 days' + INTERVAL '7 hours', 'gps', 91, 88),
  ('DEV003', 46.2044, 6.1432, 375, 10, 0, 0, NOW() - INTERVAL '68 days', 'gps', 100, 91),
  ('DEV003', 46.5197, 6.6323, 495, 8, 0, 0, NOW() - INTERVAL '68 days' + INTERVAL '1 hour', 'gps', 98, 90),
  ('DEV003', 46.9480, 7.4474, 542, 8, 0, 0, NOW() - INTERVAL '68 days' + INTERVAL '3 hours', 'gps', 96, 89),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '67 days', 'gps', 100, 92);

-- MONTH 2 (60 days ago to 30 days ago)
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  -- Week 5-6: Eastern Switzerland route (Zurich - St. Gallen - Chur - Lugano)
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '60 days', 'gps', 100, 91),
  ('DEV003', 47.4000, 8.7000, 450, 10, 75, 75, NOW() - INTERVAL '60 days' + INTERVAL '20 minutes', 'gps', 99, 89),
  ('DEV003', 47.4100, 8.9000, 520, 12, 90, 80, NOW() - INTERVAL '60 days' + INTERVAL '40 minutes', 'gps', 98, 87),
  ('DEV003', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '60 days' + INTERVAL '1 hour 15 minutes', 'gps', 97, 92),
  ('DEV003', 47.4245, 9.3767, 670, 10, 0, 0, NOW() - INTERVAL '60 days' + INTERVAL '3 hours', 'gps', 95, 90),
  ('DEV003', 47.2000, 9.5000, 600, 12, 80, 150, NOW() - INTERVAL '60 days' + INTERVAL '3 hours 30 minutes', 'gps', 94, 88),
  ('DEV003', 46.8500, 9.5300, 585, 8, 0, 0, NOW() - INTERVAL '60 days' + INTERVAL '4 hours 30 minutes', 'gps', 93, 91),
  ('DEV003', 46.8500, 9.5300, 585, 10, 0, 0, NOW() - INTERVAL '59 days', 'gps', 100, 90),
  ('DEV003', 46.5000, 9.2000, 700, 12, 70, 200, NOW() - INTERVAL '59 days' + INTERVAL '1 hour', 'gps', 98, 86),
  ('DEV003', 46.2000, 9.0000, 500, 10, 85, 210, NOW() - INTERVAL '59 days' + INTERVAL '2 hours', 'gps', 96, 88),
  ('DEV003', 46.0037, 8.9511, 270, 8, 0, 0, NOW() - INTERVAL '59 days' + INTERVAL '3 hours', 'gps', 94, 92),
  ('DEV003', 46.0037, 8.9511, 270, 10, 0, 0, NOW() - INTERVAL '58 days', 'gps', 100, 91),
  ('DEV003', 46.3000, 8.8000, 450, 12, 75, 350, NOW() - INTERVAL '58 days' + INTERVAL '1 hour', 'gps', 98, 87),
  ('DEV003', 46.8000, 8.6000, 520, 10, 90, 345, NOW() - INTERVAL '58 days' + INTERVAL '2 hours 30 minutes', 'gps', 95, 89),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '58 days' + INTERVAL '4 hours', 'gps', 92, 93),

  -- Week 7: Western route again
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '53 days', 'gps', 100, 90),
  ('DEV003', 46.9480, 7.4474, 542, 8, 0, 0, NOW() - INTERVAL '53 days' + INTERVAL '2 hours', 'gps', 96, 91),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '53 days' + INTERVAL '5 hours', 'gps', 91, 89),
  ('DEV003', 46.2044, 6.1432, 375, 10, 0, 0, NOW() - INTERVAL '52 days', 'gps', 100, 90),
  ('DEV003', 46.5197, 6.6323, 495, 8, 0, 0, NOW() - INTERVAL '52 days' + INTERVAL '1 hour', 'gps', 98, 88),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '52 days' + INTERVAL '3 hours', 'gps', 95, 91),
  ('DEV003', 47.5596, 7.5886, 260, 8, 0, 0, NOW() - INTERVAL '51 days' + INTERVAL '4 hours', 'gps', 93, 89),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '50 days', 'gps', 100, 92),

  -- Week 8: Mixed routes
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '46 days', 'gps', 100, 91),
  ('DEV003', 47.0502, 8.3093, 445, 10, 70, 210, NOW() - INTERVAL '46 days' + INTERVAL '40 minutes', 'gps', 98, 89),
  ('DEV003', 46.9480, 7.4474, 542, 8, 0, 0, NOW() - INTERVAL '46 days' + INTERVAL '1 hour 30 minutes', 'gps', 97, 90),
  ('DEV003', 46.9480, 7.4474, 542, 10, 0, 0, NOW() - INTERVAL '45 days', 'gps', 100, 91),
  ('DEV003', 46.5197, 6.6323, 495, 8, 0, 0, NOW() - INTERVAL '45 days' + INTERVAL '2 hours', 'gps', 96, 88),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '45 days' + INTERVAL '3 hours', 'gps', 94, 90),
  ('DEV003', 46.2044, 6.1432, 375, 10, 0, 0, NOW() - INTERVAL '44 days', 'gps', 100, 89),
  ('DEV003', 47.5596, 7.5886, 260, 8, 0, 0, NOW() - INTERVAL '44 days' + INTERVAL '4 hours', 'gps', 93, 91),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '43 days', 'gps', 100, 92);

-- MONTH 3 (30 days ago to now) - More detailed tracking
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  -- Week 9-10: Frequent Zurich-Bern-Geneva shuttle
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '30 days', 'gps', 100, 92),
  ('DEV003', 47.3500, 8.4500, 430, 10, 55, 250, NOW() - INTERVAL '30 days' + INTERVAL '15 minutes', 'gps', 99, 90),
  ('DEV003', 47.2800, 8.3000, 480, 12, 85, 245, NOW() - INTERVAL '30 days' + INTERVAL '30 minutes', 'gps', 99, 88),
  ('DEV003', 47.1500, 8.0500, 520, 10, 100, 240, NOW() - INTERVAL '30 days' + INTERVAL '45 minutes', 'gps', 98, 87),
  ('DEV003', 47.0200, 7.8000, 540, 12, 105, 245, NOW() - INTERVAL '30 days' + INTERVAL '1 hour', 'gps', 97, 89),
  ('DEV003', 46.9480, 7.4474, 542, 8, 0, 0, NOW() - INTERVAL '30 days' + INTERVAL '1 hour 30 minutes', 'gps', 97, 93),
  ('DEV003', 46.9480, 7.4474, 542, 10, 0, 0, NOW() - INTERVAL '30 days' + INTERVAL '3 hours', 'gps', 95, 91),
  ('DEV003', 46.8500, 7.2000, 560, 12, 80, 220, NOW() - INTERVAL '30 days' + INTERVAL '3 hours 20 minutes', 'gps', 94, 88),
  ('DEV003', 46.7000, 6.9000, 520, 10, 95, 215, NOW() - INTERVAL '30 days' + INTERVAL '3 hours 45 minutes', 'gps', 94, 86),
  ('DEV003', 46.5000, 6.6000, 480, 12, 100, 210, NOW() - INTERVAL '30 days' + INTERVAL '4 hours 10 minutes', 'gps', 93, 87),
  ('DEV003', 46.3500, 6.4000, 440, 10, 90, 205, NOW() - INTERVAL '30 days' + INTERVAL '4 hours 30 minutes', 'gps', 92, 89),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '30 days' + INTERVAL '5 hours', 'gps', 91, 93),

  -- Day 2-7 of month 3
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '29 days', 'gps', 100, 91),
  ('DEV003', 46.2100, 6.1600, 382, 10, 30, 60, NOW() - INTERVAL '29 days' + INTERVAL '1 hour', 'gps', 99, 89),
  ('DEV003', 46.2200, 6.1900, 395, 12, 35, 75, NOW() - INTERVAL '29 days' + INTERVAL '2 hours', 'gps', 98, 88),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '29 days' + INTERVAL '3 hours', 'gps', 97, 91),
  ('DEV003', 46.2044, 6.1432, 375, 10, 0, 0, NOW() - INTERVAL '28 days', 'gps', 100, 92),
  ('DEV003', 46.5197, 6.6323, 495, 8, 0, 0, NOW() - INTERVAL '28 days' + INTERVAL '1 hour', 'gps', 98, 89),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '28 days' + INTERVAL '3 hours', 'gps', 95, 91),
  ('DEV003', 46.2044, 6.1432, 375, 10, 0, 0, NOW() - INTERVAL '27 days', 'gps', 100, 90),
  ('DEV003', 46.9480, 7.4474, 542, 8, 0, 0, NOW() - INTERVAL '27 days' + INTERVAL '3 hours', 'gps', 94, 88),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '26 days', 'gps', 100, 92),

  -- Week 11: More detailed tracking
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '23 days', 'gps', 100, 91),
  ('DEV003', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '23 days' + INTERVAL '1 hour 30 minutes', 'gps', 97, 89),
  ('DEV003', 47.4245, 9.3767, 670, 10, 0, 0, NOW() - INTERVAL '23 days' + INTERVAL '3 hours', 'gps', 95, 91),
  ('DEV003', 46.8500, 9.5300, 585, 8, 0, 0, NOW() - INTERVAL '23 days' + INTERVAL '5 hours', 'gps', 93, 88),
  ('DEV003', 46.0037, 8.9511, 270, 8, 0, 0, NOW() - INTERVAL '22 days', 'gps', 100, 90),
  ('DEV003', 46.0037, 8.9511, 270, 10, 0, 0, NOW() - INTERVAL '21 days', 'gps', 100, 91),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '21 days' + INTERVAL '5 hours', 'gps', 92, 93),

  -- Week 12: Final week with frequent updates
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '16 days', 'gps', 100, 92),
  ('DEV003', 46.9480, 7.4474, 542, 8, 0, 0, NOW() - INTERVAL '16 days' + INTERVAL '2 hours', 'gps', 96, 90),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '16 days' + INTERVAL '5 hours', 'gps', 92, 91),
  ('DEV003', 46.2044, 6.1432, 375, 10, 0, 0, NOW() - INTERVAL '15 days', 'gps', 100, 90),
  ('DEV003', 46.2044, 6.1432, 375, 10, 0, 0, NOW() - INTERVAL '14 days', 'gps', 100, 91),
  ('DEV003', 47.5596, 7.5886, 260, 8, 0, 0, NOW() - INTERVAL '14 days' + INTERVAL '4 hours', 'gps', 94, 89),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '13 days', 'gps', 100, 92),
  ('DEV003', 47.3769, 8.5417, 408, 10, 0, 0, NOW() - INTERVAL '12 days', 'gps', 100, 91),
  ('DEV003', 47.0502, 8.3093, 445, 8, 0, 0, NOW() - INTERVAL '12 days' + INTERVAL '1 hour', 'gps', 98, 89),
  ('DEV003', 46.9480, 7.4474, 542, 8, 0, 0, NOW() - INTERVAL '12 days' + INTERVAL '2 hours', 'gps', 96, 90);

-- Last 10 days with very detailed tracking
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  ('DEV003', 46.9480, 7.4474, 542, 10, 0, 0, NOW() - INTERVAL '10 days', 'gps', 100, 91),
  ('DEV003', 46.9500, 7.4500, 545, 10, 15, 45, NOW() - INTERVAL '10 days' + INTERVAL '1 hour', 'gps', 99, 90),
  ('DEV003', 46.9480, 7.4474, 542, 8, 0, 0, NOW() - INTERVAL '10 days' + INTERVAL '2 hours', 'gps', 99, 92),
  ('DEV003', 46.8000, 7.1500, 560, 12, 85, 220, NOW() - INTERVAL '10 days' + INTERVAL '2 hours 30 minutes', 'gps', 98, 87),
  ('DEV003', 46.5000, 6.7000, 490, 10, 95, 215, NOW() - INTERVAL '10 days' + INTERVAL '3 hours', 'gps', 96, 88),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '10 days' + INTERVAL '4 hours', 'gps', 94, 93),

  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '9 days', 'gps', 100, 92),
  ('DEV003', 46.2100, 6.1550, 380, 10, 25, 50, NOW() - INTERVAL '9 days' + INTERVAL '30 minutes', 'gps', 99, 90),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '9 days' + INTERVAL '1 hour', 'gps', 99, 91),

  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '8 days', 'gps', 100, 91),
  ('DEV003', 46.5197, 6.6323, 495, 8, 0, 0, NOW() - INTERVAL '8 days' + INTERVAL '1 hour', 'gps', 98, 89),
  ('DEV003', 46.8000, 7.1000, 550, 12, 90, 55, NOW() - INTERVAL '8 days' + INTERVAL '2 hours', 'gps', 96, 87),
  ('DEV003', 46.9480, 7.4474, 542, 8, 0, 0, NOW() - INTERVAL '8 days' + INTERVAL '2 hours 45 minutes', 'gps', 95, 92),
  ('DEV003', 47.0500, 7.6500, 510, 10, 80, 45, NOW() - INTERVAL '8 days' + INTERVAL '3 hours 15 minutes', 'gps', 94, 88),
  ('DEV003', 47.2000, 7.9000, 460, 12, 95, 55, NOW() - INTERVAL '8 days' + INTERVAL '3 hours 45 minutes', 'gps', 93, 89),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '8 days' + INTERVAL '4 hours 30 minutes', 'gps', 91, 93),

  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '7 days', 'gps', 100, 92),
  ('DEV003', 47.3800, 8.5500, 415, 10, 20, 45, NOW() - INTERVAL '7 days' + INTERVAL '30 minutes', 'gps', 99, 90),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '7 days' + INTERVAL '1 hour', 'gps', 99, 91),

  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '6 days', 'gps', 100, 91),
  ('DEV003', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '6 days' + INTERVAL '1 hour 30 minutes', 'gps', 97, 88),
  ('DEV003', 47.4245, 9.3767, 670, 10, 0, 0, NOW() - INTERVAL '6 days' + INTERVAL '3 hours', 'gps', 95, 90),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '6 days' + INTERVAL '5 hours', 'gps', 92, 93),

  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '5 days', 'gps', 100, 92),
  ('DEV003', 47.5596, 7.5886, 260, 8, 0, 0, NOW() - INTERVAL '5 days' + INTERVAL '1 hour 30 minutes', 'gps', 97, 89),
  ('DEV003', 47.5596, 7.5886, 260, 10, 0, 0, NOW() - INTERVAL '5 days' + INTERVAL '3 hours', 'gps', 95, 91),
  ('DEV003', 46.9480, 7.4474, 542, 8, 0, 0, NOW() - INTERVAL '5 days' + INTERVAL '4 hours 30 minutes', 'gps', 93, 90),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '5 days' + INTERVAL '7 hours', 'gps', 89, 92),

  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '4 days', 'gps', 100, 91),
  ('DEV003', 46.2044, 6.1432, 375, 10, 0, 0, NOW() - INTERVAL '3 days', 'gps', 100, 90),

  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '2 days', 'gps', 100, 92),
  ('DEV003', 46.5000, 6.5500, 460, 12, 80, 50, NOW() - INTERVAL '2 days' + INTERVAL '30 minutes', 'gps', 99, 88),
  ('DEV003', 46.8000, 7.0000, 530, 10, 95, 55, NOW() - INTERVAL '2 days' + INTERVAL '1 hour', 'gps', 97, 87),
  ('DEV003', 46.9480, 7.4474, 542, 8, 0, 0, NOW() - INTERVAL '2 days' + INTERVAL '1 hour 45 minutes', 'gps', 96, 91),
  ('DEV003', 47.1500, 7.8000, 490, 12, 90, 50, NOW() - INTERVAL '2 days' + INTERVAL '2 hours 15 minutes', 'gps', 95, 88),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '2 days' + INTERVAL '3 hours', 'gps', 93, 93),

  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '1 day', 'gps', 100, 92),
  ('DEV003', 47.3780, 8.5450, 412, 10, 15, 60, NOW() - INTERVAL '1 day' + INTERVAL '2 hours', 'gps', 99, 90),
  ('DEV003', 47.3800, 8.5500, 420, 12, 20, 65, NOW() - INTERVAL '1 day' + INTERVAL '4 hours', 'gps', 98, 88),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '1 day' + INTERVAL '6 hours', 'gps', 97, 91),
  ('DEV003', 47.3769, 8.5417, 408, 10, 0, 0, NOW() - INTERVAL '12 hours', 'gps', 96, 90),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '6 hours', 'gps', 95, 92),
  ('DEV003', 47.3770, 8.5420, 410, 10, 5, 30, NOW() - INTERVAL '3 hours', 'gps', 95, 91),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '1 hour', 'gps', 94, 93);


-- ============================================================================
-- DEV007: Asset Tracker Eta - Equipment moving between warehouses/job sites
-- Pattern: Weekly movements between St. Gallen, Zurich, Winterthur warehouses
-- Plus occasional trips to job sites in eastern Switzerland
-- ============================================================================

-- MONTH 1 (90 days ago to 60 days ago)
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  -- Week 1: St. Gallen warehouse (stationary)
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '90 days', 'gps', 100, 85),
  ('DEV007', 47.4246, 9.3768, 671, 12, 0, 0, NOW() - INTERVAL '90 days' + INTERVAL '6 hours', 'gps', 99, 83),
  ('DEV007', 47.4245, 9.3767, 670, 10, 0, 0, NOW() - INTERVAL '89 days', 'gps', 99, 84),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '88 days', 'gps', 98, 85),
  ('DEV007', 47.4244, 9.3766, 669, 12, 0, 0, NOW() - INTERVAL '87 days', 'gps', 98, 82),

  -- Move to Zurich warehouse
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '86 days', 'gps', 97, 85),
  ('DEV007', 47.4200, 9.3500, 650, 10, 40, 250, NOW() - INTERVAL '86 days' + INTERVAL '15 minutes', 'gps', 97, 82),
  ('DEV007', 47.4100, 9.2500, 600, 12, 55, 245, NOW() - INTERVAL '86 days' + INTERVAL '30 minutes', 'gps', 96, 80),
  ('DEV007', 47.4000, 9.1000, 550, 10, 60, 250, NOW() - INTERVAL '86 days' + INTERVAL '45 minutes', 'gps', 96, 83),
  ('DEV007', 47.3900, 8.9000, 480, 12, 55, 255, NOW() - INTERVAL '86 days' + INTERVAL '1 hour', 'gps', 95, 85),
  ('DEV007', 47.3800, 8.7000, 450, 10, 50, 260, NOW() - INTERVAL '86 days' + INTERVAL '1 hour 15 minutes', 'gps', 95, 87),
  ('DEV007', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '86 days' + INTERVAL '1 hour 30 minutes', 'gps', 94, 90),

  -- Zurich warehouse (3 days)
  ('DEV007', 47.3769, 8.5417, 408, 10, 0, 0, NOW() - INTERVAL '85 days', 'gps', 94, 88),
  ('DEV007', 47.3770, 8.5418, 409, 12, 0, 0, NOW() - INTERVAL '84 days', 'gps', 93, 87),
  ('DEV007', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '83 days', 'gps', 93, 89),

  -- Move to Winterthur job site
  ('DEV007', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '82 days', 'gps', 92, 88),
  ('DEV007', 47.4000, 8.6000, 430, 10, 45, 45, NOW() - INTERVAL '82 days' + INTERVAL '10 minutes', 'gps', 92, 85),
  ('DEV007', 47.4300, 8.7000, 460, 12, 50, 50, NOW() - INTERVAL '82 days' + INTERVAL '20 minutes', 'gps', 91, 83),
  ('DEV007', 47.4984, 8.7240, 442, 8, 0, 0, NOW() - INTERVAL '82 days' + INTERVAL '30 minutes', 'gps', 91, 86),

  -- Winterthur job site (2 days)
  ('DEV007', 47.4984, 8.7240, 442, 10, 0, 0, NOW() - INTERVAL '81 days', 'gps', 90, 84),
  ('DEV007', 47.4985, 8.7242, 443, 12, 0, 0, NOW() - INTERVAL '80 days', 'gps', 90, 85),

  -- Return to St. Gallen
  ('DEV007', 47.4984, 8.7240, 442, 8, 0, 0, NOW() - INTERVAL '79 days', 'gps', 89, 86),
  ('DEV007', 47.4800, 8.8500, 480, 10, 50, 80, NOW() - INTERVAL '79 days' + INTERVAL '15 minutes', 'gps', 89, 83),
  ('DEV007', 47.4600, 9.0500, 550, 12, 55, 85, NOW() - INTERVAL '79 days' + INTERVAL '30 minutes', 'gps', 88, 81),
  ('DEV007', 47.4400, 9.2500, 620, 10, 50, 90, NOW() - INTERVAL '79 days' + INTERVAL '45 minutes', 'gps', 88, 82),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '79 days' + INTERVAL '1 hour', 'gps', 87, 85),

  -- Week 2-4: Similar pattern
  ('DEV007', 47.4245, 9.3767, 670, 10, 0, 0, NOW() - INTERVAL '78 days', 'gps', 100, 84),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '75 days', 'gps', 98, 85),
  ('DEV007', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '72 days', 'gps', 95, 88),
  ('DEV007', 47.3769, 8.5417, 408, 10, 0, 0, NOW() - INTERVAL '70 days', 'gps', 94, 87),
  ('DEV007', 47.4984, 8.7240, 442, 8, 0, 0, NOW() - INTERVAL '68 days', 'gps', 92, 85),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '65 days', 'gps', 100, 84),
  ('DEV007', 47.4245, 9.3767, 670, 10, 0, 0, NOW() - INTERVAL '62 days', 'gps', 98, 85);

-- MONTH 2 (60 days ago to 30 days ago)
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '60 days', 'gps', 100, 85),
  ('DEV007', 47.4246, 9.3768, 671, 10, 0, 0, NOW() - INTERVAL '58 days', 'gps', 99, 84),
  -- Trip to Chur (new job site)
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '55 days', 'gps', 97, 85),
  ('DEV007', 47.3500, 9.4500, 700, 10, 50, 160, NOW() - INTERVAL '55 days' + INTERVAL '20 minutes', 'gps', 96, 82),
  ('DEV007', 47.2000, 9.5000, 750, 12, 55, 165, NOW() - INTERVAL '55 days' + INTERVAL '40 minutes', 'gps', 95, 80),
  ('DEV007', 47.0000, 9.5200, 800, 10, 50, 170, NOW() - INTERVAL '55 days' + INTERVAL '1 hour', 'gps', 94, 78),
  ('DEV007', 46.8500, 9.5300, 585, 8, 0, 0, NOW() - INTERVAL '55 days' + INTERVAL '1 hour 20 minutes', 'gps', 94, 82),

  -- Chur job site (3 days)
  ('DEV007', 46.8500, 9.5300, 585, 10, 0, 0, NOW() - INTERVAL '54 days', 'gps', 93, 80),
  ('DEV007', 46.8502, 9.5305, 586, 12, 0, 0, NOW() - INTERVAL '53 days', 'gps', 92, 81),
  ('DEV007', 46.8500, 9.5300, 585, 8, 0, 0, NOW() - INTERVAL '52 days', 'gps', 92, 82),

  -- Return to St. Gallen
  ('DEV007', 46.8500, 9.5300, 585, 8, 0, 0, NOW() - INTERVAL '51 days', 'gps', 91, 81),
  ('DEV007', 47.0500, 9.5000, 720, 10, 55, 350, NOW() - INTERVAL '51 days' + INTERVAL '30 minutes', 'gps', 90, 79),
  ('DEV007', 47.2500, 9.4500, 680, 12, 50, 345, NOW() - INTERVAL '51 days' + INTERVAL '1 hour', 'gps', 89, 82),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '51 days' + INTERVAL '1 hour 30 minutes', 'gps', 88, 85),

  -- More week movements
  ('DEV007', 47.4245, 9.3767, 670, 10, 0, 0, NOW() - INTERVAL '48 days', 'gps', 100, 84),
  ('DEV007', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '45 days', 'gps', 96, 88),
  ('DEV007', 47.3769, 8.5417, 408, 10, 0, 0, NOW() - INTERVAL '42 days', 'gps', 94, 87),
  ('DEV007', 47.4984, 8.7240, 442, 8, 0, 0, NOW() - INTERVAL '40 days', 'gps', 92, 85),
  ('DEV007', 47.4984, 8.7240, 442, 10, 0, 0, NOW() - INTERVAL '38 days', 'gps', 91, 84),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '35 days', 'gps', 100, 85),
  ('DEV007', 47.4245, 9.3767, 670, 10, 0, 0, NOW() - INTERVAL '32 days', 'gps', 98, 84);

-- MONTH 3 (30 days ago to now) - More detailed tracking
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '30 days', 'gps', 100, 85),
  ('DEV007', 47.4246, 9.3768, 671, 10, 0, 0, NOW() - INTERVAL '29 days', 'gps', 99, 84),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '28 days', 'gps', 99, 85),

  -- Trip to Zurich with detailed tracking
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '27 days', 'gps', 98, 85),
  ('DEV007', 47.4220, 9.3600, 660, 10, 35, 250, NOW() - INTERVAL '27 days' + INTERVAL '5 minutes', 'gps', 98, 83),
  ('DEV007', 47.4180, 9.3300, 640, 12, 50, 248, NOW() - INTERVAL '27 days' + INTERVAL '10 minutes', 'gps', 97, 81),
  ('DEV007', 47.4150, 9.2800, 610, 10, 55, 252, NOW() - INTERVAL '27 days' + INTERVAL '18 minutes', 'gps', 97, 82),
  ('DEV007', 47.4100, 9.2000, 570, 12, 58, 255, NOW() - INTERVAL '27 days' + INTERVAL '28 minutes', 'gps', 96, 83),
  ('DEV007', 47.4050, 9.1000, 530, 10, 55, 258, NOW() - INTERVAL '27 days' + INTERVAL '40 minutes', 'gps', 96, 85),
  ('DEV007', 47.3950, 8.9500, 490, 12, 52, 260, NOW() - INTERVAL '27 days' + INTERVAL '52 minutes', 'gps', 95, 86),
  ('DEV007', 47.3850, 8.7800, 460, 10, 50, 262, NOW() - INTERVAL '27 days' + INTERVAL '1 hour 5 minutes', 'gps', 95, 87),
  ('DEV007', 47.3800, 8.6500, 430, 12, 48, 265, NOW() - INTERVAL '27 days' + INTERVAL '1 hour 18 minutes', 'gps', 94, 88),
  ('DEV007', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '27 days' + INTERVAL '1 hour 30 minutes', 'gps', 94, 90),

  -- Zurich warehouse (4 days)
  ('DEV007', 47.3769, 8.5417, 408, 10, 0, 0, NOW() - INTERVAL '26 days', 'gps', 93, 89),
  ('DEV007', 47.3770, 8.5418, 409, 12, 0, 0, NOW() - INTERVAL '25 days', 'gps', 92, 88),
  ('DEV007', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '24 days', 'gps', 92, 89),
  ('DEV007', 47.3768, 8.5416, 407, 10, 0, 0, NOW() - INTERVAL '23 days', 'gps', 91, 88),

  -- Move to Winterthur
  ('DEV007', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '22 days', 'gps', 91, 89),
  ('DEV007', 47.4100, 8.6200, 435, 10, 45, 50, NOW() - INTERVAL '22 days' + INTERVAL '10 minutes', 'gps', 90, 86),
  ('DEV007', 47.4500, 8.6800, 450, 12, 50, 55, NOW() - INTERVAL '22 days' + INTERVAL '20 minutes', 'gps', 90, 84),
  ('DEV007', 47.4984, 8.7240, 442, 8, 0, 0, NOW() - INTERVAL '22 days' + INTERVAL '30 minutes', 'gps', 89, 86),

  -- Winterthur (3 days)
  ('DEV007', 47.4984, 8.7240, 442, 10, 0, 0, NOW() - INTERVAL '21 days', 'gps', 89, 85),
  ('DEV007', 47.4985, 8.7242, 443, 12, 0, 0, NOW() - INTERVAL '20 days', 'gps', 88, 84),
  ('DEV007', 47.4984, 8.7240, 442, 8, 0, 0, NOW() - INTERVAL '19 days', 'gps', 88, 86),

  -- Return to St. Gallen with detailed tracking
  ('DEV007', 47.4984, 8.7240, 442, 8, 0, 0, NOW() - INTERVAL '18 days', 'gps', 87, 85),
  ('DEV007', 47.4900, 8.8000, 470, 10, 45, 80, NOW() - INTERVAL '18 days' + INTERVAL '8 minutes', 'gps', 87, 83),
  ('DEV007', 47.4800, 8.9000, 510, 12, 52, 82, NOW() - INTERVAL '18 days' + INTERVAL '18 minutes', 'gps', 86, 81),
  ('DEV007', 47.4700, 9.0200, 560, 10, 50, 85, NOW() - INTERVAL '18 days' + INTERVAL '30 minutes', 'gps', 86, 82),
  ('DEV007', 47.4600, 9.1500, 600, 12, 48, 88, NOW() - INTERVAL '18 days' + INTERVAL '42 minutes', 'gps', 85, 83),
  ('DEV007', 47.4450, 9.2800, 640, 10, 45, 90, NOW() - INTERVAL '18 days' + INTERVAL '55 minutes', 'gps', 85, 84),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '18 days' + INTERVAL '1 hour 10 minutes', 'gps', 84, 85),

  -- St. Gallen (rest of month with periodic checks)
  ('DEV007', 47.4245, 9.3767, 670, 10, 0, 0, NOW() - INTERVAL '17 days', 'gps', 100, 85),
  ('DEV007', 47.4246, 9.3768, 671, 12, 0, 0, NOW() - INTERVAL '16 days', 'gps', 99, 84),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '15 days', 'gps', 99, 85),
  ('DEV007', 47.4244, 9.3766, 669, 10, 0, 0, NOW() - INTERVAL '14 days', 'gps', 98, 84),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '13 days', 'gps', 98, 85),
  ('DEV007', 47.4245, 9.3767, 670, 10, 0, 0, NOW() - INTERVAL '12 days', 'gps', 97, 84),
  ('DEV007', 47.4246, 9.3768, 671, 12, 0, 0, NOW() - INTERVAL '11 days', 'gps', 97, 83),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '10 days', 'gps', 96, 85);

-- Last 10 days with very detailed tracking
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '9 days', 'gps', 96, 84),
  ('DEV007', 47.4246, 9.3768, 671, 10, 0, 0, NOW() - INTERVAL '8 days', 'gps', 95, 85),

  -- Quick trip to Zurich and back
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '7 days', 'gps', 95, 85),
  ('DEV007', 47.4100, 9.1500, 580, 10, 55, 255, NOW() - INTERVAL '7 days' + INTERVAL '25 minutes', 'gps', 94, 82),
  ('DEV007', 47.3900, 8.8500, 470, 12, 58, 260, NOW() - INTERVAL '7 days' + INTERVAL '50 minutes', 'gps', 93, 85),
  ('DEV007', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '7 days' + INTERVAL '1 hour 20 minutes', 'gps', 92, 90),
  ('DEV007', 47.3769, 8.5417, 408, 10, 0, 0, NOW() - INTERVAL '7 days' + INTERVAL '3 hours', 'gps', 91, 89),
  ('DEV007', 47.3900, 8.8500, 470, 12, 55, 80, NOW() - INTERVAL '7 days' + INTERVAL '3 hours 30 minutes', 'gps', 90, 85),
  ('DEV007', 47.4100, 9.1500, 580, 10, 52, 85, NOW() - INTERVAL '7 days' + INTERVAL '4 hours', 'gps', 89, 82),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '7 days' + INTERVAL '4 hours 30 minutes', 'gps', 88, 85),

  ('DEV007', 47.4245, 9.3767, 670, 10, 0, 0, NOW() - INTERVAL '6 days', 'gps', 100, 85),
  ('DEV007', 47.4246, 9.3768, 671, 12, 0, 0, NOW() - INTERVAL '5 days', 'gps', 99, 84),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '4 days', 'gps', 99, 85),
  ('DEV007', 47.4244, 9.3766, 669, 10, 0, 0, NOW() - INTERVAL '3 days', 'gps', 98, 84),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '2 days', 'gps', 98, 85),
  ('DEV007', 47.4246, 9.3769, 672, 10, 3, 30, NOW() - INTERVAL '2 days' + INTERVAL '4 hours', 'gps', 97, 84),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '2 days' + INTERVAL '6 hours', 'gps', 97, 85),
  ('DEV007', 47.4245, 9.3767, 670, 10, 0, 0, NOW() - INTERVAL '1 day', 'gps', 96, 84),
  ('DEV007', 47.4246, 9.3768, 671, 12, 0, 0, NOW() - INTERVAL '1 day' + INTERVAL '6 hours', 'gps', 96, 83),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '12 hours', 'gps', 95, 85),
  ('DEV007', 47.4244, 9.3766, 669, 10, 0, 0, NOW() - INTERVAL '6 hours', 'gps', 95, 84),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '3 hours', 'gps', 94, 85),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '1 hour', 'gps', 94, 85);

-- Update devices to have current battery status reflecting usage
-- Note: status values must be lowercase to match constraint
UPDATE "sim-card-portal-v2".devices
SET battery_level = 54, status = 'offline', last_seen = NOW() - INTERVAL '1 hour'
WHERE id = 'DEV003';

UPDATE "sim-card-portal-v2".devices
SET battery_level = 0, status = 'inactive', last_seen = NOW() - INTERVAL '1 hour'
WHERE id = 'DEV007';

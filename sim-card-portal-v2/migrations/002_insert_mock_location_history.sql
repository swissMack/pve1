-- Migration: Insert mock location history data for Swiss devices
-- This generates realistic route data for devices traveling in Switzerland

-- Helper function to generate timestamps for the last 30 days
-- DEV003 (Vehicle Tracker): Zurich → Bern → Geneva → Basel → Zurich (circular route)
-- Generate route points every 30 minutes over 7 days

-- Day 1: Zurich to Bern (120 km, ~4 hours)
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  ('DEV003', 47.3769, 8.5417, 408, 10, 0, 0, NOW() - INTERVAL '7 days', 'gps', 100, 85),
  ('DEV003', 47.4000, 8.5000, 450, 12, 85, 270, NOW() - INTERVAL '7 days' + INTERVAL '30 minutes', 'gps', 99, 88),
  ('DEV003', 47.4300, 8.4500, 480, 15, 95, 280, NOW() - INTERVAL '7 days' + INTERVAL '1 hour', 'gps', 98, 90),
  ('DEV003', 47.4600, 8.3800, 520, 10, 110, 285, NOW() - INTERVAL '7 days' + INTERVAL '1 hour 30 minutes', 'gps', 97, 87),
  ('DEV003', 47.0000, 7.7500, 540, 12, 100, 250, NOW() - INTERVAL '7 days' + INTERVAL '2 hours', 'gps', 96, 85),
  ('DEV003', 46.9500, 7.4500, 560, 15, 90, 245, NOW() - INTERVAL '7 days' + INTERVAL '2 hours 30 minutes', 'gps', 95, 88),
  ('DEV003', 46.9480, 7.4474, 542, 8, 0, 0, NOW() - INTERVAL '7 days' + INTERVAL '4 hours', 'gps', 94, 92);

-- Day 2: Bern to Geneva (160 km, ~5 hours)
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  ('DEV003', 46.9480, 7.4474, 542, 10, 0, 0, NOW() - INTERVAL '6 days', 'gps', 93, 90),
  ('DEV003', 46.9000, 7.3000, 580, 12, 95, 220, NOW() - INTERVAL '6 days' + INTERVAL '30 minutes', 'gps', 92, 87),
  ('DEV003', 46.8000, 7.1000, 620, 15, 105, 215, NOW() - INTERVAL '6 days' + INTERVAL '1 hour', 'gps', 91, 85),
  ('DEV003', 46.7000, 6.9000, 650, 10, 110, 210, NOW() - INTERVAL '6 days' + INTERVAL '1 hour 30 minutes', 'gps', 90, 88),
  ('DEV003', 46.5000, 6.7000, 480, 12, 100, 205, NOW() - INTERVAL '6 days' + INTERVAL '2 hours 30 minutes', 'gps', 88, 90),
  ('DEV003', 46.3000, 6.4000, 420, 15, 95, 200, NOW() - INTERVAL '6 days' + INTERVAL '3 hours 30 minutes', 'gps', 86, 92),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '6 days' + INTERVAL '5 hours', 'gps', 85, 95);

-- Day 3-4: Geneva area (local movement)
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  ('DEV003', 46.2044, 6.1432, 375, 10, 0, 0, NOW() - INTERVAL '5 days', 'gps', 84, 93),
  ('DEV003', 46.2100, 6.1500, 380, 12, 30, 45, NOW() - INTERVAL '5 days' + INTERVAL '2 hours', 'gps', 83, 92),
  ('DEV003', 46.2044, 6.1432, 375, 8, 0, 0, NOW() - INTERVAL '5 days' + INTERVAL '4 hours', 'gps', 82, 90),
  ('DEV003', 46.1900, 6.1300, 370, 10, 25, 180, NOW() - INTERVAL '4 days' + INTERVAL '1 hour', 'gps', 81, 88);

-- Day 5: Geneva to Basel (280 km, ~7 hours)
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  ('DEV003', 46.2044, 6.1432, 375, 10, 0, 0, NOW() - INTERVAL '3 days', 'gps', 80, 85),
  ('DEV003', 46.5000, 6.5000, 450, 12, 100, 45, NOW() - INTERVAL '3 days' + INTERVAL '1 hour', 'gps', 78, 87),
  ('DEV003', 46.8000, 6.9000, 520, 15, 110, 50, NOW() - INTERVAL '3 days' + INTERVAL '2 hours', 'gps', 76, 90),
  ('DEV003', 47.0000, 7.2000, 550, 10, 105, 55, NOW() - INTERVAL '3 days' + INTERVAL '3 hours', 'gps', 74, 88),
  ('DEV003', 47.2000, 7.4000, 480, 12, 95, 60, NOW() - INTERVAL '3 days' + INTERVAL '4 hours', 'gps', 72, 85),
  ('DEV003', 47.4000, 7.5000, 420, 15, 90, 65, NOW() - INTERVAL '3 days' + INTERVAL '5 hours', 'gps', 70, 87),
  ('DEV003', 47.5596, 7.5886, 260, 8, 0, 0, NOW() - INTERVAL '3 days' + INTERVAL '7 hours', 'gps', 68, 92);

-- Day 6: Basel to Zurich (90 km, ~3 hours)
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  ('DEV003', 47.5596, 7.5886, 260, 10, 0, 0, NOW() - INTERVAL '2 days', 'gps', 67, 90),
  ('DEV003', 47.5500, 7.7000, 320, 12, 100, 90, NOW() - INTERVAL '2 days' + INTERVAL '30 minutes', 'gps', 66, 88),
  ('DEV003', 47.5000, 7.9000, 380, 15, 110, 95, NOW() - INTERVAL '2 days' + INTERVAL '1 hour', 'gps', 65, 85),
  ('DEV003', 47.4500, 8.1000, 420, 10, 105, 100, NOW() - INTERVAL '2 days' + INTERVAL '1 hour 30 minutes', 'gps', 64, 87),
  ('DEV003', 47.4000, 8.3000, 450, 12, 95, 105, NOW() - INTERVAL '2 days' + INTERVAL '2 hours', 'gps', 63, 90),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '2 days' + INTERVAL '3 hours', 'gps', 62, 92);

-- Day 7: Zurich area (stationary with minimal drift)
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  ('DEV003', 47.3769, 8.5417, 408, 10, 0, 0, NOW() - INTERVAL '1 day', 'gps', 61, 90),
  ('DEV003', 47.3770, 8.5418, 409, 15, 0, 0, NOW() - INTERVAL '1 day' + INTERVAL '6 hours', 'gps', 60, 88),
  ('DEV003', 47.3768, 8.5416, 407, 12, 0, 0, NOW() - INTERVAL '12 hours', 'gps', 59, 85);

-- DEV007 (Asset Tracker): Local movements in St. Gallen area
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  ('DEV007', 47.4245, 9.3767, 670, 10, 0, 0, NOW() - INTERVAL '7 days', 'gps', 88, 82),
  ('DEV007', 47.4250, 9.3770, 672, 12, 15, 45, NOW() - INTERVAL '7 days' + INTERVAL '1 hour', 'gps', 88, 80),
  ('DEV007', 47.4260, 9.3780, 675, 15, 20, 90, NOW() - INTERVAL '7 days' + INTERVAL '2 hours', 'gps', 87, 78),
  ('DEV007', 47.4240, 9.3790, 668, 10, 10, 180, NOW() - INTERVAL '7 days' + INTERVAL '3 hours', 'gps', 87, 81),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '7 days' + INTERVAL '4 hours', 'gps', 86, 83),
  ('DEV007', 47.4255, 9.3775, 673, 12, 18, 60, NOW() - INTERVAL '6 days', 'gps', 86, 80),
  ('DEV007', 47.4265, 9.3785, 677, 15, 22, 75, NOW() - INTERVAL '6 days' + INTERVAL '1 hour', 'gps', 85, 79),
  ('DEV007', 47.4270, 9.3790, 680, 10, 12, 120, NOW() - INTERVAL '6 days' + INTERVAL '2 hours', 'gps', 85, 82),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '6 days' + INTERVAL '3 hours', 'gps', 84, 85),
  ('DEV007', 47.4245, 9.3767, 670, 10, 0, 0, NOW() - INTERVAL '5 days', 'gps', 84, 83),
  ('DEV007', 47.4248, 9.3772, 671, 12, 8, 30, NOW() - INTERVAL '4 days', 'gps', 83, 81),
  ('DEV007', 47.4242, 9.3765, 669, 10, 10, 200, NOW() - INTERVAL '3 days', 'gps', 82, 80),
  ('DEV007', 47.4245, 9.3767, 670, 8, 0, 0, NOW() - INTERVAL '2 days', 'gps', 81, 82),
  ('DEV007', 47.4245, 9.3767, 670, 10, 0, 0, NOW() - INTERVAL '1 day', 'gps', 80, 85);

-- DEV001 (IoT Sensor): Stationary in Zurich with GPS drift
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  ('DEV001', 47.3769, 8.5417, 408, 20, 0, 0, NOW() - INTERVAL '30 days', 'gps', 100, 85),
  ('DEV001', 47.3770, 8.5418, 409, 25, 0, 0, NOW() - INTERVAL '25 days', 'gps', 95, 83),
  ('DEV001', 47.3768, 8.5416, 407, 22, 0, 0, NOW() - INTERVAL '20 days', 'gps', 90, 84),
  ('DEV001', 47.3769, 8.5417, 408, 18, 0, 0, NOW() - INTERVAL '15 days', 'gps', 88, 86),
  ('DEV001', 47.3771, 8.5419, 410, 24, 0, 0, NOW() - INTERVAL '10 days', 'gps', 87, 82),
  ('DEV001', 47.3768, 8.5415, 406, 21, 0, 0, NOW() - INTERVAL '5 days', 'gps', 86, 85),
  ('DEV001', 47.3769, 8.5417, 408, 19, 0, 0, NOW() - INTERVAL '1 day', 'gps', 85, 85);

-- DEV002 (Smart Gateway): Stationary in Geneva with minimal movement
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  ('DEV002', 46.2044, 6.1432, 375, 15, 0, 0, NOW() - INTERVAL '30 days', 'gps', 100, 92),
  ('DEV002', 46.2045, 6.1433, 376, 18, 0, 0, NOW() - INTERVAL '25 days', 'gps', 98, 90),
  ('DEV002', 46.2043, 6.1431, 374, 16, 0, 0, NOW() - INTERVAL '20 days', 'gps', 96, 91),
  ('DEV002', 46.2044, 6.1432, 375, 14, 0, 0, NOW() - INTERVAL '15 days', 'gps', 94, 93),
  ('DEV002', 46.2046, 6.1434, 377, 17, 0, 0, NOW() - INTERVAL '10 days', 'gps', 93, 92),
  ('DEV002', 46.2044, 6.1432, 375, 15, 0, 0, NOW() - INTERVAL '5 days', 'gps', 92, 94),
  ('DEV002', 46.2044, 6.1432, 375, 13, 0, 0, NOW() - INTERVAL '1 day', 'gps', 92, 92);

-- Add more frequent data points for the last 24 hours for DEV003
INSERT INTO "sim-card-portal-v2".device_location_history (device_id, latitude, longitude, altitude, accuracy, speed, heading, recorded_at, location_source, battery_level, signal_strength)
VALUES
  ('DEV003', 47.3769, 8.5417, 408, 10, 0, 0, NOW() - INTERVAL '24 hours', 'gps', 58, 85),
  ('DEV003', 47.3770, 8.5420, 410, 12, 5, 30, NOW() - INTERVAL '23 hours', 'gps', 58, 87),
  ('DEV003', 47.3775, 8.5425, 415, 10, 8, 45, NOW() - INTERVAL '22 hours', 'gps', 58, 88),
  ('DEV003', 47.3780, 8.5430, 420, 12, 10, 60, NOW() - INTERVAL '21 hours', 'gps', 57, 86),
  ('DEV003', 47.3785, 8.5435, 425, 10, 0, 0, NOW() - INTERVAL '20 hours', 'gps', 57, 85),
  ('DEV003', 47.3783, 8.5433, 423, 12, 6, 200, NOW() - INTERVAL '19 hours', 'gps', 57, 87),
  ('DEV003', 47.3778, 8.5428, 418, 10, 7, 210, NOW() - INTERVAL '18 hours', 'gps', 56, 88),
  ('DEV003', 47.3772, 8.5422, 412, 12, 5, 220, NOW() - INTERVAL '17 hours', 'gps', 56, 86),
  ('DEV003', 47.3769, 8.5417, 408, 10, 0, 0, NOW() - INTERVAL '16 hours', 'gps', 56, 85),
  ('DEV003', 47.3769, 8.5418, 409, 10, 0, 0, NOW() - INTERVAL '12 hours', 'gps', 55, 84),
  ('DEV003', 47.3768, 8.5416, 407, 12, 0, 0, NOW() - INTERVAL '8 hours', 'gps', 55, 85),
  ('DEV003', 47.3769, 8.5417, 408, 10, 0, 0, NOW() - INTERVAL '4 hours', 'gps', 55, 86),
  ('DEV003', 47.3769, 8.5417, 408, 8, 0, 0, NOW() - INTERVAL '1 hour', 'gps', 54, 85);

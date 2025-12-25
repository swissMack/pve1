-- Migration: Insert 3 months of sensor history data for all devices
-- Each device has realistic sensor patterns based on its type and location

-- Clear existing sensor history data to avoid duplicates
DELETE FROM "sim-card-portal-v2".device_sensor_history;

-- ============================================================================
-- DEV001: IoT Sensor Alpha - Cold Storage Temperature Sensor (Zurich Warehouse)
-- Pattern: Cold storage (-5°C to 2°C), high humidity, low light
-- Readings every 15 minutes for 3 months
-- ============================================================================

-- Generate 3 months of cold storage data with daily temperature cycles
-- Slight variations based on door openings and defrost cycles
INSERT INTO "sim-card-portal-v2".device_sensor_history (device_id, temperature, humidity, light, recorded_at, battery_level, signal_strength)
SELECT
  'DEV001',
  -- Temperature: -5 to 2°C with daily cycles and random defrost spikes
  CASE
    WHEN EXTRACT(HOUR FROM ts) BETWEEN 8 AND 17 THEN -2.5 + (random() * 2) + sin(EXTRACT(HOUR FROM ts) * 0.5) * 1.5  -- Daytime warmer due to door openings
    ELSE -4.0 + (random() * 1.5)  -- Nighttime stable cold
  END +
  CASE WHEN random() < 0.02 THEN 5.0 ELSE 0 END,  -- Occasional defrost cycle spike
  -- Humidity: 60-75% typical for cold storage
  65 + (random() * 10) - 5 + sin(EXTRACT(HOUR FROM ts) * 0.3) * 3,
  -- Light: Low (0-200 lux), higher during working hours
  CASE
    WHEN EXTRACT(HOUR FROM ts) BETWEEN 7 AND 19 THEN 80 + (random() * 120)
    ELSE 5 + (random() * 15)
  END,
  ts,
  -- Battery: Slowly decreasing over time with recharges
  GREATEST(20, 100 - (EXTRACT(EPOCH FROM (NOW() - ts)) / 86400 * 0.3)::int % 80),
  80 + (random() * 15)::int
FROM generate_series(
  NOW() - INTERVAL '90 days',
  NOW(),
  INTERVAL '15 minutes'
) AS ts;

-- ============================================================================
-- DEV002: Smart Gateway Beta - Office Gateway (Geneva Office)
-- Pattern: Office environment (20-26°C), moderate humidity, variable light
-- Readings every 30 minutes
-- ============================================================================

INSERT INTO "sim-card-portal-v2".device_sensor_history (device_id, temperature, humidity, light, recorded_at, battery_level, signal_strength)
SELECT
  'DEV002',
  -- Temperature: 20-26°C office with HVAC cycles
  22 + sin(EXTRACT(HOUR FROM ts) * 0.4) * 2 + (random() * 2) - 1 +
  CASE
    WHEN EXTRACT(DOW FROM ts) IN (0, 6) THEN -2  -- Cooler on weekends
    ELSE 0
  END,
  -- Humidity: 40-55% controlled office environment
  45 + sin(EXTRACT(HOUR FROM ts) * 0.3) * 5 + (random() * 6) - 3,
  -- Light: High during office hours, low otherwise
  CASE
    WHEN EXTRACT(DOW FROM ts) IN (0, 6) THEN 50 + (random() * 100)  -- Weekend minimal
    WHEN EXTRACT(HOUR FROM ts) BETWEEN 8 AND 18 THEN 350 + (random() * 200)  -- Office hours
    ELSE 20 + (random() * 50)  -- Night
  END,
  ts,
  -- Gateway always powered
  95 + (random() * 5)::int,
  88 + (random() * 10)::int
FROM generate_series(
  NOW() - INTERVAL '90 days',
  NOW(),
  INTERVAL '30 minutes'
) AS ts;

-- ============================================================================
-- DEV004: Security Camera Delta - Outdoor Entrance (Bern Entrance Gate)
-- Pattern: Outdoor temps (-5 to 30°C seasonal), variable humidity, high light variance
-- Readings every 20 minutes
-- ============================================================================

INSERT INTO "sim-card-portal-v2".device_sensor_history (device_id, temperature, humidity, light, recorded_at, battery_level, signal_strength)
SELECT
  'DEV004',
  -- Temperature: Outdoor seasonal variation
  -- Base temp around 10°C with daily cycle and some warming trend as we approach summer
  10 +
  (EXTRACT(EPOCH FROM ts - (NOW() - INTERVAL '90 days')) / 86400 * 0.15) +  -- Seasonal warming
  sin(EXTRACT(HOUR FROM ts) * 0.26) * 8 +  -- Daily cycle (warmer midday)
  (random() * 4) - 2,
  -- Humidity: 30-80% varying with weather
  55 + sin(EXTRACT(DAY FROM ts) * 0.5) * 20 + (random() * 15) - 7.5,
  -- Light: Very high variance - 0 at night, up to 80000 lux in direct sun
  CASE
    WHEN EXTRACT(HOUR FROM ts) BETWEEN 6 AND 20 THEN
      (200 + sin((EXTRACT(HOUR FROM ts) - 6) * 0.4) * 600) * (0.5 + random() * 0.5)
    ELSE 0
  END,
  ts,
  70 + (random() * 25)::int,
  75 + (random() * 20)::int
FROM generate_series(
  NOW() - INTERVAL '90 days',
  NOW(),
  INTERVAL '20 minutes'
) AS ts;

-- ============================================================================
-- DEV005: Environmental Monitor Epsilon - Data Center (Lausanne Data Center)
-- Pattern: Very stable temps (18-22°C), low humidity (30-45%), controlled light
-- Critical monitoring - readings every 5 minutes
-- ============================================================================

INSERT INTO "sim-card-portal-v2".device_sensor_history (device_id, temperature, humidity, light, recorded_at, battery_level, signal_strength)
SELECT
  'DEV005',
  -- Temperature: Very stable 18-22°C with occasional hot spot alerts
  20 + (random() * 2) - 1 +
  CASE WHEN random() < 0.01 THEN 3 + random() * 2 ELSE 0 END,  -- Rare hot spot
  -- Humidity: Low and controlled 30-45%
  38 + (random() * 7) - 3.5,
  -- Light: Consistent artificial lighting
  280 + (random() * 40) - 20,
  ts,
  -- Always powered via UPS
  100,
  90 + (random() * 8)::int
FROM generate_series(
  NOW() - INTERVAL '90 days',
  NOW(),
  INTERVAL '5 minutes'
) AS ts;

-- ============================================================================
-- DEV006: Smart Meter Zeta - Building Utility (Lucerne Building 12)
-- Pattern: Indoor utility room, stable temps, low humidity, minimal light
-- Readings every hour
-- ============================================================================

INSERT INTO "sim-card-portal-v2".device_sensor_history (device_id, temperature, humidity, light, recorded_at, battery_level, signal_strength)
SELECT
  'DEV006',
  -- Temperature: Utility room 18-28°C, warmer when equipment running
  22 +
  CASE
    WHEN EXTRACT(HOUR FROM ts) BETWEEN 9 AND 21 THEN 4  -- Warmer during usage hours
    ELSE 0
  END +
  (random() * 3) - 1.5,
  -- Humidity: 40-60%
  50 + (random() * 10) - 5,
  -- Light: Very low, only when accessed
  CASE
    WHEN random() < 0.05 THEN 200 + (random() * 100)  -- Occasional access
    ELSE 10 + (random() * 20)
  END,
  ts,
  85 + (random() * 12)::int,
  82 + (random() * 15)::int
FROM generate_series(
  NOW() - INTERVAL '90 days',
  NOW(),
  INTERVAL '1 hour'
) AS ts;

-- ============================================================================
-- DEV008: Industrial Controller Theta - Factory Floor (Lugano Factory)
-- Pattern: Industrial environment (15-35°C), variable humidity, bright lighting
-- High-frequency readings every 10 minutes
-- ============================================================================

INSERT INTO "sim-card-portal-v2".device_sensor_history (device_id, temperature, humidity, light, recorded_at, battery_level, signal_strength)
SELECT
  'DEV008',
  -- Temperature: Factory floor 15-35°C, hot near machinery
  25 +
  CASE
    WHEN EXTRACT(DOW FROM ts) IN (0, 6) THEN -8  -- Weekend shutdown cooler
    WHEN EXTRACT(HOUR FROM ts) BETWEEN 6 AND 22 THEN
      sin((EXTRACT(HOUR FROM ts) - 6) * 0.2) * 5  -- Heats up during production
    ELSE -3
  END +
  (random() * 4) - 2,
  -- Humidity: 35-55% industrial
  42 + (random() * 13) - 6.5,
  -- Light: Bright industrial lighting during operations
  CASE
    WHEN EXTRACT(DOW FROM ts) IN (0, 6) THEN 50 + (random() * 50)  -- Weekend minimal
    WHEN EXTRACT(HOUR FROM ts) BETWEEN 6 AND 22 THEN 450 + (random() * 150)  -- Production
    ELSE 80 + (random() * 40)  -- Night shift minimal
  END,
  ts,
  88 + (random() * 10)::int,
  85 + (random() * 12)::int
FROM generate_series(
  NOW() - INTERVAL '90 days',
  NOW(),
  INTERVAL '10 minutes'
) AS ts;

-- ============================================================================
-- DEV003: Vehicle Tracker Gamma - Fleet Vehicle (Basel Fleet Depot)
-- Pattern: Vehicle interior temps (varies with outside), moderate humidity
-- Readings tied to vehicle activity
-- ============================================================================

INSERT INTO "sim-card-portal-v2".device_sensor_history (device_id, temperature, humidity, light, recorded_at, battery_level, signal_strength)
SELECT
  'DEV003',
  -- Temperature: Vehicle interior, varies greatly
  CASE
    WHEN EXTRACT(DOW FROM ts) IN (0, 6) THEN
      12 + sin(EXTRACT(HOUR FROM ts) * 0.26) * 8 + (random() * 4) - 2  -- Parked weekend
    WHEN EXTRACT(HOUR FROM ts) BETWEEN 7 AND 18 THEN
      20 + (random() * 6) - 3  -- Climate controlled during work hours
    ELSE
      10 + sin(EXTRACT(HOUR FROM ts) * 0.26) * 6 + (random() * 4) - 2  -- Parked overnight
  END,
  -- Humidity: 40-70%
  55 + (random() * 15) - 7.5,
  -- Light: Varies with driving/parked
  CASE
    WHEN EXTRACT(HOUR FROM ts) BETWEEN 6 AND 20 THEN
      100 + (random() * 400)  -- Daytime
    ELSE
      5 + (random() * 30)  -- Night
  END,
  ts,
  -- Battery tied to vehicle
  CASE
    WHEN EXTRACT(DOW FROM ts) IN (0, 6) THEN 50 + (random() * 20)::int  -- Weekend drain
    ELSE 75 + (random() * 20)::int  -- Weekday charging
  END,
  70 + (random() * 25)::int
FROM generate_series(
  NOW() - INTERVAL '90 days',
  NOW(),
  INTERVAL '30 minutes'
) AS ts;

-- ============================================================================
-- DEV007: Asset Tracker Eta - Warehouse Equipment (St. Gallen Storage)
-- Pattern: Warehouse environment, stable temps, low activity
-- Readings every 2 hours (battery saving mode)
-- ============================================================================

INSERT INTO "sim-card-portal-v2".device_sensor_history (device_id, temperature, humidity, light, recorded_at, battery_level, signal_strength)
SELECT
  'DEV007',
  -- Temperature: Warehouse 15-25°C
  18 +
  CASE
    WHEN EXTRACT(HOUR FROM ts) BETWEEN 10 AND 16 THEN 4  -- Afternoon warmer
    ELSE 0
  END +
  (random() * 3) - 1.5,
  -- Humidity: 50-70% warehouse
  58 + (random() * 12) - 6,
  -- Light: Warehouse lighting during hours
  CASE
    WHEN EXTRACT(HOUR FROM ts) BETWEEN 7 AND 18 THEN 150 + (random() * 100)
    ELSE 10 + (random() * 20)
  END,
  ts,
  -- Battery slowly draining
  GREATEST(10, 95 - (EXTRACT(EPOCH FROM (NOW() - ts)) / 86400 * 0.8)::int % 85),
  72 + (random() * 18)::int
FROM generate_series(
  NOW() - INTERVAL '90 days',
  NOW(),
  INTERVAL '2 hours'
) AS ts;

-- Create a summary of inserted records
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'Sensor history data inserted successfully:';
  FOR rec IN
    SELECT device_id, COUNT(*) as record_count,
           MIN(recorded_at) as earliest,
           MAX(recorded_at) as latest
    FROM "sim-card-portal-v2".device_sensor_history
    GROUP BY device_id
    ORDER BY device_id
  LOOP
    RAISE NOTICE 'Device %: % records from % to %',
      rec.device_id, rec.record_count, rec.earliest, rec.latest;
  END LOOP;
END $$;

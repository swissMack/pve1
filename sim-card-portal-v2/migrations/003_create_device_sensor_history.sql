-- Migration: Create device_sensor_history table for sensor data tracking
-- This table stores historical sensor readings (temperature, humidity, light) for devices

CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".device_sensor_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR NOT NULL REFERENCES "sim-card-portal-v2".devices(id) ON DELETE CASCADE,
  temperature NUMERIC(5, 2),      -- Temperature in Celsius
  humidity NUMERIC(5, 2),          -- Humidity percentage (0-100)
  light NUMERIC(10, 2),            -- Light level in lux
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  battery_level INTEGER,           -- Battery at time of recording (0-100)
  signal_strength INTEGER,         -- Signal strength at time of recording (0-100)
  notes TEXT,
  metadata JSONB,                  -- Additional flexible data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_device_sensor_device_id 
  ON "sim-card-portal-v2".device_sensor_history(device_id);

CREATE INDEX IF NOT EXISTS idx_device_sensor_recorded_at 
  ON "sim-card-portal-v2".device_sensor_history(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_sensor_device_time 
  ON "sim-card-portal-v2".device_sensor_history(device_id, recorded_at DESC);

-- Add comments to table for documentation
COMMENT ON TABLE "sim-card-portal-v2".device_sensor_history IS 
  'Historical sensor data (temperature, humidity, light) for devices to enable trend analysis and visualization';

COMMENT ON COLUMN "sim-card-portal-v2".device_sensor_history.temperature IS 
  'Temperature reading in degrees Celsius';

COMMENT ON COLUMN "sim-card-portal-v2".device_sensor_history.humidity IS 
  'Relative humidity percentage (0-100)';

COMMENT ON COLUMN "sim-card-portal-v2".device_sensor_history.light IS 
  'Ambient light level in lux';

COMMENT ON COLUMN "sim-card-portal-v2".device_sensor_history.recorded_at IS 
  'Timestamp when the sensor readings were recorded by the device';

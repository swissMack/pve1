-- Migration: Create device_location_history table for GPS route tracking
-- This table stores historical location data for devices to enable route visualization

CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".device_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR NOT NULL REFERENCES "sim-card-portal-v2".devices(id) ON DELETE CASCADE,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  altitude NUMERIC(10, 2),        -- optional elevation in meters
  accuracy NUMERIC(10, 2),        -- GPS accuracy in meters
  speed NUMERIC(10, 2),           -- Speed in km/h
  heading NUMERIC(5, 2),          -- Direction 0-360 degrees
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location_source VARCHAR(50),    -- 'gps', 'cell_tower', 'wifi', 'manual'
  battery_level INTEGER,          -- Battery at time of recording (0-100)
  signal_strength INTEGER,        -- Signal strength at time of recording (0-100)
  notes TEXT,
  metadata JSONB,                 -- Additional flexible data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_device_location_device_id 
  ON "sim-card-portal-v2".device_location_history(device_id);

CREATE INDEX IF NOT EXISTS idx_device_location_recorded_at 
  ON "sim-card-portal-v2".device_location_history(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_location_device_time 
  ON "sim-card-portal-v2".device_location_history(device_id, recorded_at DESC);

-- Add comment to table for documentation
COMMENT ON TABLE "sim-card-portal-v2".device_location_history IS 
  'Historical GPS location data for devices to enable route tracking and visualization';

COMMENT ON COLUMN "sim-card-portal-v2".device_location_history.latitude IS 
  'Latitude coordinate in decimal degrees (e.g., 47.3769 for Zurich)';

COMMENT ON COLUMN "sim-card-portal-v2".device_location_history.longitude IS 
  'Longitude coordinate in decimal degrees (e.g., 8.5417 for Zurich)';

COMMENT ON COLUMN "sim-card-portal-v2".device_location_history.recorded_at IS 
  'Timestamp when the location was recorded by the device';

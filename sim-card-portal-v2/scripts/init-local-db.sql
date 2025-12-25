-- Local PostgreSQL initialization script for sim-card-portal-v2
-- Run this against a local PostgreSQL instance (Docker)

-- Create schema
CREATE SCHEMA IF NOT EXISTS "sim-card-portal-v2";

-- Set search path
SET search_path TO "sim-card-portal-v2", public;

-- Create device_types table
CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".device_types (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create locations table
CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".locations (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  address TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sim_cards table
CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".sim_cards (
  id VARCHAR PRIMARY KEY,
  iccid VARCHAR NOT NULL UNIQUE,
  msisdn VARCHAR,
  status VARCHAR(20) CHECK (status IN ('Active', 'Inactive', 'Suspended', 'Terminated')),
  carrier VARCHAR,
  plan VARCHAR,
  data_used VARCHAR,
  data_limit VARCHAR,
  activation_date DATE,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create devices table
CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".devices (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'maintenance', 'offline')),
  sim_card_id VARCHAR REFERENCES "sim-card-portal-v2".sim_cards(id),
  device_type_id VARCHAR REFERENCES "sim-card-portal-v2".device_types(id),
  location_id VARCHAR REFERENCES "sim-card-portal-v2".locations(id),
  last_seen TIMESTAMPTZ,
  signal_strength INTEGER,
  data_usage_mb NUMERIC(10, 2),
  connection_type VARCHAR(10) CHECK (connection_type IN ('3g', '4g', '5g', 'wifi')),
  firmware_version VARCHAR,
  hardware_version VARCHAR,
  serial_number VARCHAR,
  manufacturer VARCHAR,
  model VARCHAR,
  notes TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  test1 VARCHAR(20) CHECK (test1 IN ('value1', 'value2')),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  temperature NUMERIC(10, 2),
  humidity NUMERIC(10, 2),
  light NUMERIC(10, 2),
  sensor_sampling_interval INTEGER DEFAULT 15,  -- Sampling interval in minutes
  health_status VARCHAR(20) CHECK (health_status IN ('healthy', 'warning', 'critical', 'unknown')),
  battery_level INTEGER,
  security_status VARCHAR(20) CHECK (security_status IN ('secure', 'vulnerable', 'compromised', 'unknown')),
  asset_management_url VARCHAR,
  supplier_device_url VARCHAR,
  user_manual_url VARCHAR,
  specification_base64 TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create device_location_history table
CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".device_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR NOT NULL REFERENCES "sim-card-portal-v2".devices(id) ON DELETE CASCADE,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  altitude NUMERIC(10, 2),
  accuracy NUMERIC(10, 2),
  speed NUMERIC(10, 2),
  heading NUMERIC(5, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location_source VARCHAR(50),
  battery_level INTEGER,
  signal_strength INTEGER,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for location history performance
CREATE INDEX IF NOT EXISTS idx_device_location_device_id
  ON "sim-card-portal-v2".device_location_history(device_id);

CREATE INDEX IF NOT EXISTS idx_device_location_recorded_at
  ON "sim-card-portal-v2".device_location_history(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_location_device_time
  ON "sim-card-portal-v2".device_location_history(device_id, recorded_at DESC);

-- Create device_sensor_history table
CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".device_sensor_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR NOT NULL REFERENCES "sim-card-portal-v2".devices(id) ON DELETE CASCADE,
  temperature NUMERIC(10, 2),
  humidity NUMERIC(10, 2),
  light NUMERIC(10, 2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  battery_level INTEGER,
  signal_strength INTEGER,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for sensor history performance
CREATE INDEX IF NOT EXISTS idx_device_sensor_device_id
  ON "sim-card-portal-v2".device_sensor_history(device_id);

CREATE INDEX IF NOT EXISTS idx_device_sensor_recorded_at
  ON "sim-card-portal-v2".device_sensor_history(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_sensor_device_time
  ON "sim-card-portal-v2".device_sensor_history(device_id, recorded_at DESC);

-- Insert device types
INSERT INTO "sim-card-portal-v2".device_types (id, name, description) VALUES
  ('DT001', 'Temperature Sensor', 'Environmental temperature monitoring sensor'),
  ('DT002', 'Gateway', 'Network gateway device for IoT communication'),
  ('DT003', 'GPS Tracker', 'GPS-enabled tracking device'),
  ('DT004', 'IP Camera', 'Internet protocol security camera'),
  ('DT005', 'Environmental Sensor', 'Multi-parameter environmental monitoring'),
  ('DT006', 'Utility Meter', 'Smart utility metering device'),
  ('DT007', 'Asset Tracker', 'Asset tracking and inventory device'),
  ('DT008', 'PLC Controller', 'Programmable logic controller')
ON CONFLICT (id) DO NOTHING;

-- Insert locations
INSERT INTO "sim-card-portal-v2".locations (id, name, latitude, longitude) VALUES
  ('LOC001', 'Zurich Warehouse', 47.3769, 8.5417),
  ('LOC002', 'Geneva Office', 46.2044, 6.1432),
  ('LOC003', 'Basel Fleet Depot', 47.5596, 7.5886),
  ('LOC004', 'Bern Entrance Gate', 46.9480, 7.4474),
  ('LOC005', 'Lausanne Data Center', 46.5197, 6.6323),
  ('LOC006', 'Lucerne Building 12', 47.0502, 8.3093),
  ('LOC007', 'St. Gallen Storage', 47.4245, 9.3767),
  ('LOC008', 'Lugano Factory', 46.0037, 8.9511)
ON CONFLICT (id) DO NOTHING;

-- Insert SIM cards
INSERT INTO "sim-card-portal-v2".sim_cards (id, iccid, msisdn, status, carrier, plan, data_used, data_limit, activation_date, expiry_date) VALUES
  ('SIM001', '8901234567890123456', '+1234567890', 'Active', 'Global Wireless', 'IoT Basic 10MB', '2.4 MB', '10 MB', '2023-12-01', '2024-12-01'),
  ('SIM002', '8901234567890123457', '+1234567891', 'Active', 'TechConnect', 'Enterprise 100MB', '15.7 MB', '100 MB', '2023-11-15', '2024-11-15'),
  ('SIM003', '8901234567890123458', '+1234567892', 'Active', 'MobileNet', 'Fleet Tracker 50MB', '8.3 MB', '50 MB', '2023-10-20', '2024-10-20'),
  ('SIM004', '8901234567890123459', '+1234567893', 'Active', 'SecureLink', 'Security Pro 200MB', '45.2 MB', '200 MB', '2023-09-10', '2024-09-10'),
  ('SIM005', '8901234567890123460', '+1234567894', 'Suspended', 'DataFlow', 'Environmental 25MB', '1.8 MB', '25 MB', '2023-08-05', '2024-08-05'),
  ('SIM006', '8901234567890123461', '+1234567895', 'Active', 'UtilityConnect', 'Smart Meter 15MB', '3.6 MB', '15 MB', '2023-07-12', '2024-07-12'),
  ('SIM007', '8901234567890123462', '+1234567896', 'Inactive', 'AssetTrack', 'Asset Basic 5MB', '0.9 MB', '5 MB', '2023-06-18', '2024-06-18'),
  ('SIM008', '8901234567890123463', '+1234567897', 'Active', 'IndustrialNet', 'Industrial Pro 500MB', '12.4 MB', '500 MB', '2023-05-25', '2024-05-25'),
  ('SIM009', '8901234567890123464', '+1234567898', 'Terminated', 'Legacy Wireless', 'Standard 20MB', '0 MB', '20 MB', '2023-01-10', '2024-01-10'),
  ('SIM010', '8901234567890123465', '+1234567899', 'Active', 'NextGen Mobile', 'Premium 1GB', '234.5 MB', '1024 MB', '2023-04-03', '2024-04-03')
ON CONFLICT (id) DO NOTHING;

-- Insert devices
INSERT INTO "sim-card-portal-v2".devices (id, name, status, sim_card_id, device_type_id, location_id, last_seen, signal_strength, data_usage_mb, connection_type, test1, description, latitude, longitude, temperature, humidity, light, sensor_sampling_interval, health_status, battery_level, security_status, asset_management_url, supplier_device_url, user_manual_url) VALUES
  ('DEV001', 'IoT Sensor Alpha', 'active', 'SIM001', 'DT001', 'LOC001', '2024-01-15 14:30:22', 85, 2.4, '4g', 'value1', 'High-precision temperature monitoring sensor for cold storage applications.', 47.3769, 8.5417, -2.5, 65, 125, 15, 'healthy', 85, 'secure', 'https://example.com/assets/DEV001', 'https://supplier.com/devices/iot-sensor-alpha', 'https://docs.example.com/manuals/iot-sensor-alpha.pdf'),
  ('DEV002', 'Smart Gateway Beta', 'active', 'SIM002', 'DT002', 'LOC002', '2024-01-15 14:29:15', 92, 15.7, '5g', 'value2', 'Central communication hub connecting multiple IoT devices to the network.', 46.2044, 6.1432, 22.5, 45, 450, 30, 'healthy', 92, 'secure', 'https://example.com/assets/DEV002', 'https://supplier.com/devices/smart-gateway-beta', 'https://docs.example.com/manuals/smart-gateway-beta.pdf'),
  ('DEV003', 'Vehicle Tracker Gamma', 'offline', 'SIM003', 'DT003', 'LOC003', '2024-01-15 12:45:33', 0, 8.3, '4g', 'value1', 'Fleet vehicle tracking device with GPS positioning and route optimization.', 47.5596, 7.5886, 18.2, 55, 0, 30, 'critical', 15, 'unknown', 'https://example.com/assets/DEV003', 'https://supplier.com/devices/vehicle-tracker-gamma', 'https://docs.example.com/manuals/vehicle-tracker-gamma.pdf'),
  ('DEV004', 'Security Camera Delta', 'active', 'SIM004', 'DT004', 'LOC004', '2024-01-15 14:31:05', 78, 45.2, '4g', 'value2', 'High-definition security camera with night vision and motion detection.', 46.9480, 7.4474, 25.1, 40, 320, 20, 'healthy', 78, 'secure', 'https://example.com/assets/DEV004', 'https://supplier.com/devices/security-camera-delta', 'https://docs.example.com/manuals/security-camera-delta.pdf'),
  ('DEV005', 'Environmental Monitor Epsilon', 'maintenance', 'SIM005', 'DT005', 'LOC005', '2024-01-15 09:15:44', 65, 1.8, '3g', 'value1', 'Multi-parameter environmental monitoring system for data center climate control.', 46.5197, 6.6323, 20.8, 35, 280, 5, 'warning', 45, 'secure', 'https://example.com/assets/DEV005', 'https://supplier.com/devices/environmental-monitor-epsilon', 'https://docs.example.com/manuals/environmental-monitor-epsilon.pdf'),
  ('DEV006', 'Smart Meter Zeta', 'active', 'SIM006', 'DT006', 'LOC006', '2024-01-15 14:28:12', 88, 3.6, '4g', 'value2', 'Advanced utility meter for accurate electricity consumption monitoring.', 47.0502, 8.3093, 23.5, 50, 150, 60, 'healthy', 88, 'secure', 'https://example.com/assets/DEV006', 'https://supplier.com/devices/smart-meter-zeta', 'https://docs.example.com/manuals/smart-meter-zeta.pdf'),
  ('DEV007', 'Asset Tracker Eta', 'inactive', 'SIM007', 'DT007', 'LOC007', '2024-01-14 16:22:18', 0, 0.9, '4g', 'value1', 'Compact asset tracking device for inventory management and theft prevention.', 47.4245, 9.3767, 19.5, 60, 75, 120, 'unknown', 0, 'unknown', 'https://example.com/assets/DEV007', 'https://supplier.com/devices/asset-tracker-eta', 'https://docs.example.com/manuals/asset-tracker-eta.pdf'),
  ('DEV008', 'Industrial Controller Theta', 'active', 'SIM008', 'DT008', 'LOC008', '2024-01-15 14:30:45', 91, 12.4, '5g', 'value2', 'Programmable logic controller for industrial automation and process control.', 46.0037, 8.9511, 28.2, 42, 520, 10, 'healthy', 91, 'secure', 'https://example.com/assets/DEV008', 'https://supplier.com/devices/industrial-controller-theta', 'https://docs.example.com/manuals/industrial-controller-theta.pdf')
ON CONFLICT (id) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Schema, tables, and initial data created successfully!';
END $$;

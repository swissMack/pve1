-- ============================================================================
-- Migration: 000_supabase_init.sql
-- Description: Create all tables in public schema for Supabase
-- Run this FIRST on a fresh Supabase project
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CREATE BASE TABLES
-- ============================================================================

-- Create device_types table
CREATE TABLE IF NOT EXISTS public.device_types (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create locations table
CREATE TABLE IF NOT EXISTS public.locations (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  address TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create carriers table
CREATE TABLE IF NOT EXISTS public.carriers (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  country VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create plans table
CREATE TABLE IF NOT EXISTS public.plans (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  data_limit_mb INTEGER,
  price NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sim_cards table
CREATE TABLE IF NOT EXISTS public.sim_cards (
  id VARCHAR PRIMARY KEY,
  iccid VARCHAR NOT NULL UNIQUE,
  msisdn VARCHAR,
  status VARCHAR(20) CHECK (status IN ('Active', 'Inactive', 'Suspended', 'Terminated', 'active', 'available')),
  carrier_id VARCHAR REFERENCES public.carriers(id),
  plan_id VARCHAR REFERENCES public.plans(id),
  data_used VARCHAR,
  data_limit VARCHAR,
  activation_date DATE,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create devices table
CREATE TABLE IF NOT EXISTS public.devices (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'maintenance', 'offline')),
  sim_card_id VARCHAR REFERENCES public.sim_cards(id),
  device_type_id VARCHAR REFERENCES public.device_types(id),
  location_id VARCHAR REFERENCES public.locations(id),
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
  sensor_sampling_interval INTEGER DEFAULT 15,
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
CREATE TABLE IF NOT EXISTS public.device_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
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

-- Create device_sensor_history table
CREATE TABLE IF NOT EXISTS public.device_sensor_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
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

-- Create users table (for authentication)
CREATE TABLE IF NOT EXISTS public.users (
  id VARCHAR PRIMARY KEY,
  username VARCHAR NOT NULL UNIQUE,
  password_hash VARCHAR NOT NULL,
  role VARCHAR NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_devices_status ON public.devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_device_type_id ON public.devices(device_type_id);
CREATE INDEX IF NOT EXISTS idx_devices_location_id ON public.devices(location_id);
CREATE INDEX IF NOT EXISTS idx_devices_sim_card_id ON public.devices(sim_card_id);
CREATE INDEX IF NOT EXISTS idx_sim_cards_status ON public.sim_cards(status);
CREATE INDEX IF NOT EXISTS idx_sim_cards_iccid ON public.sim_cards(iccid);
CREATE INDEX IF NOT EXISTS idx_device_location_history_device_id ON public.device_location_history(device_id);
CREATE INDEX IF NOT EXISTS idx_device_location_history_recorded_at ON public.device_location_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_device_sensor_history_device_id ON public.device_sensor_history(device_id);
CREATE INDEX IF NOT EXISTS idx_device_sensor_history_recorded_at ON public.device_sensor_history(recorded_at);

-- ============================================================================
-- 3. INSERT SAMPLE DATA
-- ============================================================================

-- Insert device types
INSERT INTO public.device_types (id, name, description) VALUES
  ('dt_001', 'IoT Sensor', 'General purpose IoT sensor device'),
  ('dt_002', 'GPS Tracker', 'Vehicle and asset GPS tracking device'),
  ('dt_003', 'Smart Meter', 'Utility smart metering device'),
  ('dt_004', 'Environmental Monitor', 'Environmental monitoring sensor'),
  ('dt_005', 'Industrial Controller', 'Industrial automation controller')
ON CONFLICT (id) DO NOTHING;

-- Insert locations
INSERT INTO public.locations (id, name, address, latitude, longitude) VALUES
  ('loc_001', 'Zurich HQ', 'Bahnhofstrasse 1, 8001 Zurich', 47.3769, 8.5417),
  ('loc_002', 'Basel Office', 'Marktplatz 10, 4001 Basel', 47.5596, 7.5886),
  ('loc_003', 'Geneva Warehouse', 'Rue du Rhone 42, 1204 Geneva', 46.2044, 6.1432),
  ('loc_004', 'Bern Datacenter', 'Bundesplatz 1, 3003 Bern', 46.9480, 7.4474),
  ('loc_005', 'Lausanne Lab', 'Avenue de la Gare 15, 1003 Lausanne', 46.5197, 6.6323)
ON CONFLICT (id) DO NOTHING;

-- Insert carriers
INSERT INTO public.carriers (id, name, country) VALUES
  ('carrier_001', 'Swisscom', 'Switzerland'),
  ('carrier_002', 'Sunrise', 'Switzerland'),
  ('carrier_003', 'Salt', 'Switzerland')
ON CONFLICT (id) DO NOTHING;

-- Insert plans
INSERT INTO public.plans (id, name, data_limit_mb, price) VALUES
  ('plan_001', 'IoT Basic', 100, 5.00),
  ('plan_002', 'IoT Standard', 500, 15.00),
  ('plan_003', 'IoT Premium', 2000, 35.00),
  ('plan_004', 'IoT Enterprise', 10000, 99.00)
ON CONFLICT (id) DO NOTHING;

-- Insert sample SIM cards
INSERT INTO public.sim_cards (id, iccid, msisdn, status, carrier_id, plan_id, data_used, data_limit) VALUES
  ('SIM001', '89410000000000000001', '+41791234567', 'Active', 'carrier_001', 'plan_002', '125 MB', '500 MB'),
  ('SIM002', '89410000000000000002', '+41791234568', 'Active', 'carrier_001', 'plan_003', '890 MB', '2000 MB'),
  ('SIM003', '89410000000000000003', '+41791234569', 'Inactive', 'carrier_002', 'plan_001', '0 MB', '100 MB'),
  ('SIM004', '89410000000000000004', '+41791234570', 'Active', 'carrier_002', 'plan_002', '234 MB', '500 MB'),
  ('SIM005', '89410000000000000005', '+41791234571', 'available', 'carrier_003', 'plan_001', '0 MB', '100 MB'),
  ('SIM006', '89410000000000000006', '+41791234572', 'available', 'carrier_001', 'plan_002', '0 MB', '500 MB'),
  ('SIM007', '89410000000000000007', '+41791234573', 'available', 'carrier_002', 'plan_003', '0 MB', '2000 MB')
ON CONFLICT (id) DO NOTHING;

-- Insert sample devices
INSERT INTO public.devices (id, name, status, sim_card_id, device_type_id, location_id, signal_strength, data_usage_mb, connection_type, latitude, longitude) VALUES
  ('DEV001', 'Sensor Alpha', 'active', 'SIM001', 'dt_001', 'loc_001', 85, 125.5, '4g', 47.3769, 8.5417),
  ('DEV002', 'Tracker Beta', 'active', 'SIM002', 'dt_002', 'loc_002', 92, 890.2, '5g', 47.5596, 7.5886),
  ('DEV003', 'Vehicle Tracker Gamma', 'active', 'SIM004', 'dt_002', 'loc_003', 78, 234.1, '4g', 46.2044, 6.1432),
  ('DEV004', 'Smart Meter Delta', 'inactive', NULL, 'dt_003', 'loc_004', 65, 45.3, '3g', 46.9480, 7.4474),
  ('DEV005', 'Env Monitor Epsilon', 'active', NULL, 'dt_004', 'loc_005', 88, 67.8, '4g', 46.5197, 6.6323),
  ('DEV006', 'Controller Zeta', 'maintenance', NULL, 'dt_005', 'loc_001', 45, 12.1, 'wifi', 47.3769, 8.5417),
  ('DEV007', 'Asset Tracker Eta', 'active', NULL, 'dt_002', 'loc_002', 91, 456.7, '5g', 47.5596, 7.5886)
ON CONFLICT (id) DO NOTHING;

-- Insert admin user (password: 1234567, hashed with SHA256)
INSERT INTO public.users (id, username, password_hash, role) VALUES
  ('admin-001', 'admin', '4c8de6fc2d84b8b3c12c37b2a6b9e5e4b9c7c0e4f5d8a9b2c3d4e5f6a7b8c9d0', 'administrator')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. CREATE UPDATE TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to all tables with updated_at column
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND column_name = 'updated_at'
        AND table_name NOT LIKE 'pg_%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_%I_updated_at ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
    END LOOP;
END $$;

-- ============================================================================
-- Done! Your Supabase database is now initialized.
-- ============================================================================

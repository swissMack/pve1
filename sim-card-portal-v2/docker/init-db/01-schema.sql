-- ============================================================================
-- SIM Card Portal - Complete Database Schema
-- Auto-runs on container first start via docker-entrypoint-initdb.d
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  token VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Carriers
CREATE TABLE IF NOT EXISTS carriers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  country VARCHAR(50),
  logo_url VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plans
CREATE TABLE IF NOT EXISTS plans (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  carrier_id VARCHAR(50) REFERENCES carriers(id),
  data_limit_gb NUMERIC(10,2),
  price NUMERIC(10,2),
  currency VARCHAR(3) DEFAULT 'CHF',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(255),
  city VARCHAR(100),
  country VARCHAR(50),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device types
CREATE TABLE IF NOT EXISTS device_types (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  icon VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SIM Cards
CREATE TABLE IF NOT EXISTS sim_cards (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'sim_' || encode(gen_random_bytes(8), 'hex'),
  iccid VARCHAR(20) UNIQUE NOT NULL,
  imsi VARCHAR(15),
  msisdn VARCHAR(20),
  carrier_id VARCHAR(50) REFERENCES carriers(id),
  plan_id VARCHAR(50) REFERENCES plans(id),
  status VARCHAR(20) DEFAULT 'Inactive',
  activation_date DATE,
  expiry_date DATE,
  data_usage_bytes BIGINT DEFAULT 0,
  data_limit_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Devices
CREATE TABLE IF NOT EXISTS devices (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'dev_' || encode(gen_random_bytes(8), 'hex'),
  name VARCHAR(100) NOT NULL,
  device_type_id VARCHAR(50) REFERENCES device_types(id),
  sim_card_id VARCHAR(50) REFERENCES sim_cards(id),
  location_id VARCHAR(50) REFERENCES locations(id),
  status VARCHAR(20) DEFAULT 'Offline',
  last_seen TIMESTAMPTZ,
  signal_strength INTEGER,
  battery_level INTEGER,
  firmware_version VARCHAR(50),
  specification_base64 TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device location history
CREATE TABLE IF NOT EXISTS device_location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(50) REFERENCES devices(id),
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  altitude NUMERIC(10,2),
  speed NUMERIC(10,2),
  heading NUMERIC(5,2),
  accuracy NUMERIC(10,2),
  location_source VARCHAR(50),
  battery_level INTEGER,
  signal_strength INTEGER,
  metadata JSONB,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device sensor history
CREATE TABLE IF NOT EXISTS device_sensor_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(50) REFERENCES devices(id),
  temperature NUMERIC(5,2),
  humidity NUMERIC(5,2),
  pressure NUMERIC(10,2),
  battery_voltage NUMERIC(5,3),
  signal_rssi INTEGER,
  light NUMERIC(10,2),
  battery_level INTEGER,
  signal_strength INTEGER,
  metadata JSONB,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CONSUMPTION & BILLING TABLES
-- ============================================================================

-- Usage aggregations (monthly)
CREATE TABLE IF NOT EXISTS usage_aggregations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  carrier_id VARCHAR(50) REFERENCES carriers(id),
  total_data_bytes BIGINT DEFAULT 0,
  total_cost NUMERIC(12,2) DEFAULT 0,
  active_sim_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily usage
CREATE TABLE IF NOT EXISTS daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_date DATE NOT NULL,
  carrier_id VARCHAR(50) REFERENCES carriers(id),
  data_bytes BIGINT DEFAULT 0,
  cost NUMERIC(10,2) DEFAULT 0,
  active_sim_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage records (CDR data)
CREATE TABLE IF NOT EXISTS usage_records (
  id SERIAL PRIMARY KEY,
  record_id VARCHAR(100) NOT NULL UNIQUE,
  iccid VARCHAR(20) NOT NULL,
  sim_id VARCHAR(50),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  data_upload_bytes BIGINT DEFAULT 0,
  data_download_bytes BIGINT DEFAULT 0,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  sms_count INT DEFAULT 0,
  voice_seconds INT DEFAULT 0,
  source VARCHAR(100),
  batch_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'PROCESSED',
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage cycles (billing periods)
CREATE TABLE IF NOT EXISTS usage_cycles (
  id SERIAL PRIMARY KEY,
  sim_id VARCHAR(50),
  iccid VARCHAR(20) NOT NULL,
  cycle_id VARCHAR(20) NOT NULL,
  cycle_start TIMESTAMPTZ NOT NULL,
  cycle_end TIMESTAMPTZ NOT NULL,
  total_upload_bytes BIGINT DEFAULT 0,
  total_download_bytes BIGINT DEFAULT 0,
  total_bytes BIGINT DEFAULT 0,
  sms_count INT DEFAULT 0,
  voice_seconds INT DEFAULT 0,
  is_current BOOLEAN DEFAULT true,
  archived_at TIMESTAMPTZ,
  final_usage JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  carrier_id VARCHAR(50) REFERENCES carriers(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CHF',
  status VARCHAR(20) DEFAULT 'pending',
  due_date DATE,
  paid_date DATE,
  pdf_url VARCHAR(255),
  erpnext_reference VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SETTINGS TABLES
-- ============================================================================

-- App settings (key-value store)
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(255)
);

-- Exchange rates
CREATE TABLE IF NOT EXISTS exchange_rates (
  id SERIAL PRIMARY KEY,
  base_currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  target_currency VARCHAR(3) NOT NULL,
  rate NUMERIC(18,8) NOT NULL,
  rate_date DATE NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_rate_per_day UNIQUE(base_currency, target_currency, rate_date)
);

-- LLM conversations
CREATE TABLE IF NOT EXISTS llm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  chart_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sim_cards_iccid ON sim_cards(iccid);
CREATE INDEX IF NOT EXISTS idx_sim_cards_status ON sim_cards(status);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_device_location_history_device ON device_location_history(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_sensor_history_device ON device_sensor_history(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_usage_date ON daily_usage(usage_date);
CREATE INDEX IF NOT EXISTS idx_daily_usage_carrier ON daily_usage(carrier_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_usage_records_iccid ON usage_records(iccid);
CREATE INDEX IF NOT EXISTS idx_usage_records_period ON usage_records(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_usage_cycles_iccid ON usage_cycles(iccid);
CREATE INDEX IF NOT EXISTS idx_usage_cycles_cycle ON usage_cycles(cycle_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Stub aggregation function (no-op for this deployment)
CREATE OR REPLACE FUNCTION aggregate_usage_to_daily()
RETURNS INTEGER AS $$
BEGIN
  RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Additional columns for consumption API compatibility
ALTER TABLE sim_cards ADD COLUMN IF NOT EXISTS data_used VARCHAR(50);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);

-- ============================================================================
-- SPRINT 3: ASSET MANAGEMENT & GEOZONES
-- ============================================================================

-- Asset status enum
DO $$ BEGIN
  CREATE TYPE asset_status AS ENUM ('at_facility', 'in_transit', 'at_supplier', 'at_customer', 'unknown', 'stored');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  customer_id UUID,
  project_id UUID,
  device_id VARCHAR(50) REFERENCES devices(id) UNIQUE,
  name VARCHAR(255) NOT NULL,
  asset_type VARCHAR(100),
  barcode VARCHAR(100) UNIQUE,
  birth_date DATE,
  composition JSONB,
  recycled_content NUMERIC(5,4) DEFAULT 0,
  trip_count INTEGER DEFAULT 0,
  last_trip_date TIMESTAMPTZ,
  current_status asset_status DEFAULT 'unknown',
  certification_status VARCHAR(100),
  compliance_expiry DATE,
  labels JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assets_tenant ON assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assets_customer ON assets(customer_id);
CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_device ON assets(device_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(current_status);
CREATE INDEX IF NOT EXISTS idx_assets_barcode ON assets(barcode);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(asset_type);

-- Zone type enum
DO $$ BEGIN
  CREATE TYPE zone_type AS ENUM ('warehouse', 'supplier', 'customer', 'transit_hub', 'restricted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Geozones table
CREATE TABLE IF NOT EXISTS geozones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  customer_id UUID,
  name VARCHAR(255) NOT NULL,
  zone_type zone_type DEFAULT 'warehouse',
  geometry GEOMETRY(POLYGON, 4326),
  center_lat NUMERIC(10,7),
  center_lng NUMERIC(10,7),
  radius_meters INTEGER,
  address VARCHAR(500),
  owner_name VARCHAR(255),
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  operating_hours JSONB,
  is_active BOOLEAN DEFAULT true,
  hysteresis_meters INTEGER DEFAULT 50,
  color VARCHAR(7) DEFAULT '#137fec',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_geozones_tenant ON geozones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_geozones_customer ON geozones(customer_id);
CREATE INDEX IF NOT EXISTS idx_geozones_geometry ON geozones USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_geozones_active ON geozones(is_active);

-- Geozone event type enum
DO $$ BEGIN
  CREATE TYPE geozone_event_type AS ENUM ('zone_enter', 'zone_exit', 'zone_dwell');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trip status enum
DO $$ BEGIN
  CREATE TYPE trip_status AS ENUM ('in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Geozone events table
CREATE TABLE IF NOT EXISTS geozone_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  geozone_id UUID NOT NULL REFERENCES geozones(id),
  device_id VARCHAR(50) REFERENCES devices(id),
  event_type geozone_event_type NOT NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geozone_events_asset ON geozone_events(asset_id);
CREATE INDEX IF NOT EXISTS idx_geozone_events_geozone ON geozone_events(geozone_id);
CREATE INDEX IF NOT EXISTS idx_geozone_events_device ON geozone_events(device_id);
CREATE INDEX IF NOT EXISTS idx_geozone_events_type ON geozone_events(event_type);
CREATE INDEX IF NOT EXISTS idx_geozone_events_occurred ON geozone_events(occurred_at DESC);

-- Asset trips table
CREATE TABLE IF NOT EXISTS asset_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  origin_geozone_id UUID REFERENCES geozones(id),
  destination_geozone_id UUID REFERENCES geozones(id),
  departed_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  status trip_status DEFAULT 'in_progress',
  distance_km NUMERIC(10,2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_trips_asset ON asset_trips(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_trips_origin ON asset_trips(origin_geozone_id);
CREATE INDEX IF NOT EXISTS idx_asset_trips_destination ON asset_trips(destination_geozone_id);
CREATE INDEX IF NOT EXISTS idx_asset_trips_status ON asset_trips(status);

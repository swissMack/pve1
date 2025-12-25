-- Migration: Exchange Rates and App Settings Tables
-- Purpose: Store ECB exchange rates for currency conversion and global app settings

-- =====================================================
-- Exchange Rates Table
-- Stores daily exchange rates from European Central Bank
-- Base currency is always EUR
-- =====================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id SERIAL PRIMARY KEY,
  base_currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  target_currency VARCHAR(3) NOT NULL,
  rate NUMERIC(18, 8) NOT NULL,
  rate_date DATE NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_rate_per_day UNIQUE(base_currency, target_currency, rate_date)
);

-- Index for fast lookups by currency and date
CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup
  ON exchange_rates(target_currency, rate_date DESC);

-- Comment on table
COMMENT ON TABLE exchange_rates IS 'Daily exchange rates from ECB. Base currency is EUR.';

-- =====================================================
-- App Settings Table
-- Stores global application settings as key-value pairs
-- =====================================================
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(255) DEFAULT NULL
);

-- Comment on table
COMMENT ON TABLE app_settings IS 'Global application settings. Key-value store with JSONB values.';

-- Insert default display currency (EUR as base)
INSERT INTO app_settings (key, value)
VALUES ('display_currency', '"EUR"')
ON CONFLICT (key) DO NOTHING;

-- Insert default for tracking when rates were last fetched
INSERT INTO app_settings (key, value)
VALUES ('exchange_rates_last_fetched', 'null')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- Helper function to get current exchange rate
-- =====================================================
CREATE OR REPLACE FUNCTION get_exchange_rate(
  p_target_currency VARCHAR(3),
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC AS $$
DECLARE
  v_rate NUMERIC(18, 8);
BEGIN
  -- EUR to EUR is always 1
  IF p_target_currency = 'EUR' THEN
    RETURN 1.0;
  END IF;

  -- Get the most recent rate for the target currency on or before the given date
  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE target_currency = p_target_currency
    AND rate_date <= p_date
  ORDER BY rate_date DESC
  LIMIT 1;

  -- Return rate or 1.0 if not found (fallback to no conversion)
  RETURN COALESCE(v_rate, 1.0);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Helper function to convert EUR to target currency
-- =====================================================
CREATE OR REPLACE FUNCTION convert_from_eur(
  p_amount NUMERIC,
  p_target_currency VARCHAR(3),
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC AS $$
BEGIN
  RETURN p_amount * get_exchange_rate(p_target_currency, p_date);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (for Supabase)
GRANT SELECT, INSERT, UPDATE ON exchange_rates TO authenticated;
GRANT SELECT, INSERT, UPDATE ON app_settings TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE exchange_rates_id_seq TO authenticated;

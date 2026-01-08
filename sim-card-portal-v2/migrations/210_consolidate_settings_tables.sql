-- ============================================================================
-- MIGRATION: Consolidate Settings Tables in Supabase
-- Run this in Supabase SQL Editor to ensure all required tables exist
-- This migration is idempotent and safe to run multiple times
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. APP SETTINGS TABLE
-- Stores application-wide settings like display currency
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(255) DEFAULT NULL
);

COMMENT ON TABLE app_settings IS 'Global application settings. Key-value store with JSONB values.';

-- Insert default settings if not exists
INSERT INTO app_settings (key, value)
VALUES ('display_currency', '"EUR"')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value)
VALUES ('exchange_rates_last_fetched', 'null')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. EXCHANGE RATES TABLE
-- Stores daily exchange rates from ECB (base currency: EUR)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id SERIAL PRIMARY KEY,
  base_currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  target_currency VARCHAR(3) NOT NULL,
  rate NUMERIC(18, 8) NOT NULL,
  rate_date DATE NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_rate_per_day UNIQUE(base_currency, target_currency, rate_date)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_lookup
  ON exchange_rates(target_currency, rate_date DESC);

COMMENT ON TABLE exchange_rates IS 'Daily exchange rates from ECB. Base currency is EUR.';

-- ============================================================================
-- 3. LLM CONVERSATIONS TABLE
-- Stores Ask Bob chat history for session persistence
-- ============================================================================
CREATE TABLE IF NOT EXISTS llm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  chart_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_conversations_session
  ON llm_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_llm_conversations_created
  ON llm_conversations(created_at DESC);

COMMENT ON TABLE llm_conversations IS 'Chat history for Ask Bob AI feature. Stores messages per session.';

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Function to get exchange rate for a currency
CREATE OR REPLACE FUNCTION get_exchange_rate(
  p_target_currency VARCHAR(3),
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC AS $$
DECLARE
  v_rate NUMERIC(18, 8);
BEGIN
  IF p_target_currency = 'EUR' THEN
    RETURN 1.0;
  END IF;

  SELECT rate INTO v_rate
  FROM exchange_rates
  WHERE target_currency = p_target_currency
    AND rate_date <= p_date
  ORDER BY rate_date DESC
  LIMIT 1;

  RETURN COALESCE(v_rate, 1.0);
END;
$$ LANGUAGE plpgsql;

-- Function to convert from EUR to target currency
CREATE OR REPLACE FUNCTION convert_from_eur(
  p_amount NUMERIC,
  p_target_currency VARCHAR(3),
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC AS $$
BEGIN
  RETURN p_amount * get_exchange_rate(p_target_currency, p_date);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Allow service role access" ON app_settings;
DROP POLICY IF EXISTS "Allow service role access" ON exchange_rates;
DROP POLICY IF EXISTS "Allow service role access" ON llm_conversations;

DROP POLICY IF EXISTS "Allow authenticated access" ON app_settings;
DROP POLICY IF EXISTS "Allow authenticated access" ON exchange_rates;
DROP POLICY IF EXISTS "Allow authenticated access" ON llm_conversations;

-- Service role has full access
CREATE POLICY "Allow service role access" ON app_settings
  FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role access" ON exchange_rates
  FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role access" ON llm_conversations
  FOR ALL TO service_role USING (true);

-- Authenticated users have full access
CREATE POLICY "Allow authenticated access" ON app_settings
  FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON exchange_rates
  FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON llm_conversations
  FOR ALL TO authenticated USING (true);

-- ============================================================================
-- 6. GRANTS
-- ============================================================================

-- Grant access to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON app_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON exchange_rates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON llm_conversations TO authenticated;

-- Grant sequence access
GRANT USAGE, SELECT ON SEQUENCE exchange_rates_id_seq TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 210: Settings tables consolidated successfully.';
  RAISE NOTICE 'Tables created/verified: app_settings, exchange_rates, llm_conversations';
END $$;

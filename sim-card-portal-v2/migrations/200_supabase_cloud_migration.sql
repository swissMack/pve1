-- ============================================================================
-- SUPABASE MIGRATION: Missing Tables for SIM Card Portal
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. APP SETTINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(255) DEFAULT NULL
);

COMMENT ON TABLE app_settings IS 'Global application settings. Key-value store with JSONB values.';

-- Insert defaults
INSERT INTO app_settings (key, value)
VALUES ('display_currency', '"EUR"')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value)
VALUES ('exchange_rates_last_fetched', 'null')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 2. EXCHANGE RATES TABLE
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
-- 3. PROVISIONED SIMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS provisioned_sims (
    sim_id VARCHAR(50) PRIMARY KEY DEFAULT 'sim_' || encode(gen_random_bytes(12), 'hex'),
    iccid VARCHAR(20) NOT NULL UNIQUE,
    imsi VARCHAR(15) NOT NULL,
    msisdn VARCHAR(20) NOT NULL,
    imei VARCHAR(15),
    puk1 VARCHAR(255),
    puk2 VARCHAR(255),
    pin1 VARCHAR(255),
    pin2 VARCHAR(255),
    ki TEXT,
    opc TEXT,
    apn VARCHAR(255) NOT NULL,
    rate_plan_id VARCHAR(100) NOT NULL,
    data_limit_bytes BIGINT,
    billing_account_id VARCHAR(100) NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PROVISIONED'
        CHECK (status IN ('PROVISIONED', 'ACTIVE', 'INACTIVE', 'BLOCKED')),
    previous_status VARCHAR(20),
    block_reason VARCHAR(50),
    block_notes TEXT,
    blocked_at TIMESTAMPTZ,
    blocked_by VARCHAR(20),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_provisioned_sims_iccid ON provisioned_sims(iccid);
CREATE INDEX IF NOT EXISTS idx_provisioned_sims_imsi ON provisioned_sims(imsi);
CREATE INDEX IF NOT EXISTS idx_provisioned_sims_msisdn ON provisioned_sims(msisdn);
CREATE INDEX IF NOT EXISTS idx_provisioned_sims_status ON provisioned_sims(status);
CREATE INDEX IF NOT EXISTS idx_provisioned_sims_customer ON provisioned_sims(customer_id);

COMMENT ON TABLE provisioned_sims IS 'SIM cards provisioned via external Provisioning API.';

-- ============================================================================
-- 4. API CLIENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_clients (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'client_' || encode(gen_random_bytes(8), 'hex'),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    api_key_hash VARCHAR(255) NOT NULL,
    api_key_prefix VARCHAR(8) NOT NULL,
    permissions JSONB DEFAULT '[]',
    rate_limit_override JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_clients_prefix ON api_clients(api_key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_clients_active ON api_clients(is_active) WHERE is_active = true;

-- ============================================================================
-- 5. WEBHOOKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhooks (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'wh_' || encode(gen_random_bytes(12), 'hex'),
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,
    secret_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'FAILED')),
    failure_count INT DEFAULT 0,
    client_id VARCHAR(50) REFERENCES api_clients(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_delivery_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_client ON webhooks(client_id);

-- ============================================================================
-- 6. WEBHOOK DELIVERIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(50) NOT NULL DEFAULT 'evt_' || encode(gen_random_bytes(12), 'hex'),
    event_type VARCHAR(50) NOT NULL,
    webhook_id VARCHAR(50) NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED', 'ABANDONED')),
    attempt_count INT DEFAULT 0,
    max_attempts INT DEFAULT 5,
    response_code INT,
    response_body TEXT,
    response_time_ms INT,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);

-- ============================================================================
-- 7. USAGE RECORDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_records (
    id SERIAL PRIMARY KEY,
    record_id VARCHAR(100) NOT NULL UNIQUE,
    iccid VARCHAR(20) NOT NULL,
    sim_id VARCHAR(50) REFERENCES provisioned_sims(sim_id),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    data_upload_bytes BIGINT DEFAULT 0,
    data_download_bytes BIGINT DEFAULT 0,
    total_bytes BIGINT NOT NULL DEFAULT 0,
    sms_count INT DEFAULT 0,
    voice_seconds INT DEFAULT 0,
    source VARCHAR(100),
    batch_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'PROCESSED' CHECK (status IN ('PROCESSED', 'DUPLICATE', 'FAILED')),
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_records_iccid ON usage_records(iccid);
CREATE INDEX IF NOT EXISTS idx_usage_records_sim ON usage_records(sim_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_period ON usage_records(period_start, period_end);

-- ============================================================================
-- 8. USAGE CYCLES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS usage_cycles (
    id SERIAL PRIMARY KEY,
    sim_id VARCHAR(50) NOT NULL REFERENCES provisioned_sims(sim_id),
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
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sim_id, cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_usage_cycles_sim ON usage_cycles(sim_id);
CREATE INDEX IF NOT EXISTS idx_usage_cycles_iccid ON usage_cycles(iccid);

-- ============================================================================
-- 9. DAILY USAGE TABLE (for consumption dashboard)
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_usage (
    id SERIAL PRIMARY KEY,
    usage_date DATE NOT NULL,
    iccid VARCHAR(20) NOT NULL,
    carrier VARCHAR(100),
    data_bytes BIGINT DEFAULT 0,
    sms_count INT DEFAULT 0,
    voice_seconds INT DEFAULT 0,
    cost NUMERIC(10, 4) DEFAULT 0,
    active_sim_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usage_date, iccid)
);

CREATE INDEX IF NOT EXISTS idx_daily_usage_date ON daily_usage(usage_date);
CREATE INDEX IF NOT EXISTS idx_daily_usage_iccid ON daily_usage(iccid);

-- ============================================================================
-- 10. SIM AUDIT LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS sim_audit_log (
    id SERIAL PRIMARY KEY,
    sim_id VARCHAR(50) NOT NULL,
    iccid VARCHAR(20),
    action VARCHAR(50) NOT NULL,
    previous_status VARCHAR(20),
    new_status VARCHAR(20),
    reason VARCHAR(50),
    notes TEXT,
    initiated_by VARCHAR(20),
    client_id VARCHAR(50),
    correlation_id VARCHAR(100),
    request_id VARCHAR(50),
    ip_address VARCHAR(45),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sim_audit_sim ON sim_audit_log(sim_id);
CREATE INDEX IF NOT EXISTS idx_sim_audit_iccid ON sim_audit_log(iccid);
CREATE INDEX IF NOT EXISTS idx_sim_audit_action ON sim_audit_log(action);

-- ============================================================================
-- 11. API AUDIT LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_audit_log (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(50) NOT NULL DEFAULT 'req_' || encode(gen_random_bytes(12), 'hex'),
    client_id VARCHAR(50),
    method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    status_code INT,
    response_time_ms INT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_body JSONB,
    response_body JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_audit_client ON api_audit_log(client_id);
CREATE INDEX IF NOT EXISTS idx_api_audit_endpoint ON api_audit_log(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_audit_created ON api_audit_log(created_at DESC);

-- ============================================================================
-- 12. RATE LIMIT BUCKETS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    id SERIAL PRIMARY KEY,
    bucket_key VARCHAR(255) NOT NULL,
    tokens INT NOT NULL DEFAULT 0,
    last_refill TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bucket_key)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key ON rate_limit_buckets(bucket_key);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY (Optional - adjust as needed)
-- ============================================================================
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisioned_sims ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE sim_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (adjust for your security needs)
CREATE POLICY "Allow authenticated access" ON app_settings FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON exchange_rates FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON provisioned_sims FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON api_clients FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON webhooks FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON webhook_deliveries FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON usage_records FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON usage_cycles FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON daily_usage FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON sim_audit_log FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON api_audit_log FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated access" ON rate_limit_buckets FOR ALL TO authenticated USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role access" ON app_settings FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role access" ON exchange_rates FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role access" ON provisioned_sims FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role access" ON api_clients FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role access" ON webhooks FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role access" ON webhook_deliveries FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role access" ON usage_records FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role access" ON usage_cycles FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role access" ON daily_usage FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role access" ON sim_audit_log FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role access" ON api_audit_log FOR ALL TO service_role USING (true);
CREATE POLICY "Allow service role access" ON rate_limit_buckets FOR ALL TO service_role USING (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get exchange rate
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

-- Function to convert from EUR
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
-- MIGRATION COMPLETE
-- ============================================================================

-- ============================================================================
-- Migration: 010_provisioning_mediation_api.sql
-- Description: Database schema for Provisioning and Mediation API
-- Version: 1.0
-- Date: December 2024
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. PROVISIONED SIMS TABLE
-- Stores SIM cards provisioned via the external Provisioning API
-- This is separate from the existing sim_cards table used by the portal UI
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".provisioned_sims (
    -- Primary identifier (portal-generated)
    sim_id VARCHAR(50) PRIMARY KEY DEFAULT 'sim_' || encode(gen_random_bytes(12), 'hex'),

    -- Core SIM identifiers (from provisioning system)
    iccid VARCHAR(20) NOT NULL UNIQUE,
    imsi VARCHAR(15) NOT NULL,
    msisdn VARCHAR(20) NOT NULL,
    imei VARCHAR(15),

    -- Security codes (encrypted at rest)
    puk1 VARCHAR(255),  -- Encrypted
    puk2 VARCHAR(255),  -- Encrypted
    pin1 VARCHAR(255),  -- Encrypted
    pin2 VARCHAR(255),  -- Encrypted
    ki TEXT,            -- Encrypted authentication key (hex)
    opc TEXT,           -- Encrypted operator code (hex)

    -- Profile configuration
    apn VARCHAR(255) NOT NULL,
    rate_plan_id VARCHAR(100) NOT NULL,
    data_limit_bytes BIGINT,
    billing_account_id VARCHAR(100) NOT NULL,
    customer_id VARCHAR(100) NOT NULL,

    -- Status management
    status VARCHAR(20) NOT NULL DEFAULT 'PROVISIONED'
        CHECK (status IN ('PROVISIONED', 'ACTIVE', 'INACTIVE', 'BLOCKED')),
    previous_status VARCHAR(20),  -- For unblock operations

    -- Block information
    block_reason VARCHAR(50),
    block_notes TEXT,
    blocked_at TIMESTAMPTZ,
    blocked_by VARCHAR(20),  -- SYSTEM | USER | API

    -- Flexible metadata storage
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ
);

-- Indexes for provisioned_sims
CREATE INDEX IF NOT EXISTS idx_provisioned_sims_iccid ON "sim-card-portal-v2".provisioned_sims(iccid);
CREATE INDEX IF NOT EXISTS idx_provisioned_sims_imsi ON "sim-card-portal-v2".provisioned_sims(imsi);
CREATE INDEX IF NOT EXISTS idx_provisioned_sims_msisdn ON "sim-card-portal-v2".provisioned_sims(msisdn);
CREATE INDEX IF NOT EXISTS idx_provisioned_sims_status ON "sim-card-portal-v2".provisioned_sims(status);
CREATE INDEX IF NOT EXISTS idx_provisioned_sims_customer ON "sim-card-portal-v2".provisioned_sims(customer_id);
CREATE INDEX IF NOT EXISTS idx_provisioned_sims_billing ON "sim-card-portal-v2".provisioned_sims(billing_account_id);

COMMENT ON TABLE "sim-card-portal-v2".provisioned_sims IS 'SIM cards provisioned via external Provisioning API. Portal cannot delete - only provisioning system has deletion authority.';

-- ============================================================================
-- 2. API CLIENTS TABLE
-- Stores credentials for external systems (provisioning/mediation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".api_clients (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'client_' || encode(gen_random_bytes(8), 'hex'),
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Authentication
    api_key_hash VARCHAR(255) NOT NULL,  -- SHA256 hash of API key
    api_key_prefix VARCHAR(8) NOT NULL,  -- First 8 chars for identification

    -- Permissions
    permissions JSONB DEFAULT '[]',  -- Array of allowed endpoints/actions
    rate_limit_override JSONB,       -- Custom rate limits

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_clients_prefix ON "sim-card-portal-v2".api_clients(api_key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_clients_active ON "sim-card-portal-v2".api_clients(is_active) WHERE is_active = true;

COMMENT ON TABLE "sim-card-portal-v2".api_clients IS 'API client credentials for external provisioning and mediation systems.';

-- ============================================================================
-- 3. WEBHOOKS TABLE
-- Stores webhook subscriptions for event notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".webhooks (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'wh_' || encode(gen_random_bytes(12), 'hex'),

    -- Subscription details
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,  -- Array of event types
    secret_hash VARCHAR(255) NOT NULL,  -- SHA256 hash of shared secret

    -- Status tracking
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'FAILED')),
    failure_count INT DEFAULT 0,

    -- Owner
    client_id VARCHAR(50) REFERENCES "sim-card-portal-v2".api_clients(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_delivery_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhooks_status ON "sim-card-portal-v2".webhooks(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_client ON "sim-card-portal-v2".webhooks(client_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_events ON "sim-card-portal-v2".webhooks USING GIN(events);

COMMENT ON TABLE "sim-card-portal-v2".webhooks IS 'Webhook subscriptions for SIM lifecycle event notifications.';

-- ============================================================================
-- 4. WEBHOOK DELIVERIES TABLE
-- Tracks webhook delivery attempts with retry logic
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".webhook_deliveries (
    id SERIAL PRIMARY KEY,

    -- Event information
    event_id VARCHAR(50) NOT NULL DEFAULT 'evt_' || encode(gen_random_bytes(12), 'hex'),
    event_type VARCHAR(50) NOT NULL,
    webhook_id VARCHAR(50) NOT NULL REFERENCES "sim-card-portal-v2".webhooks(id) ON DELETE CASCADE,

    -- Payload
    payload JSONB NOT NULL,

    -- Delivery tracking
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DELIVERED', 'FAILED', 'ABANDONED')),
    attempt_count INT DEFAULT 0,
    max_attempts INT DEFAULT 5,

    -- Response tracking
    response_code INT,
    response_body TEXT,
    response_time_ms INT,

    -- Retry scheduling
    next_retry_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON "sim-card-portal-v2".webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON "sim-card-portal-v2".webhook_deliveries(next_retry_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event ON "sim-card-portal-v2".webhook_deliveries(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON "sim-card-portal-v2".webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON "sim-card-portal-v2".webhook_deliveries(created_at DESC);

COMMENT ON TABLE "sim-card-portal-v2".webhook_deliveries IS 'Webhook delivery attempts with exponential backoff retry logic.';

-- ============================================================================
-- 5. USAGE RECORDS TABLE
-- Stores individual usage records from mediation systems
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".usage_records (
    id SERIAL PRIMARY KEY,

    -- Idempotency key (from mediation system)
    record_id VARCHAR(100) NOT NULL UNIQUE,

    -- SIM identification
    iccid VARCHAR(20) NOT NULL,
    sim_id VARCHAR(50) REFERENCES "sim-card-portal-v2".provisioned_sims(sim_id),

    -- Usage period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Usage data
    data_upload_bytes BIGINT DEFAULT 0,
    data_download_bytes BIGINT DEFAULT 0,
    total_bytes BIGINT NOT NULL DEFAULT 0,
    sms_count INT DEFAULT 0,
    voice_seconds INT DEFAULT 0,

    -- Source tracking
    source VARCHAR(100),  -- Mediation node identifier
    batch_id VARCHAR(100),  -- If part of a batch submission

    -- Processing status
    status VARCHAR(20) DEFAULT 'PROCESSED' CHECK (status IN ('PROCESSED', 'DUPLICATE', 'FAILED')),

    -- Timestamps
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_records_iccid ON "sim-card-portal-v2".usage_records(iccid);
CREATE INDEX IF NOT EXISTS idx_usage_records_sim ON "sim-card-portal-v2".usage_records(sim_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_period ON "sim-card-portal-v2".usage_records(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_usage_records_batch ON "sim-card-portal-v2".usage_records(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_records_processed ON "sim-card-portal-v2".usage_records(processed_at DESC);

COMMENT ON TABLE "sim-card-portal-v2".usage_records IS 'Individual usage records from mediation systems. Deduplicated via record_id.';

-- ============================================================================
-- 6. USAGE CYCLES TABLE
-- Accumulated usage per billing cycle
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".usage_cycles (
    id SERIAL PRIMARY KEY,

    -- SIM identification
    sim_id VARCHAR(50) NOT NULL REFERENCES "sim-card-portal-v2".provisioned_sims(sim_id),
    iccid VARCHAR(20) NOT NULL,

    -- Billing cycle
    cycle_id VARCHAR(20) NOT NULL,  -- e.g., "2024-12"
    cycle_start TIMESTAMPTZ NOT NULL,
    cycle_end TIMESTAMPTZ NOT NULL,

    -- Accumulated usage
    total_upload_bytes BIGINT DEFAULT 0,
    total_download_bytes BIGINT DEFAULT 0,
    total_bytes BIGINT DEFAULT 0,
    sms_count INT DEFAULT 0,
    voice_seconds INT DEFAULT 0,

    -- Cycle status
    is_current BOOLEAN DEFAULT true,

    -- Archive information
    archived_at TIMESTAMPTZ,
    final_usage JSONB,  -- Snapshot at cycle end

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one current cycle per SIM
    UNIQUE(sim_id, cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_usage_cycles_sim ON "sim-card-portal-v2".usage_cycles(sim_id);
CREATE INDEX IF NOT EXISTS idx_usage_cycles_iccid ON "sim-card-portal-v2".usage_cycles(iccid);
CREATE INDEX IF NOT EXISTS idx_usage_cycles_current ON "sim-card-portal-v2".usage_cycles(sim_id, is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_usage_cycles_cycle ON "sim-card-portal-v2".usage_cycles(cycle_id);

COMMENT ON TABLE "sim-card-portal-v2".usage_cycles IS 'Accumulated usage per SIM per billing cycle. Archived at cycle boundaries.';

-- ============================================================================
-- 7. SIM AUDIT LOG TABLE
-- Tracks all state changes and actions on SIMs
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".sim_audit_log (
    id SERIAL PRIMARY KEY,

    -- SIM identification
    sim_id VARCHAR(50) NOT NULL,
    iccid VARCHAR(20),

    -- Action details
    action VARCHAR(50) NOT NULL,  -- CREATE, ACTIVATE, DEACTIVATE, BLOCK, UNBLOCK, UPDATE
    previous_status VARCHAR(20),
    new_status VARCHAR(20),

    -- Context
    reason VARCHAR(50),
    notes TEXT,
    initiated_by VARCHAR(20),  -- SYSTEM | USER | API
    client_id VARCHAR(50),
    correlation_id VARCHAR(100),

    -- Request details
    request_id VARCHAR(50),
    ip_address VARCHAR(45),

    -- Changes made (for UPDATE actions)
    changes JSONB,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sim_audit_log_sim ON "sim-card-portal-v2".sim_audit_log(sim_id);
CREATE INDEX IF NOT EXISTS idx_sim_audit_log_iccid ON "sim-card-portal-v2".sim_audit_log(iccid);
CREATE INDEX IF NOT EXISTS idx_sim_audit_log_action ON "sim-card-portal-v2".sim_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_sim_audit_log_created ON "sim-card-portal-v2".sim_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sim_audit_log_correlation ON "sim-card-portal-v2".sim_audit_log(correlation_id) WHERE correlation_id IS NOT NULL;

COMMENT ON TABLE "sim-card-portal-v2".sim_audit_log IS 'Audit trail for all SIM state changes and actions.';

-- ============================================================================
-- 8. API AUDIT LOG TABLE
-- Tracks all API requests for compliance and debugging
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".api_audit_log (
    id SERIAL PRIMARY KEY,

    -- Request identification
    request_id VARCHAR(50) NOT NULL DEFAULT 'req_' || encode(gen_random_bytes(12), 'hex'),

    -- Client information
    client_id VARCHAR(50),
    client_ip VARCHAR(45),
    user_agent TEXT,

    -- Request details
    method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    query_params JSONB,
    request_body_hash VARCHAR(64),  -- SHA256 hash (not the actual body)

    -- Response details
    status_code INT,
    response_time_ms INT,

    -- Error tracking
    error_code VARCHAR(50),
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_audit_log_request ON "sim-card-portal-v2".api_audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_api_audit_log_client ON "sim-card-portal-v2".api_audit_log(client_id);
CREATE INDEX IF NOT EXISTS idx_api_audit_log_endpoint ON "sim-card-portal-v2".api_audit_log(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_audit_log_created ON "sim-card-portal-v2".api_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_audit_log_status ON "sim-card-portal-v2".api_audit_log(status_code);

COMMENT ON TABLE "sim-card-portal-v2".api_audit_log IS 'API request audit log for compliance and debugging. Sensitive data is masked.';

-- ============================================================================
-- 9. RATE LIMITING TABLE
-- Tracks API request counts for rate limiting
-- ============================================================================

CREATE TABLE IF NOT EXISTS "sim-card-portal-v2".rate_limit_buckets (
    id SERIAL PRIMARY KEY,

    -- Bucket identification
    client_id VARCHAR(50) NOT NULL,
    endpoint_category VARCHAR(50) NOT NULL,  -- provisioning_write, provisioning_read, usage_single, usage_batch
    window_start TIMESTAMPTZ NOT NULL,

    -- Counter
    request_count INT DEFAULT 1,

    -- Unique constraint for upsert
    UNIQUE(client_id, endpoint_category, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_client ON "sim-card-portal-v2".rate_limit_buckets(client_id, endpoint_category);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON "sim-card-portal-v2".rate_limit_buckets(window_start);

COMMENT ON TABLE "sim-card-portal-v2".rate_limit_buckets IS 'Rate limiting counters per client per endpoint category.';

-- ============================================================================
-- 10. HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION "sim-card-portal-v2".update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_provisioned_sims_updated_at ON "sim-card-portal-v2".provisioned_sims;
CREATE TRIGGER update_provisioned_sims_updated_at
    BEFORE UPDATE ON "sim-card-portal-v2".provisioned_sims
    FOR EACH ROW EXECUTE FUNCTION "sim-card-portal-v2".update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_clients_updated_at ON "sim-card-portal-v2".api_clients;
CREATE TRIGGER update_api_clients_updated_at
    BEFORE UPDATE ON "sim-card-portal-v2".api_clients
    FOR EACH ROW EXECUTE FUNCTION "sim-card-portal-v2".update_updated_at_column();

DROP TRIGGER IF EXISTS update_webhooks_updated_at ON "sim-card-portal-v2".webhooks;
CREATE TRIGGER update_webhooks_updated_at
    BEFORE UPDATE ON "sim-card-portal-v2".webhooks
    FOR EACH ROW EXECUTE FUNCTION "sim-card-portal-v2".update_updated_at_column();

-- Function to accumulate usage into current cycle
CREATE OR REPLACE FUNCTION "sim-card-portal-v2".accumulate_usage(
    p_sim_id VARCHAR(50),
    p_iccid VARCHAR(20),
    p_upload_bytes BIGINT,
    p_download_bytes BIGINT,
    p_total_bytes BIGINT,
    p_sms_count INT DEFAULT 0,
    p_voice_seconds INT DEFAULT 0
)
RETURNS void AS $$
BEGIN
    UPDATE "sim-card-portal-v2".usage_cycles
    SET
        total_upload_bytes = total_upload_bytes + p_upload_bytes,
        total_download_bytes = total_download_bytes + p_download_bytes,
        total_bytes = total_bytes + p_total_bytes,
        sms_count = sms_count + p_sms_count,
        voice_seconds = voice_seconds + p_voice_seconds,
        last_updated = NOW()
    WHERE sim_id = p_sim_id AND is_current = true;

    -- If no current cycle exists, create one
    IF NOT FOUND THEN
        INSERT INTO "sim-card-portal-v2".usage_cycles (
            sim_id, iccid, cycle_id, cycle_start, cycle_end,
            total_upload_bytes, total_download_bytes, total_bytes,
            sms_count, voice_seconds, is_current
        ) VALUES (
            p_sim_id, p_iccid, TO_CHAR(NOW(), 'YYYY-MM'),
            DATE_TRUNC('month', NOW()),
            DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 second',
            p_upload_bytes, p_download_bytes, p_total_bytes,
            p_sms_count, p_voice_seconds, true
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to reset billing cycle
CREATE OR REPLACE FUNCTION "sim-card-portal-v2".reset_billing_cycle(
    p_iccid VARCHAR(20),
    p_new_cycle_id VARCHAR(20),
    p_cycle_start TIMESTAMPTZ,
    p_cycle_end TIMESTAMPTZ,
    p_final_usage JSONB DEFAULT NULL
)
RETURNS TABLE (
    previous_cycle_id VARCHAR(20),
    archived_usage JSONB,
    new_cycle_id VARCHAR(20)
) AS $$
DECLARE
    v_sim_id VARCHAR(50);
    v_prev_cycle_id VARCHAR(20);
    v_archived_usage JSONB;
BEGIN
    -- Get SIM ID
    SELECT sim_id INTO v_sim_id
    FROM "sim-card-portal-v2".provisioned_sims
    WHERE iccid = p_iccid;

    IF v_sim_id IS NULL THEN
        RAISE EXCEPTION 'SIM with ICCID % not found', p_iccid;
    END IF;

    -- Archive current cycle
    UPDATE "sim-card-portal-v2".usage_cycles
    SET
        is_current = false,
        archived_at = NOW(),
        final_usage = COALESCE(p_final_usage, jsonb_build_object(
            'total_upload_bytes', total_upload_bytes,
            'total_download_bytes', total_download_bytes,
            'total_bytes', total_bytes,
            'sms_count', sms_count,
            'voice_seconds', voice_seconds
        ))
    WHERE sim_id = v_sim_id AND is_current = true
    RETURNING cycle_id, final_usage INTO v_prev_cycle_id, v_archived_usage;

    -- Create new cycle
    INSERT INTO "sim-card-portal-v2".usage_cycles (
        sim_id, iccid, cycle_id, cycle_start, cycle_end, is_current
    ) VALUES (
        v_sim_id, p_iccid, p_new_cycle_id, p_cycle_start, p_cycle_end, true
    );

    RETURN QUERY SELECT v_prev_cycle_id, v_archived_usage, p_new_cycle_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate exponential backoff delay
CREATE OR REPLACE FUNCTION "sim-card-portal-v2".calculate_retry_delay(attempt_count INT)
RETURNS INTERVAL AS $$
BEGIN
    -- Exponential backoff: 1s, 2s, 4s, 8s, 16s
    RETURN (POWER(2, LEAST(attempt_count, 4))::INT || ' seconds')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old audit logs (data retention)
CREATE OR REPLACE FUNCTION "sim-card-portal-v2".cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Delete webhook deliveries older than 90 days
    DELETE FROM "sim-card-portal-v2".webhook_deliveries
    WHERE created_at < NOW() - INTERVAL '90 days';

    -- Delete API audit logs older than 12 months
    DELETE FROM "sim-card-portal-v2".api_audit_log
    WHERE created_at < NOW() - INTERVAL '12 months';

    -- Delete archived usage cycles older than 24 months
    DELETE FROM "sim-card-portal-v2".usage_cycles
    WHERE is_current = false AND archived_at < NOW() - INTERVAL '24 months';

    -- Clean up old rate limit buckets
    DELETE FROM "sim-card-portal-v2".rate_limit_buckets
    WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. SAMPLE API CLIENT FOR TESTING
-- ============================================================================

-- Insert a test API client (API key: test_provisioning_key_12345)
-- In production, generate secure random keys
INSERT INTO "sim-card-portal-v2".api_clients (id, name, description, api_key_hash, api_key_prefix, permissions)
VALUES (
    'client_test_provisioning',
    'Test Provisioning System',
    'Test client for development and testing',
    encode(sha256('test_provisioning_key_12345'::bytea), 'hex'),
    'test_pro',
    '["provisioning:*", "webhooks:*", "usage:*"]'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON SCHEMA "sim-card-portal-v2" IS 'SIM Card Portal v2 - Includes Provisioning and Mediation API tables (Migration 010)';

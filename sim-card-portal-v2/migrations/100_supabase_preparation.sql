-- ============================================================================
-- Migration: 100_supabase_preparation.sql
-- Description: Prepare schema for Supabase migration
-- Version: 1.0
-- Date: December 2024
--
-- This migration:
-- 1. Moves all tables from "sim-card-portal-v2" schema to public schema
-- 2. Updates foreign key references
-- 3. Creates updated_at triggers for all tables
-- 4. Moves functions to public schema
-- ============================================================================

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CREATE THE update_updated_at_column FUNCTION IN PUBLIC SCHEMA
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_updated_at_column() IS 'Trigger function to automatically update updated_at timestamp';

-- ============================================================================
-- 2. MOVE TABLES TO PUBLIC SCHEMA
-- Note: This requires dropping and recreating foreign key constraints
-- ============================================================================

-- Step 2.1: Drop existing foreign key constraints in the old schema
ALTER TABLE IF EXISTS "sim-card-portal-v2".devices
    DROP CONSTRAINT IF EXISTS devices_sim_card_id_fkey,
    DROP CONSTRAINT IF EXISTS devices_device_type_id_fkey,
    DROP CONSTRAINT IF EXISTS devices_location_id_fkey;

ALTER TABLE IF EXISTS "sim-card-portal-v2".device_location_history
    DROP CONSTRAINT IF EXISTS device_location_history_device_id_fkey;

ALTER TABLE IF EXISTS "sim-card-portal-v2".device_sensor_history
    DROP CONSTRAINT IF EXISTS device_sensor_history_device_id_fkey;

ALTER TABLE IF EXISTS "sim-card-portal-v2".webhooks
    DROP CONSTRAINT IF EXISTS webhooks_client_id_fkey;

ALTER TABLE IF EXISTS "sim-card-portal-v2".webhook_deliveries
    DROP CONSTRAINT IF EXISTS webhook_deliveries_webhook_id_fkey;

ALTER TABLE IF EXISTS "sim-card-portal-v2".usage_records
    DROP CONSTRAINT IF EXISTS usage_records_sim_id_fkey;

ALTER TABLE IF EXISTS "sim-card-portal-v2".usage_cycles
    DROP CONSTRAINT IF EXISTS usage_cycles_sim_id_fkey;

-- Step 2.2: Move tables to public schema
ALTER TABLE IF EXISTS "sim-card-portal-v2".device_types SET SCHEMA public;
ALTER TABLE IF EXISTS "sim-card-portal-v2".locations SET SCHEMA public;
ALTER TABLE IF EXISTS "sim-card-portal-v2".sim_cards SET SCHEMA public;
ALTER TABLE IF EXISTS "sim-card-portal-v2".devices SET SCHEMA public;
ALTER TABLE IF EXISTS "sim-card-portal-v2".device_location_history SET SCHEMA public;
ALTER TABLE IF EXISTS "sim-card-portal-v2".device_sensor_history SET SCHEMA public;
ALTER TABLE IF EXISTS "sim-card-portal-v2".provisioned_sims SET SCHEMA public;
ALTER TABLE IF EXISTS "sim-card-portal-v2".api_clients SET SCHEMA public;
ALTER TABLE IF EXISTS "sim-card-portal-v2".webhooks SET SCHEMA public;
ALTER TABLE IF EXISTS "sim-card-portal-v2".webhook_deliveries SET SCHEMA public;
ALTER TABLE IF EXISTS "sim-card-portal-v2".usage_records SET SCHEMA public;
ALTER TABLE IF EXISTS "sim-card-portal-v2".usage_cycles SET SCHEMA public;
ALTER TABLE IF EXISTS "sim-card-portal-v2".sim_audit_log SET SCHEMA public;
ALTER TABLE IF EXISTS "sim-card-portal-v2".api_audit_log SET SCHEMA public;
ALTER TABLE IF EXISTS "sim-card-portal-v2".rate_limit_buckets SET SCHEMA public;

-- Also move LLM-related tables if they exist
ALTER TABLE IF EXISTS "sim-card-portal-v2".llm_conversations SET SCHEMA public;
ALTER TABLE IF EXISTS "sim-card-portal-v2".llm_messages SET SCHEMA public;

-- Step 2.3: Recreate foreign key constraints in public schema
ALTER TABLE public.devices
    ADD CONSTRAINT devices_sim_card_id_fkey
        FOREIGN KEY (sim_card_id) REFERENCES public.sim_cards(id),
    ADD CONSTRAINT devices_device_type_id_fkey
        FOREIGN KEY (device_type_id) REFERENCES public.device_types(id),
    ADD CONSTRAINT devices_location_id_fkey
        FOREIGN KEY (location_id) REFERENCES public.locations(id);

ALTER TABLE public.device_location_history
    ADD CONSTRAINT device_location_history_device_id_fkey
        FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE CASCADE;

ALTER TABLE public.device_sensor_history
    ADD CONSTRAINT device_sensor_history_device_id_fkey
        FOREIGN KEY (device_id) REFERENCES public.devices(id) ON DELETE CASCADE;

ALTER TABLE public.webhooks
    ADD CONSTRAINT webhooks_client_id_fkey
        FOREIGN KEY (client_id) REFERENCES public.api_clients(id);

ALTER TABLE public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_webhook_id_fkey
        FOREIGN KEY (webhook_id) REFERENCES public.webhooks(id) ON DELETE CASCADE;

ALTER TABLE public.usage_records
    ADD CONSTRAINT usage_records_sim_id_fkey
        FOREIGN KEY (sim_id) REFERENCES public.provisioned_sims(sim_id);

ALTER TABLE public.usage_cycles
    ADD CONSTRAINT usage_cycles_sim_id_fkey
        FOREIGN KEY (sim_id) REFERENCES public.provisioned_sims(sim_id);

-- ============================================================================
-- 3. CREATE updated_at TRIGGERS FOR ALL TABLES
-- ============================================================================

-- device_types
DROP TRIGGER IF EXISTS set_device_types_updated_at ON public.device_types;
CREATE TRIGGER set_device_types_updated_at
    BEFORE UPDATE ON public.device_types
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- locations
DROP TRIGGER IF EXISTS set_locations_updated_at ON public.locations;
CREATE TRIGGER set_locations_updated_at
    BEFORE UPDATE ON public.locations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- sim_cards
DROP TRIGGER IF EXISTS set_sim_cards_updated_at ON public.sim_cards;
CREATE TRIGGER set_sim_cards_updated_at
    BEFORE UPDATE ON public.sim_cards
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- devices
DROP TRIGGER IF EXISTS set_devices_updated_at ON public.devices;
CREATE TRIGGER set_devices_updated_at
    BEFORE UPDATE ON public.devices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- provisioned_sims (may already have trigger from migration 010)
DROP TRIGGER IF EXISTS update_provisioned_sims_updated_at ON public.provisioned_sims;
DROP TRIGGER IF EXISTS set_provisioned_sims_updated_at ON public.provisioned_sims;
CREATE TRIGGER set_provisioned_sims_updated_at
    BEFORE UPDATE ON public.provisioned_sims
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- api_clients
DROP TRIGGER IF EXISTS update_api_clients_updated_at ON public.api_clients;
DROP TRIGGER IF EXISTS set_api_clients_updated_at ON public.api_clients;
CREATE TRIGGER set_api_clients_updated_at
    BEFORE UPDATE ON public.api_clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- webhooks
DROP TRIGGER IF EXISTS update_webhooks_updated_at ON public.webhooks;
DROP TRIGGER IF EXISTS set_webhooks_updated_at ON public.webhooks;
CREATE TRIGGER set_webhooks_updated_at
    BEFORE UPDATE ON public.webhooks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4. RECREATE HELPER FUNCTIONS IN PUBLIC SCHEMA
-- ============================================================================

-- Function to accumulate usage into current cycle
CREATE OR REPLACE FUNCTION public.accumulate_usage(
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
    UPDATE public.usage_cycles
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
        INSERT INTO public.usage_cycles (
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
CREATE OR REPLACE FUNCTION public.reset_billing_cycle(
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
    FROM public.provisioned_sims
    WHERE iccid = p_iccid;

    IF v_sim_id IS NULL THEN
        RAISE EXCEPTION 'SIM with ICCID % not found', p_iccid;
    END IF;

    -- Archive current cycle
    UPDATE public.usage_cycles
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
    INSERT INTO public.usage_cycles (
        sim_id, iccid, cycle_id, cycle_start, cycle_end, is_current
    ) VALUES (
        v_sim_id, p_iccid, p_new_cycle_id, p_cycle_start, p_cycle_end, true
    );

    RETURN QUERY SELECT v_prev_cycle_id, v_archived_usage, p_new_cycle_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate exponential backoff delay
CREATE OR REPLACE FUNCTION public.calculate_retry_delay(attempt_count INT)
RETURNS INTERVAL AS $$
BEGIN
    -- Exponential backoff: 1s, 2s, 4s, 8s, 16s
    RETURN (POWER(2, LEAST(attempt_count, 4))::INT || ' seconds')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old data (data retention)
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Delete webhook deliveries older than 90 days
    DELETE FROM public.webhook_deliveries
    WHERE created_at < NOW() - INTERVAL '90 days';

    -- Delete API audit logs older than 12 months
    DELETE FROM public.api_audit_log
    WHERE created_at < NOW() - INTERVAL '12 months';

    -- Delete archived usage cycles older than 24 months
    DELETE FROM public.usage_cycles
    WHERE is_current = false AND archived_at < NOW() - INTERVAL '24 months';

    -- Clean up old rate limit buckets
    DELETE FROM public.rate_limit_buckets
    WHERE window_start < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. DROP OLD SCHEMA (optional - can be done later after verification)
-- ============================================================================

-- Uncomment after verifying migration success:
-- DROP SCHEMA IF EXISTS "sim-card-portal-v2" CASCADE;

-- ============================================================================
-- 6. UPDATE SEARCH PATH
-- ============================================================================

-- Set default search path to public
ALTER DATABASE current_database() SET search_path TO public;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 100: Schema preparation complete. Tables moved to public schema.';
    RAISE NOTICE 'Remember to update application code to remove "sim-card-portal-v2". prefix from queries.';
END $$;

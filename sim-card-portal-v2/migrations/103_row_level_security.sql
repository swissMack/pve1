-- ============================================================================
-- Migration: 103_row_level_security.sql
-- Description: Implement Row Level Security (RLS) for Supabase
-- Version: 1.0
-- Date: December 2024
--
-- This migration:
-- 1. Enables RLS on all tables
-- 2. Creates service role policies (full access for backend)
-- 3. Creates authenticated user policies
-- 4. Creates read-only policies for specific tables
--
-- IMPORTANT: In Supabase, the service_role key bypasses RLS.
-- These policies primarily affect the anon key and authenticated users.
-- ============================================================================

-- ============================================================================
-- HELPER: Create a function to check if user has a specific role
-- This can be extended to support custom role claims in JWT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if the current user has the required role
    -- In Supabase, roles are typically stored in auth.users metadata or custom claims
    -- This is a placeholder that can be customized based on your auth setup

    -- For service role, always return true
    IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        RETURN true;
    END IF;

    -- Check for admin role in JWT claims
    IF current_setting('request.jwt.claim.role', true) = 'admin' THEN
        RETURN true;
    END IF;

    -- Check app_metadata for role (Supabase pattern)
    IF current_setting('request.jwt.claims', true)::jsonb->>'app_metadata' IS NOT NULL THEN
        IF (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role') = required_role THEN
            RETURN true;
        END IF;
    END IF;

    RETURN false;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================================

-- Core tables
ALTER TABLE public.device_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sim_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sensor_history ENABLE ROW LEVEL SECURITY;

-- Provisioning API tables
ALTER TABLE public.provisioned_sims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sim_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. SERVICE ROLE POLICIES (Full Access)
-- Note: service_role bypasses RLS in Supabase, but we add these for completeness
-- ============================================================================

-- device_types: Service role full access
CREATE POLICY "Service role full access to device_types"
    ON public.device_types FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- locations: Service role full access
CREATE POLICY "Service role full access to locations"
    ON public.locations FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- sim_cards: Service role full access
CREATE POLICY "Service role full access to sim_cards"
    ON public.sim_cards FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- devices: Service role full access
CREATE POLICY "Service role full access to devices"
    ON public.devices FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- device_location_history: Service role full access
CREATE POLICY "Service role full access to device_location_history"
    ON public.device_location_history FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- device_sensor_history: Service role full access
CREATE POLICY "Service role full access to device_sensor_history"
    ON public.device_sensor_history FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- provisioned_sims: Service role full access
CREATE POLICY "Service role full access to provisioned_sims"
    ON public.provisioned_sims FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- api_clients: Service role full access
CREATE POLICY "Service role full access to api_clients"
    ON public.api_clients FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- webhooks: Service role full access
CREATE POLICY "Service role full access to webhooks"
    ON public.webhooks FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- webhook_deliveries: Service role full access
CREATE POLICY "Service role full access to webhook_deliveries"
    ON public.webhook_deliveries FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- usage_records: Service role full access
CREATE POLICY "Service role full access to usage_records"
    ON public.usage_records FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- usage_cycles: Service role full access
CREATE POLICY "Service role full access to usage_cycles"
    ON public.usage_cycles FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- sim_audit_log: Service role full access
CREATE POLICY "Service role full access to sim_audit_log"
    ON public.sim_audit_log FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- api_audit_log: Service role full access
CREATE POLICY "Service role full access to api_audit_log"
    ON public.api_audit_log FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- rate_limit_buckets: Service role full access
CREATE POLICY "Service role full access to rate_limit_buckets"
    ON public.rate_limit_buckets FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 3. AUTHENTICATED USER POLICIES (Portal Users)
-- ============================================================================

-- device_types: Authenticated users can read
CREATE POLICY "Authenticated users can read device_types"
    ON public.device_types FOR SELECT
    USING (auth.role() = 'authenticated');

-- locations: Authenticated users can read
CREATE POLICY "Authenticated users can read locations"
    ON public.locations FOR SELECT
    USING (auth.role() = 'authenticated');

-- sim_cards: Authenticated users can read and update
CREATE POLICY "Authenticated users can read sim_cards"
    ON public.sim_cards FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update sim_cards"
    ON public.sim_cards FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- devices: Authenticated users can read and update
CREATE POLICY "Authenticated users can read devices"
    ON public.devices FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update devices"
    ON public.devices FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- device_location_history: Authenticated users can read
CREATE POLICY "Authenticated users can read device_location_history"
    ON public.device_location_history FOR SELECT
    USING (auth.role() = 'authenticated');

-- device_sensor_history: Authenticated users can read
CREATE POLICY "Authenticated users can read device_sensor_history"
    ON public.device_sensor_history FOR SELECT
    USING (auth.role() = 'authenticated');

-- provisioned_sims: Authenticated users can read
CREATE POLICY "Authenticated users can read provisioned_sims"
    ON public.provisioned_sims FOR SELECT
    USING (auth.role() = 'authenticated');

-- usage_cycles: Authenticated users can read
CREATE POLICY "Authenticated users can read usage_cycles"
    ON public.usage_cycles FOR SELECT
    USING (auth.role() = 'authenticated');

-- ============================================================================
-- 4. ADMIN-ONLY POLICIES
-- For sensitive operations like managing API clients and viewing audit logs
-- ============================================================================

-- api_clients: Only admins can manage
CREATE POLICY "Admin users can manage api_clients"
    ON public.api_clients FOR ALL
    USING (public.user_has_role('admin'))
    WITH CHECK (public.user_has_role('admin'));

-- webhooks: Authenticated users can read their own, admins can manage all
CREATE POLICY "Authenticated users can read webhooks"
    ON public.webhooks FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Admin users can manage webhooks"
    ON public.webhooks FOR ALL
    USING (public.user_has_role('admin'))
    WITH CHECK (public.user_has_role('admin'));

-- sim_audit_log: Read-only for authenticated users
CREATE POLICY "Authenticated users can read sim_audit_log"
    ON public.sim_audit_log FOR SELECT
    USING (auth.role() = 'authenticated');

-- api_audit_log: Admin only
CREATE POLICY "Admin users can read api_audit_log"
    ON public.api_audit_log FOR SELECT
    USING (public.user_has_role('admin'));

-- ============================================================================
-- 5. ANON KEY POLICIES (Public/Unauthenticated Access)
-- Very limited access - only for health checks, etc.
-- ============================================================================

-- No anon access to any tables by default
-- If you need public access to specific tables, add policies here:

-- Example: Allow anonymous read of device_types for public documentation
-- CREATE POLICY "Anon users can read device_types"
--     ON public.device_types FOR SELECT
--     USING (auth.role() = 'anon');

-- ============================================================================
-- 6. SPECIAL POLICIES FOR HISTORY TABLES
-- Allow INSERT from service role only (for MQTT bridge, sensors, etc.)
-- ============================================================================

CREATE POLICY "Service can insert device_location_history"
    ON public.device_location_history FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service can insert device_sensor_history"
    ON public.device_sensor_history FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 7. RATE LIMIT BUCKETS - Service only
-- ============================================================================

-- Rate limit table is internal, no authenticated access needed

-- ============================================================================
-- 8. AUDIT TABLES - Insert only for service role
-- ============================================================================

CREATE POLICY "Service can insert sim_audit_log"
    ON public.sim_audit_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service can insert api_audit_log"
    ON public.api_audit_log FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

DO $$
DECLARE
    rls_enabled_count INTEGER;
    policy_count INTEGER;
BEGIN
    -- Count tables with RLS enabled
    SELECT COUNT(*) INTO rls_enabled_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = true;

    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public';

    RAISE NOTICE 'Migration 103: Row Level Security setup complete.';
    RAISE NOTICE 'Tables with RLS enabled: %', rls_enabled_count;
    RAISE NOTICE 'Total RLS policies created: %', policy_count;
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: When using Supabase:';
    RAISE NOTICE '- service_role key bypasses all RLS policies';
    RAISE NOTICE '- anon key has minimal access (health checks only)';
    RAISE NOTICE '- authenticated users have read access to most tables';
    RAISE NOTICE '- admin role has full management access';
END $$;

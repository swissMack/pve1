-- ============================================================================
-- Migration: 102_add_indexes.sql
-- Description: Add optimized indexes for common query patterns
-- Version: 1.0
-- Date: December 2024
--
-- This migration adds indexes to improve query performance for:
-- 1. Device and SIM card lookups
-- 2. Status-based filtering
-- 3. Time-based queries on history tables
-- 4. Foreign key relationships
-- ============================================================================

-- ============================================================================
-- 1. DEVICES TABLE INDEXES
-- ============================================================================

-- Status index for filtering active/inactive devices
CREATE INDEX IF NOT EXISTS idx_devices_status
    ON public.devices(status);

-- SIM card relationship (frequently joined)
CREATE INDEX IF NOT EXISTS idx_devices_sim_card_id
    ON public.devices(sim_card_id);

-- Device type for filtering by category
CREATE INDEX IF NOT EXISTS idx_devices_device_type_id
    ON public.devices(device_type_id);

-- Location for geographic queries
CREATE INDEX IF NOT EXISTS idx_devices_location_id
    ON public.devices(location_id);

-- Last seen for monitoring active devices
CREATE INDEX IF NOT EXISTS idx_devices_last_seen
    ON public.devices(last_seen DESC);

-- Health status for monitoring
CREATE INDEX IF NOT EXISTS idx_devices_health_status
    ON public.devices(health_status);

-- Composite index for common dashboard query
CREATE INDEX IF NOT EXISTS idx_devices_status_last_seen
    ON public.devices(status, last_seen DESC);

-- Connection type for network analysis
CREATE INDEX IF NOT EXISTS idx_devices_connection_type
    ON public.devices(connection_type);

-- ============================================================================
-- 2. SIM_CARDS TABLE INDEXES
-- ============================================================================

-- Status for filtering
CREATE INDEX IF NOT EXISTS idx_sim_cards_status
    ON public.sim_cards(status);

-- Carrier for filtering by provider
CREATE INDEX IF NOT EXISTS idx_sim_cards_carrier
    ON public.sim_cards(carrier);

-- Expiry date for renewal alerts
CREATE INDEX IF NOT EXISTS idx_sim_cards_expiry_date
    ON public.sim_cards(expiry_date);

-- Activation date for reporting
CREATE INDEX IF NOT EXISTS idx_sim_cards_activation_date
    ON public.sim_cards(activation_date);

-- MSISDN for phone number lookups
CREATE INDEX IF NOT EXISTS idx_sim_cards_msisdn
    ON public.sim_cards(msisdn);

-- ============================================================================
-- 3. DEVICE_LOCATION_HISTORY OPTIMIZATIONS
-- (Some indexes already exist from init script)
-- ============================================================================

-- Composite index for time-range queries per device
CREATE INDEX IF NOT EXISTS idx_device_location_device_recorded
    ON public.device_location_history(device_id, recorded_at DESC);

-- BRIN index for large time-series data (efficient for sequential inserts)
CREATE INDEX IF NOT EXISTS idx_device_location_recorded_brin
    ON public.device_location_history USING BRIN(recorded_at);

-- ============================================================================
-- 4. DEVICE_SENSOR_HISTORY OPTIMIZATIONS
-- ============================================================================

-- Composite index for time-range queries per device
CREATE INDEX IF NOT EXISTS idx_device_sensor_device_recorded
    ON public.device_sensor_history(device_id, recorded_at DESC);

-- BRIN index for large time-series data
CREATE INDEX IF NOT EXISTS idx_device_sensor_recorded_brin
    ON public.device_sensor_history USING BRIN(recorded_at);

-- ============================================================================
-- 5. PROVISIONED_SIMS INDEXES
-- (Some indexes already exist from migration 010)
-- ============================================================================

-- Customer ID for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_provisioned_sims_customer_id
    ON public.provisioned_sims(customer_id);

-- Rate plan for plan-based filtering
CREATE INDEX IF NOT EXISTS idx_provisioned_sims_rate_plan
    ON public.provisioned_sims(rate_plan_id);

-- Composite for customer + status queries
CREATE INDEX IF NOT EXISTS idx_provisioned_sims_customer_status
    ON public.provisioned_sims(customer_id, status);

-- Activated date for reporting
CREATE INDEX IF NOT EXISTS idx_provisioned_sims_activated_at
    ON public.provisioned_sims(activated_at);

-- ============================================================================
-- 6. USAGE_RECORDS INDEXES
-- ============================================================================

-- Period-based queries
CREATE INDEX IF NOT EXISTS idx_usage_records_period
    ON public.usage_records(period_start, period_end);

-- Status for processing queue
CREATE INDEX IF NOT EXISTS idx_usage_records_status
    ON public.usage_records(status);

-- BRIN for time-series efficiency
CREATE INDEX IF NOT EXISTS idx_usage_records_processed_brin
    ON public.usage_records USING BRIN(processed_at);

-- ============================================================================
-- 7. USAGE_CYCLES INDEXES
-- ============================================================================

-- Current cycle lookup (partial index - very efficient)
CREATE INDEX IF NOT EXISTS idx_usage_cycles_current
    ON public.usage_cycles(sim_id)
    WHERE is_current = true;

-- Cycle ID for period queries
CREATE INDEX IF NOT EXISTS idx_usage_cycles_cycle_id
    ON public.usage_cycles(cycle_id);

-- Archived cycles
CREATE INDEX IF NOT EXISTS idx_usage_cycles_archived
    ON public.usage_cycles(archived_at)
    WHERE is_current = false;

-- ============================================================================
-- 8. API_CLIENTS INDEXES
-- ============================================================================

-- Active clients (partial index)
CREATE INDEX IF NOT EXISTS idx_api_clients_active
    ON public.api_clients(is_active)
    WHERE is_active = true;

-- Last used for activity tracking
CREATE INDEX IF NOT EXISTS idx_api_clients_last_used
    ON public.api_clients(last_used_at DESC);

-- ============================================================================
-- 9. WEBHOOKS INDEXES
-- ============================================================================

-- Active webhooks
CREATE INDEX IF NOT EXISTS idx_webhooks_active
    ON public.webhooks(status)
    WHERE status = 'ACTIVE';

-- Failed webhooks for retry
CREATE INDEX IF NOT EXISTS idx_webhooks_failed
    ON public.webhooks(failure_count)
    WHERE status = 'FAILED';

-- ============================================================================
-- 10. WEBHOOK_DELIVERIES INDEXES
-- ============================================================================

-- Pending deliveries for retry queue
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending
    ON public.webhook_deliveries(next_retry_at)
    WHERE status = 'PENDING';

-- Event ID for idempotency checks
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_id
    ON public.webhook_deliveries(event_id);

-- ============================================================================
-- 11. AUDIT LOG INDEXES
-- ============================================================================

-- SIM audit by action type
CREATE INDEX IF NOT EXISTS idx_sim_audit_action_created
    ON public.sim_audit_log(action, created_at DESC);

-- API audit by endpoint
CREATE INDEX IF NOT EXISTS idx_api_audit_endpoint
    ON public.api_audit_log(endpoint);

-- API audit by status for error analysis
CREATE INDEX IF NOT EXISTS idx_api_audit_status_code
    ON public.api_audit_log(status_code)
    WHERE status_code >= 400;

-- ============================================================================
-- 12. ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================

ANALYZE public.devices;
ANALYZE public.sim_cards;
ANALYZE public.device_location_history;
ANALYZE public.device_sensor_history;
ANALYZE public.provisioned_sims;
ANALYZE public.usage_records;
ANALYZE public.usage_cycles;
ANALYZE public.api_clients;
ANALYZE public.webhooks;
ANALYZE public.webhook_deliveries;
ANALYZE public.sim_audit_log;
ANALYZE public.api_audit_log;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename IN (
        'devices', 'sim_cards', 'device_location_history',
        'device_sensor_history', 'provisioned_sims', 'usage_records',
        'usage_cycles', 'api_clients', 'webhooks', 'webhook_deliveries',
        'sim_audit_log', 'api_audit_log'
    );

    RAISE NOTICE 'Migration 102: Index optimization complete.';
    RAISE NOTICE 'Total indexes on main tables: %', index_count;
END $$;

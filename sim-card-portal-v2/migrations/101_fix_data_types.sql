-- ============================================================================
-- Migration: 101_fix_data_types.sql
-- Description: Fix data types for Supabase compatibility
-- Version: 1.0
-- Date: December 2024
--
-- This migration:
-- 1. Converts VARCHAR data_used/data_limit to BIGINT (bytes) in sim_cards
-- 2. Ensures proper numeric handling for all BIGINT columns
-- 3. Adds helper views for backwards compatibility
-- ============================================================================

-- ============================================================================
-- 1. ADD NEW BIGINT COLUMNS TO sim_cards
-- ============================================================================

-- Add new columns for byte values
ALTER TABLE public.sim_cards
    ADD COLUMN IF NOT EXISTS data_used_bytes BIGINT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS data_limit_bytes BIGINT DEFAULT 0;

-- ============================================================================
-- 2. MIGRATE DATA FROM VARCHAR TO BIGINT
-- Parse values like "2.4 MB", "10 MB", "1024 MB", "1 GB" to bytes
-- ============================================================================

-- Create a helper function to parse data strings to bytes
CREATE OR REPLACE FUNCTION public.parse_data_to_bytes(data_str VARCHAR)
RETURNS BIGINT AS $$
DECLARE
    numeric_part NUMERIC;
    unit_part VARCHAR;
    result BIGINT;
BEGIN
    -- Handle NULL or empty strings
    IF data_str IS NULL OR TRIM(data_str) = '' THEN
        RETURN 0;
    END IF;

    -- Extract numeric part (handles decimals)
    numeric_part := NULLIF(REGEXP_REPLACE(data_str, '[^0-9.]', '', 'g'), '')::NUMERIC;

    IF numeric_part IS NULL THEN
        RETURN 0;
    END IF;

    -- Extract unit part (MB, GB, KB, etc.)
    unit_part := UPPER(TRIM(REGEXP_REPLACE(data_str, '[0-9. ]', '', 'g')));

    -- Convert to bytes based on unit
    CASE unit_part
        WHEN 'B', 'BYTES' THEN
            result := numeric_part::BIGINT;
        WHEN 'KB', 'K' THEN
            result := (numeric_part * 1024)::BIGINT;
        WHEN 'MB', 'M' THEN
            result := (numeric_part * 1024 * 1024)::BIGINT;
        WHEN 'GB', 'G' THEN
            result := (numeric_part * 1024 * 1024 * 1024)::BIGINT;
        WHEN 'TB', 'T' THEN
            result := (numeric_part * 1024 * 1024 * 1024 * 1024)::BIGINT;
        ELSE
            -- Default to MB if no unit specified
            result := (numeric_part * 1024 * 1024)::BIGINT;
    END CASE;

    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.parse_data_to_bytes(VARCHAR) IS 'Converts human-readable data strings (e.g., "2.4 MB") to bytes';

-- Migrate existing data
UPDATE public.sim_cards
SET
    data_used_bytes = public.parse_data_to_bytes(data_used),
    data_limit_bytes = public.parse_data_to_bytes(data_limit)
WHERE data_used_bytes = 0 OR data_limit_bytes = 0;

-- ============================================================================
-- 3. CREATE HELPER FUNCTION TO FORMAT BYTES AS HUMAN-READABLE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.format_bytes(bytes BIGINT)
RETURNS VARCHAR AS $$
BEGIN
    IF bytes IS NULL THEN
        RETURN '0 B';
    ELSIF bytes < 1024 THEN
        RETURN bytes || ' B';
    ELSIF bytes < 1024 * 1024 THEN
        RETURN ROUND(bytes / 1024.0, 2) || ' KB';
    ELSIF bytes < 1024 * 1024 * 1024 THEN
        RETURN ROUND(bytes / (1024.0 * 1024), 2) || ' MB';
    ELSIF bytes < 1024::BIGINT * 1024 * 1024 * 1024 THEN
        RETURN ROUND(bytes / (1024.0 * 1024 * 1024), 2) || ' GB';
    ELSE
        RETURN ROUND(bytes / (1024.0 * 1024 * 1024 * 1024), 2) || ' TB';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.format_bytes(BIGINT) IS 'Converts bytes to human-readable format (e.g., 2516582 -> "2.4 MB")';

-- ============================================================================
-- 4. CREATE VIEW FOR BACKWARDS COMPATIBILITY
-- ============================================================================

CREATE OR REPLACE VIEW public.sim_cards_formatted AS
SELECT
    id,
    iccid,
    msisdn,
    status,
    carrier,
    plan,
    -- Original VARCHAR columns (for backwards compatibility)
    data_used,
    data_limit,
    -- New BIGINT columns
    data_used_bytes,
    data_limit_bytes,
    -- Formatted versions from BIGINT
    public.format_bytes(data_used_bytes) AS data_used_formatted,
    public.format_bytes(data_limit_bytes) AS data_limit_formatted,
    -- Usage percentage
    CASE
        WHEN data_limit_bytes > 0 THEN
            ROUND((data_used_bytes::NUMERIC / data_limit_bytes::NUMERIC) * 100, 2)
        ELSE 0
    END AS usage_percentage,
    activation_date,
    expiry_date,
    created_at,
    updated_at
FROM public.sim_cards;

COMMENT ON VIEW public.sim_cards_formatted IS 'SIM cards with formatted data usage values for UI display';

-- ============================================================================
-- 5. ADD CHECK CONSTRAINTS FOR DATA INTEGRITY
-- ============================================================================

-- Ensure bytes values are non-negative
ALTER TABLE public.sim_cards
    ADD CONSTRAINT chk_data_used_bytes_positive
        CHECK (data_used_bytes >= 0),
    ADD CONSTRAINT chk_data_limit_bytes_positive
        CHECK (data_limit_bytes >= 0);

-- ============================================================================
-- 6. OPTIONAL: DROP OLD VARCHAR COLUMNS
-- Uncomment after verifying application is updated to use _bytes columns
-- ============================================================================

-- ALTER TABLE public.sim_cards DROP COLUMN data_used;
-- ALTER TABLE public.sim_cards DROP COLUMN data_limit;

-- ============================================================================
-- 7. ENSURE BIGINT HANDLING IN PROVISIONED_SIMS
-- (Already using BIGINT, but add constraint)
-- ============================================================================

ALTER TABLE public.provisioned_sims
    ADD CONSTRAINT IF NOT EXISTS chk_provisioned_data_limit_positive
        CHECK (data_limit_bytes IS NULL OR data_limit_bytes >= 0);

-- ============================================================================
-- 8. ADD INDEXES ON NEW COLUMNS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sim_cards_data_used_bytes
    ON public.sim_cards(data_used_bytes);

CREATE INDEX IF NOT EXISTS idx_sim_cards_data_limit_bytes
    ON public.sim_cards(data_limit_bytes);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
DECLARE
    migrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO migrated_count
    FROM public.sim_cards
    WHERE data_used_bytes > 0 OR data_limit_bytes > 0;

    RAISE NOTICE 'Migration 101: Data type fixes complete.';
    RAISE NOTICE 'Migrated % SIM cards with data values.', migrated_count;
    RAISE NOTICE 'Old VARCHAR columns (data_used, data_limit) retained for backwards compatibility.';
    RAISE NOTICE 'Applications should migrate to using data_used_bytes and data_limit_bytes columns.';
END $$;

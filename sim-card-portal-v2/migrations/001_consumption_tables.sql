-- ============================================================================
-- Migration: 001_consumption_tables.sql
-- Description: Create tables for Consumption Dashboard
-- Run this in Supabase SQL Editor after 000_supabase_init.sql
-- ============================================================================

-- ============================================================================
-- 1. USAGE AGGREGATIONS TABLE
-- Pre-aggregated usage data for dashboard performance
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_aggregations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  carrier_id VARCHAR REFERENCES public.carriers(id),
  total_data_bytes BIGINT DEFAULT 0,
  total_cost NUMERIC(12, 2) DEFAULT 0,
  active_sim_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_aggregations_period
  ON public.usage_aggregations(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_usage_aggregations_carrier
  ON public.usage_aggregations(carrier_id);

-- ============================================================================
-- 1b. DAILY USAGE TABLE
-- Granular daily usage data for daily/weekly/monthly aggregation
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_date DATE NOT NULL,
  carrier_id VARCHAR REFERENCES public.carriers(id),
  data_bytes BIGINT DEFAULT 0,
  cost NUMERIC(10, 2) DEFAULT 0,
  active_sim_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_usage_date ON public.daily_usage(usage_date);
CREATE INDEX IF NOT EXISTS idx_daily_usage_carrier ON public.daily_usage(carrier_id, usage_date);

-- ============================================================================
-- 2. INVOICES TABLE
-- Billing records with ERPNext integration
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR NOT NULL UNIQUE,
  carrier_id VARCHAR REFERENCES public.carriers(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'CHF',
  status VARCHAR(20) CHECK (status IN ('pending', 'paid', 'overdue', 'disputed')) DEFAULT 'pending',
  due_date DATE,
  paid_date DATE,
  pdf_url VARCHAR,
  erpnext_reference VARCHAR,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_carrier ON public.invoices(carrier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON public.invoices(period_start, period_end);

-- Add updated_at trigger
DROP TRIGGER IF EXISTS set_invoices_updated_at ON public.invoices;
CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 3. LLM CONVERSATIONS TABLE
-- Chat history for Ask Bob feature
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.llm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  chart_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_conversations_session
  ON public.llm_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_llm_conversations_created
  ON public.llm_conversations(created_at);

-- ============================================================================
-- 4. SAMPLE DATA FOR DEVELOPMENT
-- ============================================================================

-- Insert sample usage aggregations (last 6 months)
INSERT INTO public.usage_aggregations (period_start, period_end, carrier_id, total_data_bytes, total_cost, active_sim_count) VALUES
  -- November 2024
  ('2024-11-01', '2024-11-30', 'carrier_001', 52428800000, 1250.00, 4),  -- 50 GB Swisscom
  ('2024-11-01', '2024-11-30', 'carrier_002', 31457280000, 890.00, 2),   -- 30 GB Sunrise
  ('2024-11-01', '2024-11-30', 'carrier_003', 10485760000, 320.00, 1),   -- 10 GB Salt
  -- October 2024
  ('2024-10-01', '2024-10-31', 'carrier_001', 47185920000, 1180.00, 4),  -- 45 GB Swisscom
  ('2024-10-01', '2024-10-31', 'carrier_002', 26843545600, 780.00, 2),   -- 25 GB Sunrise
  ('2024-10-01', '2024-10-31', 'carrier_003', 8589934592, 280.00, 1),    -- 8 GB Salt
  -- September 2024
  ('2024-09-01', '2024-09-30', 'carrier_001', 42949672960, 1100.00, 4),  -- 40 GB Swisscom
  ('2024-09-01', '2024-09-30', 'carrier_002', 21474836480, 650.00, 2),   -- 20 GB Sunrise
  ('2024-09-01', '2024-09-30', 'carrier_003', 7516192768, 240.00, 1),    -- 7 GB Salt
  -- August 2024
  ('2024-08-01', '2024-08-31', 'carrier_001', 38654705664, 980.00, 3),   -- 36 GB Swisscom
  ('2024-08-01', '2024-08-31', 'carrier_002', 19327352832, 580.00, 2),   -- 18 GB Sunrise
  ('2024-08-01', '2024-08-31', 'carrier_003', 6442450944, 210.00, 1),    -- 6 GB Salt
  -- July 2024
  ('2024-07-01', '2024-07-31', 'carrier_001', 34359738368, 870.00, 3),   -- 32 GB Swisscom
  ('2024-07-01', '2024-07-31', 'carrier_002', 16106127360, 490.00, 2),   -- 15 GB Sunrise
  ('2024-07-01', '2024-07-31', 'carrier_003', 5368709120, 180.00, 1),    -- 5 GB Salt
  -- June 2024
  ('2024-06-01', '2024-06-30', 'carrier_001', 32212254720, 820.00, 3),   -- 30 GB Swisscom
  ('2024-06-01', '2024-06-30', 'carrier_002', 14495514624, 440.00, 2),   -- 13.5 GB Sunrise
  ('2024-06-01', '2024-06-30', 'carrier_003', 4831838208, 160.00, 1)     -- 4.5 GB Salt
ON CONFLICT DO NOTHING;

-- Insert sample invoices
INSERT INTO public.invoices (invoice_number, carrier_id, period_start, period_end, total_amount, currency, status, due_date, paid_date, erpnext_reference) VALUES
  ('INV-2024-11-001', 'carrier_001', '2024-11-01', '2024-11-30', 1250.00, 'CHF', 'pending', '2024-12-15', NULL, 'SINV-00234'),
  ('INV-2024-11-002', 'carrier_002', '2024-11-01', '2024-11-30', 890.00, 'CHF', 'pending', '2024-12-15', NULL, 'SINV-00235'),
  ('INV-2024-11-003', 'carrier_003', '2024-11-01', '2024-11-30', 320.00, 'CHF', 'pending', '2024-12-15', NULL, 'SINV-00236'),
  ('INV-2024-10-001', 'carrier_001', '2024-10-01', '2024-10-31', 1180.00, 'CHF', 'paid', '2024-11-15', '2024-11-10', 'SINV-00201'),
  ('INV-2024-10-002', 'carrier_002', '2024-10-01', '2024-10-31', 780.00, 'CHF', 'paid', '2024-11-15', '2024-11-12', 'SINV-00202'),
  ('INV-2024-10-003', 'carrier_003', '2024-10-01', '2024-10-31', 280.00, 'CHF', 'paid', '2024-11-15', '2024-11-08', 'SINV-00203'),
  ('INV-2024-09-001', 'carrier_001', '2024-09-01', '2024-09-30', 1100.00, 'CHF', 'paid', '2024-10-15', '2024-10-14', 'SINV-00178'),
  ('INV-2024-09-002', 'carrier_002', '2024-09-01', '2024-09-30', 650.00, 'CHF', 'paid', '2024-10-15', '2024-10-10', 'SINV-00179'),
  ('INV-2024-09-003', 'carrier_003', '2024-09-01', '2024-09-30', 240.00, 'CHF', 'paid', '2024-10-15', '2024-10-09', 'SINV-00180')
ON CONFLICT (invoice_number) DO NOTHING;

-- ============================================================================
-- 5. GENERATE DAILY USAGE DATA (for granular trends)
-- Generates 6 months of daily usage data with realistic patterns
-- ============================================================================

DO $$
DECLARE
  d DATE;
  day_factor NUMERIC;
  month_factor NUMERIC;
  random_factor NUMERIC;
  data_bytes BIGINT;
  cost_val NUMERIC;
  sim_count INTEGER;
BEGIN
  -- Delete existing daily usage data
  DELETE FROM public.daily_usage;

  -- Loop through dates (last 6 months)
  FOR d IN SELECT generate_series(
    (CURRENT_DATE - INTERVAL '6 months')::date,
    CURRENT_DATE,
    '1 day'::interval
  )::date
  LOOP
    -- Calculate day factor (weekday vs weekend)
    IF EXTRACT(DOW FROM d) IN (0, 6) THEN
      day_factor := 0.6;  -- Weekend: 60% of normal traffic
    ELSE
      day_factor := 1.0 + (EXTRACT(DOW FROM d) - 3) * 0.05;  -- Weekday variation
    END IF;

    -- Month factor (gradual growth over time)
    month_factor := 2.0 + ((d - (CURRENT_DATE - INTERVAL '6 months')::date) / 30.0) * 0.15;

    -- Carrier 1: Swisscom (~55% market share)
    random_factor := 0.85 + (RANDOM() * 0.3);
    data_bytes := (day_factor * 0.55 * month_factor * random_factor * 1073741824)::bigint;
    cost_val := (day_factor * 0.55 * month_factor * random_factor * 25)::numeric(10,2);
    sim_count := CASE WHEN EXTRACT(MONTH FROM d) > EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '4 months') THEN 4 ELSE 3 END;
    INSERT INTO public.daily_usage (usage_date, carrier_id, data_bytes, cost, active_sim_count)
    VALUES (d, 'carrier_001', data_bytes, cost_val, sim_count);

    -- Carrier 2: Sunrise (~32% market share)
    random_factor := 0.85 + (RANDOM() * 0.3);
    data_bytes := (day_factor * 0.32 * month_factor * random_factor * 1073741824)::bigint;
    cost_val := (day_factor * 0.32 * month_factor * random_factor * 28)::numeric(10,2);
    sim_count := CASE WHEN EXTRACT(MONTH FROM d) > EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '3 months') THEN 3 ELSE 2 END;
    INSERT INTO public.daily_usage (usage_date, carrier_id, data_bytes, cost, active_sim_count)
    VALUES (d, 'carrier_002', data_bytes, cost_val, sim_count);

    -- Carrier 3: Salt (~13% market share)
    random_factor := 0.85 + (RANDOM() * 0.3);
    data_bytes := (day_factor * 0.13 * month_factor * random_factor * 1073741824)::bigint;
    cost_val := (day_factor * 0.13 * month_factor * random_factor * 30)::numeric(10,2);
    INSERT INTO public.daily_usage (usage_date, carrier_id, data_bytes, cost, active_sim_count)
    VALUES (d, 'carrier_003', data_bytes, cost_val, 1);
  END LOOP;

  RAISE NOTICE 'Generated daily usage data for % days', (SELECT COUNT(DISTINCT usage_date) FROM public.daily_usage);
END $$;

-- ============================================================================
-- Done! Consumption tables are now ready.
-- ============================================================================

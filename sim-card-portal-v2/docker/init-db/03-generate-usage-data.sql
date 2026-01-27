-- ============================================================================
-- SIM Card Portal - Generate Dynamic Usage Data
-- Uses current dates for realistic demo data
-- ============================================================================

-- ============================================================================
-- GENERATE DAILY USAGE (last 6 months)
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
  DELETE FROM daily_usage;

  FOR d IN SELECT generate_series(
    (CURRENT_DATE - INTERVAL '6 months')::date,
    CURRENT_DATE,
    '1 day'::interval
  )::date
  LOOP
    IF EXTRACT(DOW FROM d) IN (0, 6) THEN
      day_factor := 0.6;
    ELSE
      day_factor := 1.0 + (EXTRACT(DOW FROM d) - 3) * 0.05;
    END IF;

    month_factor := 2.0 + ((d - (CURRENT_DATE - INTERVAL '6 months')::date) / 30.0) * 0.15;

    -- Carrier 1: Swisscom
    random_factor := 0.85 + (RANDOM() * 0.3);
    data_bytes := (day_factor * 0.55 * month_factor * random_factor * 1073741824)::bigint;
    cost_val := (day_factor * 0.55 * month_factor * random_factor * 25)::numeric(10,2);
    sim_count := CASE WHEN d > CURRENT_DATE - INTERVAL '4 months' THEN 4 ELSE 3 END;
    INSERT INTO daily_usage (usage_date, carrier_id, data_bytes, cost, active_sim_count)
    VALUES (d, 'carrier_001', data_bytes, cost_val, sim_count);

    -- Carrier 2: Sunrise
    random_factor := 0.85 + (RANDOM() * 0.3);
    data_bytes := (day_factor * 0.32 * month_factor * random_factor * 1073741824)::bigint;
    cost_val := (day_factor * 0.32 * month_factor * random_factor * 28)::numeric(10,2);
    sim_count := CASE WHEN d > CURRENT_DATE - INTERVAL '3 months' THEN 3 ELSE 2 END;
    INSERT INTO daily_usage (usage_date, carrier_id, data_bytes, cost, active_sim_count)
    VALUES (d, 'carrier_002', data_bytes, cost_val, sim_count);

    -- Carrier 3: Salt
    random_factor := 0.85 + (RANDOM() * 0.3);
    data_bytes := (day_factor * 0.13 * month_factor * random_factor * 1073741824)::bigint;
    cost_val := (day_factor * 0.13 * month_factor * random_factor * 30)::numeric(10,2);
    INSERT INTO daily_usage (usage_date, carrier_id, data_bytes, cost, active_sim_count)
    VALUES (d, 'carrier_003', data_bytes, cost_val, 1);
  END LOOP;

  RAISE NOTICE 'Generated % days of daily usage data', (SELECT COUNT(DISTINCT usage_date) FROM daily_usage);
END $$;

-- ============================================================================
-- GENERATE USAGE AGGREGATIONS (monthly summaries)
-- ============================================================================

DELETE FROM usage_aggregations;
INSERT INTO usage_aggregations (period_start, period_end, carrier_id, total_data_bytes, total_cost, active_sim_count)
SELECT 
  date_trunc('month', usage_date)::date,
  (date_trunc('month', usage_date) + interval '1 month' - interval '1 day')::date,
  carrier_id,
  SUM(data_bytes),
  SUM(cost),
  MAX(active_sim_count)
FROM daily_usage
GROUP BY date_trunc('month', usage_date), carrier_id;

-- ============================================================================
-- GENERATE USAGE RECORDS (CDR data for current month)
-- ============================================================================

DELETE FROM usage_records;
INSERT INTO usage_records (record_id, iccid, period_start, period_end, data_upload_bytes, data_download_bytes, total_bytes, status)
SELECT 
  'rec_' || encode(gen_random_bytes(8), 'hex'),
  s.iccid,
  (date_trunc('day', CURRENT_DATE - (g * 3) * interval '1 day'))::timestamptz,
  (date_trunc('day', CURRENT_DATE - (g * 3) * interval '1 day') + interval '1 day')::timestamptz,
  (RANDOM() * 500000000)::bigint,
  (RANDOM() * 2000000000)::bigint,
  (RANDOM() * 2500000000)::bigint,
  'PROCESSED'
FROM sim_cards s
CROSS JOIN generate_series(0, 9) g
WHERE s.status = 'Active';

-- ============================================================================
-- GENERATE USAGE CYCLES (billing periods)
-- ============================================================================

DELETE FROM usage_cycles;
INSERT INTO usage_cycles (iccid, cycle_id, cycle_start, cycle_end, total_bytes, total_upload_bytes, total_download_bytes, is_current)
SELECT 
  s.iccid,
  to_char(CURRENT_DATE, 'YYYY-MM'),
  date_trunc('month', CURRENT_DATE),
  date_trunc('month', CURRENT_DATE) + interval '1 month',
  (RANDOM() * 5 + 1) * 1073741824,
  (RANDOM() * 2) * 1073741824,
  (RANDOM() * 4) * 1073741824,
  true
FROM sim_cards s
WHERE s.status = 'Active';

-- ============================================================================
-- GENERATE INVOICES (last 3 months)
-- ============================================================================

DELETE FROM invoices;
INSERT INTO invoices (invoice_number, carrier_id, period_start, period_end, total_amount, currency, status, due_date, paid_date, erpnext_reference)
SELECT
  'INV-' || to_char(m.month_date, 'YYYY-MM') || '-00' || c.num,
  c.carrier_id,
  date_trunc('month', m.month_date)::date,
  (date_trunc('month', m.month_date) + interval '1 month' - interval '1 day')::date,
  (800 + RANDOM() * 500)::numeric(12,2),
  'CHF',
  CASE 
    WHEN m.month_date >= date_trunc('month', CURRENT_DATE) THEN 'pending'
    ELSE 'paid'
  END,
  (date_trunc('month', m.month_date) + interval '1 month' + interval '15 days')::date,
  CASE 
    WHEN m.month_date >= date_trunc('month', CURRENT_DATE) THEN NULL
    ELSE (date_trunc('month', m.month_date) + interval '1 month' + interval '10 days')::date
  END,
  'SINV-00' || (300 + c.num + m.offset * 3)::text
FROM (
  SELECT 'carrier_001' as carrier_id, 1 as num UNION ALL
  SELECT 'carrier_002', 2 UNION ALL
  SELECT 'carrier_003', 3
) c
CROSS JOIN (
  SELECT CURRENT_DATE as month_date, 0 as offset UNION ALL
  SELECT CURRENT_DATE - interval '1 month', 1 UNION ALL
  SELECT CURRENT_DATE - interval '2 months', 2
) m;


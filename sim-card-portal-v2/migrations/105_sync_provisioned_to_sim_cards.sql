-- Migration 105: Sync provisioned_sims to sim_cards
-- When SIMs are provisioned/activated/blocked via the Provisioning API,
-- the changes should be reflected in the sim_cards table for the SIM Management page.

-- Status mapping:
-- provisioned_sims.status -> sim_cards.status
-- PROVISIONED -> available
-- ACTIVE -> Active
-- INACTIVE -> Inactive
-- BLOCKED -> Suspended

-- Function to map provisioned_sims status to sim_cards status
CREATE OR REPLACE FUNCTION map_provisioned_status(prov_status VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
  CASE prov_status
    WHEN 'PROVISIONED' THEN RETURN 'available';
    WHEN 'ACTIVE' THEN RETURN 'Active';
    WHEN 'INACTIVE' THEN RETURN 'Inactive';
    WHEN 'BLOCKED' THEN RETURN 'Suspended';
    ELSE RETURN 'Inactive';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to sync provisioned_sims to sim_cards
CREATE OR REPLACE FUNCTION sync_provisioned_to_sim_cards()
RETURNS TRIGGER AS $$
DECLARE
  default_carrier_id VARCHAR := 'carrier_001';  -- Swisscom as default
  default_plan_id VARCHAR := 'plan_001';        -- IoT Basic as default
  mapped_plan_id VARCHAR;
  mapped_status VARCHAR;
BEGIN
  -- Map the status
  mapped_status := map_provisioned_status(NEW.status);

  -- Try to map rate_plan_id to plan_id (e.g., plan_001, plan_iot_standard -> plan_001)
  -- First check if the rate_plan_id directly matches a plan
  SELECT id INTO mapped_plan_id FROM plans WHERE id = NEW.rate_plan_id;
  IF mapped_plan_id IS NULL THEN
    -- Try matching by similar name
    SELECT id INTO mapped_plan_id FROM plans
    WHERE NEW.rate_plan_id ILIKE '%' || REPLACE(name, ' ', '_') || '%'
    LIMIT 1;
  END IF;
  IF mapped_plan_id IS NULL THEN
    mapped_plan_id := default_plan_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Check if SIM already exists in sim_cards by ICCID
    IF NOT EXISTS (SELECT 1 FROM sim_cards WHERE iccid = NEW.iccid) THEN
      INSERT INTO sim_cards (
        id,
        iccid,
        msisdn,
        status,
        carrier_id,
        plan_id,
        data_used,
        data_limit,
        activation_date,
        created_at,
        updated_at
      ) VALUES (
        NEW.sim_id,                                    -- Use sim_id as id
        NEW.iccid,
        NEW.msisdn,
        mapped_status,
        default_carrier_id,
        mapped_plan_id,
        '0 MB',                                        -- Initial data used
        CASE
          WHEN NEW.data_limit_bytes IS NOT NULL
          THEN (NEW.data_limit_bytes / 1073741824.0)::TEXT || ' GB'
          ELSE '1 GB'
        END,
        CASE
          WHEN NEW.activated_at IS NOT NULL
          THEN NEW.activated_at::DATE
          ELSE NULL
        END,
        NOW(),
        NOW()
      );
    ELSE
      -- Update existing record if ICCID matches but status differs
      UPDATE sim_cards
      SET
        status = mapped_status,
        msisdn = COALESCE(NEW.msisdn, msisdn),
        activation_date = CASE
          WHEN NEW.activated_at IS NOT NULL
          THEN NEW.activated_at::DATE
          ELSE activation_date
        END,
        updated_at = NOW()
      WHERE iccid = NEW.iccid;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Update the sim_cards record
    UPDATE sim_cards
    SET
      status = mapped_status,
      msisdn = COALESCE(NEW.msisdn, msisdn),
      activation_date = CASE
        WHEN NEW.activated_at IS NOT NULL AND OLD.activated_at IS NULL
        THEN NEW.activated_at::DATE
        ELSE activation_date
      END,
      updated_at = NOW()
    WHERE iccid = NEW.iccid OR id = NEW.sim_id;

  ELSIF TG_OP = 'DELETE' THEN
    -- Optionally delete from sim_cards (or set to Terminated)
    UPDATE sim_cards
    SET
      status = 'Terminated',
      updated_at = NOW()
    WHERE iccid = OLD.iccid OR id = OLD.sim_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_sync_provisioned_to_sim_cards ON provisioned_sims;

-- Create trigger on provisioned_sims
CREATE TRIGGER trigger_sync_provisioned_to_sim_cards
  AFTER INSERT OR UPDATE OR DELETE ON provisioned_sims
  FOR EACH ROW
  EXECUTE FUNCTION sync_provisioned_to_sim_cards();

-- Sync existing provisioned_sims to sim_cards (one-time migration)
INSERT INTO sim_cards (id, iccid, msisdn, status, carrier_id, plan_id, data_used, data_limit, activation_date, created_at, updated_at)
SELECT
  p.sim_id,
  p.iccid,
  p.msisdn,
  map_provisioned_status(p.status),
  'carrier_001',
  'plan_001',
  '0 MB',
  CASE
    WHEN p.data_limit_bytes IS NOT NULL
    THEN (p.data_limit_bytes / 1073741824.0)::TEXT || ' GB'
    ELSE '1 GB'
  END,
  CASE
    WHEN p.activated_at IS NOT NULL
    THEN p.activated_at::DATE
    ELSE NULL
  END,
  p.created_at,
  p.updated_at
FROM provisioned_sims p
WHERE NOT EXISTS (
  SELECT 1 FROM sim_cards s WHERE s.iccid = p.iccid
)
ON CONFLICT (iccid) DO UPDATE SET
  status = EXCLUDED.status,
  msisdn = EXCLUDED.msisdn,
  updated_at = NOW();

-- Add comment explaining the sync
COMMENT ON TRIGGER trigger_sync_provisioned_to_sim_cards ON provisioned_sims IS
  'Syncs SIM provisioning changes to sim_cards table for SIM Management page';

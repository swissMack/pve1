-- Migration: Insert 10 available SIM cards for device assignment
-- These SIM cards will be available for assignment to devices

INSERT INTO "sim-card-portal-v2".sim_cards (id, iccid, msisdn, status, carrier, plan, data_used, data_limit, activation_date, expiry_date)
VALUES
  ('SIM-AVAIL-001', '8901234567890100001', '+41791000001', 'Inactive', 'Swisscom', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-01-01', '2025-01-01'),
  ('SIM-AVAIL-002', '8901234567890100002', '+41791000002', 'Inactive', 'Swisscom', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-01-01', '2025-01-01'),
  ('SIM-AVAIL-003', '8901234567890100003', '+41791000003', 'Inactive', 'Sunrise', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-01-01', '2025-01-01'),
  ('SIM-AVAIL-004', '8901234567890100004', '+41791000004', 'Inactive', 'Sunrise', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-01-01', '2025-01-01'),
  ('SIM-AVAIL-005', '8901234567890100005', '+41791000005', 'Inactive', 'Salt', 'IoT Enterprise 1GB', '0 MB', '1024 MB', '2024-01-01', '2025-01-01'),
  ('SIM-AVAIL-006', '8901234567890100006', '+41791000006', 'Inactive', 'Salt', 'IoT Enterprise 1GB', '0 MB', '1024 MB', '2024-01-01', '2025-01-01'),
  ('SIM-AVAIL-007', '8901234567890100007', '+41791000007', 'Inactive', 'Swisscom', 'IoT Standard 250MB', '0 MB', '250 MB', '2024-01-01', '2025-01-01'),
  ('SIM-AVAIL-008', '8901234567890100008', '+41791000008', 'Inactive', 'Sunrise', 'IoT Standard 250MB', '0 MB', '250 MB', '2024-01-01', '2025-01-01'),
  ('SIM-AVAIL-009', '8901234567890100009', '+41791000009', 'Inactive', 'Salt', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-01-01', '2025-01-01'),
  ('SIM-AVAIL-010', '8901234567890100010', '+41791000010', 'Inactive', 'Swisscom', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-01-01', '2025-01-01')
ON CONFLICT (id) DO NOTHING;

-- Add comment
COMMENT ON TABLE "sim-card-portal-v2".sim_cards IS 'SIM cards for device connectivity. Status "Inactive" means available for assignment, "Active" means assigned to a device.';

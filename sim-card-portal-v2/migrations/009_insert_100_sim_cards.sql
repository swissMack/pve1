-- Migration: Insert 100 available SIM cards for device assignment
-- These SIM cards are available (Inactive status) for assignment to new devices
-- Once assigned to a device, status can be changed to Active

-- Carriers: Swisscom, Sunrise, Salt, Vodafone, T-Mobile, Orange, Three, EE
-- Plans: IoT Basic 100MB, IoT Standard 250MB, IoT Pro 500MB, IoT Enterprise 1GB, IoT Unlimited 5GB

INSERT INTO "sim-card-portal-v2".sim_cards (id, iccid, msisdn, status, carrier, plan, data_used, data_limit, activation_date, expiry_date)
VALUES
  -- Swisscom SIMs (25 cards)
  ('SIM-NEW-001', '8941001234567890001', '+41791100001', 'Inactive', 'Swisscom', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-002', '8941001234567890002', '+41791100002', 'Inactive', 'Swisscom', 'IoT Standard 250MB', '0 MB', '250 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-003', '8941001234567890003', '+41791100003', 'Inactive', 'Swisscom', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-004', '8941001234567890004', '+41791100004', 'Inactive', 'Swisscom', 'IoT Enterprise 1GB', '0 MB', '1024 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-005', '8941001234567890005', '+41791100005', 'Inactive', 'Swisscom', 'IoT Unlimited 5GB', '0 MB', '5120 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-006', '8941001234567890006', '+41791100006', 'Inactive', 'Swisscom', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-007', '8941001234567890007', '+41791100007', 'Inactive', 'Swisscom', 'IoT Standard 250MB', '0 MB', '250 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-008', '8941001234567890008', '+41791100008', 'Inactive', 'Swisscom', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-009', '8941001234567890009', '+41791100009', 'Inactive', 'Swisscom', 'IoT Enterprise 1GB', '0 MB', '1024 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-010', '8941001234567890010', '+41791100010', 'Inactive', 'Swisscom', 'IoT Unlimited 5GB', '0 MB', '5120 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-011', '8941001234567890011', '+41791100011', 'Inactive', 'Swisscom', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-012', '8941001234567890012', '+41791100012', 'Inactive', 'Swisscom', 'IoT Standard 250MB', '0 MB', '250 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-013', '8941001234567890013', '+41791100013', 'Inactive', 'Swisscom', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-014', '8941001234567890014', '+41791100014', 'Inactive', 'Swisscom', 'IoT Enterprise 1GB', '0 MB', '1024 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-015', '8941001234567890015', '+41791100015', 'Inactive', 'Swisscom', 'IoT Unlimited 5GB', '0 MB', '5120 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-016', '8941001234567890016', '+41791100016', 'Inactive', 'Swisscom', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-017', '8941001234567890017', '+41791100017', 'Inactive', 'Swisscom', 'IoT Standard 250MB', '0 MB', '250 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-018', '8941001234567890018', '+41791100018', 'Inactive', 'Swisscom', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-019', '8941001234567890019', '+41791100019', 'Inactive', 'Swisscom', 'IoT Enterprise 1GB', '0 MB', '1024 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-020', '8941001234567890020', '+41791100020', 'Inactive', 'Swisscom', 'IoT Unlimited 5GB', '0 MB', '5120 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-021', '8941001234567890021', '+41791100021', 'Inactive', 'Swisscom', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-022', '8941001234567890022', '+41791100022', 'Inactive', 'Swisscom', 'IoT Standard 250MB', '0 MB', '250 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-023', '8941001234567890023', '+41791100023', 'Inactive', 'Swisscom', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-024', '8941001234567890024', '+41791100024', 'Inactive', 'Swisscom', 'IoT Enterprise 1GB', '0 MB', '1024 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-025', '8941001234567890025', '+41791100025', 'Inactive', 'Swisscom', 'IoT Unlimited 5GB', '0 MB', '5120 MB', '2024-09-01', '2026-09-01'),

  -- Sunrise SIMs (25 cards)
  ('SIM-NEW-026', '8941002234567890026', '+41791200026', 'Inactive', 'Sunrise', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-027', '8941002234567890027', '+41791200027', 'Inactive', 'Sunrise', 'IoT Standard 250MB', '0 MB', '250 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-028', '8941002234567890028', '+41791200028', 'Inactive', 'Sunrise', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-029', '8941002234567890029', '+41791200029', 'Inactive', 'Sunrise', 'IoT Enterprise 1GB', '0 MB', '1024 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-030', '8941002234567890030', '+41791200030', 'Inactive', 'Sunrise', 'IoT Unlimited 5GB', '0 MB', '5120 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-031', '8941002234567890031', '+41791200031', 'Inactive', 'Sunrise', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-06-15', '2026-06-15'),
  ('SIM-NEW-032', '8941002234567890032', '+41791200032', 'Inactive', 'Sunrise', 'IoT Standard 250MB', '0 MB', '250 MB', '2024-06-15', '2026-06-15'),
  ('SIM-NEW-033', '8941002234567890033', '+41791200033', 'Inactive', 'Sunrise', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-06-15', '2026-06-15'),
  ('SIM-NEW-034', '8941002234567890034', '+41791200034', 'Inactive', 'Sunrise', 'IoT Enterprise 1GB', '0 MB', '1024 MB', '2024-06-15', '2026-06-15'),
  ('SIM-NEW-035', '8941002234567890035', '+41791200035', 'Inactive', 'Sunrise', 'IoT Unlimited 5GB', '0 MB', '5120 MB', '2024-06-15', '2026-06-15'),
  ('SIM-NEW-036', '8941002234567890036', '+41791200036', 'Inactive', 'Sunrise', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-037', '8941002234567890037', '+41791200037', 'Inactive', 'Sunrise', 'IoT Standard 250MB', '0 MB', '250 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-038', '8941002234567890038', '+41791200038', 'Inactive', 'Sunrise', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-039', '8941002234567890039', '+41791200039', 'Inactive', 'Sunrise', 'IoT Enterprise 1GB', '0 MB', '1024 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-040', '8941002234567890040', '+41791200040', 'Inactive', 'Sunrise', 'IoT Unlimited 5GB', '0 MB', '5120 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-041', '8941002234567890041', '+41791200041', 'Inactive', 'Sunrise', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-042', '8941002234567890042', '+41791200042', 'Inactive', 'Sunrise', 'IoT Standard 250MB', '0 MB', '250 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-043', '8941002234567890043', '+41791200043', 'Inactive', 'Sunrise', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-044', '8941002234567890044', '+41791200044', 'Inactive', 'Sunrise', 'IoT Enterprise 1GB', '0 MB', '1024 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-045', '8941002234567890045', '+41791200045', 'Inactive', 'Sunrise', 'IoT Unlimited 5GB', '0 MB', '5120 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-046', '8941002234567890046', '+41791200046', 'Inactive', 'Sunrise', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-047', '8941002234567890047', '+41791200047', 'Inactive', 'Sunrise', 'IoT Standard 250MB', '0 MB', '250 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-048', '8941002234567890048', '+41791200048', 'Inactive', 'Sunrise', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-049', '8941002234567890049', '+41791200049', 'Inactive', 'Sunrise', 'IoT Enterprise 1GB', '0 MB', '1024 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-050', '8941002234567890050', '+41791200050', 'Inactive', 'Sunrise', 'IoT Unlimited 5GB', '0 MB', '5120 MB', '2024-09-01', '2026-09-01'),

  -- Salt SIMs (20 cards)
  ('SIM-NEW-051', '8941003234567890051', '+41791300051', 'Inactive', 'Salt', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-052', '8941003234567890052', '+41791300052', 'Inactive', 'Salt', 'IoT Standard 250MB', '0 MB', '250 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-053', '8941003234567890053', '+41791300053', 'Inactive', 'Salt', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-054', '8941003234567890054', '+41791300054', 'Inactive', 'Salt', 'IoT Enterprise 1GB', '0 MB', '1024 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-055', '8941003234567890055', '+41791300055', 'Inactive', 'Salt', 'IoT Unlimited 5GB', '0 MB', '5120 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-056', '8941003234567890056', '+41791300056', 'Inactive', 'Salt', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-057', '8941003234567890057', '+41791300057', 'Inactive', 'Salt', 'IoT Standard 250MB', '0 MB', '250 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-058', '8941003234567890058', '+41791300058', 'Inactive', 'Salt', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-059', '8941003234567890059', '+41791300059', 'Inactive', 'Salt', 'IoT Enterprise 1GB', '0 MB', '1024 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-060', '8941003234567890060', '+41791300060', 'Inactive', 'Salt', 'IoT Unlimited 5GB', '0 MB', '5120 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-061', '8941003234567890061', '+41791300061', 'Inactive', 'Salt', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-062', '8941003234567890062', '+41791300062', 'Inactive', 'Salt', 'IoT Standard 250MB', '0 MB', '250 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-063', '8941003234567890063', '+41791300063', 'Inactive', 'Salt', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-064', '8941003234567890064', '+41791300064', 'Inactive', 'Salt', 'IoT Enterprise 1GB', '0 MB', '1024 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-065', '8941003234567890065', '+41791300065', 'Inactive', 'Salt', 'IoT Unlimited 5GB', '0 MB', '5120 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-066', '8941003234567890066', '+41791300066', 'Inactive', 'Salt', 'IoT Basic 100MB', '0 MB', '100 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-067', '8941003234567890067', '+41791300067', 'Inactive', 'Salt', 'IoT Standard 250MB', '0 MB', '250 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-068', '8941003234567890068', '+41791300068', 'Inactive', 'Salt', 'IoT Pro 500MB', '0 MB', '500 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-069', '8941003234567890069', '+41791300069', 'Inactive', 'Salt', 'IoT Enterprise 1GB', '0 MB', '1024 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-070', '8941003234567890070', '+41791300070', 'Inactive', 'Salt', 'IoT Unlimited 5GB', '0 MB', '5120 MB', '2024-09-01', '2026-09-01'),

  -- Vodafone SIMs (10 cards - international)
  ('SIM-NEW-071', '8944001234567890071', '+447891100071', 'Inactive', 'Vodafone', 'IoT Global 500MB', '0 MB', '500 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-072', '8944001234567890072', '+447891100072', 'Inactive', 'Vodafone', 'IoT Global 500MB', '0 MB', '500 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-073', '8944001234567890073', '+447891100073', 'Inactive', 'Vodafone', 'IoT Global 1GB', '0 MB', '1024 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-074', '8944001234567890074', '+447891100074', 'Inactive', 'Vodafone', 'IoT Global 1GB', '0 MB', '1024 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-075', '8944001234567890075', '+447891100075', 'Inactive', 'Vodafone', 'IoT Global 2GB', '0 MB', '2048 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-076', '8944001234567890076', '+447891100076', 'Inactive', 'Vodafone', 'IoT Global 2GB', '0 MB', '2048 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-077', '8944001234567890077', '+447891100077', 'Inactive', 'Vodafone', 'IoT Global 5GB', '0 MB', '5120 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-078', '8944001234567890078', '+447891100078', 'Inactive', 'Vodafone', 'IoT Global 5GB', '0 MB', '5120 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-079', '8944001234567890079', '+447891100079', 'Inactive', 'Vodafone', 'IoT Global 10GB', '0 MB', '10240 MB', '2024-10-01', '2026-10-01'),
  ('SIM-NEW-080', '8944001234567890080', '+447891100080', 'Inactive', 'Vodafone', 'IoT Global 10GB', '0 MB', '10240 MB', '2024-10-01', '2026-10-01'),

  -- T-Mobile SIMs (10 cards - international)
  ('SIM-NEW-081', '8949001234567890081', '+491701100081', 'Inactive', 'T-Mobile', 'IoT Connect 250MB', '0 MB', '250 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-082', '8949001234567890082', '+491701100082', 'Inactive', 'T-Mobile', 'IoT Connect 250MB', '0 MB', '250 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-083', '8949001234567890083', '+491701100083', 'Inactive', 'T-Mobile', 'IoT Connect 500MB', '0 MB', '500 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-084', '8949001234567890084', '+491701100084', 'Inactive', 'T-Mobile', 'IoT Connect 500MB', '0 MB', '500 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-085', '8949001234567890085', '+491701100085', 'Inactive', 'T-Mobile', 'IoT Connect 1GB', '0 MB', '1024 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-086', '8949001234567890086', '+491701100086', 'Inactive', 'T-Mobile', 'IoT Connect 1GB', '0 MB', '1024 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-087', '8949001234567890087', '+491701100087', 'Inactive', 'T-Mobile', 'IoT Connect 2GB', '0 MB', '2048 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-088', '8949001234567890088', '+491701100088', 'Inactive', 'T-Mobile', 'IoT Connect 2GB', '0 MB', '2048 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-089', '8949001234567890089', '+491701100089', 'Inactive', 'T-Mobile', 'IoT Connect 5GB', '0 MB', '5120 MB', '2024-10-01', '2026-10-01'),
  ('SIM-NEW-090', '8949001234567890090', '+491701100090', 'Inactive', 'T-Mobile', 'IoT Connect 5GB', '0 MB', '5120 MB', '2024-10-01', '2026-10-01'),

  -- Orange SIMs (5 cards - France)
  ('SIM-NEW-091', '8933001234567890091', '+33671100091', 'Inactive', 'Orange', 'IoT M2M 100MB', '0 MB', '100 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-092', '8933001234567890092', '+33671100092', 'Inactive', 'Orange', 'IoT M2M 250MB', '0 MB', '250 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-093', '8933001234567890093', '+33671100093', 'Inactive', 'Orange', 'IoT M2M 500MB', '0 MB', '500 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-094', '8933001234567890094', '+33671100094', 'Inactive', 'Orange', 'IoT M2M 1GB', '0 MB', '1024 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-095', '8933001234567890095', '+33671100095', 'Inactive', 'Orange', 'IoT M2M 2GB', '0 MB', '2048 MB', '2024-10-01', '2026-10-01'),

  -- Three SIMs (5 cards - UK)
  ('SIM-NEW-096', '8944301234567890096', '+447451100096', 'Inactive', 'Three', 'IoT Data 100MB', '0 MB', '100 MB', '2024-06-01', '2026-06-01'),
  ('SIM-NEW-097', '8944301234567890097', '+447451100097', 'Inactive', 'Three', 'IoT Data 250MB', '0 MB', '250 MB', '2024-07-01', '2026-07-01'),
  ('SIM-NEW-098', '8944301234567890098', '+447451100098', 'Inactive', 'Three', 'IoT Data 500MB', '0 MB', '500 MB', '2024-08-01', '2026-08-01'),
  ('SIM-NEW-099', '8944301234567890099', '+447451100099', 'Inactive', 'Three', 'IoT Data 1GB', '0 MB', '1024 MB', '2024-09-01', '2026-09-01'),
  ('SIM-NEW-100', '8944301234567890100', '+447451100100', 'Inactive', 'Three', 'IoT Data 2GB', '0 MB', '2048 MB', '2024-10-01', '2026-10-01')

ON CONFLICT (id) DO NOTHING;

-- Summary: 100 SIM cards inserted
-- Swisscom: 25 cards
-- Sunrise: 25 cards
-- Salt: 20 cards
-- Vodafone: 10 cards (UK)
-- T-Mobile: 10 cards (Germany)
-- Orange: 5 cards (France)
-- Three: 5 cards (UK)

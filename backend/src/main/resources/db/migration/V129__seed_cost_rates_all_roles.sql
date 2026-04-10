-- V129: Seed hourly cost rates for all roles × locations.
--
-- V48 only inserted DEVELOPER rates for US and INDIA.
-- QA, BSA, and TECH_LEAD were missing, so the BudgetPage
-- computed spend = allocatedHours × 0 = 0 → all dashes.
--
-- Rates reflect typical US blended contractor / FTE fully-loaded cost
-- and India offshore blended rate (including benefits & overhead):
--   DEVELOPER  : US $100/hr  INDIA  $50/hr  (already in V48, kept via ON CONFLICT DO NOTHING)
--   QA         : US  $80/hr  INDIA  $35/hr
--   BSA        : US  $90/hr  INDIA  $40/hr
--   TECH_LEAD  : US $120/hr  INDIA  $60/hr

INSERT INTO cost_rate (role, location, hourly_rate) VALUES
  ('DEVELOPER',  'US',    100.00),
  ('DEVELOPER',  'INDIA',  50.00),
  ('QA',         'US',     80.00),
  ('QA',         'INDIA',  35.00),
  ('BSA',        'US',     90.00),
  ('BSA',        'INDIA',  40.00),
  ('TECH_LEAD',  'US',    120.00),
  ('TECH_LEAD',  'INDIA',  60.00)
ON CONFLICT (role, location) DO UPDATE
  SET hourly_rate = EXCLUDED.hourly_rate;

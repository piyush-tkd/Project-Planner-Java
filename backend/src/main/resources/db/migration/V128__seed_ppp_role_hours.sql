-- V128: Back-fill role hours on the project_pod_planning rows inserted by V127.
--
-- V33 replaced the t-shirt-size model with explicit role hours.  V127 only set
-- tshirt_size; the four hours columns defaulted to 0, so the DemandCalculator
-- skips every row (hasHours = false) → utilisation chart shows all dashes.
--
-- T-shirt → total hours mapping (industry-standard sizing for a typical sprint team):
--   XS =   200 h   S =   400 h   M =   800 h   L = 1 600 h   XL = 3 200 h
--
-- Role mix from V2 seed (matches RoleEffortMix table):
--   DEVELOPER 60 %  |  QA 20 %  |  BSA 10 %  |  TECH_LEAD 10 %
--
-- Contingency: 10 % on all rows (industry default).

-- ── XS rows (200 h) ──────────────────────────────────────────────────────────
UPDATE project_pod_planning SET
    dev_hours       = 120,
    qa_hours        =  40,
    bsa_hours       =  20,
    tech_lead_hours =  20,
    contingency_pct =  10
WHERE tshirt_size = 'XS'
  AND dev_hours = 0 AND qa_hours = 0;

-- ── S rows (400 h) ───────────────────────────────────────────────────────────
UPDATE project_pod_planning SET
    dev_hours       = 240,
    qa_hours        =  80,
    bsa_hours       =  40,
    tech_lead_hours =  40,
    contingency_pct =  10
WHERE tshirt_size = 'S'
  AND dev_hours = 0 AND qa_hours = 0;

-- ── M rows (800 h) ───────────────────────────────────────────────────────────
UPDATE project_pod_planning SET
    dev_hours       = 480,
    qa_hours        = 160,
    bsa_hours       =  80,
    tech_lead_hours =  80,
    contingency_pct =  10
WHERE tshirt_size = 'M'
  AND dev_hours = 0 AND qa_hours = 0;

-- ── L rows (1 600 h) ─────────────────────────────────────────────────────────
UPDATE project_pod_planning SET
    dev_hours       =  960,
    qa_hours        =  320,
    bsa_hours       =  160,
    tech_lead_hours =  160,
    contingency_pct =   10
WHERE tshirt_size = 'L'
  AND dev_hours = 0 AND qa_hours = 0;

-- ── XL rows (3 200 h) ────────────────────────────────────────────────────────
UPDATE project_pod_planning SET
    dev_hours       = 1920,
    qa_hours        =  640,
    bsa_hours       =  320,
    tech_lead_hours =  320,
    contingency_pct =   10
WHERE tshirt_size = 'XL'
  AND dev_hours = 0 AND qa_hours = 0;

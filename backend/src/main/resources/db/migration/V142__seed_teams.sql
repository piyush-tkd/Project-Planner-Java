-- V142: Seed sample Core Teams and Project Teams for demo / dev
-- pod columns: id, name, complexity_multiplier, display_order, active, created_at, updated_at
-- + team_type_id, is_active, start_date, target_end_date (added by V132)

-- ── Core Teams ────────────────────────────────────────────────────────────
INSERT INTO pod (name, active, team_type_id)
SELECT t.name, true, tt.id
FROM (VALUES
  ('Platform Core'),
  ('Mobile Core'),
  ('Data Core'),
  ('Security Core'),
  ('DevOps Core')
) AS t(name)
JOIN team_types tt ON tt.name = 'Core Team'
WHERE NOT EXISTS (SELECT 1 FROM pod WHERE pod.name = t.name);

-- ── Project Teams ─────────────────────────────────────────────────────────
INSERT INTO pod (name, active, team_type_id, target_end_date)
SELECT t.name, true, tt.id, t.target_end_date::DATE
FROM (VALUES
  ('Project Phoenix',  '2026-09-30'),
  ('Project Atlas',    '2026-06-30'),
  ('Project Nova',     '2026-12-31'),
  ('Project Horizon',  '2026-08-31'),
  ('Project Forge',    '2026-11-30'),
  ('Project Pulse',    '2027-03-31'),
  ('Project Compass',  '2026-07-31')
) AS t(name, target_end_date)
JOIN team_types tt ON tt.name = 'Project Team'
WHERE NOT EXISTS (SELECT 1 FROM pod WHERE pod.name = t.name);

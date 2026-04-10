-- V133: Scenario planning extensions — changes and snapshots
-- The scenarios table is the existing `scenario` table (V1) + extensions in V138.

CREATE TABLE IF NOT EXISTS scenario_changes (
  id BIGSERIAL PRIMARY KEY,
  scenario_id BIGINT NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  change_type VARCHAR(30) NOT NULL
    CHECK (change_type IN (
      'ADD_RESOURCE','REMOVE_RESOURCE','CHANGE_ALLOCATION',
      'ADD_PROJECT','REMOVE_PROJECT','CHANGE_TEAM_SIZE',
      'HIRE','ATTRITION'
    )),
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('RESOURCE','PROJECT','TEAM','ALLOCATION')),
  entity_id BIGINT,
  change_data JSONB NOT NULL DEFAULT '{}',
  impact_cost NUMERIC(15,2),
  impact_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scenario_snapshots (
  id BIGSERIAL PRIMARY KEY,
  scenario_id BIGINT NOT NULL REFERENCES scenario(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_headcount INTEGER NOT NULL DEFAULT 0,
  total_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
  capex_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  opex_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  demand_coverage_pct NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

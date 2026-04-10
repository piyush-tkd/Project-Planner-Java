-- cost_rates: stores billing/salary rate per resource per period
CREATE TABLE IF NOT EXISTS cost_rates (
  id BIGSERIAL PRIMARY KEY,
  resource_id BIGINT NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
  rate_type VARCHAR(20) NOT NULL CHECK (rate_type IN ('HOURLY','DAILY','MONTHLY','ANNUAL')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(resource_id, effective_from)
);

-- project_value_metrics: tracks projected and actual value per project
CREATE TABLE IF NOT EXISTS project_value_metrics (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  metric_type VARCHAR(30) NOT NULL CHECK (metric_type IN ('REVENUE','COST_SAVINGS','RISK_REDUCTION','STRATEGIC_VALUE')),
  projected_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  actual_value NUMERIC(15,2),
  capex_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  opex_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  measurement_period DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- project cost summary view
CREATE OR REPLACE VIEW project_cost_summary AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  COALESCE(SUM(pvm.capex_amount), 0) AS total_capex,
  COALESCE(SUM(pvm.opex_amount), 0) AS total_opex,
  COALESCE(SUM(pvm.projected_value), 0) AS total_projected_value,
  COALESCE(SUM(pvm.actual_value), 0) AS total_actual_value,
  CASE
    WHEN COALESCE(SUM(pvm.capex_amount) + SUM(pvm.opex_amount), 0) = 0 THEN 0
    ELSE ROUND(
      (COALESCE(SUM(pvm.projected_value), 0) - COALESCE(SUM(pvm.capex_amount) + SUM(pvm.opex_amount), 0))
      / NULLIF(COALESCE(SUM(pvm.capex_amount) + SUM(pvm.opex_amount), 0), 0) * 100,
      2
    )
  END AS roi_percent
FROM project p
LEFT JOIN project_value_metrics pvm ON pvm.project_id = p.id
GROUP BY p.id, p.name;

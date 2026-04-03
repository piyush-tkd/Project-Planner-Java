-- V62: Resource capacity planning columns
-- Adds resource counts per POD planning and parallelization factors to scheduling rules

-- Resource counts on POD planning (how many devs/QAs assigned)
ALTER TABLE project_pod_planning ADD COLUMN IF NOT EXISTS dev_count INT DEFAULT 1;
ALTER TABLE project_pod_planning ADD COLUMN IF NOT EXISTS qa_count INT DEFAULT 1;

-- Parallelization factors on scheduling rules (percentage of work that can be parallelized)
ALTER TABLE scheduling_rules ADD COLUMN IF NOT EXISTS dev_parallel_pct INT DEFAULT 70;
ALTER TABLE scheduling_rules ADD COLUMN IF NOT EXISTS qa_parallel_pct INT DEFAULT 50;
ALTER TABLE scheduling_rules ADD COLUMN IF NOT EXISTS uat_parallel_pct INT DEFAULT 30;

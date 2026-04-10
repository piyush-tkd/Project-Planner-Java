-- V113: Add estimated_budget and actual_cost to project table
ALTER TABLE project
    ADD COLUMN IF NOT EXISTS estimated_budget DECIMAL(15, 2),
    ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(15, 2);

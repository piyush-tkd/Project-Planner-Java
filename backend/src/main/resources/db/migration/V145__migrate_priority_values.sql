-- V145: Migrate project priority values from Px notation to Jira-style names

-- Step 1: Drop the old CHECK constraint that only allows P0/P1/P2/P3
ALTER TABLE project DROP CONSTRAINT IF EXISTS project_priority_check;

-- Step 2: Widen the priority column to accommodate longer values (HIGHEST = 7 chars)
ALTER TABLE project ALTER COLUMN priority TYPE VARCHAR(10);

-- Step 3: Migrate existing Px values to Jira-style names
UPDATE project SET priority = 'HIGHEST' WHERE priority = 'P0';
UPDATE project SET priority = 'HIGH'    WHERE priority = 'P1';
UPDATE project SET priority = 'MEDIUM'  WHERE priority = 'P2';
UPDATE project SET priority = 'LOW'     WHERE priority = 'P3';

-- Step 4: Add a new CHECK constraint for all valid Jira-style priority values
ALTER TABLE project ADD CONSTRAINT project_priority_check
    CHECK (priority IN ('HIGHEST','HIGH','MEDIUM','LOW','LOWEST','BLOCKER','MINOR'));

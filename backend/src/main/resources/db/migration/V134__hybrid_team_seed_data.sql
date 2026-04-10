-- PP-305: Migrate existing POD data to hybrid model
-- Tag all existing PODs as "Core Team" with Permanent allocations for all resources

-- Tag all existing pods as Core Teams
UPDATE pod
SET    team_type_id = (SELECT id FROM team_types WHERE name = 'Core Team'),
       is_active    = true
WHERE  team_type_id IS NULL;

-- Create Permanent 100% allocations for existing resource-pod assignments
INSERT INTO resource_allocations (resource_id, team_id, allocation_type_id, percentage, start_date, is_primary)
SELECT
    rpa.resource_id,
    rpa.pod_id,
    (SELECT id FROM allocation_types WHERE name = 'Permanent'),
    100,
    CURRENT_DATE,
    true
FROM resource_pod_assignment rpa
WHERE NOT EXISTS (
    SELECT 1 FROM resource_allocations ra
    WHERE ra.resource_id = rpa.resource_id
      AND ra.team_id     = rpa.pod_id
);

-- V141: Fix SERIAL (INT) → BIGINT for all sprint-migration tables
-- Hibernate maps Java Long to BIGINT; SERIAL only creates INT sequences.
-- All new sprint entities (TeamType, AllocationType, ResourceAllocation,
-- ResourcePool, ResourcePoolMember, DemandRequest, DemandFulfillment,
-- AllocationHistory) declare Long id fields → need BIGINT columns.
-- Also adds the missing allocation_id column to demand_fulfillments.

-- ── team_types (V132) ─────────────────────────────────────────────────
ALTER TABLE team_types ALTER COLUMN id TYPE BIGINT;
ALTER SEQUENCE IF EXISTS team_types_id_seq AS BIGINT;

-- ── allocation_types (V132) ───────────────────────────────────────────
ALTER TABLE allocation_types ALTER COLUMN id TYPE BIGINT;
ALTER SEQUENCE IF EXISTS allocation_types_id_seq AS BIGINT;

-- ── resource_allocations (V132) ───────────────────────────────────────
ALTER TABLE resource_allocations ALTER COLUMN id TYPE BIGINT;
ALTER SEQUENCE IF EXISTS resource_allocations_id_seq AS BIGINT;
ALTER TABLE resource_allocations ALTER COLUMN resource_id TYPE BIGINT;
ALTER TABLE resource_allocations ALTER COLUMN team_id TYPE BIGINT;
ALTER TABLE resource_allocations ALTER COLUMN allocation_type_id TYPE BIGINT;

-- ── resource_pools (V136) ─────────────────────────────────────────────
ALTER TABLE resource_pools ALTER COLUMN id TYPE BIGINT;
ALTER SEQUENCE IF EXISTS resource_pools_id_seq AS BIGINT;

-- ── resource_pool_members (V136) ──────────────────────────────────────
ALTER TABLE resource_pool_members ALTER COLUMN id TYPE BIGINT;
ALTER SEQUENCE IF EXISTS resource_pool_members_id_seq AS BIGINT;
ALTER TABLE resource_pool_members ALTER COLUMN pool_id TYPE BIGINT;
ALTER TABLE resource_pool_members ALTER COLUMN resource_id TYPE BIGINT;

-- ── demand_requests (V136) ────────────────────────────────────────────
ALTER TABLE demand_requests ALTER COLUMN id TYPE BIGINT;
ALTER SEQUENCE IF EXISTS demand_requests_id_seq AS BIGINT;
ALTER TABLE demand_requests ALTER COLUMN project_id TYPE BIGINT;
ALTER TABLE demand_requests ALTER COLUMN team_id TYPE BIGINT;
ALTER TABLE demand_requests ALTER COLUMN created_by TYPE BIGINT;

-- ── demand_fulfillments (V136) ────────────────────────────────────────
ALTER TABLE demand_fulfillments ALTER COLUMN id TYPE BIGINT;
ALTER SEQUENCE IF EXISTS demand_fulfillments_id_seq AS BIGINT;
ALTER TABLE demand_fulfillments ALTER COLUMN demand_request_id TYPE BIGINT;
ALTER TABLE demand_fulfillments ALTER COLUMN resource_id TYPE BIGINT;
-- Add missing allocation_id column (DemandFulfillment entity has this field)
ALTER TABLE demand_fulfillments ADD COLUMN IF NOT EXISTS allocation_id BIGINT;

-- ── allocation_history (V139) ─────────────────────────────────────────
ALTER TABLE allocation_history ALTER COLUMN id TYPE BIGINT;
ALTER SEQUENCE IF EXISTS allocation_history_id_seq AS BIGINT;
ALTER TABLE allocation_history ALTER COLUMN allocation_id TYPE BIGINT;
ALTER TABLE allocation_history ALTER COLUMN resource_id TYPE BIGINT;
ALTER TABLE allocation_history ALTER COLUMN team_id TYPE BIGINT;
ALTER TABLE allocation_history ALTER COLUMN changed_by TYPE BIGINT;

-- V112: Store the proposed change that triggered the approval request.
-- e.g. "STATUS:PLANNING→ACTIVE" so the system can auto-apply it on APPROVE.

ALTER TABLE project_approval
    ADD COLUMN IF NOT EXISTS proposed_change TEXT;

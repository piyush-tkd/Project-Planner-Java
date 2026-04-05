-- V81: Add avatar_url column to resource table for Jira profile photo sync
ALTER TABLE resource ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);

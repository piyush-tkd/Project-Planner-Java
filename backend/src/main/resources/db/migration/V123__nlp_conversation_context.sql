-- V123: Add context_json column to nlp_conversation to persist multi-turn session memory.
-- Stores a JSON array of {q, a, intent} objects for follow-up context restoration
-- when a user resumes a previous conversation from the history page.

ALTER TABLE nlp_conversation ADD COLUMN IF NOT EXISTS context_json TEXT;

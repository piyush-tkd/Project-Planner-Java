-- V107: Add star rating to user_feedback table
ALTER TABLE user_feedback
    ADD COLUMN IF NOT EXISTS rating SMALLINT CHECK (rating BETWEEN 1 AND 5);

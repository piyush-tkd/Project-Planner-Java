-- V51: Add star rating (1–5) to user feedback
ALTER TABLE user_feedback ADD COLUMN rating SMALLINT;

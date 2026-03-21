-- Add feedback_comment column so users can explain what they expected on thumbs-down
ALTER TABLE nlp_query_log ADD COLUMN feedback_comment TEXT;

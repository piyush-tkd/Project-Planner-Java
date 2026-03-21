-- Add screenshot support for negative feedback (base64 encoded image)
ALTER TABLE nlp_query_log ADD COLUMN feedback_screenshot TEXT;

-- Self-learning enhancements: CONTAINS patterns, confidence decay, corrective learning

-- Add expected_intent so negative feedback can record what the user actually wanted
ALTER TABLE nlp_query_log ADD COLUMN expected_intent VARCHAR(50);

-- Add last_matched_at to track when a pattern was last used (for confidence decay)
ALTER TABLE nlp_learned_pattern ADD COLUMN last_matched_at TIMESTAMP;

-- Add corrective flag — true means this pattern was generated from negative feedback correction
ALTER TABLE nlp_learned_pattern ADD COLUMN corrective BOOLEAN NOT NULL DEFAULT FALSE;

-- Add keywords column for CONTAINS-style matching (comma-separated extracted keywords)
ALTER TABLE nlp_learned_pattern ADD COLUMN keywords TEXT;

-- Track the last auto-learner run timestamp in nlp_config for scheduling
ALTER TABLE nlp_learner_run ADD COLUMN triggered_by VARCHAR(20) NOT NULL DEFAULT 'MANUAL';

-- Add sprint_end_date to sprint_retro_summary so velocity comparisons use
-- actual sprint chronology instead of retro generation timestamp.
ALTER TABLE sprint_retro_summary
    ADD COLUMN IF NOT EXISTS sprint_end_date TIMESTAMP;
